#!/usr/bin/env python3
"""
Stratos Brain - Async Document Embedding Ingestion Script
==========================================================

This is the "Ferrari" version of the ingestion script using asyncio for maximum throughput.

Features:
- Async concurrency with 20 parallel OpenAI requests
- Automatic retry with exponential backoff for rate limits
- Bulk database operations for efficiency
- Progress tracking and resumable processing

Usage:
    pip install openai psycopg2-binary tenacity
    python async_ingest.py --total-docs 5000

Environment Variables:
    OPENAI_API_KEY - Your OpenAI API key
    DB_PASSWORD - Supabase database password (optional, has default)
"""

import asyncio
import os
import sys
import time
import argparse
from typing import List, Dict, Any
from datetime import datetime

try:
    import psycopg2
    from psycopg2.extras import execute_batch
    from openai import AsyncOpenAI
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install openai psycopg2-binary tenacity")
    sys.exit(1)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Database connection (Supabase PostgreSQL)
DB_HOST = "db.wfogbaipiqootjrsprde.supabase.co"
DB_PORT = 5432
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = os.environ.get("DB_PASSWORD", "stratosbrainpostgresdbpw")

# OpenAI
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536

# Chunking parameters
CHUNK_SIZE = 1000        # Characters per chunk (~250 tokens)
CHUNK_OVERLAP = 100      # Overlap between chunks for context

# Performance tuning
MAX_CONCURRENT_REQUESTS = 20   # Parallel OpenAI requests (adjust based on your tier)
CHUNKS_PER_REQUEST = 100       # Chunks per OpenAI API call (max 2048)
DOCS_PER_BATCH = 50            # Documents to fetch from DB at once

# =============================================================================
# VALIDATION
# =============================================================================

if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY environment variable not set")
    print("Set it with: export OPENAI_API_KEY='sk-...'")
    sys.exit(1)

# Initialize async OpenAI client
client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# =============================================================================
# DATABASE HELPERS
# =============================================================================

def get_db_connection():
    """Create a new database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=30
    )

def fetch_unindexed_docs(conn, limit: int = 50, doc_type: str = None, ticker: str = None) -> List[Dict]:
    """Fetch a batch of unindexed documents."""
    query = """
        SELECT id, ticker, doc_type, filing_date, full_text, title
        FROM company_documents 
        WHERE (is_indexed IS NULL OR is_indexed = false)
          AND full_text IS NOT NULL 
          AND LENGTH(full_text) > 100
    """
    params = []
    
    if doc_type:
        query += " AND doc_type = %s"
        params.append(doc_type)
    
    if ticker:
        query += " AND ticker = %s"
        params.append(ticker.upper())
    
    query += " ORDER BY filing_date DESC LIMIT %s"
    params.append(limit)
    
    with conn.cursor() as cur:
        cur.execute(query, params)
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]

def get_pending_count(conn) -> int:
    """Get count of remaining unindexed documents."""
    query = """
        SELECT COUNT(*) FROM company_documents 
        WHERE (is_indexed IS NULL OR is_indexed = false)
          AND full_text IS NOT NULL 
          AND LENGTH(full_text) > 100
    """
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchone()[0]

def mark_docs_indexed(conn, doc_ids: List[str]):
    """Bulk update documents as indexed."""
    if not doc_ids:
        return
    query = "UPDATE company_documents SET is_indexed = true WHERE id IN %s"
    with conn.cursor() as cur:
        cur.execute(query, (tuple(doc_ids),))
    conn.commit()

def bulk_insert_chunks(conn, chunk_data_list: List[tuple]):
    """
    Fast bulk insert using execute_batch.
    
    Expected tuple format:
    (document_id, chunk_index, chunk_type, content, embedding, ticker, doc_type, filing_date)
    """
    if not chunk_data_list:
        return
    
    query = """
        INSERT INTO document_chunks 
        (document_id, chunk_index, chunk_type, content, embedding, ticker, doc_type, filing_date)
        VALUES (%s, %s, %s, %s, %s::vector, %s, %s, %s)
    """
    with conn.cursor() as cur:
        execute_batch(cur, query, chunk_data_list, page_size=500)
    conn.commit()

# =============================================================================
# TEXT CHUNKING
# =============================================================================

def chunk_text(text: str) -> List[str]:
    """
    Split text into chunks respecting natural boundaries.
    Uses paragraph-aware splitting with overlap.
    """
    if not text or len(text) < 50:
        return []
    
    text = text.strip()
    chunks = []
    start_index = 0
    
    while start_index < len(text):
        end_index = start_index + CHUNK_SIZE
        
        # If not at end, find natural break point
        if end_index < len(text):
            # Priority 1: Paragraph break
            break_idx = text.rfind('\n\n', start_index, end_index)
            
            # Priority 2: Line break
            if break_idx == -1 or break_idx <= start_index:
                break_idx = text.rfind('\n', start_index, end_index)
            
            # Priority 3: Sentence end
            if break_idx == -1 or break_idx <= start_index:
                break_idx = text.rfind('. ', start_index, end_index)
                if break_idx != -1:
                    break_idx += 1  # Include the period
            
            if break_idx != -1 and break_idx > start_index:
                end_index = break_idx
        else:
            end_index = len(text)
        
        chunk = text[start_index:end_index].strip()
        
        # Only add meaningful chunks
        if len(chunk) > 50:
            chunks.append(chunk)
        
        # Move forward with overlap
        start_index = max(end_index - CHUNK_OVERLAP, start_index + 1)
        
        if start_index >= len(text):
            break
    
    return chunks

# =============================================================================
# ASYNC EMBEDDING GENERATION
# =============================================================================

@retry(
    wait=wait_exponential(multiplier=1, min=2, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_exception_type(Exception)
)
async def generate_embeddings_async(texts: List[str], semaphore: asyncio.Semaphore) -> List[List[float]]:
    """
    Generate embeddings for a batch of texts using OpenAI API.
    Uses semaphore to limit concurrent requests.
    """
    async with semaphore:
        try:
            # Clean texts for better embedding quality
            clean_texts = [t.replace("\n", " ").strip() for t in texts]
            
            response = await client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=clean_texts
            )
            
            # Sort by index to ensure correct order
            sorted_data = sorted(response.data, key=lambda x: x.index)
            return [item.embedding for item in sorted_data]
            
        except Exception as e:
            if "429" in str(e):
                print(f"  ⏳ Rate limit hit, backing off...")
            raise e

# =============================================================================
# BATCH PROCESSING
# =============================================================================

async def process_batch(conn, documents: List[Dict], semaphore: asyncio.Semaphore) -> Dict[str, int]:
    """
    Process a batch of documents:
    1. Chunk all documents
    2. Generate embeddings in parallel
    3. Bulk insert to database
    4. Mark documents as indexed
    """
    start_time = time.time()
    print(f"\n📄 Processing batch of {len(documents)} documents...")
    
    # 1. Prepare all chunks with metadata
    all_chunk_payloads = []
    doc_ids_processed = []
    
    for doc in documents:
        doc_ids_processed.append(doc['id'])
        text_chunks = chunk_text(doc['full_text'])
        
        for i, text in enumerate(text_chunks):
            payload = {
                'doc_id': doc['id'],
                'ticker': doc['ticker'],
                'doc_type': doc['doc_type'],
                'filing_date': doc['filing_date'],
                'chunk_index': i,
                'text': text
            }
            all_chunk_payloads.append(payload)
    
    if not all_chunk_payloads:
        print("  ⚠️ No chunks generated (documents may be too short)")
        mark_docs_indexed(conn, doc_ids_processed)
        return {'docs': len(documents), 'chunks': 0, 'time': time.time() - start_time}
    
    print(f"  📝 Generated {len(all_chunk_payloads)} chunks")
    
    # 2. Group chunks for OpenAI API calls
    api_batches = [
        all_chunk_payloads[i:i + CHUNKS_PER_REQUEST] 
        for i in range(0, len(all_chunk_payloads), CHUNKS_PER_REQUEST)
    ]
    
    print(f"  🚀 Firing {len(api_batches)} async API requests...")
    
    # 3. Create async tasks for all batches
    tasks = []
    for batch in api_batches:
        texts = [p['text'] for p in batch]
        tasks.append(generate_embeddings_async(texts, semaphore))
    
    # 4. Execute all tasks in parallel
    results = await asyncio.gather(*tasks)
    
    # 5. Reassemble data for database insert
    db_insert_rows = []
    
    for batch_idx, embeddings in enumerate(results):
        original_batch = api_batches[batch_idx]
        
        for i, embedding in enumerate(embeddings):
            info = original_batch[i]
            # Format: (document_id, chunk_index, chunk_type, content, embedding, ticker, doc_type, filing_date)
            row = (
                str(info['doc_id']),
                info['chunk_index'],
                'paragraph',
                info['text'],
                embedding,
                info['ticker'],
                info['doc_type'],
                info['filing_date']
            )
            db_insert_rows.append(row)
    
    # 6. Bulk insert to database
    print(f"  💾 Writing {len(db_insert_rows)} vectors to database...")
    bulk_insert_chunks(conn, db_insert_rows)
    
    # 7. Mark documents as indexed
    mark_docs_indexed(conn, doc_ids_processed)
    
    elapsed = time.time() - start_time
    print(f"  ✅ Batch complete in {elapsed:.1f}s ({len(db_insert_rows)/elapsed:.0f} chunks/sec)")
    
    return {'docs': len(documents), 'chunks': len(db_insert_rows), 'time': elapsed}

# =============================================================================
# MAIN LOOP
# =============================================================================

async def main():
    parser = argparse.ArgumentParser(description='Async document embedding ingestion for Stratos Brain')
    parser.add_argument('--total-docs', type=int, default=1000, 
                        help='Total documents to process in this run (default: 1000)')
    parser.add_argument('--doc-type', type=str, default=None,
                        help='Filter by document type (transcript, 10-K, 10-Q, DEF 14A)')
    parser.add_argument('--ticker', type=str, default=None,
                        help='Filter by ticker symbol')
    parser.add_argument('--concurrency', type=int, default=MAX_CONCURRENT_REQUESTS,
                        help=f'Max concurrent API requests (default: {MAX_CONCURRENT_REQUESTS})')
    args = parser.parse_args()
    
    print("=" * 60)
    print("🧠 Stratos Brain - Async Document Embedding Ingestion")
    print("=" * 60)
    print(f"Target: {args.total_docs} documents")
    print(f"Concurrency: {args.concurrency} parallel requests")
    if args.doc_type:
        print(f"Filter: doc_type = {args.doc_type}")
    if args.ticker:
        print(f"Filter: ticker = {args.ticker}")
    print("=" * 60)
    
    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(args.concurrency)
    
    # Connect to database
    conn = get_db_connection()
    print(f"✅ Connected to database")
    
    # Get initial count
    pending = get_pending_count(conn)
    print(f"📊 Pending documents: {pending:,}")
    
    total_processed = 0
    total_chunks = 0
    start_time = time.time()
    
    try:
        while total_processed < args.total_docs:
            # Fetch batch of documents
            docs = fetch_unindexed_docs(
                conn, 
                limit=DOCS_PER_BATCH,
                doc_type=args.doc_type,
                ticker=args.ticker
            )
            
            if not docs:
                print("\n🎉 No more unindexed documents found!")
                break
            
            # Process the batch
            result = await process_batch(conn, docs, semaphore)
            
            total_processed += result['docs']
            total_chunks += result['chunks']
            
            # Progress update
            elapsed = time.time() - start_time
            rate = total_chunks / elapsed if elapsed > 0 else 0
            remaining = get_pending_count(conn)
            
            print(f"\n📈 Progress: {total_processed}/{args.total_docs} docs | "
                  f"{total_chunks:,} chunks | {rate:.0f} chunks/sec | "
                  f"{remaining:,} remaining")
    
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
    
    finally:
        conn.close()
        
        # Final summary
        elapsed = time.time() - start_time
        print("\n" + "=" * 60)
        print("📊 FINAL SUMMARY")
        print("=" * 60)
        print(f"Documents processed: {total_processed:,}")
        print(f"Chunks created: {total_chunks:,}")
        print(f"Total time: {elapsed/60:.1f} minutes")
        print(f"Average rate: {total_chunks/elapsed:.0f} chunks/sec")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

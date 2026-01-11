#!/usr/bin/env python3
"""
Stratos Brain - Async Document Embedding Ingestion Script V2
=============================================================

This is the "Streaming Queue" version with decoupled OpenAI workers and DB writer.

Architecture:
- The Swarm (OpenAI Workers) keeps firing requests and drops results into a Queue
- The Writer (DB Worker) runs in background, flushing to DB when queue is full

This removes "Stop-and-Go" latency for maximum throughput.

Usage:
    pip install openai psycopg2-binary tenacity
    python async_ingest_v2.py --total-docs 5000

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

# Performance tuning - STREAMING QUEUE MODE
MAX_CONCURRENT_REQUESTS = 100  # Parallel OpenAI requests (your tier: 10K RPM)
CHUNKS_PER_REQUEST = 100       # Chunks per OpenAI API call
DOCS_PER_BATCH = 100           # Documents to fetch from DB at once (larger batches)
WRITE_BATCH_THRESHOLD = 2000   # Flush to DB when queue has this many chunks

# =============================================================================
# VALIDATION
# =============================================================================

if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY environment variable not set")
    print("Set it with: export OPENAI_API_KEY='sk-...'")
    sys.exit(1)

# Initialize async OpenAI client with explicit base URL
client = AsyncOpenAI(
    api_key=OPENAI_API_KEY,
    base_url="https://api.openai.com/v1"
)

# =============================================================================
# GLOBAL COUNTERS (for progress tracking)
# =============================================================================

total_chunks_written = 0
total_chunks_queued = 0

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

def fetch_unindexed_docs(conn, limit: int = 100, doc_type: str = None, ticker: str = None) -> List[Dict]:
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
    
    # CRITICAL: FOR UPDATE SKIP LOCKED enables multi-process parallelism
    # Each worker locks the rows it fetches, other workers get the next batch
    query += " ORDER BY filing_date DESC LIMIT %s FOR UPDATE SKIP LOCKED"
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
    Uses Postgres COPY protocol for maximum throughput.
    """
    global total_chunks_written
    
    if not chunk_data_list:
        return
    
    import io
    
    # Create a memory buffer formatted as TSV
    output = io.StringIO()
    
    for row in chunk_data_list:
        # Sanitize 'content' to remove tabs/newlines that break TSV format
        clean_content = str(row[3]).replace('\t', ' ').replace('\n', '\\n').replace('\r', '')
        # pgvector needs the array formatted as string "[0.1,0.2,...]"
        vector_str = '[' + ','.join(map(str, row[4])) + ']'
        
        line = f"{row[0]}\t{row[1]}\t{row[2]}\t{clean_content}\t{vector_str}\t{row[5]}\t{row[6]}\t{row[7]}\n"
        output.write(line)
    
    output.seek(0)
    
    with conn.cursor() as cur:
        try:
            cur.copy_expert(
                """COPY document_chunks (
                    document_id, chunk_index, chunk_type, content, embedding, ticker, doc_type, filing_date
                   ) FROM STDIN WITH (FORMAT TEXT)""",
                output
            )
            conn.commit()
            total_chunks_written += len(chunk_data_list)
        except Exception as e:
            conn.rollback()
            print(f"COPY Error: {e}")
            raise e

# =============================================================================
# TEXT CHUNKING
# =============================================================================

def chunk_text(text: str) -> List[str]:
    """Split text into chunks respecting natural boundaries."""
    if not text or len(text) < 50:
        return []
    
    text = text.strip()
    chunks = []
    start_index = 0
    
    while start_index < len(text):
        end_index = start_index + CHUNK_SIZE
        
        if end_index < len(text):
            break_idx = text.rfind('\n\n', start_index, end_index)
            if break_idx == -1 or break_idx <= start_index:
                break_idx = text.rfind('\n', start_index, end_index)
            if break_idx == -1 or break_idx <= start_index:
                break_idx = text.rfind('. ', start_index, end_index)
                if break_idx != -1:
                    break_idx += 1
            if break_idx != -1 and break_idx > start_index:
                end_index = break_idx
        else:
            end_index = len(text)
        
        chunk = text[start_index:end_index].strip()
        if len(chunk) > 50:
            chunks.append(chunk)
        
        start_index = max(end_index - CHUNK_OVERLAP, start_index + 1)
        if start_index >= len(text):
            break
    
    return chunks

# =============================================================================
# ASYNC EMBEDDING GENERATION
# =============================================================================

@retry(
    wait=wait_exponential(multiplier=2, min=5, max=120),
    stop=stop_after_attempt(10),
    retry=retry_if_exception_type(Exception)
)
async def generate_embeddings_async(texts: List[str], semaphore: asyncio.Semaphore) -> List[List[float]]:
    """Generate embeddings for a batch of texts using OpenAI API."""
    async with semaphore:
        try:
            clean_texts = [t.replace("\n", " ").strip() for t in texts]
            response = await client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=clean_texts
            )
            sorted_data = sorted(response.data, key=lambda x: x.index)
            return [item.embedding for item in sorted_data]
        except Exception as e:
            if "429" in str(e):
                print(f"  ⏳ Rate limit hit, backing off...")
            raise e

# =============================================================================
# STREAMING QUEUE ARCHITECTURE
# =============================================================================

async def db_writer_worker(conn, queue: asyncio.Queue, stop_event: asyncio.Event, start_time: float):
    """
    Background task that pulls chunks from the queue and writes to DB.
    Flushes when buffer is full OR after timeout.
    """
    global total_chunks_written
    
    buffer = []
    last_write_time = time.time()

    while not stop_event.is_set() or not queue.empty():
        try:
            # Get item with timeout to check time-based flush
            try:
                item = await asyncio.wait_for(queue.get(), timeout=1.0)
                buffer.append(item)
                queue.task_done()
            except asyncio.TimeoutError:
                pass  # Just checking if we need to flush

            current_time = time.time()
            is_full = len(buffer) >= WRITE_BATCH_THRESHOLD
            is_old = len(buffer) > 0 and (current_time - last_write_time > 2.0)
            is_stopping = stop_event.is_set() and len(buffer) > 0
            
            # Flush if full, old, or stopping
            if is_full or is_old or is_stopping:
                if buffer:
                    elapsed = current_time - start_time
                    rate = total_chunks_written / elapsed if elapsed > 0 else 0
                    print(f"  💾 Flushing {len(buffer):,} chunks to DB... (total: {total_chunks_written:,}, rate: {rate:.0f}/sec)")
                    
                    # Run blocking DB write in a separate thread
                    await asyncio.to_thread(bulk_insert_chunks, conn, buffer)
                    last_write_time = time.time()
                    buffer = []
        
        except Exception as e:
            print(f"CRITICAL WRITER ERROR: {e}")
            await asyncio.sleep(1)


async def process_doc_to_queue(doc: Dict, semaphore: asyncio.Semaphore, queue: asyncio.Queue) -> int:
    """
    Chunks a doc and fires OpenAI requests. Puts results into Queue immediately.
    """
    global total_chunks_queued
    
    text_chunks = chunk_text(doc['full_text'])
    if not text_chunks:
        return 0

    # Prepare payloads
    payloads = []
    for i, text in enumerate(text_chunks):
        payloads.append({
            'doc_id': doc['id'],
            'chunk_index': i,
            'text': text,
            'metadata': (doc['ticker'], doc['doc_type'], doc['filing_date'])
        })

    # Group into API batches
    api_batches = [payloads[i:i + CHUNKS_PER_REQUEST] for i in range(0, len(payloads), CHUNKS_PER_REQUEST)]

    # Define the OpenAI task
    async def process_api_batch(batch):
        global total_chunks_queued
        texts = [p['text'] for p in batch]
        
        # Generate Embeddings (Async)
        embeddings = await generate_embeddings_async(texts, semaphore)
        
        # Put results into Queue immediately
        for i, embedding in enumerate(embeddings):
            info = batch[i]
            # Format expected by bulk_insert_chunks
            row = (
                str(info['doc_id']),
                info['chunk_index'],
                'paragraph',
                info['text'],
                embedding,
                info['metadata'][0],  # ticker
                info['metadata'][1],  # doc_type
                info['metadata'][2]   # date
            )
            await queue.put(row)
            total_chunks_queued += 1

    # Fire tasks concurrently
    tasks = [process_api_batch(b) for b in api_batches]
    await asyncio.gather(*tasks)
    return len(text_chunks)

# =============================================================================
# MAIN LOOP
# =============================================================================

async def main():
    global total_chunks_written, total_chunks_queued
    
    parser = argparse.ArgumentParser(description='Async document embedding ingestion V2 (Streaming Queue)')
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
    print("🧠 Stratos Brain - Streaming Queue Ingestion V2")
    print("=" * 60)
    print(f"Target: {args.total_docs} documents")
    print(f"Concurrency: {args.concurrency} parallel requests")
    print(f"Write batch threshold: {WRITE_BATCH_THRESHOLD} chunks")
    if args.doc_type:
        print(f"Filter: doc_type = {args.doc_type}")
    if args.ticker:
        print(f"Filter: ticker = {args.ticker}")
    print("=" * 60)
    
    # Setup
    semaphore = asyncio.Semaphore(args.concurrency)
    write_queue = asyncio.Queue()
    stop_event = asyncio.Event()
    start_time = time.time()
    
    # Separate connections for reader and writer
    writer_conn = get_db_connection()
    reader_conn = get_db_connection()
    
    print(f"✅ Connected to database (2 connections)")
    
    # Get initial count
    pending = get_pending_count(reader_conn)
    print(f"📊 Pending documents: {pending:,}")
    
    # Start the Writer (Consumer) in background
    writer_task = asyncio.create_task(
        db_writer_worker(writer_conn, write_queue, stop_event, start_time)
    )
    
    print(f"\n🚀 Pipeline Started!")
    
    total_processed_docs = 0
    
    try:
        while total_processed_docs < args.total_docs:
            # Fetch Docs
            docs = fetch_unindexed_docs(
                reader_conn, 
                limit=DOCS_PER_BATCH,
                doc_type=args.doc_type,
                ticker=args.ticker
            )
            
            if not docs:
                print("\n🎉 No more unindexed documents found!")
                break
            
            print(f"\n📄 Processing {len(docs)} documents...")
            
            # Fire Processing Tasks (Producer)
            doc_tasks = [process_doc_to_queue(doc, semaphore, write_queue) for doc in docs]
            
            # Wait for the API calls to finish pushing to queue
            # (The writer is still working in background)
            await asyncio.gather(*doc_tasks)
            
            # Mark these docs as done in DB
            doc_ids = [d['id'] for d in docs]
            mark_docs_indexed(reader_conn, doc_ids)
            
            total_processed_docs += len(docs)
            
            elapsed = time.time() - start_time
            rate = total_chunks_written / elapsed if elapsed > 0 else 0
            
            print(f"  📈 Docs: {total_processed_docs}/{args.total_docs} | "
                  f"Queued: {total_chunks_queued:,} | Written: {total_chunks_written:,} | "
                  f"Queue: {write_queue.qsize()} | Rate: {rate:.0f}/sec")

    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user")
    
    finally:
        # Graceful Shutdown
        print("\n⏳ Waiting for writer to finish...")
        stop_event.set()  # Tell writer to stop when empty
        await writer_task  # Wait for queue to drain
        
        writer_conn.close()
        reader_conn.close()
        
        # Final summary
        elapsed = time.time() - start_time
        print("\n" + "=" * 60)
        print("📊 FINAL SUMMARY")
        print("=" * 60)
        print(f"Documents processed: {total_processed_docs:,}")
        print(f"Chunks created: {total_chunks_written:,}")
        print(f"Total time: {elapsed/60:.1f} minutes")
        if elapsed > 0:
            print(f"Average rate: {total_chunks_written/elapsed:.0f} chunks/sec")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

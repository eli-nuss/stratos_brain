#!/usr/bin/env python3
"""
Generate embeddings for document chunks and populate the document_chunks table.
Prioritizes companies by market cap (highest first).

Usage:
    python generate_document_embeddings.py --batch-size 10 --limit 100
    python generate_document_embeddings.py --ticker AAPL  # Process specific ticker
    python generate_document_embeddings.py --continue     # Continue from where it left off
"""

import os
import sys
import argparse
import time
from typing import List, Dict, Optional
import psycopg2
from psycopg2.extras import execute_batch
import openai
from openai import OpenAI

# Database configuration
DB_HOST = "db.wfogbaipiqootjrsprde.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = "stratosbrainpostgresdbpw"

# OpenAI configuration
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY environment variable not set")
    sys.exit(1)

client = OpenAI(api_key=OPENAI_API_KEY)

# Embedding model configuration
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536
CHUNK_SIZE = 1000  # Target characters per chunk
CHUNK_OVERLAP = 200  # Overlap between chunks
BATCH_SIZE = 20  # Number of chunks to embed in one API call


def get_db_connection():
    """Create a database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Split text into overlapping chunks.
    Tries to break at paragraph boundaries when possible.
    """
    if not text or len(text) == 0:
        return []
    
    chunks = []
    
    # Split by double newlines (paragraphs) first
    paragraphs = text.split('\n\n')
    
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        
        # If adding this paragraph would exceed chunk size
        if len(current_chunk) + len(para) + 2 > chunk_size and current_chunk:
            # Save current chunk
            chunks.append(current_chunk.strip())
            
            # Start new chunk with overlap from previous chunk
            if overlap > 0 and len(current_chunk) > overlap:
                current_chunk = current_chunk[-overlap:] + "\n\n" + para
            else:
                current_chunk = para
        else:
            # Add paragraph to current chunk
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para
    
    # Add the last chunk
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    # Handle very long paragraphs that exceed chunk_size
    final_chunks = []
    for chunk in chunks:
        if len(chunk) <= chunk_size * 1.5:  # Allow some flexibility
            final_chunks.append(chunk)
        else:
            # Split long chunk by sentences
            sentences = chunk.split('. ')
            sub_chunk = ""
            for sentence in sentences:
                if len(sub_chunk) + len(sentence) + 2 > chunk_size and sub_chunk:
                    final_chunks.append(sub_chunk.strip())
                    sub_chunk = sentence
                else:
                    if sub_chunk:
                        sub_chunk += ". " + sentence
                    else:
                        sub_chunk = sentence
            if sub_chunk:
                final_chunks.append(sub_chunk.strip())
    
    return final_chunks


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a batch of texts using OpenAI API."""
    try:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        raise


def get_unindexed_documents(conn, ticker: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
    """
    Fetch unindexed documents ordered by market cap (highest first).
    """
    cursor = conn.cursor()
    
    query = """
        SELECT 
            cd.id,
            cd.ticker,
            cd.doc_type,
            cd.filing_date,
            cd.fiscal_year,
            cd.fiscal_quarter,
            cd.full_text,
            cd.word_count,
            a.asset_id,
            em.market_cap
        FROM company_documents cd
        JOIN assets a ON cd.ticker = a.symbol
        LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
        WHERE cd.status = 'active'
          AND (cd.is_indexed IS NULL OR cd.is_indexed = false)
          AND cd.full_text IS NOT NULL
          AND LENGTH(cd.full_text) > 100
    """
    
    params = []
    
    if ticker:
        query += " AND cd.ticker = %s"
        params.append(ticker)
    
    # Order by market cap (highest first), then by filing date (newest first)
    query += """
        ORDER BY 
            COALESCE(em.market_cap, 0) DESC,
            cd.filing_date DESC
    """
    
    if limit:
        query += " LIMIT %s"
        params.append(limit)
    
    cursor.execute(query, params)
    
    columns = [desc[0] for desc in cursor.description]
    documents = []
    
    for row in cursor.fetchall():
        doc = dict(zip(columns, row))
        documents.append(doc)
    
    cursor.close()
    return documents


def process_document(conn, document: Dict) -> int:
    """
    Process a single document: chunk it, generate embeddings, and insert into database.
    Returns the number of chunks created.
    """
    doc_id = document['id']
    ticker = document['ticker']
    doc_type = document['doc_type']
    full_text = document['full_text']
    filing_date = document['filing_date']
    
    print(f"\n  Processing: {ticker} {doc_type} ({filing_date}) - {len(full_text):,} chars")
    
    # Chunk the document
    chunks = chunk_text(full_text)
    print(f"    Created {len(chunks)} chunks")
    
    if len(chunks) == 0:
        print(f"    WARNING: No chunks created for document {doc_id}")
        return 0
    
    # Generate embeddings in batches
    all_embeddings = []
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        print(f"    Generating embeddings for chunks {i+1}-{min(i+BATCH_SIZE, len(chunks))}...")
        
        try:
            embeddings = generate_embeddings(batch)
            all_embeddings.extend(embeddings)
            time.sleep(0.1)  # Rate limiting
        except Exception as e:
            print(f"    ERROR generating embeddings: {e}")
            return 0
    
    # Insert chunks into database
    cursor = conn.cursor()
    
    insert_query = """
        INSERT INTO document_chunks (
            document_id,
            chunk_index,
            chunk_type,
            content,
            embedding,
            ticker,
            doc_type,
            filing_date
        ) VALUES (
            %s, %s, %s, %s, %s::vector, %s, %s, %s
        )
    """
    
    chunk_data = [
        (
            doc_id,
            idx,
            'paragraph',
            chunk,
            str(embedding),  # Convert list to string for pgvector
            ticker,
            doc_type,
            filing_date
        )
        for idx, (chunk, embedding) in enumerate(zip(chunks, all_embeddings))
    ]
    
    try:
        execute_batch(cursor, insert_query, chunk_data)
        conn.commit()
        print(f"    ✓ Inserted {len(chunk_data)} chunks into database")
    except Exception as e:
        conn.rollback()
        print(f"    ERROR inserting chunks: {e}")
        cursor.close()
        return 0
    
    # Mark document as indexed
    try:
        cursor.execute(
            "UPDATE company_documents SET is_indexed = true WHERE id = %s",
            (doc_id,)
        )
        conn.commit()
        print(f"    ✓ Marked document as indexed")
    except Exception as e:
        conn.rollback()
        print(f"    ERROR marking document as indexed: {e}")
    
    cursor.close()
    return len(chunks)


def main():
    parser = argparse.ArgumentParser(description="Generate embeddings for document chunks")
    parser.add_argument("--ticker", type=str, help="Process documents for specific ticker only")
    parser.add_argument("--limit", type=int, help="Limit number of documents to process")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of documents to process in one run")
    parser.add_argument("--continue", dest="continue_mode", action="store_true", help="Continue from where it left off")
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("Document Embedding Generation Script")
    print("=" * 80)
    print(f"Embedding Model: {EMBEDDING_MODEL}")
    print(f"Chunk Size: {CHUNK_SIZE} characters")
    print(f"Chunk Overlap: {CHUNK_OVERLAP} characters")
    print(f"Batch Size: {BATCH_SIZE} chunks per API call")
    print("=" * 80)
    
    # Connect to database
    try:
        conn = get_db_connection()
        print("✓ Connected to database")
    except Exception as e:
        print(f"ERROR: Could not connect to database: {e}")
        sys.exit(1)
    
    # Get statistics
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            COUNT(*) as total_docs,
            COUNT(CASE WHEN is_indexed = true THEN 1 END) as indexed_docs,
            COUNT(CASE WHEN is_indexed = false OR is_indexed IS NULL THEN 1 END) as unindexed_docs
        FROM company_documents 
        WHERE status = 'active'
    """)
    stats = cursor.fetchone()
    total_docs, indexed_docs, unindexed_docs = stats
    cursor.close()
    
    print(f"\nDocument Statistics:")
    print(f"  Total documents: {total_docs:,}")
    print(f"  Indexed: {indexed_docs:,}")
    print(f"  Unindexed: {unindexed_docs:,}")
    print(f"  Progress: {indexed_docs/total_docs*100:.1f}%")
    
    # Get documents to process
    limit = args.batch_size if not args.limit else min(args.batch_size, args.limit)
    documents = get_unindexed_documents(conn, ticker=args.ticker, limit=limit)
    
    if len(documents) == 0:
        print("\n✓ No documents to process. All documents are indexed!")
        conn.close()
        return
    
    print(f"\nProcessing {len(documents)} documents (ordered by market cap)...")
    
    # Process each document
    total_chunks = 0
    successful_docs = 0
    start_time = time.time()
    
    for i, doc in enumerate(documents, 1):
        print(f"\n[{i}/{len(documents)}] {doc['ticker']} - Market Cap: ${doc['market_cap']/1e9:.2f}B" if doc['market_cap'] else f"\n[{i}/{len(documents)}] {doc['ticker']}")
        
        try:
            chunks_created = process_document(conn, doc)
            if chunks_created > 0:
                total_chunks += chunks_created
                successful_docs += 1
        except Exception as e:
            print(f"  ERROR processing document: {e}")
            continue
    
    elapsed_time = time.time() - start_time
    
    # Final statistics
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Documents processed: {successful_docs}/{len(documents)}")
    print(f"Total chunks created: {total_chunks:,}")
    print(f"Time elapsed: {elapsed_time:.1f} seconds")
    print(f"Average time per document: {elapsed_time/len(documents):.1f} seconds")
    
    if unindexed_docs - successful_docs > 0:
        print(f"\nRemaining documents: {unindexed_docs - successful_docs:,}")
        print("Run the script again to continue processing.")
    else:
        print("\n✓ All documents have been indexed!")
    
    conn.close()


if __name__ == "__main__":
    main()

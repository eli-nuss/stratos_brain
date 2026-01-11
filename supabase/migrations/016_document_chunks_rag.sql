-- Migration: 016_document_chunks_rag.sql
-- Description: Enable RAG (Retrieval-Augmented Generation) for document search
-- This prevents memory crashes by searching chunks instead of loading full documents

-- ============================================================================
-- ENABLE PGVECTOR EXTENSION
-- ============================================================================
-- pgvector enables storing and searching vector embeddings in PostgreSQL

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- DOCUMENT CHUNKS TABLE
-- ============================================================================
-- Stores chunked paragraphs from company documents with their embeddings
-- Each document is split into ~500 token chunks with overlap for context

CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Parent document reference
    document_id UUID NOT NULL REFERENCES public.company_documents(id) ON DELETE CASCADE,
    
    -- Chunk metadata
    chunk_index INTEGER NOT NULL,  -- Position within the document (0-indexed)
    chunk_type TEXT DEFAULT 'paragraph',  -- 'paragraph', 'section_header', 'table', 'list'
    
    -- Content
    content TEXT NOT NULL,  -- The actual paragraph/chunk text
    token_count INTEGER,    -- Approximate token count for context window management
    
    -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
    embedding vector(1536),
    
    -- Denormalized fields for faster filtering (avoid joins in hot path)
    ticker TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    filing_date DATE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR DOCUMENT CHUNKS
-- ============================================================================

-- Primary lookup: by document
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
ON public.document_chunks (document_id);

-- Filter by ticker (most common filter)
CREATE INDEX IF NOT EXISTS idx_document_chunks_ticker 
ON public.document_chunks (ticker);

-- Filter by ticker + doc_type
CREATE INDEX IF NOT EXISTS idx_document_chunks_ticker_type 
ON public.document_chunks (ticker, doc_type);

-- HNSW index for fast approximate nearest neighbor search on embeddings
-- This is the key index for semantic search performance
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- SEMANTIC SEARCH FUNCTION
-- ============================================================================
-- This function performs semantic search across document chunks
-- Returns the most relevant paragraphs for a given query embedding

CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    filter_ticker text DEFAULT NULL,
    filter_doc_type text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    similarity float,
    document_id uuid,
    ticker text,
    doc_type text,
    filing_date date,
    chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity,
        dc.document_id,
        dc.ticker,
        dc.doc_type,
        dc.filing_date,
        dc.chunk_index
    FROM public.document_chunks dc
    WHERE 
        -- Similarity threshold filter
        1 - (dc.embedding <=> query_embedding) > match_threshold
        -- Optional ticker filter
        AND (filter_ticker IS NULL OR dc.ticker = filter_ticker)
        -- Optional doc_type filter
        AND (filter_doc_type IS NULL OR dc.doc_type = filter_doc_type)
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- SEARCH WITH DOCUMENT CONTEXT FUNCTION
-- ============================================================================
-- Enhanced version that joins with company_documents for full context

CREATE OR REPLACE FUNCTION search_company_documents(
    query_embedding vector(1536),
    filter_ticker text,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    filter_doc_type text DEFAULT NULL
)
RETURNS TABLE (
    chunk_id uuid,
    content text,
    similarity float,
    document_title text,
    doc_type text,
    filing_date date,
    fiscal_year int,
    fiscal_quarter int,
    source_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id AS chunk_id,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity,
        cd.title AS document_title,
        dc.doc_type,
        dc.filing_date,
        cd.fiscal_year,
        cd.fiscal_quarter,
        cd.source_url
    FROM public.document_chunks dc
    JOIN public.company_documents cd ON dc.document_id = cd.id
    WHERE 
        dc.ticker = filter_ticker
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
        AND (filter_doc_type IS NULL OR dc.doc_type = filter_doc_type)
        AND cd.status = 'active'
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- HELPER FUNCTION: Estimate token count
-- ============================================================================
-- Rough estimate: ~4 characters per token for English text

CREATE OR REPLACE FUNCTION estimate_tokens(text_content text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CEIL(LENGTH(text_content) / 4.0)::integer;
$$;

-- ============================================================================
-- TRIGGER: Auto-calculate token count on insert
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_chunk_tokens()
RETURNS TRIGGER AS $$
BEGIN
    NEW.token_count = estimate_tokens(NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_chunk_tokens ON public.document_chunks;
CREATE TRIGGER trigger_calculate_chunk_tokens
    BEFORE INSERT OR UPDATE OF content ON public.document_chunks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_chunk_tokens();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.document_chunks IS 'Chunked paragraphs from company documents with vector embeddings for RAG';
COMMENT ON COLUMN public.document_chunks.embedding IS 'Vector embedding (1536 dims) for semantic search using OpenAI text-embedding-3-small';
COMMENT ON FUNCTION match_document_chunks IS 'Semantic search function - finds most relevant document chunks for a query';
COMMENT ON FUNCTION search_company_documents IS 'Enhanced semantic search with full document context';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.document_chunks TO anon, authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_company_documents TO anon, authenticated;

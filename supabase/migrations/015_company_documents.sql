-- Migration: 015_company_documents.sql
-- Description: Create table for storing SEC filings and earnings transcripts
-- This enables the "Universal Analyst" feature for deep document analysis

-- ============================================================================
-- COMPANY DOCUMENTS TABLE
-- ============================================================================
-- Stores full text of SEC filings (10-K, 10-Q, 8-K) and earnings transcripts
-- Pre-fetched via FMP API for fast retrieval during chat sessions

CREATE TABLE IF NOT EXISTS public.company_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Asset identification
    ticker TEXT NOT NULL,
    asset_id INTEGER REFERENCES public.assets(asset_id),
    
    -- Document metadata
    doc_type TEXT NOT NULL CHECK (doc_type IN ('10-K', '10-Q', '8-K', 'transcript', 'earnings_release')),
    filing_date DATE NOT NULL,
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,  -- NULL for annual filings
    
    -- Document content
    title TEXT,
    full_text TEXT NOT NULL,  -- The complete document text (cleaned/markdown)
    summary TEXT,  -- AI-generated summary (optional, for quick context)
    
    -- Source tracking
    source_url TEXT,
    source_api TEXT DEFAULT 'fmp',  -- 'fmp', 'sec_edgar', 'manual'
    
    -- Processing metadata
    word_count INTEGER,
    char_count INTEGER,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'error')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup: ticker + document type + date
CREATE INDEX IF NOT EXISTS idx_company_documents_ticker_type_date 
ON public.company_documents (ticker, doc_type, filing_date DESC);

-- For finding documents by asset_id
CREATE INDEX IF NOT EXISTS idx_company_documents_asset_id 
ON public.company_documents (asset_id) WHERE asset_id IS NOT NULL;

-- For finding recent documents
CREATE INDEX IF NOT EXISTS idx_company_documents_filing_date 
ON public.company_documents (filing_date DESC);

-- For full-text search on document content
CREATE INDEX IF NOT EXISTS idx_company_documents_fulltext 
ON public.company_documents USING gin(to_tsvector('english', full_text));

-- Unique constraint to prevent duplicate filings
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_documents_unique_filing 
ON public.company_documents (ticker, doc_type, filing_date);

-- ============================================================================
-- DOCUMENT INGESTION LOG TABLE
-- ============================================================================
-- Tracks ingestion runs for monitoring and debugging

CREATE TABLE IF NOT EXISTS public.document_ingestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Run metadata
    run_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Stats
    tickers_processed INTEGER DEFAULT 0,
    documents_fetched INTEGER DEFAULT 0,
    documents_inserted INTEGER DEFAULT 0,
    documents_skipped INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    
    -- Details
    error_details JSONB,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_log_run 
ON public.document_ingestion_log (run_id, started_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on any change
CREATE OR REPLACE FUNCTION update_company_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_documents_updated_at ON public.company_documents;
CREATE TRIGGER trigger_company_documents_updated_at
    BEFORE UPDATE ON public.company_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_company_documents_updated_at();

-- Auto-calculate word and char count on insert/update
CREATE OR REPLACE FUNCTION calculate_document_stats()
RETURNS TRIGGER AS $$
BEGIN
    NEW.char_count = LENGTH(NEW.full_text);
    NEW.word_count = array_length(regexp_split_to_array(NEW.full_text, '\s+'), 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_document_stats ON public.company_documents;
CREATE TRIGGER trigger_calculate_document_stats
    BEFORE INSERT OR UPDATE OF full_text ON public.company_documents
    FOR EACH ROW
    EXECUTE FUNCTION calculate_document_stats();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.company_documents IS 'Stores full text of SEC filings and earnings transcripts for AI analysis';
COMMENT ON TABLE public.document_ingestion_log IS 'Audit log for document ingestion runs';

COMMENT ON COLUMN public.company_documents.ticker IS 'Stock ticker symbol (e.g., AAPL, GOOGL)';
COMMENT ON COLUMN public.company_documents.doc_type IS 'Type of document: 10-K (annual), 10-Q (quarterly), 8-K (current), transcript (earnings call)';
COMMENT ON COLUMN public.company_documents.full_text IS 'Complete document text, cleaned and formatted as markdown';
COMMENT ON COLUMN public.company_documents.summary IS 'Optional AI-generated summary for quick context injection';

-- Migration: 006_asset_ai_reviews.sql
-- Description: Create asset_ai_reviews table for Stage 5 AI Chart Review

-- Create the asset_ai_reviews table
CREATE TABLE IF NOT EXISTS asset_ai_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Asset identification
    asset_id TEXT NOT NULL,
    as_of_date DATE NOT NULL,
    universe_id TEXT NOT NULL,
    config_id UUID NOT NULL,
    
    -- Source scope (which dashboard view triggered this review)
    source_scope TEXT NOT NULL CHECK (source_scope IN ('inflections_bullish', 'inflections_bearish', 'trends', 'risk')),
    
    -- Model and prompt versioning
    prompt_version TEXT NOT NULL,
    model TEXT NOT NULL,
    
    -- Input hash for idempotency/caching
    input_hash TEXT NOT NULL,
    
    -- Review content
    review_json JSONB NOT NULL,
    summary_text TEXT,
    
    -- Denormalized fields for fast filtering
    attention_level TEXT CHECK (attention_level IN ('URGENT', 'FOCUS', 'WATCH', 'IGNORE')),
    direction TEXT CHECK (direction IN ('bullish', 'bearish', 'neutral')),
    setup_type TEXT CHECK (setup_type IN ('breakout', 'reversal', 'continuation', 'breakdown', 'range', 'mean_reversion', 'unclear')),
    confidence DOUBLE PRECISION,
    
    -- Token usage tracking
    tokens_in INTEGER,
    tokens_out INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique constraint for idempotency
-- Only one review per asset/date/universe/config/scope/prompt_version combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_ai_reviews_unique 
ON asset_ai_reviews (asset_id, as_of_date, universe_id, config_id, source_scope, prompt_version);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_asset_ai_reviews_date_scope 
ON asset_ai_reviews (as_of_date, source_scope);

CREATE INDEX IF NOT EXISTS idx_asset_ai_reviews_date_universe_config 
ON asset_ai_reviews (as_of_date, universe_id, config_id);

CREATE INDEX IF NOT EXISTS idx_asset_ai_reviews_attention_confidence 
ON asset_ai_reviews (attention_level, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_asset_ai_reviews_asset_date 
ON asset_ai_reviews (asset_id, as_of_date DESC);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_asset_ai_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_asset_ai_reviews_updated_at ON asset_ai_reviews;
CREATE TRIGGER trigger_asset_ai_reviews_updated_at
    BEFORE UPDATE ON asset_ai_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_asset_ai_reviews_updated_at();

-- Add comment for documentation
COMMENT ON TABLE asset_ai_reviews IS 'Stores AI-generated chart reviews for assets surfaced by dashboard views (Stage 5)';
COMMENT ON COLUMN asset_ai_reviews.source_scope IS 'Which dashboard view triggered this review: inflections_bullish, inflections_bearish, trends, or risk';
COMMENT ON COLUMN asset_ai_reviews.input_hash IS 'Hash of input data (OHLCV, signals, scores) for caching/idempotency';
COMMENT ON COLUMN asset_ai_reviews.attention_level IS 'Denormalized from review_json for fast filtering: URGENT, FOCUS, WATCH, IGNORE';
COMMENT ON COLUMN asset_ai_reviews.confidence IS 'Model confidence score 0-1, denormalized from review_json';

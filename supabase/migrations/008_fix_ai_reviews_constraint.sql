-- Migration: 008_fix_ai_reviews_constraint.sql
-- Description: Update unique constraint on asset_ai_reviews to match code expectation (asset_id, as_of_date, input_hash)

-- Drop existing unique index if it exists
DROP INDEX IF EXISTS idx_asset_ai_reviews_unique;

-- Create new unique index that matches the ON CONFLICT clause in the code
-- ON CONFLICT (asset_id, as_of_date, input_hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_ai_reviews_unique_hash 
ON asset_ai_reviews (asset_id, as_of_date, input_hash);

-- Also add columns that might be missing based on the INSERT statement
ALTER TABLE asset_ai_reviews 
ADD COLUMN IF NOT EXISTS scope TEXT,
ADD COLUMN IF NOT EXISTS entry JSONB,
ADD COLUMN IF NOT EXISTS targets JSONB,
ADD COLUMN IF NOT EXISTS invalidation NUMERIC,
ADD COLUMN IF NOT EXISTS support JSONB,
ADD COLUMN IF NOT EXISTS resistance JSONB,
ADD COLUMN IF NOT EXISTS pass1_review JSONB;

-- Backfill scope from source_scope if needed
UPDATE asset_ai_reviews SET scope = source_scope WHERE scope IS NULL;

-- Handle any remaining NULL scopes by defaulting to 'unknown' or source_scope
UPDATE asset_ai_reviews SET scope = 'unknown' WHERE scope IS NULL;

-- Make scope NOT NULL after backfill
ALTER TABLE asset_ai_reviews ALTER COLUMN scope SET NOT NULL;

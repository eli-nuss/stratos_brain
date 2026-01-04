-- Migration to add V2 AI Scoring columns and versioning to asset_ai_reviews

-- 1. Add new columns to asset_ai_reviews
ALTER TABLE asset_ai_reviews
ADD COLUMN ai_review_version TEXT NOT NULL DEFAULT 'v1.0',
ADD COLUMN fingerprint TEXT,
ADD COLUMN similarity_to_prev DOUBLE PRECISION,
ADD COLUMN raw_ai_setup_quality_score DOUBLE PRECISION,
ADD COLUMN smoothed_ai_setup_quality_score DOUBLE PRECISION,
ADD COLUMN raw_ai_direction_score DOUBLE PRECISION,
ADD COLUMN smoothed_ai_direction_score DOUBLE PRECISION,
ADD COLUMN subscores JSONB;

-- Update existing rows to the default version
UPDATE asset_ai_reviews SET ai_review_version = 'v1.0' WHERE ai_review_version IS NULL;

-- 2. Drop old unique constraint
ALTER TABLE asset_ai_reviews
DROP CONSTRAINT IF EXISTS asset_ai_reviews_asset_id_as_of_date_key;

-- 3. Add new unique constraint including the version
ALTER TABLE asset_ai_reviews
ADD CONSTRAINT asset_ai_reviews_unique_versioned UNIQUE (asset_id, as_of_date, ai_review_version);

-- 4. Update v_dashboard_all_assets view
-- Drop existing view
DROP VIEW IF EXISTS v_dashboard_all_assets;

-- Recreate view to include new smoothed scores and select the latest version
CREATE OR REPLACE VIEW v_dashboard_all_assets AS
SELECT
    ds.asset_id,
    ds.as_of_date,
    ds.weighted_score,
    ds.score_delta,
    ds.inflection_score,
    ds.signal_category,
    ds.setup_type,
    ds.attention_level,
    a.symbol,
    a.name,
    a.asset_type,
    -- Select the latest AI review based on version and created_at
    (
        SELECT row_to_json(r)
        FROM asset_ai_reviews r
        WHERE r.asset_id = ds.asset_id AND r.as_of_date = ds.as_of_date
        ORDER BY r.ai_review_version DESC, r.created_at DESC
        LIMIT 1
    ) AS latest_review,
    -- Expose the new smoothed scores for easy access and sorting
    (
        SELECT r.smoothed_ai_setup_quality_score
        FROM asset_ai_reviews r
        WHERE r.asset_id = ds.asset_id AND r.as_of_date = ds.as_of_date
        ORDER BY r.ai_review_version DESC, r.created_at DESC
        LIMIT 1
    ) AS ai_setup_quality_score,
    (
        SELECT r.smoothed_ai_direction_score
        FROM asset_ai_reviews r
        WHERE r.asset_id = ds.asset_id AND r.as_of_date = ds.as_of_date
        ORDER BY r.ai_review_version DESC, r.created_at DESC
        LIMIT 1
    ) AS ai_direction_score,
    (
        SELECT r.ai_confidence
        FROM asset_ai_reviews r
        WHERE r.asset_id = ds.asset_id AND r.as_of_date = ds.as_of_date
        ORDER BY r.ai_review_version DESC, r.created_at DESC
        LIMIT 1
    ) AS ai_confidence
FROM
    daily_scores ds
JOIN
    assets a ON ds.asset_id = a.asset_id;

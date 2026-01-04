-- Migration: 007_dashboard_liquidity_ai.sql
-- Description: Add liquidity gates to dashboard views and join AI review fields
-- Date: 2026-01-03

-- Define liquidity thresholds as a function for easy tuning
CREATE OR REPLACE FUNCTION get_liquidity_threshold(asset_type_param VARCHAR)
RETURNS NUMERIC AS $$
BEGIN
    CASE asset_type_param
        WHEN 'equity' THEN RETURN 5000000;  -- $5M for equities
        WHEN 'crypto' THEN RETURN 2000000;  -- $2M for crypto
        ELSE RETURN 1000000;  -- $1M default
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to resolve latest date by asset type
CREATE OR REPLACE FUNCTION resolve_latest_date(asset_type_param VARCHAR DEFAULT NULL)
RETURNS DATE AS $$
DECLARE
    latest DATE;
BEGIN
    IF asset_type_param = 'equity' THEN
        -- For equities: latest trading day
        SELECT MAX(date) INTO latest
        FROM daily_features df
        JOIN assets a ON df.asset_id = a.asset_id
        WHERE a.asset_type = 'equity';
    ELSIF asset_type_param = 'crypto' THEN
        -- For crypto: latest UTC day
        SELECT MAX(date) INTO latest
        FROM daily_features df
        JOIN assets a ON df.asset_id = a.asset_id
        WHERE a.asset_type = 'crypto';
    ELSE
        -- Default: latest date across all
        SELECT MAX(date) INTO latest FROM daily_features;
    END IF;
    RETURN latest;
END;
$$ LANGUAGE plpgsql STABLE;

-- Drop existing views to recreate with liquidity gates
DROP VIEW IF EXISTS v_dashboard_risk CASCADE;
DROP VIEW IF EXISTS v_dashboard_trends CASCADE;
DROP VIEW IF EXISTS v_dashboard_inflections CASCADE;
DROP VIEW IF EXISTS v_dashboard_base CASCADE;

-- Base view with liquidity gate and AI fields
-- Note: asset_id types vary (text in daily_asset_scores, bigint in assets/daily_features)
CREATE OR REPLACE VIEW v_dashboard_base AS
SELECT 
    das.as_of_date,
    das.universe_id,
    das.config_id,
    das.asset_id,
    a.symbol,
    a.name,
    a.asset_type,
    das.weighted_score,
    das.score_total,
    das.score_bullish,
    das.score_bearish,
    das.score_delta,
    das.new_signal_count,
    das.inflection_score,
    das.rank_in_universe,
    das.components,
    df.dollar_volume_sma_20,
    df.close,
    df.rs_vs_benchmark,
    -- AI Review fields (joined from asset_ai_reviews)
    air.attention_level,
    air.direction as ai_direction,
    air.setup_type,
    air.summary_text,
    air.confidence as ai_confidence,
    air.entry,
    air.targets,
    air.invalidation,
    air.support,
    air.resistance,
    air.scope as ai_scope,
    air.review_json,
    air.created_at as reviewed_at
FROM daily_asset_scores das
JOIN assets a ON das.asset_id::bigint = a.asset_id
LEFT JOIN daily_features df ON das.asset_id::bigint = df.asset_id 
    AND das.as_of_date = df.date
LEFT JOIN asset_ai_reviews air ON das.asset_id = air.asset_id
    AND das.as_of_date = air.as_of_date
    AND das.config_id = air.config_id
-- Liquidity gate: filter out illiquid assets
WHERE df.dollar_volume_sma_20 >= get_liquidity_threshold(a.asset_type);

-- Inflections view: New breakouts/reversals (high novelty)
CREATE OR REPLACE VIEW v_dashboard_inflections AS
WITH delta_stats AS (
    SELECT 
        universe_id,
        config_id,
        as_of_date,
        percentile_cont(0.90) WITHIN GROUP (ORDER BY abs(score_delta)) as delta_threshold
    FROM daily_asset_scores
    GROUP BY universe_id, config_id, as_of_date
)
SELECT 
    vdb.*,
    CASE WHEN vdb.weighted_score > 0 THEN 'bullish' ELSE 'bearish' END as inflection_direction,
    abs(vdb.inflection_score) as abs_inflection
FROM v_dashboard_base vdb
JOIN delta_stats ds ON vdb.universe_id = ds.universe_id 
    AND vdb.config_id = ds.config_id 
    AND vdb.as_of_date = ds.as_of_date
WHERE vdb.new_signal_count > 0 
   OR abs(vdb.score_delta) >= ds.delta_threshold
ORDER BY abs(vdb.inflection_score) DESC;

-- Trends view: Ongoing bullish trends (ACTIVE signals, no new signals)
CREATE OR REPLACE VIEW v_dashboard_trends AS
SELECT vdb.*
FROM v_dashboard_base vdb
WHERE vdb.weighted_score > 0
  AND vdb.new_signal_count = 0
  AND EXISTS (
      SELECT 1 FROM signal_instances si
      WHERE si.asset_id = vdb.asset_id::bigint
        AND si.state = 'active'
        AND si.direction = 'bullish'
        AND si.last_seen_at = vdb.as_of_date
        AND si.config_id = vdb.config_id
  )
ORDER BY vdb.weighted_score DESC;

-- Risk view: Bearish setups and breakdown risk
CREATE OR REPLACE VIEW v_dashboard_risk AS
WITH delta_stats AS (
    SELECT 
        universe_id,
        config_id,
        as_of_date,
        percentile_cont(0.90) WITHIN GROUP (ORDER BY abs(score_delta)) as delta_threshold
    FROM daily_asset_scores
    GROUP BY universe_id, config_id, as_of_date
)
SELECT vdb.*
FROM v_dashboard_base vdb
JOIN delta_stats ds ON vdb.universe_id = ds.universe_id 
    AND vdb.config_id = ds.config_id 
    AND vdb.as_of_date = ds.as_of_date
WHERE vdb.weighted_score < 0
  AND (
      vdb.new_signal_count > 0
      OR vdb.score_delta < -ds.delta_threshold
      OR EXISTS (
          SELECT 1 FROM signal_instances si
          WHERE si.asset_id = vdb.asset_id::bigint
            AND si.state IN ('new', 'active')
            AND si.direction = 'bearish'
            AND si.last_seen_at = vdb.as_of_date
            AND si.config_id = vdb.config_id
      )
  )
ORDER BY vdb.weighted_score ASC, vdb.score_delta ASC;

-- Create index for faster AI review lookups
CREATE INDEX IF NOT EXISTS idx_ai_reviews_lookup 
ON asset_ai_reviews(asset_id, as_of_date, config_id);

-- Create index for attention level filtering
CREATE INDEX IF NOT EXISTS idx_ai_reviews_attention 
ON asset_ai_reviews(attention_level, as_of_date);

COMMENT ON FUNCTION get_liquidity_threshold IS 'Returns the minimum 20D avg dollar volume threshold for eligibility by asset type';
COMMENT ON FUNCTION resolve_latest_date IS 'Returns the latest available date for a given asset type (equity uses trading days, crypto uses UTC days)';

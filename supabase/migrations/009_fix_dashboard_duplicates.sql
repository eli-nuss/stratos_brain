-- Migration: 009_fix_dashboard_duplicates.sql
-- Description: Fix row duplication by filtering AI reviews by scope in dashboard views
-- Date: 2026-01-03

-- Drop existing views to recreate
DROP VIEW IF EXISTS v_dashboard_risk CASCADE;
DROP VIEW IF EXISTS v_dashboard_trends CASCADE;
DROP VIEW IF EXISTS v_dashboard_inflections CASCADE;
DROP VIEW IF EXISTS v_dashboard_base CASCADE;

-- Base view WITHOUT AI fields (to avoid cross-product join)
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
    df.rs_vs_benchmark
FROM daily_asset_scores das
JOIN assets a ON das.asset_id::bigint = a.asset_id
LEFT JOIN daily_features df ON das.asset_id::bigint = df.asset_id 
    AND das.as_of_date = df.date
-- Liquidity gate: filter out illiquid assets
WHERE df.dollar_volume_sma_20 >= get_liquidity_threshold(a.asset_type);

-- Inflections view: Join AI reviews with scope='inflections_bullish' or 'inflections_bearish'
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
    abs(vdb.inflection_score) as abs_inflection,
    -- AI Review fields
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
FROM v_dashboard_base vdb
JOIN delta_stats ds ON vdb.universe_id = ds.universe_id 
    AND vdb.config_id = ds.config_id 
    AND vdb.as_of_date = ds.as_of_date
LEFT JOIN asset_ai_reviews air ON vdb.asset_id = air.asset_id
    AND vdb.as_of_date = air.as_of_date
    AND vdb.config_id = air.config_id
    AND air.scope IN ('inflections_bullish', 'inflections_bearish') -- Strict scope filter
WHERE vdb.new_signal_count > 0 
   OR abs(vdb.score_delta) >= ds.delta_threshold
ORDER BY abs(vdb.inflection_score) DESC;

-- Trends view: Join AI reviews with scope='trends'
CREATE OR REPLACE VIEW v_dashboard_trends AS
SELECT 
    vdb.*,
    -- AI Review fields
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
FROM v_dashboard_base vdb
LEFT JOIN asset_ai_reviews air ON vdb.asset_id = air.asset_id
    AND vdb.as_of_date = air.as_of_date
    AND vdb.config_id = air.config_id
    AND air.scope = 'trends' -- Strict scope filter
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

-- Risk view: Join AI reviews with scope='risk'
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
SELECT 
    vdb.*,
    -- AI Review fields
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
FROM v_dashboard_base vdb
JOIN delta_stats ds ON vdb.universe_id = ds.universe_id 
    AND vdb.config_id = ds.config_id 
    AND vdb.as_of_date = ds.as_of_date
LEFT JOIN asset_ai_reviews air ON vdb.asset_id = air.asset_id
    AND vdb.as_of_date = air.as_of_date
    AND vdb.config_id = air.config_id
    AND air.scope = 'risk' -- Strict scope filter
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

-- Migration: 005_dashboard_views.sql
-- Description: Create dashboard views for inflections, trends, and risk
-- Date: 2026-01-03

-- Base view joining scores with asset metadata
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
JOIN assets a ON das.asset_id::text = a.asset_id::text
LEFT JOIN daily_features df ON das.asset_id::text = df.asset_id::text 
    AND das.as_of_date = df.date;

-- Inflections view: New breakouts/reversals (high novelty)
-- Shows assets with NEW signals or significant score changes
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
-- Shows assets with established bullish momentum
CREATE OR REPLACE VIEW v_dashboard_trends AS
SELECT vdb.*
FROM v_dashboard_base vdb
WHERE vdb.weighted_score > 0
  AND vdb.new_signal_count = 0
  AND EXISTS (
      SELECT 1 FROM signal_instances si
      WHERE si.asset_id::text = vdb.asset_id::text
        AND si.state = 'active'
        AND si.direction = 'bullish'
        AND si.last_seen_at = vdb.as_of_date
        AND si.config_id = vdb.config_id
  )
ORDER BY vdb.weighted_score DESC;

-- Risk view: Bearish setups and breakdown risk
-- Shows assets with bearish signals or significant negative moves
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
          WHERE si.asset_id::text = vdb.asset_id::text
            AND si.state IN ('new', 'active')
            AND si.direction = 'bearish'
            AND si.last_seen_at = vdb.as_of_date
            AND si.config_id = vdb.config_id
      )
  )
ORDER BY vdb.weighted_score ASC, vdb.score_delta ASC;

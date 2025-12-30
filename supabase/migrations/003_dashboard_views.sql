-- Dashboard Views for Stratos Signal Engine
-- These views power the frontend dashboard panels

-- Active Signals View
-- Shows all currently active signal instances with latest data
CREATE OR REPLACE VIEW v_active_signals AS
SELECT 
    si.instance_id,
    si.asset_id,
    a.symbol,
    a.name AS asset_name,
    a.asset_type,
    si.template_name,
    si.direction,
    si.state,
    si.first_date,
    si.last_seen_date,
    si.strength_at_open,
    si.days_absent,
    
    -- Latest signal facts
    dsf.strength AS current_strength,
    dsf.attention_score,
    dsf.evidence,
    
    -- AI annotations (if available)
    saa.attention_level,
    saa.confidence,
    saa.thesis,
    saa.recommended_action,
    saa.priority_rank,
    
    -- Latest features for context
    df.trend_regime,
    df.rsi_14,
    df.roc_20,
    df.rvol_20,
    df.return_1d,
    df.return_5d,
    df.return_21d,
    
    -- Computed fields
    EXTRACT(DAY FROM NOW() - si.first_date::timestamp) AS days_active,
    CASE 
        WHEN saa.attention_level = 'priority' THEN 1
        WHEN saa.attention_level = 'focus' THEN 2
        WHEN saa.attention_level = 'glance' THEN 3
        ELSE 4
    END AS attention_rank
    
FROM signal_instances si
JOIN assets a ON si.asset_id = a.asset_id
LEFT JOIN daily_signal_facts dsf ON 
    si.asset_id = dsf.asset_id 
    AND si.template_name = dsf.template_name
    AND dsf.date = si.last_seen_date
LEFT JOIN signal_ai_annotations saa ON si.instance_id = saa.instance_id
LEFT JOIN daily_features df ON 
    si.asset_id = df.asset_id 
    AND df.date = si.last_seen_date
WHERE si.state IN ('new', 'active')
ORDER BY 
    attention_rank ASC,
    dsf.strength DESC NULLS LAST;


-- Leaders View (Bullish signals sorted by strength)
CREATE OR REPLACE VIEW v_leaders AS
SELECT 
    a.symbol,
    a.name AS asset_name,
    a.asset_type,
    df.attention_score,
    df.trend_regime,
    df.rsi_14,
    df.roc_20,
    df.rvol_20,
    df.return_1d,
    df.return_5d,
    df.return_21d,
    df.ma_dist_50,
    df.dist_52w_high,
    
    -- Aggregate signals
    ARRAY_AGG(DISTINCT si.template_name) AS active_signals,
    COUNT(DISTINCT si.template_name) AS signal_count,
    MAX(dsf.strength) AS max_strength,
    AVG(dsf.strength) AS avg_strength
    
FROM daily_features df
JOIN assets a ON df.asset_id = a.asset_id
LEFT JOIN signal_instances si ON 
    df.asset_id = si.asset_id 
    AND si.state IN ('new', 'active')
    AND si.direction = 'bullish'
LEFT JOIN daily_signal_facts dsf ON 
    df.asset_id = dsf.asset_id 
    AND dsf.date = df.date
    AND dsf.direction = 'bullish'
WHERE df.date = (SELECT MAX(date) FROM daily_features)
  AND df.attention_score > 0
GROUP BY 
    a.symbol, a.name, a.asset_type,
    df.attention_score, df.trend_regime, df.rsi_14, df.roc_20, df.rvol_20,
    df.return_1d, df.return_5d, df.return_21d, df.ma_dist_50, df.dist_52w_high
ORDER BY df.attention_score DESC
LIMIT 50;


-- Risks View (Bearish signals sorted by strength)
CREATE OR REPLACE VIEW v_risks AS
SELECT 
    a.symbol,
    a.name AS asset_name,
    a.asset_type,
    df.attention_score,
    df.trend_regime,
    df.rsi_14,
    df.roc_20,
    df.rvol_20,
    df.return_1d,
    df.return_5d,
    df.return_21d,
    df.ma_dist_50,
    df.dist_52w_low,
    
    -- Aggregate signals
    ARRAY_AGG(DISTINCT si.template_name) AS active_signals,
    COUNT(DISTINCT si.template_name) AS signal_count,
    MAX(dsf.strength) AS max_strength,
    AVG(dsf.strength) AS avg_strength
    
FROM daily_features df
JOIN assets a ON df.asset_id = a.asset_id
LEFT JOIN signal_instances si ON 
    df.asset_id = si.asset_id 
    AND si.state IN ('new', 'active')
    AND si.direction = 'bearish'
LEFT JOIN daily_signal_facts dsf ON 
    df.asset_id = dsf.asset_id 
    AND dsf.date = df.date
    AND dsf.direction = 'bearish'
WHERE df.date = (SELECT MAX(date) FROM daily_features)
  AND df.attention_score < 0
GROUP BY 
    a.symbol, a.name, a.asset_type,
    df.attention_score, df.trend_regime, df.rsi_14, df.roc_20, df.rvol_20,
    df.return_1d, df.return_5d, df.return_21d, df.ma_dist_50, df.dist_52w_low
ORDER BY df.attention_score ASC  -- Most negative first
LIMIT 50;


-- Signal Summary View (for dashboard cards)
CREATE OR REPLACE VIEW v_signal_summary AS
SELECT 
    (SELECT MAX(date) FROM daily_features) AS as_of_date,
    
    -- Total counts
    (SELECT COUNT(*) FROM signal_instances WHERE state IN ('new', 'active')) AS active_instances,
    (SELECT COUNT(*) FROM signal_instances WHERE state = 'new') AS new_today,
    
    -- By direction
    (SELECT COUNT(*) FROM signal_instances WHERE state IN ('new', 'active') AND direction = 'bullish') AS bullish_count,
    (SELECT COUNT(*) FROM signal_instances WHERE state IN ('new', 'active') AND direction = 'bearish') AS bearish_count,
    
    -- By template
    (SELECT jsonb_object_agg(template_name, cnt) 
     FROM (SELECT template_name, COUNT(*) as cnt 
           FROM signal_instances 
           WHERE state IN ('new', 'active') 
           GROUP BY template_name) t
    ) AS by_template,
    
    -- Pipeline status
    (SELECT status FROM pipeline_runs ORDER BY started_at DESC LIMIT 1) AS last_run_status,
    (SELECT started_at FROM pipeline_runs ORDER BY started_at DESC LIMIT 1) AS last_run_at,
    
    -- Queue depth
    (SELECT get_queue_depth()) AS queue_depth;


-- Watchlist Signals View (for user watchlists)
-- This view is meant to be filtered by a user's watchlist
CREATE OR REPLACE VIEW v_watchlist_signals AS
SELECT 
    a.symbol,
    a.name AS asset_name,
    a.asset_id,
    df.date,
    df.attention_score,
    df.trend_regime,
    df.close,
    df.return_1d,
    df.return_5d,
    df.rsi_14,
    df.roc_20,
    
    -- Active signals for this asset
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'template', si.template_name,
            'direction', si.direction,
            'state', si.state,
            'strength', dsf.strength,
            'first_date', si.first_date
        ))
        FROM signal_instances si
        LEFT JOIN daily_signal_facts dsf ON 
            si.asset_id = dsf.asset_id 
            AND si.template_name = dsf.template_name
            AND dsf.date = df.date
        WHERE si.asset_id = a.asset_id
          AND si.state IN ('new', 'active')),
        '[]'::jsonb
    ) AS signals
    
FROM assets a
JOIN daily_features df ON a.asset_id = df.asset_id
WHERE df.date = (SELECT MAX(date) FROM daily_features);


-- Recent Pipeline Runs View (for monitoring)
CREATE OR REPLACE VIEW v_recent_runs AS
SELECT 
    pr.run_id,
    pr.as_of_date,
    pr.status,
    pr.started_at,
    pr.ended_at,
    EXTRACT(EPOCH FROM (pr.ended_at - pr.started_at)) AS duration_seconds,
    pr.counts_json,
    pr.error_message,
    ec.name AS config_name
FROM pipeline_runs pr
LEFT JOIN engine_configs ec ON pr.config_id = ec.config_id
ORDER BY pr.started_at DESC
LIMIT 20;


-- Grant access to views
GRANT SELECT ON v_active_signals TO authenticated;
GRANT SELECT ON v_leaders TO authenticated;
GRANT SELECT ON v_risks TO authenticated;
GRANT SELECT ON v_signal_summary TO authenticated;
GRANT SELECT ON v_watchlist_signals TO authenticated;
GRANT SELECT ON v_recent_runs TO authenticated;

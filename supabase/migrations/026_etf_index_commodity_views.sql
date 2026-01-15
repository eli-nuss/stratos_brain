-- Migration: Create overview views for ETFs, Indices, and Commodities
-- These are simple views showing price data without technical indicators

-- =====================================================
-- ETF Overview View
-- =====================================================
CREATE OR REPLACE VIEW v_etf_overview AS
SELECT 
    e.etf_id,
    e.symbol,
    e.name,
    e.asset_class,
    e.geography,
    e.category,
    e.issuer,
    e.created_at,
    -- Latest bar data
    lb.date AS last_date,
    lb.open,
    lb.high,
    lb.low,
    lb.close,
    lb.volume,
    -- Returns
    CASE WHEN lb.close IS NOT NULL AND prev1.close IS NOT NULL AND prev1.close > 0 
         THEN ((lb.close - prev1.close) / prev1.close) * 100 
         ELSE NULL END AS return_1d,
    CASE WHEN lb.close IS NOT NULL AND prev7.close IS NOT NULL AND prev7.close > 0 
         THEN ((lb.close - prev7.close) / prev7.close) * 100 
         ELSE NULL END AS return_7d,
    CASE WHEN lb.close IS NOT NULL AND prev30.close IS NOT NULL AND prev30.close > 0 
         THEN ((lb.close - prev30.close) / prev30.close) * 100 
         ELSE NULL END AS return_30d,
    CASE WHEN lb.close IS NOT NULL AND prev365.close IS NOT NULL AND prev365.close > 0 
         THEN ((lb.close - prev365.close) / prev365.close) * 100 
         ELSE NULL END AS return_365d,
    -- Dollar volume
    lb.close * lb.volume AS dollar_volume
FROM etf_assets e
LEFT JOIN LATERAL (
    SELECT date, open, high, low, close, volume
    FROM etf_daily_bars
    WHERE etf_id = e.etf_id
    ORDER BY date DESC
    LIMIT 1
) lb ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM etf_daily_bars
    WHERE etf_id = e.etf_id AND date < lb.date
    ORDER BY date DESC
    LIMIT 1
) prev1 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM etf_daily_bars
    WHERE etf_id = e.etf_id AND date <= lb.date - INTERVAL '7 days'
    ORDER BY date DESC
    LIMIT 1
) prev7 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM etf_daily_bars
    WHERE etf_id = e.etf_id AND date <= lb.date - INTERVAL '30 days'
    ORDER BY date DESC
    LIMIT 1
) prev30 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM etf_daily_bars
    WHERE etf_id = e.etf_id AND date <= lb.date - INTERVAL '365 days'
    ORDER BY date DESC
    LIMIT 1
) prev365 ON true
WHERE e.is_active = true;

-- =====================================================
-- Market Index Overview View
-- =====================================================
CREATE OR REPLACE VIEW v_index_overview AS
SELECT 
    i.index_id,
    i.symbol,
    i.name,
    i.region,
    i.country,
    i.index_type,
    i.created_at,
    -- Latest bar data
    lb.date AS last_date,
    lb.open,
    lb.high,
    lb.low,
    lb.close,
    lb.volume,
    -- Returns
    CASE WHEN lb.close IS NOT NULL AND prev1.close IS NOT NULL AND prev1.close > 0 
         THEN ((lb.close - prev1.close) / prev1.close) * 100 
         ELSE NULL END AS return_1d,
    CASE WHEN lb.close IS NOT NULL AND prev7.close IS NOT NULL AND prev7.close > 0 
         THEN ((lb.close - prev7.close) / prev7.close) * 100 
         ELSE NULL END AS return_7d,
    CASE WHEN lb.close IS NOT NULL AND prev30.close IS NOT NULL AND prev30.close > 0 
         THEN ((lb.close - prev30.close) / prev30.close) * 100 
         ELSE NULL END AS return_30d,
    CASE WHEN lb.close IS NOT NULL AND prev365.close IS NOT NULL AND prev365.close > 0 
         THEN ((lb.close - prev365.close) / prev365.close) * 100 
         ELSE NULL END AS return_365d
FROM market_indices i
LEFT JOIN LATERAL (
    SELECT date, open, high, low, close, volume
    FROM index_daily_bars
    WHERE index_id = i.index_id
    ORDER BY date DESC
    LIMIT 1
) lb ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM index_daily_bars
    WHERE index_id = i.index_id AND date < lb.date
    ORDER BY date DESC
    LIMIT 1
) prev1 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM index_daily_bars
    WHERE index_id = i.index_id AND date <= lb.date - INTERVAL '7 days'
    ORDER BY date DESC
    LIMIT 1
) prev7 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM index_daily_bars
    WHERE index_id = i.index_id AND date <= lb.date - INTERVAL '30 days'
    ORDER BY date DESC
    LIMIT 1
) prev30 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM index_daily_bars
    WHERE index_id = i.index_id AND date <= lb.date - INTERVAL '365 days'
    ORDER BY date DESC
    LIMIT 1
) prev365 ON true
WHERE i.is_active = true;

-- =====================================================
-- Commodity Overview View
-- =====================================================
CREATE OR REPLACE VIEW v_commodity_overview AS
SELECT 
    c.commodity_id,
    c.symbol,
    c.name,
    c.category,
    c.unit,
    c.created_at,
    -- Latest bar data
    lb.date AS last_date,
    lb.open,
    lb.high,
    lb.low,
    lb.close,
    lb.volume,
    -- Returns
    CASE WHEN lb.close IS NOT NULL AND prev1.close IS NOT NULL AND prev1.close > 0 
         THEN ((lb.close - prev1.close) / prev1.close) * 100 
         ELSE NULL END AS return_1d,
    CASE WHEN lb.close IS NOT NULL AND prev7.close IS NOT NULL AND prev7.close > 0 
         THEN ((lb.close - prev7.close) / prev7.close) * 100 
         ELSE NULL END AS return_7d,
    CASE WHEN lb.close IS NOT NULL AND prev30.close IS NOT NULL AND prev30.close > 0 
         THEN ((lb.close - prev30.close) / prev30.close) * 100 
         ELSE NULL END AS return_30d,
    CASE WHEN lb.close IS NOT NULL AND prev365.close IS NOT NULL AND prev365.close > 0 
         THEN ((lb.close - prev365.close) / prev365.close) * 100 
         ELSE NULL END AS return_365d
FROM commodities c
LEFT JOIN LATERAL (
    SELECT date, open, high, low, close, volume
    FROM commodity_daily_bars
    WHERE commodity_id = c.commodity_id
    ORDER BY date DESC
    LIMIT 1
) lb ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM commodity_daily_bars
    WHERE commodity_id = c.commodity_id AND date < lb.date
    ORDER BY date DESC
    LIMIT 1
) prev1 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM commodity_daily_bars
    WHERE commodity_id = c.commodity_id AND date <= lb.date - INTERVAL '7 days'
    ORDER BY date DESC
    LIMIT 1
) prev7 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM commodity_daily_bars
    WHERE commodity_id = c.commodity_id AND date <= lb.date - INTERVAL '30 days'
    ORDER BY date DESC
    LIMIT 1
) prev30 ON true
LEFT JOIN LATERAL (
    SELECT close
    FROM commodity_daily_bars
    WHERE commodity_id = c.commodity_id AND date <= lb.date - INTERVAL '365 days'
    ORDER BY date DESC
    LIMIT 1
) prev365 ON true
WHERE c.is_active = true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_etf_daily_bars_etf_date ON etf_daily_bars(etf_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_index_daily_bars_index_date ON index_daily_bars(index_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_commodity_daily_bars_commodity_date ON commodity_daily_bars(commodity_id, date DESC);

-- Migration: Guru Tracker V2 - Smart Money Intelligence Platform
-- Adds performance tracking, consensus views, and enriched data support

-- 1. Guru Performance History (For the 5-Year Chart and Performance Leaderboard)
CREATE TABLE IF NOT EXISTS guru_performance_history (
    id BIGSERIAL PRIMARY KEY,
    investor_id BIGINT REFERENCES tracked_investors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_assets BIGINT, -- AUM at this point in time
    cash_value BIGINT,
    equity_value BIGINT,
    performance_pct NUMERIC(10, 4), -- Estimated return vs previous period
    spy_benchmark_pct NUMERIC(10, 4), -- For comparison
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(investor_id, date)
);

-- Index for performance queries
CREATE INDEX IF NOT EXISTS idx_guru_performance_investor_date 
ON guru_performance_history(investor_id, date DESC);

-- 2. Add additional columns to tracked_investors for the redesign
ALTER TABLE tracked_investors 
ADD COLUMN IF NOT EXISTS manager_name TEXT,
ADD COLUMN IF NOT EXISTS top_sector TEXT,
ADD COLUMN IF NOT EXISTS turnover_rate TEXT DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS performance_1y NUMERIC(10, 4),
ADD COLUMN IF NOT EXISTS performance_ytd NUMERIC(10, 4);

-- 3. Consensus View - Stocks owned by multiple gurus
CREATE OR REPLACE VIEW v_guru_consensus AS
SELECT 
    ih.symbol,
    ih.company_name,
    COUNT(DISTINCT ih.investor_id) as guru_count,
    ARRAY_AGG(DISTINCT ti.name) as guru_names,
    SUM(ih.value) as total_guru_invested,
    AVG(ih.percent_portfolio) as avg_conviction,
    MAX(ih.date_reported) as latest_filing_date
FROM investor_holdings ih
JOIN tracked_investors ti ON ih.investor_id = ti.id
WHERE ih.date_reported = (
    SELECT MAX(date_reported) 
    FROM investor_holdings ih2 
    WHERE ih2.investor_id = ih.investor_id
)
GROUP BY ih.symbol, ih.company_name
HAVING COUNT(DISTINCT ih.investor_id) >= 1
ORDER BY guru_count DESC, total_guru_invested DESC;

-- 4. Enhanced Guru Summary View (for the Boardroom cards)
DROP VIEW IF EXISTS v_guru_latest_holdings CASCADE;
DROP VIEW IF EXISTS v_guru_cross_reference CASCADE;
DROP VIEW IF EXISTS v_guru_summary CASCADE;
CREATE VIEW v_guru_summary AS
SELECT 
    ti.id as investor_id,
    ti.name as investor_name,
    ti.cik,
    ti.manager_name,
    ti.last_filing_date,
    ti.last_updated,
    ti.top_sector,
    ti.turnover_rate,
    ti.performance_1y,
    ti.performance_ytd,
    COUNT(DISTINCT ih.symbol) as total_positions,
    SUM(ih.value) as total_portfolio_value,
    COUNT(DISTINCT CASE WHEN ih.action = 'NEW' THEN ih.symbol END) as new_positions,
    COUNT(DISTINCT CASE WHEN ih.action = 'ADD' THEN ih.symbol END) as increased_positions,
    COUNT(DISTINCT CASE WHEN ih.action = 'REDUCE' THEN ih.symbol END) as reduced_positions,
    COUNT(DISTINCT CASE WHEN ih.action = 'SOLD' THEN ih.symbol END) as sold_positions,
    (SELECT ARRAY_AGG(s.symbol ORDER BY s.value DESC) 
     FROM (SELECT DISTINCT ON (ih2.symbol) ih2.symbol, ih2.value 
           FROM investor_holdings ih2 
           WHERE ih2.investor_id = ti.id AND ih2.date_reported = ti.last_filing_date
           ORDER BY ih2.symbol, ih2.value DESC) s) as top_holdings
FROM tracked_investors ti
LEFT JOIN investor_holdings ih ON ti.id = ih.investor_id
    AND ih.date_reported = ti.last_filing_date
GROUP BY ti.id, ti.name, ti.cik, ti.manager_name, ti.last_filing_date, 
         ti.last_updated, ti.top_sector, ti.turnover_rate, 
         ti.performance_1y, ti.performance_ytd;

-- 5. Latest Holdings View with enrichment support
CREATE OR REPLACE VIEW v_guru_latest_holdings AS
SELECT 
    ih.id,
    ih.investor_id,
    ti.name as investor_name,
    ih.symbol,
    ih.company_name,
    ih.shares,
    ih.value,
    ih.percent_portfolio,
    ih.change_shares,
    ih.change_percent,
    ih.action,
    ih.date_reported,
    ih.quarter
FROM investor_holdings ih
JOIN tracked_investors ti ON ih.investor_id = ti.id
WHERE ih.date_reported = ti.last_filing_date;

-- 6. Cross-reference view for finding stocks across multiple portfolios
CREATE OR REPLACE VIEW v_guru_cross_reference AS
SELECT 
    ih.symbol,
    ih.company_name,
    ti.name as investor_name,
    ti.id as investor_id,
    ih.percent_portfolio,
    ih.value,
    ih.shares,
    ih.action,
    ih.date_reported
FROM investor_holdings ih
JOIN tracked_investors ti ON ih.investor_id = ti.id
WHERE ih.date_reported = ti.last_filing_date
ORDER BY ih.symbol, ih.percent_portfolio DESC;

-- 7. Performance Leaderboard View
CREATE OR REPLACE VIEW v_guru_performance_leaderboard AS
SELECT 
    ti.id as investor_id,
    ti.name as investor_name,
    ti.manager_name,
    ti.performance_1y,
    ti.performance_ytd,
    SUM(ih.value) as total_aum,
    COUNT(DISTINCT ih.symbol) as position_count
FROM tracked_investors ti
LEFT JOIN investor_holdings ih ON ti.id = ih.investor_id
    AND ih.date_reported = ti.last_filing_date
GROUP BY ti.id, ti.name, ti.manager_name, ti.performance_1y, ti.performance_ytd
ORDER BY ti.performance_1y DESC NULLS LAST;

-- Grant permissions
GRANT SELECT ON v_guru_consensus TO authenticated;
GRANT SELECT ON v_guru_performance_leaderboard TO authenticated;
GRANT SELECT ON guru_performance_history TO authenticated;

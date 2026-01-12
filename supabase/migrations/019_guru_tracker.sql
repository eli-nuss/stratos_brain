-- Guru Tracker: Track Super-Investor Portfolios via 13F Filings
-- This migration creates tables to store tracked investors and their holdings
-- Enables building a "Dataroma-like" feature inside the dashboard

-- 1. Tracked Investors (The "Watchlist" of Gurus)
CREATE TABLE IF NOT EXISTS public.tracked_investors (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Optional: remove if global
    name TEXT NOT NULL, -- e.g. "Berkshire Hathaway Inc."
    cik TEXT NOT NULL, -- The SEC CIK identifier (e.g. "0001067983")
    last_filing_date DATE, -- Date of most recent 13F filing
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store additional info (total AUM, fund type, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(cik) -- Ensure we don't duplicate funds
);

-- 2. Investor Holdings (The Portfolio Snapshots)
CREATE TABLE IF NOT EXISTS public.investor_holdings (
    id BIGSERIAL PRIMARY KEY,
    investor_id BIGINT REFERENCES public.tracked_investors(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    company_name TEXT, -- Store company name for display
    shares BIGINT, -- Number of shares held
    value BIGINT, -- Position value in USD
    percent_portfolio NUMERIC(10, 4), -- Conviction weight (e.g. 15.5 = 15.5%)
    change_shares BIGINT, -- Change in shares since last quarter
    change_percent NUMERIC(10, 2), -- Percentage change in position
    action TEXT, -- 'NEW', 'ADD', 'REDUCE', 'SOLD', 'HOLD'
    date_reported DATE NOT NULL, -- The 13F filing date (e.g. 2024-12-31)
    quarter TEXT, -- e.g. "Q4 2024"
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(investor_id, symbol, date_reported)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tracked_investors_cik ON public.tracked_investors(cik);
CREATE INDEX IF NOT EXISTS idx_tracked_investors_user ON public.tracked_investors(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investor_holdings_lookup ON public.investor_holdings(investor_id, date_reported DESC);
CREATE INDEX IF NOT EXISTS idx_investor_holdings_symbol ON public.investor_holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_investor_holdings_action ON public.investor_holdings(action) WHERE action IN ('NEW', 'ADD');

-- 3. View: Latest Holdings for Each Investor
CREATE OR REPLACE VIEW v_guru_latest_holdings AS
SELECT 
    ti.id AS investor_id,
    ti.name AS investor_name,
    ti.cik,
    ti.last_filing_date,
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
FROM public.tracked_investors ti
JOIN public.investor_holdings ih ON ti.id = ih.investor_id
WHERE ih.date_reported = ti.last_filing_date
  AND ti.is_active = true
ORDER BY ti.name, ih.percent_portfolio DESC NULLS LAST;

-- 4. View: Guru Portfolio Summary
CREATE OR REPLACE VIEW v_guru_summary AS
SELECT 
    ti.id AS investor_id,
    ti.name AS investor_name,
    ti.cik,
    ti.last_filing_date,
    ti.last_updated,
    COUNT(DISTINCT ih.symbol) AS total_positions,
    SUM(ih.value) AS total_portfolio_value,
    SUM(CASE WHEN ih.action = 'NEW' THEN 1 ELSE 0 END) AS new_positions,
    SUM(CASE WHEN ih.action = 'ADD' THEN 1 ELSE 0 END) AS increased_positions,
    SUM(CASE WHEN ih.action = 'REDUCE' THEN 1 ELSE 0 END) AS reduced_positions,
    SUM(CASE WHEN ih.action = 'SOLD' THEN 1 ELSE 0 END) AS sold_positions,
    -- Top 3 holdings
    ARRAY_AGG(
        ih.symbol ORDER BY ih.percent_portfolio DESC NULLS LAST
    ) FILTER (WHERE ih.percent_portfolio IS NOT NULL) AS top_holdings
FROM public.tracked_investors ti
LEFT JOIN public.investor_holdings ih ON ti.id = ih.investor_id 
    AND ih.date_reported = ti.last_filing_date
WHERE ti.is_active = true
GROUP BY ti.id, ti.name, ti.cik, ti.last_filing_date, ti.last_updated;

-- 5. View: Cross-Reference - Which Gurus Hold a Stock
CREATE OR REPLACE VIEW v_stock_guru_holders AS
SELECT 
    ih.symbol,
    ih.company_name,
    ARRAY_AGG(
        jsonb_build_object(
            'investor_name', ti.name,
            'investor_id', ti.id,
            'cik', ti.cik,
            'shares', ih.shares,
            'value', ih.value,
            'percent_portfolio', ih.percent_portfolio,
            'action', ih.action,
            'date_reported', ih.date_reported
        ) ORDER BY ih.percent_portfolio DESC NULLS LAST
    ) AS holders
FROM public.investor_holdings ih
JOIN public.tracked_investors ti ON ih.investor_id = ti.id
WHERE ih.date_reported = ti.last_filing_date
  AND ti.is_active = true
GROUP BY ih.symbol, ih.company_name;

-- Grant permissions (adjust based on your auth setup)
GRANT SELECT ON public.tracked_investors TO authenticated;
GRANT SELECT ON public.investor_holdings TO authenticated;
GRANT SELECT ON v_guru_latest_holdings TO authenticated;
GRANT SELECT ON v_guru_summary TO authenticated;
GRANT SELECT ON v_stock_guru_holders TO authenticated;

-- Allow authenticated users to insert/update their own tracked investors
GRANT INSERT, UPDATE, DELETE ON public.tracked_investors TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.tracked_investors IS 'Stores the list of super-investors (gurus) being tracked, identified by their SEC CIK number';
COMMENT ON TABLE public.investor_holdings IS 'Historical snapshots of investor portfolios from 13F filings, with position changes tracked quarter-over-quarter';
COMMENT ON VIEW v_guru_latest_holdings IS 'Latest portfolio holdings for each tracked investor';
COMMENT ON VIEW v_guru_summary IS 'Summary statistics for each guru including position counts and top holdings';
COMMENT ON VIEW v_stock_guru_holders IS 'Cross-reference showing which gurus hold each stock';

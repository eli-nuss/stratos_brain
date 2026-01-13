-- Migration: 022_fundamental_scoring.sql
-- Description: Create tables for Context-Aware Stock Scoring Engine
-- This system classifies stocks as Growth/Value/Hybrid and applies appropriate scoring algorithms
-- Author: Claude
-- Date: 2026-01-13

-- ============================================================================
-- Table: fundamental_snapshot
-- Stores monthly pre-calculated base metrics and classification
-- Updated Monthly (or when earnings are released)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fundamental_snapshot (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,

    -- Classification
    classification TEXT NOT NULL CHECK (classification IN ('growth', 'value', 'hybrid')),
    classification_reason TEXT,  -- e.g., "Revenue CAGR 25% > 15% threshold"

    -- Revenue Growth Metrics (for Router + Growth Engine)
    revenue_cagr_3y NUMERIC(10, 4),           -- 3-year Compound Annual Growth Rate
    revenue_growth_yoy NUMERIC(10, 4),        -- Year-over-year revenue growth
    revenue_growth_qoq NUMERIC(10, 4),        -- Quarter-over-quarter (acceleration check)
    revenue_acceleration NUMERIC(10, 4),      -- QoQ change in growth rate

    -- Growth Engine Metrics
    rule_of_40 NUMERIC(10, 4),                -- Revenue Growth % + EBITDA Margin %
    gross_margin NUMERIC(10, 4),              -- Gross Profit / Revenue
    ebitda_margin NUMERIC(10, 4),             -- EBITDA / Revenue
    operating_margin NUMERIC(10, 4),          -- Operating Income / Revenue

    -- Value Engine Metrics
    fcf_yield NUMERIC(10, 4),                 -- Free Cash Flow / Market Cap
    fcf_margin NUMERIC(10, 4),                -- Free Cash Flow / Revenue
    debt_to_equity NUMERIC(10, 4),            -- Total Debt / Shareholder Equity
    current_ratio NUMERIC(10, 4),             -- Current Assets / Current Liabilities
    interest_coverage NUMERIC(10, 4),         -- EBIT / Interest Expense

    -- Dividend Metrics (Value Engine)
    dividend_yield NUMERIC(10, 4),
    dividend_payout_ratio NUMERIC(10, 4),     -- Dividends / Net Income
    dividend_growth_years INT,                -- Consecutive years of dividend growth

    -- Piotroski F-Score Components (Value Engine)
    piotroski_score INT CHECK (piotroski_score >= 0 AND piotroski_score <= 9),
    piotroski_components JSONB,               -- Breakdown of 9 criteria

    -- Historical Averages (for relative valuation)
    pe_5y_avg NUMERIC(10, 4),                 -- 5-year average P/E
    ps_5y_avg NUMERIC(10, 4),                 -- 5-year average P/S
    pb_5y_avg NUMERIC(10, 4),                 -- 5-year average P/B

    -- Pre-calculated Scores (0-100 scale)
    growth_engine_score NUMERIC(5, 2),        -- Score from Growth Engine (NULL if Value only)
    value_engine_score NUMERIC(5, 2),         -- Score from Value Engine (NULL if Growth only)
    base_fundamental_score NUMERIC(5, 2),     -- Combined base score before daily adjustments

    -- Metadata
    data_source TEXT DEFAULT 'fmp',           -- 'fmp', 'alpha_vantage', or 'mixed'
    last_earnings_date DATE,                  -- Last earnings release date
    next_earnings_date DATE,                  -- Expected next earnings
    data_freshness TEXT,                      -- 'current', 'stale', 'pending_update'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (asset_id)
);

-- ============================================================================
-- Table: fundamental_scores
-- Stores daily updated final scores combining base metrics with live price data
-- Updated Daily (after market close)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fundamental_scores (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,

    -- Classification (copied from snapshot for convenience)
    classification TEXT NOT NULL CHECK (classification IN ('growth', 'value', 'hybrid')),

    -- Live Valuation Metrics (updated daily)
    pe_ratio NUMERIC(10, 4),
    forward_pe NUMERIC(10, 4),
    peg_ratio NUMERIC(10, 4),
    price_to_sales NUMERIC(10, 4),
    price_to_book NUMERIC(10, 4),
    ev_to_ebitda NUMERIC(10, 4),
    ev_to_revenue NUMERIC(10, 4),

    -- Relative Valuation (vs historical)
    pe_vs_5y_avg NUMERIC(10, 4),              -- Current P/E / 5Y Avg P/E (< 1 = cheap)
    ps_vs_5y_avg NUMERIC(10, 4),
    pb_vs_5y_avg NUMERIC(10, 4),

    -- Technical Overlay (from daily_features)
    price_vs_sma_200 NUMERIC(10, 4),          -- Price / 200-day SMA (> 1 = uptrend)
    price_vs_sma_50 NUMERIC(10, 4),
    dist_from_52w_high NUMERIC(10, 4),        -- % below 52-week high

    -- Component Scores (0-100 scale)
    valuation_score NUMERIC(5, 2),            -- Real-time valuation component
    technical_score NUMERIC(5, 2),            -- Trend/momentum component
    fundamental_base_score NUMERIC(5, 2),     -- From fundamental_snapshot

    -- Final Scores
    final_score NUMERIC(5, 2) NOT NULL,       -- The 0-100 composite score
    score_breakdown JSONB,                    -- Detailed breakdown by component

    -- Ranking
    rank_in_universe INT,                     -- Rank among all scored equities
    rank_in_classification INT,               -- Rank among same classification (Growth/Value)
    rank_in_sector INT,                       -- Rank within sector
    percentile NUMERIC(5, 2),                 -- Percentile rank (0-100)

    -- Change Tracking
    score_delta_1d NUMERIC(5, 2),             -- Change from yesterday
    score_delta_5d NUMERIC(5, 2),             -- Change from 5 days ago

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (asset_id, as_of_date)
);

-- ============================================================================
-- Table: fundamental_score_history
-- Stores historical snapshots for backtesting and analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS fundamental_score_history (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    classification TEXT NOT NULL,
    final_score NUMERIC(5, 2) NOT NULL,
    growth_engine_score NUMERIC(5, 2),
    value_engine_score NUMERIC(5, 2),
    score_breakdown JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (asset_id, snapshot_date)
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fundamental_snapshot_classification
    ON fundamental_snapshot(classification);
CREATE INDEX IF NOT EXISTS idx_fundamental_snapshot_updated
    ON fundamental_snapshot(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_fundamental_scores_date
    ON fundamental_scores(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_fundamental_scores_final_score
    ON fundamental_scores(as_of_date, final_score DESC);
CREATE INDEX IF NOT EXISTS idx_fundamental_scores_classification
    ON fundamental_scores(as_of_date, classification);

CREATE INDEX IF NOT EXISTS idx_fundamental_score_history_asset
    ON fundamental_score_history(asset_id, snapshot_date DESC);

-- ============================================================================
-- View: v_fundamental_leaders
-- Top scoring stocks by classification
-- ============================================================================
CREATE OR REPLACE VIEW v_fundamental_leaders AS
SELECT
    fs.asset_id,
    a.symbol,
    a.name,
    em.sector,
    em.industry,
    fs.classification,
    fs.final_score,
    fs.valuation_score,
    fs.technical_score,
    fs.fundamental_base_score,
    fs.pe_ratio,
    fs.peg_ratio,
    fs.pe_vs_5y_avg,
    fs.price_vs_sma_200,
    fs.rank_in_universe,
    fs.rank_in_classification,
    fs.percentile,
    fs.score_delta_1d,
    fs.score_breakdown,
    snap.rule_of_40,
    snap.fcf_yield,
    snap.debt_to_equity,
    snap.revenue_cagr_3y,
    snap.piotroski_score,
    fs.as_of_date
FROM fundamental_scores fs
JOIN assets a ON fs.asset_id = a.asset_id
LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
LEFT JOIN fundamental_snapshot snap ON fs.asset_id = snap.asset_id
WHERE fs.as_of_date = (SELECT MAX(as_of_date) FROM fundamental_scores)
  AND a.is_active = true
ORDER BY fs.final_score DESC;

-- ============================================================================
-- View: v_growth_leaders
-- Top Growth stocks
-- ============================================================================
CREATE OR REPLACE VIEW v_growth_leaders AS
SELECT * FROM v_fundamental_leaders
WHERE classification = 'growth'
ORDER BY final_score DESC;

-- ============================================================================
-- View: v_value_leaders
-- Top Value stocks
-- ============================================================================
CREATE OR REPLACE VIEW v_value_leaders AS
SELECT * FROM v_fundamental_leaders
WHERE classification = 'value'
ORDER BY final_score DESC;

-- ============================================================================
-- Trigger to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_fundamental_snapshot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fundamental_snapshot_updated_at ON fundamental_snapshot;
CREATE TRIGGER trigger_fundamental_snapshot_updated_at
    BEFORE UPDATE ON fundamental_snapshot
    FOR EACH ROW
    EXECUTE FUNCTION update_fundamental_snapshot_updated_at();

DROP TRIGGER IF EXISTS trigger_fundamental_scores_updated_at ON fundamental_scores;
CREATE TRIGGER trigger_fundamental_scores_updated_at
    BEFORE UPDATE ON fundamental_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_fundamental_snapshot_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE fundamental_snapshot IS 'Monthly pre-calculated fundamental metrics and Growth/Value classification';
COMMENT ON TABLE fundamental_scores IS 'Daily updated fundamental scores combining base metrics with live valuation';
COMMENT ON TABLE fundamental_score_history IS 'Historical fundamental scores for backtesting';
COMMENT ON VIEW v_fundamental_leaders IS 'Top scoring stocks across all classifications';
COMMENT ON VIEW v_growth_leaders IS 'Top scoring Growth stocks';
COMMENT ON VIEW v_value_leaders IS 'Top scoring Value stocks';

COMMENT ON COLUMN fundamental_snapshot.classification IS 'Stock classification: growth (CAGR>15%), value (CAGR<10% + cheap), or hybrid';
COMMENT ON COLUMN fundamental_snapshot.rule_of_40 IS 'Revenue Growth % + EBITDA Margin % - key SaaS efficiency metric';
COMMENT ON COLUMN fundamental_snapshot.piotroski_score IS 'Piotroski F-Score (0-9) - fundamental health indicator';
COMMENT ON COLUMN fundamental_scores.final_score IS 'Composite 0-100 score using classification-appropriate algorithm';

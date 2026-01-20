-- Migration: Extended Financial Metrics
-- Adds new columns to equity_metadata for ratios and key metrics from FMP
-- Creates new tables for earnings history, dividend history, and financial growth

-- ============================================================================
-- PART 1: Add new columns to equity_metadata for ratios and key metrics
-- ============================================================================

-- Liquidity Ratios
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS current_ratio NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS quick_ratio NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS cash_ratio NUMERIC(10,4);

-- Leverage/Solvency Ratios
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS debt_to_equity NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS debt_to_assets NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS interest_coverage NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS debt_to_capital NUMERIC(10,4);

-- Efficiency Ratios
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS asset_turnover NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS inventory_turnover NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS receivables_turnover NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS payables_turnover NUMERIC(10,4);

-- Profitability Ratios (additional)
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS gross_profit_margin NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS ebitda_margin NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS net_profit_margin NUMERIC(10,4);

-- Return Metrics (additional)
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS roic NUMERIC(10,4);  -- Return on Invested Capital
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS roce NUMERIC(10,4);  -- Return on Capital Employed

-- Valuation Metrics (additional)
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS enterprise_value BIGINT;
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS ev_to_fcf NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS price_to_fcf NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS fcf_yield NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS earnings_yield NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS graham_number NUMERIC(15,4);

-- Cash Flow Metrics
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS fcf_per_share NUMERIC(15,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS operating_cf_per_share NUMERIC(15,4);

-- Working Capital Metrics
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS working_capital BIGINT;
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS invested_capital BIGINT;
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS tangible_asset_value BIGINT;
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS cash_conversion_cycle NUMERIC(10,4);

-- Dividend Metrics
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS dividend_payout_ratio NUMERIC(10,4);
ALTER TABLE equity_metadata ADD COLUMN IF NOT EXISTS dividend_per_share NUMERIC(10,4);

-- ============================================================================
-- PART 2: Add growth metrics to equity_quarterly_fundamentals
-- ============================================================================

ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS revenue_growth NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS gross_profit_growth NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS operating_income_growth NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS net_income_growth NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS eps_growth NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS eps_diluted_growth NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS fcf_growth NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS ebitda_growth NUMERIC(10,4);

-- Long-term growth rates (CAGR)
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS three_year_revenue_cagr NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS five_year_revenue_cagr NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS three_year_net_income_cagr NUMERIC(10,4);
ALTER TABLE equity_quarterly_fundamentals ADD COLUMN IF NOT EXISTS five_year_net_income_cagr NUMERIC(10,4);

-- Same for annual fundamentals
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS revenue_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS gross_profit_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS operating_income_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS net_income_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS eps_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS eps_diluted_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS fcf_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS ebitda_growth NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS three_year_revenue_cagr NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS five_year_revenue_cagr NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS three_year_net_income_cagr NUMERIC(10,4);
ALTER TABLE equity_annual_fundamentals ADD COLUMN IF NOT EXISTS five_year_net_income_cagr NUMERIC(10,4);

-- ============================================================================
-- PART 3: Create equity_earnings_history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS equity_earnings_history (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    fiscal_date DATE NOT NULL,
    fiscal_quarter VARCHAR(10),  -- e.g., 'Q1', 'Q2', 'Q3', 'Q4'
    fiscal_year INTEGER,
    
    -- EPS data
    eps_estimated NUMERIC(10,4),
    eps_actual NUMERIC(10,4),
    eps_surprise NUMERIC(10,4),
    eps_surprise_pct NUMERIC(10,4),
    
    -- Revenue data
    revenue_estimated BIGINT,
    revenue_actual BIGINT,
    revenue_surprise BIGINT,
    revenue_surprise_pct NUMERIC(10,4),
    
    -- Timing
    announcement_date DATE,
    announcement_time VARCHAR(10),  -- 'BMO' (before market open), 'AMC' (after market close)
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asset_id, fiscal_date)
);

-- Index for querying by date range
CREATE INDEX IF NOT EXISTS idx_earnings_history_date ON equity_earnings_history(fiscal_date);
CREATE INDEX IF NOT EXISTS idx_earnings_history_announcement ON equity_earnings_history(announcement_date);

-- ============================================================================
-- PART 4: Create equity_dividend_history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS equity_dividend_history (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    ex_dividend_date DATE NOT NULL,
    
    -- Dividend details
    dividend_amount NUMERIC(10,6),
    dividend_type VARCHAR(20) DEFAULT 'regular',  -- 'regular', 'special', 'stock'
    frequency VARCHAR(20),  -- 'quarterly', 'monthly', 'annual', 'semi-annual'
    
    -- Key dates
    declaration_date DATE,
    record_date DATE,
    payment_date DATE,
    
    -- Yield calculation (at time of ex-div)
    adjusted_dividend NUMERIC(10,6),  -- Adjusted for splits
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asset_id, ex_dividend_date)
);

-- Index for querying by date
CREATE INDEX IF NOT EXISTS idx_dividend_history_date ON equity_dividend_history(ex_dividend_date);
CREATE INDEX IF NOT EXISTS idx_dividend_history_payment ON equity_dividend_history(payment_date);

-- ============================================================================
-- PART 5: Create equity_stock_splits table
-- ============================================================================

CREATE TABLE IF NOT EXISTS equity_stock_splits (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    split_date DATE NOT NULL,
    
    -- Split ratio (e.g., 4:1 split = numerator=4, denominator=1)
    split_numerator INTEGER NOT NULL,
    split_denominator INTEGER NOT NULL,
    split_ratio NUMERIC(10,6),  -- Calculated: numerator/denominator
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asset_id, split_date)
);

CREATE INDEX IF NOT EXISTS idx_stock_splits_date ON equity_stock_splits(split_date);

-- ============================================================================
-- PART 6: Create equity_ratios_quarterly table for historical ratio tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS equity_ratios_quarterly (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    fiscal_date DATE NOT NULL,
    fiscal_year INTEGER,
    fiscal_quarter VARCHAR(10),
    
    -- Liquidity Ratios
    current_ratio NUMERIC(10,4),
    quick_ratio NUMERIC(10,4),
    cash_ratio NUMERIC(10,4),
    
    -- Leverage Ratios
    debt_to_equity NUMERIC(10,4),
    debt_to_assets NUMERIC(10,4),
    debt_to_capital NUMERIC(10,4),
    interest_coverage NUMERIC(10,4),
    
    -- Efficiency Ratios
    asset_turnover NUMERIC(10,4),
    inventory_turnover NUMERIC(10,4),
    receivables_turnover NUMERIC(10,4),
    payables_turnover NUMERIC(10,4),
    
    -- Profitability Ratios
    gross_profit_margin NUMERIC(10,4),
    operating_profit_margin NUMERIC(10,4),
    ebitda_margin NUMERIC(10,4),
    net_profit_margin NUMERIC(10,4),
    
    -- Return Ratios
    return_on_assets NUMERIC(10,4),
    return_on_equity NUMERIC(10,4),
    roic NUMERIC(10,4),
    roce NUMERIC(10,4),
    
    -- Valuation Ratios (at period end)
    price_to_earnings NUMERIC(10,4),
    price_to_book NUMERIC(10,4),
    price_to_sales NUMERIC(10,4),
    price_to_fcf NUMERIC(10,4),
    ev_to_ebitda NUMERIC(10,4),
    ev_to_sales NUMERIC(10,4),
    
    -- Per Share Metrics
    revenue_per_share NUMERIC(15,4),
    book_value_per_share NUMERIC(15,4),
    fcf_per_share NUMERIC(15,4),
    
    -- Cash Cycle
    days_sales_outstanding NUMERIC(10,4),
    days_inventory_outstanding NUMERIC(10,4),
    days_payables_outstanding NUMERIC(10,4),
    cash_conversion_cycle NUMERIC(10,4),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asset_id, fiscal_date)
);

CREATE INDEX IF NOT EXISTS idx_ratios_quarterly_date ON equity_ratios_quarterly(fiscal_date);

-- ============================================================================
-- PART 7: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN equity_metadata.current_ratio IS 'Current Assets / Current Liabilities - measures short-term liquidity';
COMMENT ON COLUMN equity_metadata.quick_ratio IS '(Current Assets - Inventory) / Current Liabilities - stricter liquidity test';
COMMENT ON COLUMN equity_metadata.debt_to_equity IS 'Total Debt / Shareholder Equity - measures financial leverage';
COMMENT ON COLUMN equity_metadata.roic IS 'Return on Invested Capital - NOPAT / Invested Capital';
COMMENT ON COLUMN equity_metadata.roce IS 'Return on Capital Employed - EBIT / Capital Employed';
COMMENT ON COLUMN equity_metadata.fcf_yield IS 'Free Cash Flow / Market Cap - cash return to shareholders';
COMMENT ON COLUMN equity_metadata.graham_number IS 'sqrt(22.5 * EPS * Book Value) - Ben Graham intrinsic value estimate';
COMMENT ON COLUMN equity_metadata.cash_conversion_cycle IS 'DIO + DSO - DPO - days to convert inventory to cash';

COMMENT ON TABLE equity_earnings_history IS 'Historical earnings announcements with estimates vs actuals';
COMMENT ON TABLE equity_dividend_history IS 'Historical dividend payments with ex-div and payment dates';
COMMENT ON TABLE equity_stock_splits IS 'Historical stock split events';
COMMENT ON TABLE equity_ratios_quarterly IS 'Quarterly snapshot of financial ratios for trend analysis';

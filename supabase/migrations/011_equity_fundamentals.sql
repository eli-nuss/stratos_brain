-- Migration: 011_equity_fundamentals.sql
-- Description: Create tables for storing quarterly and annual equity fundamentals data
-- Author: Manus AI
-- Date: 2026-01-06

-- ============================================================================
-- Table: equity_quarterly_fundamentals
-- Stores quarterly financial statement data for equities
-- ============================================================================
CREATE TABLE IF NOT EXISTS equity_quarterly_fundamentals (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    fiscal_date_ending DATE NOT NULL,
    reported_currency VARCHAR(10),
    
    -- Income Statement
    total_revenue BIGINT,
    cost_of_revenue BIGINT,
    gross_profit BIGINT,
    operating_expenses BIGINT,
    operating_income BIGINT,
    research_and_development BIGINT,
    selling_general_administrative BIGINT,
    interest_expense BIGINT,
    income_before_tax BIGINT,
    income_tax_expense BIGINT,
    net_income BIGINT,
    ebit BIGINT,
    ebitda BIGINT,
    
    -- Per Share Data
    eps NUMERIC(12, 4),
    eps_diluted NUMERIC(12, 4),
    
    -- Balance Sheet
    total_assets BIGINT,
    total_current_assets BIGINT,
    cash_and_equivalents BIGINT,
    total_liabilities BIGINT,
    total_current_liabilities BIGINT,
    long_term_debt BIGINT,
    total_shareholder_equity BIGINT,
    retained_earnings BIGINT,
    common_stock_shares_outstanding BIGINT,
    
    -- Cash Flow
    operating_cashflow BIGINT,
    capital_expenditures BIGINT,
    investing_cashflow BIGINT,
    financing_cashflow BIGINT,
    dividend_payout BIGINT,
    free_cash_flow BIGINT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asset_id, fiscal_date_ending)
);

-- ============================================================================
-- Table: equity_annual_fundamentals
-- Stores annual financial statement data for equities
-- ============================================================================
CREATE TABLE IF NOT EXISTS equity_annual_fundamentals (
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    fiscal_date_ending DATE NOT NULL,
    reported_currency VARCHAR(10),
    
    -- Income Statement
    total_revenue BIGINT,
    cost_of_revenue BIGINT,
    gross_profit BIGINT,
    operating_expenses BIGINT,
    operating_income BIGINT,
    research_and_development BIGINT,
    selling_general_administrative BIGINT,
    interest_expense BIGINT,
    income_before_tax BIGINT,
    income_tax_expense BIGINT,
    net_income BIGINT,
    ebit BIGINT,
    ebitda BIGINT,
    
    -- Per Share Data
    eps NUMERIC(12, 4),
    eps_diluted NUMERIC(12, 4),
    
    -- Balance Sheet
    total_assets BIGINT,
    total_current_assets BIGINT,
    cash_and_equivalents BIGINT,
    total_liabilities BIGINT,
    total_current_liabilities BIGINT,
    long_term_debt BIGINT,
    total_shareholder_equity BIGINT,
    retained_earnings BIGINT,
    common_stock_shares_outstanding BIGINT,
    
    -- Cash Flow
    operating_cashflow BIGINT,
    capital_expenditures BIGINT,
    investing_cashflow BIGINT,
    financing_cashflow BIGINT,
    dividend_payout BIGINT,
    free_cash_flow BIGINT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (asset_id, fiscal_date_ending)
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_equity_quarterly_fundamentals_asset_id 
    ON equity_quarterly_fundamentals(asset_id);
CREATE INDEX IF NOT EXISTS idx_equity_quarterly_fundamentals_date 
    ON equity_quarterly_fundamentals(fiscal_date_ending DESC);

CREATE INDEX IF NOT EXISTS idx_equity_annual_fundamentals_asset_id 
    ON equity_annual_fundamentals(asset_id);
CREATE INDEX IF NOT EXISTS idx_equity_annual_fundamentals_date 
    ON equity_annual_fundamentals(fiscal_date_ending DESC);

-- ============================================================================
-- Add new columns to equity_metadata for live metrics from OVERVIEW endpoint
-- ============================================================================
ALTER TABLE equity_metadata 
    ADD COLUMN IF NOT EXISTS shares_outstanding BIGINT,
    ADD COLUMN IF NOT EXISTS peg_ratio NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS forward_pe NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS trailing_pe NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS price_to_sales_ttm NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS price_to_book NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS ev_to_revenue NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS ev_to_ebitda NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS operating_margin_ttm NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS return_on_assets_ttm NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS return_on_equity_ttm NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS revenue_ttm BIGINT,
    ADD COLUMN IF NOT EXISTS gross_profit_ttm BIGINT,
    ADD COLUMN IF NOT EXISTS diluted_eps_ttm NUMERIC(12, 4),
    ADD COLUMN IF NOT EXISTS quarterly_earnings_growth_yoy NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS quarterly_revenue_growth_yoy NUMERIC(10, 4),
    ADD COLUMN IF NOT EXISTS analyst_target_price NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS fiscal_year_end VARCHAR(20);

-- ============================================================================
-- Trigger to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_fundamentals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_equity_quarterly_fundamentals_updated_at ON equity_quarterly_fundamentals;
CREATE TRIGGER trigger_equity_quarterly_fundamentals_updated_at
    BEFORE UPDATE ON equity_quarterly_fundamentals
    FOR EACH ROW
    EXECUTE FUNCTION update_fundamentals_updated_at();

DROP TRIGGER IF EXISTS trigger_equity_annual_fundamentals_updated_at ON equity_annual_fundamentals;
CREATE TRIGGER trigger_equity_annual_fundamentals_updated_at
    BEFORE UPDATE ON equity_annual_fundamentals
    FOR EACH ROW
    EXECUTE FUNCTION update_fundamentals_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE equity_quarterly_fundamentals IS 'Stores quarterly financial statement data for equities from Alpha Vantage';
COMMENT ON TABLE equity_annual_fundamentals IS 'Stores annual financial statement data for equities from Alpha Vantage';

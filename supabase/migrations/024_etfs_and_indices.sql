-- Migration: 024_etfs_and_indices.sql
-- Description: Create tables for ETFs and market indices
-- Date: 2026-01-15

-- ============================================================================
-- ETFs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS etf_assets (
    etf_id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    asset_class VARCHAR(50),  -- Equity, Bond, Commodity, Currency, Multi-Asset, etc.
    geography VARCHAR(100),   -- U.S., Global, Emerging Markets, etc.
    category VARCHAR(100),    -- Large Cap, Small Cap, Sector, Thematic, etc.
    issuer VARCHAR(100),      -- Vanguard, iShares, SPDR, etc.
    expense_ratio DECIMAL(6,4),
    is_active BOOLEAN DEFAULT true,
    data_vendor VARCHAR(50) DEFAULT 'fmp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indices Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_indices (
    index_id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(50),       -- US, Europe, Asia, Global
    country VARCHAR(50),      -- USA, Japan, UK, Germany, etc.
    index_type VARCHAR(50),   -- Equity, Bond, Volatility, Currency, Commodity
    is_active BOOLEAN DEFAULT true,
    data_vendor VARCHAR(50) DEFAULT 'fmp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Daily Bars for ETFs
-- ============================================================================
CREATE TABLE IF NOT EXISTS etf_daily_bars (
    etf_id INTEGER NOT NULL REFERENCES etf_assets(etf_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    open DECIMAL(18,8),
    high DECIMAL(18,8),
    low DECIMAL(18,8),
    close DECIMAL(18,8),
    volume DECIMAL(20,2),
    source VARCHAR(50) DEFAULT 'fmp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (etf_id, date)
);

-- ============================================================================
-- Daily Bars for Indices
-- ============================================================================
CREATE TABLE IF NOT EXISTS index_daily_bars (
    index_id INTEGER NOT NULL REFERENCES market_indices(index_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    open DECIMAL(18,8),
    high DECIMAL(18,8),
    low DECIMAL(18,8),
    close DECIMAL(18,8),
    volume DECIMAL(20,2),
    source VARCHAR(50) DEFAULT 'fmp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (index_id, date)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_etf_daily_bars_date ON etf_daily_bars(date);
CREATE INDEX IF NOT EXISTS idx_etf_daily_bars_etf_date ON etf_daily_bars(etf_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_index_daily_bars_date ON index_daily_bars(date);
CREATE INDEX IF NOT EXISTS idx_index_daily_bars_index_date ON index_daily_bars(index_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_etf_assets_symbol ON etf_assets(symbol);
CREATE INDEX IF NOT EXISTS idx_etf_assets_asset_class ON etf_assets(asset_class);
CREATE INDEX IF NOT EXISTS idx_market_indices_symbol ON market_indices(symbol);
CREATE INDEX IF NOT EXISTS idx_market_indices_region ON market_indices(region);

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE etf_assets IS 'Master list of ETFs tracked in the system';
COMMENT ON TABLE market_indices IS 'Master list of market indices tracked in the system';
COMMENT ON TABLE etf_daily_bars IS 'Daily OHLCV data for ETFs';
COMMENT ON TABLE index_daily_bars IS 'Daily OHLCV data for market indices';

-- Migration: 025_commodities.sql
-- Description: Add commodities table and daily bars for commodity futures

-- Commodities master table
CREATE TABLE IF NOT EXISTS commodities (
    commodity_id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50),  -- precious_metals, energy, base_metals, agriculture, livestock, interest_rates, currency
    unit VARCHAR(50),      -- oz, barrel, bushel, lb, etc.
    is_active BOOLEAN DEFAULT true,
    data_vendor VARCHAR(50) DEFAULT 'fmp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commodity daily bars
CREATE TABLE IF NOT EXISTS commodity_daily_bars (
    bar_id BIGSERIAL PRIMARY KEY,
    commodity_id INTEGER NOT NULL REFERENCES commodities(commodity_id),
    date DATE NOT NULL,
    open DECIMAL(18, 6),
    high DECIMAL(18, 6),
    low DECIMAL(18, 6),
    close DECIMAL(18, 6),
    volume BIGINT,
    source VARCHAR(50) DEFAULT 'fmp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(commodity_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commodities_symbol ON commodities(symbol);
CREATE INDEX IF NOT EXISTS idx_commodities_category ON commodities(category);
CREATE INDEX IF NOT EXISTS idx_commodity_daily_bars_date ON commodity_daily_bars(date);
CREATE INDEX IF NOT EXISTS idx_commodity_daily_bars_commodity_date ON commodity_daily_bars(commodity_id, date);

-- Comments
COMMENT ON TABLE commodities IS 'Master table for commodity futures (gold, oil, natural gas, etc.)';
COMMENT ON TABLE commodity_daily_bars IS 'Daily OHLCV data for commodities from FMP';

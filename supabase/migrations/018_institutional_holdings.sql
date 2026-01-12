-- Migration: Add institutional holdings data table
-- Purpose: Store quarterly institutional ownership data from FMP API for agent analysis

CREATE TABLE IF NOT EXISTS institutional_holdings (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    cik TEXT NOT NULL,
    date DATE NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL,
    
    -- Holder Metrics
    investors_holding INTEGER,
    last_investors_holding INTEGER,
    investors_holding_change INTEGER,
    
    -- Share Metrics
    number_of_13f_shares BIGINT,
    last_number_of_13f_shares BIGINT,
    number_of_13f_shares_change BIGINT,
    
    -- Value Metrics
    total_invested BIGINT,
    last_total_invested BIGINT,
    total_invested_change BIGINT,
    
    -- Ownership Metrics
    ownership_percent NUMERIC(10, 4),
    last_ownership_percent NUMERIC(10, 4),
    ownership_percent_change NUMERIC(10, 4),
    
    -- Position Change Metrics
    new_positions INTEGER,
    last_new_positions INTEGER,
    new_positions_change INTEGER,
    
    increased_positions INTEGER,
    last_increased_positions INTEGER,
    increased_positions_change INTEGER,
    
    closed_positions INTEGER,
    last_closed_positions INTEGER,
    closed_positions_change INTEGER,
    
    reduced_positions INTEGER,
    last_reduced_positions INTEGER,
    reduced_positions_change INTEGER,
    
    -- Options Metrics
    total_calls BIGINT,
    last_total_calls BIGINT,
    total_calls_change BIGINT,
    
    total_puts BIGINT,
    last_total_puts BIGINT,
    total_puts_change BIGINT,
    
    put_call_ratio NUMERIC(10, 4),
    last_put_call_ratio NUMERIC(10, 4),
    put_call_ratio_change NUMERIC(10, 4),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(symbol, year, quarter)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_institutional_holdings_symbol ON institutional_holdings(symbol);
CREATE INDEX IF NOT EXISTS idx_institutional_holdings_date ON institutional_holdings(date DESC);
CREATE INDEX IF NOT EXISTS idx_institutional_holdings_symbol_date ON institutional_holdings(symbol, date DESC);

-- RLS Policies (allow authenticated users to read)
ALTER TABLE institutional_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read institutional holdings"
    ON institutional_holdings
    FOR SELECT
    TO authenticated
    USING (true);

-- Grant permissions
GRANT SELECT ON institutional_holdings TO authenticated;
GRANT ALL ON institutional_holdings TO service_role;

-- Comment
COMMENT ON TABLE institutional_holdings IS 'Quarterly institutional ownership data from 13F filings via FMP API';

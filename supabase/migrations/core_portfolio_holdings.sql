-- Migration: Create new core_portfolio_holdings table for real portfolio tracking
-- This replaces the simple core_portfolio_items table with a more comprehensive schema

-- Create enum for asset categories
DO $$ BEGIN
    CREATE TYPE portfolio_asset_category AS ENUM (
        'dats',      -- Digital Asset Trust Securities
        'tokens',    -- Crypto tokens
        'equities',  -- Stocks
        'options',   -- Options contracts
        'cash',      -- Cash positions
        'other'      -- Other assets
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the new core_portfolio_holdings table
CREATE TABLE IF NOT EXISTS core_portfolio_holdings (
    id SERIAL PRIMARY KEY,
    
    -- Asset identification (nullable for manual entries)
    asset_id INTEGER REFERENCES assets(asset_id) ON DELETE SET NULL,
    
    -- Manual entry fields (used when asset_id is null)
    custom_symbol VARCHAR(50),
    custom_name VARCHAR(255),
    custom_asset_type VARCHAR(50), -- 'equity', 'crypto', 'option', 'cash', etc.
    
    -- Category for grouping
    category portfolio_asset_category NOT NULL DEFAULT 'other',
    
    -- Position details
    quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
    cost_basis NUMERIC(20, 8), -- Cost per unit
    total_cost NUMERIC(20, 2), -- Total cost (quantity * cost_basis or manual entry)
    
    -- For options/warrants
    strike_price NUMERIC(20, 2),
    expiration_date DATE,
    option_type VARCHAR(10), -- 'call', 'put'
    
    -- Current pricing (can be manually overridden)
    manual_price NUMERIC(20, 8), -- Override price if set
    
    -- Metadata
    notes TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    added_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_core_portfolio_holdings_asset_id ON core_portfolio_holdings(asset_id);
CREATE INDEX IF NOT EXISTS idx_core_portfolio_holdings_category ON core_portfolio_holdings(category);
CREATE INDEX IF NOT EXISTS idx_core_portfolio_holdings_active ON core_portfolio_holdings(is_active);

-- Create a view that joins with assets and daily data for current prices
CREATE OR REPLACE VIEW v_core_portfolio_holdings AS
SELECT 
    h.id,
    h.asset_id,
    h.custom_symbol,
    h.custom_name,
    h.custom_asset_type,
    h.category,
    h.quantity,
    h.cost_basis,
    h.total_cost,
    h.strike_price,
    h.expiration_date,
    h.option_type,
    h.manual_price,
    h.notes,
    h.display_order,
    h.is_active,
    h.added_at,
    h.updated_at,
    
    -- Asset info (from assets table or custom fields)
    COALESCE(a.symbol, h.custom_symbol) AS symbol,
    COALESCE(a.name, h.custom_name) AS name,
    COALESCE(a.asset_type::text, h.custom_asset_type) AS asset_type,
    a.sector,
    a.industry,
    
    -- Current price (manual override > latest close)
    COALESCE(h.manual_price, df.close) AS current_price,
    
    -- Calculated fields
    CASE 
        WHEN h.manual_price IS NOT NULL THEN h.quantity * h.manual_price
        WHEN df.close IS NOT NULL THEN h.quantity * df.close
        ELSE h.total_cost
    END AS current_value,
    
    CASE 
        WHEN h.total_cost IS NOT NULL AND h.total_cost > 0 THEN
            ((COALESCE(h.manual_price, df.close, 0) * h.quantity) - h.total_cost) / h.total_cost * 100
        ELSE NULL
    END AS gain_loss_pct,
    
    CASE 
        WHEN h.total_cost IS NOT NULL THEN
            (COALESCE(h.manual_price, df.close, 0) * h.quantity) - h.total_cost
        ELSE NULL
    END AS gain_loss_value,
    
    -- AI scores from daily features
    df.ai_direction_score,
    df.ai_setup_quality_score,
    
    -- Return metrics
    df.return_1d,
    df.return_7d,
    df.return_30d,
    df.return_365d

FROM core_portfolio_holdings h
LEFT JOIN assets a ON h.asset_id = a.asset_id
LEFT JOIN LATERAL (
    SELECT 
        close,
        ai_direction_score,
        ai_setup_quality_score,
        return_1d * 100 as return_1d,
        return_5d * 100 as return_7d,
        return_21d * 100 as return_30d,
        return_252d * 100 as return_365d
    FROM daily_features 
    WHERE asset_id = h.asset_id 
    ORDER BY date DESC 
    LIMIT 1
) df ON true
WHERE h.is_active = true
ORDER BY h.category, h.display_order, h.id;

-- Create a summary view for portfolio totals
CREATE OR REPLACE VIEW v_core_portfolio_summary AS
SELECT 
    COUNT(*) as total_positions,
    SUM(current_value) as total_value,
    SUM(total_cost) as total_cost,
    CASE 
        WHEN SUM(total_cost) > 0 THEN 
            (SUM(current_value) - SUM(total_cost)) / SUM(total_cost) * 100
        ELSE 0
    END as total_gain_loss_pct,
    SUM(current_value) - SUM(total_cost) as total_gain_loss_value
FROM v_core_portfolio_holdings;

-- Create category summary view
CREATE OR REPLACE VIEW v_core_portfolio_by_category AS
SELECT 
    category,
    COUNT(*) as position_count,
    SUM(current_value) as category_value,
    SUM(total_cost) as category_cost,
    CASE 
        WHEN SUM(total_cost) > 0 THEN 
            (SUM(current_value) - SUM(total_cost)) / SUM(total_cost) * 100
        ELSE 0
    END as category_gain_loss_pct
FROM v_core_portfolio_holdings
GROUP BY category
ORDER BY category;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_core_portfolio_holdings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_core_portfolio_holdings_updated_at ON core_portfolio_holdings;
CREATE TRIGGER trigger_update_core_portfolio_holdings_updated_at
    BEFORE UPDATE ON core_portfolio_holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_core_portfolio_holdings_updated_at();

-- Add comment for documentation
COMMENT ON TABLE core_portfolio_holdings IS 'Tracks real portfolio holdings with quantity, cost basis, and support for manual entries';
COMMENT ON VIEW v_core_portfolio_holdings IS 'Portfolio holdings with calculated current values, gain/loss, and AI scores';

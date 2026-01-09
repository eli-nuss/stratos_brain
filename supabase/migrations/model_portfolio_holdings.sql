-- Create model_portfolio_holdings table
CREATE TABLE IF NOT EXISTS model_portfolio_holdings (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER REFERENCES assets(asset_id),
    custom_symbol VARCHAR(50),
    custom_name VARCHAR(255),
    custom_asset_type VARCHAR(50),
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    quantity DECIMAL(20, 8) DEFAULT 0,
    cost_basis DECIMAL(20, 8),
    total_cost DECIMAL(20, 2),
    manual_price DECIMAL(20, 8),
    target_weight DECIMAL(5, 2),
    notes TEXT,
    strike_price DECIMAL(20, 2),
    expiration_date DATE,
    option_type VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT model_portfolio_holdings_category_check CHECK (category IN ('dats', 'tokens', 'equities', 'options', 'cash', 'other'))
);

-- Create view for model portfolio holdings with calculated fields
CREATE OR REPLACE VIEW v_model_portfolio_holdings AS
SELECT 
    mph.id,
    mph.asset_id,
    mph.custom_symbol,
    mph.custom_name,
    mph.custom_asset_type,
    mph.category,
    mph.quantity,
    mph.cost_basis,
    mph.total_cost,
    mph.manual_price,
    mph.target_weight,
    mph.notes,
    mph.strike_price,
    mph.expiration_date,
    mph.option_type,
    mph.created_at,
    mph.updated_at,
    -- Asset info from joined table
    a.symbol,
    a.name,
    a.asset_type,
    -- Current price (use manual_price if set, otherwise from dashboard view)
    COALESCE(mph.manual_price, vdb.price) as current_price,
    -- Calculated fields
    COALESCE(mph.total_cost, mph.quantity * mph.cost_basis) as calculated_total_cost,
    mph.quantity * COALESCE(mph.manual_price, vdb.price, 0) as current_value,
    CASE 
        WHEN COALESCE(mph.total_cost, mph.quantity * mph.cost_basis, 0) > 0 
        THEN ((mph.quantity * COALESCE(mph.manual_price, vdb.price, 0)) - COALESCE(mph.total_cost, mph.quantity * mph.cost_basis, 0)) / COALESCE(mph.total_cost, mph.quantity * mph.cost_basis, 0) * 100
        ELSE 0 
    END as gain_loss_pct
FROM model_portfolio_holdings mph
LEFT JOIN assets a ON mph.asset_id = a.asset_id
LEFT JOIN v_dashboard_base vdb ON mph.asset_id = vdb.asset_id;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_model_portfolio_holdings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS model_portfolio_holdings_updated_at ON model_portfolio_holdings;
CREATE TRIGGER model_portfolio_holdings_updated_at
    BEFORE UPDATE ON model_portfolio_holdings
    FOR EACH ROW
    EXECUTE FUNCTION update_model_portfolio_holdings_updated_at();

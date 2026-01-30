-- Migration: 029_supply_chain_map.sql
-- Description: Create tables for AI Infrastructure Supply Chain Market Map feature
-- Date: 2026-01-30

-- ============================================================================
-- Step 1: Reactivate Data Center REITs (needed for Tier 3)
-- ============================================================================
UPDATE assets SET is_active = true WHERE symbol IN ('EQIX', 'DLR', 'AMT');

-- ============================================================================
-- Step 2: Add is_private column to assets table for private companies
-- ============================================================================
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Step 3: Create supply chain tiers table
-- ============================================================================
CREATE TABLE IF NOT EXISTS supply_chain_tiers (
    tier_id SERIAL PRIMARY KEY,
    tier_number INTEGER NOT NULL,           -- -1 for base layer, 0-5 for main tiers
    tier_name VARCHAR(100) NOT NULL,
    tier_short_name VARCHAR(50),
    tier_description TEXT,
    display_order INTEGER NOT NULL,
    color_code VARCHAR(7),                  -- Hex color for visualization
    is_bottleneck BOOLEAN DEFAULT FALSE,    -- Highlight constraint tiers
    icon_name VARCHAR(50),                  -- Icon identifier for UI
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 4: Create supply chain categories table (subcategories within tiers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS supply_chain_categories (
    category_id SERIAL PRIMARY KEY,
    tier_id INTEGER NOT NULL REFERENCES supply_chain_tiers(tier_id) ON DELETE CASCADE,
    category_name VARCHAR(100) NOT NULL,
    category_description TEXT,
    display_order INTEGER NOT NULL,
    market_size_2024 BIGINT,               -- Estimated market size in USD
    market_size_2025e BIGINT,              -- Projected market size
    cagr_percent NUMERIC(5,2),             -- Compound annual growth rate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 5: Create asset to supply chain mapping table
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_supply_chain_mapping (
    mapping_id SERIAL PRIMARY KEY,
    asset_id BIGINT REFERENCES assets(asset_id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES supply_chain_categories(category_id) ON DELETE CASCADE,
    role_description TEXT,                  -- e.g., "GPU manufacturer", "Leading foundry"
    market_share_percent NUMERIC(5,2),      -- Estimated market share in category
    is_primary_category BOOLEAN DEFAULT TRUE,  -- Primary vs secondary categorization
    display_order INTEGER DEFAULT 0,
    key_products TEXT[],                    -- Array of key product names
    competitive_position VARCHAR(50),       -- 'leader', 'challenger', 'niche'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_id, category_id)
);

-- ============================================================================
-- Step 6: Create private companies table for non-public companies
-- ============================================================================
CREATE TABLE IF NOT EXISTS private_companies (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category_id INTEGER REFERENCES supply_chain_categories(category_id) ON DELETE SET NULL,
    headquarters_country VARCHAR(50),
    headquarters_city VARCHAR(100),
    estimated_valuation BIGINT,             -- Latest valuation in USD
    estimated_revenue BIGINT,               -- Estimated annual revenue in USD
    funding_stage VARCHAR(50),              -- 'Series A', 'Series B', etc.
    total_funding BIGINT,                   -- Total funding raised
    key_investors TEXT[],                   -- Array of major investors
    founded_year INTEGER,
    employee_count_range VARCHAR(50),       -- e.g., '100-500', '1000-5000'
    description TEXT,
    role_description TEXT,                  -- Role in supply chain
    key_products TEXT[],
    competitive_position VARCHAR(50),
    website_url VARCHAR(255),
    logo_url VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 7: Seed tier data
-- ============================================================================
INSERT INTO supply_chain_tiers (tier_number, tier_name, tier_short_name, tier_description, display_order, color_code, is_bottleneck, icon_name) VALUES
(-1, 'Raw Materials', 'Base', 'Silicon wafers, rare earths, process gases and chemicals - the foundation of semiconductor manufacturing', 0, '#8B4513', false, 'layers'),
(0, 'Wafer-Level Foundation', 'Tier 0', 'Foundries, EUV lithography equipment, and semiconductor manufacturing equipment', 1, '#1E3A5F', false, 'cpu'),
(1, 'Chip Integration', 'Tier 1', 'Logic chips (GPUs/TPUs), HBM memory, advanced packaging (CoWoS), and substrates - CURRENT BOTTLENECK', 2, '#DC2626', true, 'microchip'),
(2, 'System Integration', 'Tier 2', 'Server OEMs, AI-optimized networking, and petabyte-scale storage systems', 3, '#0369A1', false, 'server'),
(3, 'Data Center Physical', 'Tier 3', 'Colocation facilities, thermal management, and power infrastructure', 4, '#7C3AED', false, 'building'),
(4, 'Cloud & Orchestration', 'Tier 4', 'Hyperscale cloud providers, GPU cloud platforms, and AI infrastructure services', 5, '#059669', false, 'cloud'),
(5, 'Application Layer', 'Tier 5', 'Foundation models, consumer AI applications, and enterprise AI solutions', 6, '#D97706', false, 'sparkles')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 8: Seed category data
-- ============================================================================

-- Base Layer Categories
INSERT INTO supply_chain_categories (tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent) VALUES
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = -1), 'Silicon Wafers', 'High-purity silicon wafer manufacturing for semiconductor fabrication', 1, 12000000000, 7.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = -1), 'Rare Earths & Critical Minerals', 'Rare earth elements, copper, gallium, and other critical materials', 2, 15000000000, 15.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = -1), 'Process Gases & Chemicals', 'Ultra-high-purity gases, CMP slurries, and specialty chemicals', 3, 8000000000, 9.8);

-- Tier 0 Categories
INSERT INTO supply_chain_categories (tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent) VALUES
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 0), 'Foundries', 'Semiconductor fabrication facilities for logic and memory chips', 1, 150000000000, 12.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 0), 'EUV Lithography', 'Extreme ultraviolet lithography equipment for advanced nodes', 2, 25000000000, 15.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 0), 'Semiconductor Equipment', 'Deposition, etch, metrology, and other fab equipment', 3, 100000000000, 10.0);

-- Tier 1 Categories (Bottleneck Tier)
INSERT INTO supply_chain_categories (tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent) VALUES
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 1), 'Logic - GPUs & Accelerators', 'Graphics processing units and AI accelerator chips', 1, 78000000000, 60.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 1), 'HBM Memory', 'High Bandwidth Memory for AI training and inference', 2, 18000000000, 78.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 1), 'Advanced Packaging (CoWoS)', 'Chip-on-Wafer-on-Substrate and other 2.5D/3D packaging', 3, 6000000000, 50.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 1), 'Substrates & Interposers', 'ABF substrates and silicon interposers for advanced packaging', 4, 4500000000, 44.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 1), 'Analog & Mixed Signal', 'Power management, RF, and analog semiconductors', 5, 65000000000, 8.0);

-- Tier 2 Categories
INSERT INTO supply_chain_categories (tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent) VALUES
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 2), 'Server OEMs', 'AI server manufacturers and system integrators', 1, 65000000000, 37.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 2), 'AI Networking', 'InfiniBand, high-speed Ethernet, and optical interconnects', 2, 14000000000, 25.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 2), 'Storage Systems', 'Enterprise storage for AI training data and model weights', 3, 7000000000, 30.0);

-- Tier 3 Categories
INSERT INTO supply_chain_categories (tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent) VALUES
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 3), 'Colocation & Data Centers', 'Data center facilities and colocation services', 1, 80000000000, 12.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 3), 'Thermal Management', 'Liquid cooling, immersion cooling, and thermal solutions', 2, 5000000000, 25.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 3), 'Power Infrastructure', 'UPS, power distribution, and electrical equipment', 3, 15000000000, 10.0);

-- Tier 4 Categories
INSERT INTO supply_chain_categories (tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent) VALUES
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 4), 'Hyperscale Cloud', 'Major cloud providers with AI infrastructure', 1, 250000000000, 20.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 4), 'GPU Cloud & AI Infrastructure', 'Specialized GPU cloud and AI compute providers', 2, 10000000000, 100.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 4), 'Cloud Software & Orchestration', 'Kubernetes, MLOps, and cloud management platforms', 3, 20000000000, 25.0);

-- Tier 5 Categories
INSERT INTO supply_chain_categories (tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent) VALUES
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 5), 'Foundation Models', 'Large language models and multimodal AI systems', 1, 15000000000, 150.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 5), 'Consumer AI', 'Consumer-facing AI applications and assistants', 2, 10000000000, 80.0),
((SELECT tier_id FROM supply_chain_tiers WHERE tier_number = 5), 'Enterprise AI', 'Enterprise AI platforms, copilots, and agents', 3, 25000000000, 40.0);

-- ============================================================================
-- Step 9: Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_supply_chain_tiers_tier_number ON supply_chain_tiers(tier_number);
CREATE INDEX IF NOT EXISTS idx_supply_chain_categories_tier_id ON supply_chain_categories(tier_id);
CREATE INDEX IF NOT EXISTS idx_asset_supply_chain_mapping_asset_id ON asset_supply_chain_mapping(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_supply_chain_mapping_category_id ON asset_supply_chain_mapping(category_id);
CREATE INDEX IF NOT EXISTS idx_private_companies_category_id ON private_companies(category_id);

-- ============================================================================
-- Step 10: Create view for supply chain overview with company data
-- ============================================================================
CREATE OR REPLACE VIEW v_supply_chain_overview AS
SELECT 
    t.tier_id,
    t.tier_number,
    t.tier_name,
    t.tier_short_name,
    t.tier_description,
    t.color_code,
    t.is_bottleneck,
    t.icon_name,
    t.display_order as tier_display_order,
    c.category_id,
    c.category_name,
    c.category_description,
    c.market_size_2024,
    c.market_size_2025e,
    c.cagr_percent,
    c.display_order as category_display_order,
    -- Count of public companies in category
    (SELECT COUNT(*) FROM asset_supply_chain_mapping m WHERE m.category_id = c.category_id) as public_company_count,
    -- Count of private companies in category
    (SELECT COUNT(*) FROM private_companies p WHERE p.category_id = c.category_id) as private_company_count
FROM supply_chain_tiers t
LEFT JOIN supply_chain_categories c ON t.tier_id = c.tier_id
ORDER BY t.display_order, c.display_order;

-- ============================================================================
-- Step 11: Create view for companies in supply chain with financial data
-- ============================================================================
CREATE OR REPLACE VIEW v_supply_chain_companies AS
SELECT 
    'public' as company_type,
    a.asset_id::TEXT as company_id,
    a.symbol,
    a.name,
    a.asset_type,
    t.tier_id,
    t.tier_number,
    t.tier_name,
    c.category_id,
    c.category_name,
    m.role_description,
    m.market_share_percent,
    m.competitive_position,
    m.key_products,
    m.display_order,
    -- Financial data from equity_metadata
    em.market_cap,
    em.revenue_ttm,
    em.profit_margin,
    em.ev_to_revenue,
    em.ev_to_ebitda,
    em.sector,
    em.industry,
    -- Latest price data
    db.close as latest_price,
    df.return_1d,
    df.return_5d as return_7d,
    df.return_21d as return_30d,
    df.return_252d as return_1y,
    -- AI analysis
    air.attention_level as ai_attention,
    air.direction as ai_direction,
    air.summary_text as ai_summary
FROM asset_supply_chain_mapping m
JOIN assets a ON m.asset_id = a.asset_id
JOIN supply_chain_categories c ON m.category_id = c.category_id
JOIN supply_chain_tiers t ON c.tier_id = t.tier_id
LEFT JOIN equity_metadata em ON a.symbol = em.symbol
LEFT JOIN daily_bars db ON a.asset_id = db.asset_id 
    AND db.date = (SELECT MAX(date) FROM daily_bars WHERE asset_id = a.asset_id)
LEFT JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = db.date
LEFT JOIN asset_ai_reviews air ON a.asset_id::TEXT = air.asset_id AND air.as_of_date = db.date
WHERE a.is_active = true

UNION ALL

SELECT 
    'private' as company_type,
    'private_' || p.company_id::TEXT as company_id,
    NULL as symbol,
    p.name,
    'private' as asset_type,
    t.tier_id,
    t.tier_number,
    t.tier_name,
    c.category_id,
    c.category_name,
    p.role_description,
    NULL as market_share_percent,
    p.competitive_position,
    p.key_products,
    p.display_order,
    -- Private company estimated data
    p.estimated_valuation as market_cap,
    p.estimated_revenue as revenue_ttm,
    NULL as profit_margin,
    NULL as ev_to_revenue,
    NULL as ev_to_ebitda,
    NULL as sector,
    NULL as industry,
    NULL as latest_price,
    NULL as return_1d,
    NULL as return_7d,
    NULL as return_30d,
    NULL as return_1y,
    NULL as ai_attention,
    NULL as ai_direction,
    NULL as ai_summary
FROM private_companies p
LEFT JOIN supply_chain_categories c ON p.category_id = c.category_id
LEFT JOIN supply_chain_tiers t ON c.tier_id = t.tier_id;

-- ============================================================================
-- Step 12: Add comments for documentation
-- ============================================================================
COMMENT ON TABLE supply_chain_tiers IS 'AI Infrastructure Supply Chain tier definitions (Base Layer through Tier 5)';
COMMENT ON TABLE supply_chain_categories IS 'Categories within each supply chain tier (e.g., Foundries, GPUs, Cloud)';
COMMENT ON TABLE asset_supply_chain_mapping IS 'Maps public companies (assets) to supply chain categories';
COMMENT ON TABLE private_companies IS 'Private companies in the AI infrastructure supply chain';
COMMENT ON VIEW v_supply_chain_overview IS 'Aggregated view of supply chain tiers and categories with company counts';
COMMENT ON VIEW v_supply_chain_companies IS 'All companies (public and private) in the supply chain with financial data';

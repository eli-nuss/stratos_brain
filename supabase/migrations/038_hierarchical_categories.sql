-- Migration 038: Add hierarchical category support for Raw Materials tier
-- This creates a parent-child relationship for Critical Minerals and its sub-categories

-- Add parent_category_id column to support hierarchical categories
ALTER TABLE supply_chain_categories 
ADD COLUMN IF NOT EXISTS parent_category_id INTEGER REFERENCES supply_chain_categories(category_id) ON DELETE SET NULL;

-- Add index for parent lookups
CREATE INDEX IF NOT EXISTS idx_supply_chain_categories_parent ON supply_chain_categories(parent_category_id);

-- Rename 'Rare Earth Producers' to 'Critical Minerals' to serve as parent category
UPDATE supply_chain_categories 
SET category_name = 'Critical Minerals',
    category_description = 'Rare earths, lithium, cobalt, graphite, and other critical minerals essential for semiconductors and batteries'
WHERE category_id = 2;

-- Set Critical Minerals (2) as parent for all mineral sub-categories
UPDATE supply_chain_categories 
SET parent_category_id = 2
WHERE category_id IN (30, 31, 32, 33, 34);  -- Lithium, Cobalt, Graphite, Gallium, Silicon Metal

-- Create a new 'Rare Earths' sub-category under Critical Minerals
INSERT INTO supply_chain_categories (category_id, tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent, parent_category_id)
VALUES (36, 1, 'Rare Earths', 'Rare earth element producers for magnets, electronics, and defense applications', 0, 15000000000, 15.00, 2)
ON CONFLICT (category_id) DO NOTHING;

-- Move rare earth companies from Critical Minerals (2) to Rare Earths sub-category (36)
UPDATE asset_supply_chain_mapping 
SET category_id = 36
WHERE category_id = 2;

-- Update display order for sub-categories to be nested under parent
UPDATE supply_chain_categories SET display_order = 0 WHERE category_id = 36;  -- Rare Earths
UPDATE supply_chain_categories SET display_order = 1 WHERE category_id = 30;  -- Lithium
UPDATE supply_chain_categories SET display_order = 2 WHERE category_id = 31;  -- Cobalt
UPDATE supply_chain_categories SET display_order = 3 WHERE category_id = 32;  -- Graphite
UPDATE supply_chain_categories SET display_order = 4 WHERE category_id = 33;  -- Gallium
UPDATE supply_chain_categories SET display_order = 5 WHERE category_id = 34;  -- Silicon Metal

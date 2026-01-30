-- Migration: Expand Raw Materials Tier with Critical Minerals Categories
-- Based on Rare Earths & Critical Minerals Analysis

-- Rename the existing "Rare Earths & Critical Minerals" category to "Rare Earth Producers"
UPDATE supply_chain_categories 
SET category_name = 'Rare Earth Producers',
    category_description = 'Companies mining and processing rare earth elements critical for magnets, electronics, and defense',
    market_size_2024 = 15000000000,
    market_size_2025e = 17250000000,
    cagr_percent = 15.0
WHERE category_id = 2;

-- Insert new categories for Raw Materials tier
INSERT INTO supply_chain_categories (category_id, tier_id, category_name, category_description, market_size_2024, market_size_2025e, cagr_percent, display_order)
VALUES 
(30, 1, 'Lithium Producers', 'Companies mining and refining lithium for batteries powering AI data centers and EVs', 18000000000, 21000000000, 16.5, 4),
(31, 1, 'Cobalt Producers', 'Companies producing cobalt for battery cathodes and superalloys', 12000000000, 13560000000, 13.0, 5),
(32, 1, 'Graphite Producers', 'Companies mining and processing graphite for battery anodes and thermal management', 25000000000, 28875000000, 15.5, 6),
(33, 1, 'Gallium & Specialty Metals', 'Producers of gallium, germanium, and other specialty metals for semiconductors', 3000000000, 3540000000, 18.0, 7),
(34, 1, 'Silicon Metal Producers', 'Companies producing metallurgical and solar-grade silicon', 7900000000, 8335000000, 5.5, 8)
ON CONFLICT (category_id) DO NOTHING;

-- Add USA Rare Earth to Rare Earth Producers (category 2)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, key_products, market_share_percent, competitive_position, display_order)
VALUES (2492, 2, 'US-based rare earth magnet manufacturer reducing China dependency', ARRAY['NdFeB magnets', 'rare earth processing'], 3.0, 'challenger', 4)
ON CONFLICT DO NOTHING;

-- LITHIUM PRODUCERS (category 30)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, key_products, market_share_percent, competitive_position, display_order)
VALUES 
(2652, 30, 'World''s largest lithium producer with operations in Chile, Australia, and US', ARRAY['Lithium carbonate', 'lithium hydroxide', 'spodumene'], 20.0, 'leader', 1),
(8570, 30, 'Second-largest global lithium producer from Chilean brine operations', ARRAY['Lithium carbonate', 'lithium hydroxide', 'potassium'], 18.0, 'leader', 2),
(4484, 30, 'Developer of Thacker Pass, largest known lithium deposit in North America', ARRAY['Lithium carbonate'], 2.0, 'emerging', 3),
(9327, 30, 'US lithium producer with North Carolina spodumene project', ARRAY['Spodumene concentrate', 'lithium hydroxide'], 1.0, 'emerging', 4),
(1351, 30, 'Brazilian lithium producer with high-purity spodumene operations', ARRAY['Battery-grade lithium concentrate'], 2.0, 'challenger', 5),
(6372, 30, 'US lithium developer using direct lithium extraction from Arkansas brine', ARRAY['Lithium carbonate'], 1.0, 'emerging', 6),
(8665, 30, 'Top-5 lithium producer after Arcadium Lithium acquisition', ARRAY['Lithium carbonate', 'lithium hydroxide'], 10.0, 'major', 7)
ON CONFLICT DO NOTHING;

-- GRAPHITE PRODUCERS (category 32)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, key_products, market_share_percent, competitive_position, display_order)
VALUES (8024, 32, 'North American graphite producer developing Quebec mine and battery anode materials', ARRAY['Natural graphite', 'coated spherical graphite'], 2.0, 'emerging', 1)
ON CONFLICT DO NOTHING;

-- GALLIUM & SPECIALTY METALS (category 33)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, key_products, market_share_percent, competitive_position, display_order)
VALUES (2882, 33, 'Major aluminum producer with gallium recovery capabilities from bauxite processing', ARRAY['Aluminum', 'gallium'], 5.0, 'major', 1)
ON CONFLICT DO NOTHING;

-- SILICON METAL PRODUCERS (category 34)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, key_products, market_share_percent, competitive_position, display_order)
VALUES (2500, 34, 'World''s largest merchant producer of silicon metal and silicon-based alloys', ARRAY['Silicon metal', 'ferrosilicon', 'manganese alloys'], 15.0, 'leader', 1)
ON CONFLICT DO NOTHING;

-- Update the tier description to reflect expanded scope
UPDATE supply_chain_tiers 
SET tier_description = 'Critical minerals, rare earths, silicon, lithium, and specialty materials that form the foundation of semiconductor and battery manufacturing'
WHERE tier_id = 1;

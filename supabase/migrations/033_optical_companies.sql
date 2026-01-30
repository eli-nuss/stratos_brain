-- Migration: Add optical networking and test companies to supply chain map
-- Date: 2026-01-30

-- Add CIEN (Ciena) to AI Networking
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
VALUES (2447, 13, 'Optical networking systems and coherent optics leader', 8, 'challenger', ARRAY['WaveLogic coherent optics', 'Packet-optical platforms', 'Blue Planet automation'], 9)
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Add AAOI (Applied Optoelectronics) to AI Networking  
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
VALUES (1693, 13, 'Optical transceivers for data center interconnects', 3, 'challenger', ARRAY['400G transceivers', 'CWDM/DWDM modules', 'Fiber optic components'], 10)
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Add KEYS (Keysight) to Semiconductor Equipment
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
VALUES (4585, 6, 'Test and measurement for semiconductors and optical', 5, 'challenger', ARRAY['Oscilloscopes', 'Network analyzers', 'Semiconductor test systems'], 15)
ON CONFLICT (asset_id, category_id) DO NOTHING;

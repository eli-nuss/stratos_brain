-- Migration: Add Physical AI / Robotics tier to supply chain map
-- This tier represents AI meeting the physical world - robotics, autonomous vehicles, drones

-- Add new tier (tier_number 6, alongside Application Layer which is 5)
INSERT INTO supply_chain_tiers (tier_id, tier_number, tier_name, tier_short_name, tier_description, display_order, color_code, is_bottleneck, icon_name)
VALUES (8, 6, 'Physical AI', 'Tier 6', 'Robotics, autonomous vehicles, drones, and AI-powered physical systems', 7, '#06B6D4', false, 'robot')
ON CONFLICT (tier_id) DO NOTHING;

-- Add categories for Physical AI tier
INSERT INTO supply_chain_categories (category_id, tier_id, category_name, category_description, display_order, market_size_2024, cagr_percent)
VALUES 
  (24, 8, 'Autonomous Vehicles', 'Self-driving cars, trucks, and autonomous vehicle technology', 1, 55.0, 35),
  (25, 8, 'Industrial Robotics', 'Factory automation, industrial robots, and manufacturing AI', 2, 45.0, 12),
  (26, 8, 'Surgical & Medical Robotics', 'Robotic surgery systems, medical automation, and healthcare AI', 3, 15.0, 18),
  (27, 8, 'Drones & eVTOL', 'Unmanned aerial vehicles, air taxis, and autonomous flight', 4, 12.0, 25),
  (28, 8, 'Defense Robotics', 'Military drones, autonomous defense systems, and defense AI', 5, 20.0, 15),
  (29, 8, 'Agricultural Robotics', 'Autonomous tractors, precision agriculture, and farm automation', 6, 8.0, 20)
ON CONFLICT (category_id) DO NOTHING;

-- =====================================================
-- AUTONOMOUS VEHICLES (Category 24)
-- =====================================================

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'Leader in autonomous driving and AI-powered vehicles', 60, 'leader', ARRAY['Autopilot', 'FSD', 'Optimus Robot']
FROM assets WHERE symbol = 'TSLA' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'Waymo autonomous driving technology', 15, 'leader', ARRAY['Waymo Driver', 'Waymo One', 'Waymo Via']
FROM assets WHERE symbol = 'GOOGL' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'Electric trucks with autonomous features', 5, 'challenger', ARRAY['R1T', 'R1S', 'EDV']
FROM assets WHERE symbol = 'RIVN' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'Luxury EVs with autonomous driving', 3, 'challenger', ARRAY['Lucid Air', 'DreamDrive']
FROM assets WHERE symbol = 'LCID' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'Computer vision for autonomous vehicles', 10, 'leader', ARRAY['EyeQ', 'SuperVision', 'Mobileye Drive']
FROM assets WHERE symbol = 'MBLY' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'Autonomous trucking technology', 5, 'challenger', ARRAY['Aurora Driver', 'Aurora Horizon']
FROM assets WHERE symbol = 'AUR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'LiDAR sensors for autonomous vehicles', 3, 'challenger', ARRAY['Ouster sensors', 'Digital LiDAR']
FROM assets WHERE symbol = 'OUST' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, 'LiDAR for autonomous driving', 2, 'niche', ARRAY['InnovizOne', 'InnovizTwo']
FROM assets WHERE symbol = 'INVZ' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 24, '4D LiDAR for autonomous vehicles', 2, 'niche', ARRAY['Aeries', '4D LiDAR']
FROM assets WHERE symbol = 'AEVA' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- =====================================================
-- INDUSTRIAL ROBOTICS (Category 25)
-- =====================================================

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Industrial automation and robotics leader', 20, 'leader', ARRAY['Rockwell Automation', 'Allen-Bradley', 'FactoryTalk']
FROM assets WHERE symbol = 'ROK' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Industrial automation and process control', 15, 'leader', ARRAY['DeltaV', 'Plantweb', 'AspenTech']
FROM assets WHERE symbol = 'EMR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Industrial automation and aerospace systems', 12, 'major', ARRAY['Honeywell Forge', 'Connected Plant']
FROM assets WHERE symbol = 'HON' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Robotic test equipment for semiconductors', 8, 'major', ARRAY['Universal Robots', 'Teradyne Robotics']
FROM assets WHERE symbol = 'TER' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Machine vision for industrial automation', 10, 'leader', ARRAY['In-Sight', 'DataMan', 'VisionPro']
FROM assets WHERE symbol = 'CGNX' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Precision motion control and photonics', 5, 'challenger', ARRAY['Motion Control', 'Photonics', 'Vision']
FROM assets WHERE symbol = 'NOVT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Robotic process automation software', 8, 'leader', ARRAY['UiPath Platform', 'AI Center', 'Document Understanding']
FROM assets WHERE symbol = 'PATH' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 25, 'Warehouse robotics and automation', 15, 'leader', ARRAY['Amazon Robotics', 'Kiva', 'Proteus']
FROM assets WHERE symbol = 'AMZN' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- =====================================================
-- SURGICAL & MEDICAL ROBOTICS (Category 26)
-- =====================================================

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 26, 'Robotic surgery pioneer and market leader', 70, 'leader', ARRAY['da Vinci', 'Ion', 'SP System']
FROM assets WHERE symbol = 'ISRG' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 26, 'Robotic surgery and orthopedic systems', 15, 'major', ARRAY['Mako', 'ROSA', 'Spine Robot']
FROM assets WHERE symbol = 'SYK' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 26, 'Surgical robotics and AI-assisted surgery', 8, 'major', ARRAY['Hugo RAS', 'Touch Surgery']
FROM assets WHERE symbol = 'MDT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 26, 'Medical devices with AI diagnostics', 5, 'challenger', ARRAY['FreeStyle Libre', 'AI Diagnostics']
FROM assets WHERE symbol = 'ABT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 26, 'AI-powered medical devices and imaging', 4, 'challenger', ARRAY['WATCHMAN', 'AI Imaging']
FROM assets WHERE symbol = 'BSX' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- =====================================================
-- DRONES & eVTOL (Category 27)
-- =====================================================

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 27, 'Electric air taxi and eVTOL leader', 20, 'leader', ARRAY['Joby S4', 'Air Taxi']
FROM assets WHERE symbol = 'JOBY' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 27, 'Electric air taxi development', 15, 'challenger', ARRAY['Midnight', 'eVTOL']
FROM assets WHERE symbol = 'ACHR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 27, 'Tactical drones and unmanned systems', 25, 'leader', ARRAY['Puma', 'Switchblade', 'JUMP 20']
FROM assets WHERE symbol = 'AVAV' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 27, 'Drone delivery and logistics', 10, 'major', ARRAY['Prime Air', 'MK30 Drone']
FROM assets WHERE symbol = 'AMZN' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 27, 'Wing drone delivery service', 8, 'major', ARRAY['Wing', 'Drone Delivery']
FROM assets WHERE symbol = 'GOOGL' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- =====================================================
-- DEFENSE ROBOTICS (Category 28)
-- =====================================================

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 28, 'Autonomous military systems and AI defense', 25, 'leader', ARRAY['Skunk Works', 'ATLAS', 'Autonomous Systems']
FROM assets WHERE symbol = 'LMT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 28, 'Defense AI and autonomous systems', 20, 'leader', ARRAY['Coyote', 'AI/ML Systems']
FROM assets WHERE symbol = 'RTX' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 28, 'Autonomous aircraft and defense AI', 18, 'major', ARRAY['X-47B', 'MQ-4C Triton', 'AI Systems']
FROM assets WHERE symbol = 'NOC' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 28, 'Autonomous ground vehicles and marine systems', 15, 'major', ARRAY['MUTT', 'ACTUV', 'AI Combat']
FROM assets WHERE symbol = 'GD' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 28, 'AI-enabled defense communications', 10, 'major', ARRAY['Trusted AI', 'Autonomous Sensors']
FROM assets WHERE symbol = 'LHX' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 28, 'Tactical drone systems for defense', 8, 'challenger', ARRAY['Switchblade', 'Puma', 'Blackwing']
FROM assets WHERE symbol = 'AVAV' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- =====================================================
-- AGRICULTURAL ROBOTICS (Category 29)
-- =====================================================

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 29, 'Autonomous tractors and precision agriculture leader', 50, 'leader', ARRAY['AutoTrac', 'See and Spray', 'Autonomy Kit']
FROM assets WHERE symbol = 'DE' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 29, 'Smart farming and autonomous equipment', 25, 'major', ARRAY['CNH Autonomous', 'Precision Planting']
FROM assets WHERE symbol = 'CNH' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 29, 'Precision agriculture and smart farming', 20, 'major', ARRAY['Fuse', 'Precision Ag', 'Smart Farming']
FROM assets WHERE symbol = 'AGCO' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- =====================================================
-- PRIVATE COMPANIES FOR PHYSICAL AI
-- =====================================================

INSERT INTO private_companies (company_id, category_id, name, description, estimated_valuation, key_products, competitive_position)
VALUES 
  (22, 24, 'Cruise', 'GM-backed autonomous vehicle company', 5000000000, ARRAY['Cruise Origin', 'Robotaxi'], 'major'),
  (23, 24, 'Nuro', 'Autonomous delivery vehicles', 8600000000, ARRAY['R2', 'Delivery Robot'], 'challenger'),
  (24, 25, 'Figure AI', 'Humanoid robots for labor', 2600000000, ARRAY['Figure 01', 'Humanoid Robot'], 'niche'),
  (25, 25, 'Boston Dynamics', 'Advanced robotics (Hyundai)', 1000000000, ARRAY['Spot', 'Atlas', 'Stretch'], 'leader'),
  (26, 27, 'Zipline', 'Drone delivery for healthcare', 4200000000, ARRAY['Zip', 'Medical Delivery'], 'leader'),
  (27, 27, 'Skydio', 'Autonomous drones', 2200000000, ARRAY['Skydio X10', 'AI Drone'], 'challenger'),
  (28, 28, 'Anduril', 'Defense AI and autonomous systems', 14000000000, ARRAY['Lattice', 'Ghost', 'Altius'], 'leader'),
  (29, 28, 'Shield AI', 'AI pilot for defense', 2800000000, ARRAY['Hivemind', 'V-BAT'], 'challenger')
ON CONFLICT (company_id) DO NOTHING;

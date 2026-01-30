-- Migration: Add additional companies to supply chain map
-- Based on careful audit of database for AI infrastructure relevance

-- First, reactivate some key inactive companies that belong in the supply chain
UPDATE assets SET is_active = true WHERE symbol IN ('NFLX', 'CCI', 'SBAC', 'JNPR');

-- RAW MATERIALS (Tier -1, Category 2: Rare Earths)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 2, 'Major copper and aluminum producer', 8, 'major', ARRAY['Copper', 'Aluminum']
FROM assets WHERE symbol = 'RIO' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 2, 'Leading copper producer', 6, 'major', ARRAY['Copper Cathodes']
FROM assets WHERE symbol = 'SCCO' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- SEMICONDUCTOR EQUIPMENT (Tier 0, Category 6)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'Process control equipment', 3, 'challenger', ARRAY['Inspection', 'Metrology']
FROM assets WHERE symbol = 'ONTO' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'Ion implantation equipment', 15, 'major', ARRAY['Purion Platform']
FROM assets WHERE symbol = 'ACLS' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'Inspection systems for packaging', 5, 'challenger', ARRAY['2D/3D Metrology']
FROM assets WHERE symbol = 'CAMT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'Semiconductor parts and services', 3, 'challenger', ARRAY['Gas Delivery', 'Chambers']
FROM assets WHERE symbol = 'UCTT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'Probe cards and test equipment', 25, 'leader', ARRAY['Probe Cards']
FROM assets WHERE symbol = 'FORM' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'Process control instruments', 8, 'major', ARRAY['Vacuum Systems', 'Lasers']
FROM assets WHERE symbol = 'MKSI' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'Lasers and optics for semis', 10, 'major', ARRAY['Excimer Lasers', 'Optics']
FROM assets WHERE symbol = 'COHR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 6, 'High-power fiber lasers', 5, 'challenger', ARRAY['Fiber Lasers']
FROM assets WHERE symbol = 'IPGP' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- CHIP INTEGRATION (Tier 1)
-- Category 7: Logic
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 7, 'Low-power FPGAs for edge AI', 3, 'challenger', ARRAY['Nexus FPGAs', 'sensAI']
FROM assets WHERE symbol = 'LSCC' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Category 11: Analog
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 11, 'Power management ICs', 8, 'leader', ARRAY['Power Modules', 'PMICs']
FROM assets WHERE symbol = 'MPWR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 11, 'Microcontrollers and analog', 12, 'major', ARRAY['PIC MCUs', 'Analog ICs']
FROM assets WHERE symbol = 'MCHP' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 11, 'RF semiconductors', 8, 'major', ARRAY['RF Front-Ends', 'Filters']
FROM assets WHERE symbol = 'SWKS' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 11, 'RF solutions for 5G', 7, 'major', ARRAY['5G Infrastructure']
FROM assets WHERE symbol = 'QRVO' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 11, 'IoT chips for edge AI', 3, 'challenger', ARRAY['Wireless MCUs']
FROM assets WHERE symbol = 'SLAB' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 11, 'Discrete semiconductors', 2, 'challenger', ARRAY['MOSFETs', 'Diodes']
FROM assets WHERE symbol = 'DIOD' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 11, 'Magnetic sensor ICs', 4, 'challenger', ARRAY['Hall Effect Sensors']
FROM assets WHERE symbol = 'ALGM' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- SYSTEM INTEGRATION (Tier 2)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 12, 'PCs and workstations', 15, 'major', ARRAY['Z Workstations']
FROM assets WHERE symbol = 'HPQ' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 13, 'Enterprise networking', 8, 'major', ARRAY['MX Series', 'QFX']
FROM assets WHERE symbol = 'JNPR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 13, 'Application delivery', 5, 'challenger', ARRAY['BIG-IP', 'NGINX']
FROM assets WHERE symbol = 'FFIV' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 13, 'Optical transceivers', 15, 'leader', ARRAY['Transceivers', 'ROADMs']
FROM assets WHERE symbol = 'LITE' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 14, 'Hyperconverged infrastructure', 5, 'challenger', ARRAY['Nutanix Cloud']
FROM assets WHERE symbol = 'NTNX' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- DATA CENTER PHYSICAL (Tier 3)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 15, 'Tower infrastructure for edge', 10, 'leader', ARRAY['Tower Sites', 'Small Cells']
FROM assets WHERE symbol = 'CCI' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 15, 'Wireless tower infrastructure', 8, 'major', ARRAY['Tower Sites']
FROM assets WHERE symbol = 'SBAC' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 16, 'Building automation and HVAC', 12, 'leader', ARRAY['OpenBlue', 'York']
FROM assets WHERE symbol = 'JCI' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 16, 'HVAC for data centers', 15, 'leader', ARRAY['Trane Chillers']
FROM assets WHERE symbol = 'TT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 16, 'HVAC and refrigeration', 10, 'major', ARRAY['AquaEdge Chillers']
FROM assets WHERE symbol = 'CARR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 16, 'Commercial HVAC', 5, 'challenger', ARRAY['Rooftop Units']
FROM assets WHERE symbol = 'LII' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Power infrastructure construction', 15, 'leader', ARRAY['Power Grid', 'Substations']
FROM assets WHERE symbol = 'PWR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Power generation', 8, 'major', ARRAY['Natural Gas', 'Nuclear']
FROM assets WHERE symbol = 'VST' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Nuclear power for data centers', 20, 'leader', ARRAY['Nuclear Plants']
FROM assets WHERE symbol = 'CEG' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Power generation and retail', 5, 'challenger', ARRAY['Natural Gas', 'Solar']
FROM assets WHERE symbol = 'NRG' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Renewable power', 3, 'challenger', ARRAY['Wind', 'Solar']
FROM assets WHERE symbol = 'AES' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Hydrogen fuel cells', 2, 'niche', ARRAY['GenDrive', 'Electrolyzers']
FROM assets WHERE symbol = 'PLUG' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Utility-scale solar', 10, 'leader', ARRAY['Series 6', 'Series 7']
FROM assets WHERE symbol = 'FSLR' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 17, 'Solar microinverters', 5, 'challenger', ARRAY['IQ8 Microinverters']
FROM assets WHERE symbol = 'ENPH' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- CLOUD & ORCHESTRATION (Tier 4)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 19, 'Quantum computing cloud', 5, 'niche', ARRAY['IonQ Aria', 'Quantum Cloud']
FROM assets WHERE symbol = 'IONQ' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 19, 'Superconducting quantum', 3, 'niche', ARRAY['Ankaa', 'Novera']
FROM assets WHERE symbol = 'RGTI' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'Cloud-native database', 8, 'leader', ARRAY['MongoDB Atlas', 'Vector Search']
FROM assets WHERE symbol = 'MDB' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'Search and observability', 5, 'challenger', ARRAY['Elasticsearch', 'Kibana']
FROM assets WHERE symbol = 'ESTC' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'Data streaming platform', 6, 'major', ARRAY['Confluent Cloud', 'Kafka']
FROM assets WHERE symbol = 'CFLT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'CRM with AI capabilities', 4, 'challenger', ARRAY['Marketing Hub', 'Breeze AI']
FROM assets WHERE symbol = 'HUBS' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'Zero trust cloud security', 12, 'leader', ARRAY['ZIA', 'ZPA']
FROM assets WHERE symbol = 'ZS' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'Identity management', 10, 'leader', ARRAY['Workforce Identity', 'Auth0']
FROM assets WHERE symbol = 'OKTA' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'AI-native cybersecurity', 15, 'leader', ARRAY['Falcon', 'Charlotte AI']
FROM assets WHERE symbol = 'CRWD' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'Comprehensive cybersecurity', 18, 'leader', ARRAY['Cortex', 'Prisma']
FROM assets WHERE symbol = 'PANW' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 20, 'Network security with AI', 10, 'major', ARRAY['FortiGate', 'FortiAI']
FROM assets WHERE symbol = 'FTNT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- APPLICATION LAYER (Tier 5)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI-powered streaming', 25, 'leader', ARRAY['Netflix', 'Recommendations']
FROM assets WHERE symbol = 'NFLX' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI-powered music', 30, 'leader', ARRAY['Spotify', 'DJ AI']
FROM assets WHERE symbol = 'SPOT' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI-powered ride-sharing', 70, 'leader', ARRAY['Uber', 'Uber Eats']
FROM assets WHERE symbol = 'UBER' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI-powered travel', 20, 'leader', ARRAY['Airbnb', 'Smart Pricing']
FROM assets WHERE symbol = 'ABNB' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI-powered food delivery', 60, 'leader', ARRAY['DoorDash', 'DashPass']
FROM assets WHERE symbol = 'DASH' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI-powered gaming platform', 15, 'major', ARRAY['Roblox', 'Avatar AI']
FROM assets WHERE symbol = 'RBLX' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI game engine', 30, 'leader', ARRAY['Unity Engine', 'Muse AI']
FROM assets WHERE symbol = 'U' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI in gaming', 15, 'major', ARRAY['EA Sports FC', 'Madden']
FROM assets WHERE symbol = 'EA' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 22, 'AI in gaming', 12, 'major', ARRAY['GTA', 'NBA 2K']
FROM assets WHERE symbol = 'TTWO' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'AI-powered financial software', 20, 'leader', ARRAY['TurboTax', 'Intuit Assist']
FROM assets WHERE symbol = 'INTU' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'Life sciences cloud with AI', 50, 'leader', ARRAY['Veeva CRM', 'Vault']
FROM assets WHERE symbol = 'VEEV' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'AI-powered collaboration', 25, 'leader', ARRAY['Jira', 'Confluence']
FROM assets WHERE symbol = 'TEAM' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'AI-powered advertising', 20, 'leader', ARRAY['The Trade Desk', 'Kokai']
FROM assets WHERE symbol = 'TTD' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'AI-powered e-signature', 60, 'leader', ARRAY['DocuSign', 'CLM']
FROM assets WHERE symbol = 'DOCU' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'AI-powered video', 30, 'leader', ARRAY['Zoom', 'AI Companion']
FROM assets WHERE symbol = 'ZM' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'AI communications platform', 15, 'major', ARRAY['Twilio', 'CustomerAI']
FROM assets WHERE symbol = 'TWLO' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products)
SELECT asset_id, 23, 'AI-powered e-commerce', 30, 'leader', ARRAY['Shopify', 'Sidekick AI']
FROM assets WHERE symbol = 'SHOP' AND is_active = true
ON CONFLICT (asset_id, category_id) DO NOTHING;

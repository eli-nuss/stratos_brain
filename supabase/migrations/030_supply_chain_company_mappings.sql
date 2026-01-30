-- Migration: 030_supply_chain_company_mappings.sql
-- Description: Seed company mappings for the AI Infrastructure Supply Chain Map
-- Date: 2026-01-30

-- ============================================================================
-- Helper: Get category IDs
-- ============================================================================

-- Base Layer
-- Silicon Wafers, Rare Earths & Critical Minerals, Process Gases & Chemicals

-- Tier 0
-- Foundries, EUV Lithography, Semiconductor Equipment

-- Tier 1
-- Logic - GPUs & Accelerators, HBM Memory, Advanced Packaging (CoWoS), Substrates & Interposers, Analog & Mixed Signal

-- Tier 2
-- Server OEMs, AI Networking, Storage Systems

-- Tier 3
-- Colocation & Data Centers, Thermal Management, Power Infrastructure

-- Tier 4
-- Hyperscale Cloud, GPU Cloud & AI Infrastructure, Cloud Software & Orchestration

-- Tier 5
-- Foundation Models, Consumer AI, Enterprise AI

-- ============================================================================
-- BASE LAYER: Raw Materials
-- ============================================================================

-- Silicon Wafers
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, 
    'Global leader in silicon wafer manufacturing with 30%+ market share',
    30.0, 'leader', ARRAY['300mm wafers', 'SOI wafers'], 1
FROM assets a, supply_chain_categories c
WHERE a.symbol = '4063.T' AND c.category_name = 'Silicon Wafers'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Rare Earths
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, 
    'Only integrated rare earth mining and processing facility in Western Hemisphere',
    5.0, 'challenger', ARRAY['NdPr oxide', 'Rare earth magnets'], 1
FROM assets a, supply_chain_categories c
WHERE a.symbol = 'MP' AND c.category_name = 'Rare Earths & Critical Minerals'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Process Gases & Chemicals
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('ENTG', 'Critical contamination control and specialty materials for semiconductor fabs', 15.0, 'leader', ARRAY['CMP slurries', 'Filters', 'Specialty chemicals'], 1),
    ('LIN', 'Global industrial gases leader with major semiconductor presence', 20.0, 'leader', ARRAY['Ultra-high-purity gases', 'On-site generation'], 2),
    ('APD', 'Industrial gases and specialty chemicals for semiconductor manufacturing', 15.0, 'leader', ARRAY['Electronic gases', 'Hydrogen'], 3)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Process Gases & Chemicals'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- ============================================================================
-- TIER 0: Wafer-Level Foundation
-- ============================================================================

-- Foundries
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('TSM', 'Dominant foundry with 60%+ advanced logic market share', 60.0, 'leader', ARRAY['N3', 'N5', 'CoWoS packaging'], 1),
    ('2330.TW', 'Taiwan-listed TSMC shares', 60.0, 'leader', ARRAY['N3', 'N5', 'CoWoS packaging'], 2),
    ('INTC', 'Integrated device manufacturer pivoting to foundry services', 10.0, 'challenger', ARRAY['Intel 18A', 'Intel 3'], 3),
    ('GFS', 'Specialty foundry for automotive, IoT, and RF applications', 5.0, 'niche', ARRAY['22FDX', '12LP+'], 4),
    ('UMC', 'Mature node foundry for specialty applications', 7.0, 'niche', ARRAY['28nm', '22nm'], 5),
    ('0981.HK', 'Leading Chinese foundry (SMIC)', 5.0, 'challenger', ARRAY['14nm', '28nm'], 6)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym
JOIN supply_chain_categories c ON c.category_name = 'Foundries'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- EUV Lithography
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('ASML', 'Monopoly provider of EUV lithography systems', 100.0, 'leader', ARRAY['EUV', 'High-NA EUV', 'DUV'], 1),
    ('ASML.AS', 'Amsterdam-listed ASML shares', 100.0, 'leader', ARRAY['EUV', 'High-NA EUV', 'DUV'], 2)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym
JOIN supply_chain_categories c ON c.category_name = 'EUV Lithography'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Semiconductor Equipment
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('AMAT', 'Largest semiconductor equipment company by revenue', 20.0, 'leader', ARRAY['CVD', 'PVD', 'Etch', 'CMP'], 1),
    ('LRCX', 'Leader in etch and deposition equipment', 15.0, 'leader', ARRAY['Etch systems', 'Deposition'], 2),
    ('KLAC', 'Leader in process control and metrology', 12.0, 'leader', ARRAY['Inspection', 'Metrology', 'Data analytics'], 3),
    ('8035.T', 'Tokyo Electron - Major equipment supplier', 15.0, 'leader', ARRAY['Coater/Developer', 'Etch', 'Deposition'], 4),
    ('6857.T', 'Advantest - Leading test equipment provider', 50.0, 'leader', ARRAY['ATE systems', 'Memory test'], 5)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym
JOIN supply_chain_categories c ON c.category_name = 'Semiconductor Equipment'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- ============================================================================
-- TIER 1: Chip Integration (Bottleneck Tier)
-- ============================================================================

-- Logic - GPUs & Accelerators
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('NVDA', 'Dominant AI accelerator company with 80%+ data center GPU share', 80.0, 'leader', ARRAY['H100', 'H200', 'B100', 'GB200'], 1),
    ('AMD', 'Primary GPU competitor with growing AI presence', 10.0, 'challenger', ARRAY['MI300X', 'MI300A', 'EPYC'], 2),
    ('INTC', 'CPU leader expanding into AI accelerators', 5.0, 'challenger', ARRAY['Gaudi 3', 'Xeon'], 3),
    ('AVGO', 'Custom AI accelerator leader (Google TPU, Meta MTIA)', 15.0, 'leader', ARRAY['Custom ASICs', 'Networking'], 4),
    ('QCOM', 'Mobile AI and edge inference leader', 5.0, 'niche', ARRAY['Snapdragon', 'Cloud AI 100'], 5),
    ('MRVL', 'Custom silicon and AI networking specialist', 10.0, 'challenger', ARRAY['Custom compute', 'DPUs'], 6),
    ('ARM', 'CPU architecture licensor enabling AI chips', 95.0, 'leader', ARRAY['Cortex', 'Neoverse', 'GPU'], 7)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Logic - GPUs & Accelerators'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- HBM Memory
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('000660.KS', 'SK Hynix - HBM market leader with 50%+ share', 50.0, 'leader', ARRAY['HBM3', 'HBM3E'], 1),
    ('005930.KS', 'Samsung - Second largest HBM producer', 30.0, 'challenger', ARRAY['HBM3', 'HBM3E'], 2),
    ('MU', 'Micron - Third HBM producer, US-based', 15.0, 'challenger', ARRAY['HBM3E'], 3)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym
JOIN supply_chain_categories c ON c.category_name = 'HBM Memory'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Advanced Packaging (CoWoS)
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('TSM', 'CoWoS packaging leader - primary bottleneck in AI chip supply', 70.0, 'leader', ARRAY['CoWoS-S', 'CoWoS-L', 'SoIC'], 1),
    ('ASX', 'ASE Technology - Major OSAT provider', 15.0, 'challenger', ARRAY['Fan-out', 'Flip chip', '2.5D'], 2),
    ('AMKR', 'Amkor - US-headquartered OSAT with CHIPS Act funding', 10.0, 'challenger', ARRAY['S-Connect', 'SWIFT'], 3)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Advanced Packaging (CoWoS)'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Analog & Mixed Signal
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('TXN', 'Texas Instruments - Analog semiconductor leader', 18.0, 'leader', ARRAY['Power management', 'Signal chain'], 1),
    ('ADI', 'Analog Devices - High-performance analog leader', 12.0, 'leader', ARRAY['Data converters', 'RF', 'Power'], 2),
    ('NXPI', 'NXP - Automotive and IoT semiconductors', 8.0, 'leader', ARRAY['Automotive', 'IoT', 'Mobile'], 3),
    ('ON', 'ON Semiconductor - Power and sensing solutions', 6.0, 'challenger', ARRAY['Power', 'Image sensors'], 4),
    ('MCHP', 'Microchip - Embedded control solutions', 5.0, 'challenger', ARRAY['MCUs', 'Analog', 'FPGAs'], 5),
    ('MPWR', 'Monolithic Power Systems - Power management ICs', 3.0, 'niche', ARRAY['Power modules', 'DC-DC'], 6),
    ('IFX.DE', 'Infineon - European power semiconductor leader', 10.0, 'leader', ARRAY['Power', 'Automotive', 'Security'], 7)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym
JOIN supply_chain_categories c ON c.category_name = 'Analog & Mixed Signal'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- ============================================================================
-- TIER 2: System Integration
-- ============================================================================

-- Server OEMs
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('SMCI', 'Super Micro - Fastest-growing AI server OEM, NVIDIA partner', 15.0, 'leader', ARRAY['GPU servers', 'Liquid cooling'], 1),
    ('DELL', 'Dell Technologies - Enterprise server leader', 20.0, 'leader', ARRAY['PowerEdge', 'XE9680'], 2),
    ('HPE', 'HPE - Enterprise and HPC server provider', 15.0, 'leader', ARRAY['ProLiant', 'Cray'], 3),
    ('IBM', 'IBM - Enterprise systems and mainframes', 5.0, 'niche', ARRAY['Power', 'Z Series'], 4)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Server OEMs'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- AI Networking
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('NVDA', 'NVIDIA Networking (Mellanox) - InfiniBand leader', 70.0, 'leader', ARRAY['InfiniBand', 'NVLink', 'Spectrum-X'], 1),
    ('ANET', 'Arista Networks - High-speed Ethernet leader', 15.0, 'leader', ARRAY['7800R3', '7060X5'], 2),
    ('CSCO', 'Cisco - Enterprise networking leader', 10.0, 'challenger', ARRAY['Nexus', 'Silicon One'], 3),
    ('MRVL', 'Marvell - Optical DSPs and custom silicon', 20.0, 'leader', ARRAY['PAM4 DSPs', 'Custom ASICs'], 4),
    ('AVGO', 'Broadcom - Merchant switching silicon', 40.0, 'leader', ARRAY['Memory test'], 5)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'AI Networking'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Storage Systems
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('PSTG', 'Pure Storage - All-flash storage leader for AI workloads', 10.0, 'leader', ARRAY['FlashBlade', 'FlashArray'], 1),
    ('NTAP', 'NetApp - Enterprise storage with cloud integration', 15.0, 'leader', ARRAY['AFF', 'StorageGRID'], 2),
    ('DELL', 'Dell EMC - Enterprise storage portfolio', 20.0, 'leader', ARRAY['PowerScale', 'PowerStore'], 3),
    ('WDC', 'Western Digital - HDD and flash storage', 15.0, 'challenger', ARRAY['Ultrastar', 'NVMe SSDs'], 4),
    ('STX', 'Seagate - High-capacity HDD leader', 15.0, 'challenger', ARRAY['Exos', 'Mach.2'], 5)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Storage Systems'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- ============================================================================
-- TIER 3: Data Center Physical
-- ============================================================================

-- Colocation & Data Centers
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('EQIX', 'Equinix - Global interconnection and data center leader', 15.0, 'leader', ARRAY['IBX', 'xScale'], 1),
    ('DLR', 'Digital Realty - Hyperscale data center provider', 12.0, 'leader', ARRAY['PlatformDIGITAL', 'ServiceFabric'], 2),
    ('AMT', 'American Tower - Communications infrastructure REIT', 5.0, 'challenger', ARRAY['Data centers', 'Edge'], 3)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Colocation & Data Centers'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Thermal Management
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('VRT', 'Vertiv - Data center thermal and power leader', 25.0, 'leader', ARRAY['Liebert', 'Liquid cooling', 'CDUs'], 1)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Thermal Management'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Power Infrastructure
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('ETN', 'Eaton - Power management solutions leader', 20.0, 'leader', ARRAY['UPS', 'PDUs', 'Switchgear'], 1),
    ('VRT', 'Vertiv - UPS and power distribution', 15.0, 'leader', ARRAY['UPS', 'Power distribution'], 2),
    ('GNRC', 'Generac - Backup power and energy solutions', 10.0, 'challenger', ARRAY['Generators', 'Energy storage'], 3),
    ('EMR', 'Emerson Electric - Industrial automation and power', 15.0, 'leader', ARRAY['Power supplies', 'Cooling'], 4),
    ('GE', 'GE Vernova - Power generation and grid solutions', 20.0, 'leader', ARRAY['Gas turbines', 'Grid solutions'], 5)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Power Infrastructure'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- ============================================================================
-- TIER 4: Cloud & Orchestration
-- ============================================================================

-- Hyperscale Cloud
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('AMZN', 'Amazon Web Services - Cloud market leader', 32.0, 'leader', ARRAY['EC2', 'SageMaker', 'Bedrock', 'Trainium'], 1),
    ('MSFT', 'Microsoft Azure - Enterprise cloud leader', 23.0, 'leader', ARRAY['Azure AI', 'OpenAI partnership', 'Copilot'], 2),
    ('GOOGL', 'Google Cloud Platform - AI-native cloud', 11.0, 'challenger', ARRAY['TPUs', 'Vertex AI', 'Gemini'], 3),
    ('ORCL', 'Oracle Cloud - Enterprise and AI infrastructure', 5.0, 'challenger', ARRAY['OCI', 'GPU clusters', 'Autonomous DB'], 4),
    ('META', 'Meta - AI infrastructure for internal and research use', 0.0, 'niche', ARRAY['LLaMA', 'PyTorch', 'MTIA'], 5)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Hyperscale Cloud'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Cloud Software & Orchestration
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('SNOW', 'Snowflake - Cloud data platform for AI/ML', 10.0, 'leader', ARRAY['Data Cloud', 'Cortex AI'], 1),
    ('DDOG', 'Datadog - Cloud monitoring and observability', 15.0, 'leader', ARRAY['APM', 'Infrastructure', 'LLM Observability'], 2),
    ('NET', 'Cloudflare - Edge computing and security', 10.0, 'leader', ARRAY['Workers AI', 'Edge', 'Security'], 3),
    ('PLTR', 'Palantir - AI platforms for enterprise and government', 5.0, 'niche', ARRAY['Foundry', 'Gotham', 'AIP'], 4)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Cloud Software & Orchestration'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- ============================================================================
-- TIER 5: Application Layer
-- ============================================================================

-- Enterprise AI
INSERT INTO asset_supply_chain_mapping (asset_id, category_id, role_description, market_share_percent, competitive_position, key_products, display_order)
SELECT a.asset_id, c.category_id, role_desc, market_share, position, products, ord
FROM (VALUES
    ('MSFT', 'Microsoft - Enterprise AI leader with Copilot ecosystem', 30.0, 'leader', ARRAY['M365 Copilot', 'GitHub Copilot', 'Dynamics'], 1),
    ('CRM', 'Salesforce - CRM with AI (Einstein, Agentforce)', 15.0, 'leader', ARRAY['Einstein GPT', 'Agentforce', 'Data Cloud'], 2),
    ('SAP', 'SAP - Enterprise software with Joule AI', 10.0, 'challenger', ARRAY['Joule', 'S/4HANA', 'Business AI'], 3),
    ('NOW', 'ServiceNow - Enterprise workflow AI', 8.0, 'challenger', ARRAY['Now Assist', 'Workflow automation'], 4),
    ('WDAY', 'Workday - HR and finance with AI', 5.0, 'challenger', ARRAY['Workday AI', 'Skills Cloud'], 5),
    ('ADBE', 'Adobe - Creative and marketing AI', 10.0, 'leader', ARRAY['Firefly', 'Sensei', 'GenStudio'], 6),
    ('ACN', 'Accenture - AI consulting and implementation', 15.0, 'leader', ARRAY['AI consulting', 'Implementation'], 7)
) AS v(sym, role_desc, market_share, position, products, ord)
JOIN assets a ON a.symbol = v.sym AND a.asset_type = 'equity'
JOIN supply_chain_categories c ON c.category_name = 'Enterprise AI'
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- ============================================================================
-- PRIVATE COMPANIES
-- ============================================================================

-- Foundation Models (Private)
INSERT INTO private_companies (name, category_id, headquarters_country, headquarters_city, estimated_valuation, estimated_revenue, funding_stage, total_funding, key_investors, founded_year, employee_count_range, description, role_description, key_products, competitive_position, display_order)
SELECT 
    v.name, c.category_id, v.country, v.city, v.valuation, v.revenue, v.stage, v.funding, v.investors, v.founded, v.employees, v.description, v.role_desc, v.products, v.position, v.ord
FROM (VALUES
    ('OpenAI', 'US', 'San Francisco', 300000000000, 13000000000, 'Late Stage', 17000000000, ARRAY['Microsoft', 'Thrive Capital', 'Khosla Ventures'], 2015, '1000-5000', 'Leading AI research company and creator of GPT models', 'Consumer and enterprise AI leader with ChatGPT', ARRAY['ChatGPT', 'GPT-4', 'DALL-E', 'Sora'], 'leader', 1),
    ('Anthropic', 'US', 'San Francisco', 60000000000, 1500000000, 'Series E', 8000000000, ARRAY['Google', 'Amazon', 'Spark Capital'], 2021, '500-1000', 'AI safety-focused research company', 'Constitutional AI and Claude models', ARRAY['Claude 3', 'Claude API'], 'challenger', 2),
    ('Mistral AI', 'France', 'Paris', 6000000000, 200000000, 'Series B', 1000000000, ARRAY['a16z', 'Lightspeed', 'General Catalyst'], 2023, '50-100', 'European AI champion focused on open models', 'Open-weight foundation models', ARRAY['Mistral Large', 'Mixtral'], 'challenger', 3),
    ('xAI', 'US', 'San Francisco', 50000000000, 100000000, 'Series B', 6000000000, ARRAY['a16z', 'Sequoia', 'Valor Equity'], 2023, '100-500', 'Elon Musk AI venture focused on understanding the universe', 'Grok AI assistant', ARRAY['Grok'], 'challenger', 4),
    ('Cohere', 'Canada', 'Toronto', 5500000000, 100000000, 'Series D', 900000000, ARRAY['NVIDIA', 'Oracle', 'Salesforce Ventures'], 2019, '200-500', 'Enterprise-focused LLM provider', 'Enterprise NLP and RAG solutions', ARRAY['Command', 'Embed', 'Rerank'], 'niche', 5)
) AS v(name, country, city, valuation, revenue, stage, funding, investors, founded, employees, description, role_desc, products, position, ord)
CROSS JOIN supply_chain_categories c
WHERE c.category_name = 'Foundation Models';

-- GPU Cloud & AI Infrastructure (Private)
INSERT INTO private_companies (name, category_id, headquarters_country, headquarters_city, estimated_valuation, estimated_revenue, funding_stage, total_funding, key_investors, founded_year, employee_count_range, description, role_description, key_products, competitive_position, display_order)
SELECT 
    v.name, c.category_id, v.country, v.city, v.valuation, v.revenue, v.stage, v.funding, v.investors, v.founded, v.employees, v.description, v.role_desc, v.products, v.position, v.ord
FROM (VALUES
    ('CoreWeave', 'US', 'Roseland', 35000000000, 2000000000, 'Series C', 12000000000, ARRAY['NVIDIA', 'Magnetar', 'Coatue'], 2017, '500-1000', 'GPU cloud provider specializing in AI workloads', 'Specialized GPU cloud with massive NVIDIA capacity', ARRAY['GPU instances', 'Kubernetes', 'Inference'], 'leader', 1),
    ('Lambda Labs', 'US', 'San Francisco', 1500000000, 200000000, 'Series C', 500000000, ARRAY['Gradient Ventures', 'Bloomberg Beta'], 2012, '100-500', 'GPU cloud and deep learning workstations', 'GPU cloud for AI researchers', ARRAY['Lambda Cloud', 'Workstations'], 'challenger', 2),
    ('Together AI', 'US', 'San Francisco', 3000000000, 100000000, 'Series A', 225000000, ARRAY['Kleiner Perkins', 'NVIDIA', 'a16z'], 2022, '50-100', 'Open-source AI cloud platform', 'Open model inference and fine-tuning', ARRAY['Together Inference', 'Fine-tuning'], 'challenger', 3),
    ('Crusoe Energy', 'US', 'Denver', 3000000000, 500000000, 'Series C', 750000000, ARRAY['G2 Venture Partners', 'Valor Equity'], 2018, '200-500', 'Clean energy AI data centers', 'Sustainable GPU cloud powered by stranded energy', ARRAY['Cloud GPU', 'Sustainable compute'], 'niche', 4)
) AS v(name, country, city, valuation, revenue, stage, funding, investors, founded, employees, description, role_desc, products, position, ord)
CROSS JOIN supply_chain_categories c
WHERE c.category_name = 'GPU Cloud & AI Infrastructure';

-- Logic - GPUs & Accelerators (Private AI chip companies)
INSERT INTO private_companies (name, category_id, headquarters_country, headquarters_city, estimated_valuation, estimated_revenue, funding_stage, total_funding, key_investors, founded_year, employee_count_range, description, role_description, key_products, competitive_position, display_order)
SELECT 
    v.name, c.category_id, v.country, v.city, v.valuation, v.revenue, v.stage, v.funding, v.investors, v.founded, v.employees, v.description, v.role_desc, v.products, v.position, v.ord
FROM (VALUES
    ('Cerebras Systems', 'US', 'Sunnyvale', 4000000000, 100000000, 'Series F', 720000000, ARRAY['Eclipse Ventures', 'Altimeter', 'Coatue'], 2016, '200-500', 'Wafer-scale AI chip company', 'Largest AI chips for training', ARRAY['WSE-3', 'CS-3'], 'niche', 10),
    ('Groq', 'US', 'Mountain View', 2800000000, 50000000, 'Series D', 640000000, ARRAY['Tiger Global', 'D1 Capital', 'BlackRock'], 2016, '200-500', 'LPU inference chip company', 'Ultra-fast inference with LPU architecture', ARRAY['LPU', 'GroqCloud'], 'niche', 11),
    ('SambaNova Systems', 'US', 'Palo Alto', 5000000000, 100000000, 'Series D', 1100000000, ARRAY['SoftBank', 'BlackRock', 'Intel Capital'], 2017, '200-500', 'AI systems company with dataflow architecture', 'Enterprise AI systems', ARRAY['SN40L', 'DataScale'], 'niche', 12),
    ('Tenstorrent', 'Canada', 'Toronto', 1000000000, 20000000, 'Series C', 335000000, ARRAY['Fidelity', 'Samsung', 'Hyundai'], 2016, '200-500', 'AI chip company founded by Jim Keller', 'Open and efficient AI silicon', ARRAY['Wormhole', 'Grayskull'], 'niche', 13)
) AS v(name, country, city, valuation, revenue, stage, funding, investors, founded, employees, description, role_desc, products, position, ord)
CROSS JOIN supply_chain_categories c
WHERE c.category_name = 'Logic - GPUs & Accelerators';

-- Thermal Management (Private)
INSERT INTO private_companies (name, category_id, headquarters_country, headquarters_city, estimated_valuation, estimated_revenue, funding_stage, total_funding, key_investors, founded_year, employee_count_range, description, role_description, key_products, competitive_position, display_order)
SELECT 
    v.name, c.category_id, v.country, v.city, v.valuation, v.revenue, v.stage, v.funding, v.investors, v.founded, v.employees, v.description, v.role_desc, v.products, v.position, v.ord
FROM (VALUES
    ('CoolIT Systems', 'Canada', 'Calgary', 500000000, 100000000, 'Private', 50000000, ARRAY['ARC Financial'], 2001, '100-500', 'Direct liquid cooling solutions', 'Modular liquid cooling for AI servers', ARRAY['Rack DLC', 'Cold plates'], 'challenger', 2),
    ('GRC (Green Revolution Cooling)', 'US', 'Austin', 200000000, 50000000, 'Series C', 60000000, ARRAY['Chevron', 'ConocoPhillips'], 2009, '50-100', 'Immersion cooling pioneer', 'Single-phase immersion cooling', ARRAY['ICEraQ', 'ICEtank'], 'niche', 3),
    ('Iceotope', 'UK', 'Sheffield', 150000000, 30000000, 'Series C', 50000000, ARRAY['Pavilion Capital', 'Aster Capital'], 2012, '50-100', 'Precision liquid cooling', 'Chassis-level immersion cooling', ARRAY['KUL', 'Precision cooling'], 'niche', 4)
) AS v(name, country, city, valuation, revenue, stage, funding, investors, founded, employees, description, role_desc, products, position, ord)
CROSS JOIN supply_chain_categories c
WHERE c.category_name = 'Thermal Management';

-- Storage Systems (Private)
INSERT INTO private_companies (name, category_id, headquarters_country, headquarters_city, estimated_valuation, estimated_revenue, funding_stage, total_funding, key_investors, founded_year, employee_count_range, description, role_description, key_products, competitive_position, display_order)
SELECT 
    v.name, c.category_id, v.country, v.city, v.valuation, v.revenue, v.stage, v.funding, v.investors, v.founded, v.employees, v.description, v.role_desc, v.products, v.position, v.ord
FROM (VALUES
    ('VAST Data', 'US', 'New York', 9000000000, 500000000, 'Series E', 400000000, ARRAY['Tiger Global', 'Fidelity', 'NVIDIA'], 2016, '500-1000', 'Universal storage for AI workloads', 'Disaggregated storage architecture for AI', ARRAY['VAST DataStore', 'InsightEngine'], 'leader', 6)
) AS v(name, country, city, valuation, revenue, stage, funding, investors, founded, employees, description, role_desc, products, position, ord)
CROSS JOIN supply_chain_categories c
WHERE c.category_name = 'Storage Systems';

-- Consumer AI (Private)
INSERT INTO private_companies (name, category_id, headquarters_country, headquarters_city, estimated_valuation, estimated_revenue, funding_stage, total_funding, key_investors, founded_year, employee_count_range, description, role_description, key_products, competitive_position, display_order)
SELECT 
    v.name, c.category_id, v.country, v.city, v.valuation, v.revenue, v.stage, v.funding, v.investors, v.founded, v.employees, v.description, v.role_desc, v.products, v.position, v.ord
FROM (VALUES
    ('Character.AI', 'US', 'Palo Alto', 1000000000, 150000000, 'Series A', 150000000, ARRAY['a16z', 'Google'], 2021, '50-100', 'Personalized AI character conversations', 'AI companions and characters', ARRAY['Character.AI app'], 'challenger', 1),
    ('Midjourney', 'US', 'San Francisco', 10000000000, 300000000, 'Bootstrapped', 0, ARRAY[]::TEXT[], 2021, '50-100', 'AI image generation leader', 'Artistic AI image generation', ARRAY['Midjourney'], 'leader', 2),
    ('Runway', 'US', 'New York', 4000000000, 100000000, 'Series D', 240000000, ARRAY['Google', 'NVIDIA', 'Salesforce'], 2018, '100-500', 'AI video generation and editing', 'Generative video tools', ARRAY['Gen-3', 'Video editing'], 'leader', 3),
    ('Perplexity AI', 'US', 'San Francisco', 9000000000, 100000000, 'Series B', 250000000, ARRAY['NVIDIA', 'Jeff Bezos', 'IVP'], 2022, '50-100', 'AI-powered search engine', 'Conversational search with citations', ARRAY['Perplexity Search', 'Pro'], 'challenger', 4)
) AS v(name, country, city, valuation, revenue, stage, funding, investors, founded, employees, description, role_desc, products, position, ord)
CROSS JOIN supply_chain_categories c
WHERE c.category_name = 'Consumer AI';

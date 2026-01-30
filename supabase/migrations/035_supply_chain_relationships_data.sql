-- Migration: Populate supply chain relationships
-- Date: 2026-01-30
-- Purpose: Insert real supplier-customer relationships for flow visualization

-- ============================================
-- TIER 0: RAW MATERIALS → FOUNDRIES/EQUIPMENT
-- ============================================

-- Shin-Etsu → TSMC (silicon wafers)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent)
VALUES (9476, 68, 'supplier', 'critical', 'Primary silicon wafer supplier to TSMC', ARRAY['300mm silicon wafers', 'SOI wafers'], 25);

-- Entegris → TSMC (process chemicals)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (1360, 68, 'supplier', 'strong', 'Advanced materials and specialty chemicals for semiconductor manufacturing', ARRAY['CMP slurries', 'Photoresists', 'Specialty gases']);

-- Linde → TSMC (specialty gases)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (37, 68, 'supplier', 'strong', 'Industrial gases for semiconductor fabs', ARRAY['Nitrogen', 'Argon', 'Specialty gases']);

-- Air Products → TSMC (specialty gases)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (3713, 68, 'supplier', 'strong', 'Industrial gases for semiconductor manufacturing', ARRAY['Nitrogen', 'Hydrogen', 'Specialty gases']);

-- ============================================
-- TIER 0: EQUIPMENT → FOUNDRIES
-- ============================================

-- ASML → TSMC (EUV lithography - MONOPOLY)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent, is_exclusive)
VALUES (67, 68, 'supplier', 'critical', 'Sole supplier of EUV lithography systems - monopoly position', ARRAY['EUV lithography systems', 'High-NA EUV', 'DUV systems'], 100, true);

-- ASML → Samsung (EUV lithography)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, is_exclusive)
VALUES (67, 9457, 'supplier', 'critical', 'Sole supplier of EUV lithography systems', ARRAY['EUV lithography systems', 'DUV systems'], true);

-- ASML → Intel (EUV lithography)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, is_exclusive)
VALUES (67, 45, 'supplier', 'critical', 'Sole supplier of EUV lithography systems', ARRAY['EUV lithography systems', 'High-NA EUV'], true);

-- Applied Materials → TSMC (deposition equipment)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (69, 68, 'supplier', 'critical', 'Leading supplier of deposition and etch equipment', ARRAY['CVD systems', 'PVD systems', 'Etch systems', 'CMP equipment']);

-- Applied Materials → Samsung
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (69, 9457, 'supplier', 'critical', 'Deposition and etch equipment for memory and logic', ARRAY['CVD systems', 'PVD systems', 'Etch systems']);

-- Lam Research → TSMC (etch equipment)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (70, 68, 'supplier', 'critical', 'Leading supplier of etch and deposition equipment', ARRAY['Conductor etch', 'Dielectric etch', 'ALD systems']);

-- Lam Research → Samsung
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (70, 9457, 'supplier', 'critical', 'Etch equipment for memory manufacturing', ARRAY['Conductor etch', 'Dielectric etch']);

-- KLA → TSMC (inspection/metrology)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (71, 68, 'supplier', 'critical', 'Process control and yield management systems', ARRAY['Wafer inspection', 'Metrology', 'Reticle inspection']);

-- Tokyo Electron → TSMC (coater/developer)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (9468, 68, 'supplier', 'strong', 'Coater/developer and etch equipment', ARRAY['Coater/developer', 'Etch systems', 'Deposition']);

-- Teradyne → TSMC (test equipment)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (656, 68, 'supplier', 'strong', 'Semiconductor test equipment', ARRAY['ATE systems', 'Wafer test']);

-- ============================================
-- TIER 1: FOUNDRY → CHIP DESIGNERS
-- ============================================

-- TSMC → NVIDIA (GPU fabrication - CRITICAL)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent)
VALUES (68, 6, 'supplier', 'critical', 'Primary foundry for all NVIDIA GPUs - 90%+ of production', ARRAY['3nm GPUs', '4nm GPUs', 'CoWoS packaging'], 90);

-- TSMC → AMD (CPU/GPU fabrication)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent)
VALUES (68, 28, 'supplier', 'critical', 'Primary foundry for AMD CPUs and GPUs', ARRAY['Ryzen CPUs', 'EPYC CPUs', 'Radeon GPUs'], 95);

-- TSMC → Broadcom (networking chips)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (68, 19, 'supplier', 'critical', 'Foundry for Broadcom networking and custom silicon', ARRAY['Switching ASICs', 'Custom AI chips', 'Networking ICs']);

-- TSMC → Qualcomm (mobile chips)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (68, 47, 'supplier', 'critical', 'Foundry for Snapdragon mobile processors', ARRAY['Snapdragon SoCs', 'Modem chips']);

-- TSMC → ARM (reference designs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (68, 5312, 'supplier', 'strong', 'Foundry for ARM reference designs and test chips', ARRAY['Reference designs', 'Test chips']);

-- TSMC → Marvell (custom silicon)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (68, 72, 'supplier', 'critical', 'Foundry for Marvell custom silicon and networking chips', ARRAY['Custom ASICs', 'Optical DSPs', 'Storage controllers']);

-- Intel internal fabrication (self-supply)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (45, 45, 'supplier', 'critical', 'Internal fabrication for Intel processors', ARRAY['Core CPUs', 'Xeon CPUs', 'Arc GPUs']);

-- Samsung internal fabrication
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (9457, 9457, 'supplier', 'critical', 'Internal fabrication for Samsung memory and Exynos', ARRAY['DRAM', 'NAND', 'Exynos SoCs']);

-- ============================================
-- TIER 1: MEMORY → GPU MAKERS
-- ============================================

-- SK Hynix → NVIDIA (HBM - PRIMARY)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent)
VALUES (9458, 6, 'supplier', 'critical', 'Primary HBM supplier for NVIDIA GPUs - 70% share for Vera Rubin', ARRAY['HBM3', 'HBM3e', 'HBM4'], 70);

-- Micron → NVIDIA (HBM)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent)
VALUES (73, 6, 'supplier', 'strong', 'Secondary HBM supplier for NVIDIA GPUs', ARRAY['HBM3', 'HBM3e'], 20);

-- Samsung → NVIDIA (HBM)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent)
VALUES (9457, 6, 'supplier', 'medium', 'Tertiary HBM supplier for NVIDIA GPUs', ARRAY['HBM3', 'HBM3e'], 10);

-- SK Hynix → AMD (HBM)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (9458, 28, 'supplier', 'critical', 'Primary HBM supplier for AMD MI series GPUs', ARRAY['HBM3', 'HBM3e']);

-- Micron → AMD (HBM)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (73, 28, 'supplier', 'strong', 'Secondary HBM supplier for AMD GPUs', ARRAY['HBM3']);

-- ============================================
-- TIER 1: PACKAGING (OSAT)
-- ============================================

-- TSMC CoWoS → NVIDIA (advanced packaging)
-- Already covered in TSMC → NVIDIA relationship

-- Amkor → NVIDIA (packaging partner)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6663, 6, 'supplier', 'strong', 'Advanced packaging partner for NVIDIA in Arizona', ARRAY['CoWoS packaging', 'Flip chip', '2.5D packaging']);

-- ASE → NVIDIA (packaging)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6975, 6, 'supplier', 'strong', 'OSAT partner for NVIDIA chip packaging', ARRAY['Advanced packaging', 'Test services']);

-- Amkor → AMD (packaging)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6663, 28, 'supplier', 'strong', 'Packaging partner for AMD processors', ARRAY['Flip chip', 'Advanced packaging']);

-- ASE → Broadcom (packaging)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6975, 19, 'supplier', 'strong', 'OSAT partner for Broadcom chips', ARRAY['Advanced packaging', 'Test services']);

-- ============================================
-- TIER 1 → TIER 2: CHIPS → SYSTEMS
-- ============================================

-- NVIDIA → Supermicro (GPUs for AI servers)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services, revenue_dependency_percent)
VALUES (6, 4859, 'supplier', 'critical', 'Primary GPU supplier for Supermicro AI servers', ARRAY['H100', 'H200', 'B100', 'B200', 'GB200'], 80);

-- NVIDIA → Dell (GPUs for PowerEdge)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 3321, 'supplier', 'critical', 'GPU supplier for Dell PowerEdge AI servers', ARRAY['H100', 'H200', 'B100', 'B200']);

-- NVIDIA → HPE (GPUs for ProLiant)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 4439, 'supplier', 'critical', 'GPU supplier for HPE ProLiant and Apollo servers', ARRAY['H100', 'H200', 'B100', 'B200']);

-- AMD → Dell (CPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (28, 3321, 'supplier', 'strong', 'EPYC CPU supplier for Dell servers', ARRAY['EPYC CPUs', 'MI GPUs']);

-- AMD → HPE (CPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (28, 4439, 'supplier', 'strong', 'EPYC CPU supplier for HPE servers', ARRAY['EPYC CPUs', 'MI GPUs']);

-- Intel → Dell (CPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (45, 3321, 'supplier', 'strong', 'Xeon CPU supplier for Dell servers', ARRAY['Xeon CPUs', 'Gaudi accelerators']);

-- Intel → HPE (CPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (45, 4439, 'supplier', 'strong', 'Xeon CPU supplier for HPE servers', ARRAY['Xeon CPUs']);

-- Broadcom → Arista (networking chips)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (19, 963, 'supplier', 'critical', 'Switching silicon supplier for Arista', ARRAY['Memory switching ASICs', 'Memory SerDes']);

-- Broadcom → Cisco (networking chips)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (19, 32, 'supplier', 'strong', 'Switching silicon for Cisco networking', ARRAY['Switching ASICs', 'PHYs']);

-- Marvell → Arista (optical DSPs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (72, 963, 'supplier', 'strong', 'Optical DSPs and custom silicon for Arista', ARRAY['Optical DSPs', 'Custom ASICs']);

-- NVIDIA Networking → Supermicro (InfiniBand)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 4859, 'supplier', 'strong', 'InfiniBand networking for AI clusters', ARRAY['ConnectX NICs', 'InfiniBand switches']);

-- ============================================
-- TIER 2 → TIER 4: SYSTEMS → CLOUD
-- ============================================

-- Supermicro → CoreWeave (AI servers)
INSERT INTO supply_chain_relationships (supplier_asset_id, supplier_private_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (4859, NULL, 6, 'supplier', 'critical', 'Primary server supplier for CoreWeave GPU cloud', ARRAY['GPU servers', 'Liquid-cooled systems']);

-- Supermicro → Lambda Labs (AI servers)
INSERT INTO supply_chain_relationships (supplier_asset_id, supplier_private_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (4859, NULL, 7, 'supplier', 'critical', 'Server supplier for Lambda Labs GPU cloud', ARRAY['GPU servers', 'AI workstations']);

-- Dell → Amazon (servers)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (3321, 5, 'supplier', 'medium', 'Enterprise server supplier to AWS', ARRAY['PowerEdge servers']);

-- Dell → Microsoft (servers)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (3321, 2, 'supplier', 'medium', 'Enterprise server supplier to Azure', ARRAY['PowerEdge servers']);

-- Arista → Amazon (switches)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (963, 5, 'supplier', 'strong', 'Data center switches for AWS', ARRAY['Spine switches', 'Leaf switches', '400G Ethernet']);

-- Arista → Microsoft (switches)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (963, 2, 'supplier', 'strong', 'Data center switches for Azure', ARRAY['Spine switches', 'Leaf switches']);

-- Arista → Meta (switches)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (963, 7, 'supplier', 'strong', 'Data center switches for Meta', ARRAY['Spine switches', 'Leaf switches']);

-- Cisco → Enterprise (general)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (32, 5, 'supplier', 'medium', 'Enterprise networking equipment', ARRAY['Routers', 'Switches', 'Security']);

-- ============================================
-- TIER 3 → TIER 4: DATA CENTERS → CLOUD
-- ============================================

-- Equinix → Amazon (colocation)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6934, 5, 'supplier', 'strong', 'Colocation and interconnection services', ARRAY['Colocation', 'Interconnection', 'Edge']);

-- Equinix → Microsoft (colocation)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6934, 2, 'supplier', 'strong', 'Colocation and interconnection services', ARRAY['Colocation', 'Interconnection']);

-- Equinix → Google (colocation)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6934, 3, 'supplier', 'strong', 'Colocation and interconnection services', ARRAY['Colocation', 'Interconnection']);

-- Digital Realty → Amazon (colocation)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (1628, 5, 'supplier', 'strong', 'Data center colocation', ARRAY['Colocation', 'Powered shell']);

-- Digital Realty → Microsoft (colocation)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (1628, 2, 'supplier', 'strong', 'Data center colocation', ARRAY['Colocation', 'Powered shell']);

-- Vertiv → Data centers (cooling/power)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (5480, 6934, 'supplier', 'strong', 'Thermal management and power systems', ARRAY['Cooling systems', 'UPS', 'PDUs']);

-- Vertiv → Supermicro (liquid cooling)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (5480, 4859, 'supplier', 'strong', 'Liquid cooling solutions for AI servers', ARRAY['Liquid cooling', 'CDUs']);

-- Eaton → Data centers (power)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (8877, 6934, 'supplier', 'strong', 'Power management systems', ARRAY['UPS', 'PDUs', 'Switchgear']);

-- ============================================
-- TIER 4 → TIER 5: CLOUD → APPLICATIONS
-- ============================================

-- Microsoft Azure → OpenAI (primary cloud)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_private_id, relationship_type, relationship_strength, description, products_services, is_exclusive)
VALUES (2, 1, 'supplier', 'critical', 'Primary cloud infrastructure and compute partner', ARRAY['Azure compute', 'GPU clusters', 'Storage'], true);

-- Amazon AWS → Anthropic (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (5, 2, 'supplier', 'critical', 'Primary cloud infrastructure partner', ARRAY['AWS compute', 'Trainium chips', 'Storage']);

-- Google Cloud → Anthropic (secondary cloud)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (3, 2, 'supplier', 'strong', 'Secondary cloud infrastructure partner', ARRAY['GCP compute', 'TPUs']);

-- Amazon AWS → OpenAI (secondary)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (5, 1, 'supplier', 'medium', 'Secondary cloud infrastructure', ARRAY['AWS compute']);

-- Oracle Cloud → xAI
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (9322, 4, 'supplier', 'critical', 'Primary cloud infrastructure for Grok training', ARRAY['OCI compute', 'GPU clusters']);

-- CoreWeave → Mistral AI
INSERT INTO supply_chain_relationships (supplier_private_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 3, 'supplier', 'strong', 'GPU cloud infrastructure', ARRAY['GPU compute', 'Training clusters']);

-- Lambda Labs → AI startups
INSERT INTO supply_chain_relationships (supplier_private_id, customer_private_id, relationship_type, relationship_strength, description, products_services)
VALUES (7, 8, 'supplier', 'medium', 'GPU cloud for AI training', ARRAY['GPU compute', 'Training infrastructure']);

-- ============================================
-- CUSTOM SILICON RELATIONSHIPS
-- ============================================

-- Broadcom → Google (TPU design partner)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (19, 3, 'partner', 'critical', 'Custom silicon design partner for Google TPUs', ARRAY['TPU design', 'ASIC development']);

-- TSMC → Google (TPU fabrication)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (68, 3, 'supplier', 'critical', 'Foundry for Google TPU chips', ARRAY['TPU fabrication', '3nm process']);

-- Intel → Amazon (custom chip fabrication)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (45, 5, 'supplier', 'strong', 'Custom chip fabrication for AWS Trainium', ARRAY['Trainium fabrication', 'Custom packaging']);

-- TSMC → Amazon (Graviton fabrication)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (68, 5, 'supplier', 'critical', 'Foundry for AWS Graviton ARM chips', ARRAY['Graviton CPUs', 'Trainium']);

-- TSMC → Microsoft (Maia fabrication)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (68, 2, 'supplier', 'critical', 'Foundry for Microsoft Maia AI chips', ARRAY['Maia 100', 'Maia 200']);

-- ============================================
-- NVIDIA → HYPERSCALERS (direct GPU sales)
-- ============================================

-- NVIDIA → Amazon (GPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 5, 'supplier', 'critical', 'GPU supplier for AWS EC2 instances', ARRAY['H100', 'H200', 'B100', 'B200', 'GB200']);

-- NVIDIA → Microsoft (GPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 2, 'supplier', 'critical', 'GPU supplier for Azure AI infrastructure', ARRAY['H100', 'H200', 'B100', 'B200', 'GB200']);

-- NVIDIA → Google (GPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 3, 'supplier', 'strong', 'GPU supplier for Google Cloud', ARRAY['H100', 'A100']);

-- NVIDIA → Meta (GPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 7, 'supplier', 'critical', 'GPU supplier for Meta AI infrastructure', ARRAY['H100', 'H200', 'B200']);

-- NVIDIA → Oracle (GPUs)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (6, 9322, 'supplier', 'critical', 'GPU supplier for Oracle Cloud AI', ARRAY['H100', 'H200', 'B200', 'GB200']);

-- ============================================
-- ENTERPRISE SOFTWARE DEPENDENCIES
-- ============================================

-- Salesforce → Amazon (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (5, 27, 'supplier', 'strong', 'Cloud infrastructure for Salesforce', ARRAY['AWS compute', 'Storage']);

-- ServiceNow → Amazon (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (5, 1826, 'supplier', 'strong', 'Cloud infrastructure for ServiceNow', ARRAY['AWS compute', 'Storage']);

-- Adobe → Amazon (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (5, 34, 'supplier', 'strong', 'Cloud infrastructure for Adobe Creative Cloud', ARRAY['AWS compute', 'Storage', 'CDN']);

-- Snowflake → Amazon (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (5, 53, 'supplier', 'critical', 'Primary cloud infrastructure for Snowflake', ARRAY['AWS compute', 'S3 storage']);

-- Snowflake → Microsoft (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (2, 53, 'supplier', 'strong', 'Azure infrastructure for Snowflake', ARRAY['Azure compute', 'Blob storage']);

-- Snowflake → Google (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (3, 53, 'supplier', 'strong', 'GCP infrastructure for Snowflake', ARRAY['GCP compute', 'Cloud storage']);

-- Palantir → Amazon (cloud infrastructure)
INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description, products_services)
VALUES (5, 48, 'supplier', 'strong', 'Cloud infrastructure for Palantir Foundry', ARRAY['AWS compute', 'Storage']);

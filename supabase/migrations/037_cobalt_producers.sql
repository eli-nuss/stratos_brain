-- Migration: Add Cobalt Producers to Supply Chain Map
-- Date: 2026-01-30
-- Description: Adds major cobalt mining companies to the Cobalt Producers category

-- Add cobalt producers to the Cobalt Producers category (31)
-- Note: Glencore (GLNCY) is the world's largest cobalt producer (20% global share)
-- but is not in our database as it trades OTC. These are the major publicly traded
-- cobalt producers available in our equity universe.

INSERT INTO asset_supply_chain_mapping (asset_id, category_id, competitive_position, market_share_percent, key_products, role_description)
VALUES
  -- Vale (VALE) - Major cobalt producer via Voisey's Bay nickel-cobalt mine in Canada
  -- Produces ~8% of global cobalt supply as byproduct of nickel mining
  (2273, 31, 'leader', 8, ARRAY['Cobalt from Voisey''s Bay', 'Nickel-Cobalt concentrate'], 
   'Major integrated miner producing cobalt as byproduct of nickel operations at Voisey''s Bay, Canada'),
  
  -- Freeport-McMoRan (FCX) - US-based with DRC cobalt-copper operations
  -- Operates copper-cobalt mines in Democratic Republic of Congo
  (2620, 31, 'major', 5, ARRAY['Copper-Cobalt concentrate', 'Cathode cobalt'], 
   'Copper-cobalt mining in DRC with processing facilities, former Tenke Fungurume stake'),
  
  -- BHP Group (BHP) - Nickel West produces cobalt as byproduct
  -- Australian operations produce cobalt sulfate for battery market
  (7840, 31, 'major', 3, ARRAY['Cobalt sulfate', 'Nickel-Cobalt products'], 
   'Cobalt production from Nickel West operations in Western Australia, supplying battery-grade cobalt sulfate'),
  
  -- Wheaton Precious Metals (WPM) - Cobalt streaming agreements
  -- Unique streaming model with cobalt offtake from Vale's Voisey's Bay
  (7229, 31, 'niche', 2, ARRAY['Cobalt streams', 'Precious metals'], 
   'Streaming company with $390M cobalt offtake agreement from Vale''s Voisey''s Bay mine')
ON CONFLICT (asset_id, category_id) DO NOTHING;

-- Note on missing companies:
-- Glencore (GLNCY/GLEN.L) - World's largest cobalt producer (26,800 tonnes/yr, 20% global)
--   Not in database - trades on London Stock Exchange and OTC in US
-- CMOC Group (603993.SS) - Second largest producer (18,600 tonnes/yr)
--   Not in database - Chinese company trading on Shanghai Stock Exchange
-- Anglo American (NGLOY) - Produces 2,300 tonnes/yr from South Africa platinum operations
--   Not in database - trades OTC in US

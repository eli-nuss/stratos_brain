-- Migration: Add supply chain relationships for Critical Minerals companies
-- These minerals flow into battery manufacturing, semiconductor fabs, and EV production

INSERT INTO supply_chain_relationships (supplier_asset_id, customer_asset_id, relationship_type, relationship_strength, description)
VALUES 
-- Lithium producers -> Battery/EV companies (Tesla)
(2652, 24, 'supplier', 'strong', 'Albemarle supplies lithium hydroxide for Tesla battery cathodes'),
(8570, 24, 'supplier', 'strong', 'SQM supplies lithium carbonate for EV battery production'),

-- Cobalt producers -> Battery supply chain
(2273, 24, 'supplier', 'medium', 'Vale supplies nickel and cobalt for battery cathodes'),
(2620, 24, 'supplier', 'medium', 'Freeport-McMoRan supplies copper for EV wiring and batteries'),

-- Rare earths -> Chip and magnet production
(9171, 6, 'supplier', 'medium', 'MP Materials supplies rare earths for NVIDIA server magnets and motors'),
(9171, 24, 'supplier', 'strong', 'MP Materials supplies rare earths for Tesla EV motors'),

-- Graphite -> Battery anodes
(8024, 24, 'supplier', 'medium', 'Nouveau Monde supplies graphite for EV battery anodes'),

-- Gallium -> Semiconductor production
(2882, 68, 'supplier', 'medium', 'Alcoa supplies aluminum and gallium for semiconductor packaging'),

-- Silicon metal -> Wafer production
(2500, 9476, 'supplier', 'strong', 'Ferroglobe supplies silicon metal to Shin-Etsu for wafer production')
ON CONFLICT DO NOTHING;

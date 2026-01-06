-- Migration: 010_equity_metadata_in_dashboard.sql
-- Description: Add equity_metadata (industry, sector, description) to v_dashboard_all_assets view
-- Date: 2026-01-06

-- Drop existing view to recreate with equity_metadata join
DROP VIEW IF EXISTS v_dashboard_all_assets;

-- Recreate view with equity_metadata for equities
CREATE OR REPLACE VIEW v_dashboard_all_assets AS
SELECT
    a.asset_id,
    a.symbol,
    a.name,
    a.asset_type,
    -- Use equity_metadata.industry for equities, keep assets.industry as fallback
    CASE 
        WHEN a.asset_type = 'equity' THEN COALESCE(em.industry, a.industry)
        ELSE a.industry
    END AS industry,
    -- Use equity_metadata.sector for equities, keep assets.sector as fallback
    CASE 
        WHEN a.asset_type = 'equity' THEN COALESCE(em.sector, a.sector)
        ELSE a.sector
    END AS sector,
    -- Category: for crypto use token_metadata categories, for equities use industry
    CASE
        WHEN a.asset_type = 'crypto' THEN
            CASE COALESCE(
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Meme%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Privacy%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Decentralized Finance%' OR elem ILIKE '%DeFi%' AND elem NOT ILIKE '%Portfolio%' AND elem NOT ILIKE '%Index%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Artificial Intelligence%' OR elem ILIKE '%AI Agent%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem = 'Layer 1 (L1)' OR elem = 'Layer 2 (L2)' OR elem = 'Layer 0 (L0)' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Smart Contract%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Oracle%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%DEX%' OR elem ILIKE '%Exchange%' AND elem NOT ILIKE '%Ecosystem%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Gaming%' OR elem ILIKE '%Metaverse%' OR elem ILIKE '%NFT%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Infrastructure%' OR elem ILIKE '%Storage%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Real World%' OR elem ILIKE '%RWA%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Payment%' OR elem ILIKE '%Currency%' OR elem ILIKE '%Stablecoin%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Ledger%' AND elem NOT ILIKE '%Ecosystem%' LIMIT 1),
                (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem 
                    WHERE elem NOT ILIKE '%Ecosystem%' AND elem NOT ILIKE '%Portfolio%' AND elem NOT ILIKE '%Index%' 
                    AND elem NOT ILIKE '%Alleged%' AND elem NOT ILIKE '%FTX%' AND elem NOT ILIKE '%Binance%' 
                    AND elem NOT ILIKE '%Holdings%' AND elem NOT ILIKE '%Peg%' AND elem NOT ILIKE '%Proof of%' 
                    AND elem NOT ILIKE '%Made in%' LIMIT 1),
                tm.categories ->> 0
            )
                WHEN 'Decentralized Finance (DeFi)' THEN 'DeFi'
                WHEN 'Artificial Intelligence (AI)' THEN 'AI'
                WHEN 'Layer 1 (L1)' THEN 'L1'
                WHEN 'Layer 2 (L2)' THEN 'L2'
                WHEN 'Layer 0 (L0)' THEN 'L0'
                WHEN 'Privacy Coins' THEN 'Privacy'
                WHEN 'Smart Contract Platform' THEN 'Smart Contract'
                WHEN 'Gaming (GameFi)' THEN 'Gaming'
                WHEN 'Real World Assets (RWA)' THEN 'RWA'
                WHEN 'Privacy Blockchain' THEN 'Privacy'
                ELSE COALESCE(
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Meme%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Privacy%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Decentralized Finance%' OR elem ILIKE '%DeFi%' AND elem NOT ILIKE '%Portfolio%' AND elem NOT ILIKE '%Index%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Artificial Intelligence%' OR elem ILIKE '%AI Agent%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem = 'Layer 1 (L1)' OR elem = 'Layer 2 (L2)' OR elem = 'Layer 0 (L0)' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Smart Contract%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Oracle%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%DEX%' OR elem ILIKE '%Exchange%' AND elem NOT ILIKE '%Ecosystem%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Gaming%' OR elem ILIKE '%Metaverse%' OR elem ILIKE '%NFT%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Infrastructure%' OR elem ILIKE '%Storage%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Real World%' OR elem ILIKE '%RWA%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Payment%' OR elem ILIKE '%Currency%' OR elem ILIKE '%Stablecoin%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem WHERE elem ILIKE '%Ledger%' AND elem NOT ILIKE '%Ecosystem%' LIMIT 1),
                    (SELECT elem FROM jsonb_array_elements_text(tm.categories) elem 
                        WHERE elem NOT ILIKE '%Ecosystem%' AND elem NOT ILIKE '%Portfolio%' AND elem NOT ILIKE '%Index%' 
                        AND elem NOT ILIKE '%Alleged%' AND elem NOT ILIKE '%FTX%' AND elem NOT ILIKE '%Binance%' 
                        AND elem NOT ILIKE '%Holdings%' AND elem NOT ILIKE '%Peg%' AND elem NOT ILIKE '%Proof of%' 
                        AND elem NOT ILIKE '%Made in%' LIMIT 1),
                    tm.categories ->> 0
                )
            END::VARCHAR
        ELSE COALESCE(em.industry, a.industry)
    END AS category,
    db.date AS as_of_date,
    db.close,
    df.return_1d,
    df.return_5d AS return_7d,
    df.return_21d AS return_30d,
    df.return_252d AS return_365d,
    df.dollar_volume,
    -- Market cap: for crypto calculate from circulating supply, for equities use equity_metadata
    CASE
        WHEN a.asset_type = 'crypto' THEN db.close * ((tm.raw -> 'market_data' ->> 'circulating_supply')::NUMERIC)
        ELSE em.market_cap
    END AS market_cap,
    (SELECT SUM(db2.dollar_volume) FROM daily_bars db2 
     WHERE db2.asset_id = a.asset_id AND db2.date > db.date - INTERVAL '7 days' AND db2.date <= db.date) AS dollar_volume_7d,
    (SELECT SUM(db2.dollar_volume) FROM daily_bars db2 
     WHERE db2.asset_id = a.asset_id AND db2.date > db.date - INTERVAL '30 days' AND db2.date <= db.date) AS dollar_volume_30d,
    air.attention_level AS ai_attention,
    air.direction AS ai_direction,
    air.ai_direction_score,
    air.setup_type,
    air.ai_setup_quality_score,
    air.confidence AS ai_confidence,
    air.summary_text AS ai_summary,
    -- Short description: for crypto use token_metadata, for equities use equity_metadata
    CASE
        WHEN a.asset_type = 'crypto' THEN LEFT((tm.raw -> 'description' ->> 'en'), 200)
        ELSE LEFT(em.description, 200)
    END AS short_description,
    -- P/E ratio for equities
    CASE
        WHEN a.asset_type = 'equity' THEN em.pe_ratio
        ELSE NULL
    END AS pe_ratio,
    CASE
        WHEN a.asset_type = 'crypto' THEN 'crypto_all'
        ELSE 'equity_all'
    END AS universe_id
FROM assets a
JOIN daily_bars db ON a.asset_id = db.asset_id
LEFT JOIN daily_features df ON a.asset_id = df.asset_id AND db.date = df.date
LEFT JOIN asset_ai_reviews air ON a.asset_id::TEXT = air.asset_id AND db.date = air.as_of_date
LEFT JOIN tokens t ON a.token_id = t.token_id
LEFT JOIN token_metadata tm ON t.token_id = tm.token_id
LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
WHERE a.is_active = true;

-- Add comment to document the view
COMMENT ON VIEW v_dashboard_all_assets IS 'Dashboard view for all assets with equity_metadata integration for industry, sector, description, market_cap, and pe_ratio';

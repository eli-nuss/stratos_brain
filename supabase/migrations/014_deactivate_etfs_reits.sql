-- Migration: 014_deactivate_etfs_reits.sql
-- Description: Deactivate ETFs, Funds, Trusts, and REITs from the assets table
-- Date: 2026-01-08
-- 
-- This migration sets is_active = false for non-operating company equities:
-- - ETFs, Funds, Trusts (identified by name patterns)
-- - REITs (identified by industry in equity_metadata)
--
-- The data is preserved but these assets will be excluded from:
-- - AI analysis workflows
-- - Dashboard views (which filter by is_active = true)
-- - Any other queries that use the is_active filter
--
-- Estimated impact: ~608 assets deactivated, ~4,409 remaining active

-- Deactivate ETFs, Funds, Trusts, and REITs
UPDATE assets a
SET is_active = false,
    updated_at = NOW()
FROM equity_metadata em
WHERE a.asset_id = em.asset_id
  AND a.asset_type = 'equity'
  AND a.is_active = true
  AND (
    -- ETFs, Funds, Trusts by name pattern
    a.name ILIKE '%ETF%'
    OR a.name ILIKE '%Fund%'
    OR a.name ILIKE '%Trust%'
    OR a.name ILIKE '%Index%'
    OR a.name ILIKE '%ProShares%'
    OR a.name ILIKE '%iShares%'
    OR a.name ILIKE '%SPDR%'
    OR a.name ILIKE '%Vanguard%'
    OR a.name ILIKE '%Invesco%'
    OR em.industry ILIKE '%ETF%'
    OR em.industry ILIKE '%Fund%'
    -- REITs by industry
    OR em.industry ILIKE '%REIT%'
  );

-- Also deactivate assets without equity_metadata that match ETF/Fund patterns
UPDATE assets
SET is_active = false,
    updated_at = NOW()
WHERE asset_type = 'equity'
  AND is_active = true
  AND asset_id NOT IN (SELECT asset_id FROM equity_metadata)
  AND (
    name ILIKE '%ETF%'
    OR name ILIKE '%Fund%'
    OR name ILIKE '%Trust%'
    OR name ILIKE '%Index%'
    OR name ILIKE '%ProShares%'
    OR name ILIKE '%iShares%'
    OR name ILIKE '%SPDR%'
    OR name ILIKE '%Vanguard%'
    OR name ILIKE '%Invesco%'
  );

-- Add comment to document the change
COMMENT ON TABLE assets IS 'Core assets table. ETFs, Funds, Trusts, and REITs have been deactivated (is_active=false) as of 2026-01-08 migration 014.';

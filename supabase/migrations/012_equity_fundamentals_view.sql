-- Migration: 012_equity_fundamentals_view.sql
-- Description: Create view for serving equity fundamentals with live hybrid metrics
-- Author: Manus AI
-- Date: 2026-01-06

-- ============================================================================
-- View: v_equity_fundamentals
-- Provides comprehensive equity fundamentals with on-the-fly calculated metrics
-- ============================================================================
CREATE OR REPLACE VIEW v_equity_fundamentals AS
WITH 
-- Get the latest 4 quarters of EPS for TTM calculation
latest_quarterly_eps AS (
    SELECT
        asset_id,
        fiscal_date_ending,
        eps,
        ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY fiscal_date_ending DESC) as rn
    FROM equity_quarterly_fundamentals
    WHERE eps IS NOT NULL
),
-- Calculate TTM EPS (sum of last 4 quarters)
ttm_eps AS (
    SELECT
        asset_id,
        SUM(eps) as eps_ttm,
        MAX(fiscal_date_ending) as latest_quarter
    FROM latest_quarterly_eps
    WHERE rn <= 4
    GROUP BY asset_id
    HAVING COUNT(*) >= 4  -- Only calculate if we have 4 quarters
),
-- Get the latest quarterly fundamentals
latest_quarterly AS (
    SELECT DISTINCT ON (asset_id)
        asset_id,
        fiscal_date_ending,
        total_revenue,
        gross_profit,
        operating_income,
        net_income,
        ebitda,
        total_assets,
        total_liabilities,
        total_shareholder_equity,
        operating_cashflow,
        free_cash_flow,
        common_stock_shares_outstanding
    FROM equity_quarterly_fundamentals
    ORDER BY asset_id, fiscal_date_ending DESC
),
-- Get the latest annual fundamentals
latest_annual AS (
    SELECT DISTINCT ON (asset_id)
        asset_id,
        fiscal_date_ending as annual_fiscal_date,
        total_revenue as annual_revenue,
        net_income as annual_net_income,
        ebitda as annual_ebitda,
        total_assets as annual_total_assets,
        total_shareholder_equity as annual_equity
    FROM equity_annual_fundamentals
    ORDER BY asset_id, fiscal_date_ending DESC
),
-- Get the latest price from daily_bars
latest_price AS (
    SELECT DISTINCT ON (asset_id)
        asset_id,
        date as price_date,
        close as latest_close
    FROM daily_bars
    ORDER BY asset_id, date DESC
)
SELECT
    a.asset_id,
    a.symbol,
    em.name,
    em.sector,
    em.industry,
    em.description,
    em.exchange,
    em.currency,
    em.country,
    
    -- Live price data
    lp.latest_close,
    lp.price_date,
    
    -- Pre-calculated metrics from equity_metadata (from Alpha Vantage OVERVIEW)
    em.market_cap,
    em.pe_ratio,
    em.peg_ratio,
    em.forward_pe,
    em.trailing_pe,
    em.price_to_book,
    em.price_to_sales_ttm,
    em.ev_to_revenue,
    em.ev_to_ebitda,
    em.dividend_yield,
    em.eps,
    em.beta,
    em.book_value,
    em.week_52_high,
    em.week_52_low,
    em.shares_outstanding,
    em.profit_margin,
    em.operating_margin_ttm,
    em.return_on_assets_ttm,
    em.return_on_equity_ttm,
    em.revenue_ttm,
    em.gross_profit_ttm,
    em.diluted_eps_ttm,
    em.quarterly_earnings_growth_yoy,
    em.quarterly_revenue_growth_yoy,
    em.analyst_target_price,
    
    -- TTM EPS calculated from quarterly data
    ttm.eps_ttm,
    ttm.latest_quarter as ttm_as_of_date,
    
    -- On-the-fly calculated P/E ratio using live price and TTM EPS
    CASE 
        WHEN ttm.eps_ttm > 0 AND lp.latest_close IS NOT NULL 
        THEN ROUND((lp.latest_close / ttm.eps_ttm)::numeric, 2)
        ELSE NULL
    END AS pe_ratio_live,
    
    -- Latest quarterly data
    lq.fiscal_date_ending as quarterly_fiscal_date,
    lq.total_revenue as quarterly_revenue,
    lq.gross_profit as quarterly_gross_profit,
    lq.operating_income as quarterly_operating_income,
    lq.net_income as quarterly_net_income,
    lq.ebitda as quarterly_ebitda,
    lq.total_assets as quarterly_total_assets,
    lq.total_liabilities as quarterly_total_liabilities,
    lq.total_shareholder_equity as quarterly_equity,
    lq.operating_cashflow as quarterly_operating_cashflow,
    lq.free_cash_flow as quarterly_free_cash_flow,
    lq.common_stock_shares_outstanding as quarterly_shares_outstanding,
    
    -- Latest annual data
    la.annual_fiscal_date,
    la.annual_revenue,
    la.annual_net_income,
    la.annual_ebitda,
    la.annual_total_assets,
    la.annual_equity,
    
    -- On-the-fly calculated Book Value Per Share
    CASE 
        WHEN lq.common_stock_shares_outstanding > 0 AND lq.total_shareholder_equity IS NOT NULL
        THEN ROUND((lq.total_shareholder_equity::numeric / lq.common_stock_shares_outstanding), 2)
        ELSE NULL
    END AS book_value_per_share_live,
    
    -- On-the-fly calculated P/B ratio using live price
    CASE 
        WHEN lq.common_stock_shares_outstanding > 0 
            AND lq.total_shareholder_equity > 0 
            AND lp.latest_close IS NOT NULL
        THEN ROUND((lp.latest_close * lq.common_stock_shares_outstanding / lq.total_shareholder_equity::numeric), 2)
        ELSE NULL
    END AS pb_ratio_live,
    
    -- Metadata timestamps
    em.last_updated as metadata_last_updated

FROM assets a
JOIN equity_metadata em ON a.asset_id = em.asset_id
LEFT JOIN latest_price lp ON a.asset_id = lp.asset_id
LEFT JOIN ttm_eps ttm ON a.asset_id = ttm.asset_id
LEFT JOIN latest_quarterly lq ON a.asset_id = lq.asset_id
LEFT JOIN latest_annual la ON a.asset_id = la.asset_id
WHERE a.asset_type = 'equity' AND a.is_active = true;

-- ============================================================================
-- Comment for documentation
-- ============================================================================
COMMENT ON VIEW v_equity_fundamentals IS 'Comprehensive equity fundamentals view with live hybrid metrics calculated on-the-fly';

-- Migration: Add Macro Context Tracking
-- Purpose: Store daily macro-economic indicators for contextualizing stock analysis
-- Author: Stratos Brain Team
-- Date: 2026-01-11

CREATE TABLE IF NOT EXISTS public.daily_macro_metrics (
    date DATE PRIMARY KEY,
    
    -- 1. Risk & Regime
    risk_premium NUMERIC,       -- Market Risk Premium from FMP
    market_regime TEXT,         -- 'Risk-On', 'Risk-Off', 'Neutral'
    
    -- 2. Rates & Credit
    us10y_yield NUMERIC,        -- 10-Year Treasury Yield
    us2y_yield NUMERIC,         -- 2-Year Treasury Yield (for curve calculation)
    yield_curve_10y_2y NUMERIC, -- Recession Indicator (10Y - 2Y)
    hyg_close NUMERIC,          -- Junk Bond ETF Price (Credit Appetite)
    
    -- 3. Commodities & Inflation
    oil_close NUMERIC,          -- WTI Crude Oil (CL=F)
    gold_close NUMERIC,         -- Gold (GC=F) - Safety trade
    copper_close NUMERIC,       -- Copper (HG=F) - Economic health proxy
    cpi_yoy NUMERIC,            -- CPI Year-over-Year % change
    
    -- 4. Market Breadth & Sectors
    spy_close NUMERIC,          -- S&P 500 ETF
    spy_change_pct NUMERIC,     -- Daily % change
    iwm_close NUMERIC,          -- Russell 2000 (Small Caps)
    iwm_change_pct NUMERIC,     -- Daily % change
    breadth_rating TEXT,        -- 'Strong', 'Weak', 'Divergent'
    sector_rotation JSONB,      -- Full sector performance: {'Technology': 1.2, 'Energy': -0.5}
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup for the "Latest" macro context
CREATE INDEX idx_daily_macro_date ON public.daily_macro_metrics(date DESC);

-- Index for time-series queries
CREATE INDEX idx_daily_macro_created ON public.daily_macro_metrics(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE public.daily_macro_metrics IS 'Daily macro-economic indicators for contextualizing stock analysis';
COMMENT ON COLUMN public.daily_macro_metrics.risk_premium IS 'Market Risk Premium - higher values indicate risk-off sentiment';
COMMENT ON COLUMN public.daily_macro_metrics.market_regime IS 'Calculated regime: Risk-On (bullish), Risk-Off (bearish), or Neutral';
COMMENT ON COLUMN public.daily_macro_metrics.yield_curve_10y_2y IS 'Yield curve spread - negative values indicate recession risk';
COMMENT ON COLUMN public.daily_macro_metrics.breadth_rating IS 'Market breadth quality - Strong (broad rally), Weak (narrow), Divergent (warning)';
COMMENT ON COLUMN public.daily_macro_metrics.sector_rotation IS 'JSONB object with sector names and daily % changes';

-- Grant permissions
GRANT SELECT ON public.daily_macro_metrics TO anon, authenticated;
GRANT ALL ON public.daily_macro_metrics TO service_role;

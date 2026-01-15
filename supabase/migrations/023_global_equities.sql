-- Migration 023: Global Equities Support
-- Adds support for international stocks with currency conversion

-- 1. Create fx_rates table for storing daily forex rates
CREATE TABLE IF NOT EXISTS public.fx_rates (
    rate_date DATE NOT NULL,
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    rate NUMERIC(20, 10) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'fmp',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (rate_date, from_currency, to_currency)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_fx_rates_date ON public.fx_rates(rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_fx_rates_currency ON public.fx_rates(from_currency, rate_date DESC);

-- 2. Add USD-converted columns to daily_bars
ALTER TABLE public.daily_bars 
    ADD COLUMN IF NOT EXISTS close_usd NUMERIC(20, 8),
    ADD COLUMN IF NOT EXISTS volume_usd NUMERIC(24, 4);

-- 3. Add fmp_symbol column to assets for FMP API lookups
ALTER TABLE public.assets 
    ADD COLUMN IF NOT EXISTS fmp_symbol VARCHAR(50);

-- 4. Update currency column for existing US equities (set to USD if null)
UPDATE public.assets 
SET currency = 'USD' 
WHERE asset_type = 'equity' 
  AND currency IS NULL 
  AND data_vendor = 'alpha_vantage';

-- 5. Create a view for global equity dashboard
CREATE OR REPLACE VIEW public.v_global_equities AS
SELECT 
    a.asset_id,
    a.symbol,
    a.name,
    a.sector,
    a.industry,
    a.exchange,
    a.currency,
    a.data_vendor,
    a.fmp_symbol,
    a.is_active,
    db.date as latest_date,
    db.close as close_native,
    db.close_usd,
    db.volume,
    db.volume_usd,
    CASE 
        WHEN a.currency = 'USD' THEN 'US'
        WHEN a.currency IN ('JPY') THEN 'Japan'
        WHEN a.currency IN ('HKD', 'CNY') THEN 'China/HK'
        WHEN a.currency IN ('KRW') THEN 'Korea'
        WHEN a.currency IN ('TWD') THEN 'Taiwan'
        WHEN a.currency IN ('INR') THEN 'India'
        WHEN a.currency IN ('EUR', 'GBP', 'CHF') THEN 'Europe'
        ELSE 'Other'
    END as region
FROM public.assets a
LEFT JOIN LATERAL (
    SELECT date, close, close_usd, volume, volume_usd
    FROM public.daily_bars
    WHERE asset_id = a.asset_id
    ORDER BY date DESC
    LIMIT 1
) db ON true
WHERE a.asset_type IN ('equity', 'global_equity')
  AND a.is_active = true;

-- 6. Create function to convert prices to USD
CREATE OR REPLACE FUNCTION public.convert_to_usd(
    p_amount NUMERIC,
    p_currency VARCHAR,
    p_date DATE
) RETURNS NUMERIC AS $$
DECLARE
    v_rate NUMERIC;
BEGIN
    -- USD doesn't need conversion
    IF p_currency = 'USD' OR p_currency IS NULL THEN
        RETURN p_amount;
    END IF;
    
    -- Look up the exchange rate
    SELECT rate INTO v_rate
    FROM public.fx_rates
    WHERE from_currency = p_currency
      AND to_currency = 'USD'
      AND rate_date <= p_date
    ORDER BY rate_date DESC
    LIMIT 1;
    
    -- If no rate found, return NULL
    IF v_rate IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN p_amount * v_rate;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Add comment for documentation
COMMENT ON TABLE public.fx_rates IS 'Daily foreign exchange rates for currency conversion. Rates are stored as from_currency/to_currency (e.g., JPY/USD = 0.0065 means 1 JPY = 0.0065 USD)';
COMMENT ON COLUMN public.daily_bars.close_usd IS 'Close price converted to USD using daily fx rate';
COMMENT ON COLUMN public.daily_bars.volume_usd IS 'Volume in USD terms (volume * close_usd)';
COMMENT ON COLUMN public.assets.fmp_symbol IS 'Symbol used for Financial Modeling Prep API lookups (may differ from display symbol)';

-- Migration: 019_fundamental_vigor_scores.sql
-- Description: Create tables for the Fundamental Vigor Score (FVS) system
-- This implements the Qualitative Fundamental Analysis scoring system using LLM-based analysis
-- Author: Stratos Team
-- Date: 2026-01-13

-- ============================================================================
-- Table: fundamental_vigor_scores
-- Stores the AI-generated Fundamental Vigor Scores for equities
-- Based on the four-pillar scoring methodology:
--   - Profitability & Efficiency (35%)
--   - Solvency & Liquidity (25%)
--   - Growth & Momentum (20%)
--   - Quality & Moat (20%)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fundamental_vigor_scores (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,
    
    -- Four Pillar Sub-Scores (0-100 each)
    profitability_score INTEGER CHECK (profitability_score >= 0 AND profitability_score <= 100),
    solvency_score INTEGER CHECK (solvency_score >= 0 AND solvency_score <= 100),
    growth_score INTEGER CHECK (growth_score >= 0 AND growth_score <= 100),
    moat_score INTEGER CHECK (moat_score >= 0 AND moat_score <= 100),
    
    -- Final Weighted Score (0-100)
    -- Calculated as: profitability*0.35 + solvency*0.25 + growth*0.20 + moat*0.20
    final_score NUMERIC(5, 2) CHECK (final_score >= 0 AND final_score <= 100),
    
    -- Confidence and Quality Metrics
    confidence_level VARCHAR(20) CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW')),
    data_quality_score NUMERIC(3, 2) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    
    -- Shadow Scoring (for calibration against established metrics)
    piotroski_f_score INTEGER CHECK (piotroski_f_score >= 0 AND piotroski_f_score <= 9),
    altman_z_score NUMERIC(6, 3),
    
    -- AI Reasoning Output
    reasoning_scratchpad TEXT,  -- Chain of Thought reasoning
    final_reasoning_paragraph TEXT,  -- User-facing summary (100-200 words)
    
    -- Detailed Breakdown (JSON)
    -- Contains: quantitative_inputs, qualitative_assessments, pillar_details
    score_breakdown JSONB,
    
    -- Pre-calculated Quantitative Metrics (input to LLM)
    quantitative_metrics JSONB,
    
    -- Model and Version Tracking
    model_name VARCHAR(50) DEFAULT 'gemini-3-pro-preview',
    prompt_version VARCHAR(20) DEFAULT '1.0',
    input_hash VARCHAR(64),  -- Hash of inputs for idempotency
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one score per asset per date per prompt version
    CONSTRAINT unique_fvs_asset_date_version UNIQUE (asset_id, as_of_date, prompt_version)
);

-- ============================================================================
-- Table: fvs_calculation_inputs
-- Stores the pre-calculated quantitative metrics used as input to the FVS
-- This ensures reproducibility and allows auditing of the scoring process
-- ============================================================================
CREATE TABLE IF NOT EXISTS fvs_calculation_inputs (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    as_of_date DATE NOT NULL,
    
    -- Profitability Metrics
    roic NUMERIC(10, 4),  -- Return on Invested Capital
    gross_margin NUMERIC(10, 4),
    gross_margin_trend NUMERIC(10, 4),  -- YoY change
    operating_margin NUMERIC(10, 4),
    net_margin NUMERIC(10, 4),
    asset_turnover NUMERIC(10, 4),
    roe NUMERIC(10, 4),  -- Return on Equity
    roa NUMERIC(10, 4),  -- Return on Assets
    
    -- DuPont Analysis Components
    dupont_profit_margin NUMERIC(10, 4),
    dupont_asset_turnover NUMERIC(10, 4),
    dupont_equity_multiplier NUMERIC(10, 4),
    
    -- Solvency & Liquidity Metrics
    current_ratio NUMERIC(10, 4),
    quick_ratio NUMERIC(10, 4),
    cash_ratio NUMERIC(10, 4),
    net_debt_to_ebitda NUMERIC(10, 4),
    interest_coverage NUMERIC(10, 4),
    debt_to_equity NUMERIC(10, 4),
    debt_to_assets NUMERIC(10, 4),
    altman_z_score NUMERIC(10, 4),
    
    -- Growth Metrics
    revenue_cagr_4y NUMERIC(10, 4),  -- 4-year Revenue CAGR
    ebitda_cagr_4y NUMERIC(10, 4),   -- 4-year EBITDA CAGR
    fcf_cagr_4y NUMERIC(10, 4),      -- 4-year Free Cash Flow CAGR
    eps_cagr_4y NUMERIC(10, 4),      -- 4-year EPS CAGR
    revenue_growth_yoy NUMERIC(10, 4),
    revenue_acceleration NUMERIC(10, 4),  -- QoQ growth rate change
    
    -- Quality & Moat Metrics
    accruals_ratio NUMERIC(10, 4),
    fcf_to_net_income NUMERIC(10, 4),  -- Cash Flow conversion
    share_buyback_yield NUMERIC(10, 4),
    dividend_yield NUMERIC(10, 4),
    peg_ratio NUMERIC(10, 4),
    
    -- Piotroski F-Score Components (9 binary signals)
    piotroski_positive_net_income BOOLEAN,
    piotroski_positive_ocf BOOLEAN,
    piotroski_roa_increasing BOOLEAN,
    piotroski_ocf_gt_net_income BOOLEAN,
    piotroski_debt_ratio_decreasing BOOLEAN,
    piotroski_current_ratio_increasing BOOLEAN,
    piotroski_no_dilution BOOLEAN,
    piotroski_gross_margin_increasing BOOLEAN,
    piotroski_asset_turnover_increasing BOOLEAN,
    
    -- Raw Financial Data (for reference)
    revenue_ttm BIGINT,
    ebitda_ttm BIGINT,
    net_income_ttm BIGINT,
    free_cash_flow_ttm BIGINT,
    total_debt BIGINT,
    total_equity BIGINT,
    total_assets BIGINT,
    cash_and_equivalents BIGINT,
    market_cap BIGINT,
    
    -- Historical Data Arrays (4 years)
    revenue_history JSONB,  -- Array of annual revenues
    ebitda_history JSONB,
    net_income_history JSONB,
    fcf_history JSONB,
    quarterly_revenue JSONB,  -- Last 16 quarters
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_fvs_inputs_asset_date UNIQUE (asset_id, as_of_date)
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_fvs_asset_id ON fundamental_vigor_scores(asset_id);
CREATE INDEX IF NOT EXISTS idx_fvs_as_of_date ON fundamental_vigor_scores(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_fvs_final_score ON fundamental_vigor_scores(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_fvs_asset_date ON fundamental_vigor_scores(asset_id, as_of_date DESC);

CREATE INDEX IF NOT EXISTS idx_fvs_inputs_asset_id ON fvs_calculation_inputs(asset_id);
CREATE INDEX IF NOT EXISTS idx_fvs_inputs_as_of_date ON fvs_calculation_inputs(as_of_date DESC);

-- ============================================================================
-- Trigger to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_fvs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fvs_updated_at ON fundamental_vigor_scores;
CREATE TRIGGER trigger_fvs_updated_at
    BEFORE UPDATE ON fundamental_vigor_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_fvs_updated_at();

-- ============================================================================
-- View: v_fvs_latest
-- Returns the latest FVS for each asset
-- ============================================================================
CREATE OR REPLACE VIEW v_fvs_latest AS
SELECT DISTINCT ON (fvs.asset_id)
    fvs.*,
    a.symbol,
    a.name,
    em.sector,
    em.industry,
    em.market_cap
FROM fundamental_vigor_scores fvs
JOIN assets a ON fvs.asset_id = a.asset_id
LEFT JOIN equity_metadata em ON fvs.asset_id = em.asset_id
WHERE a.asset_type = 'equity'
  AND a.is_active = true
ORDER BY fvs.asset_id, fvs.as_of_date DESC, fvs.created_at DESC;

-- ============================================================================
-- View: v_fvs_with_inputs
-- Joins FVS with calculation inputs for debugging/auditing
-- ============================================================================
CREATE OR REPLACE VIEW v_fvs_with_inputs AS
SELECT 
    fvs.*,
    a.symbol,
    a.name,
    fci.roic,
    fci.gross_margin,
    fci.current_ratio,
    fci.net_debt_to_ebitda,
    fci.revenue_cagr_4y,
    fci.fcf_to_net_income
FROM fundamental_vigor_scores fvs
JOIN assets a ON fvs.asset_id = a.asset_id
LEFT JOIN fvs_calculation_inputs fci 
    ON fvs.asset_id = fci.asset_id 
    AND fvs.as_of_date = fci.as_of_date
ORDER BY fvs.as_of_date DESC, fvs.final_score DESC;

-- ============================================================================
-- Update v_dashboard_all_assets to include FVS
-- ============================================================================
CREATE OR REPLACE VIEW v_dashboard_all_assets AS
SELECT 
    a.asset_id,
    a.symbol,
    a.name,
    a.asset_type,
    a.is_active,
    
    -- Price data
    db.date as price_date,
    db.close as price,
    db.open,
    db.high,
    db.low,
    db.volume,
    
    -- Technical features
    df.rsi_14,
    df.macd_line,
    df.macd_signal,
    df.sma_20,
    df.sma_50,
    df.sma_200,
    df.atr_14,
    df.dollar_volume_sma_20,
    
    -- Signal scores
    das.score_total,
    das.weighted_score,
    das.score_delta,
    das.inflection_score,
    das.new_signal_count,
    das.rank_in_universe,
    
    -- AI review scores
    aar.ai_direction_score,
    aar.smoothed_ai_direction_score,
    aar.ai_setup_quality_score,
    aar.smoothed_ai_setup_quality_score,
    aar.direction as ai_direction,
    aar.attention_level,
    aar.setup_type,
    aar.summary_text as ai_summary,
    
    -- Fundamental Vigor Score (NEW)
    fvs.final_score as fvs_score,
    fvs.profitability_score as fvs_profitability,
    fvs.solvency_score as fvs_solvency,
    fvs.growth_score as fvs_growth,
    fvs.moat_score as fvs_moat,
    fvs.confidence_level as fvs_confidence,
    fvs.final_reasoning_paragraph as fvs_reasoning,
    fvs.piotroski_f_score,
    fvs.altman_z_score as fvs_altman_z,
    
    -- Equity metadata
    em.sector,
    em.industry,
    em.market_cap,
    em.pe_ratio,
    em.dividend_yield,
    em.beta,
    em.fifty_two_week_high,
    em.fifty_two_week_low,
    em.trailing_pe,
    em.forward_pe,
    em.peg_ratio,
    em.price_to_book,
    em.profit_margin,
    em.return_on_equity_ttm,
    em.revenue_ttm,
    em.quarterly_revenue_growth_yoy
    
FROM assets a
LEFT JOIN LATERAL (
    SELECT * FROM daily_bars 
    WHERE asset_id = a.asset_id 
    ORDER BY date DESC LIMIT 1
) db ON true
LEFT JOIN LATERAL (
    SELECT * FROM daily_features 
    WHERE asset_id = a.asset_id 
    ORDER BY date DESC LIMIT 1
) df ON true
LEFT JOIN LATERAL (
    SELECT * FROM daily_asset_scores 
    WHERE asset_id::bigint = a.asset_id 
    ORDER BY as_of_date DESC LIMIT 1
) das ON true
LEFT JOIN LATERAL (
    SELECT * FROM asset_ai_reviews 
    WHERE asset_id::bigint = a.asset_id 
    ORDER BY as_of_date DESC, ai_review_version DESC LIMIT 1
) aar ON true
LEFT JOIN LATERAL (
    SELECT * FROM fundamental_vigor_scores 
    WHERE asset_id = a.asset_id 
    ORDER BY as_of_date DESC LIMIT 1
) fvs ON true
LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
WHERE a.is_active = true;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE fundamental_vigor_scores IS 'AI-generated Fundamental Vigor Scores using the four-pillar methodology: Profitability (35%), Solvency (25%), Growth (20%), Moat (20%)';
COMMENT ON TABLE fvs_calculation_inputs IS 'Pre-calculated quantitative metrics used as deterministic inputs to the FVS LLM analysis';
COMMENT ON COLUMN fundamental_vigor_scores.profitability_score IS 'Profitability & Efficiency pillar score (0-100), weighted 35% in final score';
COMMENT ON COLUMN fundamental_vigor_scores.solvency_score IS 'Solvency & Liquidity pillar score (0-100), weighted 25% in final score';
COMMENT ON COLUMN fundamental_vigor_scores.growth_score IS 'Growth & Momentum pillar score (0-100), weighted 20% in final score';
COMMENT ON COLUMN fundamental_vigor_scores.moat_score IS 'Quality & Moat pillar score (0-100), weighted 20% in final score';
COMMENT ON COLUMN fundamental_vigor_scores.reasoning_scratchpad IS 'Chain of Thought reasoning from the LLM (internal use)';
COMMENT ON COLUMN fundamental_vigor_scores.final_reasoning_paragraph IS 'User-facing summary paragraph (100-200 words) with citations';

-- Migration: Enhanced Backtesting Schema
-- Date: 2026-01-25
-- Description: Extended schema for comprehensive setup analysis and ranking

-- =============================================================================
-- DROP EXISTING TABLES IF THEY EXIST (for clean migration)
-- =============================================================================
DROP TABLE IF EXISTS backtest_summary_metrics CASCADE;
DROP TABLE IF EXISTS backtest_trades CASCADE;
DROP TABLE IF EXISTS backtest_runs CASCADE;
DROP TABLE IF EXISTS setup_performance_rankings CASCADE;
DROP TABLE IF EXISTS setup_optimal_params CASCADE;

-- =============================================================================
-- CORE BACKTESTING TABLES
-- =============================================================================

-- Table: backtest_runs
-- Stores metadata about each backtest run
CREATE TABLE backtest_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setup_name TEXT NOT NULL,
    asset_universe TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    is_optimization_run BOOLEAN DEFAULT FALSE,
    parent_run_id UUID REFERENCES backtest_runs(run_id),
    run_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_runs_setup ON backtest_runs(setup_name);
CREATE INDEX idx_backtest_runs_universe ON backtest_runs(asset_universe);
CREATE INDEX idx_backtest_runs_date ON backtest_runs(run_at DESC);

-- Table: backtest_trades
-- Stores individual trade results
CREATE TABLE backtest_trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES backtest_runs(run_id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    entry_price NUMERIC(20, 8) NOT NULL,
    exit_date DATE,
    exit_price NUMERIC(20, 8),
    exit_reason TEXT CHECK (exit_reason IN ('stop_loss', 'take_profit', 'time_exit', 'manual')),
    return_pct NUMERIC(10, 6),
    holding_period INTEGER,
    is_winner BOOLEAN GENERATED ALWAYS AS (return_pct > 0) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_backtest_trades_run ON backtest_trades(run_id);
CREATE INDEX idx_backtest_trades_asset ON backtest_trades(asset_id);
CREATE INDEX idx_backtest_trades_entry ON backtest_trades(entry_date);
CREATE INDEX idx_backtest_trades_winner ON backtest_trades(is_winner);

-- Table: backtest_summary_metrics
-- Stores comprehensive performance metrics for each run
CREATE TABLE backtest_summary_metrics (
    run_id UUID PRIMARY KEY REFERENCES backtest_runs(run_id) ON DELETE CASCADE,
    
    -- Core metrics
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    losing_trades INTEGER NOT NULL DEFAULT 0,
    win_rate NUMERIC(5, 4),
    
    -- Return metrics
    total_return_pct NUMERIC(10, 6),
    avg_return_pct NUMERIC(10, 6),
    median_return_pct NUMERIC(10, 6),
    std_return_pct NUMERIC(10, 6),
    
    -- Risk metrics
    profit_factor NUMERIC(10, 4),
    sharpe_ratio NUMERIC(10, 4),
    sortino_ratio NUMERIC(10, 4),
    max_drawdown NUMERIC(10, 6),
    calmar_ratio NUMERIC(10, 4),
    
    -- Win/Loss analysis
    avg_win_pct NUMERIC(10, 6),
    avg_loss_pct NUMERIC(10, 6),
    win_loss_ratio NUMERIC(10, 4),
    largest_win_pct NUMERIC(10, 6),
    largest_loss_pct NUMERIC(10, 6),
    
    -- Streak analysis
    max_consecutive_wins INTEGER,
    max_consecutive_losses INTEGER,
    avg_consecutive_wins NUMERIC(6, 2),
    avg_consecutive_losses NUMERIC(6, 2),
    
    -- Time analysis
    avg_holding_period NUMERIC(6, 2),
    avg_winning_hold NUMERIC(6, 2),
    avg_losing_hold NUMERIC(6, 2),
    
    -- Exit analysis (stored as JSONB for flexibility)
    exit_reason_breakdown JSONB,
    
    -- Composite scores
    reliability_score NUMERIC(5, 2),
    risk_adjusted_score NUMERIC(5, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SETUP RANKING AND OPTIMIZATION TABLES
-- =============================================================================

-- Table: setup_optimal_params
-- Stores the best parameters found for each setup
CREATE TABLE setup_optimal_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setup_name TEXT NOT NULL,
    asset_universe TEXT NOT NULL,
    optimal_params JSONB NOT NULL,
    backtest_run_id UUID REFERENCES backtest_runs(run_id),
    
    -- Performance at optimal params
    win_rate NUMERIC(5, 4),
    profit_factor NUMERIC(10, 4),
    sharpe_ratio NUMERIC(10, 4),
    reliability_score NUMERIC(5, 2),
    total_trades INTEGER,
    
    -- Metadata
    optimization_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_current BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(setup_name, asset_universe, is_current) -- Only one current optimal per setup/universe
);

CREATE INDEX idx_setup_optimal_current ON setup_optimal_params(setup_name, asset_universe) WHERE is_current = TRUE;

-- Table: setup_performance_rankings
-- Stores cross-setup comparison rankings
CREATE TABLE setup_performance_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ranking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    asset_universe TEXT NOT NULL,
    
    -- Rankings (JSONB array of ranked setups)
    rankings JSONB NOT NULL,
    
    -- Summary statistics
    best_setup TEXT,
    best_reliability_score NUMERIC(5, 2),
    avg_reliability_score NUMERIC(5, 2),
    
    -- Analysis period
    analysis_start_date DATE NOT NULL,
    analysis_end_date DATE NOT NULL,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(ranking_date, asset_universe)
);

CREATE INDEX idx_rankings_date ON setup_performance_rankings(ranking_date DESC);
CREATE INDEX idx_rankings_universe ON setup_performance_rankings(asset_universe);

-- =============================================================================
-- VIEWS FOR EASY QUERYING
-- =============================================================================

-- View: Latest optimal parameters for each setup
CREATE OR REPLACE VIEW v_current_optimal_params AS
SELECT 
    setup_name,
    asset_universe,
    optimal_params,
    win_rate,
    profit_factor,
    sharpe_ratio,
    reliability_score,
    total_trades,
    optimization_date
FROM setup_optimal_params
WHERE is_current = TRUE
ORDER BY reliability_score DESC;

-- View: Latest rankings
CREATE OR REPLACE VIEW v_latest_rankings AS
SELECT 
    r.ranking_date,
    r.asset_universe,
    r.best_setup,
    r.best_reliability_score,
    r.rankings,
    r.analysis_start_date,
    r.analysis_end_date
FROM setup_performance_rankings r
WHERE r.ranking_date = (
    SELECT MAX(ranking_date) 
    FROM setup_performance_rankings 
    WHERE asset_universe = r.asset_universe
);

-- View: Trade statistics by setup
CREATE OR REPLACE VIEW v_setup_trade_stats AS
SELECT 
    br.setup_name,
    br.asset_universe,
    COUNT(DISTINCT br.run_id) as total_runs,
    SUM(bsm.total_trades) as total_trades,
    AVG(bsm.win_rate) as avg_win_rate,
    AVG(bsm.profit_factor) as avg_profit_factor,
    AVG(bsm.sharpe_ratio) as avg_sharpe_ratio,
    AVG(bsm.reliability_score) as avg_reliability_score,
    MAX(bsm.reliability_score) as best_reliability_score
FROM backtest_runs br
JOIN backtest_summary_metrics bsm ON br.run_id = bsm.run_id
GROUP BY br.setup_name, br.asset_universe
ORDER BY avg_reliability_score DESC;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function: Update setup optimal params when a better configuration is found
CREATE OR REPLACE FUNCTION update_optimal_params(
    p_setup_name TEXT,
    p_universe TEXT,
    p_params JSONB,
    p_run_id UUID,
    p_win_rate NUMERIC,
    p_profit_factor NUMERIC,
    p_sharpe NUMERIC,
    p_reliability NUMERIC,
    p_trades INTEGER
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Mark existing as not current
    UPDATE setup_optimal_params
    SET is_current = FALSE, updated_at = NOW()
    WHERE setup_name = p_setup_name 
      AND asset_universe = p_universe 
      AND is_current = TRUE;
    
    -- Insert new optimal
    INSERT INTO setup_optimal_params (
        setup_name, asset_universe, optimal_params, backtest_run_id,
        win_rate, profit_factor, sharpe_ratio, reliability_score, total_trades
    ) VALUES (
        p_setup_name, p_universe, p_params, p_run_id,
        p_win_rate, p_profit_factor, p_sharpe, p_reliability, p_trades
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Save setup rankings
CREATE OR REPLACE FUNCTION save_setup_rankings(
    p_universe TEXT,
    p_rankings JSONB,
    p_start_date DATE,
    p_end_date DATE
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_best_setup TEXT;
    v_best_score NUMERIC;
    v_avg_score NUMERIC;
BEGIN
    -- Extract best setup from rankings
    SELECT 
        rankings->0->>'setup_name',
        (rankings->0->>'reliability_score')::NUMERIC,
        AVG((elem->>'reliability_score')::NUMERIC)
    INTO v_best_setup, v_best_score, v_avg_score
    FROM jsonb_array_elements(p_rankings) elem;
    
    -- Insert or update rankings
    INSERT INTO setup_performance_rankings (
        asset_universe, rankings, best_setup, best_reliability_score,
        avg_reliability_score, analysis_start_date, analysis_end_date
    ) VALUES (
        p_universe, p_rankings, v_best_setup, v_best_score,
        v_avg_score, p_start_date, p_end_date
    )
    ON CONFLICT (ranking_date, asset_universe) DO UPDATE SET
        rankings = EXCLUDED.rankings,
        best_setup = EXCLUDED.best_setup,
        best_reliability_score = EXCLUDED.best_reliability_score,
        avg_reliability_score = EXCLUDED.avg_reliability_score,
        created_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backtest_runs IS 'Stores metadata for each backtest execution';
COMMENT ON TABLE backtest_trades IS 'Individual trade records from backtests';
COMMENT ON TABLE backtest_summary_metrics IS 'Comprehensive performance metrics per backtest run';
COMMENT ON TABLE setup_optimal_params IS 'Best parameters found for each setup through optimization';
COMMENT ON TABLE setup_performance_rankings IS 'Cross-setup comparison and rankings';

COMMENT ON COLUMN backtest_summary_metrics.reliability_score IS 'Composite score (0-100) combining win rate, profit factor, sharpe, and sample size';
COMMENT ON COLUMN backtest_summary_metrics.risk_adjusted_score IS 'Score adjusted for drawdown and volatility';
COMMENT ON COLUMN setup_optimal_params.is_current IS 'TRUE for the latest optimal params, FALSE for historical';

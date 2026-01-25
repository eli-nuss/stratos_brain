-- Migration: Add Backtesting Tables
-- Date: 2026-01-25
-- Description: Creates tables for storing backtest runs, trades, and summary metrics

-- Table: backtest_runs
-- Stores metadata about each backtest run
CREATE TABLE IF NOT EXISTS backtest_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setup_name TEXT NOT NULL,
    asset_universe TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    parameters JSONB,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying runs by setup
CREATE INDEX IF NOT EXISTS idx_backtest_runs_setup_name ON backtest_runs(setup_name);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_run_at ON backtest_runs(run_at DESC);

-- Table: backtest_trades
-- Stores individual trade results for each backtest run
CREATE TABLE IF NOT EXISTS backtest_trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES backtest_runs(run_id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_date DATE,
    exit_price NUMERIC,
    exit_reason TEXT, -- 'stop_loss', 'take_profit', 'time_exit'
    return_pct NUMERIC,
    holding_period INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying trades
CREATE INDEX IF NOT EXISTS idx_backtest_trades_run_id ON backtest_trades(run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_asset_id ON backtest_trades(asset_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_entry_date ON backtest_trades(entry_date);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_exit_reason ON backtest_trades(exit_reason);

-- Table: backtest_summary_metrics
-- Stores aggregate performance metrics for each backtest run
CREATE TABLE IF NOT EXISTS backtest_summary_metrics (
    run_id UUID PRIMARY KEY REFERENCES backtest_runs(run_id) ON DELETE CASCADE,
    total_trades INTEGER,
    win_rate NUMERIC,
    profit_factor NUMERIC,
    avg_return_pct NUMERIC,
    sharpe_ratio NUMERIC,
    max_drawdown NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments for documentation
COMMENT ON TABLE backtest_runs IS 'Stores metadata about each backtest run including setup name, universe, date range, and parameters';
COMMENT ON TABLE backtest_trades IS 'Stores individual trade results for each backtest run';
COMMENT ON TABLE backtest_summary_metrics IS 'Stores aggregate performance metrics for each backtest run';

COMMENT ON COLUMN backtest_trades.exit_reason IS 'Reason for trade exit: stop_loss, take_profit, or time_exit';
COMMENT ON COLUMN backtest_summary_metrics.profit_factor IS 'Gross profit divided by gross loss';
COMMENT ON COLUMN backtest_summary_metrics.sharpe_ratio IS 'Annualized risk-adjusted return';
COMMENT ON COLUMN backtest_summary_metrics.max_drawdown IS 'Maximum peak-to-trough decline';

# Scalable Backtesting System Design

**Version:** 2.0  
**Author:** Manus AI  
**Date:** January 25, 2026

---

## Executive Summary

This document presents the architectural design for a scalable backtesting system for Stratos Brain. The system is engineered to achieve two primary objectives:

> **Goal 1:** Identify the **optimal parameters** for each of the 7 Master Trading Setups.
>
> **Goal 2:** **Rank all setups** by reliability and performance to determine which strategies are most profitable and consistent.

The output of this system directly feeds into the "Classify First, Grade Second" AI paradigm, providing quantitative validation for the setups that the AI will be asked to grade.

---

## 1. System Architecture

The backtesting system consists of five interconnected modules:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPREHENSIVE BACKTESTER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   SETUP      │    │    DATA      │    │   TRADE      │                   │
│  │ DEFINITIONS  │───▶│   PROVIDER   │───▶│  SIMULATOR   │                   │
│  │   (YAML)     │    │              │    │              │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                                       │                            │
│         │                                       ▼                            │
│         │            ┌──────────────────────────────────────┐               │
│         │            │         METRICS CALCULATOR           │               │
│         │            │  • Win Rate    • Profit Factor       │               │
│         │            │  • Sharpe      • Sortino             │               │
│         │            │  • Max DD     • Reliability Score    │               │
│         │            └──────────────────────────────────────┘               │
│         │                            │                                       │
│         ▼                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PARAMETER OPTIMIZER                                │   │
│  │  Grid search over all parameter combinations to find optimal config   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      SETUP RANKER                                     │   │
│  │  Compare all setups and rank by Reliability Score                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    DATABASE (Supabase)                                │   │
│  │  • backtest_runs          • setup_optimal_params                      │   │
│  │  • backtest_trades        • setup_performance_rankings                │   │
│  │  • backtest_summary_metrics                                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 7 Master Setups

The backtesting system tests the following setups, derived from the "Project Apex" feedback:

| # | Setup Name | Category | Direction | Description |
|---|------------|----------|-----------|-------------|
| 1 | `pullback_ma50` | Trend Continuation | Long | Pullback to 50-day MA in strong uptrend |
| 2 | `vcp_squeeze` | Trend Continuation | Long | Volatility Contraction Pattern (bands tightening) |
| 3 | `standard_breakout` | Momentum | Long | Price clears resistance on high volume |
| 4 | `gap_and_go` | Momentum | Long | Institutional gap-up that holds gains |
| 5 | `mean_reversion` | Reversal | Long | Oversold bounce from extreme levels |
| 6 | `double_bottom` | Reversal | Long | Liquidity trap - sweeps low then reverses |
| 7 | `parabolic_top` | Reversal | Short | Blow-off top with rejection candle |

---

## 3. Reliability Score: The Composite Ranking Metric

To compare setups objectively, we use a **Reliability Score** (0-100) that combines multiple performance dimensions:

```
Reliability Score = Win Rate Component (30%)
                  + Profit Factor Component (30%)
                  + Sharpe Ratio Component (25%)
                  + Sample Size Component (15%)
```

**Component Calculations:**

| Component | Formula | Max Points | Target |
|-----------|---------|------------|--------|
| Win Rate | `min(30, (win_rate / 0.70) * 30)` | 30 | 70% |
| Profit Factor | `min(30, (profit_factor / 2.5) * 30)` | 30 | 2.5 |
| Sharpe Ratio | `min(25, (sharpe / 2.0) * 25)` | 25 | 2.0 |
| Sample Size | `min(15, (trade_count / 100) * 15)` | 15 | 100 trades |

**Interpretation:**
- **80-100:** Excellent - High confidence, prioritize in production
- **60-79:** Good - Reliable, include in rotation
- **40-59:** Marginal - Needs parameter tuning or filtering
- **0-39:** Poor - Do not use without significant changes

---

## 4. Parameter Optimization Process

For each setup, the system performs a grid search over predefined parameter ranges:

### Example: `standard_breakout` Parameter Grid

| Parameter | Values Tested | Impact |
|-----------|---------------|--------|
| `rvol_thresh` | [2.0, 2.5, 3.0, 4.0, 5.0] | Volume confirmation strength |
| `rsi_thresh` | [55, 60, 65, 70] | Momentum confirmation |
| `stop_loss_atr_mult` | [1.0, 1.5, 2.0] | Risk per trade |

**Total Combinations:** 5 × 4 × 3 = **60 backtests per setup**

The optimizer runs all combinations and selects the parameters that maximize the Reliability Score.

---

## 5. Database Schema

### 5.1 Core Tables

**`backtest_runs`** - Metadata for each backtest execution
```sql
CREATE TABLE backtest_runs (
    run_id UUID PRIMARY KEY,
    setup_name TEXT NOT NULL,
    asset_universe TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    parameters JSONB NOT NULL,
    run_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`backtest_trades`** - Individual trade records
```sql
CREATE TABLE backtest_trades (
    trade_id UUID PRIMARY KEY,
    run_id UUID REFERENCES backtest_runs(run_id),
    asset_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_date DATE,
    exit_price NUMERIC,
    exit_reason TEXT, -- 'stop_loss', 'take_profit', 'time_exit'
    return_pct NUMERIC,
    holding_period INTEGER,
    is_winner BOOLEAN GENERATED ALWAYS AS (return_pct > 0) STORED
);
```

**`backtest_summary_metrics`** - Comprehensive performance metrics
```sql
CREATE TABLE backtest_summary_metrics (
    run_id UUID PRIMARY KEY REFERENCES backtest_runs(run_id),
    total_trades INTEGER,
    win_rate NUMERIC,
    profit_factor NUMERIC,
    sharpe_ratio NUMERIC,
    sortino_ratio NUMERIC,
    max_drawdown NUMERIC,
    avg_return_pct NUMERIC,
    reliability_score NUMERIC
);
```

### 5.2 Ranking Tables

**`setup_optimal_params`** - Best parameters found for each setup
```sql
CREATE TABLE setup_optimal_params (
    id UUID PRIMARY KEY,
    setup_name TEXT NOT NULL,
    asset_universe TEXT NOT NULL,
    optimal_params JSONB NOT NULL,
    win_rate NUMERIC,
    profit_factor NUMERIC,
    sharpe_ratio NUMERIC,
    reliability_score NUMERIC,
    is_current BOOLEAN DEFAULT TRUE,
    UNIQUE(setup_name, asset_universe, is_current)
);
```

**`setup_performance_rankings`** - Cross-setup comparison
```sql
CREATE TABLE setup_performance_rankings (
    id UUID PRIMARY KEY,
    ranking_date DATE DEFAULT CURRENT_DATE,
    asset_universe TEXT NOT NULL,
    rankings JSONB NOT NULL, -- Array of ranked setups
    best_setup TEXT,
    best_reliability_score NUMERIC,
    UNIQUE(ranking_date, asset_universe)
);
```

---

## 6. Scripts and Usage

### 6.1 Run Full Analysis

```bash
# Run comprehensive backtest across all setups with parameter optimization
python scripts/backtest_all_setups.py \
    --universe crypto_top_100 \
    --start 2022-01-01 \
    --end 2025-12-31 \
    --output /home/ubuntu/stratos_brain/data/backtest_results.json
```

**Output:**
- Optimal parameters for each setup
- Performance metrics for each setup
- Cross-setup rankings
- Recommendations

### 6.2 Analyze Results

```bash
# Generate visualizations and reports
python scripts/analyze_backtest_results.py --universe crypto_top_100
```

**Output:**
- Setup comparison bar charts
- Return distribution histograms
- Parameter sensitivity heatmaps
- Markdown report with recommendations

---

## 7. Expected Output: Setup Rankings

After running the full analysis, the system produces a ranking table like this:

| Rank | Setup | Category | Reliability | Win Rate | Profit Factor | Sharpe | Trades |
|------|-------|----------|-------------|----------|---------------|--------|--------|
| 1 | `vcp_squeeze` | Trend Continuation | 78.5 | 68.2% | 2.34 | 1.85 | 156 |
| 2 | `pullback_ma50` | Trend Continuation | 72.1 | 64.5% | 2.12 | 1.62 | 243 |
| 3 | `standard_breakout` | Momentum | 65.8 | 58.3% | 1.95 | 1.41 | 312 |
| 4 | `gap_and_go` | Momentum | 61.2 | 55.1% | 1.78 | 1.28 | 89 |
| 5 | `mean_reversion` | Reversal | 54.6 | 52.4% | 1.52 | 1.05 | 178 |
| 6 | `double_bottom` | Reversal | 48.3 | 49.8% | 1.35 | 0.82 | 67 |
| 7 | `parabolic_top` | Reversal | 42.1 | 47.2% | 1.21 | 0.65 | 45 |

*(Note: These are illustrative values. Actual results will vary based on historical data.)*

---

## 8. Integration with AI Scoring System

Once the backtesting system identifies the best setups, the results are used to:

1. **Filter AI Inputs:** Only pass assets to the AI that match a high-reliability setup.
2. **Provide Context:** Tell the AI which setup was identified (e.g., "This is a VCP Squeeze").
3. **Calibrate Expectations:** Include historical win rate in the AI prompt for grounding.

**Example AI Prompt (Post-Backtesting):**

```
The quantitative engine has identified this chart as a **VCP Squeeze** setup.

Historical Performance:
- Win Rate: 68.2%
- Avg Return: +12.4%
- Typical Holding Period: 15 days

Your task: Grade the QUALITY of this VCP Squeeze from 0-100.
Focus on:
1. How tight is the volatility contraction?
2. Is volume truly drying up?
3. Is the broader trend healthy?
```

---

## 9. Implementation Files

| File | Purpose |
|------|---------|
| `scripts/backtest_all_setups.py` | Main backtesting script with optimization and ranking |
| `scripts/analyze_backtest_results.py` | Visualization and reporting tools |
| `config/backtest_setups.yaml` | YAML definitions for the 7 Master Setups |
| `supabase/migrations/20260125_enhanced_backtesting_schema.sql` | Database schema |

---

## 10. Next Steps

1. **Apply Migration:** Run the SQL migration to create backtesting tables in Supabase.
2. **Execute Full Backtest:** Run `backtest_all_setups.py` for crypto and equity universes.
3. **Review Rankings:** Analyze which setups perform best for each asset class.
4. **Update AI Prompts:** Modify `prompts/ai_score_system.txt` to use setup-specific grading.
5. **Iterate:** Re-run backtests periodically as new data accumulates.

---

## Conclusion

This backtesting system provides the quantitative foundation for the Stratos Brain AI scoring system. By identifying optimal parameters and ranking setups by reliability, we can confidently deploy the "Classify First, Grade Second" approach, knowing that each setup has been rigorously validated with historical data.

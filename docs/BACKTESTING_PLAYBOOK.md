# Backtesting Playbook: Order of Operations

**Version:** 1.0  
**Last Updated:** January 25, 2026

---

## Overview

This playbook provides the exact order of operations for running the Stratos Brain backtesting system. Follow these steps sequentially to identify the best trading setups and their optimal parameters.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKTESTING WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   PHASE 1: SETUP                                                             │
│   ├── 1.1 Apply database migrations                                          │
│   └── 1.2 Verify data availability                                           │
│                     │                                                        │
│                     ▼                                                        │
│   PHASE 2: BASELINE TESTING                                                  │
│   ├── 2.1 Run each setup with default parameters                             │
│   ├── 2.2 Review audit reports                                               │
│   └── 2.3 Identify promising setups                                          │
│                     │                                                        │
│                     ▼                                                        │
│   PHASE 3: PARAMETER OPTIMIZATION                                            │
│   ├── 3.1 Run grid search on promising setups                                │
│   ├── 3.2 Analyze parameter sensitivity                                      │
│   └── 3.3 Select optimal parameters                                          │
│                     │                                                        │
│                     ▼                                                        │
│   PHASE 4: CROSS-SETUP RANKING                                               │
│   ├── 4.1 Run all setups with optimal parameters                             │
│   ├── 4.2 Calculate reliability scores                                       │
│   └── 4.3 Generate final rankings                                            │
│                     │                                                        │
│                     ▼                                                        │
│   PHASE 5: VALIDATION & DEPLOYMENT                                           │
│   ├── 5.1 Out-of-sample testing                                              │
│   ├── 5.2 Update AI scoring prompts                                          │
│   └── 5.3 Document findings                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Setup (One-Time)

### Step 1.1: Apply Database Migrations

Before running any backtests, ensure the database tables exist.

```bash
# Navigate to the project
cd /home/ubuntu/stratos_brain

# Apply the backtesting schema migration
# Option A: Via Supabase CLI
supabase db push

# Option B: Via direct SQL execution
psql $DATABASE_URL -f supabase/migrations/20260125_enhanced_backtesting_schema.sql
```

**Expected Tables:**
- `backtest_runs`
- `backtest_trades`
- `backtest_summary_metrics`
- `setup_optimal_params`
- `setup_performance_rankings`

### Step 1.2: Verify Data Availability

Confirm you have sufficient historical data for backtesting.

```sql
-- Check data range for crypto
SELECT 
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    COUNT(DISTINCT asset_id) as num_assets
FROM daily_features
WHERE asset_id IN (SELECT asset_id FROM assets WHERE asset_type = 'crypto');

-- Check data range for equities
SELECT 
    MIN(date) as earliest_date,
    MAX(date) as latest_date,
    COUNT(DISTINCT asset_id) as num_assets
FROM daily_features
WHERE asset_id IN (SELECT asset_id FROM assets WHERE asset_type = 'equity');
```

**Minimum Requirements:**
- At least 2 years of data (for statistical significance)
- At least 50 assets per universe
- All required features populated (RSI, SMA, ATR, etc.)

---

## Phase 2: Baseline Testing

### Step 2.1: Run Each Setup with Default Parameters

Test each of the 7 Master Setups with their default parameters to establish baselines.

```bash
# Run baseline tests for each setup
for setup in pullback_ma50 vcp_squeeze standard_breakout gap_and_go mean_reversion double_bottom parabolic_top; do
    echo "Testing $setup..."
    python scripts/auditable_backtester.py \
        --setup $setup \
        --universe crypto_top_100 \
        --start 2022-01-01 \
        --end 2024-12-31 \
        --output ./data/baseline/${setup}_baseline
done
```

**Or run individually for more control:**

```bash
# Example: Test standard_breakout
python scripts/auditable_backtester.py \
    --setup standard_breakout \
    --universe crypto_top_100 \
    --start 2022-01-01 \
    --end 2024-12-31 \
    --output ./data/baseline/standard_breakout_baseline
```

### Step 2.2: Review Audit Reports

For each setup, review the generated reports:

```bash
# View the Markdown report
cat ./data/baseline/standard_breakout_baseline.md

# Or open in browser for better formatting
# The .md file renders nicely in GitHub or any Markdown viewer
```

**Key Metrics to Evaluate:**

| Metric | Minimum Threshold | Ideal |
|--------|-------------------|-------|
| Total Trades | 30+ | 100+ |
| Win Rate | 45%+ | 55%+ |
| Profit Factor | 1.2+ | 1.8+ |
| Avg Return | 0%+ | 2%+ |

### Step 2.3: Identify Promising Setups

Create a summary table of baseline results:

| Setup | Trades | Win Rate | Profit Factor | Promising? |
|-------|--------|----------|---------------|------------|
| pullback_ma50 | ? | ?% | ? | ? |
| vcp_squeeze | ? | ?% | ? | ? |
| standard_breakout | ? | ?% | ? | ? |
| gap_and_go | ? | ?% | ? | ? |
| mean_reversion | ? | ?% | ? | ? |
| double_bottom | ? | ?% | ? | ? |
| parabolic_top | ? | ?% | ? | ? |

**Decision Rule:** Proceed to optimization for setups with:
- Profit Factor > 1.0 (at least breakeven)
- Total Trades > 30 (statistically meaningful)

---

## Phase 3: Parameter Optimization

### Step 3.1: Run Grid Search on Promising Setups

For each promising setup, run parameter optimization:

```bash
# Optimize standard_breakout parameters
python scripts/optimize_setup.py \
    --setup standard_breakout \
    --universe crypto_top_100 \
    --start 2022-01-01 \
    --end 2024-12-31 \
    --output ./data/optimization/standard_breakout_optimization.json
```

**Parameter Grids (defined in config/backtest_setups.yaml):**

| Setup | Parameters Tested | Total Combinations |
|-------|-------------------|-------------------|
| pullback_ma50 | rsi_threshold, stop_loss_atr_mult, take_profit_r_mult | 36 |
| vcp_squeeze | bb_width_pctile_thresh, rvol_thresh, stop_loss_atr_mult | 36 |
| standard_breakout | rvol_thresh, rsi_thresh, stop_loss_atr_mult | 60 |
| gap_and_go | gap_pct_thresh, rvol_thresh, candle_close_pct_thresh | 36 |
| mean_reversion | ma_dist_thresh, rsi_thresh, rvol_thresh | 48 |
| double_bottom | stop_loss_atr_mult, take_profit_r_mult | 12 |
| parabolic_top | ma_dist_thresh, rvol_thresh, candle_close_pct_thresh | 36 |

### Step 3.2: Analyze Parameter Sensitivity

Review the optimization results to understand which parameters matter most:

```bash
# Generate sensitivity analysis
python scripts/analyze_backtest_results.py \
    --input ./data/optimization/standard_breakout_optimization.json \
    --output ./data/analysis/standard_breakout_sensitivity
```

**Questions to Answer:**
1. Which parameter has the biggest impact on win rate?
2. Are there parameter combinations that fail completely?
3. Is there a "sweet spot" or is performance linear?

### Step 3.3: Select Optimal Parameters

From the optimization results, select the parameters that maximize the **Reliability Score**:

```
Reliability Score = Win Rate (30%) + Profit Factor (30%) + Sharpe (25%) + Sample Size (15%)
```

**Record the optimal parameters:**

| Setup | Optimal Parameters | Reliability Score |
|-------|-------------------|-------------------|
| standard_breakout | rvol=3.0, rsi=60, sl=1.5 | 72.5 |
| vcp_squeeze | bb_width=0.10, rvol=0.7, sl=2.0 | 68.3 |
| ... | ... | ... |

---

## Phase 4: Cross-Setup Ranking

### Step 4.1: Run All Setups with Optimal Parameters

Now run the comprehensive comparison with optimized parameters:

```bash
python scripts/backtest_all_setups.py \
    --universe crypto_top_100 \
    --start 2022-01-01 \
    --end 2024-12-31 \
    --use-optimal-params \
    --output ./data/final/cross_setup_comparison.json
```

### Step 4.2: Calculate Reliability Scores

The script automatically calculates reliability scores. Review the output:

```bash
cat ./data/final/cross_setup_comparison.json | jq '.rankings'
```

### Step 4.3: Generate Final Rankings

**Expected Output:**

| Rank | Setup | Category | Reliability | Win Rate | Profit Factor | Sharpe | Trades |
|------|-------|----------|-------------|----------|---------------|--------|--------|
| 1 | vcp_squeeze | Trend Continuation | 78.5 | 68.2% | 2.34 | 1.85 | 156 |
| 2 | pullback_ma50 | Trend Continuation | 72.1 | 64.5% | 2.12 | 1.62 | 243 |
| 3 | standard_breakout | Momentum | 65.8 | 58.3% | 1.95 | 1.41 | 312 |
| 4 | gap_and_go | Momentum | 61.2 | 55.1% | 1.78 | 1.28 | 89 |
| 5 | mean_reversion | Reversal | 54.6 | 52.4% | 1.52 | 1.05 | 178 |
| 6 | double_bottom | Reversal | 48.3 | 49.8% | 1.35 | 0.82 | 67 |
| 7 | parabolic_top | Reversal | 42.1 | 47.2% | 1.21 | 0.65 | 45 |

---

## Phase 5: Validation & Deployment

### Step 5.1: Out-of-Sample Testing

**Critical:** Test on data the optimizer never saw.

```bash
# If you optimized on 2022-2024, test on 2025
python scripts/auditable_backtester.py \
    --setup vcp_squeeze \
    --params '{"bb_width_pctile_thresh": 0.10, "rvol_thresh": 0.7, "stop_loss_atr_mult": 2.0}' \
    --universe crypto_top_100 \
    --start 2025-01-01 \
    --end 2025-12-31 \
    --output ./data/validation/vcp_squeeze_oos
```

**Validation Criteria:**
- Out-of-sample win rate within 10% of in-sample
- Profit factor > 1.0
- No catastrophic drawdowns

### Step 5.2: Update AI Scoring Prompts

Once you've validated the best setups, update the AI prompts to use setup-specific grading:

```bash
# Edit the AI scoring prompt
vim prompts/ai_score_system.txt
```

**New Prompt Structure:**

```
The quantitative engine has identified this chart as a **{SETUP_NAME}** setup.

Historical Performance (from backtesting):
- Win Rate: {WIN_RATE}%
- Avg Return: {AVG_RETURN}%
- Typical Holding Period: {HOLD_DAYS} days

Your task: Grade the QUALITY of this {SETUP_NAME} from 0-100.

Focus on setup-specific criteria:
{SETUP_SPECIFIC_CRITERIA}
```

### Step 5.3: Document Findings

Create a summary document with:
1. Final setup rankings
2. Optimal parameters for each setup
3. Out-of-sample validation results
4. Recommendations for production use

---

## Quick Reference: Command Cheatsheet

```bash
# Phase 2: Baseline testing
python scripts/auditable_backtester.py --setup {SETUP} --universe {UNIVERSE} --output ./data/baseline/{SETUP}

# Phase 3: Parameter optimization
python scripts/optimize_setup.py --setup {SETUP} --universe {UNIVERSE} --output ./data/optimization/{SETUP}

# Phase 4: Cross-setup comparison
python scripts/backtest_all_setups.py --universe {UNIVERSE} --output ./data/final/comparison

# Phase 5: Out-of-sample validation
python scripts/auditable_backtester.py --setup {SETUP} --params '{JSON}' --start {OOS_START} --end {OOS_END}
```

---

## Appendix: Troubleshooting

### Issue: "No trades generated"

**Causes:**
1. Entry conditions too strict
2. Insufficient data for the date range
3. Features not calculated (NULL values)

**Solution:**
```sql
-- Check for NULL features
SELECT COUNT(*) as total, COUNT(rsi_14) as has_rsi, COUNT(sma_50) as has_sma
FROM daily_features
WHERE date BETWEEN '2022-01-01' AND '2024-12-31';
```

### Issue: "Win rate too low"

**Causes:**
1. Stop loss too tight
2. Take profit too aggressive
3. Wrong market regime

**Solution:**
- Increase `stop_loss_atr_mult` (e.g., 1.5 → 2.0)
- Decrease `take_profit_r_mult` (e.g., 3.0 → 2.0)
- Test on different date ranges

### Issue: "Results not reproducible"

**Causes:**
1. Data changed between runs
2. Random seed not set (shouldn't happen with this system)

**Solution:**
- Verify the `run_id` matches
- Check that input data hasn't been updated

---

## Next Steps After Completing This Playbook

1. **Schedule Regular Re-Optimization:** Run monthly to adapt to market changes
2. **Add New Setups:** Define new setups in `config/backtest_setups.yaml`
3. **Build Dashboard:** Visualize backtest results in the Stratos dashboard
4. **Paper Trade:** Test top setups in real-time before live trading

---

*Playbook created for Stratos Brain Backtesting System v1.0*

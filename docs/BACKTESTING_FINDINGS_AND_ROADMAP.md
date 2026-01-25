# Stratos Brain: Backtesting Findings & Roadmap

**Date:** January 25, 2026  
**Status:** In Progress  
**Universe:** 96 Blue-Chip Equities (2020-2025)

---

## Executive Summary

We built and tested a backtesting system to identify the best trading setups for the Stratos Brain platform. Through multiple iterations, we discovered that **exit strategies must match entry logic** and that **different setups naturally fit different timeframes**.

### Key Discovery

> **One-size-fits-all exit strategies don't work.** A mean reversion trade needs different exits than a trend-following trade. Forcing all setups into the same exit framework destroys performance.

---

## Part 1: What We Tested

### Initial Approach (V1)
We started with a universal exit strategy for all setups:
- 50% profit target
- Trailing stop (15% initial, tightening as gains grow)
- 200 SMA breakdown exit
- 12-month max hold

**Problem:** This approach generated results that looked good on paper but didn't match how each setup should actually be traded.

### Setup-Specific Exits (V2)
We then implemented custom exit logic for each setup category:
- **Trend Pullbacks:** Stop below the MA we bought at
- **Mean Reversion:** Exit when price returns to the mean (MA)
- **Breakouts:** Fast failure exit if breakout doesn't follow through

**Problem:** Exits were triggering too quickly, resulting in 7-11 day average holds instead of the medium-term positions we wanted.

### Wider Stops for Medium-Term (V3)
We widened the stops to allow positions room to breathe:
- Used 200 SMA as stop instead of 50 SMA for trend pullbacks
- Removed "no new high" exits that forced quick exits
- Increased trailing stop activation thresholds

**Result:** Average holds increased to 30-100+ days, but win rates dropped because wider stops mean more volatility tolerance.

---

## Part 2: Key Findings

### Finding 1: Setups Naturally Fit Different Timeframes

| Setup Type | Natural Timeframe | Why |
|------------|-------------------|-----|
| Mean Reversion (oversold bounce) | **Short-term (1-4 weeks)** | Bounces happen fast or not at all |
| Gap Plays | **Short-term (1-2 weeks)** | Gaps fill or follow through quickly |
| Breakout Momentum | **Short-term (2-4 weeks)** | Breakouts explode or fail immediately |
| Trend Pullbacks | **Medium-term (1-6 months)** | Trends take time to develop |
| Accumulation Breakouts | **Medium-term (2-6 months)** | Institutional buying is gradual |
| Relative Strength | **Medium-term (3-12 months)** | Outperformance compounds over time |

**Implication:** We should NOT force short-term setups into long holds, or vice versa.

---

### Finding 2: Best Performing Setups by Timeframe

#### Short-Term Results (Original V2 - Tight Exits)

| Rank | Setup | Trades | Win Rate | Profit Factor | Avg Return | Avg Hold |
|------|-------|--------|----------|---------------|------------|----------|
| 1 | gap_up_hold | 485 | 60.0% | 38.90 | +27.48% | 7 days |
| 2 | volatility_contraction_breakout | 1,131 | 49.0% | 24.35 | +18.17% | 8 days |
| 3 | oversold_quality | 213 | 81.2% | 5.34 | +5.46% | 8 days |

**Observation:** These setups work exceptionally well with tight exits because they're designed for quick moves.

#### Medium-Term Results (V3 - Wide Exits)

| Rank | Setup | Trades | Win Rate | Profit Factor | Avg Return | Avg Hold |
|------|-------|--------|----------|---------------|------------|----------|
| 1 | trend_pullback_50ma | 218 | 34.9% | 2.65 | +9.74% | 106 days |
| 2 | oversold_quality | 168 | 61.9% | 2.88 | +6.42% | 34 days |
| 3 | holy_grail_20ema | 487 | 35.1% | 1.69 | +2.11% | 41 days |

**Observation:** Trend pullbacks shine with wider stops because they need room to work.

---

### Finding 3: Exit Strategy Must Match Entry Thesis

| Entry Thesis | Correct Exit Logic | Wrong Exit Logic |
|--------------|-------------------|------------------|
| "Price is oversold, will bounce to mean" | Exit when price touches the mean (20 MA) | Wait for 50% gain (won't happen) |
| "Buying pullback in uptrend" | Exit if trend breaks (close below MA) | Exit on first dip (too tight) |
| "Breakout from consolidation" | Exit if breakout fails (no follow-through) | Wait 6 months (dead money) |
| "Gap up with volume" | Exit if gap fills or no continuation | Use 200 MA stop (too loose) |

---

### Finding 4: The Trade-Off Between Win Rate and Hold Time

| Configuration | Win Rate | Avg Hold | Trade-Off |
|---------------|----------|----------|-----------|
| Tight stops (V2) | 50-80% | 7-17 days | High win rate, quick exits, smaller gains |
| Wide stops (V3) | 30-40% | 30-100+ days | Lower win rate, longer holds, larger gains per winner |

**Neither is "better"** - they serve different purposes:
- **Tight stops:** Good for active traders who want high win rates and quick turnover
- **Wide stops:** Good for position traders who want to capture larger moves

---

## Part 3: Current State of the Codebase

### Files Created

| File | Purpose | Status |
|------|---------|--------|
| `scripts/position_backtester.py` | V1 backtester with universal exits | ✅ Complete |
| `scripts/position_backtester_v2.py` | V2 backtester with setup-specific exits | ✅ Complete |
| `scripts/quality_backtester.py` | V3 backtester with medium-term focus | ✅ Complete |
| `scripts/run_all_position_tests.py` | Batch runner for all setups | ✅ Complete |
| `scripts/optimize_exits_v2.py` | Parameter optimization | ✅ Complete |
| `config/backtest_setups.yaml` | Setup definitions | ✅ Complete |
| `data/quality_backtest_results.json` | Latest results | ✅ Complete |

### Setups Implemented

**Trend Continuation:**
- `trend_pullback_50ma` - Pullback to 50 MA in uptrend
- `trend_pullback_200ma` - Pullback to 200 MA in uptrend
- `holy_grail_20ema` - Pullback to rising 20 EMA

**Mean Reversion:**
- `oversold_quality` - RSI oversold + extended below 20 MA
- `deep_oversold_bounce` - Extreme oversold conditions
- `drawdown_recovery` - Recovery from significant drawdown

**Breakout/Momentum:**
- `gap_up_hold` - Gap up with volume that holds
- `breakout_consolidation` - Breakout from tight range
- `squeeze_release` - Bollinger Band squeeze release
- `volatility_contraction_breakout` - VCP pattern

**Acceleration:**
- `acceleration_turn_up` - Momentum acceleration turning positive
- `macd_bullish_cross` - MACD histogram turning positive
- `relative_strength_breakout` - Relative strength breakout

---

## Part 4: The Plan Forward

### Proposed Architecture: Dual-Timeframe System

We will build two separate "lenses" for analyzing setups:

```
┌─────────────────────────────────────────────────────────────┐
│                    STRATOS BRAIN                            │
│                  Backtesting System                         │
├─────────────────────────┬───────────────────────────────────┤
│   SHORT-TERM LENS       │      MEDIUM-TERM LENS             │
│   (1-4 weeks)           │      (1-6 months)                 │
├─────────────────────────┼───────────────────────────────────┤
│ • Mean Reversion        │ • Trend Pullbacks                 │
│ • Gap Plays             │ • Accumulation Breakouts          │
│ • Breakout Momentum     │ • Relative Strength               │
├─────────────────────────┼───────────────────────────────────┤
│ Exit Strategy:          │ Exit Strategy:                    │
│ • Tight ATR stops       │ • Wide MA-based stops             │
│ • Touch MA targets      │ • Trailing stops (30%+ activation)│
│ • Time stops (5-15 days)│ • 50% profit targets              │
│ • Fast failure exits    │ • 200 MA breakdown                │
├─────────────────────────┼───────────────────────────────────┤
│ Expected Results:       │ Expected Results:                 │
│ • 50-80% win rate       │ • 30-50% win rate                 │
│ • 5-20% avg return      │ • 10-30% avg return               │
│ • 7-20 day avg hold     │ • 30-120 day avg hold             │
└─────────────────────────┴───────────────────────────────────┘
```

### Implementation Steps

#### Phase 1: Restructure the Backtester
1. Create `short_term_backtester.py` with setups optimized for 1-4 week holds
2. Create `medium_term_backtester.py` with setups optimized for 1-6 month holds
3. Each backtester has its own exit strategy configurations

#### Phase 2: Optimize Each Timeframe Independently
1. Run parameter optimization for short-term setups (tight stops, quick exits)
2. Run parameter optimization for medium-term setups (wide stops, patient holds)
3. Identify the top 3-5 setups for each timeframe

#### Phase 3: Validate with Out-of-Sample Testing
1. Use 2020-2023 as training data
2. Use 2024-2025 as validation data
3. Ensure results hold up on unseen data

#### Phase 4: Integrate with Stratos Brain
1. Update the AI scoring system to use the validated setups
2. Create setup-specific grading rubrics
3. Tag signals with their appropriate timeframe lens

### Success Criteria

| Metric | Short-Term Target | Medium-Term Target |
|--------|-------------------|-------------------|
| Win Rate | > 55% | > 40% |
| Profit Factor | > 2.0 | > 2.0 |
| Avg Return | > 5% | > 8% |
| Avg Hold | 7-21 days | 30-120 days |
| Min Trades (6 years) | > 100 | > 100 |

---

## Part 5: Open Questions

1. **Should we weight setups by reliability?** Some setups have higher win rates but lower returns. How do we rank them?

2. **How do we handle market regimes?** These results span 2020-2025 which includes a crash, bull market, and bear market. Should we segment by regime?

3. **Should we add filters?** For example, only take trend pullbacks when the broader market is above its 200 MA?

4. **How do we integrate with the AI scoring?** Once we validate the setups, how do we update the Gemini prompts to grade them appropriately?

---

## Appendix: Raw Data

### Short-Term Results (V2 - Tight Exits)

```
Setup                              Trades   Win Rate       PF    Avg Ret   Avg Hold
gap_up_hold                           485      60.0%    38.90    +27.48%         7d
volatility_contraction_breakout      1131      49.0%    24.35    +18.17%         8d
oversold_quality                      213      81.2%     5.34     +5.46%         8d
holy_grail_20ema                      914      30.0%     1.52     +0.97%        17d
acceleration_turn_up                 1431      33.0%     1.36     +0.63%        14d
trend_pullback_50ma                  1807      37.9%     1.28     +0.36%        11d
```

### Medium-Term Results (V3 - Wide Exits)

```
Setup                              Trades   Win Rate       PF    Avg Ret   Avg Hold
trend_pullback_50ma                   218      34.9%     2.65     +9.74%       106d
oversold_quality                      168      61.9%     2.88     +6.42%        34d
holy_grail_20ema                      487      35.1%     1.69     +2.11%        41d
acceleration_turn_up                  715      30.5%     1.68     +1.82%        33d
gap_up_hold                           418      43.8%     1.39     +0.85%        20d
```

---

*Document generated by Stratos Brain Backtesting System*

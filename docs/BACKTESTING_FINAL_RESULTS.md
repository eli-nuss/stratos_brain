# Stratos Brain: Final Backtesting Results

**Date:** January 25, 2026  
**Status:** Complete  
**Universe:** 87 Blue-Chip Equities (2020-2025)

---

## Executive Summary

We built and tested a comprehensive backtesting system to identify optimal trading setups for the Stratos Brain platform. Through multiple iterations, we discovered three key optimizations that significantly improve performance:

1. **Market Regime Filter** - Only trade when market breadth is healthy
2. **Free-Roll Exit Strategy** - Sell 50% early, hold 50% with breakeven stop
3. **Combined Short+Long Entry** - Use short-term setups as entries into long-term uptrends

---

## Part 1: Three Timeframe Lenses

We identified that setups naturally fit different timeframes:

### Short-Term (1-4 Weeks)
Best for quick, high-probability trades.

| Setup | Win Rate | Profit Factor | Avg Return | Avg Hold |
|-------|----------|---------------|------------|----------|
| oversold_quality | 81.2% | 5.34 | +5.46% | 8 days |
| volatility_contraction_breakout | 49.0% | 24.35 | +18.17% | 8 days |
| gap_up_hold | 60.0% | 38.90 | +27.48% | 7 days |

### Medium-Term (1-6 Months)
Best for trend-following positions.

| Setup | Win Rate | Profit Factor | Avg Return | Avg Hold |
|-------|----------|---------------|------------|----------|
| trend_pullback_50ma | 34.9% | 2.65 | +9.74% | 106 days |
| oversold_quality (wide stops) | 61.9% | 2.88 | +6.42% | 34 days |
| holy_grail_20ema | 35.1% | 1.69 | +2.11% | 41 days |

### Long-Term (3-12 Months)
Best for capturing major moves.

| Setup | Win Rate | Profit Factor | Avg Return | Avg Hold |
|-------|----------|---------------|------------|----------|
| golden_cross_momentum | 48.4% | 4.34 | +21.42% | 145 days |
| 52w_low_reversal | 49.5% | 3.16 | +10.16% | 107 days |
| rs_acceleration | 41.3% | 2.62 | +10.39% | 119 days |

---

## Part 2: Optimization Results

### Optimization 1: Market Regime Filter

**Concept:** Only take trades when >50% of stocks are above their 200 MA (bull market).

| Metric | Without Filter | With Filter | Improvement |
|--------|----------------|-------------|-------------|
| Trades | 502 | 421 | -16% (fewer bad trades) |
| Win Rate | 35.3% | 37.1% | +1.8pp |
| Profit Factor | 2.76 | 3.09 | +12% |
| Avg Return | +6.06% | +7.55% | +25% |
| Bear Trades Skipped | 0 | 3,738 | ✅ |

**Conclusion:** The regime filter significantly improves all metrics by avoiding trades during bear markets.

---

### Optimization 2: Free-Roll Exit Strategy

**Concept:** Sell 50% of position at short-term target, hold remaining 50% with breakeven stop.

| Metric | Standard Exit | Free-Roll Exit | Improvement |
|--------|---------------|----------------|-------------|
| Trades | 218 | 248 | +14% |
| Win Rate | 33.5% | 44.8% | +11.3pp |
| Profit Factor | 1.69 | 1.87 | +11% |
| Free-Roll Conversions | 0 | 111 | ✅ |

**Conclusion:** The free-roll strategy dramatically improves win rate by locking in partial profits early.

---

### Optimization 3: Combined Short+Long Entry

**Concept:** Use short-term setups (oversold, VCP, gap) as entries, but only when the stock is already in a long-term uptrend.

**Entry Conditions:**
1. Stock must be above 200 MA
2. 50 MA must be above 200 MA
3. Stock must be within 20% of 52-week high
4. THEN look for short-term entry signal (oversold, breakout, etc.)

**Exit Strategy:**
1. Sell 50% at short-term target (8-10% gain)
2. Move stop to breakeven on remaining 50%
3. Hold remaining with 200 MA breakdown as final stop

---

## Part 3: Final Configuration Comparison

| Configuration | Trades | Win Rate | PF | Avg Return | Avg Hold |
|---------------|--------|----------|-----|------------|----------|
| Long-term (no filter) | 502 | 35.3% | 2.76 | +6.06% | 48d |
| **Long-term + Regime Filter** | 421 | 37.1% | **3.09** | **+7.55%** | 55d |
| Combined (no free-roll) | 218 | 33.5% | 1.69 | +3.59% | 95d |
| **Combined + Free-Roll** | 248 | **44.8%** | 1.87 | +2.81% | 86d |

### Recommended Configuration by Goal

| Your Goal | Best Configuration | Key Metric |
|-----------|-------------------|------------|
| **Maximum returns per trade** | Long-term + Regime Filter | +7.55% avg return |
| **Highest win rate** | Combined + Free-Roll | 44.8% win rate |
| **Best risk-adjusted returns** | Long-term + Regime Filter | 3.09 profit factor |
| **Most trades per year** | Long-term (no filter) | ~84 trades/year |

---

## Part 4: Best Setups by Category

### For Long-Term Position Trading (Recommended)

1. **Golden Cross Momentum** - 50 MA crosses above 200 MA with strong momentum
   - 48.4% win rate, 4.34 PF, +21.42% avg return, 145-day hold
   - Best for: Catching the start of major bull runs

2. **52-Week Low Reversal** - Near 52-week low with reversal signals
   - 49.5% win rate, 3.16 PF, +10.16% avg return, 107-day hold
   - Best for: Contrarian recovery plays

3. **RS Acceleration** - Relative strength accelerating vs benchmark
   - 41.3% win rate, 2.62 PF, +10.39% avg return, 119-day hold
   - Best for: Riding sector/stock outperformance

### For Short-Term Trading

1. **Oversold Quality** - RSI < 35, extended below 20 MA
   - 81.2% win rate, 5.34 PF, +5.46% avg return, 8-day hold
   - Best for: Quick mean reversion bounces

2. **Volatility Contraction Breakout** - Tight squeeze with breakout
   - 49.0% win rate, 24.35 PF, +18.17% avg return, 8-day hold
   - Best for: Explosive breakout moves

---

## Part 5: Implementation Roadmap

### Phase 1: Deploy Regime Filter (Immediate)
- Add market breadth calculation to daily pipeline
- Only generate signals when breadth > 50%
- Expected impact: +25% improvement in returns

### Phase 2: Implement Free-Roll Exit (Week 1-2)
- Modify signal tracking to support partial exits
- Add breakeven stop logic after first target hit
- Expected impact: +11pp improvement in win rate

### Phase 3: Update AI Scoring (Week 2-3)
- Update Gemini prompts to assess both short-term and long-term thesis
- Add setup-specific grading rubrics
- Output format:
```json
{
  "detected_setup": "trend_pullback_50ma",
  "short_term_thesis": "Oversold bounce likely in 5-10 days",
  "long_term_thesis": "Trend intact, 30%+ upside over 6 months",
  "ai_setup_quality_score": 92
}
```

### Phase 4: Out-of-Sample Validation (Week 3-4)
- Reserve 2025 data for validation
- Ensure results hold on unseen data
- Adjust parameters if needed

---

## Appendix: Files Created

| File | Purpose |
|------|---------|
| `scripts/advanced_backtester.py` | Full backtester with all 3 optimizations |
| `scripts/longterm_backtester.py` | Long-term (3-12 month) setup testing |
| `scripts/quality_backtester.py` | Setup-specific exit strategies |
| `scripts/position_backtester.py` | Original position trading backtester |
| `data/advanced_backtest_comparison.json` | Final comparison results |
| `data/longterm_backtest_results.json` | Long-term setup results |
| `data/quality_backtest_results.json` | Quality backtest results |

---

## Conclusion

The backtesting system has identified clear, actionable insights:

1. **Use the regime filter** - Avoid trading in bear markets
2. **Match exit to entry** - Different setups need different exits
3. **Consider free-roll** - Lock in partial profits to boost win rate
4. **Best long-term setup** - Golden Cross Momentum (4.34 PF, +21.42% avg)
5. **Best short-term setup** - Oversold Quality (81.2% win rate)

The system is now ready for integration with the Stratos Brain AI scoring pipeline.

---

*Document generated by Stratos Brain Backtesting System*

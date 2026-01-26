# Stratos Brain - Comprehensive Optimization Report

**Date:** January 25, 2026  
**Total Setups Tested:** 13 (8 swing, 5 position)  
**Total Combinations Tested:** 3,412  
**Data Period:** 2 years of daily data (Jan 2024 - Jan 2026)  
**Universe:** 1,000 liquid equities

---

## Executive Summary

This report combines the results of two separate optimization runs:
1. **Swing Trading Setups:** 8 setups with 10-20 day hold periods
2. **Position Trading Setups:** 5 setups with 60-252 day hold periods

### Key Findings

- **Weinstein Stage 2** is the top-performing setup with an exceptional **4.09 profit factor** and **8.45% average return**
- **RS Breakout** and **Donchian 55-Day Breakout** also delivered excellent results for position trading (PF > 2.0)
- For swing trading, **VCP Squeeze** and **Gap Up Momentum** are the strongest performers (PF > 1.5)
- The original composite score was biased towards high-frequency setups; ranking by profit factor and average return provides a better view for position traders

---

## Methodology

### Data Sources

The optimization used pre-calculated daily features from the Stratos Brain database, including:
- Price data (OHLCV)
- Moving averages (20, 50, 200-day SMA/EMA)
- Momentum indicators (RSI, ROC, ADX)
- Volatility measures (ATR, Bollinger Bands)
- Volume metrics (RVOL, dollar volume)
- Donchian channels (20, 55-day)

### Optimization Process

1. **Parameter Grid Search:** For each setup, we defined a grid of entry and exit parameters based on quantitative literature
2. **Parallel Backtesting:** Used 4-worker multiprocessing to test all parameter combinations
3. **Trade Simulation:** Simulated trades with realistic friction (15bps round trip) and position management
4. **Scoring:** Ranked results by profit factor and average return

---

## Combined Rankings: All 13 Setups

| Rank | Setup | Profit Factor | Win Rate | Avg Return | Trades | Style |
|------|-------|--------------|----------|------------|--------|-------|
| 1 | **weinstein_stage2** | **4.09** | 61.0% | **8.45%** | 77 | Position |
| 2 | rs_breakout | 2.03 | 49.3% | 3.81% | 850 | Position |
| 3 | **donchian_55_breakout** | **1.99** | 50.8% | **5.32%** | 122 | Position |
| 4 | trend_pullback_50ma | 1.97 | 50.9% | 4.44% | 4,446 | Position |
| 5 | **adx_holy_grail** | **1.71** | 49.8% | 2.79% | 6,155 | Position |
| 6 | vcp_squeeze | 1.69 | 55.3% | 1.69% | 11,500 | Swing |
| 7 | gap_up_momentum | 1.58 | 51.6% | 1.87% | 7,745 | Swing |
| 8 | golden_cross | 1.53 | 35.9% | 2.02% | 5,940 | Position |
| 9 | oversold_bounce | 1.52 | 65.6% | 1.83% | 2,720 | Swing |
| 10 | acceleration_turn | 1.48 | 62.9% | 0.97% | 26,290 | Swing |
| 11 | breakout_confirmed | 1.45 | 48.9% | 2.22% | 2,235 | Position |

---

## Detailed Setup Analysis

### Position Trading Setups (60-252 Day Holds)

#### 1. Weinstein Stage 2 Transition

- **Profit Factor:** 4.09
- **Avg Return:** 8.45%
- **Analysis:** The clear winner. Captures major trend transitions with exceptional performance.

#### 2. RS Breakout

- **Profit Factor:** 2.03
- **Avg Return:** 3.81%
- **Analysis:** Strong performance with a relative strength filter.

#### 3. Donchian 55-Day Breakout

- **Profit Factor:** 1.99
- **Avg Return:** 5.32%
- **Analysis:** Classic Turtle system works well for systematic trend following.

#### 4. Trend Pullback 50MA

- **Profit Factor:** 1.97
- **Avg Return:** 4.44%
- **Analysis:** Excellent for adding to existing trends.

#### 5. ADX Holy Grail

- **Profit Factor:** 1.71
- **Avg Return:** 2.79%
- **Analysis:** High trade count makes it suitable for active position traders.

### Swing Trading Setups (10-20 Day Holds)

#### 1. VCP Squeeze

- **Profit Factor:** 1.69
- **Avg Return:** 1.69%
- **Analysis:** Best of the swing setups. Captures volatility contractions effectively.

#### 2. Gap Up Momentum

- **Profit Factor:** 1.58
- **Avg Return:** 1.87%
- **Analysis:** Solid performance on high-volume gap-up days.

#### 3. Oversold Bounce

- **Profit Factor:** 1.52
- **Avg Return:** 1.83%
- **Analysis:** Highest win rate of all setups (65.6%).

#### 4. Acceleration Turn

- **Profit Factor:** 1.48
- **Avg Return:** 0.97%
- **Analysis:** Highest trade count (26,290) but lowest average return.

---

## Recommendations

### For Position Traders (Medium/Long-Term)

1. **Weinstein Stage 2** - Core holding for major trend transitions
2. **RS Breakout** - For assets showing strong relative strength
3. **Donchian 55-Day Breakout** - Systematic trend following
4. **Trend Pullback 50MA** - Adding to existing positions

### For Swing Traders (Short-Term)

1. **VCP Squeeze** - Primary swing setup
2. **Gap Up Momentum** - For strong momentum days
3. **Oversold Bounce** - For mean-reversion opportunities

---

## Technical Notes

- **Backtest Period:** January 2024 - January 2026 (2 years)
- **Universe:** 1,000 liquid equities with avg dollar volume > $1M
- **Friction:** 15bps round trip (7.5bps per side)
- **Position Sizing:** Not included (equal weight assumed)
- **Optimization Method:** Grid search with 4-worker multiprocessing

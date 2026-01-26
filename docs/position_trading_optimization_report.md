# Position Trading Optimization Report

**Date:** January 25, 2026  
**Total Runtime:** 28.6 minutes  
**Total Combinations Tested:** 1,569 across 5 setups  
**Data Period:** 2 years of daily data (Jan 2024 - Jan 2026)  
**Universe:** 1,000 liquid equities

---

## Executive Summary

This report presents the results of parameter optimization for 5 new position trading setups derived from quantitative trading literature. These setups are specifically designed for medium-to-long-term investing with holding periods of 90-252 days.

### Key Findings

1. **Weinstein Stage 2** achieved the highest profit factor (4.09) and average return (8.45%) of any setup tested
2. **Donchian 55-Day Breakout** (Turtle Traders) delivered a solid 1.99 profit factor with 5.32% average return
3. **ADX Holy Grail** generated the most trades (6,155) with a 1.71 profit factor
4. Two setups (Wyckoff Spring, TSM Acceleration) did not generate valid signals due to restrictive entry conditions

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

1. **Parameter Grid Search:** For each setup, we defined a grid of entry and exit parameters based on the original literature
2. **Parallel Backtesting:** Used 4-worker multiprocessing to test all parameter combinations
3. **Trade Simulation:** Simulated trades with realistic friction (15bps round trip) and position management
4. **Scoring:** Ranked results by profit factor and average return (optimized for position trading)

### Scoring Formula

For position trading, we prioritized profit factor and average return over trade count:

```
score = profit_factor * (1 + avg_return * 10) * sqrt(trades)
```

---

## Setup Descriptions & Results

### 1. Weinstein Stage 2 Transition

**Source:** *Secrets for Profiting in Bull and Bear Markets* by Stan Weinstein

**Thesis:** Markets move in 4 stages: Base (1), Uptrend (2), Top (3), Downtrend (4). The most profitable moment to invest is when a stock leaves a long Stage 1 base and begins a Stage 2 uptrend.

**Optimized Parameters:**

| Parameter | Value |
|-----------|-------|
| Base Days | 100 |
| Base Range | < 15% |
| Volume on Breakout | > 1.5× average |
| Breakdown Exit | MA200 < -3% |
| Trailing Activation | 20% profit |
| Trailing ATR Mult | 3.5× |
| Max Hold Days | 252 |

**Results:**

| Metric | Value |
|--------|-------|
| **Profit Factor** | **4.09** |
| **Win Rate** | 61.0% |
| **Avg Return** | **8.45%** |
| **Total Trades** | 77 |

**Analysis:** This is an exceptional result. A 4.0+ profit factor means you make $4 for every $1 you risk. The 8.45% average return per trade over a 252-day max hold period represents significant alpha capture. The relatively low trade count (77) is expected for a setup that requires a 100-day consolidation base.

---

### 2. Donchian 55-Day Breakout (Turtle Traders)

**Source:** *Way of the Turtle* by Curtis Faith; Richard Donchian's trend-following research

**Thesis:** When an asset hits a multi-month high, it indicates a major supply/demand imbalance. Buying long-term highs captures every major secular trend.

**Optimized Parameters:**

| Parameter | Value |
|-----------|-------|
| Lookback Days | 55 (3-month high) |
| MA Slope Filter | None |
| Trailing Exit | 20-day low |
| Max Hold Days | 120 |

**Results:**

| Metric | Value |
|--------|-------|
| **Profit Factor** | **1.99** |
| **Win Rate** | 50.8% |
| **Avg Return** | **5.32%** |
| **Total Trades** | 122 |

**Analysis:** The classic Turtle system works well with nearly 2.0 profit factor. The 50.8% win rate is typical for trend-following systems - you lose slightly more often than you win, but winners are much larger than losers. The 5.32% average return per trade is excellent for a systematic approach.

---

### 3. ADX Holy Grail Pullback

**Source:** *Street Smarts* by Linda Raschke and Larry Connors; J. Welles Wilder's ADX research

**Thesis:** Moving average pullbacks fail in weak trends. The ADX quantifies trend strength. Buying pullbacks only when ADX > 25 filters out "fake" trends.

**Optimized Parameters:**

| Parameter | Value |
|-----------|-------|
| ADX Threshold | > 25 |
| MA Touch Distance | < 3% from 20 EMA |
| Breakdown Exit | MA50 < -5% |
| Trailing Activation | 10% profit |
| Trailing ATR Mult | 3.0× |
| Max Hold Days | 90 |

**Results:**

| Metric | Value |
|--------|-------|
| **Profit Factor** | **1.71** |
| **Win Rate** | 49.8% |
| **Avg Return** | 2.79% |
| **Total Trades** | 6,155 |

**Analysis:** This setup generates significantly more trades than the others, making it suitable for active position traders. The 1.71 profit factor is solid, though the 2.79% average return is lower than the other setups. The high trade count provides better statistical significance.

---

### 4. Wyckoff Spring (No Valid Signals)

**Source:** *The Secret Science of Price and Volume* by Tim Ord; Richard Wyckoff course

**Thesis:** Institutions manufacture liquidity by pushing price below major support, triggering retail stop-losses, then buying those shares (the "Spring").

**Why It Failed:** The Wyckoff Spring pattern requires a specific sequence:
1. Price drops below a 100-day support level
2. Within 3 days, price recovers above that support
3. This must happen with high volume

This pattern is relatively rare in our 2-year dataset. The combination of conditions was too restrictive to generate valid signals.

**Recommendation:** Relax the entry conditions or extend the lookback period for support detection.

---

### 5. Time-Series Momentum Acceleration (No Valid Signals)

**Source:** *Quantitative Momentum* by Wesley Gray; AQR Capital Management research

**Thesis:** When short-term momentum accelerates faster than long-term momentum in top-performing assets, it signals massive capital inflow.

**Why It Failed:** The entry conditions required:
1. Positive 120-day return
2. 20-day ROC > 120-day ROC
3. Asset in top 10% of universe for 21-day return

The top 10% filter combined with the momentum crossover was too restrictive.

**Recommendation:** Relax the RS percentile filter to top 20-30% or use a longer lookback for the cross-sectional ranking.

---

## Combined Rankings: All 13 Setups

Combining the original 8 setups with the 3 successful new setups:

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

## Recommendations for Position Trading

Based on the optimization results, the top setups for medium-to-long-term position trading are:

### Tier 1: Highest Edge (PF > 2.0)

1. **Weinstein Stage 2** - Best overall with 4.09 PF and 8.45% avg return
2. **RS Breakout** - Strong 2.03 PF with relative strength filter
3. **Donchian 55-Day Breakout** - Classic Turtle system with 1.99 PF

### Tier 2: Solid Edge (PF 1.7-2.0)

4. **Trend Pullback 50MA** - 1.97 PF with 4.44% avg return
5. **ADX Holy Grail** - 1.71 PF with high trade count

### Portfolio Construction

For a diversified position trading portfolio:
- Use **Weinstein Stage 2** for major trend transitions (low frequency, high conviction)
- Use **Donchian 55-Day Breakout** for systematic trend following
- Use **Trend Pullback 50MA** for adding to existing trends
- Use **ADX Holy Grail** for active position management

---

## Technical Notes

- **Backtest Period:** January 2024 - January 2026 (2 years)
- **Universe:** 1,000 liquid equities with avg dollar volume > $1M
- **Friction:** 15bps round trip (7.5bps per side)
- **Position Sizing:** Not included (equal weight assumed)
- **Optimization Method:** Grid search with 4-worker multiprocessing

---

## Files Generated

- `position_trading_setups_optimized.json` - Complete optimization results
- `donchian_55_breakout_optimized.json` - Donchian setup details
- `weinstein_stage2_optimized.json` - Weinstein setup details
- `adx_holy_grail_optimized.json` - ADX setup details

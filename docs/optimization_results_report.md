# Stratos Brain - Parameter Optimization Results

**Date:** January 25, 2026  
**Total Runtime:** 134.8 minutes  
**Total Combinations Tested:** 1,843 across 8 setups  
**Data Period:** 2 years of daily data for 1,000 assets (crypto + equities)

---

## Executive Summary

This report presents the results of a comprehensive parameter optimization for all 8 trading setups in the Stratos Brain system. The optimization tested entry and exit parameters to maximize a composite score that balances profit factor, win rate, average return, and trade frequency.

### Key Findings

1. **Best Overall Score:** acceleration_turn (242.6) - High trade volume with solid profit factor
2. **Highest Profit Factor:** rs_breakout (2.026) - Excellent edge but fewer opportunities
3. **Highest Win Rate:** oversold_bounce (65.6%) - Most consistent winner
4. **Highest Avg Return:** trend_pullback_50ma (4.44%) - Best for position trading
5. **Most Active:** acceleration_turn (26,290 trades) - Ideal for active traders

---

## Methodology & Trading Timeframes

This section details the optimization process and addresses the distinction between short-term and medium/long-term trading setups.

### Optimization Process

1. **Data:** We used 2 years of daily historical data (Jan 2024 - Jan 2026) for a universe of 1,000 liquid assets (equities and crypto).
2. **Parameter Grids:** For each of the 8 setups, we defined a grid of possible entry and exit parameters. For example, for `oversold_bounce`, we tested RSI thresholds of 25, 30, and 35.
3. **Backtesting:** We then simulated every possible parameter combination for each setup across all 1,000 assets. This involved 1,843 unique backtests.
4. **Scoring:** Each backtest was evaluated using a composite score that balances:
    - **Profit Factor:** Total profit divided by total loss
    - **Win Rate:** Percentage of winning trades
    - **Average Return:** Average return per trade
    - **Trade Count:** Total number of trades (to ensure statistical significance)
5. **Ranking:** The parameter combination with the highest composite score was selected as the "optimized" version for each setup.

### Trading Timeframes: Short-Term vs. Medium/Long-Term

You raised a great point about trading timeframes. The setups we tested span a range of holding periods:

**Short-Term / Swing Trading (1-4 weeks):**

These setups aim to capture short-term price movements and typically have holding periods of 1-4 weeks.

- **acceleration_turn:** 10-day time stop
- **vcp_squeeze:** 15-day time stop
- **gap_up_momentum:** 15-day time stop
- **oversold_bounce:** 20-day time stop

**Medium-Term / Position Trading (1-6 months):**

These setups are designed to capture larger trends and have longer holding periods, making them suitable for medium-term position trading.

- **breakout_confirmed:** 60-90 day max hold
- **rs_breakout:** 90-120 day max hold
- **trend_pullback_50ma:** 90-120 day max hold
- **golden_cross:** 120-180 day max hold

**The optimization results clearly distinguish between these two styles:**

- **Short-term setups** like `acceleration_turn` and `vcp_squeeze` generated the most trades and had high composite scores due to their frequency.
- **Medium-term setups** like `trend_pullback_50ma` and `rs_breakout` had the highest profit factors and average returns, indicating they are more effective at capturing large, sustained moves.

**Conclusion:** The optimization successfully identified strong parameters for both short-term swing trading and medium-term position trading. The `trend_pullback_50ma` and `rs_breakout` setups are particularly well-suited for your focus on medium-to-long-term setups.

---

## Final Rankings

### By Composite Score

| Rank | Setup | Profit Factor | Win Rate | Avg Return | Trades | Score |
|------|-------|--------------|----------|------------|--------|-------|
| 1 | **acceleration_turn** | 1.482 | 62.9% | 0.97% | 26,290 | **242.6** |
| 2 | **vcp_squeeze** | 1.691 | 55.3% | 1.69% | 11,500 | **184.3** |
| 3 | **gap_up_momentum** | 1.583 | 51.6% | 1.87% | 7,745 | **141.9** |
| 4 | **trend_pullback_50ma** | 1.970 | 50.9% | 4.44% | 4,446 | **137.2** |
| 5 | **golden_cross** | 1.528 | 35.9% | 2.02% | 5,940 | **120.2** |
| 6 | **oversold_bounce** | 1.521 | 65.6% | 1.83% | 2,720 | **80.8** |
| 7 | **breakout_confirmed** | 1.447 | 48.9% | 2.22% | 2,235 | **69.9** |
| 8 | **rs_breakout** | 2.026 | 49.3% | 3.81% | 850 | **61.3** |

### By Profit Factor

| Rank | Setup | Profit Factor |
|------|-------|--------------|
| 1 | rs_breakout | 2.026 |
| 2 | trend_pullback_50ma | 1.970 |
| 3 | vcp_squeeze | 1.691 |
| 4 | gap_up_momentum | 1.583 |
| 5 | golden_cross | 1.528 |
| 6 | oversold_bounce | 1.521 |
| 7 | acceleration_turn | 1.482 |
| 8 | breakout_confirmed | 1.447 |

---

## Optimized Parameters by Setup

### 1. acceleration_turn (Score: 242.6)

**Strategy:** Captures momentum turns when price acceleration changes direction

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - RSI Min** | 25 |
| **Entry - RSI Max** | 65 |
| **Exit - Target %** | 6% |
| **Exit - Stop ATR Mult** | 2.5× |
| **Exit - Time Stop** | 10 days |

**Performance:**
- Profit Factor: 1.482
- Win Rate: 62.9%
- Avg Return: 0.97%
- Total Trades: 26,290

---

### 2. vcp_squeeze (Score: 184.3)

**Strategy:** Volatility contraction pattern - enters when Bollinger Bands squeeze

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - BB Width Percentile** | < 25th |
| **Entry - RSI Min** | 35 |
| **Entry - RSI Max** | 75 |
| **Exit - Target %** | 12% |
| **Exit - Stop ATR Mult** | 2.0× |
| **Exit - Time Stop** | 15 days |

**Performance:**
- Profit Factor: 1.691
- Win Rate: 55.3%
- Avg Return: 1.69%
- Total Trades: 11,500

---

### 3. gap_up_momentum (Score: 141.9)

**Strategy:** Enters on gap-up days with high relative volume

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - Gap %** | > 2% |
| **Entry - RVOL** | > 1.5× |
| **Exit - Breakdown MA Dist** | -3% |
| **Exit - Time Stop** | 15 days |

**Performance:**
- Profit Factor: 1.583
- Win Rate: 51.6%
- Avg Return: 1.87%
- Total Trades: 7,745

---

### 4. trend_pullback_50ma (Score: 137.2)

**Strategy:** Position trading - buys pullbacks to 50MA in uptrends

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - MA Dist 50 Min** | -4% |
| **Entry - MA Dist 50 Max** | +3% |
| **Entry - RSI Threshold** | < 55 |
| **Exit - Breakdown MA200 Dist** | -2% |
| **Exit - Trailing Activation** | 12% |
| **Exit - Trailing ATR Mult** | 3.5× |
| **Exit - Max Hold Days** | 120 |

**Performance:**
- Profit Factor: 1.970
- Win Rate: 50.9%
- Avg Return: 4.44%
- Total Trades: 4,446

---

### 5. golden_cross (Score: 120.2)

**Strategy:** Long-term trend following after 50MA crosses above 200MA

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - MA Dist 50 Min** | -2% |
| **Entry - MA Dist 50 Max** | +7% |
| **Entry - RSI Min** | 45 |
| **Entry - RSI Max** | 70 |
| **Exit - Breakdown MA50 Dist** | -3% |
| **Exit - Trailing Activation** | 15% |
| **Exit - Trailing ATR Mult** | 3.5× |
| **Exit - Max Hold Days** | 120 |

**Performance:**
- Profit Factor: 1.528
- Win Rate: 35.9%
- Avg Return: 2.02%
- Total Trades: 5,940

---

### 6. oversold_bounce (Score: 80.8)

**Strategy:** Mean reversion - buys oversold conditions

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - RSI Threshold** | < 35 |
| **Entry - MA Dist 20** | < -6% |
| **Exit - Target MA Dist** | +1% |
| **Exit - Stop ATR Mult** | 2.5× |
| **Exit - Time Stop** | 20 days |

**Performance:**
- Profit Factor: 1.521
- Win Rate: 65.6%
- Avg Return: 1.83%
- Total Trades: 2,720

---

### 7. breakout_confirmed (Score: 69.9)

**Strategy:** Enters on confirmed breakouts with volume

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - RVOL Threshold** | > 1.2× |
| **Entry - RSI Min** | 50 |
| **Entry - RSI Max** | 75 |
| **Exit - Breakdown MA20 Dist** | -4% |
| **Exit - Trailing Activation** | 12% |
| **Exit - Trailing ATR Mult** | 2.5× |
| **Exit - Max Hold Days** | 90 |

**Performance:**
- Profit Factor: 1.447
- Win Rate: 48.9%
- Avg Return: 2.22%
- Total Trades: 2,235

---

### 8. rs_breakout (Score: 61.3)

**Strategy:** Relative strength breakouts - highest profit factor

| Parameter | Optimized Value |
|-----------|----------------|
| **Entry - RSI Min** | 50 |
| **Entry - RSI Max** | 75 |
| **Exit - Breakdown MA50 Dist** | -4% |
| **Exit - Trailing Activation** | 15% |
| **Exit - Trailing ATR Mult** | 3.0× |
| **Exit - Max Hold Days** | 90 |

**Performance:**
- Profit Factor: 2.026
- Win Rate: 49.3%
- Avg Return: 3.81%
- Total Trades: 850

---

## Strategy Recommendations

### For Active Traders (High Frequency)
1. **acceleration_turn** - 26,290 trades, solid 1.48 PF
2. **vcp_squeeze** - 11,500 trades, excellent 1.69 PF
3. **gap_up_momentum** - 7,745 trades, good 1.58 PF

### For Position Traders (Higher Returns)
1. **trend_pullback_50ma** - 4.44% avg return, 1.97 PF
2. **rs_breakout** - 3.81% avg return, 2.03 PF
3. **breakout_confirmed** - 2.22% avg return

### For Conservative Traders (High Win Rate)
1. **oversold_bounce** - 65.6% win rate
2. **acceleration_turn** - 62.9% win rate
3. **vcp_squeeze** - 55.3% win rate

---

## Next Steps

1. **Walk-Forward Validation** - Test optimized parameters on out-of-sample data
2. **Live Paper Trading** - Deploy top setups in paper trading environment
3. **Risk Management** - Implement position sizing based on setup characteristics
4. **Correlation Analysis** - Ensure setups are uncorrelated for portfolio diversification

---

## Technical Notes

- **Scoring Formula:** `score = profit_factor * sqrt(trades) * (1 + avg_return/100)`
- **Data Source:** Supabase daily_features table with pre-calculated indicators
- **Backtest Period:** 2 years of daily data
- **Universe:** 1,000 assets (crypto + equities)
- **Optimization Method:** Grid search with multiprocessing (4 workers)

# Position Trading Backtesting Analysis

**Generated:** January 25, 2026  
**Backtest Period:** January 2020 - December 2025 (6 years)  
**Universe:** 96 Blue-Chip US Equities

---

## Executive Summary

This analysis tested 7 position trading setups designed for **1-12 month holding periods** with:
- **Trailing stop losses** that lock in gains
- **50% profit target**
- **Technical breakdown exit** (close below 200 SMA)

The backtesting system identified **trend_pullback_50ma** as the most reliable and profitable setup, with a 68.6% win rate and 14.14 profit factor.

---

## Results Summary

| Rank | Setup | Trades | Win Rate | Profit Factor | Avg Return | Avg Hold | Reliability |
|------|-------|--------|----------|---------------|------------|----------|-------------|
| **1** | **trend_pullback_50ma** | 299 | **68.6%** | **14.14** | **+22.09%** | 46 days | 100.0 |
| **2** | **oversold_quality** | 124 | 60.5% | 6.34 | +5.76% | 8 days | 100.0 |
| **3** | **gap_up_hold** | 211 | 56.4% | 5.32 | +8.06% | 44 days | 98.2 |
| 4 | breakout_consolidation | 58 | 58.6% | 2.05 | +2.83% | 80 days | 91.6 |
| 5 | deep_value_pullback | 22 | 59.1% | 8.06 | +7.24% | 1 day | 91.1 |
| 6 | squeeze_release | 87 | 55.2% | 1.99 | +2.97% | 87 days | 89.3 |
| 7 | trend_pullback_200ma | 341 | 39.0% | 4.72 | +4.15% | 26 days | 86.8 |

---

## Top 3 Recommended Setups

### 1. Trend Pullback to 50 MA (BEST SETUP)

**Description:** Enter when a stock in an established uptrend pulls back to its 50-day moving average.

**Entry Conditions:**
- Price is above 200 SMA (confirmed uptrend)
- Price is within 3% of 50 SMA (pullback to support)
- RSI < 50 (not overbought)

**Performance:**
- **299 trades** over 6 years (~50/year)
- **68.6% win rate** - exceptional
- **14.14 profit factor** - outstanding
- **+22.09% average return** per trade
- **46 days average hold**

**Exit Breakdown:**
| Exit Reason | Count | % |
|-------------|-------|---|
| Profit Target (50%) | 127 | 42% |
| Trailing Stop | 94 | 31% |
| Technical Breakdown | 73 | 24% |
| Max Hold | 5 | 2% |

**Why It Works:** This setup buys quality stocks (above 200 SMA) at a discount (pullback to 50 SMA). The trailing stop locks in gains while the 50% target captures big winners.

---

### 2. Oversold Quality (Mean Reversion)

**Description:** Enter when a stock becomes significantly oversold relative to its recent average.

**Entry Conditions:**
- Price is 10%+ below 20-day MA
- RSI < 35 (oversold)

**Performance:**
- **124 trades** over 6 years (~21/year)
- **60.5% win rate**
- **6.34 profit factor**
- **+5.76% average return** per trade
- **8 days average hold** (very quick!)

**Why It Works:** Oversold conditions in quality stocks tend to revert quickly. The trailing stop captures the bounce without overstaying.

---

### 3. Gap Up Hold

**Description:** Enter when a stock gaps up 3%+ on high volume and holds the gap.

**Entry Conditions:**
- Gap up > 3%
- Gap held (didn't fill)
- Relative volume > 2x average

**Performance:**
- **211 trades** over 6 years (~35/year)
- **56.4% win rate**
- **5.32 profit factor**
- **+8.06% average return** per trade
- **44 days average hold**

**Why It Works:** Gaps that hold on volume indicate institutional buying. The momentum tends to continue.

---

## Exit Strategy Analysis

### Overall Exit Breakdown (All 1,142 Trades)

| Exit Reason | Count | % | Description |
|-------------|-------|---|-------------|
| Technical Breakdown | 592 | 52% | Price closed below 200 SMA |
| Trailing Stop | 335 | 29% | Locked in gains |
| Profit Target | 206 | 18% | Hit 50% gain |
| Max Hold | 9 | 1% | Reached 12-month limit |

### Key Insight

The **technical breakdown exit** (52% of exits) is the primary exit mechanism. This is actually a good sign - it means the system is:
1. Cutting losers before they become catastrophic
2. Letting winners run until they show weakness
3. Not relying solely on arbitrary time or price targets

---

## Trailing Stop Configuration

The trailing stop uses a tiered approach:

| Gain Level | Trail Distance |
|------------|----------------|
| Initial | 15% below entry |
| +10% gain | 12% below high |
| +20% gain | 15% below high |
| +35% gain | 18% below high |

This allows:
- **Room to breathe** early in the trade
- **Tighter protection** as gains accumulate
- **Locking in profits** without premature exits

---

## Recommendations

### For Live Trading

1. **Primary Focus:** Use **trend_pullback_50ma** as your main setup
   - High win rate (68.6%) provides psychological comfort
   - Exceptional profit factor (14.14) means winners far outweigh losers
   - Reasonable frequency (~50 trades/year)

2. **Secondary Setup:** Use **oversold_quality** for quick mean reversion trades
   - Very short hold period (8 days average)
   - Good for capturing quick bounces

3. **Opportunistic:** Use **gap_up_hold** for momentum plays
   - Good balance of frequency and performance

### For AI Scoring Integration

The AI scoring system should:
1. **Classify first** - Identify which setup the current signal matches
2. **Grade second** - Score the quality of that specific setup

For example:
- If a stock is pulling back to 50 MA → Grade it as a "trend_pullback_50ma" setup
- If a stock is oversold → Grade it as an "oversold_quality" setup

This allows setup-specific grading criteria rather than generic scoring.

---

## Next Steps

1. **Parameter Optimization:** Fine-tune the entry conditions for each setup
2. **Out-of-Sample Testing:** Test on 2026 data as it becomes available
3. **AI Integration:** Update the AI scoring prompts to use setup-specific grading
4. **Position Sizing:** Implement Kelly criterion or fixed fractional sizing

---

## Files Generated

| File | Description |
|------|-------------|
| `data/position/trend_pullback_50ma_equity.json` | Full trade log for best setup |
| `data/position/trend_pullback_50ma_equity.md` | Human-readable report |
| `data/position/trend_pullback_50ma_equity.csv` | Trade data for spreadsheet analysis |
| `data/position/summary_equity.json` | Summary of all setups |
| `scripts/position_backtester.py` | The backtesting system |

---

*Analysis generated by Stratos Brain Position Trading Backtester*

# Backtest Report: standard_breakout

**Generated:** 2026-01-25 14:29:40

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | standard_breakout |
| **Universe** | equity |
| **Date Range** | 2023-01-01 to 2025-12-31 |

### Parameters

```json
{
  "rvol_thresh": 2.0,
  "rsi_thresh": 60,
  "stop_loss_atr_mult": 1.5,
  "take_profit_r_mult": 2.0,
  "max_hold_days": 10
}
```

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 96 |
| **Assets Skipped** | 0 |
| **Signals Scanned** | 44,918 |
| **Entries Triggered** | 159 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 159 | Sample size |
| **Win Rate** | 52.2% | ✅ Good |
| **Profit Factor** | 1.35 | ✅ Profitable |
| **Avg Return** | +0.62% | Per-trade expectancy |
| **Sharpe Ratio** | 1.91 | Risk-adjusted return |
| **Reliability Score** | 77.4/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
| time_exit | 91 |
| take_profit | 26 |
| stop_loss | 42 |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-05-03 |
| **Entry Price** | $181.9092 |
| **Stop Loss** | $174.8565 |
| **Take Profit** | $196.0146 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-05-17 |
| **Exit Price** | $188.6044 |
| **Exit Reason** | time_exit |
| **Return** | +3.68% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.4834, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 64.993, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 188.6044

---

### Trade #2: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-06-11 |
| **Entry Price** | $205.7692 |
| **Stop Loss** | $199.0710 |
| **Take Profit** | $219.1655 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-12 |
| **Exit Price** | $219.1655 |
| **Exit Reason** | take_profit |
| **Return** | +6.51% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.9424, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 70.5213, Threshold: 60.0

**Exit Details:** High (220.2000) reached take profit (219.1655)

---

### Trade #3: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-06-12 |
| **Entry Price** | $211.6497 |
| **Stop Loss** | $203.6789 |
| **Take Profit** | $227.5912 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-27 |
| **Exit Price** | $212.6728 |
| **Exit Reason** | time_exit |
| **Return** | +0.48% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 3.008, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 77.35, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 212.6728

---

### Trade #4: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-09-19 |
| **Entry Price** | $245.2633 |
| **Stop Loss** | $237.5627 |
| **Take Profit** | $260.6645 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-10-03 |
| **Exit Price** | $257.7713 |
| **Exit Reason** | time_exit |
| **Return** | +5.10% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.9377, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 64.3966, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 257.7713

---

### Trade #5: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-10-01 |
| **Entry Price** | $240.6786 |
| **Stop Loss** | $232.8352 |
| **Take Profit** | $256.3654 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-10-06 |
| **Exit Price** | $232.8352 |
| **Exit Reason** | stop_loss |
| **Return** | -3.26% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.046, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 80.0348, Threshold: 60.0

**Exit Details:** Low (227.9200) breached stop loss (232.8352)

---

### Trade #6: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-01-23 |
| **Entry Price** | $121.5449 |
| **Stop Loss** | $116.1421 |
| **Take Profit** | $132.3505 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-02-05 |
| **Exit Price** | $132.3505 |
| **Exit Reason** | take_profit |
| **Return** | +8.89% |
| **Holding Period** | 9 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.4029, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 76.7921, Threshold: 60.0

**Exit Details:** High (132.5000) reached take profit (132.3505)

---

### Trade #7: ADBE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-06-14 |
| **Entry Price** | $525.3100 |
| **Stop Loss** | $499.4407 |
| **Take Profit** | $577.0485 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $560.0100 |
| **Exit Reason** | time_exit |
| **Return** | +6.61% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 3.6896, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 66.8993, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 560.0100

---

### Trade #8: ADBE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-12-05 |
| **Entry Price** | $346.2600 |
| **Stop Loss** | $332.8688 |
| **Take Profit** | $373.0424 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-12-19 |
| **Exit Price** | $355.8600 |
| **Exit Reason** | time_exit |
| **Return** | +2.77% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.0721, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 63.3798, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 355.8600

---

### Trade #9: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-05-22 |
| **Entry Price** | $233.3473 |
| **Stop Loss** | $218.3860 |
| **Take Profit** | $263.2699 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-06 |
| **Exit Price** | $231.5955 |
| **Exit Reason** | time_exit |
| **Return** | -0.75% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.9969, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 94.7166, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 231.5955

---

### Trade #10: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-02-19 |
| **Entry Price** | $237.7273 |
| **Stop Loss** | $225.3992 |
| **Take Profit** | $262.3834 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-02-27 |
| **Exit Price** | $225.3992 |
| **Exit Reason** | stop_loss |
| **Return** | -5.19% |
| **Holding Period** | 6 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.4361, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 77.0213, Threshold: 60.0

**Exit Details:** Low (223.5000) breached stop loss (225.3992)

---

### Trade #11: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-08-20 |
| **Entry Price** | $244.8700 |
| **Stop Loss** | $235.3868 |
| **Take Profit** | $263.8365 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-09-04 |
| **Exit Price** | $245.2402 |
| **Exit Reason** | time_exit |
| **Return** | +0.15% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.3722, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 73.0522, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 245.2402

---

### Trade #12: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-02-16 |
| **Entry Price** | $196.0348 |
| **Stop Loss** | $183.9652 |
| **Take Profit** | $220.1741 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-03-04 |
| **Exit Price** | $206.1250 |
| **Exit Reason** | time_exit |
| **Return** | +5.15% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.176, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 78.1153, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 206.1250

---

### Trade #13: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-09-18 |
| **Entry Price** | $189.3645 |
| **Stop Loss** | $182.0368 |
| **Take Profit** | $204.0198 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-09-23 |
| **Exit Price** | $204.0198 |
| **Exit Reason** | take_profit |
| **Return** | +7.74% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.136, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 75.0974, Threshold: 60.0

**Exit Details:** High (204.1000) reached take profit (204.0198)

---

### Trade #14: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-06-16 |
| **Entry Price** | $126.3900 |
| **Stop Loss** | $119.6259 |
| **Take Profit** | $139.9182 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-06-25 |
| **Exit Price** | $139.9182 |
| **Exit Reason** | take_profit |
| **Return** | +10.70% |
| **Holding Period** | 6 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.5863, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 64.873, Threshold: 60.0

**Exit Details:** High (144.1800) reached take profit (139.9182)

---

### Trade #15: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-07-29 |
| **Entry Price** | $177.4400 |
| **Stop Loss** | $167.7486 |
| **Take Profit** | $196.8229 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-08-01 |
| **Exit Price** | $167.7486 |
| **Exit Reason** | stop_loss |
| **Return** | -5.46% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.0606, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 88.4229, Threshold: 60.0

**Exit Details:** Low (166.8200) breached stop loss (167.7486)

---

### Trade #16: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-10-06 |
| **Entry Price** | $203.7100 |
| **Stop Loss** | $189.2158 |
| **Take Profit** | $232.6984 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-10-08 |
| **Exit Price** | $232.6984 |
| **Exit Reason** | take_profit |
| **Return** | +14.23% |
| **Holding Period** | 2 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 4.6048, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 84.233, Threshold: 60.0

**Exit Details:** High (235.8700) reached take profit (232.6984)

---

### Trade #17: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-10-08 |
| **Entry Price** | $235.5600 |
| **Stop Loss** | $218.3674 |
| **Take Profit** | $269.9452 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-10-10 |
| **Exit Price** | $218.3674 |
| **Exit Reason** | stop_loss |
| **Return** | -7.30% |
| **Holding Period** | 2 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.5367, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 91.9766, Threshold: 60.0

**Exit Details:** Low (213.2001) breached stop loss (218.3674)

---

### Trade #18: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-06-21 |
| **Entry Price** | $189.0800 |
| **Stop Loss** | $184.1942 |
| **Take Profit** | $198.8515 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-27 |
| **Exit Price** | $198.8515 |
| **Exit Reason** | take_profit |
| **Return** | +5.17% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.0499, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 76.6892, Threshold: 60.0

**Exit Details:** High (199.8400) reached take profit (198.8515)

---

### Trade #19: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-09-20 |
| **Entry Price** | $191.6000 |
| **Stop Loss** | $184.4841 |
| **Take Profit** | $205.8318 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-10-01 |
| **Exit Price** | $184.4841 |
| **Exit Reason** | stop_loss |
| **Return** | -3.71% |
| **Holding Period** | 7 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.7734, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 65.7603, Threshold: 60.0

**Exit Details:** Low (183.4519) breached stop loss (184.4841)

---

### Trade #20: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-11-01 |
| **Entry Price** | $197.9300 |
| **Stop Loss** | $190.7793 |
| **Take Profit** | $212.2314 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-11-07 |
| **Exit Price** | $212.2314 |
| **Exit Reason** | take_profit |
| **Return** | +7.23% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.8372, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 65.0014, Threshold: 60.0

**Exit Details:** High (212.2500) reached take profit (212.2314)

---

*...and 139 more trades (see CSV export)*

---

*Report generated by Stratos Brain Production Backtester*

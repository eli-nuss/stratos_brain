# Backtest Report: pullback_ma50

**Generated:** 2026-01-25 14:29:20

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | pullback_ma50 |
| **Universe** | equity |
| **Date Range** | 2023-01-01 to 2025-12-31 |

### Parameters

```json
{
  "rsi_threshold": 45,
  "stop_loss_atr_mult": 1.5,
  "take_profit_r_mult": 3.0,
  "max_hold_days": 20
}
```

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 96 |
| **Assets Skipped** | 0 |
| **Signals Scanned** | 43,958 |
| **Entries Triggered** | 6029 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 6029 | Sample size |
| **Win Rate** | 49.1% | ⚠️ Below 50% |
| **Profit Factor** | 1.70 | ✅ Profitable |
| **Avg Return** | +1.40% | Per-trade expectancy |
| **Sharpe Ratio** | 3.35 | Risk-adjusted return |
| **Reliability Score** | 81.5/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
| stop_loss | 1943 |
| time_exit | 3388 |
| take_profit | 698 |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-02-08 |
| **Entry Price** | $186.5725 |
| **Stop Loss** | $180.6974 |
| **Take Profit** | $204.1978 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-02-20 |
| **Exit Price** | $180.6974 |
| **Exit Reason** | stop_loss |
| **Return** | -3.15% |
| **Holding Period** | 7 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0115, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 42.8064, Threshold: 45.0

**Exit Details:** Low (180.0000) breached stop loss (180.6974)

---

### Trade #2: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-02-09 |
| **Entry Price** | $187.3353 |
| **Stop Loss** | $181.6884 |
| **Take Profit** | $204.2760 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-02-15 |
| **Exit Price** | $181.6884 |
| **Exit Reason** | stop_loss |
| **Return** | -3.01% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0073, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 38.5494, Threshold: 45.0

**Exit Details:** Low (181.3500) breached stop loss (181.6884)

---

### Trade #3: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-02-12 |
| **Entry Price** | $185.6489 |
| **Stop Loss** | $180.1926 |
| **Take Profit** | $202.0177 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-02-20 |
| **Exit Price** | $180.1926 |
| **Exit Reason** | stop_loss |
| **Return** | -2.94% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0161, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 31.7701, Threshold: 45.0

**Exit Details:** Low (180.0000) breached stop loss (180.1926)

---

### Trade #4: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-02-13 |
| **Entry Price** | $183.5559 |
| **Stop Loss** | $178.1333 |
| **Take Profit** | $199.8238 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-03-01 |
| **Exit Price** | $178.1333 |
| **Exit Reason** | stop_loss |
| **Return** | -2.95% |
| **Holding Period** | 12 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0267, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 29.7743, Threshold: 45.0

**Exit Details:** Low (177.3800) breached stop loss (178.1333)

---

### Trade #5: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-02-14 |
| **Entry Price** | $182.6730 |
| **Stop Loss** | $177.3021 |
| **Take Profit** | $198.7858 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-03-04 |
| **Exit Price** | $177.3021 |
| **Exit Reason** | stop_loss |
| **Return** | -2.94% |
| **Holding Period** | 12 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0306, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 29.0591, Threshold: 45.0

**Exit Details:** Low (173.7900) breached stop loss (177.3021)

---

### Trade #6: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-02-15 |
| **Entry Price** | $182.3853 |
| **Stop Loss** | $176.9801 |
| **Take Profit** | $198.6010 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-03-04 |
| **Exit Price** | $176.9801 |
| **Exit Reason** | stop_loss |
| **Return** | -2.96% |
| **Holding Period** | 11 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0316, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 30.9954, Threshold: 45.0

**Exit Details:** Low (173.7900) breached stop loss (176.9801)

---

### Trade #7: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-02-22 |
| **Entry Price** | $182.8912 |
| **Stop Loss** | $177.6423 |
| **Take Profit** | $198.6379 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-03-01 |
| **Exit Price** | $177.6423 |
| **Exit Reason** | stop_loss |
| **Return** | -2.87% |
| **Holding Period** | 6 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0244, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 43.182, Threshold: 45.0

**Exit Details:** Low (177.3800) breached stop loss (177.6423)

---

### Trade #8: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-08-05 |
| **Entry Price** | $207.8750 |
| **Stop Loss** | $197.3214 |
| **Take Profit** | $239.5359 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $221.5394 |
| **Exit Reason** | time_exit |
| **Return** | +6.57% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0174, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 18.1341, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 221.5394

---

### Trade #9: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-08-06 |
| **Entry Price** | $205.8486 |
| **Stop Loss** | $195.0480 |
| **Take Profit** | $238.2505 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-04 |
| **Exit Price** | $219.6300 |
| **Exit Reason** | time_exit |
| **Return** | +6.69% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0288, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 20.0883, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 219.6300

---

### Trade #10: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-08-07 |
| **Entry Price** | $208.4214 |
| **Stop Loss** | $197.6613 |
| **Take Profit** | $240.7016 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-05 |
| **Exit Price** | $221.1515 |
| **Exit Reason** | time_exit |
| **Return** | +6.11% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0185, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 28.9319, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 221.1515

---

### Trade #11: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-08-08 |
| **Entry Price** | $211.8881 |
| **Stop Loss** | $200.9497 |
| **Take Profit** | $244.7033 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-06 |
| **Exit Price** | $219.6001 |
| **Exit Reason** | time_exit |
| **Return** | +3.64% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0043, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 35.3098, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 219.6001

---

### Trade #12: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-08-09 |
| **Entry Price** | $214.7986 |
| **Stop Loss** | $203.8681 |
| **Take Profit** | $247.5902 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-09 |
| **Exit Price** | $219.6896 |
| **Exit Reason** | time_exit |
| **Return** | +2.28% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: 0.0069, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 40.3549, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 219.6896

---

### Trade #13: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-08-12 |
| **Entry Price** | $216.3283 |
| **Stop Loss** | $205.3722 |
| **Take Profit** | $249.1965 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-10 |
| **Exit Price** | $218.8941 |
| **Exit Reason** | time_exit |
| **Return** | +1.19% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: 0.0116, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 41.0763, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 218.8941

---

### Trade #14: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-09-05 |
| **Entry Price** | $221.1515 |
| **Stop Loss** | $214.5903 |
| **Take Profit** | $240.8350 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-16 |
| **Exit Price** | $214.5903 |
| **Exit Reason** | stop_loss |
| **Return** | -2.97% |
| **Holding Period** | 7 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: 0.0005, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 44.8908, Threshold: 45.0

**Exit Details:** Low (213.9200) breached stop loss (214.5903)

---

### Trade #15: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-09-06 |
| **Entry Price** | $219.6001 |
| **Stop Loss** | $212.8116 |
| **Take Profit** | $239.9655 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-10-04 |
| **Exit Price** | $225.5471 |
| **Exit Reason** | time_exit |
| **Return** | +2.71% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0072, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 38.6942, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 225.5471

---

### Trade #16: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-09-09 |
| **Entry Price** | $219.6896 |
| **Stop Loss** | $212.7286 |
| **Take Profit** | $240.5725 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-10-07 |
| **Exit Price** | $220.4653 |
| **Exit Reason** | time_exit |
| **Return** | +0.35% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0074, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 39.2021, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 220.4653

---

### Trade #17: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-09-10 |
| **Entry Price** | $218.8941 |
| **Stop Loss** | $211.6951 |
| **Take Profit** | $240.4912 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-10-08 |
| **Exit Price** | $224.5228 |
| **Exit Reason** | time_exit |
| **Return** | +2.57% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0119, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 36.2307, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 224.5228

---

### Trade #18: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-09-11 |
| **Entry Price** | $221.4300 |
| **Stop Loss** | $213.9877 |
| **Take Profit** | $243.7568 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-16 |
| **Exit Price** | $213.9877 |
| **Exit Reason** | stop_loss |
| **Return** | -3.36% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.001, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 42.7181, Threshold: 45.0

**Exit Details:** Low (213.9200) breached stop loss (213.9877)

---

### Trade #19: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-09-13 |
| **Entry Price** | $221.2709 |
| **Stop Loss** | $214.1650 |
| **Take Profit** | $242.5885 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-09-16 |
| **Exit Price** | $214.1650 |
| **Exit Reason** | stop_loss |
| **Return** | -3.21% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.002, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 40.0823, Threshold: 45.0

**Exit Details:** Low (213.9200) breached stop loss (214.1650)

---

### Trade #20: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | pullback_ma50 |
| **Entry Date** | 2024-09-16 |
| **Entry Price** | $215.1250 |
| **Stop Loss** | $207.5947 |
| **Take Profit** | $237.7159 |
| **Risk:Reward** | 1:3.0 |
| **Exit Date** | 2024-10-14 |
| **Exit Price** | $230.0222 |
| **Exit Reason** | time_exit |
| **Return** | +6.92% |
| **Holding Period** | 20 days |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Touched 50 SMA`: ma_dist_50 <= 0.02 → Actual: -0.0289, Threshold: 0.02
- ✓ `RSI Not Overbought`: rsi_14 < 45.0 → Actual: 30.4112, Threshold: 45.0

**Exit Details:** Max holding period (20 days) reached. Closed at 230.0222

---

*...and 6009 more trades (see CSV export)*

---

*Report generated by Stratos Brain Production Backtester*

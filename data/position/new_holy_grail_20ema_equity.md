# Position Trading Backtest Report: holy_grail_20ema

**Generated:** 2026-01-25 14:55:45

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | holy_grail_20ema |
| **Universe** | equity |
| **Date Range** | 2020-01-01 to 2025-12-31 |

### Trailing Stop Configuration

| Parameter | Value |
|-----------|-------|
| **Initial Stop Loss** | 15% |
| **Profit Target** | 50% |
| **Max Hold Period** | 252 days (~12 months) |
| **Trail Tiers** | [(0.1, 0.12), (0.2, 0.15), (0.35, 0.18)] |

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 96 |
| **Assets Skipped** | 0 |
| **Signals Scanned** | 7,225 |
| **Entries Triggered** | 252 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 252 | Sample size |
| **Win Rate** | 69.0% | ✅ Good |
| **Profit Factor** | 12.09 | ✅ Profitable |
| **Avg Return** | +20.55% | Per-trade expectancy |
| **Avg Hold Period** | 55 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -15.00% | Maximum loss |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 93 | Trailing stop triggered |
| technical_breakdown | 55 | Broke below 200 SMA |
| profit_target | 99 | 50% profit target reached |
| max_hold | 5 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-06-10 |
| **Entry Price** | $191.83 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $201.87 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.23% |
| **Holding Period** | 38 days |
| **Max Gain** | +23.67% |
| **Highest Price** | $237.23 (2024-07-15) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0093, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0093, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0163, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 54.4558, Threshold: 60.0

**Exit Details:** Low (196.00) breached trailing stop (201.87). Max gain was 23.7%

---

### Trade #2: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-09-03 |
| **Entry Price** | $221.54 |
| **Exit Date** | 2025-01-16 |
| **Exit Price** | $228.89 |
| **Exit Reason** | trailing_stop |
| **Return** | +3.32% |
| **Holding Period** | 93 days |
| **Max Gain** | +17.41% |
| **Highest Price** | $260.10 (2024-12-26) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0011, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0011, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0111, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 53.275, Threshold: 60.0

**Exit Details:** Low (228.03) breached trailing stop (228.89). Max gain was 17.4%

---

### Trade #3: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-03-14 |
| **Entry Price** | $170.40 |
| **Exit Date** | 2024-05-28 |
| **Exit Price** | $154.96 |
| **Exit Reason** | trailing_stop |
| **Return** | -9.06% |
| **Holding Period** | 51 days |
| **Max Gain** | +6.99% |
| **Highest Price** | $182.30 (2024-03-28) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0154, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0154, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0087, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 58.0778, Threshold: 60.0

**Exit Details:** Low (153.95) breached trailing stop (154.96). Max gain was 7.0%

---

### Trade #4: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-06-27 |
| **Entry Price** | $160.43 |
| **Exit Date** | 2024-11-11 |
| **Exit Price** | $176.22 |
| **Exit Reason** | trailing_stop |
| **Return** | +9.84% |
| **Holding Period** | 95 days |
| **Max Gain** | +29.23% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0089, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0089, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.021, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 51.0028, Threshold: 60.0

**Exit Details:** Low (172.70) breached trailing stop (176.22). Max gain was 29.2%

---

### Trade #5: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-03-14 |
| **Entry Price** | $114.87 |
| **Exit Date** | 2024-05-20 |
| **Exit Price** | $100.26 |
| **Exit Reason** | technical_breakdown |
| **Return** | -12.72% |
| **Holding Period** | 46 days |
| **Max Gain** | +0.78% |
| **Highest Price** | $115.76 (2024-03-18) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0005, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0005, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0175, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 47.5145, Threshold: 60.0

**Exit Details:** Close (100.26) broke below 200 SMA (102.39)

---

### Trade #6: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-06-11 |
| **Entry Price** | $102.78 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $100.25 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.47% |
| **Holding Period** | 13 days |
| **Max Gain** | +4.04% |
| **Highest Price** | $106.93 (2024-06-21) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0184, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0184, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0015, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 59.5189, Threshold: 60.0

**Exit Details:** Close (100.25) broke below 200 SMA (102.62)

---

### Trade #7: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-08-13 |
| **Entry Price** | $105.70 |
| **Exit Date** | 2025-07-17 |
| **Exit Price** | $120.05 |
| **Exit Reason** | trailing_stop |
| **Return** | +13.57% |
| **Holding Period** | 231 days |
| **Max Gain** | +33.61% |
| **Highest Price** | $141.23 (2025-03-04) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0149, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0149, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0138, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 53.1413, Threshold: 60.0

**Exit Details:** Low (119.77) breached trailing stop (120.05). Max gain was 33.6%

---

### Trade #8: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-03-14 |
| **Entry Price** | $365.70 |
| **Exit Date** | 2024-04-10 |
| **Exit Price** | $324.08 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.38% |
| **Holding Period** | 18 days |
| **Max Gain** | +4.26% |
| **Highest Price** | $381.27 (2024-03-20) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0059, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0059, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0063, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 50.8401, Threshold: 60.0

**Exit Details:** Low (323.64) breached trailing stop (324.08). Max gain was 4.3%

---

### Trade #9: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-09-17 |
| **Entry Price** | $328.61 |
| **Exit Date** | 2025-02-28 |
| **Exit Price** | $345.36 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.10% |
| **Holding Period** | 112 days |
| **Max Gain** | +21.22% |
| **Highest Price** | $398.35 (2025-02-05) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: -0.0118, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: -0.0118, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.018, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 46.424, Threshold: 60.0

**Exit Details:** Low (342.41) breached trailing stop (345.36). Max gain was 21.2%

---

### Trade #10: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-07-18 |
| **Entry Price** | $556.85 |
| **Exit Date** | 2024-07-24 |
| **Exit Price** | $531.04 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.64% |
| **Holding Period** | 4 days |
| **Max Gain** | +0.76% |
| **Highest Price** | $561.09 (2024-07-19) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0043, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0043, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0303, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 57.1167, Threshold: 60.0

**Exit Details:** Close (531.04) broke below 200 SMA (546.39)

---

### Trade #11: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-09-06 |
| **Entry Price** | $563.41 |
| **Exit Date** | 2024-09-16 |
| **Exit Price** | $521.50 |
| **Exit Reason** | technical_breakdown |
| **Return** | -7.44% |
| **Holding Period** | 6 days |
| **Max Gain** | +4.32% |
| **Highest Price** | $587.75 (2024-09-12) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0091, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0091, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0237, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 56.7807, Threshold: 60.0

**Exit Details:** Close (521.50) broke below 200 SMA (543.41)

---

### Trade #12: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-03-14 |
| **Entry Price** | $188.91 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +9.85% |
| **Holding Period** | 97 days |
| **Max Gain** | +29.23% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0112, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0112, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0096, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 57.4433, Threshold: 60.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 29.2%

---

### Trade #13: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-09-03 |
| **Entry Price** | $214.25 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $208.59 |
| **Exit Reason** | trailing_stop |
| **Return** | -2.64% |
| **Holding Period** | 53 days |
| **Max Gain** | +10.63% |
| **Highest Price** | $237.03 (2024-10-14) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: -0.0063, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: -0.0063, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.014, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 51.1675, Threshold: 60.0

**Exit Details:** Low (205.40) breached trailing stop (208.59). Max gain was 10.6%

---

### Trade #14: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-12-16 |
| **Entry Price** | $212.79 |
| **Exit Date** | 2024-12-18 |
| **Exit Price** | $204.39 |
| **Exit Reason** | technical_breakdown |
| **Return** | -3.95% |
| **Holding Period** | 2 days |
| **Max Gain** | +2.89% |
| **Highest Price** | $218.95 (2024-12-18) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0008, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0008, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0038, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 40.4539, Threshold: 60.0

**Exit Details:** Close (204.39) broke below 200 SMA (212.82)

---

### Trade #15: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-03-14 |
| **Entry Price** | $197.53 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $217.51 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.12% |
| **Holding Period** | 86 days |
| **Max Gain** | +29.55% |
| **Highest Price** | $255.89 (2024-07-10) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: -0.0045, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: -0.0045, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0262, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 53.4145, Threshold: 60.0

**Exit Details:** Low (213.25) breached trailing stop (217.51). Max gain was 29.5%

---

### Trade #16: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-03-14 |
| **Entry Price** | $187.06 |
| **Exit Date** | 2024-04-10 |
| **Exit Price** | $164.73 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.94% |
| **Holding Period** | 18 days |
| **Max Gain** | +3.60% |
| **Highest Price** | $193.80 (2024-03-15) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: -0.0123, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: -0.0123, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0345, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 57.2871, Threshold: 60.0

**Exit Details:** Low (164.00) breached trailing stop (164.73). Max gain was 3.6%

---

### Trade #17: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-06-04 |
| **Entry Price** | $159.99 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $164.81 |
| **Exit Reason** | trailing_stop |
| **Return** | +3.01% |
| **Holding Period** | 29 days |
| **Max Gain** | +17.06% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: -0.0063, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: -0.0063, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0213, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 57.249, Threshold: 60.0

**Exit Details:** Low (159.37) breached trailing stop (164.81). Max gain was 17.1%

---

### Trade #18: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-10-14 |
| **Entry Price** | $165.27 |
| **Exit Date** | 2024-10-15 |
| **Exit Price** | $156.64 |
| **Exit Reason** | technical_breakdown |
| **Return** | -5.22% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.00% |
| **Highest Price** | $165.27 (2024-10-14) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.017, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.017, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0296, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 57.7377, Threshold: 60.0

**Exit Details:** Close (156.64) broke below 200 SMA (162.46)

---

### Trade #19: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-03-19 |
| **Entry Price** | $175.90 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $177.06 |
| **Exit Reason** | trailing_stop |
| **Return** | +0.66% |
| **Holding Period** | 88 days |
| **Max Gain** | +14.38% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: 0.0053, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: 0.0053, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0098, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 54.4859, Threshold: 60.0

**Exit Details:** Low (176.80) breached trailing stop (177.06). Max gain was 14.4%

---

### Trade #20: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | holy_grail_20ema |
| **Entry Date** | 2024-09-04 |
| **Entry Price** | $173.33 |
| **Exit Date** | 2025-03-04 |
| **Exit Price** | $198.87 |
| **Exit Reason** | trailing_stop |
| **Return** | +14.73% |
| **Holding Period** | 123 days |
| **Max Gain** | +39.92% |
| **Highest Price** | $242.52 (2025-02-04) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 20 SMA`: ma_dist_20 >= -0.02 → Actual: -0.0002, Threshold: -0.02
- ✓ `Near 20 SMA`: ma_dist_20 <= 0.02 → Actual: -0.0002, Threshold: 0.02
- ✓ `20 MA Slope Positive`: ma_slope_20 > 0.0 → Actual: 0.0026, Threshold: 0.0
- ✓ `RSI Mid-Range`: rsi_14 < 60.0 → Actual: 54.6051, Threshold: 60.0

**Exit Details:** Low (197.43) breached trailing stop (198.87). Max gain was 39.9%

---

*...and 232 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

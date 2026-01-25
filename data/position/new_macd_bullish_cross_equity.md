# Position Trading Backtest Report: macd_bullish_cross

**Generated:** 2026-01-25 14:56:23

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | macd_bullish_cross |
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
| **Signals Scanned** | 6,977 |
| **Entries Triggered** | 290 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 290 | Sample size |
| **Win Rate** | 65.5% | ✅ Good |
| **Profit Factor** | 12.72 | ✅ Profitable |
| **Avg Return** | +20.47% | Per-trade expectancy |
| **Avg Hold Period** | 49 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -13.67% | Maximum loss |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 91 | Trailing stop triggered |
| technical_breakdown | 82 | Broke below 200 SMA |
| profit_target | 113 | 50% profit target reached |
| max_hold | 4 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-05-03 |
| **Entry Price** | $181.91 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $201.65 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.85% |
| **Holding Period** | 63 days |
| **Max Gain** | +30.41% |
| **Highest Price** | $237.23 (2024-07-15) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 1.3793, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.736, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 64.993, Threshold: 70.0

**Exit Details:** Low (196.00) breached trailing stop (201.65). Max gain was 30.4%

---

### Trade #2: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-08-14 |
| **Entry Price** | $220.50 |
| **Exit Date** | 2025-01-16 |
| **Exit Price** | $228.89 |
| **Exit Reason** | trailing_stop |
| **Return** | +3.81% |
| **Holding Period** | 106 days |
| **Max Gain** | +17.96% |
| **Highest Price** | $260.10 (2024-12-26) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.022, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.4289, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 56.0304, Threshold: 70.0

**Exit Details:** Low (228.03) breached trailing stop (228.89). Max gain was 18.0%

---

### Trade #3: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-04-23 |
| **Entry Price** | $160.95 |
| **Exit Date** | 2024-11-11 |
| **Exit Price** | $176.22 |
| **Exit Reason** | trailing_stop |
| **Return** | +9.49% |
| **Holding Period** | 140 days |
| **Max Gain** | +28.81% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.1533, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.3557, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 38.5478, Threshold: 70.0

**Exit Details:** Low (172.70) breached trailing stop (176.22). Max gain was 28.8%

---

### Trade #4: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-11-26 |
| **Entry Price** | $174.95 |
| **Exit Date** | 2024-12-12 |
| **Exit Price** | $167.28 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.39% |
| **Holding Period** | 11 days |
| **Max Gain** | +5.31% |
| **Highest Price** | $184.24 (2024-11-27) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.2421, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.7577, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 30.8441, Threshold: 70.0

**Exit Details:** Close (167.28) broke below 200 SMA (170.87)

---

### Trade #5: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-04-26 |
| **Entry Price** | $104.45 |
| **Exit Date** | 2024-05-20 |
| **Exit Price** | $100.26 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.02% |
| **Holding Period** | 16 days |
| **Max Gain** | +3.58% |
| **Highest Price** | $108.19 (2024-04-29) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.0243, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.0888, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 41.209, Threshold: 70.0

**Exit Details:** Close (100.26) broke below 200 SMA (102.39)

---

### Trade #6: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-06-07 |
| **Entry Price** | $104.50 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $100.25 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.07% |
| **Holding Period** | 15 days |
| **Max Gain** | +4.29% |
| **Highest Price** | $108.98 (2024-06-10) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.5468, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.2658, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 62.1772, Threshold: 70.0

**Exit Details:** Close (100.25) broke below 200 SMA (102.62)

---

### Trade #7: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-07-24 |
| **Entry Price** | $104.75 |
| **Exit Date** | 2025-07-17 |
| **Exit Price** | $120.05 |
| **Exit Reason** | trailing_stop |
| **Return** | +14.61% |
| **Holding Period** | 245 days |
| **Max Gain** | +34.83% |
| **Highest Price** | $141.23 (2025-03-04) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.3722, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.2566, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 62.8363, Threshold: 70.0

**Exit Details:** Low (119.77) breached trailing stop (120.05). Max gain was 34.8%

---

### Trade #8: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-08-20 |
| **Entry Price** | $322.10 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $339.60 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.43% |
| **Holding Period** | 136 days |
| **Max Gain** | +23.67% |
| **Highest Price** | $398.35 (2025-02-05) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.2759, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.3417, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 49.709, Threshold: 70.0

**Exit Details:** Low (335.91) breached trailing stop (339.60). Max gain was 23.7%

---

### Trade #9: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-03-14 |
| **Entry Price** | $570.45 |
| **Exit Date** | 2024-03-15 |
| **Exit Price** | $492.46 |
| **Exit Reason** | technical_breakdown |
| **Return** | -13.67% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.00% |
| **Highest Price** | $570.45 (2024-03-14) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 3.6934, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.179, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 57.3262, Threshold: 70.0

**Exit Details:** Close (492.46) broke below 200 SMA (549.96)

---

### Trade #10: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-08-15 |
| **Entry Price** | $554.16 |
| **Exit Date** | 2024-09-16 |
| **Exit Price** | $521.50 |
| **Exit Reason** | technical_breakdown |
| **Return** | -5.89% |
| **Holding Period** | 21 days |
| **Max Gain** | +6.06% |
| **Highest Price** | $587.75 (2024-09-12) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 1.0353, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 1.5353, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 54.8858, Threshold: 70.0

**Exit Details:** Close (521.50) broke below 200 SMA (543.41)

---

### Trade #11: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-11-25 |
| **Entry Price** | $518.73 |
| **Exit Date** | 2024-12-12 |
| **Exit Price** | $474.21 |
| **Exit Reason** | trailing_stop |
| **Return** | -8.58% |
| **Holding Period** | 12 days |
| **Max Gain** | +7.55% |
| **Highest Price** | $557.90 (2024-12-09) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 1.625, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.5298, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 63.5973, Threshold: 70.0

**Exit Details:** Low (470.90) breached trailing stop (474.21). Max gain was 7.6%

---

### Trade #12: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-04-01 |
| **Entry Price** | $191.04 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +8.62% |
| **Holding Period** | 86 days |
| **Max Gain** | +27.79% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.0818, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.1774, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 47.5148, Threshold: 70.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 27.8%

---

### Trade #13: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-08-15 |
| **Entry Price** | $218.19 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $202.14 |
| **Exit Reason** | technical_breakdown |
| **Return** | -7.36% |
| **Holding Period** | 65 days |
| **Max Gain** | +8.63% |
| **Highest Price** | $237.03 (2024-10-14) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.7511, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.8306, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 48.3109, Threshold: 70.0

**Exit Details:** Close (202.14) broke below 200 SMA (209.80)

---

### Trade #14: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-11-25 |
| **Entry Price** | $219.02 |
| **Exit Date** | 2024-12-18 |
| **Exit Price** | $204.39 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.68% |
| **Holding Period** | 16 days |
| **Max Gain** | +6.63% |
| **Highest Price** | $233.55 (2024-11-26) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.3046, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.8836, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 56.1246, Threshold: 70.0

**Exit Details:** Close (204.39) broke below 200 SMA (212.82)

---

### Trade #15: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-05-03 |
| **Entry Price** | $200.81 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $217.51 |
| **Exit Reason** | trailing_stop |
| **Return** | +8.31% |
| **Holding Period** | 51 days |
| **Max Gain** | +27.43% |
| **Highest Price** | $255.89 (2024-07-10) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.0882, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.4922, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 48.6965, Threshold: 70.0

**Exit Details:** Low (213.25) breached trailing stop (217.51). Max gain was 27.4%

---

### Trade #16: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-08-13 |
| **Entry Price** | $197.94 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $181.12 |
| **Exit Reason** | technical_breakdown |
| **Return** | -8.50% |
| **Holding Period** | 14 days |
| **Max Gain** | +7.61% |
| **Highest Price** | $213.00 (2024-08-15) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.4999, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 1.1776, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 46.9037, Threshold: 70.0

**Exit Details:** Close (181.12) broke below 200 SMA (192.08)

---

### Trade #17: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-09-19 |
| **Entry Price** | $194.29 |
| **Exit Date** | 2024-09-20 |
| **Exit Price** | $189.80 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.31% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.63% |
| **Highest Price** | $195.53 (2024-09-20) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 1.749, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.6969, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 53.0629, Threshold: 70.0

**Exit Details:** Close (189.80) broke below 200 SMA (194.33)

---

### Trade #18: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-10-09 |
| **Entry Price** | $202.54 |
| **Exit Date** | 2024-10-15 |
| **Exit Price** | $188.67 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.85% |
| **Holding Period** | 4 days |
| **Max Gain** | +6.50% |
| **Highest Price** | $215.70 (2024-10-15) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.9108, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.0868, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 58.5083, Threshold: 70.0

**Exit Details:** Close (188.67) broke below 200 SMA (198.11)

---

### Trade #19: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-04-29 |
| **Entry Price** | $160.20 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $164.81 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.88% |
| **Holding Period** | 54 days |
| **Max Gain** | +16.90% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.4143, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.6771, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 40.1819, Threshold: 70.0

**Exit Details:** Low (159.37) breached trailing stop (164.81). Max gain was 16.9%

---

### Trade #20: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | macd_bullish_cross |
| **Entry Date** | 2024-04-03 |
| **Entry Price** | $182.41 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $177.06 |
| **Exit Reason** | trailing_stop |
| **Return** | -2.94% |
| **Holding Period** | 78 days |
| **Max Gain** | +10.30% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `MACD Histogram Positive`: macd_histogram > 0.0 → Actual: 0.0656, Threshold: 0.0
- ✓ `MACD Hist Slope Up`: macd_hist_slope > 0.0 → Actual: 0.0801, Threshold: 0.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RSI Not Overbought`: rsi_14 < 70.0 → Actual: 66.3593, Threshold: 70.0

**Exit Details:** Low (176.80) breached trailing stop (177.06). Max gain was 10.3%

---

*...and 270 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

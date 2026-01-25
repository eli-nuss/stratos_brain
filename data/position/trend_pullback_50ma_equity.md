# Position Trading Backtest Report: trend_pullback_50ma

**Generated:** 2026-01-25 14:46:51

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | trend_pullback_50ma |
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
| **Signals Scanned** | 7,404 |
| **Entries Triggered** | 299 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 299 | Sample size |
| **Win Rate** | 68.6% | ✅ Good |
| **Profit Factor** | 14.14 | ✅ Profitable |
| **Avg Return** | +22.09% | Per-trade expectancy |
| **Avg Hold Period** | 46 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -13.32% | Maximum loss |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 94 | Trailing stop triggered |
| technical_breakdown | 73 | Broke below 200 SMA |
| profit_target | 127 | 50% profit target reached |
| max_hold | 5 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-08-01 |
| **Entry Price** | $216.90 |
| **Exit Date** | 2025-01-16 |
| **Exit Price** | $228.89 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.52% |
| **Holding Period** | 115 days |
| **Max Gain** | +19.91% |
| **Highest Price** | $260.10 (2024-12-26) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.0298, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 31.1337, Threshold: 50.0

**Exit Details:** Low (228.03) breached trailing stop (228.89). Max gain was 19.9%

---

### Trade #2: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-03-21 |
| **Entry Price** | $166.92 |
| **Exit Date** | 2024-05-28 |
| **Exit Price** | $154.96 |
| **Exit Reason** | trailing_stop |
| **Return** | -7.17% |
| **Holding Period** | 46 days |
| **Max Gain** | +9.22% |
| **Highest Price** | $182.30 (2024-03-28) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.0268, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 46.8344, Threshold: 50.0

**Exit Details:** Low (153.95) breached trailing stop (154.96). Max gain was 9.2%

---

### Trade #3: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-06-03 |
| **Entry Price** | $152.08 |
| **Exit Date** | 2024-11-12 |
| **Exit Price** | $172.00 |
| **Exit Reason** | trailing_stop |
| **Return** | +13.10% |
| **Holding Period** | 113 days |
| **Max Gain** | +36.33% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0312, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 47.7544, Threshold: 50.0

**Exit Details:** Low (171.03) breached trailing stop (172.00). Max gain was 36.3%

---

### Trade #4: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-11-22 |
| **Entry Price** | $170.91 |
| **Exit Date** | 2024-12-12 |
| **Exit Price** | $167.28 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.12% |
| **Holding Period** | 13 days |
| **Max Gain** | +7.80% |
| **Highest Price** | $184.24 (2024-11-27) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0628, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 26.414, Threshold: 50.0

**Exit Details:** Close (167.28) broke below 200 SMA (170.87)

---

### Trade #5: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $111.62 |
| **Exit Date** | 2024-05-20 |
| **Exit Price** | $100.26 |
| **Exit Reason** | technical_breakdown |
| **Return** | -10.18% |
| **Holding Period** | 45 days |
| **Max Gain** | +3.71% |
| **Highest Price** | $115.76 (2024-03-18) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.002, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 39.2328, Threshold: 50.0

**Exit Details:** Close (100.26) broke below 200 SMA (102.39)

---

### Trade #6: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-09-24 |
| **Entry Price** | $110.68 |
| **Exit Date** | 2025-07-17 |
| **Exit Price** | $120.05 |
| **Exit Reason** | trailing_stop |
| **Return** | +8.46% |
| **Holding Period** | 202 days |
| **Max Gain** | +27.60% |
| **Highest Price** | $141.23 (2025-03-04) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.0235, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 46.5177, Threshold: 50.0

**Exit Details:** Low (119.77) breached trailing stop (120.05). Max gain was 27.6%

---

### Trade #7: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $362.21 |
| **Exit Date** | 2024-04-10 |
| **Exit Price** | $324.08 |
| **Exit Reason** | trailing_stop |
| **Return** | -10.53% |
| **Holding Period** | 17 days |
| **Max Gain** | +5.26% |
| **Highest Price** | $381.27 (2024-03-20) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.0198, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 47.4477, Threshold: 50.0

**Exit Details:** Low (323.64) breached trailing stop (324.08). Max gain was 5.3%

---

### Trade #8: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
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
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.0244, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 46.424, Threshold: 50.0

**Exit Details:** Low (342.41) breached trailing stop (345.36). Max gain was 21.2%

---

### Trade #9: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-03-21 |
| **Entry Price** | $189.61 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +9.44% |
| **Holding Period** | 92 days |
| **Max Gain** | +28.76% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.0166, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 49.8726, Threshold: 50.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 28.8%

---

### Trade #10: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-08-05 |
| **Entry Price** | $195.65 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $202.14 |
| **Exit Reason** | technical_breakdown |
| **Return** | +3.32% |
| **Holding Period** | 73 days |
| **Max Gain** | +21.15% |
| **Highest Price** | $237.03 (2024-10-14) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.1305, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 27.1844, Threshold: 50.0

**Exit Details:** Close (202.14) broke below 200 SMA (209.80)

---

### Trade #11: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-11-26 |
| **Entry Price** | $214.58 |
| **Exit Date** | 2024-12-18 |
| **Exit Price** | $204.39 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.75% |
| **Holding Period** | 15 days |
| **Max Gain** | +4.76% |
| **Highest Price** | $224.79 (2024-12-02) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0254, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 41.9463, Threshold: 50.0

**Exit Details:** Close (204.39) broke below 200 SMA (212.82)

---

### Trade #12: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-04-17 |
| **Entry Price** | $196.68 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $217.51 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.59% |
| **Holding Period** | 63 days |
| **Max Gain** | +30.11% |
| **Highest Price** | $255.89 (2024-07-10) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0042, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 40.9223, Threshold: 50.0

**Exit Details:** Low (213.25) breached trailing stop (217.51). Max gain was 30.1%

---

### Trade #13: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-07-19 |
| **Entry Price** | $207.26 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $190.48 |
| **Exit Reason** | trailing_stop |
| **Return** | -8.10% |
| **Holding Period** | 10 days |
| **Max Gain** | +8.12% |
| **Highest Price** | $224.09 (2024-07-22) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0765, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 32.6827, Threshold: 50.0

**Exit Details:** Low (179.63) breached trailing stop (190.48). Max gain was 8.1%

---

### Trade #14: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-08-08 |
| **Entry Price** | $187.83 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $187.44 |
| **Exit Reason** | trailing_stop |
| **Return** | -0.21% |
| **Holding Period** | 17 days |
| **Max Gain** | +13.40% |
| **Highest Price** | $213.00 (2024-08-15) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.1472, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 41.2345, Threshold: 50.0

**Exit Details:** Low (182.50) breached trailing stop (187.44). Max gain was 13.4%

---

### Trade #15: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-03-20 |
| **Entry Price** | $179.73 |
| **Exit Date** | 2024-04-15 |
| **Exit Price** | $159.54 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.24% |
| **Holding Period** | 17 days |
| **Max Gain** | +4.43% |
| **Highest Price** | $187.69 (2024-03-21) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.0104, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 40.5465, Threshold: 50.0

**Exit Details:** Low (158.76) breached trailing stop (159.54). Max gain was 4.4%

---

### Trade #16: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-04-16 |
| **Entry Price** | $163.46 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $164.81 |
| **Exit Reason** | trailing_stop |
| **Return** | +0.82% |
| **Holding Period** | 63 days |
| **Max Gain** | +14.57% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0946, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 36.5151, Threshold: 50.0

**Exit Details:** Low (159.37) breached trailing stop (164.81). Max gain was 14.6%

---

### Trade #17: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-07-18 |
| **Entry Price** | $155.77 |
| **Exit Date** | 2024-07-24 |
| **Exit Price** | $144.63 |
| **Exit Reason** | technical_breakdown |
| **Return** | -7.15% |
| **Holding Period** | 4 days |
| **Max Gain** | +0.82% |
| **Highest Price** | $157.05 (2024-07-23) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.049, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 47.185, Threshold: 50.0

**Exit Details:** Close (144.63) broke below 200 SMA (153.27)

---

### Trade #18: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-04-18 |
| **Entry Price** | $179.22 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $177.06 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.21% |
| **Holding Period** | 67 days |
| **Max Gain** | +12.26% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: 0.012, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 47.5712, Threshold: 50.0

**Exit Details:** Low (176.80) breached trailing stop (177.06). Max gain was 12.3%

---

### Trade #19: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-07-26 |
| **Entry Price** | $182.50 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $162.01 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.23% |
| **Holding Period** | 5 days |
| **Max Gain** | +4.44% |
| **Highest Price** | $190.60 (2024-08-01) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0248, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 23.2728, Threshold: 50.0

**Exit Details:** Low (160.55) breached trailing stop (162.01). Max gain was 4.4%

---

### Trade #20: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_50ma |
| **Entry Date** | 2024-08-13 |
| **Entry Price** | $170.23 |
| **Exit Date** | 2025-03-04 |
| **Exit Price** | $198.87 |
| **Exit Reason** | trailing_stop |
| **Return** | +16.82% |
| **Holding Period** | 138 days |
| **Max Gain** | +42.47% |
| **Highest Price** | $242.52 (2025-02-04) |

**Entry Conditions:**
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Near 50 SMA`: ma_dist_50 <= 0.03 → Actual: -0.0779, Threshold: 0.03
- ✓ `RSI Not Overbought`: rsi_14 < 50.0 → Actual: 38.6119, Threshold: 50.0

**Exit Details:** Low (197.43) breached trailing stop (198.87). Max gain was 42.5%

---

*...and 279 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

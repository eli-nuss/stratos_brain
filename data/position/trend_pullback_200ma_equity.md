# Position Trading Backtest Report: trend_pullback_200ma

**Generated:** 2026-01-25 14:46:57

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | trend_pullback_200ma |
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
| **Signals Scanned** | 11,241 |
| **Entries Triggered** | 341 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 341 | Sample size |
| **Win Rate** | 39.0% | ⚠️ Below 50% |
| **Profit Factor** | 4.72 | ✅ Profitable |
| **Avg Return** | +4.15% | Per-trade expectancy |
| **Avg Hold Period** | 26 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -8.14% | Maximum loss |
| **Reliability Score** | 86.8/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| technical_breakdown | 272 | Broke below 200 SMA |
| trailing_stop | 42 | Trailing stop triggered |
| profit_target | 25 | 50% profit target reached |
| max_hold | 2 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-03-20 |
| **Entry Price** | $177.24 |
| **Exit Date** | 2024-03-21 |
| **Exit Price** | $170.00 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.09% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.14% |
| **Highest Price** | $177.49 (2024-03-21) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0258, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0258, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 46.0577, Threshold: 55.0

**Exit Details:** Close (170.00) broke below 200 SMA (181.89)

---

### Trade #2: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-05-22 |
| **Entry Price** | $151.53 |
| **Exit Date** | 2024-11-12 |
| **Exit Price** | $172.00 |
| **Exit Reason** | trailing_stop |
| **Return** | +13.51% |
| **Holding Period** | 120 days |
| **Max Gain** | +36.82% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: 0.0223, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: 0.0223, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 46.8751, Threshold: 55.0

**Exit Details:** Low (171.03) breached trailing stop (172.00). Max gain was 36.8%

---

### Trade #3: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-11-21 |
| **Entry Price** | $165.87 |
| **Exit Date** | 2024-12-12 |
| **Exit Price** | $167.28 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.85% |
| **Holding Period** | 14 days |
| **Max Gain** | +11.08% |
| **Highest Price** | $184.24 (2024-11-27) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0267, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0267, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 16.6596, Threshold: 55.0

**Exit Details:** Close (167.28) broke below 200 SMA (170.87)

---

### Trade #4: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-12-13 |
| **Entry Price** | $167.45 |
| **Exit Date** | 2024-12-16 |
| **Exit Price** | $165.77 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.52% |
| **Highest Price** | $173.34 (2024-12-16) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0201, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0201, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 39.4705, Threshold: 55.0

**Exit Details:** Close (165.77) broke below 200 SMA (170.87)

---

### Trade #5: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-12-17 |
| **Entry Price** | $169.39 |
| **Exit Date** | 2024-12-18 |
| **Exit Price** | $167.11 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.35% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.20% |
| **Highest Price** | $176.50 (2024-12-18) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0087, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0087, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 34.2625, Threshold: 55.0

**Exit Details:** Close (167.11) broke below 200 SMA (170.87)

---

### Trade #6: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-04-17 |
| **Entry Price** | $102.87 |
| **Exit Date** | 2024-05-20 |
| **Exit Price** | $100.26 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.54% |
| **Holding Period** | 23 days |
| **Max Gain** | +5.17% |
| **Highest Price** | $108.19 (2024-04-29) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: 0.0026, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: 0.0026, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 25.9178, Threshold: 55.0

**Exit Details:** Close (100.26) broke below 200 SMA (102.39)

---

### Trade #7: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-05-21 |
| **Entry Price** | $100.01 |
| **Exit Date** | 2024-05-28 |
| **Exit Price** | $99.03 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.98% |
| **Holding Period** | 4 days |
| **Max Gain** | +5.13% |
| **Highest Price** | $105.14 (2024-05-22) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.023, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.023, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 23.6128, Threshold: 55.0

**Exit Details:** Close (99.03) broke below 200 SMA (102.36)

---

### Trade #8: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-05-31 |
| **Entry Price** | $99.27 |
| **Exit Date** | 2024-06-03 |
| **Exit Price** | $99.93 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.67% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.90% |
| **Highest Price** | $104.13 (2024-06-03) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0299, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0299, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 38.3774, Threshold: 55.0

**Exit Details:** Close (99.93) broke below 200 SMA (102.33)

---

### Trade #9: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-06-04 |
| **Entry Price** | $100.47 |
| **Exit Date** | 2024-06-05 |
| **Exit Price** | $100.28 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.19% |
| **Holding Period** | 1 days |
| **Max Gain** | +2.94% |
| **Highest Price** | $103.42 (2024-06-05) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0181, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0181, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 47.4606, Threshold: 55.0

**Exit Details:** Close (100.28) broke below 200 SMA (102.33)

---

### Trade #10: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-06-06 |
| **Entry Price** | $101.29 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $100.25 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.03% |
| **Holding Period** | 16 days |
| **Max Gain** | +7.60% |
| **Highest Price** | $108.98 (2024-06-10) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0103, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0103, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 47.4573, Threshold: 55.0

**Exit Details:** Close (100.25) broke below 200 SMA (102.62)

---

### Trade #11: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-07-02 |
| **Entry Price** | $100.25 |
| **Exit Date** | 2024-07-03 |
| **Exit Price** | $99.40 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.84% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.41% |
| **Highest Price** | $103.66 (2024-07-03) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0233, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0233, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 36.5329, Threshold: 55.0

**Exit Details:** Close (99.40) broke below 200 SMA (102.65)

---

### Trade #12: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-07-05 |
| **Entry Price** | $101.04 |
| **Exit Date** | 2024-07-08 |
| **Exit Price** | $99.20 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.83% |
| **Holding Period** | 1 days |
| **Max Gain** | +2.78% |
| **Highest Price** | $103.85 (2024-07-08) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0158, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0158, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 52.8818, Threshold: 55.0

**Exit Details:** Close (99.20) broke below 200 SMA (102.68)

---

### Trade #13: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-07-10 |
| **Entry Price** | $100.10 |
| **Exit Date** | 2024-07-15 |
| **Exit Price** | $100.55 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.45% |
| **Holding Period** | 3 days |
| **Max Gain** | +4.82% |
| **Highest Price** | $104.93 (2024-07-12) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0255, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0255, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 46.2934, Threshold: 55.0

**Exit Details:** Close (100.55) broke below 200 SMA (102.84)

---

### Trade #14: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-07-16 |
| **Entry Price** | $100.31 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $97.72 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.58% |
| **Holding Period** | 2 days |
| **Max Gain** | +5.32% |
| **Highest Price** | $105.65 (2024-07-17) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.025, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.025, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 39.6793, Threshold: 55.0

**Exit Details:** Close (97.72) broke below 200 SMA (102.96)

---

### Trade #15: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-07-22 |
| **Entry Price** | $101.29 |
| **Exit Date** | 2025-07-17 |
| **Exit Price** | $119.96 |
| **Exit Reason** | technical_breakdown |
| **Return** | +18.44% |
| **Holding Period** | 247 days |
| **Max Gain** | +39.43% |
| **Highest Price** | $141.23 (2025-03-04) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.017, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.017, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 52.8647, Threshold: 55.0

**Exit Details:** Close (119.96) broke below 200 SMA (123.35)

---

### Trade #16: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-03-22 |
| **Entry Price** | $326.34 |
| **Exit Date** | 2024-04-12 |
| **Exit Price** | $306.18 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.18% |
| **Holding Period** | 14 days |
| **Max Gain** | +6.33% |
| **Highest Price** | $346.98 (2024-03-28) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: 0.0229, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: 0.0229, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 26.0148, Threshold: 55.0

**Exit Details:** Close (306.18) broke below 200 SMA (320.79)

---

### Trade #17: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-08-06 |
| **Entry Price** | $310.71 |
| **Exit Date** | 2024-08-07 |
| **Exit Price** | $310.06 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.21% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.84% |
| **Highest Price** | $325.74 (2024-08-07) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0285, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0285, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 41.423, Threshold: 55.0

**Exit Details:** Close (310.06) broke below 200 SMA (319.90)

---

### Trade #18: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-08-13 |
| **Entry Price** | $311.34 |
| **Exit Date** | 2024-08-14 |
| **Exit Price** | $311.83 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.16% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.45% |
| **Highest Price** | $322.07 (2024-08-14) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0282, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0282, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 38.7863, Threshold: 55.0

**Exit Details:** Close (311.83) broke below 200 SMA (320.53)

---

### Trade #19: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-08-15 |
| **Entry Price** | $316.99 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $338.60 |
| **Exit Reason** | trailing_stop |
| **Return** | +6.81% |
| **Holding Period** | 139 days |
| **Max Gain** | +25.66% |
| **Highest Price** | $398.35 (2025-02-05) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: -0.0116, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: -0.0116, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 46.2492, Threshold: 55.0

**Exit Details:** Low (335.91) breached trailing stop (338.60). Max gain was 25.7%

---

### Trade #20: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | trend_pullback_200ma |
| **Entry Date** | 2024-07-19 |
| **Entry Price** | $551.00 |
| **Exit Date** | 2024-07-24 |
| **Exit Price** | $531.04 |
| **Exit Reason** | technical_breakdown |
| **Return** | -3.62% |
| **Holding Period** | 3 days |
| **Max Gain** | +1.67% |
| **Highest Price** | $560.19 (2024-07-22) |

**Entry Conditions:**
- ✓ `Near 200 SMA`: ma_dist_200 <= 0.03 → Actual: 0.0093, Threshold: 0.03
- ✓ `Near 200 SMA`: ma_dist_200 >= -0.03 → Actual: 0.0093, Threshold: -0.03
- ✓ `RSI Not Overbought`: rsi_14 < 55.0 → Actual: 46.6598, Threshold: 55.0

**Exit Details:** Close (531.04) broke below 200 SMA (546.39)

---

*...and 321 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

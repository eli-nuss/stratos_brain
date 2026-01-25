# Position Trading Backtest Report: oversold_quality

**Generated:** 2026-01-25 14:46:37

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | oversold_quality |
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
| **Signals Scanned** | 18,014 |
| **Entries Triggered** | 124 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 124 | Sample size |
| **Win Rate** | 60.5% | ✅ Good |
| **Profit Factor** | 6.34 | ✅ Profitable |
| **Avg Return** | +5.76% | Per-trade expectancy |
| **Avg Hold Period** | 8 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -15.00% | Maximum loss |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| technical_breakdown | 95 | Broke below 200 SMA |
| trailing_stop | 16 | Trailing stop triggered |
| profit_target | 13 | 50% profit target reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-11-12 |
| **Entry Price** | $165.25 |
| **Exit Date** | 2024-11-13 |
| **Exit Price** | $164.53 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.43% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.47% |
| **Highest Price** | $172.64 (2024-11-13) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1102, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 34.8054, Threshold: 35.0

**Exit Details:** Close (164.53) broke below 200 SMA (170.35)

---

### Trade #2: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-11-14 |
| **Entry Price** | $163.84 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $159.36 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.74% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.54% |
| **Highest Price** | $169.63 (2024-11-15) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1087, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 32.8566, Threshold: 35.0

**Exit Details:** Close (159.36) broke below 200 SMA (170.41)

---

### Trade #3: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-11-18 |
| **Entry Price** | $160.60 |
| **Exit Date** | 2024-11-19 |
| **Exit Price** | $160.88 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.17% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.05% |
| **Highest Price** | $167.10 (2024-11-19) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1161, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 29.6789, Threshold: 35.0

**Exit Details:** Close (160.88) broke below 200 SMA (170.42)

---

### Trade #4: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-03-25 |
| **Entry Price** | $322.78 |
| **Exit Date** | 2024-04-12 |
| **Exit Price** | $306.18 |
| **Exit Reason** | technical_breakdown |
| **Return** | -5.14% |
| **Holding Period** | 13 days |
| **Max Gain** | +7.50% |
| **Highest Price** | $346.98 (2024-03-28) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.104, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 26.8942, Threshold: 35.0

**Exit Details:** Close (306.18) broke below 200 SMA (320.79)

---

### Trade #5: ADBE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $492.46 |
| **Exit Date** | 2024-03-18 |
| **Exit Price** | $513.86 |
| **Exit Reason** | technical_breakdown |
| **Return** | +4.35% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.73% |
| **Highest Price** | $515.73 (2024-03-18) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.109, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 31.8167, Threshold: 35.0

**Exit Details:** Close (513.86) broke below 200 SMA (550.44)

---

### Trade #6: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-12-16 |
| **Entry Price** | $461.53 |
| **Exit Date** | 2024-12-17 |
| **Exit Price** | $455.23 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.37% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.94% |
| **Highest Price** | $465.86 (2024-12-17) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1035, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 31.5078, Threshold: 35.0

**Exit Details:** Close (455.23) broke below 200 SMA (514.24)

---

### Trade #7: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-12-18 |
| **Entry Price** | $441.31 |
| **Exit Date** | 2024-12-19 |
| **Exit Price** | $437.39 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.89% |
| **Holding Period** | 1 days |
| **Max Gain** | +1.74% |
| **Highest Price** | $449.00 (2024-12-19) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1341, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 26.9066, Threshold: 35.0

**Exit Details:** Close (437.39) broke below 200 SMA (513.20)

---

### Trade #8: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-12-20 |
| **Entry Price** | $447.17 |
| **Exit Date** | 2024-12-23 |
| **Exit Price** | $446.74 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.10% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.95% |
| **Highest Price** | $451.43 (2024-12-23) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1122, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 29.4394, Threshold: 35.0

**Exit Details:** Close (446.74) broke below 200 SMA (512.13)

---

### Trade #9: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
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
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1247, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 27.1844, Threshold: 35.0

**Exit Details:** Close (202.14) broke below 200 SMA (209.80)

---

### Trade #10: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
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
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.113, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 32.6827, Threshold: 35.0

**Exit Details:** Low (179.63) breached trailing stop (190.48). Max gain was 8.1%

---

### Trade #11: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-08-05 |
| **Entry Price** | $179.30 |
| **Exit Date** | 2024-08-06 |
| **Exit Price** | $180.70 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.78% |
| **Holding Period** | 1 days |
| **Max Gain** | +5.14% |
| **Highest Price** | $188.51 (2024-08-06) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1663, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 25.3564, Threshold: 35.0

**Exit Details:** Close (180.70) broke below 200 SMA (186.41)

---

### Trade #12: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-08-07 |
| **Entry Price** | $175.96 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $181.12 |
| **Exit Reason** | technical_breakdown |
| **Return** | +2.93% |
| **Holding Period** | 18 days |
| **Max Gain** | +21.05% |
| **Highest Price** | $213.00 (2024-08-15) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1537, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 31.8426, Threshold: 35.0

**Exit Details:** Close (181.12) broke below 200 SMA (192.08)

---

### Trade #13: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-09-06 |
| **Entry Price** | $172.60 |
| **Exit Date** | 2024-09-09 |
| **Exit Price** | $175.37 |
| **Exit Reason** | technical_breakdown |
| **Return** | +1.60% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.45% |
| **Highest Price** | $178.55 (2024-09-09) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1102, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 21.9691, Threshold: 35.0

**Exit Details:** Close (175.37) broke below 200 SMA (192.62)

---

### Trade #14: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-04-04 |
| **Entry Price** | $165.83 |
| **Exit Date** | 2024-04-19 |
| **Exit Price** | $146.79 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.48% |
| **Holding Period** | 11 days |
| **Max Gain** | +4.14% |
| **Highest Price** | $172.69 (2024-04-05) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1104, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 27.0486, Threshold: 35.0

**Exit Details:** Low (145.29) breached trailing stop (146.79). Max gain was 4.1%

---

### Trade #15: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-04-22 |
| **Entry Price** | $148.64 |
| **Exit Date** | 2024-06-18 |
| **Exit Price** | $153.60 |
| **Exit Reason** | trailing_stop |
| **Return** | +3.34% |
| **Holding Period** | 40 days |
| **Max Gain** | +17.43% |
| **Highest Price** | $174.55 (2024-05-28) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1167, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 26.6106, Threshold: 35.0

**Exit Details:** Low (153.34) breached trailing stop (153.60). Max gain was 17.4%

---

### Trade #16: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-07-25 |
| **Entry Price** | $138.32 |
| **Exit Date** | 2024-07-26 |
| **Exit Price** | $139.99 |
| **Exit Reason** | technical_breakdown |
| **Return** | +1.21% |
| **Holding Period** | 1 days |
| **Max Gain** | +2.15% |
| **Highest Price** | $141.29 (2024-07-26) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1616, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 25.8278, Threshold: 35.0

**Exit Details:** Close (139.99) broke below 200 SMA (153.59)

---

### Trade #17: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-07-29 |
| **Entry Price** | $139.75 |
| **Exit Date** | 2024-07-30 |
| **Exit Price** | $138.44 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.94% |
| **Holding Period** | 1 days |
| **Max Gain** | +1.40% |
| **Highest Price** | $141.70 (2024-07-30) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1421, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 20.3524, Threshold: 35.0

**Exit Details:** Close (138.44) broke below 200 SMA (153.89)

---

### Trade #18: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-07-31 |
| **Entry Price** | $144.48 |
| **Exit Date** | 2024-08-01 |
| **Exit Price** | $132.54 |
| **Exit Reason** | technical_breakdown |
| **Return** | -8.26% |
| **Holding Period** | 1 days |
| **Max Gain** | +1.94% |
| **Highest Price** | $147.29 (2024-08-01) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1023, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 19.5249, Threshold: 35.0

**Exit Details:** Close (132.54) broke below 200 SMA (154.21)

---

### Trade #19: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-08-02 |
| **Entry Price** | $132.50 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $134.82 |
| **Exit Reason** | technical_breakdown |
| **Return** | +1.75% |
| **Holding Period** | 1 days |
| **Max Gain** | +5.01% |
| **Highest Price** | $139.14 (2024-08-05) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1582, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 16.8232, Threshold: 35.0

**Exit Details:** Close (134.82) broke below 200 SMA (154.48)

---

### Trade #20: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | oversold_quality |
| **Entry Date** | 2024-08-06 |
| **Entry Price** | $130.18 |
| **Exit Date** | 2024-08-07 |
| **Exit Price** | $128.67 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.16% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.66% |
| **Highest Price** | $136.24 (2024-08-07) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.1 → Actual: -0.1484, Threshold: -0.1
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 24.7366, Threshold: 35.0

**Exit Details:** Close (128.67) broke below 200 SMA (154.76)

---

*...and 104 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

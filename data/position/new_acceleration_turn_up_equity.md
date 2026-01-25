# Position Trading Backtest Report: acceleration_turn_up

**Generated:** 2026-01-25 14:56:04

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | acceleration_turn_up |
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
| **Signals Scanned** | 6,070 |
| **Entries Triggered** | 349 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 349 | Sample size |
| **Win Rate** | 73.9% | ✅ Good |
| **Profit Factor** | 19.39 | ✅ Profitable |
| **Avg Return** | +25.95% | Per-trade expectancy |
| **Avg Hold Period** | 43 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -13.91% | Maximum loss |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 108 | Trailing stop triggered |
| technical_breakdown | 61 | Broke below 200 SMA |
| profit_target | 174 | 50% profit target reached |
| max_hold | 6 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-05-09 |
| **Entry Price** | $183.09 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $201.65 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.13% |
| **Holding Period** | 59 days |
| **Max Gain** | +29.57% |
| **Highest Price** | $237.23 (2024-07-15) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0544, Threshold: 0.0

**Exit Details:** Low (196.00) breached trailing stop (201.65). Max gain was 29.6%

---

### Trade #2: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-08-15 |
| **Entry Price** | $223.48 |
| **Exit Date** | 2025-01-16 |
| **Exit Price** | $228.89 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.42% |
| **Holding Period** | 105 days |
| **Max Gain** | +16.39% |
| **Highest Price** | $260.10 (2024-12-26) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0036, Threshold: 0.0

**Exit Details:** Low (228.03) breached trailing stop (228.89). Max gain was 16.4%

---

### Trade #3: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
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
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0389, Threshold: 0.0

**Exit Details:** Low (153.95) breached trailing stop (154.96). Max gain was 7.0%

---

### Trade #4: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-06-13 |
| **Entry Price** | $158.12 |
| **Exit Date** | 2024-11-11 |
| **Exit Price** | $176.22 |
| **Exit Reason** | trailing_stop |
| **Return** | +11.44% |
| **Holding Period** | 104 days |
| **Max Gain** | +31.11% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0169, Threshold: 0.0

**Exit Details:** Low (172.70) breached trailing stop (176.22). Max gain was 31.1%

---

### Trade #5: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
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
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0222, Threshold: 0.0

**Exit Details:** Low (119.77) breached trailing stop (120.05). Max gain was 34.8%

---

### Trade #6: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-03-19 |
| **Entry Price** | $365.58 |
| **Exit Date** | 2024-04-10 |
| **Exit Price** | $324.08 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.35% |
| **Holding Period** | 15 days |
| **Max Gain** | +4.29% |
| **Highest Price** | $381.27 (2024-03-20) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0417, Threshold: 0.0

**Exit Details:** Low (323.64) breached trailing stop (324.08). Max gain was 4.3%

---

### Trade #7: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-07-25 |
| **Entry Price** | $321.86 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $305.89 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.96% |
| **Holding Period** | 7 days |
| **Max Gain** | +5.30% |
| **Highest Price** | $338.92 (2024-08-01) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0884, Threshold: 0.0

**Exit Details:** Close (305.89) broke below 200 SMA (319.72)

---

### Trade #8: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-08-21 |
| **Entry Price** | $325.25 |
| **Exit Date** | 2025-03-06 |
| **Exit Price** | $340.56 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.71% |
| **Holding Period** | 134 days |
| **Max Gain** | +22.47% |
| **Highest Price** | $398.35 (2025-02-05) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.015, Threshold: 0.0

**Exit Details:** Low (339.82) breached trailing stop (340.56). Max gain was 22.5%

---

### Trade #9: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-06-27 |
| **Entry Price** | $546.76 |
| **Exit Date** | 2024-07-24 |
| **Exit Price** | $531.04 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.88% |
| **Holding Period** | 18 days |
| **Max Gain** | +6.18% |
| **Highest Price** | $580.55 (2024-07-05) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.1448, Threshold: 0.0

**Exit Details:** Close (531.04) broke below 200 SMA (546.39)

---

### Trade #10: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-08-19 |
| **Entry Price** | $563.12 |
| **Exit Date** | 2024-09-16 |
| **Exit Price** | $521.50 |
| **Exit Reason** | technical_breakdown |
| **Return** | -7.39% |
| **Holding Period** | 19 days |
| **Max Gain** | +4.37% |
| **Highest Price** | $587.75 (2024-09-12) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.015, Threshold: 0.0

**Exit Details:** Close (521.50) broke below 200 SMA (543.41)

---

### Trade #11: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-12-04 |
| **Entry Price** | $536.49 |
| **Exit Date** | 2024-12-12 |
| **Exit Price** | $474.21 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.61% |
| **Holding Period** | 6 days |
| **Max Gain** | +3.99% |
| **Highest Price** | $557.90 (2024-12-09) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.1029, Threshold: 0.0

**Exit Details:** Low (470.90) breached trailing stop (474.21). Max gain was 4.0%

---

### Trade #12: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $189.66 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +9.41% |
| **Holding Period** | 96 days |
| **Max Gain** | +28.72% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0458, Threshold: 0.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 28.7%

---

### Trade #13: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-08-21 |
| **Entry Price** | $221.93 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $202.14 |
| **Exit Reason** | technical_breakdown |
| **Return** | -8.92% |
| **Holding Period** | 61 days |
| **Max Gain** | +6.80% |
| **Highest Price** | $237.03 (2024-10-14) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0128, Threshold: 0.0

**Exit Details:** Close (202.14) broke below 200 SMA (209.80)

---

### Trade #14: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
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
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.08, Threshold: 0.0

**Exit Details:** Low (213.25) breached trailing stop (217.51). Max gain was 29.5%

---

### Trade #15: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-08-21 |
| **Entry Price** | $206.14 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $181.12 |
| **Exit Reason** | technical_breakdown |
| **Return** | -12.14% |
| **Holding Period** | 8 days |
| **Max Gain** | +2.04% |
| **Highest Price** | $210.34 (2024-08-22) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0125, Threshold: 0.0

**Exit Details:** Close (181.12) broke below 200 SMA (192.08)

---

### Trade #16: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-09-26 |
| **Entry Price** | $207.03 |
| **Exit Date** | 2024-10-15 |
| **Exit Price** | $188.67 |
| **Exit Reason** | technical_breakdown |
| **Return** | -8.87% |
| **Holding Period** | 13 days |
| **Max Gain** | +4.19% |
| **Highest Price** | $215.70 (2024-10-15) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0867, Threshold: 0.0

**Exit Details:** Close (188.67) broke below 200 SMA (198.11)

---

### Trade #17: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $191.06 |
| **Exit Date** | 2024-04-10 |
| **Exit Price** | $164.47 |
| **Exit Reason** | trailing_stop |
| **Return** | -13.91% |
| **Holding Period** | 17 days |
| **Max Gain** | +1.28% |
| **Highest Price** | $193.50 (2024-03-18) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0809, Threshold: 0.0

**Exit Details:** Low (164.00) breached trailing stop (164.47). Max gain was 1.3%

---

### Trade #18: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-05-24 |
| **Entry Price** | $166.36 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $164.81 |
| **Exit Reason** | trailing_stop |
| **Return** | -0.93% |
| **Holding Period** | 35 days |
| **Max Gain** | +12.58% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0569, Threshold: 0.0

**Exit Details:** Low (159.37) breached trailing stop (164.81). Max gain was 12.6%

---

### Trade #19: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
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
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.0074, Threshold: 0.0

**Exit Details:** Close (144.63) broke below 200 SMA (153.27)

---

### Trade #20: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | acceleration_turn_up |
| **Entry Date** | 2024-10-11 |
| **Entry Price** | $167.89 |
| **Exit Date** | 2024-10-15 |
| **Exit Price** | $156.64 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.70% |
| **Holding Period** | 2 days |
| **Max Gain** | +0.60% |
| **Highest Price** | $168.90 (2024-10-14) |

**Entry Conditions:**
- ✓ `Acceleration Turn Up`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_20 > 0.0 → Actual: 0.1023, Threshold: 0.0

**Exit Details:** Close (156.64) broke below 200 SMA (162.46)

---

*...and 329 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

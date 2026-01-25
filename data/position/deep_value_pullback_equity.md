# Position Trading Backtest Report: deep_value_pullback

**Generated:** 2026-01-25 14:46:44

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | deep_value_pullback |
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
| **Signals Scanned** | 18,781 |
| **Entries Triggered** | 22 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 22 | Sample size |
| **Win Rate** | 59.1% | ✅ Good |
| **Profit Factor** | 8.06 | ✅ Profitable |
| **Avg Return** | +7.24% | Per-trade expectancy |
| **Avg Hold Period** | 1 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -6.38% | Maximum loss |
| **Reliability Score** | 91.1/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| technical_breakdown | 18 | Broke below 200 SMA |
| profit_target | 3 | 50% profit target reached |
| trailing_stop | 1 | Trailing stop triggered |

---

## Trade Journal (First 20 Trades)


### Trade #1: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-02 |
| **Entry Price** | $179.22 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $179.30 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.04% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.44% |
| **Highest Price** | $187.17 (2024-08-05) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1788, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 25.477, Threshold: 30.0

**Exit Details:** Close (179.30) broke below 200 SMA (186.20)

---

### Trade #2: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
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
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1616, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 25.8278, Threshold: 30.0

**Exit Details:** Close (139.99) broke below 200 SMA (153.59)

---

### Trade #3: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-01 |
| **Entry Price** | $132.54 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $132.50 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.03% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.44% |
| **Highest Price** | $137.10 (2024-08-02) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1683, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 16.4226, Threshold: 30.0

**Exit Details:** Close (132.50) broke below 200 SMA (154.34)

---

### Trade #4: CI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-12-17 |
| **Entry Price** | $260.26 |
| **Exit Date** | 2024-12-18 |
| **Exit Price** | $276.75 |
| **Exit Reason** | technical_breakdown |
| **Return** | +6.33% |
| **Holding Period** | 1 days |
| **Max Gain** | +9.23% |
| **Highest Price** | $284.29 (2024-12-18) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1573, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 5.4138, Threshold: 30.0

**Exit Details:** Close (276.75) broke below 200 SMA (330.11)

---

### Trade #5: CRM (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-05-30 |
| **Entry Price** | $215.64 |
| **Exit Date** | 2024-05-31 |
| **Exit Price** | $231.90 |
| **Exit Reason** | technical_breakdown |
| **Return** | +7.54% |
| **Holding Period** | 1 days |
| **Max Gain** | +8.80% |
| **Highest Price** | $234.62 (2024-05-31) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.2082, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 18.8739, Threshold: 30.0

**Exit Details:** Close (231.90) broke below 200 SMA (251.81)

---

### Trade #6: INTC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-02 |
| **Entry Price** | $21.34 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $19.98 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.38% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.00% |
| **Highest Price** | $21.34 (2024-08-02) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.3342, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 10.7624, Threshold: 30.0

**Exit Details:** Close (19.98) broke below 200 SMA (38.07)

---

### Trade #7: INTC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-06 |
| **Entry Price** | $19.70 |
| **Exit Date** | 2024-08-07 |
| **Exit Price** | $18.99 |
| **Exit Reason** | technical_breakdown |
| **Return** | -3.61% |
| **Holding Period** | 1 days |
| **Max Gain** | +2.79% |
| **Highest Price** | $20.25 (2024-08-07) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.3568, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 9.2481, Threshold: 30.0

**Exit Details:** Close (18.99) broke below 200 SMA (37.91)

---

### Trade #8: INTC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-08 |
| **Entry Price** | $20.49 |
| **Exit Date** | 2024-08-09 |
| **Exit Price** | $19.71 |
| **Exit Reason** | technical_breakdown |
| **Return** | -3.81% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.00% |
| **Highest Price** | $20.49 (2024-08-08) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.2984, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 15.4403, Threshold: 30.0

**Exit Details:** Close (19.71) broke below 200 SMA (37.78)

---

### Trade #9: INTC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-12 |
| **Entry Price** | $19.36 |
| **Exit Date** | 2024-08-13 |
| **Exit Price** | $20.47 |
| **Exit Reason** | technical_breakdown |
| **Return** | +5.73% |
| **Holding Period** | 1 days |
| **Max Gain** | +5.79% |
| **Highest Price** | $20.48 (2024-08-13) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.302, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 13.0197, Threshold: 30.0

**Exit Details:** Close (20.47) broke below 200 SMA (37.64)

---

### Trade #10: INTC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-14 |
| **Entry Price** | $19.92 |
| **Exit Date** | 2024-08-15 |
| **Exit Price** | $20.69 |
| **Exit Reason** | technical_breakdown |
| **Return** | +3.87% |
| **Holding Period** | 1 days |
| **Max Gain** | +5.72% |
| **Highest Price** | $21.06 (2024-08-15) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.2437, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 19.3484, Threshold: 30.0

**Exit Details:** Close (20.69) broke below 200 SMA (37.51)

---

### Trade #11: INTC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-16 |
| **Entry Price** | $20.87 |
| **Exit Date** | 2024-08-19 |
| **Exit Price** | $21.52 |
| **Exit Reason** | technical_breakdown |
| **Return** | +3.11% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.74% |
| **Highest Price** | $21.86 (2024-08-19) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1667, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 23.0288, Threshold: 30.0

**Exit Details:** Close (21.52) broke below 200 SMA (37.37)

---

### Trade #12: LRCX (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-01 |
| **Entry Price** | $81.80 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $122.70 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +884.65% |
| **Highest Price** | $805.43 (2024-08-02) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1556, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 27.2758, Threshold: 30.0

**Exit Details:** High (805.43) reached 50% profit target (122.70)

---

### Trade #13: LRCX (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-05 |
| **Entry Price** | $75.89 |
| **Exit Date** | 2024-08-06 |
| **Exit Price** | $113.84 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +947.49% |
| **Highest Price** | $794.98 (2024-08-06) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1895, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 24.2795, Threshold: 30.0

**Exit Details:** High (794.98) reached 50% profit target (113.84)

---

### Trade #14: LRCX (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-07 |
| **Entry Price** | $73.69 |
| **Exit Date** | 2024-08-08 |
| **Exit Price** | $110.54 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +987.19% |
| **Highest Price** | $801.18 (2024-08-08) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1819, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 29.2558, Threshold: 30.0

**Exit Details:** High (801.18) reached 50% profit target (110.54)

---

### Trade #15: NKE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-06-28 |
| **Entry Price** | $72.94 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $74.35 |
| **Exit Reason** | technical_breakdown |
| **Return** | +1.94% |
| **Holding Period** | 1 days |
| **Max Gain** | +5.65% |
| **Highest Price** | $77.06 (2024-07-01) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1989, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 15.2328, Threshold: 30.0

**Exit Details:** Close (74.35) broke below 200 SMA (96.24)

---

### Trade #16: NKE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-07-02 |
| **Entry Price** | $73.59 |
| **Exit Date** | 2024-07-03 |
| **Exit Price** | $72.81 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.05% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.17% |
| **Highest Price** | $75.92 (2024-07-03) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1759, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 19.0445, Threshold: 30.0

**Exit Details:** Close (72.81) broke below 200 SMA (96.05)

---

### Trade #17: NKE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-07-05 |
| **Entry Price** | $73.00 |
| **Exit Date** | 2024-07-08 |
| **Exit Price** | $70.69 |
| **Exit Reason** | technical_breakdown |
| **Return** | -3.16% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.41% |
| **Highest Price** | $75.49 (2024-07-08) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1651, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 19.0902, Threshold: 30.0

**Exit Details:** Close (70.69) broke below 200 SMA (95.86)

---

### Trade #18: NKE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-07-09 |
| **Entry Price** | $70.12 |
| **Exit Date** | 2024-07-10 |
| **Exit Price** | $70.20 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.11% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.59% |
| **Highest Price** | $72.64 (2024-07-10) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1767, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 13.5277, Threshold: 30.0

**Exit Details:** Close (70.20) broke below 200 SMA (95.67)

---

### Trade #19: NVDA (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-07-30 |
| **Entry Price** | $103.69 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $105.74 |
| **Exit Reason** | trailing_stop |
| **Return** | +1.98% |
| **Holding Period** | 3 days |
| **Max Gain** | +15.89% |
| **Highest Price** | $120.16 (2024-08-01) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.15, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 21.0438, Threshold: 30.0

**Exit Details:** Low (101.37) breached trailing stop (105.74). Max gain was 15.9%

---

### Trade #20: QCOM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_value_pullback |
| **Entry Date** | 2024-08-02 |
| **Entry Price** | $154.21 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $152.89 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.85% |
| **Holding Period** | 1 days |
| **Max Gain** | +5.59% |
| **Highest Price** | $162.82 (2024-08-05) |

**Entry Conditions:**
- ✓ `Extended Below 20 MA`: ma_dist_20 < -0.15 → Actual: -0.1588, Threshold: -0.15
- ✓ `RSI Very Oversold`: rsi_14 < 30.0 → Actual: 27.0886, Threshold: 30.0

**Exit Details:** Close (152.89) broke below 200 SMA (156.69)

---

*...and 2 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

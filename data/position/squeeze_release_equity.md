# Position Trading Backtest Report: squeeze_release

**Generated:** 2026-01-25 14:47:12

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | squeeze_release |
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
| **Signals Scanned** | 12,787 |
| **Entries Triggered** | 87 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 87 | Sample size |
| **Win Rate** | 55.2% | ✅ Good |
| **Profit Factor** | 1.99 | ✅ Profitable |
| **Avg Return** | +2.97% | Per-trade expectancy |
| **Avg Hold Period** | 87 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -13.40% | Maximum loss |
| **Reliability Score** | 89.3/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 62 | Trailing stop triggered |
| technical_breakdown | 21 | Broke below 200 SMA |
| profit_target | 4 | 50% profit target reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
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
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0547, Threshold: 0.0

**Exit Details:** Low (228.03) breached trailing stop (228.89). Max gain was 16.4%

---

### Trade #2: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-07-31 |
| **Entry Price** | $177.56 |
| **Exit Date** | 2024-11-11 |
| **Exit Price** | $182.44 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.75% |
| **Holding Period** | 72 days |
| **Max Gain** | +16.76% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0517, Threshold: 0.0

**Exit Details:** Low (172.70) breached trailing stop (182.44). Max gain was 16.8%

---

### Trade #3: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-08-07 |
| **Entry Price** | $107.36 |
| **Exit Date** | 2025-07-17 |
| **Exit Price** | $120.05 |
| **Exit Reason** | trailing_stop |
| **Return** | +11.81% |
| **Holding Period** | 235 days |
| **Max Gain** | +31.54% |
| **Highest Price** | $141.23 (2025-03-04) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0378, Threshold: 0.0

**Exit Details:** Low (119.77) breached trailing stop (120.05). Max gain was 31.5%

---

### Trade #4: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-08-27 |
| **Entry Price** | $331.86 |
| **Exit Date** | 2025-02-28 |
| **Exit Price** | $345.36 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.07% |
| **Holding Period** | 126 days |
| **Max Gain** | +20.03% |
| **Highest Price** | $398.35 (2025-02-05) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0303, Threshold: 0.0

**Exit Details:** Low (342.41) breached trailing stop (345.36). Max gain was 20.0%

---

### Trade #5: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-05-07 |
| **Entry Price** | $197.80 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.92% |
| **Holding Period** | 60 days |
| **Max Gain** | +23.43% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0148, Threshold: 0.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 23.4%

---

### Trade #6: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-06-12 |
| **Entry Price** | $234.26 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $217.51 |
| **Exit Reason** | trailing_stop |
| **Return** | -7.15% |
| **Holding Period** | 24 days |
| **Max Gain** | +9.23% |
| **Highest Price** | $255.89 (2024-07-10) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0639, Threshold: 0.0

**Exit Details:** Low (213.25) breached trailing stop (217.51). Max gain was 9.2%

---

### Trade #7: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-07-08 |
| **Entry Price** | $178.69 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $159.19 |
| **Exit Reason** | trailing_stop |
| **Return** | -10.91% |
| **Holding Period** | 8 days |
| **Max Gain** | +4.81% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.1016, Threshold: 0.0

**Exit Details:** Low (153.20) breached trailing stop (159.19). Max gain was 4.8%

---

### Trade #8: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-03-28 |
| **Entry Price** | $180.38 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $177.06 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.84% |
| **Holding Period** | 81 days |
| **Max Gain** | +11.54% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0125, Threshold: 0.0

**Exit Details:** Low (176.80) breached trailing stop (177.06). Max gain was 11.5%

---

### Trade #9: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-09-12 |
| **Entry Price** | $187.00 |
| **Exit Date** | 2025-02-25 |
| **Exit Price** | $206.14 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.24% |
| **Holding Period** | 112 days |
| **Max Gain** | +29.69% |
| **Highest Price** | $242.52 (2025-02-04) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0512, Threshold: 0.0

**Exit Details:** Low (204.16) breached trailing stop (206.14). Max gain was 29.7%

---

### Trade #10: AON (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-07-29 |
| **Entry Price** | $315.44 |
| **Exit Date** | 2025-04-25 |
| **Exit Price** | $351.02 |
| **Exit Reason** | trailing_stop |
| **Return** | +11.28% |
| **Holding Period** | 186 days |
| **Max Gain** | +30.92% |
| **Highest Price** | $412.97 (2025-03-03) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0674, Threshold: 0.0

**Exit Details:** Low (323.73) breached trailing stop (351.02). Max gain was 30.9%

---

### Trade #11: APD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-10-14 |
| **Entry Price** | $312.37 |
| **Exit Date** | 2025-01-02 |
| **Exit Price** | $286.45 |
| **Exit Reason** | trailing_stop |
| **Return** | -8.30% |
| **Holding Period** | 55 days |
| **Max Gain** | +7.89% |
| **Highest Price** | $337.00 (2024-12-03) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0245, Threshold: 0.0

**Exit Details:** Low (282.86) breached trailing stop (286.45). Max gain was 7.9%

---

### Trade #12: AVGO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-08-14 |
| **Entry Price** | $155.38 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $151.73 |
| **Exit Reason** | trailing_stop |
| **Return** | -2.35% |
| **Holding Period** | 13 days |
| **Max Gain** | +10.97% |
| **Highest Price** | $172.42 (2024-08-22) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.1572, Threshold: 0.0

**Exit Details:** Low (151.38) breached trailing stop (151.73). Max gain was 11.0%

---

### Trade #13: AXP (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-04-23 |
| **Entry Price** | $235.07 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $268.09 |
| **Exit Reason** | trailing_stop |
| **Return** | +14.04% |
| **Holding Period** | 218 days |
| **Max Gain** | +38.80% |
| **Highest Price** | $326.27 (2025-01-23) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0944, Threshold: 0.0

**Exit Details:** Low (264.71) breached trailing stop (268.09). Max gain was 38.8%

---

### Trade #14: BAC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-07-17 |
| **Entry Price** | $42.47 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $37.60 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.45% |
| **Holding Period** | 12 days |
| **Max Gain** | +4.18% |
| **Highest Price** | $44.24 (2024-07-18) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0537, Threshold: 0.0

**Exit Details:** Low (37.18) breached trailing stop (37.60). Max gain was 4.2%

---

### Trade #15: BAC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-08-28 |
| **Entry Price** | $38.57 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $40.87 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.95% |
| **Holding Period** | 130 days |
| **Max Gain** | +24.64% |
| **Highest Price** | $48.08 (2024-11-29) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.031, Threshold: 0.0

**Exit Details:** Low (40.61) breached trailing stop (40.87). Max gain was 24.6%

---

### Trade #16: BKNG (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-05-08 |
| **Entry Price** | $3610.45 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $3647.00 |
| **Exit Reason** | trailing_stop |
| **Return** | +1.01% |
| **Holding Period** | 53 days |
| **Max Gain** | +14.79% |
| **Highest Price** | $4144.32 (2024-07-16) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0715, Threshold: 0.0

**Exit Details:** Low (3643.05) breached trailing stop (3647.00). Max gain was 14.8%

---

### Trade #17: BLK (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-09-24 |
| **Entry Price** | $917.80 |
| **Exit Date** | 2025-01-10 |
| **Exit Price** | $952.56 |
| **Exit Reason** | trailing_stop |
| **Return** | +3.79% |
| **Holding Period** | 74 days |
| **Max Gain** | +17.94% |
| **Highest Price** | $1082.45 (2024-12-11) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0406, Threshold: 0.0

**Exit Details:** Low (948.16) breached trailing stop (952.56). Max gain was 17.9%

---

### Trade #18: BMY (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-07-26 |
| **Entry Price** | $47.52 |
| **Exit Date** | 2025-04-07 |
| **Exit Price** | $53.83 |
| **Exit Reason** | trailing_stop |
| **Return** | +13.27% |
| **Holding Period** | 174 days |
| **Max Gain** | +33.26% |
| **Highest Price** | $63.33 (2025-03-11) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.1832, Threshold: 0.0

**Exit Details:** Low (52.69) breached trailing stop (53.83). Max gain was 33.3%

---

### Trade #19: BRK-B (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-07-11 |
| **Entry Price** | $418.78 |
| **Exit Date** | 2025-07-15 |
| **Exit Price** | $470.13 |
| **Exit Reason** | technical_breakdown |
| **Return** | +12.26% |
| **Holding Period** | 252 days |
| **Max Gain** | +29.44% |
| **Highest Price** | $542.07 (2025-05-02) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0321, Threshold: 0.0

**Exit Details:** Close (470.13) broke below 200 SMA (484.11)

---

### Trade #20: CAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_release |
| **Entry Date** | 2024-03-18 |
| **Entry Price** | $342.77 |
| **Exit Date** | 2024-04-25 |
| **Exit Price** | $336.17 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.93% |
| **Holding Period** | 27 days |
| **Max Gain** | +11.45% |
| **Highest Price** | $382.01 (2024-04-08) |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0505, Threshold: 0.0

**Exit Details:** Low (330.32) breached trailing stop (336.17). Max gain was 11.4%

---

*...and 67 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

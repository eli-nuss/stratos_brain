# Position Trading Backtest Report: drawdown_recovery

**Generated:** 2026-01-25 14:57:01

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | drawdown_recovery |
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
| **Signals Scanned** | 18,759 |
| **Entries Triggered** | 16 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 16 | Sample size |
| **Win Rate** | 43.8% | ⚠️ Below 50% |
| **Profit Factor** | 2.95 | ✅ Profitable |
| **Avg Return** | +2.60% | Per-trade expectancy |
| **Avg Hold Period** | 3 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -14.32% | Maximum loss |
| **Reliability Score** | 71.8/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| technical_breakdown | 14 | Broke below 200 SMA |
| trailing_stop | 1 | Trailing stop triggered |
| profit_target | 1 | 50% profit target reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-07-31 |
| **Entry Price** | $209.17 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $179.22 |
| **Exit Reason** | technical_breakdown |
| **Return** | -14.32% |
| **Holding Period** | 2 days |
| **Max Gain** | +0.00% |
| **Highest Price** | $209.17 (2024-07-31) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.1677, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0275, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 36.01, Threshold: 40.0

**Exit Details:** Close (179.22) broke below 200 SMA (186.00)

---

### Trade #2: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-08-09 |
| **Entry Price** | $188.45 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $187.44 |
| **Exit Reason** | trailing_stop |
| **Return** | -0.54% |
| **Holding Period** | 16 days |
| **Max Gain** | +13.02% |
| **Highest Price** | $213.00 (2024-08-15) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.2223, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0515, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 33.8307, Threshold: 40.0

**Exit Details:** Low (182.50) breached trailing stop (187.44). Max gain was 13.0%

---

### Trade #3: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-08-08 |
| **Entry Price** | $136.32 |
| **Exit Date** | 2024-08-09 |
| **Exit Price** | $134.27 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.50% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.00% |
| **Highest Price** | $136.32 (2024-08-08) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.2494, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0285, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 37.1115, Threshold: 40.0

**Exit Details:** Close (134.27) broke below 200 SMA (155.10)

---

### Trade #4: BKNG (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-08-09 |
| **Entry Price** | $3404.23 |
| **Exit Date** | 2024-08-12 |
| **Exit Price** | $3400.40 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.11% |
| **Holding Period** | 1 days |
| **Max Gain** | +1.98% |
| **Highest Price** | $3471.47 (2024-08-12) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.1641, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0345, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 29.3506, Threshold: 40.0

**Exit Details:** Close (3400.40) broke below 200 SMA (3499.88)

---

### Trade #5: CRM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-06-06 |
| **Entry Price** | $240.13 |
| **Exit Date** | 2024-06-07 |
| **Exit Price** | $239.23 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.37% |
| **Holding Period** | 1 days |
| **Max Gain** | +1.58% |
| **Highest Price** | $243.93 (2024-06-07) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.1557, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.1135, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 29.7331, Threshold: 40.0

**Exit Details:** Close (239.23) broke below 200 SMA (252.61)

---

### Trade #6: CRM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-06-10 |
| **Entry Price** | $239.22 |
| **Exit Date** | 2024-06-11 |
| **Exit Price** | $238.37 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.35% |
| **Holding Period** | 1 days |
| **Max Gain** | +1.90% |
| **Highest Price** | $243.75 (2024-06-11) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.1589, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0221, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 27.8176, Threshold: 40.0

**Exit Details:** Close (238.37) broke below 200 SMA (252.95)

---

### Trade #7: INTC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-08-13 |
| **Entry Price** | $20.47 |
| **Exit Date** | 2024-08-14 |
| **Exit Price** | $19.92 |
| **Exit Reason** | technical_breakdown |
| **Return** | -2.69% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.15% |
| **Highest Price** | $20.50 (2024-08-14) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.4091, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0391, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 19.2987, Threshold: 40.0

**Exit Details:** Close (19.92) broke below 200 SMA (37.58)

---

### Trade #8: INTC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
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
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.3705, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0589, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 23.0288, Threshold: 40.0

**Exit Details:** Close (21.52) broke below 200 SMA (37.37)

---

### Trade #9: INTC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-08-20 |
| **Entry Price** | $20.99 |
| **Exit Date** | 2024-08-21 |
| **Exit Price** | $21.41 |
| **Exit Reason** | technical_breakdown |
| **Return** | +2.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +2.14% |
| **Highest Price** | $21.44 (2024-08-21) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.3335, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0254, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 23.4292, Threshold: 40.0

**Exit Details:** Close (21.41) broke below 200 SMA (37.21)

---

### Trade #10: LLY (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-11-25 |
| **Entry Price** | $749.47 |
| **Exit Date** | 2024-11-26 |
| **Exit Price** | $783.54 |
| **Exit Reason** | technical_breakdown |
| **Return** | +4.55% |
| **Holding Period** | 1 days |
| **Max Gain** | +7.68% |
| **Highest Price** | $807.00 (2024-11-26) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.163, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0382, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 39.1093, Threshold: 40.0

**Exit Details:** Close (783.54) broke below 200 SMA (827.53)

---

### Trade #11: LRCX (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-08-09 |
| **Entry Price** | $79.59 |
| **Exit Date** | 2024-08-12 |
| **Exit Price** | $119.38 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +933.45% |
| **Highest Price** | $822.51 (2024-08-12) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.2492, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0588, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 31.5101, Threshold: 40.0

**Exit Details:** High (822.51) reached 50% profit target (119.38)

---

### Trade #12: QCOM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-08-09 |
| **Entry Price** | $159.21 |
| **Exit Date** | 2024-09-03 |
| **Exit Price** | $158.01 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.75% |
| **Holding Period** | 16 days |
| **Max Gain** | +10.77% |
| **Highest Price** | $176.36 (2024-08-29) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.2154, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0325, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 32.483, Threshold: 40.0

**Exit Details:** Close (158.01) broke below 200 SMA (162.13)

---

### Trade #13: TGT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-11-27 |
| **Entry Price** | $124.55 |
| **Exit Date** | 2024-11-29 |
| **Exit Price** | $126.67 |
| **Exit Reason** | technical_breakdown |
| **Return** | +1.71% |
| **Holding Period** | 1 days |
| **Max Gain** | +6.66% |
| **Highest Price** | $132.85 (2024-11-29) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.1614, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0688, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 35.0005, Threshold: 40.0

**Exit Details:** Close (126.67) broke below 200 SMA (144.61)

---

### Trade #14: TGT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-12-02 |
| **Entry Price** | $125.15 |
| **Exit Date** | 2024-12-03 |
| **Exit Price** | $125.85 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.56% |
| **Holding Period** | 1 days |
| **Max Gain** | +5.29% |
| **Highest Price** | $131.77 (2024-12-03) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.1574, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0457, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 33.4766, Threshold: 40.0

**Exit Details:** Close (125.85) broke below 200 SMA (144.49)

---

### Trade #15: TGT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-12-04 |
| **Entry Price** | $124.53 |
| **Exit Date** | 2024-12-05 |
| **Exit Price** | $123.67 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.69% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.79% |
| **Highest Price** | $130.50 (2024-12-05) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.1616, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0278, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 31.3869, Threshold: 40.0

**Exit Details:** Close (123.67) broke below 200 SMA (144.33)

---

### Trade #16: TSLA (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | drawdown_recovery |
| **Entry Date** | 2024-03-22 |
| **Entry Price** | $170.83 |
| **Exit Date** | 2024-03-25 |
| **Exit Price** | $172.63 |
| **Exit Reason** | technical_breakdown |
| **Return** | +1.05% |
| **Holding Period** | 1 days |
| **Max Gain** | +2.58% |
| **Highest Price** | $175.24 (2024-03-25) |

**Entry Conditions:**
- ✓ `Significant Drawdown`: drawdown_20d < -0.15 → Actual: -0.157, Threshold: -0.15
- ✓ `Starting to Recover`: roc_5 > 0.02 → Actual: 0.0444, Threshold: 0.02
- ✓ `RSI Oversold`: rsi_14 < 40.0 → Actual: 34.9922, Threshold: 40.0

**Exit Details:** Close (172.63) broke below 200 SMA (233.12)

---

---

*Report generated by Stratos Brain Position Trading Backtester*

# Position Trading Backtest Report: deep_oversold_bounce

**Generated:** 2026-01-25 14:56:42

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | deep_oversold_bounce |
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
| **Signals Scanned** | 18,799 |
| **Entries Triggered** | 7 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 7 | Sample size |
| **Win Rate** | 71.4% | ✅ Good |
| **Profit Factor** | 24.15 | ✅ Profitable |
| **Avg Return** | +8.01% | Per-trade expectancy |
| **Avg Hold Period** | 1 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -1.39% | Maximum loss |
| **Reliability Score** | 87.1/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| technical_breakdown | 6 | Broke below 200 SMA |
| profit_target | 1 | 50% profit target reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_oversold_bounce |
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
- ✓ `Very Oversold`: rsi_14 < 25.0 → Actual: 16.8232, Threshold: 25.0
- ✓ `Extended Below MA`: ma_dist_20 < -0.15 → Actual: -0.1582, Threshold: -0.15
- ✓ `Acceleration Turning`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Close (134.82) broke below 200 SMA (154.48)

---

### Trade #2: INTC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_oversold_bounce |
| **Entry Date** | 2024-08-05 |
| **Entry Price** | $19.98 |
| **Exit Date** | 2024-08-06 |
| **Exit Price** | $19.70 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.39% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.26% |
| **Highest Price** | $20.63 (2024-08-06) |

**Entry Conditions:**
- ✓ `Very Oversold`: rsi_14 < 25.0 → Actual: 10.0063, Threshold: 25.0
- ✓ `Extended Below MA`: ma_dist_20 < -0.15 → Actual: -0.363, Threshold: -0.15
- ✓ `Acceleration Turning`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Close (19.70) broke below 200 SMA (37.99)

---

### Trade #3: INTC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_oversold_bounce |
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
- ✓ `Very Oversold`: rsi_14 < 25.0 → Actual: 13.0197, Threshold: 25.0
- ✓ `Extended Below MA`: ma_dist_20 < -0.15 → Actual: -0.302, Threshold: -0.15
- ✓ `Acceleration Turning`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Close (20.47) broke below 200 SMA (37.64)

---

### Trade #4: INTC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_oversold_bounce |
| **Entry Date** | 2024-08-15 |
| **Entry Price** | $20.69 |
| **Exit Date** | 2024-08-16 |
| **Exit Price** | $20.87 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.87% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.99% |
| **Highest Price** | $20.89 (2024-08-16) |

**Entry Conditions:**
- ✓ `Very Oversold`: rsi_14 < 25.0 → Actual: 21.6313, Threshold: 25.0
- ✓ `Extended Below MA`: ma_dist_20 < -0.15 → Actual: -0.193, Threshold: -0.15
- ✓ `Acceleration Turning`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Close (20.87) broke below 200 SMA (37.44)

---

### Trade #5: LRCX (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_oversold_bounce |
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
- ✓ `Very Oversold`: rsi_14 < 25.0 → Actual: 24.2795, Threshold: 25.0
- ✓ `Extended Below MA`: ma_dist_20 < -0.15 → Actual: -0.1895, Threshold: -0.15
- ✓ `Acceleration Turning`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** High (794.98) reached 50% profit target (113.84)

---

### Trade #6: NKE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | deep_oversold_bounce |
| **Entry Date** | 2024-07-01 |
| **Entry Price** | $74.35 |
| **Exit Date** | 2024-07-02 |
| **Exit Price** | $73.59 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.03% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.48% |
| **Highest Price** | $76.94 (2024-07-02) |

**Entry Conditions:**
- ✓ `Very Oversold`: rsi_14 < 25.0 → Actual: 19.4452, Threshold: 25.0
- ✓ `Extended Below MA`: ma_dist_20 < -0.15 → Actual: -0.1755, Threshold: -0.15
- ✓ `Acceleration Turning`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Close (73.59) broke below 200 SMA (96.15)

---

### Trade #7: NKE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | deep_oversold_bounce |
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
- ✓ `Very Oversold`: rsi_14 < 25.0 → Actual: 13.5277, Threshold: 25.0
- ✓ `Extended Below MA`: ma_dist_20 < -0.15 → Actual: -0.1767, Threshold: -0.15
- ✓ `Acceleration Turning`: accel_turn_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Close (70.20) broke below 200 SMA (95.67)

---

---

*Report generated by Stratos Brain Position Trading Backtester*

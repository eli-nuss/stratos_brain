# Backtest Report: momentum_acceleration

**Generated:** 2026-01-25 14:30:54

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | momentum_acceleration |
| **Universe** | equity |
| **Date Range** | 2023-01-01 to 2025-12-31 |

### Parameters

```json
{
  "droc_thresh": 0.01,
  "rvol_thresh": 1.5,
  "stop_loss_atr_mult": 1.5,
  "take_profit_r_mult": 2.0,
  "max_hold_days": 10
}
```

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 500 |
| **Assets Skipped** | 0 |
| **Signals Scanned** | 223,422 |
| **Entries Triggered** | 7898 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 7898 | Sample size |
| **Win Rate** | 42.5% | ⚠️ Below 50% |
| **Profit Factor** | 0.94 | ❌ Unprofitable |
| **Avg Return** | -0.33% | Per-trade expectancy |
| **Sharpe Ratio** | -0.34 | Risk-adjusted return |
| **Reliability Score** | 44.5/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
| stop_loss | 2900 |
| time_exit | 3619 |
| take_profit | 1379 |

---

## Trade Journal (First 20 Trades)


### Trade #1: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-02-29 |
| **Entry Price** | $16.8538 |
| **Stop Loss** | $15.0287 |
| **Take Profit** | $20.5039 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-03-01 |
| **Exit Price** | $15.0287 |
| **Exit Reason** | stop_loss |
| **Return** | -10.83% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.1891, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 13.3657, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 63.5822, Threshold: 50.0

**Exit Details:** Low (14.5400) breached stop loss (15.0287)

---

### Trade #2: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-03-08 |
| **Entry Price** | $15.1731 |
| **Stop Loss** | $13.1578 |
| **Take Profit** | $19.2037 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-03-15 |
| **Exit Price** | $13.1578 |
| **Exit Reason** | stop_loss |
| **Return** | -13.28% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0976, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.8182, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 58.3636, Threshold: 50.0

**Exit Details:** Low (13.0300) breached stop loss (13.1578)

---

### Trade #3: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-03-22 |
| **Entry Price** | $13.6990 |
| **Stop Loss** | $11.7651 |
| **Take Profit** | $17.5668 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-04-08 |
| **Exit Price** | $11.7460 |
| **Exit Reason** | time_exit |
| **Return** | -14.26% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.1055, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.5257, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 50.3966, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 11.7460

---

### Trade #4: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-03-25 |
| **Entry Price** | $15.0229 |
| **Stop Loss** | $12.9376 |
| **Take Profit** | $19.1935 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-04-08 |
| **Exit Price** | $12.9376 |
| **Exit Reason** | stop_loss |
| **Return** | -13.88% |
| **Holding Period** | 9 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0953, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 3.2132, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 59.4562, Threshold: 50.0

**Exit Details:** Low (12.0000) breached stop loss (12.9376)

---

### Trade #5: -P-HIZ (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-05-14 |
| **Entry Price** | $15.4923 |
| **Stop Loss** | $13.4939 |
| **Take Profit** | $19.4890 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-05-24 |
| **Exit Price** | $19.4890 |
| **Exit Reason** | take_profit |
| **Return** | +25.80% |
| **Holding Period** | 8 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.3357, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 16.1744, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 80.4511, Threshold: 50.0

**Exit Details:** High (22.4000) reached take profit (19.4890)

---

### Trade #6: -P-HIZ (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-06-21 |
| **Entry Price** | $19.6236 |
| **Stop Loss** | $17.7618 |
| **Take Profit** | $23.3472 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-24 |
| **Exit Price** | $23.3472 |
| **Exit Reason** | take_profit |
| **Return** | +18.97% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.1056, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 4.0488, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 72.222, Threshold: 50.0

**Exit Details:** High (25.0500) reached take profit (23.3472)

---

### Trade #7: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-06-24 |
| **Entry Price** | $23.4732 |
| **Stop Loss** | $21.0975 |
| **Take Profit** | $28.2246 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-25 |
| **Exit Price** | $21.0975 |
| **Exit Reason** | stop_loss |
| **Return** | -10.12% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.2279, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 4.7005, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 88.8892, Threshold: 50.0

**Exit Details:** Low (20.9100) breached stop loss (21.0975)

---

### Trade #8: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-09-03 |
| **Entry Price** | $21.5954 |
| **Stop Loss** | $18.7765 |
| **Take Profit** | $27.2333 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-09-17 |
| **Exit Price** | $19.9522 |
| **Exit Reason** | time_exit |
| **Return** | -7.61% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.2076, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 3.7457, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 70.799, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 19.9522

---

### Trade #9: -P-HIZ (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-09-05 |
| **Entry Price** | $20.0931 |
| **Stop Loss** | $16.8368 |
| **Take Profit** | $26.6057 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-09-19 |
| **Exit Price** | $20.9005 |
| **Exit Reason** | time_exit |
| **Return** | +4.02% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0727, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 3.4886, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 70.858, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 20.9005

---

### Trade #10: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-09-06 |
| **Entry Price** | $20.9193 |
| **Stop Loss** | $17.5360 |
| **Take Profit** | $27.6860 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-09-20 |
| **Exit Price** | $17.4547 |
| **Exit Reason** | time_exit |
| **Return** | -16.56% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0488, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 3.6855, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 72.8474, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 17.4547

---

### Trade #11: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-09-10 |
| **Entry Price** | $20.6283 |
| **Stop Loss** | $16.9639 |
| **Take Profit** | $27.9571 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-09-24 |
| **Exit Price** | $17.4547 |
| **Exit Reason** | time_exit |
| **Return** | -15.38% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.015, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.1681, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 70.3059, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 17.4547

---

### Trade #12: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-10-31 |
| **Entry Price** | $21.8395 |
| **Stop Loss** | $19.5750 |
| **Take Profit** | $26.3684 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-11-14 |
| **Exit Price** | $19.2480 |
| **Exit Reason** | time_exit |
| **Return** | -11.87% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.058, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.9074, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 59.0522, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 19.2480

---

### Trade #13: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2024-12-06 |
| **Entry Price** | $20.8442 |
| **Stop Loss** | $18.6321 |
| **Take Profit** | $25.2683 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-12-20 |
| **Exit Price** | $19.6706 |
| **Exit Reason** | time_exit |
| **Return** | -5.63% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0714, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.8327, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 51.5433, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 19.6706

---

### Trade #14: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2025-04-22 |
| **Entry Price** | $20.6564 |
| **Stop Loss** | $18.4804 |
| **Take Profit** | $25.0084 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-29 |
| **Exit Price** | $18.4804 |
| **Exit Reason** | stop_loss |
| **Return** | -10.53% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.074, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 4.9249, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 54.1046, Threshold: 50.0

**Exit Details:** Low (18.3300) breached stop loss (18.4804)

---

### Trade #15: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2025-04-25 |
| **Entry Price** | $20.0931 |
| **Stop Loss** | $17.6231 |
| **Take Profit** | $25.0330 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-05-09 |
| **Exit Price** | $19.1541 |
| **Exit Reason** | time_exit |
| **Return** | -4.67% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0416, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 3.1873, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 50.0508, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 19.1541

---

### Trade #16: -P-HIZ (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2025-06-09 |
| **Entry Price** | $17.7645 |
| **Stop Loss** | $15.7666 |
| **Take Profit** | $21.7603 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-06-24 |
| **Exit Price** | $19.3869 |
| **Exit Reason** | time_exit |
| **Return** | +9.13% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0206, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.431, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 62.4992, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 19.3869

---

### Trade #17: -P-HIZ (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2025-06-17 |
| **Entry Price** | $18.9992 |
| **Stop Loss** | $16.8692 |
| **Take Profit** | $23.2592 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-07-02 |
| **Exit Price** | $19.3385 |
| **Exit Reason** | time_exit |
| **Return** | +1.79% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0441, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 3.2139, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 80.6445, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 19.3385

---

### Trade #18: -P-HIZ (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2025-06-24 |
| **Entry Price** | $19.3869 |
| **Stop Loss** | $17.0914 |
| **Take Profit** | $23.9780 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-07-09 |
| **Exit Price** | $18.3206 |
| **Exit Reason** | time_exit |
| **Return** | -5.50% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.1232, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 4.9583, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 66.1431, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 18.3206

---

### Trade #19: -P-HIZ (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2025-07-08 |
| **Entry Price** | $18.9992 |
| **Stop Loss** | $17.3347 |
| **Take Profit** | $22.3282 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-07-22 |
| **Exit Price** | $19.2900 |
| **Exit Reason** | time_exit |
| **Return** | +1.53% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0875, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.9393, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 55.389, Threshold: 50.0

**Exit Details:** Max holding period (10 days) reached. Closed at 19.2900

---

### Trade #20: -P-HIZ (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | momentum_acceleration |
| **Entry Date** | 2025-08-21 |
| **Entry Price** | $18.4176 |
| **Stop Loss** | $16.9104 |
| **Take Profit** | $21.4320 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-08-26 |
| **Exit Price** | $21.4320 |
| **Exit Reason** | take_profit |
| **Return** | +16.37% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `Momentum Accelerating`: droc_20 > 0.01 → Actual: 0.0523, Threshold: 0.01
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 4.5738, Threshold: 1.5
- ✓ `Positive RSI`: rsi_14 > 50.0 → Actual: 72.8907, Threshold: 50.0

**Exit Details:** High (21.6500) reached take profit (21.4320)

---

*...and 7878 more trades (see CSV export)*

---

*Report generated by Stratos Brain Production Backtester*

# Backtest Report: squeeze_breakout

**Generated:** 2026-01-25 14:30:10

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | squeeze_breakout |
| **Universe** | equity |
| **Date Range** | 2023-01-01 to 2025-12-31 |

### Parameters

```json
{
  "rvol_thresh": 1.5,
  "stop_loss_atr_mult": 1.5,
  "take_profit_r_mult": 2.5,
  "max_hold_days": 15
}
```

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 96 |
| **Assets Skipped** | 0 |
| **Signals Scanned** | 44,438 |
| **Entries Triggered** | 77 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 77 | Sample size |
| **Win Rate** | 50.6% | ✅ Good |
| **Profit Factor** | 1.39 | ✅ Profitable |
| **Avg Return** | +0.72% | Per-trade expectancy |
| **Sharpe Ratio** | 2.15 | Risk-adjusted return |
| **Reliability Score** | 74.9/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
| time_exit | 44 |
| take_profit | 10 |
| stop_loss | 23 |

---

## Trade Journal (First 20 Trades)


### Trade #1: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-01-23 |
| **Entry Price** | $121.5449 |
| **Stop Loss** | $116.1421 |
| **Take Profit** | $135.0519 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-02-13 |
| **Exit Price** | $129.9984 |
| **Exit Reason** | time_exit |
| **Return** | +6.96% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.4029, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.1091, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 129.9984

---

### Trade #2: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-01-28 |
| **Entry Price** | $371.9979 |
| **Stop Loss** | $353.8805 |
| **Take Profit** | $417.2914 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-02-19 |
| **Exit Price** | $383.6280 |
| **Exit Reason** | time_exit |
| **Return** | +3.13% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.5546, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0616, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 383.6280

---

### Trade #3: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-11-25 |
| **Entry Price** | $251.1293 |
| **Stop Loss** | $238.7577 |
| **Take Profit** | $282.0584 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-12-05 |
| **Exit Price** | $282.0584 |
| **Exit Reason** | take_profit |
| **Return** | +12.32% |
| **Holding Period** | 7 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.8693, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0951, Threshold: 0.0

**Exit Details:** High (283.2350) reached take profit (282.0584)

---

### Trade #4: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-03-01 |
| **Entry Price** | $202.6400 |
| **Stop Loss** | $189.5980 |
| **Take Profit** | $235.2449 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-03-14 |
| **Exit Price** | $189.5980 |
| **Exit Reason** | stop_loss |
| **Return** | -6.44% |
| **Holding Period** | 9 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.6171, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.148, Threshold: 0.0

**Exit Details:** Low (184.0300) breached stop loss (189.5980)

---

### Trade #5: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-11-01 |
| **Entry Price** | $197.9300 |
| **Stop Loss** | $190.7793 |
| **Take Profit** | $215.8068 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-11-14 |
| **Exit Price** | $215.8068 |
| **Exit Reason** | take_profit |
| **Return** | +9.03% |
| **Holding Period** | 9 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.8372, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0538, Threshold: 0.0

**Exit Details:** High (215.9000) reached take profit (215.8068)

---

### Trade #6: AON (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-01-21 |
| **Entry Price** | $365.0700 |
| **Stop Loss** | $354.3230 |
| **Take Profit** | $391.9374 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-02-11 |
| **Exit Price** | $381.7443 |
| **Exit Reason** | time_exit |
| **Return** | +4.57% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.5357, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0378, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 381.7443

---

### Trade #7: AXP (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-04-23 |
| **Entry Price** | $235.0742 |
| **Stop Loss** | $223.9797 |
| **Take Profit** | $262.8103 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-05-14 |
| **Exit Price** | $237.6024 |
| **Exit Reason** | time_exit |
| **Return** | +1.08% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.5173, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0944, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 237.6024

---

### Trade #8: BAC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-07-17 |
| **Entry Price** | $42.4655 |
| **Stop Loss** | $39.3955 |
| **Take Profit** | $50.1405 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-08-01 |
| **Exit Price** | $39.3955 |
| **Exit Reason** | stop_loss |
| **Return** | -7.23% |
| **Holding Period** | 11 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.7431, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0537, Threshold: 0.0

**Exit Details:** Low (38.9800) breached stop loss (39.3955)

---

### Trade #9: BAC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-01-16 |
| **Entry Price** | $45.5881 |
| **Stop Loss** | $43.1862 |
| **Take Profit** | $51.5929 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-02-07 |
| **Exit Price** | $46.3309 |
| **Exit Reason** | time_exit |
| **Return** | +1.63% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.6396, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0093, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 46.3309

---

### Trade #10: BKNG (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-02-08 |
| **Entry Price** | $3778.7186 |
| **Stop Loss** | $3609.0097 |
| **Take Profit** | $4202.9908 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-02-23 |
| **Exit Price** | $3609.0097 |
| **Exit Reason** | stop_loss |
| **Return** | -4.49% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.5866, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0792, Threshold: 0.0

**Exit Details:** Low (3491.3250) breached stop loss (3609.0097)

---

### Trade #11: BMY (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-07-26 |
| **Entry Price** | $47.5223 |
| **Stop Loss** | $42.0972 |
| **Take Profit** | $61.0852 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-08-16 |
| **Exit Price** | $46.4955 |
| **Exit Reason** | time_exit |
| **Return** | -2.16% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.1399, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.1832, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 46.4955

---

### Trade #12: CAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-02-02 |
| **Entry Price** | $306.9126 |
| **Stop Loss** | $288.7851 |
| **Take Profit** | $352.2314 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-02-26 |
| **Exit Price** | $316.9355 |
| **Exit Reason** | time_exit |
| **Return** | +3.27% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.7138, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0523, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 316.9355

---

### Trade #13: CAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-09-19 |
| **Entry Price** | $366.4337 |
| **Stop Loss** | $348.0225 |
| **Take Profit** | $412.4617 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-10-10 |
| **Exit Price** | $389.3340 |
| **Exit Reason** | time_exit |
| **Return** | +6.25% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.8698, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0993, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 389.3340

---

### Trade #14: CL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-03-07 |
| **Entry Price** | $95.0189 |
| **Stop Loss** | $89.9949 |
| **Take Profit** | $107.5788 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-03-14 |
| **Exit Price** | $89.9949 |
| **Exit Reason** | stop_loss |
| **Return** | -5.29% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 2.1888, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0611, Threshold: 0.0

**Exit Details:** Low (89.1800) breached stop loss (89.9949)

---

### Trade #15: COST (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-11-08 |
| **Entry Price** | $938.9159 |
| **Stop Loss** | $913.2475 |
| **Take Profit** | $1003.0869 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $913.2475 |
| **Exit Reason** | stop_loss |
| **Return** | -2.73% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.9693, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0758, Threshold: 0.0

**Exit Details:** Low (905.5613) breached stop loss (913.2475)

---

### Trade #16: CRM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-02-29 |
| **Entry Price** | $305.0682 |
| **Stop Loss** | $292.7065 |
| **Take Profit** | $335.9724 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-03-21 |
| **Exit Price** | $305.0434 |
| **Exit Reason** | time_exit |
| **Return** | -0.01% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 3.7346, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0517, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 305.0434

---

### Trade #17: CRM (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $304.5324 |
| **Stop Loss** | $294.1483 |
| **Take Profit** | $330.4927 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2024-11-11 |
| **Exit Price** | $330.4927 |
| **Exit Reason** | take_profit |
| **Return** | +8.52% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.581, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0354, Threshold: 0.0

**Exit Details:** High (344.8800) reached take profit (330.4927)

---

### Trade #18: CSCO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-06-23 |
| **Entry Price** | $66.5822 |
| **Stop Loss** | $64.2811 |
| **Take Profit** | $72.3350 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-07-15 |
| **Exit Price** | $66.7769 |
| **Exit Reason** | time_exit |
| **Return** | +0.29% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.7252, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0513, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 66.7769

---

### Trade #19: CSCO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-08-08 |
| **Entry Price** | $71.3592 |
| **Stop Loss** | $69.3800 |
| **Take Profit** | $76.3071 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-08-14 |
| **Exit Price** | $69.3800 |
| **Exit Reason** | stop_loss |
| **Return** | -2.77% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.8051, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0697, Threshold: 0.0

**Exit Details:** Low (67.4800) breached stop loss (69.3800)

---

### Trade #20: CVX (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | squeeze_breakout |
| **Entry Date** | 2025-06-13 |
| **Entry Price** | $142.6983 |
| **Stop Loss** | $135.3947 |
| **Take Profit** | $160.9573 |
| **Risk:Reward** | 1:2.5 |
| **Exit Date** | 2025-07-08 |
| **Exit Price** | $149.8670 |
| **Exit Reason** | time_exit |
| **Return** | +5.02% |
| **Holding Period** | 15 days |

**Entry Conditions:**
- ✓ `Squeeze Released`: squeeze_release == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above Average Volume`: rvol_20 > 1.5 → Actual: 1.6628, Threshold: 1.5
- ✓ `Positive Momentum`: roc_5 > 0.0 → Actual: 0.0407, Threshold: 0.0

**Exit Details:** Max holding period (15 days) reached. Closed at 149.8670

---

*...and 57 more trades (see CSV export)*

---

*Report generated by Stratos Brain Production Backtester*

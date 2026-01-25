# Backtest Report: standard_breakout

**Generated:** 2026-01-25 14:22:37

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | standard_breakout |
| **Universe** | crypto |
| **Date Range** | 2023-01-01 to 2025-12-31 |

### Parameters

```json
{
  "rvol_thresh": 2.0,
  "rsi_thresh": 60,
  "stop_loss_atr_mult": 1.5,
  "take_profit_r_mult": 2.0,
  "max_hold_days": 10
}
```

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 226 |
| **Assets Skipped** | 3 |
| **Signals Scanned** | 183,673 |
| **Entries Triggered** | 583 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 583 | Sample size |
| **Win Rate** | 50.1% | ✅ Good |
| **Profit Factor** | 2.55 | ✅ Profitable |
| **Avg Return** | +13.59% | Per-trade expectancy |
| **Sharpe Ratio** | 3.67 | Risk-adjusted return |
| **Reliability Score** | 91.5/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
| time_exit | 578 |
| stop_loss | 4 |
| take_profit | 1 |

---

## Trade Journal (First 20 Trades)


### Trade #1: AGENTFUN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-03-27 |
| **Entry Price** | $2.2071 |
| **Stop Loss** | $2.0716 |
| **Take Profit** | $2.4781 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-06 |
| **Exit Price** | $1.6769 |
| **Exit Reason** | time_exit |
| **Return** | -24.02% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 3.2815, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 66.1884, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 1.6769

---

### Trade #2: AGENTFUN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-07-08 |
| **Entry Price** | $1.7396 |
| **Stop Loss** | $1.6798 |
| **Take Profit** | $1.8591 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-07-18 |
| **Exit Price** | $2.0963 |
| **Exit Reason** | time_exit |
| **Return** | +20.50% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 4.2865, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 72.1209, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 2.0963

---

### Trade #3: AGENTFUN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-07-11 |
| **Entry Price** | $1.9033 |
| **Stop Loss** | $1.8339 |
| **Take Profit** | $2.0421 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-07-21 |
| **Exit Price** | $2.1642 |
| **Exit Reason** | time_exit |
| **Return** | +13.71% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.4453, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 86.8506, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 2.1642

---

### Trade #4: AGENTFUN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-08-27 |
| **Entry Price** | $3.0246 |
| **Stop Loss** | $2.8239 |
| **Take Profit** | $3.4260 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-09-06 |
| **Exit Price** | $2.8036 |
| **Exit Reason** | time_exit |
| **Return** | -7.31% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.6239, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 72.0813, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 2.8036

---

### Trade #5: AGENTFUN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-08-28 |
| **Entry Price** | $3.6592 |
| **Stop Loss** | $3.4077 |
| **Take Profit** | $4.1622 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-09-07 |
| **Exit Price** | $2.7202 |
| **Exit Reason** | time_exit |
| **Return** | -25.66% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.6659, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 84.5653, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 2.7202

---

### Trade #6: ALEO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-11-30 |
| **Entry Price** | $1.6350 |
| **Stop Loss** | $1.5609 |
| **Take Profit** | $1.7833 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-12-10 |
| **Exit Price** | $1.7055 |
| **Exit Reason** | time_exit |
| **Return** | +4.31% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.4442, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 77.8441, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 1.7055

---

### Trade #7: ALEO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-12-01 |
| **Entry Price** | $1.7813 |
| **Stop Loss** | $1.6970 |
| **Take Profit** | $1.9501 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-12-11 |
| **Exit Price** | $1.6641 |
| **Exit Reason** | time_exit |
| **Return** | -6.58% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.0591, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 87.0062, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 1.6641

---

### Trade #8: ALEO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-07-22 |
| **Entry Price** | $0.3667 |
| **Stop Loss** | $0.3467 |
| **Take Profit** | $0.4068 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-08-01 |
| **Exit Price** | $0.2681 |
| **Exit Reason** | time_exit |
| **Return** | -26.89% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 4.3431, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 92.3211, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.2681

---

### Trade #9: ALEO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-10-05 |
| **Entry Price** | $0.2728 |
| **Stop Loss** | $0.2601 |
| **Take Profit** | $0.2984 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-10-15 |
| **Exit Price** | $0.2302 |
| **Exit Reason** | time_exit |
| **Return** | -15.61% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 16.1795, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 70.6632, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.2302

---

### Trade #10: ALEO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-10-06 |
| **Entry Price** | $0.3682 |
| **Stop Loss** | $0.3476 |
| **Take Profit** | $0.4095 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-10-16 |
| **Exit Price** | $0.2219 |
| **Exit Reason** | time_exit |
| **Return** | -39.73% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 7.2016, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 93.2639, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.2219

---

### Trade #11: ALEO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2025-11-06 |
| **Entry Price** | $0.2979 |
| **Stop Loss** | $0.2769 |
| **Take Profit** | $0.3399 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-11-16 |
| **Exit Price** | $0.1925 |
| **Exit Reason** | time_exit |
| **Return** | -35.39% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.2075, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 60.2825, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.1925

---

### Trade #12: ARKM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-08-30 |
| **Entry Price** | $0.4441 |
| **Stop Loss** | $0.4193 |
| **Take Profit** | $0.4936 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-09-09 |
| **Exit Price** | $0.3773 |
| **Exit Reason** | time_exit |
| **Return** | -15.05% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 3.6572, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 64.0063, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.3773

---

### Trade #13: ARKM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-09-01 |
| **Entry Price** | $0.5019 |
| **Stop Loss** | $0.4679 |
| **Take Profit** | $0.5699 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-09-11 |
| **Exit Price** | $0.3327 |
| **Exit Reason** | time_exit |
| **Return** | -33.71% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 5.4205, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 64.9659, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.3327

---

### Trade #14: ARKM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-10-25 |
| **Entry Price** | $0.3869 |
| **Stop Loss** | $0.3687 |
| **Take Profit** | $0.4233 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-11-04 |
| **Exit Price** | $0.3670 |
| **Exit Reason** | time_exit |
| **Return** | -5.14% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 3.9271, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 64.5377, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.3670

---

### Trade #15: ARKM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-11-11 |
| **Entry Price** | $0.4281 |
| **Stop Loss** | $0.4099 |
| **Take Profit** | $0.4646 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-11-21 |
| **Exit Price** | $0.3795 |
| **Exit Reason** | time_exit |
| **Return** | -11.36% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.6389, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 62.8253, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.3795

---

### Trade #16: ARKM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-11-13 |
| **Entry Price** | $0.4577 |
| **Stop Loss** | $0.4373 |
| **Take Profit** | $0.4984 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-11-23 |
| **Exit Price** | $0.4143 |
| **Exit Reason** | time_exit |
| **Return** | -9.47% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 3.6919, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 66.7413, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.4143

---

### Trade #17: ARKM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-11-14 |
| **Entry Price** | $0.4765 |
| **Stop Loss** | $0.4566 |
| **Take Profit** | $0.5162 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-11-24 |
| **Exit Price** | $0.4721 |
| **Exit Reason** | time_exit |
| **Return** | -0.91% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.4259, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 78.5236, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.4721

---

### Trade #18: ARKM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-11-15 |
| **Entry Price** | $0.5347 |
| **Stop Loss** | $0.5086 |
| **Take Profit** | $0.5869 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-11-25 |
| **Exit Price** | $0.4912 |
| **Exit Reason** | time_exit |
| **Return** | -8.13% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 4.3982, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 83.7622, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.4912

---

### Trade #19: ARKM (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-12-17 |
| **Entry Price** | $0.6147 |
| **Stop Loss** | $0.5712 |
| **Take Profit** | $0.7017 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-12-27 |
| **Exit Price** | $0.6379 |
| **Exit Reason** | time_exit |
| **Return** | +3.78% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 2.4413, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 61.1004, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 0.6379

---

### Trade #20: ARKM (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-02-16 |
| **Entry Price** | $0.7665 |
| **Stop Loss** | $0.7336 |
| **Take Profit** | $0.8323 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-02-26 |
| **Exit Price** | $1.6493 |
| **Exit Reason** | time_exit |
| **Return** | +115.16% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `High Relative Volume`: rvol_20 > 2.0 → Actual: 4.674, Threshold: 2.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 60.0 → Actual: 88.8875, Threshold: 60.0

**Exit Details:** Max holding period (10 days) reached. Closed at 1.6493

---

*...and 563 more trades (see CSV export)*

---

*Report generated by Stratos Brain Production Backtester*

# Backtest Audit Report

**Run ID:** `3cb7b134`  
**Generated:** 2026-01-25 14:12:32

---

## 1. Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | standard_breakout |
| **Universe** | demo_5_assets |
| **Date Range** | 2023-01-01 to 2024-12-31 |
| **Started At** | 2026-01-25T14:12:32.014980 |
| **Completed At** | 2026-01-25T14:12:32.231611 |

### Parameters Used

```json
{
  "rvol_thresh": 3.0,
  "rsi_thresh": 65,
  "stop_loss_atr_mult": 1.5,
  "take_profit_r_mult": 2.0,
  "max_hold_days": 10
}
```

---

## 2. Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 5 |
| **Assets Skipped** | 0 |
| **Total Signals Scanned** | 2,510 |
| **Entries Triggered** | 10 |
| **Entries Skipped** | 2500 |
| **Entry Rate** | 0.40% |

---

## 3. Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 10 | Sample size for statistical significance |
| **Win Rate** | 60.0% | ✅ Good |
| **Profit Factor** | 3.06 | ✅ Profitable |
| **Avg Return** | +3.28% | Per-trade expectancy |
| **Median Return** | +5.19% | Typical trade outcome |
| **Std Dev** | 6.21% | Consistency measure |
| **Best Trade** | +11.39% | Maximum upside |
| **Worst Trade** | -4.25% | Maximum drawdown |
| **Avg Winner** | +8.13% | When right, how much? |
| **Avg Loser** | -3.99% | When wrong, how much? |
| **Avg Hold Period** | 6.8 days | Time in market |

### Exit Reason Breakdown

| Exit Reason | Count | Percentage |
|-------------|-------|------------|
| Stop Loss | 4 | 40.0% |
| Take Profit | 5 | 50.0% |
| Time Exit | 1 | 10.0% |

---

## 4. Trade Journal

Below is the complete list of trades with full audit trails.


### Trade #1: TEST1 (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-07-10 00:00:00 |
| **Entry Price** | $132.0013 |
| **Stop Loss** | $125.8090 |
| **Take Profit** | $144.3858 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-07-18 00:00:00 |
| **Exit Price** | $144.3858 |
| **Exit Reason** | take_profit |
| **Return** | +9.38% |
| **Holding Period** | 8 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 3.7992, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 66.2298, Threshold: 65

**Exit Details:** High (145.4760) reached take profit (144.3858)

---

### Trade #2: TEST1 (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-10-03 00:00:00 |
| **Entry Price** | $161.5847 |
| **Stop Loss** | $154.9060 |
| **Take Profit** | $174.9421 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-10-05 00:00:00 |
| **Exit Price** | $154.9060 |
| **Exit Reason** | stop_loss |
| **Return** | -4.13% |
| **Holding Period** | 2 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 3.8281, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 68.2729, Threshold: 65

**Exit Details:** Low (152.9287) breached stop loss (154.9060)

---

### Trade #3: TEST1 (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-10-27 00:00:00 |
| **Entry Price** | $156.3841 |
| **Stop Loss** | $149.7363 |
| **Take Profit** | $169.6798 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-10-30 00:00:00 |
| **Exit Price** | $149.7363 |
| **Exit Reason** | stop_loss |
| **Return** | -4.25% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 4.796, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 98.6464, Threshold: 65

**Exit Details:** Low (149.0029) breached stop loss (149.7363)

---

### Trade #4: TEST1 (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-11-28 00:00:00 |
| **Entry Price** | $154.2930 |
| **Stop Loss** | $148.8834 |
| **Take Profit** | $165.1122 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-12-05 00:00:00 |
| **Exit Price** | $148.8834 |
| **Exit Reason** | stop_loss |
| **Return** | -3.51% |
| **Holding Period** | 7 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 3.8831, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 71.4329, Threshold: 65

**Exit Details:** Low (144.6665) breached stop loss (148.8834)

---

### Trade #5: TEST2 (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-06-08 00:00:00 |
| **Entry Price** | $201.0311 |
| **Stop Loss** | $193.0175 |
| **Take Profit** | $217.0583 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-17 00:00:00 |
| **Exit Price** | $217.0583 |
| **Exit Reason** | take_profit |
| **Return** | +7.97% |
| **Holding Period** | 9 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 4.8653, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 68.1839, Threshold: 65

**Exit Details:** High (219.7048) reached take profit (217.0583)

---

### Trade #6: TEST3 (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-08-31 00:00:00 |
| **Entry Price** | $585.2163 |
| **Stop Loss** | $557.0460 |
| **Take Profit** | $641.5569 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-09-07 00:00:00 |
| **Exit Price** | $641.5569 |
| **Exit Reason** | take_profit |
| **Return** | +9.63% |
| **Holding Period** | 7 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 4.5282, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 70.7816, Threshold: 65

**Exit Details:** High (644.3618) reached take profit (641.5569)

---

### Trade #7: TEST4 (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2023-11-15 00:00:00 |
| **Entry Price** | $551.8289 |
| **Stop Loss** | $520.3906 |
| **Take Profit** | $614.7057 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2023-11-21 00:00:00 |
| **Exit Price** | $614.7057 |
| **Exit Reason** | take_profit |
| **Return** | +11.39% |
| **Holding Period** | 6 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 3.7026, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 82.1523, Threshold: 65

**Exit Details:** High (619.2577) reached take profit (614.7057)

---

### Trade #8: TEST4 (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-01-01 00:00:00 |
| **Entry Price** | $624.9564 |
| **Stop Loss** | $598.4669 |
| **Take Profit** | $677.9353 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-01-11 00:00:00 |
| **Exit Price** | $652.4387 |
| **Exit Reason** | time_exit |
| **Return** | +4.40% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 3.9302, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 89.0141, Threshold: 65

**Exit Details:** Max holding period (10 days) reached. Closed at 652.4387

---

### Trade #9: TEST4 (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-01-11 00:00:00 |
| **Entry Price** | $652.4387 |
| **Stop Loss** | $632.9000 |
| **Take Profit** | $691.5163 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-01-17 00:00:00 |
| **Exit Price** | $691.5163 |
| **Exit Reason** | take_profit |
| **Return** | +5.99% |
| **Holding Period** | 6 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 4.6654, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 72.0484, Threshold: 65

**Exit Details:** High (698.5614) reached take profit (691.5163)

---

### Trade #10: TEST5 (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | standard_breakout |
| **Entry Date** | 2024-09-05 00:00:00 |
| **Entry Price** | $247.2971 |
| **Stop Loss** | $237.2611 |
| **Take Profit** | $267.3691 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-09-15 00:00:00 |
| **Exit Price** | $237.2611 |
| **Exit Reason** | stop_loss |
| **Return** | -4.06% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == True → Actual: True, Threshold: True
- ✓ `High Relative Volume`: rvol_20 > 3.0 → Actual: 3.595, Threshold: 3.0
- ✓ `RSI Confirms Momentum`: rsi_14 > 65 → Actual: 84.6569, Threshold: 65

**Exit Details:** Low (233.1200) breached stop loss (237.2611)

---

## 5. Decision Log Summary

The backtester made **110** logged decisions during this run.

### Sample Decisions (First 20)

- **2023-08-08 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-09 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-10 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-11 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-12 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-13 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-14 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-15 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-16 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-17 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-18 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-19 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-20 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-21 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-22 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-23 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-24 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-25 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-26 00:00:00** | TEST1 | entry_skipped | Conditions not met
- **2023-08-27 00:00:00** | TEST1 | entry_skipped | Conditions not met

*...and 90 more decisions (see full JSON export)*

---

## 6. Reproducibility Statement

This backtest is **fully reproducible**. Given the same:
- Setup configuration
- Parameter values
- Date range
- Asset universe

The results will be **identical** on every run. No randomness is used.

---

## 7. Audit Checklist

- [x] All entry conditions logged with actual vs threshold values
- [x] All exit decisions logged with reason and price
- [x] Parameters explicitly stated and traceable to outcomes
- [x] No lookahead bias (only uses data available at decision time)
- [x] No survivorship bias (processes all assets in universe)
- [x] Slippage and fees not included (add 0.1-0.5% for realistic estimates)

---

*Report generated by Stratos Brain Auditable Backtester v1.0*

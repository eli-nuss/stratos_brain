# Backtest Report: gap_and_go

**Generated:** 2026-01-25 14:29:50

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | gap_and_go |
| **Universe** | equity |
| **Date Range** | 2023-01-01 to 2025-12-31 |

### Parameters

```json
{
  "gap_pct_thresh": 0.03,
  "rvol_thresh": 2.5,
  "stop_loss_atr_mult": 1.0,
  "take_profit_r_mult": 2.0,
  "max_hold_days": 5
}
```

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 96 |
| **Assets Skipped** | 0 |
| **Signals Scanned** | 45,398 |
| **Entries Triggered** | 250 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 250 | Sample size |
| **Win Rate** | 48.8% | ⚠️ Below 50% |
| **Profit Factor** | 1.23 | ✅ Profitable |
| **Avg Return** | +0.31% | Per-trade expectancy |
| **Sharpe Ratio** | 1.18 | Risk-adjusted return |
| **Reliability Score** | 65.4/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
| time_exit | 195 |
| stop_loss | 31 |
| take_profit | 24 |

---

## Trade Journal (First 20 Trades)


### Trade #1: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $167.2738 |
| **Stop Loss** | $154.9349 |
| **Take Profit** | $191.9516 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-03-22 |
| **Exit Price** | $167.8098 |
| **Exit Reason** | time_exit |
| **Return** | +0.32% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0554, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.4447, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 167.8098

---

### Trade #2: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-05-31 |
| **Entry Price** | $153.0742 |
| **Stop Loss** | $143.7097 |
| **Take Profit** | $171.8032 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-07 |
| **Exit Price** | $160.8399 |
| **Exit Reason** | time_exit |
| **Return** | +5.07% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0556, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.9753, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 160.8399

---

### Trade #3: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-06-28 |
| **Entry Price** | $162.8336 |
| **Stop Loss** | $152.6850 |
| **Take Profit** | $183.1307 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-07-08 |
| **Exit Price** | $158.0868 |
| **Exit Reason** | time_exit |
| **Return** | -2.92% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0596, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.6755, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 158.0868

---

### Trade #4: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-09-20 |
| **Entry Price** | $185.3663 |
| **Stop Loss** | $175.8140 |
| **Take Profit** | $204.4709 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-09-27 |
| **Exit Price** | $186.6310 |
| **Exit Reason** | time_exit |
| **Return** | +0.68% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0404, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.5833, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 186.6310

---

### Trade #5: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-12-20 |
| **Entry Price** | $169.5847 |
| **Stop Loss** | $162.1993 |
| **Take Profit** | $184.3556 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-12-30 |
| **Exit Price** | $170.1835 |
| **Exit Reason** | time_exit |
| **Return** | +0.35% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.037, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.7469, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 170.1835

---

### Trade #6: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-06-20 |
| **Entry Price** | $297.2125 |
| **Stop Loss** | $283.5872 |
| **Take Profit** | $324.4632 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-27 |
| **Exit Price** | $294.3293 |
| **Exit Reason** | time_exit |
| **Return** | -0.97% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.1358, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.9526, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 294.3293

---

### Trade #7: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-06-28 |
| **Entry Price** | $294.5429 |
| **Stop Loss** | $281.2412 |
| **Take Profit** | $321.1462 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-07-08 |
| **Exit Price** | $290.7180 |
| **Exit Reason** | time_exit |
| **Return** | -1.30% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0313, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.1173, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 290.7180

---

### Trade #8: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-12-19 |
| **Entry Price** | $364.3350 |
| **Stop Loss** | $351.4681 |
| **Take Profit** | $390.0687 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-12-27 |
| **Exit Price** | $348.6909 |
| **Exit Reason** | time_exit |
| **Return** | -4.29% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0726, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.5356, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 348.6909

---

### Trade #9: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-06-14 |
| **Entry Price** | $525.3100 |
| **Stop Loss** | $508.0638 |
| **Take Profit** | $559.8023 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-17 |
| **Exit Price** | $508.0638 |
| **Exit Reason** | stop_loss |
| **Return** | -3.28% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.1559, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.6896, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (505.3800) breached stop loss (508.0638)

---

### Trade #10: ADBE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2025-09-12 |
| **Entry Price** | $349.3600 |
| **Stop Loss** | $338.7086 |
| **Take Profit** | $370.6629 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-09-18 |
| **Exit Price** | $370.6629 |
| **Exit Reason** | take_profit |
| **Return** | +6.10% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0301, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.1295, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** High (370.8600) reached take profit (370.6629)

---

### Trade #11: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-05-22 |
| **Entry Price** | $233.3473 |
| **Stop Loss** | $223.3731 |
| **Take Profit** | $253.2957 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-05-30 |
| **Exit Price** | $223.4755 |
| **Exit Reason** | time_exit |
| **Return** | -4.23% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0822, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.9969, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 223.4755

---

### Trade #12: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2025-10-06 |
| **Entry Price** | $203.7100 |
| **Stop Loss** | $194.0472 |
| **Take Profit** | $223.0356 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-10-08 |
| **Exit Price** | $223.0356 |
| **Exit Reason** | take_profit |
| **Return** | +9.49% |
| **Holding Period** | 2 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.3751, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 4.6048, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** High (235.8700) reached take profit (223.0356)

---

### Trade #13: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-11-01 |
| **Entry Price** | $197.9300 |
| **Stop Loss** | $193.1629 |
| **Take Profit** | $207.4643 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-11-06 |
| **Exit Price** | $207.4643 |
| **Exit Reason** | take_profit |
| **Return** | +4.82% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0676, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.8372, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** High (207.5500) reached take profit (207.4643)

---

### Trade #14: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2025-10-31 |
| **Entry Price** | $244.2200 |
| **Stop Loss** | $237.4025 |
| **Take Profit** | $257.8550 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-11-03 |
| **Exit Price** | $257.8550 |
| **Exit Reason** | take_profit |
| **Return** | +5.58% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.1222, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.1149, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** High (258.6000) reached take profit (257.8550)

---

### Trade #15: AON (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-07-26 |
| **Entry Price** | $319.1093 |
| **Stop Loss** | $310.8913 |
| **Take Profit** | $335.5452 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $326.9041 |
| **Exit Reason** | time_exit |
| **Return** | +2.44% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0394, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.5268, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 326.9041

---

### Trade #16: APD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-02-06 |
| **Entry Price** | $208.3166 |
| **Stop Loss** | $193.6059 |
| **Take Profit** | $237.7380 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-02-13 |
| **Exit Price** | $207.8962 |
| **Exit Reason** | time_exit |
| **Return** | -0.20% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.05, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.525, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 207.8962

---

### Trade #17: APD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-06-26 |
| **Entry Price** | $253.7694 |
| **Stop Loss** | $241.4438 |
| **Take Profit** | $278.4207 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-07-03 |
| **Exit Price** | $245.2147 |
| **Exit Reason** | time_exit |
| **Return** | -3.37% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0346, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.1918, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 245.2147

---

### Trade #18: APD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-10-07 |
| **Entry Price** | $304.9086 |
| **Stop Loss** | $292.4755 |
| **Take Profit** | $329.7748 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-10-14 |
| **Exit Price** | $312.3682 |
| **Exit Reason** | time_exit |
| **Return** | +2.45% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0992, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.8808, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 312.3682

---

### Trade #19: APD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2025-11-06 |
| **Entry Price** | $258.7900 |
| **Stop Loss** | $252.9301 |
| **Take Profit** | $270.5098 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-11-13 |
| **Exit Price** | $263.0300 |
| **Exit Reason** | time_exit |
| **Return** | +1.64% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0498, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 2.9829, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 263.0300

---

### Trade #20: AVGO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_and_go |
| **Entry Date** | 2024-05-31 |
| **Entry Price** | $130.4746 |
| **Stop Loss** | $-1138.6606 |
| **Take Profit** | $2668.7450 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-06-07 |
| **Exit Price** | $138.1437 |
| **Exit Reason** | time_exit |
| **Return** | +5.88% |
| **Holding Period** | 5 days |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 9.1621, Threshold: 0.03
- ✓ `High Relative Volume`: rvol_20 > 2.5 → Actual: 3.1162, Threshold: 2.5
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Max holding period (5 days) reached. Closed at 138.1437

---

*...and 230 more trades (see CSV export)*

---

*Report generated by Stratos Brain Production Backtester*

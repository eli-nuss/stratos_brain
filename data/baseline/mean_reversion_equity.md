# Backtest Report: mean_reversion

**Generated:** 2026-01-25 14:30:00

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | mean_reversion |
| **Universe** | equity |
| **Date Range** | 2023-01-01 to 2025-12-31 |

### Parameters

```json
{
  "ma_dist_thresh": -0.12,
  "rsi_thresh": 35,
  "stop_loss_atr_mult": 2.0,
  "take_profit_r_mult": 2.0,
  "max_hold_days": 10
}
```

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | 96 |
| **Assets Skipped** | 0 |
| **Signals Scanned** | 44,918 |
| **Entries Triggered** | 384 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 384 | Sample size |
| **Win Rate** | 70.6% | ✅ Good |
| **Profit Factor** | 3.04 | ✅ Profitable |
| **Avg Return** | +3.83% | Per-trade expectancy |
| **Sharpe Ratio** | 7.02 | Risk-adjusted return |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
| stop_loss | 44 |
| time_exit | 324 |
| take_profit | 16 |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-04 |
| **Entry Price** | $187.7517 |
| **Stop Loss** | $173.2047 |
| **Take Profit** | $216.8457 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-08 |
| **Exit Price** | $173.2047 |
| **Exit Reason** | stop_loss |
| **Return** | -7.75% |
| **Holding Period** | 2 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1301, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 30.7773, Threshold: 35.0

**Exit Details:** Low (169.2101) breached stop loss (173.2047)

---

### Trade #2: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-07 |
| **Entry Price** | $180.8547 |
| **Stop Loss** | $164.0406 |
| **Take Profit** | $214.4830 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-22 |
| **Exit Price** | $199.0738 |
| **Exit Reason** | time_exit |
| **Return** | +10.07% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1531, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 28.3875, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 199.0738

---

### Trade #3: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-08 |
| **Entry Price** | $171.8449 |
| **Stop Loss** | $152.9814 |
| **Take Profit** | $209.5719 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-14 |
| **Exit Price** | $209.5719 |
| **Exit Reason** | take_profit |
| **Return** | +21.95% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1861, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 22.8092, Threshold: 35.0

**Exit Details:** High (212.9400) reached take profit (209.5719)

---

### Trade #4: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-11-15 |
| **Entry Price** | $159.3563 |
| **Stop Loss** | $139.3177 |
| **Take Profit** | $199.4334 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-12-02 |
| **Exit Price** | $175.5633 |
| **Exit Reason** | time_exit |
| **Return** | +10.17% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1276, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 27.9357, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 175.5633

---

### Trade #5: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-08 |
| **Entry Price** | $171.2955 |
| **Stop Loss** | $152.8544 |
| **Take Profit** | $208.1777 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-23 |
| **Exit Price** | $174.2426 |
| **Exit Reason** | time_exit |
| **Return** | +1.72% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1409, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 15.5036, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 174.2426

---

### Trade #6: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-10 |
| **Entry Price** | $169.8621 |
| **Stop Loss** | $149.0508 |
| **Take Profit** | $211.4847 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-25 |
| **Exit Price** | $183.1097 |
| **Exit Reason** | time_exit |
| **Return** | +7.80% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1333, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 20.4489, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 183.1097

---

### Trade #7: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-11 |
| **Entry Price** | $170.6910 |
| **Stop Loss** | $149.6797 |
| **Take Profit** | $212.7136 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-28 |
| **Exit Price** | $189.2901 |
| **Exit Reason** | time_exit |
| **Return** | +10.90% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1211, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 21.8483, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 189.2901

---

### Trade #8: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-12-18 |
| **Entry Price** | $441.3100 |
| **Stop Loss** | $406.5085 |
| **Take Profit** | $510.9131 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-01-03 |
| **Exit Price** | $430.5700 |
| **Exit Reason** | time_exit |
| **Return** | -2.43% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1341, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 26.9066, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 430.5700

---

### Trade #9: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-12-19 |
| **Entry Price** | $437.3900 |
| **Stop Loss** | $401.4713 |
| **Take Profit** | $509.2273 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-01-06 |
| **Exit Price** | $431.1800 |
| **Exit Reason** | time_exit |
| **Return** | -1.42% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1365, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 25.2021, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 431.1800

---

### Trade #10: ADBE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-03-13 |
| **Entry Price** | $377.8400 |
| **Stop Loss** | $349.7739 |
| **Take Profit** | $433.9723 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-03-27 |
| **Exit Price** | $396.1500 |
| **Exit Reason** | time_exit |
| **Return** | +4.85% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1473, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 20.8165, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 396.1500

---

### Trade #11: ADBE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-07 |
| **Entry Price** | $340.7000 |
| **Stop Loss** | $316.0587 |
| **Take Profit** | $389.9825 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-22 |
| **Exit Price** | $349.9100 |
| **Exit Reason** | time_exit |
| **Return** | +2.70% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.125, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 22.4709, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 349.9100

---

### Trade #12: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-08-05 |
| **Entry Price** | $195.6480 |
| **Stop Loss** | $175.0883 |
| **Take Profit** | $236.7673 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-08-19 |
| **Exit Price** | $220.4161 |
| **Exit Reason** | time_exit |
| **Return** | +12.66% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1247, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 27.1844, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 220.4161

---

### Trade #13: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-03 |
| **Entry Price** | $178.7153 |
| **Stop Loss** | $165.3928 |
| **Take Profit** | $205.3604 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-04 |
| **Exit Price** | $165.3928 |
| **Exit Reason** | stop_loss |
| **Return** | -7.45% |
| **Holding Period** | 1 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1261, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 24.5479, Threshold: 35.0

**Exit Details:** Low (164.1400) breached stop loss (165.3928)

---

### Trade #14: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-04 |
| **Entry Price** | $162.6301 |
| **Stop Loss** | $148.2423 |
| **Take Profit** | $191.4058 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-09 |
| **Exit Price** | $191.4058 |
| **Exit Reason** | take_profit |
| **Return** | +17.69% |
| **Holding Period** | 3 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1928, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 15.4331, Threshold: 35.0

**Exit Details:** High (198.4600) reached take profit (191.4058)

---

### Trade #15: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-07 |
| **Entry Price** | $169.2894 |
| **Stop Loss** | $151.8159 |
| **Take Profit** | $204.2365 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-22 |
| **Exit Price** | $176.3637 |
| **Exit Reason** | time_exit |
| **Return** | +4.18% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1504, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 23.8522, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 176.3637

---

### Trade #16: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2025-04-08 |
| **Entry Price** | $164.1023 |
| **Stop Loss** | $145.0521 |
| **Take Profit** | $202.2028 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2025-04-23 |
| **Exit Price** | $180.9186 |
| **Exit Reason** | time_exit |
| **Return** | +10.25% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1676, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 21.4173, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 180.9186

---

### Trade #17: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-07-25 |
| **Entry Price** | $199.4352 |
| **Stop Loss** | $178.4610 |
| **Take Profit** | $241.3837 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $178.4610 |
| **Exit Reason** | stop_loss |
| **Return** | -10.52% |
| **Holding Period** | 7 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1319, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 29.9871, Threshold: 35.0

**Exit Details:** Low (171.6100) breached stop loss (178.4610)

---

### Trade #18: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-07-30 |
| **Entry Price** | $193.9348 |
| **Stop Loss** | $172.0535 |
| **Take Profit** | $237.6973 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $172.0535 |
| **Exit Reason** | stop_loss |
| **Return** | -11.28% |
| **Holding Period** | 4 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1379, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 21.4866, Threshold: 35.0

**Exit Details:** Low (171.6100) breached stop loss (172.0535)

---

### Trade #19: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-08-01 |
| **Entry Price** | $193.5010 |
| **Stop Loss** | $170.1384 |
| **Take Profit** | $240.2263 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-08-15 |
| **Exit Price** | $208.8096 |
| **Exit Reason** | time_exit |
| **Return** | +7.91% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1253, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 29.9779, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 208.8096

---

### Trade #20: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | mean_reversion |
| **Entry Date** | 2024-08-02 |
| **Entry Price** | $179.2176 |
| **Stop Loss** | $155.1421 |
| **Take Profit** | $227.3687 |
| **Risk:Reward** | 1:2.0 |
| **Exit Date** | 2024-08-16 |
| **Exit Price** | $204.9356 |
| **Exit Reason** | time_exit |
| **Return** | +14.35% |
| **Holding Period** | 10 days |

**Entry Conditions:**
- ✓ `Extended Below MA`: ma_dist_20 < -0.12 → Actual: -0.1788, Threshold: -0.12
- ✓ `RSI Oversold`: rsi_14 < 35.0 → Actual: 25.477, Threshold: 35.0

**Exit Details:** Max holding period (10 days) reached. Closed at 204.9356

---

*...and 364 more trades (see CSV export)*

---

*Report generated by Stratos Brain Production Backtester*

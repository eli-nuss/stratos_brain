# Position Trading Backtest Report: gap_up_hold

**Generated:** 2026-01-25 14:47:18

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | gap_up_hold |
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
| **Signals Scanned** | 11,455 |
| **Entries Triggered** | 211 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 211 | Sample size |
| **Win Rate** | 56.4% | ✅ Good |
| **Profit Factor** | 5.32 | ✅ Profitable |
| **Avg Return** | +8.06% | Per-trade expectancy |
| **Avg Hold Period** | 44 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -15.00% | Maximum loss |
| **Reliability Score** | 98.2/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 69 | Trailing stop triggered |
| technical_breakdown | 108 | Broke below 200 SMA |
| profit_target | 32 | 50% profit target reached |
| max_hold | 2 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-05-03 |
| **Entry Price** | $181.91 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $201.65 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.85% |
| **Holding Period** | 63 days |
| **Max Gain** | +30.41% |
| **Highest Price** | $237.23 (2024-07-15) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0874, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.4834, Threshold: 2.0

**Exit Details:** Low (196.00) breached trailing stop (201.65). Max gain was 30.4%

---

### Trade #2: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $167.27 |
| **Exit Date** | 2024-05-28 |
| **Exit Price** | $154.96 |
| **Exit Reason** | trailing_stop |
| **Return** | -7.36% |
| **Holding Period** | 50 days |
| **Max Gain** | +8.98% |
| **Highest Price** | $182.30 (2024-03-28) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0554, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 3.4447, Threshold: 2.0

**Exit Details:** Low (153.95) breached trailing stop (154.96). Max gain was 9.0%

---

### Trade #3: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-05-31 |
| **Entry Price** | $153.07 |
| **Exit Date** | 2024-11-12 |
| **Exit Price** | $172.00 |
| **Exit Reason** | trailing_stop |
| **Return** | +12.36% |
| **Holding Period** | 114 days |
| **Max Gain** | +35.44% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0556, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.9753, Threshold: 2.0

**Exit Details:** Low (171.03) breached trailing stop (172.00). Max gain was 35.4%

---

### Trade #4: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-03-18 |
| **Entry Price** | $108.67 |
| **Exit Date** | 2024-05-20 |
| **Exit Price** | $100.26 |
| **Exit Reason** | technical_breakdown |
| **Return** | -7.75% |
| **Holding Period** | 44 days |
| **Max Gain** | +5.29% |
| **Highest Price** | $114.42 (2024-03-19) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0334, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.2919, Threshold: 2.0

**Exit Details:** Close (100.26) broke below 200 SMA (102.39)

---

### Trade #5: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-03-22 |
| **Entry Price** | $326.34 |
| **Exit Date** | 2024-04-12 |
| **Exit Price** | $306.18 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.18% |
| **Holding Period** | 14 days |
| **Max Gain** | +6.33% |
| **Highest Price** | $346.98 (2024-03-28) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0501, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.3196, Threshold: 2.0

**Exit Details:** Close (306.18) broke below 200 SMA (320.79)

---

### Trade #6: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-05-31 |
| **Entry Price** | $274.04 |
| **Exit Date** | 2024-06-03 |
| **Exit Price** | $273.53 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.19% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.92% |
| **Highest Price** | $287.52 (2024-06-03) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0301, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.2683, Threshold: 2.0

**Exit Details:** Close (273.53) broke below 200 SMA (320.14)

---

### Trade #7: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-06-20 |
| **Entry Price** | $297.21 |
| **Exit Date** | 2024-06-21 |
| **Exit Price** | $299.95 |
| **Exit Reason** | technical_breakdown |
| **Return** | +0.92% |
| **Holding Period** | 1 days |
| **Max Gain** | +4.42% |
| **Highest Price** | $310.35 (2024-06-21) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.1358, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.9526, Threshold: 2.0

**Exit Details:** Close (299.95) broke below 200 SMA (318.75)

---

### Trade #8: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-06-28 |
| **Entry Price** | $294.54 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $293.71 |
| **Exit Reason** | technical_breakdown |
| **Return** | -0.28% |
| **Holding Period** | 1 days |
| **Max Gain** | +3.33% |
| **Highest Price** | $304.36 (2024-07-01) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0313, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 3.1173, Threshold: 2.0

**Exit Details:** Close (293.71) broke below 200 SMA (318.35)

---

### Trade #9: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-12-19 |
| **Entry Price** | $364.33 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $338.60 |
| **Exit Reason** | trailing_stop |
| **Return** | -7.06% |
| **Holding Period** | 51 days |
| **Max Gain** | +9.34% |
| **Highest Price** | $398.35 (2025-02-05) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0726, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.5356, Threshold: 2.0

**Exit Details:** Low (335.91) breached trailing stop (338.60). Max gain was 9.3%

---

### Trade #10: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-06-14 |
| **Entry Price** | $525.31 |
| **Exit Date** | 2024-06-17 |
| **Exit Price** | $518.74 |
| **Exit Reason** | technical_breakdown |
| **Return** | -1.25% |
| **Holding Period** | 1 days |
| **Max Gain** | +0.12% |
| **Highest Price** | $525.94 (2024-06-17) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.1559, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 3.6896, Threshold: 2.0

**Exit Details:** Close (518.74) broke below 200 SMA (544.14)

---

### Trade #11: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-04-24 |
| **Entry Price** | $190.93 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +8.69% |
| **Holding Period** | 69 days |
| **Max Gain** | +27.87% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0839, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.0436, Threshold: 2.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 27.9%

---

### Trade #12: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-09-19 |
| **Entry Price** | $228.69 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $202.14 |
| **Exit Reason** | technical_breakdown |
| **Return** | -11.61% |
| **Holding Period** | 41 days |
| **Max Gain** | +3.65% |
| **Highest Price** | $237.03 (2024-10-14) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0546, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.3062, Threshold: 2.0

**Exit Details:** Close (202.14) broke below 200 SMA (209.80)

---

### Trade #13: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-11-25 |
| **Entry Price** | $219.02 |
| **Exit Date** | 2024-12-18 |
| **Exit Price** | $204.39 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.68% |
| **Holding Period** | 16 days |
| **Max Gain** | +6.63% |
| **Highest Price** | $233.55 (2024-11-26) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0358, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.2087, Threshold: 2.0

**Exit Details:** Close (204.39) broke below 200 SMA (212.82)

---

### Trade #14: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-07-31 |
| **Entry Price** | $144.48 |
| **Exit Date** | 2024-08-01 |
| **Exit Price** | $132.54 |
| **Exit Reason** | technical_breakdown |
| **Return** | -8.26% |
| **Holding Period** | 1 days |
| **Max Gain** | +1.94% |
| **Highest Price** | $147.29 (2024-08-01) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0888, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.0139, Threshold: 2.0

**Exit Details:** Close (132.54) broke below 200 SMA (154.21)

---

### Trade #15: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-05-01 |
| **Entry Price** | $179.00 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $177.06 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.09% |
| **Holding Period** | 58 days |
| **Max Gain** | +12.40% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0379, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.0626, Threshold: 2.0

**Exit Details:** Low (176.80) breached trailing stop (177.06). Max gain was 12.4%

---

### Trade #16: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-11-01 |
| **Entry Price** | $197.93 |
| **Exit Date** | 2025-02-25 |
| **Exit Price** | $208.03 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.10% |
| **Holding Period** | 76 days |
| **Max Gain** | +22.53% |
| **Highest Price** | $242.52 (2025-02-04) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0676, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.8372, Threshold: 2.0

**Exit Details:** Low (204.16) breached trailing stop (208.03). Max gain was 22.5%

---

### Trade #17: AON (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-07-26 |
| **Entry Price** | $319.11 |
| **Exit Date** | 2025-04-25 |
| **Exit Price** | $351.02 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.00% |
| **Holding Period** | 187 days |
| **Max Gain** | +29.41% |
| **Highest Price** | $412.97 (2025-03-03) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0394, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.5268, Threshold: 2.0

**Exit Details:** Low (323.73) breached trailing stop (351.02). Max gain was 29.4%

---

### Trade #18: APD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-06-25 |
| **Entry Price** | $257.03 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $239.73 |
| **Exit Reason** | technical_breakdown |
| **Return** | -6.73% |
| **Holding Period** | 4 days |
| **Max Gain** | +3.50% |
| **Highest Price** | $266.01 (2024-06-26) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.0362, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.0996, Threshold: 2.0

**Exit Details:** Close (239.73) broke below 200 SMA (248.27)

---

### Trade #19: APD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-08-01 |
| **Entry Price** | $278.62 |
| **Exit Date** | 2024-12-19 |
| **Exit Price** | $292.77 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.08% |
| **Holding Period** | 98 days |
| **Max Gain** | +20.95% |
| **Highest Price** | $337.00 (2024-12-03) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 0.1286, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.2462, Threshold: 2.0

**Exit Details:** Low (292.62) breached trailing stop (292.77). Max gain was 21.0%

---

### Trade #20: AVGO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | gap_up_hold |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $120.84 |
| **Exit Date** | 2024-03-18 |
| **Exit Price** | $181.26 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +945.09% |
| **Highest Price** | $1262.88 (2024-03-18) |

**Entry Conditions:**
- ✓ `Gap Up`: gap_pct > 0.03 → Actual: 9.153, Threshold: 0.03
- ✓ `Gap Held`: gap_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Surge`: rvol_20 > 2.0 → Actual: 2.4409, Threshold: 2.0

**Exit Details:** High (1262.88) reached 50% profit target (181.26)

---

*...and 191 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

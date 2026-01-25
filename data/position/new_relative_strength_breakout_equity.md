# Position Trading Backtest Report: relative_strength_breakout

**Generated:** 2026-01-25 14:55:55

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | relative_strength_breakout |
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
| **Signals Scanned** | 10,346 |
| **Entries Triggered** | 150 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 150 | Sample size |
| **Win Rate** | 62.0% | ✅ Good |
| **Profit Factor** | 6.19 | ✅ Profitable |
| **Avg Return** | +12.55% | Per-trade expectancy |
| **Avg Hold Period** | 68 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -15.00% | Maximum loss |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 76 | Trailing stop triggered |
| technical_breakdown | 37 | Broke below 200 SMA |
| profit_target | 35 | 50% profit target reached |
| max_hold | 2 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-05-07 |
| **Entry Price** | $180.94 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $201.65 |
| **Exit Reason** | trailing_stop |
| **Return** | +11.45% |
| **Holding Period** | 61 days |
| **Max Gain** | +31.11% |
| **Highest Price** | $237.23 (2024-07-15) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 51.0436, Threshold: 0.0

**Exit Details:** Low (196.00) breached trailing stop (201.65). Max gain was 31.1%

---

### Trade #2: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-08-13 |
| **Entry Price** | $220.05 |
| **Exit Date** | 2025-01-16 |
| **Exit Price** | $228.89 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.02% |
| **Holding Period** | 107 days |
| **Max Gain** | +18.20% |
| **Highest Price** | $260.10 (2024-12-26) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 11.3122, Threshold: 0.0

**Exit Details:** Low (228.03) breached trailing stop (228.89). Max gain was 18.2%

---

### Trade #3: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-03-28 |
| **Entry Price** | $171.24 |
| **Exit Date** | 2024-05-28 |
| **Exit Price** | $154.62 |
| **Exit Reason** | trailing_stop |
| **Return** | -9.71% |
| **Holding Period** | 41 days |
| **Max Gain** | +6.22% |
| **Highest Price** | $181.90 (2024-04-01) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 1.3418, Threshold: 0.0

**Exit Details:** Low (153.95) breached trailing stop (154.62). Max gain was 6.2%

---

### Trade #4: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-06-18 |
| **Entry Price** | $162.68 |
| **Exit Date** | 2024-11-11 |
| **Exit Price** | $176.22 |
| **Exit Reason** | trailing_stop |
| **Return** | +8.32% |
| **Holding Period** | 101 days |
| **Max Gain** | +27.44% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 14.8699, Threshold: 0.0

**Exit Details:** Low (172.70) breached trailing stop (176.22). Max gain was 27.4%

---

### Trade #5: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-02 |
| **Entry Price** | $108.27 |
| **Exit Date** | 2024-05-20 |
| **Exit Price** | $100.26 |
| **Exit Reason** | technical_breakdown |
| **Return** | -7.40% |
| **Holding Period** | 34 days |
| **Max Gain** | +3.97% |
| **Highest Price** | $112.57 (2024-04-09) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 35.3454, Threshold: 0.0

**Exit Details:** Close (100.26) broke below 200 SMA (102.39)

---

### Trade #6: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-08-02 |
| **Entry Price** | $108.70 |
| **Exit Date** | 2025-07-17 |
| **Exit Price** | $120.05 |
| **Exit Reason** | trailing_stop |
| **Return** | +10.44% |
| **Holding Period** | 238 days |
| **Max Gain** | +29.92% |
| **Highest Price** | $141.23 (2025-03-04) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 22.6765, Threshold: 0.0

**Exit Details:** Low (119.77) breached trailing stop (120.05). Max gain was 29.9%

---

### Trade #7: ACN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-03-20 |
| **Entry Price** | $367.86 |
| **Exit Date** | 2024-04-12 |
| **Exit Price** | $313.68 |
| **Exit Reason** | trailing_stop |
| **Return** | -14.73% |
| **Holding Period** | 16 days |
| **Max Gain** | +0.32% |
| **Highest Price** | $369.03 (2024-03-21) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 2.1063, Threshold: 0.0

**Exit Details:** Low (313.19) breached trailing stop (313.68). Max gain was 0.3%

---

### Trade #8: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
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
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 1.1975, Threshold: 0.0

**Exit Details:** Low (342.41) breached trailing stop (345.36). Max gain was 20.0%

---

### Trade #9: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-22 |
| **Entry Price** | $181.02 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +14.64% |
| **Holding Period** | 71 days |
| **Max Gain** | +34.87% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 16.3034, Threshold: 0.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 34.9%

---

### Trade #10: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-09-09 |
| **Entry Price** | $214.10 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $208.59 |
| **Exit Reason** | trailing_stop |
| **Return** | -2.58% |
| **Holding Period** | 49 days |
| **Max Gain** | +10.71% |
| **Highest Price** | $237.03 (2024-10-14) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 15.8523, Threshold: 0.0

**Exit Details:** Low (205.40) breached trailing stop (208.59). Max gain was 10.7%

---

### Trade #11: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-09 |
| **Entry Price** | $207.03 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $217.51 |
| **Exit Reason** | trailing_stop |
| **Return** | +5.06% |
| **Holding Period** | 69 days |
| **Max Gain** | +23.60% |
| **Highest Price** | $255.89 (2024-07-10) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 1.2348, Threshold: 0.0

**Exit Details:** Low (213.25) breached trailing stop (217.51). Max gain was 23.6%

---

### Trade #12: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-07-30 |
| **Entry Price** | $193.93 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $180.94 |
| **Exit Reason** | trailing_stop |
| **Return** | -6.70% |
| **Holding Period** | 3 days |
| **Max Gain** | +9.76% |
| **Highest Price** | $212.87 (2024-07-31) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 14.8687, Threshold: 0.0

**Exit Details:** Low (179.63) breached trailing stop (180.94). Max gain was 9.8%

---

### Trade #13: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-10-08 |
| **Entry Price** | $198.41 |
| **Exit Date** | 2024-10-15 |
| **Exit Price** | $188.67 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.91% |
| **Holding Period** | 5 days |
| **Max Gain** | +8.71% |
| **Highest Price** | $215.70 (2024-10-15) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 14.6913, Threshold: 0.0

**Exit Details:** Close (188.67) broke below 200 SMA (198.11)

---

### Trade #14: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-08 |
| **Entry Price** | $169.90 |
| **Exit Date** | 2024-04-19 |
| **Exit Price** | $145.86 |
| **Exit Reason** | trailing_stop |
| **Return** | -14.15% |
| **Holding Period** | 9 days |
| **Max Gain** | +1.00% |
| **Highest Price** | $171.60 (2024-04-09) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 43.2486, Threshold: 0.0

**Exit Details:** Low (145.29) breached trailing stop (145.86). Max gain was 1.0%

---

### Trade #15: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-05-30 |
| **Entry Price** | $166.75 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $164.81 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.17% |
| **Holding Period** | 32 days |
| **Max Gain** | +12.31% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 42.2364, Threshold: 0.0

**Exit Details:** Low (159.37) breached trailing stop (164.81). Max gain was 12.3%

---

### Trade #16: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-03 |
| **Entry Price** | $182.41 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $177.06 |
| **Exit Reason** | trailing_stop |
| **Return** | -2.94% |
| **Holding Period** | 78 days |
| **Max Gain** | +10.30% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 1.6003, Threshold: 0.0

**Exit Details:** Low (176.80) breached trailing stop (177.06). Max gain was 10.3%

---

### Trade #17: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-09-11 |
| **Entry Price** | $184.52 |
| **Exit Date** | 2025-02-25 |
| **Exit Price** | $206.14 |
| **Exit Reason** | trailing_stop |
| **Return** | +11.72% |
| **Holding Period** | 113 days |
| **Max Gain** | +31.43% |
| **Highest Price** | $242.52 (2025-02-04) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 37.488, Threshold: 0.0

**Exit Details:** Low (204.16) breached trailing stop (206.14). Max gain was 31.4%

---

### Trade #18: AVGO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-08 |
| **Entry Price** | $131.22 |
| **Exit Date** | 2024-04-09 |
| **Exit Price** | $196.82 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +936.06% |
| **Highest Price** | $1359.48 (2024-04-09) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 2.9726, Threshold: 0.0

**Exit Details:** High (1359.48) reached 50% profit target (196.82)

---

### Trade #19: AVGO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-11 |
| **Entry Price** | $135.77 |
| **Exit Date** | 2024-04-12 |
| **Exit Price** | $203.65 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +906.49% |
| **Highest Price** | $1366.51 (2024-04-12) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 6.8461, Threshold: 0.0

**Exit Details:** High (1366.51) reached 50% profit target (203.65)

---

### Trade #20: AVGO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | relative_strength_breakout |
| **Entry Date** | 2024-04-25 |
| **Entry Price** | $127.12 |
| **Exit Date** | 2024-04-26 |
| **Exit Price** | $190.68 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 1 days |
| **Max Gain** | +966.55% |
| **Highest Price** | $1355.83 (2024-04-26) |

**Entry Conditions:**
- ✓ `RS Breakout`: rs_breakout == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `RS Positive`: rs_vs_benchmark > 0.0 → Actual: 27.9387, Threshold: 0.0

**Exit Details:** High (1355.83) reached 50% profit target (190.68)

---

*...and 130 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

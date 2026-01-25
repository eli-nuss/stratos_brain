# Position Trading Backtest Report: confirmed_breakout

**Generated:** 2026-01-25 14:56:51

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | confirmed_breakout |
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
| **Signals Scanned** | 17,165 |
| **Entries Triggered** | 29 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 29 | Sample size |
| **Win Rate** | 44.8% | ⚠️ Below 50% |
| **Profit Factor** | 1.01 | ✅ Profitable |
| **Avg Return** | +0.02% | Per-trade expectancy |
| **Avg Hold Period** | 73 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -14.15% | Maximum loss |
| **Reliability Score** | 46.3/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 24 | Trailing stop triggered |
| technical_breakdown | 4 | Broke below 200 SMA |
| profit_target | 1 | 50% profit target reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-06-12 |
| **Entry Price** | $211.65 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $208.76 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.36% |
| **Holding Period** | 36 days |
| **Max Gain** | +12.09% |
| **Highest Price** | $237.23 (2024-07-15) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 3.008, Threshold: 1.2

**Exit Details:** Low (196.00) breached trailing stop (208.76). Max gain was 12.1%

---

### Trade #2: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-11-13 |
| **Entry Price** | $532.50 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $503.37 |
| **Exit Reason** | technical_breakdown |
| **Return** | -5.47% |
| **Holding Period** | 2 days |
| **Max Gain** | +0.40% |
| **Highest Price** | $534.64 (2024-11-14) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 1.3479, Threshold: 1.2

**Exit Details:** Close (503.37) broke below 200 SMA (521.60)

---

### Trade #3: AMD (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-07-08 |
| **Entry Price** | $178.69 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $159.19 |
| **Exit Reason** | trailing_stop |
| **Return** | -10.91% |
| **Holding Period** | 8 days |
| **Max Gain** | +4.81% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 1.202, Threshold: 1.2

**Exit Details:** Low (153.20) breached trailing stop (159.19). Max gain was 4.8%

---

### Trade #4: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-06-27 |
| **Entry Price** | $197.85 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $171.02 |
| **Exit Reason** | trailing_stop |
| **Return** | -13.56% |
| **Holding Period** | 25 days |
| **Max Gain** | +1.69% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 1.8047, Threshold: 1.2

**Exit Details:** Low (160.55) breached trailing stop (171.02). Max gain was 1.7%

---

### Trade #5: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-09-20 |
| **Entry Price** | $191.60 |
| **Exit Date** | 2025-02-25 |
| **Exit Price** | $206.14 |
| **Exit Reason** | trailing_stop |
| **Return** | +7.59% |
| **Holding Period** | 106 days |
| **Max Gain** | +26.58% |
| **Highest Price** | $242.52 (2025-02-04) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.7734, Threshold: 1.2

**Exit Details:** Low (204.16) breached trailing stop (206.14). Max gain was 26.6%

---

### Trade #6: AON (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
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
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.5268, Threshold: 1.2

**Exit Details:** Low (323.73) breached trailing stop (351.02). Max gain was 29.4%

---

### Trade #7: APD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
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
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.2462, Threshold: 1.2

**Exit Details:** Low (292.62) breached trailing stop (292.77). Max gain was 21.0%

---

### Trade #8: AVGO (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-12-16 |
| **Entry Price** | $247.11 |
| **Exit Date** | 2025-01-27 |
| **Exit Price** | $212.15 |
| **Exit Reason** | trailing_stop |
| **Return** | -14.15% |
| **Holding Period** | 26 days |
| **Max Gain** | +1.00% |
| **Highest Price** | $249.59 (2025-01-24) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 3.4001, Threshold: 1.2

**Exit Details:** Low (196.23) breached trailing stop (212.15). Max gain was 1.0%

---

### Trade #9: BKNG (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $4956.39 |
| **Exit Date** | 2025-03-10 |
| **Exit Price** | $4536.65 |
| **Exit Reason** | trailing_stop |
| **Return** | -8.47% |
| **Holding Period** | 82 days |
| **Max Gain** | +7.68% |
| **Highest Price** | $5337.24 (2024-12-12) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 1.249, Threshold: 1.2

**Exit Details:** Low (4405.92) breached trailing stop (4536.65). Max gain was 7.7%

---

### Trade #10: BRK-B (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-08-28 |
| **Entry Price** | $464.59 |
| **Exit Date** | 2025-04-07 |
| **Exit Price** | $474.32 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.09% |
| **Holding Period** | 151 days |
| **Max Gain** | +16.02% |
| **Highest Price** | $539.00 (2025-04-02) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 1.2977, Threshold: 1.2

**Exit Details:** Low (462.10) breached trailing stop (474.32). Max gain was 16.0%

---

### Trade #11: CB (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-05-16 |
| **Entry Price** | $258.85 |
| **Exit Date** | 2025-01-08 |
| **Exit Price** | $265.80 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.69% |
| **Holding Period** | 162 days |
| **Max Gain** | +16.69% |
| **Highest Price** | $302.05 (2024-10-17) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.8262, Threshold: 1.2

**Exit Details:** Low (264.17) breached trailing stop (265.80). Max gain was 16.7%

---

### Trade #12: CRM (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-11-11 |
| **Entry Price** | $339.09 |
| **Exit Date** | 2025-02-21 |
| **Exit Price** | $313.65 |
| **Exit Reason** | trailing_stop |
| **Return** | -7.50% |
| **Holding Period** | 68 days |
| **Max Gain** | +8.82% |
| **Highest Price** | $369.00 (2024-12-04) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 3.0577, Threshold: 1.2

**Exit Details:** Low (306.86) breached trailing stop (313.65). Max gain was 8.8%

---

### Trade #13: ETN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $354.59 |
| **Exit Date** | 2025-01-27 |
| **Exit Price** | $322.99 |
| **Exit Reason** | trailing_stop |
| **Return** | -8.91% |
| **Holding Period** | 53 days |
| **Max Gain** | +7.16% |
| **Highest Price** | $379.99 (2024-11-26) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.2255, Threshold: 1.2

**Exit Details:** Low (306.15) breached trailing stop (322.99). Max gain was 7.2%

---

### Trade #14: FDX (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-03-22 |
| **Entry Price** | $273.55 |
| **Exit Date** | 2024-05-23 |
| **Exit Price** | $247.24 |
| **Exit Reason** | trailing_stop |
| **Return** | -9.62% |
| **Holding Period** | 43 days |
| **Max Gain** | +6.33% |
| **Highest Price** | $290.87 (2024-03-26) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 3.8207, Threshold: 1.2

**Exit Details:** Low (246.90) breached trailing stop (247.24). Max gain was 6.3%

---

### Trade #15: FDX (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-06-26 |
| **Entry Price** | $286.51 |
| **Exit Date** | 2024-09-20 |
| **Exit Price** | $266.76 |
| **Exit Reason** | trailing_stop |
| **Return** | -6.89% |
| **Holding Period** | 60 days |
| **Max Gain** | +9.54% |
| **Highest Price** | $313.84 (2024-07-16) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 5.1527, Threshold: 1.2

**Exit Details:** Low (253.50) breached trailing stop (266.76). Max gain was 9.5%

---

### Trade #16: GOOGL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-12-11 |
| **Entry Price** | $194.63 |
| **Exit Date** | 2025-02-25 |
| **Exit Price** | $175.99 |
| **Exit Reason** | trailing_stop |
| **Return** | -9.57% |
| **Holding Period** | 49 days |
| **Max Gain** | +6.38% |
| **Highest Price** | $207.05 (2025-02-04) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.2504, Threshold: 1.2

**Exit Details:** Low (174.69) breached trailing stop (175.99). Max gain was 6.4%

---

### Trade #17: INTU (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $644.05 |
| **Exit Date** | 2024-12-03 |
| **Exit Price** | $629.01 |
| **Exit Reason** | trailing_stop |
| **Return** | -2.34% |
| **Holding Period** | 18 days |
| **Max Gain** | +10.98% |
| **Highest Price** | $714.78 (2024-11-13) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.3269, Threshold: 1.2

**Exit Details:** Low (626.40) breached trailing stop (629.01). Max gain was 11.0%

---

### Trade #18: ISRG (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-06-06 |
| **Entry Price** | $418.15 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $505.12 |
| **Exit Reason** | trailing_stop |
| **Return** | +20.80% |
| **Holding Period** | 187 days |
| **Max Gain** | +47.32% |
| **Highest Price** | $616.00 (2025-01-23) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 1.4473, Threshold: 1.2

**Exit Details:** Low (502.84) breached trailing stop (505.12). Max gain was 47.3%

---

### Trade #19: MO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-10-31 |
| **Entry Price** | $50.76 |
| **Exit Date** | 2025-01-08 |
| **Exit Price** | $51.07 |
| **Exit Reason** | trailing_stop |
| **Return** | +0.62% |
| **Holding Period** | 46 days |
| **Max Gain** | +14.34% |
| **Highest Price** | $58.03 (2024-11-27) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 3.4993, Threshold: 1.2

**Exit Details:** Low (50.95) breached trailing stop (51.07). Max gain was 14.3%

---

### Trade #20: NOC (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | confirmed_breakout |
| **Entry Date** | 2024-07-25 |
| **Entry Price** | $458.76 |
| **Exit Date** | 2024-12-06 |
| **Exit Price** | $472.23 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.94% |
| **Holding Period** | 94 days |
| **Max Gain** | +21.10% |
| **Highest Price** | $555.57 (2024-10-01) |

**Entry Conditions:**
- ✓ `Confirmed Breakout`: breakout_confirmed_up == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.2 → Actual: 2.4561, Threshold: 1.2

**Exit Details:** Low (470.55) breached trailing stop (472.23). Max gain was 21.1%

---

*...and 9 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

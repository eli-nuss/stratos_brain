# Position Trading Backtest Report: 52w_high_breakout

**Generated:** 2026-01-25 14:56:14

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | 52w_high_breakout |
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
| **Signals Scanned** | 17,372 |
| **Entries Triggered** | 29 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 29 | Sample size |
| **Win Rate** | 44.8% | ⚠️ Below 50% |
| **Profit Factor** | 1.34 | ✅ Profitable |
| **Avg Return** | +1.44% | Per-trade expectancy |
| **Avg Hold Period** | 71 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -14.13% | Maximum loss |
| **Reliability Score** | 58.2/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 27 | Trailing stop triggered |
| profit_target | 2 | 50% profit target reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-06-11 |
| **Entry Price** | $205.77 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $208.76 |
| **Exit Reason** | trailing_stop |
| **Return** | +1.45% |
| **Holding Period** | 37 days |
| **Max Gain** | +15.29% |
| **Highest Price** | $237.23 (2024-07-15) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0067, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.9424, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (196.00) breached trailing stop (208.76). Max gain was 15.3%

---

### Trade #2: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-06-21 |
| **Entry Price** | $189.08 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $171.02 |
| **Exit Reason** | trailing_stop |
| **Return** | -9.55% |
| **Holding Period** | 29 days |
| **Max Gain** | +6.41% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0137, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.0499, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (160.55) breached trailing stop (171.02). Max gain was 6.4%

---

### Trade #3: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
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
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0163, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.8372, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (204.16) breached trailing stop (208.03). Max gain was 22.5%

---

### Trade #4: AON (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-10-08 |
| **Entry Price** | $350.43 |
| **Exit Date** | 2025-01-10 |
| **Exit Price** | $347.89 |
| **Exit Reason** | trailing_stop |
| **Return** | -0.72% |
| **Holding Period** | 64 days |
| **Max Gain** | +12.81% |
| **Highest Price** | $395.33 (2024-11-27) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0133, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.5145, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (346.07) breached trailing stop (347.89). Max gain was 12.8%

---

### Trade #5: AXP (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-04-19 |
| **Entry Price** | $227.28 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $225.49 |
| **Exit Reason** | trailing_stop |
| **Return** | -0.79% |
| **Holding Period** | 73 days |
| **Max Gain** | +12.74% |
| **Highest Price** | $256.24 (2024-07-31) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.019, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.6896, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (222.03) breached trailing stop (225.49). Max gain was 12.7%

---

### Trade #6: AXP (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $291.96 |
| **Exit Date** | 2025-03-04 |
| **Exit Price** | $287.12 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.66% |
| **Holding Period** | 78 days |
| **Max Gain** | +11.75% |
| **Highest Price** | $326.27 (2025-01-23) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0164, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.901, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (277.58) breached trailing stop (287.12). Max gain was 11.8%

---

### Trade #7: BKNG (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-06-21 |
| **Entry Price** | $3944.12 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $3522.67 |
| **Exit Reason** | trailing_stop |
| **Return** | -10.69% |
| **Holding Period** | 29 days |
| **Max Gain** | +5.08% |
| **Highest Price** | $4144.32 (2024-07-16) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0151, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.3319, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (3291.05) breached trailing stop (3522.67). Max gain was 5.1%

---

### Trade #8: BKNG (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-10-30 |
| **Entry Price** | $4423.95 |
| **Exit Date** | 2025-01-21 |
| **Exit Price** | $4627.22 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.59% |
| **Holding Period** | 54 days |
| **Max Gain** | +20.64% |
| **Highest Price** | $5337.24 (2024-12-12) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.012, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.9674, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (4615.00) breached trailing stop (4627.22). Max gain was 20.6%

---

### Trade #9: BRK-B (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-08-30 |
| **Entry Price** | $475.92 |
| **Exit Date** | 2025-04-07 |
| **Exit Price** | $474.32 |
| **Exit Reason** | trailing_stop |
| **Return** | -0.34% |
| **Holding Period** | 149 days |
| **Max Gain** | +13.25% |
| **Highest Price** | $539.00 (2025-04-02) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0022, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.9058, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (462.10) breached trailing stop (474.32). Max gain was 13.3%

---

### Trade #10: CAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $410.68 |
| **Exit Date** | 2025-01-10 |
| **Exit Price** | $355.72 |
| **Exit Reason** | trailing_stop |
| **Return** | -13.38% |
| **Holding Period** | 43 days |
| **Max Gain** | +1.90% |
| **Highest Price** | $418.50 (2024-11-07) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0182, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.0586, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (349.80) breached trailing stop (355.72). Max gain was 1.9%

---

### Trade #11: COST (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-05-31 |
| **Entry Price** | $803.50 |
| **Exit Date** | 2025-03-13 |
| **Exit Price** | $916.50 |
| **Exit Reason** | trailing_stop |
| **Return** | +14.06% |
| **Holding Period** | 195 days |
| **Max Gain** | +34.19% |
| **Highest Price** | $1078.23 (2025-02-13) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0195, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.3734, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (887.47) breached trailing stop (916.50). Max gain was 34.2%

---

### Trade #12: CRM (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-11-08 |
| **Entry Price** | $319.47 |
| **Exit Date** | 2025-01-07 |
| **Exit Price** | $324.72 |
| **Exit Reason** | trailing_stop |
| **Return** | +1.64% |
| **Holding Period** | 39 days |
| **Max Gain** | +15.51% |
| **Highest Price** | $369.00 (2024-12-04) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0104, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.096, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (322.91) breached trailing stop (324.72). Max gain was 15.5%

---

### Trade #13: DE (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-11-22 |
| **Entry Price** | $440.45 |
| **Exit Date** | 2025-03-04 |
| **Exit Price** | $453.24 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.90% |
| **Holding Period** | 66 days |
| **Max Gain** | +16.94% |
| **Highest Price** | $515.05 (2025-02-19) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0158, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.6172, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (447.65) breached trailing stop (453.24). Max gain was 16.9%

---

### Trade #14: ETN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-11-25 |
| **Entry Price** | $371.87 |
| **Exit Date** | 2025-01-27 |
| **Exit Price** | $322.99 |
| **Exit Reason** | trailing_stop |
| **Return** | -13.14% |
| **Holding Period** | 40 days |
| **Max Gain** | +2.18% |
| **Highest Price** | $379.99 (2024-11-26) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0191, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.5735, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (306.15) breached trailing stop (322.99). Max gain was 2.2%

---

### Trade #15: GOOGL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-06-21 |
| **Entry Price** | $178.48 |
| **Exit Date** | 2024-08-05 |
| **Exit Price** | $162.99 |
| **Exit Reason** | trailing_stop |
| **Return** | -8.68% |
| **Holding Period** | 30 days |
| **Max Gain** | +7.44% |
| **Highest Price** | $191.75 (2024-07-10) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0131, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.3724, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (154.93) breached trailing stop (162.99). Max gain was 7.4%

---

### Trade #16: GOOGL (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
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
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.005, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.2504, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (174.69) breached trailing stop (175.99). Max gain was 6.4%

---

### Trade #17: ICE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-10-24 |
| **Entry Price** | $164.55 |
| **Exit Date** | 2025-01-10 |
| **Exit Price** | $142.79 |
| **Exit Reason** | trailing_stop |
| **Return** | -13.22% |
| **Holding Period** | 52 days |
| **Max Gain** | +2.09% |
| **Highest Price** | $167.99 (2024-10-30) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0179, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.9101, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (142.45) breached trailing stop (142.79). Max gain was 2.1%

---

### Trade #18: ISRG (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-03-15 |
| **Entry Price** | $396.28 |
| **Exit Date** | 2025-01-17 |
| **Exit Price** | $594.42 |
| **Exit Reason** | profit_target |
| **Return** | +50.00% |
| **Holding Period** | 211 days |
| **Max Gain** | +50.82% |
| **Highest Price** | $597.68 (2025-01-17) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0167, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.4543, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** High (597.68) reached 50% profit target (594.42)

---

### Trade #19: LLY (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-05-31 |
| **Entry Price** | $811.78 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $850.17 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.73% |
| **Holding Period** | 32 days |
| **Max Gain** | +19.01% |
| **Highest Price** | $966.10 (2024-07-15) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0175, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.6941, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (836.66) breached trailing stop (850.17). Max gain was 19.0%

---

### Trade #20: META (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | 52w_high_breakout |
| **Entry Date** | 2024-07-05 |
| **Entry Price** | $537.30 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $461.39 |
| **Exit Reason** | trailing_stop |
| **Return** | -14.13% |
| **Holding Period** | 8 days |
| **Max Gain** | +1.03% |
| **Highest Price** | $542.81 (2024-07-08) |

**Entry Conditions:**
- ✓ `Near 52W High`: dist_52w_high >= -0.02 → Actual: -0.0066, Threshold: -0.02
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.7921, Threshold: 1.5
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0

**Exit Details:** Low (459.12) breached trailing stop (461.39). Max gain was 1.0%

---

*...and 9 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

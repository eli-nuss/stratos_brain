# Position Trading Backtest Report: breakout_consolidation

**Generated:** 2026-01-25 14:47:05

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | breakout_consolidation |
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
| **Signals Scanned** | 15,570 |
| **Entries Triggered** | 58 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 58 | Sample size |
| **Win Rate** | 58.6% | ✅ Good |
| **Profit Factor** | 2.05 | ✅ Profitable |
| **Avg Return** | +2.83% | Per-trade expectancy |
| **Avg Hold Period** | 80 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -14.13% | Maximum loss |
| **Reliability Score** | 91.6/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 51 | Trailing stop triggered |
| technical_breakdown | 5 | Broke below 200 SMA |
| profit_target | 2 | 50% profit target reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.4834, Threshold: 1.5

**Exit Details:** Low (196.00) breached trailing stop (201.65). Max gain was 30.4%

---

### Trade #2: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-11-12 |
| **Entry Price** | $526.42 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $503.37 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.38% |
| **Holding Period** | 3 days |
| **Max Gain** | +2.56% |
| **Highest Price** | $539.92 (2024-11-13) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.6541, Threshold: 1.5

**Exit Details:** Close (503.37) broke below 200 SMA (521.60)

---

### Trade #3: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-05-22 |
| **Entry Price** | $233.35 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.07% |
| **Holding Period** | 49 days |
| **Max Gain** | +4.63% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.9969, Threshold: 1.5

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 4.6%

---

### Trade #4: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-05-16 |
| **Entry Price** | $162.62 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $164.81 |
| **Exit Reason** | trailing_stop |
| **Return** | +1.34% |
| **Holding Period** | 41 days |
| **Max Gain** | +15.16% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.6177, Threshold: 1.5

**Exit Details:** Low (159.37) breached trailing stop (164.81). Max gain was 15.2%

---

### Trade #5: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.0499, Threshold: 1.5

**Exit Details:** Low (160.55) breached trailing stop (171.02). Max gain was 6.4%

---

### Trade #6: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.7734, Threshold: 1.5

**Exit Details:** Low (204.16) breached trailing stop (206.14). Max gain was 26.6%

---

### Trade #7: AON (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.5268, Threshold: 1.5

**Exit Details:** Low (323.73) breached trailing stop (351.02). Max gain was 29.4%

---

### Trade #8: APD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.2462, Threshold: 1.5

**Exit Details:** Low (292.62) breached trailing stop (292.77). Max gain was 21.0%

---

### Trade #9: AVGO (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-12-11 |
| **Entry Price** | $181.08 |
| **Exit Date** | 2025-01-27 |
| **Exit Price** | $206.54 |
| **Exit Reason** | trailing_stop |
| **Return** | +14.06% |
| **Holding Period** | 29 days |
| **Max Gain** | +39.10% |
| **Highest Price** | $251.88 (2024-12-16) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.896, Threshold: 1.5

**Exit Details:** Low (196.23) breached trailing stop (206.54). Max gain was 39.1%

---

### Trade #10: AXP (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.901, Threshold: 1.5

**Exit Details:** Low (277.58) breached trailing stop (287.12). Max gain was 11.8%

---

### Trade #11: BAC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-07-16 |
| **Entry Price** | $42.61 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $37.77 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.35% |
| **Holding Period** | 13 days |
| **Max Gain** | +4.29% |
| **Highest Price** | $44.44 (2024-07-17) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.1263, Threshold: 1.5

**Exit Details:** Low (37.18) breached trailing stop (37.77). Max gain was 4.3%

---

### Trade #12: BAC (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $44.14 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $40.87 |
| **Exit Reason** | trailing_stop |
| **Return** | -7.41% |
| **Holding Period** | 81 days |
| **Max Gain** | +8.93% |
| **Highest Price** | $48.08 (2024-11-29) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.9929, Threshold: 1.5

**Exit Details:** Low (40.61) breached trailing stop (40.87). Max gain was 8.9%

---

### Trade #13: BKNG (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-10-31 |
| **Entry Price** | $4634.36 |
| **Exit Date** | 2025-01-13 |
| **Exit Price** | $4696.77 |
| **Exit Reason** | trailing_stop |
| **Return** | +1.35% |
| **Holding Period** | 48 days |
| **Max Gain** | +15.17% |
| **Highest Price** | $5337.24 (2024-12-12) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.8139, Threshold: 1.5

**Exit Details:** Low (4660.32) breached trailing stop (4696.77). Max gain was 15.2%

---

### Trade #14: BLK (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-10-11 |
| **Entry Price** | $965.61 |
| **Exit Date** | 2025-01-10 |
| **Exit Price** | $952.56 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.35% |
| **Holding Period** | 61 days |
| **Max Gain** | +12.10% |
| **Highest Price** | $1082.45 (2024-12-11) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.7644, Threshold: 1.5

**Exit Details:** Low (948.16) breached trailing stop (952.56). Max gain was 12.1%

---

### Trade #15: BMY (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-07-26 |
| **Entry Price** | $47.52 |
| **Exit Date** | 2025-04-07 |
| **Exit Price** | $53.83 |
| **Exit Reason** | trailing_stop |
| **Return** | +13.27% |
| **Holding Period** | 174 days |
| **Max Gain** | +33.26% |
| **Highest Price** | $63.33 (2025-03-11) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.1399, Threshold: 1.5

**Exit Details:** Low (52.69) breached trailing stop (53.83). Max gain was 33.3%

---

### Trade #16: BRK-B (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.9058, Threshold: 1.5

**Exit Details:** Low (462.10) breached trailing stop (474.32). Max gain was 13.3%

---

### Trade #17: CAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-09-19 |
| **Entry Price** | $366.43 |
| **Exit Date** | 2024-12-18 |
| **Exit Price** | $368.28 |
| **Exit Reason** | trailing_stop |
| **Return** | +0.50% |
| **Holding Period** | 63 days |
| **Max Gain** | +14.21% |
| **Highest Price** | $418.50 (2024-11-07) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.8698, Threshold: 1.5

**Exit Details:** Low (363.03) breached trailing stop (368.28). Max gain was 14.2%

---

### Trade #18: CB (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
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
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 2.8262, Threshold: 1.5

**Exit Details:** Low (264.17) breached trailing stop (265.80). Max gain was 16.7%

---

### Trade #19: COST (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-11-08 |
| **Entry Price** | $938.92 |
| **Exit Date** | 2025-03-07 |
| **Exit Price** | $948.85 |
| **Exit Reason** | trailing_stop |
| **Return** | +1.06% |
| **Holding Period** | 79 days |
| **Max Gain** | +14.84% |
| **Highest Price** | $1078.23 (2025-02-13) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.9693, Threshold: 1.5

**Exit Details:** Low (942.78) breached trailing stop (948.85). Max gain was 14.8%

---

### Trade #20: CRM (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | breakout_consolidation |
| **Entry Date** | 2024-11-06 |
| **Entry Price** | $304.53 |
| **Exit Date** | 2025-02-21 |
| **Exit Price** | $313.65 |
| **Exit Reason** | trailing_stop |
| **Return** | +2.99% |
| **Holding Period** | 71 days |
| **Max Gain** | +21.17% |
| **Highest Price** | $369.00 (2024-12-04) |

**Entry Conditions:**
- ✓ `20-Day Breakout`: breakout_up_20 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Volume Confirmation`: rvol_20 > 1.5 → Actual: 1.581, Threshold: 1.5

**Exit Details:** Low (306.86) breached trailing stop (313.65). Max gain was 21.2%

---

*...and 38 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

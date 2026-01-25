# Position Trading Backtest Report: volatility_contraction_breakout

**Generated:** 2026-01-25 14:56:32

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | volatility_contraction_breakout |
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
| **Signals Scanned** | 8,288 |
| **Entries Triggered** | 199 |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | 199 | Sample size |
| **Win Rate** | 63.3% | ✅ Good |
| **Profit Factor** | 7.65 | ✅ Profitable |
| **Avg Return** | +14.57% | Per-trade expectancy |
| **Avg Hold Period** | 63 days | Time in position |
| **Best Trade** | +50.00% | Maximum gain |
| **Worst Trade** | -14.18% | Maximum loss |
| **Reliability Score** | 100.0/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
| trailing_stop | 90 | Trailing stop triggered |
| technical_breakdown | 49 | Broke below 200 SMA |
| profit_target | 54 | 50% profit target reached |
| max_hold | 6 | Max hold period reached |

---

## Trade Journal (First 20 Trades)


### Trade #1: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
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
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 15.0794, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0659, Threshold: 0.0

**Exit Details:** Low (196.00) breached trailing stop (208.76). Max gain was 15.3%

---

### Trade #2: AAPL (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-09-13 |
| **Entry Price** | $221.27 |
| **Exit Date** | 2025-01-16 |
| **Exit Price** | $228.89 |
| **Exit Reason** | trailing_stop |
| **Return** | +3.44% |
| **Holding Period** | 85 days |
| **Max Gain** | +17.55% |
| **Highest Price** | $260.10 (2024-12-26) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 0.7937, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0076, Threshold: 0.0

**Exit Details:** Low (228.03) breached trailing stop (228.89). Max gain was 17.5%

---

### Trade #3: ABBV (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-03-25 |
| **Entry Price** | $167.88 |
| **Exit Date** | 2024-05-28 |
| **Exit Price** | $154.96 |
| **Exit Reason** | trailing_stop |
| **Return** | -7.70% |
| **Holding Period** | 44 days |
| **Max Gain** | +8.59% |
| **Highest Price** | $182.30 (2024-03-28) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 0.7937, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0002, Threshold: 0.0

**Exit Details:** Low (153.95) breached trailing stop (154.96). Max gain was 8.6%

---

### Trade #4: ABBV (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-07-16 |
| **Entry Price** | $162.11 |
| **Exit Date** | 2024-11-11 |
| **Exit Price** | $176.22 |
| **Exit Reason** | trailing_stop |
| **Return** | +8.70% |
| **Holding Period** | 83 days |
| **Max Gain** | +27.89% |
| **Highest Price** | $207.32 (2024-10-31) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 19.8413, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0161, Threshold: 0.0

**Exit Details:** Low (172.70) breached trailing stop (176.22). Max gain was 27.9%

---

### Trade #5: ABT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-06-07 |
| **Entry Price** | $104.50 |
| **Exit Date** | 2024-07-01 |
| **Exit Price** | $100.25 |
| **Exit Reason** | technical_breakdown |
| **Return** | -4.07% |
| **Holding Period** | 15 days |
| **Max Gain** | +4.29% |
| **Highest Price** | $108.98 (2024-06-10) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 17.4603, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0527, Threshold: 0.0

**Exit Details:** Close (100.25) broke below 200 SMA (102.62)

---

### Trade #6: ABT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-07-24 |
| **Entry Price** | $104.75 |
| **Exit Date** | 2025-07-17 |
| **Exit Price** | $120.05 |
| **Exit Reason** | trailing_stop |
| **Return** | +14.61% |
| **Holding Period** | 245 days |
| **Max Gain** | +34.83% |
| **Highest Price** | $141.23 (2025-03-04) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 25.3968, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0246, Threshold: 0.0

**Exit Details:** Low (119.77) breached trailing stop (120.05). Max gain was 34.8%

---

### Trade #7: ACN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-08-21 |
| **Entry Price** | $325.25 |
| **Exit Date** | 2025-03-06 |
| **Exit Price** | $340.56 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.71% |
| **Holding Period** | 134 days |
| **Max Gain** | +22.47% |
| **Highest Price** | $398.35 (2025-02-05) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 23.8095, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0431, Threshold: 0.0

**Exit Details:** Low (339.82) breached trailing stop (340.56). Max gain was 22.5%

---

### Trade #8: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-08-16 |
| **Entry Price** | $553.46 |
| **Exit Date** | 2024-09-16 |
| **Exit Price** | $521.50 |
| **Exit Reason** | technical_breakdown |
| **Return** | -5.77% |
| **Holding Period** | 20 days |
| **Max Gain** | +6.20% |
| **Highest Price** | $587.75 (2024-09-12) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 24.6032, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.032, Threshold: 0.0

**Exit Details:** Close (521.50) broke below 200 SMA (543.41)

---

### Trade #9: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
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
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 18.254, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0822, Threshold: 0.0

**Exit Details:** Close (503.37) broke below 200 SMA (521.60)

---

### Trade #10: ADBE (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-12-05 |
| **Entry Price** | $538.22 |
| **Exit Date** | 2024-12-12 |
| **Exit Price** | $474.21 |
| **Exit Reason** | trailing_stop |
| **Return** | -11.89% |
| **Holding Period** | 5 days |
| **Max Gain** | +3.66% |
| **Highest Price** | $557.90 (2024-12-09) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 26.9841, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0478, Threshold: 0.0

**Exit Details:** Low (470.90) breached trailing stop (474.21). Max gain was 3.7%

---

### Trade #11: ADI (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-03-28 |
| **Entry Price** | $192.18 |
| **Exit Date** | 2024-08-02 |
| **Exit Price** | $207.52 |
| **Exit Reason** | trailing_stop |
| **Return** | +7.98% |
| **Holding Period** | 87 days |
| **Max Gain** | +27.04% |
| **Highest Price** | $244.14 (2024-07-17) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 15.0794, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0135, Threshold: 0.0

**Exit Details:** Low (206.71) breached trailing stop (207.52). Max gain was 27.0%

---

### Trade #12: ADI (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-10-09 |
| **Entry Price** | $228.48 |
| **Exit Date** | 2024-11-15 |
| **Exit Price** | $202.14 |
| **Exit Reason** | technical_breakdown |
| **Return** | -11.53% |
| **Holding Period** | 27 days |
| **Max Gain** | +3.74% |
| **Highest Price** | $237.03 (2024-10-14) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 4.7619, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0242, Threshold: 0.0

**Exit Details:** Close (202.14) broke below 200 SMA (209.80)

---

### Trade #13: AMAT (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-03-21 |
| **Entry Price** | $207.41 |
| **Exit Date** | 2024-07-18 |
| **Exit Price** | $217.51 |
| **Exit Reason** | trailing_stop |
| **Return** | +4.87% |
| **Holding Period** | 81 days |
| **Max Gain** | +23.37% |
| **Highest Price** | $255.89 (2024-07-10) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 13.4921, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0501, Threshold: 0.0

**Exit Details:** Low (213.25) breached trailing stop (217.51). Max gain was 23.4%

---

### Trade #14: AMAT (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-10-14 |
| **Entry Price** | $211.26 |
| **Exit Date** | 2024-10-15 |
| **Exit Price** | $188.67 |
| **Exit Reason** | technical_breakdown |
| **Return** | -10.69% |
| **Holding Period** | 1 days |
| **Max Gain** | +2.10% |
| **Highest Price** | $215.70 (2024-10-15) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 19.8413, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0688, Threshold: 0.0

**Exit Details:** Close (188.67) broke below 200 SMA (198.11)

---

### Trade #15: AMD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-05-15 |
| **Entry Price** | $159.67 |
| **Exit Date** | 2024-07-17 |
| **Exit Price** | $164.81 |
| **Exit Reason** | trailing_stop |
| **Return** | +3.22% |
| **Holding Period** | 42 days |
| **Max Gain** | +17.29% |
| **Highest Price** | $187.28 (2024-07-10) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 5.5556, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0394, Threshold: 0.0

**Exit Details:** Low (159.37) breached trailing stop (164.81). Max gain was 17.3%

---

### Trade #16: AMZN (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-03-22 |
| **Entry Price** | $178.87 |
| **Exit Date** | 2024-07-25 |
| **Exit Price** | $177.06 |
| **Exit Reason** | trailing_stop |
| **Return** | -1.01% |
| **Holding Period** | 85 days |
| **Max Gain** | +12.48% |
| **Highest Price** | $201.20 (2024-07-08) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 5.5556, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0255, Threshold: 0.0

**Exit Details:** Low (176.80) breached trailing stop (177.06). Max gain was 12.5%

---

### Trade #17: AMZN (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
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
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 26.9841, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0646, Threshold: 0.0

**Exit Details:** Low (204.16) breached trailing stop (206.14). Max gain was 31.4%

---

### Trade #18: AON (❌ LOSS)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
| **Entry Date** | 2024-03-19 |
| **Entry Price** | $318.12 |
| **Exit Date** | 2024-04-11 |
| **Exit Price** | $306.52 |
| **Exit Reason** | technical_breakdown |
| **Return** | -3.65% |
| **Holding Period** | 16 days |
| **Max Gain** | +5.64% |
| **Highest Price** | $336.06 (2024-03-28) |

**Entry Conditions:**
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 0.7937, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0068, Threshold: 0.0

**Exit Details:** Close (306.52) broke below 200 SMA (315.33)

---

### Trade #19: AON (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
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
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 1.5873, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.0906, Threshold: 0.0

**Exit Details:** Low (323.73) breached trailing stop (351.02). Max gain was 29.4%

---

### Trade #20: APD (✅ WIN)

| Field | Value |
|-------|-------|
| **Setup** | volatility_contraction_breakout |
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
- ✓ `BB Width Expanding`: bb_width_pctile_expanding == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Was Tight`: bb_width_pctile_prev < 30.0 → Actual: 26.1905, Threshold: 30.0
- ✓ `Above 200 SMA`: above_ma200 == 1.0 → Actual: 1.0, Threshold: 1.0
- ✓ `Positive ROC`: roc_5 > 0.0 → Actual: 0.1115, Threshold: 0.0

**Exit Details:** Low (292.62) breached trailing stop (292.77). Max gain was 21.0%

---

*...and 179 more trades (see CSV export)*

---

*Report generated by Stratos Brain Position Trading Backtester*

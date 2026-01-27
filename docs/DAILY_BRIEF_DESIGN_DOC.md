# Daily Brief System - Design Document

**Objective:** Create a daily market brief for a fund manager that surfaces actionable trading ideas by consolidating thousands of signals into a few high-conviction categories. The system should be designed for Gemini to review and provide feedback on.

---

## 1. Core Philosophy

- **Consolidation over Raw Data**: The goal is not to show all 5,000+ signals, but to synthesize them into a few actionable themes.
- **Category-Driven Analysis**: Group setups into meaningful categories (Momentum, Pullbacks) with tailored ranking logic for each.
- **AI as Analyst**: Use Gemini as an AI analyst to interpret the data, not just format it.

---

## 2. Proposed Categories & Setup Mapping

We will consolidate the 11 available setup types into 3 actionable categories:

**Category 1: MOMENTUM BREAKOUTS** (New highs, strength, breakouts)
- `weinstein_stage2_breakout`
- `donchian_55_breakout`
- `rs_breakout`
- `breakout_confirmed`
- `gap_up_momentum`

**Category 2: TREND CONTINUATION** (Riding existing trends)
- `golden_cross`
- `adx_holy_grail`
- `acceleration_turn`

**Category 3: PULLBACKS & COMPRESSION** (Buying dips/squeezes)
- `trend_pullback_50ma`
- `vcp_squeeze`
- `oversold_bounce`

---

## 3. Composite Score Logic (per category)

Within each category, we will rank assets using a tailored composite score to find the "best" opportunities.

**Momentum Breakouts Composite:**
```
score = (ai_direction_score * 0.40) + 
        (setup_purity_score * 0.40) + 
        (risk_reward * 5) +
        (ai_confidence * 0.20)
```

**Trend Continuation Composite:**
```
score = (ai_direction_score * 0.30) + 
        (setup_purity_score * 0.25) + 
        (historical_profit_factor * 20) +
        (risk_reward * 5) +
        (return_1d * 10)
```

**Pullbacks & Compression Composite:**
```
score = (ai_direction_score * 0.25) + 
        (setup_purity_score * 0.35) + 
        (risk_reward * 8) + 
        (historical_profit_factor * 15)
```

---

## 4. Available Data Tables & Schemas

Here is a summary of all the data tables available for this project:

### `setup_signals`
- **Purpose**: Contains all active trading setups with entry, stop, and target levels.
- **Key Columns**: `setup_name`, `signal_date`, `entry_price`, `stop_loss`, `target_price`, `risk_reward`, `historical_profit_factor`
- **Sample Data**:
  ```json
  [
    {"id":200,"symbol":"USX","setup_name":"donchian_55_breakout","signal_date":"2026-01-25","entry_price":"0.999205","stop_loss":"0.9964457142857143","target_price":"1.14908575","risk_reward":"54.31867719389022","historical_profit_factor":"1.99"},
    {"id":332,"symbol":"DOLA","setup_name":"donchian_55_breakout","signal_date":"2026-01-25","entry_price":"0.997149","stop_loss":"0.9937647142857142","target_price":"1.1467213499999998","risk_reward":"44.196135500210815","historical_profit_factor":"1.99"}
  ]
  ```

### `asset_ai_reviews`
- **Purpose**: Contains AI-generated analysis, scores, and conviction levels for each asset.
- **Key Columns**: `ai_direction_score`, `setup_purity_score`, `ai_confidence`, `ai_attention_level`, `primary_setup`, `historical_profit_factor`, `agreement_with_engine`
- **Sample Data**:
  ```json
  [
    {"asset_id":"9007","ai_direction_score":95,"setup_purity_score":95,"ai_confidence":0.92,"ai_attention_level":"URGENT","primary_setup":"donchian_55_breakout","historical_profit_factor":1.99},
    {"asset_id":"9162","ai_direction_score":95,"setup_purity_score":95,"ai_confidence":0.92,"ai_attention_level":"URGENT","primary_setup":"donchian_55_breakout","historical_profit_factor":1.99}
  ]
  ```

### `daily_features`
- **Purpose**: Contains over 120 technical indicators for each asset, per day.
- **Key Columns**: `rsi_14`, `macd_histogram`, `atr_pct`, `return_1d`, `return_5d`, `ma_slope_50`, `bb_width_pctile`

### `fundamental_vigor_scores` (equities only)
- **Purpose**: Contains fundamental quality scores (FVS) for equities.
- **Key Columns**: `final_score`, `profitability_score`, `growth_score`, `moat_score`

### `core_portfolio_holdings`
- **Purpose**: Contains the user's active portfolio holdings.
- **Key Columns**: `asset_id`, `quantity`, `cost_basis`

### `daily_macro_metrics`
- **Purpose**: Contains daily macro-economic indicators.
- **Key Columns**: `market_regime`, `us10y_yield`, `yield_curve_10y_2y`, `cpi_yoy`

### `assets`
- **Purpose**: Master list of all assets with metadata.
- **Key Columns**: `symbol`, `name`, `asset_type`, `sector`, `industry`

---

## 5. Request for Gemini

Given this context, please review the proposed system design and provide feedback on:
1. **Category Mapping**: Does the proposed categorization of setup types make sense?
2. **Composite Scores**: Are the composite score formulas well-designed for each category? Any factors I should add or remove?
3. **Overall Architecture**: Is this a robust and scalable approach for generating a daily market brief?
4. **Blind Spots**: Are there any potential issues or blind spots in this design?

Your feedback will be used to refine the system before implementation.

# Daily Brief System - Design Document (v2)

**Objective:** Create a daily market brief for a fund manager that surfaces actionable trading ideas by consolidating thousands of signals into a few high-conviction categories. This version incorporates feedback from Gemini.

---

## 1. Core Philosophy (Unchanged)

- **Consolidation over Raw Data**: Synthesize 5,000+ signals into actionable themes.
- **Category-Driven Analysis**: Group setups into meaningful categories with tailored ranking logic.
- **AI as Analyst**: Use Gemini to interpret pre-processed data.

---

## 2. Revised Category Mapping (per Gemini Feedback)

**Category 1: MOMENTUM BREAKOUTS** (New Trends)
- `weinstein_stage2_breakout`
- `donchian_55_breakout`
- `rs_breakout`
- `breakout_confirmed`
- `gap_up_momentum` (flagged as shorter-term)

**Category 2: TREND CONTINUATION** (Riding Trends)
- `golden_cross`
- `adx_holy_grail`
- `acceleration_turn`
- `trend_pullback_50ma` (moved from Pullbacks)

**Category 3: COMPRESSION & REVERSION** (Energy Buildup)
- `vcp_squeeze`
- `oversold_bounce`

---

## 3. Simplified Composite Scores (per Gemini Feedback)

Removed `historical_profit_factor` to avoid scaling issues. Scores are now based on AI conviction and technical strength, calculated in TypeScript before calling Gemini.

**Momentum Breakouts Composite:**
```
score = (ai_direction_score * 0.5) + (setup_purity_score * 0.5)
Tie-breaker: Liquidity (dollar volume)
```

**Trend Continuation Composite:**
```
score = (ai_direction_score * 0.4) + (setup_purity_score * 0.4) + (min(return_1d * 2, 20))
```

**Compression & Reversion Composite:**
```
score = (ai_direction_score * 0.3) + (setup_purity_score * 0.7)
```

---

## 4. New Architectural Components (per Gemini Feedback)

**A. Macro Regime Gate (Critical)**
- If `market_regime` from `daily_macro_metrics` is "Bearish" or "High Volatility," the **Compression & Reversion** category will be suppressed or heavily penalized.
- The brief will explicitly state: *"Macro Filter Active: Pullback setups suppressed due to Bearish Regime."*

**B. Portfolio Resonance**
- A **"Portfolio Action"** flag will be added.
- Signal on a holding → **"Add-On Opportunity."**
- Signal in the same sector as a holding → **"Sector Concentration Risk."**

---

## 5. Refined AI Prompt Structure

Instead of asking the AI to categorize, we will pre-categorize the data and ask the AI to answer three key questions for the fund manager:

1. **"What is working?"** (Theme Analysis)
2. **"What should I buy?"** (Top 3 Conviction Picks from each category)
3. **"What should I manage?"** (Portfolio Alerts)

---

## 6. Available Data (Unchanged)

- `setup_signals`
- `asset_ai_reviews`
- `daily_features`
- `fundamental_vigor_scores`
- `core_portfolio_holdings`
- `daily_macro_metrics`
- `assets`

This revised design is cleaner, more robust, and directly incorporates Gemini's feedback to avoid common pitfalls. It is now ready for implementation.

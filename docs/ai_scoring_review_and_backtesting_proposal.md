# AI Technical Scoring System Review and Backtesting System Proposal

**Document Version:** 1.0  
**Author:** Manus AI  
**Date:** January 25, 2026

---

## Executive Summary

This document provides a comprehensive review of the current Stratos Brain AI Technical Scoring System, an analysis of the "Project Apex" feedback, and a detailed proposal for a scalable backtesting system. The core finding is that the current system is architecturally sound but suffers from a lack of **contextual grounding**. The proposed "Classify First, Grade Second" approach is a significant improvement that will transform the AI from a generic scorer into an actionable opportunity finder. The backtesting system proposed herein is designed to provide the quantitative validation needed to underpin this new paradigm.

---

## Part 1: Review of the Current AI Technical Scoring System

### 1.1. Architecture Overview

The current system is a sophisticated, multi-stage pipeline that combines quantitative signal detection with LLM-powered analysis. The architecture is well-structured and consists of the following key stages:

| Stage | Name | Function |
| :---: | :--- | :--- |
| **1** | Fetch & Features | Ingests OHLCV data and calculates 50+ technical indicators. |
| **3** | State Machine | Evaluates signal templates and manages signal lifecycle (`new` → `active` → `ended`). |
| **4** | Scoring | Aggregates signals into composite scores (`weighted_score`, `inflection_score`). |
| **5** | AI Review | Two-pass LLM analysis (Independent Score + Reconciliation). |

### 1.2. Signal Engine (Stage 3 & 4)

The signal engine is built on a robust, template-based architecture defined in `src/stratos_engine/templates/v32.yaml`. This is a significant strength.

**Key Strengths:**

*   **Declarative Templates:** Signals are defined in YAML, not hardcoded. This allows for rapid iteration on signal logic without modifying Python code.
*   **Composable Logic:** The template engine supports complex `all`, `any`, and `not` gates, enabling the definition of nuanced market conditions.
*   **Strength Scoring:** Each template has a `strength` calculation with `add` (boosters) and `subtract` (penalties), providing a granular score for each signal.
*   **State Management:** The `Stage3State` class implements a proper state machine with grace periods and cooldowns, preventing signal spam.

**Current Signal Templates (v3.2):**

| Template Name | Direction Rule | Base Weight | Description |
| :--- | :--- | :---: | :--- |
| `momentum_inflection` | `momentum_inflection` | 30 | Acceleration turning after deceleration. |
| `breakout_participation` | `breakout_participation` | 25 | Price breakout with volume confirmation. |
| `trend_ignition` | `trend_ignition` | 25 | New trend emerging from consolidation. |
| `squeeze_release` | `squeeze_release` | 20 | Volatility squeeze releasing. |
| `rs_breakout` | `rs_breakout` | 20 | Relative strength breakout. |
| `volatility_shock` | `volatility_shock` | 15 | Unusual price movement detection. |
| `exhaustion` | `exhaustion` | 15 | Momentum exhaustion at extremes. |
| `trend_breakdown` | `trend_breakdown` | 15 | Trend failure/breakdown patterns. |
| `trend_leadership` | `trend_leadership` | 20 | Strong uptrend attention signals. |

### 1.3. AI Review System (Stage 5)

The AI review system (`stage5_ai_review.py`) uses a two-pass approach with Google Gemini.

**Pass A (Independent Chart Score):**
The LLM receives 365 days of raw OHLCV data and is prompted to produce an independent technical assessment. The output includes:
*   `ai_direction_score` (-100 to +100)
*   `subscores` (trend_structure, momentum_alignment, volatility_regime, volume_confirmation, risk_reward_clarity)
*   `attention_level` (URGENT, FOCUS, WATCH, IGNORE)
*   `setup_type` (breakout, breakdown, reversal, continuation, range, mean_reversion, unclear)
*   Actionable fields: `key_levels`, `entry_zone`, `targets`, `why_now`, `risks_and_contradictions`.

**Pass B (Reconciliation):**
An optional pass that compares the AI's independent assessment with the quantitative engine's scores and signals.

**Key Strengths:**

*   **Structured Output:** The use of a JSON schema (`ai_score_schema.json`) ensures consistent, parsable output from the LLM.
*   **Smoothing Logic:** The system includes a clever smoothing mechanism based on chart similarity (`fingerprint`) to prevent wild score swings on days with minimal price change.
*   **Idempotency:** The `input_hash` ensures that the same chart data with the same prompt version does not trigger redundant API calls.

### 1.4. Identified Weaknesses

Despite its architectural strengths, the current system has a critical flaw that the "Project Apex" feedback correctly identifies:

> **"A generic 92/100 score is not tradable because it lacks context."**

The current AI prompt asks the LLM to score the chart holistically. While the output schema includes a `setup_type` field, this classification is performed *after* the score is generated, not before. This means:

1.  **The score is not calibrated to the setup.** An 85 on a "reversal" setup is not comparable to an 85 on a "breakout" setup.
2.  **The subscores are generic.** The `trend_structure` subscore is always evaluated the same way, regardless of whether the trader is looking for a trend-following or a mean-reversion opportunity.
3.  **The AI is doing too much.** By asking the AI to both classify and grade in a single pass, we are not leveraging the quantitative engine's ability to pre-filter and categorize setups.

---

## Part 2: Analysis of "Project Apex" Feedback

The feedback proposes a fundamental shift from a single-pass AI scoring model to a **"Classify First, Grade Second"** hybrid system. This is an excellent strategic direction.

### 2.1. The "7 Master Setups"

The feedback defines 7 distinct market microstructures. These are well-chosen and cover the major categories of tradable setups.

| Category | Setup Name | Core Logic |
| :--- | :--- | :--- |
| **Trend Continuation** | The Pullback | Strong trend dips to MA on light volume. |
| **Trend Continuation** | The Volatility Squeeze (VCP) | Trend consolidates as volume and volatility dry up. |
| **Momentum** | Standard Breakout | Price clears 60-day high on >3x volume. |
| **Momentum** | Institutional Gap-and-Go | Catalyst-driven gap up, closes at high on record volume. |
| **Reversal** | Mean Reversion | Price drops too far, too fast below short-term averages. |
| **Reversal** | Double Bottom (Liquidity Trap) | Price sweeps a previous low, then reverses. |
| **Reversal** | Parabolic Top (Short) | Blow-off top with a rejection candle. |

### 2.2. Alignment with Current Architecture

The proposed setups can be mapped to the existing signal templates in `v32.yaml`:

| Project Apex Setup | Existing Template(s) | Notes |
| :--- | :--- | :--- |
| The Pullback | `momentum_inflection` | Partially overlaps; needs refinement. |
| The Volatility Squeeze | `squeeze_release`, `trend_ignition` | Good alignment. |
| Standard Breakout | `breakout_participation` | Direct match. |
| Institutional Gap-and-Go | `volatility_shock` | Needs a new, specific template. |
| Mean Reversion | `exhaustion` | Good alignment. |
| Double Bottom | *None* | **New template required.** |
| Parabolic Top | `exhaustion` (bearish) | Needs refinement for short setups. |

This analysis shows that the existing infrastructure can be adapted to support the new paradigm. The key changes are:
1.  **Refinement of existing templates** to align with the stricter definitions.
2.  **Addition of new templates** for "Gap-and-Go" and "Double Bottom".
3.  **A new "classification" layer** that maps fired signals to a primary setup type.

### 2.3. The Proposed AI Prompt Re-Engineering

The feedback suggests changing the AI prompt from:

> "Score this chart from 0 to 100."

To:

> "The quantitative engine has identified this as a **Gap-and-Go Breakout**. Grade the chart specifically on the quality of this Gap."

This is the correct approach. By providing the AI with a pre-classified setup, we:
*   **Reduce the AI's cognitive load.** It no longer needs to figure out *what* the chart is; it only needs to judge *how good* it is.
*   **Enable setup-specific rubrics.** The subscores can be tailored to the setup (e.g., for a Pullback, we score "proximity to support" instead of generic "trend_structure").
*   **Ground the score in historical data.** The AI can be informed of the historical win rate for this setup type, adding context to its assessment.

---

## Part 3: Scalable Backtesting System Proposal

The "Project Apex" feedback includes a basic `ApexBacktester` script. While functional, it has limitations that prevent it from being a production-grade research tool. The following proposal outlines a more robust, scalable, and reusable system.

### 3.1. Limitations of the Initial Script

| Issue | Description |
| :--- | :--- |
| **Memory-Bound** | The script loads all historical data for an entire asset type into a single Pandas DataFrame. This will fail for large universes or long time periods. |
| **Hardcoded Setups** | Setup definitions are embedded in the Python code, making iteration slow and error-prone. |
| **No Result Persistence** | Results are printed to the console and lost. There is no way to compare runs or track parameter changes over time. |
| **Simplified Exit Logic** | The script only checks if a stop-loss was hit within 10 days. It does not simulate day-by-day price action or take-profit exits. |

### 3.2. Proposed Architecture

The proposed system addresses these limitations through a modular, database-centric design. A full architectural document has been created at `docs/scalable_backtesting_system_design.md`.

**Core Components:**

1.  **Setup Definition Store (YAML):** Setups are defined in a human-readable YAML format, consistent with the existing signal engine.
2.  **Data Provider:** A module that fetches data for a single asset at a time, keeping memory usage constant.
3.  **Setup Identification Engine:** A stateless engine that applies setup entry rules to historical data.
4.  **Trade Execution Simulator:** An event-driven simulator that processes data day-by-day to determine trade outcomes (stop-loss, take-profit, time-based exit).
5.  **Backtest Results Store (Database):** Three new tables (`backtest_runs`, `backtest_trades`, `backtest_summary_metrics`) to persist all results.

### 3.3. Database Schema

The following tables will be added to the Supabase database:

**`backtest_runs`**

```sql
CREATE TABLE backtest_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setup_name TEXT NOT NULL,
    asset_universe TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    parameters JSONB,
    run_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`backtest_trades`**

```sql
CREATE TABLE backtest_trades (
    trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES backtest_runs(run_id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    entry_date DATE NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_date DATE,
    exit_price NUMERIC,
    exit_reason TEXT, -- 'stop_loss', 'take_profit', 'time_exit'
    return_pct NUMERIC,
    holding_period INTEGER
);
```

**`backtest_summary_metrics`**

```sql
CREATE TABLE backtest_summary_metrics (
    run_id UUID PRIMARY KEY REFERENCES backtest_runs(run_id) ON DELETE CASCADE,
    total_trades INTEGER,
    win_rate NUMERIC,
    profit_factor NUMERIC,
    avg_return_pct NUMERIC,
    sharpe_ratio NUMERIC,
    max_drawdown NUMERIC
);
```

### 3.4. Implementation Roadmap

| Phase | Task | Description |
| :---: | :--- | :--- |
| **1** | Schema Implementation | Create the three new database tables via Supabase migrations. |
| **2** | YAML Template Creation | Convert the 7 master setups into the new YAML template format. |
| **3** | Backtester Script Development | Implement `scripts/run_backtest.py` with the modular architecture. |
| **4** | Initial Backtest Run | Execute the backtester for all 7 setups to generate baseline metrics. |
| **5** | Parameter Optimization | Create `scripts/optimize_setup.py` to run grid searches over parameters. |
| **6** | AI Prompt Re-Engineering | Update `prompts/ai_score_system.txt` to accept a pre-classified setup. |
| **7** | Dashboard Integration | Add a "Setup" column and setup-specific filters to the frontend. |

---

## Part 4: Recommendations

Based on this review, the following actions are recommended:

1.  **Adopt the "Classify First, Grade Second" paradigm.** This is the single most impactful change to improve the actionability of the AI scoring system.

2.  **Prioritize the backtesting system.** Before re-engineering the AI prompts, we need quantitative proof that the 7 master setups are historically profitable. The backtesting system should be the immediate focus.

3.  **Iterate on setup definitions using data.** The initial parameters in the `ApexBacktester` script (e.g., `rvol_20 > 3.0` for breakouts) are starting points. The optimization process will reveal the optimal thresholds for each asset class.

4.  **Introduce a "Primary Setup" field.** Add a new column to the `daily_asset_scores` or `asset_ai_reviews` table to store the classified setup type. This will be the bridge between the quantitative engine and the AI grader.

5.  **Develop setup-specific AI rubrics.** Once the primary setups are validated, create tailored subscore definitions for each. For example, a "Pullback" rubric would include "Proximity to Support (0-5)" and "Trend Health (0-5)".

---

## Conclusion

The Stratos Brain AI Technical Scoring System has a strong architectural foundation. The proposed "Project Apex" enhancements represent a significant evolution that will transform the system from a generic scorer into a precision trading tool. The scalable backtesting system outlined in this document is the critical first step in this transformation, providing the quantitative rigor needed to validate and refine the new setup-based approach.

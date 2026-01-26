# V3 AI System - Gemini JSON Truncation Fix

This document summarizes the investigation and resolution of the critical JSON truncation issue that was blocking the v3 AI analysis system from processing assets with quantitative setups.

## 1. Problem Description

The v3 AI analysis system was failing to process any equity or cryptocurrency that had one or more active quantitative setups (e.g., `rs_breakout`, `weinstein_stage2`). The root cause was traced to the Gemini API (`gemini-3-flash-preview` model) returning truncated or malformed JSON responses when the prompt included the additional context from these setups. This resulted in `JSONDecodeError` exceptions during parsing, causing the analysis for that asset to fail.

**Key Symptoms:**
- Assets *without* setups processed successfully.
- Assets *with* setups failed silently or with JSON parsing errors.
- The `max_output_tokens=4000` setting was insufficient for the larger responses generated when setup context was included.

## 2. Investigation and Solution

Several approaches were tested to resolve the issue. The final, robust solution involves a multi-layered approach to ensure both reliability and performance.

### Initial Attempts

- **Increasing `max_output_tokens` to 8000:** This provided a larger buffer but did not completely solve the problem, as truncation still occurred intermittently.
- **Switching to `gemini-2.0-flash`:** This model consistently returned valid JSON but was not the user's preferred model.

### Final Implemented Solution

The following fixes were implemented in `src/stratos_engine/stages/stage5_ai_review_v3.py`:

| # | Fix | Description |
|---|---|---|
| 1 | **Increased `max_output_tokens` to 16000** | Provides a very large buffer to prevent truncation even with verbose "thinking" from the model. |
| 2 | **Implemented `_parse_json_with_repair()`** | A new method that attempts to repair truncated JSON by adding missing closing brackets (`]`) and braces (`}`). It also handles unterminated strings. |
| 3 | **Added Fallback Model Logic** | If the primary model (`gemini-3-flash-preview`) fails to return valid JSON after 3 retries, the system automatically falls back to the more stable `gemini-2.0-flash` model for that asset. |
| 4 | **Handled List Responses** | The code now correctly handles cases where the model unexpectedly returns a list (`[{...}]`) instead of a dictionary (`{...}`), by simply using the first element of the list. |
| 5 | **Updated Database Constraint** | The `asset_ai_reviews_setup_type_check` constraint in the PostgreSQL database was updated to include all the new setup names from the quantitative signal system (e.g., `gap_up_momentum`, `adx_holy_grail`). |

## 3. Test Results

The implemented solution was tested against a basket of assets known to have active quantitative setups. The system successfully processed all of them using the primary `gemini-3-flash-preview` model.

| Symbol | Primary Setup | Purity Score | Model Used |
|---|---|---|---|
| MSFT | `gap_up_momentum` | 68 | `gemini-3-flash-preview` |
| GOOGL | `adx_holy_grail` | 82 | `gemini-3-flash-preview` |
| AMZN | `trend_pullback_50ma` | 82 | `gemini-3-flash-preview` |
| NVDA | `trend_pullback_50ma` | 85 | `gemini-3-flash-preview` |
| TSLA | `trend_pullback_50ma` | 82 | `gemini-3-flash-preview` |

## 4. Next Steps

The code, including the robust JSON handling and fallback logic, has been committed to the `main` branch. The parallel E2B workflow can now be triggered to process all 4,463 equities for the target date of `2026-01-23`.

**Workflow Trigger:**
- **URL:** [https://github.com/eli-nuss/stratos_brain/actions/workflows/equity-ai-signals-parallel.yml](https://github.com/eli-nuss/stratos_brain/actions/workflows/equity-ai-signals-parallel.yml)
- **Parameters:**
    - `target_date`: `2026-01-23`
    - `sandboxes`: `50`
    - `model`: `gemini-3-flash-preview`

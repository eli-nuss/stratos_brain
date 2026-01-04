# Stratos Brain AI Scoring V2 Implementation Plan

This document outlines the implementation of the new two-pass AI scoring system, incorporating a rubric-based scoring mechanism and a chart-similarity-based smoothing logic, as requested by the user.

## 1. Rubric-Based AI Scoring (Pass A)

The primary change is moving from a single "magic number" score to a calculated score based on a rubric of sub-scores. This is intended to reduce variance and improve the model's consistency by forcing it to grade specific technical aspects.

### 1.1. AI Output Schema Update

The AI model (Pass A) will be instructed to output five sub-scores, each on a scale of 0 to 5.

| Field Name | Type | Range | Description |
| :--- | :--- | :--- | :--- |
| `trend_structure` | Integer | 0-5 | Clarity and strength of the current market structure (e.g., uptrend, consolidation). |
| `momentum_alignment` | Integer | 0-5 | Alignment of short-term and long-term momentum indicators. |
| `volatility_regime` | Integer | 0-5 | Assessment of current volatility (e.g., low-volatility compression, high-volatility expansion). |
| `volume_confirmation` | Integer | 0-5 | Confirmation of price action by volume profile. |
| `risk_reward_clarity` | Integer | 0-5 | How clearly defined the potential entry, stop-loss, and target levels are. |
| `ai_direction_score` | Integer | -100 to 100 | The model's directional conviction (Positive = bullish, Negative = bearish). |
| `confidence` | Float | 0.0 to 1.0 | The model's confidence in its overall assessment. |

### 1.2. `ai_setup_quality_score` Calculation

The final raw setup quality score will be calculated outside the model using the rubric sub-scores:

$$
\text{raw\_ai\_setup\_quality\_score} = 20 \times \sum (\text{subscores})
$$

This results in a score ranging from 0 (all sub-scores are 0) to 100 (all sub-scores are 5).

## 2. Chart Similarity and Smoothing Logic

To prevent large, unwarranted score changes, a smoothing mechanism based on chart similarity will be implemented.

### 2.1. Chart Fingerprint and Similarity

A new utility will be created to compute a "chart fingerprint" and compare it to the previous day's fingerprint.

1.  **Data Input**: Last 60 bars of OHLCV data.
2.  **Normalization**:
    *   Calculate daily returns: $\ln(\text{close} / \text{prev\_close})$.
    *   Calculate volume changes.
    *   Normalize both returns and volume changes using a Z-score transformation (mean and standard deviation calculated over the 60-bar window).
3.  **Fingerprint**: A compact, hashable representation (e.g., SHA256 hash) of the rounded, normalized data vector.
4.  **Similarity**: The cosine similarity between today's normalized data vector and the previous day's normalized data vector.

### 2.2. Smoothing Rule

The smoothing rule will be applied to the `raw_ai_setup_quality_score` and `raw_ai\_direction\_score` to produce the final `smoothed\_` scores.

| Condition | `ai_setup_quality_score` Clamp | `ai_direction_score` Clamp |
| :--- | :--- | :--- |
| $\text{similarity\_to\_prev} \ge 0.98$ | $\pm 10$ points from previous day's smoothed score | $\pm 20$ points from previous day's smoothed score |
| $\text{similarity\_to\_prev} < 0.98$ | No clamp (i.e., $\text{smoothed} = \text{raw}$) | No clamp (i.e., $\text{smoothed} = \text{raw}$) |

The clamping function is:
$$
\text{smoothed} = \min(\max(\text{raw}, \text{prev\_smoothed} - \text{limit}), \text{prev\_smoothed} + \text{limit})
$$

## 3. Database Schema Updates

The `asset_ai_reviews` table will be updated with the following new columns:

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `ai_review_version` | `TEXT` | Version identifier for the AI review logic (e.g., "v2.0"). |
| `fingerprint` | `TEXT` | SHA256 hash of the 60-bar normalized chart data. |
| `similarity_to_prev` | `DOUBLE PRECISION` | Cosine similarity to the previous day's chart fingerprint. |
| `raw_ai_setup_quality_score` | `DOUBLE PRECISION` | Calculated score from the rubric (0-100), before smoothing. |
| `smoothed_ai_setup_quality_score` | `DOUBLE PRECISION` | Final score after smoothing (0-100). Used for dashboard ranking. |
| `raw_ai_direction_score` | `DOUBLE PRECISION` | Model's output direction score (-100 to 100), before smoothing. |
| `smoothed_ai_direction_score` | `DOUBLE PRECISION` | Final score after smoothing (-100 to 100). Used for dashboard ranking. |
| `subscores` | `JSONB` | Stores the raw rubric sub-scores (e.g., `{"trend_structure": 4, ...}`). |

The existing `ai_setup_quality_score` and `ai_direction_score` columns will be deprecated in favor of the `smoothed_` versions in the dashboard view.

## 4. Dashboard Updates

The dashboard will be updated to:
1.  Default sort by `smoothed_ai_setup_quality_score`.
2.  Display `raw_ai_setup_quality_score` and `smoothed_ai_direction_score` (renamed to "AI Quality" and "AI Dir" respectively) in the main table.
3.  The API endpoint (`/dashboard/all-assets`) will be updated to select the `smoothed_` scores and support sorting by them.
4.  The dashboard will be updated to use the `smoothed_` scores for all display and sorting logic.

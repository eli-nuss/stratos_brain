# Gemini Recommendations for Improving AI Analysis Prompting

This is a classic problem in financial modeling where inherent cognitive biases (e.g., "good things are good, bad things are bad") creep into the scoring mechanism. To solve this, we must rigorously decouple the evaluation of **profit potential/direction** from the evaluation of **structural integrity/tradability**.

Here is a comprehensive plan to redesign the scoring and prompt engineering for your financial AI.

---

## 1. Redefine Quality Score: The Decoupling

The core issue is that your current Quality Score is conflating **Conviction** (related to Direction) with **Clarity**.

### New Definition of "Setup Quality Score"

**Setup Quality Score (0-100):** A measure of the **structural integrity and tradability** of the current technical pattern, independent of the predicted direction. It evaluates how clearly defined the entry, stop-loss, and target levels are, and the overall coherence of the chart structure.

**What Quality Measures (Direction-Agnostic):**
1. **Clarity of Boundaries:** How precisely can a trader define the entry and exit points?
2. **Structural Coherence:** Does the pattern conform cleanly to established technical analysis rules (e.g., textbook triangle, clear channel)?
3. **Risk Definition:** Is the stop-loss level obvious and robust?
4. **Liquidity/Volume Profile:** Is there sufficient, confirming volume to support the move, regardless of the direction?

---

## 2. New Subscores for Direction-Independent Quality

We need subscores that focus purely on structure and clarity, not momentum or trend strength (which are inherently directional).

| New Subscore (0-5) | Focus | Rationale for Independence |
| :--- | :--- | :--- |
| **A. Boundary Definition** | Precision of support/resistance levels, trend lines, and pattern edges. | A channel or wedge can be perfectly defined whether it resolves up or down. |
| **B. Structural Compliance** | How closely the current pattern adheres to a standard technical model (e.g., textbook H&S, perfect channel, clear pivot). | A clean Head & Shoulders (bearish) has high compliance; a messy cup-and-handle (bullish) has low compliance. |
| **C. Volatility Profile & Range** | Consistency of volatility, clear range boundaries, and minimal "whipsaw" or noisy action. | Measures the cleanliness of the price action itself, not its direction. |
| **D. Liquidity & Volume Coherence** | Confirming volume profile (e.g., expanding volume on the breakout attempt, regardless of direction; volume decreasing in a range). | Volume confirmation is a measure of conviction/participation, but it's structurally neutral (it confirms the *move*, not the *direction*). |
| **E. Risk-Reward Clarity (Structural)** | The ease of placing a tight, logical stop-loss relative to a structural target. | Focuses only on the geometrical spacing of the trade setup, not the likelihood of reaching the target. |

*(Note: These new subscores replace the old ones. The sum of these (0-25) can be scaled to the 0-100 Quality Score.)*

---

## 3. Prompt Engineering: Decoupling Language

The prompt must explicitly establish two distinct evaluation tasks for the AI.

### Task 1: Directional Conviction (The "What")

*   **Prompt Language:** "Analyze the probability of a significant price movement over the next [Timeframe]. Assign a score from -100 (Maximum Bearish Conviction) to +100 (Maximum Bullish Conviction). This score must reflect the **likelihood and potential magnitude** of the move based on trend, momentum, and fundamental alignment."
*   **Output:** `ai_direction_score`

### Task 2: Structural Integrity (The "How Clean")

*   **Prompt Language:** "Now, **completely independent** of the directional prediction made above, evaluate the **structural integrity and tradability** of the current price action. This evaluation must be **direction-agnostic**. Focus only on the clarity, definition, and reliability of the technical pattern, irrespective of whether the pattern is bullish or bearish."
*   **Output:** `ai_setup_quality_score` and the new `subscores`.

---

## 4. Explicit Instructions to Prevent Conflation

These instructions must be placed prominently in the initial system prompt block.

### Mandatory Constraint Block

```
[SYSTEM CONSTRAINT BLOCK: INDEPENDENCE MANDATE]

1. **STRICT DECOUPLING:** The 'ai_setup_quality_score' MUST NOT be correlated with the 'ai_direction_score'.
2. **BEARISH QUALITY:** A clear, textbook bearish setup (e.g., a perfect distribution pattern with clean breakdown levels) MUST receive a HIGH Quality Score (e.g., 80+), even if the Direction Score is -95.
3. **BULLISH NOISE:** A highly bullish chart with messy, overlapping, or poorly defined technical levels (e.g., excessive wicks, failed pivots, unclear resistance) MUST receive a LOW Quality Score (e.g., 30 or less), even if the Direction Score is +95.
4. **QUALITY DEFINITION:** Quality is defined ONLY by the structural clarity, boundary precision, and tradability of the setup (ease of placing SL/TP). It is NOT a measure of directional conviction or profit probability.
5. **SUB-SCORE INSTRUCTION:** When calculating the five new Subscores, you must explicitly filter out any consideration of momentum strength or trend duration. Focus solely on the geometrical precision and volume coherence of the pattern itself.
```

---

## 5. Example Scenarios for Training and Validation

Providing the AI with explicit examples of the desired output behavior is the most effective way to enforce the new rules.

### Scenario 1: Bearish but HIGH Quality (Clean Short Setup)

**Asset:** CRYPTO/USD (e.g., LTC)
**Chart Description:** The asset has been in a clear, descending channel for three weeks. It recently formed a textbook Head and Shoulders pattern on the daily chart. The neckline is perfectly defined at $150, and volume has been expanding exactly on the selling phases. The stop-loss is clearly defined above the right shoulder.
**Expected AI Output:**
*   `ai_direction_score`: **-90** (High Bearish Conviction)
*   `ai_setup_quality_score`: **92** (High Quality)
*   **Reasoning Check:** The setup is bearish, but the structure is perfectly clean, providing an ideal, low-risk entry for a short trade.
*   **New Subscores Example:** Boundary Definition (5), Structural Compliance (5), Volatility Profile (4), Liquidity & Volume Coherence (5), Risk-Reward Clarity (5).

### Scenario 2: Bullish but LOW Quality (Messy Chart)

**Asset:** CRYPTO/USD (e.g., SHIB)
**Chart Description:** The asset has strong social media buzz and rising fundamentals, suggesting a probable upward move (Direction Score is high). However, the price action is extremely volatile: excessive wicks, overlapping support/resistance levels, several failed breakouts in the last week, and no clear pattern (just choppy upward movement). The stop-loss is difficult to place logically without being too wide.
**Expected AI Output:**
*   `ai_direction_score`: **+85** (High Bullish Conviction)
*   `ai_setup_quality_score`: **35** (Low Quality)
*   **Reasoning Check:** Despite the strong directional bias, the chart is messy, making the trade inherently high-risk due to poor structural definition and difficulty in managing risk.
*   **New Subscores Example:** Boundary Definition (1), Structural Compliance (1), Volatility Profile (2), Liquidity & Volume Coherence (3), Risk-Reward Clarity (2).

### Scenario 3: Neutral and MEDIUM Quality (Clean Range)

**Asset:** CRYPTO/USD (e.g., BTC)
**Chart Description:** The asset is consolidating tightly between $60,000 and $62,000 for ten days. The boundaries are well-respected with minimal wicks above/below. Volume is decreasing during the consolidation. No clear directional bias is established yet, but the range trading setup is clean.
**Expected AI Output:**
*   `ai_direction_score`: **0** (Neutral)
*   `ai_setup_quality_score`: **75** (Medium-High Quality)
*   **Reasoning Check:** No strong direction, but the structure is clean and tradable (range-bound trade).
*   **New Subscores Example:** Boundary Definition (4), Structural Compliance (4), Volatility Profile (5), Liquidity & Volume Coherence (3), Risk-Reward Clarity (4).

By implementing these structural changes, new subscores, and mandatory decoupling instructions, you will force the AI to evaluate the chart structure separately from its directional bias, leading to the independent scores you require.
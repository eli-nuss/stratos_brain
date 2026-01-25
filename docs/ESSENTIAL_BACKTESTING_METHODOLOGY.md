# Essential Backtesting Methodology

**Author:** Manus AI
**Date:** January 25, 2026

## 1. Objective

This document outlines the essential, streamlined methodology for identifying and validating high-probability trading setups. The goal is to find what works well right now, with a focus on practical implementation and clear, actionable results.

## 2. Core Principles

| Principle | Description |
|---|---|
| **Setup-Specific Exit Optimization** | The core of the system. We optimize exit parameters for each setup individually. |
| **Walk-Forward Validation** | Ensures results are not overfit to a single time period. |
| **Simple Friction Model** | A flat 0.15% friction is applied to every trade to simulate real-world costs. |
| **Market Regime Filter** | A simple market breadth filter (>50% of stocks above 200 MA) is used to avoid testing in bear markets. |

## 3. The Essential Workflow

```mermaid
graph TD
    A[Phase 1: Define Setups] --> B[Phase 2: Optimize Exits];
    B --> C[Phase 3: Validate];
    C --> D[Phase 4: Rank & Analyze];

    subgraph A [Phase 1]
        A1[Define Entry Conditions]
        A2[Categorize (Short/Medium-Term)]
    end

    subgraph B [Phase 2]
        B1[Grid Search Exit Parameters]
        B2[Apply Friction & Regime Filter]
    end

    subgraph C [Phase 3]
        C1[Walk-Forward Test]
        C2(Train 2020-2022, Test 2023-2024)
    end

    subgraph D [Phase 4]
        D1[Rank by Reliability Score]
        D2[Identify Top 3-5 Setups]
    end
```

### Phase 1: Define Setups

1.  **Entry Conditions:** Each setup is defined by a clear set of entry rules.
2.  **Timeframe Categorization:** Setups are categorized as either **Short-Term (1-4 weeks)** or **Medium-Term (1-6 months)**.

### Phase 2: Optimize Exits

For each setup individually, we perform a grid search to find the optimal exit parameters:

-   **Parameters Tested:** Stop loss, profit target, time stop, trailing stop.
-   **Friction:** A 0.15% fee is applied to each trade.
-   **Regime Filter:** The backtest is only run when market breadth is positive.

### Phase 3: Validate

We use a simple walk-forward validation to ensure robustness:

-   **Train:** Optimize parameters on 2020-2022 data.
-   **Test:** Run the backtest with the best parameters on 2023-2024 data.

### Phase 4: Rank & Analyze

-   Setups are ranked by their **Reliability Score** (a composite of win rate, profit factor, and trade count).
-   The top 3-5 setups are identified as viable candidates for live trading.

## 4. Conclusion

This streamlined methodology provides a practical and effective way to identify what works well right now. It focuses on the essentials of backtesting and optimization, leaving more advanced portfolio construction and execution techniques for a later stage.

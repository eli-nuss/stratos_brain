# Stratos Brain Backtesting Methodology

**Author:** Manus AI
**Date:** January 25, 2026

## 1. Executive Summary

This document outlines the definitive backtesting and optimization methodology for the Stratos Brain platform. Our core objective is to **identify and validate high-probability trading setups** by systematically testing entry conditions and optimizing exit strategies across multiple timeframes. The system is designed from the ground up to be **auditable, modular, and data-driven**.

Our key finding is that a **one-size-fits-all approach does not work**. Different trading ideas require different holding periods and exit logic. Therefore, we have designed a **dual-timeframe architecture** that separates strategies into two distinct "lenses":

1.  **Short-Term Lens (1-4 weeks):** Focuses on mean reversion and momentum plays with tight stops and quick exits.
2.  **Medium-Term Lens (1-6 months):** Focuses on trend following and relative strength with wider stops and patient holds.

This document details the complete workflow, from data preparation to final analysis.

## 2. Core Principles

The entire system is built on these foundational principles:

| Principle | Description |
|---|---|
| **Setup-Specific Exits** | Exit logic MUST match the entry thesis. A mean reversion trade should not have a trend-following exit. |
| **Dual Timeframe** | Strategies are explicitly categorized as either short-term or medium-term, with appropriate parameters for each. |
| **Optimization is Key** | We do not assume parameters. Both entry and exit parameters are systematically optimized through grid search. |
| **Data-Driven Decisions** | All decisions are based on backtested performance metrics, not intuition. |
| **Auditability** | Every trade is logged with the exact conditions that triggered entry and exit, ensuring full transparency. |
| **Market Regime Awareness** | The system incorporates a market breadth filter to avoid taking long trades in bear markets. |

## 3. The Backtesting Workflow

The process follows a systematic 5-phase approach:

```mermaid
graph TD
    A[Phase 1: Data Preparation] --> B[Phase 2: Setup Definition];
    B --> C[Phase 3: Parameter Optimization];
    C --> D[Phase 4: Validation & Ranking];
    D --> E[Phase 5: AI Integration];

    subgraph A [Phase 1]
        A1[Load Universe (S&P 500)]
        A2[Calculate Features]
        A3[Load Market Breadth Data]
    end

    subgraph B [Phase 2]
        B1[Define Entry Conditions]
        B2[Categorize (Short/Medium-Term)]
        B3[Define Exit Parameter Grids]
    end

    subgraph C [Phase 3]
        C1[Grid Search All Exit Parameters]
        C2[Identify Optimal Params for Each Setup]
    end

    subgraph D [Phase 4]
        D1[Run Final Backtest with Optimal Params]
        D2[Apply Market Regime Filter]
        D3[Rank Setups by Reliability Score]
        D4[Out-of-Sample Testing]
    end

    subgraph E [Phase 5]
        E1[Update AI Scoring Prompts]
        E2[Generate Dual-Timeframe Thesis]
    end
```

### Phase 1: Data Preparation

1.  **Universe Selection:** We use a universe of the S&P 500 components, filtered for liquidity and data availability.
2.  **Feature Calculation:** All technical indicators (MAs, RSI, ATR, etc.) are pre-calculated and stored in the `daily_features` table.
3.  **Market Regime:** Market breadth (% of stocks above 200 MA) is calculated daily to serve as a regime filter.

### Phase 2: Setup Definition

1.  **Entry Logic:** Each setup is defined by a clear, non-discretionary set of entry conditions (e.g., `rsi_14 < 30` and `ma_dist_20 < -0.10`).
2.  **Timeframe Categorization:** Each setup is assigned to either the **Short-Term** or **Medium-Term** lens.
3.  **Exit Parameter Grid:** For each category, we define a grid of possible exit parameters to be tested (e.g., different stop-loss multipliers, MA breakdown levels, holding periods).

### Phase 3: Parameter Optimization

This is the most critical phase. For each setup, we perform a **grid search** to test every possible combination of its exit parameters.

-   **Example: Mean Reversion Optimization**
    -   Test `target_ma`: `sma_20`, `sma_50`
    -   Test `time_stop_days`: `5`, `10`, `15`
    -   Test `stop_atr_mult`: `1.5`, `2.0`, `2.5`

The combination that produces the highest **Reliability Score** is selected as the optimal configuration for that setup.

### Phase 4: Validation & Ranking

1.  **Final Backtest:** We run a final backtest for all setups using their individually optimized exit parameters.
2.  **Regime Filter:** The market regime filter is applied to this final run.
3.  **Ranking:** Setups are ranked by their **Reliability Score**, a composite metric that balances win rate, profit factor, average return, and sample size.
4.  **Out-of-Sample (OOS) Test:** The top-ranked setups are then tested on a separate, unseen period of data (e.g., 2024-2025) to ensure they are not over-optimized.

### Phase 5: AI Integration

Once a setup is validated, its logic is integrated into the Stratos Brain AI scoring system.

-   The AI is trained to recognize the setup and provide a **dual-timeframe thesis**:
    -   **Short-Term Thesis:** What to expect in the next 1-4 weeks.
    -   **Medium-Term Thesis:** The outlook for the next 1-6 months.

## 4. System Architecture

The system is designed as a modular Python application:

-   `master_backtester.py`: The core engine that runs the backtests.
-   `optimize_exits.py`: The script that performs the grid search optimization.
-   `config/setups.py`: A central file defining all setup entry conditions.
-   `config/exit_grids.py`: A file defining the parameter grids for optimization.
-   `data/`: Directory where all results (JSON, CSV) are stored for analysis.

This modular design allows for easy addition of new setups and parameters.

## 5. Conclusion

This methodology provides a robust and systematic framework for identifying and validating profitable trading strategies. By embracing the principles of setup-specific exits, dual timeframes, and rigorous optimization, we can build a powerful and reliable AI-powered analysis platform.

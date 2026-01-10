# Stratos Brain: Comprehensive Codebase Review

**Author:** Manus AI
**Date:** January 10, 2026

## 1. Introduction

This document provides a comprehensive review of the Stratos Brain project, a sophisticated financial analysis platform. The review covers the frontend dashboard, backend data processing engine, Supabase database and edge functions, and the automated data ingestion workflows. The goal is to provide a clear understanding of the current state of the codebase and to identify key architectural patterns, strengths, and potential areas for enhancement.

## 2. Frontend Architecture (React & Vite)

The frontend is a modern, single-page application (SPA) built with **React**, **TypeScript**, and **Vite**. It uses **Tailwind CSS** for styling and **Shadcn/UI** for its component library, providing a clean and consistent user interface.

| Aspect                  | Technology/Pattern                                    |
| ----------------------- | ----------------------------------------------------- |
| **Framework/Bundler**   | React 18, Vite                                        |
| **Language**            | TypeScript                                            |
| **Styling**             | Tailwind CSS, Shadcn/UI                               |
| **Routing**             | `wouter`                                              |
| **Data Fetching**       | SWR (`useSWR`)                                        |
| **State Management**    | SWR for server state, `useState`/`useContext` for UI state |

### Key Components & Structure

The application is well-structured, with a clear separation of concerns:

-   **`pages/`**: Contains top-level components for each major route (e.g., `Home.tsx`, `CompanyChat.tsx`, `Documentation.tsx`). The `Home.tsx` component is the main entry point for most data-driven views, dynamically rendering different tables based on the URL.
-   **`components/`**: A rich library of reusable components. Key components include:
    -   `DashboardLayout.tsx`: The main application shell, including navigation, header, and status bar.
    -   `CustomizableAssetTable.tsx`: A flexible data table used to display lists of assets (e.g., all equities, all crypto).
    -   `AssetDetail.tsx`: A detailed modal view for a single asset, which includes charts, AI analysis, a trade plan, and related documents.
-   **`hooks/`**: Custom hooks abstract the data-fetching logic, making components cleaner. `useAllAssets.ts` and `useDashboardData.ts` are central to fetching and managing the main datasets displayed in the tables.
-   **`contexts/`**: React contexts are used for managing global state like authentication (`AuthContext.tsx`) and theme (`ThemeContext.tsx`).

### Data Flow

1.  The main `Home.tsx` page determines the active view (e.g., Watchlist, Equities, Crypto) from the URL.
2.  It then renders the appropriate data table component (e.g., `CustomizableWatchlistTable`, `CustomizableAssetTable`).
3.  These table components use custom hooks like `useAllAssets` to fetch data from the backend via SWR.
4.  The hooks construct the appropriate API URL and handle caching, revalidation, and loading states.
5.  When a user clicks on an asset, the URL changes, and the `AssetDetail.tsx` component is rendered in a modal, fetching its own data via the `/api/dashboard/asset` endpoint.

## 3. Backend Architecture (Python & Stratos Engine)

The backend is a Python-based data processing pipeline named **Stratos Engine**. Its primary responsibility is to ingest raw data, compute a wide range of features, and run AI analysis.

| Aspect                  | Technology/Pattern                                    |
| ----------------------- | ----------------------------------------------------- |
| **Language**            | Python 3.11                                           |
| **AI/ML**               | `google-genai` (for Gemini)                           |
| **Database**            | `psycopg2` for direct PostgreSQL connection           |
| **Architecture**        | Multi-stage data processing pipeline                  |

### Pipeline Stages

The engine is organized into a series of stages located in `src/stratos_engine/stages/`. The core logic resides in `stage5_ai_review.py`, which performs a two-pass AI analysis:

1.  **Pass A (Independent Score):** A Gemini model analyzes the raw OHLCV data for an asset to generate a directional score and rationale, without any knowledge of the engine's other calculated features.
2.  **Pass B (Reconciliation):** A second (optional) pass compares the AI's independent analysis with the engine's calculated signals and scores to provide a reconciled view.

This two-pass approach is a sophisticated method for reducing bias and ensuring the AI's analysis is grounded in pure price action before being influenced by other indicators.

## 4. Database (Supabase & PostgreSQL)

The project uses a **Supabase-hosted PostgreSQL** database as its central data store. The schema is well-structured and managed via versioned SQL migration files.

### Key Tables

| Table Name             | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `assets`               | Master list of all tracked assets (crypto and equity).                      |
| `daily_bars`           | Raw daily OHLCV price data.                                                 |
| `daily_features`       | Calculated technical indicators and features for each asset.                |
| `asset_ai_reviews`     | Stores the output from the AI analysis pipeline.                            |
| `equity_metadata`      | Stores fundamental and descriptive data for equity assets.                  |

### Database Views

The database makes excellent use of SQL views (e.g., `v_dashboard_base`, `v_dashboard_inflections`) to pre-join and aggregate data. This simplifies the backend API, improves performance, and allows the frontend to query complex datasets with simple API calls. The `007_dashboard_liquidity_ai.sql` migration is a great example, creating a base view that joins scores, features, and AI reviews while also applying a liquidity filter.

## 5. Edge Functions (Deno & TypeScript)

Supabase Edge Functions, written in **Deno (TypeScript)**, serve as the primary API layer between the frontend and the database.

-   **`control-api`**: This is the main API gateway. It exposes a comprehensive set of RESTful endpoints for almost all frontend data needs, from fetching asset lists and details to managing user watchlists and notes. It intelligently routes requests and handles authentication.
-   **`company-chat-api`**: This function powers the company-specific research chat. It uses a unified function-calling approach with Gemini, wrapping database lookups, web searches (via Google Custom Search), and sandboxed Python code execution (via E2B) as callable tools for the AI.
-   **`generate-document`**: This function is responsible for generating detailed investment memos and one-pagers. It fetches all available data for an asset and uses Gemini with a detailed system prompt and template to produce the final document.

## 6. Workflows (GitHub Actions)

The project's data pipelines are automated using **GitHub Actions**, not n8n as initially suspected. The workflows are defined in YAML files within the `.github/workflows/` directory.

### Pipeline Structure

There are two parallel pipelines, one for crypto and one for equities, each consisting of three stages:

1.  **OHLCV Ingestion:** Fetches daily price data from CoinGecko (for crypto) or Alpha Vantage (for equities).
2.  **Features Calculation:** Computes technical indicators from the raw price data.
3.  **AI Signals:** Runs the main AI analysis script (`run_all_crypto.py` or `run_all_equities.py`).

These workflows are chained together using the `workflow_run` trigger, ensuring that each stage runs only after the previous one has successfully completed. This is a robust and effective way to manage dependent jobs.

## 7. Summary & Recommendations

The Stratos Brain project is a well-architected and sophisticated platform. The codebase demonstrates a clear understanding of modern web development practices, data engineering principles, and advanced AI integration.

### Key Strengths

-   **Decoupled Architecture:** The separation between the frontend, backend API (Edge Functions), and data processing engine allows for independent development, scaling, and maintenance.
-   **Modern Tech Stack:** The use of React, TypeScript, Python 3.11, and Deno positions the project at the forefront of current technology.
-   **Sophisticated AI Implementation:** The two-pass AI review and the function-calling chat agent are advanced and powerful features.
-   **Robust Data Pipeline:** The use of chained GitHub Actions workflows for data ingestion is reliable and well-structured.

### Recommendations

-   **Consolidate Environment Variables:** There are multiple sources of truth for configuration (project files, Supabase secrets, GitHub Actions secrets). Consider centralizing all non-sensitive configuration and using a single secrets management solution for all environments.
-   **Error Handling and Monitoring:** While the workflows have success rate thresholds, adding more granular monitoring and alerting (e.g., for specific API failures or data quality issues) would further improve robustness.
-   **Component Storybook:** For a component library as rich as this, implementing Storybook would help with documentation, testing, and isolated development of UI components.

This concludes the comprehensive review. I am now ready to discuss the new features you would like to implement.

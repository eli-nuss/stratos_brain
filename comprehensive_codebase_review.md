# Stratos Brain: A Comprehensive Codebase Review

**Author:** Manus AI
**Date:** January 08, 2026

## 1. Introduction

This document provides a comprehensive review of the Stratos Brain project, a sophisticated financial analysis platform designed to identify high-probability trading setups in the cryptocurrency and equity markets. The review covers the project's documentation, codebase, database schema, backend and frontend architecture, and key workflows. The goal is to provide a deep understanding of the system's inner workings to facilitate future development and collaboration.

## 2. Project Overview

The Stratos Brain is an AI-powered platform for the technical analysis of financial assets. Its core function is to automate the identification and evaluation of trading setups by leveraging a combination of quantitative signals, chart pattern recognition, and AI-driven analysis. The project is built on a modern technology stack, utilizing a Supabase backend for data storage and management, a Python-based worker for data processing and analysis, and a React frontend for the user-facing dashboard. The entire infrastructure is deployed on Vercel, with continuous integration and deployment managed through GitHub.

The system's architecture is designed to be modular, with distinct stages for data ingestion, feature calculation, signal generation, scoring, and AI-powered review. This modularity allows for scalability and the independent development of specialized analytical agents. The ultimate vision for the Stratos Brain is to create a comprehensive, AI-driven platform that can automate many of the analytical tasks traditionally performed by a team of fund analysts, providing users with actionable insights to inform their trading decisions.

## 3. Database Schema

The project's data is stored in a PostgreSQL database managed by Supabase. The schema is well-structured and designed to support the various stages of the data processing pipeline. The key tables in the database are:

| Table Name | Description |
| :--- | :--- |
| `engine_configs` | Stores versioned configurations for the signal engine, including parameters and weights. |
| `engine_jobs` | Manages the queue of jobs to be processed by the Python worker, with support for different job types (e.g., daily runs, recomputations). |
| `pipeline_runs` | Provides an audit trail of all pipeline executions, including status, timings, and error logs. |
| `daily_bars` | Stores raw OHLCV (Open, High, Low, Close, Volume) data for each asset. |
| `daily_features` | Contains calculated technical indicators and features derived from the `daily_bars` data. |
| `daily_signal_facts` | Stores the output of the signal evaluation stage, including signal strength and direction. |
| `signal_instances` | Tracks the state of active signals over time, including their first and last seen dates. |
| `daily_asset_scores` | Aggregates signal data to produce daily scores for each asset, including a weighted score and an inflection score. |
| `asset_ai_reviews` | Stores the output of the AI-powered chart review, including the AI's thesis, confidence, and recommended actions. |
| `equity_quarterly_fundamentals` | Stores quarterly financial statement data for equities. |
| `equity_annual_fundamentals` | Stores annual financial statement data for equities. |

The database also utilizes several views (e.g., `v_active_signals`, `v_leaders`, `v_risks`, `v_equity_fundamentals`) to provide aggregated and filtered data to the frontend dashboard, simplifying the presentation of complex analytical information.

## 4. Backend Architecture

The backend of the Stratos Brain is powered by a Python worker that processes jobs from a `pgmq` queue in the Supabase database. The worker is responsible for executing the various stages of the data analysis pipeline, which include:

- **Stage 1: Data Fetching and Feature Calculation**: Ingests raw market data from external APIs (AlphaVantage for equities, CoinGecko for crypto) and calculates a wide range of technical indicators.
- **Stage 2: AI Analysis (Legacy)**: An older AI analysis stage that has been largely superseded by Stage 5.
- **Stage 3: State Machine**: Manages the state of signal instances, transitioning them from 'new' to 'active' to 'ended'.
- **Stage 4: Scoring**: Aggregates signal data to produce daily scores for each asset, including a `weighted_score` and an `inflection_score`.
- **Stage 5: AI Review**: A two-pass, LLM-powered chart analysis that provides a qualitative review of trading setups.

The backend also includes a Supabase Edge Function, `control-api`, which provides a RESTful interface for managing the signal engine. This API allows the frontend to enqueue new jobs, retrieve status updates, and access the results of the analysis.

## 5. Frontend Architecture

The frontend is a modern, responsive dashboard built with React, TypeScript, and Vite. It utilizes a variety of libraries to create a rich and interactive user experience, including:

- **Wouter** for routing
- **SWR** for data fetching and caching
- **Recharts** for charting
- **Tailwind CSS** for styling
- **Shadcn/ui** for UI components

 The main components of the dashboard include:

- **`DashboardLayout`**: The main layout of the dashboard, including the top status bar and navigation.
- **`AllAssetsTable`**: A table that displays all assets of a given type (crypto or equity), with sorting, filtering, and pagination.
- **`AssetDetail`**: A modal that provides a detailed view of a single asset, including a chart, AI analysis, and trade plan.

 The frontend communicates with the backend via the `control-api` Edge Function, which acts as a proxy to the Supabase database.

## 6. Key Workflows

The Stratos Brain project has two primary workflows: the daily data processing pipeline and the user interaction with the dashboard.

### Daily Data Processing Pipeline

1.  A new job is enqueued in the `engine_jobs` table, typically triggered by a `pg_cron` schedule.
2.  The Python worker picks up the job from the `pgmq` queue.
3.  The worker executes the data processing pipeline, which includes fetching new data, calculating features, evaluating signals, and generating scores.
4.  For high-potential setups, the worker triggers the Stage 5 AI Review, which generates a qualitative analysis of the trading opportunity.
5.  The results of the analysis are stored in the appropriate tables in the Supabase database.

### User Interaction with the Dashboard

1.  The user navigates to the Stratos Brain dashboard in their web browser.
2.  The frontend fetches data from the Supabase database via the `control-api` Edge Function.
3.  The user can view their watchlist, browse different asset classes, and sort and filter the data to identify interesting trading opportunities.
4.  When the user clicks on an asset, the `AssetDetail` modal is displayed, showing a detailed analysis of the asset, including the AI's review and a suggested trade plan.

## 7. Summary of Findings and Recommendations

The Stratos Brain is a powerful and well-architected platform for AI-powered technical analysis. The project is built on a modern and scalable technology stack, and the codebase is well-organized and modular. The database schema is well-designed and effectively supports the data processing pipeline.

Based on the project documentation and my review of the codebase, here are some key recommendations for future development:

- **Implement Backtesting and Reinforcement Learning**: As suggested in the project's discussion summary, implementing a rigorous backtesting process is crucial for validating the AI's models and enabling reinforcement learning. This will allow the AI to learn from its past performance and continuously improve the accuracy of its predictions.
- **Enhance UI/UX**: The user interface could be further enhanced by implementing the requested features, such as multi-column sorting and a more effective filtering system for equities. Integrating TradingView charts directly into the frontend would also provide a more comprehensive charting experience for users.
- **Develop the Memo Generation Agent**: The development of a memo generation agent, as discussed in the project summary, would be a valuable addition to the platform. This would provide users with a fundamental narrative to complement the platform's technical analysis, creating a more holistic view of each trading opportunity.
- **Continue to Enrich Data**: The platform could be further enriched by integrating additional data points, such as sentiment analysis from news and social media, and more fundamental data for equities.

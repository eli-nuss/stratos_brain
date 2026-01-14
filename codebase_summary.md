# Stratos Brain Codebase Review

This document provides a comprehensive overview of the Stratos Brain codebase, detailing its architecture, data pipelines, and core features.

## 1. Project Overview

Stratos Brain is an AI-powered financial analysis platform designed to automate the identification and evaluation of trading setups for cryptocurrencies and equities. It combines quantitative signals, technical analysis, and AI-driven insights to provide institutional-grade research capabilities.

### Technology Stack

| Component         | Technology                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| **Frontend**      | React, TypeScript, Vite, Tailwind CSS, wouter, SWR                      |
| **Backend**       | Supabase (PostgreSQL, Edge Functions), Deno, Express.js (proxy)         |
| **Database**      | Supabase PostgreSQL with pg_cron and pgmq for job scheduling and queuing |
| **AI & ML**       | Google Gemini 3 Pro, Python, scikit-learn                               |
| **CI/CD**         | GitHub Actions                                                          |
| **Data Sources**  | Alpha Vantage (Equities), CoinGecko (Crypto), Financial Modeling Prep (Fundamentals) |

## 2. System Architecture

The system is architected around a React-based frontend dashboard that communicates with a Supabase backend. The backend consists of a PostgreSQL database, a series of Deno-based Edge Functions for real-time API requests, and a Python-based data processing pipeline for asynchronous jobs.

### 2.1. Frontend Architecture

The frontend is a single-page application (SPA) built with React and TypeScript. Key architectural aspects include:

*   **Component-Based Structure**: The UI is organized into reusable components located in `dashboard/client/src/components`. This includes UI primitives (e.g., `Button`, `Card`), composite components (e.g., `CustomizableAssetTable`), and page-level layouts (`DashboardLayout`).
*   **Routing**: Client-side routing is handled by `wouter`, with routes defined in `App.tsx`. The application supports various views, including the main dashboard, asset detail pages, a global AI chat (`StratosBrain.tsx`), and a smart money tracking interface (`InvestorWatchlist.tsx`).
*   **State Management**: Global state, such as authentication and theme, is managed via React Context (`contexts/AuthContext.tsx`, `contexts/ThemeContext.tsx`). Local and remote data state is managed with SWR (`useSWR`), which provides caching, revalidation, and data fetching hooks (e.g., `hooks/useAllAssets.ts`).
*   **API Interaction**: The frontend communicates with the backend via a proxy server (`dashboard/server/index.ts`) that forwards requests to the appropriate Supabase Edge Functions. This abstracts the backend API from the client and manages API key authentication.

### 2.2. Backend Architecture

The backend is built on Supabase, leveraging its integrated services:

*   **Database**: A PostgreSQL database serves as the primary data store. It houses all financial data, user information, and application state. The schema is managed via SQL migration files in `supabase/migrations`.
*   **Edge Functions**: A collection of Deno-based serverless functions in `supabase/functions` provides the core API. These functions handle requests for data, AI analysis, and user actions. The main API gateway is the `control-api`, which routes requests to various internal services.
*   **Authentication**: User authentication is handled by Supabase Auth, supporting Google OAuth with domain restrictions.
*   **Job Queuing**: Asynchronous tasks, such as data ingestion and AI analysis, are managed using `pgmq`, a message queue extension for PostgreSQL. Jobs are enqueued via the `control-api` and processed by the Python pipeline.

### 2.3. Python Data Pipeline

A Python-based data processing pipeline, located in the `src/stratos_engine` directory, is responsible for fetching, processing, and analyzing financial data. The pipeline is divided into several stages:

*   **Stage 1: Fetch & Features**: Ingests raw data from external APIs (Alpha Vantage, CoinGecko) and calculates a wide range of technical indicators.
*   **Stage 2: AI Analysis**: Runs AI models (Gemini) to generate qualitative analysis and trading signals.
*   **Stage 3: State Machine**: Manages the state of trading signals over time (e.g., new, active, expired).
*   **Stage 4: Scoring**: Calculates composite scores for assets based on technical and AI-driven metrics.
*   **Stage 5: AI Review**: Performs a final AI review to generate human-readable summaries and theses.

## 3. Data Sources and Ingestion

Stratos Brain relies on several external data sources to fuel its analysis:

| Data Source               | Type           | Usage                                     |
| ------------------------- | -------------- | ----------------------------------------- |
| **Alpha Vantage**         | Equities       | Daily OHLCV data                          |
| **CoinGecko**             | Cryptocurrencies | Daily OHLCV and market data               |
| **Financial Modeling Prep** | Fundamentals   | Company financial statements and filings  |

Data ingestion is automated via GitHub Actions workflows, which run on a daily schedule. The `run_all_equities.py` and `run_all_crypto.py` scripts manage the end-to-end data pipeline for their respective asset classes.

## 4. Core Features

*   **Customizable Dashboard**: Users can view and filter assets in a highly customizable table, with views for their watchlist, equities, and cryptocurrencies.
*   **AI Chat (Stratos Brain)**: A global chat interface allows users to ask natural language questions about the market, specific assets, or economic events. The chat is powered by Gemini 3 Pro and has access to a wide range of tools for data retrieval and analysis.
*   **Company-Specific Chat**: Each asset has its own dedicated chat interface, providing a focused environment for deep research and analysis.
*   **Smart Money Tracking**: The `InvestorWatchlist` feature allows users to track the portfolios of institutional investors (gurus) based on 13F filings.
*   **Fundamental Vigor Score (FVS)**: An AI-driven scoring system that evaluates the fundamental health of a company based on profitability, solvency, growth, and moat.
*   **Automated Document Generation**: The platform can automatically generate investment memos and one-pagers based on AI analysis.

## 5. Automated Workflows

Automation is a key aspect of the Stratos Brain platform. The `.github/workflows` directory contains a series of GitHub Actions that orchestrate the entire data pipeline:

*   **Data Ingestion**: Separate workflows for fetching daily OHLCV data for equities and crypto.
*   **Feature Calculation**: Workflows that trigger after data ingestion to calculate technical features.
*   **AI Signal Generation**: Workflows that run the AI analysis pipeline to generate trading signals and reviews.
*   **Fundamental Data Updates**: Workflows for fetching and updating company fundamental data.
*   **Deployment**: A workflow for deploying Supabase Edge Functions.

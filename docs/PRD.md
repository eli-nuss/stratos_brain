# Product Requirements Document (PRD): Stratos Brain

**Document Version:** 1.0  
**Last Updated: January 30, 2026 (v11.5.0 - Feature: Daily Brief V4 enhanced with live market data, alerts, and visual polish)  
**Author:** Stratos Team  
**Status:** Living Document

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. 2. [Product Overview](#2-product-overview)
   3. 3. [System Architecture](#3-system-architecture)
      4. 4. [Core Features](#4-core-features)
         5. 5. [Database Schema](#5-database-schema)
            6. 6. [Data Sources & Integrations](#6-data-sources--integrations)
               7. 7. [Automated Workflows](#7-automated-workflows)
                  8. 8. [API Reference](#8-api-reference)
                     9. 9. [Frontend Architecture](#9-frontend-architecture)
                        10. 10. [AI Chat System](#10-ai-chat-system)
                            11. 11. [Roadmap & Planned Features](#11-roadmap--planned-features)
                                12. 12. [Non-Functional Requirements](#12-non-functional-requirements)
                                    13. 13. [Success Metrics](#13-success-metrics)
                                        14. 14. [Known Limitations](#14-known-limitations)
                                           
                                            15. ---
                                           
                                            16. ## 1. Executive Summary
                                           
                                            17. ### Product Identity
                                           
                                            18. | Attribute | Value |
                                            19. |-----------|-------|
                                            20. | **Product Name** | Stratos Brain |
                                            21. | **Version** | Signal Engine v3.2 |
                                            22. | **Live URL** | https://stratos-dashboard.vercel.app |
                                            23. | **Repository** | https://github.com/eli-nuss/stratos_brain |
                                           
                                            24. ### Vision Statement
                                           
                                            25. Stratos Brain is an AI-powered financial analysis platform that automates the identification and evaluation of trading setups across cryptocurrencies and equities. By combining quantitative signals, technical analysis, and AI-driven insights, Stratos Brain delivers institutional-grade research capabilities to individual traders and investment professionals.
                                           
                                            26. ### Target Users
                                           
                                            27. - Individual traders seeking automated technical analysis
                                                - - Fund analysts requiring comprehensive research tools
                                                  - - Investment professionals needing AI-augmented decision support
                                                    - - Quantitative researchers exploring signal-based strategies
                                                     
                                                      - ---

                                                      ## 2. Product Overview

                                                      ### 2.1 Problem Statement

                                                      Traditional financial analysis requires significant manual effort across multiple domains:
                                                      - Data gathering from disparate sources
                                                      - - Technical indicator calculation and interpretation
                                                        - - Chart pattern recognition and analysis
                                                          - - Fundamental research synthesis
                                                            - - News and sentiment monitoring
                                                             
                                                              - Retail and smaller institutional investors lack access to the comprehensive analytical tools available to large hedge funds, creating an information asymmetry in the market.
                                                             
                                                              - ### 2.2 Solution
                                                             
                                                              - Stratos Brain automates the end-to-end analytical workflow through:
                                                             
                                                              - - **Automated Data Ingestion**: Daily ingestion from CoinGecko (crypto), Alpha Vantage (equities), and Financial Modeling Prep (fundamentals)
                                                                - - **Quantitative Signal Detection**: 11 technical setup templates for pattern recognition
                                                                  - - **Two-Pass AI Analysis**: Bias-reduced analysis using independent and reconciled AI passes
                                                                    - - **AI Research Agents**: Chat-based research with code execution and web search
                                                                      - - **Document Generation**: Automated investment memos and one-pagers
                                                                        - - **Smart Money Tracking**: Institutional holdings and 13F filing analysis
                                                                         
                                                                          - ---

                                                                          ## 3. System Architecture

                                                                          ### 3.1 High-Level Architecture Diagram

                                                                          ```
                                                                          ┌─────────────────────────────────────────────────────────────────────────────┐
                                                                          │                              STRATOS BRAIN                                  │
                                                                          ├─────────────────────────────────────────────────────────────────────────────┤
                                                                          │                                                                             │
                                                                          │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
                                                                          │  │    Dashboard    │───▶│   Edge Funcs    │───▶│      Supabase DB        │  │
                                                                          │  │    (React)      │    │   Control API   │    │                         │  │
                                                                          │  │                 │    │  Company Chat   │    │  • assets               │  │
                                                                          │  │  • Watchlist    │    │  Global Brain   │    │  • daily_bars           │  │
                                                                          │  │  • Equities     │    │  Generate Doc   │    │  • daily_features       │  │
                                                                          │  │  • Crypto       │    │  Feedback API   │    │  • daily_signal_facts   │  │
                                                                          │  │  • Chat         │    │  Investor API   │    │  • asset_ai_reviews     │  │
                                                                          │  │  • Smart Money  │    │                 │    │  • company_chats        │  │
                                                                          │  └─────────────────┘    └─────────────────┘    │  • chat_messages        │  │
                                                                          │                                               │  • institutional_holdings│  │
                                                                          │  ┌─────────────────┐    ┌─────────────────┐    └─────────────────────────┘  │
                                                                          │  │    pg_cron      │───▶│      pgmq       │              ▲                  │
                                                                          │  │   (scheduler)   │    │    (queue)      │              │                  │
                                                                          │  └─────────────────┘    └────────┬────────┘              │                  │
                                                                          │                                  │                       │                  │
                                                                          │                                  ▼                       │                  │
                                                                          │                         ┌─────────────────┐              │                  │
                                                                          │                         │  Python Worker  │──────────────┘                  │
                                                                          │                         │  (GCP/Docker)   │                                 │
                                                                          │                         │                 │                                 │
                                                                          │                         │  • Stage 1: Fetch & Features                      │
                                                                          │                         │  • Stage 3: State Machine                         │
                                                                          │                         │  • Stage 4: Scoring                               │
                                                                          │                         │  • Stage 5: AI Review                             │
                                                                          │                         └─────────────────┘                                 │
                                                                          │                                                                             │
                                                                          └─────────────────────────────────────────────────────────────────────────────┘
                                                                          ```

                                                                          ### 3.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, TypeScript, Vite | Modern SPA framework |
| UI Components | Tailwind CSS, Shadcn/UI | Consistent styling |
| Routing | Wouter | Lightweight client-side routing |
| Data Fetching | SWR | Caching and revalidation |
| Backend API | Supabase Edge Functions (Deno/TypeScript) | Serverless API layer |
| Data Processing | Python 3.11 | Signal engine and analysis |
| AI Models | Google Gemini 3 Flash Preview | LLM-powered analysis |
| Database | PostgreSQL (Supabase) | Data persistence |
| Job Queue | pgmq | Async job processing |
| Scheduler | pg_cron | Automated job scheduling |
| Code Execution | E2B | Sandboxed Python execution |
| Deployment | Vercel (Dashboard), Docker/GCP (Worker) | Hosting infrastructure |
| CI/CD | GitHub Actions | Automated pipelines |

---

## 4. Core Features

### 4.1 Signal Engine (v3.2)

The Signal Engine is the quantitative backbone of Stratos Brain, responsible for detecting tradeable patterns across all tracked assets.

#### Signal Templates

| Template | Description | Use Case |
|---|---|---|
| `momentum_inflection` | Acceleration turning after deceleration | Reversal detection |
| `breakout_participation` | Price breakout with volume confirmation | Trend continuation |
| `trend_ignition` | New trend emerging from consolidation | Early trend entry |
| `squeeze_release` | Volatility squeeze releasing | Breakout trades |
| `rs_breakout` | Relative strength breakout | Sector rotation |
| `volatility_shock` | Unusual price movement detection | Event-driven trades |
| `exhaustion` | Momentum exhaustion at extremes | Mean reversion |
| `trend_breakdown` | Trend failure/breakdown patterns | Risk management |
| `trend_leadership` | Strong uptrend attention signals | Momentum following |

#### Data Pipeline Stages

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE FLOW                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Stage 1: Fetch & Features                                               │
│  ├── Ingest OHLCV from CoinGecko/Alpha Vantage                          │
│  ├── Calculate 50+ technical indicators                                  │
│  └── Store in daily_features table                                       │
│                     │                                                    │
│                     ▼                                                    │
│  Stage 3: State Machine                                                  │
│  ├── Evaluate signal templates against features                          │
│  ├── Track signal lifecycle (new → active → ended)                       │
│  └── Manage signal_instances table                                       │
│                     │                                                    │
│                     ▼                                                    │
│  Stage 4: Scoring                                                        │
│  ├── Aggregate signals into composite scores                             │
│  ├── Calculate weighted_score and inflection_score                       │
│  └── Store in daily_asset_scores table                                   │
│                     │                                                    │
│                     ▼                                                    │
│  Stage 5: AI Review (Two-Pass)                                           │
│  ├── Pass A: Independent analysis from raw OHLCV                         │
│  ├── Pass B: Reconciliation with calculated signals                      │
│  └── Store in asset_ai_reviews table                                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Dashboard Views

| View | Description | Key Features |
|---|---|---|
| Watchlist | Personal asset tracking | Custom notes, alerts |
| Equities | US stock universe | Filtering, multi-sort |
| Crypto | Cryptocurrency universe | Real-time signals |
| ETFs | ETF universe | Setups, R:R ratios, filtering |
| Indices | Global market indices | Setups, R:R ratios, regional grouping |
| Commodities | Commodities overview | Setups, R:R ratios, category grouping |
| Company Chat | Asset-specific AI assistant | Code execution, search |
| Global Brain | Cross-market AI analysis | Market screening |
| Smart Money | Institutional tracking | 13F filings, guru portfolios |
| Core Portfolio | Portfolio management | Holdings tracking |
| Model Portfolio | Paper trading & portfolio construction | Sandbox mode, rebalance calculator, risk metrics, correlation matrix, stress testing, risk attribution, backtester, AI review |
| AI Supply Chain | Interactive AI infrastructure market map | 7-tier visualization, 99 companies (78 public + 21 private), bottleneck analysis, company financials |

### 4.3 AI Chat System

Stratos Brain includes two distinct AI chat agents:

- **Company Chat**
  - **Scope:** Single asset context
  - **Memory:** Persistent conversation history per asset
  - **Tools:** Database queries, Google Search, E2B code execution
  - **Output:** Charts, data visualizations, research insights

- **Global Brain Chat**
  - **Scope:** Cross-market analysis
  - **Tools:** Market screening, macro context, comparative analysis
  - **Output:** Market-wide insights and sector analysis

### 4.5 Daily Brief (v4)

An AI-powered daily market intelligence dashboard providing comprehensive market analysis:

**Market Ticker Bar:**
- Real-time market regime indicator (Bullish/Bearish/Neutral)
- SPY, QQQ, IWM, BTC percentage changes
- VIX and 10Y Treasury yield levels

**Active Portfolio Section:**
- Displays all active portfolio holdings with action recommendations (ADD/TRIM/HOLD)
- AI Direction scores and RSI indicators
- Current setup type and recent news
- Clickable rows navigate to asset detail pages

**Setup Opportunities:**
- **Momentum Breakouts**: Donchian 55 breakouts, RS breakouts, Weinstein Stage 2
- **Trend Continuation**: Golden cross, ADX holy grail, acceleration turns
- **Compression/Reversion**: VCP squeeze, oversold bounce, squeeze release
- Each setup shows conviction level (HIGH/MEDIUM/LOW) and composite scores

**Market Intel:**
- Aggregated news from MarketWatch and Seeking Alpha RSS feeds
- Categorized by type: ECON, TECH, EARNINGS, GEOPOL, POLICY, CRYPTO
- Direct links to source articles

**Macro Insights (AI-Generated):**
- Market Pulse: Current market sentiment and key levels
- Liquidity & Flows: Treasury yields, DXY, fund flows
- Calendar: Economic events and earnings releases

**Technical Implementation:**
- Frontend: `/pages/DailyBriefV4.tsx` - React component with dark theme
- Backend: `/supabase/functions/daily-brief-api-v4/index.ts` - Edge function
- Data Sources: Supabase tables, Gemini AI (with Google Search), RSS feeds
- Generation time: ~5-10 seconds with parallel fetching

---

## 5. Database Schema

### 5.1 Core Tables

| Table | Description |
|---|---|
| `assets` | Master list of all tracked assets (equities including international, and crypto) |
| `daily_bars` | Raw OHLCV data for all assets |
| `daily_features` | Calculated technical indicators for all assets |
| `daily_signal_facts` | Daily record of all active signals for each asset |
| `signal_instances` | Lifecycle tracking for each signal instance |
| `daily_asset_scores` | Composite scores for each asset |
| `asset_ai_reviews` | AI-generated analysis and insights |
| `company_chats` | Conversation history for the Company Chat agent |
| `chat_messages` | Individual messages within each chat |
| `institutional_holdings` | Quarterly 13F holdings data |
| `gurus` | List of tracked institutional investors |
| `document_jobs` | Tracks the status of asynchronous document generation jobs |
| `asset_files` | Stores generated documents (memos, one-pagers) |
| `setup_signals` | Trading setup signals with entry/exit parameters |
| `etf_assets` | Master list of tracked ETFs |
| `market_indices` | Master list of tracked market indices |
| `commodities` | Master list of tracked commodities |
| `etf_daily_bars` | OHLCV data for ETFs |
| `index_daily_bars` | OHLCV data for market indices |
| `commodity_daily_bars` | OHLCV data for commodities |
| `supply_chain_tiers` | AI infrastructure supply chain tier definitions (7 tiers from raw materials to applications) |
| `supply_chain_categories` | Categories within each tier (23 total categories) |
| `asset_supply_chain_mapping` | Maps public companies to supply chain categories with role descriptions |
| `private_companies` | Private companies in the AI supply chain (OpenAI, Anthropic, etc.) |

### 5.2 Database Views

| View | Description |
|---|---|
| `v_etf_overview_with_setups` | ETF overview with setup signals and R:R ratios |
| `v_index_overview_with_setups` | Index overview with setup signals and R:R ratios |
| `v_commodity_overview_with_setups` | Commodity overview with setup signals and R:R ratios |

### 5.3 ERD (Entity Relationship Diagram)

(Diagram to be added)

---

## 6. Data Sources & Integrations

| Source | Type | Data | Frequency |
|---|---|---|---|
| CoinGecko | API | Crypto OHLCV, market data | Daily |
| Alpha Vantage | API | US Equity OHLCV | Daily |
| Financial Modeling Prep (FMP) | API | International equity OHLCV, ETF/Index/Commodity data, fundamentals, institutional holdings | Daily/Quarterly |
| Google Gemini | API | LLM for AI analysis and chat | On-demand |
| E2B | API | Sandboxed code execution | On-demand |

---

## 7. Automated Workflows

### 7.1 Equity Daily OHLCV (GitHub Actions)

- **Schedule:** Mon-Fri at 21:30 UTC (4:30 PM ET, after US market close)
- **Workflow:**
  1. Fetches all active equity assets from the database
  2. Routes US equities (no exchange suffix) to Alpha Vantage API
  3. Routes international equities (symbols with `.L`, `.DE`, `.AX`, etc.) to FMP API
  4. Inserts/updates daily bars in the `daily_bars` table
- **International Markets Supported:**
  - London Stock Exchange (`.L`)
  - Germany/Frankfurt (`.DE`)
  - Australia (`.AX`)
  - Paris (`.PA`)
  - Toronto (`.TO`)
  - Switzerland (`.SW`)

### 7.2 Daily Data Pipeline (pg_cron)

- **Schedule:** Every day at 00:00 UTC
- **Workflow:**
  1. `pg_cron` schedules a job in the `pgmq` queue.
  2. The Python worker picks up the job.
  3. The worker executes the 5-stage data pipeline.

### 7.3 Document Generation (Edge Function)

- **Trigger:** User request from the dashboard.
- **Workflow:**
  1. The `generate-document` Edge Function is called.
  2. A new job is created in the `document_jobs` table.
  3. The function returns a `job_id` to the client.
  4. The client polls the `control-api` for job status.
  5. The Edge Function processes the document generation in the background.
  6. Upon completion, the job status is updated and the file is available in `asset-files`.

---

## 8. API Reference

### 8.1 Supabase Edge Functions

#### `control-api`

- **`GET /dashboard/assets`**: Retrieves the main list of assets with scores and signals.
- **`GET /dashboard/asset?symbol=<symbol>`**: Retrieves detailed data for a single asset.
- **`POST /dashboard/notes`**: Saves user notes for an asset.
- **`POST /dashboard/create-document`**: Initiates a document generation job.
- **`GET /dashboard/job-status/:job_id`**: Polls for the status of an async job.

#### `generate-document`

- **`POST /`**: Creates a new document generation job.
  - **Request Body:** `{ "symbol": string, "asset_id": number, "asset_type": string, "document_type": "one_pager" | "memo" | "deep_research" | "all", "user_id": string }`
  - **Response (202 Accepted):** `{ "success": true, "message": "Document generation started", "job_id": string, "job_type": string }`
  - **Error Handling:** The background job now properly handles errors and updates the job status to `failed` with a descriptive error message.

---

## 9. Frontend Architecture

### 9.1 Component Library

- **`Shadcn/UI`**: Core component library for a consistent look and feel.
- **`Radix UI`**: Primitives for building accessible components.
- **`Tailwind CSS`**: Utility-first CSS framework for styling.

### 9.2 State Management

- **`SWR`**: For data fetching, caching, and revalidation.
- **`Zustand`**: For global client-side state management.

### 9.3 Key Components

- **`AssetTable`**: Main data grid for displaying assets.
- **`AssetDetail`**: Detailed view for a single asset.
- **`ChatWindow`**: Interface for the AI chat agents.
- **`SupplyChainMap`**: Interactive visualization of the AI infrastructure supply chain with 7 tiers, expandable categories, and company detail sheets.

---

## 10. AI Chat System

### 10.1 System Prompt

The system prompt for the AI agents is designed to be concise and direct, providing the agent with its role, objectives, and available tools.

### 10.2 Tool Integration

The AI agents have access to the following tools:
- **`database_query`**: Executes SQL queries against the Supabase database.
- **`google_search`**: Performs web searches for real-time information.
- **`code_interpreter`**: Executes Python code in a sandboxed environment (E2B).

---

## 11. Roadmap & Planned Features

- **Q1 2026:**
  - [ ] Real-time alerts and notifications
  - [ ] Advanced charting and drawing tools
- **Q2 2026:**
  - [ ] Portfolio backtesting and optimization
  - [ ] Integration with broker APIs for live trading

---

## 12. Non-Functional Requirements

- **Performance:** API responses should be < 500ms.
- **Scalability:** The system should handle up to 10,000 concurrent users.
- **Security:** All sensitive data should be encrypted at rest and in transit.

---

## 13. Success Metrics

- **User Engagement:** Daily active users (DAU), session duration.
- **Feature Adoption:** Usage of AI chat, document generation, and smart money features.
- **User Satisfaction:** Net Promoter Score (NPS), user feedback.

---

## 14. Known Limitations

- **Data Latency:** There is a 24-hour delay in the daily data pipeline.
- **Backtesting:** The current backtesting capabilities are limited.
- **[Resolved] Document Generation Failures:** Previously, document generation jobs could get stuck in a "processing" state indefinitely due to improper error handling in the background task. This has been fixed by implementing robust error handling that updates the job status to "failed" with a clear error message.
- **[Resolved] Chat Authentication Errors (401):** Users were experiencing "Authentication required" errors in the Brain Chat and Company Chat even when logged in. This was caused by Vercel rewrites not forwarding custom headers (`x-user-id`, `Authorization`) to the Supabase Edge Functions. Fixed by updating the frontend to use direct Supabase URLs with proper auth headers via the centralized `api-config.ts` module.

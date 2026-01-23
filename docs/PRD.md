# Product Requirements Document (PRD): Stratos Brain

**Document Version:** 1.0  
**Last Updated: January 23, 2026 (v2.6 - Studio Panel & Treemap Diagrams)  
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
                                                                - - **Quantitative Signal Detection**: 9+ technical signal templates for pattern recognition
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
                                                                          |-------|------------|---------|
                                                                          | **Frontend** | React 18, TypeScript, Vite | Modern SPA framework |
                                                                          | **UI Components** | Tailwind CSS, Shadcn/UI | Consistent styling |
                                                                          | **Routing** | Wouter | Lightweight client-side routing |
                                                                          | **Data Fetching** | SWR | Caching and revalidation |
                                                                          | **Backend API** | Supabase Edge Functions (Deno/TypeScript) | Serverless API layer |
                                                                          | **Data Processing** | Python 3.11 | Signal engine and analysis |
                                                                          | **AI Models** | Google Gemini 3 Flash Preview | LLM-powered analysis |
                                                                          | **Database** | PostgreSQL (Supabase) | Data persistence |
                                                                          | **Job Queue** | pgmq | Async job processing |
                                                                          | **Scheduler** | pg_cron | Automated job scheduling |
                                                                          | **Code Execution** | E2B | Sandboxed Python execution |
                                                                          | **Deployment** | Vercel (Dashboard), Docker/GCP (Worker) | Hosting infrastructure |
                                                                          | **CI/CD** | GitHub Actions | Automated pipelines |

                                                                          ---

                                                                          ## 4. Core Features

                                                                          ### 4.1 Signal Engine (v3.2)

                                                                          The Signal Engine is the quantitative backbone of Stratos Brain, responsible for detecting tradeable patterns across all tracked assets.

                                                                          #### Signal Templates

                                                                          | Template | Description | Use Case |
                                                                          |----------|-------------|----------|
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
                                                                          |------|-------------|--------------|
                                                                          | **Watchlist** | Personal asset tracking | Custom notes, alerts |
                                                                          | **Equities** | US stock universe | Filtering, multi-sort |
                                                                          | **Crypto** | Cryptocurrency universe | Real-time signals |
                                                                          | **Company Chat** | Asset-specific AI assistant | Code execution, search |
                                                                          | **Global Brain** | Cross-market AI analysis | Market screening |
                                                                          | **Smart Money** | Institutional tracking | 13F filings, guru portfolios |
                                                                          | **Core Portfolio** | Portfolio management | Holdings tracking |
                                                                          | **Model Portfolio** | Paper trading & portfolio construction | Sandbox mode, rebalance calculator, risk metrics, correlation matrix, stress testing, risk attribution, backtester, AI review |

                                                                          ### 4.3 AI Chat System

                                                                          Stratos Brain includes two distinct AI chat agents:

                                                                          #### Company Chat
                                                                          - **Scope**: Single asset context
                                                                          - - **Memory**: Persistent conversation history per asset
                                                                            - - **Tools**: Database queries, Google Search, E2B code execution
                                                                              - - **Output**: Charts, data visualizations, research insights
                                                                               
                                                                                - #### Global Brain Chat
                                                                                - - **Scope**: Cross-market analysis
                                                                                  - - **Tools**: Market screening, macro context, comparative analysis
                                                                                    - - **Output**: Market-wide insights and sector analysis
                                                                                     
- ### 4.4 Document & Output Generation
                                                                                      
                                                                                       - Automated generation of investment documents and visual outputs:
                                                                                       - - **Investment Memos**: Comprehensive analysis documents
                                                                                         - - **One-Pagers**: Executive summaries
                                                                                           - - **Presentation Slides**: AI-generated slide decks
                                                                                           - - **Interactive Diagrams**: Visual flowcharts and treemaps via Studio Panel
                                                                                           - - **Data Tables**: Formatted data tables for comparison
                                                                                           - - **Async Processing**: Job system for long-running generation

### 4.5 Studio Panel & Diagram Canvas

The Studio Panel provides an interactive workspace for creating and viewing visual outputs:

#### Diagram Types
- **Treemap Layout**: Proportional visualization for revenue breakdowns, market segments, portfolio allocations
  - Nodes sized by percentage values
  - Parent-child hierarchy support
  - Color-coded segments with labels
- **Flowchart Layout**: Process flows, decision trees, organizational structures
  - Horizontal and vertical orientations
  - Connection lines between nodes
  - Multiple node types (default, decision, process)

#### Canvas Features
- **Pan & Zoom**: Interactive navigation with mouse/touch controls
- **Export**: PNG export for sharing and embedding
- **Fullscreen Mode**: Expanded view for detailed analysis
- **Reset View**: Return to default zoom and position

#### Technical Implementation
- React-based DiagramCanvas component with SVG rendering
- Treemap algorithm for proportional box sizing
- Responsive layout adapting to container size
- Integration with studio-api Edge Function for AI-generated diagrams
                                                                                            
                                                                                             - ---

                                                                                            ## 5. Database Schema

                                                                                            ### 5.1 Core Tables

                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
| `assets` | Master asset list | `asset_id`, `asset_type`, `symbol`, `currency`, `fmp_symbol`, `data_vendor`, `is_active` |
| `daily_bars` | Raw OHLCV data with USD conversion | `asset_id`, `bar_date`, `open`, `high`, `low`, `close`, `volume`, `close_usd`, `volume_usd` |
| `fx_rates` | Daily forex rates for currency conversion | `rate_date`, `from_currency`, `to_currency`, `rate`, `source` |
                                                                                            | `daily_features` | Technical indicators | `asset_id`, `as_of_date`, `rsi_14`, `macd`, `sma_20`, etc. |
                                                                                            | `daily_signal_facts` | Signal evaluations | `asset_id`, `template_name`, `signal_strength`, `direction` |
                                                                                            | `signal_instances` | Signal lifecycle | `signal_id`, `first_seen`, `last_seen`, `status` |
                                                                                            | `daily_asset_scores` | Composite scores | `asset_id`, `weighted_score`, `inflection_score` |
                                                                                            | `asset_ai_reviews` | AI analysis output | `asset_id`, `thesis`, `confidence`, `direction`, `scope` |

                                                                                            ### 5.2 Chat, Source & Document Tables

                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `company_chats` | Chat sessions | `chat_id`, `asset_id`, `user_id`, `display_name` |
                                                                                            | `chat_messages` | Conversation history | `message_id`, `chat_id`, `role`, `content`, `tool_calls` |
                                                                                            | `company_documents` | SEC filings, transcripts | `document_id`, `asset_id`, `document_type`, `content` |
                                                                                            | `document_chunks` | RAG embeddings | `chunk_id`, `document_id`, `embedding`, `content` |
| `chat_sources` | User-provided sources | `source_id`, `chat_id`, `user_id`, `source_type`, `name`, `status`, `is_enabled` |

                                                                                            ### 5.3 Institutional Data Tables

                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `institutional_holdings` | 13F filings | `holder_name`, `asset_id`, `shares`, `value` |
                                                                                            | `guru_portfolios` | Super-investor info | `guru_id`, `name`, `cik`, `fund_name` |
                                                                                            | `guru_holdings` | Guru positions | `guru_id`, `asset_id`, `shares`, `portfolio_weight` |

                                                                                            ### 5.4 Key Database Views

                                                                                            | View | Purpose |
                                                                                            |------|---------|
                                                                                            | `v_dashboard_base` | Base join of scores, features, AI reviews |
                                                                                            | `v_dashboard_all_assets` | Complete dashboard data with fundamentals |
                                                                                            | `v_dashboard_inflections` | Filtered view for inflection signals |
                                                                                            | `v_active_signals` | Currently active signals |
                                                                                            | `v_leaders` | Top performing assets |
                                                                                            | `v_risks` | Assets showing risk signals |
                                                                                            | `v_dashboard_risk` | Assets with risk indicators |
                                                                                            | `v_dashboard_trends` | Trending assets |
                                                                                            | `v_screener_leaders` | Top momentum leaders |
                                                                                            | `v_screener_movers` | Biggest price movers |
                                                                                            | `v_screener_risks` | High risk assets |
                                                                                            | `v_guru_consensus` | Guru agreement on holdings |
                                                                                            | `v_guru_latest_holdings` | Most recent guru positions |
                                                                                            | `v_fundamental_leaders` | Top fundamental scores |
                                                                                            | `v_growth_leaders` | Top growth stocks |
                                                                                            | `v_value_leaders` | Top value stocks |
                                                                                            | `v_equity_fundamentals` | Complete equity fundamental data |
                                                                                         
                                                                                            ### 5.5 Fundamental Data Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
| `equity_metadata` | Company information + ratios | `asset_id`, `symbol`, `sector`, `industry`, `current_ratio`, `debt_to_equity`, `roic`, `roce`, `fcf_yield`, `graham_number`, etc. |
| `equity_annual_fundamentals` | Annual financial data + growth | `asset_id`, `fiscal_year`, `revenue`, `net_income`, `revenue_growth`, `eps_growth`, `three_year_revenue_cagr`, etc. |
| `equity_quarterly_fundamentals` | Quarterly financial data + growth | `asset_id`, `fiscal_quarter`, `revenue`, `eps`, `revenue_growth`, `net_income_growth`, `fcf_growth`, etc. |
| `equity_ratios_quarterly` | Historical ratio trends | `asset_id`, `fiscal_date`, `current_ratio`, `debt_to_equity`, `roic`, `roce`, `gross_profit_margin`, etc. |
| `equity_earnings_history` | Earnings beats/misses | `asset_id`, `fiscal_date`, `eps_estimated`, `eps_actual`, `eps_surprise_pct`, `revenue_surprise_pct` |
| `equity_dividend_history` | Dividend payments | `asset_id`, `ex_dividend_date`, `dividend_amount`, `dividend_type`, `payment_date` |
| `equity_stock_splits` | Stock split events | `asset_id`, `split_date`, `split_numerator`, `split_denominator` |
                                                                                            | `fundamental_scores` | Calculated fundamental scores | `asset_id`, `value_score`, `growth_score`, `quality_score` |
                                                                                            | `fundamental_snapshot` | Monthly pre-calculated fundamentals | `asset_id`, `snapshot_date`, `pe_ratio`, `pb_ratio` |
                                                                                            | `fundamental_score_history` | Historical score tracking | `asset_id`, `score_date`, `composite_score` |
                                                                                            | `daily_macro_metrics` | Macro-economic indicators | `date`, `vix`, `dxy`, `treasury_yields` |
| `fundamental_vigor_scores` | AI-powered FVS scores | `asset_id`, `as_of_date`, `final_score`, `profitability_score`, `solvency_score`, `growth_score`, `moat_score` |
| `fvs_calculation_inputs` | FVS calculation audit trail | `asset_id`, `as_of_date`, `quantitative_metrics` |
                                                                                         
                                                                                            ### 5.6 ETF, Index & Commodity Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `etf_assets` | ETF master list | `etf_id`, `symbol`, `name`, `asset_class`, `geography`, `category`, `issuer` |
| `etf_daily_bars` | ETF OHLCV data | `etf_id`, `date`, `open`, `high`, `low`, `close`, `volume` |
| `market_indices` | Global indices | `index_id`, `symbol`, `name`, `region`, `country`, `index_type` |
| `index_daily_bars` | Index OHLCV data | `index_id`, `date`, `open`, `high`, `low`, `close`, `volume` |
| `commodities` | Commodity futures | `commodity_id`, `symbol`, `name`, `category`, `unit` |
| `commodity_daily_bars` | Commodity OHLCV data | `commodity_id`, `date`, `open`, `high`, `low`, `close`, `volume` |

### 5.7 Signal & Engine Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `signal_ai_annotations` | AI annotations on signals | `signal_id`, `annotation`, `confidence` |
                                                                                            | `signal_state_history` | Signal state transitions | `signal_id`, `state`, `transitioned_at` |
                                                                                            | `signal_validation_stats` | Signal performance metrics | `template_name`, `accuracy`, `precision` |
                                                                                            | `engine_configs` | Engine configuration | `config_name`, `parameters`, `is_active` |
                                                                                            | `engine_jobs` | Engine job queue | `job_id`, `job_type`, `status`, `created_at` |
                                                                                            | `daily_signals_v2` | V2 signal data | `asset_id`, `signal_date`, `signals_json` |
                                                                                         
                                                                                            ### 5.8 Brain & Chat System Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `brain_chats` | Global Brain chat sessions | `chat_id`, `user_id`, `title`, `created_at` |
                                                                                            | `brain_jobs` | Brain async job queue | `job_id`, `chat_id`, `status` |
                                                                                            | `brain_messages` | Brain conversation history | `message_id`, `chat_id`, `role`, `content` |
                                                                                            | `chat_config` | Chat system configuration | `config_key`, `config_value` |
                                                                                            | `chat_jobs` | Chat async jobs | `job_id`, `chat_id`, `job_type`, `status` |
                                                                                            | `chat_tool_executions` | Tool execution logs | `execution_id`, `message_id`, `tool_name`, `result` |
                                                                                            | `content_knowledge_base` | Knowledge base content | `content_id`, `title`, `content`, `embedding` |
                                                                                         
                                                                                            ### 5.8 Portfolio Management Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `core_portfolio_holdings` | Core portfolio positions | `holding_id`, `asset_id`, `shares`, `cost_basis` |
                                                                                            | `core_portfolio_items` | Portfolio configuration | `item_id`, `portfolio_name` |
                                                                                            | `model_portfolio_holdings` | Model portfolio positions | `holding_id`, `asset_id`, `target_weight` |
                                                                                            | `model_portfolio_items` | Model portfolio config | `item_id`, `portfolio_name` |
                                                                                            | `watchlist` | User watchlists | `user_id`, `asset_id`, `added_at` |
                                                                                         
                                                                                            ### 5.9 User & Activity Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `user_profiles` | User profile data | `user_id`, `email`, `display_name` |
                                                                                            | `user_preferences` | User settings | `user_id`, `preference_key`, `preference_value` |
                                                                                            | `user_table_settings` | User-specific table column/sort/filter settings | `id`, `user_id`, `table_key`, `visible_columns`, `column_order`, `column_widths`, `sort_by`, `sort_order`, `secondary_sort_by`, `secondary_sort_order`, `filters` |
                                                                                            | `user_activity` | Activity tracking | `activity_id`, `user_id`, `action`, `timestamp` |
                                                                                            | `feedback_items` | User feedback | `feedback_id`, `user_id`, `feedback_type`, `content` |
                                                                                         
                                                                                            ### 5.10 Utility & System Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `pipeline_runs` | Pipeline execution audit | `run_id`, `pipeline_name`, `status`, `started_at` |
                                                                                            | `latest_dates` | Data freshness tracking | `data_type`, `latest_date` |
                                                                                            | `metrics` | System metrics | `metric_name`, `metric_value`, `recorded_at` |
                                                                                            | `sources` | Data source references | `source_id`, `source_name` |
                                                                                            | `document_jobs` | Document processing jobs | `job_id`, `document_id`, `status` |
                                                                                            | `document_templates` | Document templates | `template_id`, `template_name`, `content` |
                                                                                            | `document_ingestion_log` | Document ingestion audit | `log_id`, `document_id`, `ingested_at` |
                                                                                         
                                                                                            ### 5.11 Asset Annotation Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `asset_files` | Asset-related files | `file_id`, `asset_id`, `file_type`, `url` |
                                                                                            | `asset_notes` | User notes on assets | `note_id`, `asset_id`, `user_id`, `content` |
                                                                                            | `asset_tags` | Asset tagging (interesting, maybe, no) - supports sorting | `tag_id`, `asset_id`, `tag_name` |
                                                                                            | `asset_reviewed` | Review tracking | `asset_id`, `reviewed_at` |
                                                                                            | `stock_lists` | Custom subsector/thematic lists | `id`, `name`, `description`, `icon`, `color`, `display_order`, `etf_id` |
                                                                                            | `stock_list_items` | Stock list membership | `id`, `list_id`, `asset_id`, `added_at` |
                                                                                            | `etfs` | ETF tracking for subsectors | `etf_id`, `symbol`, `name`, `description`, `subsector` |
                                                                                            | `etf_holdings` | ETF constituent holdings | `id`, `etf_id`, `asset_id`, `weight_pct`, `as_of_date` |
                                                                                         
### 5.12 Research Notes Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `research_notes` | Context-aware user notes (per-user, per-context) | `id`, `user_id`, `title`, `content`, `is_favorite`, `context_type`, `context_id`, `created_at`, `updated_at` |
| `research_note_assets` | Junction table linking notes to assets | `id`, `note_id`, `asset_id`, `added_at` |

**Context Types:**
- `general` - General notes not tied to a specific context
- `asset` - Notes for a specific asset (context_id = asset_id)
- `stock_list` - Notes for a custom stock list (context_id = list_id)

### 5.14 User-Specific vs Shared Data

**User-Specific Data (requires authentication):**
| Data Type | Table | Description |
|-----------|-------|-------------|
| Asset Notes | `asset_notes` | Quick notes on individual assets (user_id column) |
| Research Notes | `research_notes` | Context-aware research notes |
| Company Chats | `company_chats` | AI chat sessions for specific companies |
| Brain Chats | `brain_chats` | Global AI assistant chat sessions |
| Table Settings | `user_table_settings` | Column visibility, order, widths, sorting, and filters |

**Shared Data (accessible to all authenticated users):**
| Data Type | Table | Description |
|-----------|-------|-------------|
| Watchlist | `watchlist` | Shared watchlist of assets |
| Model Portfolio | `model_portfolio_holdings` | Paper trading portfolio |
| Core Portfolio | `core_portfolio_holdings` | Real holdings tracking |
| Stock Lists | `stock_lists`, `stock_list_items` | Custom thematic/subsector lists |
| Asset Tags | `asset_tags` | Asset categorization (interesting, maybe, no) |

                                                                                            ### 5.13 Token & Crypto Tables
                                                                                         
                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `tokens` | Cryptocurrency tokens | `token_id`, `symbol`, `name`, `coingecko_id` |
                                                                                            | `token_metadata` | Token metadata | `token_id`, `market_cap`, `total_supply` |
                                                                                            | `tracked_investors` | Super-investor profiles | `investor_id`, `name`, `cik`, `fund_name` |
                                                                                            | `investor_holdings` | Historical investor snapshots | `holding_id`, `investor_id`, `asset_id`, `shares` |
                                                                                            | `guru_performance_history` | Guru performance tracking | `guru_id`, `period`, `return_pct` |
                                                                                            

                                                                                            ---

                                                                                            ## 6. Data Sources & Integrations

                                                                                            ### 6.1 Market Data

                                                                                            | Source | Data Type | Frequency | Assets |
                                                                                            |--------|-----------|-----------|--------|
| **CoinGecko** | OHLCV, Market Cap | Daily | Crypto |
| **Alpha Vantage** | OHLCV | Daily | US Equities |
| **Financial Modeling Prep** | OHLCV, Fundamentals, 13F, Transcripts, FX Rates | Daily/Quarterly | Global Equities, US Equities |

                                                                                            ### 6.2 AI & Search

                                                                                            | Service | Purpose | Integration |
                                                                                            |---------|---------|-------------|
                                                                                            | **Google Gemini API** | LLM analysis, chat | Edge Functions |
                                                                                            | **Google Custom Search** | Real-time news | Chat grounding |
                                                                                            | **E2B** | Code execution sandbox | Chat agents |
| **MCP Protocol** | Standardized tool connectivity | mcp-server Edge Function |

                                                                                            ### 6.3 Infrastructure

                                                                                            | Service | Purpose |
                                                                                            |---------|---------|
                                                                                            | **Supabase** | Database, Auth, Edge Functions |
                                                                                            | **Vercel** | Dashboard hosting |
                                                                                            | **GCP Cloud Run** | Python worker |
                                                                                            | **GitHub Actions** | CI/CD pipelines |

                                                                                            ---

                                                                                            ## 7. Automated Workflows

                                                                                            ### 7.1 GitHub Actions Pipelines

                                                                                            #### Crypto Pipeline
                                                                                            ```yaml
                                                                                            Schedule: Daily after market close
                                                                                            1. crypto-daily-ohlcv.yml      # Fetch OHLCV from CoinGecko
                                                                                            2. crypto-daily-features.yml   # Calculate technical indicators
                                                                                            3. crypto-daily-ai-signals.yml # Run AI analysis
                                                                                            ```

                                                                                            #### Equity Pipeline
                                                                                            ```yaml
                                                                                            Schedule: Daily after market close
                                                                                            1. equity-daily-ohlcv.yml      # Fetch OHLCV from Alpha Vantage
                                                                                            2. equity-daily-features.yml   # Calculate technical indicators
                                                                                            3. equity-daily-ai-signals.yml # Run AI analysis
                                                                                            ```

                                                                                            #### Fundamentals Pipeline
                                                                                            ```yaml
                                                                                            Schedule: Daily/Monthly
                                                                                            1. fundamental-daily-update.yml    # Update fundamental scores
                                                                                            2. fundamental-monthly-refresh.yml # Full data refresh
                                                                                            ```

                                                                                            ### 7.2 Pipeline Dependencies

                                                                                            ```
                                                                                            crypto-daily-ohlcv ─────┐
                                                                                                                    ├──▶ crypto-daily-features ──▶ crypto-daily-ai-signals
                                                                                                                    │
                                                                                            equity-daily-ohlcv ─────┘
                                                                                                                    ├──▶ equity-daily-features ──▶ equity-daily-ai-signals
                                                                                            ```

                                                                                            ---

                                                                                            ## 8. API Reference

                                                                                            ### 8.1 Edge Functions

                                                                                            | Function | Purpose | Key Endpoints |
                                                                                            |----------|---------|---------------|
                                                                                            | `control-api` | Main dashboard API | `/dashboard/*`, `/assets/*`, `/watchlist/*` |
                                                                                            | `sources-api` | NotebookLM-style sources | `/sources`, `/sources/:id` |
| `company-chat-api` | Asset chat | `/chats`, `/chats/:id/messages` |
                                                                                            | `global-chat-api` | Market chat | `/chat`, `/screen` |
                                                                                            | `generate-document` | Document generation | `/generate` |
                                                                                            | `feedback-api` | User feedback | `/feedback` |
                                                                                            | `investor-api` | Institutional data | `/investors`, `/holdings` |
                                                                                            | `fundamental-score-api` | On-demand scoring | `/score/:symbol` |
| `mcp-server` | Model Context Protocol server | `/` (JSON-RPC) |

                                                                                            ### 8.2 Key API Endpoints

                                                                                            #### Dashboard Data
                                                                                            ```
                                                                                            GET  /api/dashboard/all-assets     # All assets with scores
                                                                                            GET  /api/dashboard/asset/:id      # Single asset detail (now includes enterprise_value for equities)
                                                                                            GET  /api/dashboard/inflections    # Inflection signals
                                                                                            GET  /api/dashboard/health         # Pipeline status
                                                                                            ```

                                                                                            #### Chat
                                                                                            ```
                                                                                            POST /api/company-chat/chats       # Create/get chat
                                                                                            GET  /api/company-chat/chats       # List all chats
                                                                                            POST /api/company-chat/chats/:id/messages  # Send message
                                                                                            GET  /api/company-chat/chats/:id/messages  # Get history
                                                                                            ```

#### Watchlist
                                                                            ```
                                                                            GET  /api/watchlist                # Get watchlist
                                                                            POST /api/watchlist/add            # Add asset
                                                                            POST /api/watchlist/remove         # Remove asset
                                                                            ```

                                                                            #### Portfolio Construction
                                                                            ```
GET  /api/dashboard/portfolio-risk  # Portfolio risk metrics, betas, volatilities & correlation matrix
GET  /api/dashboard/portfolio-backtest  # Historical portfolio performance backtest vs SPY/BTC
POST /api/dashboard/ai-analysis  # AI-powered portfolio analysis (Gemini)
GET  /api/dashboard/model-portfolio-holdings  # Model portfolio holdings
POST /api/dashboard/model-portfolio-holdings  # Add holding
PATCH /api/dashboard/model-portfolio-holdings/:id  # Update holding
DELETE /api/dashboard/model-portfolio-holdings/:id  # Remove holding
                                                                            ```

#### Research Notes (Context-Aware)
```
GET    /api/dashboard/research-notes              # List all notes for user (query: user_id, context_type?, context_id?)
GET    /api/dashboard/research-notes/context      # Get or create note for context (query: user_id, context_type, context_id?)
GET    /api/dashboard/research-notes/:id          # Get single note with linked assets
POST   /api/dashboard/research-notes              # Create new note (body: user_id, title, context_type?, context_id?)
PUT    /api/dashboard/research-notes/:id          # Update note title/content
DELETE /api/dashboard/research-notes/:id          # Delete note
POST   /api/dashboard/research-notes/:id/assets   # Link asset to note
DELETE /api/dashboard/research-notes/:id/assets/:asset_id  # Unlink asset
PATCH  /api/dashboard/research-notes/:id/favorite # Toggle favorite status
```

                                                                                            ---

                                                                                            ## 9. Frontend Architecture

                                                                                            ### 9.1 Directory Structure

                                                                                            ```
                                                                                            dashboard/client/src/
                                                                                            ├── components/           # Reusable UI components
                                                                                            │   ├── DashboardLayout.tsx
                                                                                            │   ├── CustomizableAssetTable.tsx
                                                                                            │   ├── AssetDetail.tsx
                                                                                            │   ├── CompanyChatInterface.tsx
                                                                                            │   └── ...
                                                                                            ├── contexts/            # React contexts
                                                                                            │   ├── AuthContext.tsx
                                                                                            │   ├── ThemeContext.tsx
                                                                                            │   └── NoteContext.tsx
                                                                                            ├── hooks/               # Custom data hooks
│   ├── useAllAssets.ts
│   ├── useDashboardData.ts
│   ├── useCompanyChats.ts
│   ├── useResearchNotes.ts
│   | `useUnifiedSearch.ts` |
| `useSources.ts` | Manages user-provided sources (files, URLs, text) for a chat
                                                                                            ├── pages/               # Route pages
                                                                                            │   ├── Home.tsx
                                                                                            │   ├── CompanyChat.tsx
                                                                                            │   ├── SmartMoney.tsx
                                                                                            │   └── ResearchNotes.tsx
                                                                                            └── lib/                 # Utilities
                                                                                                ├── supabase.ts
                                                                                                └── portfolioMath.ts  # Risk calculations, correlation, volatility
                                                                                            ```

                                                                                            ### 9.2 Key Components

| Component | Purpose |
|-----------|---------|
| `DashboardLayout` | Main app shell with navigation |
| `CustomizableAssetTable` | Flexible data table with sorting/filtering, including tag-based sorting (Interesting first) |
| `AssetDetail` | Modal with charts, AI analysis, trade plan, and EV+MC display for equities |
| `chat/BaseChatInterface` | **Shared base component for all chat interfaces** (v2.1) - Provides unified message rendering, tool call visualization, streaming support, and error recovery |
| `SourcesPanel` | UI for managing user-provided sources (files, URLs, text) |
| `CompanyChatInterfaceNew` | Company-specific chat using BaseChatInterface with side panel for fundamentals/technicals and NotebookLM-style sources |
| `BrainChatInterfaceNew` | Global Brain chat using BaseChatInterface with purple theme and market-wide tools |
| `CompanySidePanel` | Mobile-optimized side panel with sticky tabs, touch-friendly controls, and drawer support |
| `SmartMoneyTracker` | Institutional holdings visualization |
| `PortfolioSandbox` | Interactive portfolio construction with weight sliders |
| `RebalanceCalculator` | Trade sheet generation and CSV export |
| `CorrelationMatrix` | Asset correlation heatmap visualization |
| `ScenarioSimulator` | Stress testing with preset scenarios (Mild Correction, Market Crash, Black Swan, Bull Run) |
| `RiskAttribution` | Dual donut charts showing Capital vs Risk allocation with concentration warnings |
| `TimeTravelBacktester` | Historical performance simulation with SPY/BTC comparison |
| `AIInvestmentCommittee` | LLM-powered portfolio critique with actionable recommendations |
| `ResearchNotes` | Notes library page for browsing all user notes across contexts |
| `FloatingNotepad` | Context-aware floating notepad popup accessible from any page |
| `UnifiedCommandBar` | Global search (⌘K) with multi-category results: assets, industries, sectors, lists, and recent items |

                                                                                            ### 9.3 Data Flow

                                                                                            ```
                                                                                            URL Change
                                                                                                │
                                                                                                ▼
                                                                                            Home.tsx (determines active view)
                                                                                                │
                                                                                                ▼
                                                                                            CustomizableAssetTable (renders data)
                                                                                                │
                                                                                                ▼
                                                                                            useAllAssets hook (fetches via SWR)
                                                                                                │
                                                                                                ▼
                                                                                            /api/dashboard/* (Edge Function)
                                                                                                │
                                                                                                ▼
                                                                                            Supabase Database Views
                                                                                            ```

### 9.4 Authentication System

Stratos Brain uses Supabase Auth with Google OAuth for authentication. The system is designed to handle stale auth tokens gracefully and provide a seamless user experience.

#### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User clicks "Sign In"                                                   │
│         │                                                                   │
│         ▼                                                                   │
│  2. Google OAuth (restricted to @stratos.xyz domain)                        │
│         │                                                                   │
│         ▼                                                                   │
│  3. Supabase creates session with JWT access token                          │
│         │                                                                   │
│         ▼                                                                   │
│  4. AuthContext caches user ID and access token                             │
│         │                                                                   │
│         ▼                                                                   │
│  5. API requests include JWT in Authorization header                        │
│         │                                                                   │
│         ▼                                                                   │
│  6. Backend validates JWT and extracts user_id                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Files

| File | Purpose |
|------|--------|
| `contexts/AuthContext.tsx` | React context providing auth state and methods |
| `lib/api-config.ts` | API configuration with auth headers and stale auth recovery |
| `lib/supabase.ts` | Supabase client initialization |
| `components/StaleAuthHandler.tsx` | UI feedback for stale auth events |
| `pages/AuthCallback.tsx` | OAuth callback handler |

#### Authentication Methods

The backend (`control-api`) supports three authentication methods:

1. **JWT (Supabase Auth)**: `Authorization: Bearer <user_jwt>`
   - Used by authenticated browser clients
   - Provides user_id for user-specific data filtering

2. **API Key (scripts/n8n)**: `x-stratos-key: <STRATOS_BRAIN_API_KEY>`
   - Used by automated scripts and n8n workflows
   - Full access to all endpoints

3. **Supabase Anon Key**: `apikey: <SUPABASE_ANON_KEY>`
   - Used by unauthenticated browser clients
   - Access to public endpoints only

#### Stale Auth Detection & Recovery

The system automatically detects and recovers from stale authentication tokens:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STALE AUTH RECOVERY FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. API request returns 401/403 error                                       │
│         │                                                                   │
│         ▼                                                                   │
│  2. Increment auth error counter                                            │
│         │                                                                   │
│         ▼                                                                   │
│  3. If 3+ errors within 10 seconds:                                         │
│         │                                                                   │
│         ├──▶ Try to refresh Supabase session token                          │
│         │         │                                                         │
│         │         ├──▶ Success: Retry original request                      │
│         │         │                                                         │
│         │         └──▶ Failure: Clear stale auth data                       │
│         │                   │                                               │
│         │                   ▼                                               │
│         │             Clear localStorage (sb-* keys)                        │
│         │                   │                                               │
│         │                   ▼                                               │
│         │             Sign out user                                         │
│         │                   │                                               │
│         │                   ▼                                               │
│         │             Show "Session Expired" toast                          │
│         │                   │                                               │
│         │                   ▼                                               │
│         │             Reload page                                           │
│         │                                                                   │
│         └──▶ If < 3 errors: Return empty data (graceful degradation)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Implementation Details

**api-config.ts** handles:
- Auth token caching (`cachedUserId`, `cachedAccessToken`)
- Auth error tracking (`authErrorCount`, `lastAuthErrorTime`)
- Automatic token refresh (`forceRefreshToken()`)
- Stale auth clearing (`clearStaleAuth()`)
- Request retry after token refresh

**StaleAuthHandler.tsx** provides:
- Listens for `stale-auth-cleared` custom event
- Shows toast notification when session expires
- Provides `useClearStaleAuth()` hook for manual recovery

#### Best Practices for Auth-Related Changes

1. **Always use the cached auth helpers**:
   ```typescript
   import { getApiHeaders, getCachedUserId, hasAuthToken } from '@/lib/api-config';
   ```

2. **Handle auth errors gracefully**:
   - Return empty arrays instead of throwing for 401/403 errors
   - Let the stale auth recovery system handle token refresh

3. **User-specific data filtering**:
   - Always filter by `user_id` on the backend for user-specific tables
   - Use `getUserIdFromRequest()` helper in edge functions

4. **SWR cache management**:
   - Use `clearUserSpecificCache()` when auth state changes
   - Don't clear public data cache on auth changes

5. **Testing auth changes**:
   - Test with fresh browser session
   - Test with expired tokens (wait for token expiry)
   - Test sign-in/sign-out transitions

                                                                                            ---

                                                                                            ## 10. AI Chat System

                                                                                            ### 10.1 Architecture

                                                                                            ```
                                                                                            ┌─────────────────────────────────────────────────────────────────────────┐
                                                                                            │                        AI CHAT ARCHITECTURE                             │
                                                                                            ├─────────────────────────────────────────────────────────────────────────┤
                                                                                            │                                                                         │
                                                                                            │  Frontend                       Edge Function                           │
                                                                                            │  ┌───────────────┐             ┌───────────────────────────────────┐   │
                                                                                            │  │ Chat UI       │────────────▶│ company-chat-api                  │   │
                                                                                            │  │               │             │                                   │   │
                                                                                            │  │ • Message     │             │ ┌─────────────────────────────┐   │   │
                                                                                            │  │   input       │             │ │ Gemini 3 Pro                │   │   │
                                                                                            │  │ • Code blocks │◀────────────│ │                             │   │   │
                                                                                            │  │ • Citations   │             │ │ Tools:                      │   │   │
                                                                                            │  │ • Charts      │             │ │ • Google Search             │   │   │
                                                                                            │  └───────────────┘             │ │ • Code Execution (E2B)      │   │   │
                                                                                            │                                │ │ • Database Functions        │   │   │
                                                                                            │                                │ └─────────────────────────────┘   │   │
                                                                                            │                                └───────────────────────────────────┘   │
                                                                                            │                                                                         │
                                                                                            └─────────────────────────────────────────────────────────────────────────┘
                                                                                            ```

                                                                                            ### 10.2 Available Tools

                                                                                            | Tool | Description | Source |
                                                                                            |------|-------------|--------|
                                                                                            | `google_search` | Real-time web search | Gemini Native |
                                                                                            | `code_execution` | Python sandbox | E2B |
                                                                                            | `get_fundamentals` | Financial data | Database |
                                                                                            | `get_signals` | Active signals | Database |
                                                                                            | `get_price_history` | OHLCV data | Database |
                                                                                            | `get_ai_reviews` | Previous AI analyses | Database |
                                                                                            | `get_macro_context` | Market indicators | Database |
                                                                                            | `get_institutional_flows` | 13F data | Database |
                                                                                            | `search_documents` | RAG search | Database |

                                                                                            ### 10.3 System Prompt Structure

The system prompt uses a configurable structure with two modes:

**Full Mode** (default): Comprehensive prompt with all protocols, tool documentation, and pre-loaded documents (~4000 tokens)

**Compact Mode** (streaming): Minimal prompt for faster responses (~500 tokens)

```

You are Stratos, an elite autonomous financial analyst for {company_name} ({symbol}).

## Interactive UI
- For DCF, scenario analysis, or any model where the user should be able to adjust inputs, use the `InteractiveModel` component with `generate_dynamic_ui`.
- This creates sliders for user interaction.
## Context
- Symbol: {symbol} | Asset ID: {asset_id} | Type: {asset_type}
- Sector: {sector} | Industry: {industry}
- Today: {current_date}

## Critical Rules
1. Data First: Query database/docs before making claims.
2. Math via Python: Use execute_python for ALL calculations.
3. Cite Sources: Quote specific documents (e.g., "10-K 2024, Risk Factors").

## Tools Available
- Fundamentals: get_asset_fundamentals, get_price_history, get_technical_indicators
- Analysis: get_ai_reviews, get_active_signals, get_sector_comparison
- Documents: get_company_docs, search_company_docs, get_deep_research_report
- Market: get_macro_context, get_institutional_flows, get_market_pulse
- Utility: execute_python, perform_grounded_research, generate_dynamic_ui (for charts, tables, and interactive models)
```

### 10.4 Performance Optimizations (v2025.01.22)

The chat system includes several performance optimizations for faster response times:

| Optimization | Impact | Time Saved |
|--------------|--------|------------|
| **Model Toggle (Flash/Pro)** | User-selectable model (Flash default) | 2-3x faster responses |
| **Context Bloat Fix** | Only load One Pager by default (not Deep Research) | 3-5 seconds |
| **Parallel Setup Phase** | Config, last message, and docs fetched via Promise.all() | 1-2 seconds |
| **Global Tool Caching** | 5-minute cache for read-only data tools (fundamentals, technicals, etc.) | Instant on repeat |
| **Parallel Tool Execution** | All function calls execute simultaneously via Promise.all() | 40-60% reduction |
| **Chat Config Caching** | In-memory cache with 5-minute TTL | 50-100ms per request |
| **Persistent Python Sessions** | Stateful E2B sandboxes per chat session (10-min TTL) | Variables persist across turns |
| **Document Caching** | Hash-based invalidation with 10-minute TTL | 500ms-2s per request |
| **Real-time Broadcast Streaming** | Supabase Realtime for event-based streaming | First update in <1s |
| **Compact System Prompt** | 70% reduction in token count for simple queries | Faster processing |

#### Cacheable Tools (5-minute TTL)

The following tools are cached to provide instant responses on repeated queries:
- `get_asset_fundamentals` - Financial metrics and ratios
- `get_price_history` - Historical OHLCV data
- `get_technical_indicators` - RSI, MACD, moving averages
- `get_active_signals` - Trading signals
- `get_macro_context` - Market regime and rates
- `get_institutional_flows` - 13F data
- `get_market_pulse` - Market overview
- `get_sector_comparison` - Peer comparison
- `get_ai_reviews` - Previous AI analysis
- `get_financial_calendar` - Earnings dates

### 10.5 Multi-Agent Orchestrator ("Skeptic" Agent Loop)

The chat-worker now supports a multi-agent orchestration system that improves analysis quality through a "Virtual Investment Committee" pattern. This feature is enabled by default and can be disabled via the `ENABLE_SKEPTIC_AGENT` environment variable.

#### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE SKEPTIC AGENT LOOP                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Request                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   SCOUT     │───▶│    QUANT    │───▶│   SKEPTIC   │                     │
│  │  (Flash)    │    │   (Pro)     │    │   (Flash)   │                     │
│  │             │    │             │    │             │                     │
│  │ • Research  │    │ • Calculate │    │ • Validate  │                     │
│  │ • Gather    │    │ • Analyze   │    │ • Audit     │                     │
│  │ • Search    │    │ • Model     │    │ • Challenge │                     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                     │
│                                               │                             │
│                                        ┌──────┴──────┐                      │
│                                        │   PASS?     │                      │
│                                        └──────┬──────┘                      │
│                                    YES │      │ NO                          │
│                                        ▼      ▼                             │
│                               ┌────────────┐  │                             │
│                               │   FINAL    │  │ Loop back with              │
│                               │  RESPONSE  │  │ correction instructions     │
│                               └────────────┘  └─────────────────────────────│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Agent Specifications

| Agent | Model | Role | Tools Available |
|-------|-------|------|----------------|
| **Scout** | Gemini 3 Flash | Fast data gathering, news search | `web_search`, `get_company_docs`, `search_company_docs`, `get_market_pulse`, `get_macro_context`, `get_asset_fundamentals`, `get_price_history` |
| **Quant** | Gemini 3 Pro | Complex calculations, financial modeling | `execute_python`, `run_valuation_model`, `generate_scenario_matrix`, `get_asset_fundamentals`, `get_price_history`, `get_technical_indicators`, `analyze_earnings_tone`, `get_sector_comparison` |
| **Skeptic** | Gemini 3 Flash | Validation, error detection | Read-only access to Scout/Quant outputs |

#### Query Classification

The system automatically classifies queries to determine whether to use the multi-agent orchestrator:

| Query Type | Description | Uses Orchestrator |
|------------|-------------|-------------------|
| `calculation` | DCF, valuation, fair value, forecasts | ✅ Yes |
| `research` | News, comparisons, explanations | ✅ Yes |
| `hybrid` | Both calculation and research | ✅ Yes |
| `simple` | Greetings, basic questions | ❌ No (single agent) |

#### Skeptic Validation Criteria

The Skeptic agent validates analysis against five criteria:

1. **Mathematical Accuracy** - Are calculations correct?
2. **Logical Consistency** - Do conclusions follow from data?
3. **Hallucination Detection** - Are all claims supported?
4. **Completeness** - Does the analysis answer the question?
5. **Quality Standards** - Is it institutional-grade?

#### Key Files

| File | Purpose |
|------|--------|
| `chat-worker/agent-state.ts` | State management and query classification |
| `chat-worker/agent-prompts.ts` | Specialized prompts for each agent |
| `chat-worker/agent-orchestrator.ts` | Multi-agent coordination logic |
| `chat-worker/index.ts` | Integration with main worker loop |

#### Streaming Architecture (Supabase Realtime)

Both **Company Chat** and **Global Brain Chat** now use the same streaming architecture via Supabase Realtime. This provides a robust and scalable solution for real-time updates.

**Feature Parity (v2.0):** Both chat systems now have identical functionality:
- Real-time streaming via Supabase Broadcast
- MALFORMED_FUNCTION_CALL recovery with automatic fallback
- Thought signature preservation for Gemini 3
- Correct function response format (`role: 'user'`)
- Pro/Flash model toggle
- Parallel tool execution

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STREAMING CHAT ARCHITECTURE (v2)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend                       Edge Function                           │
│  ┌───────────────┐             ┌───────────────────────────────────┐   │
│  │ useChatJob    │----POST-----▶│ company-chat-api                  │   │
│  │ Hook          │             │ (Job-based)                       │   │
│  │               │             │                                   │   │
│  │ Subscribes to │◀--Realtime--│ Broadcasts Events:                │   │
│  │ Supabase      │   Channel   │ • tool_start                      │   │
│  │ Realtime      │             │ • tool_complete                   │   │
│  │               │             │ • text_chunk                      │   │
│  │               │             │ • done / error                    │   │
│  └───────────────┘             └───────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/company-chat-api/chats/:chatId/messages` | POST | Company-specific chat (job-based async) |
| `/global-chat-api/chats/:chatId/messages` | POST | Global Brain chat (job-based async) |

#### Frontend Hooks

| Hook | Chat Type | Features |
|------|-----------|----------|
| `useSendMessage(chatId)` | Company Chat | Job-based + Realtime streaming |
| `useSendBrainMessage(chatId)` | Global Brain | Job-based + Realtime streaming |

Both hooks subscribe to Supabase Realtime channels for live updates:
- `company_job:{jobId}` - Company chat events
- `brain_job:{jobId}` - Global Brain chat events


                                                                                            ---

                                                                                            ## 11. Roadmap & Planned Features

### 11.1 Completed Features

- **NotebookLM-style Sources (v2.5):** Users can now upload files, add URLs, and create text notes as custom sources for each chat. The AI will reference these sources when answering questions.

### 11.2 Planned Features

                                                                                            ### 11.1 Agent Enhancement Tools

                                                                                            #### Forensic & Valuation (Fundamental Alpha)
                                                                                            - [ ] `run_valuation_model` - DCF/Comparable analysis
                                                                                            - [ ] - [ ] `detect_accounting_flags` - Earnings manipulation detection (Beneish M-Score)
                                                                                            - [ ] - [ ] `generate_scenario_matrix` - Sensitivity analysis tables
                                                                                           
                                                                                            - [ ] #### Sentiment Analysis (Sentiment Alpha)
                                                                                            - [ ] - [ ] `analyze_management_tone` - Earnings call sentiment shifts
                                                                                            - [ ] - [ ] `track_topic_trend` - Longitudinal topic tracking
                                                                                            - [ ] - [ ] `expert_network_proxy` - Cross-company intelligence
                                                                                           
                                                                                            - [ ] #### Macro & Ecosystem (Context Alpha)
                                                                                            - [ ] - [x] `get_macro_context` - ✅ Completed (Jan 11, 2026)
                                                                                            - [ ] - [ ] `map_supply_chain` - Supply chain risk mapping
                                                                                            - [ ] - [ ] `monitor_insider_activity` - Form 4 tracking
                                                                                           
                                                                                            - [ ] #### Alternative Data (Information Advantage)
                                                                                            - [ ] - [ ] `get_web_traffic` - Traffic as revenue proxy
                                                                                            - [ ] - [ ] `get_app_metrics` - App store analytics
                                                                                            - [ ] - [ ] `check_gov_contracts` - Government contract search
                                                                                           
                                                                                            - [ ] #### Market Structure (Flow Alpha)
                                                                                            - [ ] - [ ] `get_options_sentiment` - Put/Call ratio, IV skew
                                                                                            - [ ] - [ ] `get_institutional_flows` - Enhanced 13F analysis
                                                                                            - [ ] - [ ] `get_revenue_segments` - Geographic/product breakdown
                                                                                            - [ ] - [ ] `monitor_short_interest` - Short squeeze detection
                                                                                           
                                                                                            - [ ] ### 11.2 Agentic Workflows
                                                                                           
                                                                                            - [ ] | Workflow | Description | Status |
                                                                                            - [ ] |----------|-------------|--------|
                                                                                            - [ ] | `devils_advocate_mode` | Pre-mortem thesis testing | Planned |
                                                                                            - [ ] | `earnings_prep_pack` | Pre-earnings cheat sheet | Planned |
                                                                                            - [ ] | `watchdog_alerts` | Background monitoring | Planned |
                                                                                           
                                                                                            - [ ] ### 11.3 Platform Enhancements
                                                                                           
                                                                                            - [ ] - [ ] Backtesting framework for signal validation
                                                                                            - [ ] - [ ] Reinforcement learning from historical performance
                                                                                            - [ ] - [ ] TradingView chart integration
                                                                                            - [ ] - [ ] Streaming chat responses
                                                                                            - [ ] - [ ] Voice input for chat
                                                                                            - [ ] - [ ] Collaborative chat sharing
                                                                                            - [ ] - [ ] Export chat as PDF/Markdown
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] ## 12. Non-Functional Requirements
                                                                                           
                                                                                            - [ ] ### 12.1 Performance
                                                                                           
                                                                                            - [ ] | Metric | Target | Current |
                                                                                            - [ ] |--------|--------|---------|
                                                                                            - [ ] | Dashboard load time | < 3 seconds | ~2s |
                                                                                            - [ ] | Edge function timeout | 60 seconds | 60s |
                                                                                            - [ ] | Daily pipeline completion | Before market open | ✓ |
                                                                                            - [ ] | Chat response latency | < 5 seconds | ~3s |
                                                                                           
                                                                                            - [ ] ### 12.2 Security
                                                                                           
                                                                                            - [ ] | Requirement | Implementation |
                                                                                            - [ ] |-------------|----------------|
                                                                                            - [ ] | Authentication | Google OAuth with domain restriction (@stratos.xyz) |
                                                                                            - [ ] | Authorization | Row-level security (RLS) in Supabase |
                                                                                            - [ ] | API Keys | Environment variables only |
                                                                                            - [ ] | Chat Isolation | User-specific conversations |
                                                                                            - [ ] | Data Access | Read-only for most chat functions |
                                                                                           
                                                                                            - [ ] ### 12.3 Scalability
                                                                                           
                                                                                            - [ ] | Component | Strategy |
                                                                                            - [ ] |-----------|----------|
                                                                                            - [ ] | Pipeline stages | Independent scaling via Docker |
                                                                                            - [ ] | Job processing | pgmq queue for async work |
                                                                                            - [ ] | Document generation | Async job system |
                                                                                            - [ ] | Database | Supabase managed PostgreSQL |
                                                                                           
                                                                                            - [ ] ### 12.4 Reliability
                                                                                           
                                                                                            - [ ] | Requirement | Implementation |
                                                                                            - [ ] |-------------|----------------|
                                                                                            - [ ] | Data freshness | Health endpoint with latest_dates |
                                                                                            - [ ] | Pipeline monitoring | Success rate thresholds in workflows |
                                                                                            - [ ] | Error handling | Retry logic with exponential backoff |
                                                                                            - [ ] | Audit trail | pipeline_runs table |
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] ## 13. Success Metrics
                                                                                           
                                                                                            - [ ] ### 13.1 Product Metrics
                                                                                           
                                                                                            - [ ] | Metric | Target | Measurement |
                                                                                            - [ ] |--------|--------|-------------|
                                                                                            - [ ] | Signal accuracy (backtested) | TBD | Backtesting framework (roadmap) |
                                                                                            - [ ] | Daily active users | Growth | Supabase Analytics |
                                                                                            - [ ] | Chat sessions per user | Engagement | Database query |
                                                                                            - [ ] | Document generation completion | > 95% | Job success rate |
                                                                                            - [ ] | Pipeline success rate | > 99% | GitHub Actions metrics |
                                                                                           
                                                                                            - [ ] ### 13.2 Technical Metrics
                                                                                           
                                                                                            - [ ] | Metric | Target | Measurement |
                                                                                            - [ ] |--------|--------|-------------|
                                                                                            - [ ] | API response time (p95) | < 500ms | Vercel Analytics |
                                                                                            - [ ] | Database query time | < 100ms | Supabase Dashboard |
                                                                                            - [ ] | Worker job completion | < 5 min | Pipeline logs |
                                                                                            - [ ] | Uptime | 99.9% | Status monitoring |
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] ## 14. Known Limitations
                                                                                           
                                                                                            - [ ] ### 14.1 Technical Debt
                                                                                           
                                                                                            - [ ] | Issue | Impact | Priority |
                                                                                            - [ ] |-------|--------|----------|
                                                                                            - [ ] | Environment variable consolidation | Multiple sources of truth | Medium |
                                                                                            - [ ] | Backtesting not implemented | Cannot validate signal accuracy | High |
                                                                                            - [ ] | Component Storybook missing | UI documentation gap | Low |
                                                                                            - [ ] | Monitoring granularity | Limited alerting | Medium |
                                                                                           
                                                                                            - [ ] ### 14.2 Data Limitations
                                                                                           
                                                                                            - [ ] | Limitation | Workaround |
                                                                                            - [ ] |------------|------------|
                                                                                            - [ ] | Alpha Vantage rate limits | Batched requests, caching |
                                                                                            - [ ] | CoinGecko API limits | Pro API key |
                                                                                            - [ ] | 13F filing delay | 45-day SEC requirement |
                                                                                            - [ ] | Real-time data | Daily frequency only |
                                                                                           
                                                                                            - [ ] ### 14.3 AI Limitations
                                                                                           
                                                                                            - [ ] | Limitation | Mitigation |
                                                                                            - [ ] |------------|------------|
                                                                                            - [ ] | LLM hallucination | Two-pass analysis, grounding |
                                                                                            - [ ] | Context window limits | Chunking, summarization |
                                                                                            - [ ] | Code execution timeout | 60-second limit |
                                                                                            - [ ] | Search grounding accuracy | Citation verification |
                                                                                            - [ ] | Gemini MALFORMED_FUNCTION_CALL | JSON escaping instructions + automatic recovery |
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] ## Appendix A: Environment Variables
                                                                                           
                                                                                            - [ ] ```env
                                                                                            - [ ] # Supabase
                                                                                            - [ ] SUPABASE_URL=
                                                                                            - [ ] SUPABASE_ANON_KEY=
                                                                                            - [ ] SUPABASE_SERVICE_ROLE_KEY=
                                                                                           
                                                                                            - [ ] # AI
                                                                                            - [ ] GEMINI_API_KEY=
                                                                                            - [ ] E2B_API_KEY=
                                                                                           
                                                                                            - [ ] # Data Sources
                                                                                            - [ ] COINGECKO_API_KEY=
                                                                                            - [ ] ALPHAVANTAGE_API_KEY=
                                                                                            - [ ] FMP_API_KEY=
                                                                                           
                                                                                            - [ ] # Google Search
                                                                                            - [ ] GOOGLE_SEARCH_API_KEY=
                                                                                            - [ ] GOOGLE_SEARCH_ENGINE_ID=
                                                                                            - [ ] ```
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] ## Appendix B: Related Documentation
                                                                                           
                                                                                            - [ ] - [AI Analysis Documentation](./AI_ANALYSIS_DOCUMENTATION.md)
                                                                                            - [ ] - [API Reference](./API.md)
                                                                                            - [ ] - [Deployment Guide](./DEPLOYMENT.md)
                                                                                            - [ ] - [Data Ingestion Guide](./DATA_INGESTION_GUIDE.md)
                                                                                            - [ ] - [Pipeline Documentation](./pipeline_documentation.md)
                                                                                            - [ ] - [Prompting Recommendations](./prompting_recommendations.md)
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] ## Changelog
                                                                                           
| Version | Date | Changes |
|---------|------|---------|
| 2.4 | Jan 22, 2026 | **Enhanced Generative UI**: Added 4 new chart types to GenerativeUIRenderer - CorrelationHeatmap (asset correlation matrices), CandlestickChart (OHLC price data), TreeMap (hierarchical data visualization), ScatterPlot (two-variable analysis). Updated generate_dynamic_ui tool definition with 10 total component types. |
| 2.3 | Jan 22, 2026 | **MCP Integration**: Implemented Model Context Protocol server exposing 24 unified tools via JSON-RPC. Added mcp-client utility for connecting to internal/external MCP servers. Enables plug-and-play integration with Claude Desktop, Cursor IDE, and external data providers (Bloomberg, SEC Edgar). See `docs/MCP_INTEGRATION.md` for full API reference. |
| 2.2 | Jan 22, 2026 | **Skeptic Agent Loop**: Implemented multi-agent orchestration system with Scout (research), Quant (calculations), and Skeptic (validation) agents. Added query classification for automatic routing. Includes retry logic with max 2 attempts for failed validations. |
| 2.1 | Jan 22, 2026 | **Code Reuse Refactor**: Created shared `BaseChatInterface` component reducing code duplication by ~70%. Added error recovery with retry functionality. Improved mobile UX for CompanySidePanel with sticky tabs and touch optimization. |
                                                                                            - [ ] | 1.4 | Jan 15, 2026 | Added ETFs, Indices, and Commodities dashboard views with API endpoints; global equities now appear in All Equities view |
| 1.3 | Jan 15, 2026 | Added ETF tables (105 ETFs, 104K bars), market indices (15 global indices, 15K bars), commodities (40 commodities, 38K bars) |
| 1.2 | Jan 15, 2026 | Added global equities support (62 international tech stocks), FMP data ingestion, fx_rates table, USD conversion in daily_bars |
- [ ] | 1.1 | Jan 14, 2026 | Added fill_missing_descriptions.py script, fixed Under the Hood metrics display |
                                                                                            - [ ] | 1.0 | Jan 13, 2026 | Initial PRD document |
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] *This is a living document. Please update as the product evolves.*


### 9.4 Authentication System (v2 - Robust Auth)

**Objective:** Implement a resilient authentication system that provides a seamless user experience, survives deployments, and gracefully handles session-related issues without requiring manual user intervention (e.g., clearing cache).

#### 9.4.1 Core Principles

1.  **Single Source of Truth**: A new centralized utility, `lib/auth-storage.ts`, manages all interactions with `localStorage` for auth tokens. This eliminates inconsistencies where different parts of the app might look for different keys.
2.  **Centralized Logic**: The `AuthContext` is the primary interface for authentication state within the React application. It is responsible for initializing, refreshing, and managing the user session.
3.  **Resilient API Calls**: All API requests are funneled through a set of helpers in `lib/api-config.ts` which automatically attach authentication headers and include logic for recovering from stale authentication tokens.
4.  **Graceful Failure & Recovery**: The system is designed to detect and automatically recover from common authentication failures, such as expired tokens or session desynchronization.

#### 9.4.2 Key Components

| Component | File Path | Purpose |
|---|---|---|
| **Auth Storage Utility** | `lib/auth-storage.ts` | Provides a single, consistent interface for reading from and writing to `localStorage`. It defines a single storage key (`stratos-auth-token`) and provides synchronous getters for the user ID and access token. |
| **Auth Context** | `contexts/AuthContext.tsx` | Manages the application's auth state (`user`, `session`, `profile`, `loading`). It listens for auth changes from Supabase, handles sign-in/sign-out logic, and fetches user profiles. It now includes more robust initialization and session refresh logic. |
| **API Configuration** | `lib/api-config.ts` | Centralizes API endpoint configuration and header generation. It includes an `apiFetcher` for SWR that automatically handles auth errors, attempts to refresh the token, and, if that fails, clears the stale session. |
| **Stale Auth Handler** | `components/StaleAuthHandler.tsx` | A global component that periodically checks the health of the stored authentication token. If it detects a corrupt or expired token, it will automatically clear the session and prompt the user to sign in again. |
| **Version Check** | `components/VersionCheck.tsx` | Detects when a new version of the application has been deployed. It now ensures that the user's session is preserved during a refresh, preventing forced logouts on deployment. |
| **Auth Callback Page** | `pages/AuthCallback.tsx` | The page that handles the OAuth callback from Supabase. It has been made more robust with better error handling and a timeout to prevent it from getting stuck. |

#### 9.4.3 Authentication Flow

1.  **Initialization**: On application load, the `AuthProvider` attempts to load a session from Supabase. It uses the `auth-storage` utility to check for a pre-existing token, which helps in faster initialization.
2.  **API Requests**: When a component makes an API call (e.g., via a `useSWR` hook), it uses the `apiFetcher`. This fetcher gets the latest auth token from `auth-storage` and adds it to the request headers.
3.  **Token Expiration & Refresh**: If an API call fails with a 401 Unauthorized error, the `apiFetcher` in `api-config.ts` triggers a recovery process:
    *   It first attempts to silently refresh the token using `supabase.auth.refreshSession()`.
    *   If the refresh is successful, the original API request is automatically retried with the new token.
    *   If the refresh fails, it assumes the session is irrevocably stale. It then calls `clearAllAuthData()` to wipe the invalid token from `localStorage` and triggers a `stale-auth-cleared` event.
4.  **Stale Session Handling**: The `StaleAuthHandler` listens for the `stale-auth-cleared` event and displays a toast notification informing the user that their session has expired and they need to sign in again.
5.  **Sign Out**: When the user signs out, the `signOut` function in `AuthContext` is called. This function tells Supabase to invalidate the token, calls `clearAllAuthData()` to ensure no local data is left behind, and clears all user-specific data from the SWR cache.

This new architecture ensures that the application is much more resilient to common authentication problems and provides a smoother experience for the user.

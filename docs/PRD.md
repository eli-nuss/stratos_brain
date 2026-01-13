# Product Requirements Document (PRD): Stratos Brain

**Document Version:** 1.0  
**Last Updated:** January 13, 2026  
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
                                                                          | **AI Models** | Google Gemini 3 Pro Preview, Gemini Flash | LLM-powered analysis |
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
                                                                          | **Model Portfolio** | Paper trading | Simulation mode |

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
                                                                                     
                                                                                      - ### 4.4 Document Generation
                                                                                     
                                                                                      - Automated generation of investment documents:
                                                                                      - - **Investment Memos**: Comprehensive analysis documents
                                                                                        - - **One-Pagers**: Executive summaries
                                                                                          - - **Async Processing**: Job system for long-running generation
                                                                                           
                                                                                            - ---

                                                                                            ## 5. Database Schema

                                                                                            ### 5.1 Core Tables

                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `assets` | Master asset list | `asset_id`, `asset_type`, `is_active` |
                                                                                            | `daily_bars` | Raw OHLCV data | `asset_id`, `bar_date`, `open`, `high`, `low`, `close`, `volume` |
                                                                                            | `daily_features` | Technical indicators | `asset_id`, `as_of_date`, `rsi_14`, `macd`, `sma_20`, etc. |
                                                                                            | `daily_signal_facts` | Signal evaluations | `asset_id`, `template_name`, `signal_strength`, `direction` |
                                                                                            | `signal_instances` | Signal lifecycle | `signal_id`, `first_seen`, `last_seen`, `status` |
                                                                                            | `daily_asset_scores` | Composite scores | `asset_id`, `weighted_score`, `inflection_score` |
                                                                                            | `asset_ai_reviews` | AI analysis output | `asset_id`, `thesis`, `confidence`, `direction`, `scope` |

                                                                                            ### 5.2 Chat & Document Tables

                                                                                            | Table | Purpose | Key Columns |
                                                                                            |-------|---------|-------------|
                                                                                            | `company_chats` | Chat sessions | `chat_id`, `asset_id`, `user_id`, `display_name` |
                                                                                            | `chat_messages` | Conversation history | `message_id`, `chat_id`, `role`, `content`, `tool_calls` |
                                                                                            | `company_documents` | SEC filings, transcripts | `document_id`, `asset_id`, `document_type`, `content` |
                                                                                            | `document_chunks` | RAG embeddings | `chunk_id`, `document_id`, `embedding`, `content` |

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

                                                                                            ---

                                                                                            ## 6. Data Sources & Integrations

                                                                                            ### 6.1 Market Data

                                                                                            | Source | Data Type | Frequency | Assets |
                                                                                            |--------|-----------|-----------|--------|
                                                                                            | **CoinGecko** | OHLCV, Market Cap | Daily | Crypto |
                                                                                            | **Alpha Vantage** | OHLCV | Daily | Equities |
                                                                                            | **Financial Modeling Prep** | Fundamentals, 13F, Transcripts | Daily/Quarterly | Equities |

                                                                                            ### 6.2 AI & Search

                                                                                            | Service | Purpose | Integration |
                                                                                            |---------|---------|-------------|
                                                                                            | **Google Gemini API** | LLM analysis, chat | Edge Functions |
                                                                                            | **Google Custom Search** | Real-time news | Chat grounding |
                                                                                            | **E2B** | Code execution sandbox | Chat agents |

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
                                                                                            | `company-chat-api` | Asset chat | `/chats`, `/chats/:id/messages` |
                                                                                            | `global-chat-api` | Market chat | `/chat`, `/screen` |
                                                                                            | `generate-document` | Document generation | `/generate` |
                                                                                            | `feedback-api` | User feedback | `/feedback` |
                                                                                            | `investor-api` | Institutional data | `/investors`, `/holdings` |
                                                                                            | `fundamental-score-api` | On-demand scoring | `/score/:symbol` |

                                                                                            ### 8.2 Key API Endpoints

                                                                                            #### Dashboard Data
                                                                                            ```
                                                                                            GET  /api/dashboard/all-assets     # All assets with scores
                                                                                            GET  /api/dashboard/asset/:id      # Single asset detail
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
                                                                                            │   └── ThemeContext.tsx
                                                                                            ├── hooks/               # Custom data hooks
                                                                                            │   ├── useAllAssets.ts
                                                                                            │   ├── useDashboardData.ts
                                                                                            │   └── useCompanyChats.ts
                                                                                            ├── pages/               # Route pages
                                                                                            │   ├── Home.tsx
                                                                                            │   ├── CompanyChat.tsx
                                                                                            │   └── SmartMoney.tsx
                                                                                            └── lib/                 # Utilities
                                                                                                └── supabase.ts
                                                                                            ```

                                                                                            ### 9.2 Key Components

                                                                                            | Component | Purpose |
                                                                                            |-----------|---------|
                                                                                            | `DashboardLayout` | Main app shell with navigation |
                                                                                            | `CustomizableAssetTable` | Flexible data table with sorting/filtering |
                                                                                            | `AssetDetail` | Modal with charts, AI analysis, trade plan |
                                                                                            | `CompanyChatInterface` | Chat UI with code blocks and citations |
                                                                                            | `SmartMoneyTracker` | Institutional holdings visualization |

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

                                                                                            ```
                                                                                            You are an AI research analyst for {company_name} ({asset_id}).

                                                                                            ## Capabilities
                                                                                            1. Code Execution: Python with pandas, numpy, matplotlib
                                                                                            2. Web Search: Real-time news and market updates
                                                                                            3. Database Access: Fundamentals, signals, scores, price history

                                                                                            ## Context
                                                                                            - Asset Type: {asset_type}
                                                                                            - Current Date: {current_date}
                                                                                            - Latest Price: ${latest_price}
                                                                                            - Market Cap: {market_cap}

                                                                                            ## Guidelines
                                                                                            - Cite sources when using web search
                                                                                            - Show code when performing calculations
                                                                                            - Use database functions for accurate data
                                                                                            - Provide actionable insights
                                                                                            ```

                                                                                            ---

                                                                                            ## 11. Roadmap & Planned Features

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
                                                                                           
                                                                                            - [ ] | Version | Date | Changes |
                                                                                            - [ ] |---------|------|---------|
                                                                                            - [ ] | 1.0 | Jan 13, 2026 | Initial PRD document |
                                                                                           
                                                                                            - [ ] ---
                                                                                           
                                                                                            - [ ] *This is a living document. Please update as the product evolves.*

// supabase/functions/_shared/unified_tools.ts
// Unified Tool Definitions - "Shared Brain" Architecture
// Both Global Chat and Company Chat import from this single source of truth
// Database separation is maintained (brain_chats vs company_chats)

export const UNIFIED_TOOL_DECLARATIONS = [
  // ============================================================================
  // MARKET-WIDE TOOLS (Originally Global Chat only)
  // ============================================================================
  
  // Screen assets across the entire database
  {
    name: "screen_assets",
    description: "Scan the entire database for stocks/crypto matching fundamental and technical criteria. Use this for 'Find me stocks that...' queries. Returns real-time data from your proprietary database with AI scores, fundamentals, and technicals.",
    parameters: {
      type: "object",
      properties: {
        asset_type: {
          type: "string",
          enum: ["equity", "crypto", "all"],
          description: "Type of assets to screen: 'equity' for stocks, 'crypto' for cryptocurrencies, 'all' for both"
        },
        sector: {
          type: "string",
          description: "Filter by sector (e.g., 'Technology', 'Healthcare', 'Financial Services', 'Energy', 'Consumer Cyclical'). Only applies to equities."
        },
        industry: {
          type: "string",
          description: "Filter by industry (e.g., 'Software - Application', 'Semiconductors', 'Biotechnology'). Only applies to equities."
        },
        min_market_cap_billions: {
          type: "number",
          description: "Minimum market cap in billions USD (e.g., 10 for $10B+)"
        },
        max_market_cap_billions: {
          type: "number",
          description: "Maximum market cap in billions USD"
        },
        min_pe_ratio: {
          type: "number",
          description: "Minimum P/E ratio"
        },
        max_pe_ratio: {
          type: "number",
          description: "Maximum P/E ratio (e.g., 15 for value stocks)"
        },
        min_revenue_growth: {
          type: "number",
          description: "Minimum YoY revenue growth as decimal (e.g., 0.20 for 20%+)"
        },
        min_profit_margin: {
          type: "number",
          description: "Minimum profit margin as decimal (e.g., 0.15 for 15%+)"
        },
        min_roe: {
          type: "number",
          description: "Minimum return on equity as decimal (e.g., 0.20 for 20%+)"
        },
        min_performance_1m: {
          type: "number",
          description: "Minimum 1-month return as decimal (e.g., 0.05 for 5%+)"
        },
        max_performance_1m: {
          type: "number",
          description: "Maximum 1-month return as decimal"
        },
        min_ai_direction_score: {
          type: "number",
          description: "Minimum AI direction score (0-100, higher = more bullish)"
        },
        min_ai_setup_quality: {
          type: "number",
          description: "Minimum AI setup quality score (0-100)"
        },
        setup_type: {
          type: "string",
          enum: ["breakout", "pullback", "momentum", "reversal", "consolidation"],
          description: "Filter by AI-detected setup type"
        },
        sort_by: {
          type: "string",
          enum: ["market_cap", "revenue_growth", "performance_1m", "performance_30d", "pe_ratio", "ai_direction_score", "ai_setup_quality", "profit_margin", "roe"],
          description: "Field to sort results by"
        },
        sort_order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order: 'asc' for ascending, 'desc' for descending (default: desc)"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 15, max 50)"
        }
      },
      required: ["asset_type"]
    }
  },
  
  // Get market pulse - today's market action
  {
    name: "get_market_pulse",
    description: "Get today's market action including top gainers, losers, most active stocks, and sector performance. Use this for 'How is the market today?', 'What's moving?', 'Top gainers?', 'Which sectors are leading?'",
    parameters: {
      type: "object",
      properties: {
        data_type: {
          type: "string",
          enum: ["overview", "gainers", "losers", "actives", "sectors"],
          description: "Type of market data: 'overview' for summary of all, 'gainers' for top gainers, 'losers' for top losers, 'actives' for most active by volume, 'sectors' for sector performance"
        },
        limit: {
          type: "number",
          description: "Number of results to return (default 10, max 20)"
        }
      },
      required: ["data_type"]
    }
  },
  
  // Get financial calendar - earnings and economic events
  {
    name: "get_financial_calendar",
    description: "Get upcoming earnings dates and economic calendar events. Use this for 'When does X report earnings?', 'What earnings are this week?', 'Is CPI coming out?', 'Economic calendar'",
    parameters: {
      type: "object",
      properties: {
        calendar_type: {
          type: "string",
          enum: ["earnings", "economic", "both"],
          description: "Type of calendar: 'earnings' for company earnings, 'economic' for economic events (CPI, Fed, GDP), 'both' for all"
        },
        symbol: {
          type: "string",
          description: "Optional: specific stock symbol to check earnings date for"
        },
        days_ahead: {
          type: "number",
          description: "Number of days to look ahead (default 7, max 30)"
        }
      },
      required: ["calendar_type"]
    }
  },

  // ============================================================================
  // ASSET LOOKUP & FUNDAMENTALS (Shared)
  // ============================================================================
  
  // Search for assets by name or symbol
  {
    name: "search_assets",
    description: "Search for assets by symbol or name. Use this to find asset IDs for other function calls, or when user mentions a company by name.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Search query (symbol or company name)" 
        },
        asset_type: { 
          type: "string",
          enum: ["equity", "crypto"],
          description: "Filter by asset type: 'equity' or 'crypto'" 
        }
      },
      required: ["query"]
    }
  },
  
  // Get fundamentals for any ticker
  {
    name: "get_asset_fundamentals",
    description: "Get financial fundamentals for a company including revenue, earnings, margins, valuation ratios, and other key metrics. Use this to understand the company's financial health and valuation.",
    parameters: {
      type: "object",
      properties: {
        symbol: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'GOOGL'). For Company Chat, this is optional and defaults to the current asset." 
        }
      },
      required: []
    }
  },
  
  // Get price history
  {
    name: "get_price_history",
    description: "Get historical OHLCV (Open, High, Low, Close, Volume) price data for an asset. Returns daily bars for the specified number of days.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID. For Company Chat, this is optional and defaults to the current asset." 
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id (for Global Chat)"
        },
        days: { 
          type: "number", 
          description: "Number of days of history to retrieve (max 365)" 
        }
      },
      required: []
    }
  },
  
  // Get technical indicators
  {
    name: "get_technical_indicators",
    description: "Get current technical indicators and features for an asset including RSI, MACD, moving averages, Bollinger Bands, volume analysis, and trend regime.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID. For Company Chat, this is optional and defaults to the current asset." 
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id (for Global Chat)"
        },
        as_of_date: { 
          type: "string", 
          description: "Date in YYYY-MM-DD format (defaults to latest)" 
        }
      },
      required: []
    }
  },

  // ============================================================================
  // DEEP DIVE TOOLS (Originally Company Chat only)
  // ============================================================================
  
  // Get active trading signals
  {
    name: "get_active_signals",
    description: "Get active trading signals for an asset. Signals indicate potential trading opportunities based on technical patterns, momentum, and other factors.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID. For Company Chat, this is optional and defaults to the current asset." 
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id (for Global Chat)"
        },
        as_of_date: { 
          type: "string", 
          description: "Date in YYYY-MM-DD format (defaults to latest)" 
        }
      },
      required: []
    }
  },
  
  // Get AI reviews
  {
    name: "get_ai_reviews",
    description: "Get previous AI analysis reviews for an asset. These contain detailed analysis including direction, setup type, entry/exit levels, and risk assessment.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID. For Company Chat, this is optional and defaults to the current asset." 
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id (for Global Chat)"
        },
        limit: { 
          type: "number", 
          description: "Number of reviews to retrieve (default 5)" 
        }
      },
      required: []
    }
  },
  
  // Get sector comparison
  {
    name: "get_sector_comparison",
    description: "Compare an asset's performance against its sector/category peers. Returns relative performance metrics.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID. For Company Chat, this is optional and defaults to the current asset." 
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id (for Global Chat)"
        },
        as_of_date: { 
          type: "string", 
          description: "Date in YYYY-MM-DD format" 
        }
      },
      required: []
    }
  },
  
  // Deep Research Report retrieval
  {
    name: "get_deep_research_report",
    description: "Retrieves the latest Deep Research Report for a company if one exists. This comprehensive report contains: 1) Business Model Deep Dive (how the company makes money, revenue streams, customer segments, margins), 2) Historical Financial Analysis (7-10 years of data), 3) Key Metrics That Matter (3-5 business-specific metrics with historical trends), 4) Competitive Position, 5) Management Assessment. USE THIS FIRST when answering questions about business model, revenue breakdown, key metrics, or comprehensive company analysis.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID. For Company Chat, this is optional and defaults to the current asset." 
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id (for Global Chat)"
        }
      },
      required: []
    }
  },
  
  // Document retrieval - SEC filings and earnings transcripts
  {
    name: "get_company_docs",
    description: "Retrieves FULL text of SEC filings (10-K annual reports, 10-Q quarterly reports) or Earnings Call Transcripts. Use this for deep dives, risk analysis, finding specific quotes from management, understanding business strategy, or any question that requires reading the actual source documents.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'GOOGL'). For Company Chat, this is optional and defaults to the current asset." 
        },
        doc_type: { 
          type: "string", 
          enum: ["10-K", "10-Q", "transcript"],
          description: "Type of document: '10-K' for annual reports, '10-Q' for quarterly reports, 'transcript' for earnings call transcripts" 
        },
        years_back: { 
          type: "number", 
          description: "How many years of history to fetch (default 1, max 3)" 
        }
      },
      required: ["doc_type"]
    }
  },
  
  // Semantic search across document chunks
  {
    name: "search_company_docs",
    description: "Semantically search inside 10-K/10-Q filings and earnings transcripts using AI embeddings. PREFERRED over get_company_docs for specific questions. Returns only the most relevant paragraphs instead of the entire document.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'NVDA'). For Company Chat, this is optional and defaults to the current asset." 
        },
        search_query: { 
          type: "string", 
          description: "The specific question or topic to find (e.g., 'What are the AI risks?', 'Revenue recognition policy')" 
        },
        doc_type: { 
          type: "string", 
          enum: ["10-K", "10-Q", "transcript", "all"],
          description: "Type of document to search: '10-K', '10-Q', 'transcript', or 'all' for all types (default: 'all')" 
        },
        max_results: { 
          type: "number", 
          description: "Maximum number of relevant paragraphs to return (default 10, max 20)" 
        }
      },
      required: ["search_query"]
    }
  },
  
  // Track topic trends across earnings transcripts
  {
    name: "track_topic_trend",
    description: "Search for how often a topic is mentioned across earnings transcripts. SMART USAGE: Provide multiple synonyms to catch all mentions (e.g., for 'AI', provide ['AI', 'Artificial Intelligence', 'Generative AI', 'LLM', 'Machine Learning']).",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol. For Company Chat, this is optional and defaults to the current asset." 
        },
        search_phrases: { 
          type: "array", 
          items: { type: "string" },
          description: "List of related keywords/phrases to search for. Include synonyms, acronyms, and variations." 
        },
        quarters_back: { 
          type: "number", 
          description: "Number of quarters to search (default 8, max 16)" 
        }
      },
      required: ["search_phrases"]
    }
  },
  
  // Analyze management tone
  {
    name: "analyze_management_tone",
    description: "Compare the sentiment and linguistic patterns of a company's recent earnings call against previous calls. Detects shifts in management confidence, uncertainty language, and overall tone changes.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol. For Company Chat, this is optional and defaults to the current asset." 
        },
        quarters_to_compare: { 
          type: "number", 
          description: "Number of recent quarters to analyze (default 4, max 8)" 
        }
      },
      required: []
    }
  },

  // ============================================================================
  // VALUATION & ANALYSIS TOOLS (Originally Company Chat only)
  // ============================================================================
  
  // Run valuation models
  {
    name: "run_valuation_model",
    description: "Run a standardized DCF (Discounted Cash Flow) or Comparable Company valuation model using the company's actual financial data. Returns fair value estimates with different assumption scenarios.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol. For Company Chat, this is optional and defaults to the current asset. For Global Chat, this is REQUIRED." 
        },
        model_type: { 
          type: "string", 
          enum: ["dcf", "comps", "both"],
          description: "Type of valuation model: 'dcf' for Discounted Cash Flow, 'comps' for Comparable Companies, 'both' for both methods" 
        },
        growth_rate: { 
          type: "number", 
          description: "Expected revenue growth rate as decimal (e.g., 0.10 for 10%). If not provided, uses historical growth." 
        },
        discount_rate: { 
          type: "number", 
          description: "WACC/discount rate as decimal (e.g., 0.10 for 10%). Default is 10%." 
        },
        terminal_growth: { 
          type: "number", 
          description: "Terminal growth rate as decimal (e.g., 0.025 for 2.5%). Default is 2.5%." 
        }
      },
      required: ["model_type"]
    }
  },
  
  // Generate scenario/sensitivity matrix
  {
    name: "generate_scenario_matrix",
    description: "Generate a sensitivity analysis table showing how key metrics (EPS, fair value, etc.) change under different scenarios. Essential for Bull Case vs Bear Case analysis.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol. For Company Chat, this is optional and defaults to the current asset." 
        },
        metric: { 
          type: "string", 
          enum: ["eps", "fair_value", "revenue", "fcf"],
          description: "The metric to stress test: 'eps', 'fair_value', 'revenue', or 'fcf' (free cash flow)" 
        },
        variable_1: { 
          type: "string", 
          enum: ["revenue_growth", "margin", "multiple", "discount_rate"],
          description: "First variable to vary (rows)" 
        },
        variable_2: { 
          type: "string", 
          enum: ["revenue_growth", "margin", "multiple", "discount_rate"],
          description: "Second variable to vary (columns)" 
        },
        range_pct: { 
          type: "number", 
          description: "Percentage range to vary each variable (e.g., 20 means -20% to +20%). Default is 20." 
        }
      },
      required: ["metric", "variable_1", "variable_2"]
    }
  },

  // ============================================================================
  // MACRO & INSTITUTIONAL TOOLS (Shared)
  // ============================================================================
  
  // Get macro context
  {
    name: "get_macro_context",
    description: "Fetches the current 'State of the Market' including Risk Regime, Interest Rates, Inflation, Commodity trends, and Sector Rotation. MANDATORY USE: Call this tool FIRST if the user asks about 'buying', 'market conditions', 'risks', 'outlook', or any investment recommendation.",
    parameters: {
      type: "object",
      properties: {
        focus_sector: { 
          type: "string", 
          description: "Optional: The sector of the stock being discussed (e.g., 'Technology', 'Consumer Discretionary')" 
        },
        days_back: {
          type: "number",
          description: "Number of days of macro history to analyze for trends (default: 1, max: 30)"
        }
      },
      required: []
    }
  },
  
  // Get institutional flows
  {
    name: "get_institutional_flows",
    description: "Returns the TOP 10 INSTITUTIONAL HOLDERS by name (e.g., Vanguard, BlackRock, Citadel) and their share counts from 13F filings. Also tracks whether 'Smart Money' is accumulating or distributing.",
    parameters: {
      type: "object",
      properties: {
        symbol: { 
          type: "string", 
          description: "The stock ticker symbol. For Company Chat, this is optional and defaults to the current asset." 
        },
        lookback_quarters: {
          type: "number",
          description: "Number of quarters to analyze for trend (default: 2, max: 4)"
        }
      },
      required: []
    }
  },

  // ============================================================================
  // UTILITY TOOLS (Shared)
  // ============================================================================
  
  // Grounded Research using native Gemini Google Search
  {
    name: "perform_grounded_research",
    description: "Search the web using Google Search and get a synthesized, comprehensive answer with citations. Use this for ANY external knowledge: current news, company developments, market events, explanations, historical context, or any information not in the database.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "The research query - be specific and detailed for best results" 
        }
      },
      required: ["query"]
    }
  },
  
  // Python code execution - STATEFUL: Variables persist across calls in the same chat!
  {
    name: "execute_python",
    description: "Execute Python code in a STATEFUL Jupyter-like environment. **Variables defined in previous calls are preserved!** This means you can: (1) Define a DataFrame in one call, (2) Filter or transform it in the next call, (3) Plot it in a third call. NumPy, Pandas, Matplotlib are pre-imported. Use this for iterative data analysis, calculations, and visualizations.",
    parameters: {
      type: "object",
      properties: {
        code: { 
          type: "string", 
          description: "Python code to execute. Variables from previous executions in this chat are still available. If data_context is specified, data will be pre-loaded into 'df'." 
        },
        purpose: { 
          type: "string", 
          description: "Brief description of what this code does (for logging)" 
        },
        data_context: {
          type: "object",
          description: "Optional: Specify data to pre-load into the sandbox. The data will be available as a 'df' DataFrame.",
          properties: {
            type: {
              type: "string",
              enum: ["price_history", "fundamentals", "signals", "custom"],
              description: "Type of data to load"
            },
            asset_id: {
              type: "number",
              description: "Asset ID to fetch data for"
            },
            ticker: {
              type: "string",
              description: "Ticker symbol (for fundamentals)"
            },
            days: {
              type: "number",
              description: "Number of days of history to fetch (for price_history, default 365)"
            }
          }
        }
      },
      required: ["code", "purpose"]
    }
  },
  
  // Generate dynamic UI
  {
    name: "generate_dynamic_ui",
    description: "Renders a visual UI component in the chat. Use this when the user asks for comparisons, trends, financial charts, data tables, or any visual representation of data. DO NOT use markdown tables - use this tool instead for better visualization.",
    parameters: {
      type: "object",
      properties: {
        componentType: { 
          type: "string", 
          enum: ["FinancialChart", "MetricCard", "RiskGauge", "DataTable", "ComparisonChart", "InteractiveModel"],
          description: "The type of React component to render. Use InteractiveModel for DCF, scenario analysis, or any model where the user should be able to adjust inputs." 
        },
        title: { 
          type: "string", 
          description: "The title of the chart/card/table. Include the unit in the title (e.g., '($ Billions)' or '(%)')." 
        },
        data: { 
          type: "object", 
          description: "STRICT JSON data. Schemas: FinancialChart: {type: 'line'|'bar', metric: string, points: [{label: string, value: number}]}. MetricCard: {metrics: [{label: string, value: string, trend: number}]}. DataTable: {headers: string[], rows: string[][]}. ComparisonChart: {items: [{name: string, value: number}]}. InteractiveModel: {modelType: 'dcf'|'scenario'|'sensitivity'|'custom', baseValue: number, variables: [{name: string, label: string, value: number, min: number, max: number, step: number, unit?: '%'|'$'|'x'}], formula?: string}." 
        },
        insight: { 
          type: "string", 
          description: "A one-sentence analyst takeaway to display below the visualization." 
        }
      },
      required: ["componentType", "title", "data"]
    }
  },
  
  // Document creation and export
  {
    name: "create_and_export_document",
    description: "Create a structured document from analysis and save it for download. Use this when the user asks for a document, report, analysis, DCF, valuation, or any exportable content. The user will see download buttons for Markdown and PDF.",
    parameters: {
      type: "object",
      properties: {
        asset_id: {
          type: "number",
          description: "The asset ID to save the document to. For Company Chat, this is automatically injected."
        },
        title: {
          type: "string",
          description: "Document title (e.g., 'DCF Analysis - AAPL', 'Market Analysis Report')"
        },
        document_type: {
          type: "string",
          enum: ["analysis", "report", "summary", "dcf", "valuation", "comparison", "research", "screening", "custom"],
          description: "Type of document being created"
        },
        content: {
          type: "string",
          description: "Full markdown content of the document. Use proper markdown formatting with headers, tables, bullet points, bold text."
        },
        export_format: {
          type: "string",
          enum: ["markdown", "pdf", "both"],
          description: "Format to export the document."
        }
      },
      required: ["title", "document_type", "content", "export_format"]
    }
  }
]

// Helper to get tool names for quick reference
export const TOOL_NAMES = UNIFIED_TOOL_DECLARATIONS.map(t => t.name)

// Tool categories for documentation
export const TOOL_CATEGORIES = {
  market_wide: ["screen_assets", "get_market_pulse", "get_financial_calendar"],
  asset_lookup: ["search_assets", "get_asset_fundamentals", "get_price_history", "get_technical_indicators"],
  deep_dive: ["get_active_signals", "get_ai_reviews", "get_sector_comparison", "get_deep_research_report", "get_company_docs", "search_company_docs", "track_topic_trend", "analyze_management_tone"],
  valuation: ["run_valuation_model", "generate_scenario_matrix"],
  macro: ["get_macro_context", "get_institutional_flows"],
  utility: ["perform_grounded_research", "execute_python", "generate_dynamic_ui", "create_and_export_document"]
}

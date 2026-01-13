// Stratos Brain - Global Chat API
// General-purpose AI assistant for market analysis, not tied to any specific asset
// Forked from company-chat-api with general-purpose tools

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview'
const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY') || ''
const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX') || ''
const E2B_API_KEY = Deno.env.get('E2B_API_KEY') || ''
const E2B_API_URL = 'https://api.e2b.dev'
const FMP_API_KEY = Deno.env.get('FMP_API_KEY') || ''

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Unified function declarations for Gemini
const unifiedFunctionDeclarations = [
  // Screen assets across the entire database using v_dashboard_all_assets view
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
  // Search for assets by name or symbol
  {
    name: "search_assets",
    description: "Search for assets by name or ticker symbol. Use this when the user mentions a specific company or crypto by name.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query - company name, ticker symbol, or crypto name"
        },
        asset_type: {
          type: "string",
          enum: ["equity", "crypto"],
          description: "Optional: filter by asset type"
        }
      },
      required: ["query"]
    }
  },
  // Get fundamentals for any ticker
  {
    name: "get_asset_fundamentals",
    description: "Get fundamental data for a specific stock or crypto. Includes valuation metrics, financial ratios, and company info.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The ticker symbol (e.g., 'AAPL', 'BTC')"
        }
      },
      required: ["symbol"]
    }
  },
  // Get price history
  {
    name: "get_price_history",
    description: "Get historical price data (OHLCV) for an asset. Use this for price analysis, charting, or calculating returns.",
    parameters: {
      type: "object",
      properties: {
        asset_id: {
          type: "number",
          description: "The asset_id from the database"
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id"
        },
        days: {
          type: "number",
          description: "Number of days of history (default 90, max 365)"
        }
      },
      required: []
    }
  },
  // Get technical indicators
  {
    name: "get_technical_indicators",
    description: "Get technical analysis indicators for an asset including RSI, MACD, moving averages, volatility metrics, and momentum signals.",
    parameters: {
      type: "object",
      properties: {
        asset_id: {
          type: "number",
          description: "The asset_id from the database"
        },
        symbol: {
          type: "string",
          description: "Alternative: use ticker symbol instead of asset_id"
        },
        as_of_date: {
          type: "string",
          description: "Date for indicators (YYYY-MM-DD format, defaults to latest)"
        }
      },
      required: []
    }
  },
  // Get macro context
  {
    name: "get_macro_context",
    description: "Get the current macroeconomic environment including market regime, interest rates, inflation, commodities, and sector rotation. ALWAYS call this before making any investment recommendations to understand if the market environment is supportive.",
    parameters: {
      type: "object",
      properties: {
        focus_sector: {
          type: "string",
          description: "Optional: sector to analyze specifically (e.g., 'Technology', 'Healthcare')"
        },
        days_back: {
          type: "number",
          description: "Number of days of macro history to analyze (default 1, max 30)"
        }
      },
      required: []
    }
  },
  // Get institutional flows
  {
    name: "get_institutional_flows",
    description: "Get institutional ownership data from 13F filings. Shows top holders, position changes, and smart money flow. Use this to detect accumulation/distribution patterns.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The stock ticker symbol (e.g., 'AAPL', 'NVDA')"
        },
        lookback_quarters: {
          type: "number",
          description: "Number of quarters to analyze (default 2, max 4)"
        }
      },
      required: ["symbol"]
    }
  },
  // Universal Search - uses native Gemini Google Search for any external knowledge
  {
    name: "perform_grounded_research",
    description: "The 'Universal Search' tool. Use this for ANY query that requires knowledge outside your internal database. This includes: current events, geopolitical analysis, technical documentation, competitor research, historical context, educational explanations, or general knowledge. It uses Google's native engine to read the web and synthesize detailed answers with citations.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The detailed question or topic to research. Be specific about what you want (e.g., 'Analyze the impact of X on Y', 'Explain how Z works', 'What is the history of W')."
        }
      },
      required: ["query"]
    }
  },
  // Execute Python code
  {
    name: "execute_python",
    description: "Execute Python code in a sandboxed environment for calculations, data analysis, or generating insights. Use this for any mathematical calculations or data processing.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Python code to execute. Must print() any output you want to see."
        },
        purpose: {
          type: "string",
          description: "Brief description of what this code does"
        }
      },
      required: ["code", "purpose"]
    }
  },
  // Generate dynamic UI
  {
    name: "generate_dynamic_ui",
    description: "Render a visual UI component in the chat. Use this for tables, charts, and data visualizations instead of markdown tables.",
    parameters: {
      type: "object",
      properties: {
        componentType: {
          type: "string",
          enum: ["FinancialChart", "MetricCard", "RiskGauge", "DataTable", "ComparisonChart"],
          description: "Type of component: FinancialChart for line/bar charts, MetricCard for key stats, DataTable for tabular data, ComparisonChart for comparisons"
        },
        title: {
          type: "string",
          description: "Title of the visualization"
        },
        data: {
          type: "object",
          description: "Data for the component. DataTable: {headers: string[], rows: string[][]}. FinancialChart: {type: 'line'|'bar', points: [{label, value}]}. MetricCard: {metrics: [{label, value, trend}]}."
        },
        insight: {
          type: "string",
          description: "One-sentence insight to display below the visualization"
        }
      },
      required: ["componentType", "title", "data"]
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
  // Document creation and export function
  {
    name: "create_and_export_document",
    description: "Create a structured document from analysis and save it for download. Use this when the user asks for a document, report, analysis, or any exportable content. The user will see download buttons for Markdown and PDF. IMPORTANT: Generate complete, well-formatted markdown content with proper headers, tables, and sections.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title (e.g., 'Market Analysis Report', 'Portfolio Screening Results', 'Sector Comparison')"
        },
        document_type: {
          type: "string",
          enum: ["analysis", "report", "summary", "screening", "comparison", "research", "custom"],
          description: "Type of document being created"
        },
        content: {
          type: "string",
          description: "Full markdown content of the document. Use proper markdown formatting with headers (#, ##, ###), tables, bullet points, bold text, and code blocks where appropriate."
        },
        export_format: {
          type: "string",
          enum: ["markdown", "pdf", "both"],
          description: "Format to export the document. 'both' will generate both Markdown and PDF versions."
        }
      },
      required: ["title", "document_type", "content", "export_format"]
    }
  }
]

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

// Grounded Research using native Gemini Google Search (Tool-ception pattern)
// This spins up a separate Gemini instance with ONLY googleSearch enabled
// to get high-quality synthesized answers with citations
async function executeGroundedSearch(query: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            role: 'user', 
            parts: [{ text: `You are a highly capable research assistant with access to Google Search.

User Query: "${query}"

Instructions:
1. Use Google Search to find the most relevant and up-to-date information.
2. Answer the query comprehensively and thoroughly.
3. If the query asks for an opinion or analysis, provide it based on the search results.
4. If the query asks for a specific format (bullet points, essay, table, timeline), follow it.
5. If the query is about current events, include specific dates, names, and developments.
6. If the query is technical or educational, explain concepts clearly.

Provide a detailed, well-structured response with citations where appropriate.` }] 
          }],
          tools: [{ googleSearch: {} }], // EXCLUSIVE MODE: Grounding ONLY - no function calling
          generationConfig: { 
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return `Research Error: ${response.status} - ${errorText}`;
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text).join('') || "No results found.";
    
    // Extract Grounding Metadata (Citations) and append to text
    const metadata = candidate?.groundingMetadata;
    let citationText = "";
    
    if (metadata?.groundingChunks && metadata.groundingChunks.length > 0) {
      citationText = "\n\n**Sources:**\n" + metadata.groundingChunks
        .slice(0, 10) // Limit to top 10 sources
        .map((c: { web?: { title?: string; uri?: string } }, i: number) => 
          `[${i+1}] ${c.web?.title || 'Source'} - ${c.web?.uri || ''}`
        )
        .join('\n');
    }
    
    // Also include search queries used if available
    if (metadata?.webSearchQueries && metadata.webSearchQueries.length > 0) {
      citationText += "\n\n**Search queries used:** " + metadata.webSearchQueries.join(', ');
    }

    return text + citationText;

  } catch (e) {
    return `Research failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

// Execute Python code using E2B sandbox
async function executePythonCode(code: string, purpose: string): Promise<unknown> {
  if (!E2B_API_KEY) {
    return {
      success: false,
      purpose,
      code,
      output: null,
      error: "E2B API key not configured"
    }
  }

  try {
    // Create sandbox
    const createResponse = await fetch(`${E2B_API_URL}/sandboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: 'code-interpreter-v1',
        timeoutMs: 60000,
      }),
    })

    if (!createResponse.ok) {
      return { success: false, purpose, code, output: null, error: `Failed to create sandbox: ${createResponse.status}` }
    }

    const sandbox = await createResponse.json()
    const sandboxId = sandbox.sandboxID || sandbox.sandboxId || sandbox.id
    if (!sandboxId) {
      return { success: false, purpose, code, output: null, error: 'Failed to get sandbox ID' }
    }

    // Execute code
    const executeUrl = `https://49999-${sandboxId}.e2b.dev/execute`
    const accessToken = sandbox.envdAccessToken || ''
    
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': accessToken,
      },
      body: JSON.stringify({ code, language: 'python' }),
    })

    let executionResult: { stdout: string[]; stderr: string[]; error?: string } = { stdout: [], stderr: [] }

    if (executeResponse.ok) {
      const responseText = await executeResponse.text()
      const lines = responseText.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'stdout' && parsed.text) executionResult.stdout.push(parsed.text)
          else if (parsed.type === 'stderr' && parsed.text) executionResult.stderr.push(parsed.text)
          else if (parsed.error) executionResult.error = parsed.error
        } catch {
          if (line.trim()) executionResult.stdout.push(line)
        }
      }
    } else {
      executionResult.error = `Execution failed: ${executeResponse.status}`
    }

    // Cleanup sandbox
    try {
      await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}`, { method: 'DELETE', headers: { 'X-API-Key': E2B_API_KEY } })
    } catch { /* ignore */ }

    const output = executionResult.stdout.join('')
    const errorOutput = executionResult.stderr.join('')
    
    if (executionResult.error) {
      return { success: false, purpose, code, output: output || null, error: executionResult.error + (errorOutput ? `\n${errorOutput}` : '') }
    }

    return { success: true, purpose, code, output: output || '(No output)', error: errorOutput || null }
  } catch (error) {
    return { success: false, purpose, code, output: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Execute function calls
async function executeFunctionCall(
  functionCall: { name: string; args: Record<string, unknown> },
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, unknown>> {
  const { name, args } = functionCall

  switch (name) {
    case "screen_assets": {
      console.log("🔍 Running Screen:", JSON.stringify(args))
      
      const assetType = args.asset_type as string
      const limit = Math.min((args.limit as number) || 15, 50)
      
      // Use v_dashboard_all_assets view which has all the data we need
      let query = supabase
        .from('v_dashboard_all_assets')
        .select(`
          asset_id, symbol, name, asset_type, sector, industry,
          close, return_1d, return_7d, return_30d, return_365d,
          market_cap, pe_ratio, forward_pe, peg_ratio,
          revenue_ttm, revenue_growth_yoy, profit_margin, operating_margin, roe, roa,
          ai_direction, ai_direction_score, ai_setup_quality_score, setup_type, ai_confidence, ai_summary,
          beta, dividend_yield, eps, analyst_target_price
        `)
      
      // Filter by asset type
      if (assetType === 'equity') {
        query = query.eq('asset_type', 'equity')
      } else if (assetType === 'crypto') {
        query = query.eq('asset_type', 'crypto')
      }
      // 'all' doesn't add a filter
      
      // Sector/Industry filters (equities only)
      if (args.sector) query = query.ilike('sector', `%${args.sector}%`)
      if (args.industry) query = query.ilike('industry', `%${args.industry}%`)
      
      // Market cap filters (convert billions to actual value)
      if (args.min_market_cap_billions) query = query.gte('market_cap', (args.min_market_cap_billions as number) * 1e9)
      if (args.max_market_cap_billions) query = query.lte('market_cap', (args.max_market_cap_billions as number) * 1e9)
      
      // Valuation filters
      if (args.min_pe_ratio) query = query.gte('pe_ratio', args.min_pe_ratio)
      if (args.max_pe_ratio) query = query.lte('pe_ratio', args.max_pe_ratio)
      
      // Fundamental filters
      if (args.min_revenue_growth) query = query.gte('revenue_growth_yoy', args.min_revenue_growth)
      if (args.min_profit_margin) query = query.gte('profit_margin', args.min_profit_margin)
      if (args.min_roe) query = query.gte('roe', args.min_roe)
      
      // Performance filters
      if (args.min_performance_1m) query = query.gte('return_30d', args.min_performance_1m)
      if (args.max_performance_1m) query = query.lte('return_30d', args.max_performance_1m)
      
      // AI score filters
      if (args.min_ai_direction_score) query = query.gte('ai_direction_score', args.min_ai_direction_score)
      if (args.min_ai_setup_quality) query = query.gte('ai_setup_quality_score', args.min_ai_setup_quality)
      if (args.setup_type) query = query.eq('setup_type', args.setup_type)
      
      // Sorting - map sort_by to actual column names
      const sortMapping: Record<string, string> = {
        'market_cap': 'market_cap',
        'revenue_growth': 'revenue_growth_yoy',
        'performance_1m': 'return_30d',
        'performance_30d': 'return_30d',
        'pe_ratio': 'pe_ratio',
        'ai_direction_score': 'ai_direction_score',
        'ai_setup_quality': 'ai_setup_quality_score',
        'profit_margin': 'profit_margin',
        'roe': 'roe'
      }
      const sortBy = sortMapping[args.sort_by as string] || 'market_cap'
      const sortOrder = args.sort_order === 'asc'
      query = query.order(sortBy, { ascending: sortOrder, nullsFirst: false })
      query = query.limit(limit)
      
      const { data, error } = await query
      
      if (error) {
        console.error('Screen error:', error)
        return { error: error.message }
      }
      
      if (!data || data.length === 0) {
        return { 
          result: "No assets found matching your criteria. Try relaxing some filters.",
          filters_applied: args,
          count: 0
        }
      }
      
      // Format the results for clean display
      const formattedAssets = data.map((d: Record<string, unknown>) => {
        const result: Record<string, unknown> = {
          symbol: d.symbol,
          name: d.name,
          type: d.asset_type
        }
        
        // Add sector/industry for equities
        if (d.asset_type === 'equity') {
          result.sector = d.sector
          result.industry = d.industry
        }
        
        // Market cap
        if (d.market_cap) {
          const mcap = d.market_cap as number
          result.market_cap = mcap >= 1e12 
            ? `$${(mcap / 1e12).toFixed(2)}T` 
            : mcap >= 1e9 
              ? `$${(mcap / 1e9).toFixed(1)}B`
              : `$${(mcap / 1e6).toFixed(0)}M`
        }
        
        // Price and returns
        result.price = d.close ? `$${(d.close as number).toFixed(2)}` : null
        result.return_1d = d.return_1d ? `${((d.return_1d as number) * 100).toFixed(2)}%` : null
        result.return_30d = d.return_30d ? `${((d.return_30d as number) * 100).toFixed(1)}%` : null
        
        // Fundamentals
        if (d.pe_ratio) result.pe_ratio = (d.pe_ratio as number).toFixed(1)
        if (d.revenue_growth_yoy) result.revenue_growth = `${((d.revenue_growth_yoy as number) * 100).toFixed(1)}%`
        if (d.profit_margin) result.profit_margin = `${((d.profit_margin as number) * 100).toFixed(1)}%`
        if (d.roe) result.roe = `${((d.roe as number) * 100).toFixed(1)}%`
        
        // AI scores
        if (d.ai_direction) result.ai_direction = d.ai_direction
        if (d.ai_direction_score) result.ai_direction_score = d.ai_direction_score
        if (d.setup_type) result.setup_type = d.setup_type
        if (d.ai_setup_quality_score) result.ai_setup_quality = d.ai_setup_quality_score
        if (d.ai_summary) result.ai_summary = d.ai_summary
        
        return result
      })
      
      return {
        count: data.length,
        filters_applied: args,
        assets: formattedAssets
      }
    }

    case "search_assets": {
      const query = args.query as string
      let dbQuery = supabase
        .from('assets')
        .select('asset_id, symbol, name, asset_type, sector, industry')
        .eq('is_active', true)
        .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
        .limit(10)
      
      if (args.asset_type) {
        dbQuery = dbQuery.eq('asset_type', args.asset_type)
      }
      
      const { data, error } = await dbQuery
      if (error) return { error: error.message }
      return { assets: data || [], count: data?.length || 0, query }
    }

    case "get_asset_fundamentals": {
      const symbol = (args.symbol as string).toUpperCase()
      
      // Try equity first
      const { data: equity, error: eqError } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', symbol)
        .single()
      
      if (equity) return { fundamentals: equity, asset_type: 'equity' }
      
      // Try crypto
      const { data: crypto, error: crError } = await supabase
        .from('crypto_metadata')
        .select('*')
        .eq('symbol', symbol)
        .single()
      
      if (crypto) return { fundamentals: crypto, asset_type: 'crypto' }
      
      return { error: `No data found for symbol: ${symbol}` }
    }

    case "get_price_history": {
      let assetId = args.asset_id as number
      
      // If symbol provided, look up asset_id
      if (!assetId && args.symbol) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', (args.symbol as string).toUpperCase())
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const days = Math.min((args.days as number) || 90, 365)
      const { data, error } = await supabase
        .from('daily_bars')
        .select('date, open, high, low, close, volume')
        .eq('asset_id', assetId)
        .order('date', { ascending: false })
        .limit(days)
      
      if (error) return { error: error.message }
      return { bars: data?.reverse() || [], count: data?.length || 0 }
    }

    case "get_technical_indicators": {
      let assetId = args.asset_id as number
      
      if (!assetId && args.symbol) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', (args.symbol as string).toUpperCase())
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const targetDate = args.as_of_date || new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('daily_features')
        .select('*')
        .eq('asset_id', assetId)
        .lte('date', targetDate)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      
      if (error) return { error: error.message }
      return { indicators: data, as_of_date: targetDate }
    }

    case "get_macro_context": {
      const days_back = Math.min((args.days_back as number) || 1, 30)
      const focus_sector = args.focus_sector as string | undefined
      
      const { data: macroData, error } = await supabase
        .from('daily_macro_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(days_back)
      
      if (error || !macroData || macroData.length === 0) {
        return { error: 'No macro data available' }
      }
      
      const latest = macroData[0]
      let sectorData: Record<string, number> = {}
      try {
        sectorData = typeof latest.sector_rotation === 'string' 
          ? JSON.parse(latest.sector_rotation) 
          : latest.sector_rotation || {}
      } catch { /* ignore */ }
      
      const response: Record<string, unknown> = {
        date: latest.date,
        market_regime: latest.market_regime,
        risk_premium: latest.risk_premium,
        rates: {
          us_10y_yield: latest.us10y_yield,
          us_2y_yield: latest.us2y_yield,
          yield_curve_spread: latest.yield_curve_10y_2y,
          yield_curve_status: latest.yield_curve_10y_2y < 0 ? 'INVERTED' : 'Normal'
        },
        commodities: {
          oil_price: latest.oil_close,
          gold_price: latest.gold_close,
          copper_price: latest.copper_close
        },
        inflation: {
          cpi_yoy: latest.cpi_yoy,
          status: latest.cpi_yoy > 3 ? 'Hot' : latest.cpi_yoy < 2 ? 'Cool' : 'Target Range'
        },
        market_breadth: {
          spy_price: latest.spy_close,
          spy_change_pct: latest.spy_change_pct,
          breadth_rating: latest.breadth_rating
        },
        sector_rotation: sectorData,
        leading_sectors: Object.entries(sectorData)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([sector, change]) => ({ sector, change_pct: change })),
        lagging_sectors: Object.entries(sectorData)
          .sort(([,a], [,b]) => (a as number) - (b as number))
          .slice(0, 3)
          .map(([sector, change]) => ({ sector, change_pct: change }))
      }
      
      if (focus_sector && sectorData[focus_sector] !== undefined) {
        response.focus_sector_analysis = {
          sector: focus_sector,
          performance_today: sectorData[focus_sector],
          relative_rank: Object.values(sectorData).filter((v) => (v as number) > sectorData[focus_sector]).length + 1
        }
      }
      
      return response
    }

    case "get_institutional_flows": {
      const symbol = (args.symbol as string).toUpperCase()
      const lookback_quarters = Math.min((args.lookback_quarters as number) || 2, 4)
      
      if (!FMP_API_KEY) {
        return { error: 'FMP API key not configured' }
      }
      
      // Dynamic date calculation - FMP 13F data lags by ~45 days
      // Go back 2 quarters from now to ensure full filing availability
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() // 0-indexed
      
      let year = currentYear
      let quarter = Math.floor(currentMonth / 3) + 1 // 1-4
      
      // Go back 2 quarters to get latest available data
      quarter -= 2
      if (quarter <= 0) {
        quarter += 4
        year -= 1
      }
      
      const quarters: Array<{year: number, quarter: number}> = []
      for (let i = 0; i < lookback_quarters; i++) {
        quarters.push({ year, quarter })
        if (quarter === 1) { year -= 1; quarter = 4 } else { quarter -= 1 }
      }
      
      const quarterlyData = []
      for (const { year, quarter } of quarters) {
        const url = `https://financialmodelingprep.com/stable/institutional-ownership/symbol-positions-summary?symbol=${symbol}&year=${year}&quarter=${quarter}&apikey=${FMP_API_KEY}`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            quarterlyData.push({ ...data[0], year, quarter })
          }
        }
      }
      
      if (quarterlyData.length === 0) {
        return { error: `No institutional data for ${symbol}` }
      }
      
      const latest = quarterlyData[0]
      const flow_trend = latest.investorsHoldingChange > 10 ? 'Accumulation' : latest.investorsHoldingChange < -10 ? 'Distribution' : 'Neutral'
      
      return {
        symbol,
        quarter: `Q${latest.quarter} ${latest.year}`,
        holders: {
          total: latest.investorsHolding,
          change: latest.investorsHoldingChange
        },
        ownership: {
          percent: latest.ownershipPercent,
          change_pct: latest.ownershipPercentChange
        },
        position_changes: {
          new_positions: latest.newPositions,
          increased_positions: latest.increasedPositions,
          closed_positions: latest.closedPositions,
          reduced_positions: latest.reducedPositions
        },
        flow_analysis: {
          trend: flow_trend,
          interpretation: flow_trend === 'Accumulation'
            ? 'BULLISH: Institutions are buying'
            : flow_trend === 'Distribution'
            ? 'BEARISH: Institutions are selling'
            : 'Neutral positioning'
        }
      }
    }

    case "perform_grounded_research": {
      const result = await executeGroundedSearch(args.query as string);
      return { research_summary: result };
    }

    case "execute_python": {
      return { execution_result: await executePythonCode(args.code as string, args.purpose as string) }
    }

    case "generate_dynamic_ui": {
      return {
        ui_component: {
          componentType: args.componentType,
          title: args.title,
          data: args.data,
          insight: args.insight || null
        },
        render_instruction: "FRONTEND_RENDER"
      }
    }

    case "get_market_pulse": {
      const dataType = args.data_type as string
      const limit = Math.min((args.limit as number) || 10, 20)
      
      if (!FMP_API_KEY) {
        return { error: 'FMP API key not configured' }
      }
      
      const result: Record<string, unknown> = {
        as_of: new Date().toISOString().split('T')[0],
        data_type: dataType
      }
      
      try {
        if (dataType === 'overview' || dataType === 'sectors') {
          // Get sector performance
          const sectorUrl = `https://financialmodelingprep.com/api/v3/sector-performance?apikey=${FMP_API_KEY}`
          const sectorRes = await fetch(sectorUrl)
          if (sectorRes.ok) {
            const sectorData = await sectorRes.json()
            result.sectors = sectorData.map((s: Record<string, unknown>) => ({
              sector: s.sector,
              change: s.changesPercentage
            }))
          }
        }
        
        if (dataType === 'overview' || dataType === 'gainers') {
          // Get top gainers
          const gainersUrl = `https://financialmodelingprep.com/api/v3/stock_market/gainers?apikey=${FMP_API_KEY}`
          const gainersRes = await fetch(gainersUrl)
          if (gainersRes.ok) {
            const gainersData = await gainersRes.json()
            result.gainers = gainersData.slice(0, limit).map((g: Record<string, unknown>) => ({
              symbol: g.symbol,
              name: g.name,
              price: g.price,
              change: g.changesPercentage ? `${(g.changesPercentage as number).toFixed(2)}%` : null
            }))
          }
        }
        
        if (dataType === 'overview' || dataType === 'losers') {
          // Get top losers
          const losersUrl = `https://financialmodelingprep.com/api/v3/stock_market/losers?apikey=${FMP_API_KEY}`
          const losersRes = await fetch(losersUrl)
          if (losersRes.ok) {
            const losersData = await losersRes.json()
            result.losers = losersData.slice(0, limit).map((l: Record<string, unknown>) => ({
              symbol: l.symbol,
              name: l.name,
              price: l.price,
              change: l.changesPercentage ? `${(l.changesPercentage as number).toFixed(2)}%` : null
            }))
          }
        }
        
        if (dataType === 'overview' || dataType === 'actives') {
          // Get most active
          const activesUrl = `https://financialmodelingprep.com/api/v3/stock_market/actives?apikey=${FMP_API_KEY}`
          const activesRes = await fetch(activesUrl)
          if (activesRes.ok) {
            const activesData = await activesRes.json()
            result.most_active = activesData.slice(0, limit).map((a: Record<string, unknown>) => ({
              symbol: a.symbol,
              name: a.name,
              price: a.price,
              change: a.changesPercentage ? `${(a.changesPercentage as number).toFixed(2)}%` : null,
              volume: a.volume
            }))
          }
        }
        
        return result
      } catch (error) {
        return { error: `Failed to fetch market data: ${error}` }
      }
    }

    case "get_financial_calendar": {
      const calendarType = args.calendar_type as string
      const symbol = args.symbol as string | undefined
      const daysAhead = Math.min((args.days_ahead as number) || 7, 30)
      
      if (!FMP_API_KEY) {
        return { error: 'FMP API key not configured' }
      }
      
      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + daysAhead)
      
      const fromStr = today.toISOString().split('T')[0]
      const toStr = endDate.toISOString().split('T')[0]
      
      const result: Record<string, unknown> = {
        from: fromStr,
        to: toStr,
        calendar_type: calendarType
      }
      
      try {
        if (calendarType === 'earnings' || calendarType === 'both') {
          let earningsUrl: string
          if (symbol) {
            // Get specific company earnings
            earningsUrl = `https://financialmodelingprep.com/api/v3/historical/earning_calendar/${symbol.toUpperCase()}?apikey=${FMP_API_KEY}`
          } else {
            // Get all upcoming earnings
            earningsUrl = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${fromStr}&to=${toStr}&apikey=${FMP_API_KEY}`
          }
          
          const earningsRes = await fetch(earningsUrl)
          if (earningsRes.ok) {
            const earningsData = await earningsRes.json()
            result.earnings = earningsData.slice(0, 20).map((e: Record<string, unknown>) => ({
              symbol: e.symbol,
              date: e.date,
              time: e.time || 'TBD',
              eps_estimate: e.epsEstimated,
              revenue_estimate: e.revenueEstimated
            }))
          }
        }
        
        if (calendarType === 'economic' || calendarType === 'both') {
          // Get economic calendar
          const econUrl = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${fromStr}&to=${toStr}&apikey=${FMP_API_KEY}`
          const econRes = await fetch(econUrl)
          if (econRes.ok) {
            const econData = await econRes.json()
            // Filter to major events
            const majorEvents = econData.filter((e: Record<string, unknown>) => 
              e.impact === 'High' || e.impact === 'Medium' ||
              (e.event as string)?.includes('CPI') ||
              (e.event as string)?.includes('Fed') ||
              (e.event as string)?.includes('GDP') ||
              (e.event as string)?.includes('Employment') ||
              (e.event as string)?.includes('Payroll')
            )
            result.economic_events = majorEvents.slice(0, 15).map((e: Record<string, unknown>) => ({
              date: e.date,
              event: e.event,
              country: e.country,
              impact: e.impact,
              previous: e.previous,
              estimate: e.estimate
            }))
          }
        }
        
        return result
      } catch (error) {
        return { error: `Failed to fetch calendar data: ${error}` }
      }
    }

    case "create_and_export_document": {
      const title = args.title as string
      const documentType = args.document_type as string
      const content = args.content as string
      const exportFormat = args.export_format as string
      
      try {
        // For global chat, we don't have an asset_id, so we store in a general location
        const timestamp = Date.now()
        const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')
        const fileName = `${safeTitle}_${timestamp}.md`
        const storagePath = `global_chat_exports/${fileName}`
        
        // Upload to Supabase storage
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('asset-files')
          .upload(storagePath, new Blob([content], { type: 'text/markdown' }), {
            contentType: 'text/markdown',
            upsert: true
          })
        
        if (uploadError) {
          console.error('Storage upload error:', uploadError)
        }
        
        // Get public URL if upload succeeded
        let markdownUrl: string | null = null
        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('asset-files')
            .getPublicUrl(storagePath)
          markdownUrl = urlData?.publicUrl || null
        }
        
        return {
          document_created: {
            success: true,
            title,
            document_type: documentType,
            markdown_url: markdownUrl,
            message: `Document "${title}" created successfully. The user can download it as ${exportFormat === 'both' ? 'Markdown or PDF' : exportFormat}.`
          },
          download_data: {
            title,
            content,
            markdown_url: markdownUrl,
            export_format: exportFormat
          }
        }
      } catch (error) {
        console.error('Document creation error:', error)
        return {
          document_created: {
            success: true,
            title,
            document_type: documentType,
            message: `Document "${title}" created. Download available.`
          },
          download_data: {
            title,
            content,
            export_format: exportFormat
          }
        }
      }
    }

    default:
      return { error: `Unknown function: ${name}` }
  }
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  
  return `You are **Stratos Brain**, an autonomous financial research engine.
**Mission:** Answer the user's question accurately, concisely, and with data.
**Role:** You are a "High-Speed Research Desk," not a "Portfolio Manager." Do not offer unsolicited advice or macro lectures unless the user explicitly asks for an opinion/thesis.

## Tool Routing Logic (Follow Strictly)
1. **Internal Data (Stock Metrics):** If asked for specific stock data (Price, P/E, Volume, Fundamentals) -> Use \`get_asset_fundamentals\`, \`screen_assets\`, \`get_price_history\`, or \`get_market_pulse\`.
2. **External World (Everything Else):** For ANY question requiring knowledge outside your database -> Use \`perform_grounded_research\`.
   - This includes: "Why is X moving?", "What is the history of Y?", "How does Z work?", "Explain the Fed's policy", "What happened in Iran?"
   - Treat this tool as your "General Knowledge" module.
   - If you don't know the answer, DO NOT guess. Call \`perform_grounded_research\`.
3. **Hybrid Queries:** If asked "How does the Iran news affect NVDA?" -> Use \`perform_grounded_research\` FIRST to understand the news, THEN use \`get_asset_fundamentals\` to check the company's exposure.
4. **Calendar Events:** If asked "When does X report earnings?" -> Use \`get_financial_calendar\`.
5. **Document Export (CRITICAL):** If user mentions "PDF", "document", "report", "download", "downloadable", "export", "save" -> You MUST call \`create_and_export_document\` as your FINAL tool call after gathering data. This is the ONLY way the user can download anything.

## Available Tools
- **screen_assets**: Filter stocks/crypto by fundamentals, technicals, AI scores
- **search_assets**: Find specific companies or cryptocurrencies by name
- **get_asset_fundamentals**: Deep dive into any company's financials
- **get_price_history**: Historical price data for charting and analysis
- **get_technical_indicators**: RSI, MACD, moving averages, and more
- **get_macro_context**: Market regime, rates, inflation, sector rotation
- **get_institutional_flows**: 13F data showing what smart money is doing
- **get_market_pulse**: Today's market action - gainers, losers, sector performance
- **get_financial_calendar**: Earnings dates, economic calendar events
- **perform_grounded_research**: Universal Search - use for ANY external knowledge (news, history, explanations, analysis, general knowledge)
- **execute_python**: Run calculations and data analysis
- **generate_dynamic_ui**: Create tables and charts for visualization
- **create_and_export_document**: When users ask to CREATE, EXPORT, SAVE, or DOWNLOAD a document/report, use this to generate a downloadable file

## PROTOCOL - Follow This Order:
1. **Reason First**: Before answering, analyze the user's intent. Are they asking for data (use database tools), current events (use grounded research), or a downloadable file (use document export)?
2. **Data First**: For market data, use \`get_market_pulse\`, \`get_macro_context\`, \`screen_assets\`.
3. **External Knowledge**: For news, events, or explanations, use \`perform_grounded_research\`.
4. **Accurate Math**: For calculations, use \`execute_python\`.
5. **Visualizations**: Use \`generate_dynamic_ui\` for tables and charts.
6. **Document Export**: When users explicitly ask to CREATE, EXPORT, SAVE, or DOWNLOAD a document, report, or analysis, use \`create_and_export_document\` to save it. This gives them download buttons for Markdown and PDF. Keywords that trigger this: "create a document", "export this", "save as PDF", "download", "downloadable", "make a report I can save".

## Response Guidelines
- For **external knowledge queries**: Present the full response from \`perform_grounded_research\`. Do NOT over-summarize - the user wants depth.
- For **hybrid queries** (news + market impact): First explain the situation thoroughly, THEN layer on market data.
- For **data queries**: Be concise and lead with the answer.

## Constraints
- **Date Awareness:** Today is ${today}.
- **Data First:** Never hallucinate numbers. Use \`execute_python\` for math.
- **Visuals:** Use \`generate_dynamic_ui\` for any list > 3 items.

## Tone
Professional, objective, data-rich. For news/geopolitical questions, be comprehensive and journalistic. For data questions, be concise and lead with the answer.`
}

// ============================================================================
// GEMINI API INTEGRATION
// ============================================================================

async function callGeminiWithTools(
  messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  logTool?: (toolName: string, status: 'started' | 'completed' | 'failed') => Promise<void>
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  groundingMetadata: unknown | null;
}> {
  const toolCalls: unknown[] = []
  const codeExecutions: unknown[] = []
  let groundingMetadata: unknown | null = null
  
  const requestBody = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    tools: [{ functionDeclarations: unifiedFunctionDeclarations }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      candidateCount: 1
    }
  }
  
  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 500)}`)
  }
  
  let data = await response.json()
  let candidate = data.candidates?.[0]
  
  // Capture grounding metadata from the first response (citations from Google Search)
  if (candidate?.groundingMetadata) {
    groundingMetadata = candidate.groundingMetadata
  }
  
  const maxIterations = 10
  let iteration = 0
  
  while (candidate && iteration < maxIterations) {
    const content = candidate.content
    const functionCallParts = content?.parts?.filter((p: { functionCall?: unknown }) => p.functionCall) || []
    
    if (functionCallParts.length === 0) break
    
    const functionResponses: Array<{ functionResponse: { name: string; response: unknown } }> = []
    
    for (const part of functionCallParts) {
      const fc = part.functionCall as { name: string; args: Record<string, unknown> }
      console.log(`Executing function: ${fc.name}`)
      
      if (logTool) {
        await logTool(fc.name, 'started').catch(e => console.error('Failed to log tool start:', e))
      }
      
      const result = await executeFunctionCall(fc, supabase)
      
      if (logTool) {
        await logTool(fc.name, (result as { error?: string }).error ? 'failed' : 'completed').catch(e => console.error('Failed to log tool completion:', e))
      }
      
      if (fc.name === 'execute_python') {
        codeExecutions.push({ code: fc.args.code, purpose: fc.args.purpose, result })
      } else {
        toolCalls.push({ name: fc.name, args: fc.args, result })
      }
      
      functionResponses.push({ functionResponse: { name: fc.name, response: result } })
    }
    
    messages.push({ role: 'model', parts: content.parts })
    messages.push({ role: 'function', parts: functionResponses })
    
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, contents: messages })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${response.status}`)
    }
    
    data = await response.json()
    candidate = data.candidates?.[0]
    iteration++
  }
  
  const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || []
  const responseText = textParts.map((p: { text: string }) => p.text).join('\n')
  
  // Also capture grounding metadata from final response if not already captured
  if (!groundingMetadata && candidate?.groundingMetadata) {
    groundingMetadata = candidate.groundingMetadata
  }
  
  return {
    response: responseText || 'I apologize, but I was unable to generate a response.',
    toolCalls,
    codeExecutions,
    groundingMetadata
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/global-chat-api/, '') || '/'
  const userId = req.headers.get('x-user-id')

  try {
    // GET /chats - List all brain chats
    if (req.method === 'GET' && path === '/chats') {
      let query = supabase
        .from('brain_chats')
        .select('*')
        .eq('status', 'active')
        .order('last_message_at', { ascending: false, nullsFirst: false })
      
      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`)
      }
      
      const { data, error } = await query
      if (error) throw error
      
      return new Response(JSON.stringify({ chats: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /chats - Create new brain chat
    if (req.method === 'POST' && path === '/chats') {
      const body = await req.json()
      const title = body.title || 'New Chat'
      
      const { data: chat, error } = await supabase
        .from('brain_chats')
        .insert({
          title,
          user_id: userId || null,
          status: 'active'
        })
        .select()
        .single()
      
      if (error) throw error
      
      return new Response(JSON.stringify(chat), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /chats/:chatId - Get chat details
    const chatMatch = path.match(/^\/chats\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && chatMatch) {
      const chatId = chatMatch[1]
      
      const { data: chat, error } = await supabase
        .from('brain_chats')
        .select('*')
        .eq('chat_id', chatId)
        .single()
      
      if (error || !chat) {
        return new Response(JSON.stringify({ error: 'Chat not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(chat), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /chats/:chatId - Delete chat
    const deleteMatch = path.match(/^\/chats\/([a-f0-9-]+)$/)
    if (req.method === 'DELETE' && deleteMatch) {
      const chatId = deleteMatch[1]
      
      const { error } = await supabase
        .from('brain_chats')
        .update({ status: 'archived' })
        .eq('chat_id', chatId)
      
      if (error) throw error
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /chats/:chatId/messages - Get messages
    const messagesMatch = path.match(/^\/chats\/([a-f0-9-]+)\/messages$/)
    if (req.method === 'GET' && messagesMatch) {
      const chatId = messagesMatch[1]
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      const { data: messages, error } = await supabase
        .from('brain_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('sequence_num', { ascending: true })
        .limit(limit)
      
      if (error) throw error
      
      return new Response(JSON.stringify({ messages: messages || [], total: messages?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /chats/:chatId/messages - Send message (async job-based)
    const sendMatch = path.match(/^\/chats\/([a-f0-9-]+)\/messages$/)
    if (req.method === 'POST' && sendMatch) {
      const chatId = sendMatch[1]
      const body = await req.json()
      const { content } = body
      
      if (!content) {
        return new Response(JSON.stringify({ error: 'content is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Verify chat exists
      const { data: chat, error: chatError } = await supabase
        .from('brain_chats')
        .select('*')
        .eq('chat_id', chatId)
        .single()
      
      if (chatError || !chat) {
        return new Response(JSON.stringify({ error: 'Chat not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Create job
      const { data: job, error: jobError } = await supabase
        .from('brain_jobs')
        .insert({
          chat_id: chatId,
          user_message: content,
          status: 'pending'
        })
        .select()
        .single()
      
      if (jobError) throw jobError
      
      const jobId = job.id
      
      // Helper to update job
      const updateJob = async (status: string, updates: Record<string, unknown> = {}) => {
        await supabase
          .from('brain_jobs')
          .update({ status, updated_at: new Date().toISOString(), ...updates })
          .eq('id', jobId)
      }
      
      // Helper to log tool calls
      const logTool = async (toolName: string, status: 'started' | 'completed' | 'failed') => {
        const { data: currentJob } = await supabase
          .from('brain_jobs')
          .select('tool_calls')
          .eq('id', jobId)
          .single()
        
        const toolCalls = currentJob?.tool_calls || []
        toolCalls.push({
          tool_name: toolName,
          status,
          timestamp: new Date().toISOString()
        })
        
        await supabase
          .from('brain_jobs')
          .update({ tool_calls: toolCalls, updated_at: new Date().toISOString() })
          .eq('id', jobId)
      }
      
      // Background task
      async function runAnalysisTask() {
        try {
          await updateJob('processing')
          
          // Get sequence number
          const { data: lastMessage } = await supabase
            .from('brain_messages')
            .select('sequence_num')
            .eq('chat_id', chatId)
            .order('sequence_num', { ascending: false })
            .limit(1)
            .single()
          
          const nextSeq = (lastMessage?.sequence_num || 0) + 1
          
          // Save user message
          await supabase
            .from('brain_messages')
            .insert({
              chat_id: chatId,
              sequence_num: nextSeq,
              role: 'user',
              content: content
            })
          
          // Build conversation history
          const { data: history } = await supabase
            .from('brain_messages')
            .select('role, content')
            .eq('chat_id', chatId)
            .order('sequence_num', { ascending: true })
            .limit(50)
          
          const geminiMessages: Array<{ role: string; parts: Array<{ text?: string }> }> = []
          for (const msg of history || []) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              geminiMessages.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content || '' }]
              })
            }
          }
          
          // Call Gemini
          const systemPrompt = buildSystemPrompt()
          const startTime = Date.now()
          const geminiResult = await callGeminiWithTools(geminiMessages, systemPrompt, supabase, logTool)
          const latencyMs = Date.now() - startTime
          
          // Save assistant message
          const { data: assistantMessage } = await supabase
            .from('brain_messages')
            .insert({
              chat_id: chatId,
              sequence_num: nextSeq + 1,
              role: 'assistant',
              content: geminiResult.response,
              tool_calls: geminiResult.toolCalls.length > 0 ? geminiResult.toolCalls : null,
              grounding_metadata: geminiResult.groundingMetadata,
              model: GEMINI_MODEL,
              latency_ms: latencyMs
            })
            .select()
            .single()
          
          // Update chat title if first message
          if (nextSeq === 1) {
            // Generate title from first message
            const title = content.length > 50 ? content.substring(0, 47) + '...' : content
            await supabase
              .from('brain_chats')
              .update({ title, last_message_at: new Date().toISOString() })
              .eq('chat_id', chatId)
          } else {
            await supabase
              .from('brain_chats')
              .update({ last_message_at: new Date().toISOString() })
              .eq('chat_id', chatId)
          }
          
          await updateJob('completed', {
            completed_at: new Date().toISOString(),
            result: { message_id: assistantMessage?.message_id }
          })
          
        } catch (err) {
          console.error('Background task failed:', err)
          await updateJob('failed', {
            error_message: err instanceof Error ? err.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
        }
      }
      
      // Fire and forget
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(runAnalysisTask())
      } else {
        runAnalysisTask().catch(err => console.error('Background task error:', err))
      }
      
      return new Response(JSON.stringify({
        job_id: jobId,
        status: 'pending',
        message: 'Analysis started in background'
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /jobs/:jobId - Get job status
    const jobMatch = path.match(/^\/jobs\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && jobMatch) {
      const jobId = jobMatch[1]
      
      const { data: job, error } = await supabase
        .from('brain_jobs')
        .select('*')
        .eq('id', jobId)
        .single()
      
      if (error || !job) {
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(job), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /chats/:chatId/messages - Clear messages
    const clearMatch = path.match(/^\/chats\/([a-f0-9-]+)\/messages$/)
    if (req.method === 'DELETE' && clearMatch) {
      const chatId = clearMatch[1]
      
      const { error } = await supabase
        .from('brain_messages')
        .delete()
        .eq('chat_id', chatId)
      
      if (error) throw error
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

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
  // Screen assets across the entire database
  {
    name: "screen_assets",
    description: "Screen and filter assets (equities or crypto) based on various criteria. Returns a list of matching assets with key metrics. Use this to find stocks/crypto matching specific criteria like 'tech stocks with >20% revenue growth' or 'crypto with market cap over $1B'.",
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
          description: "Filter by sector (e.g., 'Technology', 'Healthcare', 'Financial Services'). Only applies to equities."
        },
        industry: {
          type: "string",
          description: "Filter by industry (e.g., 'Software', 'Semiconductors'). Only applies to equities."
        },
        min_market_cap: {
          type: "number",
          description: "Minimum market cap in billions USD (e.g., 10 for $10B+)"
        },
        max_market_cap: {
          type: "number",
          description: "Maximum market cap in billions USD"
        },
        min_pe_ratio: {
          type: "number",
          description: "Minimum P/E ratio"
        },
        max_pe_ratio: {
          type: "number",
          description: "Maximum P/E ratio"
        },
        min_revenue_growth: {
          type: "number",
          description: "Minimum revenue growth rate as decimal (e.g., 0.20 for 20%+)"
        },
        min_ai_score: {
          type: "number",
          description: "Minimum AI composite score (0-100)"
        },
        min_return_1m: {
          type: "number",
          description: "Minimum 1-month return as decimal (e.g., 0.10 for 10%+)"
        },
        max_return_1m: {
          type: "number",
          description: "Maximum 1-month return as decimal"
        },
        sort_by: {
          type: "string",
          enum: ["market_cap", "ai_score", "return_1m", "return_3m", "pe_ratio", "revenue_growth"],
          description: "Field to sort results by"
        },
        sort_order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order: 'asc' for ascending, 'desc' for descending"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 20, max 50)"
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
  // Web search
  {
    name: "web_search",
    description: "Search the web for current news, research, and information. Use this for recent events, news, or information not in the database.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
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
  }
]

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

// Web search using Google Custom Search API
async function executeWebSearch(query: string): Promise<unknown> {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
    return {
      query,
      error: 'Web search not configured',
      timestamp: new Date().toISOString()
    }
  }

  try {
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1')
    searchUrl.searchParams.set('key', GOOGLE_SEARCH_API_KEY)
    searchUrl.searchParams.set('cx', GOOGLE_SEARCH_CX)
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('num', '10')

    const response = await fetch(searchUrl.toString())
    if (!response.ok) {
      return { query, error: `Search API error: ${response.status}`, timestamp: new Date().toISOString() }
    }

    const data = await response.json()
    const results = (data.items || []).map((item: { title: string; link: string; snippet: string; displayLink?: string }) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: item.displayLink || new URL(item.link).hostname
    }))

    return {
      query,
      total_results: data.searchInformation?.totalResults || results.length,
      results,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
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
      const assetType = args.asset_type as string
      const limit = Math.min((args.limit as number) || 20, 50)
      
      // Build query based on asset type
      if (assetType === 'equity' || assetType === 'all') {
        let query = supabase
          .from('equity_metadata')
          .select('symbol, company_name, sector, industry, market_cap, pe_ratio, revenue_growth_yoy, ai_score')
        
        if (args.sector) query = query.eq('sector', args.sector)
        if (args.industry) query = query.eq('industry', args.industry)
        if (args.min_market_cap) query = query.gte('market_cap', (args.min_market_cap as number) * 1e9)
        if (args.max_market_cap) query = query.lte('market_cap', (args.max_market_cap as number) * 1e9)
        if (args.min_pe_ratio) query = query.gte('pe_ratio', args.min_pe_ratio)
        if (args.max_pe_ratio) query = query.lte('pe_ratio', args.max_pe_ratio)
        if (args.min_revenue_growth) query = query.gte('revenue_growth_yoy', args.min_revenue_growth)
        if (args.min_ai_score) query = query.gte('ai_score', args.min_ai_score)
        
        // Sort
        const sortBy = args.sort_by as string || 'market_cap'
        const sortOrder = args.sort_order === 'asc' ? true : false
        query = query.order(sortBy, { ascending: sortOrder, nullsFirst: false })
        query = query.limit(limit)
        
        const { data, error } = await query
        if (error) return { error: error.message }
        
        return {
          asset_type: assetType,
          count: data?.length || 0,
          assets: data?.map(d => ({
            symbol: d.symbol,
            name: d.company_name,
            sector: d.sector,
            industry: d.industry,
            market_cap_b: d.market_cap ? (d.market_cap / 1e9).toFixed(1) + 'B' : null,
            pe_ratio: d.pe_ratio?.toFixed(1),
            revenue_growth: d.revenue_growth_yoy ? (d.revenue_growth_yoy * 100).toFixed(1) + '%' : null,
            ai_score: d.ai_score
          })) || []
        }
      }
      
      if (assetType === 'crypto') {
        let query = supabase
          .from('crypto_metadata')
          .select('symbol, name, market_cap, price, change_24h, volume_24h')
        
        if (args.min_market_cap) query = query.gte('market_cap', (args.min_market_cap as number) * 1e9)
        if (args.max_market_cap) query = query.lte('market_cap', (args.max_market_cap as number) * 1e9)
        
        query = query.order('market_cap', { ascending: false, nullsFirst: false })
        query = query.limit(limit)
        
        const { data, error } = await query
        if (error) return { error: error.message }
        
        return {
          asset_type: 'crypto',
          count: data?.length || 0,
          assets: data?.map(d => ({
            symbol: d.symbol,
            name: d.name,
            market_cap_b: d.market_cap ? (d.market_cap / 1e9).toFixed(1) + 'B' : null,
            price: d.price,
            change_24h: d.change_24h ? (d.change_24h * 100).toFixed(2) + '%' : null
          })) || []
        }
      }
      
      return { error: 'Invalid asset_type' }
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
      
      const quarters: Array<{year: number, quarter: number}> = []
      let year = 2024
      let quarter = 3
      
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

    case "web_search": {
      return await executeWebSearch(args.query as string)
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

    default:
      return { error: `Unknown function: ${name}` }
  }
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  
  return `You are **Stratos Brain**, an autonomous Chief Investment Officer AI assistant. You help users analyze markets, screen for investment opportunities, and build investment theses.

## Your Capabilities
You have access to powerful tools:
- **screen_assets**: Filter the entire universe of stocks and crypto by any criteria
- **search_assets**: Find specific companies or cryptocurrencies
- **get_asset_fundamentals**: Deep dive into any company's financials
- **get_price_history**: Historical price data for charting and analysis
- **get_technical_indicators**: RSI, MACD, moving averages, and more
- **get_macro_context**: Current market regime, rates, inflation, sector rotation
- **get_institutional_flows**: 13F data showing what smart money is doing
- **web_search**: Current news and research from the web
- **execute_python**: Run calculations and data analysis
- **generate_dynamic_ui**: Create tables and charts for visualization

## Core Principles

### 1. MACRO FIRST
Before recommending ANY investment, ALWAYS check the macro environment using \`get_macro_context\`. You cannot recommend a stock without knowing if the market environment supports it.

### 2. FOLLOW THE SMART MONEY
For any stock recommendation, check institutional flows using \`get_institutional_flows\`. Avoid value traps where fundamentals look good but institutions are selling.

### 3. DATA-DRIVEN RESPONSES
Always use your tools to fetch real data. Never make up numbers. If you don't have data, say so.

### 4. VISUAL PRESENTATION
Use \`generate_dynamic_ui\` to present data in tables and charts. Don't use markdown tables - use the DataTable component instead.

## Today's Date
${today}

## Response Style
- Be direct and actionable
- Lead with the key insight
- Support with data
- Acknowledge risks and uncertainties
- Use visualizations for complex data`
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
}> {
  const toolCalls: unknown[] = []
  const codeExecutions: unknown[] = []
  
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
  
  return {
    response: responseText || 'I apologize, but I was unable to generate a response.',
    toolCalls,
    codeExecutions
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

  // Verify API key
  const stratosKey = req.headers.get('x-stratos-key')
  if (stratosKey !== 'stratos-internal-key-2024') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
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

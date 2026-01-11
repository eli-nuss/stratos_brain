// Company Chat API - Manus-style chat interface for company research
// Supports Gemini 3 Pro with unified function calling approach
// Search and code execution are wrapped as functions to avoid tool conflicts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview' // Using Gemini 3 Pro as requested

// Google Custom Search API configuration
const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY') || ''
const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX') || ''

// Unified function declarations - includes DB access, search, and code execution as functions
const unifiedFunctionDeclarations = [
  // Database functions
  {
    name: "get_asset_fundamentals",
    description: "Get financial fundamentals for a company including revenue, earnings, margins, valuation ratios, and other key metrics. Use this to understand the company's financial health and valuation.",
    parameters: {
      type: "object",
      properties: {
        symbol: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'GOOGL')" 
        }
      },
      required: ["symbol"]
    }
  },
  {
    name: "get_price_history",
    description: "Get historical OHLCV (Open, High, Low, Close, Volume) price data for an asset. Returns daily bars for the specified number of days.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID" 
        },
        days: { 
          type: "number", 
          description: "Number of days of history to retrieve (max 365)" 
        }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "get_technical_indicators",
    description: "Get current technical indicators and features for an asset including RSI, MACD, moving averages, Bollinger Bands, volume analysis, and trend regime.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID" 
        },
        as_of_date: { 
          type: "string", 
          description: "Date in YYYY-MM-DD format (defaults to latest)" 
        }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "get_active_signals",
    description: "Get active trading signals for an asset. Signals indicate potential trading opportunities based on technical patterns, momentum, and other factors.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID" 
        },
        as_of_date: { 
          type: "string", 
          description: "Date in YYYY-MM-DD format (defaults to latest)" 
        }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "get_ai_reviews",
    description: "Get previous AI analysis reviews for an asset. These contain detailed analysis including direction, setup type, entry/exit levels, and risk assessment.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID" 
        },
        limit: { 
          type: "number", 
          description: "Number of reviews to retrieve (default 5)" 
        }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "get_sector_comparison",
    description: "Compare an asset's performance against its sector/category peers. Returns relative performance metrics.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { 
          type: "number", 
          description: "The internal asset ID" 
        },
        as_of_date: { 
          type: "string", 
          description: "Date in YYYY-MM-DD format" 
        }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "search_assets",
    description: "Search for assets by symbol or name. Use this to find asset IDs for other function calls.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Search query (symbol or company name)" 
        },
        asset_type: { 
          type: "string", 
          description: "Filter by asset type: 'equity' or 'crypto'" 
        }
      },
      required: ["query"]
    }
  },
  // Document retrieval function - for SEC filings and earnings transcripts
  {
    name: "get_company_docs",
    description: "Retrieves FULL text of SEC filings (10-K annual reports, 10-Q quarterly reports) or Earnings Call Transcripts. Use this for deep dives, risk analysis, finding specific quotes from management, understanding business strategy, or any question that requires reading the actual source documents. This is your primary tool for fundamental research.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'GOOGL')" 
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
      required: ["ticker", "doc_type"]
    }
  },
  // Web search function wrapper
  {
    name: "web_search",
    description: "Search the web for current information about a company, news, market conditions, or any topic. Use this for real-time information not in the database.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "The search query to find information about" 
        }
      },
      required: ["query"]
    }
  },
  // Python code execution function wrapper
  {
    name: "execute_python",
    description: "Execute Python code for data analysis, calculations, or creating visualizations. The code runs in a sandboxed environment with numpy, pandas, and matplotlib available. Use this for complex calculations, statistical analysis, or generating charts.",
    parameters: {
      type: "object",
      properties: {
        code: { 
          type: "string", 
          description: "Python code to execute. Must be valid Python 3 code. Use print() to output results." 
        },
        purpose: {
          type: "string",
          description: "Brief description of what the code does"
        }
      },
      required: ["code", "purpose"]
    }
  },
  // NEW TIER 1 TOOLS - Track topic trends across earnings transcripts
  {
    name: "track_topic_trend",
    description: "Search for how often a specific topic, keyword, or phrase is mentioned across a company's earnings call transcripts over multiple quarters. Use this to identify thematic momentum, strategic pivots, or emerging concerns (e.g., 'How many times was AI mentioned in the last 8 quarters?').",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'NVDA')" 
        },
        search_term: { 
          type: "string", 
          description: "The keyword or phrase to search for (e.g., 'artificial intelligence', 'supply chain', 'margin expansion')" 
        },
        quarters_back: { 
          type: "number", 
          description: "Number of quarters to search (default 8, max 16)" 
        }
      },
      required: ["ticker", "search_term"]
    }
  },
  // Analyze management tone changes across earnings calls
  {
    name: "analyze_management_tone",
    description: "Compare the sentiment and linguistic patterns of a company's recent earnings call against previous calls. Detects shifts in management confidence, uncertainty language ('hopefully' vs 'we will'), and overall tone changes that may precede financial performance changes.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'NVDA')" 
        },
        quarters_to_compare: { 
          type: "number", 
          description: "Number of recent quarters to analyze (default 4, max 8)" 
        }
      },
      required: ["ticker"]
    }
  },
  // Run standardized valuation models
  {
    name: "run_valuation_model",
    description: "Run a standardized DCF (Discounted Cash Flow) or Comparable Company valuation model using the company's actual financial data. Returns fair value estimates with different assumption scenarios. Use this instead of ad-hoc calculations for professional-grade valuations.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'NVDA')" 
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
      required: ["ticker", "model_type"]
    }
  },
  // Generate scenario/sensitivity analysis matrix
  {
    name: "generate_scenario_matrix",
    description: "Generate a sensitivity analysis table showing how key metrics (EPS, fair value, etc.) change under different scenarios. Essential for Bull Case vs Bear Case analysis and stress testing investment theses.",
    parameters: {
      type: "object",
      properties: {
        ticker: { 
          type: "string", 
          description: "The stock ticker symbol (e.g., 'AAPL', 'NVDA')" 
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
      required: ["ticker", "metric", "variable_1", "variable_2"]
    }
  },
  // Generative UI function - renders visual components in the chat
  {
    name: "generate_dynamic_ui",
    description: "Renders a visual UI component in the chat. Use this when the user asks for comparisons, trends, financial charts, data tables, or any visual representation of data. DO NOT use markdown tables - use this tool instead for better visualization. CRITICAL: Before calling this tool, use execute_python to calculate any derived values to ensure accuracy.",
    parameters: {
      type: "object",
      properties: {
        componentType: { 
          type: "string", 
          enum: ["FinancialChart", "MetricCard", "RiskGauge", "DataTable", "ComparisonChart"],
          description: "The type of React component to render. FinancialChart for line/bar charts, MetricCard for key stats, RiskGauge for risk indicators, DataTable for tabular data, ComparisonChart for side-by-side comparisons." 
        },
        title: { 
          type: "string", 
          description: "The title of the chart/card/table. Include the unit in the title (e.g., '($ Billions)' or '(%)')." 
        },
        data: { 
          type: "object", 
          description: "STRICT JSON data. IMPORTANT UNIT RULES: 1) ALL 'value' fields MUST use the SAME unit type - either all raw numbers OR all percentages, NEVER mix. 2) For dollar amounts in billions, pass raw numbers (e.g., 15.7 not 15700000000) and indicate unit in title. 3) For percentages, pass as decimals 0-100 (e.g., 12 for 12%). 4) For ComparisonChart showing percentages, values must sum to 100. Schemas: FinancialChart: {type: 'line'|'bar', metric: string, points: [{label: string, value: number}]}. MetricCard: {metrics: [{label: string, value: string, trend: number}]}. DataTable: {headers: string[], rows: string[][]}. ComparisonChart: {items: [{name: string, value: number}]} where values are percentages summing to 100." 
        },
        insight: { 
          type: "string", 
          description: "A one-sentence analyst takeaway to display below the visualization." 
        }
      },
      required: ["componentType", "title", "data"]
    }
  }
]

// Execute web search using Google Custom Search API
async function executeWebSearch(query: string): Promise<unknown> {
  // Check if API credentials are configured
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
    console.warn('Google Search API not configured - missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX')
    return {
      query: query,
      error: 'Web search not configured. Please set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX environment variables.',
      timestamp: new Date().toISOString()
    }
  }

  try {
    // Build the Google Custom Search API URL
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1')
    searchUrl.searchParams.set('key', GOOGLE_SEARCH_API_KEY)
    searchUrl.searchParams.set('cx', GOOGLE_SEARCH_CX)
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('num', '10') // Return up to 10 results

    console.log(`Executing web search for: "${query}"`)

    const response = await fetch(searchUrl.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Search API error:', errorText)
      return {
        query: query,
        error: `Search API error: ${response.status} - ${errorText}`,
        timestamp: new Date().toISOString()
      }
    }

    const data = await response.json()

    // Extract and format search results
    const results = (data.items || []).map((item: { title: string; link: string; snippet: string; displayLink?: string }) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: item.displayLink || new URL(item.link).hostname
    }))

    return {
      query: query,
      total_results: data.searchInformation?.totalResults || results.length,
      results: results,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    console.error('Web search error:', error)
    return {
      query: query,
      error: error instanceof Error ? error.message : 'Unknown error during web search',
      timestamp: new Date().toISOString()
    }
  }
}

// E2B API configuration for sandboxed code execution
const E2B_API_KEY = Deno.env.get('E2B_API_KEY') || ''
const E2B_API_URL = 'https://api.e2b.dev'

// Execute Python code using E2B sandboxed environment
async function executePythonCode(code: string, purpose: string): Promise<unknown> {
  if (!E2B_API_KEY) {
    return {
      success: false,
      purpose: purpose,
      code: code,
      output: null,
      error: "E2B API key not configured. Please set E2B_API_KEY environment variable."
    }
  }

  try {
    // Step 1: Create a new sandbox
    const createResponse = await fetch(`${E2B_API_URL}/sandboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: 'code-interpreter-v1',
        timeoutMs: 60000, // 60 second timeout
      }),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      return {
        success: false,
        purpose: purpose,
        code: code,
        output: null,
        error: `Failed to create E2B sandbox: ${createResponse.status} - ${errorText}`
      }
    }

    const sandbox = await createResponse.json()
    const sandboxId = sandbox.sandboxID || sandbox.sandboxId || sandbox.id
    
    if (!sandboxId) {
      return {
        success: false,
        purpose: purpose,
        code: code,
        output: null,
        error: `Failed to get sandbox ID from response: ${JSON.stringify(sandbox)}`
      }
    }

    // Step 2: Execute code in the sandbox
    // The sandbox runs a Jupyter server that we can POST code to
    // Port 49999 is encoded in the subdomain, not as an actual port
    const executeUrl = `https://49999-${sandboxId}.e2b.dev/execute`
    const accessToken = sandbox.envdAccessToken || ''
    
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': accessToken,
      },
      body: JSON.stringify({
        code: code,
        language: 'python',
      }),
    })

    let executionResult: { stdout: string[]; stderr: string[]; error?: string } = {
      stdout: [],
      stderr: [],
    }

    if (executeResponse.ok) {
      // Parse streaming response
      const responseText = await executeResponse.text()
      const lines = responseText.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'stdout' && parsed.text) {
            executionResult.stdout.push(parsed.text)
          } else if (parsed.type === 'stderr' && parsed.text) {
            executionResult.stderr.push(parsed.text)
          } else if (parsed.error) {
            executionResult.error = parsed.error
          }
        } catch {
          // If not JSON, treat as raw output
          if (line.trim()) {
            executionResult.stdout.push(line)
          }
        }
      }
    } else {
      executionResult.error = `Execution failed: ${executeResponse.status}`
    }

    // Step 3: Kill the sandbox to clean up
    try {
      await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': E2B_API_KEY,
        },
      })
    } catch {
      // Ignore cleanup errors - sandbox will timeout anyway
    }

    // Return results
    const output = executionResult.stdout.join('')
    const errorOutput = executionResult.stderr.join('')
    
    if (executionResult.error) {
      return {
        success: false,
        purpose: purpose,
        code: code,
        output: output || null,
        error: executionResult.error + (errorOutput ? `\n${errorOutput}` : '')
      }
    }

    return {
      success: true,
      purpose: purpose,
      code: code,
      output: output || '(No output)',
      error: errorOutput || null
    }

  } catch (error) {
    return {
      success: false,
      purpose: purpose,
      code: code,
      output: null,
      error: error instanceof Error ? error.message : "Unknown error during E2B execution"
    }
  }
}

// Execute function calls against Supabase or external services
async function executeFunctionCall(
  functionCall: { name: string; args: Record<string, unknown> },
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, unknown>> { // Enforce Object return type for Gemini API
  const { name, args } = functionCall
  
  switch (name) {
    case "get_asset_fundamentals": {
      const { data, error } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', args.symbol)
        .single()
      
      if (error) return { error: error.message }
      // Wrap in object for Gemini API compatibility
      return { fundamentals: data }
    }
    
    case "get_price_history": {
      const days = Math.min(args.days as number || 90, 365)
      const { data, error } = await supabase
        .from('daily_bars')
        .select('date, open, high, low, close, volume')
        .eq('asset_id', args.asset_id)
        .order('date', { ascending: false })
        .limit(days)
      
      if (error) return { error: error.message }
      // Wrap array in object for Gemini API compatibility
      return { bars: data?.reverse() || [], count: data?.length || 0 }
    }
    
    case "get_technical_indicators": {
      const targetDate = args.as_of_date || new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('daily_features')
        .select('*')
        .eq('asset_id', args.asset_id)
        .lte('date', targetDate)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      
      if (error) return { error: error.message }
      // Wrap in object for Gemini API compatibility
      return { indicators: data, as_of_date: targetDate }
    }
    
    case "get_active_signals": {
      const targetDate = args.as_of_date || new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('daily_signal_facts')
        .select('signal_type, direction, strength, evidence')
        .eq('asset_id', args.asset_id)
        .eq('date', targetDate)
        .order('strength', { ascending: false })
      
      if (error) return { error: error.message }
      // Wrap array in object for Gemini API compatibility
      return { signals: data || [], count: data?.length || 0, as_of_date: targetDate }
    }
    
    case "get_ai_reviews": {
      const limit = args.limit as number || 5
      const { data, error } = await supabase
        .from('asset_ai_reviews')
        .select('*')
        .eq('asset_id', args.asset_id)
        .order('as_of_date', { ascending: false })
        .limit(limit)
      
      if (error) return { error: error.message }
      // Wrap array in object for Gemini API compatibility
      return { reviews: data || [], count: data?.length || 0 }
    }
    
    case "get_sector_comparison": {
      const targetDate = args.as_of_date || new Date().toISOString().split('T')[0]
      
      // Get the asset's type
      const { data: asset } = await supabase
        .from('assets')
        .select('asset_type')
        .eq('asset_id', args.asset_id)
        .single()
      
      if (!asset) return { error: 'Asset not found' }
      
      // Get sector assets
      const { data: sectorAssets } = await supabase
        .from('assets')
        .select('asset_id')
        .eq('asset_type', asset.asset_type)
        .eq('is_active', true)
        .limit(500)
      
      const sectorAssetIds = sectorAssets?.map(a => a.asset_id) || []
      
      // Get features for sector
      const { data: sectorStats } = await supabase
        .from('daily_features')
        .select('return_1d, return_5d, return_21d')
        .eq('date', targetDate)
        .in('asset_id', sectorAssetIds)
      
      if (!sectorStats || sectorStats.length === 0) {
        return { error: 'No sector data available' }
      }
      
      // Get asset's own features
      const { data: assetFeatures } = await supabase
        .from('daily_features')
        .select('return_1d, return_5d, return_21d')
        .eq('asset_id', args.asset_id)
        .eq('date', targetDate)
        .single()
      
      const avgReturn1d = sectorStats.reduce((sum, s) => sum + (s.return_1d || 0), 0) / sectorStats.length
      const avgReturn5d = sectorStats.reduce((sum, s) => sum + (s.return_5d || 0), 0) / sectorStats.length
      const avgReturn21d = sectorStats.reduce((sum, s) => sum + (s.return_21d || 0), 0) / sectorStats.length
      
      return {
        asset_type: asset.asset_type,
        assets_in_sector: sectorStats.length,
        sector_avg_return_1d: (avgReturn1d * 100).toFixed(2) + '%',
        sector_avg_return_5d: (avgReturn5d * 100).toFixed(2) + '%',
        sector_avg_return_21d: (avgReturn21d * 100).toFixed(2) + '%',
        asset_return_1d: assetFeatures ? (assetFeatures.return_1d * 100).toFixed(2) + '%' : null,
        asset_return_5d: assetFeatures ? (assetFeatures.return_5d * 100).toFixed(2) + '%' : null,
        asset_vs_sector_1d: assetFeatures ? ((assetFeatures.return_1d - avgReturn1d) * 100).toFixed(2) + '%' : null
      }
    }
    
    case "search_assets": {
      let query = supabase
        .from('assets')
        .select('asset_id, symbol, name, asset_type, sector, industry')
        .eq('is_active', true)
        .or(`symbol.ilike.%${args.query}%,name.ilike.%${args.query}%`)
        .limit(10)
      
      if (args.asset_type) {
        query = query.eq('asset_type', args.asset_type)
      }
      
      const { data, error } = await query
      
      if (error) return { error: error.message }
      // Wrap array in object for Gemini API compatibility
      return { assets: data || [], count: data?.length || 0, query: args.query }
    }
    
    case "get_company_docs": {
      const ticker = (args.ticker as string).toUpperCase()
      const docType = args.doc_type as string
      const yearsBack = Math.min(args.years_back as number || 1, 3)
      
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setFullYear(startDate.getFullYear() - yearsBack)
      
      // Query company_documents table
      const { data: documents, error } = await supabase
        .from('company_documents')
        .select('id, ticker, doc_type, filing_date, fiscal_year, fiscal_quarter, title, full_text, word_count')
        .eq('ticker', ticker)
        .eq('doc_type', docType)
        .eq('status', 'active')
        .gte('filing_date', startDate.toISOString().split('T')[0])
        .order('filing_date', { ascending: false })
        .limit(yearsBack * (docType === '10-K' ? 1 : 4)) // 1 per year for 10-K, 4 per year for 10-Q/transcripts
      
      if (error) {
        return { error: error.message }
      }
      
      if (!documents || documents.length === 0) {
        return { 
          error: `No ${docType} documents found for ${ticker}. The documents may not have been ingested yet. Try using web_search as a fallback.`,
          ticker,
          doc_type: docType,
          suggestion: 'Use web_search to find this information online'
        }
      }
      
      // AGGRESSIVE TRUNCATION for memory-constrained Edge Function environment
      // 256MB limit is tight. A 10-K is ~2MB text but creates ~10MB+ in V8 string memory.
      const MAX_CHARS_PER_DOC = 100000 // ~25k tokens - enough for analysis but prevents crash
      const MAX_TOTAL_CHARS = 150000 // Total limit across all docs
      
      let totalChars = 0
      let wasTruncated = false
      
      const processedDocs = documents.map(d => {
        let text = d.full_text || ''
        const originalLength = text.length
        
        // Check total limit first
        if (totalChars >= MAX_TOTAL_CHARS) {
          text = '[DOCUMENT OMITTED - Memory limit reached. Ask for this document separately.]'
          wasTruncated = true
        }
        // Check per-document limit
        else if (text.length > MAX_CHARS_PER_DOC) {
          text = text.substring(0, MAX_CHARS_PER_DOC) + '\n\n[DOCUMENT TRUNCATED - ' + (originalLength - MAX_CHARS_PER_DOC) + ' chars omitted. Ask for specific sections if needed.]'
          wasTruncated = true
          console.log(`⚠️ Document truncated: ${d.title} (${originalLength} -> ${MAX_CHARS_PER_DOC} chars)`)
        }
        // Check if this would exceed total limit
        else if (totalChars + text.length > MAX_TOTAL_CHARS) {
          const remainingChars = MAX_TOTAL_CHARS - totalChars
          text = text.substring(0, remainingChars) + '\n\n[DOCUMENT TRUNCATED - Memory limit reached.]'
          wasTruncated = true
        }
        
        totalChars += text.length
        
        // Return processed doc - original full_text is not referenced to help GC
        return {
          title: d.title,
          filing_date: d.filing_date,
          fiscal_year: d.fiscal_year,
          fiscal_quarter: d.fiscal_quarter,
          word_count: d.word_count,
          content: text // Use 'content' instead of 'full_text' to avoid confusion
        }
      })
      
      // Nullify the original documents array to help garbage collection
      // @ts-ignore - intentional GC hint
      documents.length = 0
      
      // Return processed documents
      const result = {
        ticker,
        doc_type: docType,
        documents_found: processedDocs.length,
        total_chars_returned: totalChars,
        truncation_applied: wasTruncated,
        memory_note: wasTruncated ? 'Some documents were truncated for memory efficiency. Ask for specific sections if you need more detail.' : null,
        documents: processedDocs
      }
      
      return result
    }
    
    case "web_search": {
      const result = await executeWebSearch(args.query as string)
      // Wrap in object for Gemini API compatibility
      return { search_output: result }
    }
    
    case "execute_python": {
      const MAX_RETRIES = 2
      let attempts = 0
      let lastResult = null
      let currentCode = args.code as string
      const purpose = args.purpose as string
      
      while (attempts < MAX_RETRIES) {
        attempts++
        const result = await executePythonCode(currentCode, purpose)
        lastResult = result
        
        if (result.success) {
          // Code executed successfully
          console.log(`✅ Python execution succeeded on attempt ${attempts}`)
          return { execution_result: result }
        } else {
          // Code failed - provide detailed error feedback for Gemini to fix
          console.log(`⚠️ Python execution attempt ${attempts} failed: ${result.error}`)
          
          if (attempts < MAX_RETRIES) {
            // Return error with fix instructions - Gemini will auto-retry
            return {
              execution_result: {
                success: false,
                purpose: purpose,
                code: currentCode,
                output: null,
                error: result.error,
                fix_instruction: `ERROR: The Python code failed to execute. Error message: ${result.error}. Please examine your code, fix the syntax or logic error, and call execute_python again with the corrected code.`,
                attempt: attempts,
                max_retries: MAX_RETRIES
              }
            }
          }
        }
      }
      
      // All retries exhausted - return final error
      console.log(`❌ Python execution failed after ${MAX_RETRIES} attempts`)
      return {
        execution_result: {
          success: false,
          purpose: purpose,
          code: currentCode,
          output: null,
          error: lastResult?.error || 'Unknown error after max retries',
          final_failure: true,
          attempts_made: attempts
        }
      }
    }
    
    case "generate_dynamic_ui": {
      // This is a special tool - we don't execute it server-side
      // Instead, we pass the args directly back to the frontend for rendering
      // The frontend will use GenerativeUIRenderer to display the component
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
    
    // NEW TIER 1 TOOL IMPLEMENTATIONS
    
    case "track_topic_trend": {
      const ticker = (args.ticker as string).toUpperCase()
      const searchTerm = (args.search_term as string).toLowerCase()
      const quartersBack = Math.min(args.quarters_back as number || 8, 16)
      
      // Get transcripts for the ticker
      const { data: transcripts, error } = await supabase
        .from('company_documents')
        .select('fiscal_year, fiscal_quarter, filing_date, full_text, title')
        .eq('ticker', ticker)
        .eq('doc_type', 'transcript')
        .eq('status', 'active')
        .order('filing_date', { ascending: false })
        .limit(quartersBack)
      
      if (error) return { error: error.message }
      
      if (!transcripts || transcripts.length === 0) {
        return {
          error: `No earnings transcripts found for ${ticker}`,
          ticker,
          search_term: searchTerm
        }
      }
      
      // Count mentions in each transcript
      const results = transcripts.map(t => {
        const text = (t.full_text || '').toLowerCase()
        // Count occurrences (case-insensitive)
        const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        const matches = text.match(regex) || []
        const count = matches.length
        
        // Extract sample contexts (first 3 mentions with surrounding text)
        const contexts: string[] = []
        let match
        const contextRegex = new RegExp(`.{0,100}${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,100}`, 'gi')
        let contextMatch
        let contextCount = 0
        while ((contextMatch = contextRegex.exec(text)) !== null && contextCount < 3) {
          contexts.push('...' + contextMatch[0].trim() + '...')
          contextCount++
        }
        
        return {
          quarter: `Q${t.fiscal_quarter} ${t.fiscal_year}`,
          filing_date: t.filing_date,
          mention_count: count,
          sample_contexts: contexts
        }
      })
      
      // Calculate trend statistics
      const counts = results.map(r => r.mention_count)
      const avgMentions = counts.reduce((a, b) => a + b, 0) / counts.length
      const recentAvg = counts.slice(0, Math.min(2, counts.length)).reduce((a, b) => a + b, 0) / Math.min(2, counts.length)
      const olderAvg = counts.slice(-Math.min(2, counts.length)).reduce((a, b) => a + b, 0) / Math.min(2, counts.length)
      const trendDirection = recentAvg > olderAvg * 1.2 ? 'INCREASING' : recentAvg < olderAvg * 0.8 ? 'DECREASING' : 'STABLE'
      
      return {
        ticker,
        search_term: searchTerm,
        quarters_analyzed: results.length,
        trend_direction: trendDirection,
        average_mentions_per_quarter: avgMentions.toFixed(1),
        recent_vs_older_ratio: olderAvg > 0 ? (recentAvg / olderAvg).toFixed(2) : 'N/A',
        quarterly_breakdown: results,
        insight: `"${searchTerm}" was mentioned an average of ${avgMentions.toFixed(1)} times per quarter. Trend is ${trendDirection}.`
      }
    }
    
    case "analyze_management_tone": {
      const ticker = (args.ticker as string).toUpperCase()
      const quartersToCompare = Math.min(args.quarters_to_compare as number || 4, 8)
      
      // Get recent transcripts
      const { data: transcripts, error } = await supabase
        .from('company_documents')
        .select('fiscal_year, fiscal_quarter, filing_date, full_text, title')
        .eq('ticker', ticker)
        .eq('doc_type', 'transcript')
        .eq('status', 'active')
        .order('filing_date', { ascending: false })
        .limit(quartersToCompare)
      
      if (error) return { error: error.message }
      
      if (!transcripts || transcripts.length < 2) {
        return {
          error: `Need at least 2 transcripts for tone comparison. Found ${transcripts?.length || 0} for ${ticker}`,
          ticker
        }
      }
      
      // Linguistic analysis patterns
      const uncertaintyWords = ['hopefully', 'might', 'maybe', 'uncertain', 'challenging', 'difficult', 'concerned', 'worried', 'cautious', 'headwinds']
      const confidenceWords = ['confident', 'strong', 'excellent', 'outstanding', 'record', 'momentum', 'accelerating', 'excited', 'optimistic', 'committed']
      const forwardLookingPositive = ['will deliver', 'will achieve', 'expect to grow', 'on track', 'well positioned']
      const forwardLookingNegative = ['hope to', 'trying to', 'working on', 'attempting']
      
      const analyzeText = (text: string) => {
        const lowerText = text.toLowerCase()
        const wordCount = text.split(/\s+/).length
        
        const countMatches = (patterns: string[]) => 
          patterns.reduce((sum, p) => sum + (lowerText.match(new RegExp(p, 'gi')) || []).length, 0)
        
        return {
          word_count: wordCount,
          uncertainty_score: countMatches(uncertaintyWords),
          confidence_score: countMatches(confidenceWords),
          forward_positive: countMatches(forwardLookingPositive),
          forward_negative: countMatches(forwardLookingNegative),
          // Normalized per 1000 words
          uncertainty_per_1k: (countMatches(uncertaintyWords) / wordCount * 1000).toFixed(2),
          confidence_per_1k: (countMatches(confidenceWords) / wordCount * 1000).toFixed(2)
        }
      }
      
      const analyses = transcripts.map(t => {
        // Format fiscal year as 2-digit (e.g., 2026 -> FY26)
        const fyShort = String(t.fiscal_year).slice(-2)
        return {
          quarter: `Q${t.fiscal_quarter} FY${fyShort}`,
          earnings_call_date: t.filing_date,
          fiscal_year: t.fiscal_year,
          fiscal_quarter: t.fiscal_quarter,
          ...analyzeText(t.full_text || '')
        }
      })
      
      // Compare most recent to average of others
      const mostRecent = analyses[0]
      const previousAvg = {
        uncertainty_per_1k: analyses.slice(1).reduce((s, a) => s + parseFloat(a.uncertainty_per_1k), 0) / (analyses.length - 1),
        confidence_per_1k: analyses.slice(1).reduce((s, a) => s + parseFloat(a.confidence_per_1k), 0) / (analyses.length - 1)
      }
      
      const uncertaintyChange = ((parseFloat(mostRecent.uncertainty_per_1k) - previousAvg.uncertainty_per_1k) / previousAvg.uncertainty_per_1k * 100).toFixed(1)
      const confidenceChange = ((parseFloat(mostRecent.confidence_per_1k) - previousAvg.confidence_per_1k) / previousAvg.confidence_per_1k * 100).toFixed(1)
      
      let toneShift = 'NEUTRAL'
      if (parseFloat(confidenceChange) > 15 && parseFloat(uncertaintyChange) < -10) toneShift = 'MORE CONFIDENT'
      else if (parseFloat(uncertaintyChange) > 15 && parseFloat(confidenceChange) < -10) toneShift = 'MORE CAUTIOUS'
      else if (parseFloat(confidenceChange) > 10) toneShift = 'SLIGHTLY MORE CONFIDENT'
      else if (parseFloat(uncertaintyChange) > 10) toneShift = 'SLIGHTLY MORE CAUTIOUS'
      
      return {
        ticker,
        quarters_analyzed: analyses.length,
        tone_shift: toneShift,
        most_recent_quarter: mostRecent.quarter,
        confidence_change_pct: confidenceChange + '%',
        uncertainty_change_pct: uncertaintyChange + '%',
        quarterly_analysis: analyses,
        methodology: 'Linguistic pattern analysis comparing frequency of confidence vs uncertainty language per 1000 words',
        insight: `Management tone in ${mostRecent.quarter} is ${toneShift} compared to previous ${analyses.length - 1} quarters. Confidence language ${parseFloat(confidenceChange) > 0 ? 'up' : 'down'} ${Math.abs(parseFloat(confidenceChange))}%, uncertainty language ${parseFloat(uncertaintyChange) > 0 ? 'up' : 'down'} ${Math.abs(parseFloat(uncertaintyChange))}%.`
      }
    }
    
    case "run_valuation_model": {
      const ticker = (args.ticker as string).toUpperCase()
      const modelType = args.model_type as string
      const customGrowthRate = args.growth_rate as number | undefined
      const discountRate = (args.discount_rate as number) || 0.10
      const terminalGrowth = (args.terminal_growth as number) || 0.025
      
      // Get fundamental data
      const { data: metadata, error: metaError } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', ticker)
        .single()
      
      if (metaError || !metadata) {
        return { error: `Could not find fundamental data for ${ticker}` }
      }
      
      // Get quarterly financials for historical growth (including EBITDA/EBIT for D&A calculation)
      const { data: quarterlies, error: qError } = await supabase
        .from('equity_quarterly_fundamentals')
        .select('fiscal_date_ending, total_revenue, net_income, free_cash_flow, operating_cashflow, eps_diluted, ebitda, ebit, capital_expenditures')
        .eq('asset_id', metadata.asset_id)
        .order('fiscal_date_ending', { ascending: false })
        .limit(8)
      
      // Get current price
      const { data: latestBar } = await supabase
        .from('daily_bars')
        .select('close')
        .eq('asset_id', metadata.asset_id)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      
      const currentPrice = latestBar?.close || 0
      const sharesOutstanding = metadata.shares_outstanding || 0
      const marketCap = currentPrice * sharesOutstanding
      
      // Calculate historical growth rate if not provided
      let growthRate = customGrowthRate
      if (!growthRate && quarterlies && quarterlies.length >= 4) {
        const recentRevenue = quarterlies.slice(0, 4).reduce((s, q) => s + (q.total_revenue || 0), 0)
        const olderRevenue = quarterlies.slice(4, 8).reduce((s, q) => s + (q.total_revenue || 0), 0)
        if (olderRevenue > 0) {
          growthRate = (recentRevenue - olderRevenue) / olderRevenue
        }
      }
      growthRate = growthRate || 0.05 // Default 5%
      
      const results: Record<string, unknown> = {
        ticker,
        current_price: currentPrice.toFixed(2),
        market_cap_billions: (marketCap / 1e9).toFixed(2),
        shares_outstanding_millions: (sharesOutstanding / 1e6).toFixed(1),
        assumptions: {
          growth_rate: (growthRate * 100).toFixed(1) + '%',
          discount_rate: (discountRate * 100).toFixed(1) + '%',
          terminal_growth: (terminalGrowth * 100).toFixed(1) + '%'
        }
      }
      
      // DCF Model with Owner Earnings Auto-Detection
      if (modelType === 'dcf' || modelType === 'both') {
        // Calculate TTM metrics
        const ttmOCF = quarterlies?.slice(0, 4).reduce((s, q) => s + (q.operating_cashflow || 0), 0) || 0
        const ttmCapex = Math.abs(quarterlies?.slice(0, 4).reduce((s, q) => s + (q.capital_expenditures || 0), 0) || 0)
        // D&A = EBITDA - EBIT (proxy for depreciation & amortization)
        const ttmDA = quarterlies?.slice(0, 4).reduce((s, q) => s + ((q.ebitda || 0) - (q.ebit || 0)), 0) || 0
        
        // Standard FCF calculation
        const standardFCF = ttmOCF - ttmCapex
        
        // Owner Earnings calculation (Buffett method)
        // Maintenance CapEx ≈ D&A, so Owner Earnings = OCF - D&A
        const ownerEarnings = ttmOCF - Math.abs(ttmDA)
        
        // Auto-detect high-growth companies: if CapEx > 150% of D&A, use Owner Earnings
        const capexToDA = ttmDA > 0 ? ttmCapex / ttmDA : 0
        const isHighGrowthReinvestor = capexToDA > 1.5
        
        // Choose the appropriate FCF metric
        const usedFCF = isHighGrowthReinvestor ? ownerEarnings : standardFCF
        const methodUsed = isHighGrowthReinvestor ? 'Owner Earnings (Adj. for Growth CapEx)' : 'Standard Unlevered FCF'
        
        // Project 5 years of FCF
        let projectedFCFs = []
        let fcf = usedFCF
        for (let i = 1; i <= 5; i++) {
          fcf = fcf * (1 + growthRate)
          projectedFCFs.push(fcf)
        }
        
        // Calculate terminal value
        const terminalFCF = projectedFCFs[4] * (1 + terminalGrowth)
        const terminalValue = terminalFCF / (discountRate - terminalGrowth)
        
        // Discount all cash flows
        let pvFCFs = 0
        for (let i = 0; i < 5; i++) {
          pvFCFs += projectedFCFs[i] / Math.pow(1 + discountRate, i + 1)
        }
        const pvTerminal = terminalValue / Math.pow(1 + discountRate, 5)
        
        const enterpriseValue = pvFCFs + pvTerminal
        const equityValue = enterpriseValue // Simplified - should subtract net debt
        const fairValuePerShare = equityValue / sharesOutstanding
        const upside = ((fairValuePerShare - currentPrice) / currentPrice * 100)
        
        // Also calculate what standard FCF would have given (for comparison)
        const standardFairValue = isHighGrowthReinvestor ? (() => {
          let stdFcf = standardFCF
          let stdProjected = []
          for (let i = 1; i <= 5; i++) {
            stdFcf = stdFcf * (1 + growthRate)
            stdProjected.push(stdFcf)
          }
          const stdTerminal = (stdProjected[4] * (1 + terminalGrowth)) / (discountRate - terminalGrowth)
          let stdPV = 0
          for (let i = 0; i < 5; i++) {
            stdPV += stdProjected[i] / Math.pow(1 + discountRate, i + 1)
          }
          return (stdPV + stdTerminal / Math.pow(1 + discountRate, 5)) / sharesOutstanding
        })() : null
        
        results.dcf_model = {
          methodology: methodUsed,
          ttm_operating_cash_flow_millions: (ttmOCF / 1e6).toFixed(1),
          ttm_capex_millions: (ttmCapex / 1e6).toFixed(1),
          ttm_depreciation_amortization_millions: (Math.abs(ttmDA) / 1e6).toFixed(1),
          capex_to_da_ratio: capexToDA.toFixed(2) + 'x',
          adjustment_note: isHighGrowthReinvestor 
            ? `Switched to Owner Earnings because CapEx (${(ttmCapex/1e9).toFixed(1)}B) is ${capexToDA.toFixed(1)}x D&A (${(Math.abs(ttmDA)/1e9).toFixed(1)}B). This avoids penalizing growth investments.`
            : 'Standard FCF used (CapEx is within normal maintenance range).',
          starting_cash_flow_millions: (usedFCF / 1e6).toFixed(1),
          projected_fcf_year5_millions: (projectedFCFs[4] / 1e6).toFixed(1),
          terminal_value_billions: (terminalValue / 1e9).toFixed(2),
          enterprise_value_billions: (enterpriseValue / 1e9).toFixed(2),
          fair_value_per_share: fairValuePerShare.toFixed(2),
          standard_fcf_fair_value: standardFairValue ? standardFairValue.toFixed(2) : null,
          upside_downside_pct: upside.toFixed(1) + '%',
          verdict: upside > 20 ? 'UNDERVALUED' : upside < -20 ? 'OVERVALUED' : 'FAIRLY VALUED'
        }
      }
      
      // Comps Model
      if (modelType === 'comps' || modelType === 'both') {
        const pe = metadata.pe_ratio || metadata.trailing_pe
        const ps = metadata.price_to_sales_ttm
        const evEbitda = metadata.ev_to_ebitda
        
        // Industry average multiples (simplified - would ideally pull from sector peers)
        const industryPE = 20
        const industryPS = 3
        const industryEVEBITDA = 12
        
        const peImpliedValue = pe ? currentPrice * (industryPE / pe) : null
        const psImpliedValue = ps ? currentPrice * (industryPS / ps) : null
        const evImpliedValue = evEbitda ? currentPrice * (industryEVEBITDA / evEbitda) : null
        
        const validValues = [peImpliedValue, psImpliedValue, evImpliedValue].filter(v => v !== null) as number[]
        const avgImpliedValue = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null
        
        results.comps_model = {
          current_pe: pe?.toFixed(1) || 'N/A',
          current_ps: ps?.toFixed(2) || 'N/A',
          current_ev_ebitda: evEbitda?.toFixed(1) || 'N/A',
          industry_avg_pe: industryPE,
          industry_avg_ps: industryPS,
          industry_avg_ev_ebitda: industryEVEBITDA,
          pe_implied_value: peImpliedValue?.toFixed(2) || 'N/A',
          ps_implied_value: psImpliedValue?.toFixed(2) || 'N/A',
          ev_ebitda_implied_value: evImpliedValue?.toFixed(2) || 'N/A',
          average_implied_value: avgImpliedValue?.toFixed(2) || 'N/A',
          upside_downside_pct: avgImpliedValue ? ((avgImpliedValue - currentPrice) / currentPrice * 100).toFixed(1) + '%' : 'N/A'
        }
      }
      
      return results
    }
    
    case "generate_scenario_matrix": {
      const ticker = (args.ticker as string).toUpperCase()
      const metric = args.metric as string
      const variable1 = args.variable_1 as string
      const variable2 = args.variable_2 as string
      const rangePct = (args.range_pct as number) || 20
      
      // Get fundamental data
      const { data: metadata, error: metaError } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', ticker)
        .single()
      
      if (metaError || !metadata) {
        return { error: `Could not find fundamental data for ${ticker}` }
      }
      
      // Get quarterly financials
      const { data: quarterlies } = await supabase
        .from('equity_quarterly_fundamentals')
        .select('total_revenue, net_income, free_cash_flow, eps_diluted')
        .eq('asset_id', metadata.asset_id)
        .order('fiscal_date_ending', { ascending: false })
        .limit(4)
      
      // Get current price
      const { data: latestBar } = await supabase
        .from('daily_bars')
        .select('close')
        .eq('asset_id', metadata.asset_id)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      
      const currentPrice = latestBar?.close || 0
      const sharesOutstanding = metadata.shares_outstanding || 1
      
      // Calculate base values
      const ttmRevenue = quarterlies?.reduce((s, q) => s + (q.total_revenue || 0), 0) || 0
      const ttmNetIncome = quarterlies?.reduce((s, q) => s + (q.net_income || 0), 0) || 0
      const ttmFCF = quarterlies?.reduce((s, q) => s + (q.free_cash_flow || 0), 0) || 0
      const ttmEPS = quarterlies?.reduce((s, q) => s + (q.eps_diluted || 0), 0) || 0
      const currentMargin = ttmRevenue > 0 ? ttmNetIncome / ttmRevenue : 0.1
      const currentMultiple = metadata.pe_ratio || 20
      
      // Generate range values (-rangePct to +rangePct in 5 steps)
      const steps = [-rangePct, -rangePct/2, 0, rangePct/2, rangePct]
      
      const getBaseValue = (variable: string) => {
        switch (variable) {
          case 'revenue_growth': return 0.10 // 10% base growth
          case 'margin': return currentMargin
          case 'multiple': return currentMultiple
          case 'discount_rate': return 0.10
          default: return 0.10
        }
      }
      
      const formatLabel = (variable: string, pctChange: number) => {
        const base = getBaseValue(variable)
        const adjusted = base * (1 + pctChange / 100)
        switch (variable) {
          case 'revenue_growth': return (adjusted * 100).toFixed(0) + '%'
          case 'margin': return (adjusted * 100).toFixed(1) + '%'
          case 'multiple': return adjusted.toFixed(1) + 'x'
          case 'discount_rate': return (adjusted * 100).toFixed(1) + '%'
          default: return adjusted.toFixed(2)
        }
      }
      
      const calculateMetric = (v1Pct: number, v2Pct: number) => {
        const v1Base = getBaseValue(variable1)
        const v2Base = getBaseValue(variable2)
        const v1Adj = v1Base * (1 + v1Pct / 100)
        const v2Adj = v2Base * (1 + v2Pct / 100)
        
        // Simplified calculation based on metric type
        let result = 0
        switch (metric) {
          case 'eps':
            // EPS = Revenue * (1+growth) * margin / shares
            const growth = variable1 === 'revenue_growth' ? v1Adj : (variable2 === 'revenue_growth' ? v2Adj : 0.10)
            const margin = variable1 === 'margin' ? v1Adj : (variable2 === 'margin' ? v2Adj : currentMargin)
            result = ttmRevenue * (1 + growth) * margin / sharesOutstanding
            return '$' + result.toFixed(2)
          case 'fair_value':
            // Fair Value = EPS * Multiple
            const eps = ttmEPS || ttmNetIncome / sharesOutstanding
            const multiple = variable1 === 'multiple' ? v1Adj : (variable2 === 'multiple' ? v2Adj : currentMultiple)
            const growthAdj = variable1 === 'revenue_growth' ? v1Adj : (variable2 === 'revenue_growth' ? v2Adj : 0.10)
            result = eps * (1 + growthAdj) * multiple
            return '$' + result.toFixed(2)
          case 'revenue':
            const revGrowth = variable1 === 'revenue_growth' ? v1Adj : (variable2 === 'revenue_growth' ? v2Adj : 0.10)
            result = ttmRevenue * (1 + revGrowth) / 1e9
            return '$' + result.toFixed(1) + 'B'
          case 'fcf':
            const fcfGrowth = variable1 === 'revenue_growth' ? v1Adj : (variable2 === 'revenue_growth' ? v2Adj : 0.10)
            const fcfMargin = variable1 === 'margin' ? v1Adj : (variable2 === 'margin' ? v2Adj : currentMargin)
            result = ttmRevenue * (1 + fcfGrowth) * fcfMargin * 0.8 / 1e9 // 80% FCF conversion
            return '$' + result.toFixed(1) + 'B'
          default:
            return 'N/A'
        }
      }
      
      // Build the matrix
      const headers = ['', ...steps.map(s => formatLabel(variable2, s))]
      const rows = steps.map(v1Pct => [
        formatLabel(variable1, v1Pct),
        ...steps.map(v2Pct => calculateMetric(v1Pct, v2Pct))
      ])
      
      return {
        ticker,
        metric,
        variable_1: variable1,
        variable_2: variable2,
        current_price: '$' + currentPrice.toFixed(2),
        base_values: {
          [variable1]: formatLabel(variable1, 0),
          [variable2]: formatLabel(variable2, 0)
        },
        matrix: {
          headers,
          rows
        },
        insight: `Scenario matrix for ${ticker} ${metric.toUpperCase()} varying ${variable1} (rows) and ${variable2} (columns) by +/- ${rangePct}%`
      }
    }
    
    default:
      return { error: `Unknown function: ${name}` }
  }
}

// Chat config interface
interface ChatConfig {
  model?: string;
  temperature?: number;
  max_output_tokens?: number;
  system_prompt_intro?: string;
  grounding_rules?: string;
  role_description?: string;
  guidelines?: string;
  response_format?: string;
}

// Fetch chat config from database
async function fetchChatConfig(supabase: ReturnType<typeof createClient>): Promise<ChatConfig> {
  const { data, error } = await supabase
    .from('chat_config')
    .select('config_key, config_value')
  
  if (error) {
    console.log('Failed to fetch chat config, using defaults:', error.message)
    return {}
  }
  
  const config: ChatConfig = {}
  for (const row of data || []) {
    if (row.config_key === 'model') config.model = row.config_value
    else if (row.config_key === 'temperature') config.temperature = parseFloat(row.config_value)
    else if (row.config_key === 'max_output_tokens') config.max_output_tokens = parseInt(row.config_value)
    else if (row.config_key === 'system_prompt_intro') config.system_prompt_intro = row.config_value
    else if (row.config_key === 'grounding_rules') config.grounding_rules = row.config_value
    else if (row.config_key === 'role_description') config.role_description = row.config_value
    else if (row.config_key === 'guidelines') config.guidelines = row.config_value
    else if (row.config_key === 'response_format') config.response_format = row.config_value
  }
  
  return config
}

// Build system prompt for a company chat - Universal Analyst Protocol
function buildSystemPrompt(asset: Record<string, unknown>, contextSnapshot: Record<string, unknown> | null, chatConfig: ChatConfig = {}): string {
  const today = new Date().toISOString().split('T')[0];
  
  // Universal Analyst system prompt - prioritizes source documents and accurate calculations
  const intro = chatConfig.system_prompt_intro 
    ? chatConfig.system_prompt_intro
        .replace('{company_name}', String(asset.name))
        .replace('{symbol}', String(asset.symbol))
    : `You are Stratos, an elite autonomous financial analyst for ${asset.name} (${asset.symbol}). Your goal is accuracy, depth, and data-driven insight.`
  
  const groundingRules = chatConfig.grounding_rules
    ? chatConfig.grounding_rules
        .replace(/{asset_id}/g, String(asset.asset_id))
        .replace(/{asset_type}/g, String(asset.asset_type))
        .replace(/{today}/g, today)
    : `1. **Trust Data Over Memory**: Your internal training data is OUTDATED. The database and source documents contain the REAL-TIME truth. ALWAYS query before making claims.
2. **Source Truth Priority**: When asked about risks, strategy, management commentary, or business details, do NOT guess. Use \`get_company_docs\` to read the actual SEC filings or earnings transcripts.
3. **Zero-Math Tolerance**: You are bad at arithmetic. If the user asks for ANY calculation (growth rates, CAGR, valuation, projections, ratios), you MUST use \`execute_python\` to compute it accurately.
4. **Public Status Verification**: This asset has ID ${asset.asset_id} and Type '${asset.asset_type}'. It is ALREADY a public company/token trading on exchanges. NEVER discuss "upcoming IPOs" or "going public soon".
5. **Date Awareness**: Today is **${today}**. News older than 7 days is "History", not "News".
6. **Citation Required**: Always cite the specific document and section (e.g., '10-K 2024, Risk Factors section') when providing facts from filings.`
  
  const roleDescription = chatConfig.role_description || `You are helping a trader/investor research and analyze this company with professional-grade tools:

1. **Document Library (get_company_docs)**: Read FULL SEC filings (10-K, 10-Q) and earnings transcripts. Use this for deep dives, risk analysis, finding management quotes, or understanding business strategy.
2. **Database Functions**: Query real-time financial data, price history, technical indicators, signals, and AI reviews.
3. **Python Sandbox (execute_python)**: Execute Python code for accurate calculations, statistical analysis, forecasts, and data processing. NumPy, Pandas, and Matplotlib are available.
4. **Web Search**: Search for current news and real-time information not in the database.`
  
  const guidelines = chatConfig.guidelines
    ? chatConfig.guidelines.replace(/{asset_id}/g, String(asset.asset_id))
    : `## PROTOCOL - Follow This Order:

1. **Reason First**: Before answering, analyze the user's intent. Are they asking for facts (use docs), math (use Python), or current events (use search)?
2. **Source Documents**: For questions about risks, strategy, competitive position, or management tone → call \`get_company_docs\` FIRST.
3. **Accurate Math**: For ANY numbers, calculations, or projections → use \`execute_python\`. Show your work.
4. **Database Context**: Use asset_id ${asset.asset_id} for database functions. Query fundamentals, price history, and signals to ground your analysis.
5. **Verify Claims**: If your memory conflicts with database/document data, ALWAYS trust the source data.
6. **Transparency**: Be clear about data limitations and uncertainty. Cite your sources.
7. **Actionable Insights**: End with clear takeaways or action items when appropriate.

## MEMORY CONSTRAINT STRATEGY (CRITICAL)
You are running in a memory-constrained serverless environment. For complex multi-step queries:
- **DO NOT** chain heavy operations (get_company_docs + web_search + execute_python + generate_dynamic_ui) in a single response turn.
- **Step 1**: Fetch data (documents OR web search). Return findings to user.
- **Step 2**: If user confirms, proceed with analysis (Python calculations, charts).
- If documents are truncated, inform the user and offer to fetch specific sections.
- Prefer smaller, focused queries over massive all-in-one requests.`
  
  const responseFormat = chatConfig.response_format || `- Use markdown formatting with clear sections
- Include relevant metrics and data points with citations
- Show calculation methodology when using Python
- Provide both bullish and bearish perspectives when relevant
- Quote directly from filings when citing management commentary
- End with key takeaways or action items`
  
  return `${intro}

## CRITICAL GROUNDING RULES (READ FIRST)
${groundingRules}

## Your Tools & Capabilities
${roleDescription}

## Company Context
- **Symbol**: ${asset.symbol}
- **Name**: ${asset.name}
- **Asset Type**: ${asset.asset_type}
- **Current Status**: TRADING / PUBLIC (confirmed by presence in database)
- **Sector**: ${asset.sector || 'N/A'}
- **Industry**: ${asset.industry || 'N/A'}
- **Asset ID**: ${asset.asset_id} (use this for database queries)
- **Today's Date**: ${today}

${contextSnapshot ? `## Latest Context Snapshot (REAL-TIME DATA)
${JSON.stringify(contextSnapshot, null, 2)}` : ''}

## Analysis Protocol
${guidelines}

## Response Format
${responseFormat}`
}

// Call Gemini with unified function calling
async function callGeminiWithTools(
  messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  chatConfig: ChatConfig = {}
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  groundingMetadata: unknown | null;
}> {
  const toolCalls: unknown[] = []
  const codeExecutions: unknown[] = []
  const groundingMetadata: unknown | null = null
  
  // Use config values or defaults
  const model = chatConfig.model || GEMINI_MODEL
  const temperature = chatConfig.temperature ?? 0.7
  const maxOutputTokens = chatConfig.max_output_tokens ?? 8192
  
  console.log(`Using model: ${model}, temperature: ${temperature}, maxTokens: ${maxOutputTokens}`)
  
  // Gemini API request with unified function calling only
  const requestBody = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    tools: [
      { 
        functionDeclarations: unifiedFunctionDeclarations 
      }
    ],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxOutputTokens,
      candidateCount: 1
    }
  }
  
  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', errorText)
    console.error('Request body was:', JSON.stringify(requestBody, null, 2).substring(0, 5000))
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 500)}`)
  }
  
  let data = await response.json()
  let candidate = data.candidates?.[0]
  
  // Handle function calls in a loop
  const maxIterations = 10
  let iteration = 0
  
  while (candidate && iteration < maxIterations) {
    const content = candidate.content
    
    // Check for function calls
    const functionCallParts = content?.parts?.filter((p: { functionCall?: unknown }) => p.functionCall) || []
    
    if (functionCallParts.length === 0) {
      // No more function calls, we're done
      break
    }
    
    // Execute function calls
    const functionResponses: Array<{ functionResponse: { name: string; response: unknown } }> = []
    
    for (const part of functionCallParts) {
      const fc = part.functionCall as { name: string; args: Record<string, unknown> }
      console.log(`Executing function: ${fc.name}`)
      
      const result = await executeFunctionCall(fc, supabase)
      
      // Track tool calls and code executions separately
      if (fc.name === 'execute_python') {
        codeExecutions.push({
          code: fc.args.code,
          purpose: fc.args.purpose,
          result: result
        })
      } else {
        toolCalls.push({
          name: fc.name,
          args: fc.args,
          result: result
        })
      }
      
      functionResponses.push({
        functionResponse: {
          name: fc.name,
          response: result
        }
      })
      
      // Lightweight audit logging (verbose logging removed to save memory)
      console.log(`✓ ${fc.name} completed: ${result.error ? 'ERROR' : 'OK'}`)
    }
    
    // Add the assistant's response and function results to messages
    // IMPORTANT: Preserve the full parts array including thoughtSignature for Gemini 3 models
    // Model response logged (content truncated for memory efficiency)
    console.log(`Model response: ${content.parts?.length || 0} parts`)
    
    // Verify thoughtSignature is present in function call parts
    for (const part of content.parts || []) {
      if (part.functionCall && !part.thoughtSignature) {
        console.warn('WARNING: functionCall part is missing thoughtSignature!')
      }
    }
    
    messages.push({
      role: 'model',
      parts: content.parts
    })
    
    // Use 'function' role for tool outputs (required by Gemini API)
    messages.push({
      role: 'function',
      parts: functionResponses
    })
    
    // Call Gemini again with function results
    const followUpBody = {
      ...requestBody,
      contents: messages
    }
    console.log(`Sending follow-up request: ${messages.length} messages`)
    
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followUpBody)
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error on function response:', errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }
    
    data = await response.json()
    candidate = data.candidates?.[0]
    iteration++
  }
  
  // Extract final text response
  const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || []
  const responseText = textParts.map((p: { text: string }) => p.text).join('\n')
  
  return {
    response: responseText || 'I apologize, but I was unable to generate a response.',
    toolCalls,
    codeExecutions,
    groundingMetadata
  }
}

// Wrapper function with timeout and error handling
async function callGeminiWithToolsSafe(
  messages: Array<{ role: string; parts: Array<{ text?: string }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  chatConfig: ChatConfig = {}
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  groundingMetadata: unknown | null;
  error?: string;
}> {
  try {
    // Create a timeout promise (55 seconds to leave buffer for response)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout - the analysis took too long')), 55000)
    })
    
    // Race between the actual call and timeout
    const result = await Promise.race([
      callGeminiWithTools(messages, systemInstruction, supabase, chatConfig),
      timeoutPromise
    ])
    
    return result
  } catch (error) {
    console.error('callGeminiWithToolsSafe error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return {
      response: `I encountered an error while processing your request: ${errorMessage}. Please try again or simplify your question.`,
      toolCalls: [],
      codeExecutions: [],
      groundingMetadata: null,
      error: errorMessage
    }
  }
}

// Main server handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/company-chat-api', '')
    
    // Extract user_id from request header for user-specific chat isolation
    const userId = req.headers.get('x-user-id') || null

    // Route handling
    switch (true) {
      // GET /chats - List all company chats for the current user
      case req.method === 'GET' && path === '/chats': {
        // Build query with user_id filter if provided
        let query = supabase
          .from('company_chats')
          .select(`
            chat_id,
            asset_id,
            asset_type,
            display_name,
            status,
            last_message_at,
            created_at,
            user_id
          `)
          .eq('status', 'active')
        
        // Filter by user_id if provided, otherwise show legacy chats (null user_id)
        if (userId) {
          query = query.eq('user_id', userId)
        } else {
          query = query.is('user_id', null)
        }
        
        const { data, error } = await query.order('last_message_at', { ascending: false, nullsFirst: false })
        
        if (error) throw error
        
        // Get message counts
        const chatIds = data?.map(c => c.chat_id) || []
        const { data: messageCounts } = await supabase
          .from('chat_messages')
          .select('chat_id')
          .in('chat_id', chatIds)
        
        const countMap = new Map<string, number>()
        messageCounts?.forEach(m => {
          countMap.set(m.chat_id, (countMap.get(m.chat_id) || 0) + 1)
        })
        
        const chatsWithCounts = data?.map(chat => ({
          ...chat,
          message_count: countMap.get(chat.chat_id) || 0
        }))
        
        return new Response(JSON.stringify({ chats: chatsWithCounts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /chats - Create or get a chat for a company (user-specific)
      case req.method === 'POST' && path === '/chats': {
        const body = await req.json()
        const { asset_id, asset_type, display_name } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Check if chat already exists for this user + asset combination
        let existingChatQuery = supabase
          .from('company_chats')
          .select('*')
          .eq('asset_id', asset_id)
        
        // Filter by user_id if provided
        if (userId) {
          existingChatQuery = existingChatQuery.eq('user_id', userId)
        } else {
          existingChatQuery = existingChatQuery.is('user_id', null)
        }
        
        const { data: existingChat } = await existingChatQuery.single()
        
        if (existingChat) {
          return new Response(JSON.stringify(existingChat), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset info if not provided
        let assetInfo = { asset_type, display_name }
        if (!display_name) {
          const { data: asset } = await supabase
            .from('assets')
            .select('name, asset_type, symbol')
            .eq('asset_id', asset_id)
            .single()
          
          if (asset) {
            assetInfo = {
              asset_type: asset.asset_type,
              display_name: `${asset.name} (${asset.symbol})`
            }
          }
        }
        
        // Create new chat with user_id for user-specific isolation
        const { data: newChat, error } = await supabase
          .from('company_chats')
          .insert({
            asset_id: String(asset_id),
            asset_type: assetInfo.asset_type || 'equity',
            display_name: assetInfo.display_name || `Asset ${asset_id}`,
            user_id: userId  // Associate chat with the current user
          })
          .select()
          .single()
        
        if (error) throw error
        
        return new Response(JSON.stringify(newChat), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /chats/:chatId - Get a specific chat
      case req.method === 'GET' && /^\/chats\/[a-f0-9-]+$/.test(path): {
        const chatId = path.split('/').pop()
        
        const { data: chat, error } = await supabase
          .from('company_chats')
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

      // GET /chats/:chatId/messages - Get messages for a chat
      case req.method === 'GET' && /^\/chats\/[a-f0-9-]+\/messages$/.test(path): {
        const chatId = path.split('/')[2]
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('sequence_num', { ascending: true })
          .range(offset, offset + limit - 1)
        
        if (error) throw error
        
        // Get total count
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chatId)
        
        return new Response(JSON.stringify({
          messages: messages || [],
          total: count || 0,
          has_more: (offset + limit) < (count || 0)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /chats/:chatId/messages - Send a message and get AI response
      case req.method === 'POST' && /^\/chats\/[a-f0-9-]+\/messages$/.test(path): {
        const chatId = path.split('/')[2]
        const body = await req.json()
        const { content } = body
        
        if (!content) {
          return new Response(JSON.stringify({ error: 'content is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get chat info
        const { data: chat, error: chatError } = await supabase
          .from('company_chats')
          .select('*')
          .eq('chat_id', chatId)
          .single()
        
        if (chatError || !chat) {
          return new Response(JSON.stringify({ error: 'Chat not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset info
        const { data: asset } = await supabase
          .from('assets')
          .select('*')
          .eq('asset_id', parseInt(chat.asset_id))
          .single()
        
        if (!asset) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Fetch chat configuration from database
        const chatConfig = await fetchChatConfig(supabase)
        
        // Get current sequence number
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('sequence_num')
          .eq('chat_id', chatId)
          .order('sequence_num', { ascending: false })
          .limit(1)
          .single()
        
        const nextSeq = (lastMessage?.sequence_num || 0) + 1
        
        // Save user message
        const { data: userMessage, error: userMsgError } = await supabase
          .from('chat_messages')
          .insert({
            chat_id: chatId,
            sequence_num: nextSeq,
            role: 'user',
            content: content
          })
          .select()
          .single()
        
        if (userMsgError) throw userMsgError
        
        // Build conversation history for Gemini
        const { data: history } = await supabase
          .from('chat_messages')
          .select('role, content, tool_calls, executable_code, code_execution_result')
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
        
        // Build system prompt with config
        const systemPrompt = buildSystemPrompt(asset, chat.context_snapshot, chatConfig)
        
        // Call Gemini with tools and config (using safe wrapper with timeout)
        const startTime = Date.now()
        const geminiResult = await callGeminiWithToolsSafe(geminiMessages, systemPrompt, supabase, chatConfig)
        const latencyMs = Date.now() - startTime
        
        // Save assistant message
        const { data: assistantMessage, error: assistantMsgError } = await supabase
          .from('chat_messages')
          .insert({
            chat_id: chatId,
            sequence_num: nextSeq + 1,
            role: 'assistant',
            content: geminiResult.response,
            tool_calls: geminiResult.toolCalls.length > 0 ? geminiResult.toolCalls : null,
            executable_code: geminiResult.codeExecutions.length > 0 ? (geminiResult.codeExecutions[0] as { code?: string })?.code : null,
            code_execution_result: geminiResult.codeExecutions.length > 0 ? JSON.stringify((geminiResult.codeExecutions[0] as { result?: unknown })?.result) : null,
            grounding_metadata: geminiResult.groundingMetadata,
            model: chatConfig.model || GEMINI_MODEL,
            latency_ms: latencyMs
          })
          .select()
          .single()
        
        if (assistantMsgError) throw assistantMsgError
        
        // Update chat's last_message_at
        await supabase
          .from('company_chats')
          .update({ last_message_at: new Date().toISOString() })
          .eq('chat_id', chatId)
        
        // Save tool executions
        if (geminiResult.toolCalls.length > 0) {
          const toolExecutions = geminiResult.toolCalls.map((tc: { name: string; args: unknown; result: unknown }) => ({
            message_id: assistantMessage.message_id,
            chat_id: chatId,
            tool_type: 'function_call',
            tool_name: tc.name,
            input_data: tc.args,
            output_data: tc.result,
            status: 'success',
            completed_at: new Date().toISOString()
          }))
          
          await supabase
            .from('chat_tool_executions')
            .insert(toolExecutions)
        }
        
        // Save code executions
        if (geminiResult.codeExecutions.length > 0) {
          const codeExecutions = geminiResult.codeExecutions.map((ce: { code?: string; purpose?: string; result?: unknown }) => ({
            message_id: assistantMessage.message_id,
            chat_id: chatId,
            tool_type: 'code_execution',
            tool_name: 'execute_python',
            input_data: { code: ce.code, purpose: ce.purpose },
            output_data: ce.result,
            status: 'success',
            completed_at: new Date().toISOString()
          }))
          
          await supabase
            .from('chat_tool_executions')
            .insert(codeExecutions)
        }
        
        return new Response(JSON.stringify({
          user_message: userMessage,
          assistant_message: assistantMessage,
          tool_calls: geminiResult.toolCalls,
          code_executions: geminiResult.codeExecutions,
          grounding_metadata: geminiResult.groundingMetadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /chats/:chatId/messages - Clear all messages from a chat
      case req.method === 'DELETE' && /^\/chats\/[a-f0-9-]+\/messages$/.test(path): {
        const chatId = path.split('/')[2]
        
        // Delete all messages for this chat
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('chat_id', chatId)
        
        if (error) throw error
        
        // Update the chat's last_message_at to null and reset message_count
        await supabase
          .from('company_chats')
          .update({ 
            last_message_at: null,
            message_count: 0
          })
          .eq('chat_id', chatId)
        
        return new Response(JSON.stringify({ success: true, message: 'Chat cleared' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /chats/:chatId - Archive a chat
      case req.method === 'DELETE' && /^\/chats\/[a-f0-9-]+$/.test(path): {
        const chatId = path.split('/').pop()
        
        const { error } = await supabase
          .from('company_chats')
          .update({ status: 'archived' })
          .eq('chat_id', chatId)
        
        if (error) throw error
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /chats/:chatId/context - Refresh context snapshot
      case req.method === 'PUT' && /^\/chats\/[a-f0-9-]+\/context$/.test(path): {
        const chatId = path.split('/')[2]
        
        // Get chat info
        const { data: chat } = await supabase
          .from('company_chats')
          .select('asset_id')
          .eq('chat_id', chatId)
          .single()
        
        if (!chat) {
          return new Response(JSON.stringify({ error: 'Chat not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetId = parseInt(chat.asset_id)
        
        // Build context snapshot
        const today = new Date().toISOString().split('T')[0]
        
        const [features, signals, reviews] = await Promise.all([
          supabase
            .from('daily_features')
            .select('*')
            .eq('asset_id', assetId)
            .lte('date', today)
            .order('date', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('daily_signal_facts')
            .select('signal_type, direction, strength')
            .eq('asset_id', assetId)
            .eq('date', today)
            .order('strength', { ascending: false })
            .limit(5),
          supabase
            .from('asset_ai_reviews')
            .select('direction, setup_type, entry_zone, stop_loss, targets, risk_rating, as_of_date')
            .eq('asset_id', assetId)
            .order('as_of_date', { ascending: false })
            .limit(1)
            .single()
        ])
        
        const contextSnapshot = {
          updated_at: new Date().toISOString(),
          latest_features: features.data,
          active_signals: signals.data,
          latest_review: reviews.data
        }
        
        // Update chat with new context
        const { error } = await supabase
          .from('company_chats')
          .update({ context_snapshot: contextSnapshot })
          .eq('chat_id', chatId)
        
        if (error) throw error
        
        return new Response(JSON.stringify({ context_snapshot: contextSnapshot }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /fundamentals/:assetId - Get fundamentals for an asset (for the summary panel)
      case req.method === 'GET' && /^\/fundamentals\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop() || '0')
        const assetType = url.searchParams.get('asset_type') || 'equity'
        
        // Get asset info
        const { data: asset } = await supabase
          .from('assets')
          .select('name, symbol, asset_type, sector, industry')
          .eq('asset_id', assetId)
          .single()
        
        if (!asset) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get fundamentals from equity_metadata table
        const { data: fundamentals } = await supabase
          .from('equity_metadata')
          .select('*')
          .eq('asset_id', assetId)
          .single()
        
        // Get latest price for 52-week calculation
        const { data: priceData } = await supabase
          .from('daily_bars')
          .select('close, high, low')
          .eq('asset_id', assetId)
          .order('date', { ascending: false })
          .limit(1)
          .single()
        
        // Combine the data
        const result = {
          name: asset.name,
          symbol: asset.symbol,
          sector: asset.sector || fundamentals?.sector,
          industry: asset.industry || fundamentals?.industry,
          
          // Size & Growth
          market_cap: fundamentals?.market_cap,
          revenue_ttm: fundamentals?.revenue_ttm,
          quarterly_revenue_growth_yoy: fundamentals?.quarterly_revenue_growth_yoy,
          quarterly_earnings_growth_yoy: fundamentals?.quarterly_earnings_growth_yoy,
          eps: fundamentals?.eps,
          
          // Valuation
          pe_ratio: fundamentals?.pe_ratio,
          forward_pe: fundamentals?.forward_pe,
          peg_ratio: fundamentals?.peg_ratio,
          price_to_sales_ttm: fundamentals?.price_to_sales_ttm,
          price_to_book: fundamentals?.price_to_book,
          
          // Profitability
          profit_margin: fundamentals?.profit_margin,
          operating_margin_ttm: fundamentals?.operating_margin_ttm,
          return_on_equity_ttm: fundamentals?.return_on_equity_ttm,
          return_on_assets_ttm: fundamentals?.return_on_assets_ttm,
          
          // Other
          beta: fundamentals?.beta,
          analyst_target_price: fundamentals?.analyst_target_price,
          week_52_low: fundamentals?.week_52_low,
          week_52_high: fundamentals?.week_52_high,
          dividend_yield: fundamentals?.dividend_yield,
          current_price: priceData?.close,
          
          // Meta
          last_updated: fundamentals?.last_updated
        }
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // AI Review endpoint - GET /ai-review/:assetId
      case path.startsWith('/ai-review/'): {
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetId = path.replace('/ai-review/', '')
        if (!assetId) {
          return new Response(JSON.stringify({ error: 'Asset ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get the latest AI review for this asset
        const { data: aiReview, error: aiError } = await supabase
          .from('asset_ai_reviews')
          .select(`
            asset_id,
            as_of_date,
            direction,
            setup_type,
            ai_direction_score,
            ai_setup_quality_score,
            ai_attention_level,
            ai_confidence,
            ai_summary_text,
            ai_key_levels,
            ai_entry,
            ai_targets,
            ai_risks,
            ai_time_horizon,
            ai_what_to_watch_next,
            created_at
          `)
          .eq('asset_id', assetId)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .single()
        
        if (aiError || !aiReview) {
          return new Response(JSON.stringify({ error: 'AI review not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(aiReview), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

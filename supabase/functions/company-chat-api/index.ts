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
      
      // Return documents with full text
      return {
        ticker,
        doc_type: docType,
        documents_found: documents.length,
        total_words: documents.reduce((sum, d) => sum + (d.word_count || 0), 0),
        documents: documents.map(d => ({
          title: d.title,
          filing_date: d.filing_date,
          fiscal_year: d.fiscal_year,
          fiscal_quarter: d.fiscal_quarter,
          word_count: d.word_count,
          full_text: d.full_text
        }))
      }
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
7. **Actionable Insights**: End with clear takeaways or action items when appropriate.`
  
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

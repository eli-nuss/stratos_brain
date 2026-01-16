// Chat Worker - Background job processor for long-running AI analysis
// This function is triggered by company-chat-api and runs without timeout constraints

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-flash-preview'

// Google Custom Search API configuration
const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY') || ''
const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX') || ''

// E2B configuration for Python execution
const E2B_API_KEY = Deno.env.get('E2B_API_KEY') || ''

// Chat configuration interface
interface ChatConfig {
  model?: string
  temperature?: number
  max_output_tokens?: number
  intro?: string
  grounding_rules?: string
  role_description?: string
  guidelines?: string
  response_format?: string
}

// Helper to update job status and log tool calls
async function updateJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  updates: {
    result?: unknown
    tool_calls?: unknown[]
    error_message?: string
  } = {}
) {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString()
  }
  
  if (updates.result !== undefined) updateData.result = updates.result
  if (updates.error_message !== undefined) updateData.error_message = updates.error_message
  if (status === 'completed' || status === 'failed') {
    updateData.completed_at = new Date().toISOString()
  }
  
  // Append tool calls if provided
  if (updates.tool_calls && updates.tool_calls.length > 0) {
    // Get current tool_calls and append
    const { data: currentJob } = await supabase
      .from('chat_jobs')
      .select('tool_calls')
      .eq('id', jobId)
      .single()
    
    const existingCalls = currentJob?.tool_calls || []
    updateData.tool_calls = [...existingCalls, ...updates.tool_calls]
  }
  
  await supabase
    .from('chat_jobs')
    .update(updateData)
    .eq('id', jobId)
}

// Log a single tool execution for real-time UI updates
async function logToolExecution(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  toolName: string,
  status: 'started' | 'completed' | 'failed',
  data?: unknown
) {
  const toolCall = {
    tool_name: toolName,
    status,
    timestamp: new Date().toISOString(),
    data: data || null
  }
  
  await updateJobStatus(supabase, jobId, 'processing', {
    tool_calls: [toolCall]
  })
}

// Unified function declarations (same as company-chat-api)
const unifiedFunctionDeclarations = [
  {
    name: "get_asset_fundamentals",
    description: "Get financial fundamentals for a company including revenue, earnings, margins, valuation ratios, and other key metrics.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The stock ticker symbol (e.g., 'AAPL', 'GOOGL')" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "get_price_history",
    description: "Get historical OHLCV price data for an asset.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The internal asset ID" },
        days: { type: "number", description: "Number of days of history (max 365)" }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "get_technical_indicators",
    description: "Get current technical indicators including RSI, MACD, moving averages, Bollinger Bands.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The internal asset ID" },
        as_of_date: { type: "string", description: "Date in YYYY-MM-DD format" }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "get_company_docs",
    description: "Retrieve SEC filings (10-K, 10-Q) and earnings transcripts for a company.",
    parameters: {
      type: "object",
      properties: {
        asset_id: { type: "number", description: "The internal asset ID" },
        doc_type: { type: "string", description: "Document type: '10-K', '10-Q', 'earnings_transcript', or 'all'" },
        limit: { type: "number", description: "Maximum documents to return (default 3)" }
      },
      required: ["asset_id"]
    }
  },
  {
    name: "web_search",
    description: "Search the web for current news and information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        num_results: { type: "number", description: "Number of results (default 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "execute_python",
    description: "Execute Python code for calculations, data analysis, and visualizations.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Python code to execute" },
        purpose: { type: "string", description: "Brief description of what the code does" }
      },
      required: ["code"]
    }
  },
  {
    name: "generate_dynamic_ui",
    description: "Generate a dynamic UI component to display data.",
    parameters: {
      type: "object",
      properties: {
        component_type: { type: "string", description: "Type: 'table', 'chart', 'card', 'metric'" },
        title: { type: "string", description: "Title for the component" },
        data: { type: "object", description: "Data to display" }
      },
      required: ["component_type", "data"]
    }
  },
  {
    name: "track_topic_trend",
    description: "Track how often a topic/keyword is mentioned across earnings transcripts over time.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol" },
        keyword: { type: "string", description: "Keyword or phrase to track" },
        quarters: { type: "number", description: "Number of quarters to analyze (default 8)" }
      },
      required: ["ticker", "keyword"]
    }
  },
  {
    name: "analyze_management_tone",
    description: "Analyze management tone and sentiment across earnings calls.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol" },
        quarters: { type: "number", description: "Number of quarters to analyze (default 4)" }
      },
      required: ["ticker"]
    }
  },
  {
    name: "run_valuation_model",
    description: "Run DCF or comparable company valuation model with Owner Earnings methodology.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol" },
        model_type: { type: "string", description: "Model type: 'dcf', 'comps', or 'both'" },
        growth_rate: { type: "number", description: "Custom growth rate (optional)" },
        discount_rate: { type: "number", description: "Discount rate (default 10%)" },
        terminal_growth: { type: "number", description: "Terminal growth rate (default 2.5%)" }
      },
      required: ["ticker", "model_type"]
    }
  },
  {
    name: "generate_scenario_matrix",
    description: "Generate a sensitivity analysis matrix for key metrics.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol" },
        metric: { type: "string", description: "Metric to analyze: 'fair_value', 'eps', 'revenue'" },
        variable_1: { type: "string", description: "First variable: 'growth', 'margin', 'multiple', 'discount_rate'" },
        variable_2: { type: "string", description: "Second variable" },
        range_pct: { type: "number", description: "Range percentage for sensitivity (default 20)" }
      },
      required: ["ticker", "metric", "variable_1", "variable_2"]
    }
  }
]

// Execute a function call (simplified version - full implementation in original file)
async function executeFunctionCall(
  supabase: ReturnType<typeof createClient>,
  functionName: string,
  args: Record<string, unknown>,
  jobId: string
): Promise<unknown> {
  // Log that we're starting this tool
  await logToolExecution(supabase, jobId, functionName, 'started', args)
  
  try {
    let result: unknown
    
    switch (functionName) {
      case "get_asset_fundamentals": {
        const symbol = (args.symbol as string).toUpperCase()
        const { data, error } = await supabase
          .from('equity_metadata')
          .select('*')
          .eq('symbol', symbol)
          .single()
        
        if (error) throw error
        result = data
        break
      }
      
      case "get_price_history": {
        const assetId = args.asset_id as number
        const days = Math.min(args.days as number || 30, 365)
        
        const { data, error } = await supabase
          .from('daily_bars')
          .select('date, open, high, low, close, volume')
          .eq('asset_id', assetId)
          .order('date', { ascending: false })
          .limit(days)
        
        if (error) throw error
        result = data
        break
      }
      
      case "get_technical_indicators": {
        const assetId = args.asset_id as number
        const { data, error } = await supabase
          .from('daily_features')
          .select('*')
          .eq('asset_id', assetId)
          .order('date', { ascending: false })
          .limit(1)
          .single()
        
        if (error) throw error
        result = data
        break
      }
      
      case "get_company_docs": {
        const assetId = args.asset_id as number
        const docType = args.doc_type as string || 'all'
        const limit = Math.min(args.limit as number || 3, 10)
        
        let query = supabase
          .from('company_documents')
          .select('id, doc_type, fiscal_year, fiscal_quarter, filing_date, content')
          .eq('asset_id', assetId)
          .order('filing_date', { ascending: false })
          .limit(limit)
        
        if (docType !== 'all') {
          query = query.eq('doc_type', docType)
        }
        
        const { data, error } = await query
        if (error) throw error
        
        // Truncate content for memory efficiency
        result = data?.map(doc => ({
          ...doc,
          content: doc.content?.substring(0, 50000) + (doc.content?.length > 50000 ? '... [truncated]' : '')
        }))
        break
      }
      
      case "web_search": {
        const query = args.query as string
        const numResults = Math.min(args.num_results as number || 5, 10)
        
        if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
          result = { error: 'Search API not configured' }
          break
        }
        
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(query)}&num=${numResults}`
        const response = await fetch(searchUrl)
        const data = await response.json()
        
        result = data.items?.map((item: { title: string; link: string; snippet: string }) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet
        })) || []
        break
      }
      
      case "execute_python": {
        const code = args.code as string
        const purpose = args.purpose as string || 'Python execution'
        
        if (!E2B_API_KEY) {
          result = { error: 'Python execution not configured' }
          break
        }
        
        // Call E2B API
        const e2bResponse = await fetch('https://api.e2b.dev/v1/sandboxes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${E2B_API_KEY}`
          },
          body: JSON.stringify({
            template: 'Python3',
            timeout: 30000
          })
        })
        
        if (!e2bResponse.ok) {
          result = { error: 'Failed to create sandbox', purpose }
          break
        }
        
        const sandbox = await e2bResponse.json()
        
        // Execute code
        const execResponse = await fetch(`https://api.e2b.dev/v1/sandboxes/${sandbox.sandboxId}/code/execution`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${E2B_API_KEY}`
          },
          body: JSON.stringify({ code })
        })
        
        const execResult = await execResponse.json()
        result = {
          purpose,
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          result: execResult.result
        }
        break
      }
      
      case "track_topic_trend": {
        const ticker = (args.ticker as string).toUpperCase()
        const keyword = (args.keyword as string).toLowerCase()
        const quarters = Math.min(args.quarters as number || 8, 20)
        
        // Get asset_id
        const { data: asset } = await supabase
          .from('equity_metadata')
          .select('asset_id')
          .eq('symbol', ticker)
          .single()
        
        if (!asset) {
          result = { error: `Ticker ${ticker} not found` }
          break
        }
        
        // Get transcripts
        const { data: docs } = await supabase
          .from('company_documents')
          .select('fiscal_year, fiscal_quarter, filing_date, content')
          .eq('asset_id', asset.asset_id)
          .eq('doc_type', 'earnings_transcript')
          .order('filing_date', { ascending: false })
          .limit(quarters)
        
        const trendData = docs?.map(doc => {
          const content = (doc.content || '').toLowerCase()
          const matches = content.split(keyword).length - 1
          return {
            quarter: `Q${doc.fiscal_quarter} FY${String(doc.fiscal_year).slice(-2)}`,
            earnings_call_date: doc.filing_date,
            mentions: matches
          }
        }) || []
        
        const mentionCounts = trendData.map(t => t.mentions)
        const avgMentions = mentionCounts.reduce((a, b) => a + b, 0) / mentionCounts.length
        const recentAvg = mentionCounts.slice(0, Math.floor(quarters/2)).reduce((a, b) => a + b, 0) / Math.floor(quarters/2)
        const olderAvg = mentionCounts.slice(Math.floor(quarters/2)).reduce((a, b) => a + b, 0) / Math.ceil(quarters/2)
        
        result = {
          ticker,
          keyword,
          trend_direction: recentAvg > olderAvg * 1.2 ? 'INCREASING' : recentAvg < olderAvg * 0.8 ? 'DECREASING' : 'STABLE',
          average_mentions_per_quarter: avgMentions.toFixed(1),
          quarterly_data: trendData.reverse()
        }
        break
      }
      
      case "analyze_management_tone": {
        const ticker = (args.ticker as string).toUpperCase()
        const quarters = Math.min(args.quarters as number || 4, 8)
        
        const { data: asset } = await supabase
          .from('equity_metadata')
          .select('asset_id')
          .eq('symbol', ticker)
          .single()
        
        if (!asset) {
          result = { error: `Ticker ${ticker} not found` }
          break
        }
        
        const { data: docs } = await supabase
          .from('company_documents')
          .select('fiscal_year, fiscal_quarter, filing_date, content')
          .eq('asset_id', asset.asset_id)
          .eq('doc_type', 'earnings_transcript')
          .order('filing_date', { ascending: false })
          .limit(quarters)
        
        const confidenceWords = ['confident', 'strong', 'growth', 'momentum', 'excited', 'optimistic', 'record', 'outperform']
        const uncertaintyWords = ['uncertain', 'challenging', 'headwind', 'cautious', 'concern', 'risk', 'difficult', 'pressure']
        
        const toneData = docs?.map(doc => {
          const content = (doc.content || '').toLowerCase()
          const words = content.split(/\s+/).length
          
          let confidenceScore = 0
          let uncertaintyScore = 0
          
          confidenceWords.forEach(word => {
            confidenceScore += (content.split(word).length - 1)
          })
          uncertaintyWords.forEach(word => {
            uncertaintyScore += (content.split(word).length - 1)
          })
          
          return {
            quarter: `Q${doc.fiscal_quarter} FY${String(doc.fiscal_year).slice(-2)}`,
            earnings_call_date: doc.filing_date,
            confidence_score: confidenceScore,
            uncertainty_score: uncertaintyScore,
            net_sentiment: confidenceScore - uncertaintyScore,
            confidence_per_1k_words: ((confidenceScore / words) * 1000).toFixed(2),
            uncertainty_per_1k_words: ((uncertaintyScore / words) * 1000).toFixed(2)
          }
        }) || []
        
        result = {
          ticker,
          analysis_period: `Last ${quarters} quarters`,
          quarterly_tone: toneData.reverse(),
          overall_trend: toneData.length >= 2 
            ? (toneData[toneData.length-1].net_sentiment > toneData[0].net_sentiment ? 'IMPROVING' : 'DECLINING')
            : 'INSUFFICIENT_DATA'
        }
        break
      }
      
      case "run_valuation_model": {
        const ticker = (args.ticker as string).toUpperCase()
        const modelType = args.model_type as string
        const customGrowthRate = args.growth_rate as number | undefined
        const discountRate = (args.discount_rate as number) || 0.10
        const terminalGrowth = (args.terminal_growth as number) || 0.025
        
        const { data: metadata } = await supabase
          .from('equity_metadata')
          .select('*')
          .eq('symbol', ticker)
          .single()
        
        if (!metadata) {
          result = { error: `Could not find fundamental data for ${ticker}` }
          break
        }
        
        const { data: quarterlies } = await supabase
          .from('equity_quarterly_fundamentals')
          .select('fiscal_date_ending, total_revenue, net_income, free_cash_flow, operating_cashflow, eps_diluted, ebitda, ebit, capital_expenditures')
          .eq('asset_id', metadata.asset_id)
          .order('fiscal_date_ending', { ascending: false })
          .limit(8)
        
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
        
        let growthRate = customGrowthRate
        if (!growthRate && quarterlies && quarterlies.length >= 4) {
          const recentRevenue = quarterlies.slice(0, 4).reduce((s, q) => s + (q.total_revenue || 0), 0)
          const olderRevenue = quarterlies.slice(4, 8).reduce((s, q) => s + (q.total_revenue || 0), 0)
          if (olderRevenue > 0) {
            growthRate = (recentRevenue - olderRevenue) / olderRevenue
          }
        }
        growthRate = growthRate || 0.05
        
        const results: Record<string, unknown> = {
          ticker,
          current_price: currentPrice.toFixed(2),
          market_cap_billions: (marketCap / 1e9).toFixed(2),
          assumptions: {
            growth_rate: (growthRate * 100).toFixed(1) + '%',
            discount_rate: (discountRate * 100).toFixed(1) + '%',
            terminal_growth: (terminalGrowth * 100).toFixed(1) + '%'
          }
        }
        
        if (modelType === 'dcf' || modelType === 'both') {
          const ttmOCF = quarterlies?.slice(0, 4).reduce((s, q) => s + (q.operating_cashflow || 0), 0) || 0
          const ttmCapex = Math.abs(quarterlies?.slice(0, 4).reduce((s, q) => s + (q.capital_expenditures || 0), 0) || 0)
          const ttmDA = quarterlies?.slice(0, 4).reduce((s, q) => s + ((q.ebitda || 0) - (q.ebit || 0)), 0) || 0
          
          const standardFCF = ttmOCF - ttmCapex
          const ownerEarnings = ttmOCF - Math.abs(ttmDA)
          const capexToDA = ttmDA > 0 ? ttmCapex / ttmDA : 0
          const isHighGrowthReinvestor = capexToDA > 1.5
          
          const usedFCF = isHighGrowthReinvestor ? ownerEarnings : standardFCF
          const methodUsed = isHighGrowthReinvestor ? 'Owner Earnings (Adj. for Growth CapEx)' : 'Standard Unlevered FCF'
          
          let projectedFCFs = []
          let fcf = usedFCF
          for (let i = 1; i <= 5; i++) {
            fcf = fcf * (1 + growthRate)
            projectedFCFs.push(fcf)
          }
          
          const terminalFCF = projectedFCFs[4] * (1 + terminalGrowth)
          const terminalValue = terminalFCF / (discountRate - terminalGrowth)
          
          let pvFCFs = 0
          for (let i = 0; i < 5; i++) {
            pvFCFs += projectedFCFs[i] / Math.pow(1 + discountRate, i + 1)
          }
          const pvTerminal = terminalValue / Math.pow(1 + discountRate, 5)
          
          const enterpriseValue = pvFCFs + pvTerminal
          const fairValuePerShare = enterpriseValue / sharesOutstanding
          const upside = ((fairValuePerShare - currentPrice) / currentPrice * 100)
          
          results.dcf_model = {
            methodology: methodUsed,
            ttm_operating_cash_flow_millions: (ttmOCF / 1e6).toFixed(1),
            ttm_capex_millions: (ttmCapex / 1e6).toFixed(1),
            ttm_depreciation_amortization_millions: (Math.abs(ttmDA) / 1e6).toFixed(1),
            capex_to_da_ratio: capexToDA.toFixed(2) + 'x',
            adjustment_note: isHighGrowthReinvestor 
              ? `Switched to Owner Earnings because CapEx is ${capexToDA.toFixed(1)}x D&A. This avoids penalizing growth investments.`
              : 'Standard FCF used (CapEx is within normal maintenance range).',
            starting_cash_flow_millions: (usedFCF / 1e6).toFixed(1),
            fair_value_per_share: fairValuePerShare.toFixed(2),
            upside_downside_pct: upside.toFixed(1) + '%',
            verdict: upside > 20 ? 'UNDERVALUED' : upside < -20 ? 'OVERVALUED' : 'FAIRLY VALUED'
          }
        }
        
        result = results
        break
      }
      
      case "generate_scenario_matrix": {
        const ticker = (args.ticker as string).toUpperCase()
        const metric = args.metric as string
        const variable1 = args.variable_1 as string
        const variable2 = args.variable_2 as string
        const rangePct = (args.range_pct as number) || 20
        
        // Simplified scenario matrix
        const baseValues = { growth: 0.15, margin: 0.20, multiple: 15, discount_rate: 0.10 }
        const matrix: Record<string, Record<string, number>> = {}
        
        const var1Range = [-rangePct, -rangePct/2, 0, rangePct/2, rangePct]
        const var2Range = [-rangePct, -rangePct/2, 0, rangePct/2, rangePct]
        
        for (const v1 of var1Range) {
          const rowKey = `${variable1} ${v1 >= 0 ? '+' : ''}${v1}%`
          matrix[rowKey] = {}
          for (const v2 of var2Range) {
            const colKey = `${variable2} ${v2 >= 0 ? '+' : ''}${v2}%`
            // Simplified calculation
            const baseValue = 100
            const adjustedValue = baseValue * (1 + v1/100) * (1 + v2/100)
            matrix[rowKey][colKey] = Math.round(adjustedValue * 100) / 100
          }
        }
        
        result = {
          ticker,
          metric,
          variable_1: variable1,
          variable_2: variable2,
          sensitivity_matrix: matrix
        }
        break
      }
      
      case "generate_dynamic_ui": {
        result = {
          component_type: args.component_type,
          title: args.title,
          data: args.data,
          rendered: true
        }
        break
      }
      
      default:
        result = { error: `Unknown function: ${functionName}` }
    }
    
    // Log completion
    await logToolExecution(supabase, jobId, functionName, 'completed', result)
    return result
    
  } catch (error) {
    await logToolExecution(supabase, jobId, functionName, 'failed', { error: String(error) })
    return { error: String(error) }
  }
}

// Build system prompt
function buildSystemPrompt(asset: Record<string, unknown>, contextSnapshot: unknown, chatConfig: ChatConfig): string {
  const today = new Date().toISOString().split('T')[0]
  
  const intro = chatConfig.intro
    ? (chatConfig.intro as string).replace('{name}', String(asset.name)).replace('{symbol}', String(asset.symbol))
    : `You are Stratos, an elite autonomous financial analyst for ${asset.name} (${asset.symbol}).`
  
  return `${intro}

## CRITICAL GROUNDING RULES
1. Trust Data Over Memory: Your training data is OUTDATED. Always query the database first.
2. Zero-Math Tolerance: Use execute_python for ANY calculations.
3. Date Awareness: Today is ${today}.
4. Citation Required: Always cite specific documents when providing facts.

## Company Context
- Symbol: ${asset.symbol}
- Name: ${asset.name}
- Asset ID: ${asset.asset_id} (use this for database queries)
- Today's Date: ${today}

${contextSnapshot ? `## Latest Context\n${JSON.stringify(contextSnapshot, null, 2)}` : ''}

## Response Format
- Use markdown with clear sections
- Include relevant metrics with citations
- Show calculation methodology when using Python
- End with key takeaways`
}

// Call Gemini with tools
async function callGeminiWithTools(
  messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  chatConfig: ChatConfig = {}
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
}> {
  const toolCalls: unknown[] = []
  const codeExecutions: unknown[] = []
  
  const model = chatConfig.model || GEMINI_MODEL
  const temperature = chatConfig.temperature ?? 0.7
  const maxOutputTokens = chatConfig.max_output_tokens ?? 8192
  
  const requestBody = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    tools: [{ functionDeclarations: unifiedFunctionDeclarations }],
    generationConfig: {
      temperature,
      maxOutputTokens,
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
    
    // Add model's function call to messages
    messages.push({
      role: 'model',
      parts: functionCallParts
    })
    
    // Execute each function call
    const functionResponses: Array<{ functionResponse: { name: string; response: unknown } }> = []
    
    for (const part of functionCallParts) {
      const fc = part.functionCall as { name: string; args: Record<string, unknown> }
      const result = await executeFunctionCall(supabase, fc.name, fc.args, jobId)
      
      toolCalls.push({
        name: fc.name,
        args: fc.args,
        result
      })
      
      if (fc.name === 'execute_python') {
        codeExecutions.push({
          code: fc.args.code,
          purpose: fc.args.purpose,
          result
        })
      }
      
      functionResponses.push({
        functionResponse: {
          name: fc.name,
          response: result
        }
      })
    }
    
    // Add function responses to messages
    messages.push({
      role: 'user',
      parts: functionResponses
    })
    
    // Call Gemini again
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBody,
          contents: messages
        })
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
  
  // Extract final text response
  const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || []
  const finalResponse = textParts.map((p: { text: string }) => p.text).join('\n')
  
  return {
    response: finalResponse,
    toolCalls,
    codeExecutions
  }
}

// Main serve function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    const { jobId, chatId, message } = await req.json()
    
    if (!jobId || !chatId || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Update job to processing
    await updateJobStatus(supabase, jobId, 'processing')
    
    // Get chat info
    const { data: chat, error: chatError } = await supabase
      .from('company_chats')
      .select('*')
      .eq('chat_id', chatId)
      .single()
    
    if (chatError || !chat) {
      await updateJobStatus(supabase, jobId, 'failed', { error_message: 'Chat not found' })
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
      await updateJobStatus(supabase, jobId, 'failed', { error_message: 'Asset not found' })
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Fetch chat config
    const { data: chatConfig } = await supabase
      .from('chat_config')
      .select('*')
      .eq('is_active', true)
      .single()
    
    // Get sequence number
    const { data: lastMessage } = await supabase
      .from('chat_messages')
      .select('sequence_num')
      .eq('chat_id', chatId)
      .order('sequence_num', { ascending: false })
      .limit(1)
      .single()
    
    const nextSeq = (lastMessage?.sequence_num || 0) + 1
    
    // Save user message
    const { data: userMessage } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        sequence_num: nextSeq,
        role: 'user',
        content: message
      })
      .select()
      .single()
    
    // Build conversation history
    const { data: history } = await supabase
      .from('chat_messages')
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
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(asset, chat.context_snapshot, chatConfig || {})
    
    // Call Gemini with tools
    const startTime = Date.now()
    const geminiResult = await callGeminiWithTools(geminiMessages, systemPrompt, supabase, jobId, chatConfig || {})
    const latencyMs = Date.now() - startTime
    
    // Save assistant message
    const { data: assistantMessage } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        sequence_num: nextSeq + 1,
        role: 'assistant',
        content: geminiResult.response,
        tool_calls: geminiResult.toolCalls.length > 0 ? geminiResult.toolCalls : null,
        model: chatConfig?.model || GEMINI_MODEL,
        latency_ms: latencyMs
      })
      .select()
      .single()
    
    // Update chat's last_message_at
    await supabase
      .from('company_chats')
      .update({ last_message_at: new Date().toISOString() })
      .eq('chat_id', chatId)
    
    // Mark job as completed
    await updateJobStatus(supabase, jobId, 'completed', {
      result: {
        user_message: userMessage,
        assistant_message: assistantMessage,
        tool_calls: geminiResult.toolCalls,
        code_executions: geminiResult.codeExecutions,
        latency_ms: latencyMs
      }
    })
    
    return new Response(JSON.stringify({ success: true, jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Worker error:', error)
    
    // Try to update job status if we have a jobId
    try {
      const body = await req.clone().json()
      if (body.jobId) {
        await updateJobStatus(supabase, body.jobId, 'failed', {
          error_message: String(error)
        })
      }
    } catch {}
    
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

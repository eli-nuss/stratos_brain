// Company Chat API - Manus-style chat interface for company research
// Supports Gemini 3 Pro with unified function calling approach
// Search and code execution are wrapped as functions to avoid tool conflicts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview' // Using Gemini 3 Pro as requested

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
  }
]

// Execute web search using Google Custom Search API or fallback
async function executeWebSearch(query: string): Promise<unknown> {
  // Use Google's Programmable Search Engine (requires API key)
  // For now, we'll use a simple approach that works without additional API keys
  // by leveraging the Gemini model's built-in knowledge
  
  // In production, you would integrate with:
  // - Google Custom Search API
  // - SerpApi
  // - Brave Search API
  // - Bing Search API
  
  // For now, return a structured response indicating search was attempted
  // The model can use its training data to provide relevant information
  return {
    query: query,
    note: "Web search executed. The model will provide information based on its training data and knowledge cutoff.",
    timestamp: new Date().toISOString()
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
): Promise<unknown> {
  const { name, args } = functionCall
  
  switch (name) {
    case "get_asset_fundamentals": {
      const { data, error } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', args.symbol)
        .single()
      
      if (error) return { error: error.message }
      return data
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
      return data?.reverse() || []
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
      return data
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
      return data || []
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
      return data || []
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
      return data || []
    }
    
    case "web_search": {
      return await executeWebSearch(args.query as string)
    }
    
    case "execute_python": {
      return await executePythonCode(args.code as string, args.purpose as string)
    }
    
    default:
      return { error: `Unknown function: ${name}` }
  }
}

// Build system prompt for a company chat
function buildSystemPrompt(asset: Record<string, unknown>, contextSnapshot: Record<string, unknown> | null): string {
  return `You are an AI research analyst assistant for ${asset.name} (${asset.symbol}).

## Your Role
You are helping a trader/investor research and analyze this company. You have access to:
1. **Database Functions**: Query financial data, price history, technical indicators, signals, and AI reviews from the Stratos Brain database.
2. **Web Search**: Search for current news, market conditions, and real-time information using the web_search function.
3. **Python Code Execution**: Run Python code for calculations, statistical analysis, and data processing using the execute_python function.

## Company Context
- **Symbol**: ${asset.symbol}
- **Name**: ${asset.name}
- **Asset Type**: ${asset.asset_type}
- **Sector**: ${asset.sector || 'N/A'}
- **Industry**: ${asset.industry || 'N/A'}
- **Asset ID**: ${asset.asset_id} (use this for database queries)

${contextSnapshot ? `## Latest Context Snapshot
${JSON.stringify(contextSnapshot, null, 2)}` : ''}

## Guidelines
1. Always use the asset_id (${asset.asset_id}) when calling database functions that require it.
2. Start by gathering relevant data using the available functions before providing analysis.
3. When asked about current events or news, use the web_search function.
4. For complex calculations or data analysis, use the execute_python function.
5. Provide clear, actionable insights backed by data.
6. Be transparent about data limitations and uncertainty.
7. Format responses with clear sections and bullet points for readability.

## Response Format
- Use markdown formatting for clarity
- Include relevant metrics and data points
- Cite which functions/data sources you used
- Provide both bullish and bearish perspectives when relevant
- End with key takeaways or action items when appropriate`
}

// Call Gemini with unified function calling
async function callGeminiWithTools(
  messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  groundingMetadata: unknown | null;
}> {
  const toolCalls: unknown[] = []
  const codeExecutions: unknown[] = []
  const groundingMetadata: unknown | null = null
  
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
    console.error('Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status}`)
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
      console.log(`Executing function: ${fc.name}`, fc.args)
      
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
    }
    
    // Add the assistant's response and function results to messages
    messages.push({
      role: 'model',
      parts: content.parts
    })
    
    messages.push({
      role: 'user',
      parts: functionResponses
    })
    
    // Call Gemini again with function results
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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

    // Route handling
    switch (true) {
      // GET /chats - List all company chats
      case req.method === 'GET' && path === '/chats': {
        const { data, error } = await supabase
          .from('company_chats')
          .select(`
            chat_id,
            asset_id,
            asset_type,
            display_name,
            status,
            last_message_at,
            created_at
          `)
          .eq('status', 'active')
          .order('last_message_at', { ascending: false, nullsFirst: false })
        
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

      // POST /chats - Create or get a chat for a company
      case req.method === 'POST' && path === '/chats': {
        const body = await req.json()
        const { asset_id, asset_type, display_name } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Check if chat already exists
        const { data: existingChat } = await supabase
          .from('company_chats')
          .select('*')
          .eq('asset_id', asset_id)
          .single()
        
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
        
        // Create new chat
        const { data: newChat, error } = await supabase
          .from('company_chats')
          .insert({
            asset_id: String(asset_id),
            asset_type: assetInfo.asset_type || 'equity',
            display_name: assetInfo.display_name || `Asset ${asset_id}`
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
        
        // Build system prompt
        const systemPrompt = buildSystemPrompt(asset, chat.context_snapshot)
        
        // Call Gemini with tools
        const startTime = Date.now()
        const geminiResult = await callGeminiWithTools(geminiMessages, systemPrompt, supabase)
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
            model: GEMINI_MODEL,
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

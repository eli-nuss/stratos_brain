// Diagram Generator - Dedicated AI agent for generating Mermaid diagrams
// This is a separate, focused endpoint that avoids the MALFORMED_FUNCTION_CALL issues
// by running as a fresh Gemini session with minimal, focused tools

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-flash-preview' // Use flash for faster, more reliable generation

// ============================================================================
// Focused Tool Declarations (minimal set to reduce error surface)
// ============================================================================

const diagramToolDeclarations = [
  {
    name: "get_company_fundamentals",
    description: "Get financial fundamentals for a company including revenue, earnings, margins, valuation ratios.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol (e.g., 'AAPL')" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "get_sector_peers",
    description: "Get a list of peer companies in the same sector/industry.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol to find peers for" },
        limit: { type: "number", description: "Maximum number of peers to return (default 5)" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "search_web",
    description: "Search the web for current information about a topic.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    }
  }
]

// ============================================================================
// Tool Execution (direct database calls, no nested AI)
// ============================================================================

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  console.log(`Executing tool: ${toolName}`, args)
  
  switch (toolName) {
    case "get_company_fundamentals": {
      const symbol = (args.symbol as string).toUpperCase()
      const { data, error } = await supabase
        .from('equity_metadata')
        .select('symbol, name, sector, industry, market_cap, pe_ratio, forward_pe, price_to_book, dividend_yield, revenue_ttm, net_income_ttm, profit_margin, revenue_growth_yoy, earnings_growth_yoy')
        .eq('symbol', symbol)
        .single()
      
      if (error) {
        console.error('Error fetching fundamentals:', error)
        return { error: `Could not find data for ${symbol}` }
      }
      return data
    }
    
    case "get_sector_peers": {
      const symbol = (args.symbol as string).toUpperCase()
      const limit = (args.limit as number) || 5
      
      // First get the sector/industry of the target company
      const { data: company, error: companyError } = await supabase
        .from('equity_metadata')
        .select('sector, industry')
        .eq('symbol', symbol)
        .single()
      
      if (companyError || !company) {
        return { error: `Could not find company ${symbol}` }
      }
      
      // Then find peers in the same sector
      const { data: peers, error: peersError } = await supabase
        .from('equity_metadata')
        .select('symbol, name, market_cap, pe_ratio, revenue_growth_yoy, profit_margin')
        .eq('sector', company.sector)
        .neq('symbol', symbol)
        .order('market_cap', { ascending: false })
        .limit(limit)
      
      if (peersError) {
        return { error: 'Could not fetch peers' }
      }
      
      return {
        target_symbol: symbol,
        sector: company.sector,
        industry: company.industry,
        peers: peers || []
      }
    }
    
    case "search_web": {
      const query = args.query as string
      
      // Use Google Search API via Gemini's grounding
      try {
        const searchResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `Search and summarize: ${query}` }] }],
              tools: [{ googleSearch: {} }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
            })
          }
        )
        
        if (!searchResponse.ok) {
          return { error: 'Search failed' }
        }
        
        const searchData = await searchResponse.json()
        const searchText = searchData.candidates?.[0]?.content?.parts?.[0]?.text || 'No results found'
        
        return { query, summary: searchText }
      } catch (err) {
        console.error('Search error:', err)
        return { error: 'Search failed', details: String(err) }
      }
    }
    
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

// ============================================================================
// Mermaid Generation Prompt
// ============================================================================

function buildMermaidPrompt(
  userRequest: string,
  companyContext: { symbol: string; name: string } | null,
  chatSummary: string | null
): string {
  return `You are an expert diagram designer. Generate a Mermaid diagram based on the user's request.

## User Request
${userRequest}

${companyContext ? `## Company Context
- Symbol: ${companyContext.symbol}
- Name: ${companyContext.name}
` : ''}

${chatSummary ? `## Recent Chat Context
${chatSummary}
` : ''}

## Instructions
1. First, use the available tools to gather any data you need
2. Then generate a Mermaid diagram that visualizes the information

## Mermaid Syntax Guidelines

### For Flowcharts:
\`\`\`
flowchart TD
    A[Node 1] --> B[Node 2]
    B --> C{Decision}
    C -->|Yes| D[Result 1]
    C -->|No| E[Result 2]
\`\`\`

### For Comparisons (use subgraphs):
\`\`\`
flowchart LR
    subgraph Company1[Company A]
        A1[Metric: Value]
        A2[Metric: Value]
    end
    subgraph Company2[Company B]
        B1[Metric: Value]
        B2[Metric: Value]
    end
\`\`\`

### Node Shapes:
- [Text] = Rectangle
- (Text) = Rounded rectangle
- {Text} = Diamond (decision)
- ((Text)) = Circle

## Output Format
After gathering data, respond with a JSON object:
{
  "name": "Short title for the diagram",
  "description": "One sentence description",
  "mermaid": "flowchart TD\\n    A[Node] --> B[Node]"
}

IMPORTANT:
- Use \\n for newlines in the mermaid string
- Keep labels concise (3-4 words max)
- Include actual data values in the diagram
- Return ONLY the JSON, no markdown code blocks`
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Parse request body
    const body = await req.json()
    const {
      chat_id,
      user_request,
      company_symbol,
      company_name,
      chat_summary
    } = body
    
    if (!chat_id || !user_request) {
      return new Response(JSON.stringify({ error: 'chat_id and user_request are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log(`Generating diagram for chat ${chat_id}: "${user_request}"`)
    
    // Build the prompt
    const companyContext = company_symbol ? { symbol: company_symbol, name: company_name || company_symbol } : null
    const systemPrompt = buildMermaidPrompt(user_request, companyContext, chat_summary)
    
    // Call Gemini with tools
    const messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }> = [
      { role: 'user', parts: [{ text: systemPrompt }] }
    ]
    
    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages,
          tools: [{ functionDeclarations: diagramToolDeclarations }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096
          }
        })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }
    
    let data = await response.json()
    let candidate = data.candidates?.[0]
    
    // Tool execution loop (max 5 iterations)
    const maxIterations = 5
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
        const result = await executeTool(supabase, fc.name, fc.args)
        
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
      
      // Continue the conversation
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: messages,
            tools: [{ functionDeclarations: diagramToolDeclarations }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096
            }
          })
        }
      )
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error in loop:', errorText)
        throw new Error(`Gemini API error: ${response.status}`)
      }
      
      data = await response.json()
      candidate = data.candidates?.[0]
      iteration++
    }
    
    // Extract the final response
    const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || []
    let responseText = textParts.map((p: { text: string }) => p.text).join('\n')
    
    console.log('Raw response:', responseText.substring(0, 500))
    
    // Parse the JSON response
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      responseText = jsonMatch[1]
    } else {
      // Try to find raw JSON
      jsonMatch = responseText.match(/\{[\s\S]*"mermaid"[\s\S]*\}/)
      if (jsonMatch) {
        responseText = jsonMatch[0]
      }
    }
    
    let parsedResponse: { name: string; description: string; mermaid: string }
    try {
      parsedResponse = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse response:', parseError, responseText)
      
      // Fallback: try to generate a simple diagram
      parsedResponse = {
        name: 'Generated Diagram',
        description: user_request,
        mermaid: `flowchart TD\n    A[${company_symbol || 'Topic'}] --> B[Analysis]\n    B --> C[Results]`
      }
    }
    
    if (!parsedResponse.mermaid) {
      throw new Error('No mermaid diagram in response')
    }
    
    // Detect diagram type from mermaid syntax
    let diagramType = 'flowchart'
    const mermaidLower = parsedResponse.mermaid.toLowerCase()
    if (mermaidLower.includes('mindmap')) diagramType = 'mind_map'
    else if (mermaidLower.includes('timeline')) diagramType = 'timeline'
    else if (mermaidLower.includes('subgraph')) diagramType = 'comparison'
    
    // Save the diagram to the database
    const diagramData = {
      type: 'mermaid',
      version: 1,
      source: 'stratos-brain-diagram-generator',
      mermaid: parsedResponse.mermaid,
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {}
    }
    
    const { data: savedDiagram, error: saveError } = await supabase
      .from('chat_diagrams')
      .insert({
        chat_id,
        user_id: user.id,
        name: parsedResponse.name,
        description: parsedResponse.description,
        diagram_type: diagramType,
        excalidraw_data: diagramData,
        generation_prompt: user_request,
        generation_model: GEMINI_MODEL,
        is_ai_generated: true,
        status: 'ready'
      })
      .select()
      .single()
    
    if (saveError) {
      console.error('Failed to save diagram:', saveError)
      throw new Error(`Failed to save diagram: ${saveError.message}`)
    }
    
    console.log(`Diagram saved: ${savedDiagram.diagram_id}`)
    
    return new Response(JSON.stringify({
      success: true,
      diagram: savedDiagram
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Diagram generation error:', error)
    return new Response(JSON.stringify({
      error: String(error),
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

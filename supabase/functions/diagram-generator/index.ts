// Diagram Generator Edge Function
// This agent is an expert in designing and building diagrams in Excalidraw format
// NOW WITH PLANNING PHASE, STREAMING PROGRESS, AND DATA-FIRST WORKFLOW

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
const GEMINI_MODEL = 'gemini-2.5-flash'

// ============================================================================
// Research Tool Declarations
// ============================================================================

const researchToolDeclarations = [
  {
    name: "get_company_fundamentals",
    description: "REQUIRED: Get financial fundamentals for a company including revenue, earnings, margins, valuation ratios. YOU MUST CALL THIS FIRST.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol (e.g., 'AAPL', 'NVDA', 'LLY')" }
      },
      required: ["symbol"]
    }
  },
  {
    name: "get_sector_peers",
    description: "Get a list of peer companies in the same sector/industry for comparison diagrams.",
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
    description: "Search the web for current information about a topic. Use this for revenue breakdowns, product segments, recent news, etc.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query - be specific (e.g., 'Apple Q3 2024 revenue breakdown by product segment')" }
      },
      required: ["query"]
    }
  }
]

// ============================================================================
// Tool Execution
// ============================================================================

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  console.log("Executing tool:", toolName, args)
  
  try {
    if (toolName === "get_company_fundamentals") {
      const symbol = args.symbol as string
      if (!symbol) {
        return { error: "Symbol is required" }
      }
      
      // Call the existing company-fundamentals edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/company-fundamentals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ symbol })
      })
      
      if (!response.ok) {
        return { error: `Failed to fetch fundamentals: ${response.status}` }
      }
      
      return await response.json()
    }
    
    if (toolName === "get_sector_peers") {
      const symbol = args.symbol as string
      const limit = (args.limit as number) || 5
      
      // Call the existing sector-peers edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/sector-peers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ symbol, limit })
      })
      
      if (!response.ok) {
        return { error: `Failed to fetch peers: ${response.status}` }
      }
      
      return await response.json()
    }
    
    if (toolName === "search_web") {
      const query = args.query as string
      if (!query) {
        return { error: "Query is required" }
      }
      
      // Call the existing web-search edge function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/web-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ query })
      })
      
      if (!response.ok) {
        return { error: `Failed to search: ${response.status}` }
      }
      
      return await response.json()
    }
    
    return { error: `Unknown tool: ${toolName}` }
  } catch (error) {
    console.error("Tool execution error:", error)
    return { error: String(error) }
  }
}

// ============================================================================
// EXCALIDRAW EXPERT PROMPT - Design phase after data is gathered
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = `You are an EXPERT Excalidraw diagram designer. You have already gathered the data - now create the diagram.

## STRICT DESIGN SYSTEM & LAYOUT RULES

### 1. STANDARD SIZES (Never deviate!):
- Rectangles: width=250, height=100
- Ellipses: width=200, height=100
- Diamonds: width=150, height=150

### 2. THE GRID FORMULA (Prevents overlapping!):
- Column spacing: 350px apart (X: 100, 450, 800, 1150...)
- Row spacing: 200px apart (Y: 100, 300, 500, 700...)

EXAMPLE GRID POSITIONS:
- Row 1: (100, 100), (450, 100), (800, 100)
- Row 2: (100, 300), (450, 300), (800, 300)
- Row 3: (100, 500), (450, 500), (800, 500)

### 3. ARROWS - Use ID Binding (NOT coordinates!):
{
  "type": "arrow",
  "id": "arrow_1",
  "start": { "id": "source_node_id" },
  "end": { "id": "target_node_id" },
  "strokeColor": "#495057",
  "strokeWidth": 2,
  "endArrowhead": "triangle"
}

### 4. TEXT LABELS:
- Inside shapes: Use the "label" property with actual data values
- Include real numbers from your research (e.g., "$85B", "45%", etc.)

### 5. COLOR PALETTE:
- Positive/Growth: backgroundColor="#d3f9d8", strokeColor="#2b8a3e"
- Negative/Risk: backgroundColor="#ffe3e3", strokeColor="#c92a2a"
- Neutral/Info: backgroundColor="#e7f5ff", strokeColor="#1864ab"
- Revenue/Money: backgroundColor="#fff3bf", strokeColor="#f08c00"
- Primary: backgroundColor="#d0bfff", strokeColor="#7950f2"

## OUTPUT FORMAT

Return ONLY valid JSON:

{
  "elements": [
    {
      "id": "title",
      "type": "text",
      "x": 400,
      "y": 30,
      "text": "Diagram Title",
      "fontSize": 28,
      "strokeColor": "#ffffff"
    },
    {
      "id": "node_1",
      "type": "rectangle",
      "x": 100,
      "y": 100,
      "width": 250,
      "height": 100,
      "backgroundColor": "#e7f5ff",
      "strokeColor": "#1864ab",
      "label": { "text": "Label with Data\\n$XX.XB", "fontSize": 18 }
    }
  ],
  "appState": { "viewBackgroundColor": "#1e1e1e" }
}

Use the REAL data you gathered to populate the labels. Follow your plan's layout.`

// ============================================================================
// Streaming Helper
// ============================================================================

function createStreamWriter() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    }
  })
  
  return {
    stream,
    write(event: string, data: unknown) {
      if (controller) {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }
    },
    close() {
      if (controller) {
        controller.close()
      }
    }
  }
}

// ============================================================================
// Diagram Generation with Forced Tool Calling
// ============================================================================

async function generateDiagramWithStreaming(
  supabase: ReturnType<typeof createClient>,
  writer: ReturnType<typeof createStreamWriter>,
  request: string,
  companySymbol: string,
  companyName: string,
  chatContext: string,
  chatId: string | null,
  userId: string | null
): Promise<void> {
  
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY
  
  // Build context about the company
  const companyContext = companySymbol 
    ? `\n\n## CRITICAL - TARGET COMPANY (YOU MUST USE THIS COMPANY):\n- Company Name: ${companyName || companySymbol}\n- Stock Symbol: ${companySymbol}\n\nYOU MUST use "${companySymbol}" when calling get_company_fundamentals.\nYOU MUST include "${companyName || companySymbol}" in your search queries.`
    : ''
  
  // ========== PHASE 1: FORCED DATA GATHERING ==========
  writer.write('status', { stage: 'researching', message: 'Gathering company data...' })
  writer.write('plan', {
    title: `${companyName || companySymbol || 'Company'} - ${request}`,
    type: 'breakdown',
    checklist: [
      { item: 'Company fundamentals', status: 'pending' },
      { item: 'Revenue breakdown', status: 'pending' },
      { item: 'Product segments', status: 'pending' }
    ],
    tools: ['get_company_fundamentals', 'search_web'],
    layout: 'Hierarchical breakdown',
    estimated_elements: 8
  })
  
  const gatheredData: Record<string, unknown> = {}
  
  // FORCE TOOL CALL 1: Get company fundamentals if we have a symbol
  if (companySymbol) {
    writer.write('tool_call', {
      tool: 'get_company_fundamentals',
      args: { symbol: companySymbol },
      message: `Fetching fundamentals for ${companySymbol}...`
    })
    
    const fundamentals = await executeTool(supabase, 'get_company_fundamentals', { symbol: companySymbol })
    gatheredData['fundamentals'] = fundamentals
    
    writer.write('checklist_update', { tool: 'get_company_fundamentals', status: 'complete' })
    writer.write('tool_result', {
      tool: 'get_company_fundamentals',
      success: !('error' in (fundamentals as any)),
      message: `Got fundamentals for ${companySymbol}`
    })
    
    console.log("Fundamentals gathered:", JSON.stringify(fundamentals).substring(0, 500))
  }
  
  // FORCE TOOL CALL 2: Search for specific data
  const searchQuery = companySymbol 
    ? `${companyName || companySymbol} ${request} revenue breakdown product segments 2024`
    : request
  
  writer.write('tool_call', {
    tool: 'search_web',
    args: { query: searchQuery },
    message: `Searching for ${companyName || 'company'} data...`
  })
  
  const searchResults = await executeTool(supabase, 'search_web', { query: searchQuery })
  gatheredData['search'] = searchResults
  
  writer.write('checklist_update', { tool: 'search_web', status: 'complete' })
  writer.write('tool_result', {
    tool: 'search_web',
    success: !('error' in (searchResults as any)),
    message: 'Got search results'
  })
  
  console.log("Search results gathered:", JSON.stringify(searchResults).substring(0, 500))
  
  // ========== PHASE 2: DESIGN WITH REAL DATA ==========
  writer.write('status', { stage: 'designing', message: 'Creating diagram with real data...' })
  
  const designPrompt = `Create an Excalidraw diagram for: "${request}"
${companyContext}

## GATHERED DATA (USE THIS REAL DATA IN YOUR DIAGRAM):

### Company Fundamentals:
${JSON.stringify(gatheredData['fundamentals'], null, 2)}

### Search Results:
${JSON.stringify(gatheredData['search'], null, 2)}

## INSTRUCTIONS:
1. Extract the REAL revenue numbers, product names, and percentages from the data above
2. Create a professional diagram showing the breakdown
3. Use the actual company name "${companyName || companySymbol}" in the title
4. Include real dollar amounts and percentages in each box
5. Follow the grid layout system (X: 100, 450, 800; Y: 100, 300, 500)

${EXCALIDRAW_EXPERT_PROMPT}

NOW OUTPUT THE JSON DIAGRAM:`

  let diagramJson: any = null
  const maxDesignIterations = 3
  
  for (let i = 0; i < maxDesignIterations; i++) {
    writer.write('status', { stage: 'designing', message: 'Creating diagram layout...', iteration: i })
    
    const designResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: designPrompt }] }
        ],
        generationConfig: { 
          temperature: 0.3, 
          maxOutputTokens: 16384,
          responseMimeType: "application/json"
        }
      })
    })
    
    if (!designResponse.ok) {
      throw new Error("Design phase failed: " + designResponse.status)
    }
    
    const designData = await designResponse.json()
    const textPart = designData.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
    
    if (!textPart) {
      console.log("No text in design response, retrying...")
      continue
    }
    
    // Parse JSON
    writer.write('status', { stage: 'parsing', message: 'Parsing diagram data...' })
    
    try {
      // Try to extract JSON from the response
      let jsonStr = textPart.trim()
      
      // Remove markdown code blocks if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      
      // Try to find JSON object
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (objectMatch) {
        jsonStr = objectMatch[0]
      }
      
      diagramJson = JSON.parse(jsonStr)
      
      // Validate
      if (!diagramJson.elements || !Array.isArray(diagramJson.elements)) {
        throw new Error("Invalid diagram: missing elements array")
      }
      
      if (diagramJson.elements.length < 3) {
        console.log("Too few elements, retrying...")
        continue
      }
      
      // Success!
      break
      
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Raw:", textPart.substring(0, 500))
      if (i === maxDesignIterations - 1) {
        throw new Error("Failed to parse diagram JSON after " + maxDesignIterations + " attempts")
      }
    }
  }
  
  if (!diagramJson) {
    throw new Error("Failed to generate diagram")
  }
  
  // ========== PHASE 3: SAVE ==========
  writer.write('status', { stage: 'saving', message: `Generated ${diagramJson.elements.length} elements. Saving...` })
  
  const diagramName = request.substring(0, 100)
  let diagramId = `temp-${Date.now()}`
  
  // Try to save to database
  if (chatId && userId) {
    try {
      const { data, error } = await supabase
        .from('diagrams')
        .insert({
          chat_id: chatId,
          user_id: userId,
          name: diagramName,
          excalidraw_data: {
            type: 'excalidraw',
            version: 2,
            elements: diagramJson.elements,
            appState: diagramJson.appState || { viewBackgroundColor: '#1e1e1e' },
            files: {}
          },
          generation_prompt: request,
          generation_model: GEMINI_MODEL,
          is_ai_generated: true,
          status: 'ready'
        })
        .select()
        .single()
      
      if (data) {
        diagramId = data.diagram_id
      } else if (error) {
        console.error("Failed to save diagram:", error)
      }
    } catch (dbError) {
      console.error("Database error:", dbError)
    }
  }
  
  // Send complete event
  writer.write('complete', {
    success: true,
    diagram: {
      diagram_id: diagramId,
      name: diagramName,
      excalidraw_data: {
        type: 'excalidraw',
        version: 2,
        elements: diagramJson.elements,
        appState: diagramJson.appState || { viewBackgroundColor: '#1e1e1e' },
        files: {}
      },
      is_ai_generated: true
    },
    message: 'Diagram generated successfully!'
  })
}

// ============================================================================
// HTTP Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  const writer = createStreamWriter()
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    const body = await req.json()
    const { 
      request, 
      company_symbol, 
      company_name, 
      chat_context, 
      chat_id, 
      user_id 
    } = body
    
    if (!request) {
      throw new Error("Request is required")
    }
    
    console.log("Generating diagram for:", request, "Company:", company_symbol, company_name)
    
    // Start streaming response
    const responsePromise = generateDiagramWithStreaming(
      supabase,
      writer,
      request,
      company_symbol || '',
      company_name || '',
      chat_context || '',
      chat_id,
      user_id
    )
    
    // Handle completion
    responsePromise
      .catch((error) => {
        console.error("Generation error:", error)
        writer.write('error', { message: error.message || 'Unknown error' })
      })
      .finally(() => {
        writer.close()
      })
    
    return new Response(writer.stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
    
  } catch (error) {
    console.error("Handler error:", error)
    writer.write('error', { message: (error as Error).message || 'Unknown error' })
    writer.close()
    
    return new Response(writer.stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }
    })
  }
})

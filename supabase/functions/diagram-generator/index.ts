// Diagram Generator - Dedicated AI agent for generating Excalidraw diagrams directly
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
// Planning Tool Declaration
// ============================================================================

const planningToolDeclarations = [
  {
    name: "create_diagram_plan",
    description: "Create a detailed plan for the diagram including what data to fetch and how to visualize it. MUST be called first before any other actions.",
    parameters: {
      type: "object",
      properties: {
        diagram_title: { type: "string", description: "Clear title for the diagram" },
        diagram_type: { type: "string", description: "Type of diagram: flowchart, breakdown, comparison, timeline, hierarchy" },
        data_needed: { 
          type: "array", 
          items: { type: "string" },
          description: "List of specific data points needed (e.g., 'Total revenue', 'Revenue by product segment', 'YoY growth rate')" 
        },
        tools_to_use: {
          type: "array",
          items: { type: "string" },
          description: "List of tools to call: get_company_fundamentals, search_web, get_sector_peers"
        },
        layout_plan: { type: "string", description: "Brief description of how elements will be arranged (e.g., 'Top node for total, 3 child nodes for segments')" },
        estimated_elements: { type: "number", description: "Estimated number of shapes/nodes in the final diagram (minimum 5)" }
      },
      required: ["diagram_title", "diagram_type", "data_needed", "tools_to_use", "layout_plan", "estimated_elements"]
    }
  }
]

// ============================================================================
// Research Tool Declarations
// ============================================================================

const researchToolDeclarations = [
  {
    name: "get_company_fundamentals",
    description: "Get financial fundamentals for a company including revenue, earnings, margins, valuation ratios.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol (e.g., 'AAPL', 'NVDA', 'MSFT')" }
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
  
  switch (toolName) {
    case "create_diagram_plan": {
      // This is a planning tool - just return the plan as confirmation
      return {
        status: "Plan created",
        plan: args,
        next_step: "Now execute the tools listed in tools_to_use to gather the data"
      }
    }
    
    case "get_company_fundamentals": {
      const symbol = (args.symbol as string).toUpperCase()
      const { data, error } = await supabase
        .from('equity_metadata')
        .select('symbol, name, sector, industry, market_cap, pe_ratio, forward_pe, price_to_book, dividend_yield, revenue_ttm, net_income_ttm, profit_margin, revenue_growth_yoy, earnings_growth_yoy')
        .eq('symbol', symbol)
        .single()
      
      if (error) {
        console.error('Error fetching fundamentals:', error)
        return { error: "Could not find data for " + symbol, suggestion: "Try using search_web to find the information" }
      }
      return data
    }
    
    case "get_sector_peers": {
      const symbol = (args.symbol as string).toUpperCase()
      const limit = (args.limit as number) || 5
      
      const { data: company, error: companyError } = await supabase
        .from('equity_metadata')
        .select('sector, industry')
        .eq('symbol', symbol)
        .single()
      
      if (companyError || !company) {
        return { error: "Could not find company " + symbol }
      }
      
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
      
      try {
        const searchUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Search and provide detailed factual information about: " + query + ". Include specific numbers, percentages, and breakdowns where available." }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
          })
        })
        
        if (!searchResponse.ok) {
          return { error: 'Search failed' }
        }
        
        const searchData = await searchResponse.json()
        const searchText = searchData.candidates?.[0]?.content?.parts?.[0]?.text || 'No results found'
        
        return { query, results: searchText }
      } catch (err) {
        console.error('Search error:', err)
        return { error: 'Search failed', details: String(err) }
      }
    }
    
    default:
      return { error: "Unknown tool: " + toolName }
  }
}

// ============================================================================
// PLANNING PROMPT - First phase to create a checklist
// ============================================================================

const PLANNING_PROMPT = `You are an EXPERT Financial Analyst creating a diagram plan.

Your ONLY job right now is to create a detailed plan using the create_diagram_plan tool.

Analyze the user's request and create a comprehensive plan that includes:
1. A clear diagram title
2. The type of diagram (flowchart, breakdown, comparison, timeline, hierarchy)
3. A list of ALL specific data points needed
4. Which tools you'll need to call to get that data
5. How you'll lay out the elements
6. How many elements you expect to create (minimum 5)

CALL THE create_diagram_plan TOOL NOW with your plan.`

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
// Diagram Generation with Planning Phase
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
  
  // ========== PHASE 1: PLANNING ==========
  writer.write('status', { stage: 'planning', message: 'Creating diagram plan...' })
  
  let userPrompt = `Create a diagram for: "${request}"`
  if (companySymbol) {
    userPrompt += `\n\nCompany: ${companyName} (${companySymbol})`
  }
  if (chatContext) {
    userPrompt += "\n\nContext:\n" + chatContext
  }
  
  // Call planning phase
  const planningResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: PLANNING_PROMPT }] },
        { role: "model", parts: [{ text: "I'll create a detailed plan for this diagram using the create_diagram_plan tool." }] },
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      tools: [{ functionDeclarations: planningToolDeclarations }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  })
  
  if (!planningResponse.ok) {
    throw new Error("Failed to create plan: " + planningResponse.status)
  }
  
  const planningData = await planningResponse.json()
  const planningContent = planningData.candidates?.[0]?.content
  const planCall = planningContent?.parts?.find((p: any) => p.functionCall)?.functionCall
  
  let plan: any = null
  if (planCall && planCall.name === "create_diagram_plan") {
    plan = planCall.args
    
    // Send plan to frontend
    writer.write('plan', {
      title: plan.diagram_title,
      type: plan.diagram_type,
      checklist: plan.data_needed.map((item: string) => ({ item, status: 'pending' })),
      tools: plan.tools_to_use,
      layout: plan.layout_plan,
      estimated_elements: plan.estimated_elements
    })
    
    console.log("Plan created:", plan)
  } else {
    // Fallback plan if AI didn't call the tool
    plan = {
      diagram_title: request,
      diagram_type: "breakdown",
      data_needed: ["Company fundamentals", "Revenue breakdown"],
      tools_to_use: companySymbol ? ["get_company_fundamentals", "search_web"] : ["search_web"],
      layout_plan: "Hierarchical breakdown",
      estimated_elements: 6
    }
    
    writer.write('plan', {
      title: plan.diagram_title,
      type: plan.diagram_type,
      checklist: plan.data_needed.map((item: string) => ({ item, status: 'pending' })),
      tools: plan.tools_to_use,
      layout: plan.layout_plan,
      estimated_elements: plan.estimated_elements
    })
  }
  
  // ========== PHASE 2: RESEARCH ==========
  writer.write('status', { stage: 'researching', message: 'Gathering data...' })
  
  const conversationHistory: Array<{ role: string; parts: unknown[] }> = [
    { role: "user", parts: [{ text: userPrompt + "\n\nYour plan:\n" + JSON.stringify(plan, null, 2) + "\n\nNow execute the tools in your plan to gather the data." }] }
  ]
  
  const gatheredData: Record<string, unknown> = {}
  const maxResearchIterations = 10
  
  for (let i = 0; i < maxResearchIterations; i++) {
    const researchResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: "You are gathering data for a diagram. Call the tools in your plan to get the data needed. Once you have all the data, say 'DATA_GATHERING_COMPLETE'." }] },
          { role: "model", parts: [{ text: "I'll call the tools to gather the data needed for the diagram." }] },
          ...conversationHistory
        ],
        tools: [{ functionDeclarations: researchToolDeclarations }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 4096 }
      })
    })
    
    if (!researchResponse.ok) {
      throw new Error("Research phase failed: " + researchResponse.status)
    }
    
    const researchData = await researchResponse.json()
    const researchContent = researchData.candidates?.[0]?.content
    
    const functionCall = researchContent?.parts?.find((p: any) => p.functionCall)?.functionCall
    
    if (functionCall) {
      writer.write('tool_call', {
        tool: functionCall.name,
        args: functionCall.args,
        message: `Fetching: ${functionCall.name}...`
      })
      
      const toolResult = await executeTool(supabase, functionCall.name, functionCall.args || {})
      gatheredData[functionCall.name] = toolResult
      
      // Update checklist item
      writer.write('checklist_update', {
        tool: functionCall.name,
        status: 'complete'
      })
      
      writer.write('tool_result', {
        tool: functionCall.name,
        success: !('error' in (toolResult as any)),
        message: `Got data from ${functionCall.name}`
      })
      
      conversationHistory.push({
        role: "model",
        parts: [{ functionCall: functionCall }]
      })
      conversationHistory.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: functionCall.name,
            response: { result: toolResult }
          }
        }]
      })
      
      continue
    }
    
    // Check if AI says it's done gathering data
    const textPart = researchContent?.parts?.find((p: any) => p.text)?.text
    if (textPart && textPart.includes('DATA_GATHERING_COMPLETE')) {
      break
    }
    
    // If no function call and no completion signal, break to avoid infinite loop
    if (!functionCall && i > 2) {
      break
    }
  }
  
  // ========== PHASE 3: DESIGN ==========
  writer.write('status', { stage: 'designing', message: 'Creating diagram layout...' })
  
  const designPrompt = `Based on your plan and the gathered data, create the Excalidraw diagram JSON.

YOUR PLAN:
${JSON.stringify(plan, null, 2)}

GATHERED DATA:
${JSON.stringify(gatheredData, null, 2)}

Now output ONLY the Excalidraw JSON following the design system. Use the real data values in your labels.`

  const designHistory: Array<{ role: string; parts: unknown[] }> = [
    { role: "user", parts: [{ text: designPrompt }] }
  ]
  
  const maxDesignIterations = 5
  
  for (let i = 0; i < maxDesignIterations; i++) {
    writer.write('status', { 
      stage: 'designing', 
      message: i === 0 ? 'Creating diagram layout...' : 'Refining diagram...',
      iteration: i
    })
    
    const designResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: EXCALIDRAW_EXPERT_PROMPT }] },
          { role: "model", parts: [{ text: "I'll create the Excalidraw diagram JSON using the gathered data and following the strict grid system." }] },
          ...designHistory
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 16384 }
      })
    })
    
    if (!designResponse.ok) {
      throw new Error("Design phase failed: " + designResponse.status)
    }
    
    const designData = await designResponse.json()
    const designContent = designData.candidates?.[0]?.content
    const textPart = designContent?.parts?.find((p: any) => p.text)?.text
    
    if (textPart) {
      writer.write('status', { stage: 'parsing', message: 'Parsing diagram data...' })
      
      try {
        const jsonMatch = textPart.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || textPart.match(/(\{[\s\S]*\})/)
        
        if (!jsonMatch) {
          throw new Error("Could not find JSON structure")
        }
        
        const jsonStr = jsonMatch[1].trim()
        const parsed = JSON.parse(jsonStr)
        
        if (parsed.elements && Array.isArray(parsed.elements)) {
          // Validate shapes have labels
          const shapesWithoutLabels = parsed.elements.filter((el: any) => 
            ['rectangle', 'ellipse', 'diamond'].includes(el.type) && !el.label
          )
          
          if (shapesWithoutLabels.length > 0) {
            writer.write('status', { stage: 'refining', message: 'Adding missing labels...' })
            designHistory.push({ role: "model", parts: [{ text: textPart }] })
            designHistory.push({ role: "user", parts: [{ text: "Some shapes are missing labels. Every shape MUST have a label with real data. Fix this." }] })
            continue
          }
          
          // Check minimum elements
          if (parsed.elements.length < plan.estimated_elements - 2) {
            writer.write('status', { stage: 'refining', message: 'Adding more detail...' })
            designHistory.push({ role: "model", parts: [{ text: textPart }] })
            designHistory.push({ role: "user", parts: [{ text: `Only ${parsed.elements.length} elements. Your plan called for ${plan.estimated_elements}. Add more detail based on the gathered data.` }] })
            continue
          }
          
          // Success!
          const diagramName = plan.diagram_title || request.substring(0, 50)
          
          writer.write('status', { stage: 'saving', message: `Generated ${parsed.elements.length} elements. Saving...` })
          
          // Save to database
          let savedDiagram = null
          if (chatId && userId) {
            const { data: dbDiagram, error: saveError } = await supabase
              .from('chat_diagrams')
              .insert({
                chat_id: chatId,
                user_id: userId,
                name: diagramName,
                excalidraw_data: {
                  type: 'excalidraw',
                  version: 2,
                  elements: parsed.elements,
                  appState: parsed.appState || { viewBackgroundColor: "#1e1e1e" },
                  files: {}
                },
                is_ai_generated: true,
                generation_prompt: request,
                status: 'completed'
              })
              .select()
              .single()
            
            if (saveError) {
              console.error("Error saving diagram:", saveError)
            }
            savedDiagram = dbDiagram || {
              diagram_id: 'temp-' + Date.now(),
              name: diagramName,
              excalidraw_data: { type: 'excalidraw', version: 2, elements: parsed.elements, appState: parsed.appState || { viewBackgroundColor: "#1e1e1e" }, files: {} },
              is_ai_generated: true
            }
          } else {
            savedDiagram = {
              diagram_id: 'temp-' + Date.now(),
              name: diagramName,
              excalidraw_data: { type: 'excalidraw', version: 2, elements: parsed.elements, appState: parsed.appState || { viewBackgroundColor: "#1e1e1e" }, files: {} },
              is_ai_generated: true
            }
          }
          
          writer.write('complete', { success: true, diagram: savedDiagram, message: 'Diagram generated successfully!' })
          return
        }
      } catch (parseError) {
        console.error("Parse error:", parseError)
        writer.write('status', { stage: 'refining', message: 'Fixing JSON format...' })
        designHistory.push({ role: "model", parts: [{ text: textPart }] })
        designHistory.push({ role: "user", parts: [{ text: "Invalid JSON. Return ONLY valid JSON starting with { and ending with }. No markdown." }] })
        continue
      }
    }
  }
  
  throw new Error("Failed to generate diagram after maximum iterations")
}

// ============================================================================
// HTTP Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const { request, company_symbol, company_name, chat_context, chat_id, user_id } = await req.json()
    
    if (!request) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    console.log("Generating diagram for request:", request)
    console.log("Company:", company_symbol, company_name)
    
    const writer = createStreamWriter()
    
    generateDiagramWithStreaming(
      supabase,
      writer,
      request,
      company_symbol || '',
      company_name || '',
      chat_context || '',
      chat_id || null,
      user_id || null
    ).catch((error) => {
      console.error("Generation error:", error)
      writer.write('error', { success: false, error: String(error), message: 'Diagram generation failed' })
    }).finally(() => {
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
    console.error("CRITICAL ERROR:", error)
    return new Response(
      JSON.stringify({ success: false, error: String(error), message: 'Diagram generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

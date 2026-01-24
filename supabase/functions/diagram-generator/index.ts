// Diagram Generator - Dedicated AI agent for generating Excalidraw diagrams directly
// This agent is an expert in designing and building diagrams in Excalidraw format
// NOW WITH STREAMING PROGRESS UPDATES

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
// Focused Tool Declarations
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
// Tool Execution
// ============================================================================

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  console.log("Executing tool:", toolName, args)
  
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
        return { error: "Could not find data for " + symbol }
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
            contents: [{ parts: [{ text: "Search and summarize: " + query }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
          })
        })
        
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
      return { error: "Unknown tool: " + toolName }
  }
}

// ============================================================================
// EXCALIDRAW EXPERT PROMPT - Grid-Constrained for Perfect Layouts
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = `You are an EXPERT information architect and Excalidraw diagram designer.
Your job is to fetch real financial data and visualize it beautifully.

## STRICT DESIGN SYSTEM & LAYOUT RULES
LLMs struggle with spatial layouts. You MUST strictly follow this grid system:

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
Arrows MUST connect shapes by ID. Do NOT provide x, y, width, height, or points for arrows.
The rendering engine calculates the path automatically.

{
  "type": "arrow",
  "id": "arrow_1",
  "start": { "id": "node_1" },
  "end": { "id": "node_2" },
  "strokeColor": "#495057",
  "strokeWidth": 2,
  "endArrowhead": "triangle",
  "label": { "text": "flows to" }
}

### 4. TEXT LABELS:
- Inside shapes: Use the "label" property. Keep text under 5 words.
- Titles: Use standalone text element at y=30

### 5. COLOR PALETTE (Financial Theme):
- Positive/Growth: backgroundColor="#d3f9d8", strokeColor="#2b8a3e"
- Negative/Risk: backgroundColor="#ffe3e3", strokeColor="#c92a2a"
- Neutral/Info: backgroundColor="#e7f5ff", strokeColor="#1864ab"
- Revenue/Money: backgroundColor="#fff3bf", strokeColor="#f08c00"
- Primary: backgroundColor="#d0bfff", strokeColor="#7950f2"

## SKELETON JSON SCHEMA

Return ONLY valid JSON. No markdown, no explanation.

{
  "elements": [
    {
      "id": "title",
      "type": "text",
      "x": 400,
      "y": 30,
      "text": "Company Revenue Breakdown",
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
      "label": { "text": "Total Revenue\\n$85B", "fontSize": 18 }
    },
    {
      "id": "node_2",
      "type": "rectangle",
      "x": 100,
      "y": 300,
      "width": 250,
      "height": 100,
      "backgroundColor": "#d3f9d8",
      "strokeColor": "#2b8a3e",
      "label": { "text": "Products\\n$65B", "fontSize": 18 }
    },
    {
      "id": "node_3",
      "type": "rectangle",
      "x": 450,
      "y": 300,
      "width": 250,
      "height": 100,
      "backgroundColor": "#fff3bf",
      "strokeColor": "#f08c00",
      "label": { "text": "Services\\n$20B", "fontSize": 18 }
    },
    {
      "id": "arrow_1",
      "type": "arrow",
      "start": { "id": "node_1" },
      "end": { "id": "node_2" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    },
    {
      "id": "arrow_2",
      "type": "arrow",
      "start": { "id": "node_1" },
      "end": { "id": "node_3" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    }
  ],
  "appState": { "viewBackgroundColor": "#1e1e1e" }
}

REMEMBER:
1. Use the EXACT grid positions (100, 450, 800 for X; 100, 300, 500 for Y)
2. Every shape MUST have a "label" with "text"
3. Arrows use "start": {"id": "..."} and "end": {"id": "..."} - NO coordinates
4. Return ONLY JSON, nothing else`

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
// Diagram Generation with Streaming
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
  
  writer.write('status', { stage: 'starting', message: 'Initializing diagram generation...' })
  
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY
  
  // Build the user prompt
  let userPrompt = "Create a diagram for: " + request
  if (companySymbol) {
    userPrompt += "\n\nCompany: " + companyName + " (" + companySymbol + ")"
    userPrompt += "\n\nIMPORTANT: Use the search_web or get_company_fundamentals tool to get real data about this company before creating the diagram."
  }
  if (chatContext) {
    userPrompt += "\n\nContext from conversation:\n" + chatContext
  }
  
  const conversationHistory: Array<{ role: string; parts: unknown[] }> = [
    { role: "user", parts: [{ text: userPrompt }] }
  ]
  
  const maxIterations = 10
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    writer.write('status', { 
      stage: 'thinking', 
      message: `AI is designing the diagram... (step ${iteration + 1})`,
      iteration 
    })
    
    const requestBody = {
      contents: [
        { role: "user", parts: [{ text: EXCALIDRAW_EXPERT_PROMPT }] },
        { role: "model", parts: [{ text: "I understand. I will create Excalidraw diagrams using the strict grid system (X: 100, 450, 800; Y: 100, 300, 500), standard sizes (250x100 rectangles), and arrow bindings with start/end IDs. I will return only valid JSON." }] },
        ...conversationHistory
      ],
      tools: [{ functionDeclarations: diagramToolDeclarations }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      }
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API error:", errorText)
      throw new Error("AI service error: " + response.status)
    }
    
    const data = await response.json()
    const content = data.candidates?.[0]?.content
    
    if (!content) {
      throw new Error("No response from AI")
    }
    
    // Check for function calls
    const functionCall = content.parts?.find((p: any) => p.functionCall)?.functionCall
    
    if (functionCall) {
      writer.write('tool_call', { 
        tool: functionCall.name, 
        args: functionCall.args,
        message: `Using tool: ${functionCall.name}`
      })
      
      // Execute the tool
      const toolResult = await executeTool(supabase, functionCall.name, functionCall.args || {})
      
      writer.write('tool_result', { 
        tool: functionCall.name, 
        success: !('error' in (toolResult as any)),
        message: `Completed: ${functionCall.name}`
      })
      
      // Add to conversation
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
    
    // Check for text response (should be JSON)
    const textPart = content.parts?.find((p: any) => p.text)?.text
    
    if (textPart) {
      writer.write('status', { stage: 'parsing', message: 'Parsing diagram data...' })
      
      try {
        // Extract JSON from response
        const jsonMatch = textPart.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || textPart.match(/(\{[\s\S]*\})/)
        
        if (!jsonMatch) {
          throw new Error("Could not find JSON structure in response")
        }
        
        const jsonStr = jsonMatch[1].trim()
        const parsed = JSON.parse(jsonStr)
        
        if (parsed.elements && Array.isArray(parsed.elements)) {
          // Validate that shapes have labels
          const shapesWithoutLabels = parsed.elements.filter((el: any) => 
            ['rectangle', 'ellipse', 'diamond'].includes(el.type) && !el.label
          )
          
          if (shapesWithoutLabels.length > 0) {
            console.log("Warning: Found shapes without labels, asking AI to fix")
            writer.write('status', { stage: 'retrying', message: 'Adding missing labels...' })
            
            conversationHistory.push({
              role: "model",
              parts: [{ text: textPart }]
            })
            conversationHistory.push({
              role: "user",
              parts: [{ text: `Some shapes are missing labels. Every rectangle, ellipse, and diamond MUST have a "label" property with "text" inside. Please regenerate the JSON with proper labels for all shapes.` }]
            })
            continue
          }
          
          const diagramName = request.length > 50 ? request.substring(0, 47) + "..." : request
          
          writer.write('status', { 
            stage: 'saving', 
            message: `Generated ${parsed.elements.length} elements. Saving...` 
          })
          
          // Save to database if chat_id is provided
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
              savedDiagram = {
                diagram_id: 'temp-' + Date.now(),
                name: diagramName,
                excalidraw_data: {
                  type: 'excalidraw',
                  version: 2,
                  elements: parsed.elements,
                  appState: parsed.appState || { viewBackgroundColor: "#1e1e1e" },
                  files: {}
                },
                is_ai_generated: true
              }
            } else {
              savedDiagram = dbDiagram
            }
          } else {
            savedDiagram = {
              diagram_id: 'temp-' + Date.now(),
              name: diagramName,
              excalidraw_data: {
                type: 'excalidraw',
                version: 2,
                elements: parsed.elements,
                appState: parsed.appState || { viewBackgroundColor: "#1e1e1e" },
                files: {}
              },
              is_ai_generated: true
            }
          }
          
          // Send completion event
          writer.write('complete', { 
            success: true, 
            diagram: savedDiagram,
            message: 'Diagram generated successfully!'
          })
          
          return
        } else {
          throw new Error("Response missing elements array")
        }
      } catch (parseError) {
        console.error("JSON parse error:", parseError)
        
        if (iteration >= maxIterations - 1) {
          throw new Error("Failed to parse diagram JSON: " + String(parseError))
        }
        
        writer.write('status', { stage: 'retrying', message: 'Fixing JSON format...' })
        
        conversationHistory.push({
          role: "model",
          parts: [{ text: textPart }]
        })
        conversationHistory.push({
          role: "user",
          parts: [{ text: "That response was not valid JSON. Please return ONLY a valid JSON object with an 'elements' array and 'appState' object. No markdown, no explanations - just the raw JSON starting with { and ending with }." }]
        })
        continue
      }
    }
    
    throw new Error("Unexpected response format")
  }
  
  throw new Error("Max iterations reached without generating diagram")
}

// ============================================================================
// HTTP Handler
// ============================================================================

serve(async (req) => {
  // CORS preflight
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
    
    // Create streaming response
    const writer = createStreamWriter()
    
    // Start generation in background
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
      writer.write('error', { 
        success: false, 
        error: String(error),
        message: 'Diagram generation failed'
      })
    }).finally(() => {
      writer.close()
    })
    
    // Return streaming response
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
      JSON.stringify({ 
        success: false, 
        error: String(error),
        message: 'Diagram generation failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

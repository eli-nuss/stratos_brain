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
// EXCALIDRAW EXPERT PROMPT
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = `You are an EXPERT diagram designer specializing in Excalidraw. Your purpose is to create beautiful, clear, and informative diagrams in Excalidraw's native JSON format.

## YOUR EXPERTISE

You are a master of:
1. Information architecture and visual hierarchy
2. Layout and spacing for maximum clarity
3. Color theory for data visualization
4. Excalidraw's element schema and capabilities

## EXCALIDRAW ELEMENT SCHEMA

### Element Types
1. rectangle - Boxes for entities, containers
2. ellipse - Circles for nodes, emphasis
3. diamond - Decision points
4. text - Labels
5. arrow - Connections with arrowheads
6. line - Connections without arrowheads

### Required Properties for ALL Elements
- type: Element type
- x: X coordinate
- y: Y coordinate

### Shape Elements (rectangle, ellipse, diamond)
{
  "type": "rectangle",
  "id": "unique-id-1",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 80,
  "backgroundColor": "#a5d8ff",
  "strokeColor": "#1971c2",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "fillStyle": "solid",
  "label": {
    "text": "Box Label",
    "fontSize": 16
  }
}

### Text Elements
{
  "type": "text",
  "x": 100,
  "y": 50,
  "text": "Title Text",
  "fontSize": 28,
  "strokeColor": "#1864ab"
}

### Arrow Elements
{
  "type": "arrow",
  "x": 200,
  "y": 150,
  "width": 150,
  "height": 0,
  "strokeColor": "#495057",
  "strokeWidth": 2,
  "startArrowhead": null,
  "endArrowhead": "triangle"
}

## COLOR PALETTE

### Primary Colors
- Blue: #339af0, #228be6, #1c7ed6
- Green: #51cf66, #40c057, #2f9e44
- Red: #ff6b6b, #fa5252, #e03131
- Purple: #845ef7, #7950f2

### Background Colors (lighter)
- Light Blue: #a5d8ff, #d0ebff
- Light Green: #d8f5a2, #b2f2bb
- Light Yellow: #fff3bf
- Light Red: #ffc9c9

### Neutral Colors
- Dark Gray: #495057, #343a40
- White: #ffffff

## LAYOUT GUIDELINES

- Use multiples of 50 for coordinates
- Standard spacing: 80-120 pixels
- Element sizes: width 150-250, height 60-100

## OUTPUT FORMAT

You MUST return ONLY a valid JSON object with this structure:
{
  "elements": [...array of Excalidraw elements...],
  "appState": {
    "viewBackgroundColor": "#1e1e1e"
  }
}

NO markdown code blocks, NO explanations, NO preamble - ONLY the raw JSON.`

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
  }
  if (chatContext) {
    userPrompt += "\n\nContext from conversation:\n" + chatContext
  }
  
  const conversationHistory: Array<{ role: string; parts: unknown[] }> = [
    { role: "user", parts: [{ text: userPrompt }] }
  ]
  
  const maxIterations = 8
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    writer.write('status', { 
      stage: 'thinking', 
      message: `AI is designing the diagram... (step ${iteration + 1})`,
      iteration 
    })
    
    const requestBody = {
      contents: [
        { role: "user", parts: [{ text: EXCALIDRAW_EXPERT_PROMPT }] },
        { role: "model", parts: [{ text: "I understand. I will create Excalidraw diagrams and return only valid JSON." }] },
        ...conversationHistory
      ],
      tools: [{ functionDeclarations: diagramToolDeclarations }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
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
              // Create temp diagram
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
        
        // Ask the model to fix the JSON
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

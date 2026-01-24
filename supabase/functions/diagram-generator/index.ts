// Diagram Generator - Dedicated AI agent for generating Excalidraw diagrams directly
// This agent is an expert in designing and building diagrams in Excalidraw format

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
const GEMINI_MODEL = 'gemini-3-pro-preview'

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
// EXCALIDRAW EXPERT PROMPT (using string concatenation to avoid template literal issues)
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = [
  "You are an EXPERT diagram designer specializing in Excalidraw. Your purpose is to create beautiful, clear, and informative diagrams in Excalidraw's native JSON format.",
  "",
  "## YOUR EXPERTISE",
  "",
  "You are a master of:",
  "1. Information architecture and visual hierarchy",
  "2. Layout and spacing for maximum clarity",
  "3. Color theory for data visualization",
  "4. Excalidraw's element schema and capabilities",
  "",
  "## EXCALIDRAW ELEMENT SCHEMA - COMPLETE REFERENCE",
  "",
  "### Element Types Available",
  "",
  "1. rectangle - Rectangular boxes (great for entities, containers, data cards)",
  "2. ellipse - Oval/circular shapes (great for start/end nodes, emphasis)",
  "3. diamond - Diamond shapes (great for decision points, conditions)",
  "4. text - Standalone text labels",
  "5. arrow - Arrows connecting elements (with optional labels)",
  "6. line - Lines without arrowheads",
  "",
  "### Required Properties for ALL Elements",
  "",
  "Every element MUST have:",
  "- type: The element type (rectangle, ellipse, diamond, text, arrow, line)",
  "- x: X coordinate (horizontal position from left)",
  "- y: Y coordinate (vertical position from top)",
  "",
  "### Shape Elements (rectangle, ellipse, diamond)",
  "",
  "Example rectangle:",
  "{",
  '  "type": "rectangle",',
  '  "id": "unique-id-1",',
  '  "x": 100,',
  '  "y": 100,',
  '  "width": 200,',
  '  "height": 80,',
  '  "backgroundColor": "#a5d8ff",',
  '  "strokeColor": "#1971c2",',
  '  "strokeWidth": 2,',
  '  "strokeStyle": "solid",',
  '  "fillStyle": "solid",',
  '  "label": {',
  '    "text": "Box Label",',
  '    "fontSize": 16,',
  '    "strokeColor": "#000000"',
  '  }',
  "}",
  "",
  "Optional Properties:",
  "- id: Unique identifier (REQUIRED if you want to connect arrows to this element)",
  "- width: Width in pixels (default ~100)",
  "- height: Height in pixels (default ~100)",
  "- backgroundColor: Fill color in hex (e.g., '#a5d8ff')",
  "- strokeColor: Border color in hex (e.g., '#1971c2')",
  "- strokeWidth: Border thickness (1, 2, or 4)",
  "- strokeStyle: 'solid', 'dashed', or 'dotted'",
  "- fillStyle: 'solid', 'hachure', or 'cross-hatch'",
  "- label: Object with text inside the shape",
  "",
  "### Text Elements",
  "",
  "Example text:",
  "{",
  '  "type": "text",',
  '  "x": 100,',
  '  "y": 50,',
  '  "text": "Title Text",',
  '  "fontSize": 28,',
  '  "strokeColor": "#1864ab"',
  "}",
  "",
  "Properties:",
  "- text: The text content (REQUIRED)",
  "- fontSize: Font size in pixels (16, 20, 28, 36 are good sizes)",
  "- strokeColor: Text color in hex",
  "",
  "### Arrow Elements",
  "",
  "Example arrow:",
  "{",
  '  "type": "arrow",',
  '  "x": 200,',
  '  "y": 150,',
  '  "width": 150,',
  '  "height": 0,',
  '  "strokeColor": "#495057",',
  '  "strokeWidth": 2,',
  '  "startArrowhead": null,',
  '  "endArrowhead": "triangle"',
  "}",
  "",
  "Properties:",
  "- width: Horizontal length of arrow",
  "- height: Vertical offset (0 for horizontal, positive for downward)",
  "- startArrowhead: null, 'arrow', 'bar', 'dot', 'triangle'",
  "- endArrowhead: null, 'arrow', 'bar', 'dot', 'triangle'",
  "- label: Optional label on the arrow",
  "",
  "## COLOR PALETTE (USE THESE EXACT HEX VALUES)",
  "",
  "### Primary Colors",
  "- Blue: #339af0, #228be6, #1c7ed6, #1971c2, #1864ab",
  "- Green: #51cf66, #40c057, #2f9e44, #099268",
  "- Red: #ff6b6b, #fa5252, #e03131",
  "- Orange: #ff922b, #fd7e14, #e8590c",
  "- Yellow: #fcc419, #fab005, #f59f00",
  "- Purple: #845ef7, #7950f2, #6741d9, #5f3dc4",
  "",
  "### Background Colors (lighter, for fills)",
  "- Light Blue: #a5d8ff, #d0ebff",
  "- Light Green: #d8f5a2, #c0eb75, #b2f2bb",
  "- Light Yellow: #fff3bf, #ffec99",
  "- Light Red: #ffc9c9, #ffe3e3",
  "- Light Purple: #e5dbff, #d0bfff",
  "",
  "### Neutral Colors",
  "- Dark Gray: #495057, #343a40, #212529",
  "- Medium Gray: #868e96, #adb5bd",
  "- White: #ffffff",
  "",
  "## LAYOUT GUIDELINES",
  "",
  "### Grid-Based Positioning",
  "- Use multiples of 50 for x and y coordinates",
  "- Standard spacing between elements: 80-120 pixels",
  "- Typical element sizes: width 150-250, height 60-100",
  "",
  "### Common Layouts",
  "",
  "1. HORIZONTAL FLOW (left to right):",
  "   - Start at x=100, y=200",
  "   - Each subsequent element: x += 250",
  "",
  "2. VERTICAL FLOW (top to bottom):",
  "   - Start at x=400, y=100",
  "   - Each subsequent element: y += 120",
  "",
  "3. GRID LAYOUT (for comparisons):",
  "   - Row 1: y=100, Row 2: y=220, Row 3: y=340",
  "   - Col 1: x=100, Col 2: x=350, Col 3: x=600",
  "",
  "4. RADIAL/HUB LAYOUT (for relationships):",
  "   - Center element at x=400, y=300",
  "   - Surrounding elements at radius ~200 pixels",
  "",
  "## OUTPUT FORMAT",
  "",
  "You MUST return a valid JSON object with this structure:",
  "{",
  '  "elements": [',
  "    // Array of Excalidraw elements",
  "  ],",
  '  "appState": {',
  '    "viewBackgroundColor": "#1e1e1e"',
  "  }",
  "}",
  "",
  "## IMPORTANT RULES",
  "",
  "1. ALWAYS return valid JSON - no markdown, no explanations, just the JSON object",
  "2. Use unique IDs for elements you want to connect with arrows",
  "3. Position elements to avoid overlap",
  "4. Use consistent colors within the same diagram",
  "5. Add clear labels to all important elements",
  "6. Create a title text element at the top of the diagram",
  "7. Use arrows to show relationships and flow",
  "8. Keep diagrams clean and uncluttered"
].join("\n")

// ============================================================================
// Main Diagram Generation Logic
// ============================================================================

async function generateDiagram(
  supabase: ReturnType<typeof createClient>,
  request: string,
  companySymbol: string,
  companyName: string,
  chatContext: string
): Promise<{ elements: unknown[]; appState: unknown; name: string }> {
  
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY
  
  // Build the initial prompt
  const userPrompt = [
    "Create a diagram for the following request:",
    "",
    "REQUEST: " + request,
    "",
    "COMPANY CONTEXT:",
    "- Symbol: " + companySymbol,
    "- Name: " + companyName,
    "",
    chatContext ? ("CHAT CONTEXT:\n" + chatContext) : "",
    "",
    "First, use the available tools to gather any data you need. Then create the diagram.",
    "Remember to return ONLY valid JSON with the elements array and appState."
  ].join("\n")
  
  let conversationHistory: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }> = [
    { role: "user", parts: [{ text: userPrompt }] }
  ]
  
  const maxIterations = 5
  let iteration = 0
  
  while (iteration < maxIterations) {
    iteration++
    console.log("Diagram generation iteration:", iteration)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: EXCALIDRAW_EXPERT_PROMPT }] },
        contents: conversationHistory,
        tools: [{ functionDeclarations: diagramToolDeclarations }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API error:", errorText)
      throw new Error("Failed to generate diagram: " + response.status)
    }
    
    const data = await response.json()
    const candidate = data.candidates?.[0]
    const content = candidate?.content
    const finishReason = candidate?.finishReason
    
    console.log("Finish reason:", finishReason)
    
    if (!content) {
      throw new Error("No content in response")
    }
    
    // Check for function calls
    const functionCall = content.parts?.find((p: any) => p.functionCall)?.functionCall
    
    if (functionCall) {
      console.log("Function call:", functionCall.name)
      
      // Execute the tool
      const toolResult = await executeTool(supabase, functionCall.name, functionCall.args || {})
      
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
      console.log("Got text response, attempting to parse as JSON")
      console.log("Raw text length:", textPart.length)
      
      try {
        // THE FIX: Use regex to extract the JSON object, ignoring any preamble text
        // This handles cases where the AI includes conversational text like "Here is the diagram:"
        const jsonMatch = textPart.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || textPart.match(/(\{[\s\S]*\})/)
        
        if (!jsonMatch) {
          throw new Error("Could not find JSON structure in response")
        }
        
        const jsonStr = jsonMatch[1].trim()
        console.log("Extracted JSON length:", jsonStr.length)
        
        const parsed = JSON.parse(jsonStr)
        
        if (parsed.elements && Array.isArray(parsed.elements)) {
          // Generate a name from the request
          const diagramName = request.length > 50 ? request.substring(0, 47) + "..." : request
          
          console.log("Successfully parsed diagram with", parsed.elements.length, "elements")
          
          return {
            elements: parsed.elements,
            appState: parsed.appState || { viewBackgroundColor: "#1e1e1e" },
            name: diagramName
          }
        } else {
          throw new Error("Response missing elements array")
        }
      } catch (parseError) {
        console.error("JSON parse error:", parseError)
        console.error("Raw text (first 1000 chars):", textPart.substring(0, 1000))
        
        // If we've tried multiple times, throw
        if (iteration >= maxIterations) {
          throw new Error("Failed to parse diagram JSON after " + maxIterations + " attempts: " + String(parseError))
        }
        
        // Ask the model to fix the JSON
        conversationHistory.push({
          role: "model",
          parts: [{ text: textPart }]
        })
        conversationHistory.push({
          role: "user",
          parts: [{ text: "That response was not valid JSON. Please return ONLY a valid JSON object with an 'elements' array and 'appState' object. No markdown, no explanations, no preamble text - just the raw JSON starting with { and ending with }." }]
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
  // 1. ALWAYS return CORS for OPTIONS - this must be first
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
    console.log("Chat ID:", chat_id, "User ID:", user_id)
    
    // Generate the diagram
    const result = await generateDiagram(
      supabase,
      request,
      company_symbol || '',
      company_name || '',
      chat_context || ''
    )
    
    console.log("Diagram generated successfully with", result.elements?.length || 0, "elements")
    
    // Save to database if chat_id is provided
    if (chat_id && user_id) {
      const { data: savedDiagram, error: saveError } = await supabase
        .from('chat_diagrams')
        .insert({
          chat_id,
          user_id,
          name: result.name,
          excalidraw_data: {
            type: 'excalidraw',
            version: 2,
            elements: result.elements,
            appState: result.appState,
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
        // Still return the diagram even if save failed
        return new Response(
          JSON.stringify({
            success: true,
            diagram: {
              diagram_id: 'temp-' + Date.now(),
              name: result.name,
              excalidraw_data: {
                type: 'excalidraw',
                version: 2,
                elements: result.elements,
                appState: result.appState,
                files: {}
              },
              is_ai_generated: true
            },
            warning: 'Diagram generated but failed to save: ' + saveError.message
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log("Diagram saved with ID:", savedDiagram.diagram_id)
      return new Response(
        JSON.stringify({ success: true, diagram: savedDiagram }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Return the diagram without saving
    return new Response(
      JSON.stringify({
        success: true,
        diagram: {
          diagram_id: 'temp-' + Date.now(),
          name: result.name,
          excalidraw_data: {
            type: 'excalidraw',
            version: 2,
            elements: result.elements,
            appState: result.appState,
            files: {}
          },
          is_ai_generated: true
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    // 2. GUARANTEE CORS headers are returned even on a crash
    console.error("CRITICAL ERROR in diagram generation:", error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(error),
        message: 'Diagram generation failed. The AI may have timed out or encountered an error.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

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
const GEMINI_MODEL = 'gemini-3-pro-preview' // Use pro for better diagram design

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
  console.log(\`Executing tool: \${toolName}\`, args)
  
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
        return { error: \`Could not find data for \${symbol}\` }
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
        return { error: \`Could not find company \${symbol}\` }
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
        const searchResponse = await fetch(
          \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=\${GEMINI_API_KEY}\`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: \`Search and summarize: \${query}\` }] }],
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
      return { error: \`Unknown tool: \${toolName}\` }
  }
}

// ============================================================================
// COMPREHENSIVE EXCALIDRAW DOCUMENTATION FOR THE AI
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = \`You are an EXPERT diagram designer specializing in Excalidraw. Your purpose is to create beautiful, clear, and informative diagrams in Excalidraw's native JSON format.

## YOUR EXPERTISE

You are a master of:
1. Information architecture and visual hierarchy
2. Layout and spacing for maximum clarity
3. Color theory for data visualization
4. Excalidraw's element schema and capabilities

## EXCALIDRAW ELEMENT SCHEMA - COMPLETE REFERENCE

### Element Types Available

1. **rectangle** - Rectangular boxes (great for entities, containers, data cards)
2. **ellipse** - Oval/circular shapes (great for start/end nodes, emphasis)
3. **diamond** - Diamond shapes (great for decision points, conditions)
4. **text** - Standalone text labels
5. **arrow** - Arrows connecting elements (with optional labels)
6. **line** - Lines without arrowheads

### Required Properties for ALL Elements

Every element MUST have:
- \`type\`: The element type (rectangle, ellipse, diamond, text, arrow, line)
- \`x\`: X coordinate (horizontal position from left)
- \`y\`: Y coordinate (vertical position from top)

### Shape Elements (rectangle, ellipse, diamond)

\`\`\`json
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
    "fontSize": 16,
    "strokeColor": "#000000"
  }
}
\`\`\`

**Optional Properties:**
- \`id\`: Unique identifier (REQUIRED if you want to connect arrows to this element)
- \`width\`: Width in pixels (default ~100)
- \`height\`: Height in pixels (default ~100)
- \`backgroundColor\`: Fill color in hex (e.g., "#a5d8ff")
- \`strokeColor\`: Border color in hex (e.g., "#1971c2")
- \`strokeWidth\`: Border thickness (1, 2, or 4)
- \`strokeStyle\`: "solid", "dashed", or "dotted"
- \`fillStyle\`: "solid", "hachure", or "cross-hatch"
- \`label\`: Object with text inside the shape

### Text Elements

\`\`\`json
{
  "type": "text",
  "x": 100,
  "y": 50,
  "text": "Title Text",
  "fontSize": 28,
  "strokeColor": "#1864ab"
}
\`\`\`

**Properties:**
- \`text\`: The text content (REQUIRED)
- \`fontSize\`: Font size in pixels (16, 20, 28, 36 are good sizes)
- \`strokeColor\`: Text color in hex

### Arrow Elements

\`\`\`json
{
  "type": "arrow",
  "x": 200,
  "y": 150,
  "width": 150,
  "height": 0,
  "strokeColor": "#495057",
  "strokeWidth": 2,
  "startArrowhead": null,
  "endArrowhead": "triangle",
  "label": {
    "text": "Arrow Label"
  }
}
\`\`\`

**Properties:**
- \`width\`: Horizontal length of arrow
- \`height\`: Vertical offset (0 for horizontal, positive for downward)
- \`startArrowhead\`: null, "arrow", "bar", "dot", "triangle"
- \`endArrowhead\`: null, "arrow", "bar", "dot", "triangle"
- \`label\`: Optional label on the arrow

### BINDING ARROWS TO SHAPES (CRITICAL)

To connect arrows between shapes, use \`start\` and \`end\` properties with the shape's \`id\`:

\`\`\`json
{
  "type": "arrow",
  "x": 200,
  "y": 200,
  "start": { "id": "shape-1" },
  "end": { "id": "shape-2" }
}
\`\`\`

You can also create shapes at arrow endpoints:

\`\`\`json
{
  "type": "arrow",
  "x": 200,
  "y": 200,
  "start": { "type": "rectangle", "width": 150, "height": 60 },
  "end": { "type": "ellipse", "width": 100, "height": 60 }
}
\`\`\`

## COLOR PALETTE (USE THESE EXACT HEX VALUES)

### Primary Colors
- Blue: #339af0, #228be6, #1c7ed6, #1971c2, #1864ab
- Green: #51cf66, #40c057, #2f9e44, #099268
- Red: #ff6b6b, #fa5252, #e03131
- Orange: #ff922b, #fd7e14, #e8590c
- Yellow: #fcc419, #fab005, #f59f00
- Purple: #845ef7, #7950f2, #6741d9, #5f3dc4
- Pink: #f06595, #e64980, #d6336c, #c2255c
- Teal: #20c997, #12b886, #0ca678
- Cyan: #22b8cf, #15aabf, #1098ad

### Background Colors (lighter, for fills)
- Light Blue: #a5d8ff, #d0ebff
- Light Green: #d8f5a2, #c0eb75, #b2f2bb
- Light Yellow: #fff3bf, #ffec99
- Light Red: #ffc9c9, #ffe3e3
- Light Purple: #e5dbff, #d0bfff
- Light Orange: #ffe8cc, #ffd8a8
- Light Gray: #f1f3f5, #e9ecef, #dee2e6

### Neutral Colors
- Dark Gray: #495057, #343a40, #212529
- Medium Gray: #868e96, #adb5bd
- White: #ffffff

## LAYOUT GUIDELINES

### Grid-Based Positioning
- Use multiples of 50 for x and y coordinates
- Standard spacing between elements: 80-120 pixels
- Keep diagrams centered (start around x: 100-200)

### Standard Element Sizes
- Small box: width: 120, height: 60
- Medium box: width: 180, height: 80
- Large box: width: 240, height: 100
- Decision diamond: width: 140, height: 100

### Hierarchy and Flow
- Top-to-bottom (TD): Most common for flowcharts
- Left-to-right (LR): Good for timelines, processes
- Center important elements, branch outward

## DIAGRAM TYPE TEMPLATES

### Flowchart Pattern
\`\`\`json
[
  { "type": "ellipse", "id": "start", "x": 200, "y": 50, "width": 120, "height": 60, "backgroundColor": "#a5d8ff", "label": { "text": "Start" } },
  { "type": "rectangle", "id": "step1", "x": 175, "y": 150, "width": 170, "height": 70, "backgroundColor": "#d8f5a2", "label": { "text": "Process Step" } },
  { "type": "diamond", "id": "decision", "x": 180, "y": 270, "width": 160, "height": 100, "backgroundColor": "#fff3bf", "label": { "text": "Decision?" } },
  { "type": "arrow", "x": 260, "y": 110, "start": { "id": "start" }, "end": { "id": "step1" } },
  { "type": "arrow", "x": 260, "y": 220, "start": { "id": "step1" }, "end": { "id": "decision" } }
]
\`\`\`

### Comparison Chart Pattern
\`\`\`json
[
  { "type": "text", "x": 200, "y": 30, "text": "Comparison Title", "fontSize": 28, "strokeColor": "#1864ab" },
  { "type": "rectangle", "id": "item1", "x": 50, "y": 100, "width": 200, "height": 150, "backgroundColor": "#a5d8ff", "strokeColor": "#1971c2", "strokeWidth": 2, "label": { "text": "Item A\\nMetric 1: Value\\nMetric 2: Value", "fontSize": 14 } },
  { "type": "rectangle", "id": "item2", "x": 300, "y": 100, "width": 200, "height": 150, "backgroundColor": "#d8f5a2", "strokeColor": "#2f9e44", "strokeWidth": 2, "label": { "text": "Item B\\nMetric 1: Value\\nMetric 2: Value", "fontSize": 14 } },
  { "type": "arrow", "x": 250, "y": 175, "width": 50, "strokeColor": "#868e96", "startArrowhead": "arrow", "endArrowhead": "arrow", "label": { "text": "vs" } }
]
\`\`\`

### Hierarchy/Org Chart Pattern
\`\`\`json
[
  { "type": "rectangle", "id": "top", "x": 200, "y": 50, "width": 160, "height": 60, "backgroundColor": "#845ef7", "strokeColor": "#5f3dc4", "label": { "text": "Top Level", "strokeColor": "#ffffff" } },
  { "type": "rectangle", "id": "child1", "x": 50, "y": 180, "width": 140, "height": 50, "backgroundColor": "#339af0", "label": { "text": "Child 1" } },
  { "type": "rectangle", "id": "child2", "x": 220, "y": 180, "width": 140, "height": 50, "backgroundColor": "#339af0", "label": { "text": "Child 2" } },
  { "type": "rectangle", "id": "child3", "x": 390, "y": 180, "width": 140, "height": 50, "backgroundColor": "#339af0", "label": { "text": "Child 3" } },
  { "type": "arrow", "x": 280, "y": 110, "start": { "id": "top" }, "end": { "id": "child1" } },
  { "type": "arrow", "x": 280, "y": 110, "start": { "id": "top" }, "end": { "id": "child2" } },
  { "type": "arrow", "x": 280, "y": 110, "start": { "id": "top" }, "end": { "id": "child3" } }
]
\`\`\`

### Market Map / Competitive Landscape Pattern
\`\`\`json
[
  { "type": "text", "x": 250, "y": 20, "text": "Market Landscape", "fontSize": 28, "strokeColor": "#1864ab" },
  { "type": "rectangle", "id": "leader", "x": 200, "y": 80, "width": 200, "height": 100, "backgroundColor": "#fcc419", "strokeColor": "#e8590c", "strokeWidth": 2, "label": { "text": "Market Leader\\n$XXB Revenue\\nXX% Share", "fontSize": 14 } },
  { "type": "rectangle", "id": "comp1", "x": 50, "y": 220, "width": 160, "height": 80, "backgroundColor": "#a5d8ff", "label": { "text": "Competitor 1\\n$XB Revenue", "fontSize": 12 } },
  { "type": "rectangle", "id": "comp2", "x": 230, "y": 220, "width": 160, "height": 80, "backgroundColor": "#d8f5a2", "label": { "text": "Competitor 2\\n$XB Revenue", "fontSize": 12 } },
  { "type": "rectangle", "id": "comp3", "x": 410, "y": 220, "width": 160, "height": 80, "backgroundColor": "#ffc9c9", "label": { "text": "Competitor 3\\n$XB Revenue", "fontSize": 12 } }
]
\`\`\`

## OUTPUT FORMAT

You MUST respond with a JSON object in this exact format:

{
  "name": "Short descriptive title (3-5 words)",
  "description": "One sentence describing what the diagram shows",
  "elements": [
    // Array of Excalidraw elements as documented above
  ]
}

## CRITICAL RULES

1. ALWAYS include \`type\`, \`x\`, \`y\` for every element
2. ALWAYS use \`id\` for shapes that will have arrows connected to them
3. ALWAYS use hex colors from the palette above
4. Use \`label\` for text inside shapes, NOT separate text elements
5. Use \\n for line breaks in label text
6. Keep labels concise (2-4 words per line)
7. Include actual data values from your research in the diagram
8. Plan layout on a grid with consistent spacing
9. Use color to convey meaning (e.g., green for positive, red for negative)
10. Return ONLY the JSON object, no markdown code blocks

## DESIGN PRINCIPLES

1. **Clarity**: Every element should have a clear purpose
2. **Hierarchy**: Use size and color to show importance
3. **Balance**: Distribute elements evenly across the canvas
4. **Consistency**: Use the same style for similar elements
5. **Data-Driven**: Include real numbers and facts from your research
\`

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
    
    console.log(\`Generating diagram for chat \${chat_id}: "\${user_request}"\`)
    
    // Build the user prompt
    let userPrompt = \`## User Request
\${user_request}

\`
    
    if (company_symbol) {
      userPrompt += \`## Company Context
- Symbol: \${company_symbol}
- Name: \${company_name || company_symbol}

\`
    }
    
    if (chat_summary) {
      userPrompt += \`## Recent Chat Context
\${chat_summary}

\`
    }
    
    userPrompt += \`## Instructions
1. First, use the available tools to gather any data you need for the diagram
2. Then, design and generate the Excalidraw diagram following the schema and guidelines
3. Include real data values from your research in the diagram labels
4. Return the final JSON object with name, description, and elements array\`
    
    // Call Gemini with tools
    const messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }> = [
      { role: 'user', parts: [{ text: EXCALIDRAW_EXPERT_PROMPT + '\\n\\n' + userPrompt }] }
    ]
    
    let response = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/\${GEMINI_MODEL}:generateContent?key=\${GEMINI_API_KEY}\`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages,
          tools: [{ functionDeclarations: diagramToolDeclarations }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 8192
          }
        })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      throw new Error(\`Gemini API error: \${response.status}\`)
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
        \`https://generativelanguage.googleapis.com/v1beta/models/\${GEMINI_MODEL}:generateContent?key=\${GEMINI_API_KEY}\`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: messages,
            tools: [{ functionDeclarations: diagramToolDeclarations }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 8192
            }
          })
        }
      )
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error in loop:', errorText)
        throw new Error(\`Gemini API error: \${response.status}\`)
      }
      
      data = await response.json()
      candidate = data.candidates?.[0]
      iteration++
    }
    
    // Extract the final response
    const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || []
    let responseText = textParts.map((p: { text: string }) => p.text).join('\\n')
    
    console.log('Raw response:', responseText.substring(0, 1000))
    
    // Parse the JSON response
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonMatch = responseText.match(/\`\`\`json\\s*([\\s\\S]*?)\\s*\`\`\`/)
    if (jsonMatch) {
      responseText = jsonMatch[1]
    } else {
      // Try to find raw JSON
      jsonMatch = responseText.match(/\\{[\\s\\S]*"elements"[\\s\\S]*\\}/)
      if (jsonMatch) {
        responseText = jsonMatch[0]
      }
    }
    
    let parsedResponse: { name: string; description: string; elements: unknown[] }
    try {
      parsedResponse = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse response:', parseError, responseText)
      
      // Fallback: create a simple diagram
      parsedResponse = {
        name: 'Generated Diagram',
        description: user_request,
        elements: [
          {
            type: "rectangle",
            id: "main",
            x: 200,
            y: 150,
            width: 200,
            height: 100,
            backgroundColor: "#a5d8ff",
            strokeColor: "#1971c2",
            strokeWidth: 2,
            label: { text: company_symbol || 'Diagram', fontSize: 20 }
          },
          {
            type: "text",
            x: 200,
            y: 80,
            text: user_request.substring(0, 50),
            fontSize: 20,
            strokeColor: "#1864ab"
          }
        ]
      }
    }
    
    if (!parsedResponse.elements || !Array.isArray(parsedResponse.elements)) {
      throw new Error('No elements array in response')
    }
    
    // Detect diagram type from elements
    let diagramType = 'flowchart'
    const hasArrows = parsedResponse.elements.some((e: { type?: string }) => e.type === 'arrow')
    const hasDiamonds = parsedResponse.elements.some((e: { type?: string }) => e.type === 'diamond')
    const rectangleCount = parsedResponse.elements.filter((e: { type?: string }) => e.type === 'rectangle').length
    
    if (hasDiamonds) diagramType = 'flowchart'
    else if (rectangleCount >= 3 && !hasArrows) diagramType = 'comparison'
    else if (hasArrows && rectangleCount >= 4) diagramType = 'hierarchy'
    
    // Save the diagram to the database - store elements directly
    const diagramData = {
      type: 'excalidraw',
      version: 2,
      source: 'stratos-brain-diagram-generator-v2',
      elements: parsedResponse.elements,
      appState: { 
        viewBackgroundColor: '#1e1e1e',
        theme: 'dark'
      },
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
      throw new Error(\`Failed to save diagram: \${saveError.message}\`)
    }
    
    console.log(\`Diagram saved: \${savedDiagram.diagram_id}\`)
    
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

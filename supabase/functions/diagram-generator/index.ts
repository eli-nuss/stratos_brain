// Diagram Generator v12
// Key insight: Layout instructions must come LAST, right before output request
// The shape of the diagram must match the concept

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL_SMART = 'gemini-3-pro-preview'

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
        const message = \`event: \${event}\ndata: \${JSON.stringify(data)}\n\n\`
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
// Get current date info for context
// ============================================================================

function getCurrentDateContext(): { year: number; month: string; quarter: string; fiscalContext: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.toLocaleString('en-US', { month: 'long' })
  const quarterNum = Math.ceil((now.getMonth() + 1) / 3)
  const quarter = \`Q\${quarterNum}\`
  
  const fiscalContext = quarterNum === 1 
    ? \`Most recent complete fiscal year is FY\${year - 1}. FY\${year} has just begun.\`
    : \`We are in \${quarter} of FY\${year}. FY\${year - 1} is the most recent complete fiscal year.\`
  
  return { year, month, quarter, fiscalContext }
}

// ============================================================================
// LAYOUT TEMPLATES - Exact coordinates for each diagram type
// ============================================================================

const LAYOUT_TEMPLATES = {
  cycle: \`
## REQUIRED LAYOUT: CIRCULAR FLYWHEEL

Your diagram MUST form a CIRCLE shape. This is NON-NEGOTIABLE for flywheel/cycle concepts.

Place exactly 4 boxes at these coordinates (like clock positions):

TOP (12 o'clock):
{"id": "box-top", "type": "rectangle", "x": 300, "y": 100, "width": 180, "height": 70, "backgroundColor": "#a5d8ff", "strokeColor": "#1971c2", "strokeWidth": 2, "roundness": {"type": 3}}

RIGHT (3 o'clock):
{"id": "box-right", "type": "rectangle", "x": 520, "y": 280, "width": 180, "height": 70, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}}

BOTTOM (6 o'clock):
{"id": "box-bottom", "type": "rectangle", "x": 300, "y": 460, "width": 180, "height": 70, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}}

LEFT (9 o'clock):
{"id": "box-left", "type": "rectangle", "x": 80, "y": 280, "width": 180, "height": 70, "backgroundColor": "#ffec99", "strokeColor": "#f08c00", "strokeWidth": 2, "roundness": {"type": 3}}

Connect with CLOCKWISE arrows around the outside (not through center):
- Arrow 1: TOP → RIGHT (going down-right)
- Arrow 2: RIGHT → BOTTOM (going down-left)  
- Arrow 3: BOTTOM → LEFT (going up-left)
- Arrow 4: LEFT → TOP (going up-right)

Add center label at x=350, y=310 with the core concept (e.g., "GROWTH").
Add title at top and key insight at bottom.
\`,

  comparison: \`
## REQUIRED LAYOUT: SIDE-BY-SIDE COLUMNS

Your diagram MUST have two distinct columns for comparison.

LEFT COLUMN (Company A / Option A):
- Header: {"id": "left-header", "type": "rectangle", "x": 80, "y": 100, "width": 280, "height": 50, "backgroundColor": "#ff8787", "strokeColor": "#c92a2a", "strokeWidth": 2, "roundness": {"type": 3}}
- Row 1: {"id": "left-row1", "type": "rectangle", "x": 80, "y": 170, "width": 280, "height": 60, "backgroundColor": "#fff5f5", "strokeColor": "#ffc9c9", "strokeWidth": 1, "roundness": {"type": 3}}
- Row 2: {"id": "left-row2", "type": "rectangle", "x": 80, "y": 250, "width": 280, "height": 60, ...}
- Row 3: {"id": "left-row3", "type": "rectangle", "x": 80, "y": 330, "width": 280, "height": 60, ...}

RIGHT COLUMN (Company B / Option B):
- Header: {"id": "right-header", "type": "rectangle", "x": 440, "y": 100, "width": 280, "height": 50, "backgroundColor": "#339af0", "strokeColor": "#1864ab", "strokeWidth": 2, "roundness": {"type": 3}}
- Row 1: {"id": "right-row1", "type": "rectangle", "x": 440, "y": 170, "width": 280, "height": 60, "backgroundColor": "#e7f5ff", "strokeColor": "#a5d8ff", "strokeWidth": 1, "roundness": {"type": 3}}
- Row 2, Row 3 at same y-coordinates as left column

VS BADGE in center:
{"id": "vs", "type": "ellipse", "x": 375, "y": 105, "width": 50, "height": 40, "backgroundColor": "#ffffff", "strokeColor": "#868e96", "strokeWidth": 2}

Rows must align horizontally so items can be compared directly.
\`,

  hierarchy: \`
## REQUIRED LAYOUT: TOP-DOWN TREE

Your diagram MUST flow from top to bottom, with parent above children.

PARENT (top center):
{"id": "parent", "type": "rectangle", "x": 320, "y": 100, "width": 180, "height": 60, "backgroundColor": "#a5d8ff", "strokeColor": "#1971c2", "strokeWidth": 2, "roundness": {"type": 3}}

CHILDREN (spread below):
{"id": "child1", "type": "rectangle", "x": 80, "y": 260, "width": 160, "height": 60, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}}
{"id": "child2", "type": "rectangle", "x": 320, "y": 260, "width": 160, "height": 60, "backgroundColor": "#ffec99", "strokeColor": "#f08c00", "strokeWidth": 2, "roundness": {"type": 3}}
{"id": "child3", "type": "rectangle", "x": 560, "y": 260, "width": 160, "height": 60, "backgroundColor": "#e9ecef", "strokeColor": "#868e96", "strokeWidth": 2, "roundness": {"type": 3}}

Connect with LINES (not arrows) from parent to each child:
{"id": "line1", "type": "line", "x": 410, "y": 160, "width": 250, "height": 100, "points": [[0,0], [-250, 100]], "strokeColor": "#868e96", "strokeWidth": 2}
\`,

  process: \`
## REQUIRED LAYOUT: LEFT-TO-RIGHT FLOW

Your diagram MUST flow horizontally from left to right.

STEPS (in a row):
{"id": "step1", "type": "rectangle", "x": 50, "y": 200, "width": 150, "height": 70, "backgroundColor": "#e7f5ff", "strokeColor": "#1971c2", "strokeWidth": 2, "roundness": {"type": 3}}
{"id": "step2", "type": "rectangle", "x": 250, "y": 200, "width": 150, "height": 70, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}}
{"id": "step3", "type": "rectangle", "x": 450, "y": 200, "width": 150, "height": 70, "backgroundColor": "#ffec99", "strokeColor": "#f08c00", "strokeWidth": 2, "roundness": {"type": 3}}
{"id": "step4", "type": "rectangle", "x": 650, "y": 200, "width": 150, "height": 70, "backgroundColor": "#ffc9c9", "strokeColor": "#e03131", "strokeWidth": 2, "roundness": {"type": 3}}

ARROWS between steps (pointing right):
{"id": "arrow1", "type": "arrow", "x": 200, "y": 235, "width": 50, "height": 0, "points": [[0,0], [50, 0]], "strokeColor": "#868e96", "strokeWidth": 2, "endArrowhead": "arrow"}
\`
}

// ============================================================================
// Base prompt - kept short and focused
// ============================================================================

const BASE_PROMPT = \`You are an expert diagram designer. Your diagrams are famous for being instantly understandable.

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no explanation):
{
  "type": "excalidraw",
  "version": 2,
  "source": "stratos-brain",
  "elements": [...],
  "appState": {"viewBackgroundColor": "#ffffff"}
}

## ELEMENT STRUCTURE
Each element needs: id, type, x, y, width, height, and for shapes: backgroundColor, strokeColor, strokeWidth, roundness.
Text elements need: text, fontSize (16-24), fontFamily (1), textAlign ("center"), strokeColor.

## COLORS
- Blue (#a5d8ff, stroke #1971c2): Core/Primary
- Green (#b2f2bb, stroke #2f9e44): Growth/Positive  
- Yellow (#ffec99, stroke #f08c00): Money/Catalyst
- Red (#ffc9c9, stroke #e03131): Important/Results
- Gray (#e9ecef, stroke #868e96): Secondary

## QUALITY RULES
1. Maximum 6-8 main elements
2. Short labels (2-4 words per box)
3. Include specific numbers from the data
4. Add a "Key Insight" text at the bottom
5. Title at top with company name and year
\`

// ============================================================================
// Diagram Generation with Data-First Workflow
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
  
  const apiUrl = \`https://generativelanguage.googleapis.com/v1beta/models/\${GEMINI_MODEL_SMART}:generateContent?key=\${GEMINI_API_KEY}\`
  
  const dateContext = getCurrentDateContext()
  
  const toolContext = {
    ticker: companySymbol,
    chatType: 'company' as const,
    chatId: chatId || undefined
  }
  
  try {
    // ========================================================================
    // PHASE 1: DETERMINE DIAGRAM TYPE
    // ========================================================================
    writer.write('status', { stage: 'planning', message: 'Analyzing request...' })
    
    const typePrompt = \`Classify this diagram request into exactly ONE type.

Request: "\${request}"
Company: \${companyName} (\${companySymbol})

Types:
- "cycle" = flywheel, feedback loop, virtuous cycle, reinforcing system
- "comparison" = vs, compare, versus, side-by-side, differences
- "hierarchy" = structure, breakdown, organization, ownership, segments
- "process" = flow, pipeline, how it works, steps, sequence

Output ONLY the type word, nothing else.\`

    const typeResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: typePrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
      })
    })
    
    let diagramType = 'hierarchy' // default
    
    if (typeResponse.ok) {
      const typeData = await typeResponse.json()
      const typeText = (typeData.candidates?.[0]?.content?.parts?.[0]?.text || '').toLowerCase().trim()
      if (['cycle', 'comparison', 'hierarchy', 'process'].includes(typeText)) {
        diagramType = typeText
      } else if (typeText.includes('cycle') || typeText.includes('flywheel')) {
        diagramType = 'cycle'
      } else if (typeText.includes('compar') || typeText.includes('vs')) {
        diagramType = 'comparison'
      } else if (typeText.includes('process') || typeText.includes('flow')) {
        diagramType = 'process'
      }
    }
    
    console.log('Detected diagram type:', diagramType)
    
    writer.write('plan', { 
      title: \`\${companyName} Analysis\`, 
      type: diagramType, 
      checklist: [
        { item: 'Company fundamentals', status: 'pending' },
        { item: 'Research data', status: 'pending' }
      ],
      tools: ['get_asset_fundamentals', 'perform_grounded_research'],
      layout: diagramType === 'cycle' ? 'Circular flywheel' : 
              diagramType === 'comparison' ? 'Side-by-side columns' :
              diagramType === 'hierarchy' ? 'Top-down tree' : 'Left-to-right flow',
      estimated_elements: 6
    })
    
    // ========================================================================
    // PHASE 2: DATA GATHERING
    // ========================================================================
    writer.write('status', { stage: 'researching', message: \`Fetching data for \${companySymbol}...\` })
    
    const gatheredData: Record<string, unknown> = {}
    
    if (companySymbol) {
      writer.write('tool_call', { tool: 'get_asset_fundamentals', args: { symbol: companySymbol }, message: \`Fetching fundamentals...\` })
      
      try {
        const fundamentals = await executeUnifiedTool('get_asset_fundamentals', { symbol: companySymbol }, supabase, toolContext)
        gatheredData['fundamentals'] = fundamentals
        writer.write('tool_result', { tool: 'get_asset_fundamentals', success: true, message: 'Got fundamentals' })
        writer.write('checklist_update', { item: 'Company fundamentals', status: 'complete' })
      } catch (e) {
        console.error('Fundamentals error:', e)
        writer.write('tool_result', { tool: 'get_asset_fundamentals', success: false, message: String(e) })
      }
    }
    
    const searchQuery = \`\${companyName} \${request} \${dateContext.year}\`
    writer.write('tool_call', { tool: 'perform_grounded_research', args: { query: searchQuery }, message: \`Researching...\` })
    
    try {
      const searchResults = await executeUnifiedTool('perform_grounded_research', { query: searchQuery }, supabase, toolContext)
      gatheredData['research'] = searchResults
      writer.write('tool_result', { tool: 'perform_grounded_research', success: true, message: 'Got research' })
      writer.write('checklist_update', { item: 'Research data', status: 'complete' })
    } catch (e) {
      console.error('Research error:', e)
    }
    
    // ========================================================================
    // PHASE 3: GENERATE DIAGRAM
    // ========================================================================
    writer.write('status', { stage: 'designing', message: 'Creating diagram...' })
    
    // Get the appropriate layout template
    const layoutTemplate = LAYOUT_TEMPLATES[diagramType as keyof typeof LAYOUT_TEMPLATES] || LAYOUT_TEMPLATES.hierarchy
    
    // Build the prompt with layout instructions LAST (most important = most recent in context)
    const designPrompt = \`\${BASE_PROMPT}

## COMPANY DATA
Company: \${companyName} (\${companySymbol})
Date: \${dateContext.month} \${dateContext.year}

Fundamentals:
\${JSON.stringify(gatheredData['fundamentals'] || {}, null, 2).substring(0, 3000)}

Research:
\${JSON.stringify(gatheredData['research'] || {}, null, 2).substring(0, 2000)}

## USER REQUEST
"\${request}"

## CRITICAL: FOLLOW THIS EXACT LAYOUT
\${layoutTemplate}

Now create the diagram. Use the EXACT coordinates from the layout template above. Output ONLY JSON.\`

    console.log('Design prompt length:', designPrompt.length)
    console.log('Using layout type:', diagramType)
    
    const designResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: designPrompt }] }],
        generationConfig: { 
          temperature: 0.3, 
          maxOutputTokens: 16384,
          responseMimeType: 'application/json'
        }
      })
    })
    
    if (!designResponse.ok) {
      const errorText = await designResponse.text()
      throw new Error(\`Gemini API error: \${designResponse.status} - \${errorText}\`)
    }
    
    const designData = await designResponse.json()
    let responseText = designData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    console.log('Raw response length:', responseText.length)
    
    writer.write('status', { stage: 'parsing', message: 'Parsing diagram...' })
    
    let diagramJson: { elements: unknown[], appState?: unknown }
    
    function sanitizeJsonString(str: string): string {
      return str.replace(/[\\x00-\\x1F\\x7F]/g, (char) => {
        const code = char.charCodeAt(0)
        if (code === 0x09) return '\\\\t'
        if (code === 0x0A) return '\\\\n'
        if (code === 0x0D) return '\\\\r'
        return ''
      })
    }
    
    try {
      diagramJson = JSON.parse(sanitizeJsonString(responseText))
    } catch (e) {
      const jsonMatch = responseText.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\\s*\`\`\`/) || responseText.match(/(\\{[\\s\\S]*\\})/)
      if (jsonMatch) {
        diagramJson = JSON.parse(sanitizeJsonString(jsonMatch[1]))
      } else {
        throw new Error('Could not parse diagram JSON: ' + (e as Error).message)
      }
    }
    
    if (!diagramJson.elements || !Array.isArray(diagramJson.elements)) {
      throw new Error('Invalid diagram format: missing elements array')
    }
    
    if (!diagramJson.appState) {
      diagramJson.appState = {}
    }
    (diagramJson.appState as any).viewBackgroundColor = '#ffffff'
    
    // ========================================================================
    // PHASE 4: POST-PROCESS AND SAVE
    // ========================================================================
    writer.write('status', { stage: 'finalizing', message: 'Saving diagram...' })
    
    // Ensure all elements have required fields
    const processedElements = diagramJson.elements.map((el: any, idx: number) => {
      if (!el.id) el.id = \`element-\${idx}\`
      if (el.type === 'rectangle' || el.type === 'ellipse') {
        el.fillStyle = el.fillStyle || 'solid'
        el.strokeStyle = el.strokeStyle || 'solid'
        el.roughness = el.roughness ?? 0
        el.opacity = el.opacity ?? 100
        el.roundness = el.roundness || { type: 3 }
      }
      if (el.type === 'text') {
        el.fontFamily = el.fontFamily || 1
        el.textAlign = el.textAlign || 'center'
        el.verticalAlign = el.verticalAlign || 'middle'
      }
      if (el.type === 'arrow' || el.type === 'line') {
        el.strokeStyle = el.strokeStyle || 'solid'
        el.roughness = el.roughness ?? 0
        if (el.type === 'arrow') {
          el.startArrowhead = el.startArrowhead || null
          el.endArrowhead = el.endArrowhead || 'arrow'
        }
      }
      return el
    })
    
    const finalDiagram = {
      type: 'excalidraw',
      version: 2,
      source: 'stratos-brain',
      elements: processedElements,
      appState: {
        viewBackgroundColor: '#ffffff',
        gridSize: null
      }
    }
    
    // Save to database
    if (chatId && userId) {
      try {
        const { error } = await supabase
          .from('chat_diagrams')
          .insert({
            chat_id: chatId,
            user_id: userId,
            title: \`\${companyName} - \${request.substring(0, 50)}\`,
            diagram_data: finalDiagram,
            diagram_type: diagramType,
            source: 'ai'
          })
        
        if (error) {
          console.error('Error saving diagram:', error)
        }
      } catch (e) {
        console.error('Database error:', e)
      }
    }
    
    writer.write('diagram', finalDiagram)
    writer.write('status', { stage: 'complete', message: 'Diagram complete!' })
    
  } catch (error) {
    console.error('Diagram generation error:', error)
    writer.write('error', { message: String(error) })
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { request, companySymbol, companyName, chatContext, chatId, userId } = await req.json()
    
    if (!request) {
      return new Response(
        JSON.stringify({ error: 'Missing request parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const writer = createStreamWriter()
    
    generateDiagramWithStreaming(
      supabase,
      writer,
      request,
      companySymbol || '',
      companyName || 'Company',
      chatContext || '',
      chatId || null,
      userId || null
    ).finally(() => {
      writer.close()
    })
    
    return new Response(writer.stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
    
  } catch (error) {
    console.error('Handler error:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Diagram Generator v13
// Key insight: Use natural language spatial descriptions (clock positions)
// instead of JSON coordinates - Gemini understands "3 o'clock" better than "x: 520"

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

function createStreamWriter() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  
  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c }
  })
  
  return {
    stream,
    write(event: string, data: unknown) {
      if (controller) {
        controller.enqueue(encoder.encode(\`event: \${event}\ndata: \${JSON.stringify(data)}\n\n\`))
      }
    },
    close() { if (controller) controller.close() }
  }
}

function getCurrentDateContext() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.toLocaleString('en-US', { month: 'long' })
  const quarterNum = Math.ceil((now.getMonth() + 1) / 3)
  return { year, month, quarter: `Q${quarterNum}` }
}

// ============================================================================
// Arrow Routing Post-Processor - Ensures arrows never pass through boxes
// ============================================================================

function fixArrowRouting(elements: any[]): any[] {
  function lineIntersectsRect(p1: {x: number, y: number}, p2: {x: number, y: number}, rect: {x: number, y: number, width: number, height: number}): boolean {
    const padding = 5;
    const left = rect.x - padding;
    const right = rect.x + rect.width + padding;
    const top = rect.y - padding;
    const bottom = rect.y + rect.height + padding;

    const p1Inside = p1.x > left && p1.x < right && p1.y > top && p1.y < bottom;
    const p2Inside = p2.x > left && p2.x < right && p2.y > top && p2.y < bottom;
    
    if (p1Inside || p2Inside) return true;

    // Check line-edge intersections using cross product
    const edges = [
      { a: { x: left, y: top }, b: { x: right, y: top } },
      { a: { x: right, y: top }, b: { x: right, y: bottom } },
      { a: { x: left, y: bottom }, b: { x: right, y: bottom } },
      { a: { x: left, y: top }, b: { x: left, y: bottom } }
    ];

    for (const edge of edges) {
      if (lineSegmentsIntersect(p1, p2, edge.a, edge.b)) return true;
    }
    return false;
  }

  function lineSegmentsIntersect(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, p4: {x: number, y: number}): boolean {
    const d1 = direction(p3, p4, p1);
    const d2 = direction(p3, p4, p2);
    const d3 = direction(p1, p2, p3);
    const d4 = direction(p1, p2, p4);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }
    return false;
  }

  function direction(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}): number {
    return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
  }

  function routeAroundBox(start: {x: number, y: number}, end: {x: number, y: number}, box: {x: number, y: number, width: number, height: number}): {x: number, y: number}[] {
    const padding = 30;
    const boxCenterX = box.x + box.width / 2;
    const boxCenterY = box.y + box.height / 2;
    
    const topY = box.y - padding;
    const bottomY = box.y + box.height + padding;
    const leftX = box.x - padding;
    const rightX = box.x + box.width + padding;

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Decide routing based on movement direction
    if (Math.abs(end.x - start.x) > Math.abs(end.y - start.y)) {
      // Primarily horizontal - go around top or bottom
      if (midY < boxCenterY) {
        return [start, { x: start.x, y: topY }, { x: end.x, y: topY }, end];
      } else {
        return [start, { x: start.x, y: bottomY }, { x: end.x, y: bottomY }, end];
      }
    } else {
      // Primarily vertical - go around left or right
      if (midX < boxCenterX) {
        return [start, { x: leftX, y: start.y }, { x: leftX, y: end.y }, end];
      } else {
        return [start, { x: rightX, y: start.y }, { x: rightX, y: end.y }, end];
      }
    }
  }

  const boxes = elements
    .filter((e: any) => e.type === 'rectangle')
    .map((e: any) => ({ id: e.id, x: e.x, y: e.y, width: e.width || 180, height: e.height || 70 }));

  const arrows = elements.filter((e: any) => e.type === 'arrow');
  const otherElements = elements.filter((e: any) => e.type !== 'arrow');

  const fixedArrows = arrows.map((arrow: any) => {
    if (!arrow.points || arrow.points.length < 2) return arrow;
    
    const startPoint = { x: arrow.x, y: arrow.y };
    const lastPt = arrow.points[arrow.points.length - 1] || [0, 0];
    const endPoint = { x: arrow.x + lastPt[0], y: arrow.y + lastPt[1] };

    // Check for intersections with any box
    let hasIntersection = false;
    let obstacleBox: any = null;

    for (const box of boxes) {
      for (let i = 0; i < arrow.points.length - 1; i++) {
        const p1 = { x: arrow.x + arrow.points[i][0], y: arrow.y + arrow.points[i][1] };
        const p2 = { x: arrow.x + arrow.points[i + 1][0], y: arrow.y + arrow.points[i + 1][1] };
        if (lineIntersectsRect(p1, p2, box)) {
          hasIntersection = true;
          obstacleBox = box;
          break;
        }
      }
      if (hasIntersection) break;
    }

    if (!hasIntersection) return arrow;

    console.log(`Fixing arrow ${arrow.id} - routing around box ${obstacleBox.id}`);
    
    const newPath = routeAroundBox(startPoint, endPoint, obstacleBox);
    const newPoints = newPath.map((p: {x: number, y: number}, i: number) => 
      i === 0 ? [0, 0] : [p.x - arrow.x, p.y - arrow.y]
    );

    return { ...arrow, points: newPoints };
  });

  return [...otherElements, ...fixedArrows];
}

// ============================================================================
// THE PROMPT - Natural language with clock positions
// ============================================================================

const DIAGRAM_PROMPT = \`You are creating an Excalidraw diagram. Your output must be valid JSON only.

## CRITICAL LAYOUT RULES

The SHAPE of your diagram must match the CONCEPT:

### FOR FLYWHEEL/CYCLE DIAGRAMS (feedback loops, virtuous cycles):

The diagram MUST form a CIRCLE. Think of a clock face:

- Box 1 goes at 12 o'clock (TOP CENTER): x=300, y=100
- Box 2 goes at 3 o'clock (RIGHT SIDE): x=520, y=280
- Box 3 goes at 6 o'clock (BOTTOM CENTER): x=300, y=460
- Box 4 goes at 9 o'clock (LEFT SIDE): x=80, y=280

Arrows go CLOCKWISE around the outside:
- Arrow from Box 1 to Box 2 (curves down-right)
- Arrow from Box 2 to Box 3 (curves down-left)
- Arrow from Box 3 to Box 4 (curves up-left)
- Arrow from Box 4 to Box 1 (curves up-right)

DO NOT stack boxes vertically. DO NOT create a diamond shape.
The boxes must form a SQUARE pattern like the 4 corners of a clock.

### FOR COMPARISON DIAGRAMS (vs, compare):

Two columns side by side:
- Left column at x=80
- Right column at x=440
- Rows at y=100, 180, 260, 340

### FOR HIERARCHY DIAGRAMS (structure, breakdown):

Tree flowing top to bottom:
- Parent at top center: x=320, y=100
- Children spread below: x=80/320/560, y=260

### FOR PROCESS DIAGRAMS (flow, steps):

Horizontal left to right:
- Steps at y=200, x=50/250/450/650

## CRITICAL ARROW ROUTING RULES

Arrows MUST connect to box EDGES, never pass through boxes:

1. **Calculate connection points on box edges:**
   - Top edge center: (box.x + box.width/2, box.y)
   - Bottom edge center: (box.x + box.width/2, box.y + box.height)
   - Left edge center: (box.x, box.y + box.height/2)
   - Right edge center: (box.x + box.width, box.y + box.height/2)

2. **Arrow direction determines which edges to use:**
   - Going DOWN: Start from source's BOTTOM edge, end at target's TOP edge
   - Going UP: Start from source's TOP edge, end at target's BOTTOM edge
   - Going RIGHT: Start from source's RIGHT edge, end at target's LEFT edge
   - Going LEFT: Start from source's LEFT edge, end at target's RIGHT edge

3. **For diagonal connections, use intermediate points:**
   - If source is above-left of target: Exit source's RIGHT or BOTTOM edge, enter target's LEFT or TOP edge
   - Add a bend point to route AROUND any boxes in between
   - Arrow points array: [[0,0], [midX, midY], [endX, endY]] for bent arrows

4. **Arrow position and points:**
   - Arrow x,y is the START point (on source box edge)
   - points[0] is always [0,0] (relative to arrow x,y)
   - points[1] (optional) is the bend point for routing around obstacles
   - points[last] is the END point relative to arrow x,y

5. **NEVER let an arrow line pass through any box rectangle**
   - If a straight line would cross a box, add a bend point to go around it
   - Route arrows on the OUTSIDE of the diagram, not through the middle

## OUTPUT FORMAT

Return ONLY this JSON structure:
{
  "type": "excalidraw",
  "version": 2,
  "source": "stratos-brain",
  "elements": [
    // rectangles: {id, type:"rectangle", x, y, width:180, height:70, backgroundColor, strokeColor, strokeWidth:2, roundness:{type:3}}
    // text: {id, type:"text", x, y, width, height, text, fontSize:16, fontFamily:1, textAlign:"center", strokeColor}
    // arrows: {id, type:"arrow", x, y, width, height, points:[[0,0],[dx,dy]], strokeColor, strokeWidth:2, endArrowhead:"arrow"}
  ],
  "appState": {"viewBackgroundColor": "#ffffff"}
}

## COLORS
- Blue: backgroundColor "#a5d8ff", strokeColor "#1971c2"
- Green: backgroundColor "#b2f2bb", strokeColor "#2f9e44"
- Yellow: backgroundColor "#ffec99", strokeColor "#f08c00"
- Red: backgroundColor "#ffc9c9", strokeColor "#e03131"

## FORBIDDEN - HARD CONSTRAINTS

These rules are ABSOLUTE and must NEVER be violated:

1. ARROWS MUST NEVER PASS THROUGH ANY BOX
   - Before drawing any arrow, mentally trace its path
   - If the straight line from start to end would cross ANY box, you MUST add bend points
   - Route arrows AROUND boxes, never through them
   - This applies to ALL boxes, not just the source and target

2. ARROWS MUST NEVER CROSS EACH OTHER
   - If two arrow paths would intersect, route one of them differently
   - Use different edges or add bend points to avoid crossings

3. ARROWS MUST START AND END ON BOX EDGES
   - Never start an arrow from inside a box
   - Never end an arrow inside a box
   - Calculate the exact edge point based on direction

4. VERIFICATION STEP (do this mentally before outputting):
   - For each arrow, trace its path from start to end
   - Check: does this line cross any box? If yes, add a bend point
   - Check: does this line cross any other arrow? If yes, reroute

## QUALITY RULES
1. Maximum 4-6 main boxes
2. Short labels (2-4 words per line)
3. Include a title at top
4. Include "Key Insight:" text at bottom

Now create the diagram. Output ONLY JSON.\`

// ============================================================================
// Main Generation Function
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
    // PHASE 1: Detect diagram type
    writer.write('status', { stage: 'planning', message: 'Analyzing request...' })
    
    const typePrompt = \`Classify this request into ONE type:
- "cycle" for flywheel, feedback loop, virtuous cycle
- "comparison" for vs, compare, differences
- "hierarchy" for structure, breakdown, segments
- "process" for flow, steps, how it works

Request: "\${request}"
Output ONLY the type word.\`

    const typeResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: typePrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 20 }
      })
    })
    
    let diagramType = 'hierarchy'
    if (typeResponse.ok) {
      const typeData = await typeResponse.json()
      const typeText = (typeData.candidates?.[0]?.content?.parts?.[0]?.text || '').toLowerCase().trim()
      if (['cycle', 'comparison', 'hierarchy', 'process'].includes(typeText)) {
        diagramType = typeText
      } else if (typeText.includes('cycle') || typeText.includes('flywheel')) {
        diagramType = 'cycle'
      }
    }
    
    console.log('Detected type:', diagramType)
    
    writer.write('plan', { 
      title: \`\${companyName} Analysis\`, 
      type: diagramType,
      checklist: [{ item: 'Fetching data', status: 'pending' }],
      layout: diagramType === 'cycle' ? 'Circular (clock positions)' : diagramType,
      estimated_elements: 6
    })
    
    // PHASE 2: Get data
    writer.write('status', { stage: 'researching', message: 'Fetching data...' })
    
    let fundamentals = {}
    if (companySymbol) {
      try {
        fundamentals = await executeUnifiedTool('get_asset_fundamentals', { symbol: companySymbol }, supabase, toolContext)
        writer.write('checklist_update', { item: 'Fetching data', status: 'complete' })
      } catch (e) {
        console.error('Fundamentals error:', e)
      }
    }
    
    // PHASE 3: Generate diagram
    writer.write('status', { stage: 'designing', message: 'Creating diagram...' })
    
    // Build type-specific instruction
    let layoutReminder = ''
    if (diagramType === 'cycle') {
      layoutReminder = \`
IMPORTANT: This is a CYCLE/FLYWHEEL diagram. You MUST use the CLOCK POSITION layout:
- Box 1 at 12 o'clock (x=300, y=100) - TOP CENTER
- Box 2 at 3 o'clock (x=520, y=280) - RIGHT SIDE  
- Box 3 at 6 o'clock (x=300, y=460) - BOTTOM CENTER
- Box 4 at 9 o'clock (x=80, y=280) - LEFT SIDE

The 4 boxes form a SQUARE pattern. Arrows go CLOCKWISE around the outside.
DO NOT stack boxes vertically. DO NOT make a diamond shape.\`
    }
    
    const designPrompt = \`\${DIAGRAM_PROMPT}

## COMPANY
\${companyName} (\${companySymbol})
Date: \${dateContext.month} \${dateContext.year}

## DATA
\${JSON.stringify(fundamentals, null, 2).substring(0, 2000)}

## REQUEST
"\${request}"
\${layoutReminder}

Create the diagram now. Output ONLY valid JSON.\`

    console.log('Prompt length:', designPrompt.length)
    
    const designResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: designPrompt }] }],
        generationConfig: { 
          temperature: 1.0,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json'
        }
      })
    })
    
    if (!designResponse.ok) {
      throw new Error(\`API error: \${designResponse.status}\`)
    }
    
    const designData = await designResponse.json()
    let responseText = designData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    writer.write('status', { stage: 'parsing', message: 'Parsing...' })
    
    // Parse JSON
    let diagramJson: { elements: unknown[], appState?: unknown }
    
    const sanitize = (str: string) => str.replace(/[\\x00-\\x1F\\x7F]/g, '')
    
    try {
      diagramJson = JSON.parse(sanitize(responseText))
    } catch (e) {
      const match = responseText.match(/(\\{[\\s\\S]*\\})/)
      if (match) {
        diagramJson = JSON.parse(sanitize(match[1]))
      } else {
        throw new Error('Could not parse JSON')
      }
    }
    
    if (!diagramJson.elements || !Array.isArray(diagramJson.elements)) {
      throw new Error('Invalid format: missing elements')
    }
    
    // Post-process elements - first fix arrow routing
    const arrowFixedElements = fixArrowRouting(diagramJson.elements)
    
    const processedElements = arrowFixedElements.map((el: any, idx: number) => {
      if (!el.id) el.id = \`el-\${idx}\`
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
      appState: { viewBackgroundColor: '#ffffff', gridSize: null }
    }
    
    // Save to database
    if (chatId && userId) {
      try {
        await supabase.from('chat_diagrams').insert({
          chat_id: chatId,
          user_id: userId,
          title: \`\${companyName} - \${request.substring(0, 50)}\`,
          diagram_data: finalDiagram,
          diagram_type: diagramType,
          source: 'ai'
        })
      } catch (e) {
        console.error('DB error:', e)
      }
    }
    
    writer.write('diagram', finalDiagram)
    writer.write('status', { stage: 'complete', message: 'Done!' })
    
  } catch (error) {
    console.error('Error:', error)
    writer.write('error', { message: String(error) })
  }
}

// ============================================================================
// Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { request, companySymbol, companyName, chatContext, chatId, userId } = await req.json()
    
    if (!request) {
      return new Response(JSON.stringify({ error: 'Missing request' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const writer = createStreamWriter()
    
    generateDiagramWithStreaming(
      supabase, writer, request, companySymbol || '', companyName || 'Company',
      chatContext || '', chatId || null, userId || null
    ).finally(() => writer.close())
    
    return new Response(writer.stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

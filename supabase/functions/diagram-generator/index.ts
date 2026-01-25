// Diagram Generator Edge Function v11
// Example-Based Learning Approach
// Key insight: Show don't tell - provide excellent examples instead of rules

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
// EXAMPLE-BASED DIAGRAM SYSTEM v11
// Key insight: Show excellent examples, let the model learn patterns
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = \`You are an expert visual communicator who creates diagrams that TEACH and ENLIGHTEN.

Your diagrams are famous for being:
- Instantly understandable (the "aha!" moment in 5 seconds)
- Visually clean (breathing room, no clutter)
- Conceptually accurate (the shape matches the idea)
- Insightful (reveals something the viewer didn't know)

=== YOUR PROCESS ===

STEP 1: UNDERSTAND THE CONCEPT

Before drawing anything, deeply understand what you're visualizing.
Ask yourself:
1. What is the user really trying to understand?
2. What is the ONE key insight this diagram should communicate?
3. Is there a canonical/famous visual representation? (e.g., Amazon flywheel, BCG matrix)

STEP 2: CHOOSE THE VISUAL METAPHOR

The shape of your diagram MUST match the concept. This is non-negotiable.

| Concept Type | Visual Shape | Why |
|--------------|--------------|-----|
| Cycle/Flywheel/Loop | CIRCLE with arrows going around | Cycles are circular - the shape IS the meaning |
| Hierarchy/Structure | TOP-DOWN tree | Power flows down, reporting flows up |
| Comparison/Versus | SIDE-BY-SIDE columns | Easy to compare when things are aligned |
| Process/Flow | LEFT-TO-RIGHT sequence | We read left to right, time flows left to right |
| Timeline/Evolution | HORIZONTAL line with points | Time is linear, history flows left to right |

CRITICAL: A flywheel MUST look like a wheel (circular). A hierarchy MUST flow top-down. If your diagram doesn't match the concept's natural shape, it's WRONG.

STEP 3: FOLLOW THE REFERENCE EXAMPLES

Study these examples carefully. Your output should match this quality level.

=== EXAMPLE 1: CYCLE/FLYWHEEL ===

Query: "Explain Amazon's flywheel"

A flywheel is CIRCULAR. The boxes form a square/diamond shape with arrows going CLOCKWISE around the outside. Nothing crosses through the middle.

{
  "type": "excalidraw",
  "version": 2,
  "source": "stratos-brain",
  "elements": [
    {"id": "title", "type": "text", "x": 300, "y": 20, "width": 200, "height": 35, "text": "Amazon's Flywheel", "fontSize": 28, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    {"id": "subtitle", "type": "text", "x": 220, "y": 60, "width": 360, "height": 20, "text": "Growth creates momentum that accelerates growth", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"},
    
    {"id": "box-top", "type": "rectangle", "x": 300, "y": 100, "width": 160, "height": 60, "backgroundColor": "#a5d8ff", "strokeColor": "#1971c2", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "label-top", "type": "text", "x": 320, "y": 118, "width": 120, "height": 24, "text": "Lower Prices", "fontSize": 16, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "box-right", "type": "rectangle", "x": 500, "y": 250, "width": 160, "height": 60, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "label-right", "type": "text", "x": 510, "y": 268, "width": 140, "height": 24, "text": "More Customers", "fontSize": 16, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "box-bottom", "type": "rectangle", "x": 300, "y": 400, "width": 160, "height": 60, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "label-bottom", "type": "text", "x": 325, "y": 418, "width": 110, "height": 24, "text": "More Sellers", "fontSize": 16, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "box-left", "type": "rectangle", "x": 100, "y": 250, "width": 160, "height": 60, "backgroundColor": "#ffec99", "strokeColor": "#f08c00", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "label-left", "type": "text", "x": 125, "y": 268, "width": 110, "height": 24, "text": "Lower Costs", "fontSize": 16, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "arrow1", "type": "arrow", "x": 460, "y": 130, "width": 80, "height": 120, "points": [[0,0], [80, 120]], "strokeColor": "#1971c2", "strokeWidth": 2, "endArrowhead": "arrow"},
    {"id": "arrow2", "type": "arrow", "x": 580, "y": 310, "width": 80, "height": 90, "points": [[0,0], [-80, 90]], "strokeColor": "#2f9e44", "strokeWidth": 2, "endArrowhead": "arrow"},
    {"id": "arrow3", "type": "arrow", "x": 300, "y": 430, "width": 80, "height": 120, "points": [[0,0], [-80, -120]], "strokeColor": "#2f9e44", "strokeWidth": 2, "endArrowhead": "arrow"},
    {"id": "arrow4", "type": "arrow", "x": 180, "y": 250, "width": 80, "height": 90, "points": [[0,0], [80, -90]], "strokeColor": "#f08c00", "strokeWidth": 2, "endArrowhead": "arrow"},
    
    {"id": "center", "type": "text", "x": 340, "y": 270, "width": 80, "height": 24, "text": "GROWTH", "fontSize": 18, "fontFamily": 1, "textAlign": "center", "strokeColor": "#e03131"},
    
    {"id": "insight", "type": "text", "x": 180, "y": 500, "width": 400, "height": 20, "text": "Key Insight: Each turn of the wheel makes the next turn easier", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"}
  ],
  "appState": {"viewBackgroundColor": "#ffffff"}
}

Notice:
- 4 boxes form a SQUARE pattern (top, right, bottom, left)
- Arrows go CLOCKWISE around the outside
- Center has "GROWTH" label
- Clean, minimal labels (2-3 words)
- Key insight at bottom

=== EXAMPLE 2: COMPARISON (VS) ===

Query: "Compare Amazon vs Walmart"

A comparison has TWO COLUMNS side by side. Headers are different colors. Rows align horizontally.

{
  "type": "excalidraw",
  "version": 2,
  "source": "stratos-brain",
  "elements": [
    {"id": "title", "type": "text", "x": 280, "y": 20, "width": 240, "height": 30, "text": "Amazon vs Walmart", "fontSize": 24, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    {"id": "subtitle", "type": "text", "x": 200, "y": 55, "width": 400, "height": 20, "text": "Same revenue, completely different profit engines", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"},
    
    {"id": "left-header", "type": "rectangle", "x": 50, "y": 100, "width": 280, "height": 50, "backgroundColor": "#ff8787", "strokeColor": "#c92a2a", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "left-header-label", "type": "text", "x": 130, "y": 112, "width": 120, "height": 26, "text": "AMAZON", "fontSize": 20, "fontFamily": 1, "textAlign": "center", "strokeColor": "#ffffff"},
    
    {"id": "right-header", "type": "rectangle", "x": 470, "y": 100, "width": 280, "height": 50, "backgroundColor": "#339af0", "strokeColor": "#1864ab", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "right-header-label", "type": "text", "x": 550, "y": 112, "width": 120, "height": 26, "text": "WALMART", "fontSize": 20, "fontFamily": 1, "textAlign": "center", "strokeColor": "#ffffff"},
    
    {"id": "vs", "type": "ellipse", "x": 375, "y": 105, "width": 50, "height": 40, "backgroundColor": "#ffffff", "strokeColor": "#868e96", "strokeWidth": 2},
    {"id": "vs-label", "type": "text", "x": 388, "y": 115, "width": 24, "height": 20, "text": "vs", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#868e96"},
    
    {"id": "row1-left", "type": "rectangle", "x": 50, "y": 170, "width": 280, "height": 55, "backgroundColor": "#fff5f5", "strokeColor": "#ffc9c9", "strokeWidth": 1, "roundness": {"type": 3}},
    {"id": "row1-left-label", "type": "text", "x": 60, "y": 182, "width": 260, "height": 30, "text": "Revenue: $575B\\nE-commerce + Cloud + Ads", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "row1-right", "type": "rectangle", "x": 470, "y": 170, "width": 280, "height": 55, "backgroundColor": "#e7f5ff", "strokeColor": "#a5d8ff", "strokeWidth": 1, "roundness": {"type": 3}},
    {"id": "row1-right-label", "type": "text", "x": 480, "y": 182, "width": 260, "height": 30, "text": "Revenue: $648B\\n95% Physical Retail", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "row2-left", "type": "rectangle", "x": 50, "y": 245, "width": 280, "height": 55, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "row2-left-label", "type": "text", "x": 60, "y": 257, "width": 260, "height": 30, "text": "Operating Margin: 11%\\nAWS = 60% of profit", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "row2-right", "type": "rectangle", "x": 470, "y": 245, "width": 280, "height": 55, "backgroundColor": "#ffec99", "strokeColor": "#f08c00", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "row2-right-label", "type": "text", "x": 480, "y": 257, "width": 260, "height": 30, "text": "Operating Margin: 4%\\nThin margins, huge volume", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "row3-left", "type": "rectangle", "x": 50, "y": 320, "width": 280, "height": 55, "backgroundColor": "#fff5f5", "strokeColor": "#ffc9c9", "strokeWidth": 1, "roundness": {"type": 3}},
    {"id": "row3-left-label", "type": "text", "x": 60, "y": 332, "width": 260, "height": 30, "text": "Moat: Data + Prime Lock-in\\nNetwork effects compound", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "row3-right", "type": "rectangle", "x": 470, "y": 320, "width": 280, "height": 55, "backgroundColor": "#e7f5ff", "strokeColor": "#a5d8ff", "strokeWidth": 1, "roundness": {"type": 3}},
    {"id": "row3-right-label", "type": "text", "x": 480, "y": 332, "width": 260, "height": 30, "text": "Moat: Scale + Locations\\n4,700 US stores = convenience", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "insight", "type": "text", "x": 150, "y": 410, "width": 500, "height": 20, "text": "Key Insight: Amazon is a tech company disguised as a retailer", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"}
  ],
  "appState": {"viewBackgroundColor": "#ffffff"}
}

Notice:
- Two clear columns with gap in middle
- Headers are different colors (red vs blue)
- "vs" badge between headers
- Rows align horizontally
- Key difference highlighted (thicker border on margin row)

=== EXAMPLE 3: HIERARCHY/STRUCTURE ===

Query: "Show Alphabet's corporate structure"

A hierarchy flows TOP-DOWN. Parent at top, children below, lines connect them.

{
  "type": "excalidraw",
  "version": 2,
  "source": "stratos-brain",
  "elements": [
    {"id": "title", "type": "text", "x": 280, "y": 20, "width": 240, "height": 30, "text": "Alphabet's Structure", "fontSize": 24, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    {"id": "subtitle", "type": "text", "x": 200, "y": 55, "width": 400, "height": 20, "text": "Google is the cash cow funding moonshots", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"},
    
    {"id": "parent", "type": "rectangle", "x": 300, "y": 100, "width": 200, "height": 60, "backgroundColor": "#a5d8ff", "strokeColor": "#1971c2", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "parent-label", "type": "text", "x": 330, "y": 118, "width": 140, "height": 24, "text": "Alphabet Inc.", "fontSize": 18, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "child1", "type": "rectangle", "x": 80, "y": 240, "width": 160, "height": 60, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "child1-label", "type": "text", "x": 100, "y": 250, "width": 120, "height": 40, "text": "Google\\n~99% Revenue", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "child2", "type": "rectangle", "x": 320, "y": 240, "width": 160, "height": 60, "backgroundColor": "#ffec99", "strokeColor": "#f08c00", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "child2-label", "type": "text", "x": 340, "y": 250, "width": 120, "height": 40, "text": "Other Bets\\nMoonshots", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "child3", "type": "rectangle", "x": 560, "y": 240, "width": 160, "height": 60, "backgroundColor": "#e9ecef", "strokeColor": "#868e96", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "child3-label", "type": "text", "x": 580, "y": 250, "width": 120, "height": 40, "text": "CapitalG\\nInvestments", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "line1", "type": "line", "x": 400, "y": 160, "width": 240, "height": 80, "points": [[0,0], [-240, 80]], "strokeColor": "#868e96", "strokeWidth": 2},
    {"id": "line2", "type": "line", "x": 400, "y": 160, "width": 0, "height": 80, "points": [[0,0], [0, 80]], "strokeColor": "#868e96", "strokeWidth": 2},
    {"id": "line3", "type": "line", "x": 400, "y": 160, "width": 240, "height": 80, "points": [[0,0], [240, 80]], "strokeColor": "#868e96", "strokeWidth": 2},
    
    {"id": "insight", "type": "text", "x": 150, "y": 340, "width": 500, "height": 20, "text": "Key Insight: Google's profits fund experiments that could become the next Google", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"}
  ],
  "appState": {"viewBackgroundColor": "#ffffff"}
}

Notice:
- Parent at TOP CENTER
- Children evenly spaced BELOW
- Lines fan out from parent to children
- Color indicates importance (green = main business)

=== EXAMPLE 4: PROCESS/FLOW ===

Query: "How does Amazon make money?"

A process flows LEFT-TO-RIGHT. Each step leads to the next.

{
  "type": "excalidraw",
  "version": 2,
  "source": "stratos-brain",
  "elements": [
    {"id": "title", "type": "text", "x": 250, "y": 20, "width": 300, "height": 30, "text": "How Amazon Makes Money", "fontSize": 24, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    {"id": "subtitle", "type": "text", "x": 200, "y": 55, "width": 400, "height": 20, "text": "Three engines, one profit machine", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"},
    
    {"id": "step1", "type": "rectangle", "x": 50, "y": 120, "width": 140, "height": 70, "backgroundColor": "#e7f5ff", "strokeColor": "#1971c2", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "step1-label", "type": "text", "x": 60, "y": 135, "width": 120, "height": 40, "text": "Customer\\nBuys", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "arrow1", "type": "arrow", "x": 190, "y": 155, "width": 40, "height": 0, "points": [[0,0], [40, 0]], "strokeColor": "#868e96", "strokeWidth": 2, "endArrowhead": "arrow"},
    
    {"id": "engine1", "type": "rectangle", "x": 240, "y": 100, "width": 140, "height": 50, "backgroundColor": "#b2f2bb", "strokeColor": "#2f9e44", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "engine1-label", "type": "text", "x": 250, "y": 110, "width": 120, "height": 30, "text": "1P Retail\\n$220B (3%)", "fontSize": 12, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "engine2", "type": "rectangle", "x": 240, "y": 160, "width": 140, "height": 50, "backgroundColor": "#d0bfff", "strokeColor": "#7048e8", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "engine2-label", "type": "text", "x": 250, "y": 170, "width": 120, "height": 30, "text": "3P + Ads\\n$180B (15%)", "fontSize": 12, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "engine3", "type": "rectangle", "x": 240, "y": 220, "width": 140, "height": 50, "backgroundColor": "#ffc9c9", "strokeColor": "#e03131", "strokeWidth": 2, "roundness": {"type": 3}},
    {"id": "engine3-label", "type": "text", "x": 250, "y": 230, "width": 120, "height": 30, "text": "AWS\\n$100B (35%)", "fontSize": 12, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "arrow2", "type": "arrow", "x": 380, "y": 125, "width": 60, "height": 30, "points": [[0,0], [60, 30]], "strokeColor": "#868e96", "strokeWidth": 2, "endArrowhead": "arrow"},
    {"id": "arrow3", "type": "arrow", "x": 380, "y": 185, "width": 60, "height": 0, "points": [[0,0], [60, 0]], "strokeColor": "#868e96", "strokeWidth": 2, "endArrowhead": "arrow"},
    {"id": "arrow4", "type": "arrow", "x": 380, "y": 245, "width": 60, "height": -30, "points": [[0,0], [60, -30]], "strokeColor": "#868e96", "strokeWidth": 2, "endArrowhead": "arrow"},
    
    {"id": "profit", "type": "rectangle", "x": 450, "y": 150, "width": 140, "height": 70, "backgroundColor": "#ffe066", "strokeColor": "#f59f00", "strokeWidth": 3, "roundness": {"type": 3}},
    {"id": "profit-label", "type": "text", "x": 460, "y": 165, "width": 120, "height": 40, "text": "Operating\\nProfit $60B", "fontSize": 14, "fontFamily": 1, "textAlign": "center", "strokeColor": "#1e1e1e"},
    
    {"id": "insight", "type": "text", "x": 100, "y": 310, "width": 600, "height": 20, "text": "Key Insight: AWS is 17% of revenue but ~60% of profit. Retail is a customer acquisition engine.", "fontSize": 13, "fontFamily": 1, "textAlign": "center", "strokeColor": "#666666"}
  ],
  "appState": {"viewBackgroundColor": "#ffffff"}
}

=== OUTPUT FORMAT ===

Output ONLY valid JSON. No markdown code blocks, no explanation.

The JSON must have this exact structure:
{
  "type": "excalidraw",
  "version": 2,
  "source": "stratos-brain",
  "elements": [...],
  "appState": {"viewBackgroundColor": "#ffffff"}
}

=== COLORS ===

Use these consistently:
- Blue (#a5d8ff, #1971c2): Primary/Core elements
- Green (#b2f2bb, #2f9e44): Growth/Positive/Revenue
- Yellow (#ffec99, #f08c00): Money/Catalyst/Warning
- Red (#ffc9c9, #e03131): Results/Profit/Important
- Purple (#d0bfff, #7048e8): Tech/Premium
- Gray (#e9ecef, #868e96): Context/Secondary

=== FINAL CHECKLIST ===

Before outputting, verify:
[ ] Does the SHAPE match the CONCEPT? (flywheel = circular, hierarchy = top-down tree)
[ ] Are there 4-6 main elements? (not 10+)
[ ] Is there breathing room between elements?
[ ] Are labels SHORT (2-4 words)?
[ ] Is there a Key Insight at the bottom?
[ ] Would someone understand this in 5 seconds?

Now create the diagram.\`

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
    // PHASE 1: PLANNING
    // ========================================================================
    writer.write('status', { stage: 'planning', message: 'Creating diagram plan...' })
    
    const planPrompt = \`You are planning a financial diagram for \${companyName} (\${companySymbol}).
Today's Date: \${dateContext.month} \${dateContext.year}
\${dateContext.fiscalContext}

User Request: "\${request}"

Create a brief plan for this diagram. Output as JSON:
{
  "title": "Diagram title - include company name and year",
  "type": "cycle|comparison|hierarchy|process|timeline",
  "dataNeeded": ["list of specific data points needed"],
  "layoutPlan": "Brief description of layout",
  "estimatedElements": 6
}\`

    const planResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: planPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    })
    
    let plan = { title: \`\${companyName} Analysis\`, type: 'hierarchy', dataNeeded: [], layoutPlan: '', estimatedElements: 6 }
    
    if (planResponse.ok) {
      const planData = await planResponse.json()
      const planText = planData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      try {
        const jsonMatch = planText.match(/\\{[\\s\\S]*\\}/)
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.log('Plan parsing failed, using defaults')
      }
    }
    
    const checklist = (plan.dataNeeded || []).map((item: string) => ({ item, status: 'pending' as const }))
    
    writer.write('plan', { 
      title: plan.title || \`\${companyName || 'Company'} Analysis\`, 
      type: plan.type || 'hierarchy', 
      checklist: checklist,
      tools: ['get_asset_fundamentals', 'get_deep_research_report', 'perform_grounded_research'],
      layout: plan.layoutPlan || 'Grid layout',
      estimated_elements: plan.estimatedElements || 6
    })
    
    // ========================================================================
    // PHASE 2: DATA GATHERING
    // ========================================================================
    writer.write('status', { stage: 'researching', message: \`Fetching data for \${companySymbol}...\` })
    
    const gatheredData: Record<string, unknown> = {}
    
    if (companySymbol) {
      writer.write('tool_call', { tool: 'get_asset_fundamentals', args: { symbol: companySymbol }, message: \`Fetching fundamentals for \${companySymbol}...\` })
      
      try {
        const fundamentals = await executeUnifiedTool('get_asset_fundamentals', { symbol: companySymbol }, supabase, toolContext)
        gatheredData['fundamentals'] = fundamentals
        writer.write('tool_result', { tool: 'get_asset_fundamentals', success: true, message: 'Got company fundamentals' })
        writer.write('checklist_update', { item: 'Company fundamentals', status: 'complete' })
      } catch (e) {
        console.error('Fundamentals error:', e)
        writer.write('tool_result', { tool: 'get_asset_fundamentals', success: false, message: String(e) })
      }
    }
    
    writer.write('tool_call', { tool: 'get_deep_research_report', args: { symbol: companySymbol }, message: \`Checking for research report...\` })
    
    try {
      const report = await executeUnifiedTool('get_deep_research_report', { symbol: companySymbol }, supabase, toolContext)
      if (report && !(report as any).error) {
        gatheredData['deepResearch'] = report
        writer.write('tool_result', { tool: 'get_deep_research_report', success: true, message: 'Got deep research report' })
        writer.write('checklist_update', { item: 'Deep research report', status: 'complete' })
      } else {
        writer.write('tool_result', { tool: 'get_deep_research_report', success: false, message: 'No report available' })
      }
    } catch (e) {
      console.log('Deep research not available')
    }
    
    const searchQuery = \`\${companyName} \${companySymbol} \${request} financial data revenue breakdown \${dateContext.year}\`
    writer.write('tool_call', { tool: 'perform_grounded_research', args: { query: searchQuery }, message: \`Researching: \${searchQuery.substring(0, 50)}...\` })
    
    try {
      const searchResults = await executeUnifiedTool('perform_grounded_research', { query: searchQuery }, supabase, toolContext)
      gatheredData['research'] = searchResults
      writer.write('tool_result', { tool: 'perform_grounded_research', success: true, message: 'Got web research results' })
      writer.write('checklist_update', { item: 'Web research', status: 'complete' })
    } catch (e) {
      console.error('Research error:', e)
      writer.write('tool_result', { tool: 'perform_grounded_research', success: false, message: String(e) })
    }
    
    // ========================================================================
    // PHASE 3: DESIGN DIAGRAM
    // ========================================================================
    writer.write('status', { stage: 'designing', message: 'Creating diagram with real data...' })
    
    const designPrompt = \`\${EXCALIDRAW_EXPERT_PROMPT}

## CURRENT DATE CONTEXT
- Today's Date: \${dateContext.month} \${dateContext.year}
- Current Quarter: \${dateContext.quarter}
- \${dateContext.fiscalContext}

## TARGET COMPANY
- Company Name: \${companyName}
- Stock Symbol: \${companySymbol}

## USER REQUEST
"\${request}"

## GATHERED DATA (USE THIS - DO NOT MAKE UP NUMBERS!)

### Company Fundamentals:
\${JSON.stringify(gatheredData['fundamentals'] || {}, null, 2)}

### Deep Research Report:
\${JSON.stringify(gatheredData['deepResearch'] || 'Not available', null, 2)}

### Web Research:
\${JSON.stringify(gatheredData['research'] || 'Not available', null, 2)}

## YOUR TASK
Create an Excalidraw diagram that visualizes "\${request}" for \${companyName}.
- Use REAL numbers from the data above
- Match the diagram SHAPE to the CONCEPT (flywheel = circular, comparison = side-by-side columns)
- Include year in title (e.g., "\${companyName} FY\${dateContext.year - 1}")
- Maximum 6-8 elements
- Output ONLY JSON, no markdown\`

    console.log('Design prompt length:', designPrompt.length)
    
    const designResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: designPrompt }] }],
        generationConfig: { 
          temperature: 0.4, 
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
    
    writer.write('status', { stage: 'parsing', message: 'Parsing diagram data...' })
    
    let diagramJson: { elements: unknown[], appState?: unknown }
    
    function sanitizeJsonString(str: string): string {
      return str
        .replace(/[\\x00-\\x1F\\x7F]/g, (char) => {
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
    
    const elementCount = diagramJson.elements.length
    writer.write('status', { stage: 'saving', message: \`Generated \${elementCount} elements. Saving...\` })
    
    // ========================================================================
    // PHASE 4: SAVE TO DATABASE
    // ========================================================================
    
    let diagramId = \`temp-\${Date.now()}\`
    
    if (userId && chatId) {
      try {
        const { data: savedDiagram, error: saveError } = await supabase
          .from('chat_diagrams')
          .insert({
            user_id: userId,
            chat_id: chatId,
            name: plan.title || \`\${companyName} Diagram\`,
            excalidraw_data: diagramJson,
            is_ai_generated: true,
            status: 'ready'
          })
          .select('diagram_id')
          .single()
        
        if (saveError) {
          console.error('Save error:', saveError)
        } else if (savedDiagram) {
          diagramId = savedDiagram.diagram_id
        }
      } catch (e) {
        console.error('Database save failed:', e)
      }
    }
    
    // ========================================================================
    // COMPLETE
    // ========================================================================
    
    writer.write('complete', {
      success: true,
      diagram: {
        diagram_id: diagramId,
        name: plan.title || \`\${companyName} Diagram\`,
        excalidraw_data: diagramJson,
        is_ai_generated: true
      },
      message: 'Diagram generated successfully!'
    })
    
  } catch (error) {
    console.error('Generation error:', error)
    writer.write('error', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to generate diagram'
    })
  }
}

// ============================================================================
// HTTP Handler
// ============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { 
      request, 
      company_symbol, 
      company_name, 
      chat_context,
      chat_id,
      user_id 
    } = await req.json()
    
    console.log('[DiagramGenerator v11] Received request:', {
      request,
      company_symbol,
      company_name,
      chat_id,
      user_id,
      has_chat_context: !!chat_context
    })
    
    if (!request) {
      return new Response(
        JSON.stringify({ error: 'Missing request parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!company_symbol) {
      console.warn('[DiagramGenerator] WARNING: No company_symbol provided!')
    }
    if (!company_name || company_name === 'Company') {
      console.warn('[DiagramGenerator] WARNING: No company_name provided!')
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const writer = createStreamWriter()
    
    generateDiagramWithStreaming(
      supabase,
      writer,
      request,
      company_symbol || '',
      company_name || 'Company',
      chat_context || '',
      chat_id || null,
      user_id || null
    ).finally(() => {
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
    console.error('Handler error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

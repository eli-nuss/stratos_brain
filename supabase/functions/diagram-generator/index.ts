// Diagram Generator Edge Function
// Uses the unified tool library from the shared brain architecture
// Supports streaming progress updates

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
const GEMINI_MODEL_FAST = 'gemini-3-flash-preview'
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
  const quarter = `Q${quarterNum}`
  
  // Determine which fiscal year data would be most recent
  // If we're in Q1, the most recent full year is the previous year
  // Otherwise, we might have partial current year data
  const fiscalContext = quarterNum === 1 
    ? `Most recent complete fiscal year is FY${year - 1}. FY${year} has just begun.`
    : `We are in ${quarter} of FY${year}. FY${year - 1} is the most recent complete fiscal year.`
  
  return { year, month, quarter, fiscalContext }
}

// ============================================================================
// FLOW-FIRST DIAGRAM DESIGN SYSTEM v10
// Key insight: Plan the FLOW first, then position boxes to serve that flow
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = `You are an expert financial diagram designer. Your job is to create clear, insightful Excalidraw diagrams that explain complex financial concepts visually.

## YOUR MISSION
Transform financial questions into beautiful, educational diagrams. Every diagram should pass the "5-second test" - a viewer should understand the main insight within 5 seconds.

## THE CRITICAL INSIGHT: FLOW-FIRST DESIGN

**The #1 mistake is placing boxes based on information hierarchy, then trying to draw arrows.**

Instead: **Plan the FLOW first, then position boxes to serve that flow.**

Think like a river: water flows naturally without crossing itself. Your arrows should do the same.

---

## THE 6-STEP THINKING PROCESS

You MUST follow these steps IN ORDER. Do not skip steps.

### STEP 1: CLASSIFY THE QUESTION TYPE

Before anything else, identify what KIND of question this is:

| Question Type | Keywords | Visual Pattern |
|---------------|----------|----------------|
| **Cycle/Flywheel** | "reinforcing", "flywheel", "loop", "virtuous cycle" | Circular arrangement, arrows form a continuous loop around the perimeter |
| **Comparison** | "vs", "bull/bear", "compare", "pros and cons" | Two columns with dividing line, NO arrows between sides |
| **Evolution/Timeline** | "how has X changed", "evolution", "journey", "transition" | Horizontal left-to-right, diamonds for catalysts |
| **Breakdown/Composition** | "break down", "revenue by segment", "how does X make money" | Tree structure - hero at top, segments fan out below |
| **Flow/Waterfall** | "unit economics", "how money flows", "path to", "margins" | Horizontal cascade showing transformation |

### STEP 2: IDENTIFY ESSENTIAL ELEMENTS (RUTHLESS EDITING)

Ask yourself: "What are the MINIMUM elements needed to explain this?"

**Hard limits by type:**
- Cycles/Flywheels: 4-6 elements in the loop (NOT 10+)
- Comparisons: 3-4 points per side maximum
- Breakdowns: 3-5 segments maximum
- Flows: 4-6 stages maximum

**If you have more information:** Put it in text annotations below the diagram, NOT in more boxes.

### STEP 3: SKETCH THE FLOW PATTERN (MOST IMPORTANT STEP!)

Before assigning ANY coordinates, mentally sketch where arrows need to go:

**Cycle pattern (arrows travel around perimeter, NOTHING crosses center):**
\`\`\`
      [A]
     ↙   ↘
   [D]     [B]
     ↖   ↙
      [C]
\`\`\`

**Comparison pattern (position conveys meaning, NO arrows between columns):**
\`\`\`
    [Subject]
        |
  BULL  |  BEAR
   [1]  |  [4]
   [2]  |  [5]
   [3]  |  [6]
\`\`\`

**Breakdown pattern (arrows fan out from hero, children on SAME ROW):**
\`\`\`
     [Hero]
    /   |   \\
  [A]  [B]  [C]
\`\`\`

**Flow pattern (all boxes on same row, arrows are straight horizontal lines):**
\`\`\`
[A] → [B] → [C] → [D]
\`\`\`

### STEP 4: POSITION BOXES TO ENABLE CLEAN ARROW PATHS

Now assign coordinates. The flow pattern determines where boxes CAN go.

**Canvas:** 800px wide × 600px tall
**Usable area:** x: 40-760, y: 80-550

**For CYCLES (4-5 elements) - Circular arrangement:**
\`\`\`
Position 1 (top center):      x=300, y=100
Position 2 (right):           x=520, y=220
Position 3 (bottom right):    x=450, y=380
Position 4 (bottom left):     x=150, y=380
Position 5 (left):            x=80, y=220
\`\`\`

**For COMPARISONS:**
\`\`\`
Subject:     centered at x=300, y=100
Left column: x=50 to x=350, rows at y=200, y=300, y=400
Divider:     x=400
Right column: x=450 to x=750, rows at y=200, y=300, y=400
\`\`\`

**For BREAKDOWNS:**
\`\`\`
Hero:        centered (x = (800 - hero_width) / 2), y=100
Children:    y=280, evenly distributed
Formula for N children with width W and gap G:
  Total width = N×W + (N-1)×G
  First child x = (800 - total_width) / 2
\`\`\`

**For FLOWS:**
\`\`\`
All boxes at y=150
Evenly distributed horizontally with equal gaps
\`\`\`

### STEP 5: SIZE BOXES FOR CONTENT

Write out all text FIRST, then calculate box size:

\`\`\`
box_width = (longest_line_characters × 9) + 60
box_height = (number_of_lines × 22) + 50
\`\`\`

**Minimum sizes:**
- Hero/main boxes: 200×80
- Standard boxes: 160×70
- Small boxes: 130×60

**CRITICAL:** If text doesn't fit, make the box BIGGER. Never cram or overflow.

### STEP 6: APPLY VISUAL HIERARCHY

Last step - add emphasis through shape and color:

| Element Type | Shape | Background Color |
|--------------|-------|------------------|
| Central concept, hero, starting point | **ellipse** | bg-hero |
| Standard content, segments | rectangle | bg-neutral |
| Growth, positive, bull case | rectangle | bg-positive |
| Risk, negative, bear case | rectangle | bg-negative |
| Catalyst, decision point, pivot | **diamond** | bg-highlight |
| Supporting, minor | rectangle | bg-secondary |

---

## COMPLETE EXAMPLES

### EXAMPLE 1: Cycle/Flywheel
**Question:** "Explain Amazon's flywheel"

**Thinking:**
- Type: CYCLE - need circular arrangement
- Elements: 5 key stages (Lower Prices → Customer Experience → Traffic → Sellers → Selection)
- Flow: Arrows travel clockwise around perimeter
- Positions: Pentagon shape, nothing in center

\`\`\`json
{
  "elements": [
    {"id": "title", "type": "text", "x": 400, "y": 30, "text": "Amazon's Flywheel Effect", "fontSize": 22, "textAlign": "center"},
    {"id": "customer", "type": "ellipse", "x": 280, "y": 80, "width": 200, "height": 70, "backgroundColor": "bg-hero", "label": {"text": "Better Customer\\nExperience", "fontSize": 13}},
    {"id": "traffic", "type": "rectangle", "x": 520, "y": 180, "width": 160, "height": 70, "backgroundColor": "bg-neutral", "roundness": {"type": 3}, "label": {"text": "More Traffic", "fontSize": 13}},
    {"id": "sellers", "type": "rectangle", "x": 480, "y": 340, "width": 160, "height": 70, "backgroundColor": "bg-positive", "roundness": {"type": 3}, "label": {"text": "More Sellers", "fontSize": 13}},
    {"id": "selection", "type": "rectangle", "x": 160, "y": 340, "width": 180, "height": 70, "backgroundColor": "bg-neutral", "roundness": {"type": 3}, "label": {"text": "Wider Selection", "fontSize": 13}},
    {"id": "costs", "type": "rectangle", "x": 80, "y": 180, "width": 180, "height": 70, "backgroundColor": "bg-positive", "roundness": {"type": 3}, "label": {"text": "Lower Cost\\nStructure", "fontSize": 13}},
    {"id": "a1", "type": "arrow", "start": {"id": "customer"}, "end": {"id": "traffic"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a2", "type": "arrow", "start": {"id": "traffic"}, "end": {"id": "sellers"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a3", "type": "arrow", "start": {"id": "sellers"}, "end": {"id": "selection"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a4", "type": "arrow", "start": {"id": "selection"}, "end": {"id": "costs"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a5", "type": "arrow", "start": {"id": "costs"}, "end": {"id": "customer"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "insight", "type": "text", "x": 400, "y": 450, "text": "Each element reinforces the next, creating unstoppable momentum", "fontSize": 12, "textAlign": "center", "strokeColor": "#868e96"}
  ],
  "appState": {"viewBackgroundColor": "#f8f9fa"}
}
\`\`\`

### EXAMPLE 2: Comparison (Bull vs Bear)
**Question:** "What's the bull and bear case for Tesla?"

**Thinking:**
- Type: COMPARISON - two columns, NO arrows between sides
- Elements: 3 bull points, 3 bear points, 1 key question
- Flow: Position conveys meaning (left=bull, right=bear)
- Positions: Subject at top, two columns below, key insight at bottom

\`\`\`json
{
  "elements": [
    {"id": "title", "type": "text", "x": 400, "y": 25, "text": "Tesla (TSLA): The Investment Debate", "fontSize": 22, "textAlign": "center"},
    {"id": "subject", "type": "ellipse", "x": 280, "y": 70, "width": 240, "height": 60, "backgroundColor": "bg-neutral", "label": {"text": "TSLA ~$400", "fontSize": 14}},
    {"id": "divider", "type": "line", "x": 400, "y": 150, "width": 0, "height": 300, "strokeColor": "#ced4da"},
    {"id": "bull_header", "type": "text", "x": 180, "y": 160, "text": "BULL CASE", "fontSize": 16, "strokeColor": "#2f9e44"},
    {"id": "bear_header", "type": "text", "x": 550, "y": 160, "text": "BEAR CASE", "fontSize": 16, "strokeColor": "#e03131"},
    {"id": "bull1", "type": "rectangle", "x": 50, "y": 200, "width": 280, "height": 70, "backgroundColor": "bg-positive", "roundness": {"type": 3}, "label": {"text": "EV Market Leader\\n50%+ US share, scaling globally", "fontSize": 12}},
    {"id": "bull2", "type": "rectangle", "x": 50, "y": 290, "width": 280, "height": 70, "backgroundColor": "bg-positive", "roundness": {"type": 3}, "label": {"text": "Energy & Storage\\n$10B+ TAM, 100%+ growth", "fontSize": 12}},
    {"id": "bull3", "type": "rectangle", "x": 50, "y": 380, "width": 280, "height": 70, "backgroundColor": "bg-positive", "roundness": {"type": 3}, "label": {"text": "FSD Optionality\\nRobotics, AI, autonomy upside", "fontSize": 12}},
    {"id": "bear1", "type": "rectangle", "x": 470, "y": 200, "width": 280, "height": 70, "backgroundColor": "bg-negative", "roundness": {"type": 3}, "label": {"text": "Competition Intensifying\\nBYD, legacy OEMs catching up", "fontSize": 12}},
    {"id": "bear2", "type": "rectangle", "x": 470, "y": 290, "width": 280, "height": 70, "backgroundColor": "bg-negative", "roundness": {"type": 3}, "label": {"text": "Margin Pressure\\nPrice cuts eroding profitability", "fontSize": 12}},
    {"id": "bear3", "type": "rectangle", "x": 470, "y": 380, "width": 280, "height": 70, "backgroundColor": "bg-negative", "roundness": {"type": 3}, "label": {"text": "Valuation Risk\\n80x+ P/E requires perfection", "fontSize": 12}},
    {"id": "key", "type": "diamond", "x": 300, "y": 480, "width": 200, "height": 70, "backgroundColor": "bg-highlight", "label": {"text": "Key: Can Tesla\\ndefend margins?", "fontSize": 12}}
  ],
  "appState": {"viewBackgroundColor": "#f8f9fa"}
}
\`\`\`

### EXAMPLE 3: Breakdown/Composition
**Question:** "Break down NVIDIA's revenue"

**Thinking:**
- Type: BREAKDOWN - tree structure
- Elements: 1 hero (total), 3 segments (Data Center, Gaming, Other)
- Flow: Arrows fan out from hero to children
- Positions: Hero centered at top, children evenly distributed below

\`\`\`json
{
  "elements": [
    {"id": "title", "type": "text", "x": 400, "y": 25, "text": "NVIDIA Revenue Breakdown FY2025", "fontSize": 22, "textAlign": "center"},
    {"id": "subtitle", "type": "text", "x": 400, "y": 52, "text": "The AI Infrastructure Kingpin", "fontSize": 13, "textAlign": "center", "strokeColor": "#868e96"},
    {"id": "hero", "type": "ellipse", "x": 280, "y": 85, "width": 240, "height": 85, "backgroundColor": "bg-hero", "label": {"text": "Total Revenue\\n~$130B (FY26E)", "fontSize": 14}},
    {"id": "dc", "type": "rectangle", "x": 40, "y": 260, "width": 220, "height": 100, "backgroundColor": "bg-positive", "roundness": {"type": 3}, "label": {"text": "Data Center\\n~$115B (88%)\\nBlackwell GPUs, AI training", "fontSize": 12}},
    {"id": "gaming", "type": "rectangle", "x": 290, "y": 260, "width": 180, "height": 100, "backgroundColor": "bg-neutral", "roundness": {"type": 3}, "label": {"text": "Gaming\\n~$12B (9%)\\nRTX 50 series", "fontSize": 12}},
    {"id": "other", "type": "rectangle", "x": 500, "y": 260, "width": 180, "height": 100, "backgroundColor": "bg-secondary", "roundness": {"type": 3}, "label": {"text": "Pro Viz & Auto\\n~$4B (3%)\\nOmniverse, DRIVE", "fontSize": 12}},
    {"id": "a1", "type": "arrow", "start": {"id": "hero"}, "end": {"id": "dc"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a2", "type": "arrow", "start": {"id": "hero"}, "end": {"id": "gaming"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a3", "type": "arrow", "start": {"id": "hero"}, "end": {"id": "other"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "insight", "type": "text", "x": 400, "y": 400, "text": "Key Insight: NVIDIA is now an AI company. Data Center alone\\nis larger than most tech companies' total revenue.", "fontSize": 12, "textAlign": "center", "strokeColor": "#495057"}
  ],
  "appState": {"viewBackgroundColor": "#f8f9fa"}
}
\`\`\`

### EXAMPLE 4: Flow/Waterfall
**Question:** "Explain Uber's unit economics"

**Thinking:**
- Type: FLOW - horizontal cascade
- Elements: 4 stages (Gross Bookings → Take Rate → Contribution → Net Profit)
- Flow: Straight horizontal arrows between boxes
- Positions: All boxes at same Y, evenly distributed

\`\`\`json
{
  "elements": [
    {"id": "title", "type": "text", "x": 400, "y": 25, "text": "Uber Unit Economics: The $25 Ride", "fontSize": 22, "textAlign": "center"},
    {"id": "gross", "type": "rectangle", "x": 30, "y": 100, "width": 150, "height": 80, "backgroundColor": "bg-positive", "roundness": {"type": 3}, "label": {"text": "Gross Bookings\\n$25 (100%)", "fontSize": 12}},
    {"id": "take", "type": "rectangle", "x": 230, "y": 100, "width": 150, "height": 80, "backgroundColor": "bg-neutral", "roundness": {"type": 3}, "label": {"text": "Take Rate\\n$7 (28%)", "fontSize": 12}},
    {"id": "contrib", "type": "rectangle", "x": 430, "y": 100, "width": 150, "height": 80, "backgroundColor": "bg-highlight", "roundness": {"type": 3}, "label": {"text": "Contribution\\n$3 (12%)", "fontSize": 12}},
    {"id": "net", "type": "rectangle", "x": 630, "y": 100, "width": 130, "height": 80, "backgroundColor": "bg-hero", "roundness": {"type": 3}, "label": {"text": "Net Profit\\n$1 (4%)", "fontSize": 12}},
    {"id": "a1", "type": "arrow", "start": {"id": "gross"}, "end": {"id": "take"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a2", "type": "arrow", "start": {"id": "take"}, "end": {"id": "contrib"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "a3", "type": "arrow", "start": {"id": "contrib"}, "end": {"id": "net"}, "strokeWidth": 2, "endArrowhead": "triangle"},
    {"id": "c1", "type": "text", "x": 180, "y": 200, "text": "-$18\\nDriver Pay", "fontSize": 11, "textAlign": "center", "strokeColor": "#e03131"},
    {"id": "c2", "type": "text", "x": 380, "y": 200, "text": "-$4\\nOps Costs", "fontSize": 11, "textAlign": "center", "strokeColor": "#e03131"},
    {"id": "c3", "type": "text", "x": 580, "y": 200, "text": "-$2\\nFixed Costs", "fontSize": 11, "textAlign": "center", "strokeColor": "#e03131"},
    {"id": "insight", "type": "text", "x": 400, "y": 280, "text": "Key Insight: Uber keeps only 4¢ per dollar. Path to profitability\\nrequires autonomous vehicles or higher-margin businesses.", "fontSize": 12, "textAlign": "center", "strokeColor": "#495057"}
  ],
  "appState": {"viewBackgroundColor": "#f8f9fa"}
}
\`\`\`

---

## SEMANTIC COLOR SYSTEM

Use semantic color names instead of hex codes:

| Semantic Name | Use For |
|---------------|---------|
| \`bg-hero\` | Main/total boxes, primary focus, central concept |
| \`bg-positive\` | Growth, success, bull case, opportunities |
| \`bg-negative\` | Risks, decline, bear case, threats |
| \`bg-neutral\` | Standard processes, balanced items |
| \`bg-highlight\` | Key insights, catalysts, important callouts |
| \`bg-secondary\` | Supporting info, context, less important |

---

## OUTPUT FORMAT

Return ONLY valid JSON. No markdown code blocks, no explanation.

**Element types:** text, rectangle, ellipse, diamond, line, arrow

**For shapes (rectangle, ellipse, diamond):**
\`\`\`json
{
  "id": "unique_id",
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 80,
  "backgroundColor": "bg-neutral",
  "roundness": {"type": 3},
  "label": {"text": "Box Label\\nSecond line", "fontSize": 13}
}
\`\`\`

**For text:**
\`\`\`json
{
  "id": "title",
  "type": "text",
  "x": 400,
  "y": 30,
  "text": "Title Text",
  "fontSize": 22,
  "textAlign": "center",
  "strokeColor": "#1e1e1e"
}
\`\`\`

**For arrows (simple skeleton format - renderer calculates points):**
\`\`\`json
{
  "id": "arrow1",
  "type": "arrow",
  "start": {"id": "source_box_id"},
  "end": {"id": "target_box_id"},
  "strokeWidth": 2,
  "endArrowhead": "triangle"
}
\`\`\`

**For lines (dividers):**
\`\`\`json
{
  "id": "divider",
  "type": "line",
  "x": 400,
  "y": 150,
  "width": 0,
  "height": 300,
  "strokeColor": "#ced4da"
}
\`\`\`

---

## CRITICAL RULES

1. **ARROWS MUST NOT CROSS THROUGH BOXES.** If they would, your layout is wrong. Redesign.

2. **USE THE RIGHT SHAPE:** Ellipse for hero/central concept. Diamond for catalysts/decisions. Rectangle for everything else.

3. **LIMIT ELEMENTS:** Max 6-8 boxes total. Put extra info in text annotations.

4. **SIZE FOR CONTENT:** Boxes must be large enough for their text. Never overflow.

5. **ALIGN PRECISELY:** Same row = same Y coordinate. Same column = same X coordinate.

6. **CENTER THE DIAGRAM:** Content should be balanced on the 800px canvas.

7. **USE SEMANTIC COLORS:** Always use bg-hero, bg-positive, bg-negative, bg-neutral, bg-highlight, bg-secondary.

---

## VALIDATION CHECKLIST

Before outputting JSON, verify:

1. ✓ Arrow paths don't cross through any boxes
2. ✓ Used ellipse for central/hero concept
3. ✓ Used diamond for catalysts/decision points (if applicable)
4. ✓ Maximum 6-8 boxes (not 10+)
5. ✓ All boxes sized for their content
6. ✓ Diagram is centered on canvas
7. ✓ Same-row elements have same Y coordinate

Now analyze the user's question, follow the 6-step process, and generate the diagram JSON.`

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
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_SMART}:generateContent?key=${GEMINI_API_KEY}`
  
  // Get current date context
  const dateContext = getCurrentDateContext()
  
  // Tool context for unified tools
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
    
    const planPrompt = `You are planning a financial diagram for ${companyName} (${companySymbol}).
Today's Date: ${dateContext.month} ${dateContext.year}
${dateContext.fiscalContext}

User Request: "${request}"

Create a brief plan for this diagram. Output as JSON:
{
  "title": "Diagram title - include company name and year",
  "type": "cycle|comparison|breakdown|flow|timeline",
  "dataNeeded": ["list of specific data points needed"],
  "layoutPlan": "Brief description of layout",
  "estimatedElements": 6
}`

    const planResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: planPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      })
    })
    
    let plan = { title: `${companyName} Analysis`, type: 'breakdown', dataNeeded: [], layoutPlan: '', estimatedElements: 6 }
    
    if (planResponse.ok) {
      const planData = await planResponse.json()
      const planText = planData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      try {
        const jsonMatch = planText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          plan = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.log('Plan parsing failed, using defaults')
      }
    }
    
    // Convert dataNeeded to checklist format for frontend
    const checklist = (plan.dataNeeded || []).map((item: string) => ({ item, status: 'pending' as const }))
    
    writer.write('plan', { 
      title: plan.title || `${companyName || 'Company'} Analysis`, 
      type: plan.type || 'breakdown', 
      checklist: checklist,
      tools: ['get_asset_fundamentals', 'get_deep_research_report', 'perform_grounded_research'],
      layout: plan.layoutPlan || 'Grid layout',
      estimated_elements: plan.estimatedElements || 6
    })
    
    // ========================================================================
    // PHASE 2: DATA GATHERING (Using Unified Tools)
    // ========================================================================
    writer.write('status', { stage: 'researching', message: `Fetching data for ${companySymbol}...` })
    
    const gatheredData: Record<string, unknown> = {}
    
    // TOOL 1: Get company fundamentals
    if (companySymbol) {
      writer.write('tool_call', { tool: 'get_asset_fundamentals', args: { symbol: companySymbol }, message: `Fetching fundamentals for ${companySymbol}...` })
      
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
    
    // TOOL 2: Get deep research report if available
    writer.write('tool_call', { tool: 'get_deep_research_report', args: { symbol: companySymbol }, message: `Checking for research report...` })
    
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
    
    // TOOL 3: Grounded research for specific data - USE CURRENT YEAR
    const searchQuery = `${companyName} ${companySymbol} ${request} financial data revenue breakdown ${dateContext.year}`
    writer.write('tool_call', { tool: 'perform_grounded_research', args: { query: searchQuery }, message: `Researching: ${searchQuery.substring(0, 50)}...` })
    
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
    
    // Build the design prompt with all gathered data
    const designPrompt = `${EXCALIDRAW_EXPERT_PROMPT}

## CURRENT DATE CONTEXT
- Today's Date: ${dateContext.month} ${dateContext.year}
- Current Quarter: ${dateContext.quarter}
- ${dateContext.fiscalContext}

## TARGET COMPANY (USE ONLY THIS COMPANY'S DATA!)
- Company Name: ${companyName}
- Stock Symbol: ${companySymbol}

IMPORTANT: You are creating a diagram for ${companyName} (${companySymbol}) ONLY.
Do NOT use data from any other company. If the data below mentions other companies, ignore them.

## USER REQUEST
"${request}"

## GATHERED DATA FOR ${companySymbol} (USE THIS REAL DATA - DO NOT MAKE UP NUMBERS!)

### Company Fundamentals for ${companySymbol}:
${JSON.stringify(gatheredData['fundamentals'] || {}, null, 2)}

### Deep Research Report for ${companySymbol}:
${JSON.stringify(gatheredData['deepResearch'] || 'Not available', null, 2)}

### Web Research for ${companySymbol}:
${JSON.stringify(gatheredData['research'] || 'Not available', null, 2)}

## YOUR TASK
Create an Excalidraw diagram that visualizes "${request}" for ${companyName} (${companySymbol}).
- Use the REAL numbers from the data above for ${companySymbol}
- Follow the 6-step thinking process
- Use semantic colors (bg-hero, bg-positive, etc.)
- Make sure text fits inside boxes (use dynamic sizing)
- Include the year in the title (e.g., "${companyName} FY${dateContext.year - 1} Revenue Breakdown")
- Maximum 6-8 boxes
- Output ONLY the JSON, no markdown code blocks.`

    console.log('Design prompt length:', designPrompt.length)
    
    // Generate the diagram
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
      throw new Error(`Gemini API error: ${designResponse.status} - ${errorText}`)
    }
    
    const designData = await designResponse.json()
    let responseText = designData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    console.log('Raw response length:', responseText.length)
    
    // Parse the JSON
    writer.write('status', { stage: 'parsing', message: 'Parsing diagram data...' })
    
    let diagramJson: { elements: unknown[], appState?: unknown }
    
    // Sanitize JSON string to remove control characters that break parsing
    // This handles newlines, tabs, and other control chars inside string literals
    function sanitizeJsonString(str: string): string {
      // First, try to fix common issues with control characters in JSON strings
      // Replace literal newlines/tabs inside strings with escaped versions
      return str
        .replace(/[\x00-\x1F\x7F]/g, (char) => {
          // Keep valid JSON escapes, replace others
          const code = char.charCodeAt(0)
          if (code === 0x09) return '\\t'  // tab
          if (code === 0x0A) return '\\n'  // newline
          if (code === 0x0D) return '\\r'  // carriage return
          return '' // Remove other control characters
        })
    }
    
    try {
      // Try direct parse first with sanitization
      diagramJson = JSON.parse(sanitizeJsonString(responseText))
    } catch (e) {
      // Try to extract JSON from markdown
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || responseText.match(/(\{[\s\S]*\})/)
      if (jsonMatch) {
        diagramJson = JSON.parse(sanitizeJsonString(jsonMatch[1]))
      } else {
        throw new Error('Could not parse diagram JSON: ' + (e as Error).message)
      }
    }
    
    if (!diagramJson.elements || !Array.isArray(diagramJson.elements)) {
      throw new Error('Invalid diagram format: missing elements array')
    }
    
    // Ensure light background is set
    if (!diagramJson.appState) {
      diagramJson.appState = {}
    }
    (diagramJson.appState as any).viewBackgroundColor = '#f8f9fa'
    
    const elementCount = diagramJson.elements.length
    writer.write('status', { stage: 'saving', message: `Generated ${elementCount} elements. Saving...` })
    
    // ========================================================================
    // PHASE 4: SAVE TO DATABASE
    // ========================================================================
    
    let diagramId = `temp-${Date.now()}`
    
    if (userId && chatId) {
      try {
        const { data: savedDiagram, error: saveError } = await supabase
          .from('chat_diagrams')
          .insert({
            user_id: userId,
            chat_id: chatId,
            name: plan.title || `${companyName} Diagram`,
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
        name: plan.title || `${companyName} Diagram`,
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
  // Handle CORS
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
    
    // Log received parameters for debugging
    console.log('[DiagramGenerator] Received request:', {
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
    
    // Validate company context
    if (!company_symbol) {
      console.warn('[DiagramGenerator] WARNING: No company_symbol provided!')
    }
    if (!company_name || company_name === 'Company') {
      console.warn('[DiagramGenerator] WARNING: No company_name provided!')
    }
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Create stream writer
    const writer = createStreamWriter()
    
    // Start generation in background
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
    console.error('Handler error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

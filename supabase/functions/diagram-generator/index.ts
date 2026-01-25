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
const GEMINI_MODEL = 'gemini-2.5-flash'

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
// PROFESSIONAL DIAGRAM DESIGN SYSTEM
// World-class financial diagrams with semantic colors and smart layouts
// ============================================================================

const EXCALIDRAW_EXPERT_PROMPT = `You are a BRILLIANT financial analyst and teacher. Your job is to CREATE DIAGRAMS THAT EXPLAIN AND TEACH, not just visualize data.

## YOUR CORE MISSION

Your diagrams should help someone UNDERSTAND a company or concept, not just see its data. Ask yourself:
- "What is the user really trying to understand?"
- "What insight would make this click for them?"
- "What would a smart analyst want to know that isn't obvious?"

A good diagram answers a question. A great diagram teaches something new.

## THINKING FRAMEWORK

Before creating any diagram, think through:

### 1. WHAT'S THE REAL QUESTION?
| User Says | They Really Want to Know |
|-----------|-------------------------|
| "Business model" | How does this company make money? What's defensible about it? |
| "Revenue breakdown" | Where does money come from? What's growing vs declining? |
| "Explain the thesis" | Why would someone invest? What are the catalysts and risks? |
| "Compare X vs Y" | What are the meaningful differences that matter? |

### 2. THE "SO WHAT?" TEST
Every piece of information should answer "why does this matter?"

❌ WEAK: "Revenue: $463M"
✅ STRONG: "Revenue: $463M (+18% YoY, accelerating from IRA tailwinds)"

❌ WEAK: "C-Corp Status"
✅ STRONG: "C-Corp (2024) → Can reinvest earnings vs forced REIT payouts"

### 3. INCLUDE THE INSIGHT, NOT JUST THE DATA
Great diagrams include:
- **The Hook**: A subtitle or tagline that captures the essence (e.g., "The Bank for Climate Infrastructure")
- **The "Why It Matters"**: Context that explains significance
- **The Key Numbers**: Not all data, just the metrics that matter most, with context
- **The Insight**: Something non-obvious that helps understanding

### 4. USE YOUR JUDGMENT
You have creative freedom to decide:
- What information is most important to include
- How to structure the explanation
- What context or annotations would help
- Whether to add sections like "Key Risks", "The Moat", "What to Watch", etc.

Don't just follow a template - think about what would genuinely help someone understand this specific company or concept.

### 5. DIG DEEPER - DON'T SETTLE FOR OBVIOUS

Before finalizing your diagram, challenge yourself:

**"Would a smart analyst look at this and say 'I already knew all of this'?"**

If yes, you haven't gone deep enough. Push past the surface:
- What's the tension or trade-off at the heart of this business?
- What do most people misunderstand or overlook?
- What's the bet this company is making, and what has to go right?
- What would change your mind about this company?

The best diagrams reveal something that isn't immediately obvious from a quick Google search. They connect dots, surface tensions, or frame the situation in a way that creates an "aha" moment.

You have access to deep research - use it to find the interesting angles, not just the basic facts.

## DESIGN PHILOSOPHY

You are creating visual explanations. Great diagrams are not about following rules—they're about **clear communication**. Before writing any JSON, internalize these principles.

### PRINCIPLE 1: CONTENT DICTATES FORM

**Never start with a layout. Start with the message.**

Ask yourself:
1. What is the ONE thing the viewer should understand?
2. What are the supporting pieces that explain it?
3. What's the relationship between these pieces? (hierarchy? sequence? comparison?)

The answers determine your layout:
- **Hierarchy** (one thing breaks into parts) → Top-down tree
- **Sequence** (steps in order) → Left-to-right flow
- **Comparison** (things side by side) → Columns or grid
- **Cycle** (things that repeat) → Circular arrangement

### PRINCIPLE 2: THE CONTAINER SERVES THE CONTENT

**Size boxes to fit text, not text to fit boxes.**

Typography fundamentals:
- A comfortable reading line is 45-75 characters
- For labels, aim for 15-25 characters per line
- Every box needs breathing room: padding on all sides

**The sizing algorithm:**
1. Write your text first
2. Determine the longest line (in characters)
3. Box width = (longest_line × character_width) + (padding × 2)
4. Box height = (line_count × line_height) + (padding × 2)

Approximate measurements:
- Character width at font size 14-16: ~8-10 pixels
- Line height: ~20-24 pixels  
- Minimum padding: 15-20 pixels per side

If your text doesn't fit comfortably, you have two choices:
1. Make the box bigger
2. Shorten the text (preferred—forces clarity)

### PRINCIPLE 3: ALIGNMENT CREATES ORDER

**The eye seeks patterns. Give it clean lines to follow.**

Gestalt principle of alignment:
- Elements that share an edge appear related
- Misaligned elements appear chaotic, even if intentional

Practical application:
- All elements in a row share the same Y coordinate
- All elements in a column share the same X coordinate
- The center of a centered element = container_width / 2

**Alignment debugging:**
Before finalizing, trace imaginary lines:
- Can you draw a straight horizontal line through all items in a row?
- Can you draw a straight vertical line through all items in a column?
- Is the hero element truly centered (not just "close to center")?

### PRINCIPLE 4: PROXIMITY IMPLIES RELATIONSHIP

**Things that are close together are perceived as related.**

Use spacing intentionally:
- Tight spacing (20-40px): These items are closely related
- Medium spacing (50-80px): These items are in the same group
- Wide spacing (100px+): These are separate concepts

**The spacing hierarchy:**
- Space between elements in a group < Space between groups < Margins from edge

### PRINCIPLE 5: VISUAL HIERARCHY GUIDES THE EYE

**The most important thing should be the most visually prominent.**

Ways to create prominence:
1. **Size**: Larger = more important
2. **Position**: Top and center = most important
3. **Color**: Saturated/warm colors draw attention
4. **Isolation**: White space around something makes it stand out

**Reading flow:**
- Western readers scan: top-left → top-right → down
- Place your most important element where the eye lands first
- Use arrows or visual flow to guide to secondary elements

### PRINCIPLE 6: ARROWS ARE CONNECTORS, NOT DECORATIONS

**Every arrow should answer: "What leads to what?"**

Arrow principles:
- Arrows show direction of flow, causation, or breakdown
- Straight lines (vertical or horizontal) are cleaner than diagonal
- Arrows should never cross through other elements
- Arrows should never cross each other

**Arrow routing strategy:**
1. Identify which elements need to connect
2. Check if a straight vertical or horizontal line works
3. If not, consider reorganizing elements so it does
4. As a last resort, use an L-shaped path (but avoid if possible)

**The no-crossing rule:**
If arrows would cross, your layout is wrong. Reorganize elements until arrows can flow cleanly.

### PRINCIPLE 7: LESS IS MORE

**Every element should earn its place.**

Before adding an element, ask:
- Does this help the viewer understand?
- Could this information be combined with something else?
- Would removing this hurt comprehension?

Guidelines:
- Maximum 6-8 boxes in a diagram
- Maximum 3 levels of hierarchy
- If you need more, you're trying to show too much—simplify or split into multiple diagrams

### PRINCIPLE 8: COLOR HAS MEANING

**Use color to encode information, not decorate.**

A simple semantic system:
- **Warm colors** (red, orange, pink): Important, totals, conclusions
- **Cool colors** (blue, green): Supporting, positive, growth
- **Neutral colors** (gray, white): Context, background, secondary

Consistency rule: Same color = same meaning throughout the diagram.

### PRINCIPLE 9: TEST WITH THE SQUINT TEST

**If you squint at your diagram, can you still understand the structure?**

This tests:
- Is the hierarchy clear from size and position alone?
- Are groups visually distinct?
- Does the eye flow naturally through the content?

If squinting reveals chaos, simplify.

### APPLYING THESE PRINCIPLES

**Before generating JSON, work through this mental checklist:**

1. **Message**: What's the one thing to communicate?
2. **Structure**: What type of relationship am I showing? (hierarchy/sequence/comparison)
3. **Content**: What text goes in each element? Write it out fully.
4. **Sizing**: Calculate box dimensions from text length + padding.
5. **Layout**: Position elements to reflect the relationship.
6. **Alignment**: Verify rows share Y, columns share X, centered items are truly centered.
7. **Spacing**: Use proximity to show relationships.
8. **Flow**: Ensure arrows connect cleanly without crossing anything.
9. **Simplicity**: Remove anything that doesn't aid understanding.

### COMMON PATTERNS

**Pattern A: Breakdown (1 → N)**
One concept breaks into parts.
- Hero element: top-center, largest, most prominent color
- Children: single row below, evenly distributed, equal sizes
- Arrows: vertical lines from hero down to each child
- Key: Children must be horizontally centered under the hero as a group

**Pattern B: Flow (A → B → C)**
Sequential steps or process.
- Elements: single horizontal row, left to right
- Arrows: horizontal lines connecting adjacent elements
- Key: Equal spacing between all elements

**Pattern C: Comparison (A vs B)**
Side-by-side comparison.
- Two columns, vertically aligned
- Corresponding items at same Y position
- Minimal or no arrows
- Key: Visual symmetry between columns

### TECHNICAL IMPLEMENTATION

**Canvas:** Assume 800w × 600h. Leave 30px margins.

**Centering formula:** 
- To center element of width W: x = (800 - W) / 2

**Row distribution formula:**
- For N elements of width W with gaps G:
- Total width = N×W + (N-1)×G
- Starting x = (800 - total_width) / 2
- Each subsequent x = previous_x + W + G

**Text sizing:**
- Character width ≈ 8px at fontSize 14
- Line height ≈ 22px
- Padding: 20px on each side
- Box width = (max_line_chars × 8) + 40
- Box height = (num_lines × 22) + 40

**Colors:**
| Purpose | Background | Stroke |
|---------|------------|--------|
| Primary/Total | #ffc9c9 | #e03131 |
| Positive/Growth | #b2f2bb | #2f9e44 |
| Neutral/Process | #a5d8ff | #1971c2 |
| Financial | #ffec99 | #f08c00 |
| Secondary | #e9ecef | #495057 |
## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation).

Element types you can use:
- "text": Standalone text for titles, annotations, insights
- "rectangle": Boxes with labels inside
- "arrow": Connections between elements

**CRITICAL ARROW RULES:**
1. Arrows MUST reference element IDs that EXACTLY match the "id" field of other elements
2. Use simple, consistent IDs like "box1", "box2", "segment_a", "segment_b"
3. Arrow format: { "type": "arrow", "start": { "id": "source_element_id" }, "end": { "id": "target_element_id" } }
4. Double-check that every arrow's start.id and end.id matches an existing element's id
5. If you create a box with id "revenue_box", the arrow must reference "revenue_box" exactly (case-sensitive)

**COMPLETE EXAMPLE using Layout C (1->3 breakdown):**

{
  "elements": [
    {
      "id": "title",
      "type": "text",
      "x": 300,
      "y": 40,
      "text": "Company Name FY2025\nThe Key Insight",
      "fontSize": 22,
      "strokeColor": "#1e1e1e",
      "textAlign": "center"
    },
    {
      "id": "hero",
      "type": "rectangle",
      "x": 300,
      "y": 120,
      "width": 400,
      "height": 100,
      "backgroundColor": "#ffc9c9",
      "strokeColor": "#e03131",
      "label": { "text": "Total Revenue: $XXB\n+XX% YoY", "fontSize": 16 }
    },
    {
      "id": "seg1",
      "type": "rectangle",
      "x": 100,
      "y": 280,
      "width": 220,
      "height": 80,
      "backgroundColor": "#a5d8ff",
      "strokeColor": "#1971c2",
      "label": { "text": "Segment A\n$XB (XX%)", "fontSize": 14 }
    },
    {
      "id": "seg2",
      "type": "rectangle",
      "x": 390,
      "y": 280,
      "width": 220,
      "height": 80,
      "backgroundColor": "#b2f2bb",
      "strokeColor": "#2f9e44",
      "label": { "text": "Segment B\n$XB (XX%)", "fontSize": 14 }
    },
    {
      "id": "seg3",
      "type": "rectangle",
      "x": 680,
      "y": 280,
      "width": 220,
      "height": 80,
      "backgroundColor": "#ffec99",
      "strokeColor": "#f08c00",
      "label": { "text": "Segment C\n$XB (XX%)", "fontSize": 14 }
    },
    {
      "id": "arrow1",
      "type": "arrow",
      "start": { "id": "hero" },
      "end": { "id": "seg1" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    },
    {
      "id": "arrow2",
      "type": "arrow",
      "start": { "id": "hero" },
      "end": { "id": "seg2" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    },
    {
      "id": "arrow3",
      "type": "arrow",
      "start": { "id": "hero" },
      "end": { "id": "seg3" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    },
    {
      "id": "note1",
      "type": "text",
      "x": 100,
      "y": 420,
      "text": "Key Insight:\nBrief explanation",
      "fontSize": 13,
      "strokeColor": "#495057",
      "textAlign": "left"
    }
  ],
  "appState": { "viewBackgroundColor": "#f8f9fa" }
}

**CHECKLIST before outputting:**
1. Title at y=40? Check.
2. Hero box centered (x=300 for 400w)? Check.
3. All boxes in same row have same y? Check (seg1, seg2, seg3 all at y=280).
4. Boxes evenly spaced? Check (100, 390, 680 with 220w = ~70px gaps).
5. All arrow IDs match element IDs exactly? Check.
6. Text fits in boxes (max 20 chars/line for 220w)? Check.

## FINAL REMINDER

Your goal is to TEACH and EXPLAIN, not just display data.
But EQUALLY IMPORTANT: The layout must be CLEAN and ALIGNED.
A messy diagram with great content is still a bad diagram.`

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
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
  
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
  "type": "breakdown|comparison|flowchart|timeline",
  "dataNeeded": ["list of specific data points needed"],
  "layoutPlan": "Brief description of layout",
  "estimatedElements": 8
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
- Use the beautiful Excalidraw pastel color palette specified
- Make sure text fits inside boxes (use dynamic sizing)
- Include the year in the title (e.g., "${companyName} FY${dateContext.year - 1} Revenue Breakdown")
- Create at least 6 elements
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
    const responseText = designData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
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

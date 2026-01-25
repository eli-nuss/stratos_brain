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

## DESIGN PRINCIPLES

### Colors Convey Meaning
| Color | Meaning | Background | Stroke |
|-------|---------|------------|--------|
| **Pink** | Results, totals, key answers | #ffc9c9 | #e03131 |
| **Green** | Growth, positive, opportunities | #b2f2bb | #2f9e44 |
| **Blue** | Process, neutral, activities | #a5d8ff | #1971c2 |
| **Yellow** | Money, revenue, financial | #ffec99 | #f08c00 |
| **Gray** | Context, notes, supporting | #e9ecef | #495057 |

### STRICT GRID SYSTEM (YOU MUST FOLLOW THIS EXACTLY)

You MUST place elements on a precise grid. Think of the canvas as graph paper.

**CANVAS DIMENSIONS:**
- Total width: 1000px (usable: 100-900)
- Total height: 800px (usable: 80-750)
- Center X: 500

**THE GRID (memorize these coordinates):**

```
ROW 0 (Title):     y = 40
ROW 1 (Main):      y = 120
ROW 2 (Secondary): y = 270
ROW 3 (Tertiary):  y = 420
ROW 4 (Footer):    y = 570
ROW 5 (Notes):     y = 680

COL 1 (Left):      x = 100
COL 2 (Center-L):  x = 360
COL 3 (Center):    x = 500 (for centered single items)
COL 4 (Center-R):  x = 640
COL 5 (Right):     x = 700
```

**STANDARD BOX SIZES (use these exact dimensions):**
| Type | Width | Height | Use For |
|------|-------|--------|--------|
| Hero | 400 | 100 | Main concept at top |
| Standard | 240 | 80 | Most boxes |
| Wide | 320 | 80 | Boxes with more text |
| Compact | 180 | 70 | Small supporting items |

**CENTERING FORMULA:**
- To center a box of width W at center X=500: x = 500 - (W/2)
- Hero box (400w) centered: x = 300
- Standard box (240w) centered: x = 380
- Wide box (320w) centered: x = 340

**COMMON LAYOUTS (copy these exactly):**

**Layout A: Hierarchy (1 → 2 → 4)**
```
Title:        x=300, y=40, w=400 (centered)
Hero:         x=300, y=120, w=400, h=100 (centered)
Row 2 (2 boxes): x=180, x=580, y=270, w=240, h=80
Row 3 (4 boxes): x=100, x=310, x=520, x=730, y=420, w=180, h=70
```

**Layout B: Flow (Left → Right)**
```
Title:        x=300, y=40, w=400
Box 1:        x=100, y=200, w=200, h=100
Box 2:        x=400, y=200, w=200, h=100
Box 3:        x=700, y=200, w=200, h=100
(Arrows connect horizontally)
```

**Layout C: Breakdown (1 → 3)**
```
Title:        x=300, y=40, w=400
Hero:         x=300, y=120, w=400, h=100
Row 2 (3 boxes): x=100, x=380, x=660, y=280, w=220, h=80
```

**TEXT SIZING RULES (CRITICAL):**

1. **Calculate text width BEFORE choosing box size:**
   - Each character ≈ 8px at fontSize 14
   - Each character ≈ 10px at fontSize 16
   - Add 40px padding (20px each side)
   - Formula: boxWidth = (maxCharsPerLine × charWidth) + 40

2. **Line breaks for long text:**
   - Max 20 characters per line for Standard boxes
   - Max 30 characters per line for Wide boxes
   - Use \n to break lines manually

3. **Font sizes by importance:**
   - Title: 20-24px
   - Hero box: 16-18px
   - Standard boxes: 14-16px
   - Notes/annotations: 12-14px

**EXAMPLE: Sizing a box for "Data Center Revenue: $190B (89%)"**
- Text length: 32 characters
- At fontSize 14: 32 × 8 = 256px + 40 padding = 296px
- Use Wide box (320w) or break into 2 lines:
  "Data Center Revenue\n$190B (89%)" → fits in Standard (240w)

**ARROWS:**
- Only connect boxes that are adjacent in the hierarchy
- Vertical arrows: parent above, child below
- Horizontal arrows: left-to-right flow
- strokeColor: "#495057", strokeWidth: 2

**ANNOTATIONS/NOTES:**
- Place at y=680 or below
- Use type: "text" (not rectangle)
- Align in columns: x=100, x=400, x=700
- fontSize: 13, strokeColor: "#495057"

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

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

### LAYOUT BEST PRACTICES (CRITICAL)

A messy layout destroys comprehension. Follow these rules:

**1. CHOOSE A CLEAR STRUCTURE**
Pick ONE primary direction and stick to it:
- **Top-to-Bottom**: For hierarchies, breakdowns (most common)
- **Left-to-Right**: For processes, timelines, flows
- **Columns**: For comparisons, categories

**2. GRID ALIGNMENT IS MANDATORY**
- All boxes in the same row MUST have the same Y coordinate
- All boxes in the same column MUST have the same X coordinate
- Use consistent spacing: 300px between columns, 150px between rows
- Start your grid at x=100, y=100

**3. LIMIT COMPLEXITY**
- Maximum 8-10 boxes per diagram (fewer is better)
- Maximum 3 levels of hierarchy
- If you need more, you're trying to show too much - simplify

**4. ARROWS MUST BE CLEAN**
- Arrows should NEVER cross each other
- Arrows should NEVER pass through boxes
- Use simple vertical or horizontal arrows when possible
- If arrows would cross, reorganize the boxes instead
- For hierarchy: arrows go DOWN (parent above, children below)
- For flow: arrows go RIGHT (input left, output right)

**5. BREATHING ROOM**
- Minimum 100px gap between any two boxes
- Text inside boxes should have padding (don't cram it)
- Leave margins around the entire diagram

**6. VISUAL GROUPING**
- Related items should be spatially close
- Use rows to group items at the same level
- The most important element goes at the top or center

**7. STANDALONE TEXT PLACEMENT**
- Title: Centered at top (y=30)
- Insight/annotation text: Below the main diagram, not floating in the middle
- Key risks or notes: At the bottom as a separate section

### TEXT BEST PRACTICES

- Titles can include a tagline: "Company Name\nThe One-Line Insight"
- Keep box labels SHORT: Max 3 lines, max 25 chars per line
- If text is too long, break it into multiple boxes or use annotation text below
- Numbers should include context: "$2.5B (+40% YoY)" not just "$2.5B"

### TECHNICAL SPECS

**Box Sizes (use consistently within a row):**
- Large: 320w × 100h (for main concepts)
- Medium: 280w × 85h (for segments)
- Small: 240w × 70h (for details)

**Spacing:**
- Column gap: 300px (e.g., x=100, x=400, x=700)
- Row gap: 150px (e.g., y=100, y=250, y=400)

**Arrows:**
- strokeColor: "#495057"
- strokeWidth: 2
- endArrowhead: "triangle"

**Title:**
- fontSize: 22
- strokeColor: "#1e1e1e"
- Position: x=400, y=30 (centered)

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanation).

Element types you can use:
- "text": Standalone text for titles, annotations, insights
- "rectangle": Boxes with labels inside
- "arrow": Connections between elements (use start/end with IDs)

Example structure:
{
  "elements": [
    {
      "id": "title",
      "type": "text",
      "x": 350,
      "y": 30,
      "text": "Company Name\nThe One-Line Insight That Captures the Essence",
      "fontSize": 22,
      "strokeColor": "#1e1e1e",
      "textAlign": "center"
    },
    {
      "id": "key_insight",
      "type": "rectangle",
      "x": 300,
      "y": 100,
      "width": 320,
      "height": 90,
      "backgroundColor": "#ffc9c9",
      "strokeColor": "#e03131",
      "label": { "text": "The Key Answer\n$XX.XB (+XX% because...)", "fontSize": 16 }
    },
    {
      "id": "context_box",
      "type": "rectangle",
      "x": 100,
      "y": 260,
      "width": 280,
      "height": 80,
      "backgroundColor": "#e9ecef",
      "strokeColor": "#495057",
      "label": { "text": "Why This Matters\nThe insight or context", "fontSize": 14 }
    },
    {
      "id": "arrow_1",
      "type": "arrow",
      "start": { "id": "key_insight" },
      "end": { "id": "context_box" },
      "strokeColor": "#495057",
      "strokeWidth": 2,
      "endArrowhead": "triangle"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" }
}

## FINAL REMINDER

Your goal is to TEACH and EXPLAIN, not just display data. 
Ask yourself: "After seeing this diagram, will someone understand something they didn't before?"
If the answer is no, add more context, insight, or explanation.`

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
    
    try {
      // Try direct parse first
      diagramJson = JSON.parse(responseText)
    } catch (e) {
      // Try to extract JSON from markdown
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || responseText.match(/(\{[\s\S]*\})/)
      if (jsonMatch) {
        diagramJson = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Could not parse diagram JSON')
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

// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

// Use the latest Gemini model for diagram generation
const GEMINI_MODEL = 'gemini-2.5-pro-preview-05-06'

type OutputType = 'report' | 'slides' | 'diagram' | 'table'

// ============ FLEXIBLE DIAGRAM TYPES ============
interface ThoughtProcess {
  user_intent: string
  data_analysis: string
  visualization_strategy: string
  reasoning: string
}

interface CanvasConfig {
  title: string
  subtitle?: string
}

interface BaseElement {
  id: string
  label: string
  tooltip?: string
}

interface BarElement extends BaseElement {
  type: 'bar'
  value: number
  displayValue?: string
  color?: string
  category?: string
  group?: string
  order?: number
}

interface BoxElement extends BaseElement {
  type: 'box'
  value?: number
  displayValue?: string
  percentage?: number
  color?: string
  category?: string
  parentId?: string
  metrics?: Record<string, string | number>
}

interface FlowElement extends BaseElement {
  type: 'flow'
  value?: number
  displayValue?: string
  color?: string
  column?: number
}

interface MetricElement extends BaseElement {
  type: 'metric'
  value: string | number
  displayValue?: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}

interface TextElement extends BaseElement {
  type: 'text'
  content: string
  size?: 'small' | 'medium' | 'large'
  color?: string
}

type DiagramElement = BarElement | BoxElement | FlowElement | MetricElement | TextElement

interface Connection {
  from: string
  to: string
  value?: number
  displayValue?: string
  label?: string
  color?: string
}

interface LayoutHints {
  arrangement?: 'horizontal' | 'vertical' | 'grid' | 'radial' | 'tree' | 'flow' | 'waterfall'
  spacing?: 'compact' | 'normal' | 'spacious'
  groupBy?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface LegendItem {
  label: string
  color: string
}

interface Legend {
  show?: boolean
  items?: LegendItem[]
}

interface DiagramSpec {
  thought_process: ThoughtProcess
  canvas: CanvasConfig
  elements: DiagramElement[]
  connections?: Connection[]
  layout?: LayoutHints
  legend?: Legend
}

interface GenerateRequest {
  chat_id: string
  output_type: OutputType
  prompt?: string
}

interface StudioOutput {
  output_id: string
  chat_id: string
  user_id: string
  output_type: OutputType
  title: string
  status: 'generating' | 'ready' | 'error'
  content?: string
  diagram_data?: DiagramSpec
  error_message?: string
  prompt?: string
  created_at: string
  updated_at: string
}

// Get chat context (messages and sources)
async function getChatContext(supabase: ReturnType<typeof createClient>, chatId: string, userId: string): Promise<{
  messages: Array<{ role: string; content: string }>;
  sources: Array<{ name: string; content: string }>;
  chatInfo: { display_name: string; asset_type: string } | null;
}> {
  const { data: chat } = await supabase
    .from('company_chats')
    .select('display_name, asset_type, symbol')
    .eq('chat_id', chatId)
    .single()

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('sequence_num', { ascending: true })
    .limit(50)

  const { data: sources } = await supabase
    .from('chat_sources')
    .select('name, extracted_text')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .eq('status', 'ready')

  return {
    messages: messages?.map(m => ({ role: m.role, content: m.content || '' })) || [],
    sources: sources?.map(s => ({ name: s.name, content: s.extracted_text || '' })) || [],
    chatInfo: chat ? { display_name: chat.display_name, asset_type: chat.asset_type } : null,
  }
}

// Flexible JSON Schema - Gemini decides the structure
const diagramJsonSchema = {
  type: "object",
  properties: {
    thought_process: {
      type: "object",
      description: "Your reasoning process before creating the visualization",
      properties: {
        user_intent: { type: "string", description: "What is the user trying to understand or analyze?" },
        data_analysis: { type: "string", description: "What data is available and what are the key numbers/relationships?" },
        visualization_strategy: { type: "string", description: "What visual approach will best communicate this information?" },
        reasoning: { type: "string", description: "Why did you choose this specific combination of elements?" }
      },
      required: ["user_intent", "data_analysis", "visualization_strategy", "reasoning"]
    },
    canvas: {
      type: "object",
      properties: {
        title: { type: "string", description: "Clear, descriptive title" },
        subtitle: { type: "string", description: "Additional context or explanation" }
      },
      required: ["title"]
    },
    elements: {
      type: "array",
      description: "The visual elements that make up the diagram",
      items: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["bar", "box", "flow", "metric", "text"],
            description: "Element type: bar (for charts), box (for treemaps/cards), flow (for sankeys), metric (for KPIs), text (for annotations)"
          },
          id: { type: "string", description: "Unique identifier" },
          label: { type: "string", description: "Display label" },
          value: { type: "number", description: "Numeric value" },
          displayValue: { type: "string", description: "Formatted value like '$394B' or '25.5%'" },
          color: { type: "string", description: "Color hex code or name (e.g., '#4dabf7', 'blue', 'green')" },
          category: { type: "string", description: "Category for grouping/coloring (e.g., 'positive', 'negative', 'revenue', 'cost')" },
          group: { type: "string", description: "Group name for grouped charts" },
          order: { type: "number", description: "Explicit ordering (lower = first)" },
          parentId: { type: "string", description: "Parent element ID for hierarchies" },
          percentage: { type: "number", description: "Percentage value (0-100)" },
          column: { type: "number", description: "Column index for flow diagrams (0, 1, 2...)" },
          change: { type: "string", description: "Change indicator for metrics (e.g., '+12.5%')" },
          trend: { type: "string", enum: ["up", "down", "neutral"], description: "Trend direction" },
          content: { type: "string", description: "Text content for text elements" },
          tooltip: { type: "string", description: "Hover tooltip text" },
          metrics: { 
            type: "object", 
            description: "Key-value pairs for displaying multiple metrics on a box element",
            additionalProperties: { type: ["string", "number"] }
          }
        },
        required: ["type", "id", "label"]
      }
    },
    connections: {
      type: "array",
      description: "Lines/arrows connecting elements (for flows, hierarchies)",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source element ID" },
          to: { type: "string", description: "Target element ID" },
          value: { type: "number", description: "Flow value (determines line thickness)" },
          displayValue: { type: "string", description: "Formatted value" },
          label: { type: "string", description: "Connection label" },
          color: { type: "string", description: "Line color" }
        },
        required: ["from", "to"]
      }
    },
    layout: {
      type: "object",
      description: "Hints for how to arrange the elements",
      properties: {
        arrangement: { 
          type: "string", 
          enum: ["horizontal", "vertical", "grid", "radial", "tree", "flow", "waterfall"],
          description: "How to arrange elements spatially"
        },
        spacing: { type: "string", enum: ["compact", "normal", "spacious"] },
        groupBy: { type: "string", description: "Field to group elements by" },
        sortBy: { type: "string", description: "Field to sort elements by" },
        sortOrder: { type: "string", enum: ["asc", "desc"] }
      }
    },
    legend: {
      type: "object",
      properties: {
        show: { type: "boolean" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              color: { type: "string" }
            }
          }
        }
      }
    }
  },
  required: ["thought_process", "canvas", "elements"]
}

// Generate content with Gemini
async function generateWithGemini(prompt: string, systemPrompt: string, useJsonMode = false, jsonSchema?: object): Promise<string> {
  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  }

  if (useJsonMode && jsonSchema) {
    requestBody.generationConfig = {
      ...requestBody.generationConfig as object,
      responseMimeType: "application/json",
      responseSchema: jsonSchema
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error('[studio-api] Gemini API error:', error)
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Generate report
async function generateReport(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are a professional financial analyst creating investment research reports.
Write in a clear, professional style with proper markdown formatting.
Include relevant data points, analysis, and conclusions.
Structure the report with clear sections and headers.`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}
Asset Type: ${chatInfo?.asset_type || 'Unknown'}

## Key Discussion Points
${messages.filter(m => m.role === 'assistant').slice(-5).map(m => m.content.substring(0, 1000)).join('\n\n')}

## Source Highlights
${sources.slice(0, 3).map(s => `${s.name}: ${s.content.substring(0, 2000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create a research report with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Create a comprehensive investment research report:\n\n${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  return {
    title: `Research Report: ${chatInfo?.display_name || 'Analysis'}`,
    content,
  }
}

// Generate slides
async function generateSlides(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are creating presentation slides for an investment pitch.
Format each slide as a markdown section with ## for the slide title.
Keep content concise and impactful - bullet points preferred.
Include a title slide, key points, data highlights, and conclusion.`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}
Asset Type: ${chatInfo?.asset_type || 'Unknown'}

## Key Discussion Points
${messages.filter(m => m.role === 'assistant').slice(-5).map(m => m.content.substring(0, 1000)).join('\n\n')}

## Source Highlights
${sources.slice(0, 3).map(s => `${s.name}: ${s.content.substring(0, 2000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create a presentation deck with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Create a professional investment presentation deck:\n\n${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  return {
    title: `Presentation: ${chatInfo?.display_name || 'Analysis'}`,
    content,
  }
}

// Generate FLEXIBLE diagram - Gemini decides everything
async function generateDiagram(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string; diagramData?: DiagramSpec }> {
  const { messages, sources, chatInfo } = context
  const assetName = chatInfo?.display_name || 'Unknown Asset'
  
  const systemPrompt = `You are an expert Data Visualization Designer. Your job is to create the most insightful visual representation of financial data.

═══════════════════════════════════════════════════════════════════════════════
🎯 YOUR MISSION
═══════════════════════════════════════════════════════════════════════════════

Create a diagram about: **${assetName}**

You have COMPLETE FREEDOM to design the visualization. Choose the elements, colors, layout, and structure that best tells the story.

═══════════════════════════════════════════════════════════════════════════════
📊 AVAILABLE ELEMENT TYPES
═══════════════════════════════════════════════════════════════════════════════

You can use ANY combination of these elements:

1. **bar** - Rectangular bars for comparing values
   - Great for: Revenue comparisons, time series, rankings, waterfalls
   - Key fields: value, displayValue, color, category, group, order

2. **box** - Rectangular boxes/cards for hierarchies or compositions
   - Great for: Treemaps, org charts, category breakdowns, card layouts
   - Key fields: value, percentage, parentId, metrics, color

3. **flow** - Nodes in a flow diagram
   - Great for: Sankey diagrams, process flows, money flows
   - Key fields: value, column (0=left, 1=middle, 2=right, etc.)

4. **metric** - KPI cards showing key numbers
   - Great for: Dashboard metrics, key stats, summary numbers
   - Key fields: value, displayValue, change, trend

5. **text** - Annotations and labels
   - Great for: Callouts, explanations, section headers
   - Key fields: content, size

═══════════════════════════════════════════════════════════════════════════════
🎨 LAYOUT ARRANGEMENTS
═══════════════════════════════════════════════════════════════════════════════

Tell the frontend how to arrange your elements:

- **horizontal**: Elements side by side (bar charts, comparisons)
- **vertical**: Elements stacked (lists, timelines)
- **grid**: Elements in a grid (treemaps, dashboards)
- **tree**: Hierarchical tree structure (org charts)
- **flow**: Left-to-right flow (sankey, process)
- **waterfall**: Sequential bars with running total (income statements)

═══════════════════════════════════════════════════════════════════════════════
🎨 COLOR GUIDELINES
═══════════════════════════════════════════════════════════════════════════════

Use semantic colors:
- **Positive/Revenue/Growth**: #51cf66 (green), #4dabf7 (blue)
- **Negative/Cost/Decline**: #ff6b6b (red), #ffa94d (orange)
- **Neutral**: #868e96 (gray), #748ffc (indigo)

Or use category names and let the frontend pick:
- category: "positive" / "negative" / "neutral"
- category: "revenue" / "cost" / "profit"

═══════════════════════════════════════════════════════════════════════════════
📝 EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

EXAMPLE 1: Income Statement Waterfall
{
  "thought_process": {
    "user_intent": "Understand how revenue becomes profit",
    "data_analysis": "Have revenue, costs, and profit figures",
    "visualization_strategy": "Waterfall chart showing sequential deductions",
    "reasoning": "Waterfall clearly shows the path from revenue to net income"
  },
  "canvas": { "title": "Apple Income Statement", "subtitle": "FY2024 ($B)" },
  "elements": [
    { "type": "bar", "id": "rev", "label": "Revenue", "value": 394, "displayValue": "$394B", "category": "neutral", "order": 1 },
    { "type": "bar", "id": "cogs", "label": "Cost of Sales", "value": -224, "displayValue": "-$224B", "category": "negative", "order": 2 },
    { "type": "bar", "id": "gross", "label": "Gross Profit", "value": 170, "displayValue": "$170B", "category": "positive", "order": 3 },
    { "type": "bar", "id": "opex", "label": "Operating Exp", "value": -55, "displayValue": "-$55B", "category": "negative", "order": 4 },
    { "type": "bar", "id": "net", "label": "Net Income", "value": 97, "displayValue": "$97B", "category": "positive", "order": 5 }
  ],
  "layout": { "arrangement": "waterfall" },
  "legend": { "show": true, "items": [{ "label": "Positive", "color": "#51cf66" }, { "label": "Negative", "color": "#ff6b6b" }] }
}

EXAMPLE 2: Revenue Breakdown Treemap
{
  "thought_process": {
    "user_intent": "See how the company makes money",
    "data_analysis": "Revenue split across product segments",
    "visualization_strategy": "Treemap showing proportional sizes",
    "reasoning": "Treemap instantly shows relative importance of each segment"
  },
  "canvas": { "title": "Apple Revenue Breakdown", "subtitle": "FY2024 by Segment" },
  "elements": [
    { "type": "box", "id": "iphone", "label": "iPhone", "value": 205, "displayValue": "$205B", "percentage": 52, "color": "#4dabf7" },
    { "type": "box", "id": "services", "label": "Services", "value": 85, "displayValue": "$85B", "percentage": 22, "color": "#51cf66" },
    { "type": "box", "id": "mac", "label": "Mac", "value": 40, "displayValue": "$40B", "percentage": 10, "color": "#748ffc" },
    { "type": "box", "id": "ipad", "label": "iPad", "value": 30, "displayValue": "$30B", "percentage": 8, "color": "#ffa94d" },
    { "type": "box", "id": "wearables", "label": "Wearables", "value": 34, "displayValue": "$34B", "percentage": 8, "color": "#f06595" }
  ],
  "layout": { "arrangement": "grid" }
}

EXAMPLE 3: Peer Comparison
{
  "thought_process": {
    "user_intent": "Compare company to competitors",
    "data_analysis": "Have P/E, growth, and margin data for multiple companies",
    "visualization_strategy": "Grouped bar chart for side-by-side comparison",
    "reasoning": "Grouped bars allow easy comparison across multiple metrics"
  },
  "canvas": { "title": "Tech Giants Comparison", "subtitle": "Key Valuation Metrics" },
  "elements": [
    { "type": "box", "id": "aapl", "label": "Apple", "metrics": { "P/E": 28.5, "Growth": 8.2, "Margin": 25.3 }, "color": "#4dabf7" },
    { "type": "box", "id": "msft", "label": "Microsoft", "metrics": { "P/E": 32.1, "Growth": 12.5, "Margin": 35.2 }, "color": "#51cf66" },
    { "type": "box", "id": "googl", "label": "Google", "metrics": { "P/E": 22.3, "Growth": 15.1, "Margin": 28.7 }, "color": "#ffa94d" }
  ],
  "layout": { "arrangement": "horizontal", "groupBy": "metrics" }
}

EXAMPLE 4: Key Metrics Dashboard
{
  "thought_process": {
    "user_intent": "Quick overview of key numbers",
    "data_analysis": "Have several important KPIs",
    "visualization_strategy": "Metric cards for at-a-glance view",
    "reasoning": "Metric cards highlight the most important numbers clearly"
  },
  "canvas": { "title": "Apple Key Metrics", "subtitle": "Q4 2024" },
  "elements": [
    { "type": "metric", "id": "rev", "label": "Revenue", "value": 94.9, "displayValue": "$94.9B", "change": "+6.1%", "trend": "up" },
    { "type": "metric", "id": "eps", "label": "EPS", "value": 1.64, "displayValue": "$1.64", "change": "+12.3%", "trend": "up" },
    { "type": "metric", "id": "margin", "label": "Gross Margin", "value": 46.2, "displayValue": "46.2%", "change": "+1.2%", "trend": "up" },
    { "type": "metric", "id": "pe", "label": "P/E Ratio", "value": 28.5, "displayValue": "28.5x", "change": "-2.1x", "trend": "down" }
  ],
  "layout": { "arrangement": "grid" }
}

═══════════════════════════════════════════════════════════════════════════════
⚠️ IMPORTANT RULES
═══════════════════════════════════════════════════════════════════════════════

1. ALWAYS include thought_process - explain your reasoning
2. ALWAYS use realistic financial data (research or estimate)
3. ALWAYS include displayValue with proper formatting ($, %, x)
4. ALWAYS give each element a unique id
5. Focus on ${assetName} - this is the target company
6. Be creative! Combine element types if it tells a better story
7. If data is missing, make educated estimates and note in subtitle`

  const userRequest = customPrompt || "Create a visual summary of this company's financials"
  
  // Extract recent analysis for data
  const recentAnalysis = messages
    .filter(m => m.role === 'assistant')
    .slice(-5)
    .map(m => m.content.substring(0, 2000))
    .join('\n\n')

  const userPrompt = `
═══════════════════════════════════════════════════════════════════════════════
🎯 TARGET: ${assetName}
═══════════════════════════════════════════════════════════════════════════════

USER REQUEST: "${userRequest}"

═══════════════════════════════════════════════════════════════════════════════
📊 AVAILABLE DATA
═══════════════════════════════════════════════════════════════════════════════

${recentAnalysis || 'No recent analysis available - use your knowledge of this company'}

═══════════════════════════════════════════════════════════════════════════════
📄 SOURCE DOCUMENTS
═══════════════════════════════════════════════════════════════════════════════

${sources.slice(0, 2).map(s => `${s.name}:\n${s.content.substring(0, 3000)}`).join('\n\n') || 'No source documents available'}

═══════════════════════════════════════════════════════════════════════════════
🎨 NOW CREATE YOUR VISUALIZATION
═══════════════════════════════════════════════════════════════════════════════

Think step by step:
1. What is the user trying to understand?
2. What data do I have or can I estimate?
3. What visual approach will communicate this best?
4. What elements should I use?

Then output your diagram JSON.`

  // Use JSON mode for reliable parsing
  const content = await generateWithGemini(userPrompt, systemPrompt, true, diagramJsonSchema)
  
  // Parse the JSON response
  let parsedData: DiagramSpec | undefined
  
  try {
    parsedData = JSON.parse(content) as DiagramSpec
    
    // Log the thought process for debugging
    if (parsedData.thought_process) {
      console.log('[studio-api] AI Thought Process:', JSON.stringify(parsedData.thought_process, null, 2))
    }
    
    // Ensure elements array exists
    if (!parsedData.elements) {
      parsedData.elements = []
    }

    // Ensure connections array exists
    if (!parsedData.connections) {
      parsedData.connections = []
    }

    // Validate element IDs are unique
    const elementIds = new Set<string>()
    parsedData.elements = parsedData.elements.map((el, i) => {
      if (!el.id || elementIds.has(el.id)) {
        el.id = `element_${i}`
      }
      elementIds.add(el.id)
      return el
    })

  } catch (e) {
    console.error('[studio-api] Failed to parse diagram JSON:', e)
    console.error('[studio-api] Raw content:', content)
  }

  return {
    title: parsedData?.canvas?.title || `Diagram: ${assetName}`,
    content: parsedData ? JSON.stringify(parsedData, null, 2) : content,
    diagramData: parsedData,
  }
}

// Generate table
async function generateTable(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are creating a data table for financial analysis.
Format the output as a markdown table with clear headers.
Include relevant metrics, comparisons, or data points.
Add a brief summary below the table.`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}
Asset Type: ${chatInfo?.asset_type || 'Unknown'}

## Key Discussion Points
${messages.filter(m => m.role === 'assistant').slice(-5).map(m => m.content.substring(0, 1000)).join('\n\n')}

## Source Highlights
${sources.slice(0, 3).map(s => `${s.name}: ${s.content.substring(0, 2000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create a data table with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Create a comprehensive financial data table:\n\n${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  return {
    title: `Data Table: ${chatInfo?.display_name || 'Analysis'}`,
    content,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const userId = req.headers.get('x-user-id')
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    
    // POST /studio-api/generate - Generate new output
    if (req.method === 'POST' && pathParts[pathParts.length - 1] === 'generate') {
      const body: GenerateRequest = await req.json()
      const { chat_id, output_type, prompt } = body

      if (!chat_id || !output_type) {
        return new Response(
          JSON.stringify({ error: 'chat_id and output_type required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create initial output record
      const { data: output, error: insertError } = await supabase
        .from('studio_outputs')
        .insert({
          chat_id,
          user_id: userId,
          output_type,
          title: `Generating ${output_type}...`,
          status: 'generating',
          prompt,
        })
        .select()
        .single()

      if (insertError) {
        console.error('[studio-api] Insert error:', insertError)
        throw insertError
      }

      // Generate content asynchronously
      (async () => {
        try {
          const context = await getChatContext(supabase, chat_id, userId)
          
          let result: { title: string; content: string; diagramData?: DiagramSpec }
          
          switch (output_type) {
            case 'report':
              result = await generateReport(context, prompt)
              break
            case 'slides':
              result = await generateSlides(context, prompt)
              break
            case 'diagram':
              result = await generateDiagram(context, prompt)
              break
            case 'table':
              result = await generateTable(context, prompt)
              break
            default:
              throw new Error(`Unknown output type: ${output_type}`)
          }

          // Update with generated content
          await supabase
            .from('studio_outputs')
            .update({
              title: result.title,
              content: result.content,
              diagram_data: result.diagramData || null,
              status: 'ready',
              updated_at: new Date().toISOString(),
            })
            .eq('output_id', output.output_id)

        } catch (error) {
          console.error('[studio-api] Generation error:', error)
          await supabase
            .from('studio_outputs')
            .update({
              status: 'error',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              updated_at: new Date().toISOString(),
            })
            .eq('output_id', output.output_id)
        }
      })()

      return new Response(
        JSON.stringify(output),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /studio-api/outputs/:chat_id - List outputs for a chat
    if (req.method === 'GET' && pathParts.length >= 2) {
      const chatId = pathParts[pathParts.length - 1]
      
      if (pathParts[pathParts.length - 2] === 'outputs') {
        const { data: outputs, error } = await supabase
          .from('studio_outputs')
          .select('*')
          .eq('chat_id', chatId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify(outputs || []),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // GET /studio-api/:output_id - Get single output
      const outputId = chatId
      const { data: output, error } = await supabase
        .from('studio_outputs')
        .select('*')
        .eq('output_id', outputId)
        .eq('user_id', userId)
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(output),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /studio-api/:output_id - Delete output
    if (req.method === 'DELETE' && pathParts.length >= 1) {
      const outputId = pathParts[pathParts.length - 1]
      
      const { error } = await supabase
        .from('studio_outputs')
        .delete()
        .eq('output_id', outputId)
        .eq('user_id', userId)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[studio-api] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

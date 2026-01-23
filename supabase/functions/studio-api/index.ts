
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

// Use the latest Gemini model
const GEMINI_MODEL = 'gemini-3-pro-preview'

type OutputType = 'report' | 'slides' | 'diagram' | 'table'
type LayoutType = 'treemap' | 'hierarchy' | 'waterfall' | 'sankey' | 'comparison' | 'timeline'

interface ThoughtProcess {
  user_intent: string
  data_shape: string
  selected_layout: LayoutType
  reasoning: string
}

interface DiagramNode {
  id: string
  label: string
  value?: number
  valueLabel?: string
  percentage?: number
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral' | 'positive' | 'negative'
  parentId?: string // For hierarchy layouts
  children?: string[] // For hierarchy layouts
  date?: string // For timeline layouts
  details?: string
}

interface DiagramConnection {
  from: string
  to: string
  label?: string
  value?: number
}

interface DiagramMetric {
  label: string
  value: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
}

interface DiagramData {
  thought_process?: ThoughtProcess
  layoutType: LayoutType
  title: string
  subtitle?: string
  totalValue?: number
  totalLabel?: string
  nodes: DiagramNode[]
  connections: DiagramConnection[]
  metrics?: DiagramMetric[]
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
  diagram_data?: DiagramData
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
  // Get chat info
  const { data: chat } = await supabase
    .from('company_chats')
    .select('display_name, asset_type, symbol')
    .eq('chat_id', chatId)
    .single()

  // Get messages
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('sequence_num', { ascending: true })
    .limit(50)

  // Get enabled sources
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

// JSON Schema for diagram data with thought_process - used with Gemini's JSON mode
const diagramJsonSchema = {
  type: "object",
  properties: {
    thought_process: {
      type: "object",
      description: "Chain-of-thought reasoning before generating the diagram",
      properties: {
        user_intent: { type: "string", description: "What is the core question the user is trying to answer?" },
        data_shape: { type: "string", description: "What does the available data look like? (Time-series, Composition, Relational flow, etc.)" },
        selected_layout: { 
          type: "string", 
          enum: ["treemap", "hierarchy", "waterfall", "sankey", "comparison", "timeline"],
          description: "Which layout best matches this data shape?"
        },
        reasoning: { type: "string", description: "Brief explanation of why this layout was chosen" }
      },
      required: ["user_intent", "data_shape", "selected_layout", "reasoning"]
    },
    layoutType: { 
      type: "string", 
      enum: ["treemap", "hierarchy", "waterfall", "sankey", "comparison", "timeline"],
      description: "The visualization layout type (must match thought_process.selected_layout)"
    },
    title: { type: "string", description: "Clear, descriptive title for the diagram" },
    subtitle: { type: "string", description: "Brief explanation of what this diagram shows" },
    totalValue: { type: "number", description: "Total value for the entire diagram (optional)" },
    totalLabel: { type: "string", description: "Formatted total value label (e.g., '$394B')" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Unique identifier for the node" },
          label: { type: "string", description: "Display label for the node" },
          value: { type: "number", description: "Numeric value for the node" },
          valueLabel: { type: "string", description: "Formatted value label (e.g., '$205B')" },
          percentage: { type: "number", description: "Percentage of total (0-100)" },
          category: { 
            type: "string", 
            enum: ["revenue", "cost", "asset", "metric", "risk", "neutral", "positive", "negative"],
            description: "Category for color coding"
          },
          parentId: { type: "string", description: "Parent node ID for hierarchy layouts" },
          date: { type: "string", description: "Date string for timeline layouts (e.g., 'Q1 2024', '2023')" },
          details: { type: "string", description: "Additional details for tooltip" }
        },
        required: ["id", "label"]
      }
    },
    connections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "Source node ID" },
          to: { type: "string", description: "Target node ID" },
          label: { type: "string", description: "Connection label" },
          value: { type: "number", description: "Flow value for Sankey diagrams" }
        },
        required: ["from", "to"]
      }
    },
    metrics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Metric label" },
          value: { type: "string", description: "Formatted metric value" },
          change: { type: "string", description: "Change indicator (e.g., '+8%')" },
          trend: { type: "string", enum: ["up", "down", "neutral"] }
        },
        required: ["label", "value"]
      }
    }
  },
  required: ["thought_process", "layoutType", "title", "nodes", "connections"]
}

// Generate content using Gemini with optional JSON mode
async function generateWithGemini(
  prompt: string, 
  systemPrompt: string, 
  useJsonMode: boolean = false,
  jsonSchema?: object
): Promise<string> {
  const generationConfig: Record<string, unknown> = {
    temperature: useJsonMode ? 0.3 : 0.7, // Slightly higher temp for better reasoning
    maxOutputTokens: 8000,
  }

  // Enable JSON mode with schema if specified
  if (useJsonMode) {
    generationConfig.responseMimeType = "application/json"
    if (jsonSchema) {
      generationConfig.responseSchema = jsonSchema
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[studio-api] Gemini API error:', response.status, errorText)
    throw new Error(`Gemini API error: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Generate investment report
async function generateReport(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are a senior investment analyst creating a comprehensive investment report.
Write in a professional, analytical style with clear sections and supporting data.
Include: Executive Summary, Investment Thesis, Key Metrics, Risk Analysis, and Recommendation.
Use markdown formatting with headers, bullet points, and tables where appropriate.
Be specific with numbers and cite sources when available.`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}
Asset Type: ${chatInfo?.asset_type || 'Unknown'}

## Chat Discussion Summary
${messages.filter(m => m.role === 'assistant').slice(-5).map(m => m.content.substring(0, 1500)).join('\n\n')}

## Source Documents
${sources.slice(0, 3).map(s => `### ${s.name}\n${s.content.substring(0, 3000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create an investment report with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Create a comprehensive investment report:\n\n${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  return {
    title: `Investment Report: ${chatInfo?.display_name || 'Analysis'}`,
    content,
  }
}

// Generate slides content
async function generateSlides(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are creating a presentation deck for investors.
Generate slide content in a structured format that can be converted to a presentation.
Each slide should have a clear title and 3-5 bullet points.
Use this format:

# Slide 1: Title Slide
- Main title
- Subtitle/Date

# Slide 2: Executive Summary
- Key point 1
- Key point 2
- Key point 3

Continue with relevant slides covering: Investment Thesis, Key Metrics, Risks, and Recommendation.
Keep each slide focused and concise.`

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

// Generate SMART diagram with Chain-of-Thought reasoning and semantic routing
async function generateDiagram(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string; diagramData?: DiagramData }> {
  const { messages, sources, chatInfo } = context
  
  // Information Architect Agent system prompt with semantic routing
  const systemPrompt = `You are an expert Data Information Architect. Your goal is to translate user queries and chat context into the most insightful visual diagram.

CRITICAL: You MUST output valid JSON with a "thought_process" key that shows your reasoning.

═══════════════════════════════════════════════════════════════════════════════
STEP 1: THINK BEFORE YOU ACT (Chain-of-Thought Reasoning)
═══════════════════════════════════════════════════════════════════════════════

Before generating any diagram, you MUST fill out the thought_process object:
1. user_intent: What is the core question the user is trying to answer?
2. data_shape: What does the available data look like? (Time-series? Composition? Relational flow? Arithmetic bridge? Comparative?)
3. selected_layout: Which layout best matches this data shape?
4. reasoning: Brief explanation of why this layout was chosen

═══════════════════════════════════════════════════════════════════════════════
STEP 2: LAYOUT DECISION MATRIX (Semantic Router)
═══════════════════════════════════════════════════════════════════════════════

Match the DATA SHAPE to the correct layout:

┌─────────────────────────────────────┬────────────────┬─────────────────────────────────────┐
│ DATA SHAPE                          │ LAYOUT         │ WHEN TO USE                         │
├─────────────────────────────────────┼────────────────┼─────────────────────────────────────┤
│ Parts of a Whole / Composition      │ treemap        │ Market share, revenue segments,     │
│                                     │                │ portfolio allocation, expense split │
├─────────────────────────────────────┼────────────────┼─────────────────────────────────────┤
│ Arithmetic Bridge / Change          │ waterfall      │ Profit walkdown, YoY earnings       │
│                                     │                │ bridge, value creation/destruction  │
├─────────────────────────────────────┼────────────────┼─────────────────────────────────────┤
│ Resource Flow / Conversion          │ sankey         │ Cash flow, ad spend to conversions, │
│                                     │                │ revenue to expenses allocation      │
├─────────────────────────────────────┼────────────────┼─────────────────────────────────────┤
│ Categorization / Taxonomy           │ hierarchy      │ Org chart, product lines, business  │
│                                     │                │ segments breakdown, decision tree   │
├─────────────────────────────────────┼────────────────┼─────────────────────────────────────┤
│ Comparative / Benchmarking          │ comparison     │ AAPL vs MSFT, peer analysis,        │
│                                     │                │ scenario comparison, metric compare │
├─────────────────────────────────────┼────────────────┼─────────────────────────────────────┤
│ Chronological / Time-based          │ timeline       │ Company history, quarterly results, │
│                                     │                │ roadmap, milestones, projections    │
└─────────────────────────────────────┴────────────────┴─────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
STEP 3: HANDLING VAGUE OR MISSING REQUESTS
═══════════════════════════════════════════════════════════════════════════════

⚠️ CRITICAL: ALWAYS focus on the TARGET ASSET specified in the request, NOT other companies mentioned in chat history.

If the user's request is vague, use these defaults FOR THE TARGET ASSET:

• "financials" / "financial overview" / "income statement" / no specific request
  → Default to WATERFALL showing the TARGET ASSET's: Revenue → Gross Profit → Operating Income → Net Income
  → DO NOT show competitor comparisons unless explicitly requested
  
• "what does this company do" / "business model" / "how they make money" / "revenue breakdown"
  → Default to TREEMAP of the TARGET ASSET's Revenue Segments by percentage
  
• "compare" / "vs" / "versus" / explicitly mentions multiple companies by name
  → ONLY use COMPARISON if the user EXPLICITLY asks to compare companies
  → The word "compare" or "vs" MUST be in the user's request
  
• "history" / "over time" / "trend" / "quarters" / "years"
  → Default to TIMELINE with the TARGET ASSET's chronological data points
  
• "structure" / "organization" / "breakdown" / "categories"
  → Default to HIERARCHY showing the TARGET ASSET's organizational/categorical relationships
  
• "flow" / "where does the money go" / "allocation"
  → Default to SANKEY showing the TARGET ASSET's money/resource flows

⚠️ IMPORTANT: Chat history may contain discussions about OTHER companies (competitors, peers).
   IGNORE other companies unless the user EXPLICITLY asks to compare them.
   The diagram should be about the TARGET ASSET unless comparison is explicitly requested.

If the context lacks specific numbers for the TARGET ASSET, make educated estimates based on:
- Industry standards and typical ratios for that company
- Public company benchmarks
- Reasonable assumptions
Flag estimated data in the subtitle: "Based on industry estimates"

═══════════════════════════════════════════════════════════════════════════════
FEW-SHOT EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

EXAMPLE 1:
User: "How are they making money?"
thought_process: {
  user_intent: "Understand revenue generation and business model",
  data_shape: "Parts of a Whole / Composition",
  selected_layout: "treemap",
  reasoning: "User wants to see revenue breakdown by segment. Treemap shows proportional composition best."
}
Result: Treemap showing Revenue split by Product/Service segments with percentages.

EXAMPLE 2:
User: "Why did the stock crash?"
thought_process: {
  user_intent: "Understand what caused value destruction",
  data_shape: "Arithmetic Bridge / Change",
  selected_layout: "waterfall",
  reasoning: "User wants to see sequential factors that led to decline. Waterfall shows additive/subtractive changes."
}
Result: Waterfall showing Start Price → Missed Earnings (-15%) → Sector Downturn (-8%) → End Price.

EXAMPLE 3:
User: "Compare to competitors"
thought_process: {
  user_intent: "Benchmark against peers",
  data_shape: "Comparative / Benchmarking",
  selected_layout: "comparison",
  reasoning: "User wants side-by-side comparison. Comparison chart allows multi-entity metric comparison."
}
Result: Grouped bar chart comparing P/E, Yield, and Revenue Growth for target and 3 peers.

EXAMPLE 4:
User: "Show me the financials"
thought_process: {
  user_intent: "Get a financial overview of the company",
  data_shape: "Arithmetic Bridge / Change",
  selected_layout: "waterfall",
  reasoning: "Generic financial request. Waterfall income statement walk is the most informative default."
}
Result: Waterfall from Revenue → COGS → Gross Profit → OpEx → Operating Income → Net Income.

EXAMPLE 5:
User: (clicks generate with no prompt)
thought_process: {
  user_intent: "Get a visual summary of the asset",
  data_shape: "Parts of a Whole / Composition",
  selected_layout: "treemap",
  reasoning: "No specific request. Treemap of revenue segments provides best high-level overview."
}
Result: Treemap showing business segment breakdown with percentages and values.

═══════════════════════════════════════════════════════════════════════════════
LAYOUT-SPECIFIC REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

TREEMAP:
- Nodes sized PROPORTIONALLY to their percentage values
- Percentages MUST add up to 100%
- Include valueLabel (e.g., "$205B") and percentage for each node
- Use category for color coding (revenue, asset, metric, etc.)

WATERFALL:
- First node = starting value (category: "neutral")
- Middle nodes = changes (category: "positive" for gains, "negative" for losses)
- Last node = ending value (category: "neutral")
- Values should be the CHANGE amount, not cumulative
- Order nodes sequentially from start to end

HIERARCHY:
- Use parentId to establish parent-child relationships
- Root node has no parentId
- Children reference their parent's id
- Connections are auto-generated from parentId

SANKEY:
- MUST include connections array with values
- Connections show flow from source to destination
- Connection values determine flow width
- Nodes on left are sources, nodes on right are destinations

COMPARISON:
- Each node represents one entity being compared
- Include metrics in node.metrics object for grouped bars
- Or use node.value for single metric comparison

TIMELINE:
- MUST include date field for each node (e.g., "Q1 2024", "2023", "Jan 2024")
- Nodes arranged chronologically
- Include value for bar height
- Use category for positive/negative coloring

═══════════════════════════════════════════════════════════════════════════════
FINAL CHECKLIST
═══════════════════════════════════════════════════════════════════════════════

Before outputting, verify:
✓ thought_process is filled out completely
✓ layoutType matches thought_process.selected_layout
✓ All nodes have unique id and label
✓ Numeric values are realistic (use real data or educated estimates)
✓ Layout-specific requirements are met
✓ 2-4 metrics are included for context
✓ Title is clear and descriptive
✓ Subtitle explains what the diagram shows`

  // Build the user prompt with categorized context
  const userRequest = customPrompt || "Provide a high-level visual summary of this asset."
  
  // Extract recent user messages for intent analysis
  const recentUserMessages = messages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => `User: ${m.content}`)
    .join('\n')
  
  // Extract recent assistant analysis for data
  const recentAnalysis = messages
    .filter(m => m.role === 'assistant')
    .slice(-5)
    .map(m => m.content.substring(0, 2000))
    .join('\n\n')

  const userPrompt = `
═══════════════════════════════════════════════════════════════════════════════
🎯 TARGET ASSET (THIS IS THE COMPANY TO VISUALIZE)
═══════════════════════════════════════════════════════════════════════════════
Name: ${chatInfo?.display_name || 'Unknown Asset'}
Type: ${chatInfo?.asset_type || 'Unknown'}

⚠️ IMPORTANT: Create a diagram about ${chatInfo?.display_name || 'this asset'} ONLY.
   Do NOT create diagrams about other companies mentioned in chat history.
   The user is researching ${chatInfo?.display_name || 'this asset'}, not competitors.

═══════════════════════════════════════════════════════════════════════════════
USER REQUEST
═══════════════════════════════════════════════════════════════════════════════
"${userRequest}"

═══════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════
STEP 1: The diagram MUST be about ${chatInfo?.display_name || 'the target asset'}.
STEP 2: Analyze the user request. "financials" = waterfall income statement for ${chatInfo?.display_name || 'target'}.
STEP 3: Extract numbers for ${chatInfo?.display_name || 'target'} from context (ignore competitor data).
STEP 4: Fill out thought_process explaining your reasoning.
STEP 5: Generate the diagram JSON for ${chatInfo?.display_name || 'target'} ONLY.

=== FINANCIAL DATA FOR ${(chatInfo?.display_name || 'TARGET').toUpperCase()} ===
${recentAnalysis || 'No recent analysis available'}

=== SOURCE DOCUMENTS ===
${sources.slice(0, 2).map(s => `${s.name}:\n${s.content.substring(0, 3000)}`).join('\n\n') || 'No source documents available'}
`

  // Use JSON mode for reliable parsing
  const content = await generateWithGemini(userPrompt, systemPrompt, true, diagramJsonSchema)
  
  // Parse the JSON response
  let parsedData: DiagramData | undefined
  
  try {
    parsedData = JSON.parse(content) as DiagramData
    
    // Log the thought process for debugging
    if (parsedData.thought_process) {
      console.log('[studio-api] AI Thought Process:', JSON.stringify(parsedData.thought_process, null, 2))
    }
    
    // Validate and fix the data
    const validLayouts: LayoutType[] = ['treemap', 'hierarchy', 'waterfall', 'sankey', 'comparison', 'timeline']
    
    // Use thought_process.selected_layout if layoutType is missing or invalid
    if (!parsedData.layoutType || !validLayouts.includes(parsedData.layoutType)) {
      if (parsedData.thought_process?.selected_layout && validLayouts.includes(parsedData.thought_process.selected_layout)) {
        parsedData.layoutType = parsedData.thought_process.selected_layout
      } else {
        parsedData.layoutType = 'treemap' // Ultimate fallback
      }
    }

    // Ensure nodes array exists
    if (!parsedData.nodes) {
      parsedData.nodes = []
    }

    // Ensure connections array exists
    if (!parsedData.connections) {
      parsedData.connections = []
    }

    // Validate node IDs are unique
    const nodeIds = new Set<string>()
    parsedData.nodes = parsedData.nodes.map((node, i) => {
      if (!node.id || nodeIds.has(node.id)) {
        node.id = `node_${i}`
      }
      nodeIds.add(node.id)
      return node
    })

    // For waterfall charts, ensure proper ordering and categories
    if (parsedData.layoutType === 'waterfall' && parsedData.nodes.length > 0) {
      // Mark first and last as neutral if not already set
      if (!parsedData.nodes[0].category) {
        parsedData.nodes[0].category = 'neutral'
      }
      if (parsedData.nodes.length > 1 && !parsedData.nodes[parsedData.nodes.length - 1].category) {
        parsedData.nodes[parsedData.nodes.length - 1].category = 'neutral'
      }
    }

    // For hierarchy charts, build connections from parentId if not provided
    if (parsedData.layoutType === 'hierarchy' && parsedData.connections.length === 0) {
      parsedData.nodes.forEach(node => {
        if (node.parentId) {
          parsedData!.connections.push({
            from: node.parentId,
            to: node.id
          })
        }
      })
    }

  } catch (e) {
    console.error('[studio-api] Failed to parse diagram JSON:', e)
    console.error('[studio-api] Raw content:', content)
    
    // Fallback: try to extract JSON from the response
    try {
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7)
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3)
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3)
      }
      cleanContent = cleanContent.trim()
      
      parsedData = JSON.parse(cleanContent) as DiagramData
    } catch (e2) {
      console.error('[studio-api] Fallback parsing also failed:', e2)
    }
  }
  
  return {
    title: parsedData?.title || `Diagram: ${chatInfo?.display_name || 'Analysis'}`,
    content: parsedData?.subtitle || 'Visualization of key data',
    diagramData: parsedData,
  }
}

// Generate data table
async function generateTable(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are creating data tables to organize and present financial information.
Generate well-formatted Markdown tables with clear headers and organized data.
Include multiple tables if needed to cover different aspects of the analysis.
Add brief explanations before each table.
Use proper number formatting (e.g., $1.5B, 12.3%, 2.5x).`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}

## Key Data Points
${messages.filter(m => m.role === 'assistant').slice(-3).map(m => m.content.substring(0, 1000)).join('\n\n')}

## Source Data
${sources.slice(0, 2).map(s => `${s.name}: ${s.content.substring(0, 2000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create data tables with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Create organized data tables summarizing the key financial information:\n\n${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  return {
    title: `Data Tables: ${chatInfo?.display_name || 'Analysis'}`,
    content,
  }
}

// Save output to database
async function saveOutput(
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  userId: string,
  outputType: OutputType,
  title: string,
  content: string | undefined,
  diagramData: DiagramData | undefined,
  prompt: string | undefined
): Promise<StudioOutput> {
  const { data, error } = await supabase
    .from('studio_outputs')
    .insert({
      chat_id: chatId,
      user_id: userId,
      output_type: outputType,
      title,
      status: 'ready',
      content,
      diagram_data: diagramData,
      prompt,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to save output:', error)
    throw new Error(`Failed to save output: ${error.message}`)
  }

  return data as StudioOutput
}

// Get outputs for a chat
async function getOutputs(
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  userId: string
): Promise<StudioOutput[]> {
  const { data, error } = await supabase
    .from('studio_outputs')
    .select('*')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to get outputs:', error)
    throw new Error(`Failed to get outputs: ${error.message}`)
  }

  return data as StudioOutput[]
}

// Delete an output
async function deleteOutput(
  supabase: ReturnType<typeof createClient>,
  outputId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('studio_outputs')
    .delete()
    .eq('output_id', outputId)
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to delete output:', error)
    throw new Error(`Failed to delete output: ${error.message}`)
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    
    // Strip the function name prefix from path
    const functionIndex = pathParts.findIndex(p => p === 'studio-api')
    const relevantPath = functionIndex >= 0 ? pathParts.slice(functionIndex + 1) : pathParts
    
    // Get auth token
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Extract user ID from JWT token directly (more reliable than getUser)
    let userId: string | null = null
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        userId = payload.sub || null
      }
    } catch (e) {
      console.error('[studio-api] Failed to decode JWT:', e)
    }
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid authorization', details: 'Could not extract user ID from token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Create Supabase client with service role key for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Create a user object for compatibility with existing code
    const user = { id: userId }

    // GET /outputs/:chat_id - List outputs for a chat
    if (req.method === 'GET' && relevantPath[0] === 'outputs' && relevantPath[1]) {
      const chatId = relevantPath[1]
      const outputs = await getOutputs(supabase, chatId, user.id)
      
      // Transform to frontend format
      const formattedOutputs = outputs.map(o => ({
        id: o.output_id,
        type: o.output_type,
        title: o.title,
        status: o.status,
        content: o.content,
        diagramData: o.diagram_data,
        error: o.error_message,
        createdAt: o.created_at,
      }))
      
      return new Response(JSON.stringify({ outputs: formattedOutputs }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /outputs/:output_id - Delete an output
    if (req.method === 'DELETE' && relevantPath[0] === 'outputs' && relevantPath[1]) {
      const outputId = relevantPath[1]
      await deleteOutput(supabase, outputId, user.id)
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PATCH /outputs/:output_id - Update an output (rename)
    if (req.method === 'PATCH' && relevantPath[0] === 'outputs' && relevantPath[1]) {
      const outputId = relevantPath[1]
      const body = await req.json()
      const { title } = body
      
      if (!title) {
        return new Response(JSON.stringify({ error: 'Missing title' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Update the output title
      const { data, error } = await supabase
        .from('studio_outputs')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('output_id', outputId)
        .eq('user_id', user.id)
        .select()
        .single()
      
      if (error) {
        console.error('[studio-api] Error updating output:', error)
        return new Response(JSON.stringify({ error: 'Failed to update output' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        output: {
          id: data.output_id,
          title: data.title,
          type: data.output_type,
          status: data.status,
          content: data.content,
          diagramData: data.diagram_data,
          createdAt: data.created_at,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /generate - Generate new output
    if (req.method === 'POST' && (relevantPath.length === 0 || relevantPath[0] === 'generate')) {
      const body: GenerateRequest = await req.json()
      const { chat_id, output_type, prompt } = body

      if (!chat_id || !output_type) {
        return new Response(JSON.stringify({ error: 'Missing chat_id or output_type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get chat context
      const context = await getChatContext(supabase, chat_id, user.id)

      // Generate content based on type
      let result: { title: string; content: string; diagramData?: DiagramData }
      
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
          return new Response(JSON.stringify({ error: 'Invalid output_type' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
      }

      // Save to database
      const savedOutput = await saveOutput(
        supabase,
        chat_id,
        user.id,
        output_type,
        result.title,
        result.content,
        result.diagramData,
        prompt
      )

      return new Response(JSON.stringify({
        output_id: savedOutput.output_id,
        id: savedOutput.output_id,
        type: output_type,
        title: result.title,
        content: result.content,
        diagramData: result.diagramData,
        status: 'ready',
        created_at: savedOutput.created_at,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Studio API error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

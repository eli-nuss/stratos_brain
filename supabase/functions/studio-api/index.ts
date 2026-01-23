
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

type OutputType = 'report' | 'slides' | 'diagram' | 'table'
type LayoutType = 'treemap' | 'hierarchy' | 'waterfall' | 'sankey' | 'comparison' | 'timeline'

interface DiagramNode {
  id: string
  label: string
  value?: number
  valueLabel?: string
  percentage?: number
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral'
  parentId?: string // For hierarchy layouts
  children?: string[] // For hierarchy layouts
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

// Generate content using Gemini
async function generateWithGemini(prompt: string, systemPrompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8000,
        }
      })
    }
  )

  if (!response.ok) {
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

// Generate SMART diagram with intelligent layout selection
async function generateDiagram(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string; diagramData?: DiagramData }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are an expert data visualization designer creating intelligent, insightful diagrams.
Your job is to think carefully about what visualization best tells the story of the data.

CRITICAL: You must output ONLY a valid JSON object. No markdown, no explanation, no code blocks.

LAYOUT TYPES - Choose the one that best fits the data story:

1. "treemap" - For showing composition/breakdown where parts make up a whole
   - Use when: Revenue breakdown by segment, expense allocation, market share
   - Nodes are sized PROPORTIONALLY to their values
   - Example: Apple revenue by product (iPhone 52%, Services 22%, Mac 10%, etc.)

2. "hierarchy" - For showing parent-child relationships and organizational structure
   - Use when: Corporate structure, category breakdowns, decision trees
   - Has a root node at top with children flowing down
   - Example: Total Revenue → Product Revenue + Service Revenue → Individual products

3. "waterfall" - For showing how a starting value builds up or breaks down to an ending value
   - Use when: Bridge charts, profit walkdown, value creation analysis
   - Shows sequential additions/subtractions
   - Example: Revenue → Gross Profit → Operating Profit → Net Income

4. "sankey" - For showing flows between categories with proportional widths
   - Use when: Money flows, resource allocation, conversion funnels
   - Connections have values that determine their visual width
   - Example: Revenue sources flowing to expense categories

5. "comparison" - For comparing metrics across different entities
   - Use when: Competitor analysis, year-over-year comparison, scenario analysis
   - Side-by-side bars or grouped elements
   - Example: Apple vs Samsung vs Google revenue comparison

6. "timeline" - For showing events or metrics over time
   - Use when: Historical performance, milestones, projections
   - Nodes arranged chronologically
   - Example: Quarterly revenue over past 8 quarters

OUTPUT FORMAT:
{
  "layoutType": "treemap" | "hierarchy" | "waterfall" | "sankey" | "comparison" | "timeline",
  "title": "Clear, descriptive title",
  "subtitle": "Brief explanation of what this diagram shows",
  "totalValue": 394000000000,
  "totalLabel": "$394B",
  "nodes": [
    {
      "id": "1",
      "label": "iPhone",
      "value": 205000000000,
      "valueLabel": "$205B",
      "percentage": 52,
      "category": "revenue",
      "parentId": null
    },
    {
      "id": "2", 
      "label": "Services",
      "value": 85000000000,
      "valueLabel": "$85B",
      "percentage": 22,
      "category": "revenue",
      "parentId": null
    }
  ],
  "connections": [
    { "from": "root", "to": "1", "value": 205000000000 }
  ],
  "metrics": [
    { "label": "Total Revenue", "value": "$394B", "change": "+8%", "trend": "up" },
    { "label": "YoY Growth", "value": "8%", "change": "+2pp", "trend": "up" }
  ]
}

IMPORTANT RULES:
1. ALWAYS include actual numeric values - use real data from context or make educated estimates
2. ALWAYS include percentage for composition diagrams (treemap, hierarchy)
3. Values should be realistic and internally consistent (parts should sum to total)
4. Use valueLabel for human-readable format ($205B, 52%, 2.3x)
5. Include 2-4 relevant metrics that provide context
6. For hierarchy, use parentId to establish relationships
7. For waterfall, order nodes sequentially from start to end
8. Category should reflect the nature: revenue (green), cost (red), asset (blue), metric (purple), risk (orange), neutral (gray)

THINK STEP BY STEP:
1. What story does the user want to tell?
2. What is the best layout to tell that story?
3. What are the key data points to include?
4. How should they be sized/positioned relative to each other?
5. What metrics provide important context?`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}

## Recent Analysis (use this data for the diagram)
${messages.filter(m => m.role === 'assistant').slice(-5).map(m => m.content.substring(0, 2000)).join('\n\n')}

## Source Documents (reference for accurate data)
${sources.slice(0, 2).map(s => `${s.name}: ${s.content.substring(0, 3000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create a smart, visually compelling diagram: ${customPrompt}

Think about:
- What layout type best tells this story?
- What are the actual numbers involved?
- How should elements be sized relative to each other?
- What context/metrics would help the viewer understand?

Context:
${contextText}`
    : `Create a diagram that best visualizes the key financial data and relationships for ${chatInfo?.display_name || 'this company'}.

Choose the most appropriate layout type and include real numbers from the context.

Context:
${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  // Try to parse the JSON response
  let parsedData: DiagramData | undefined
  
  try {
    // Clean up the response - remove any markdown code blocks if present
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
    
    // Ensure layoutType is valid
    const validLayouts: LayoutType[] = ['treemap', 'hierarchy', 'waterfall', 'sankey', 'comparison', 'timeline']
    if (!parsedData.layoutType || !validLayouts.includes(parsedData.layoutType)) {
      parsedData.layoutType = 'treemap' // Default to treemap
    }
  } catch (e) {
    console.error('Failed to parse diagram JSON:', e)
    console.error('Raw content:', content)
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

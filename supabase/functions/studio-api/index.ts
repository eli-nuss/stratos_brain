// Studio API - Generates reports, slides, diagrams, and tables from chat context and sources

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

type OutputType = 'report' | 'slides' | 'diagram' | 'table'

interface DiagramNode {
  id: string
  label: string
  value?: number
  valueLabel?: string
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral'
  color?: string
  icon?: string
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
  chartType?: 'flowchart' | 'sankey' | 'pie' | 'bar' | 'treemap'
  nodes: DiagramNode[]
  connections: DiagramConnection[]
  metrics?: DiagramMetric[]
}

interface GenerateRequest {
  chat_id: string
  output_type: OutputType
  prompt?: string
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
          maxOutputTokens: 8192,
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

// Generate a report
async function generateReport(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are a professional financial analyst creating investment reports. 
Generate a comprehensive, well-structured investment report in Markdown format.
Include sections like: Executive Summary, Key Findings, Analysis, Risks, and Recommendations.
Use proper Markdown formatting with headers, bullet points, and tables where appropriate.
Be specific and data-driven in your analysis.`

  const contextText = `
## Chat Context
Company/Asset: ${chatInfo?.display_name || 'Unknown'}
Asset Type: ${chatInfo?.asset_type || 'Unknown'}

## Conversation History
${messages.map(m => `**${m.role}**: ${m.content}`).join('\n\n')}

## Source Documents
${sources.map(s => `### ${s.name}\n${s.content.substring(0, 5000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Based on the following context, create an investment report with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Based on the following context, create a comprehensive investment report:\n\n${contextText}`

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

// Generate enhanced diagram with metrics and multiple chart types
async function generateDiagram(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string; diagramData?: DiagramData }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are creating rich, data-driven diagrams to visualize financial concepts.
You MUST output a JSON object that can be rendered as an interactive chart.

Output format (ONLY output valid JSON, no markdown, no explanation):
{
  "title": "Diagram title",
  "description": "Brief explanation of what the diagram shows",
  "chartType": "flowchart" | "sankey" | "pie" | "bar" | "treemap",
  "nodes": [
    { 
      "id": "1", 
      "label": "Revenue", 
      "value": 1500000000,
      "valueLabel": "$1.5B",
      "category": "revenue",
      "color": "#22c55e",
      "icon": "dollar"
    }
  ],
  "connections": [
    { "from": "1", "to": "2", "label": "45%", "value": 675000000 }
  ],
  "metrics": [
    { "label": "Total Revenue", "value": "$1.5B", "change": "+12%", "trend": "up" },
    { "label": "Gross Margin", "value": "32%", "change": "-2%", "trend": "down" }
  ]
}

Chart Types:
- "flowchart": For showing processes, hierarchies, or relationships
- "sankey": For showing money/resource flows with proportional widths
- "pie": For showing composition/breakdown of a whole
- "bar": For comparing values across categories
- "treemap": For showing hierarchical data with proportional areas

Node Categories (use for color coding):
- "revenue": Green (#22c55e) - Income sources
- "cost": Red (#ef4444) - Expenses, costs
- "asset": Blue (#3b82f6) - Assets, resources
- "metric": Purple (#a855f7) - KPIs, metrics
- "risk": Orange (#f97316) - Risks, warnings
- "neutral": Gray (#6b7280) - General information

Rules:
- Include actual numbers and percentages when available from context
- Use valueLabel for formatted display (e.g., "$1.5B", "45%", "2.3x")
- Choose the most appropriate chartType for the data
- For financial flows, prefer sankey charts
- For breakdowns, prefer pie or treemap
- For comparisons, prefer bar charts
- Include 2-4 key metrics when relevant
- Output ONLY the JSON object, nothing else`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}

## Key Topics from Discussion
${messages.filter(m => m.role === 'assistant').slice(-3).map(m => m.content.substring(0, 500)).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create a diagram with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Create a diagram that visualizes the key concepts and relationships discussed:\n\n${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  // Try to parse the JSON response
  let parsedData: {
    title?: string
    description?: string
    chartType?: DiagramData['chartType']
    nodes: DiagramNode[]
    connections: DiagramConnection[]
    metrics?: DiagramMetric[]
  } | undefined
  
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
    
    parsedData = JSON.parse(cleanContent)
  } catch (e) {
    console.error('Failed to parse diagram JSON:', e)
  }
  
  const diagramData: DiagramData | undefined = parsedData ? {
    chartType: parsedData.chartType || 'flowchart',
    nodes: parsedData.nodes,
    connections: parsedData.connections,
    metrics: parsedData.metrics,
  } : undefined
  
  return {
    title: parsedData?.title || `Diagram: ${chatInfo?.display_name || 'Analysis'}`,
    content: parsedData?.description || content,
    diagramData,
  }
}

// Generate data table
async function generateTable(context: Awaited<ReturnType<typeof getChatContext>>, customPrompt?: string): Promise<{ title: string; content: string }> {
  const { messages, sources, chatInfo } = context
  
  const systemPrompt = `You are creating data tables to organize and present financial information.
Generate well-formatted Markdown tables with clear headers and organized data.
Include multiple tables if needed to cover different aspects of the analysis.
Add brief explanations before each table.

Example format:
## Financial Metrics

| Metric | Value | YoY Change |
|--------|-------|------------|
| Revenue | $10.5B | +15% |
| Net Income | $2.1B | +8% |

Focus on extracting and organizing numerical data and key facts from the context.`

  const contextText = `
Company/Asset: ${chatInfo?.display_name || 'Unknown'}

## Discussion Content
${messages.filter(m => m.role === 'assistant').slice(-5).map(m => m.content).join('\n\n')}

## Source Data
${sources.slice(0, 3).map(s => `${s.name}: ${s.content.substring(0, 3000)}`).join('\n\n')}
`

  const userPrompt = customPrompt 
    ? `Create data tables with these specific instructions: ${customPrompt}\n\n${contextText}`
    : `Extract and organize the key data into well-formatted tables:\n\n${contextText}`

  const content = await generateWithGemini(userPrompt, systemPrompt)
  
  return {
    title: `Data Tables: ${chatInfo?.display_name || 'Analysis'}`,
    content,
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const fullPathParts = url.pathname.split('/').filter(Boolean)
    // Remove 'functions', 'v1', 'studio-api' prefix
    const studioApiIndex = fullPathParts.indexOf('studio-api')
    const pathParts = studioApiIndex >= 0 ? fullPathParts.slice(studioApiIndex + 1) : fullPathParts
    
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Create Supabase client with user's token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Get user ID from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const userId = user.id
    
    // Route: POST /generate - Generate an output
    if (req.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'generate') {
      const body: GenerateRequest = await req.json()
      const { chat_id, output_type, prompt } = body
      
      if (!chat_id || !output_type) {
        return new Response(JSON.stringify({ error: 'chat_id and output_type are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Get chat context
      const context = await getChatContext(supabase, chat_id, userId)
      
      // Generate based on type
      let result: { title: string; content: string; diagramData?: { nodes: Array<{ id: string; label: string }>; connections: Array<{ from: string; to: string; label?: string }> } }
      
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
      
      return new Response(JSON.stringify({
        output_id: `output-${Date.now()}`,
        type: output_type,
        title: result.title,
        content: result.content,
        diagramData: result.diagramData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Studio API error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

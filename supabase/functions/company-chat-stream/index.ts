// Company Chat Streaming API - Real-time SSE streaming for chat responses
// Matches the working company-chat-api pattern but with streaming
// Deployment trigger: 2025-01-21-streaming-v8-match-working

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { UNIFIED_TOOL_DECLARATIONS } from '../_shared/unified_tools.ts'
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview'  // User requested this model
const API_VERSION = 'v2025.01.21.streaming-v8'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// SSE headers
const sseHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

// Build a compact system prompt for streaming (optimized for speed)
function buildCompactSystemPrompt(asset: Record<string, unknown>): string {
  const today = new Date().toISOString().split('T')[0]
  
  return `You are Stratos Brain, an AI financial analyst for ${asset.name} (${asset.symbol}).
Today: ${today}. Sector: ${asset.sector || 'N/A'}. Industry: ${asset.industry || 'N/A'}.

You have access to tools for: fundamentals, price history, technicals, signals, AI reviews, SEC filings, web search, Python execution.

Be concise, data-driven, and actionable. Use tools to get real data before answering.`
}

// SSE event types
type SSEEventType = 'connected' | 'thinking' | 'tool_start' | 'tool_complete' | 'token' | 'done' | 'error'

interface SSEEvent {
  type: SSEEventType
  data: unknown
  timestamp: string
}

function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

// Gemini API content structure - matches working company-chat-api
interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: unknown }
}

interface GeminiContent {
  role: 'user' | 'model' | 'function'  // 'function' role for function responses
  parts: GeminiPart[]
}

// Streaming Gemini call with tool execution - matches working pattern
async function* streamGeminiWithTools(
  messages: GeminiContent[],
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  assetId?: number,
  ticker?: string
): AsyncGenerator<SSEEvent> {
  const toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = []
  
  const requestBody = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    tools: [{ functionDeclarations: UNIFIED_TOOL_DECLARATIONS }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      candidateCount: 1
    }
  }
  
  yield { type: 'thinking', data: { message: 'Processing your request...' }, timestamp: new Date().toISOString() }
  
  // Initial request - use non-streaming for reliability, then stream final response
  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', response.status, errorText)
    yield { type: 'error', data: { message: `Gemini API error: ${response.status}`, details: errorText.substring(0, 500) }, timestamp: new Date().toISOString() }
    return
  }
  
  let data = await response.json()
  let candidate = data.candidates?.[0]
  
  const maxIterations = 10
  let iteration = 0
  
  // Process function calls in a loop (matching working pattern)
  while (candidate && iteration < maxIterations) {
    const content = candidate.content
    if (!content?.parts) break
    
    // Check for function calls
    const functionCalls = content.parts.filter((p: GeminiPart) => p.functionCall)
    if (functionCalls.length === 0) break
    
    yield { type: 'thinking', data: { message: `Executing ${functionCalls.length} tool(s)...` }, timestamp: new Date().toISOString() }
    
    // Yield tool_start events
    for (const part of functionCalls) {
      if (part.functionCall) {
        yield { type: 'tool_start', data: { tool: part.functionCall.name, args: part.functionCall.args }, timestamp: new Date().toISOString() }
      }
    }
    
    // Execute tools in parallel (OPTIMIZATION)
    const parallelResults = await Promise.all(
      functionCalls.map(async (part: GeminiPart) => {
        const fc = part.functionCall!
        const result = await executeUnifiedTool(fc.name, fc.args, supabase, {
          assetId,
          ticker,
          chatType: 'company'
        })
        return { fc, result }
      })
    )
    
    // Build function responses
    const functionResponses: GeminiPart[] = []
    for (const { fc, result } of parallelResults) {
      toolCalls.push({ name: fc.name, args: fc.args, result })
      functionResponses.push({ functionResponse: { name: fc.name, response: result } })
      
      const hasError = (result as { error?: string }).error
      yield { type: 'tool_complete', data: { tool: fc.name, success: !hasError }, timestamp: new Date().toISOString() }
      console.log(`✓ ${fc.name} completed: ${hasError ? 'ERROR' : 'OK'}`)
    }
    
    // Add model response and function responses to messages
    // Use role: 'function' for function responses (matching working pattern)
    messages.push({ role: 'model', parts: content.parts })
    messages.push({ role: 'function', parts: functionResponses })
    
    yield { type: 'thinking', data: { message: 'Generating response...' }, timestamp: new Date().toISOString() }
    
    // Make follow-up request
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, contents: messages })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error on function response:', errorText)
      yield { type: 'error', data: { message: `Gemini API error: ${response.status}`, details: errorText.substring(0, 500) }, timestamp: new Date().toISOString() }
      return
    }
    
    data = await response.json()
    candidate = data.candidates?.[0]
    iteration++
  }
  
  // Extract final text response
  const textParts = candidate?.content?.parts?.filter((p: GeminiPart) => p.text) || []
  const responseText = textParts.map((p: { text: string }) => p.text).join('\n')
  
  if (responseText) {
    // Stream the text in chunks for perceived speed
    const chunkSize = 50  // Characters per chunk
    for (let i = 0; i < responseText.length; i += chunkSize) {
      const chunk = responseText.slice(i, i + chunkSize)
      yield { type: 'token', data: { text: chunk }, timestamp: new Date().toISOString() }
      // Small delay to simulate streaming (optional, can be removed)
      // await new Promise(r => setTimeout(r, 10))
    }
  }
  
  yield { type: 'done', data: { fullText: responseText, toolCalls }, timestamp: new Date().toISOString() }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const chatId = pathParts[pathParts.length - 1]
    
    if (!chatId || chatId === 'stream') {
      return new Response(JSON.stringify({ error: 'Chat ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Parse request body
    const body = await req.json()
    const { content } = body
    
    if (!content) {
      return new Response(JSON.stringify({ error: 'Message content required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Get chat and asset info
    const { data: chat, error: chatError } = await supabase
      .from('company_chats')
      .select('*')
      .eq('chat_id', chatId)
      .single()
    
    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get asset info
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('asset_id', parseInt(chat.asset_id))
      .single()
    
    if (assetError || !asset) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get existing messages for context
    const { data: existingMessages } = await supabase
      .from('company_chat_messages')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(20)
    
    // Build messages array for Gemini
    const messages: GeminiContent[] = (existingMessages || []).map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))
    
    // Add the new user message
    messages.push({ role: 'user', parts: [{ text: content }] })
    
    // Save user message to database
    await supabase.from('company_chat_messages').insert({
      chat_id: chatId,
      role: 'user',
      content: content
    })
    
    // Build system prompt
    const systemPrompt = buildCompactSystemPrompt(asset)
    
    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send connected event
          controller.enqueue(new TextEncoder().encode(
            formatSSE({ type: 'connected', data: { chatId, version: API_VERSION }, timestamp: new Date().toISOString() })
          ))
          
          // Stream the response
          let finalText = ''
          let finalToolCalls: unknown[] = []
          
          for await (const event of streamGeminiWithTools(messages, systemPrompt, supabase, asset.asset_id, asset.symbol)) {
            controller.enqueue(new TextEncoder().encode(formatSSE(event)))
            
            if (event.type === 'done') {
              const doneData = event.data as { fullText: string; toolCalls: unknown[] }
              finalText = doneData.fullText
              finalToolCalls = doneData.toolCalls
            }
          }
          
          // Save assistant message to database
          if (finalText) {
            await supabase.from('company_chat_messages').insert({
              chat_id: chatId,
              role: 'assistant',
              content: finalText,
              tool_calls: finalToolCalls.length > 0 ? finalToolCalls : null
            })
          }
          
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(new TextEncoder().encode(
            formatSSE({ 
              type: 'error', 
              data: { message: error instanceof Error ? error.message : 'Unknown error' }, 
              timestamp: new Date().toISOString() 
            })
          ))
          controller.close()
        }
      }
    })
    
    return new Response(stream, { headers: sseHeaders })
    
  } catch (error) {
    console.error('Request error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

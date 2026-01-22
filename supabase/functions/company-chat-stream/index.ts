// Company Chat Stream API - Real-time SSE streaming for chat responses
// This provides instant feedback to users by streaming tokens as they're generated
// Deployment trigger: 2025-01-21-streaming-v2

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UNIFIED_TOOL_DECLARATIONS } from '../_shared/unified_tools.ts'
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-2.5-flash'
const API_VERSION = 'v2025.01.21.streaming'

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

// Chat configuration interface
interface ChatConfig {
  model?: string;
  temperature?: number;
  max_output_tokens?: number;
}

// In-memory cache for chat configuration
interface CachedConfig {
  config: ChatConfig;
  expiry: number;
}
let chatConfigCache: CachedConfig | null = null;
const CHAT_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchChatConfig(supabase: ReturnType<typeof createClient>): Promise<ChatConfig> {
  if (chatConfigCache && chatConfigCache.expiry > Date.now()) {
    return chatConfigCache.config
  }
  
  const { data, error } = await supabase
    .from('chat_config')
    .select('config_key, config_value')
  
  if (error) return chatConfigCache?.config || {}
  
  const config: ChatConfig = {}
  for (const row of data || []) {
    if (row.config_key === 'model') config.model = row.config_value
    else if (row.config_key === 'temperature') config.temperature = parseFloat(row.config_value)
    else if (row.config_key === 'max_output_tokens') config.max_output_tokens = parseInt(row.config_value)
  }
  
  chatConfigCache = { config, expiry: Date.now() + CHAT_CONFIG_CACHE_TTL_MS }
  return config
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

// Streaming Gemini call with tool execution
async function* streamGeminiWithTools(
  messages: Array<{ role: string; parts: Array<{ text?: string }> }>,
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
      maxOutputTokens: 4096,
      candidateCount: 1
    }
  }
  
  yield { type: 'thinking', data: { message: 'Processing your request...' }, timestamp: new Date().toISOString() }
  
  // Initial request - use streaming endpoint
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    yield { type: 'error', data: { message: `Gemini API error: ${response.status}` }, timestamp: new Date().toISOString() }
    return
  }
  
  // Process streaming response
  const reader = response.body?.getReader()
  if (!reader) {
    yield { type: 'error', data: { message: 'Failed to get response stream' }, timestamp: new Date().toISOString() }
    return
  }
  
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulatedText = ''
  const functionCallParts: Array<{ functionCall: { name: string; args: Record<string, unknown> } }> = []
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      
      // Process complete SSE events
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (jsonStr === '[DONE]') continue
          
          try {
            const data = JSON.parse(jsonStr)
            const candidate = data.candidates?.[0]
            
            if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                // Handle text chunks
                if (part.text) {
                  accumulatedText += part.text
                  yield { type: 'token', data: { text: part.text }, timestamp: new Date().toISOString() }
                }
                
                // Handle function calls
                if (part.functionCall) {
                  functionCallParts.push({ functionCall: part.functionCall })
                }
              }
            }
          } catch (_e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  // If there are function calls, execute them and continue
  if (functionCallParts.length > 0) {
    yield { type: 'thinking', data: { message: `Executing ${functionCallParts.length} tool(s)...` }, timestamp: new Date().toISOString() }
    
    // Yield tool_start events for all tools
    for (const part of functionCallParts) {
      yield { type: 'tool_start', data: { tool: part.functionCall.name, args: part.functionCall.args }, timestamp: new Date().toISOString() }
    }
    
    // Execute tools in parallel
    const toolResults = await Promise.all(
      functionCallParts.map(async (part) => {
        const fc = part.functionCall
        const result = await executeUnifiedTool(fc.name, fc.args, supabase, {
          assetId,
          ticker,
          chatType: 'company'
        })
        return { fc, result }
      })
    )
    
    // Yield tool_complete events and build tool calls array
    for (const { fc, result } of toolResults) {
      toolCalls.push({ name: fc.name, args: fc.args, result })
      yield { type: 'tool_complete', data: { tool: fc.name, success: !(result as { error?: string }).error }, timestamp: new Date().toISOString() }
    }
    
    // Build function responses
    const functionResponses = toolCalls.map((tc) => ({
      functionResponse: { name: tc.name, response: tc.result }
    }))
    
    // Add model response and function results to messages
    messages.push({ 
      role: 'model', 
      parts: functionCallParts.map(p => ({ functionCall: p.functionCall })) as Array<{ text?: string }>
    })
    messages.push({ role: 'function', parts: functionResponses as Array<{ text?: string }> })
    
    // Make follow-up streaming request
    const followUpResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, contents: messages })
      }
    )
    
    if (followUpResponse.ok) {
      const followUpReader = followUpResponse.body?.getReader()
      if (followUpReader) {
        let followUpBuffer = ''
        
        try {
          while (true) {
            const { done, value } = await followUpReader.read()
            if (done) break
            
            followUpBuffer += decoder.decode(value, { stream: true })
            
            const lines = followUpBuffer.split('\n')
            followUpBuffer = lines.pop() || ''
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim()
                if (jsonStr === '[DONE]') continue
                
                try {
                  const data = JSON.parse(jsonStr)
                  const candidate = data.candidates?.[0]
                  
                  if (candidate?.content?.parts) {
                    for (const part of candidate.content.parts) {
                      if (part.text) {
                        accumulatedText += part.text
                        yield { type: 'token', data: { text: part.text }, timestamp: new Date().toISOString() }
                      }
                    }
                  }
                } catch (_e) {
                  // Ignore parse errors
                }
              }
            }
          }
        } finally {
          followUpReader.releaseLock()
        }
      }
    }
  }
  
  yield { type: 'done', data: { fullText: accumulatedText, toolCalls }, timestamp: new Date().toISOString() }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const url = new URL(req.url)
  const path = url.pathname.replace('/company-chat-stream', '')
  
  // Only handle POST /stream/:chatId
  if (req.method !== 'POST' || !path.startsWith('/stream/')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  const chatId = path.replace('/stream/', '')
  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Chat ID required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Parse request body
    const { content } = await req.json()
    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: 'Message content required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get chat and asset info
    const { data: chat } = await supabase
      .from('company_chats')
      .select('*')
      .eq('chat_id', chatId)
      .single()
    
    if (!chat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get asset info - chat.asset_id is the numeric asset_id, not the symbol
    const { data: asset } = await supabase
      .from('assets')
      .select('asset_id, symbol, name, sector, industry, asset_type')
      .eq('asset_id', parseInt(chat.asset_id))
      .single()
    
    if (!asset) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get message history (last 20 for speed)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('sequence_num', { ascending: true })
      .limit(20)
    
    // Build Gemini messages
    const geminiMessages: Array<{ role: string; parts: Array<{ text?: string }> }> = []
    for (const msg of history || []) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        geminiMessages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content || '' }]
        })
      }
    }
    
    // Add current user message
    geminiMessages.push({ role: 'user', parts: [{ text: content }] })
    
    // Save user message
    const { data: lastMessage } = await supabase
      .from('chat_messages')
      .select('sequence_num')
      .eq('chat_id', chatId)
      .order('sequence_num', { ascending: false })
      .limit(1)
      .single()
    
    const nextSeq = (lastMessage?.sequence_num || 0) + 1
    
    await supabase
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        sequence_num: nextSeq,
        role: 'user',
        content: content
      })
    
    // Build system prompt
    const systemPrompt = buildCompactSystemPrompt(asset)
    
    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        // Send connected event
        controller.enqueue(encoder.encode(formatSSE({
          type: 'connected',
          data: { chatId, assetId: asset.asset_id, symbol: asset.symbol },
          timestamp: new Date().toISOString()
        })))
        
        let fullResponse = ''
        let allToolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = []
        
        try {
          // Stream Gemini response
          for await (const event of streamGeminiWithTools(
            geminiMessages,
            systemPrompt,
            supabase,
            asset.asset_id,
            asset.symbol
          )) {
            controller.enqueue(encoder.encode(formatSSE(event)))
            
            if (event.type === 'done') {
              fullResponse = (event.data as { fullText: string }).fullText
              allToolCalls = (event.data as { toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> }).toolCalls
            }
          }
          
          // Save assistant message
          if (fullResponse) {
            await supabase
              .from('chat_messages')
              .insert({
                chat_id: chatId,
                sequence_num: nextSeq + 1,
                role: 'assistant',
                content: fullResponse,
                tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
                model: GEMINI_MODEL
              })
            
            // Update chat last_message_at
            await supabase
              .from('company_chats')
              .update({ last_message_at: new Date().toISOString() })
              .eq('chat_id', chatId)
          }
          
        } catch (error) {
          controller.enqueue(encoder.encode(formatSSE({
            type: 'error',
            data: { message: error instanceof Error ? error.message : 'Unknown error' },
            timestamp: new Date().toISOString()
          })))
        }
        
        controller.close()
      }
    })
    
    return new Response(stream, { headers: sseHeaders })
    
  } catch (error) {
    console.error('Stream error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

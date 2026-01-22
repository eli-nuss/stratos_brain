// Company Chat Streaming API - Real-time SSE streaming for chat responses
// Implements correct Gemini 3 thought signature handling per official docs
// Deployment trigger: 2025-01-21-streaming-v7-correct-signatures

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UNIFIED_TOOL_DECLARATIONS } from '../_shared/unified_tools.ts'
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview'
const API_VERSION = 'v2025.01.21.streaming-v7'

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

// Gemini API content structure - matches official REST API format
interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: unknown }
  thoughtSignature?: string  // Base64 encoded, sibling to functionCall/text
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

// Process streaming response and extract parts with thought signatures
async function processStreamingResponse(
  response: Response
): Promise<{ parts: GeminiPart[]; accumulatedText: string }> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Failed to get response stream')
  }
  
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulatedText = ''
  const parts: GeminiPart[] = []
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      
      // Process complete SSE events
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (jsonStr === '[DONE]') continue
          
          try {
            const data = JSON.parse(jsonStr)
            const candidate = data.candidates?.[0]
            
            if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                // Build the part object preserving thought signature
                const geminiPart: GeminiPart = {}
                
                if (part.text !== undefined) {
                  geminiPart.text = part.text
                  accumulatedText += part.text
                }
                
                if (part.functionCall) {
                  geminiPart.functionCall = part.functionCall
                }
                
                // CRITICAL: Capture thought signature as sibling (per Gemini 3 docs)
                if (part.thoughtSignature) {
                  geminiPart.thoughtSignature = part.thoughtSignature
                }
                
                // Only add if we have meaningful content
                if (geminiPart.text !== undefined || geminiPart.functionCall) {
                  parts.push(geminiPart)
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
  
  return { parts, accumulatedText }
}

// Streaming Gemini call with tool execution and correct thought signature handling
async function* streamGeminiWithTools(
  messages: GeminiContent[],
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  assetId?: number,
  ticker?: string
): AsyncGenerator<SSEEvent> {
  const toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = []
  
  const baseRequestBody = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    tools: [{ functionDeclarations: UNIFIED_TOOL_DECLARATIONS }],
    generationConfig: {
      temperature: 1.0,  // Gemini 3 recommends keeping at 1.0
      maxOutputTokens: 4096,
      candidateCount: 1
    },
    // Use low thinking level for faster responses
    thinkingConfig: {
      thinkingLevel: 'low'
    }
  }
  
  yield { type: 'thinking', data: { message: 'Processing your request...' }, timestamp: new Date().toISOString() }
  
  // Initial streaming request
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseRequestBody, contents: messages })
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', response.status, errorText)
    yield { type: 'error', data: { message: `Gemini API error: ${response.status}`, details: errorText }, timestamp: new Date().toISOString() }
    return
  }
  
  // Process streaming response
  const { parts: modelParts, accumulatedText: initialText } = await processStreamingResponse(response)
  
  // Stream any text tokens from initial response
  if (initialText) {
    yield { type: 'token', data: { text: initialText }, timestamp: new Date().toISOString() }
  }
  
  // Check for function calls
  const functionCallParts = modelParts.filter(p => p.functionCall)
  
  if (functionCallParts.length === 0) {
    // No function calls, we're done
    yield { type: 'done', data: { fullText: initialText, toolCalls: [] }, timestamp: new Date().toISOString() }
    return
  }
  
  // Execute function calls
  yield { type: 'thinking', data: { message: `Executing ${functionCallParts.length} tool(s)...` }, timestamp: new Date().toISOString() }
  
  // Yield tool_start events
  for (const part of functionCallParts) {
    if (part.functionCall) {
      yield { type: 'tool_start', data: { tool: part.functionCall.name, args: part.functionCall.args }, timestamp: new Date().toISOString() }
    }
  }
  
  // Execute tools in parallel
  const toolResults = await Promise.all(
    functionCallParts.map(async (part) => {
      const fc = part.functionCall!
      const result = await executeUnifiedTool(fc.name, fc.args, supabase, {
        assetId,
        ticker,
        chatType: 'company'
      })
      return { 
        name: fc.name, 
        args: fc.args, 
        result,
        thoughtSignature: part.thoughtSignature  // Preserve signature
      }
    })
  )
  
  // Yield tool_complete events
  for (const { name, result } of toolResults) {
    toolCalls.push({ name, args: toolResults.find(t => t.name === name)?.args || {}, result })
    yield { type: 'tool_complete', data: { tool: name, success: !(result as { error?: string }).error }, timestamp: new Date().toISOString() }
  }
  
  // Build model response content with thought signatures preserved
  // Per Gemini 3 docs: thoughtSignature is a sibling of functionCall in the same part
  const modelResponseParts: GeminiPart[] = modelParts.map(p => {
    const part: GeminiPart = {}
    if (p.text !== undefined) part.text = p.text
    if (p.functionCall) part.functionCall = p.functionCall
    if (p.thoughtSignature) part.thoughtSignature = p.thoughtSignature  // CRITICAL: Include signature
    return part
  })
  
  // Build function response parts
  // Per Gemini 3 docs: functionResponse goes in role: "user" parts
  const functionResponseParts: GeminiPart[] = toolResults.map(({ name, result }) => ({
    functionResponse: { name, response: result }
  }))
  
  // Add model response and function responses to conversation
  // Per Gemini 3 docs: Model response with functionCall + thoughtSignature, then user with functionResponse
  messages.push({
    role: 'model',
    parts: modelResponseParts
  })
  messages.push({
    role: 'user',  // Per Gemini 3 docs: functionResponse uses role: "user"
    parts: functionResponseParts
  })
  
  yield { type: 'thinking', data: { message: 'Generating response...' }, timestamp: new Date().toISOString() }
  
  // Make follow-up streaming request
  const followUpResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseRequestBody, contents: messages })
    }
  )
  
  if (!followUpResponse.ok) {
    const errorText = await followUpResponse.text()
    console.error('Follow-up Gemini API error:', followUpResponse.status, errorText)
    yield { type: 'error', data: { message: `Follow-up error: ${followUpResponse.status}`, details: errorText }, timestamp: new Date().toISOString() }
    return
  }
  
  // Process follow-up streaming response
  const { parts: followUpParts, accumulatedText: finalText } = await processStreamingResponse(followUpResponse)
  
  // Stream the final text
  if (finalText) {
    yield { type: 'token', data: { text: finalText }, timestamp: new Date().toISOString() }
  }
  
  // Check if there are more function calls (multi-step)
  const moreFunctionCalls = followUpParts.filter(p => p.functionCall)
  
  if (moreFunctionCalls.length > 0) {
    // Handle multi-step function calling (recursive would be complex, so we'll do one more round)
    yield { type: 'thinking', data: { message: `Executing ${moreFunctionCalls.length} additional tool(s)...` }, timestamp: new Date().toISOString() }
    
    for (const part of moreFunctionCalls) {
      if (part.functionCall) {
        yield { type: 'tool_start', data: { tool: part.functionCall.name }, timestamp: new Date().toISOString() }
        
        const result = await executeUnifiedTool(part.functionCall.name, part.functionCall.args, supabase, {
          assetId,
          ticker,
          chatType: 'company'
        })
        
        toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args, result })
        yield { type: 'tool_complete', data: { tool: part.functionCall.name, success: !(result as { error?: string }).error }, timestamp: new Date().toISOString() }
        
        // Add to messages for final response
        messages.push({
          role: 'model',
          parts: followUpParts.map(p => {
            const newPart: GeminiPart = {}
            if (p.text !== undefined) newPart.text = p.text
            if (p.functionCall) newPart.functionCall = p.functionCall
            if (p.thoughtSignature) newPart.thoughtSignature = p.thoughtSignature
            return newPart
          })
        })
        messages.push({
          role: 'user',
          parts: [{ functionResponse: { name: part.functionCall.name, response: result } }]
        })
      }
    }
    
    // Final request after multi-step
    const finalResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseRequestBody, contents: messages })
      }
    )
    
    if (finalResponse.ok) {
      const { accumulatedText: multiStepText } = await processStreamingResponse(finalResponse)
      if (multiStepText) {
        yield { type: 'token', data: { text: multiStepText }, timestamp: new Date().toISOString() }
        yield { type: 'done', data: { fullText: multiStepText, toolCalls }, timestamp: new Date().toISOString() }
        return
      }
    }
  }
  
  yield { type: 'done', data: { fullText: finalText, toolCalls }, timestamp: new Date().toISOString() }
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
    
    // Get chat configuration
    await fetchChatConfig(supabase)
    
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

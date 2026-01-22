// Company Chat Streaming API - Real-time SSE streaming for chat responses
// This provides instant feedback to users by streaming tokens as they're generated
// Deployment trigger: 2025-01-21-streaming-v6-thought-signatures

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UNIFIED_TOOL_DECLARATIONS } from '../_shared/unified_tools.ts'
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview'
const API_VERSION = 'v2025.01.21.streaming-v6'

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

// Interface for Gemini response parts with thought signatures
interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
  thoughtSignature?: string  // Base64 encoded thought signature
}

interface GeminiContent {
  role: string
  parts: GeminiPart[]
}

// Streaming Gemini call with tool execution and thought signature handling
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
    console.error('Gemini API error:', response.status, errorText)
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
  
  // Store the complete model response parts including thought signatures
  const modelResponseParts: GeminiPart[] = []
  
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
                // Store the complete part including thought signature
                const partWithSignature: GeminiPart = {}
                
                // Handle text chunks
                if (part.text) {
                  partWithSignature.text = part.text
                  accumulatedText += part.text
                  yield { type: 'token', data: { text: part.text }, timestamp: new Date().toISOString() }
                }
                
                // Handle function calls
                if (part.functionCall) {
                  partWithSignature.functionCall = part.functionCall
                }
                
                // Capture thought signature (critical for Gemini 3)
                if (part.thoughtSignature) {
                  partWithSignature.thoughtSignature = part.thoughtSignature
                }
                
                // Only add if we have content
                if (partWithSignature.text || partWithSignature.functionCall) {
                  modelResponseParts.push(partWithSignature)
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
  
  // Check if we have function calls to execute
  const functionCallParts = modelResponseParts.filter(p => p.functionCall)
  
  if (functionCallParts.length > 0) {
    yield { type: 'thinking', data: { message: `Executing ${functionCallParts.length} tool(s)...` }, timestamp: new Date().toISOString() }
    
    // Yield tool_start events for all tools
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
        return { fc, result, thoughtSignature: part.thoughtSignature }
      })
    )
    
    // Yield tool_complete events and build tool calls array
    for (const { fc, result } of toolResults) {
      toolCalls.push({ name: fc.name, args: fc.args, result })
      yield { type: 'tool_complete', data: { tool: fc.name, success: !(result as { error?: string }).error }, timestamp: new Date().toISOString() }
    }
    
    // Build the model response with thought signatures preserved
    // This is CRITICAL for Gemini 3 - we must send back the thought signatures
    const modelParts = modelResponseParts.map(p => {
      const part: Record<string, unknown> = {}
      if (p.functionCall) {
        part.functionCall = p.functionCall
      }
      if (p.text) {
        part.text = p.text
      }
      // Include thought signature if present
      if (p.thoughtSignature) {
        part.thoughtSignature = p.thoughtSignature
      }
      return part
    })
    
    // Build function responses
    const functionResponses = toolResults.map(({ fc, result }) => ({
      functionResponse: { name: fc.name, response: result }
    }))
    
    // Add model response (with thought signatures) and function results to messages
    messages.push({ 
      role: 'model', 
      parts: modelParts as GeminiPart[]
    })
    messages.push({ 
      role: 'user',  // Function responses should be role: user per Gemini API
      parts: functionResponses as unknown as GeminiPart[]
    })
    
    yield { type: 'thinking', data: { message: 'Generating response...' }, timestamp: new Date().toISOString() }
    
    // Make follow-up streaming request with the complete conversation including thought signatures
    const followUpResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, contents: messages })
      }
    )
    
    if (!followUpResponse.ok) {
      const errorText = await followUpResponse.text()
      console.error('Follow-up Gemini API error:', followUpResponse.status, errorText)
      
      // Try non-streaming fallback
      yield { type: 'thinking', data: { message: 'Retrying with alternate method...' }, timestamp: new Date().toISOString() }
      
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...requestBody, contents: messages })
        }
      )
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json()
        const fallbackText = fallbackData.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
        if (fallbackText) {
          accumulatedText = fallbackText
          yield { type: 'token', data: { text: fallbackText }, timestamp: new Date().toISOString() }
        }
      } else {
        yield { type: 'error', data: { message: 'Failed to generate response after tool execution' }, timestamp: new Date().toISOString() }
        return
      }
    } else {
      const followUpReader = followUpResponse.body?.getReader()
      if (followUpReader) {
        let followUpBuffer = ''
        accumulatedText = '' // Reset for the final response
        
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
    const chatConfig = await fetchChatConfig(supabase)
    
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

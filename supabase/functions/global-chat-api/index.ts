// Global Chat API (Stratos Brain)
// General-purpose AI assistant for market analysis, not tied to any specific asset
// Unified Tool Architecture v2 - imports from shared library
// Deployment trigger: 2025-01-13-unified-v1

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UNIFIED_TOOL_DECLARATIONS } from '../_shared/unified_tools.ts'
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-flash-preview'
const API_VERSION = 'v2025.01.13.unified' // Version for debugging deployments

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// ============================================================================
// SYSTEM PROMPT (Kept from original - not changed per user request)
// ============================================================================

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  
  return `You are **Stratos Brain** (API ${API_VERSION}), an autonomous financial research engine.
**Mission:** Answer the user's question accurately, concisely, and with data.
**Role:** You are a "High-Speed Research Desk," not a "Portfolio Manager." Do not offer unsolicited advice or macro lectures unless the user explicitly asks for an opinion/thesis.

**IMPORTANT CAPABILITY:** You CAN generate downloadable files using the \`create_and_export_document\` tool. When users ask for PDFs, documents, or downloadable reports, you MUST use this tool - do NOT tell them you cannot create files.

## Tool Routing Logic (Follow Strictly)
1. **Internal Data (Stock Metrics):** If asked for specific stock data (Price, P/E, Volume, Fundamentals) -> Use \`get_asset_fundamentals\`, \`screen_assets\`, \`get_price_history\`, or \`get_market_pulse\`.
2. **External World (Everything Else):** For ANY question requiring knowledge outside your database -> Use \`perform_grounded_research\`.
   - This includes: "Why is X moving?", "What is the history of Y?", "How does Z work?", "Explain the Fed's policy", "What happened in Iran?"
   - Treat this tool as your "General Knowledge" module.
   - If you don't know the answer, DO NOT guess. Call \`perform_grounded_research\`.
3. **Hybrid Queries:** If asked "How does the Iran news affect NVDA?" -> Use \`perform_grounded_research\` FIRST to understand the news, THEN use \`get_asset_fundamentals\` to check the company's exposure.
4. **Calendar Events:** If asked "When does X report earnings?" -> Use \`get_financial_calendar\`.
5. **Document Export (CRITICAL):** If user mentions "PDF", "document", "report", "download", "downloadable", "export", "save" -> You MUST call \`create_and_export_document\` as your FINAL tool call after gathering data. This is the ONLY way the user can download anything.

## Available Tools (Unified Library - All 23 Tools)

### Market-Wide Tools
- **screen_assets**: Filter stocks/crypto by fundamentals, technicals, AI scores
- **get_market_pulse**: Today's market action - gainers, losers, sector performance
- **get_financial_calendar**: Earnings dates, economic calendar events

### Asset Lookup & Fundamentals
- **search_assets**: Find specific companies or cryptocurrencies by name
- **get_asset_fundamentals**: Deep dive into any company's financials
- **get_price_history**: Historical price data for charting and analysis
- **get_technical_indicators**: RSI, MACD, moving averages, and more

### Deep Dive Tools (Asset-Specific)
- **get_active_signals**: Trading signals for a specific asset
- **get_ai_reviews**: Previous AI analysis reviews
- **get_sector_comparison**: Compare asset vs sector peers
- **get_deep_research_report**: Comprehensive business model analysis
- **get_company_docs**: SEC filings (10-K, 10-Q) and earnings transcripts
- **search_company_docs**: Semantic search inside company documents
- **track_topic_trend**: Track topic mentions across earnings calls
- **analyze_management_tone**: Detect shifts in management confidence

### Valuation Tools
- **run_valuation_model**: DCF and comparable company analysis
- **generate_scenario_matrix**: Sensitivity analysis tables

### Macro & Institutional
- **get_macro_context**: Market regime, rates, inflation, sector rotation
- **get_institutional_flows**: 13F data showing what smart money is doing

### Utility Tools
- **perform_grounded_research**: Universal Search - use for ANY external knowledge
- **execute_python**: Run calculations and data analysis
- **generate_dynamic_ui**: Create tables and charts for visualization
- **create_and_export_document**: Generate downloadable documents

## PROTOCOL - Follow This Order:
1. **Reason First**: Before answering, analyze the user's intent. Are they asking for data (use database tools), current events (use grounded research), or a downloadable file (use document export)?
2. **Data First**: For market data, use \`get_market_pulse\`, \`get_macro_context\`, \`screen_assets\`.
3. **External Knowledge**: For news, events, or explanations, use \`perform_grounded_research\`.
4. **Accurate Math**: For calculations, use \`execute_python\`.
5. **Visualizations**: Use \`generate_dynamic_ui\` for tables and charts.
6. **Document Export**: When users explicitly ask to CREATE, EXPORT, SAVE, or DOWNLOAD a document, report, or analysis, use \`create_and_export_document\` to save it.

## Asset-Specific Queries (Router Logic)
When a user asks about a SPECIFIC company (e.g., "Tell me about AAPL", "What's NVDA's valuation?"):
1. First use \`search_assets\` to resolve the ticker and get the asset_id
2. Then use the deep dive tools with the resolved symbol parameter
3. You have access to ALL the same tools as Company Chat - use them!

## Response Guidelines
- For **external knowledge queries**: Present the full response from \`perform_grounded_research\`. Do NOT over-summarize.
- For **hybrid queries** (news + market impact): First explain the situation thoroughly, THEN layer on market data.
- For **data queries**: Be concise and lead with the answer.

## Constraints
- **Date Awareness:** Today is ${today}.
- **Data First:** Never hallucinate numbers. Use \`execute_python\` for math.
- **Visuals:** Use \`generate_dynamic_ui\` for any list > 3 items.

## Tone
Professional, objective, data-rich. For news/geopolitical questions, be comprehensive and journalistic. For data questions, be concise and lead with the answer.`
}

// ============================================================================
// GEMINI API INTEGRATION
// ============================================================================

async function callGeminiWithTools(
  messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  logTool?: (toolName: string, status: 'started' | 'completed' | 'failed') => Promise<void>
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  groundingMetadata: unknown | null;
}> {
  const toolCalls: unknown[] = []
  const codeExecutions: unknown[] = []
  let groundingMetadata: unknown | null = null
  
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
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 500)}`)
  }
  
  let data = await response.json()
  let candidate = data.candidates?.[0]
  
  // Capture grounding metadata from the first response
  if (candidate?.groundingMetadata) {
    groundingMetadata = candidate.groundingMetadata
  }
  
  const maxIterations = 10
  let iteration = 0
  
  while (candidate && iteration < maxIterations) {
    const content = candidate.content
    const functionCallParts = content?.parts?.filter((p: { functionCall?: unknown }) => p.functionCall) || []
    
    if (functionCallParts.length === 0) break
    
    const functionResponses: Array<{ functionResponse: { name: string; response: unknown } }> = []
    
    // OPTIMIZATION: Execute all function calls in parallel for faster response
    console.log(`Executing ${functionCallParts.length} function(s) in parallel...`)
    
    // Log all tool starts first (non-blocking)
    if (logTool) {
      await Promise.all(functionCallParts.map(async (part: { functionCall?: { name: string; args: Record<string, unknown> } }) => {
        const fc = part.functionCall as { name: string; args: Record<string, unknown> }
        await logTool(fc.name, 'started').catch(e => console.error('Failed to log tool start:', e))
      }))
    }
    
    // Execute all tools in parallel
    const parallelResults = await Promise.all(
      functionCallParts.map(async (part: { functionCall?: { name: string; args: Record<string, unknown> } }) => {
        const fc = part.functionCall as { name: string; args: Record<string, unknown> }
        console.log(`Executing function: ${fc.name}`)
        
        const result = await executeUnifiedTool(fc.name, fc.args, supabase, {
          chatType: 'global'
        })
        
        return { fc, result }
      })
    )
    
    // Process results and log completions
    for (const { fc, result } of parallelResults) {
      if (logTool) {
        await logTool(fc.name, (result as { error?: string }).error ? 'failed' : 'completed').catch(e => console.error('Failed to log tool completion:', e))
      }
      
      if (fc.name === 'execute_python') {
        codeExecutions.push({ code: fc.args.code, purpose: fc.args.purpose, result })
      } else {
        toolCalls.push({ name: fc.name, args: fc.args, result })
      }
      
      functionResponses.push({ functionResponse: { name: fc.name, response: result } })
      console.log(`✓ ${fc.name} completed: ${(result as { error?: string }).error ? 'ERROR' : 'OK'}`)
    }
    
    messages.push({ role: 'model', parts: content.parts })
    messages.push({ role: 'function', parts: functionResponses })
    
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
      throw new Error(`Gemini API error: ${response.status}`)
    }
    
    data = await response.json()
    candidate = data.candidates?.[0]
    iteration++
  }
  
  const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || []
  const responseText = textParts.map((p: { text: string }) => p.text).join('\n')
  
  // Also capture grounding metadata from final response if not already captured
  if (!groundingMetadata && candidate?.groundingMetadata) {
    groundingMetadata = candidate.groundingMetadata
  }
  
  return {
    response: responseText || 'I apologize, but I was unable to generate a response.',
    toolCalls,
    codeExecutions,
    groundingMetadata
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/global-chat-api/, '') || '/'
  const userId = req.headers.get('x-user-id')
  
  // Helper to require authentication
  const requireAuth = () => {
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please sign in to use Stratos Brain chat.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    return null
  }

  try {
    // GET /chats - List all brain chats (REQUIRES AUTH)
    if (req.method === 'GET' && path === '/chats') {
      const authError = requireAuth()
      if (authError) return authError
      
      // Only return chats belonging to this user
      let query = supabase
        .from('brain_chats')
        .select('*')
        .eq('status', 'active')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
      
      const { data, error } = await query
      if (error) throw error
      
      return new Response(JSON.stringify({ chats: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /chats - Create new brain chat (REQUIRES AUTH)
    if (req.method === 'POST' && path === '/chats') {
      const authError = requireAuth()
      if (authError) return authError
      
      const body = await req.json()
      const title = body.title || 'New Chat'
      
      const { data: chat, error } = await supabase
        .from('brain_chats')
        .insert({
          title,
          user_id: userId,
          status: 'active'
        })
        .select()
        .single()
      
      if (error) throw error
      
      return new Response(JSON.stringify(chat), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /chats/:chatId - Get chat details (REQUIRES AUTH)
    const chatMatch = path.match(/^\/chats\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && chatMatch) {
      const authError = requireAuth()
      if (authError) return authError
      const chatId = chatMatch[1]
      
      const { data: chat, error } = await supabase
        .from('brain_chats')
        .select('*')
        .eq('chat_id', chatId)
        .single()
      
      if (error || !chat) {
        return new Response(JSON.stringify({ error: 'Chat not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(chat), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /chats/:chatId - Delete chat (REQUIRES AUTH)
    const deleteMatch = path.match(/^\/chats\/([a-f0-9-]+)$/)
    if (req.method === 'DELETE' && deleteMatch) {
      const authError = requireAuth()
      if (authError) return authError
      
      const chatId = deleteMatch[1]
      
      // Only delete if chat belongs to user
      const { error } = await supabase
        .from('brain_chats')
        .update({ status: 'archived' })
        .eq('chat_id', chatId)
        .eq('user_id', userId)
      
      if (error) throw error
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /chats/:chatId/messages - Get messages (REQUIRES AUTH)
    const messagesMatch = path.match(/^\/chats\/([a-f0-9-]+)\/messages$/)
    if (req.method === 'GET' && messagesMatch) {
      const authError = requireAuth()
      if (authError) return authError
      
      const chatId = messagesMatch[1]
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      // Verify chat belongs to user
      const { data: chat } = await supabase
        .from('brain_chats')
        .select('chat_id')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .single()
      
      if (!chat) {
        return new Response(JSON.stringify({ error: 'Chat not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const { data: messages, error } = await supabase
        .from('brain_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('sequence_num', { ascending: true })
        .limit(limit)
      
      if (error) throw error
      
      return new Response(JSON.stringify({ messages: messages || [], total: messages?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /chats/:chatId/messages - Send message (async job-based) (REQUIRES AUTH)
    const sendMatch = path.match(/^\/chats\/([a-f0-9-]+)\/messages$/)
    if (req.method === 'POST' && sendMatch) {
      const authError = requireAuth()
      if (authError) return authError
      
      const chatId = sendMatch[1]
      const body = await req.json()
      const { content } = body
      
      if (!content) {
        return new Response(JSON.stringify({ error: 'content is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Verify chat exists and belongs to user
      const { data: chat, error: chatError } = await supabase
        .from('brain_chats')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .single()
      
      if (chatError || !chat) {
        return new Response(JSON.stringify({ error: 'Chat not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Create job
      const { data: job, error: jobError } = await supabase
        .from('brain_jobs')
        .insert({
          chat_id: chatId,
          user_message: content,
          status: 'pending'
        })
        .select()
        .single()
      
      if (jobError) throw jobError
      
      const jobId = job.id
      
      // Helper to update job
      const updateJob = async (status: string, updates: Record<string, unknown> = {}) => {
        await supabase
          .from('brain_jobs')
          .update({ status, updated_at: new Date().toISOString(), ...updates })
          .eq('id', jobId)
      }
      
      // Helper to log tool calls
      const logTool = async (toolName: string, status: 'started' | 'completed' | 'failed') => {
        const { data: currentJob } = await supabase
          .from('brain_jobs')
          .select('tool_calls')
          .eq('id', jobId)
          .single()
        
        const toolCalls = currentJob?.tool_calls || []
        toolCalls.push({
          tool_name: toolName,
          status,
          timestamp: new Date().toISOString()
        })
        
        await supabase
          .from('brain_jobs')
          .update({ tool_calls: toolCalls, updated_at: new Date().toISOString() })
          .eq('id', jobId)
      }
      
      // Background task
      async function runAnalysisTask() {
        try {
          await updateJob('processing')
          
          // Get sequence number
          const { data: lastMessage } = await supabase
            .from('brain_messages')
            .select('sequence_num')
            .eq('chat_id', chatId)
            .order('sequence_num', { ascending: false })
            .limit(1)
            .single()
          
          const nextSeq = (lastMessage?.sequence_num || 0) + 1
          
          // Save user message
          await supabase
            .from('brain_messages')
            .insert({
              chat_id: chatId,
              sequence_num: nextSeq,
              role: 'user',
              content: content
            })
          
          // Build conversation history
          const { data: history } = await supabase
            .from('brain_messages')
            .select('role, content')
            .eq('chat_id', chatId)
            .order('sequence_num', { ascending: true })
            .limit(50)
          
          const geminiMessages: Array<{ role: string; parts: Array<{ text?: string }> }> = []
          for (const msg of history || []) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              geminiMessages.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content || '' }]
              })
            }
          }
          
          // Call Gemini
          const systemPrompt = buildSystemPrompt()
          const startTime = Date.now()
          const geminiResult = await callGeminiWithTools(geminiMessages, systemPrompt, supabase, logTool)
          const latencyMs = Date.now() - startTime
          
          // Save assistant message
          const { data: assistantMessage } = await supabase
            .from('brain_messages')
            .insert({
              chat_id: chatId,
              sequence_num: nextSeq + 1,
              role: 'assistant',
              content: geminiResult.response,
              tool_calls: geminiResult.toolCalls.length > 0 ? geminiResult.toolCalls : null,
              grounding_metadata: geminiResult.groundingMetadata,
              model: GEMINI_MODEL,
              latency_ms: latencyMs
            })
            .select()
            .single()
          
          // Update chat title if first message
          if (nextSeq === 1) {
            const title = content.length > 50 ? content.substring(0, 47) + '...' : content
            await supabase
              .from('brain_chats')
              .update({ title, last_message_at: new Date().toISOString() })
              .eq('chat_id', chatId)
          } else {
            await supabase
              .from('brain_chats')
              .update({ last_message_at: new Date().toISOString() })
              .eq('chat_id', chatId)
          }
          
          await updateJob('completed', {
            completed_at: new Date().toISOString(),
            result: { message_id: assistantMessage?.message_id, api_version: API_VERSION }
          })
          
        } catch (err) {
          console.error('Background task failed:', err)
          await updateJob('failed', {
            error_message: err instanceof Error ? err.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
        }
      }
      
      // Fire and forget
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(runAnalysisTask())
      } else {
        runAnalysisTask().catch(err => console.error('Background task error:', err))
      }
      
      return new Response(JSON.stringify({
        job_id: jobId,
        status: 'pending',
        message: 'Analysis started in background',
        api_version: API_VERSION
      }), {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET /jobs/:jobId - Get job status
    const jobMatch = path.match(/^\/jobs\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && jobMatch) {
      const jobId = jobMatch[1]
      
      const { data: job, error } = await supabase
        .from('brain_jobs')
        .select('*')
        .eq('id', jobId)
        .single()
      
      if (error || !job) {
        return new Response(JSON.stringify({ error: 'Job not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(job), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /chats/:chatId/messages - Clear messages
    const clearMatch = path.match(/^\/chats\/([a-f0-9-]+)\/messages$/)
    if (req.method === 'DELETE' && clearMatch) {
      const chatId = clearMatch[1]
      
      const { error } = await supabase
        .from('brain_messages')
        .delete()
        .eq('chat_id', chatId)
      
      if (error) throw error
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /chats/:chatId/summarize - Summarize entire chat into a document
    const summarizeMatch = path.match(/^\/chats\/([a-f0-9-]+)\/summarize$/)
    if (req.method === 'POST' && summarizeMatch) {
      const chatId = summarizeMatch[1]
      
      // Get all messages from the chat
      const { data: messages, error: messagesError } = await supabase
        .from('brain_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('sequence_num', { ascending: true })
      
      if (messagesError) throw messagesError
      
      if (!messages || messages.length === 0) {
        return new Response(JSON.stringify({ error: 'No messages to summarize' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Build conversation transcript
      const transcript = messages.map(m => {
        const role = m.role === 'user' ? 'User' : 'Stratos Brain'
        return `**${role}:** ${m.content}`
      }).join('\n\n---\n\n')
      
      // Call Gemini to summarize
      const summarizePrompt = `You are a financial research assistant. Below is a conversation between a user and Stratos Brain (an AI financial analyst). 

Your task is to create a comprehensive, well-structured document that summarizes ALL the key information, insights, analysis, and conclusions from this conversation.

**Requirements:**
1. Create a professional document with clear sections and headers
2. Include ALL important data points, numbers, and metrics discussed
3. Preserve any tables, charts descriptions, or structured data
4. Include key insights and recommendations
5. Add a brief executive summary at the top
6. Format in clean Markdown
7. Title the document based on the main topics discussed

**Conversation Transcript:**

${transcript}

---

Now create the comprehensive summary document:`

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: summarizePrompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192
            }
          })
        }
      )
      
      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error: ${geminiResponse.status}`)
      }
      
      const geminiData = await geminiResponse.json()
      const summaryContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Failed to generate summary'
      
      // Extract title from the summary
      const titleMatch = summaryContent.match(/^#\s+(.+)$/m) || summaryContent.match(/^\*\*(.+?)\*\*/m)
      const title = titleMatch ? titleMatch[1].replace(/[#*]/g, '').trim() : 'Chat Summary'
      
      // Save to storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `chat_summary_${timestamp}.md`
      const storagePath = `global_chat_exports/${chatId}/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('asset-files')
        .upload(storagePath, new Blob([summaryContent], { type: 'text/markdown' }), {
          contentType: 'text/markdown',
          upsert: true
        })
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError)
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('asset-files')
        .getPublicUrl(storagePath)
      
      return new Response(JSON.stringify({
        success: true,
        title,
        content: summaryContent,
        storage_path: storagePath,
        public_url: urlData?.publicUrl || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found', path }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('API Error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      api_version: API_VERSION
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

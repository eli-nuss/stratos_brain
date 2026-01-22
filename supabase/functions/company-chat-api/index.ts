// Company Chat API - Deep dive into specific companies
// Unified Tool Architecture v2 - imports from shared library
// Deployment trigger: 2025-01-13-unified-v1

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { UNIFIED_TOOL_DECLARATIONS } from '../_shared/unified_tools.ts'
import { executeUnifiedTool } from '../_shared/unified_tool_handlers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Gemini API configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview'
const API_VERSION = 'v2025.01.21.realtime-broadcast'

// Broadcast event to Supabase Realtime channel for real-time updates
// Uses REST API for reliable broadcasting from edge functions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

async function broadcastEvent(
  jobId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          topic: `chat_job:${jobId}`,
          event: event,
          payload: payload,
          private: false  // Public channel so clients can subscribe without auth
        }]
      })
    })
    
    if (!response.ok) {
      console.error(`Broadcast ${event} failed:`, response.status, await response.text())
    } else {
      console.log(`Broadcast ${event} sent successfully to chat_job:${jobId}`)
    }
  } catch (err) {
    console.error(`Failed to broadcast ${event}:`, err)
  }
}

// Chat config interface
interface ChatConfig {
  model?: string;
  temperature?: number;
  max_output_tokens?: number;
  system_prompt_intro?: string;
  grounding_rules?: string;
  role_description?: string;
  guidelines?: string;
  response_format?: string;
}

// OPTIMIZATION: In-memory cache for chat configuration with 5-minute TTL
interface CachedConfig {
  config: ChatConfig;
  expiry: number;
}
let chatConfigCache: CachedConfig | null = null;
const CHAT_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch chat config from database with caching
async function fetchChatConfig(supabase: ReturnType<typeof createClient>): Promise<ChatConfig> {
  // Check cache first
  if (chatConfigCache && chatConfigCache.expiry > Date.now()) {
    console.log('Using cached chat config (TTL remaining:', Math.round((chatConfigCache.expiry - Date.now()) / 1000), 's)')
    return chatConfigCache.config
  }
  
  console.log('Fetching fresh chat config from database...')
  const { data, error } = await supabase
    .from('chat_config')
    .select('config_key, config_value')
  
  if (error) {
    console.log('Failed to fetch chat config, using defaults:', error.message)
    return chatConfigCache?.config || {}
  }
  
  const config: ChatConfig = {}
  for (const row of data || []) {
    if (row.config_key === 'model') config.model = row.config_value
    else if (row.config_key === 'temperature') config.temperature = parseFloat(row.config_value)
    else if (row.config_key === 'max_output_tokens') config.max_output_tokens = parseInt(row.config_value)
    else if (row.config_key === 'system_prompt_intro') config.system_prompt_intro = row.config_value
    else if (row.config_key === 'grounding_rules') config.grounding_rules = row.config_value
    else if (row.config_key === 'role_description') config.role_description = row.config_value
    else if (row.config_key === 'guidelines') config.guidelines = row.config_value
    else if (row.config_key === 'response_format') config.response_format = row.config_value
  }
  
  // Update cache
  chatConfigCache = {
    config,
    expiry: Date.now() + CHAT_CONFIG_CACHE_TTL_MS
  }
  console.log('Chat config cached for 5 minutes')
  
  return config
}

// OPTIMIZATION: Document cache with hash-based invalidation
interface CachedDocuments {
  deepResearch: string | null;
  memo: string | null;
  onePager: string | null;
  cacheKey: string; // Hash of file paths + created_at timestamps
  cachedAt: number;
}

const documentCache = new Map<number, CachedDocuments>();
const DOCUMENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Generate cache key from file metadata
function generateDocCacheKey(files: Array<{ file_type: string; file_path: string; created_at: string }>): string {
  return files
    .filter(f => ['deep_research', 'memo', 'one_pager'].includes(f.file_type))
    .map(f => `${f.file_type}:${f.created_at}`)
    .sort()
    .join('|')
}

// Fetch latest AI-generated documents for an asset with caching
async function fetchLatestDocuments(supabase: ReturnType<typeof createClient>, assetId: number): Promise<{
  deepResearch: string | null;
  memo: string | null;
  onePager: string | null;
}> {
  try {
    // First, get file metadata (fast query)
    const { data: files } = await supabase
      .from('asset_files')
      .select('file_type, file_path, description, created_at')
      .eq('asset_id', assetId)
      .in('file_type', ['deep_research', 'memo', 'one_pager'])
      .order('created_at', { ascending: false })
    
    if (!files || files.length === 0) {
      return { deepResearch: null, memo: null, onePager: null }
    }
    
    // Generate cache key from file metadata
    const cacheKey = generateDocCacheKey(files)
    const cached = documentCache.get(assetId)
    
    // Check if cache is valid (same files, not expired)
    if (cached && cached.cacheKey === cacheKey && (Date.now() - cached.cachedAt) < DOCUMENT_CACHE_TTL_MS) {
      console.log(`[Doc Cache] HIT for asset ${assetId} (age: ${Math.round((Date.now() - cached.cachedAt) / 1000)}s)`)
      return {
        deepResearch: cached.deepResearch,
        memo: cached.memo,
        onePager: cached.onePager
      }
    }
    
    console.log(`[Doc Cache] MISS for asset ${assetId} - fetching documents...`)
    
    const latestByType: Record<string, { file_path: string; description?: string }> = {}
    for (const file of files) {
      if (!latestByType[file.file_type]) {
        latestByType[file.file_type] = { file_path: file.file_path, description: file.description }
      }
    }
    
    const fetchContent = async (fileInfo: { file_path: string; description?: string } | undefined): Promise<string | null> => {
      if (!fileInfo) return null
      try {
        const response = await fetch(fileInfo.file_path)
        if (!response.ok) return null
        const text = await response.text()
        return text.length > 30000 ? text.substring(0, 30000) + '\n\n[Document truncated for context limits...]' : text
      } catch (e) {
        console.error('Error fetching document:', e)
        return null
      }
    }
    
    const [deepResearch, memo, onePager] = await Promise.all([
      fetchContent(latestByType['deep_research']),
      fetchContent(latestByType['memo']),
      fetchContent(latestByType['one_pager'])
    ])
    
    // Update cache
    documentCache.set(assetId, {
      deepResearch,
      memo,
      onePager,
      cacheKey,
      cachedAt: Date.now()
    })
    console.log(`[Doc Cache] Cached documents for asset ${assetId}`)
    
    // Cleanup old cache entries (keep max 50 assets cached)
    if (documentCache.size > 50) {
      const entries = Array.from(documentCache.entries())
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt)
      const toRemove = entries.slice(0, entries.length - 50)
      for (const [key] of toRemove) {
        documentCache.delete(key)
      }
      console.log(`[Doc Cache] Cleaned up ${toRemove.length} old entries`)
    }
    
    return { deepResearch, memo, onePager }
  } catch (error) {
    console.error('Error fetching latest documents:', error)
    return { deepResearch: null, memo: null, onePager: null }
  }
}

// OPTIMIZATION: Compact system prompt for faster responses (reduced token count)
function buildCompactSystemPrompt(
  asset: Record<string, unknown>,
  contextSnapshot: Record<string, unknown> | null
): string {
  const today = new Date().toISOString().split('T')[0]
  
  return `You are Stratos (API ${API_VERSION}), an elite autonomous financial analyst for ${asset.name} (${asset.symbol}).

## Context
- **Symbol**: ${asset.symbol} | **Asset ID**: ${asset.asset_id} | **Type**: ${asset.asset_type}
- **Sector**: ${asset.sector || 'N/A'} | **Industry**: ${asset.industry || 'N/A'}
- **Today**: ${today}

## Critical Rules
1. **Data First**: Query database/docs before making claims. Your training data is outdated.
2. **Math via Python**: Use \`execute_python\` for ALL calculations.
3. **Cite Sources**: Quote specific documents (e.g., "10-K 2024, Risk Factors").

## Tools Available
- **Fundamentals**: get_asset_fundamentals, get_price_history, get_technical_indicators
- **Analysis**: get_ai_reviews, get_active_signals, get_sector_comparison
- **Documents**: get_company_docs, search_company_docs, get_deep_research_report
- **Market**: get_macro_context, get_institutional_flows, get_market_pulse
- **Utility**: execute_python, perform_grounded_research, generate_dynamic_ui

${contextSnapshot ? `## Latest Data\n${JSON.stringify(contextSnapshot, null, 1).slice(0, 2000)}` : ''}

Be concise, data-driven, and actionable.`
}

// Build system prompt for company chat - Universal Analyst Protocol
function buildSystemPrompt(
  asset: Record<string, unknown>, 
  contextSnapshot: Record<string, unknown> | null, 
  chatConfig: ChatConfig = {},
  preloadedDocs: { deepResearch: string | null; memo: string | null; onePager: string | null } = { deepResearch: null, memo: null, onePager: null },
  useCompactMode: boolean = false
): string {
  // Use compact mode for faster responses when documents aren't needed
  if (useCompactMode) {
    return buildCompactSystemPrompt(asset, contextSnapshot)
  }
  const today = new Date().toISOString().split('T')[0];
  
  const intro = chatConfig.system_prompt_intro 
    ? chatConfig.system_prompt_intro
        .replace('{company_name}', String(asset.name))
        .replace('{symbol}', String(asset.symbol))
    : `You are Stratos (API ${API_VERSION}), an elite autonomous financial analyst for ${asset.name} (${asset.symbol}). Your goal is accuracy, depth, and data-driven insight.`
  
  const groundingRules = chatConfig.grounding_rules
    ? chatConfig.grounding_rules
        .replace(/{asset_id}/g, String(asset.asset_id))
        .replace(/{asset_type}/g, String(asset.asset_type))
        .replace(/{today}/g, today)
    : `1. **Trust Data Over Memory**: Your internal training data is OUTDATED. The database and source documents contain the REAL-TIME truth. ALWAYS query before making claims.
2. **Source Truth Priority**: When asked about risks, strategy, management commentary, or business details, do NOT guess. Use \`get_company_docs\` to read the actual SEC filings or earnings transcripts.
3. **Zero-Math Tolerance**: You are bad at arithmetic. If the user asks for ANY calculation (growth rates, CAGR, valuation, projections, ratios), you MUST use \`execute_python\` to compute it accurately.
4. **Public Status Verification**: This asset has ID ${asset.asset_id} and Type '${asset.asset_type}'. It is ALREADY a public company/token trading on exchanges. NEVER discuss "upcoming IPOs" or "going public soon".
5. **Date Awareness**: Today is **${today}**. News older than 7 days is "History", not "News".
6. **Citation Required**: Always cite the specific document and section (e.g., '10-K 2024, Risk Factors section') when providing facts from filings.`
  
  const roleDescription = chatConfig.role_description || `You are helping a trader/investor research and analyze this company with professional-grade tools:

1. **Deep Research Reports (get_deep_research_report)**: CHECK THIS FIRST for questions about business model, revenue breakdown, key metrics, or comprehensive analysis.
2. **Document Library (get_company_docs)**: Read FULL SEC filings (10-K, 10-Q) and earnings transcripts.
3. **Database Functions**: Query real-time financial data, price history, technical indicators, signals, and AI reviews.
4. **Python Sandbox (execute_python)**: Execute Python code for accurate calculations, statistical analysis, forecasts.
5. **Grounded Research (perform_grounded_research)**: Search the web using Google Search for current news and developments.
6. **Document Export (create_and_export_document)**: When users ask to CREATE, EXPORT, SAVE, or DOWNLOAD a document, use this tool.`
  
  const guidelines = chatConfig.guidelines
    ? chatConfig.guidelines.replace(/{asset_id}/g, String(asset.asset_id))
    : `## PROTOCOL - Follow This Order:

1. **Reason First**: Before answering, analyze the user's intent.
2. **Deep Research First**: For questions about business model, revenue breakdown, key metrics → call \`get_deep_research_report\` FIRST.
3. **Source Documents**: For questions about risks, strategy, competitive position → call \`get_company_docs\` or \`search_company_docs\`.
4. **Accurate Math**: For ANY numbers, calculations, or projections → use \`execute_python\`.
5. **Database Context**: Use asset_id ${asset.asset_id} for database functions.
6. **Verify Claims**: If your memory conflicts with database/document data, ALWAYS trust the source data.
7. **Transparency**: Be clear about data limitations and uncertainty. Cite your sources.
8. **Actionable Insights**: End with clear takeaways or action items when appropriate.
9. **Document Export**: When users explicitly ask to CREATE, EXPORT, SAVE, or DOWNLOAD, use \`create_and_export_document\`.

## MEMORY CONSTRAINT STRATEGY (CRITICAL)
You are running in a memory-constrained serverless environment. For complex multi-step queries:
- **DO NOT** chain heavy operations in a single response turn.
- **Step 1**: Fetch data (documents OR grounded research). Return findings to user.
- **Step 2**: If user confirms, proceed with analysis (Python calculations, charts).`
  
  const responseFormat = chatConfig.response_format || `- Use markdown formatting with clear sections
- Include relevant metrics and data points with citations
- Show calculation methodology when using Python
- Provide both bullish and bearish perspectives when relevant
- Quote directly from filings when citing management commentary
- End with key takeaways or action items`
  
  return `${intro}

## CRITICAL GROUNDING RULES (READ FIRST)
${groundingRules}

## MACRO-AWARENESS PROTOCOL (MANDATORY)
**Before recommending ANY stock or discussing investment timing, you MUST check the macro environment using \`get_macro_context\`.**

### When to Call \`get_macro_context\`:
- User asks "Should I buy [stock]?" → Call FIRST
- User asks about "market conditions" or "risks" → Call FIRST
- User discusses "timing" or "when to enter" → Call FIRST
- User mentions "Fed", "rates", "inflation", "recession" → Call to get current data

### How to Interpret:
1. **Risk Regime**: "Risk-On" = good for growth stocks, "Risk-Off" = favor defensive
2. **Yield Curve**: Inverted = Recession warning, Steepening = Economic expansion
3. **Breadth Rating**: "Divergent" = Fragile rally, "Strong" = Healthy market

**NEVER say "This stock looks good" without explaining HOW the current macro environment supports or threatens that thesis.**

## INSTITUTIONAL FLOWS PROTOCOL (FOLLOW THE SMART MONEY)
**Before recommending ANY stock, you MUST check institutional positioning using \`get_institutional_flows\`.**

### When to Call:
- User asks about "top holders", "institutional holders", "who owns", "shareholders", "13F" → Call IMMEDIATELY
- User asks "Should I buy [stock]?" → Call AFTER macro context
- User asks "Is [stock] undervalued?" → Call to check if institutions agree

### How to Interpret:
1. **Accumulation (Positive investorsHoldingChange)**: ✅ BULLISH - Smart Money is buying
2. **Distribution (Negative investorsHoldingChange)**: ⚠️ BEARISH - Smart Money is selling (VALUE TRAP WARNING)

**If fundamentals look good BUT institutions are distributing, you MUST warn the user.**

## Available Tools (Unified Library - All 23 Tools)

### Asset-Specific Tools (Auto-injected with asset_id: ${asset.asset_id})
- **get_asset_fundamentals**: Deep dive into financials
- **get_price_history**: Historical OHLCV data
- **get_technical_indicators**: RSI, MACD, moving averages
- **get_active_signals**: Trading signals
- **get_ai_reviews**: Previous AI analysis reviews
- **get_sector_comparison**: Compare vs sector peers
- **get_deep_research_report**: Comprehensive business model analysis
- **get_company_docs**: SEC filings and earnings transcripts
- **search_company_docs**: Semantic search inside documents
- **track_topic_trend**: Track topic mentions across earnings calls
- **analyze_management_tone**: Detect shifts in management confidence

### Valuation Tools
- **run_valuation_model**: DCF and comparable company analysis
- **generate_scenario_matrix**: Sensitivity analysis tables

### Market-Wide Tools
- **screen_assets**: Filter stocks/crypto by fundamentals
- **search_assets**: Find companies by name
- **get_market_pulse**: Today's market action
- **get_financial_calendar**: Earnings dates, economic events
- **get_macro_context**: Market regime, rates, inflation
- **get_institutional_flows**: 13F data showing smart money

### Utility Tools
- **perform_grounded_research**: Universal Search for external knowledge
- **execute_python**: Run calculations and data analysis
- **generate_dynamic_ui**: Create tables and charts
- **create_and_export_document**: Generate downloadable documents

## Company Context
- **Symbol**: ${asset.symbol}
- **Name**: ${asset.name}
- **Asset Type**: ${asset.asset_type}
- **Current Status**: TRADING / PUBLIC (confirmed by presence in database)
- **Sector**: ${asset.sector || 'N/A'}
- **Industry**: ${asset.industry || 'N/A'}
- **Asset ID**: ${asset.asset_id} (use this for database queries)
- **Today's Date**: ${today}

${preloadedDocs.deepResearch ? `## 📚 DEEP RESEARCH REPORT (PRE-LOADED - USE THIS FIRST!)
**This comprehensive analysis has already been generated. Reference it directly instead of calling get_deep_research_report.**

${preloadedDocs.deepResearch}

---
` : ''}

${preloadedDocs.memo ? `## 📋 INVESTMENT MEMO (PRE-LOADED)
${preloadedDocs.memo}

---
` : ''}

${preloadedDocs.onePager ? `## 📄 ONE PAGER SNAPSHOT (PRE-LOADED)
${preloadedDocs.onePager}

---
` : ''}

${contextSnapshot ? `## Latest Context Snapshot (REAL-TIME DATA)
${JSON.stringify(contextSnapshot, null, 2)}` : ''}

## Analysis Protocol
${guidelines}

## Response Format
${responseFormat}`
}

// Call Gemini with unified function calling and real-time broadcasting
async function callGeminiWithTools(
  messages: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  chatConfig: ChatConfig = {},
  logTool?: (toolName: string, status: 'started' | 'completed' | 'failed', data?: Record<string, unknown>) => Promise<void>,
  assetId?: number,
  ticker?: string,
  jobId?: string  // For real-time broadcasting
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  groundingMetadata: unknown | null;
}> {
  const toolCalls: unknown[] = []
  const codeExecutions: unknown[] = []
  let groundingMetadata: unknown | null = null
  
  const model = chatConfig.model || GEMINI_MODEL
  const temperature = chatConfig.temperature ?? 0.7
  const maxOutputTokens = chatConfig.max_output_tokens ?? 8192
  
  console.log(`Using model: ${model}, temperature: ${temperature}, maxTokens: ${maxOutputTokens}`)
  
  const requestBody = {
    contents: messages,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    tools: [{ functionDeclarations: UNIFIED_TOOL_DECLARATIONS }],
    // Disable safety filters to prevent false positives on financial data
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxOutputTokens,
      candidateCount: 1
    }
  }
  
  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 500)}`)
  }
  
  let data = await response.json()
  
  // Debug logging for empty candidates and finishReason
  if (!data.candidates || data.candidates.length === 0) {
    console.error('⚠️ Gemini returned NO CANDIDATES. Full Response:', JSON.stringify(data, null, 2))
    if (data.promptFeedback) {
      console.error('⚠️ Block Reason:', JSON.stringify(data.promptFeedback, null, 2))
    }
  } else {
    const cand = data.candidates[0]
    if (cand.finishReason !== 'STOP') {
      console.warn(`⚠️ Finish Reason was ${cand.finishReason} (not STOP). Safety Ratings:`, JSON.stringify(cand.safetyRatings, null, 2))
    }
  }
  
  let candidate = data.candidates?.[0]
  
  // Capture grounding metadata
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
    
    // BROADCAST: Tool start events for real-time UI updates
    if (jobId) {
      const toolNames = functionCallParts.map((p: { functionCall?: { name: string } }) => p.functionCall?.name || 'unknown')
      await broadcastEvent(jobId, 'tool_start', { tools: toolNames })
    }
    
    // Log all tool starts first (non-blocking)
    if (logTool) {
      await Promise.all(functionCallParts.map(async (part: { functionCall?: { name: string; args: Record<string, unknown> } }) => {
        const fc = part.functionCall as { name: string; args: Record<string, unknown> }
        const startData: Record<string, unknown> = { args: fc.args }
        if (fc.name === 'execute_python' && fc.args.code) {
          startData.code = String(fc.args.code).slice(0, 500)
          startData.purpose = fc.args.purpose
        }
        await logTool(fc.name, 'started', startData).catch(e => console.error('Failed to log tool start:', e))
      }))
    }
    
    // Execute all tools in parallel
    const parallelResults = await Promise.all(
      functionCallParts.map(async (part: { functionCall?: { name: string; args: Record<string, unknown> } }) => {
        const fc = part.functionCall as { name: string; args: Record<string, unknown> }
        console.log(`Executing function: ${fc.name}`)
        
        const result = await executeUnifiedTool(fc.name, fc.args, supabase, {
          assetId,
          ticker,
          chatType: 'company'
        })
        
        return { fc, result }
      })
    )
    
    // Process results and log completions
    for (const { fc, result } of parallelResults) {
      // Log tool completion
      if (logTool) {
        const completionData: Record<string, unknown> = {}
        if (fc.name === 'execute_python') {
          completionData.code = String(fc.args.code || '').slice(0, 300)
          completionData.output = (result as { output?: string }).output ? String((result as { output?: string }).output).slice(0, 200) : null
          completionData.error = (result as { error?: string }).error || null
        }
        await logTool(fc.name, (result as { error?: string }).error ? 'failed' : 'completed', completionData).catch(e => console.error('Failed to log tool completion:', e))
      }
      
      // Track tool calls and code executions separately
      if (fc.name === 'execute_python') {
        codeExecutions.push({ code: fc.args.code, purpose: fc.args.purpose, result })
      } else {
        toolCalls.push({ name: fc.name, args: fc.args, result })
      }
      
      functionResponses.push({ functionResponse: { name: fc.name, response: result } })
      console.log(`✓ ${fc.name} completed: ${(result as { error?: string }).error ? 'ERROR' : 'OK'}`)
    }
    
    // BROADCAST: Tool complete events for real-time UI updates
    if (jobId) {
      const results = parallelResults.map(r => ({
        name: r.fc.name,
        success: !(r.result as { error?: string }).error
      }))
      await broadcastEvent(jobId, 'tool_complete', { results })
    }
    
    // Preserve thought signatures from model response (required for Gemini 3)
    const modelParts = content.parts.map((part: { functionCall?: unknown; text?: string; thoughtSignature?: string }) => {
      const newPart: { functionCall?: unknown; text?: string; thoughtSignature?: string } = {}
      if (part.functionCall) newPart.functionCall = part.functionCall
      if (part.text) newPart.text = part.text
      if (part.thoughtSignature) newPart.thoughtSignature = part.thoughtSignature
      return newPart
    })
    messages.push({ role: 'model', parts: modelParts })
    messages.push({ role: 'user', parts: functionResponses })
    
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, contents: messages })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error on function response:', errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }
    
    data = await response.json()
    
    // Debug logging for empty candidates and finishReason after tool execution
    if (!data.candidates || data.candidates.length === 0) {
      console.error('⚠️ Gemini returned NO CANDIDATES after tool execution. Full Response:', JSON.stringify(data, null, 2))
      if (data.promptFeedback) {
        console.error('⚠️ Block Reason:', JSON.stringify(data.promptFeedback, null, 2))
      }
    } else {
      const cand = data.candidates[0]
      if (cand.finishReason !== 'STOP') {
        console.warn(`⚠️ Finish Reason after tools was ${cand.finishReason} (not STOP). Safety Ratings:`, JSON.stringify(cand.safetyRatings, null, 2))
      }
    }
    
    candidate = data.candidates?.[0]
    
    // Capture grounding metadata from subsequent responses
    if (candidate?.groundingMetadata && !groundingMetadata) {
      groundingMetadata = candidate.groundingMetadata
    }
    
    iteration++
  }
  
  const textParts = candidate?.content?.parts?.filter((p: { text?: string }) => p.text) || []
  let responseText = textParts.map((p: { text: string }) => p.text).join('\n')
  
  // If no response text, add debug info to help diagnose the issue
  if (!responseText && candidate) {
    const finishReason = candidate.finishReason || 'UNKNOWN'
    const safetyRatings = candidate.safetyRatings ? JSON.stringify(candidate.safetyRatings) : 'none'
    console.error(`Empty response - finishReason: ${finishReason}, safetyRatings: ${safetyRatings}`)
    responseText = `I apologize, but I was unable to generate a response. Debug: finishReason=${finishReason}`
  } else if (!responseText) {
    console.error('No candidate returned from Gemini')
    responseText = 'I apologize, but I was unable to generate a response. Debug: No candidate returned.'
  }
  
  // BROADCAST: Stream text chunks for real-time UI updates
  if (jobId && responseText) {
    const chunkSize = 50  // Characters per chunk
    for (let i = 0; i < responseText.length; i += chunkSize) {
      const chunk = responseText.slice(i, i + chunkSize)
      await broadcastEvent(jobId, 'text_chunk', { text: chunk })
      // Small delay to prevent flooding the socket
      await new Promise(r => setTimeout(r, 15))
    }
    // Send done event with full text
    await broadcastEvent(jobId, 'done', { full_text: responseText })
  }
  
  return {
    response: responseText,
    toolCalls,
    codeExecutions,
    groundingMetadata
  }
}

// Wrapper function with timeout and error handling
async function callGeminiWithToolsSafe(
  messages: Array<{ role: string; parts: Array<{ text?: string }> }>,
  systemInstruction: string,
  supabase: ReturnType<typeof createClient>,
  chatConfig: ChatConfig = {},
  logTool?: (toolName: string, status: 'started' | 'completed' | 'failed', data?: Record<string, unknown>) => Promise<void>,
  assetId?: number,
  ticker?: string
): Promise<{
  response: string;
  toolCalls: unknown[];
  codeExecutions: unknown[];
  groundingMetadata: unknown | null;
  error?: string;
}> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout - the analysis took too long')), 55000)
    })
    
    const result = await Promise.race([
      callGeminiWithTools(messages, systemInstruction, supabase, chatConfig, logTool, assetId, ticker),
      timeoutPromise
    ])
    
    return result
  } catch (error) {
    console.error('callGeminiWithToolsSafe error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return {
      response: `I encountered an error while processing your request: ${errorMessage}. Please try again or simplify your question.`,
      toolCalls: [],
      codeExecutions: [],
      groundingMetadata: null,
      error: errorMessage
    }
  }
}

// Main server handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const rawPath = url.pathname
    const path = rawPath.replace('/company-chat-api', '').replace('/functions/v1/company-chat-api', '')
    
    console.log(`[company-chat-api] Request: ${req.method} ${rawPath} -> path: ${path}`)
    
    const userId = req.headers.get('x-user-id') || null
    
    // Helper to require authentication
    const requireAuth = () => {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required. Please sign in to use chat features.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return null
    }

    // Route handling
    switch (true) {
      // GET /chats - List all company chats for the current user (REQUIRES AUTH)
      case req.method === 'GET' && path === '/chats': {
        const authError = requireAuth()
        if (authError) return authError
        
        let query = supabase
          .from('company_chats')
          .select(`
            chat_id,
            asset_id,
            asset_type,
            display_name,
            status,
            last_message_at,
            created_at,
            user_id
          `)
          .eq('status', 'active')
          .eq('user_id', userId)
        
        const { data, error } = await query.order('last_message_at', { ascending: false, nullsFirst: false })
        
        if (error) throw error
        
        const chatIds = data?.map(c => c.chat_id) || []
        const { data: messageCounts } = await supabase
          .from('chat_messages')
          .select('chat_id')
          .in('chat_id', chatIds)
        
        const countMap = new Map<string, number>()
        messageCounts?.forEach(m => {
          countMap.set(m.chat_id, (countMap.get(m.chat_id) || 0) + 1)
        })
        
        const chatsWithCounts = data?.map(chat => ({
          ...chat,
          message_count: countMap.get(chat.chat_id) || 0
        }))
        
        return new Response(JSON.stringify({ chats: chatsWithCounts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /chats - Create or get a chat for a company (REQUIRES AUTH)
      case req.method === 'POST' && path === '/chats': {
        const authError = requireAuth()
        if (authError) return authError
        
        const body = await req.json()
        const { asset_id, asset_type, display_name } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Check for existing chat for this user and asset
        let existingChatQuery = supabase
          .from('company_chats')
          .select('*')
          .eq('asset_id', asset_id)
          .eq('user_id', userId)
        
        const { data: existingChat } = await existingChatQuery.single()
        
        if (existingChat) {
          return new Response(JSON.stringify(existingChat), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        let assetInfo = { asset_type, display_name }
        if (!display_name) {
          const { data: asset } = await supabase
            .from('assets')
            .select('name, asset_type, symbol')
            .eq('asset_id', asset_id)
            .single()
          
          if (asset) {
            assetInfo = {
              asset_type: asset.asset_type,
              display_name: `${asset.name} (${asset.symbol})`
            }
          }
        }
        
        const { data: newChat, error } = await supabase
          .from('company_chats')
          .insert({
            asset_id: String(asset_id),
            asset_type: assetInfo.asset_type || 'equity',
            display_name: assetInfo.display_name || `Asset ${asset_id}`,
            user_id: userId
          })
          .select()
          .single()
        
        if (error) throw error
        
        return new Response(JSON.stringify(newChat), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /chats/:chatId - Get a specific chat (REQUIRES AUTH)
      case req.method === 'GET' && /^\/chats\/[a-f0-9-]+$/.test(path): {
        const authError = requireAuth()
        if (authError) return authError
        
        const chatId = path.split('/').pop()
        
        // Only return chat if it belongs to the user
        const { data: chat, error } = await supabase
          .from('company_chats')
          .select('*')
          .eq('chat_id', chatId)
          .eq('user_id', userId)
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

      // GET /chats/:chatId/messages - Get messages for a chat (REQUIRES AUTH)
      case req.method === 'GET' && /^\/chats\/[a-f0-9-]+\/messages$/.test(path): {
        const authError = requireAuth()
        if (authError) return authError
        
        const chatId = path.split('/')[2]
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        
        // Verify chat belongs to user
        const { data: chat } = await supabase
          .from('company_chats')
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
          .from('chat_messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('sequence_num', { ascending: true })
          .range(offset, offset + limit - 1)
        
        if (error) throw error
        
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chatId)
        
        return new Response(JSON.stringify({
          messages: messages || [],
          total: count || 0,
          has_more: (offset + limit) < (count || 0)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /chats/:chatId/messages - Send a message (async job-based) (REQUIRES AUTH)
      case req.method === 'POST' && /^\/chats\/[a-f0-9-]+\/messages$/.test(path): {
        const authError = requireAuth()
        if (authError) return authError
        
        const chatId = path.split('/')[2]
        const body = await req.json()
        const { content } = body
        
        if (!content) {
          return new Response(JSON.stringify({ error: 'content is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Verify chat belongs to user
        const { data: chat, error: chatError } = await supabase
          .from('company_chats')
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
        
        const { data: asset } = await supabase
          .from('assets')
          .select('*')
          .eq('asset_id', parseInt(chat.asset_id))
          .single()
        
        if (!asset) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data: job, error: jobError } = await supabase
          .from('chat_jobs')
          .insert({
            chat_id: chatId,
            user_message: content,
            status: 'pending'
          })
          .select()
          .single()
        
        if (jobError) {
          console.error('Failed to create job:', jobError)
          return new Response(JSON.stringify({ error: 'Failed to create job' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const jobId = job.id
        
        const updateJob = async (status: string, updates: Record<string, unknown> = {}) => {
          await supabase
            .from('chat_jobs')
            .update({ status, ...updates, updated_at: new Date().toISOString() })
            .eq('id', jobId)
        }
        
        const logTool = async (toolName: string, status: 'started' | 'completed' | 'failed', data?: Record<string, unknown>) => {
          const { data: currentJob } = await supabase
            .from('chat_jobs')
            .select('tool_calls')
            .eq('id', jobId)
            .single()
          
          const existingCalls = currentJob?.tool_calls || []
          const toolCall = { tool_name: toolName, status, timestamp: new Date().toISOString(), data: data || null }
          
          await supabase
            .from('chat_jobs')
            .update({ tool_calls: [...existingCalls, toolCall] })
            .eq('id', jobId)
        }
        
        const runAnalysisTask = async () => {
          try {
            await updateJob('processing', { status_message: 'Starting analysis...' })
            
            const chatConfig = await fetchChatConfig(supabase)
            
            const { data: lastMessage } = await supabase
              .from('chat_messages')
              .select('sequence_num')
              .eq('chat_id', chatId)
              .order('sequence_num', { ascending: false })
              .limit(1)
              .single()
            
            const nextSeq = (lastMessage?.sequence_num || 0) + 1
            
            const { error: userMsgError } = await supabase
              .from('chat_messages')
              .insert({
                chat_id: chatId,
                sequence_num: nextSeq,
                role: 'user',
                content: content
              })
            
            if (userMsgError) throw userMsgError
            
            const { data: history } = await supabase
              .from('chat_messages')
              .select('role, content, tool_calls, executable_code, code_execution_result')
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
            
            const preloadedDocs = await fetchLatestDocuments(supabase, parseInt(chat.asset_id))
            console.log('Pre-loaded docs:', { 
              hasDeepResearch: !!preloadedDocs.deepResearch, 
              hasMemo: !!preloadedDocs.memo, 
              hasOnePager: !!preloadedDocs.onePager 
            })
            
            const systemPrompt = buildSystemPrompt(asset, chat.context_snapshot, chatConfig, preloadedDocs)
            
            const startTime = Date.now()
            const geminiResult = await callGeminiWithTools(
              geminiMessages, 
              systemPrompt, 
              supabase, 
              chatConfig,
              logTool,
              asset.asset_id,
              asset.symbol,
              jobId  // Pass jobId for real-time broadcasting
            )
            const latencyMs = Date.now() - startTime
            
            const { data: assistantMessage, error: assistantMsgError } = await supabase
              .from('chat_messages')
              .insert({
                chat_id: chatId,
                sequence_num: nextSeq + 1,
                role: 'assistant',
                content: geminiResult.response,
                tool_calls: geminiResult.toolCalls.length > 0 ? geminiResult.toolCalls : null,
                executable_code: geminiResult.codeExecutions.length > 0 ? (geminiResult.codeExecutions[0] as { code?: string })?.code : null,
                code_execution_result: geminiResult.codeExecutions.length > 0 ? JSON.stringify((geminiResult.codeExecutions[0] as { result?: unknown })?.result) : null,
                grounding_metadata: geminiResult.groundingMetadata,
                model: chatConfig.model || GEMINI_MODEL,
                latency_ms: latencyMs
              })
              .select()
              .single()
            
            if (assistantMsgError) throw assistantMsgError
            
            await supabase
              .from('company_chats')
              .update({ last_message_at: new Date().toISOString() })
              .eq('chat_id', chatId)
            
            await updateJob('completed', { 
              completed_at: new Date().toISOString(),
              result: { message_id: assistantMessage?.message_id, api_version: API_VERSION }
            })
            
            console.log(`Job ${jobId} completed successfully in ${latencyMs}ms`)
            
          } catch (err) {
            console.error('Background task failed:', err)
            // BROADCAST: Error event for real-time UI updates
            await broadcastEvent(jobId, 'error', { 
              message: err instanceof Error ? err.message : 'Unknown error' 
            })
            await updateJob('failed', { 
              error_message: err instanceof Error ? err.message : 'Unknown error',
              completed_at: new Date().toISOString()
            })
          }
        }
        
        // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
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
      case req.method === 'GET' && /^\/jobs\/[a-f0-9-]+$/.test(path): {
        const jobId = path.split('/').pop()
        
        const { data: job, error } = await supabase
          .from('chat_jobs')
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

      // LEGACY: POST /chats/:chatId/messages/sync - Synchronous message
      case req.method === 'POST' && /^\/chats\/[a-f0-9-]+\/messages\/sync$/.test(path): {
        const chatId = path.split('/')[2]
        const body = await req.json()
        const { content } = body
        
        if (!content) {
          return new Response(JSON.stringify({ error: 'content is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
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
        
        const { data: asset } = await supabase
          .from('assets')
          .select('*')
          .eq('asset_id', parseInt(chat.asset_id))
          .single()
        
        if (!asset) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const chatConfig = await fetchChatConfig(supabase)
        
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('sequence_num')
          .eq('chat_id', chatId)
          .order('sequence_num', { ascending: false })
          .limit(1)
          .single()
        
        const nextSeq = (lastMessage?.sequence_num || 0) + 1
        
        const { data: userMessage, error: userMsgError } = await supabase
          .from('chat_messages')
          .insert({
            chat_id: chatId,
            sequence_num: nextSeq,
            role: 'user',
            content: content
          })
          .select()
          .single()
        
        if (userMsgError) throw userMsgError
        
        const { data: history } = await supabase
          .from('chat_messages')
          .select('role, content, tool_calls, executable_code, code_execution_result')
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
        
        const preloadedDocs = await fetchLatestDocuments(supabase, parseInt(chat.asset_id))
        const systemPrompt = buildSystemPrompt(asset, chat.context_snapshot, chatConfig, preloadedDocs)
        
        const startTime = Date.now()
        const geminiResult = await callGeminiWithToolsSafe(
          geminiMessages, 
          systemPrompt, 
          supabase, 
          chatConfig,
          undefined,
          asset.asset_id,
          asset.symbol
        )
        const latencyMs = Date.now() - startTime
        
        const { data: assistantMessage, error: assistantMsgError } = await supabase
          .from('chat_messages')
          .insert({
            chat_id: chatId,
            sequence_num: nextSeq + 1,
            role: 'assistant',
            content: geminiResult.response,
            tool_calls: geminiResult.toolCalls.length > 0 ? geminiResult.toolCalls : null,
            executable_code: geminiResult.codeExecutions.length > 0 ? (geminiResult.codeExecutions[0] as { code?: string })?.code : null,
            code_execution_result: geminiResult.codeExecutions.length > 0 ? JSON.stringify((geminiResult.codeExecutions[0] as { result?: unknown })?.result) : null,
            grounding_metadata: geminiResult.groundingMetadata,
            model: chatConfig.model || GEMINI_MODEL,
            latency_ms: latencyMs
          })
          .select()
          .single()
        
        if (assistantMsgError) throw assistantMsgError
        
        await supabase
          .from('company_chats')
          .update({ last_message_at: new Date().toISOString() })
          .eq('chat_id', chatId)
        
        return new Response(JSON.stringify({
          user_message: userMessage,
          assistant_message: assistantMessage,
          tool_calls: geminiResult.toolCalls,
          code_executions: geminiResult.codeExecutions,
          grounding_metadata: geminiResult.groundingMetadata
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /chats/:chatId/messages - Clear all messages
      case req.method === 'DELETE' && /^\/chats\/[a-f0-9-]+\/messages$/.test(path): {
        const chatId = path.split('/')[2]
        
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('chat_id', chatId)
        
        if (error) throw error
        
        await supabase
          .from('company_chats')
          .update({ last_message_at: null, message_count: 0 })
          .eq('chat_id', chatId)
        
        return new Response(JSON.stringify({ success: true, message: 'Chat cleared' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /chats/:chatId - Archive a chat
      case req.method === 'DELETE' && /^\/chats\/[a-f0-9-]+$/.test(path): {
        const chatId = path.split('/').pop()
        
        const { error } = await supabase
          .from('company_chats')
          .update({ status: 'archived' })
          .eq('chat_id', chatId)
        
        if (error) throw error
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /chats/:chatId/context - Refresh context snapshot
      case req.method === 'PUT' && /^\/chats\/[a-f0-9-]+\/context$/.test(path): {
        const chatId = path.split('/')[2]
        
        const { data: chat } = await supabase
          .from('company_chats')
          .select('asset_id')
          .eq('chat_id', chatId)
          .single()
        
        if (!chat) {
          return new Response(JSON.stringify({ error: 'Chat not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetId = parseInt(chat.asset_id)
        const today = new Date().toISOString().split('T')[0]
        
        const [features, signals, reviews] = await Promise.all([
          supabase
            .from('daily_features')
            .select('*')
            .eq('asset_id', assetId)
            .lte('date', today)
            .order('date', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('daily_signal_facts')
            .select('signal_type, direction, strength')
            .eq('asset_id', assetId)
            .eq('date', today)
            .order('strength', { ascending: false })
            .limit(5),
          supabase
            .from('asset_ai_reviews')
            .select('direction, setup_type, entry_zone, stop_loss, targets, risk_rating, as_of_date')
            .eq('asset_id', assetId)
            .order('as_of_date', { ascending: false })
            .limit(1)
            .single()
        ])
        
        const contextSnapshot = {
          updated_at: new Date().toISOString(),
          latest_features: features.data,
          active_signals: signals.data,
          latest_review: reviews.data
        }
        
        const { error } = await supabase
          .from('company_chats')
          .update({ context_snapshot: contextSnapshot })
          .eq('chat_id', chatId)
        
        if (error) throw error
        
        return new Response(JSON.stringify({ context_snapshot: contextSnapshot }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /fundamentals/:assetId - Get fundamentals for an asset
      case req.method === 'GET' && /^\/fundamentals\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop() || '0')
        
        const { data: asset } = await supabase
          .from('assets')
          .select('name, symbol, asset_type, sector, industry')
          .eq('asset_id', assetId)
          .single()
        
        if (!asset) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data: fundamentals } = await supabase
          .from('equity_metadata')
          .select('*')
          .eq('asset_id', assetId)
          .single()
        
        const { data: priceData } = await supabase
          .from('daily_bars')
          .select('close, high, low')
          .eq('asset_id', assetId)
          .order('date', { ascending: false })
          .limit(1)
          .single()
        
        const result = {
          name: asset.name,
          symbol: asset.symbol,
          sector: asset.sector || fundamentals?.sector,
          industry: asset.industry || fundamentals?.industry,
          market_cap: fundamentals?.market_cap,
          revenue_ttm: fundamentals?.revenue_ttm,
          quarterly_revenue_growth_yoy: fundamentals?.quarterly_revenue_growth_yoy,
          quarterly_earnings_growth_yoy: fundamentals?.quarterly_earnings_growth_yoy,
          eps: fundamentals?.eps,
          pe_ratio: fundamentals?.pe_ratio,
          forward_pe: fundamentals?.forward_pe,
          peg_ratio: fundamentals?.peg_ratio,
          price_to_sales_ttm: fundamentals?.price_to_sales_ttm,
          price_to_book: fundamentals?.price_to_book,
          profit_margin: fundamentals?.profit_margin,
          operating_margin_ttm: fundamentals?.operating_margin_ttm,
          return_on_equity_ttm: fundamentals?.return_on_equity_ttm,
          return_on_assets_ttm: fundamentals?.return_on_assets_ttm,
          beta: fundamentals?.beta,
          analyst_target_price: fundamentals?.analyst_target_price,
          week_52_low: fundamentals?.week_52_low,
          week_52_high: fundamentals?.week_52_high,
          dividend_yield: fundamentals?.dividend_yield,
          current_price: priceData?.close,
          last_updated: fundamentals?.last_updated
        }
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /ai-review/:assetId - Get latest AI review
      case path.startsWith('/ai-review/'): {
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetId = path.replace('/ai-review/', '')
        if (!assetId) {
          return new Response(JSON.stringify({ error: 'Asset ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data: aiReview, error: aiError } = await supabase
          .from('asset_ai_reviews')
          .select(`
            asset_id,
            as_of_date,
            direction,
            setup_type,
            ai_direction_score,
            ai_setup_quality_score,
            ai_attention_level,
            ai_confidence,
            ai_summary_text,
            ai_key_levels,
            ai_entry,
            ai_targets,
            ai_risks,
            ai_time_horizon,
            ai_what_to_watch_next,
            created_at
          `)
          .eq('asset_id', assetId)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .single()
        
        if (aiError || !aiReview) {
          return new Response(JSON.stringify({ error: 'AI review not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(aiReview), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /chats/:chatId/summarize - Summarize entire chat
      case req.method === 'POST' && /^\/chats\/[a-f0-9-]+\/summarize$/.test(path): {
        const chatIdMatch = path.match(/^\/chats\/([a-f0-9-]+)\/summarize$/)
        if (!chatIdMatch) {
          return new Response(JSON.stringify({ error: 'Invalid chat ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        const chatId = chatIdMatch[1]
        
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
        
        const { data: messages, error: messagesError } = await supabase
          .from('chat_messages')
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
        
        const transcript = messages.map(m => {
          const role = m.role === 'user' ? 'User' : 'Stratos Brain'
          return `**${role}:** ${m.content || '[No content]'}`
        }).join('\n\n---\n\n')
        
        console.log(`Summarizing chat ${chatId} with ${messages.length} messages`)
        
        const summarizePrompt = `You are a financial research assistant. Below is a conversation between a user and Stratos Brain (an AI financial analyst) about ${chat.display_name || 'a company'}.

Your task is to create a comprehensive, well-structured document that summarizes ALL the key information, insights, analysis, and conclusions from this conversation.

**Requirements:**
1. Create a professional document with clear sections and headers
2. Include ALL important data points, numbers, and metrics discussed
3. Preserve any tables, charts descriptions, or structured data
4. Include key insights and recommendations
5. Add a brief executive summary at the top
6. Format in clean Markdown
7. Title the document: "${chat.display_name || 'Company'} Research Summary"

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
          const errorText = await geminiResponse.text()
          console.error('Gemini API error:', geminiResponse.status, errorText)
          throw new Error(`Gemini API error: ${geminiResponse.status}`)
        }
        
        const geminiData = await geminiResponse.json()
        
        if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.error('No content in Gemini response:', geminiData)
          throw new Error('Gemini returned empty response')
        }
        
        const summaryContent = geminiData.candidates[0].content.parts[0].text
        
        const titleMatch = summaryContent.match(/^#\s+(.+)$/m) || summaryContent.match(/^\*\*(.+?)\*\*/m)
        const title = titleMatch ? titleMatch[1].replace(/[#*]/g, '').trim() : `${chat.display_name || 'Company'} Research Summary`
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fileName = `chat_summary_${timestamp}.md`
        const storagePath = `chat_exports/${chat.asset_id}/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('asset-files')
          .upload(storagePath, new Blob([summaryContent], { type: 'text/markdown' }), {
            contentType: 'text/markdown',
            upsert: true
          })
        
        if (uploadError) {
          console.error('Storage upload error:', uploadError)
        }
        
        const { data: urlData } = supabase.storage
          .from('asset-files')
          .getPublicUrl(storagePath)
        
        return new Response(JSON.stringify({
          success: true,
          title,
          content: summaryContent,
          storage_path: storagePath,
          public_url: urlData?.publicUrl,
          asset_id: chat.asset_id,
          display_name: chat.display_name
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      api_version: API_VERSION
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

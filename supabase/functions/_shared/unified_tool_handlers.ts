// supabase/functions/_shared/unified_tool_handlers.ts
// Unified Tool Execution Handlers - "Shared Brain" Architecture
// Both Global Chat and Company Chat import from this single source of truth

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Type definitions
type SupabaseClient = ReturnType<typeof createClient>
type ToolArgs = Record<string, unknown>
type ToolResult = Record<string, unknown>

// Environment variables (must be set in the calling function)
const getEnvVar = (name: string): string => Deno.env.get(name) || ''

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Grounded Research using native Gemini Google Search
export async function executeGroundedSearch(query: string): Promise<string> {
  const GEMINI_API_KEY = getEnvVar('GEMINI_API_KEY')
  const GEMINI_MODEL = 'gemini-3-flash-preview'
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ 
            role: 'user', 
            parts: [{ text: `You are a highly capable research assistant with access to Google Search.

User Query: "${query}"

Instructions:
1. Use Google Search to find the most relevant and up-to-date information.
2. Answer the query comprehensively and thoroughly.
3. If the query asks for an opinion or analysis, provide it based on the search results.
4. If the query asks for a specific format (bullet points, essay, table, timeline), follow it.
5. If the query is about current events, include specific dates, names, and developments.
6. If the query is technical or educational, explain concepts clearly.

Provide a detailed, well-structured response with citations where appropriate.` }] 
          }],
          tools: [{ googleSearch: {} }],
          generationConfig: { 
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      return `Research Error: ${response.status} - ${errorText}`
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text).join('') || "No results found."
    
    // Extract citations
    const metadata = candidate?.groundingMetadata
    let citationText = ""
    
    if (metadata?.groundingChunks && metadata.groundingChunks.length > 0) {
      citationText = "\n\n**Sources:**\n" + metadata.groundingChunks
        .slice(0, 10)
        .map((c: { web?: { title?: string; uri?: string } }, i: number) => 
          `[${i+1}] ${c.web?.title || 'Source'} - ${c.web?.uri || ''}`
        )
        .join('\n')
    }
    
    if (metadata?.webSearchQueries && metadata.webSearchQueries.length > 0) {
      citationText += "\n\n**Search queries used:** " + metadata.webSearchQueries.join(', ')
    }

    return text + citationText

  } catch (e) {
    return `Research failed: ${e instanceof Error ? e.message : 'Unknown error'}`
  }
}

// Execute Python code using E2B sandbox
export async function executePythonCode(code: string, purpose: string): Promise<unknown> {
  const E2B_API_KEY = getEnvVar('E2B_API_KEY')
  const E2B_API_URL = 'https://api.e2b.dev'
  
  if (!E2B_API_KEY) {
    return {
      success: false,
      purpose,
      code,
      output: null,
      error: "E2B API key not configured"
    }
  }

  try {
    // Create sandbox
    const createResponse = await fetch(`${E2B_API_URL}/sandboxes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': E2B_API_KEY,
      },
      body: JSON.stringify({
        templateID: 'code-interpreter-v1',
        timeoutMs: 60000,
      }),
    })

    if (!createResponse.ok) {
      return { success: false, purpose, code, output: null, error: `Failed to create sandbox: ${createResponse.status}` }
    }

    const sandbox = await createResponse.json()
    const sandboxId = sandbox.sandboxID || sandbox.sandboxId || sandbox.id
    if (!sandboxId) {
      return { success: false, purpose, code, output: null, error: 'Failed to get sandbox ID' }
    }

    // Execute code
    const executeUrl = `https://49999-${sandboxId}.e2b.dev/execute`
    const accessToken = sandbox.envdAccessToken || ''
    
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': accessToken,
      },
      body: JSON.stringify({ code, language: 'python' }),
    })

    const executionResult: { stdout: string[]; stderr: string[]; error?: string } = { stdout: [], stderr: [] }

    if (executeResponse.ok) {
      const responseText = await executeResponse.text()
      const lines = responseText.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'stdout' && parsed.text) executionResult.stdout.push(parsed.text)
          else if (parsed.type === 'stderr' && parsed.text) executionResult.stderr.push(parsed.text)
          else if (parsed.error) executionResult.error = parsed.error
        } catch {
          if (line.trim()) executionResult.stdout.push(line)
        }
      }
    } else {
      executionResult.error = `Execution failed: ${executeResponse.status}`
    }

    // Cleanup sandbox
    try {
      await fetch(`${E2B_API_URL}/sandboxes/${sandboxId}`, { method: 'DELETE', headers: { 'X-API-Key': E2B_API_KEY } })
    } catch { /* ignore */ }

    const output = executionResult.stdout.join('')
    const errorOutput = executionResult.stderr.join('')
    
    if (executionResult.error) {
      return { success: false, purpose, code, output: output || null, error: executionResult.error + (errorOutput ? `\n${errorOutput}` : '') }
    }

    return { success: true, purpose, code, output: output || '(No output)', error: errorOutput || null }
  } catch (error) {
    return { success: false, purpose, code, output: null, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// ============================================================================
// MAIN TOOL EXECUTOR
// ============================================================================

export async function executeUnifiedTool(
  name: string,
  args: ToolArgs,
  supabase: SupabaseClient,
  context?: {
    assetId?: number
    ticker?: string
    chatType?: 'company' | 'global'
  }
): Promise<ToolResult> {
  
  // Auto-inject asset context for Company Chat if not provided
  const effectiveAssetId = args.asset_id as number || context?.assetId
  const effectiveTicker = (args.ticker as string || args.symbol as string || context?.ticker)?.toUpperCase()
  
  switch (name) {
    // ========================================================================
    // MARKET-WIDE TOOLS
    // ========================================================================
    
    case "screen_assets": {
      console.log("🔍 Running Screen:", JSON.stringify(args))
      
      const assetType = args.asset_type as string
      const limit = Math.min((args.limit as number) || 15, 50)
      
      let query = supabase
        .from('v_dashboard_all_assets')
        .select(`
          asset_id, symbol, name, asset_type, sector, industry,
          close, return_1d, return_7d, return_30d, return_365d,
          market_cap, pe_ratio, forward_pe, peg_ratio,
          revenue_ttm, revenue_growth_yoy, profit_margin, operating_margin, roe, roa,
          ai_direction, ai_direction_score, ai_setup_quality_score, setup_type, ai_confidence, ai_summary,
          beta, dividend_yield, eps, analyst_target_price
        `)
      
      if (assetType === 'equity') query = query.eq('asset_type', 'equity')
      else if (assetType === 'crypto') query = query.eq('asset_type', 'crypto')
      
      if (args.sector) query = query.ilike('sector', `%${args.sector}%`)
      if (args.industry) query = query.ilike('industry', `%${args.industry}%`)
      if (args.min_market_cap_billions) query = query.gte('market_cap', (args.min_market_cap_billions as number) * 1e9)
      if (args.max_market_cap_billions) query = query.lte('market_cap', (args.max_market_cap_billions as number) * 1e9)
      if (args.min_pe_ratio) query = query.gte('pe_ratio', args.min_pe_ratio)
      if (args.max_pe_ratio) query = query.lte('pe_ratio', args.max_pe_ratio)
      if (args.min_revenue_growth) query = query.gte('revenue_growth_yoy', args.min_revenue_growth)
      if (args.min_profit_margin) query = query.gte('profit_margin', args.min_profit_margin)
      if (args.min_roe) query = query.gte('roe', args.min_roe)
      if (args.min_performance_1m) query = query.gte('return_30d', args.min_performance_1m)
      if (args.max_performance_1m) query = query.lte('return_30d', args.max_performance_1m)
      if (args.min_ai_direction_score) query = query.gte('ai_direction_score', args.min_ai_direction_score)
      if (args.min_ai_setup_quality) query = query.gte('ai_setup_quality_score', args.min_ai_setup_quality)
      if (args.setup_type) query = query.eq('setup_type', args.setup_type)
      
      const sortMapping: Record<string, string> = {
        'market_cap': 'market_cap',
        'revenue_growth': 'revenue_growth_yoy',
        'performance_1m': 'return_30d',
        'performance_30d': 'return_30d',
        'pe_ratio': 'pe_ratio',
        'ai_direction_score': 'ai_direction_score',
        'ai_setup_quality': 'ai_setup_quality_score',
        'profit_margin': 'profit_margin',
        'roe': 'roe'
      }
      const sortBy = sortMapping[args.sort_by as string] || 'market_cap'
      const sortOrder = args.sort_order === 'asc'
      query = query.order(sortBy, { ascending: sortOrder, nullsFirst: false })
      query = query.limit(limit)
      
      const { data, error } = await query
      
      if (error) return { error: error.message }
      if (!data || data.length === 0) {
        return { result: "No assets found matching your criteria.", filters_applied: args, count: 0 }
      }
      
      const formattedAssets = data.map((d: Record<string, unknown>) => {
        const result: Record<string, unknown> = {
          symbol: d.symbol,
          name: d.name,
          type: d.asset_type
        }
        
        if (d.asset_type === 'equity') {
          result.sector = d.sector
          result.industry = d.industry
        }
        
        if (d.market_cap) {
          const mcap = d.market_cap as number
          result.market_cap = mcap >= 1e12 ? `$${(mcap / 1e12).toFixed(2)}T` : mcap >= 1e9 ? `$${(mcap / 1e9).toFixed(1)}B` : `$${(mcap / 1e6).toFixed(0)}M`
        }
        
        result.price = d.close ? `$${(d.close as number).toFixed(2)}` : null
        result.return_1d = d.return_1d ? `${((d.return_1d as number) * 100).toFixed(2)}%` : null
        result.return_30d = d.return_30d ? `${((d.return_30d as number) * 100).toFixed(1)}%` : null
        
        if (d.pe_ratio) result.pe_ratio = (d.pe_ratio as number).toFixed(1)
        if (d.revenue_growth_yoy) result.revenue_growth = `${((d.revenue_growth_yoy as number) * 100).toFixed(1)}%`
        if (d.profit_margin) result.profit_margin = `${((d.profit_margin as number) * 100).toFixed(1)}%`
        if (d.roe) result.roe = `${((d.roe as number) * 100).toFixed(1)}%`
        
        if (d.ai_direction) result.ai_direction = d.ai_direction
        if (d.ai_direction_score) result.ai_direction_score = d.ai_direction_score
        if (d.setup_type) result.setup_type = d.setup_type
        if (d.ai_setup_quality_score) result.ai_setup_quality = d.ai_setup_quality_score
        if (d.ai_summary) result.ai_summary = d.ai_summary
        
        return result
      })
      
      return { count: data.length, filters_applied: args, assets: formattedAssets }
    }

    case "get_market_pulse": {
      const FMP_API_KEY = getEnvVar('FMP_API_KEY')
      const dataType = args.data_type as string
      const limit = Math.min((args.limit as number) || 10, 20)
      
      if (!FMP_API_KEY) return { error: 'FMP API key not configured' }
      
      const result: Record<string, unknown> = {
        as_of: new Date().toISOString().split('T')[0],
        data_type: dataType
      }
      
      try {
        if (dataType === 'overview' || dataType === 'sectors') {
          const sectorUrl = `https://financialmodelingprep.com/api/v3/sector-performance?apikey=${FMP_API_KEY}`
          const sectorRes = await fetch(sectorUrl)
          if (sectorRes.ok) {
            const sectorData = await sectorRes.json()
            result.sectors = sectorData.map((s: Record<string, unknown>) => ({
              sector: s.sector,
              change: s.changesPercentage
            }))
          }
        }
        
        if (dataType === 'overview' || dataType === 'gainers') {
          const gainersUrl = `https://financialmodelingprep.com/api/v3/stock_market/gainers?apikey=${FMP_API_KEY}`
          const gainersRes = await fetch(gainersUrl)
          if (gainersRes.ok) {
            const gainersData = await gainersRes.json()
            result.gainers = gainersData.slice(0, limit).map((g: Record<string, unknown>) => ({
              symbol: g.symbol,
              name: g.name,
              price: g.price,
              change: g.changesPercentage ? `${(g.changesPercentage as number).toFixed(2)}%` : null
            }))
          }
        }
        
        if (dataType === 'overview' || dataType === 'losers') {
          const losersUrl = `https://financialmodelingprep.com/api/v3/stock_market/losers?apikey=${FMP_API_KEY}`
          const losersRes = await fetch(losersUrl)
          if (losersRes.ok) {
            const losersData = await losersRes.json()
            result.losers = losersData.slice(0, limit).map((l: Record<string, unknown>) => ({
              symbol: l.symbol,
              name: l.name,
              price: l.price,
              change: l.changesPercentage ? `${(l.changesPercentage as number).toFixed(2)}%` : null
            }))
          }
        }
        
        if (dataType === 'overview' || dataType === 'actives') {
          const activesUrl = `https://financialmodelingprep.com/api/v3/stock_market/actives?apikey=${FMP_API_KEY}`
          const activesRes = await fetch(activesUrl)
          if (activesRes.ok) {
            const activesData = await activesRes.json()
            result.most_active = activesData.slice(0, limit).map((a: Record<string, unknown>) => ({
              symbol: a.symbol,
              name: a.name,
              price: a.price,
              change: a.changesPercentage ? `${(a.changesPercentage as number).toFixed(2)}%` : null,
              volume: a.volume
            }))
          }
        }
        
        return result
      } catch (error) {
        return { error: `Failed to fetch market data: ${error}` }
      }
    }

    case "get_financial_calendar": {
      const FMP_API_KEY = getEnvVar('FMP_API_KEY')
      const calendarType = args.calendar_type as string
      const symbol = args.symbol as string | undefined
      const daysAhead = Math.min((args.days_ahead as number) || 7, 30)
      
      if (!FMP_API_KEY) return { error: 'FMP API key not configured' }
      
      const today = new Date()
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + daysAhead)
      
      const fromStr = today.toISOString().split('T')[0]
      const toStr = endDate.toISOString().split('T')[0]
      
      const result: Record<string, unknown> = { from: fromStr, to: toStr, calendar_type: calendarType }
      
      try {
        if (calendarType === 'earnings' || calendarType === 'both') {
          const earningsUrl = symbol
            ? `https://financialmodelingprep.com/api/v3/historical/earning_calendar/${symbol.toUpperCase()}?apikey=${FMP_API_KEY}`
            : `https://financialmodelingprep.com/api/v3/earning_calendar?from=${fromStr}&to=${toStr}&apikey=${FMP_API_KEY}`
          
          const earningsRes = await fetch(earningsUrl)
          if (earningsRes.ok) {
            const earningsData = await earningsRes.json()
            result.earnings = earningsData.slice(0, 20).map((e: Record<string, unknown>) => ({
              symbol: e.symbol,
              date: e.date,
              time: e.time || 'TBD',
              eps_estimate: e.epsEstimated,
              revenue_estimate: e.revenueEstimated
            }))
          }
        }
        
        if (calendarType === 'economic' || calendarType === 'both') {
          const econUrl = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${fromStr}&to=${toStr}&apikey=${FMP_API_KEY}`
          const econRes = await fetch(econUrl)
          if (econRes.ok) {
            const econData = await econRes.json()
            const majorEvents = econData.filter((e: Record<string, unknown>) => 
              e.impact === 'High' || e.impact === 'Medium' ||
              (e.event as string)?.includes('CPI') ||
              (e.event as string)?.includes('Fed') ||
              (e.event as string)?.includes('GDP') ||
              (e.event as string)?.includes('Employment') ||
              (e.event as string)?.includes('Payroll')
            )
            result.economic_events = majorEvents.slice(0, 15).map((e: Record<string, unknown>) => ({
              date: e.date,
              event: e.event,
              country: e.country,
              impact: e.impact,
              previous: e.previous,
              estimate: e.estimate
            }))
          }
        }
        
        return result
      } catch (error) {
        return { error: `Failed to fetch calendar data: ${error}` }
      }
    }

    // ========================================================================
    // ASSET LOOKUP & FUNDAMENTALS
    // ========================================================================

    case "search_assets": {
      const searchQuery = args.query as string
      let dbQuery = supabase
        .from('assets')
        .select('asset_id, symbol, name, asset_type, sector, industry')
        .eq('is_active', true)
        .or(`symbol.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
        .limit(10)
      
      if (args.asset_type) {
        dbQuery = dbQuery.eq('asset_type', args.asset_type)
      }
      
      const { data, error } = await dbQuery
      if (error) return { error: error.message }
      return { assets: data || [], count: data?.length || 0, query: searchQuery }
    }

    case "get_asset_fundamentals": {
      const symbol = effectiveTicker
      if (!symbol) return { error: 'No symbol provided' }
      
      // Try equity first
      const { data: equity } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', symbol)
        .single()
      
      if (equity) return { fundamentals: equity, asset_type: 'equity' }
      
      // Try crypto
      const { data: crypto } = await supabase
        .from('crypto_metadata')
        .select('*')
        .eq('symbol', symbol)
        .single()
      
      if (crypto) return { fundamentals: crypto, asset_type: 'crypto' }
      
      return { error: `No data found for symbol: ${symbol}` }
    }

    case "get_price_history": {
      let assetId = effectiveAssetId
      
      // If symbol provided, look up asset_id
      if (!assetId && effectiveTicker) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', effectiveTicker)
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const days = Math.min((args.days as number) || 90, 365)
      const { data, error } = await supabase
        .from('daily_bars')
        .select('date, open, high, low, close, volume')
        .eq('asset_id', assetId)
        .order('date', { ascending: false })
        .limit(days)
      
      if (error) return { error: error.message }
      return { bars: data?.reverse() || [], count: data?.length || 0 }
    }

    case "get_technical_indicators": {
      let assetId = effectiveAssetId
      
      if (!assetId && effectiveTicker) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', effectiveTicker)
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const targetDate = args.as_of_date || new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('daily_features')
        .select('*')
        .eq('asset_id', assetId)
        .lte('date', targetDate)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      
      if (error) return { error: error.message }
      return { indicators: data, as_of_date: targetDate }
    }

    // ========================================================================
    // DEEP DIVE TOOLS (Company Chat specialty, now available to both)
    // ========================================================================

    case "get_active_signals": {
      let assetId = effectiveAssetId
      
      if (!assetId && effectiveTicker) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', effectiveTicker)
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const targetDate = args.as_of_date || new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('daily_signal_facts')
        .select('signal_type, direction, strength, evidence')
        .eq('asset_id', assetId)
        .eq('date', targetDate)
        .order('strength', { ascending: false })
      
      if (error) return { error: error.message }
      return { signals: data || [], count: data?.length || 0, as_of_date: targetDate }
    }

    case "get_ai_reviews": {
      let assetId = effectiveAssetId
      
      if (!assetId && effectiveTicker) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', effectiveTicker)
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const limit = (args.limit as number) || 5
      const { data, error } = await supabase
        .from('asset_ai_reviews')
        .select('*')
        .eq('asset_id', assetId)
        .order('as_of_date', { ascending: false })
        .limit(limit)
      
      if (error) return { error: error.message }
      return { reviews: data || [], count: data?.length || 0 }
    }

    case "get_sector_comparison": {
      let assetId = effectiveAssetId
      
      if (!assetId && effectiveTicker) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', effectiveTicker)
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const targetDate = args.as_of_date || new Date().toISOString().split('T')[0]
      
      const { data: asset } = await supabase
        .from('assets')
        .select('asset_type')
        .eq('asset_id', assetId)
        .single()
      
      if (!asset) return { error: 'Asset not found' }
      
      const { data: sectorAssets } = await supabase
        .from('assets')
        .select('asset_id')
        .eq('asset_type', asset.asset_type)
        .eq('is_active', true)
        .limit(500)
      
      const sectorAssetIds = sectorAssets?.map(a => a.asset_id) || []
      
      const { data: sectorStats } = await supabase
        .from('daily_features')
        .select('return_1d, return_5d, return_21d')
        .eq('date', targetDate)
        .in('asset_id', sectorAssetIds)
      
      if (!sectorStats || sectorStats.length === 0) {
        return { error: 'No sector data available' }
      }
      
      const { data: assetFeatures } = await supabase
        .from('daily_features')
        .select('return_1d, return_5d, return_21d')
        .eq('asset_id', assetId)
        .eq('date', targetDate)
        .single()
      
      const avgReturn1d = sectorStats.reduce((sum, s) => sum + (s.return_1d || 0), 0) / sectorStats.length
      const avgReturn5d = sectorStats.reduce((sum, s) => sum + (s.return_5d || 0), 0) / sectorStats.length
      const avgReturn21d = sectorStats.reduce((sum, s) => sum + (s.return_21d || 0), 0) / sectorStats.length
      
      return {
        asset_type: asset.asset_type,
        assets_in_sector: sectorStats.length,
        sector_avg_return_1d: (avgReturn1d * 100).toFixed(2) + '%',
        sector_avg_return_5d: (avgReturn5d * 100).toFixed(2) + '%',
        sector_avg_return_21d: (avgReturn21d * 100).toFixed(2) + '%',
        asset_return_1d: assetFeatures ? (assetFeatures.return_1d * 100).toFixed(2) + '%' : null,
        asset_return_5d: assetFeatures ? (assetFeatures.return_5d * 100).toFixed(2) + '%' : null,
        asset_vs_sector_1d: assetFeatures ? ((assetFeatures.return_1d - avgReturn1d) * 100).toFixed(2) + '%' : null
      }
    }

    case "get_deep_research_report": {
      let assetId = effectiveAssetId
      
      if (!assetId && effectiveTicker) {
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', effectiveTicker)
          .single()
        if (asset) assetId = asset.asset_id
      }
      
      if (!assetId) return { error: 'Asset not found' }
      
      const { data: files, error } = await supabase
        .from('asset_files')
        .select('file_id, file_name, file_path, file_type, description, created_at')
        .eq('asset_id', assetId)
        .eq('file_type', 'deep_research')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) return { error: error.message }
      
      if (!files || files.length === 0) {
        return {
          report_exists: false,
          message: 'No Deep Research Report exists for this company yet.',
          asset_id: assetId
        }
      }
      
      const latestReport = files[0]
      
      try {
        const response = await fetch(latestReport.file_path)
        if (!response.ok) {
          return {
            report_exists: true,
            file_name: latestReport.file_name,
            created_at: latestReport.created_at,
            error: 'Could not fetch report content.',
            file_url: latestReport.file_path
          }
        }
        
        let content = await response.text()
        const MAX_REPORT_CHARS = 100000
        let wasTruncated = false
        if (content.length > MAX_REPORT_CHARS) {
          content = content.substring(0, MAX_REPORT_CHARS) + '\n\n[REPORT TRUNCATED]'
          wasTruncated = true
        }
        
        return {
          report_exists: true,
          file_name: latestReport.file_name,
          created_at: latestReport.created_at,
          description: latestReport.description,
          truncated: wasTruncated,
          content: content,
          file_url: latestReport.file_path
        }
      } catch {
        return {
          report_exists: true,
          file_name: latestReport.file_name,
          created_at: latestReport.created_at,
          error: 'Failed to fetch report content',
          file_url: latestReport.file_path
        }
      }
    }

    case "get_company_docs": {
      const ticker = effectiveTicker
      if (!ticker) return { error: 'No ticker provided' }
      
      const docType = args.doc_type as string
      const yearsBack = Math.min((args.years_back as number) || 1, 3)
      
      const endDate = new Date()
      const startDate = new Date()
      startDate.setFullYear(startDate.getFullYear() - yearsBack)
      
      const { data: documents, error } = await supabase
        .from('company_documents')
        .select('id, ticker, doc_type, filing_date, fiscal_year, fiscal_quarter, title, full_text, word_count')
        .eq('ticker', ticker)
        .eq('doc_type', docType)
        .eq('status', 'active')
        .gte('filing_date', startDate.toISOString().split('T')[0])
        .order('filing_date', { ascending: false })
        .limit(yearsBack * (docType === '10-K' ? 1 : 4))
      
      if (error) return { error: error.message }
      
      if (!documents || documents.length === 0) {
        return { 
          error: `No ${docType} documents found for ${ticker}.`,
          ticker,
          doc_type: docType
        }
      }
      
      const MAX_CHARS_PER_DOC = 100000
      const MAX_TOTAL_CHARS = 150000
      
      let totalChars = 0
      let wasTruncated = false
      
      const processedDocs = documents.map(d => {
        let text = d.full_text || ''
        const originalLength = text.length
        
        if (totalChars >= MAX_TOTAL_CHARS) {
          text = '[DOCUMENT OMITTED - Memory limit reached.]'
          wasTruncated = true
        } else if (text.length > MAX_CHARS_PER_DOC) {
          text = text.substring(0, MAX_CHARS_PER_DOC) + '\n\n[DOCUMENT TRUNCATED]'
          wasTruncated = true
        } else if (totalChars + text.length > MAX_TOTAL_CHARS) {
          const remainingChars = MAX_TOTAL_CHARS - totalChars
          text = text.substring(0, remainingChars) + '\n\n[DOCUMENT TRUNCATED]'
          wasTruncated = true
        }
        
        totalChars += text.length
        
        return {
          title: d.title,
          filing_date: d.filing_date,
          fiscal_year: d.fiscal_year,
          fiscal_quarter: d.fiscal_quarter,
          word_count: d.word_count,
          content: text
        }
      })
      
      return {
        ticker,
        doc_type: docType,
        documents_found: processedDocs.length,
        total_chars_returned: totalChars,
        truncation_applied: wasTruncated,
        documents: processedDocs
      }
    }

    case "search_company_docs": {
      const ticker = effectiveTicker
      if (!ticker) return { error: 'No ticker provided' }
      
      const searchQuery = args.search_query as string
      const docType = (args.doc_type as string) || 'all'
      const maxResults = Math.min((args.max_results as number) || 10, 20)
      
      const OPENAI_API_KEY = getEnvVar('OPENAI_API_KEY')
      
      if (!OPENAI_API_KEY) {
        // Fallback to full-text search
        const { data: chunks, error } = await supabase
          .from('document_chunks')
          .select('id, content, ticker, doc_type, filing_date, chunk_index')
          .eq('ticker', ticker)
          .textSearch('content', searchQuery.split(' ').join(' & '))
          .limit(maxResults)
        
        if (error) return { error: error.message, fallback_used: 'full_text_search' }
        
        if (!chunks || chunks.length === 0) {
          return {
            error: `No relevant content found for "${searchQuery}" in ${ticker} documents.`,
            ticker,
            search_query: searchQuery
          }
        }
        
        const context = chunks.map((c, i) => 
          `[Result ${i + 1} - ${c.doc_type} ${c.filing_date}]\n${c.content}`
        ).join('\n\n---\n\n')
        
        return {
          ticker,
          search_query: searchQuery,
          results_count: chunks.length,
          search_method: 'full_text_search',
          results: context
        }
      }
      
      try {
        // Generate embedding for search query
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: searchQuery
          })
        })
        
        if (!embeddingResponse.ok) {
          throw new Error(`Embedding API error: ${embeddingResponse.status}`)
        }
        
        const embeddingData = await embeddingResponse.json()
        const queryEmbedding = embeddingData.data[0].embedding
        
        // Search using vector similarity
        let rpcParams: Record<string, unknown> = {
          query_embedding: queryEmbedding,
          match_ticker: ticker,
          match_count: maxResults
        }
        
        if (docType !== 'all') {
          rpcParams.match_doc_type = docType
        }
        
        const { data: matches, error: searchError } = await supabase
          .rpc('match_document_chunks', rpcParams)
        
        if (searchError) throw searchError
        
        if (!matches || matches.length === 0) {
          return {
            error: `No relevant content found for "${searchQuery}" in ${ticker} documents.`,
            ticker,
            search_query: searchQuery
          }
        }
        
        const context = matches.map((m: Record<string, unknown>, i: number) => 
          `[Result ${i + 1} - ${m.doc_type} ${m.filing_date} (Relevance: ${((m.similarity as number) * 100).toFixed(0)}%)]\n${m.content}`
        ).join('\n\n---\n\n')
        
        return {
          ticker,
          search_query: searchQuery,
          results_count: matches.length,
          search_method: 'semantic_search',
          results: context
        }
      } catch (error) {
        return { error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
      }
    }

    case "track_topic_trend": {
      const ticker = effectiveTicker
      if (!ticker) return { error: 'No ticker provided' }
      
      let phrases: string[] = []
      if (Array.isArray(args.search_phrases)) {
        phrases = args.search_phrases as string[]
      } else if (args.search_term) {
        phrases = [args.search_term as string]
      } else {
        return { error: "Missing search_phrases" }
      }
      
      phrases = phrases.map(p => p.trim()).filter(p => p.length > 0)
      if (phrases.length === 0) return { error: "No valid search phrases provided" }
      
      const quartersBack = Math.min((args.quarters_back as number) || 8, 16)
      
      const { data: transcripts, error } = await supabase
        .from('company_documents')
        .select('fiscal_year, fiscal_quarter, filing_date, full_text, title')
        .eq('ticker', ticker)
        .eq('doc_type', 'transcript')
        .eq('status', 'active')
        .order('filing_date', { ascending: false })
        .limit(quartersBack)
      
      if (error) return { error: error.message }
      if (!transcripts || transcripts.length === 0) {
        return { error: `No earnings transcripts found for ${ticker}`, ticker, search_phrases: phrases }
      }
      
      const escapedPhrases = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      const masterRegex = new RegExp(`(${escapedPhrases.join('|')})`, 'gi')
      
      const results = transcripts.map(t => {
        const text = t.full_text || ''
        const matches = text.match(masterRegex) || []
        const count = matches.length
        
        const contexts: string[] = []
        let contextMatch
        let contextCount = 0
        masterRegex.lastIndex = 0
        
        while ((contextMatch = masterRegex.exec(text)) !== null && contextCount < 3) {
          const start = Math.max(0, contextMatch.index - 80)
          const end = Math.min(text.length, contextMatch.index + contextMatch[0].length + 80)
          const snippet = text.substring(start, end).replace(/\n/g, ' ')
          contexts.push('...' + snippet + '...')
          contextCount++
        }
        
        return {
          quarter: `Q${t.fiscal_quarter} ${t.fiscal_year}`,
          filing_date: t.filing_date,
          mention_count: count,
          sample_contexts: contexts
        }
      })
      
      const counts = results.map(r => r.mention_count)
      const avgMentions = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
      const recentAvg = counts.slice(0, Math.min(2, counts.length)).reduce((a, b) => a + b, 0) / Math.min(2, counts.length)
      const olderAvg = counts.slice(-Math.min(2, counts.length)).reduce((a, b) => a + b, 0) / Math.min(2, counts.length)
      const trendDirection = recentAvg > olderAvg * 1.2 ? 'INCREASING' : recentAvg < olderAvg * 0.8 ? 'DECREASING' : 'STABLE'
      
      return {
        ticker,
        search_phrases: phrases,
        quarters_analyzed: results.length,
        trend_direction: trendDirection,
        average_mentions_per_quarter: avgMentions.toFixed(1),
        recent_vs_older_ratio: olderAvg > 0 ? (recentAvg / olderAvg).toFixed(2) : 'N/A',
        quarterly_breakdown: results,
        insight: `The topics [${phrases.join(', ')}] were mentioned an average of ${avgMentions.toFixed(1)} times per quarter. Trend is ${trendDirection}.`
      }
    }

    case "analyze_management_tone": {
      const ticker = effectiveTicker
      if (!ticker) return { error: 'No ticker provided' }
      
      const quartersToCompare = Math.min((args.quarters_to_compare as number) || 4, 8)
      
      const { data: transcripts, error } = await supabase
        .from('company_documents')
        .select('fiscal_year, fiscal_quarter, filing_date, full_text, title')
        .eq('ticker', ticker)
        .eq('doc_type', 'transcript')
        .eq('status', 'active')
        .order('filing_date', { ascending: false })
        .limit(quartersToCompare)
      
      if (error) return { error: error.message }
      if (!transcripts || transcripts.length < 2) {
        return { error: `Need at least 2 transcripts for tone comparison. Found ${transcripts?.length || 0} for ${ticker}`, ticker }
      }
      
      const uncertaintyWords = ['hopefully', 'might', 'maybe', 'uncertain', 'challenging', 'difficult', 'concerned', 'worried', 'cautious', 'headwinds']
      const confidenceWords = ['confident', 'strong', 'excellent', 'outstanding', 'record', 'momentum', 'accelerating', 'excited', 'optimistic', 'committed']
      const forwardLookingPositive = ['will deliver', 'will achieve', 'expect to grow', 'on track', 'well positioned']
      const forwardLookingNegative = ['hope to', 'trying to', 'working on', 'attempting']
      
      const analyzeText = (text: string) => {
        const lowerText = text.toLowerCase()
        const wordCount = text.split(/\s+/).length
        
        const countMatches = (patterns: string[]) => 
          patterns.reduce((sum, p) => sum + (lowerText.match(new RegExp(p, 'gi')) || []).length, 0)
        
        return {
          word_count: wordCount,
          uncertainty_score: countMatches(uncertaintyWords),
          confidence_score: countMatches(confidenceWords),
          forward_positive: countMatches(forwardLookingPositive),
          forward_negative: countMatches(forwardLookingNegative),
          uncertainty_per_1k: (countMatches(uncertaintyWords) / wordCount * 1000).toFixed(2),
          confidence_per_1k: (countMatches(confidenceWords) / wordCount * 1000).toFixed(2)
        }
      }
      
      const analyses = transcripts.map(t => {
        const fyShort = String(t.fiscal_year).slice(-2)
        return {
          quarter: `Q${t.fiscal_quarter} FY${fyShort}`,
          earnings_call_date: t.filing_date,
          fiscal_year: t.fiscal_year,
          fiscal_quarter: t.fiscal_quarter,
          ...analyzeText(t.full_text || '')
        }
      })
      
      const mostRecent = analyses[0]
      const previousAvg = {
        uncertainty_per_1k: analyses.slice(1).reduce((s, a) => s + parseFloat(a.uncertainty_per_1k), 0) / (analyses.length - 1),
        confidence_per_1k: analyses.slice(1).reduce((s, a) => s + parseFloat(a.confidence_per_1k), 0) / (analyses.length - 1)
      }
      
      const uncertaintyChange = ((parseFloat(mostRecent.uncertainty_per_1k) - previousAvg.uncertainty_per_1k) / previousAvg.uncertainty_per_1k * 100).toFixed(1)
      const confidenceChange = ((parseFloat(mostRecent.confidence_per_1k) - previousAvg.confidence_per_1k) / previousAvg.confidence_per_1k * 100).toFixed(1)
      
      let toneShift = 'NEUTRAL'
      if (parseFloat(confidenceChange) > 15 && parseFloat(uncertaintyChange) < -10) toneShift = 'MORE CONFIDENT'
      else if (parseFloat(uncertaintyChange) > 15 && parseFloat(confidenceChange) < -10) toneShift = 'MORE CAUTIOUS'
      else if (parseFloat(confidenceChange) > 10) toneShift = 'SLIGHTLY MORE CONFIDENT'
      else if (parseFloat(uncertaintyChange) > 10) toneShift = 'SLIGHTLY MORE CAUTIOUS'
      
      return {
        ticker,
        quarters_analyzed: analyses.length,
        tone_shift: toneShift,
        most_recent_quarter: mostRecent.quarter,
        confidence_change_pct: confidenceChange + '%',
        uncertainty_change_pct: uncertaintyChange + '%',
        quarterly_analysis: analyses,
        methodology: 'Linguistic pattern analysis comparing frequency of confidence vs uncertainty language per 1000 words',
        insight: `Management tone in ${mostRecent.quarter} is ${toneShift} compared to previous ${analyses.length - 1} quarters.`
      }
    }

    // ========================================================================
    // VALUATION TOOLS
    // ========================================================================

    case "run_valuation_model": {
      const ticker = effectiveTicker
      if (!ticker) return { error: 'No ticker provided' }
      
      const modelType = args.model_type as string
      const customGrowthRate = args.growth_rate as number | undefined
      const discountRate = (args.discount_rate as number) || 0.10
      const terminalGrowth = (args.terminal_growth as number) || 0.025
      
      const { data: metadata, error: metaError } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', ticker)
        .single()
      
      if (metaError || !metadata) {
        return { error: `Could not find fundamental data for ${ticker}` }
      }
      
      const { data: quarterlies } = await supabase
        .from('equity_quarterly_fundamentals')
        .select('fiscal_date_ending, total_revenue, net_income, free_cash_flow, operating_cashflow, eps_diluted, ebitda, ebit, capital_expenditures')
        .eq('asset_id', metadata.asset_id)
        .order('fiscal_date_ending', { ascending: false })
        .limit(8)
      
      const { data: latestBar } = await supabase
        .from('daily_bars')
        .select('close')
        .eq('asset_id', metadata.asset_id)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      
      const currentPrice = latestBar?.close || 0
      const sharesOutstanding = metadata.shares_outstanding || 0
      const marketCap = currentPrice * sharesOutstanding
      
      let growthRate = customGrowthRate
      if (!growthRate && quarterlies && quarterlies.length >= 4) {
        const recentRevenue = quarterlies.slice(0, 4).reduce((s, q) => s + (q.total_revenue || 0), 0)
        const olderRevenue = quarterlies.slice(4, 8).reduce((s, q) => s + (q.total_revenue || 0), 0)
        if (olderRevenue > 0) {
          growthRate = (recentRevenue - olderRevenue) / olderRevenue
        }
      }
      growthRate = growthRate || 0.05
      
      const results: Record<string, unknown> = {
        ticker,
        current_price: currentPrice.toFixed(2),
        market_cap_billions: (marketCap / 1e9).toFixed(2),
        shares_outstanding_millions: (sharesOutstanding / 1e6).toFixed(1),
        assumptions: {
          growth_rate: (growthRate * 100).toFixed(1) + '%',
          discount_rate: (discountRate * 100).toFixed(1) + '%',
          terminal_growth: (terminalGrowth * 100).toFixed(1) + '%'
        }
      }
      
      if (modelType === 'dcf' || modelType === 'both') {
        const ttmOCF = quarterlies?.slice(0, 4).reduce((s, q) => s + (q.operating_cashflow || 0), 0) || 0
        const ttmCapex = Math.abs(quarterlies?.slice(0, 4).reduce((s, q) => s + (q.capital_expenditures || 0), 0) || 0)
        const ttmDA = quarterlies?.slice(0, 4).reduce((s, q) => s + ((q.ebitda || 0) - (q.ebit || 0)), 0) || 0
        
        const standardFCF = ttmOCF - ttmCapex
        const ownerEarnings = ttmOCF - Math.abs(ttmDA)
        const capexToDA = ttmDA > 0 ? ttmCapex / ttmDA : 0
        const isHighGrowthReinvestor = capexToDA > 1.5
        const usedFCF = isHighGrowthReinvestor ? ownerEarnings : standardFCF
        const methodUsed = isHighGrowthReinvestor ? 'Owner Earnings (Adj. for Growth CapEx)' : 'Standard Unlevered FCF'
        
        const projectedFCFs = []
        let fcf = usedFCF
        for (let i = 1; i <= 5; i++) {
          fcf = fcf * (1 + growthRate)
          projectedFCFs.push(fcf)
        }
        
        const terminalFCF = projectedFCFs[4] * (1 + terminalGrowth)
        const terminalValue = terminalFCF / (discountRate - terminalGrowth)
        
        let pvFCFs = 0
        for (let i = 0; i < 5; i++) {
          pvFCFs += projectedFCFs[i] / Math.pow(1 + discountRate, i + 1)
        }
        const pvTerminal = terminalValue / Math.pow(1 + discountRate, 5)
        
        const enterpriseValue = pvFCFs + pvTerminal
        const equityValue = enterpriseValue
        const fairValuePerShare = equityValue / sharesOutstanding
        const upside = ((fairValuePerShare - currentPrice) / currentPrice * 100)
        
        results.dcf_model = {
          methodology: methodUsed,
          ttm_operating_cash_flow_millions: (ttmOCF / 1e6).toFixed(1),
          ttm_capex_millions: (ttmCapex / 1e6).toFixed(1),
          ttm_depreciation_amortization_millions: (Math.abs(ttmDA) / 1e6).toFixed(1),
          capex_to_da_ratio: capexToDA.toFixed(2) + 'x',
          starting_cash_flow_millions: (usedFCF / 1e6).toFixed(1),
          projected_fcf_year5_millions: (projectedFCFs[4] / 1e6).toFixed(1),
          terminal_value_billions: (terminalValue / 1e9).toFixed(2),
          enterprise_value_billions: (enterpriseValue / 1e9).toFixed(2),
          fair_value_per_share: fairValuePerShare.toFixed(2),
          upside_downside_pct: upside.toFixed(1) + '%',
          verdict: upside > 20 ? 'UNDERVALUED' : upside < -20 ? 'OVERVALUED' : 'FAIRLY VALUED'
        }
      }
      
      if (modelType === 'comps' || modelType === 'both') {
        const pe = metadata.pe_ratio || metadata.trailing_pe
        const ps = metadata.price_to_sales_ttm
        const evEbitda = metadata.ev_to_ebitda
        
        const industryPE = 20
        const industryPS = 3
        const industryEVEBITDA = 12
        
        const peImpliedValue = pe ? currentPrice * (industryPE / pe) : null
        const psImpliedValue = ps ? currentPrice * (industryPS / ps) : null
        const evImpliedValue = evEbitda ? currentPrice * (industryEVEBITDA / evEbitda) : null
        
        const validValues = [peImpliedValue, psImpliedValue, evImpliedValue].filter(v => v !== null) as number[]
        const avgImpliedValue = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : null
        
        results.comps_model = {
          current_pe: pe?.toFixed(1) || 'N/A',
          current_ps: ps?.toFixed(2) || 'N/A',
          current_ev_ebitda: evEbitda?.toFixed(1) || 'N/A',
          industry_avg_pe: industryPE,
          industry_avg_ps: industryPS,
          industry_avg_ev_ebitda: industryEVEBITDA,
          pe_implied_value: peImpliedValue?.toFixed(2) || 'N/A',
          ps_implied_value: psImpliedValue?.toFixed(2) || 'N/A',
          ev_ebitda_implied_value: evImpliedValue?.toFixed(2) || 'N/A',
          average_implied_value: avgImpliedValue?.toFixed(2) || 'N/A',
          upside_downside_pct: avgImpliedValue ? ((avgImpliedValue - currentPrice) / currentPrice * 100).toFixed(1) + '%' : 'N/A'
        }
      }
      
      return results
    }

    case "generate_scenario_matrix": {
      const ticker = effectiveTicker
      if (!ticker) return { error: 'No ticker provided' }
      
      const metric = args.metric as string
      const variable1 = args.variable_1 as string
      const variable2 = args.variable_2 as string
      const rangePct = (args.range_pct as number) || 20
      
      const { data: metadata } = await supabase
        .from('equity_metadata')
        .select('*')
        .eq('symbol', ticker)
        .single()
      
      if (!metadata) return { error: `Could not find data for ${ticker}` }
      
      const { data: latestBar } = await supabase
        .from('daily_bars')
        .select('close')
        .eq('asset_id', metadata.asset_id)
        .order('date', { ascending: false })
        .limit(1)
        .single()
      
      const currentPrice = latestBar?.close || 0
      const eps = metadata.eps || 1
      const revenue = metadata.revenue_ttm || 1e9
      const fcf = metadata.free_cash_flow || 1e8
      const margin = metadata.profit_margin || 0.1
      const pe = metadata.pe_ratio || 20
      
      const baseValues: Record<string, number> = {
        revenue_growth: 0.10,
        margin: margin,
        multiple: pe,
        discount_rate: 0.10
      }
      
      const steps = [-rangePct, -rangePct/2, 0, rangePct/2, rangePct]
      
      const calculateMetric = (v1Val: number, v2Val: number): number => {
        const adjRevGrowth = variable1 === 'revenue_growth' ? v1Val : (variable2 === 'revenue_growth' ? v2Val : baseValues.revenue_growth)
        const adjMargin = variable1 === 'margin' ? v1Val : (variable2 === 'margin' ? v2Val : baseValues.margin)
        const adjMultiple = variable1 === 'multiple' ? v1Val : (variable2 === 'multiple' ? v2Val : baseValues.multiple)
        
        const projRevenue = revenue * (1 + adjRevGrowth)
        const projEarnings = projRevenue * adjMargin
        const projEPS = projEarnings / (metadata.shares_outstanding || 1)
        
        switch (metric) {
          case 'eps': return projEPS
          case 'fair_value': return projEPS * adjMultiple
          case 'revenue': return projRevenue / 1e9
          case 'fcf': return projRevenue * adjMargin * 0.8 / 1e9
          default: return projEPS
        }
      }
      
      const matrix: string[][] = []
      const v1Label = variable1.replace('_', ' ').toUpperCase()
      const v2Label = variable2.replace('_', ' ').toUpperCase()
      
      // Header row
      const headerRow = [v1Label + ' \\ ' + v2Label]
      for (const step of steps) {
        const v2Val = baseValues[variable2] * (1 + step/100)
        headerRow.push(variable2 === 'multiple' ? v2Val.toFixed(1) + 'x' : (v2Val * 100).toFixed(0) + '%')
      }
      matrix.push(headerRow)
      
      // Data rows
      for (const v1Step of steps) {
        const v1Val = baseValues[variable1] * (1 + v1Step/100)
        const row = [variable1 === 'multiple' ? v1Val.toFixed(1) + 'x' : (v1Val * 100).toFixed(0) + '%']
        
        for (const v2Step of steps) {
          const v2Val = baseValues[variable2] * (1 + v2Step/100)
          const result = calculateMetric(v1Val, v2Val)
          row.push(metric === 'eps' || metric === 'fair_value' ? '$' + result.toFixed(2) : result.toFixed(2) + 'B')
        }
        matrix.push(row)
      }
      
      return {
        ticker,
        metric,
        variable_1: variable1,
        variable_2: variable2,
        current_price: currentPrice.toFixed(2),
        base_values: baseValues,
        matrix,
        insight: `Sensitivity analysis for ${ticker} ${metric.toUpperCase()} varying ${v1Label} and ${v2Label} by ±${rangePct}%`
      }
    }

    // ========================================================================
    // MACRO & INSTITUTIONAL TOOLS
    // ========================================================================

    case "get_macro_context": {
      const days_back = Math.min((args.days_back as number) || 1, 30)
      const focus_sector = args.focus_sector as string | undefined
      
      const { data: macroData, error } = await supabase
        .from('daily_macro_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(days_back)
      
      if (error || !macroData || macroData.length === 0) {
        return { error: 'No macro data available' }
      }
      
      const latest = macroData[0]
      let sectorData: Record<string, number> = {}
      try {
        sectorData = typeof latest.sector_rotation === 'string' 
          ? JSON.parse(latest.sector_rotation) 
          : latest.sector_rotation || {}
      } catch { /* ignore */ }
      
      const response: Record<string, unknown> = {
        date: latest.date,
        market_regime: latest.market_regime,
        risk_premium: latest.risk_premium,
        rates: {
          us_10y_yield: latest.us10y_yield,
          us_2y_yield: latest.us2y_yield,
          yield_curve_spread: latest.yield_curve_10y_2y,
          yield_curve_status: latest.yield_curve_10y_2y < 0 ? 'INVERTED' : 'Normal'
        },
        commodities: {
          oil_price: latest.oil_close,
          gold_price: latest.gold_close,
          copper_price: latest.copper_close
        },
        inflation: {
          cpi_yoy: latest.cpi_yoy,
          status: latest.cpi_yoy > 3 ? 'Hot' : latest.cpi_yoy < 2 ? 'Cool' : 'Target Range'
        },
        market_breadth: {
          spy_price: latest.spy_close,
          spy_change_pct: latest.spy_change_pct,
          breadth_rating: latest.breadth_rating
        },
        sector_rotation: sectorData,
        leading_sectors: Object.entries(sectorData)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([sector, change]) => ({ sector, change_pct: change })),
        lagging_sectors: Object.entries(sectorData)
          .sort(([,a], [,b]) => (a as number) - (b as number))
          .slice(0, 3)
          .map(([sector, change]) => ({ sector, change_pct: change }))
      }
      
      if (focus_sector && sectorData[focus_sector] !== undefined) {
        response.focus_sector_analysis = {
          sector: focus_sector,
          performance_today: sectorData[focus_sector],
          relative_rank: Object.values(sectorData).filter((v) => (v as number) > sectorData[focus_sector]).length + 1
        }
      }
      
      return response
    }

    case "get_institutional_flows": {
      const FMP_API_KEY = getEnvVar('FMP_API_KEY')
      const symbol = effectiveTicker
      if (!symbol) return { error: 'No symbol provided' }
      
      const lookback_quarters = Math.min((args.lookback_quarters as number) || 2, 4)
      
      if (!FMP_API_KEY) return { error: 'FMP API key not configured' }
      
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      
      let year = currentYear
      let quarter = Math.floor(currentMonth / 3) + 1
      
      quarter -= 2
      if (quarter <= 0) { quarter += 4; year -= 1 }
      
      const quarters: Array<{year: number, quarter: number}> = []
      for (let i = 0; i < lookback_quarters; i++) {
        quarters.push({ year, quarter })
        if (quarter === 1) { year -= 1; quarter = 4 } else { quarter -= 1 }
      }
      
      const quarterlyData = []
      for (const { year, quarter } of quarters) {
        const url = `https://financialmodelingprep.com/stable/institutional-ownership/symbol-positions-summary?symbol=${symbol}&year=${year}&quarter=${quarter}&apikey=${FMP_API_KEY}`
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            quarterlyData.push({ ...data[0], year, quarter })
          }
        }
      }
      
      if (quarterlyData.length === 0) {
        return { error: `No institutional data for ${symbol}` }
      }
      
      const latest = quarterlyData[0]
      const flow_trend = latest.investorsHoldingChange > 10 ? 'Accumulation' : latest.investorsHoldingChange < -10 ? 'Distribution' : 'Neutral'
      
      return {
        symbol,
        quarter: `Q${latest.quarter} ${latest.year}`,
        holders: { total: latest.investorsHolding, change: latest.investorsHoldingChange },
        ownership: { percent: latest.ownershipPercent, change_pct: latest.ownershipPercentChange },
        position_changes: {
          new_positions: latest.newPositions,
          increased_positions: latest.increasedPositions,
          closed_positions: latest.closedPositions,
          reduced_positions: latest.reducedPositions
        },
        flow_analysis: {
          trend: flow_trend,
          interpretation: flow_trend === 'Accumulation' ? 'BULLISH: Institutions are buying' : flow_trend === 'Distribution' ? 'BEARISH: Institutions are selling' : 'Neutral positioning'
        }
      }
    }

    // ========================================================================
    // UTILITY TOOLS
    // ========================================================================

    case "perform_grounded_research": {
      const result = await executeGroundedSearch(args.query as string)
      return { research_summary: result }
    }

    case "execute_python": {
      const code = args.code as string
      const purpose = args.purpose as string
      
      // Handle data_context pre-loading
      let currentCode = code
      const dataContext = args.data_context as { type?: string; asset_id?: number; ticker?: string; days?: number } | undefined
      
      if (dataContext) {
        let csvData = ''
        
        if (dataContext.type === 'price_history' && (dataContext.asset_id || effectiveAssetId)) {
          const assetId = dataContext.asset_id || effectiveAssetId
          const days = dataContext.days || 365
          
          const { data: bars, error } = await supabase
            .from('daily_bars')
            .select('date, open, high, low, close, volume')
            .eq('asset_id', assetId)
            .order('date', { ascending: false })
            .limit(days)
          
          if (!error && bars && bars.length > 0) {
            const keys = Object.keys(bars[0])
            const headers = keys.join(',')
            const rows = bars.map(b => keys.map(k => JSON.stringify(b[k as keyof typeof b] ?? '')).join(',')).join('\n')
            csvData = headers + '\n' + rows
          }
        } else if (dataContext.type === 'fundamentals' && (dataContext.ticker || effectiveTicker)) {
          const ticker = dataContext.ticker || effectiveTicker
          
          const { data: fundData, error } = await supabase
            .from('equity_quarterly_fundamentals')
            .select('*')
            .eq('ticker', ticker)
            .order('period_end_date', { ascending: false })
            .limit(20)
          
          if (!error && fundData && fundData.length > 0) {
            const keys = Object.keys(fundData[0])
            const headers = keys.join(',')
            const rows = fundData.map(f => keys.map(k => JSON.stringify(f[k as keyof typeof f] ?? '')).join(',')).join('\n')
            csvData = headers + '\n' + rows
          }
        }
        
        if (csvData) {
          const dataLoadingCode = `
# AUTO-GENERATED: Data pre-loaded from database
import pandas as pd
import io

_csv_data = """${csvData}"""

df = pd.read_csv(io.StringIO(_csv_data))
if 'date' in df.columns:
    df['date'] = pd.to_datetime(df['date'])
print(f"✅ Data loaded: {len(df)} rows, columns: {list(df.columns)}")

# --- USER CODE STARTS HERE ---
`
          currentCode = dataLoadingCode + currentCode
        }
      }
      
      return { execution_result: await executePythonCode(currentCode, purpose) }
    }

    case "generate_dynamic_ui": {
      return {
        ui_component: {
          componentType: args.componentType,
          title: args.title,
          data: args.data,
          insight: args.insight || null
        },
        render_instruction: "FRONTEND_RENDER"
      }
    }

    case "create_and_export_document": {
      const SUPABASE_URL = getEnvVar('SUPABASE_URL')
      const SUPABASE_SERVICE_KEY = getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
      
      const title = args.title as string
      const documentType = args.document_type as string
      const content = args.content as string
      const exportFormat = args.export_format as string
      const assetId = args.asset_id as number || effectiveAssetId
      
      try {
        const timestamp = Date.now()
        const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')
        const fileName = `${safeTitle}_${timestamp}.md`
        
        // Determine storage path based on context
        const storagePath = assetId 
          ? `asset_${assetId}/chat_exports/${fileName}`
          : `global_chat_exports/${fileName}`
        
        const storageClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        const { data: uploadData, error: uploadError } = await storageClient.storage
          .from('asset-files')
          .upload(storagePath, new Blob([content], { type: 'text/markdown' }), {
            contentType: 'text/markdown',
            upsert: true
          })
        
        if (uploadError) {
          console.error('Storage upload error:', uploadError)
        }
        
        let markdownUrl: string | null = null
        if (uploadData) {
          const { data: urlData } = storageClient.storage
            .from('asset-files')
            .getPublicUrl(storagePath)
          markdownUrl = urlData?.publicUrl || null
        }
        
        return {
          document_created: {
            success: true,
            title,
            document_type: documentType,
            markdown_url: markdownUrl,
            message: `Document "${title}" created successfully.`
          },
          download_data: {
            title,
            content,
            markdown_url: markdownUrl,
            export_format: exportFormat
          }
        }
      } catch (error) {
        console.error('Document creation error:', error)
        return {
          document_created: {
            success: true,
            title,
            document_type: documentType,
            message: `Document "${title}" created. Download available.`
          },
          download_data: {
            title,
            content,
            export_format: exportFormat
          }
        }
      }
    }

    default:
      return { error: `Unknown function: ${name}` }
  }
}

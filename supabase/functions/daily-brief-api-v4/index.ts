// Daily Brief API v4 - Optimized for speed with better error handling
// Parallel fetching, shorter timeouts, graceful degradation

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
}

// Types
interface PortfolioHolding {
  asset_id: number
  symbol: string
  name: string
  action: "ADD" | "TRIM" | "HOLD"
  price: number
  ai_direction: number | string
  rsi: number
  setup: string
  news: string
  catalysts: string
  asset_url: string
}

interface MarketTicker {
  spy_change: number
  qqq_change: number
  iwm_change: number
  yield_10y: number
  btc_change: number
  vix: number
  regime: string
}

interface IntelItem {
  category: string
  headline: string
  impact: string
  url: string
  source: string
  date: string
}

// RSS Feeds
const RSS_FEEDS = [
  { url: 'https://www.marketwatch.com/rss/topstories', source: 'MarketWatch' },
  { url: 'https://seekingalpha.com/market_currents.xml', source: 'Seeking Alpha' },
]

// Fetch with timeout helper
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 5000): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    return response
  } catch (e) {
    clearTimeout(timeout)
    console.log(`[DailyBrief v4] Fetch timeout for ${url}`)
    return null
  }
}

// Fetch RSS feed
async function fetchRSSFeed(url: string, source: string): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StratosBrain/1.0)' }
    }, 4000)
    
    if (!response || !response.ok) return []
    
    const xml = await response.text()
    const items: any[] = []
    
    // Simple regex parsing
    const itemRegex = /<item>(.*?)<\/item>/gs
    const titleRegex = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i
    const linkRegex = /<link>(.*?)<\/link>/i
    const descRegex = /<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is
    
    let match
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const content = match[1]
      const title = titleRegex.exec(content)?.[1]?.trim()
      const link = linkRegex.exec(content)?.[1]?.trim()
      const desc = descRegex.exec(content)?.[1]?.replace(/<[^>]+>/g, '').trim()
      
      if (title) items.push({ title, link, source, description: desc })
    }
    
    return items
  } catch (e) {
    console.log(`[DailyBrief v4] RSS fetch error for ${source}:`, e)
    return []
  }
}

// Fetch all RSS in parallel
async function fetchAllRSS(): Promise<any[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(f => fetchRSSFeed(f.url, f.source))
  )
  
  const items: any[] = []
  results.forEach(r => {
    if (r.status === 'fulfilled') items.push(...r.value)
  })
  
  return items.slice(0, 10)
}

// Generate intel from RSS
function generateIntelFromRSS(rssItems: any[]): IntelItem[] {
  const categories = ['ECON', 'TECH', 'EARNINGS', 'GEOPOL', 'POLICY', 'CRYPTO']
  return rssItems.slice(0, 8).map((item, i) => ({
    category: categories[i % categories.length],
    headline: item.title?.slice(0, 100) || 'Market Update',
    impact: item.description?.slice(0, 150) || 'Market news and analysis',
    url: item.link || '',
    source: item.source || 'News',
    date: new Date().toISOString()
  }))
}

// Call Gemini with timeout
async function callGeminiWithTimeout(query: string, timeoutMs = 12000): Promise<{ text: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    console.log('[DailyBrief v4] GEMINI_API_KEY not set')
    return { text: 'AI insights unavailable' }
  }
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: query }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        }),
        signal: controller.signal
      }
    )
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      console.log(`[DailyBrief v4] Gemini API error: ${response.status}`)
      return { text: 'AI insights temporarily unavailable' }
    }
    
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || 'No insights available'
    return { text }
  } catch (e) {
    clearTimeout(timeout)
    console.log('[DailyBrief v4] Gemini timeout or error:', e)
    return { text: 'AI insights loading...' }
  }
}

// Generate morning intel in parallel
async function generateMorningIntel() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  
  const queries = [
    { key: 'market_pulse', query: `Today is ${today}. Give a brief 2-3 sentence market pulse: S&P 500 futures, key levels to watch, overall sentiment.` },
    { key: 'macro_calendar', query: `Today is ${today}. List the key economic events and earnings releases scheduled for today in 2-3 sentences.` },
    { key: 'liquidity_flows', query: `Today is ${today}. Brief 2-3 sentence summary of: 10Y Treasury yield trend, DXY dollar index, and any notable fund flows.` },
  ]
  
  const results = await Promise.all(
    queries.map(q => callGeminiWithTimeout(q.query, 10000))
  )
  
  const intel: any = { generated_at: new Date().toISOString() }
  queries.forEach((q, i) => {
    intel[q.key] = results[i].text
  })
  
  return intel
}

// Fetch portfolio holdings with better error handling
async function fetchPortfolioHoldings(supabase: SupabaseClient): Promise<PortfolioHolding[]> {
  try {
    console.log('[DailyBrief v4] Fetching portfolio holdings...')
    
    const { data: holdings, error: holdingsError } = await supabase
      .from('core_portfolio_holdings')
      .select('asset_id, cost_basis, assets!inner(symbol, name, asset_type)')
      .eq('is_active', true)
      .limit(20)
    
    if (holdingsError) {
      console.log('[DailyBrief v4] Holdings query error:', holdingsError.message)
      return []
    }
    
    if (!holdings || holdings.length === 0) {
      console.log('[DailyBrief v4] No active holdings found')
      return []
    }
    
    console.log(`[DailyBrief v4] Found ${holdings.length} holdings`)
    
    const enriched: PortfolioHolding[] = []
    
    // Process holdings in parallel batches
    const enrichmentPromises = holdings.slice(0, 10).map(async (h) => {
      const asset = h.assets as any
      
      try {
        const [assetResult, setupResult] = await Promise.all([
          supabase.from('mv_dashboard_all_assets')
            .select('ai_direction_score, rsi_14')
            .eq('asset_id', h.asset_id)
            .single(),
          supabase.from('setup_signals')
            .select('setup_name')
            .eq('asset_id', h.asset_id)
            .order('signal_date', { ascending: false })
            .limit(1)
            .maybeSingle()
        ])
        
        const assetData = assetResult.data
        const setupData = setupResult.data
        
        const rsi = assetData?.rsi_14 || 50
        return {
          asset_id: h.asset_id,
          symbol: asset.symbol,
          name: asset.name?.slice(0, 25) || asset.symbol,
          action: rsi > 70 ? 'TRIM' : rsi < 30 ? 'ADD' : 'HOLD',
          price: h.cost_basis || 0,
          ai_direction: assetData?.ai_direction_score ?? 'N/A',
          rsi: Math.round(rsi),
          setup: setupData?.setup_name?.replace(/_/g, ' ') || 'No Setup',
          news: '',
          catalysts: '',
          asset_url: `/asset/${h.asset_id}`
        } as PortfolioHolding
      } catch (e) {
        console.log(`[DailyBrief v4] Error enriching holding ${h.asset_id}:`, e)
        return {
          asset_id: h.asset_id,
          symbol: asset.symbol,
          name: asset.name?.slice(0, 25) || asset.symbol,
          action: 'HOLD',
          price: h.cost_basis || 0,
          ai_direction: 'N/A',
          rsi: 50,
          setup: 'No Setup',
          news: '',
          catalysts: '',
          asset_url: `/asset/${h.asset_id}`
        } as PortfolioHolding
      }
    })
    
    const results = await Promise.all(enrichmentPromises)
    return results.filter(r => r !== null) as PortfolioHolding[]
    
  } catch (e) {
    console.log('[DailyBrief v4] Portfolio fetch error:', e)
    return []
  }
}

// Fetch market ticker with better error handling
async function fetchMarketTicker(supabase: SupabaseClient): Promise<MarketTicker> {
  try {
    console.log('[DailyBrief v4] Fetching market ticker...')
    
    const { data: macro, error } = await supabase
      .from('daily_macro_metrics')
      .select('spy_change_pct, qqq_change_pct, iwm_change_pct, us10y_yield, btc_change_pct, vix_close, market_regime')
      .order('date', { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      console.log('[DailyBrief v4] Macro query error:', error.message)
      throw new Error('No macro data')
    }
    
    if (!macro) throw new Error('No macro data')
    
    console.log('[DailyBrief v4] Macro data fetched:', macro.market_regime)
    
    return {
      spy_change: macro.spy_change_pct || 0,
      qqq_change: macro.qqq_change_pct || 0,
      iwm_change: macro.iwm_change_pct || 0,
      yield_10y: macro.us10y_yield || 4.26,
      btc_change: macro.btc_change_pct || 0,
      vix: macro.vix_close || 14,
      regime: macro.market_regime || 'NEUTRAL'
    }
  } catch (e) {
    console.log('[DailyBrief v4] Market ticker fallback:', e)
    return {
      spy_change: 0, qqq_change: 0, iwm_change: 0,
      yield_10y: 4.26, btc_change: 0, vix: 14, regime: 'NEUTRAL'
    }
  }
}

// Fetch setup candidates with better error handling
async function fetchSetupCandidates(supabase: SupabaseClient, setupTypes: string[]): Promise<any[]> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const { data: signals, error } = await supabase
      .from('setup_signals')
      .select('id, asset_id, setup_name, assets(symbol, name)')
      .in('setup_name', setupTypes)
      .gte('signal_date', thirtyDaysAgo)
      .order('signal_date', { ascending: false })
      .limit(15)
    
    if (error) {
      console.log('[DailyBrief v4] Setup signals error:', error.message)
      return []
    }
    
    if (!signals || signals.length === 0) return []
    
    // Enrich with AI scores in parallel
    const enriched = await Promise.all(
      signals.slice(0, 10).map(async (s) => {
        try {
          const { data: assetData } = await supabase
            .from('mv_dashboard_all_assets')
            .select('ai_direction_score, setup_purity_score')
            .eq('asset_id', s.asset_id)
            .single()
          
          return {
            symbol: (s.assets as any)?.symbol || 'N/A',
            name: (s.assets as any)?.name || '',
            setup: s.setup_name,
            direction: assetData?.ai_direction_score || 50,
            purity: assetData?.setup_purity_score || 50
          }
        } catch {
          return {
            symbol: (s.assets as any)?.symbol || 'N/A',
            name: (s.assets as any)?.name || '',
            setup: s.setup_name,
            direction: 50,
            purity: 50
          }
        }
      })
    )
    
    return enriched
  } catch (e) {
    console.log('[DailyBrief v4] Setup candidates error:', e)
    return []
  }
}

// Generate picks from candidates
function generatePicks(candidates: any[]): any[] {
  if (candidates.length === 0) return []
  
  // Sort by composite score (direction + purity) / 2
  const sorted = candidates
    .map(c => ({ ...c, score: (c.direction + c.purity) / 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  
  return sorted.map(c => ({
    symbol: c.symbol,
    name: c.name,
    conviction: c.score > 70 ? 'HIGH' : c.score > 55 ? 'MEDIUM' : 'LOW',
    setup_type: c.setup?.replace(/_/g, ' ') || 'Setup',
    one_liner: `${c.setup?.replace(/_/g, ' ')} - Score: ${Math.round(c.score)}`,
    rationale: `Direction: ${Math.round(c.direction)}, Purity: ${Math.round(c.purity)}`
  }))
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('[DailyBrief v4] Starting request...')
    const startTime = Date.now()
    
    // Fetch all data in parallel for speed
    const [marketTicker, portfolioHoldings, rssItems] = await Promise.all([
      fetchMarketTicker(supabase),
      fetchPortfolioHoldings(supabase),
      fetchAllRSS()
    ])
    
    console.log(`[DailyBrief v4] Initial fetch completed in ${Date.now() - startTime}ms`)
    console.log(`[DailyBrief v4] Portfolio: ${portfolioHoldings.length}, RSS: ${rssItems.length}`)
    
    // Generate intel and RSS items in parallel
    const [morningIntel, intelItems] = await Promise.all([
      generateMorningIntel(),
      Promise.resolve(generateIntelFromRSS(rssItems))
    ])
    
    // Match news to holdings
    portfolioHoldings.forEach(h => {
      const match = rssItems.find(r => 
        r.title?.toLowerCase().includes(h.symbol.toLowerCase())
      )
      h.news = match ? `${match.title.slice(0, 80)}...` : ''
    })
    
    // Fetch setups for each category in parallel
    const setupTypes = {
      momentum_breakouts: ['weinstein_stage2_breakout', 'donchian_55_breakout', 'rs_breakout', 'breakout_participation'],
      trend_continuation: ['golden_cross', 'adx_holy_grail', 'acceleration_turn', 'trend_ignition'],
      compression_reversion: ['vcp_squeeze', 'oversold_bounce', 'squeeze_release', 'exhaustion']
    }
    
    const [momentum, trend, compression] = await Promise.all([
      fetchSetupCandidates(supabase, setupTypes.momentum_breakouts),
      fetchSetupCandidates(supabase, setupTypes.trend_continuation),
      fetchSetupCandidates(supabase, setupTypes.compression_reversion)
    ])
    
    const totalTime = Date.now() - startTime
    console.log(`[DailyBrief v4] Complete in ${totalTime}ms`)
    
    const brief = {
      date: new Date().toISOString().split('T')[0],
      market_ticker: marketTicker,
      market_regime: marketTicker.regime,
      macro_summary: `10Y at ${marketTicker.yield_10y}%. VIX at ${marketTicker.vix}.`,
      morning_intel: morningIntel,
      portfolio: portfolioHoldings,
      categories: {
        momentum_breakouts: {
          theme_summary: `${generatePicks(momentum).length} momentum breakout setups detected`,
          picks: generatePicks(momentum)
        },
        trend_continuation: {
          theme_summary: `${generatePicks(trend).length} trend continuation setups detected`,
          picks: generatePicks(trend)
        },
        compression_reversion: {
          theme_summary: `${generatePicks(compression).length} compression/reversion setups detected`,
          picks: generatePicks(compression)
        }
      },
      intel_items: intelItems,
      portfolio_alerts: [],
      action_items: [],
      tokens: { in: 0, out: 0 },
      _meta: {
        generated_at: new Date().toISOString(),
        generation_time_ms: totalTime
      }
    }
    
    return new Response(JSON.stringify(brief), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[DailyBrief v4] Error:', error)
    
    // Return a valid response even on error
    const fallbackBrief = {
      date: new Date().toISOString().split('T')[0],
      market_ticker: { 
        spy_change: 0, qqq_change: 0, iwm_change: 0, 
        yield_10y: 4.26, btc_change: 0, vix: 14, regime: 'NEUTRAL' 
      },
      market_regime: 'NEUTRAL',
      macro_summary: 'Market data temporarily unavailable',
      morning_intel: {
        market_pulse: 'Loading market insights...',
        macro_calendar: 'Loading calendar...',
        liquidity_flows: 'Loading liquidity data...',
        generated_at: new Date().toISOString()
      },
      portfolio: [],
      categories: {
        momentum_breakouts: { theme_summary: 'Loading setups...', picks: [] },
        trend_continuation: { theme_summary: 'Loading setups...', picks: [] },
        compression_reversion: { theme_summary: 'Loading setups...', picks: [] }
      },
      intel_items: [],
      error: error.message,
      _meta: {
        generated_at: new Date().toISOString(),
        error: true
      }
    }
    
    return new Response(JSON.stringify(fallbackBrief), {
      status: 200, // Return 200 even on error to prevent frontend crashes
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

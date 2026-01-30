// Daily Brief API v4 - Optimized for speed with timeouts
// Parallel fetching, shorter timeouts, graceful degradation

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    return null
  }
}

// Fetch RSS feed
async function fetchRSSFeed(url: string, source: string): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
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
  } catch {
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
  return rssItems.slice(0, 6).map((item, i) => ({
    category: ['GEOPOL', 'ECON', 'TECH', 'EARNINGS'][i % 4],
    headline: item.title.slice(0, 80),
    impact: item.description?.slice(0, 100) || 'Market news',
    url: item.link,
    source: item.source,
    date: ''
  }))
}

// Call Gemini with timeout
async function callGeminiWithTimeout(query: string, timeoutMs = 15000): Promise<{ text: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return { text: 'API key not set' }
  
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
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        }),
        signal: controller.signal
      }
    )
    
    clearTimeout(timeout)
    
    if (!response.ok) return { text: 'Search unavailable' }
    
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || 'No results'
    return { text }
  } catch {
    return { text: 'Search timeout' }
  }
}

// Generate morning intel in parallel
async function generateMorningIntel() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  
  const queries = [
    { key: 'market_pulse', query: `${today}. Brief market pulse: futures, VIX, key levels.` },
    { key: 'macro_calendar', query: `${today}. Key events today: economic data, earnings, Fed.` },
    { key: 'liquidity_flows', query: `${today}. Liquidity: 10Y yields, DXY, fund flows.` },
  ]
  
  const results = await Promise.all(
    queries.map(q => callGeminiWithTimeout(q.query, 8000))
  )
  
  const intel: any = { generated_at: new Date().toISOString() }
  queries.forEach((q, i) => {
    intel[q.key] = results[i].text
  })
  
  return intel
}

// Fetch portfolio holdings
async function fetchPortfolioHoldings(supabase: SupabaseClient): Promise<PortfolioHolding[]> {
  try {
    const { data: holdings } = await supabase
      .from('core_portfolio_holdings')
      .select('asset_id, cost_basis, assets!inner(symbol, name, asset_type)')
      .eq('is_active', true)
      .limit(20)
    
    if (!holdings) return []
    
    const enriched: PortfolioHolding[] = []
    
    for (const h of holdings.slice(0, 10)) {
      const asset = h.assets as any
      
      const [{ data: assetData }, { data: setupData }] = await Promise.all([
        supabase.from('mv_dashboard_all_assets')
          .select('ai_direction_score, rsi_14')
          .eq('asset_id', h.asset_id)
          .single(),
        supabase.from('setup_signals')
          .select('setup_name')
          .eq('asset_id', h.asset_id)
          .order('signal_date', { ascending: false })
          .limit(1)
          .single()
      ])
      
      const rsi = assetData?.rsi_14 || 50
      enriched.push({
        asset_id: h.asset_id,
        symbol: asset.symbol,
        name: asset.name?.slice(0, 18) || asset.symbol,
        action: rsi > 75 ? 'TRIM' : rsi < 30 ? 'ADD' : 'HOLD',
        price: h.cost_basis || 0,
        ai_direction: assetData?.ai_direction_score || 'N/A',
        rsi: Math.round(rsi),
        setup: setupData?.setup_name?.replace(/_/g, ' ') || 'No Setup',
        news: 'Loading...',
        catalysts: 'No upcoming catalysts',
        asset_url: `/asset/${h.asset_id}`
      })
    }
    
    return enriched
  } catch {
    return []
  }
}

// Fetch market ticker
async function fetchMarketTicker(supabase: SupabaseClient): Promise<MarketTicker> {
  try {
    const { data: macro } = await supabase
      .from('daily_macro_metrics')
      .select('spy_change_pct, qqq_change_pct, iwm_change_pct, us10y_yield, btc_change_pct, vix_close, market_regime')
      .order('date', { ascending: false })
      .limit(1)
      .single()
    
    if (!macro) throw new Error('No macro data')
    
    return {
      spy_change: macro.spy_change_pct || 0,
      qqq_change: macro.qqq_change_pct || 0,
      iwm_change: macro.iwm_change_pct || 0,
      yield_10y: macro.us10y_yield || 4.26,
      btc_change: macro.btc_change_pct || 0,
      vix: macro.vix_close || 14,
      regime: macro.market_regime || 'NEUTRAL'
    }
  } catch {
    return {
      spy_change: 0, qqq_change: 0, iwm_change: 0,
      yield_10y: 4.26, btc_change: 0, vix: 14, regime: 'NEUTRAL'
    }
  }
}

// Fetch setup candidates
async function fetchSetupCandidates(supabase: SupabaseClient, setupTypes: string[]): Promise<any[]> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const { data: signals } = await supabase
      .from('setup_signals')
      .select('id, asset_id, setup_name, assets(symbol, name)')
      .in('setup_name', setupTypes)
      .gte('signal_date', thirtyDaysAgo)
      .order('signal_date', { ascending: false })
      .limit(20)
    
    if (!signals) return []
    
    // Enrich with AI scores in parallel
    const enriched = await Promise.all(
      signals.map(async (s) => {
        const { data: assetData } = await supabase
          .from('mv_dashboard_all_assets')
          .select('ai_direction_score, setup_purity_score')
          .eq('asset_id', s.asset_id)
          .single()
        
        return {
          symbol: (s.assets as any).symbol,
          name: (s.assets as any).name,
          setup: s.setup_name,
          direction: assetData?.ai_direction_score || 50,
          purity: assetData?.setup_purity_score || 50
        }
      })
    )
    
    return enriched
  } catch {
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
    setup_type: c.setup,
    one_liner: `${c.setup} setup - Score: ${Math.round(c.score)}`,
    rationale: `Direction: ${c.direction}, Purity: ${c.purity}`
  }))
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('[DailyBrief v4] Starting...')
    const startTime = Date.now()
    
    // Fetch all data in parallel
    const [marketTicker, portfolioHoldings, rssItems] = await Promise.all([
      fetchMarketTicker(supabase),
      fetchPortfolioHoldings(supabase),
      fetchAllRSS()
    ])
    
    console.log(`[DailyBrief v4] Fetched ${rssItems.length} RSS items in ${Date.now() - startTime}ms`)
    
    // Generate intel (parallel)
    const [morningIntel, intelItems] = await Promise.all([
      generateMorningIntel(),
      Promise.resolve(generateIntelFromRSS(rssItems))
    ])
    
    // Add news to holdings
    portfolioHoldings.forEach(h => {
      const match = rssItems.find(r => 
        r.title.toLowerCase().includes(h.symbol.toLowerCase())
      )
      h.news = match ? `${match.title.slice(0, 60)}...` : 'No recent news'
    })
    
    // Fetch setups for each category in parallel
    const setupTypes = {
      momentum_breakouts: ['weinstein_stage2_breakout', 'donchian_55_breakout', 'rs_breakout'],
      trend_continuation: ['golden_cross', 'adx_holy_grail', 'acceleration_turn'],
      compression_reversion: ['vcp_squeeze', 'oversold_bounce']
    }
    
    const [momentum, trend, compression] = await Promise.all([
      fetchSetupCandidates(supabase, setupTypes.momentum_breakouts),
      fetchSetupCandidates(supabase, setupTypes.trend_continuation),
      fetchSetupCandidates(supabase, setupTypes.compression_reversion)
    ])
    
    console.log(`[DailyBrief v4] Generated in ${Date.now() - startTime}ms`)
    
    const brief = {
      date: new Date().toISOString().split('T')[0],
      market_ticker: marketTicker,
      market_regime: marketTicker.regime,
      macro_summary: `10Y at ${marketTicker.yield_10y}%. VIX at ${marketTicker.vix}.`,
      morning_intel: morningIntel,
      portfolio: portfolioHoldings,
      categories: {
        momentum_breakouts: {
          theme_summary: `${generatePicks(momentum).length} momentum setups`,
          picks: generatePicks(momentum)
        },
        trend_continuation: {
          theme_summary: `${generatePicks(trend).length} trend setups`,
          picks: generatePicks(trend)
        },
        compression_reversion: {
          theme_summary: `${generatePicks(compression).length} compression setups`,
          picks: generatePicks(compression)
        }
      },
      intel_items: intelItems,
      portfolio_alerts: [],
      action_items: [],
      tokens: { in: 0, out: 0 }
    }
    
    return new Response(JSON.stringify(brief), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[DailyBrief v4] Error:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      date: new Date().toISOString().split('T')[0],
      market_ticker: { spy_change: 0, qqq_change: 0, iwm_change: 0, yield_10y: 4.26, btc_change: 0, vix: 14, regime: 'NEUTRAL' },
      market_regime: 'NEUTRAL',
      portfolio: [],
      categories: {
        momentum_breakouts: { theme_summary: 'Error loading', picks: [] },
        trend_continuation: { theme_summary: 'Error loading', picks: [] },
        compression_reversion: { theme_summary: 'Error loading', picks: [] }
      },
      intel_items: []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

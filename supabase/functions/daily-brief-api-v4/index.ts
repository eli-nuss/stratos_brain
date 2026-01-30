// Daily Brief API v4 - Unified Web + PDF Architecture
// Added: Portfolio holdings, Market ticker, RSS Intel aggregation

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-stratos-api-key, x-stratos-key',
}

// ============================================================================
// TYPES
// ============================================================================

interface SetupSignal {
  id: number
  asset_id: number
  setup_name: string
  signal_date: string
  entry_price: number
  stop_loss: number
  target_price: number
  risk_reward: number
  context: any
  assets: {
    symbol: string
    name: string
    asset_type: string
    sector: string
  }
  ai_direction_score?: number
  setup_purity_score?: number
  ai_confidence?: number
  ai_summary_text?: string
  return_1d?: number
  dollar_volume?: number
  fvs_score?: number
  composite_score?: number
}

interface CategoryBucket {
  name: string
  description: string
  setup_types: string[]
  candidates: SetupSignal[]
  ai_picks?: SetupSignal[]
}

interface MorningIntel {
  market_pulse: string
  macro_calendar: string
  geopolitical: string
  sector_themes: string
  liquidity_flows: string
  risk_factors: string
  generated_at: string
}

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
  category: "GEOPOL" | "POLICY" | "TECH" | "EARNINGS" | "ECON" | "CRYPTO" | "DEFAULT"
  headline: string
  impact: string
  url: string
  source: string
  date: string
}

interface RSSItem {
  title: string
  link: string
  source: string
  date: string
  description: string
}

interface DailyBrief {
  date: string
  market_ticker: MarketTicker
  market_regime: string
  macro_summary: string
  morning_intel: MorningIntel | null
  portfolio: PortfolioHolding[]
  categories: {
    momentum_breakouts: {
      theme_summary: string
      picks: any[]
    }
    trend_continuation: {
      theme_summary: string
      picks: any[]
    }
    compression_reversion: {
      theme_summary: string
      picks: any[]
    }
  }
  intel_items: IntelItem[]
  portfolio_alerts: any[]
  action_items: any[]
  tokens: { in: number; out: number }
}

// ============================================================================
// RSS FEED CONFIGURATION
// ============================================================================

const RSS_FEEDS: { url: string; source: string }[] = [
  { url: 'https://www.marketwatch.com/rss/topstories', source: 'MarketWatch' },
  { url: 'https://seekingalpha.com/market_currents.xml', source: 'Seeking Alpha' },
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', source: 'WSJ' },
  { url: 'https://www.investing.com/rss/news.rss', source: 'Investing.com' },
]

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

const CATEGORIES: CategoryBucket[] = [
  {
    name: 'momentum_breakouts',
    description: 'New trends, breakouts, relative strength',
    setup_types: ['weinstein_stage2_breakout', 'donchian_55_breakout', 'rs_breakout', 'breakout_confirmed', 'gap_up_momentum'],
    candidates: []
  },
  {
    name: 'trend_continuation',
    description: 'Riding existing trends, pullbacks to support',
    setup_types: ['golden_cross', 'adx_holy_grail', 'acceleration_turn', 'trend_pullback_50ma'],
    candidates: []
  },
  {
    name: 'compression_reversion',
    description: 'Volatility compression, mean reversion',
    setup_types: ['vcp_squeeze', 'oversold_bounce'],
    candidates: []
  }
]

// ============================================================================
// COMPOSITE SCORE FUNCTIONS
// ============================================================================

function calculateMomentumScore(signal: SetupSignal): number {
  const direction = signal.ai_direction_score || 50
  const purity = signal.setup_purity_score || 50
  return (direction * 0.5) + (purity * 0.5)
}

function calculateTrendScore(signal: SetupSignal): number {
  const direction = signal.ai_direction_score || 50
  const purity = signal.setup_purity_score || 50
  const returnBonus = Math.min((signal.return_1d || 0) * 200, 20)
  return (direction * 0.4) + (purity * 0.4) + returnBonus
}

function calculateCompressionScore(signal: SetupSignal): number {
  const direction = signal.ai_direction_score || 50
  const purity = signal.setup_purity_score || 50
  return (direction * 0.3) + (purity * 0.7)
}

// ============================================================================
// RSS AGGREGATION
// ============================================================================

async function fetchRSSFeed(url: string, source: string): Promise<RSSItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StratosBot/1.0)' },
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      console.error(`[RSS] Failed to fetch ${source}: ${response.status}`)
      return []
    }
    
    const xml = await response.text()
    const items: RSSItem[] = []
    
    // Simple XML parsing for RSS items
    const itemRegex = /<item>(.*?)<\/item>/gs
    const titleRegex = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i
    const linkRegex = /<link>(.*?)<\/link>/i
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/i
    const descRegex = /<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is
    
    let match
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemContent = match[1]
      const title = (titleRegex.exec(itemContent)?.[1] || '').trim()
      const link = (linkRegex.exec(itemContent)?.[1] || '').trim()
      const date = (pubDateRegex.exec(itemContent)?.[1] || '').trim()
      const description = (descRegex.exec(itemContent)?.[1] || '').replace(/<[^>]+>/g, '').trim()
      
      if (title) {
        items.push({ title, link, source, date, description })
      }
    }
    
    return items
  } catch (error) {
    console.error(`[RSS] Error fetching ${source}:`, error.message)
    return []
  }
}

async function fetchAllRSS(): Promise<RSSItem[]> {
  const allItems: RSSItem[] = []
  
  for (const feed of RSS_FEEDS) {
    const items = await fetchRSSFeed(feed.url, feed.source)
    allItems.push(...items)
  }
  
  return allItems
}

function parseIntelItemsFromGemini(result: string, rssItems: RSSItem[]): IntelItem[] {
  const items: IntelItem[] = []
  const lines = result.split('\n')
  let currentItem: Partial<IntelItem> = {}
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    if (trimmed.toUpperCase().startsWith('CATEGORY:')) {
      if (currentItem.headline) {
        items.push(currentItem as IntelItem)
      }
      currentItem = {
        category: trimmed.split(':')[1]?.trim().toUpperCase().replace(/\s+/g, '_') as any || 'DEFAULT',
        url: '',
        date: '',
        source: '',
        impact: ''
      }
    } else if (trimmed.toUpperCase().startsWith('HEADLINE:')) {
      currentItem.headline = trimmed.split(':').slice(1).join(':').trim()
    } else if (trimmed.toUpperCase().startsWith('IMPACT:')) {
      currentItem.impact = trimmed.split(':').slice(1).join(':').trim()
    } else if (trimmed.toUpperCase().startsWith('SOURCE_NUM:')) {
      const sourceNum = parseInt(trimmed.split(':')[1]?.trim() || '1') - 1
      if (sourceNum >= 0 && sourceNum < rssItems.length) {
        currentItem.url = rssItems[sourceNum].link
        currentItem.date = rssItems[sourceNum].date
        currentItem.source = rssItems[sourceNum].source
      }
    }
  }
  
  if (currentItem.headline) {
    items.push(currentItem as IntelItem)
  }
  
  return items
}

async function aggregateIntelFromRSS(rssItems: RSSItem[]): Promise<IntelItem[]> {
  if (rssItems.length === 0) return []
  
  const headlines = rssItems.slice(0, 20).map((item, i) => `${i + 1}. [${item.source}] ${item.title}`).join('\n')
  
  const query = `Analyze these financial news headlines and extract ALL market-moving stories relevant to traders today.

HEADLINES:
${headlines}

For EACH relevant story, provide:
CATEGORY: [GEOPOL / POLICY / TECH / EARNINGS / ECON / CRYPTO]
HEADLINE: [5-10 words]
IMPACT: [One sentence on market impact]
SOURCE_NUM: [The number of the headline this is based on]

Include as many items as are truly relevant. Skip minor stories or PR fluff.`

  const result = await callGeminiWithSearch(query)
  
  if (result.text && result.text.length > 50) {
    return parseIntelItemsFromGemini(result.text, rssItems)
  }
  
  // Fallback: use top RSS items directly
  return rssItems.slice(0, 8).map((rss, i) => ({
    category: 'DEFAULT',
    headline: rss.title.slice(0, 80),
    impact: rss.description.slice(0, 100) || 'Market news',
    url: rss.link,
    date: rss.date,
    source: rss.source
  }))
}

// ============================================================================
// PORTFOLIO DATA
// ============================================================================

async function fetchPortfolioHoldings(supabase: SupabaseClient): Promise<PortfolioHolding[]> {
  // Fetch active holdings with asset details
  const { data: holdings, error } = await supabase
    .from('core_portfolio_holdings')
    .select(`
      asset_id,
      cost_basis,
      assets!inner(symbol, name, asset_type, description)
    `)
    .eq('is_active', true)
  
  if (error || !holdings) {
    console.error('[Portfolio] Error fetching holdings:', error)
    return []
  }
  
  const enrichedHoldings: PortfolioHolding[] = []
  
  for (const h of holdings) {
    const asset = h.assets as any
    
    // Get AI scores from mv_dashboard_all_assets
    const { data: assetData } = await supabase
      .from('mv_dashboard_all_assets')
      .select('ai_direction_score, setup_purity_score, rsi_14, setup_type')
      .eq('asset_id', h.asset_id)
      .single()
    
    // Get latest setup
    const { data: setupData } = await supabase
      .from('setup_signals')
      .select('setup_name, signal_date')
      .eq('asset_id', h.asset_id)
      .order('signal_date', { ascending: false })
      .limit(1)
      .single()
    
    const rsi = assetData?.rsi_14 || 50
    const action = rsi > 75 ? 'TRIM' : rsi < 30 ? 'ADD' : 'HOLD'
    
    enrichedHoldings.push({
      asset_id: h.asset_id,
      symbol: asset.symbol,
      name: asset.name?.slice(0, 18) || asset.symbol,
      action,
      price: h.cost_basis || 0,
      ai_direction: assetData?.ai_direction_score || 'N/A',
      rsi: Math.round(rsi),
      setup: setupData?.setup_name?.replace(/_/g, ' ')?.toTitleCase() || 'No Setup',
      news: '', // Will be filled later with RSS matching
      catalysts: asset.asset_type === 'etf' ? 'Quarterly rebalancing' : 'No upcoming catalysts',
      asset_url: `/asset/${h.asset_id}`
    })
  }
  
  return enrichedHoldings
}

// ============================================================================
// MARKET TICKER
// ============================================================================

async function fetchMarketTicker(supabase: SupabaseClient): Promise<MarketTicker> {
  const { data: macro, error } = await supabase
    .from('daily_macro_metrics')
    .select('spy_change_pct, qqq_change_pct, iwm_change_pct, us10y_yield, btc_change_pct, vix_close, market_regime')
    .order('date', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !macro) {
    console.error('[Market] Error fetching macro:', error)
    return {
      spy_change: 0,
      qqq_change: 0,
      iwm_change: 0,
      yield_10y: 4.26,
      btc_change: 0,
      vix: 14,
      regime: 'NEUTRAL'
    }
  }
  
  return {
    spy_change: macro.spy_change_pct || 0,
    qqq_change: macro.qqq_change_pct || 0,
    iwm_change: macro.iwm_change_pct || 0,
    yield_10y: macro.us10y_yield || 4.26,
    btc_change: macro.btc_change_pct || 0,
    vix: macro.vix_close || 14,
    regime: macro.market_regime || 'NEUTRAL'
  }
}

// ============================================================================
// GEMINI WITH SEARCH (Grounded)
// ============================================================================

async function callGeminiWithSearch(query: string): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: query }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    }
  )

  const data = await response.json()
  
  if (data.error) {
    console.error('[Gemini Search] API Error:', data.error)
    return { text: 'Search unavailable', tokensIn: 0, tokensOut: 0 }
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || 'No results found.'
  const tokensIn = data.usageMetadata?.promptTokenCount || 0
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0
  
  return { text, tokensIn, tokensOut }
}

async function generateMorningIntel(): Promise<{ intel: MorningIntel; tokensIn: number; tokensOut: number }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  let totalTokensIn = 0
  let totalTokensOut = 0
  
  const queries = [
    { key: 'market_pulse', query: `Today is ${today}. Provide a brief market pulse: US futures, key SPY/QQQ levels, VIX context, overnight global moves.` },
    { key: 'macro_calendar', query: `Today is ${today}. Key economic events: data releases, Fed speakers, major earnings, Treasury auctions. Be specific with ET times.` },
    { key: 'geopolitical', query: `Today is ${today}. Geopolitical/policy developments: trade policy, regulatory, international tensions affecting markets.` },
    { key: 'sector_themes', query: `Today is ${today}. Sector themes: leading/lagging sectors, rotation signals, key sector ETFs to watch.` },
    { key: 'liquidity_flows', query: `Today is ${today}. Liquidity state: DXY, Treasury yields, fund flows, risk appetite indicators.` },
    { key: 'risk_factors', query: `Today is ${today}. Key risk factors: volatility triggers, crowded positioning, macro vulnerabilities.` }
  ]
  
  const intel: any = { generated_at: new Date().toISOString() }
  
  for (const { key, query } of queries) {
    const result = await callGeminiWithSearch(query)
    intel[key] = result.text
    totalTokensIn += result.tokensIn
    totalTokensOut += result.tokensOut
  }
  
  return { intel: intel as MorningIntel, tokensIn: totalTokensIn, tokensOut: totalTokensOut }
}

// ============================================================================
// SETUP CANDIDATES
// ============================================================================

async function fetchSetupCandidates(supabase: SupabaseClient, setupTypes: string[]): Promise<SetupSignal[]> {
  const { data: signals, error } = await supabase
    .from('setup_signals')
    .select(`
      id, asset_id, setup_name, signal_date, entry_price, stop_loss, target_price, risk_reward, context,
      assets(symbol, name, asset_type, sector)
    `)
    .in('setup_name', setupTypes)
    .gte('signal_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('signal_date', { ascending: false })
    .limit(100)
  
  if (error || !signals) {
    console.error('[Setups] Error:', error)
    return []
  }
  
  const enriched: SetupSignal[] = []
  
  for (const signal of signals) {
    const { data: assetData } = await supabase
      .from('mv_dashboard_all_assets')
      .select('ai_direction_score, setup_purity_score, ai_confidence, ai_summary_text, return_1d, dollar_volume_sma_20 as dollar_volume')
      .eq('asset_id', signal.asset_id)
      .single()
    
    enriched.push({
      ...signal,
      ...assetData,
      assets: signal.assets as any
    })
  }
  
  return enriched
}

// ============================================================================
// AI RERANKING
// ============================================================================

async function rerankWithAI(candidates: SetupSignal[], categoryName: string): Promise<any[]> {
  if (candidates.length === 0) return []
  
  const topCandidates = candidates.slice(0, 15)
  
  const picks = topCandidates.map(c => ({
    symbol: c.assets.symbol,
    name: c.assets.name,
    setup: c.setup_name,
    direction: c.ai_direction_score,
    purity: c.setup_purity_score,
    rr: c.risk_reward,
    summary: c.ai_summary_text?.slice(0, 100) || ''
  }))
  
  const query = `As a fund manager, select the TOP 3-5 highest conviction picks from this ${categoryName} list.

CANDIDATES:
${JSON.stringify(picks, null, 2)}

Return ONLY as JSON array: [{"symbol": "...", "conviction": "HIGH|MEDIUM|LOW", "rationale": "...", "one_liner": "..."}]`

  const result = await callGeminiWithSearch(query)
  
  try {
    const jsonMatch = result.text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('[AI Rerank] Parse error:', e)
  }
  
  // Fallback
  return topCandidates.slice(0, 5).map(c => ({
    symbol: c.assets.symbol,
    name: c.assets.name,
    conviction: c.ai_direction_score && c.ai_direction_score > 60 ? 'HIGH' : 'MEDIUM',
    setup_type: c.setup_name,
    rationale: c.ai_summary_text?.slice(0, 80) || 'Technical setup aligned',
    one_liner: `${c.setup_name.replace(/_/g, ' ')} at $${c.entry_price}`
  }))
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('[DailyBrief v4] Starting generation...')
    
    // Fetch all data in parallel
    const [marketTicker, portfolioHoldings, rssItems] = await Promise.all([
      fetchMarketTicker(supabase),
      fetchPortfolioHoldings(supabase),
      fetchAllRSS()
    ])
    
    console.log(`[DailyBrief v4] Fetched ${rssItems.length} RSS items`)
    
    // Aggregate intel from RSS
    const [intelItems, morningIntel] = await Promise.all([
      aggregateIntelFromRSS(rssItems),
      generateMorningIntel()
    ])
    
    console.log(`[DailyBrief v4] Generated ${intelItems.length} intel items`)
    
    // Match RSS news to portfolio holdings
    for (const holding of portfolioHoldings) {
      const tickerPattern = new RegExp(`\\b${holding.symbol}\\b`, 'i')
      const companyWords = holding.name?.split(' ').slice(0, 3) || []
      
      const matching = rssItems.find(rss => {
        const text = `${rss.title} ${rss.description}`
        if (tickerPattern.test(text)) return true
        const matches = companyWords.filter(w => w.length > 3 && text.toLowerCase().includes(w.toLowerCase()))
        return matches.length >= 2
      })
      
      if (matching) {
        holding.news = `${matching.title.slice(0, 80)}... [${matching.source}]`
      } else {
        holding.news = rssItems[0] ? `${rssItems[0].title.slice(0, 70)}... [${rssItems[0].source}]` : 'No significant news'
      }
    }
    
    // Fetch and rank setups for each category
    const categoryResults: any = {}
    let totalTokens = { in: morningIntel.tokensIn, out: morningIntel.tokensOut }
    
    for (const category of CATEGORIES) {
      console.log(`[DailyBrief v4] Processing ${category.name}...`)
      
      const candidates = await fetchSetupCandidates(supabase, category.setup_types)
      
      // Calculate composite scores
      for (const c of candidates) {
        if (category.name === 'momentum_breakouts') {
          c.composite_score = calculateMomentumScore(c)
        } else if (category.name === 'trend_continuation') {
          c.composite_score = calculateTrendScore(c)
        } else {
          c.composite_score = calculateCompressionScore(c)
        }
      }
      
      // Sort by composite score
      candidates.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
      
      // AI reranking
      const picks = await rerankWithAI(candidates, category.name)
      
      categoryResults[category.name] = {
        theme_summary: `${picks.length} ${category.description.toLowerCase()} setups identified`,
        picks: picks
      }
    }
    
    const brief: DailyBrief = {
      date: new Date().toISOString().split('T')[0],
      market_ticker: marketTicker,
      market_regime: marketTicker.regime,
      macro_summary: `10Y yield at ${marketTicker.yield_10y}%. VIX at ${marketTicker.vix}.`,
      morning_intel: morningIntel.intel,
      portfolio: portfolioHoldings,
      categories: {
        momentum_breakouts: categoryResults.momentum_breakouts,
        trend_continuation: categoryResults.trend_continuation,
        compression_reversion: categoryResults.compression_reversion
      },
      intel_items: intelItems.slice(0, 8),
      portfolio_alerts: [],
      action_items: [],
      tokens: totalTokens
    }
    
    console.log('[DailyBrief v4] Generation complete')
    
    return new Response(JSON.stringify(brief), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[DailyBrief v4] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

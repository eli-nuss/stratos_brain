// Daily Brief API v4 - Enhanced with live data, alerts, and better formatting
// Parallel fetching, shorter timeouts, graceful degradation

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
}

// API Keys for live data
const FMP_API_KEY = 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe'
const ALPHA_VANTAGE_KEY = 'PLZVWIJQFOVHT4WL'

// Types
interface PortfolioHolding {
  asset_id: number
  symbol: string
  name: string
  asset_type: string
  action: "ADD" | "TRIM" | "HOLD"
  cost_basis: number
  current_price: number
  change_pct: number
  ai_direction: number | string
  rsi: number
  setup: string
  news: string
  news_full: string
  news_url: string
  news_time: string
  asset_url: string
}

interface MarketTicker {
  spy_price: number
  spy_change: number
  qqq_price: number
  qqq_change: number
  iwm_price: number
  iwm_change: number
  btc_price: number
  btc_change: number
  yield_10y: number
  vix: number
  regime: string
  last_updated: string
}

interface Alert {
  symbol: string
  name: string
  alert_type: 'RSI_OVERBOUGHT' | 'RSI_OVERSOLD' | 'NEW_HIGH' | 'NEW_LOW' | 'BREAKOUT' | 'BREAKDOWN'
  message: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  asset_url: string
}

interface IntelItem {
  category: string
  headline: string
  impact: string
  url: string
  source: string
  date: string
  time_ago: string
}

// RSS Feeds
const RSS_FEEDS = [
  { url: 'https://www.marketwatch.com/rss/topstories', source: 'MarketWatch' },
  { url: 'https://seekingalpha.com/market_currents.xml', source: 'Seeking Alpha' },
]

// HTML entity decoder
function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
}

// Calculate time ago string
function getTimeAgo(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

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

// Fetch live market data from FMP API (using new stable endpoints)
async function fetchLiveMarketData(): Promise<MarketTicker> {
  const defaultTicker: MarketTicker = {
    spy_price: 0, spy_change: 0,
    qqq_price: 0, qqq_change: 0,
    iwm_price: 0, iwm_change: 0,
    btc_price: 0, btc_change: 0,
    yield_10y: 4.26, vix: 14,
    regime: 'NEUTRAL',
    last_updated: new Date().toISOString()
  }
  
  try {
    console.log('[DailyBrief v4] Fetching live market data...')
    
    // Use new stable API endpoints
    const [spyRes, qqqRes, iwmRes, vixRes, btcRes] = await Promise.all([
      fetchWithTimeout(`https://financialmodelingprep.com/stable/quote?symbol=SPY&apikey=${FMP_API_KEY}`, {}, 4000),
      fetchWithTimeout(`https://financialmodelingprep.com/stable/quote?symbol=QQQ&apikey=${FMP_API_KEY}`, {}, 4000),
      fetchWithTimeout(`https://financialmodelingprep.com/stable/quote?symbol=IWM&apikey=${FMP_API_KEY}`, {}, 4000),
      fetchWithTimeout(`https://financialmodelingprep.com/stable/quote?symbol=VIX&apikey=${FMP_API_KEY}`, {}, 4000),
      fetchWithTimeout(`https://financialmodelingprep.com/stable/quote?symbol=BTCUSD&apikey=${FMP_API_KEY}`, {}, 4000)
    ])
    
    if (spyRes?.ok) {
      const data = await spyRes.json()
      if (data?.[0]) {
        defaultTicker.spy_price = data[0].price || 0
        defaultTicker.spy_change = data[0].changePercentage || 0
      }
    }
    
    if (qqqRes?.ok) {
      const data = await qqqRes.json()
      if (data?.[0]) {
        defaultTicker.qqq_price = data[0].price || 0
        defaultTicker.qqq_change = data[0].changePercentage || 0
      }
    }
    
    if (iwmRes?.ok) {
      const data = await iwmRes.json()
      if (data?.[0]) {
        defaultTicker.iwm_price = data[0].price || 0
        defaultTicker.iwm_change = data[0].changePercentage || 0
      }
    }
    
    if (vixRes?.ok) {
      const data = await vixRes.json()
      if (data?.[0]) {
        defaultTicker.vix = data[0].price || 14
      }
    }
    
    if (btcRes?.ok) {
      const btcData = await btcRes.json()
      if (btcData?.[0]) {
        defaultTicker.btc_price = btcData[0].price || 0
        defaultTicker.btc_change = btcData[0].changePercentage || 0
      }
    }
    
    // Determine market regime based on data
    const avgChange = (defaultTicker.spy_change + defaultTicker.qqq_change) / 2
    if (avgChange > 1) defaultTicker.regime = 'BULLISH'
    else if (avgChange < -1) defaultTicker.regime = 'BEARISH'
    else if (defaultTicker.vix > 25) defaultTicker.regime = 'VOLATILE'
    else defaultTicker.regime = 'NEUTRAL'
    
    console.log('[DailyBrief v4] Live market data fetched:', defaultTicker.regime)
    return defaultTicker
    
  } catch (e) {
    console.log('[DailyBrief v4] Live market data error:', e)
    return defaultTicker
  }
}

// Fetch live price for a symbol (using new stable API)
async function fetchLivePrice(symbol: string, assetType: string): Promise<{ price: number, change: number }> {
  try {
    // For crypto, append USD to symbol
    const querySymbol = assetType === 'crypto' ? `${symbol}USD` : symbol
    const res = await fetchWithTimeout(
      `https://financialmodelingprep.com/stable/quote?symbol=${querySymbol}&apikey=${FMP_API_KEY}`,
      {}, 3000
    )
    if (res?.ok) {
      const data = await res.json()
      if (data?.[0]) {
        return { price: data[0].price || 0, change: data[0].changePercentage || 0 }
      }
    }
  } catch (e) {
    console.log(`[DailyBrief v4] Price fetch error for ${symbol}:`, e)
  }
  return { price: 0, change: 0 }
}

// Fetch RSS feed with better parsing
async function fetchRSSFeed(url: string, source: string): Promise<any[]> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StratosBrain/1.0)' }
    }, 4000)
    
    if (!response || !response.ok) return []
    
    const xml = await response.text()
    const items: any[] = []
    
    const itemRegex = /<item>(.*?)<\/item>/gs
    const titleRegex = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i
    const linkRegex = /<link>(.*?)<\/link>/i
    const descRegex = /<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/i
    
    let match
    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const content = match[1]
      const rawTitle = titleRegex.exec(content)?.[1]?.trim()
      const title = decodeHtmlEntities(rawTitle || '')
      const link = linkRegex.exec(content)?.[1]?.trim()
      const rawDesc = descRegex.exec(content)?.[1]?.replace(/<[^>]+>/g, '').trim()
      const description = decodeHtmlEntities(rawDesc || '')
      const pubDate = pubDateRegex.exec(content)?.[1]?.trim()
      
      if (title) items.push({ title, link, source, description, pubDate })
    }
    
    return items
  } catch (e) {
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
  
  return items.slice(0, 15)
}

// Categorize news based on keywords
function categorizeNews(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()
  
  if (text.match(/bitcoin|crypto|ethereum|btc|eth|blockchain|defi|nft/)) return 'CRYPTO'
  if (text.match(/fed|interest rate|inflation|treasury|powell|fomc|monetary/)) return 'POLICY'
  if (text.match(/earnings|revenue|profit|eps|guidance|quarter|fiscal/)) return 'EARNINGS'
  if (text.match(/gdp|jobs|employment|cpi|ppi|retail sales|manufacturing|economic/)) return 'ECON'
  if (text.match(/china|russia|ukraine|tariff|trade war|geopolitical|sanctions/)) return 'GEOPOL'
  if (text.match(/ai|tech|nvidia|apple|microsoft|google|amazon|semiconductor/)) return 'TECH'
  
  return 'ECON'
}

// Generate intel from RSS with time stamps
function generateIntelFromRSS(rssItems: any[]): IntelItem[] {
  return rssItems.slice(0, 10).map((item) => ({
    category: categorizeNews(item.title || '', item.description || ''),
    headline: item.title?.slice(0, 120) || 'Market Update',
    impact: item.description?.slice(0, 180) || 'Market news and analysis',
    url: item.link || '',
    source: item.source || 'News',
    date: item.pubDate || new Date().toISOString(),
    time_ago: getTimeAgo(item.pubDate)
  }))
}

// Search for news for a single holding using Gemini with Google Search
async function searchNewsForHolding(symbol: string, name: string): Promise<{ headline: string, description: string, url: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return { headline: '', description: '', url: '' }
  }
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  
  try {
    const query = `Find the most important recent news (last 7 days) about ${symbol} (${name}) stock. Return ONLY a JSON object with these fields: headline (max 80 chars), description (2-3 sentence summary of why this matters for investors), url (source link). If no recent news, return empty strings.`
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: query }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        }),
        signal: controller.signal
      }
    )
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      return { headline: '', description: '', url: '' }
    }
    
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          headline: parsed.headline || '',
          description: parsed.description || '',
          url: parsed.url || ''
        }
      }
    } catch (parseError) {
      // Ignore parse errors
    }
    
    return { headline: '', description: '', url: '' }
  } catch (e) {
    clearTimeout(timeout)
    return { headline: '', description: '', url: '' }
  }
}

// Search news for all holdings in parallel
async function searchNewsForAllHoldings(holdings: PortfolioHolding[]): Promise<void> {
  console.log(`[DailyBrief v4] Searching news for ${holdings.length} holdings...`)
  
  const batchSize = 5
  for (let i = 0; i < holdings.length; i += batchSize) {
    const batch = holdings.slice(i, i + batchSize)
    
    const results = await Promise.all(
      batch.map(h => searchNewsForHolding(h.symbol, h.name))
    )
    
    results.forEach((result, idx) => {
      const holding = batch[idx]
      if (result.headline) {
        holding.news = result.headline
        holding.news_full = result.description
        holding.news_url = result.url
        holding.news_time = 'Recent'
      }
    })
    
    if (i + batchSize < holdings.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
}

// Call Gemini with timeout
async function callGeminiWithTimeout(query: string, timeoutMs = 12000): Promise<{ text: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
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
      return { text: 'AI insights temporarily unavailable' }
    }
    
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
    return { text }
  } catch (e) {
    clearTimeout(timeout)
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

// Fetch portfolio holdings with live prices
async function fetchPortfolioHoldings(supabase: SupabaseClient): Promise<PortfolioHolding[]> {
  try {
    console.log('[DailyBrief v4] Fetching portfolio holdings...')
    
    const { data: holdings, error: holdingsError } = await supabase
      .from('core_portfolio_holdings')
      .select('asset_id, cost_basis, quantity, assets!inner(symbol, name, asset_type)')
      .eq('is_active', true)
      .order('added_at', { ascending: false })
    
    if (holdingsError || !holdings || holdings.length === 0) {
      return []
    }
    
    console.log(`[DailyBrief v4] Found ${holdings.length} holdings - enriching with live data`)
    
    // Process holdings in parallel
    const enrichmentPromises = holdings.map(async (h) => {
      const asset = h.assets as any
      
      try {
        // Fetch DB data and live price in parallel
        const [assetResult, setupResult, priceData] = await Promise.all([
          supabase.from('mv_dashboard_all_assets')
            .select('ai_direction_score, rsi_14')
            .eq('asset_id', h.asset_id)
            .single(),
          supabase.from('setup_signals')
            .select('setup_name')
            .eq('asset_id', h.asset_id)
            .order('signal_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          fetchLivePrice(asset.symbol, asset.asset_type)
        ])
        
        const assetData = assetResult.data
        const setupData = setupResult.data
        const rsi = assetData?.rsi_14 || 50
        
        return {
          asset_id: h.asset_id,
          symbol: asset.symbol,
          name: asset.name?.slice(0, 25) || asset.symbol,
          asset_type: asset.asset_type || 'equity',
          action: rsi > 70 ? 'TRIM' : rsi < 30 ? 'ADD' : 'HOLD',
          cost_basis: h.cost_basis || 0,
          current_price: priceData.price,
          change_pct: priceData.change,
          ai_direction: assetData?.ai_direction_score ?? 'N/A',
          rsi: Math.round(rsi),
          setup: setupData?.setup_name?.replace(/_/g, ' ') || 'No Setup',
          news: '',
          news_full: '',
          news_url: '',
          news_time: '',
          asset_url: `/asset/${h.asset_id}`
        } as PortfolioHolding
      } catch (e) {
        return {
          asset_id: h.asset_id,
          symbol: asset.symbol,
          name: asset.name?.slice(0, 25) || asset.symbol,
          asset_type: asset.asset_type || 'equity',
          action: 'HOLD',
          cost_basis: h.cost_basis || 0,
          current_price: 0,
          change_pct: 0,
          ai_direction: 'N/A',
          rsi: 50,
          setup: 'No Setup',
          news: '',
          news_full: '',
          news_url: '',
          news_time: '',
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

// Generate alerts from portfolio holdings
function generateAlerts(holdings: PortfolioHolding[]): Alert[] {
  const alerts: Alert[] = []
  
  for (const h of holdings) {
    // RSI alerts
    if (h.rsi >= 80) {
      alerts.push({
        symbol: h.symbol,
        name: h.name,
        alert_type: 'RSI_OVERBOUGHT',
        message: `${h.symbol} RSI at ${h.rsi} - extremely overbought, consider taking profits`,
        severity: 'HIGH',
        asset_url: h.asset_url
      })
    } else if (h.rsi >= 70) {
      alerts.push({
        symbol: h.symbol,
        name: h.name,
        alert_type: 'RSI_OVERBOUGHT',
        message: `${h.symbol} RSI at ${h.rsi} - overbought territory`,
        severity: 'MEDIUM',
        asset_url: h.asset_url
      })
    } else if (h.rsi <= 20) {
      alerts.push({
        symbol: h.symbol,
        name: h.name,
        alert_type: 'RSI_OVERSOLD',
        message: `${h.symbol} RSI at ${h.rsi} - extremely oversold, potential buying opportunity`,
        severity: 'HIGH',
        asset_url: h.asset_url
      })
    } else if (h.rsi <= 30) {
      alerts.push({
        symbol: h.symbol,
        name: h.name,
        alert_type: 'RSI_OVERSOLD',
        message: `${h.symbol} RSI at ${h.rsi} - oversold territory`,
        severity: 'MEDIUM',
        asset_url: h.asset_url
      })
    }
    
    // Big movers
    if (h.change_pct >= 5) {
      alerts.push({
        symbol: h.symbol,
        name: h.name,
        alert_type: 'BREAKOUT',
        message: `${h.symbol} up ${h.change_pct.toFixed(1)}% today - strong momentum`,
        severity: 'HIGH',
        asset_url: h.asset_url
      })
    } else if (h.change_pct <= -5) {
      alerts.push({
        symbol: h.symbol,
        name: h.name,
        alert_type: 'BREAKDOWN',
        message: `${h.symbol} down ${Math.abs(h.change_pct).toFixed(1)}% today - review position`,
        severity: 'HIGH',
        asset_url: h.asset_url
      })
    }
  }
  
  // Sort by severity
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  
  return alerts.slice(0, 8)
}

// Fetch setup candidates with deduplication
async function fetchSetupCandidates(supabase: SupabaseClient, setupTypes: string[]): Promise<any[]> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const { data: signals, error } = await supabase
      .from('setup_signals')
      .select('id, asset_id, setup_name, assets(symbol, name)')
      .in('setup_name', setupTypes)
      .gte('signal_date', thirtyDaysAgo)
      .order('signal_date', { ascending: false })
      .limit(20)
    
    if (error || !signals || signals.length === 0) return []
    
    // Deduplicate by symbol - keep only the most recent setup per symbol
    const seenSymbols = new Set<string>()
    const dedupedSignals = signals.filter(s => {
      const symbol = (s.assets as any)?.symbol
      if (!symbol || seenSymbols.has(symbol)) return false
      seenSymbols.add(symbol)
      return true
    }).slice(0, 10)
    
    // Enrich with AI scores
    const enriched = await Promise.all(
      dedupedSignals.map(async (s) => {
        try {
          const { data: assetData } = await supabase
            .from('mv_dashboard_all_assets')
            .select('ai_direction_score, setup_purity_score')
            .eq('asset_id', s.asset_id)
            .single()
          
          return {
            asset_id: s.asset_id,
            symbol: (s.assets as any)?.symbol || 'N/A',
            name: (s.assets as any)?.name || '',
            setup: s.setup_name,
            direction: assetData?.ai_direction_score || 50,
            purity: assetData?.setup_purity_score || 50
          }
        } catch {
          return {
            asset_id: s.asset_id,
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
    return []
  }
}

// Generate picks from candidates
function generatePicks(candidates: any[]): any[] {
  if (candidates.length === 0) return []
  
  const sorted = candidates
    .map(c => ({ ...c, score: (c.direction + c.purity) / 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  
  return sorted.map(c => ({
    asset_id: c.asset_id,
    symbol: c.symbol,
    name: c.name,
    conviction: c.score > 70 ? 'HIGH' : c.score > 55 ? 'MEDIUM' : 'LOW',
    setup_type: c.setup?.replace(/_/g, ' ') || 'Setup',
    score: Math.round(c.score),
    asset_url: `/asset/${c.asset_id}`
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
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('[DailyBrief v4] Starting request...')
    const startTime = Date.now()
    
    // Fetch all data in parallel
    const [marketTicker, portfolioHoldings, rssItems] = await Promise.all([
      fetchLiveMarketData(),
      fetchPortfolioHoldings(supabase),
      fetchAllRSS()
    ])
    
    console.log(`[DailyBrief v4] Initial fetch completed in ${Date.now() - startTime}ms`)
    
    // Search news and generate intel in parallel
    const [_, morningIntel, intelItems] = await Promise.all([
      searchNewsForAllHoldings(portfolioHoldings),
      generateMorningIntel(),
      Promise.resolve(generateIntelFromRSS(rssItems))
    ])
    
    // Generate alerts from portfolio
    const alerts = generateAlerts(portfolioHoldings)
    
    // Fetch setups for each category
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
      macro_summary: `10Y at ${marketTicker.yield_10y.toFixed(2)}%. VIX at ${marketTicker.vix.toFixed(1)}.`,
      morning_intel: morningIntel,
      portfolio: portfolioHoldings,
      alerts: alerts,
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
    
    const fallbackBrief = {
      date: new Date().toISOString().split('T')[0],
      market_ticker: { 
        spy_price: 0, spy_change: 0, qqq_price: 0, qqq_change: 0,
        iwm_price: 0, iwm_change: 0, btc_price: 0, btc_change: 0,
        yield_10y: 4.26, vix: 14, regime: 'NEUTRAL',
        last_updated: new Date().toISOString()
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
      alerts: [],
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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

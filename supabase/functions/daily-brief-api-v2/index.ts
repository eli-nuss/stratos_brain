// Daily Brief API v2 - Modular Section-Based Architecture
// Uses Gemini 3 Pro Preview with RLM-inspired approach
// Each section is generated with focused context to maintain quality

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
const GEMINI_MODEL = 'gemini-3-pro-preview'

// ============================================================================
// TYPES
// ============================================================================

interface MarketPulse {
  regime: 'risk-on' | 'risk-off' | 'neutral'
  regime_confidence: number
  summary: string
  dominant_theme: string
  key_indices: {
    symbol: string
    price: number
    change_1d: number
    change_5d: number
  }[]
  market_breadth: {
    advancing: number
    declining: number
    new_highs: number
    new_lows: number
  }
  fear_greed_indicator: number
}

interface MacroContext {
  yield_curve: {
    status: 'inverted' | 'flat' | 'normal' | 'steepening'
    spread_10y_2y: number
    trend: string
  }
  rates: {
    fed_funds: number
    ten_year: number
    direction: 'rising' | 'falling' | 'stable'
  }
  inflation: {
    cpi_yoy: number
    trend: string
  }
  commodities: {
    oil: { price: number; change: number }
    gold: { price: number; change: number }
    copper: { price: number; change: number }
  }
  sector_rotation: {
    leading: string[]
    lagging: string[]
    rotation_signal: string
  }
  risk_assessment: string
}

interface TechnicalCluster {
  theme_name: string
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  catalyst: string
  assets: {
    symbol: string
    name: string
    price: number
    change_1d: number
    setup_type: string
    signal_strength: number
  }[]
  aggregate_conviction: number
}

interface TopSetup {
  asset_id: number
  symbol: string
  name: string
  asset_type: 'crypto' | 'equity'
  price: number
  change_1d: number
  setup_type: string
  entry_price: number
  stop_loss: number
  target_price: number
  risk_reward: number
  fvs_score: number | null
  fvs_label: 'Quality Growth' | 'Speculative Momentum' | 'Value' | null
  ai_conviction: number
  reasoning: string
  bear_case: string
  signals: string[]
  volume_warning: boolean
}

interface FundamentalLeader {
  asset_id: number
  symbol: string
  name: string
  fvs_score: number
  profitability_score: number
  solvency_score: number
  growth_score: number
  moat_score: number
  piotroski_f: number
  altman_z: number
  ai_summary: string
}

interface SignalAlert {
  signal_type: string
  direction: 'bullish' | 'bearish'
  strength: number
  count: number
  is_new_today: boolean
  notable_assets: string[]
  interpretation: string
}

interface SkepticWarning {
  warning_type: 'overbought' | 'low_quality' | 'liquidity' | 'fundamental_risk' | 'bearish_signal'
  severity: 'high' | 'medium' | 'low'
  assets: string[]
  explanation: string
}

interface SectorAnalysis {
  sector: string
  performance_1d: number
  performance_5d: number
  sentiment: 'bullish' | 'bearish' | 'neutral'
  money_flow: 'inflow' | 'outflow' | 'neutral'
  top_performers: string[]
  laggards: string[]
  key_themes: string[]
}

interface PortfolioAnalysis {
  total_value: number
  cash_position: number
  cash_percentage: number
  allocation: {
    category: string
    value: number
    percentage: number
    change_1d: number
  }[]
  positions: {
    symbol: string
    quantity: number
    cost_basis: number
    current_price: number
    market_value: number
    unrealized_pnl: number
    unrealized_pnl_pct: number
    weight: number
    signals_active: string[]
    fvs_score: number | null
  }[]
  concentration_warnings: string[]
  signals_on_holdings: {
    symbol: string
    signal: string
    direction: string
  }[]
  rebalancing_suggestions: string[]
  risk_assessment: string
}

interface CryptoSpotlight {
  btc_dominance: number
  total_market_cap: number
  market_cap_change_24h: number
  top_movers: {
    symbol: string
    name: string
    price: number
    change_24h: number
    volume_24h: number
  }[]
  active_setups: TopSetup[]
  defi_themes: string[]
  narrative_summary: string
}

interface ActionItem {
  priority: 'immediate' | 'watch' | 'research'
  action_type: 'entry' | 'exit' | 'add' | 'reduce' | 'monitor'
  symbol: string
  description: string
  trigger: string
  reasoning: string
}

interface DailyBriefV2 {
  brief_id?: number
  brief_date: string
  generated_at: string
  model_used: string
  
  // Sections
  market_pulse: MarketPulse
  macro_context: MacroContext
  technical_clusters: TechnicalCluster[]
  top_setups: TopSetup[]
  fundamental_leaders: FundamentalLeader[]
  signal_alerts: SignalAlert[]
  skeptics_corner: SkepticWarning[]
  sector_analysis: SectorAnalysis[]
  portfolio_analysis: PortfolioAnalysis | null
  crypto_spotlight: CryptoSpotlight
  action_items: ActionItem[]
  
  // Metadata
  generation_stats: {
    total_tokens_in: number
    total_tokens_out: number
    sections_generated: number
    generation_time_ms: number
  }
}

// ============================================================================
// DATA FETCHERS - Each fetcher gets focused data for its section
// ============================================================================

async function fetchMarketPulseData(supabase: SupabaseClient) {
  console.log('[MarketPulse] Fetching data...')
  
  // Get macro metrics for regime
  const { data: macro } = await supabase
    .from('daily_macro_metrics')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .single()
  
  // Get index data (SPY, QQQ, IWM, BTC)
  const indexSymbols = ['SPY', 'QQQ', 'IWM', 'BTC', 'ETH']
  const { data: indexAssets } = await supabase
    .from('assets')
    .select('asset_id, symbol')
    .in('symbol', indexSymbols)
  
  const indexIds = (indexAssets || []).map(a => a.asset_id)
  
  // Get latest prices and features for indices
  const { data: indexBars } = await supabase
    .from('daily_bars')
    .select('asset_id, close, date')
    .in('asset_id', indexIds)
    .order('date', { ascending: false })
  
  const { data: indexFeatures } = await supabase
    .from('daily_features')
    .select('asset_id, return_1d, return_5d')
    .in('asset_id', indexIds)
    .order('date', { ascending: false })
  
  // Calculate market breadth from all assets
  const { data: allFeatures } = await supabase
    .from('daily_features')
    .select('asset_id, return_1d')
    .order('date', { ascending: false })
    .limit(500)
  
  // Dedupe to get latest per asset
  const latestFeatures = new Map()
  for (const f of (allFeatures || [])) {
    if (!latestFeatures.has(f.asset_id)) {
      latestFeatures.set(f.asset_id, f)
    }
  }
  
  const advancing = [...latestFeatures.values()].filter(f => f.return_1d > 0).length
  const declining = [...latestFeatures.values()].filter(f => f.return_1d < 0).length
  
  // Build index map
  const indexMap = new Map()
  for (const asset of (indexAssets || [])) {
    const bar = (indexBars || []).find(b => b.asset_id === asset.asset_id)
    const feature = (indexFeatures || []).find(f => f.asset_id === asset.asset_id)
    indexMap.set(asset.symbol, {
      symbol: asset.symbol,
      price: bar?.close || 0,
      change_1d: (feature?.return_1d || 0) * 100,
      change_5d: (feature?.return_5d || 0) * 100
    })
  }
  
  return {
    macro,
    indices: indexSymbols.map(s => indexMap.get(s)).filter(Boolean),
    breadth: {
      advancing,
      declining,
      total: latestFeatures.size
    }
  }
}

async function fetchMacroContextData(supabase: SupabaseClient) {
  console.log('[MacroContext] Fetching data...')
  
  // Get macro metrics history (last 30 days for trends)
  const { data: macroHistory } = await supabase
    .from('daily_macro_metrics')
    .select('*')
    .order('date', { ascending: false })
    .limit(30)
  
  // Get commodity data
  const { data: commodityAssets } = await supabase
    .from('assets')
    .select('asset_id, symbol')
    .in('symbol', ['CL', 'GC', 'HG']) // Oil, Gold, Copper futures
  
  const commodityIds = (commodityAssets || []).map(a => a.asset_id)
  
  const { data: commodityBars } = await supabase
    .from('daily_bars')
    .select('asset_id, close, date')
    .in('asset_id', commodityIds)
    .order('date', { ascending: false })
  
  return {
    macroHistory: macroHistory || [],
    commodities: commodityAssets?.map(a => ({
      symbol: a.symbol,
      price: commodityBars?.find(b => b.asset_id === a.asset_id)?.close || 0
    })) || []
  }
}

async function fetchSetupSignalsData(supabase: SupabaseClient) {
  console.log('[SetupSignals] Fetching data...')
  
  // Get recent setup signals (last 3 days to ensure we have data)
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const dateFilter = threeDaysAgo.toISOString().split('T')[0]
  
  const { data: setups, error: setupError } = await supabase
    .from('setup_signals')
    .select(`
      *,
      assets!inner(asset_id, symbol, name, asset_type, sector)
    `)
    .gte('signal_date', dateFilter)
    .order('risk_reward', { ascending: false })
    .limit(50)
  
  if (setupError) {
    console.error('[SetupSignals] Error fetching setups:', setupError)
  }
  console.log(`[SetupSignals] Found ${setups?.length || 0} setups since ${dateFilter}`)
  
  // Get FVS scores for the assets with setups
  const assetIds = (setups || []).map(s => s.asset_id)
  
  const { data: fvsScores } = await supabase
    .from('fundamental_vigor_scores')
    .select('asset_id, final_score, profitability_score, growth_score')
    .in('asset_id', assetIds)
    .order('as_of_date', { ascending: false })
  
  // Get AI reviews
  const { data: aiReviews } = await supabase
    .from('asset_ai_reviews')
    .select('asset_id, ai_summary_text, direction, attention_level')
    .in('asset_id', assetIds)
    .order('as_of_date', { ascending: false })
  
  // Get daily features for technical data
  const { data: features } = await supabase
    .from('daily_features')
    .select('asset_id, rsi_14, macd_histogram, bb_pct, return_1d, atr_pct')
    .in('asset_id', assetIds)
    .order('date', { ascending: false })
  
  // Get current prices
  const { data: bars } = await supabase
    .from('daily_bars')
    .select('asset_id, close, volume')
    .in('asset_id', assetIds)
    .order('date', { ascending: false })
  
  // Build maps for deduplication
  const fvsMap = new Map()
  for (const f of (fvsScores || [])) {
    if (!fvsMap.has(f.asset_id)) fvsMap.set(f.asset_id, f)
  }
  
  const reviewMap = new Map()
  for (const r of (aiReviews || [])) {
    if (!reviewMap.has(r.asset_id)) reviewMap.set(r.asset_id, r)
  }
  
  const featureMap = new Map()
  for (const f of (features || [])) {
    if (!featureMap.has(f.asset_id)) featureMap.set(f.asset_id, f)
  }
  
  const barMap = new Map()
  for (const b of (bars || [])) {
    if (!barMap.has(b.asset_id)) barMap.set(b.asset_id, b)
  }
  
  return {
    setups: (setups || []).map(s => ({
      ...s,
      fvs: fvsMap.get(s.asset_id),
      review: reviewMap.get(s.asset_id),
      features: featureMap.get(s.asset_id),
      bar: barMap.get(s.asset_id)
    }))
  }
}

async function fetchSignalFactsData(supabase: SupabaseClient) {
  console.log('[SignalFacts] Fetching data...')
  
  // Get active signals with asset info
  const { data: signals } = await supabase
    .from('daily_signal_facts')
    .select(`
      *,
      assets!inner(symbol, name, asset_type)
    `)
    .eq('is_active', true)
    .order('strength', { ascending: false })
    .limit(200)
  
  // Group by signal type
  const signalGroups = new Map<string, typeof signals>()
  for (const signal of (signals || [])) {
    const type = signal.signal_name || signal.signal_type
    if (!signalGroups.has(type)) {
      signalGroups.set(type, [])
    }
    signalGroups.get(type)!.push(signal)
  }
  
  return {
    signals: signals || [],
    signalGroups: Object.fromEntries(signalGroups)
  }
}

async function fetchFundamentalLeadersData(supabase: SupabaseClient) {
  console.log('[FundamentalLeaders] Fetching data...')
  
  // Get top FVS scores
  const { data: topFvs } = await supabase
    .from('fundamental_vigor_scores')
    .select(`
      *,
      assets!inner(asset_id, symbol, name, asset_type)
    `)
    .gte('final_score', 70)
    .order('final_score', { ascending: false })
    .limit(20)
  
  return {
    leaders: topFvs || []
  }
}

async function fetchPortfolioData(supabase: SupabaseClient) {
  console.log('[Portfolio] Fetching data...')
  
  // Get active portfolio holdings
  const { data: holdings, error: holdingsError } = await supabase
    .from('core_portfolio_holdings')
    .select('*')
    .eq('is_active', true)
    .order('display_order')
  
  if (holdingsError) {
    console.error('[Portfolio] Error fetching holdings:', holdingsError)
  }
  console.log(`[Portfolio] Found ${holdings?.length || 0} active holdings`)
  
  if (!holdings || holdings.length === 0) {
    console.log('[Portfolio] No holdings found, returning null')
    return { holdings: [] }
  }
  
  // Get asset IDs for holdings that have them
  const assetIds = holdings.filter(h => h.asset_id).map(h => h.asset_id)
  
  // Get current prices
  const { data: bars } = await supabase
    .from('daily_bars')
    .select('asset_id, close, date')
    .in('asset_id', assetIds)
    .order('date', { ascending: false })
  
  // Get signals on held assets
  const { data: signals } = await supabase
    .from('daily_signal_facts')
    .select('asset_id, signal_name, direction')
    .in('asset_id', assetIds)
    .eq('is_active', true)
  
  // Get FVS scores for held assets
  const { data: fvsScores } = await supabase
    .from('fundamental_vigor_scores')
    .select('asset_id, final_score')
    .in('asset_id', assetIds)
    .order('as_of_date', { ascending: false })
  
  // Build maps
  const barMap = new Map()
  for (const b of (bars || [])) {
    if (!barMap.has(b.asset_id)) barMap.set(b.asset_id, b)
  }
  
  const signalMap = new Map<number, string[]>()
  for (const s of (signals || [])) {
    if (!signalMap.has(s.asset_id)) signalMap.set(s.asset_id, [])
    signalMap.get(s.asset_id)!.push(s.signal_name)
  }
  
  const fvsMap = new Map()
  for (const f of (fvsScores || [])) {
    if (!fvsMap.has(f.asset_id)) fvsMap.set(f.asset_id, f)
  }
  
  return {
    holdings: holdings.map(h => ({
      ...h,
      current_price: h.asset_id ? barMap.get(h.asset_id)?.close : h.manual_price,
      signals: h.asset_id ? signalMap.get(h.asset_id) || [] : [],
      fvs_score: h.asset_id ? fvsMap.get(h.asset_id)?.final_score : null
    }))
  }
}

async function fetchCryptoData(supabase: SupabaseClient) {
  console.log('[Crypto] Fetching data...')
  
  // Get all crypto assets with their data
  const { data: cryptoAssets } = await supabase
    .from('assets')
    .select('asset_id, symbol, name')
    .eq('asset_type', 'crypto')
    .eq('is_active', true)
  
  const cryptoIds = (cryptoAssets || []).map(a => a.asset_id)
  
  // Get latest prices and features
  const { data: bars } = await supabase
    .from('daily_bars')
    .select('asset_id, close, volume, date')
    .in('asset_id', cryptoIds)
    .order('date', { ascending: false })
  
  const { data: features } = await supabase
    .from('daily_features')
    .select('asset_id, return_1d, return_5d, rsi_14')
    .in('asset_id', cryptoIds)
    .order('date', { ascending: false })
  
  // Get active crypto setups
  const { data: setups } = await supabase
    .from('setup_signals')
    .select('*')
    .in('asset_id', cryptoIds)
    .eq('is_active', true)
  
  // Build maps
  const barMap = new Map()
  for (const b of (bars || [])) {
    if (!barMap.has(b.asset_id)) barMap.set(b.asset_id, b)
  }
  
  const featureMap = new Map()
  for (const f of (features || [])) {
    if (!featureMap.has(f.asset_id)) featureMap.set(f.asset_id, f)
  }
  
  return {
    assets: (cryptoAssets || []).map(a => ({
      ...a,
      bar: barMap.get(a.asset_id),
      features: featureMap.get(a.asset_id)
    })),
    setups: setups || []
  }
}

async function fetchSectorData(supabase: SupabaseClient) {
  console.log('[Sector] Fetching data...')
  
  // Get equity assets grouped by sector
  const { data: equities } = await supabase
    .from('assets')
    .select('asset_id, symbol, name, sector')
    .eq('asset_type', 'equity')
    .eq('is_active', true)
    .not('sector', 'is', null)
  
  const equityIds = (equities || []).map(a => a.asset_id)
  
  // Get features for performance calculation
  const { data: features } = await supabase
    .from('daily_features')
    .select('asset_id, return_1d, return_5d')
    .in('asset_id', equityIds)
    .order('date', { ascending: false })
  
  // Build feature map
  const featureMap = new Map()
  for (const f of (features || [])) {
    if (!featureMap.has(f.asset_id)) featureMap.set(f.asset_id, f)
  }
  
  // Group by sector
  const sectorGroups = new Map<string, typeof equities>()
  for (const equity of (equities || [])) {
    if (!equity.sector) continue
    if (!sectorGroups.has(equity.sector)) {
      sectorGroups.set(equity.sector, [])
    }
    sectorGroups.get(equity.sector)!.push({
      ...equity,
      features: featureMap.get(equity.asset_id)
    })
  }
  
  return {
    sectorGroups: Object.fromEntries(sectorGroups)
  }
}

// ============================================================================
// GEMINI SECTION GENERATORS
// ============================================================================

async function callGemini(prompt: string, systemPrompt: string): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  console.log(`[Gemini] Calling ${GEMINI_MODEL}...`)
  const startTime = Date.now()
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + prompt }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json'
          }
        })
      }
    )
    
    const elapsed = Date.now() - startTime
    console.log(`[Gemini] Response received in ${elapsed}ms`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const tokensIn = result.usageMetadata?.promptTokenCount || 0
    const tokensOut = result.usageMetadata?.candidatesTokenCount || 0
    
    console.log(`[Gemini] Tokens: ${tokensIn} in, ${tokensOut} out`)
    
    return { text, tokensIn, tokensOut }
  } catch (error) {
    console.error('[Gemini] Error:', error)
    throw error
  }
}

async function generateMarketPulse(data: Awaited<ReturnType<typeof fetchMarketPulseData>>): Promise<{ section: MarketPulse; tokens: { in: number; out: number } }> {
  const systemPrompt = `You are the Stratos CIO Agent generating the Market Pulse section of the daily brief.

Your task is to analyze the provided market data and generate a concise market pulse summary.

Output a JSON object with this exact structure:
{
  "regime": "risk-on" | "risk-off" | "neutral",
  "regime_confidence": number (0-100),
  "summary": "string - 2-3 sentences summarizing market conditions",
  "dominant_theme": "string - the main theme driving markets today",
  "key_indices": [
    { "symbol": "string", "price": number, "change_1d": number, "change_5d": number }
  ],
  "market_breadth": {
    "advancing": number,
    "declining": number,
    "new_highs": number,
    "new_lows": number
  },
  "fear_greed_indicator": number (0-100, 0=extreme fear, 100=extreme greed)
}

Be concise and actionable. Focus on what matters for trading decisions.`

  const prompt = `Market Data:

Macro Metrics: ${JSON.stringify(data.macro, null, 2)}

Key Indices: ${JSON.stringify(data.indices, null, 2)}

Market Breadth:
- Advancing: ${data.breadth.advancing}
- Declining: ${data.breadth.declining}
- Total Assets: ${data.breadth.total}

Generate the Market Pulse section.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as MarketPulse
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Market Pulse:', text)
    throw new Error('Failed to parse Market Pulse response')
  }
}

// Section generators with AI analysis
async function generateMacroContext(data: Awaited<ReturnType<typeof fetchMacroContextData>>): Promise<{ section: MacroContext; tokens: { in: number; out: number } }> {
  const systemPrompt = `You are the Stratos CIO Agent generating the Macro Context section of the daily brief.

Your task is to analyze the macroeconomic data and provide context for trading decisions.

Output a JSON object with this exact structure:
{
  "yield_curve": {
    "status": "inverted" | "flat" | "normal" | "steepening",
    "spread_10y_2y": number,
    "trend": "string describing recent trend"
  },
  "rates": {
    "fed_funds": number,
    "ten_year": number,
    "direction": "rising" | "falling" | "stable"
  },
  "inflation": {
    "cpi_yoy": number,
    "trend": "string describing inflation trend"
  },
  "commodities": {
    "oil": { "price": number, "change": number },
    "gold": { "price": number, "change": number },
    "copper": { "price": number, "change": number }
  },
  "sector_rotation": {
    "leading": ["array of leading sectors"],
    "lagging": ["array of lagging sectors"],
    "rotation_signal": "string describing rotation pattern"
  },
  "risk_assessment": "string - 2-3 sentences on macro risk environment"
}

Focus on actionable insights for traders. Be specific about what the macro environment means for positioning.`

  // Get latest macro data
  const latest = data.macroHistory[0]
  const previous = data.macroHistory[1]
  
  const prompt = `Macro Data (Latest):
${JSON.stringify(latest, null, 2)}

Macro Data (Previous Day):
${JSON.stringify(previous, null, 2)}

Macro History (Last 7 days for trend analysis):
${JSON.stringify(data.macroHistory.slice(0, 7), null, 2)}

Generate the Macro Context section based on this data.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as MacroContext
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Macro Context:', text)
    // Return fallback with actual data
    return {
      section: {
        yield_curve: {
          status: latest?.yield_curve_10y_2y > 0 ? 'normal' : 'inverted',
          spread_10y_2y: parseFloat(latest?.yield_curve_10y_2y) || 0,
          trend: 'Unable to analyze trend'
        },
        rates: {
          fed_funds: 4.5,
          ten_year: parseFloat(latest?.us10y_yield) || 0,
          direction: 'stable'
        },
        inflation: {
          cpi_yoy: parseFloat(latest?.cpi_yoy) || 0,
          trend: 'Unknown'
        },
        commodities: {
          oil: { price: parseFloat(latest?.oil_close) || 0, change: 0 },
          gold: { price: parseFloat(latest?.gold_close) || 0, change: 0 },
          copper: { price: parseFloat(latest?.copper_close) || 0, change: 0 }
        },
        sector_rotation: { leading: [], lagging: [], rotation_signal: 'neutral' },
        risk_assessment: 'Unable to generate AI analysis'
      },
      tokens: { in: tokensIn, out: tokensOut }
    }
  }
}

async function generateTechnicalClusters(data: Awaited<ReturnType<typeof fetchSetupSignalsData>>): Promise<{ section: TechnicalCluster[]; tokens: { in: number; out: number } }> {
  if (!data.setups || data.setups.length === 0) {
    return { section: [], tokens: { in: 0, out: 0 } }
  }

  const systemPrompt = `You are the Stratos CIO Agent generating the Technical Clusters section.

Your task is to identify THEMATIC CLUSTERS of assets that are moving together or have similar setups.
Stocks rarely move alone - find the common threads.

Output a JSON array of clusters with this structure:
[
  {
    "theme_name": "string - descriptive name like 'Energy Breakouts' or 'Tech Mean Reversion'",
    "urgency": "HIGH" | "MEDIUM" | "LOW",
    "description": "string - 1-2 sentences on why these assets are grouped",
    "catalyst": "string - what's driving this theme",
    "assets": [
      {
        "symbol": "string",
        "name": "string",
        "price": number,
        "change_1d": number,
        "setup_type": "string",
        "signal_strength": number
      }
    ],
    "aggregate_conviction": number (0-100)
  }
]

Rules:
- Only create clusters with 3+ assets
- Maximum 5 clusters
- Group by sector, setup type, or technical pattern
- HIGH urgency = actionable today, MEDIUM = developing, LOW = watch list
- Be specific about the catalyst driving the cluster`

  // Prepare setup data for clustering
  const setupSummary = data.setups.map(s => ({
    symbol: s.assets?.symbol,
    name: s.assets?.name,
    sector: s.assets?.sector,
    asset_type: s.assets?.asset_type,
    setup_type: s.setup_type,
    direction: s.direction,
    entry: s.entry_price,
    target: s.target_price,
    stop: s.stop_loss,
    risk_reward: s.risk_reward,
    price: s.bar?.close,
    change_1d: (s.features?.return_1d || 0) * 100,
    rsi: s.features?.rsi_14,
    fvs: s.fvs?.final_score
  }))

  const prompt = `Active Setup Signals (${setupSummary.length} total):
${JSON.stringify(setupSummary, null, 2)}

Identify thematic clusters from these setups. Look for:
- Sector groupings (e.g., multiple energy stocks breaking out)
- Setup type groupings (e.g., multiple mean reversion plays)
- Technical pattern groupings (e.g., multiple oversold bounces)

Generate the Technical Clusters section.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as TechnicalCluster[]
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Technical Clusters:', text)
    return { section: [], tokens: { in: tokensIn, out: tokensOut } }
  }
}

async function generateTopSetups(data: Awaited<ReturnType<typeof fetchSetupSignalsData>>): Promise<{ section: TopSetup[]; tokens: { in: number; out: number } }> {
  if (!data.setups || data.setups.length === 0) {
    return { section: [], tokens: { in: 0, out: 0 } }
  }

  const systemPrompt = `You are the Stratos CIO Agent generating the Top Individual Setups section.

Your task is to identify the BEST risk/reward setups from the data provided.
Apply the "Alpha Over Noise" principle - explain WHY each setup is tradeable.

Output a JSON array of top setups with this structure:
[
  {
    "asset_id": number,
    "symbol": "string",
    "name": "string",
    "asset_type": "crypto" | "equity",
    "price": number,
    "change_1d": number,
    "setup_type": "string - e.g., 'Breakout', 'Mean Reversion', 'Trend Continuation'",
    "entry_price": number,
    "stop_loss": number,
    "target_price": number,
    "risk_reward": number,
    "fvs_score": number | null,
    "fvs_label": "Quality Growth" | "Speculative Momentum" | "Value" | null,
    "ai_conviction": number (0-100),
    "reasoning": "string - 2-3 sentences on why this is a top setup",
    "bear_case": "string - 1-2 sentences on what could go wrong",
    "signals": ["array of active signal names"],
    "volume_warning": boolean
  }
]

Rules:
- Maximum 10 setups
- Sort by conviction (best first)
- FVS >= 60 = "Quality Growth", FVS 40-60 = "Value", FVS < 40 = "Speculative Momentum"
- Include a bear case for EVERY setup (skepticism first)
- Flag volume_warning if volume is unusually low
- Prefer setups with R:R >= 2.0`

  // Prepare setup data
  const setupSummary = data.setups.slice(0, 30).map(s => ({
    asset_id: s.asset_id,
    symbol: s.assets?.symbol,
    name: s.assets?.name,
    asset_type: s.assets?.asset_type,
    sector: s.assets?.sector,
    setup_type: s.setup_type,
    direction: s.direction,
    entry: s.entry_price,
    target: s.target_price,
    stop: s.stop_loss,
    risk_reward: s.risk_reward,
    price: s.bar?.close,
    volume: s.bar?.volume,
    change_1d: (s.features?.return_1d || 0) * 100,
    rsi: s.features?.rsi_14,
    macd: s.features?.macd_histogram,
    atr_pct: s.features?.atr_pct,
    fvs: s.fvs?.final_score,
    ai_direction: s.review?.direction,
    ai_attention: s.review?.attention_level,
    ai_summary: s.review?.ai_summary_text?.substring(0, 200)
  }))

  const prompt = `Active Setup Signals (Top ${setupSummary.length} by R:R):
${JSON.stringify(setupSummary, null, 2)}

Select the best setups and provide detailed analysis for each.
Remember: Quality over quantity. Only include setups you would actually trade.

Generate the Top Setups section.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as TopSetup[]
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Top Setups:', text)
    return { section: [], tokens: { in: tokensIn, out: tokensOut } }
  }
}

async function generateFundamentalLeaders(data: Awaited<ReturnType<typeof fetchFundamentalLeadersData>>): Promise<{ section: FundamentalLeader[]; tokens: { in: number; out: number } }> {
  if (!data.leaders || data.leaders.length === 0) {
    return { section: [], tokens: { in: 0, out: 0 } }
  }

  // Transform the data directly without AI call for this section
  const section: FundamentalLeader[] = data.leaders.slice(0, 10).map(l => ({
    asset_id: l.assets?.asset_id || l.asset_id,
    symbol: l.assets?.symbol || '',
    name: l.assets?.name || '',
    fvs_score: parseFloat(l.final_score) || 0,
    profitability_score: parseFloat(l.profitability_score) || 0,
    solvency_score: parseFloat(l.solvency_score) || 0,
    growth_score: parseFloat(l.growth_score) || 0,
    moat_score: parseFloat(l.moat_score) || 0,
    piotroski_f: parseFloat(l.piotroski_f_score) || 0,
    altman_z: parseFloat(l.altman_z_score) || 0,
    ai_summary: l.final_reasoning_paragraph || ''
  }))

  return { section, tokens: { in: 0, out: 0 } }
}

async function generateSignalAlerts(data: Awaited<ReturnType<typeof fetchSignalFactsData>>): Promise<{ section: SignalAlert[]; tokens: { in: number; out: number } }> {
  if (!data.signals || data.signals.length === 0) {
    return { section: [], tokens: { in: 0, out: 0 } }
  }

  const systemPrompt = `You are the Stratos CIO Agent generating the Signal Alerts section.

Your task is to summarize the most significant technical signals firing across the market.

Output a JSON array of signal alerts with this structure:
[
  {
    "signal_type": "string - signal name",
    "direction": "bullish" | "bearish",
    "strength": number (0-100),
    "count": number,
    "is_new_today": boolean,
    "notable_assets": ["array of symbols"],
    "interpretation": "string - what this signal means for trading"
  }
]

Rules:
- Maximum 8 signal types
- Group similar signals
- Focus on actionable signals
- Explain what each signal means in plain English`

  const signalSummary = Object.entries(data.signalGroups).map(([type, signals]) => ({
    signal_type: type,
    count: (signals as unknown[]).length,
    assets: (signals as { assets?: { symbol?: string }; direction?: string; strength?: number }[]).slice(0, 5).map(s => ({
      symbol: s.assets?.symbol,
      direction: s.direction,
      strength: s.strength
    }))
  }))

  const prompt = `Signal Summary by Type:
${JSON.stringify(signalSummary, null, 2)}

Generate the Signal Alerts section.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as SignalAlert[]
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Signal Alerts:', text)
    return { section: [], tokens: { in: tokensIn, out: tokensOut } }
  }
}

async function generateSkepticsCorner(
  setupData: Awaited<ReturnType<typeof fetchSetupSignalsData>>,
  signalData: Awaited<ReturnType<typeof fetchSignalFactsData>>
): Promise<{ section: SkepticWarning[]; tokens: { in: number; out: number } }> {
  const systemPrompt = `You are the Stratos CIO Agent generating the Skeptic's Corner section.

Your task is to identify RISKS and WARNING SIGNS in the current market.
Be the devil's advocate - find what could go wrong.

Output a JSON array of warnings with this structure:
[
  {
    "warning_type": "overbought" | "low_quality" | "liquidity" | "fundamental_risk" | "bearish_signal",
    "severity": "high" | "medium" | "low",
    "assets": ["array of affected symbols"],
    "explanation": "string - 1-2 sentences on the risk"
  }
]

Look for:
- Overbought conditions (RSI > 70)
- Low quality setups (FVS < 40)
- Liquidity concerns (low volume)
- Fundamental risks
- Bearish signals on popular assets`

  // Find potential warnings
  const overbought = setupData.setups.filter(s => (s.features?.rsi_14 || 50) > 70)
  const lowQuality = setupData.setups.filter(s => (s.fvs?.final_score || 100) < 40)
  const bearishSignals = signalData.signals.filter(s => s.direction === 'bearish')

  const prompt = `Potential Warning Signs:

Overbought Assets (RSI > 70):
${JSON.stringify(overbought.slice(0, 10).map(s => ({ symbol: s.assets?.symbol, rsi: s.features?.rsi_14 })), null, 2)}

Low Quality Setups (FVS < 40):
${JSON.stringify(lowQuality.slice(0, 10).map(s => ({ symbol: s.assets?.symbol, fvs: s.fvs?.final_score })), null, 2)}

Bearish Signals:
${JSON.stringify(bearishSignals.slice(0, 10).map(s => ({ symbol: s.assets?.symbol, signal: s.signal_name })), null, 2)}

Generate the Skeptic's Corner section.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as SkepticWarning[]
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Skeptics Corner:', text)
    return { section: [], tokens: { in: tokensIn, out: tokensOut } }
  }
}

async function generateSectorAnalysis(data: Awaited<ReturnType<typeof fetchSectorData>>): Promise<{ section: SectorAnalysis[]; tokens: { in: number; out: number } }> {
  if (Object.keys(data.sectorGroups).length === 0) {
    return { section: [], tokens: { in: 0, out: 0 } }
  }

  const systemPrompt = `You are the Stratos CIO Agent generating the Sector Analysis section.

Your task is to analyze sector performance and rotation.

Output a JSON array of sector analyses with this structure:
[
  {
    "sector": "string",
    "performance_1d": number,
    "performance_5d": number,
    "sentiment": "bullish" | "bearish" | "neutral",
    "money_flow": "inflow" | "outflow" | "neutral",
    "top_performers": ["array of symbols"],
    "laggards": ["array of symbols"],
    "key_themes": ["array of theme strings"]
  }
]

Rules:
- Include all sectors with data
- Calculate average performance
- Identify rotation patterns`

  // Calculate sector stats
  const sectorStats = Object.entries(data.sectorGroups).map(([sector, assets]) => {
    const assetList = assets as { symbol?: string; features?: { return_1d?: number; return_5d?: number } }[]
    const returns1d = assetList.map(a => (a.features?.return_1d || 0) * 100)
    const returns5d = assetList.map(a => (a.features?.return_5d || 0) * 100)
    const avgReturn1d = returns1d.reduce((a, b) => a + b, 0) / returns1d.length
    const avgReturn5d = returns5d.reduce((a, b) => a + b, 0) / returns5d.length
    
    const sorted = [...assetList].sort((a, b) => 
      ((b.features?.return_1d || 0) - (a.features?.return_1d || 0))
    )
    
    return {
      sector,
      count: assetList.length,
      avg_return_1d: avgReturn1d,
      avg_return_5d: avgReturn5d,
      top_performers: sorted.slice(0, 3).map(a => a.symbol),
      laggards: sorted.slice(-3).map(a => a.symbol)
    }
  })

  const prompt = `Sector Performance Data:
${JSON.stringify(sectorStats, null, 2)}

Generate the Sector Analysis section.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as SectorAnalysis[]
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Sector Analysis:', text)
    return { section: [], tokens: { in: tokensIn, out: tokensOut } }
  }
}

async function generatePortfolioAnalysis(data: Awaited<ReturnType<typeof fetchPortfolioData>>): Promise<{ section: PortfolioAnalysis | null; tokens: { in: number; out: number } }> {
  if (!data || !data.holdings || data.holdings.length === 0) {
    return { section: null, tokens: { in: 0, out: 0 } }
  }

  const systemPrompt = `You are the Stratos CIO Agent generating the Portfolio Analysis section.

Your task is to analyze the current portfolio and provide management recommendations.

Output a JSON object with this structure:
{
  "total_value": number,
  "cash_position": number,
  "cash_percentage": number,
  "allocation": [
    {
      "category": "string - e.g., 'Equities', 'Crypto', 'Options', 'Cash'",
      "value": number,
      "percentage": number,
      "change_1d": number
    }
  ],
  "positions": [
    {
      "symbol": "string",
      "quantity": number,
      "cost_basis": number,
      "current_price": number,
      "market_value": number,
      "unrealized_pnl": number,
      "unrealized_pnl_pct": number,
      "weight": number,
      "signals_active": ["array of signal names"],
      "fvs_score": number | null
    }
  ],
  "concentration_warnings": ["array of warning strings"],
  "signals_on_holdings": [
    { "symbol": "string", "signal": "string", "direction": "string" }
  ],
  "rebalancing_suggestions": ["array of suggestion strings"],
  "risk_assessment": "string - 2-3 sentences on portfolio risk"
}

Focus on:
- Position sizing and concentration
- P&L analysis
- Active signals on holdings
- Rebalancing opportunities`

  // Calculate portfolio metrics
  const holdings = data.holdings
  let totalValue = 0
  let cashPosition = 0
  
  const positions = holdings.map(h => {
    const currentPrice = h.current_price || h.manual_price || 0
    const marketValue = h.quantity * currentPrice
    const costBasis = h.cost_basis || 0
    const unrealizedPnl = marketValue - (h.quantity * costBasis)
    const unrealizedPnlPct = costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0
    
    if (h.category === 'cash') {
      cashPosition += marketValue
    }
    totalValue += marketValue
    
    return {
      symbol: h.symbol,
      category: h.category,
      quantity: h.quantity,
      cost_basis: costBasis,
      current_price: currentPrice,
      market_value: marketValue,
      unrealized_pnl: unrealizedPnl,
      unrealized_pnl_pct: unrealizedPnlPct,
      signals: h.signals || [],
      fvs_score: h.fvs_score
    }
  })

  const prompt = `Portfolio Holdings:
${JSON.stringify(positions, null, 2)}

Total Portfolio Value: $${totalValue.toLocaleString()}
Cash Position: $${cashPosition.toLocaleString()}

Generate the Portfolio Analysis section with management recommendations.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as PortfolioAnalysis
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Portfolio Analysis:', text)
    return { section: null, tokens: { in: tokensIn, out: tokensOut } }
  }
}

async function generateCryptoSpotlight(data: Awaited<ReturnType<typeof fetchCryptoData>>): Promise<{ section: CryptoSpotlight; tokens: { in: number; out: number } }> {
  if (!data.assets || data.assets.length === 0) {
    return {
      section: {
        btc_dominance: 50,
        total_market_cap: 0,
        market_cap_change_24h: 0,
        top_movers: [],
        active_setups: [],
        defi_themes: [],
        narrative_summary: 'No crypto data available'
      },
      tokens: { in: 0, out: 0 }
    }
  }

  const systemPrompt = `You are the Stratos CIO Agent generating the Crypto Spotlight section.

Your task is to analyze the cryptocurrency market and highlight opportunities.

Output a JSON object with this structure:
{
  "btc_dominance": number (estimated),
  "total_market_cap": number,
  "market_cap_change_24h": number,
  "top_movers": [
    {
      "symbol": "string",
      "name": "string",
      "price": number,
      "change_24h": number,
      "volume_24h": number
    }
  ],
  "active_setups": [],
  "defi_themes": ["array of current DeFi narratives"],
  "narrative_summary": "string - 2-3 sentences on crypto market narrative"
}

Focus on:
- Major movers and why
- Active trading setups
- Current narratives (DeFi, L2s, AI tokens, etc.)`

  // Prepare crypto data
  const cryptoSummary = data.assets.map(a => ({
    symbol: a.symbol,
    name: a.name,
    price: a.bar?.close || 0,
    change_24h: (a.features?.return_1d || 0) * 100,
    volume: a.bar?.volume || 0,
    rsi: a.features?.rsi_14
  })).sort((a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h))

  const prompt = `Crypto Assets (${cryptoSummary.length} total, sorted by absolute change):
${JSON.stringify(cryptoSummary.slice(0, 20), null, 2)}

Active Crypto Setups:
${JSON.stringify(data.setups.slice(0, 10), null, 2)}

Generate the Crypto Spotlight section.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as CryptoSpotlight
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Crypto Spotlight:', text)
    return {
      section: {
        btc_dominance: 50,
        total_market_cap: 0,
        market_cap_change_24h: 0,
        top_movers: cryptoSummary.slice(0, 5).map(c => ({
          symbol: c.symbol,
          name: c.name,
          price: c.price,
          change_24h: c.change_24h,
          volume_24h: c.volume
        })),
        active_setups: [],
        defi_themes: [],
        narrative_summary: 'Unable to generate AI analysis'
      },
      tokens: { in: tokensIn, out: tokensOut }
    }
  }
}

async function generateActionItems(brief: Partial<DailyBriefV2>): Promise<{ section: ActionItem[]; tokens: { in: number; out: number } }> {
  const systemPrompt = `You are the Stratos CIO Agent generating the Action Items section.

Your task is to synthesize all the analysis into PRIORITIZED ACTION ITEMS.

Output a JSON array of action items with this structure:
[
  {
    "priority": "immediate" | "watch" | "research",
    "action_type": "entry" | "exit" | "add" | "reduce" | "monitor",
    "symbol": "string",
    "description": "string - what to do",
    "trigger": "string - when to act",
    "reasoning": "string - why this action"
  }
]

Rules:
- Maximum 10 action items
- "immediate" = act today
- "watch" = wait for trigger
- "research" = needs more analysis
- Be specific about triggers
- Link back to the analysis that supports each action`

  // Summarize the brief for action item generation
  const briefSummary = {
    regime: brief.market_pulse?.regime,
    top_setups: brief.top_setups?.slice(0, 5).map(s => ({
      symbol: s.symbol,
      setup_type: s.setup_type,
      entry: s.entry_price,
      conviction: s.ai_conviction
    })),
    signals: brief.signal_alerts?.slice(0, 5).map(s => ({
      type: s.signal_type,
      direction: s.direction,
      assets: s.notable_assets
    })),
    warnings: brief.skeptics_corner?.map(w => ({
      type: w.warning_type,
      assets: w.assets
    })),
    portfolio_signals: brief.portfolio_analysis?.signals_on_holdings
  }

  const prompt = `Brief Summary for Action Items:
${JSON.stringify(briefSummary, null, 2)}

Generate prioritized action items based on this analysis.
Focus on the most actionable opportunities and risks.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const section = JSON.parse(text) as ActionItem[]
    return { section, tokens: { in: tokensIn, out: tokensOut } }
  } catch (e) {
    console.error('Failed to parse Action Items:', text)
    return { section: [], tokens: { in: tokensIn, out: tokensOut } }
  }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function generateDailyBrief(supabase: SupabaseClient): Promise<DailyBriefV2> {
  const startTime = Date.now()
  const today = new Date().toISOString().split('T')[0]
  
  let totalTokensIn = 0
  let totalTokensOut = 0
  let sectionsGenerated = 0
  
  console.log('=== Starting Daily Brief Generation ===')
  console.log(`Date: ${today}`)
  console.log(`Model: ${GEMINI_MODEL}`)
  
  // Fetch all data in parallel
  console.log('\n--- Fetching Data ---')
  const [
    marketPulseData,
    macroContextData,
    setupSignalsData,
    signalFactsData,
    fundamentalLeadersData,
    portfolioData,
    cryptoData,
    sectorData
  ] = await Promise.all([
    fetchMarketPulseData(supabase),
    fetchMacroContextData(supabase),
    fetchSetupSignalsData(supabase),
    fetchSignalFactsData(supabase),
    fetchFundamentalLeadersData(supabase),
    fetchPortfolioData(supabase),
    fetchCryptoData(supabase),
    fetchSectorData(supabase)
  ])
  
  console.log('\n--- Generating Sections (Parallel Batch 1) ---')
  
  // Batch 1: Generate independent sections in parallel
  const [marketPulseResult, macroContextResult, fundamentalLeadersResult] = await Promise.all([
    generateMarketPulse(marketPulseData).catch(e => {
      console.error('Market Pulse failed:', e)
      return { section: { regime: 'unknown', confidence: 0, summary: 'Generation failed', dominant_theme: '', fear_greed: 50, indices: [], breadth: { advancing: 0, declining: 0, ratio: 1 } } as MarketPulse, tokens: { in: 0, out: 0 } }
    }),
    generateMacroContext(macroContextData).catch(e => {
      console.error('Macro Context failed:', e)
      return { section: { yield_curve: { status: 'unknown', spread_10y_2y: 0, trend: '' }, rates: { fed_funds: 0, ten_year: 0, direction: 'stable' }, inflation: { cpi_yoy: 0, trend: '' }, commodities: { oil: { price: 0, change: 0 }, gold: { price: 0, change: 0 }, copper: { price: 0, change: 0 } }, sector_rotation: { leading: [], lagging: [], rotation_signal: '' }, risk_assessment: 'Generation failed' } as MacroContext, tokens: { in: 0, out: 0 } }
    }),
    generateFundamentalLeaders(fundamentalLeadersData).catch(e => {
      console.error('Fundamental Leaders failed:', e)
      return { section: [] as FundamentalLeader[], tokens: { in: 0, out: 0 } }
    })
  ])
  
  totalTokensIn += marketPulseResult.tokens.in + macroContextResult.tokens.in
  totalTokensOut += marketPulseResult.tokens.out + macroContextResult.tokens.out
  sectionsGenerated += 3
  console.log('  ✓ Batch 1 complete (Market Pulse, Macro Context, Fundamental Leaders)')
  
  console.log('\n--- Generating Sections (Parallel Batch 2) ---')
  
  // Batch 2: Generate setup-dependent sections in parallel
  const [technicalClustersResult, topSetupsResult, signalAlertsResult] = await Promise.all([
    generateTechnicalClusters(setupSignalsData).catch(e => {
      console.error('Technical Clusters failed:', e)
      return { section: [] as TechnicalCluster[], tokens: { in: 0, out: 0 } }
    }),
    generateTopSetups(setupSignalsData).catch(e => {
      console.error('Top Setups failed:', e)
      return { section: [] as TopSetup[], tokens: { in: 0, out: 0 } }
    }),
    generateSignalAlerts(signalFactsData).catch(e => {
      console.error('Signal Alerts failed:', e)
      return { section: [] as SignalAlert[], tokens: { in: 0, out: 0 } }
    })
  ])
  
  totalTokensIn += technicalClustersResult.tokens.in + topSetupsResult.tokens.in + signalAlertsResult.tokens.in
  totalTokensOut += technicalClustersResult.tokens.out + topSetupsResult.tokens.out + signalAlertsResult.tokens.out
  sectionsGenerated += 3
  console.log('  ✓ Batch 2 complete (Technical Clusters, Top Setups, Signal Alerts)')
  
  console.log('\n--- Generating Sections (Parallel Batch 3) ---')
  
  // Batch 3: Generate remaining sections in parallel
  const [skepticsCornerResult, sectorAnalysisResult, portfolioAnalysisResult, cryptoSpotlightResult] = await Promise.all([
    generateSkepticsCorner(setupSignalsData, signalFactsData).catch(e => {
      console.error('Skeptics Corner failed:', e)
      return { section: [] as SkepticWarning[], tokens: { in: 0, out: 0 } }
    }),
    generateSectorAnalysis(sectorData).catch(e => {
      console.error('Sector Analysis failed:', e)
      return { section: [] as SectorAnalysis[], tokens: { in: 0, out: 0 } }
    }),
    generatePortfolioAnalysis(portfolioData).catch(e => {
      console.error('Portfolio Analysis failed:', e)
      return { section: null, tokens: { in: 0, out: 0 } }
    }),
    generateCryptoSpotlight(cryptoData).catch(e => {
      console.error('Crypto Spotlight failed:', e)
      return { section: { btc_dominance: 0, total_market_cap: 0, market_cap_change_24h: 0, top_movers: [], active_setups: [], defi_themes: [], narrative_summary: 'Generation failed' } as CryptoSpotlight, tokens: { in: 0, out: 0 } }
    })
  ])
  
  totalTokensIn += skepticsCornerResult.tokens.in + sectorAnalysisResult.tokens.in + portfolioAnalysisResult.tokens.in + cryptoSpotlightResult.tokens.in
  totalTokensOut += skepticsCornerResult.tokens.out + sectorAnalysisResult.tokens.out + portfolioAnalysisResult.tokens.out + cryptoSpotlightResult.tokens.out
  sectionsGenerated += 4
  console.log('  ✓ Batch 3 complete (Skeptics Corner, Sector Analysis, Portfolio, Crypto)')
  
  // Build partial brief for action items synthesis
  const partialBrief: Partial<DailyBriefV2> = {
    market_pulse: marketPulseResult.section,
    top_setups: topSetupsResult.section,
    signal_alerts: signalAlertsResult.section,
    portfolio_analysis: portfolioAnalysisResult.section
  }
  
  console.log('Generating Action Items...')
  const actionItemsResult = await generateActionItems(partialBrief)
  sectionsGenerated++
  
  const endTime = Date.now()
  
  // Assemble final brief
  const brief: DailyBriefV2 = {
    brief_date: today,
    generated_at: new Date().toISOString(),
    model_used: GEMINI_MODEL,
    
    market_pulse: marketPulseResult.section,
    macro_context: macroContextResult.section,
    technical_clusters: technicalClustersResult.section,
    top_setups: topSetupsResult.section,
    fundamental_leaders: fundamentalLeadersResult.section,
    signal_alerts: signalAlertsResult.section,
    skeptics_corner: skepticsCornerResult.section,
    sector_analysis: sectorAnalysisResult.section,
    portfolio_analysis: portfolioAnalysisResult.section,
    crypto_spotlight: cryptoSpotlightResult.section,
    action_items: actionItemsResult.section,
    
    generation_stats: {
      total_tokens_in: totalTokensIn,
      total_tokens_out: totalTokensOut,
      sections_generated: sectionsGenerated,
      generation_time_ms: endTime - startTime
    }
  }
  
  console.log('\n=== Brief Generation Complete ===')
  console.log(`Sections: ${sectionsGenerated}`)
  console.log(`Tokens: ${totalTokensIn} in, ${totalTokensOut} out`)
  console.log(`Time: ${endTime - startTime}ms`)
  
  return brief
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()
    
    // GET /latest - Get the latest brief
    if (req.method === 'GET' && path === 'latest') {
      const { data: brief, error } = await supabase
        .from('daily_briefs_v2')
        .select('*')
        .order('brief_date', { ascending: false })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      return new Response(JSON.stringify(brief || null), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // POST /generate - Generate a new brief
    if (req.method === 'POST' && path === 'generate') {
      const brief = await generateDailyBrief(supabase)
      
      // Save to database
      const { data, error } = await supabase
        .from('daily_briefs_v2')
        .upsert({
          brief_date: brief.brief_date,
          generated_at: brief.generated_at,
          model_used: brief.model_used,
          market_pulse: brief.market_pulse,
          macro_context: brief.macro_context,
          technical_clusters: brief.technical_clusters,
          top_setups: brief.top_setups,
          fundamental_leaders: brief.fundamental_leaders,
          signal_alerts: brief.signal_alerts,
          skeptics_corner: brief.skeptics_corner,
          sector_analysis: brief.sector_analysis,
          portfolio_analysis: brief.portfolio_analysis,
          crypto_spotlight: brief.crypto_spotlight,
          action_items: brief.action_items,
          generation_stats: brief.generation_stats
        }, { onConflict: 'brief_date' })
        .select('brief_id')
        .single()
      
      if (error) {
        console.error('Error saving brief:', error)
        throw error
      }
      
      brief.brief_id = data.brief_id
      
      return new Response(JSON.stringify(brief), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // GET /section/:name - Get a specific section (for testing)
    if (req.method === 'GET' && path?.startsWith('section-')) {
      const sectionName = path.replace('section-', '')
      
      // Fetch and generate just that section
      // This is useful for testing individual sections
      
      return new Response(JSON.stringify({ message: `Section ${sectionName} endpoint` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

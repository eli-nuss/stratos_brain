// Daily Brief API v3 - Candidate Generation → Re-ranking Architecture
// Top 20 per setup type → AI picks 15 per category

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-stratos-api-key',
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
  // Enriched fields
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

interface DailyBrief {
  date: string
  market_regime: string
  macro_summary: string
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
  portfolio_alerts: any[]
  action_items: any[]
  tokens: { in: number; out: number }
}

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
    description: 'Volatility compression, mean reversion, oversold bounces',
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
  const returnBonus = Math.min((signal.return_1d || 0) * 200, 20) // Cap at 20 points
  return (direction * 0.4) + (purity * 0.4) + returnBonus
}

function calculateCompressionScore(signal: SetupSignal): number {
  const direction = signal.ai_direction_score || 50
  const purity = signal.setup_purity_score || 50
  return (direction * 0.3) + (purity * 0.7)
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchTop20PerSetupType(supabase: SupabaseClient): Promise<SetupSignal[]> {
  console.log('[Stage 1] Fetching top 20 per setup type...')
  
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const dateFilter = threeDaysAgo.toISOString().split('T')[0]
  
  // Get all setup types
  const allSetupTypes = CATEGORIES.flatMap(c => c.setup_types)
  
  // Fetch signals for each setup type
  const allSignals: SetupSignal[] = []
  
  for (const setupType of allSetupTypes) {
    const { data: signals, error } = await supabase
      .from('setup_signals')
      .select(`
        id,
        asset_id,
        setup_name,
        signal_date,
        entry_price,
        stop_loss,
        target_price,
        risk_reward,
        context,
        assets!inner(symbol, name, asset_type, sector)
      `)
      .eq('setup_name', setupType)
      .gte('signal_date', dateFilter)
      .order('risk_reward', { ascending: false })
      .limit(20)
    
    if (error) {
      console.error(`[Stage 1] Error fetching ${setupType}:`, error)
      continue
    }
    
    if (signals && signals.length > 0) {
      console.log(`[Stage 1] Found ${signals.length} ${setupType} signals`)
      allSignals.push(...signals)
    }
  }
  
  console.log(`[Stage 1] Total candidates: ${allSignals.length}`)
  return allSignals
}

async function enrichWithAIScores(supabase: SupabaseClient, signals: SetupSignal[]): Promise<SetupSignal[]> {
  console.log('[Stage 1] Enriching with AI scores...')
  
  const assetIds = [...new Set(signals.map(s => s.asset_id))]
  
  // Fetch AI reviews
  const { data: reviews } = await supabase
    .from('asset_ai_reviews')
    .select('asset_id, ai_direction_score, setup_purity_score, ai_confidence, ai_summary_text')
    .in('asset_id', assetIds.map(String))
    .order('as_of_date', { ascending: false })
  
  const reviewMap = new Map<string, any>()
  for (const review of (reviews || [])) {
    if (!reviewMap.has(review.asset_id)) {
      reviewMap.set(review.asset_id, review)
    }
  }
  
  // Fetch daily features for return_1d
  const { data: features } = await supabase
    .from('daily_features')
    .select('asset_id, return_1d, dollar_volume')
    .in('asset_id', assetIds)
    .order('date', { ascending: false })
  
  const featureMap = new Map<number, any>()
  for (const feature of (features || [])) {
    if (!featureMap.has(feature.asset_id)) {
      featureMap.set(feature.asset_id, feature)
    }
  }
  
  // Fetch FVS scores for equities
  const { data: fvsScores } = await supabase
    .from('fundamental_vigor_scores')
    .select('asset_id, final_score')
    .in('asset_id', assetIds)
    .order('as_of_date', { ascending: false })
  
  const fvsMap = new Map<number, number>()
  for (const fvs of (fvsScores || [])) {
    if (!fvsMap.has(fvs.asset_id)) {
      fvsMap.set(fvs.asset_id, fvs.final_score)
    }
  }
  
  // Enrich signals
  for (const signal of signals) {
    const review = reviewMap.get(String(signal.asset_id))
    const feature = featureMap.get(signal.asset_id)
    
    signal.ai_direction_score = review?.ai_direction_score || 50
    signal.setup_purity_score = review?.setup_purity_score || 50
    signal.ai_confidence = review?.ai_confidence || 0.5
    signal.ai_summary_text = review?.ai_summary_text || ''
    signal.return_1d = feature?.return_1d || 0
    signal.dollar_volume = feature?.dollar_volume || 0
    signal.fvs_score = fvsMap.get(signal.asset_id) || null
  }
  
  console.log(`[Stage 1] Enriched ${signals.length} signals with AI scores`)
  return signals
}

async function fetchMacroContext(supabase: SupabaseClient): Promise<{ regime: string; summary: string }> {
  const { data: macro } = await supabase
    .from('daily_macro_metrics')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
  
  const latest = macro?.[0]
  return {
    regime: latest?.market_regime || 'neutral',
    summary: `SPY: ${latest?.spy_change_pct?.toFixed(2) || 0}%, 10Y Yield: ${latest?.us10y_yield || 'N/A'}%, Regime: ${latest?.market_regime || 'Unknown'}`
  }
}

async function fetchPortfolioHoldings(supabase: SupabaseClient): Promise<any[]> {
  const { data: holdings } = await supabase
    .from('core_portfolio_holdings')
    .select('*, assets(symbol, name, sector)')
    .eq('is_active', true)
  
  return holdings || []
}

// ============================================================================
// STAGE 2: BUCKET AND SCORE
// ============================================================================

function bucketAndScore(signals: SetupSignal[]): CategoryBucket[] {
  console.log('[Stage 2] Bucketing and scoring candidates...')
  
  // Clone categories
  const buckets = CATEGORIES.map(c => ({ ...c, candidates: [] as SetupSignal[] }))
  
  for (const signal of signals) {
    const setupType = signal.setup_name
    
    // Find the category for this setup type
    const bucket = buckets.find(b => b.setup_types.includes(setupType))
    if (!bucket) continue
    
    // Calculate composite score based on category
    if (bucket.name === 'momentum_breakouts') {
      signal.composite_score = calculateMomentumScore(signal)
    } else if (bucket.name === 'trend_continuation') {
      signal.composite_score = calculateTrendScore(signal)
    } else if (bucket.name === 'compression_reversion') {
      signal.composite_score = calculateCompressionScore(signal)
    }
    
    bucket.candidates.push(signal)
  }
  
  // Sort each bucket by composite score
  for (const bucket of buckets) {
    bucket.candidates.sort((a, b) => (b.composite_score || 0) - (a.composite_score || 0))
    console.log(`[Stage 2] ${bucket.name}: ${bucket.candidates.length} candidates`)
  }
  
  return buckets
}

// ============================================================================
// STAGE 3: AI RE-RANKING
// ============================================================================

async function callGemini(prompt: string, systemPrompt: string): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    }
  )
  
  const data = await response.json()
  
  if (data.error) {
    console.error('[Gemini] API Error:', data.error)
    throw new Error(data.error.message)
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const tokensIn = data.usageMetadata?.promptTokenCount || 0
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0
  
  return { text, tokensIn, tokensOut }
}

async function aiReRankCategory(bucket: CategoryBucket, macroRegime: string): Promise<{ picks: any[]; theme_summary: string; tokensIn: number; tokensOut: number }> {
  console.log(`[Stage 3] AI re-ranking ${bucket.name} (${bucket.candidates.length} candidates)...`)
  
  // If no candidates, return empty
  if (bucket.candidates.length === 0) {
    return { picks: [], theme_summary: 'No candidates available.', tokensIn: 0, tokensOut: 0 }
  }
  
  // Suppress compression/reversion in bearish regime
  if (bucket.name === 'compression_reversion' && macroRegime.toLowerCase().includes('bear')) {
    return { 
      picks: [], 
      theme_summary: 'Macro Filter Active: Pullback setups suppressed due to Bearish Regime.',
      tokensIn: 0, 
      tokensOut: 0 
    }
  }
  
  // Prepare candidate data for AI
  const candidateData = bucket.candidates.slice(0, 40).map(c => ({
    symbol: c.assets?.symbol,
    name: c.assets?.name,
    sector: c.assets?.sector,
    asset_type: c.assets?.asset_type,
    setup_type: c.setup_name,
    entry: parseFloat(String(c.entry_price)),
    stop: parseFloat(String(c.stop_loss)),
    target: parseFloat(String(c.target_price)),
    risk_reward: parseFloat(String(c.risk_reward)).toFixed(2),
    ai_direction_score: c.ai_direction_score,
    setup_purity_score: c.setup_purity_score,
    composite_score: c.composite_score?.toFixed(1),
    return_1d_pct: ((c.return_1d || 0) * 100).toFixed(2),
    fvs_score: c.fvs_score,
    ai_summary: c.ai_summary_text?.substring(0, 200)
  }))
  
  const systemPrompt = `You are the Stratos CIO Agent. Your job is to review pre-ranked trading candidates and select the TOP 15 most actionable opportunities.

You are reviewing the "${bucket.name}" category: ${bucket.description}

Current Market Regime: ${macroRegime}

Selection Criteria:
1. Prioritize HIGH conviction (direction_score > 80, purity_score > 80)
2. Ensure SECTOR DIVERSITY - do not pick 15 stocks from the same sector
3. Consider LIQUIDITY - prefer larger, more tradeable names when scores are similar
4. For equities, prefer higher FVS scores (fundamental quality)
5. Look for CLEAN setups with clear entry/stop/target levels

Output a JSON object with:
{
  "theme_summary": "1-2 sentence summary of what's working in this category today",
  "picks": [
    {
      "symbol": "string",
      "name": "string",
      "sector": "string",
      "setup_type": "string",
      "entry": number,
      "stop": number,
      "target": number,
      "risk_reward": number,
      "conviction": "HIGH" | "MEDIUM",
      "one_liner": "Why this setup stands out (1 sentence)"
    }
  ]
}`

  const prompt = `Review these ${candidateData.length} candidates and select your TOP 15:

${JSON.stringify(candidateData, null, 2)}

Remember: Prioritize conviction, ensure sector diversity, and write a compelling one-liner for each pick.`

  const { text, tokensIn, tokensOut } = await callGemini(prompt, systemPrompt)
  
  try {
    const parsed = JSON.parse(text)
    return {
      picks: parsed.picks || [],
      theme_summary: parsed.theme_summary || '',
      tokensIn,
      tokensOut
    }
  } catch (e) {
    console.error(`[Stage 3] Failed to parse AI response for ${bucket.name}:`, e)
    return { picks: [], theme_summary: 'AI parsing error', tokensIn, tokensOut }
  }
}

// ============================================================================
// PORTFOLIO ALERTS
// ============================================================================

function generatePortfolioAlerts(signals: SetupSignal[], holdings: any[]): any[] {
  const alerts: any[] = []
  const holdingSymbols = new Set(holdings.map(h => h.assets?.symbol).filter(Boolean))
  const holdingSectors = new Set(holdings.map(h => h.assets?.sector).filter(Boolean))
  
  for (const signal of signals) {
    const symbol = signal.assets?.symbol
    const sector = signal.assets?.sector
    
    if (holdingSymbols.has(symbol)) {
      alerts.push({
        type: 'ADD_ON_OPPORTUNITY',
        symbol,
        setup_type: signal.setup_name,
        message: `Your position in ${symbol} is flashing a ${signal.setup_name} add-on signal.`,
        entry: signal.entry_price,
        stop: signal.stop_loss,
        target: signal.target_price
      })
    } else if (holdingSectors.has(sector)) {
      alerts.push({
        type: 'SECTOR_CONCENTRATION',
        symbol,
        sector,
        setup_type: signal.setup_name,
        message: `${symbol} (${sector}) signal - you already have exposure to this sector.`
      })
    }
  }
  
  return alerts.slice(0, 10) // Limit to 10 alerts
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function generateDailyBrief(supabase: SupabaseClient): Promise<DailyBrief> {
  const today = new Date().toISOString().split('T')[0]
  let totalTokensIn = 0
  let totalTokensOut = 0
  
  // Stage 1: Fetch candidates
  const rawSignals = await fetchTop20PerSetupType(supabase)
  const enrichedSignals = await enrichWithAIScores(supabase, rawSignals)
  
  // Fetch context
  const macro = await fetchMacroContext(supabase)
  const holdings = await fetchPortfolioHoldings(supabase)
  
  // Stage 2: Bucket and score
  const buckets = bucketAndScore(enrichedSignals)
  
  // Stage 3: AI re-ranking for each category
  const momentumResult = await aiReRankCategory(
    buckets.find(b => b.name === 'momentum_breakouts')!,
    macro.regime
  )
  totalTokensIn += momentumResult.tokensIn
  totalTokensOut += momentumResult.tokensOut
  
  const trendResult = await aiReRankCategory(
    buckets.find(b => b.name === 'trend_continuation')!,
    macro.regime
  )
  totalTokensIn += trendResult.tokensIn
  totalTokensOut += trendResult.tokensOut
  
  const compressionResult = await aiReRankCategory(
    buckets.find(b => b.name === 'compression_reversion')!,
    macro.regime
  )
  totalTokensIn += compressionResult.tokensIn
  totalTokensOut += compressionResult.tokensOut
  
  // Portfolio alerts
  const portfolioAlerts = generatePortfolioAlerts(enrichedSignals, holdings)
  
  // Build final brief
  const brief: DailyBrief = {
    date: today,
    market_regime: macro.regime,
    macro_summary: macro.summary,
    categories: {
      momentum_breakouts: {
        theme_summary: momentumResult.theme_summary,
        picks: momentumResult.picks
      },
      trend_continuation: {
        theme_summary: trendResult.theme_summary,
        picks: trendResult.picks
      },
      compression_reversion: {
        theme_summary: compressionResult.theme_summary,
        picks: compressionResult.picks
      }
    },
    portfolio_alerts: portfolioAlerts,
    action_items: [
      ...momentumResult.picks.slice(0, 3).map(p => ({ priority: 'HIGH', action: `Review ${p.symbol} for ${p.setup_type} entry`, ...p })),
      ...trendResult.picks.slice(0, 2).map(p => ({ priority: 'MEDIUM', action: `Monitor ${p.symbol} trend continuation`, ...p })),
      ...compressionResult.picks.slice(0, 2).map(p => ({ priority: 'LOW', action: `Watch ${p.symbol} for compression breakout`, ...p }))
    ],
    tokens: { in: totalTokensIn, out: totalTokensOut }
  }
  
  return brief
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    
    // Only generate on POST or explicit action=generate
    if (req.method === 'POST' || action === 'generate') {
      console.log('[DailyBrief v3] Starting generation...')
      const brief = await generateDailyBrief(supabase)
      
      // Save to database
      const { error: saveError } = await supabase
        .from('daily_briefs_v3')
        .upsert({
          brief_date: brief.date,
          generated_at: new Date().toISOString(),
          model_used: 'gemini-2.0-flash',
          market_regime: brief.market_regime,
          macro_summary: brief.macro_summary,
          momentum_breakouts: brief.categories.momentum_breakouts,
          trend_continuation: brief.categories.trend_continuation,
          compression_reversion: brief.categories.compression_reversion,
          portfolio_alerts: brief.portfolio_alerts,
          action_items: brief.action_items,
          tokens_in: brief.tokens.in,
          tokens_out: brief.tokens.out
        }, { onConflict: 'brief_date' })
      
      if (saveError) {
        console.error('[DailyBrief v3] Save error:', saveError)
      }
      
      console.log(`[DailyBrief v3] Complete. Tokens: ${brief.tokens.in} in / ${brief.tokens.out} out`)
      
      return new Response(JSON.stringify({ success: true, brief }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // GET - fetch latest brief
    const { data: latestBrief } = await supabase
      .from('daily_briefs_v3')
      .select('*')
      .order('brief_date', { ascending: false })
      .limit(1)
    
    const briefData = latestBrief?.[0] ? {
      date: latestBrief[0].brief_date,
      market_regime: latestBrief[0].market_regime,
      macro_summary: latestBrief[0].macro_summary,
      categories: {
        momentum_breakouts: latestBrief[0].momentum_breakouts,
        trend_continuation: latestBrief[0].trend_continuation,
        compression_reversion: latestBrief[0].compression_reversion
      },
      portfolio_alerts: latestBrief[0].portfolio_alerts,
      action_items: latestBrief[0].action_items,
      tokens: { in: latestBrief[0].tokens_in, out: latestBrief[0].tokens_out }
    } : null
    
    return new Response(JSON.stringify({ success: true, brief: briefData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[DailyBrief v3] Error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

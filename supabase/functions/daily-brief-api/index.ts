// Daily Brief API - Generates AI-powered daily market briefs
// Uses Gemini-3-Pro-Preview to analyze all assets and surface the best setups
// v1.0 - Initial implementation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

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

// Types
interface AssetData {
  asset_id: number
  symbol: string
  name: string
  asset_type: 'crypto' | 'equity'
  close_usd: number
  change_1d: number
  change_7d: number
  change_30d: number
  volume_usd: number
  weighted_score: number
  inflection_score: number
  rsi_14: number
  macd_histogram: number
  bb_position: number
  ai_attention_level: string
  ai_direction: string
  ai_summary: string
  ai_confidence: number
  active_signals: string[]
  sector?: string
  industry?: string
  market_cap?: number
}

interface DailyBrief {
  brief_id?: number
  brief_date: string
  market_overview: string
  top_bullish_setups: SetupHighlight[]
  top_bearish_setups: SetupHighlight[]
  key_signals: SignalHighlight[]
  sector_analysis: SectorAnalysis[]
  crypto_highlights: SetupHighlight[]
  equity_highlights: SetupHighlight[]
  generated_at: string
  model_used: string
  tokens_in: number
  tokens_out: number
}

interface SetupHighlight {
  asset_id: number
  symbol: string
  name: string
  asset_type: 'crypto' | 'equity'
  price: number
  change_1d: number
  score: number
  reasoning: string
  key_levels: {
    support?: number
    resistance?: number
    entry?: number
    target?: number
    stop_loss?: number
  }
  signals: string[]
  confidence: 'high' | 'medium' | 'low'
}

interface SignalHighlight {
  signal_type: string
  count: number
  direction: 'bullish' | 'bearish'
  notable_assets: string[]
  interpretation: string
}

interface SectorAnalysis {
  sector: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  top_performers: string[]
  key_themes: string[]
}

// Build the system prompt for daily brief generation
function buildDailyBriefPrompt(date: string): string {
  return `You are the **Stratos Daily Brief Generator**, an AI-powered market analyst.

Your task is to analyze the provided market data and generate a comprehensive daily brief that surfaces the best trading opportunities.

## Today's Date: ${date}

## Your Objectives:
1. **Market Overview**: Provide a 2-3 paragraph summary of overall market conditions based on the data
2. **Top Bullish Setups**: Identify the 5-7 most promising long opportunities with clear reasoning
3. **Top Bearish Setups**: Identify the 3-5 assets showing weakness or breakdown risk
4. **Key Signals**: Summarize the most significant technical signals firing across the market
5. **Sector Analysis**: Break down performance and sentiment by sector (for equities)
6. **Crypto Highlights**: Specific analysis for cryptocurrency opportunities
7. **Equity Highlights**: Specific analysis for stock opportunities

## Evaluation Criteria for Setups:
- **Score Quality**: Higher weighted_score and inflection_score indicate stronger setups
- **Technical Confirmation**: RSI, MACD, and Bollinger Band positions should align
- **AI Review Alignment**: Consider the AI attention level and direction
- **Signal Confluence**: Multiple active signals increase conviction
- **Volume Confirmation**: Strong volume supports the move

## Output Format:
Return a JSON object with this exact structure:
{
  "market_overview": "string - 2-3 paragraphs of market analysis",
  "top_bullish_setups": [
    {
      "asset_id": number,
      "symbol": "string",
      "name": "string",
      "asset_type": "crypto" | "equity",
      "price": number,
      "change_1d": number,
      "score": number,
      "reasoning": "string - 2-3 sentences explaining why this is a top setup",
      "key_levels": {
        "support": number | null,
        "resistance": number | null,
        "entry": number | null,
        "target": number | null,
        "stop_loss": number | null
      },
      "signals": ["array of active signal names"],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "top_bearish_setups": [...same structure...],
  "key_signals": [
    {
      "signal_type": "string - signal template name",
      "count": number,
      "direction": "bullish" | "bearish",
      "notable_assets": ["array of symbols"],
      "interpretation": "string - what this signal pattern means"
    }
  ],
  "sector_analysis": [
    {
      "sector": "string",
      "sentiment": "bullish" | "bearish" | "neutral",
      "top_performers": ["array of symbols"],
      "key_themes": ["array of theme strings"]
    }
  ],
  "crypto_highlights": [...SetupHighlight structure...],
  "equity_highlights": [...SetupHighlight structure...]
}

## Guidelines:
- Be specific and actionable in your analysis
- Use the actual data provided - do not hallucinate numbers
- Focus on quality over quantity - only highlight truly notable setups
- Provide clear reasoning for each recommendation
- Consider both technical and fundamental factors where available
- Be objective - acknowledge both opportunities and risks`
}

// Fetch all assets with their latest data
async function fetchAllAssetsData(supabase: ReturnType<typeof createClient>): Promise<AssetData[]> {
  // Fetch assets with their latest AI reviews
  // Using a simpler query to avoid timeout issues
  const { data: assets, error } = await supabase
    .from('assets')
    .select(`
      asset_id,
      symbol,
      name,
      asset_type,
      sector,
      industry
    `)
    .eq('is_active', true)
    .limit(100)
  
  if (error) {
    console.error('Error fetching assets:', error)
    throw error
  }

  // Fetch latest AI reviews for these assets
  const assetIds = (assets || []).map(a => a.asset_id)
  const { data: reviews, error: reviewError } = await supabase
    .from('asset_ai_reviews')
    .select('asset_id, attention_level, direction, summary, setup_type')
    .in('asset_id', assetIds)
    .order('review_date', { ascending: false })
  
  if (reviewError) {
    console.error('Error fetching reviews:', reviewError)
  }

  // Create a map of latest reviews by asset_id
  const reviewMap = new Map<number, { attention_level: string; direction: string; summary: string; setup_type: string }>()
  for (const review of (reviews || [])) {
    if (!reviewMap.has(review.asset_id)) {
      reviewMap.set(review.asset_id, review)
    }
  }

  // Fetch latest scores
  const { data: scores, error: scoreError } = await supabase
    .from('daily_scores')
    .select('asset_id, weighted_score, inflection_score')
    .in('asset_id', assetIds)
    .order('score_date', { ascending: false })
  
  if (scoreError) {
    console.error('Error fetching scores:', scoreError)
  }

  // Create a map of latest scores by asset_id
  const scoreMap = new Map<number, { weighted_score: number; inflection_score: number }>()
  for (const score of (scores || [])) {
    if (!scoreMap.has(score.asset_id)) {
      scoreMap.set(score.asset_id, score)
    }
  }

  // Fetch latest prices
  const { data: bars, error: barError } = await supabase
    .from('daily_bars')
    .select('asset_id, close_price, volume')
    .in('asset_id', assetIds)
    .order('bar_date', { ascending: false })
  
  if (barError) {
    console.error('Error fetching bars:', barError)
  }

  // Create a map of latest bars by asset_id
  const barMap = new Map<number, { close_price: number; volume: number }>()
  for (const bar of (bars || [])) {
    if (!barMap.has(bar.asset_id)) {
      barMap.set(bar.asset_id, bar)
    }
  }
  
  // Transform to our interface and sort by score
  const result = (assets || []).map((a: Record<string, unknown>) => {
    const review = reviewMap.get(a.asset_id as number)
    const score = scoreMap.get(a.asset_id as number)
    const bar = barMap.get(a.asset_id as number)
    
    return {
      asset_id: a.asset_id as number,
      symbol: a.symbol as string,
      name: a.name as string,
      asset_type: a.asset_type as 'crypto' | 'equity',
      close_usd: bar?.close_price || 0,
      change_1d: 0,
      change_7d: 0,
      change_30d: 0,
      volume_usd: bar?.volume || 0,
      weighted_score: score?.weighted_score || 0,
      inflection_score: score?.inflection_score || 0,
      rsi_14: 50,
      macd_histogram: 0,
      bb_position: 0.5,
      ai_attention_level: review?.attention_level || 'WATCH',
      ai_direction: review?.direction || 'neutral',
      ai_summary: review?.summary || '',
      ai_confidence: 0,
      active_signals: [],
      sector: a.sector as string || undefined,
      industry: a.industry as string || undefined,
      market_cap: undefined,
    }
  })

  // Sort by weighted_score descending
  return result.sort((a, b) => b.weighted_score - a.weighted_score)
}

// Call Gemini to generate the daily brief
async function generateBriefWithGemini(
  assets: AssetData[],
  date: string
): Promise<{ brief: DailyBrief; tokensIn: number; tokensOut: number }> {
  const systemPrompt = buildDailyBriefPrompt(date)
  
  // Prepare asset data summary for the prompt
  // Group by asset type and sort by score
  const cryptoAssets = assets.filter(a => a.asset_type === 'crypto').slice(0, 50)
  const equityAssets = assets.filter(a => a.asset_type === 'equity').slice(0, 100)
  
  // Create a condensed data format for the prompt
  const assetDataSummary = {
    crypto: cryptoAssets.map(a => ({
      id: a.asset_id,
      sym: a.symbol,
      name: a.name,
      price: a.close_usd,
      chg1d: a.change_1d,
      chg7d: a.change_7d,
      vol: a.volume_usd,
      score: a.weighted_score,
      inflection: a.inflection_score,
      rsi: a.rsi_14,
      macd: a.macd_histogram,
      bb: a.bb_position,
      ai_attn: a.ai_attention_level,
      ai_dir: a.ai_direction,
      ai_conf: a.ai_confidence,
      signals: a.active_signals,
    })),
    equity: equityAssets.map(a => ({
      id: a.asset_id,
      sym: a.symbol,
      name: a.name,
      price: a.close_usd,
      chg1d: a.change_1d,
      chg7d: a.change_7d,
      vol: a.volume_usd,
      score: a.weighted_score,
      inflection: a.inflection_score,
      rsi: a.rsi_14,
      macd: a.macd_histogram,
      bb: a.bb_position,
      ai_attn: a.ai_attention_level,
      ai_dir: a.ai_direction,
      ai_conf: a.ai_confidence,
      signals: a.active_signals,
      sector: a.sector,
      industry: a.industry,
      mcap: a.market_cap,
    })),
    summary: {
      total_crypto: cryptoAssets.length,
      total_equity: equityAssets.length,
      avg_crypto_score: cryptoAssets.reduce((sum, a) => sum + a.weighted_score, 0) / cryptoAssets.length || 0,
      avg_equity_score: equityAssets.reduce((sum, a) => sum + a.weighted_score, 0) / equityAssets.length || 0,
      bullish_count: assets.filter(a => a.ai_direction === 'bullish').length,
      bearish_count: assets.filter(a => a.ai_direction === 'bearish').length,
    }
  }
  
  const userMessage = `Here is today's market data for analysis:

${JSON.stringify(assetDataSummary, null, 2)}

Please analyze this data and generate the daily brief following the exact JSON structure specified in your instructions.`

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      candidateCount: 1,
      responseMimeType: 'application/json'
    }
  }
  
  const response = await fetch(
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
  
  const data = await response.json()
  const candidate = data.candidates?.[0]
  
  if (!candidate?.content?.parts?.[0]?.text) {
    throw new Error('No response from Gemini')
  }
  
  const responseText = candidate.content.parts[0].text
  const tokensIn = data.usageMetadata?.promptTokenCount || 0
  const tokensOut = data.usageMetadata?.candidatesTokenCount || 0
  
  // Parse the JSON response
  let briefData: Partial<DailyBrief>
  try {
    briefData = JSON.parse(responseText)
  } catch (e) {
    console.error('Failed to parse Gemini response:', responseText.substring(0, 500))
    throw new Error('Failed to parse Gemini response as JSON')
  }
  
  // Construct the full brief object
  const brief: DailyBrief = {
    brief_date: date,
    market_overview: briefData.market_overview || 'Unable to generate market overview.',
    top_bullish_setups: briefData.top_bullish_setups || [],
    top_bearish_setups: briefData.top_bearish_setups || [],
    key_signals: briefData.key_signals || [],
    sector_analysis: briefData.sector_analysis || [],
    crypto_highlights: briefData.crypto_highlights || [],
    equity_highlights: briefData.equity_highlights || [],
    generated_at: new Date().toISOString(),
    model_used: GEMINI_MODEL,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  }
  
  return { brief, tokensIn, tokensOut }
}

// Save the brief to the database
async function saveBrief(
  supabase: ReturnType<typeof createClient>,
  brief: DailyBrief
): Promise<number> {
  const { data, error } = await supabase
    .from('daily_briefs')
    .upsert({
      brief_date: brief.brief_date,
      market_overview: brief.market_overview,
      top_bullish_setups: brief.top_bullish_setups,
      top_bearish_setups: brief.top_bearish_setups,
      key_signals: brief.key_signals,
      sector_analysis: brief.sector_analysis,
      crypto_highlights: brief.crypto_highlights,
      equity_highlights: brief.equity_highlights,
      generated_at: brief.generated_at,
      model_used: brief.model_used,
      tokens_in: brief.tokens_in,
      tokens_out: brief.tokens_out,
    }, {
      onConflict: 'brief_date'
    })
    .select('brief_id')
    .single()
  
  if (error) {
    console.error('Error saving brief:', error)
    throw error
  }
  
  return data.brief_id
}

// Get existing brief for a date
async function getBrief(
  supabase: ReturnType<typeof createClient>,
  date: string
): Promise<DailyBrief | null> {
  const { data, error } = await supabase
    .from('daily_briefs')
    .select('*')
    .eq('brief_date', date)
    .single()
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching brief:', error)
    throw error
  }
  
  return data as DailyBrief | null
}

// Get list of available briefs
async function listBriefs(
  supabase: ReturnType<typeof createClient>,
  limit: number = 30
): Promise<{ brief_date: string; generated_at: string }[]> {
  const { data, error } = await supabase
    .from('daily_briefs')
    .select('brief_date, generated_at')
    .order('brief_date', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Error listing briefs:', error)
    throw error
  }
  
  return data || []
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const url = new URL(req.url)
    const path = url.pathname.replace('/daily-brief-api', '')

    // GET /brief - Get brief for a specific date (or today)
    if (req.method === 'GET' && (path === '/brief' || path === '')) {
      const dateParam = url.searchParams.get('date')
      const date = dateParam || new Date().toISOString().split('T')[0]
      
      const brief = await getBrief(supabase, date)
      
      if (!brief) {
        return new Response(
          JSON.stringify({ error: 'No brief found for this date', date }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify(brief),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /list - List available briefs
    if (req.method === 'GET' && path === '/list') {
      const limit = parseInt(url.searchParams.get('limit') || '30')
      const briefs = await listBriefs(supabase, limit)
      
      return new Response(
        JSON.stringify(briefs),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /generate - Generate a new brief for today (or specified date)
    if (req.method === 'POST' && path === '/generate') {
      const body = await req.json().catch(() => ({}))
      const dateParam = body.date || url.searchParams.get('date')
      const date = dateParam || new Date().toISOString().split('T')[0]
      const forceRegenerate = body.force || url.searchParams.get('force') === 'true'
      
      // Check if brief already exists
      if (!forceRegenerate) {
        const existingBrief = await getBrief(supabase, date)
        if (existingBrief) {
          return new Response(
            JSON.stringify({ 
              message: 'Brief already exists for this date',
              brief: existingBrief,
              cached: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      
      // Fetch all assets data
      console.log(`Fetching assets data for ${date}...`)
      const assets = await fetchAllAssetsData(supabase)
      console.log(`Found ${assets.length} assets`)
      
      if (assets.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No asset data available' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Generate the brief with Gemini
      console.log('Generating brief with Gemini...')
      const { brief, tokensIn, tokensOut } = await generateBriefWithGemini(assets, date)
      console.log(`Brief generated. Tokens: ${tokensIn} in, ${tokensOut} out`)
      
      // Save to database
      const briefId = await saveBrief(supabase, brief)
      console.log(`Brief saved with ID: ${briefId}`)
      
      return new Response(
        JSON.stringify({ 
          message: 'Brief generated successfully',
          brief_id: briefId,
          brief,
          cached: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /latest - Get the most recent brief
    if (req.method === 'GET' && path === '/latest') {
      const { data, error } = await supabase
        .from('daily_briefs')
        .select('*')
        .order('brief_date', { ascending: false })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      
      if (!data) {
        return new Response(
          JSON.stringify({ error: 'No briefs available' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Daily Brief API error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

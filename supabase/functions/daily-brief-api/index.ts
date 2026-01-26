// Daily Brief API - Generates AI-powered daily market briefs
// Uses Gemini-3-Pro-Preview to analyze all assets and surface the best setups
// v1.1 - Fixed database queries to use correct column names

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
  console.log('Fetching assets...')
  
  // Fetch active assets
  const { data: assets, error } = await supabase
    .from('assets')
    .select('asset_id, symbol, name, asset_type, sector, industry')
    .eq('is_active', true)
    .limit(100)
  
  if (error) {
    console.error('Error fetching assets:', error)
    throw error
  }

  console.log(`Found ${assets?.length || 0} active assets`)
  const assetIds = (assets || []).map(a => a.asset_id)

  // Fetch latest AI reviews (using correct column names: as_of_date, ai_summary_text)
  console.log('Fetching AI reviews...')
  const { data: reviews, error: reviewError } = await supabase
    .from('asset_ai_reviews')
    .select('asset_id, attention_level, direction, ai_summary_text, setup_type, as_of_date')
    .in('asset_id', assetIds)
    .order('as_of_date', { ascending: false })
  
  if (reviewError) {
    console.error('Error fetching reviews:', reviewError)
  }
  console.log(`Found ${reviews?.length || 0} AI reviews`)

  // Create a map of latest reviews by asset_id
  const reviewMap = new Map<number, { attention_level: string; direction: string; ai_summary_text: string; setup_type: string }>()
  for (const review of (reviews || [])) {
    if (!reviewMap.has(review.asset_id)) {
      reviewMap.set(review.asset_id, review)
    }
  }

  // Fetch latest scores from daily_asset_scores (correct table name, using as_of_date)
  console.log('Fetching scores...')
  const { data: scores, error: scoreError } = await supabase
    .from('daily_asset_scores')
    .select('asset_id, weighted_score, inflection_score, as_of_date')
    .in('asset_id', assetIds)
    .order('as_of_date', { ascending: false })
  
  if (scoreError) {
    console.error('Error fetching scores:', scoreError)
  }
  console.log(`Found ${scores?.length || 0} scores`)

  // Create a map of latest scores by asset_id
  const scoreMap = new Map<number, { weighted_score: number; inflection_score: number }>()
  for (const score of (scores || [])) {
    if (!scoreMap.has(Number(score.asset_id))) {
      scoreMap.set(Number(score.asset_id), score)
    }
  }

  // Fetch latest prices from daily_bars (using correct column names: date, close)
  console.log('Fetching price bars...')
  const { data: bars, error: barError } = await supabase
    .from('daily_bars')
    .select('asset_id, close, volume, date')
    .in('asset_id', assetIds)
    .order('date', { ascending: false })
  
  if (barError) {
    console.error('Error fetching bars:', barError)
  }
  console.log(`Found ${bars?.length || 0} price bars`)

  // Create a map of latest bars by asset_id
  const barMap = new Map<number, { close: number; volume: number }>()
  for (const bar of (bars || [])) {
    if (!barMap.has(bar.asset_id)) {
      barMap.set(bar.asset_id, bar)
    }
  }

  // Fetch latest features from daily_features (for RSI, MACD, etc.)
  console.log('Fetching features...')
  const { data: features, error: featureError } = await supabase
    .from('daily_features')
    .select('asset_id, date, rsi_14, macd_histogram, bb_pct, return_1d, return_5d, return_21d')
    .in('asset_id', assetIds)
    .order('date', { ascending: false })
  
  if (featureError) {
    console.error('Error fetching features:', featureError)
  }
  console.log(`Found ${features?.length || 0} features`)

  // Create a map of latest features by asset_id
  const featureMap = new Map<number, { rsi_14: number; macd_histogram: number; bb_pct: number; return_1d: number; return_5d: number; return_21d: number }>()
  for (const feature of (features || [])) {
    if (!featureMap.has(feature.asset_id)) {
      featureMap.set(feature.asset_id, feature)
    }
  }

  // Fetch active signals from daily_signal_facts
  console.log('Fetching signals...')
  const { data: signals, error: signalError } = await supabase
    .from('daily_signal_facts')
    .select('asset_id, signal_name, direction, as_of_date')
    .in('asset_id', assetIds)
    .eq('is_active', true)
  
  if (signalError) {
    console.error('Error fetching signals:', signalError)
  }
  console.log(`Found ${signals?.length || 0} active signals`)

  // Create a map of active signals by asset_id
  const signalMap = new Map<number, string[]>()
  for (const signal of (signals || [])) {
    const existing = signalMap.get(signal.asset_id) || []
    existing.push(signal.signal_name)
    signalMap.set(signal.asset_id, existing)
  }
  
  // Transform to our interface and sort by score
  const result = (assets || []).map((a: Record<string, unknown>) => {
    const assetId = a.asset_id as number
    const review = reviewMap.get(assetId)
    const score = scoreMap.get(assetId)
    const bar = barMap.get(assetId)
    const feature = featureMap.get(assetId)
    const assetSignals = signalMap.get(assetId) || []
    
    return {
      asset_id: assetId,
      symbol: a.symbol as string,
      name: a.name as string,
      asset_type: a.asset_type as 'crypto' | 'equity',
      close_usd: bar?.close ? parseFloat(String(bar.close)) : 0,
      change_1d: feature?.return_1d ? parseFloat(String(feature.return_1d)) * 100 : 0,
      change_7d: feature?.return_5d ? parseFloat(String(feature.return_5d)) * 100 : 0,
      change_30d: feature?.return_21d ? parseFloat(String(feature.return_21d)) * 100 : 0,
      volume_usd: bar?.volume ? parseFloat(String(bar.volume)) : 0,
      weighted_score: score?.weighted_score || 0,
      inflection_score: score?.inflection_score || 0,
      rsi_14: feature?.rsi_14 ? parseFloat(String(feature.rsi_14)) : 50,
      macd_histogram: feature?.macd_histogram ? parseFloat(String(feature.macd_histogram)) : 0,
      bb_position: feature?.bb_pct ? parseFloat(String(feature.bb_pct)) : 0.5,
      ai_attention_level: review?.attention_level || 'WATCH',
      ai_direction: review?.direction || 'neutral',
      ai_summary: review?.ai_summary_text || '',
      ai_confidence: 0,
      active_signals: assetSignals,
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
      aiDir: a.ai_direction,
      aiAttn: a.ai_attention_level,
      aiSum: a.ai_summary?.substring(0, 200),
      signals: a.active_signals
    })),
    equities: equityAssets.map(a => ({
      id: a.asset_id,
      sym: a.symbol,
      name: a.name,
      sector: a.sector,
      price: a.close_usd,
      chg1d: a.change_1d,
      chg7d: a.change_7d,
      vol: a.volume_usd,
      score: a.weighted_score,
      inflection: a.inflection_score,
      rsi: a.rsi_14,
      macd: a.macd_histogram,
      bb: a.bb_position,
      aiDir: a.ai_direction,
      aiAttn: a.ai_attention_level,
      aiSum: a.ai_summary?.substring(0, 200),
      signals: a.active_signals
    }))
  }
  
  const userMessage = `Here is today's market data for analysis:

${JSON.stringify(assetDataSummary, null, 2)}

Please analyze this data and generate the daily brief following the exact JSON structure specified.`

  // Call Gemini API
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    }
  )
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status}`)
  }
  
  const result = await response.json()
  
  // Extract the generated content
  const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  const tokensIn = result.usageMetadata?.promptTokenCount || 0
  const tokensOut = result.usageMetadata?.candidatesTokenCount || 0
  
  // Parse the JSON response
  let briefData: Partial<DailyBrief>
  try {
    briefData = JSON.parse(generatedText)
  } catch (e) {
    console.error('Failed to parse Gemini response:', generatedText)
    throw new Error('Failed to parse AI response')
  }
  
  // Construct the full brief
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
    tokens_out: tokensOut
  }
  
  return { brief, tokensIn, tokensOut }
}

// Save brief to database
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
      updated_at: new Date().toISOString()
    }, { onConflict: 'brief_date' })
    .select('brief_id')
    .single()
  
  if (error) {
    console.error('Error saving brief:', error)
    throw error
  }
  
  return data.brief_id
}

// Get latest brief from database
async function getLatestBrief(
  supabase: ReturnType<typeof createClient>
): Promise<DailyBrief | null> {
  const { data, error } = await supabase
    .from('daily_briefs')
    .select('*')
    .order('brief_date', { ascending: false })
    .limit(1)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null // No briefs found
    }
    console.error('Error fetching latest brief:', error)
    throw error
  }
  
  return data
}

// Get brief by date
async function getBriefByDate(
  supabase: ReturnType<typeof createClient>,
  date: string
): Promise<DailyBrief | null> {
  const { data, error } = await supabase
    .from('daily_briefs')
    .select('*')
    .eq('brief_date', date)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching brief by date:', error)
    throw error
  }
  
  return data
}

// List all briefs
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

// Main handler
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() || ''
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Route handling
    if (req.method === 'GET') {
      if (path === 'latest') {
        // Get the latest brief
        const brief = await getLatestBrief(supabase)
        if (!brief) {
          return new Response(
            JSON.stringify({ error: 'No briefs available' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify(brief),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (path === 'list') {
        // List all briefs
        const briefs = await listBriefs(supabase)
        return new Response(
          JSON.stringify(briefs),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Get brief by date (path is the date)
      if (path.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const brief = await getBriefByDate(supabase, path)
        if (!brief) {
          return new Response(
            JSON.stringify({ error: 'Brief not found for this date' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        return new Response(
          JSON.stringify(brief),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    if (req.method === 'POST' && path === 'generate') {
      // Generate a new brief
      const body = await req.json().catch(() => ({}))
      const date = body.date || new Date().toISOString().split('T')[0]
      const force = body.force || false
      
      // Check if brief already exists for this date
      if (!force) {
        const existingBrief = await getBriefByDate(supabase, date)
        if (existingBrief) {
          return new Response(
            JSON.stringify({ 
              message: 'Brief already exists for this date',
              brief_id: existingBrief.brief_id,
              brief: existingBrief,
              cached: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
      
      // Fetch all assets data
      console.log('Fetching asset data for brief generation...')
      const assets = await fetchAllAssetsData(supabase)
      console.log(`Fetched ${assets.length} assets`)
      
      // Generate brief with Gemini
      console.log('Generating brief with Gemini...')
      const { brief, tokensIn, tokensOut } = await generateBriefWithGemini(assets, date)
      console.log(`Brief generated: ${tokensIn} tokens in, ${tokensOut} tokens out`)
      
      // Save to database
      const briefId = await saveBrief(supabase, brief)
      console.log(`Brief saved with ID: ${briefId}`)
      
      return new Response(
        JSON.stringify({ 
          message: 'Brief generated successfully',
          brief_id: briefId,
          brief: { ...brief, brief_id: briefId },
          cached: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Default: return error for unknown routes
    return new Response(
      JSON.stringify({ error: 'Unknown endpoint' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

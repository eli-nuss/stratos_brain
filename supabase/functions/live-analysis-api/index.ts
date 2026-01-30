/**
 * Live Analysis API
 * 
 * Performs real-time technical analysis for a single asset using the current intraday price.
 * This is an on-demand version of the batch AI analysis pipeline.
 * 
 * Endpoints:
 * - POST /live-analysis-api - Run live analysis for an asset
 * 
 * Request body:
 * {
 *   "asset_id": number,
 *   "save_to_db": boolean (optional, default false)
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Configuration
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const FMP_API_KEY = Deno.env.get('FMP_API_KEY')
const ALPHA_VANTAGE_API_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY')
const GEMINI_MODEL = 'gemini-3-flash-preview'

interface OHLCVBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface TechnicalFeatures {
  sma_20?: number
  sma_50?: number
  sma_200?: number
  rsi_14?: number
  macd_line?: number
  macd_signal?: number
  bb_upper?: number
  bb_lower?: number
  atr_14?: number
  return_1d?: number
  return_5d?: number
  return_21d?: number
  ma_dist_20?: number
  ma_dist_50?: number
  ma_dist_200?: number
  rvol_20?: number
  [key: string]: number | undefined
}

interface AIAnalysisResult {
  direction: 'bullish' | 'bearish' | 'neutral'
  ai_direction_score: number
  ai_setup_quality_score: number
  setup_type: string
  attention_level: string
  confidence: number
  summary_text: string
  key_levels?: {
    support: number[]
    resistance: number[]
    invalidation: number
  }
  entry_zone?: {
    low: number
    high: number
  }
  targets?: number[]
  why_now?: string
  risks?: string[]
  what_to_watch?: string
  quality_subscores?: {
    boundary_definition: number
    structural_compliance: number
    volatility_profile: number
    volume_coherence: number
    risk_reward_clarity: number
  }
}

/**
 * Fetch current intraday price from FMP
 */
async function fetchIntradayPrice(symbol: string, assetType: string): Promise<{ price: number; volume: number } | null> {
  try {
    if (assetType === 'crypto') {
      // For crypto, use CoinGecko or FMP crypto endpoint
      const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}USD?apikey=${FMP_API_KEY}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        if (data && data[0]) {
          return { price: data[0].price, volume: data[0].volume || 0 }
        }
      }
    } else {
      // For equities, use FMP quote endpoint
      const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        if (data && data[0]) {
          return { price: data[0].price, volume: data[0].volume || 0 }
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching intraday price for ${symbol}:`, error)
  }
  return null
}

/**
 * Calculate technical features from OHLCV data
 */
function calculateFeatures(bars: OHLCVBar[], currentPrice: number): TechnicalFeatures {
  if (bars.length < 20) {
    return {}
  }

  const closes = bars.map(b => b.close)
  const highs = bars.map(b => b.high)
  const lows = bars.map(b => b.low)
  const volumes = bars.map(b => b.volume)

  // Helper functions
  const sma = (arr: number[], period: number): number | undefined => {
    if (arr.length < period) return undefined
    const slice = arr.slice(-period)
    return slice.reduce((a, b) => a + b, 0) / period
  }

  const ema = (arr: number[], period: number): number | undefined => {
    if (arr.length < period) return undefined
    const k = 2 / (period + 1)
    let ema = arr[0]
    for (let i = 1; i < arr.length; i++) {
      ema = arr[i] * k + ema * (1 - k)
    }
    return ema
  }

  const stdDev = (arr: number[], period: number): number | undefined => {
    if (arr.length < period) return undefined
    const slice = arr.slice(-period)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
    return Math.sqrt(variance)
  }

  // Add current price to closes for calculations
  const closesWithCurrent = [...closes, currentPrice]

  // Calculate features
  const features: TechnicalFeatures = {}

  // Moving averages
  features.sma_20 = sma(closesWithCurrent, 20)
  features.sma_50 = sma(closesWithCurrent, 50)
  features.sma_200 = sma(closesWithCurrent, 200)

  // MA distances
  if (features.sma_20) {
    features.ma_dist_20 = ((currentPrice - features.sma_20) / features.sma_20) * 100
  }
  if (features.sma_50) {
    features.ma_dist_50 = ((currentPrice - features.sma_50) / features.sma_50) * 100
  }
  if (features.sma_200) {
    features.ma_dist_200 = ((currentPrice - features.sma_200) / features.sma_200) * 100
  }

  // Returns
  if (closes.length >= 1) {
    features.return_1d = ((currentPrice - closes[closes.length - 1]) / closes[closes.length - 1]) * 100
  }
  if (closes.length >= 5) {
    features.return_5d = ((currentPrice - closes[closes.length - 5]) / closes[closes.length - 5]) * 100
  }
  if (closes.length >= 21) {
    features.return_21d = ((currentPrice - closes[closes.length - 21]) / closes[closes.length - 21]) * 100
  }

  // RSI (14-period)
  if (closes.length >= 15) {
    const changes = closesWithCurrent.slice(-15).map((c, i, arr) => i === 0 ? 0 : c - arr[i - 1]).slice(1)
    const gains = changes.map(c => c > 0 ? c : 0)
    const losses = changes.map(c => c < 0 ? -c : 0)
    const avgGain = gains.reduce((a, b) => a + b, 0) / 14
    const avgLoss = losses.reduce((a, b) => a + b, 0) / 14
    if (avgLoss !== 0) {
      const rs = avgGain / avgLoss
      features.rsi_14 = 100 - (100 / (1 + rs))
    } else {
      features.rsi_14 = 100
    }
  }

  // MACD
  const ema12 = ema(closesWithCurrent, 12)
  const ema26 = ema(closesWithCurrent, 26)
  if (ema12 !== undefined && ema26 !== undefined) {
    features.macd_line = ema12 - ema26
    // For signal line, we'd need historical MACD values - simplified here
    features.macd_signal = features.macd_line * 0.9 // Approximation
  }

  // Bollinger Bands
  const bb_sma = sma(closesWithCurrent, 20)
  const bb_std = stdDev(closesWithCurrent, 20)
  if (bb_sma !== undefined && bb_std !== undefined) {
    features.bb_upper = bb_sma + 2 * bb_std
    features.bb_lower = bb_sma - 2 * bb_std
  }

  // ATR (14-period)
  if (bars.length >= 14) {
    const trueRanges: number[] = []
    for (let i = bars.length - 14; i < bars.length; i++) {
      const high = highs[i]
      const low = lows[i]
      const prevClose = i > 0 ? closes[i - 1] : closes[i]
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
      trueRanges.push(tr)
    }
    features.atr_14 = trueRanges.reduce((a, b) => a + b, 0) / 14
  }

  // Relative Volume
  if (volumes.length >= 20) {
    const avgVolume = sma(volumes, 20)
    const currentVolume = volumes[volumes.length - 1]
    if (avgVolume && avgVolume > 0) {
      features.rvol_20 = currentVolume / avgVolume
    }
  }

  return features
}

/**
 * Build the AI analysis prompt
 */
function buildPrompt(symbol: string, name: string, bars: OHLCVBar[], currentPrice: number, features: TechnicalFeatures): string {
  // Format OHLCV data (last 60 bars)
  const recentBars = bars.slice(-60)
  const ohlcvLines = recentBars.map(b => 
    `${b.date},${b.open.toFixed(2)},${b.high.toFixed(2)},${b.low.toFixed(2)},${b.close.toFixed(2)},${b.volume}`
  )
  const ohlcvText = ohlcvLines.join('\n')

  // Format features
  const keyFeatures = ['sma_20', 'sma_50', 'sma_200', 'rsi_14', 'macd_line', 'macd_signal',
    'bb_upper', 'bb_lower', 'atr_14', 'return_1d', 'return_5d', 'return_21d',
    'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'rvol_20']
  
  const featuresLines = keyFeatures
    .filter(k => features[k] !== undefined)
    .map(k => `  ${k}: ${features[k]!.toFixed(4)}`)
  
  const featuresText = featuresLines.length > 0 
    ? '\nTECHNICAL INDICATORS (LIVE):\n' + featuresLines.join('\n')
    : ''

  return `You are a professional technical analyst. Analyze this equity chart and return a JSON assessment.

[CRITICAL INDEPENDENCE MANDATE]
You MUST evaluate TWO SEPARATE dimensions:
1. DIRECTION: Where is price likely to go? (bullish/bearish conviction)
2. QUALITY: How clean and tradeable is the chart structure? (INDEPENDENT of direction!)

IMPORTANT RULES:
- A BEARISH asset with a clean breakdown pattern MUST have HIGH quality (80+)
- A BULLISH asset with a messy chart MUST have LOW quality (below 50)
- Quality measures STRUCTURAL CLARITY, not directional conviction
- Quality = How easy is it to define entry, stop-loss, and targets?

[LIVE ANALYSIS MODE]
This is a LIVE intraday analysis. The current price is the REAL-TIME price, not the previous day's close.

ASSET: ${symbol} (${name || symbol})
CURRENT PRICE (LIVE): $${currentPrice.toFixed(2)}

OHLCV DATA (Date,Open,High,Low,Close,Volume):
${ohlcvText}
${featuresText}

TASK 1 - DIRECTIONAL ANALYSIS:
Evaluate the probability and magnitude of price movement. Score from -100 (max bearish) to +100 (max bullish).

TASK 2 - STRUCTURAL QUALITY (Direction-Agnostic):
Evaluate the chart's structural integrity and tradability. This is INDEPENDENT of direction.
- Boundary Definition: How precisely defined are support/resistance levels?
- Structural Compliance: Does the pattern conform to textbook technical analysis?
- Volatility Profile: Is price action clean or choppy/noisy?
- Volume Coherence: Does volume confirm the pattern?
- Risk-Reward Clarity: How easy is it to place a logical stop-loss?

Return ONLY a valid JSON object with this exact structure:
{
  "direction": "bullish" or "bearish" or "neutral",
  "ai_direction_score": integer from -100 to +100 (directional conviction only),
  "ai_setup_quality_score": integer from 0 to 100 (structural quality only - INDEPENDENT of direction!),
  "setup_type": "breakout" or "reversal" or "continuation" or "range",
  "attention_level": "URGENT" or "FOCUS" or "WATCH" or "IGNORE",
  "confidence": float from 0.0 to 1.0,
  "summary_text": "5-7 sentence technical analysis. Include: 1) Current trend context, 2) Recent price action with levels, 3) Pattern identification, 4) Trade thesis, 5) Risk definition. Use specific prices. Note this is LIVE intraday analysis.",
  "key_levels": {
    "support": [price1, price2],
    "resistance": [price1, price2],
    "invalidation": price
  },
  "entry_zone": {
    "low": price,
    "high": price
  },
  "targets": [price1, price2, price3],
  "why_now": "1-2 sentences on why this setup is relevant RIGHT NOW with live price",
  "risks": ["risk1", "risk2"],
  "what_to_watch": "Key thing to monitor",
  "quality_subscores": {
    "boundary_definition": 1-5,
    "structural_compliance": 1-5,
    "volatility_profile": 1-5,
    "volume_coherence": 1-5,
    "risk_reward_clarity": 1-5
  }
}`
}

/**
 * Call Gemini API for analysis
 */
async function callGeminiAPI(prompt: string): Promise<AIAnalysisResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY!
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Gemini API error: ${response.status} - ${errorText}`)
      return null
    }

    const data = await response.json()
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const jsonText = data.candidates[0].content.parts[0].text
      return JSON.parse(jsonText) as AIAnalysisResult
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error)
  }

  return null
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const body = await req.json()
    const { asset_id, save_to_db = false } = body

    if (!asset_id) {
      return new Response(JSON.stringify({ error: 'asset_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get asset info
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('asset_id, symbol, name, asset_type')
      .eq('asset_id', asset_id)
      .single()

    if (assetError || !asset) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Live Analysis] Starting analysis for ${asset.symbol} (${asset.asset_id})`)

    // Fetch current intraday price
    const intradayData = await fetchIntradayPrice(asset.symbol, asset.asset_type)
    if (!intradayData) {
      return new Response(JSON.stringify({ 
        error: 'Could not fetch current price',
        message: 'Unable to retrieve real-time price data. Market may be closed or symbol not supported.'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const currentPrice = intradayData.price
    console.log(`[Live Analysis] Current price for ${asset.symbol}: $${currentPrice}`)

    // Fetch historical OHLCV data (last 365 days)
    const { data: barsData, error: barsError } = await supabase
      .from('daily_bars')
      .select('date, open, high, low, close, volume')
      .eq('asset_id', asset_id)
      .order('date', { ascending: false })
      .limit(365)

    if (barsError || !barsData || barsData.length < 20) {
      return new Response(JSON.stringify({ 
        error: 'Insufficient historical data',
        message: 'Need at least 20 days of historical data for analysis.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Reverse to chronological order and convert to proper types
    const bars: OHLCVBar[] = barsData.reverse().map(b => ({
      date: b.date,
      open: parseFloat(b.open),
      high: parseFloat(b.high),
      low: parseFloat(b.low),
      close: parseFloat(b.close),
      volume: parseFloat(b.volume)
    }))

    console.log(`[Live Analysis] Loaded ${bars.length} historical bars`)

    // Calculate technical features
    const features = calculateFeatures(bars, currentPrice)
    console.log(`[Live Analysis] Calculated features:`, Object.keys(features).length)

    // Build prompt and call Gemini
    const prompt = buildPrompt(asset.symbol, asset.name, bars, currentPrice, features)
    const analysis = await callGeminiAPI(prompt)

    if (!analysis) {
      return new Response(JSON.stringify({ 
        error: 'AI analysis failed',
        message: 'Could not generate analysis. Please try again.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[Live Analysis] Analysis complete for ${asset.symbol}: ${analysis.direction} (${analysis.ai_direction_score})`)

    // Optionally save to database
    if (save_to_db) {
      const today = new Date().toISOString().split('T')[0]
      
      const { error: insertError } = await supabase
        .from('asset_ai_reviews')
        .upsert({
          asset_id: asset_id,
          as_of_date: today,
          direction: analysis.direction,
          ai_direction_score: analysis.ai_direction_score,
          ai_setup_quality_score: analysis.ai_setup_quality_score,
          setup_type: analysis.setup_type,
          ai_attention_level: analysis.attention_level,
          ai_confidence: analysis.confidence,
          ai_summary_text: analysis.summary_text,
          ai_key_levels: analysis.key_levels,
          ai_entry: analysis.entry_zone,
          ai_targets: analysis.targets,
          ai_why_now: analysis.why_now ? { text: analysis.why_now } : null,
          ai_risks: analysis.risks,
          ai_what_to_watch_next: analysis.what_to_watch ? { text: analysis.what_to_watch } : null,
          model_id: GEMINI_MODEL,
          review_version: 'live-v1.0',
          is_live_update: true
        }, {
          onConflict: 'asset_id,as_of_date'
        })

      if (insertError) {
        console.error('[Live Analysis] Error saving to database:', insertError)
      } else {
        console.log(`[Live Analysis] Saved analysis to database for ${asset.symbol}`)
      }
    }

    // Return the analysis result
    return new Response(JSON.stringify({
      success: true,
      asset: {
        asset_id: asset.asset_id,
        symbol: asset.symbol,
        name: asset.name,
        asset_type: asset.asset_type
      },
      live_price: currentPrice,
      last_close: bars[bars.length - 1].close,
      price_change_pct: ((currentPrice - bars[bars.length - 1].close) / bars[bars.length - 1].close * 100).toFixed(2),
      analysis: {
        direction: analysis.direction,
        ai_direction_score: analysis.ai_direction_score,
        ai_setup_quality_score: analysis.ai_setup_quality_score,
        setup_type: analysis.setup_type,
        attention_level: analysis.attention_level,
        confidence: analysis.confidence,
        summary_text: analysis.summary_text,
        key_levels: analysis.key_levels,
        entry_zone: analysis.entry_zone,
        targets: analysis.targets,
        why_now: analysis.why_now,
        risks: analysis.risks,
        what_to_watch: analysis.what_to_watch,
        quality_subscores: analysis.quality_subscores
      },
      features: features,
      model: GEMINI_MODEL,
      timestamp: new Date().toISOString(),
      saved_to_db: save_to_db
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Live Analysis] Error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

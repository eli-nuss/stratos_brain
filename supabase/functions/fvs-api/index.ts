// Supabase Edge Function: Fundamental Vigor Score (FVS) API
// 
// This implements the Qualitative Fundamental Analysis scoring system using:
// - FMP for financial data
// - Gemini LLM for qualitative analysis
//
// Endpoints:
// - GET /score/:symbol - Get FVS for a single stock
// - GET /batch?symbols=AAPL,MSFT,NVDA - Score multiple stocks (max 5)
// - GET /latest/:symbol - Get latest cached FVS
// - GET /health - Health check
//
// The FVS is completely separate from the technical analysis signal workflow.
// It provides a 0-100 score based on four pillars:
// - Profitability & Efficiency (35%)
// - Solvency & Liquidity (25%)
// - Growth & Momentum (20%)
// - Quality & Moat (20%)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Environment
const FMP_API_KEY = Deno.env.get('FMP_API_KEY')
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable'
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://wfogbaipiqootjrsprde.supabase.co'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Configuration
const CACHE_DURATION_HOURS = 168 // 7 days for FVS (fundamentals don't change often)
const GEMINI_MODEL = 'gemini-3-flash-preview' // Using Gemini 3 Flash for faster analysis
const PROMPT_VERSION = '1.0'

// Pillar weights
const PILLAR_WEIGHTS = {
  profitability: 0.35,
  solvency: 0.25,
  growth: 0.20,
  moat: 0.20
}

// ============================================================================
// Types
// ============================================================================
interface QuantitativeMetrics {
  // Profitability
  roic: number | null
  grossMargin: number | null
  grossMarginTrend: number | null
  operatingMargin: number | null
  netMargin: number | null
  assetTurnover: number | null
  roe: number | null
  roa: number | null
  
  // Solvency
  currentRatio: number | null
  quickRatio: number | null
  netDebtToEbitda: number | null
  interestCoverage: number | null
  debtToEquity: number | null
  altmanZScore: number | null
  
  // Growth
  revenueCagr4y: number | null
  ebitdaCagr4y: number | null
  fcfCagr4y: number | null
  revenueGrowthYoy: number | null
  revenueAcceleration: number | null
  
  // Quality
  accrualRatio: number | null
  fcfToNetIncome: number | null
  piotroskiFScore: number | null
  piotroskiComponents: Record<string, boolean>
  
  // Raw values
  revenueTtm: number | null
  ebitdaTtm: number | null
  netIncomeTtm: number | null
  freeCashFlowTtm: number | null
  totalDebt: number | null
  totalEquity: number | null
  totalAssets: number | null
  cash: number | null
  marketCap: number | null
  
  // History
  revenueHistory: number[]
  ebitdaHistory: number[]
  netIncomeHistory: number[]
  fcfHistory: number[]
  quarterlyRevenue: number[]
}

interface FVSResult {
  symbol: string
  companyName: string
  sector: string
  industry: string
  asOfDate: string
  
  // Pillar scores
  profitabilityScore: number
  solvencyScore: number
  growthScore: number
  moatScore: number
  
  // Final score
  finalScore: number
  
  // Metadata
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  dataQualityScore: number
  piotroskiFScore: number | null
  altmanZScore: number | null
  
  // Reasoning
  finalReasoningParagraph: string
  keyStrengths: string[]
  keyRisks: string[]
  qualityTier: string
  
  // Breakdown
  pillarDetails: Record<string, any>
  
  // Cache info
  cachedAt: string | null
  modelName: string
  promptVersion: string
}

// ============================================================================
// FMP API Functions (using stable API)
// ============================================================================
async function fetchFMP(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const queryParams = new URLSearchParams({ ...params, apikey: FMP_API_KEY! })
  const url = `${FMP_BASE_URL}/${endpoint}?${queryParams.toString()}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`FMP API error: ${response.status} for ${endpoint}:`, errorText)
      return null
    }
    const data = await response.json()
    // Check for FMP error response
    if (data && data['Error Message']) {
      console.error(`FMP API error for ${endpoint}:`, data['Error Message'])
      return null
    }
    return data
  } catch (error) {
    console.error(`FMP fetch error for ${endpoint}:`, error)
    return null
  }
}

// ============================================================================
// Calculation Functions
// ============================================================================
function safeDivide(num: number | null | undefined, den: number | null | undefined): number | null {
  if (num === null || num === undefined || den === null || den === undefined || den === 0) return null
  return num / den
}

function calculateCAGR(values: number[], years: number = 4): number | null {
  if (!values || values.length < 2) return null
  
  const endValue = values[0]
  const startIdx = Math.min(years, values.length - 1)
  const startValue = values[startIdx]
  
  if (!startValue || startValue <= 0 || !endValue || endValue <= 0) return null
  
  try {
    return Math.pow(endValue / startValue, 1 / startIdx) - 1
  } catch {
    return null
  }
}

function calculateAltmanZScore(
  workingCapital: number | null,
  retainedEarnings: number | null,
  ebit: number | null,
  marketCap: number | null,
  totalLiabilities: number | null,
  revenue: number | null,
  totalAssets: number | null
): number | null {
  if (!totalAssets || totalAssets <= 0) return null
  
  const a = safeDivide(workingCapital, totalAssets) || 0
  const b = safeDivide(retainedEarnings, totalAssets) || 0
  const c = safeDivide(ebit, totalAssets) || 0
  const d = totalLiabilities ? (safeDivide(marketCap, totalLiabilities) || 0) : 0
  const e = safeDivide(revenue, totalAssets) || 0
  
  return 1.2 * a + 1.4 * b + 3.3 * c + 0.6 * d + 1.0 * e
}

function calculatePiotroski(
  netIncome: number | null,
  ocf: number | null,
  roaCurrent: number | null,
  roaPrior: number | null,
  debtRatioCurrent: number | null,
  debtRatioPrior: number | null,
  currentRatioCurrent: number | null,
  currentRatioPrior: number | null,
  grossMarginCurrent: number | null,
  grossMarginPrior: number | null,
  assetTurnoverCurrent: number | null,
  assetTurnoverPrior: number | null
): { score: number, components: Record<string, boolean> } {
  const components: Record<string, boolean> = {}
  let score = 0
  
  // Profitability (4 points)
  components.positiveNetIncome = netIncome !== null && netIncome > 0
  if (components.positiveNetIncome) score++
  
  components.positiveOcf = ocf !== null && ocf > 0
  if (components.positiveOcf) score++
  
  components.roaIncreasing = roaCurrent !== null && roaPrior !== null && roaCurrent > roaPrior
  if (components.roaIncreasing) score++
  
  components.ocfGtNetIncome = ocf !== null && netIncome !== null && ocf > netIncome
  if (components.ocfGtNetIncome) score++
  
  // Leverage (3 points)
  components.debtRatioDecreasing = debtRatioCurrent !== null && debtRatioPrior !== null && debtRatioCurrent < debtRatioPrior
  if (components.debtRatioDecreasing) score++
  
  components.currentRatioIncreasing = currentRatioCurrent !== null && currentRatioPrior !== null && currentRatioCurrent > currentRatioPrior
  if (components.currentRatioIncreasing) score++
  
  components.noDilution = true // Simplified
  if (components.noDilution) score++
  
  // Efficiency (2 points)
  components.grossMarginIncreasing = grossMarginCurrent !== null && grossMarginPrior !== null && grossMarginCurrent > grossMarginPrior
  if (components.grossMarginIncreasing) score++
  
  components.assetTurnoverIncreasing = assetTurnoverCurrent !== null && assetTurnoverPrior !== null && assetTurnoverCurrent > assetTurnoverPrior
  if (components.assetTurnoverIncreasing) score++
  
  return { score, components }
}

// ============================================================================
// Data Fetching
// ============================================================================
async function fetchQuantitativeMetrics(symbol: string): Promise<{ metrics: QuantitativeMetrics, company: any } | null> {
  // Fetch all data in parallel using stable API endpoints
  const [profile, incomeAnnual, incomeQuarterly, balance, cashFlow, ratios] = await Promise.all([
    fetchFMP('profile', { symbol }),
    fetchFMP('income-statement', { symbol, limit: '5' }),
    fetchFMP('income-statement', { symbol, period: 'quarter', limit: '8' }),
    fetchFMP('balance-sheet-statement', { symbol, limit: '2' }),
    fetchFMP('cash-flow-statement', { symbol, limit: '2' }),
    fetchFMP('ratios-ttm', { symbol }),
  ])
  
  if (!profile || profile.length === 0) {
    return null
  }
  
  const p = profile[0]
  const inc = incomeAnnual?.[0] || {}
  const incPrior = incomeAnnual?.[1] || {}
  const bal = balance?.[0] || {}
  const balPrior = balance?.[1] || {}
  const cf = cashFlow?.[0] || {}
  const r = ratios?.[0] || {}
  
  // Calculate metrics
  const revenue = inc.revenue || 0
  const grossProfit = inc.grossProfit || 0
  const operatingIncome = inc.operatingIncome || 0
  const netIncome = inc.netIncome || 0
  const ebitda = inc.ebitda || 0
  
  const totalAssets = bal.totalAssets || 0
  const totalEquity = bal.totalStockholdersEquity || 0
  const totalDebt = bal.totalDebt || 0
  const cash = bal.cashAndCashEquivalents || 0
  const currentAssets = bal.totalCurrentAssets || 0
  const currentLiabilities = bal.totalCurrentLiabilities || 0
  const totalLiabilities = bal.totalLiabilities || 0
  const retainedEarnings = bal.retainedEarnings || 0
  
  const ocf = cf.operatingCashFlow || 0
  const capex = Math.abs(cf.capitalExpenditure || 0)
  const fcf = ocf - capex
  
  // Historical data
  const revenueHistory = incomeAnnual?.map((i: any) => i.revenue).filter(Boolean) || []
  const ebitdaHistory = incomeAnnual?.map((i: any) => i.ebitda).filter(Boolean) || []
  const netIncomeHistory = incomeAnnual?.map((i: any) => i.netIncome).filter(Boolean) || []
  const fcfHistory = cashFlow?.map((c: any) => (c.operatingCashFlow || 0) - Math.abs(c.capitalExpenditure || 0)) || []
  const quarterlyRevenue = incomeQuarterly?.map((q: any) => q.revenue).filter(Boolean) || []
  
  // Margins
  const grossMargin = safeDivide(grossProfit, revenue)
  const operatingMargin = safeDivide(operatingIncome, revenue)
  const netMargin = safeDivide(netIncome, revenue)
  
  // Prior year margins for trend
  const grossMarginPrior = safeDivide(incPrior.grossProfit, incPrior.revenue)
  const grossMarginTrend = grossMargin !== null && grossMarginPrior !== null ? grossMargin - grossMarginPrior : null
  
  // Returns
  const roe = safeDivide(netIncome, totalEquity)
  const roa = safeDivide(netIncome, totalAssets)
  const roaPrior = safeDivide(incPrior.netIncome, balPrior.totalAssets)
  const assetTurnover = safeDivide(revenue, totalAssets)
  const assetTurnoverPrior = safeDivide(incPrior.revenue, balPrior.totalAssets)
  
  // Liquidity
  const currentRatio = safeDivide(currentAssets, currentLiabilities)
  const currentRatioPrior = safeDivide(balPrior.totalCurrentAssets, balPrior.totalCurrentLiabilities)
  const quickRatio = safeDivide(currentAssets - (bal.inventory || 0), currentLiabilities)
  
  // Leverage
  const debtToEquity = safeDivide(totalDebt, totalEquity)
  const debtRatioCurrent = safeDivide(totalDebt, totalAssets)
  const debtRatioPrior = safeDivide(balPrior.totalDebt, balPrior.totalAssets)
  const netDebtToEbitda = safeDivide(totalDebt - cash, ebitda)
  const interestCoverage = safeDivide(operatingIncome, inc.interestExpense)
  
  // Altman Z-Score
  const workingCapital = currentAssets - currentLiabilities
  const altmanZScore = calculateAltmanZScore(
    workingCapital, retainedEarnings, operatingIncome,
    p.mktCap, totalLiabilities, revenue, totalAssets
  )
  
  // Growth
  const revenueCagr4y = calculateCAGR(revenueHistory, 4)
  const ebitdaCagr4y = calculateCAGR(ebitdaHistory, 4)
  const fcfCagr4y = calculateCAGR(fcfHistory, 4)
  const revenueGrowthYoy = revenueHistory.length >= 2 ? safeDivide(revenueHistory[0] - revenueHistory[1], revenueHistory[1]) : null
  
  // Revenue acceleration
  let revenueAcceleration: number | null = null
  if (quarterlyRevenue.length >= 6) {
    const recentYoy = safeDivide(quarterlyRevenue[0] - quarterlyRevenue[4], quarterlyRevenue[4])
    const priorYoy = safeDivide(quarterlyRevenue[1] - quarterlyRevenue[5], quarterlyRevenue[5])
    if (recentYoy !== null && priorYoy !== null) {
      revenueAcceleration = recentYoy - priorYoy
    }
  }
  
  // Quality
  const avgAssets = totalAssets && balPrior.totalAssets ? (totalAssets + balPrior.totalAssets) / 2 : totalAssets
  const accruals = netIncome - ocf
  const accrualRatio = safeDivide(accruals, avgAssets)
  const fcfToNetIncome = safeDivide(fcf, netIncome)
  
  // Piotroski
  const piotroski = calculatePiotroski(
    netIncome, ocf,
    roa, roaPrior,
    debtRatioCurrent, debtRatioPrior,
    currentRatio, currentRatioPrior,
    grossMargin, grossMarginPrior,
    assetTurnover, assetTurnoverPrior
  )
  
  const metrics: QuantitativeMetrics = {
    roic: r.returnOnCapitalEmployedTTM || null,
    grossMargin,
    grossMarginTrend,
    operatingMargin,
    netMargin,
    assetTurnover,
    roe,
    roa,
    currentRatio,
    quickRatio,
    netDebtToEbitda,
    interestCoverage,
    debtToEquity,
    altmanZScore,
    revenueCagr4y,
    ebitdaCagr4y,
    fcfCagr4y,
    revenueGrowthYoy,
    revenueAcceleration,
    accrualRatio,
    fcfToNetIncome,
    piotroskiFScore: piotroski.score,
    piotroskiComponents: piotroski.components,
    revenueTtm: revenue,
    ebitdaTtm: ebitda,
    netIncomeTtm: netIncome,
    freeCashFlowTtm: fcf,
    totalDebt,
    totalEquity,
    totalAssets,
    cash,
    marketCap: p.mktCap,
    revenueHistory,
    ebitdaHistory,
    netIncomeHistory,
    fcfHistory,
    quarterlyRevenue
  }
  
  return {
    metrics,
    company: {
      symbol: symbol.toUpperCase(),
      companyName: p.companyName || symbol,
      sector: p.sector || 'Unknown',
      industry: p.industry || 'Unknown'
    }
  }
}

// ============================================================================
// Gemini LLM Integration
// ============================================================================
const FVS_SYSTEM_PROMPT = `You are an expert CFA-certified Quantitative Financial Analyst.
Your role is to evaluate the fundamental health of a company based on pre-calculated financial metrics.

# SCORING METHODOLOGY: FOUR PILLARS

## Pillar 1: Profitability & Efficiency (Weight: 35%)
- ROIC: >20% = excellent, >10% = good, <5% = poor
- Gross Margin: Higher is better, expanding trend is positive
- Operating Margin: >20% = excellent, >10% = good
Score 90-100: ROIC >20%, expanding margins
Score 70-89: ROIC >10%, stable margins
Score 50-69: ROIC 5-10%, mixed trends
Score 30-49: ROIC <5%, contracting margins
Score 0-29: Operating losses

## Pillar 2: Solvency & Liquidity (Weight: 25%)
- Current Ratio: >2.0 = strong, <1.0 = weak
- Net Debt/EBITDA: <1x = fortress, >4x = concerning
- Altman Z-Score: >3.0 = safe, <1.8 = distress
CONSTRAINT: If Altman Z-Score < 1.8, score cannot exceed 50.
Score 90-100: Net cash, Z-Score >3
Score 70-89: Low leverage, Z-Score >2.5
Score 50-69: Moderate leverage
Score 30-49: High leverage
Score 0-29: Distress risk

## Pillar 3: Growth & Momentum (Weight: 20%)
- 4-Year Revenue CAGR: >15% = high, <5% = low
- Revenue Acceleration: Positive = speeding up
Score 90-100: CAGR >20%, accelerating
Score 70-89: CAGR 10-20%
Score 50-69: CAGR 5-10%
Score 30-49: CAGR <5%
Score 0-29: Revenue decline

## Pillar 4: Quality & Moat (Weight: 20%)
- FCF/Net Income: >100% = excellent, <80% = concerning
- Piotroski F-Score: 7-9 = strong, 0-3 = weak
CONSTRAINT: If Piotroski <=3, score cannot exceed 60.
Score 90-100: F-Score 8-9, excellent cash conversion
Score 70-89: F-Score 6-7
Score 50-69: F-Score 4-5
Score 30-49: F-Score 2-3
Score 0-29: F-Score 0-1

# OUTPUT REQUIREMENTS
Return valid JSON with:
- sub_scores: {profitability, solvency, growth, moat} (0-100 each)
- confidence_level: "HIGH" | "MEDIUM" | "LOW"
- data_quality_score: 0.0-1.0
- final_reasoning_paragraph: 100-200 word summary with specific metrics cited
- key_strengths: 2-4 bullet points
- key_risks: 2-4 bullet points
- quality_tier: "fortress" | "quality" | "average" | "speculative" | "distressed"
- pillar_details: breakdown for each pillar

Be critical. Score of 50 is average. Every claim must cite specific numbers.`

async function callGemini(metrics: QuantitativeMetrics, company: any, asOfDate: string): Promise<any> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }
  
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ 
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json"
    }
  })
  
  // Build context packet
  const contextPacket = {
    company,
    as_of_date: asOfDate,
    quantitative_metrics: {
      // Profitability
      roic: metrics.roic ? `${(metrics.roic * 100).toFixed(1)}%` : 'N/A',
      gross_margin: metrics.grossMargin ? `${(metrics.grossMargin * 100).toFixed(1)}%` : 'N/A',
      gross_margin_trend: metrics.grossMarginTrend ? `${(metrics.grossMarginTrend * 100).toFixed(2)}%` : 'N/A',
      operating_margin: metrics.operatingMargin ? `${(metrics.operatingMargin * 100).toFixed(1)}%` : 'N/A',
      net_margin: metrics.netMargin ? `${(metrics.netMargin * 100).toFixed(1)}%` : 'N/A',
      roe: metrics.roe ? `${(metrics.roe * 100).toFixed(1)}%` : 'N/A',
      roa: metrics.roa ? `${(metrics.roa * 100).toFixed(1)}%` : 'N/A',
      asset_turnover: metrics.assetTurnover?.toFixed(2) || 'N/A',
      
      // Solvency
      current_ratio: metrics.currentRatio?.toFixed(2) || 'N/A',
      quick_ratio: metrics.quickRatio?.toFixed(2) || 'N/A',
      net_debt_to_ebitda: metrics.netDebtToEbitda?.toFixed(2) || 'N/A',
      interest_coverage: metrics.interestCoverage?.toFixed(1) || 'N/A',
      debt_to_equity: metrics.debtToEquity?.toFixed(2) || 'N/A',
      altman_z_score: metrics.altmanZScore?.toFixed(2) || 'N/A',
      
      // Growth
      revenue_cagr_4y: metrics.revenueCagr4y ? `${(metrics.revenueCagr4y * 100).toFixed(1)}%` : 'N/A',
      ebitda_cagr_4y: metrics.ebitdaCagr4y ? `${(metrics.ebitdaCagr4y * 100).toFixed(1)}%` : 'N/A',
      fcf_cagr_4y: metrics.fcfCagr4y ? `${(metrics.fcfCagr4y * 100).toFixed(1)}%` : 'N/A',
      revenue_growth_yoy: metrics.revenueGrowthYoy ? `${(metrics.revenueGrowthYoy * 100).toFixed(1)}%` : 'N/A',
      revenue_acceleration: metrics.revenueAcceleration ? `${(metrics.revenueAcceleration * 100).toFixed(2)}%` : 'N/A',
      
      // Quality
      accrual_ratio: metrics.accrualRatio?.toFixed(3) || 'N/A',
      fcf_to_net_income: metrics.fcfToNetIncome ? `${(metrics.fcfToNetIncome * 100).toFixed(0)}%` : 'N/A',
      piotroski_f_score: metrics.piotroskiFScore,
      piotroski_components: metrics.piotroskiComponents
    },
    financial_history: {
      revenue_4y: metrics.revenueHistory.slice(0, 4),
      ebitda_4y: metrics.ebitdaHistory.slice(0, 4),
      net_income_4y: metrics.netIncomeHistory.slice(0, 4),
      fcf_4y: metrics.fcfHistory.slice(0, 4)
    },
    raw_values: {
      revenue_ttm: metrics.revenueTtm,
      ebitda_ttm: metrics.ebitdaTtm,
      net_income_ttm: metrics.netIncomeTtm,
      fcf_ttm: metrics.freeCashFlowTtm,
      total_debt: metrics.totalDebt,
      total_equity: metrics.totalEquity,
      total_assets: metrics.totalAssets,
      cash: metrics.cash,
      market_cap: metrics.marketCap
    }
  }
  
  const prompt = `Analyze the following company's fundamental data and provide a Fundamental Vigor Score assessment.

INPUT DATA:
${JSON.stringify(contextPacket, null, 2)}

Provide your analysis following the scoring methodology in your instructions.
Return JSON only.`
  
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: FVS_SYSTEM_PROMPT
  })
  
  const responseText = result.response.text()
  return JSON.parse(responseText)
}

// ============================================================================
// Main Scoring Function
// ============================================================================
async function scoreFVS(symbol: string, supabase: any, forceRefresh: boolean = false): Promise<FVSResult | null> {
  const asOfDate = new Date().toISOString().split('T')[0]
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('fundamental_vigor_scores')
      .select('*')
      .eq('asset_id', await getAssetId(supabase, symbol))
      .eq('as_of_date', asOfDate)
      .single()
    
    if (cached) {
      console.log(`Using cached FVS for ${symbol}`)
      return formatCachedResult(cached, symbol)
    }
  }
  
  // Fetch fresh data
  console.log(`Fetching fresh data for ${symbol}`)
  const data = await fetchQuantitativeMetrics(symbol)
  
  if (!data) {
    console.error(`Failed to fetch data for ${symbol}`)
    return null
  }
  
  const { metrics, company } = data
  
  // Call Gemini for analysis
  console.log(`Calling Gemini for ${symbol}`)
  let llmResult
  try {
    llmResult = await callGemini(metrics, company, asOfDate)
  } catch (error) {
    console.error(`Gemini call failed for ${symbol}:`, error)
    return null
  }
  
  // Calculate final score
  const subScores = llmResult.sub_scores
  const finalScore = 
    subScores.profitability * PILLAR_WEIGHTS.profitability +
    subScores.solvency * PILLAR_WEIGHTS.solvency +
    subScores.growth * PILLAR_WEIGHTS.growth +
    subScores.moat * PILLAR_WEIGHTS.moat
  
  // Build result
  const result: FVSResult = {
    symbol: symbol.toUpperCase(),
    companyName: company.companyName,
    sector: company.sector,
    industry: company.industry,
    asOfDate,
    profitabilityScore: subScores.profitability,
    solvencyScore: subScores.solvency,
    growthScore: subScores.growth,
    moatScore: subScores.moat,
    finalScore: Math.round(finalScore * 100) / 100,
    confidenceLevel: llmResult.confidence_level,
    dataQualityScore: llmResult.data_quality_score,
    piotroskiFScore: metrics.piotroskiFScore,
    altmanZScore: metrics.altmanZScore,
    finalReasoningParagraph: llmResult.final_reasoning_paragraph,
    keyStrengths: llmResult.key_strengths,
    keyRisks: llmResult.key_risks,
    qualityTier: llmResult.quality_tier,
    pillarDetails: llmResult.pillar_details || {},
    cachedAt: new Date().toISOString(),
    modelName: GEMINI_MODEL,
    promptVersion: PROMPT_VERSION
  }
  
  // Save to database
  const assetId = await getAssetId(supabase, symbol)
  if (assetId) {
    await saveFVSResult(supabase, assetId, result, metrics)
  }
  
  return result
}

async function getAssetId(supabase: any, symbol: string): Promise<number | null> {
  const { data } = await supabase
    .from('assets')
    .select('asset_id')
    .eq('symbol', symbol.toUpperCase())
    .single()
  
  return data?.asset_id || null
}

async function saveFVSResult(supabase: any, assetId: number, result: FVSResult, metrics: QuantitativeMetrics): Promise<void> {
  try {
    await supabase
      .from('fundamental_vigor_scores')
      .upsert({
        asset_id: assetId,
        as_of_date: result.asOfDate,
        profitability_score: result.profitabilityScore,
        solvency_score: result.solvencyScore,
        growth_score: result.growthScore,
        moat_score: result.moatScore,
        final_score: result.finalScore,
        confidence_level: result.confidenceLevel,
        data_quality_score: result.dataQualityScore,
        piotroski_f_score: result.piotroskiFScore,
        altman_z_score: result.altmanZScore,
        final_reasoning_paragraph: result.finalReasoningParagraph,
        score_breakdown: {
          key_strengths: result.keyStrengths,
          key_risks: result.keyRisks,
          quality_tier: result.qualityTier,
          pillar_details: result.pillarDetails
        },
        quantitative_metrics: metrics,
        model_name: result.modelName,
        prompt_version: result.promptVersion
      }, {
        onConflict: 'asset_id,as_of_date'
      })
    
    console.log(`Saved FVS for ${result.symbol}`)
  } catch (error) {
    console.error(`Failed to save FVS for ${result.symbol}:`, error)
  }
}

function formatCachedResult(cached: any, symbol: string): FVSResult {
  return {
    symbol: symbol.toUpperCase(),
    companyName: cached.company_name || symbol,
    sector: cached.sector || 'Unknown',
    industry: cached.industry || 'Unknown',
    asOfDate: cached.as_of_date,
    profitabilityScore: cached.profitability_score,
    solvencyScore: cached.solvency_score,
    growthScore: cached.growth_score,
    moatScore: cached.moat_score,
    finalScore: cached.final_score,
    confidenceLevel: cached.confidence_level,
    dataQualityScore: cached.data_quality_score,
    piotroskiFScore: cached.piotroski_f_score,
    altmanZScore: cached.altman_z_score,
    finalReasoningParagraph: cached.final_reasoning_paragraph,
    keyStrengths: cached.score_breakdown?.key_strengths || [],
    keyRisks: cached.score_breakdown?.key_risks || [],
    qualityTier: cached.score_breakdown?.quality_tier || 'unknown',
    pillarDetails: cached.score_breakdown?.pillar_details || {},
    cachedAt: cached.created_at,
    modelName: cached.model_name,
    promptVersion: cached.prompt_version
  }
}

// ============================================================================
// HTTP Handler
// ============================================================================
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  const url = new URL(req.url)
  const path = url.pathname.replace('/fvs-api', '')
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY!)
  
  try {
    // Health check
    if (path === '/health' || path === '/') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'fvs-api',
        version: PROMPT_VERSION,
        model: GEMINI_MODEL
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Single symbol score: /score/:symbol
    const scoreMatch = path.match(/^\/score\/([A-Za-z0-9.-]+)$/)
    if (scoreMatch) {
      const symbol = scoreMatch[1].toUpperCase()
      const forceRefresh = url.searchParams.get('refresh') === 'true'
      
      const result = await scoreFVS(symbol, supabase, forceRefresh)
      
      if (!result) {
        return new Response(JSON.stringify({
          error: 'Failed to score symbol',
          symbol
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Latest cached score: /latest/:symbol
    const latestMatch = path.match(/^\/latest\/([A-Za-z0-9.-]+)$/)
    if (latestMatch) {
      const symbol = latestMatch[1].toUpperCase()
      const assetId = await getAssetId(supabase, symbol)
      
      if (!assetId) {
        return new Response(JSON.stringify({
          error: 'Symbol not found',
          symbol
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const { data: cached } = await supabase
        .from('fundamental_vigor_scores')
        .select('*')
        .eq('asset_id', assetId)
        .order('as_of_date', { ascending: false })
        .limit(1)
        .single()
      
      if (!cached) {
        return new Response(JSON.stringify({
          error: 'No FVS found for symbol',
          symbol
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify(formatCachedResult(cached, symbol)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Batch scoring: /batch?symbols=AAPL,MSFT,NVDA
    if (path === '/batch') {
      const symbolsParam = url.searchParams.get('symbols')
      if (!symbolsParam) {
        return new Response(JSON.stringify({
          error: 'Missing symbols parameter'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const symbols = symbolsParam.split(',').slice(0, 5) // Max 5 symbols
      const forceRefresh = url.searchParams.get('refresh') === 'true'
      
      const results: Record<string, FVSResult | null> = {}
      
      for (const symbol of symbols) {
        results[symbol.toUpperCase()] = await scoreFVS(symbol.trim(), supabase, forceRefresh)
      }
      
      return new Response(JSON.stringify({
        results,
        count: Object.values(results).filter(Boolean).length,
        total: symbols.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Not found
    return new Response(JSON.stringify({
      error: 'Not found',
      availableEndpoints: [
        'GET /score/:symbol',
        'GET /latest/:symbol',
        'GET /batch?symbols=AAPL,MSFT',
        'GET /health'
      ]
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('FVS API error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

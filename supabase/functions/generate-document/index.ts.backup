// Supabase Edge Function: Gemini-based Document Generation
// Generates investment memos and one-pagers using Gemini 3 Pro with Google Search grounding
//
// This replaces the Manus-based document generation with a synchronous Gemini approach.
// The function fetches asset data from the control-api, then uses Gemini with web search
// to generate comprehensive investment documents.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// ==================== TEMPLATES ====================

const MEMO_TEMPLATE = `# Investment Memo: [Company Name] (Ticker)

Date: [Date] | Analyst: Stratos Brain AI

Recommendation: [Long / Short / Watch] | Conviction: [High / Medium / Low]

## Market Data Snapshot

*[Agent Instruction: Determine which valuation multiples make sense based on the business. What does it seem to trade off of or what do similar companies seem to trade based on?]*

| Metric | Value | Metric | Value |
|--------|-------|--------|-------|
| Current Price | $[Price] | Market Cap | $[X]B |
| [P/E (TTM) OR P/Sales, etc.] | [X]x | [P/E (Fwd) OR EV/Rev, etc.] | [X]x |
| [FCF Yield OR Cash Runway, etc.] | [X] | [ROIC OR Gross Margin, etc.] | [X] |
| 1-Year Return | [X]% | 3-Year Return | [X]% |
| 5-Year Return | [X]% | Trend Signal | [Bullish/Bearish] |

---

## 1. Executive Summary: The "Why Now?"

### The Hook & Opportunity
- **The Thesis in 2 Sentences:** [Succinctly state the core opportunity.]
- **Why Now?:** [Why does this opportunity exist *today*? e.g., "Stock fell 20% on temporary news," "New CEO," "Regulatory change."]
- **Consensus vs. Reality:**
  - *Market View:* [What the consensus believes.]
  - *Our View:* [How we differ.]
  - *The Gap:* [The specific misunderstanding creating the alpha.]

### Synthesized Target Price

| Methodology | Price Target | Weighting | Implied Upside |
|-------------|--------------|-----------|----------------|
| Fundamental (Multiple Re-rating) | $[Price] | 40% | [X]% |
| Fundamental (DCF/Consensus) | $[Price] | 40% | [X]% |
| Technical (Resistance/Support) | $[Price] | 20% | [X]% |
| **BLENDED TARGET** | **$[Price]** | **100%** | **[Total Upside]%** |

---

## 2. Business Overview & Segment Analysis

### Business Models by Segment
*[Agent Instruction: Briefly explain what each division actually does and how it makes money (e.g., "Subscription SaaS" vs "One-time Hardware Sales").]*

- **Segment A ([Name]):** [Description of business model].
- **Segment B ([Name]):** [Description of business model].
- **Segment C ([Name]):** [Description of business model].

### Segment Performance (5-Year Lookback)

| Segment Revenue ($M) | FY-5 | FY-4 | FY-3 | FY-2 | FY-1 | CAGR (3y) |
|---------------------|------|------|------|------|------|-----------|
| [Segment A] | | | | | | |
| [Segment B] | | | | | | |
| [Total Revenue] | | | | | | |

---

## 3. Financial Snapshot (Historical + TTM + Estimates)

- **Valuation Context:**
  - **Current Valuation:** [P/E or P/Sales] is [X]x (vs. 5yr Avg: [Y]x) — *[Premium/Discount Analysis]*
  - **Efficiency:** [ROIC or Gross Margin Trend analysis]
- **Liquidity & Quality:**
  - **Cash Position:** $[X]M Cash vs $[Y]M Debt.
  - **Quality of Earnings:** Is growth driven by volume (good) or just price (risk)?

| Metric (USD M) | FY-5 | FY-4 | FY-3 | FY-2 | FY-1 | TTM (LTM) | FY+1 (Est) | FY+2 (Est) |
|----------------|------|------|------|------|------|-----------|------------|------------|
| Revenue | | | | | | | | |
| Growth % | | | | | | | | |
| Gross Margin % | | | | | | | | |
| EBITDA | | | | | | | | |
| Free Cash Flow | | | | | | | | |

---

## 4. Strategic Quality & Moat (Counterpoint Analysis)

### A. Return on Invested Capital (ROIC)
- **Trend:** Is ROIC rising, falling, or stable? Why?
- **Sustainability:** Is the ROIC supported by structural advantages (patents, scale) or temporary factors?

### B. Competitive Advantage (The Moat)
- **Pricing Power:** Evidence of price hikes above inflation without churn?
- **Barriers to Entry:**
  - *Scale:* Does Minimum Efficient Scale (MES) prevent new entrants?
  - *Switching Costs:* Is there high customer lock-in? (Retention rates).
- **Disruption Risk:** Vertical integration risks or horizontal shifts?

### C. Industry Structure
- **Consolidation:** Is the industry consolidating (good for profits) or fragmenting?
- **Rationality:** Do competitors act rationally regarding pricing and capacity?
- **Government Role:** Tariff exposure, antitrust risks, or subsidy reliance.

### D. Competitors
- **Competition:** List the major competitors and their market share
- **Share Gains:** How has market share evolved over the past 3 years?
- **Projected share:** How is market share expected to evolve in the next 3 years?

---

## 5. Management & Governance Analysis ("Say/Do" Audit)

### Recent Focus (Last 4 Quarters)
*[Agent Instruction: Analyze the last 4 earnings calls. What changed quarter-to-quarter?]*

- **Q1 [Year]:** Key Theme: [e.g., "Supply Chain Constraints"]
- **Q2 [Year]:** Key Theme: [e.g., "Pricing Actions taken"]
- **Q3 [Year]:** Key Theme: [e.g., "Demand Softening"]
- **Q4 [Year]:** Key Theme: [e.g., "Cost Cutting / Efficiency"]

### Guidance vs. Reality
- **The Audit:** [Compare a specific promise from 3 years ago to today's actual result.]
- **"Beat & Raise" Ratio:** Frequency of beating their own guidance in the last 12 quarters.

### Capital Allocation Priorities
- **Cash Use (Last 5 Years):** Capex [X]% | M&A [X]% | Buybacks/Divs [X]%
- **M&A Track Record:** Did past acquisitions improve or degrade ROIC?

---

## 6. Valuation Deep Dive

### Historical Multiples Analysis
- **Primary Band:** Current [X]x vs. 10-Year Range ([Low]x - [High]x).
- **Context:** Is the multiple low because earnings are cyclically peaking (Value Trap risk)?

### Reverse DCF (Expectations Investing)
- **Implied Growth:** What revenue growth/margin is the market pricing in at the current price?
- **Feasibility:** Is this implied hurdle low or high relative to history?

### Relative Valuation
- **Historical Valuations:** What is the historical average and median P/E ratio for the competitive set?
- **Current Valuations:** Show a table of this company and its 4 closest competitors

---

## 7. Technical Analysis & Timing (The "When")

### Trend & Momentum
- **Primary Trend:** [Bullish / Bearish] (Price vs. 200-Day SMA).
- **RSI (14):** [Value] ([Overbought/Neutral/Oversold]).

### Key Levels
- **Resistance (Target):** $[Price] (Recent Highs).
- **Support (Stop Loss):** $[Price] (Recent Lows / 50-Day SMA).

---

## 8. Risks & "Pre-Mortem"

- **The "Kill" Criteria:** If this investment fails, what is the single most likely reason?
- **Bear Case Scenario:** Modeled downside price ($[Price]) in a recession/execution failure.
- **"Colonel Blotto" Risk:** Is the company fighting too many battles on too many fronts?

---

## 9. Appendices

- **Glossary of Acronyms**
- **Sources:** (Links to specific sources used).
`

const ONE_PAGER_TEMPLATE = `# **Investment Snapshot: [Company Name] (Ticker)**

Analyst: Stratos Brain AI | Date: [Date] | Rec: [Long/Short] | Conviction: [High/Med/Low]

Price: $[X] | Target: $[X] | Upside: [X]% | Trend: [Bullish/Bearish]

---

### **1. THE EXECUTIVE THESIS**

* **The Hook:** [2 sentences. What is the core specific opportunity?]
* **Why Now? (Key Catalysts):**
  * [Catalyst 1: e.g., Upcoming Product Launch in Q3]
  * [Catalyst 2: e.g., Competitor regulatory stumbling block]
  * [Catalyst 3: e.g., Recent 15% pullback on non-fundamental news]
* **The Gap (Consensus vs. Reality):**
  * **Market Thinks:** [Summary of consensus fear/apathy]
  * **We Believe:** [Our contrarian view]

### **2. WHAT YOU NEED TO BELIEVE (The "Bull Case" Logic)**

*[Agent Instruction: List the 3 critical assumptions required for this stock to double. If these aren't true, the thesis breaks.]*

1. **[Assumption 1]:** (e.g., "Gross Margins must expand from 30% to 40% via automation.")
2. **[Assumption 2]:** (e.g., "Revenue growth accelerates to >15% in FY+1.")
3. **[Assumption 3]:** (e.g., "Management hits their $1B FCF target by 2025.")

---

### **3. FINANCIAL TRAJECTORY (LTM + 2-Year Forecast)**

*[Agent Instruction: Focus on the trend. Is growth accelerating or decelerating?]*

| Metric | LTM (Actual) | FY+1 (Est) | FY+2 (Est) | Trajectory |
| :---- | :---- | :---- | :---- | :---- |
| **Revenue ($B)** | $[X] | $[X] | $[X] | [Accel/Decel] |
| **YoY Growth** | [X]% | [X]% | [X]% |  |
| **EBITDA Margin** | [X]% | [X]% | [X]% | [Expanding/Contracting] |
| **EPS** | $[X] | $[X] | $[X] |  |
| **Free Cash Flow** | $[X] | $[X] | $[X] |  |

* **Valuation Reality:** Trading at **[X]x [P/E or Sales]** (vs. 5Y Avg: **[Y]x**).
* **Balance Sheet Check:** Cash: $[X]B | Debt: $[X]B | **Runway/Stability:** [Secure/Concern].

---

### **4. KEY RISKS (The "Pre-Mortem")**

* **The "Kill" Criteria:** [What single specific event destroys this thesis? e.g., "FDA Rejection"]
* **Bear Case Target:** $[Price] (Implies -[X]% downside).
* **Management "Say/Do" Check:** [Pass/Fail] – *[Briefly: Do they have a history of missing guidance?]*
`

const SYSTEM_PROMPT = `# ROLE & OBJECTIVE
You are the **Lead Equity Research Agent** for Stratos Brain. Your goal is to generate institutional-grade investment documents that are 100% compliant with a specific **Template**.

To do this, you must synthesize two distinct sources of truth:
1.  **Internal Database (Provided):** Hard financials, technical indicators, and proprietary AI scores.
2.  **External Reality (You must research this):** Real-time news, management sentiment, and macro risks which are NOT in the database.

# THE WORKFLOW (Strictly Follow This Sequence)

## PHASE 1: GAP ANALYSIS & RESEARCH
Before generating the document, you must analyze the provided DATABASE_DATA against the TEMPLATE.
* **Identify what is missing.** The database has numbers (PE, RSI, Revenue), but it likely lacks *qualitative* context (e.g., "Why did the CEO resign?", "What are the specific details of the new product launch?", "What is the tone of the latest earnings call?").
* **EXECUTE RESEARCH:** You **MUST utilize Google Search** to find high-quality, up-to-date sources to fill these specific gaps.
    * *Target:* Recent earnings transcripts, reputable financial news (Bloomberg, Reuters, CNBC), and competitor announcements.
    * *Focus:* Look for "Management Confidence," "Geopolitical Risks," and "Catalysts" that explain the numbers in the database.

## PHASE 2: SYNTHESIS & GENERATION
Once you have gathered the missing qualitative data, generate the full document.
* **Structure:** Follow the TEMPLATE structure **exactly**. Do not add or remove sections.
* **Data Integrity:**
    * If a metric exists in the DATABASE_DATA (e.g., pe_ratio, rsi_14, ai_score), you MUST use that exact number. **Do not hallucinate numbers.**
    * If the database says review_status: "missing", rely heavily on your own interpretation of the ohlcv and features data for the technical section.
* **Citations:** When you state a fact from your Phase 1 research (e.g., "The CEO announced a buyback..."), you must cite the source found via Google Search.

# STYLE GUIDELINES
* **Tone:** Professional, objective, institutional (Goldman Sachs/Morgan Stanley style).
* **Formatting:** Use clean Markdown. Use tables where the template requests them.
* **Opinion:** Be decisive. If the data suggests a "Bullish" trend, say so clearly, backed by the database evidence.
`

// ==================== HELPER FUNCTIONS ====================

interface AssetData {
  asset: Record<string, unknown>
  as_of_date: string
  ohlcv: Array<Record<string, unknown>>
  features: Record<string, unknown>
  scores: Record<string, unknown>
  signals: Array<Record<string, unknown>>
  review: Record<string, unknown> | null
  review_status: string
}

function formatDatabaseContext(data: AssetData): string {
  const asset = data.asset || {}
  const review = data.review || {}
  const features = data.features || {}
  const ohlcv = data.ohlcv || []
  
  // Get recent OHLCV (last 30 days)
  const recentOhlcv = ohlcv.slice(-30)
  
  const context = {
    // Core info
    symbol: asset.symbol,
    company_name: asset.name,
    sector: asset.sector || asset.category,
    industry: asset.industry || asset.category,
    description: asset.short_description,
    
    // Valuation
    market_cap: asset.market_cap,
    pe_ratio: asset.pe_ratio,
    forward_pe: asset.forward_pe,
    price_to_sales_ttm: asset.price_to_sales_ttm,
    ev_to_ebitda: asset.ev_to_ebitda,
    price_to_book: asset.price_to_book,
    peg_ratio: asset.peg_ratio,
    
    // Growth & Profitability
    revenue_ttm: asset.revenue_ttm,
    revenue_growth_yoy: asset.revenue_growth_yoy,
    profit_margin: asset.profit_margin,
    operating_margin: asset.operating_margin,
    roe: asset.roe,
    roa: asset.roa,
    eps: asset.eps,
    earnings_growth_yoy: asset.earnings_growth_yoy,
    
    // Price context
    week_52_high: asset.week_52_high,
    week_52_low: asset.week_52_low,
    analyst_target_price: asset.analyst_target_price,
    beta: asset.beta,
    
    // AI Review data
    review_status: data.review_status,
    ai_direction_score: review.ai_direction_score,
    ai_setup_quality_score: review.ai_setup_quality_score,
    attention_level: review.attention_level,
    setup_type: review.setup_type,
    confidence: review.confidence,
    ai_summary: review.summary_text || review.ai_summary_text,
    entry: review.entry || review.ai_entry,
    targets: review.targets || review.ai_targets,
    invalidation: review.invalidation,
    support_levels: review.ai_key_levels?.support,
    resistance_levels: review.ai_key_levels?.resistance,
    risks: review.risks || review.ai_risks,
    why_now: review.why_now || review.ai_why_now,
    what_to_watch_next: review.what_to_watch_next,
    
    // Technical features (key ones)
    features: {
      rsi_14: features.rsi_14,
      sma_20: features.sma_20,
      sma_50: features.sma_50,
      sma_200: features.sma_200,
      macd_histogram: features.macd_histogram,
      atr_pct: features.atr_pct,
      trend_regime: features.trend_regime,
      return_1d: features.return_1d,
      return_5d: features.return_5d,
      return_21d: features.return_21d,
      return_63d: features.return_63d,
      return_252d: features.return_252d,
    },
    
    // Recent price action
    recent_ohlcv: recentOhlcv,
    as_of_date: data.as_of_date,
  }
  
  return JSON.stringify(context, null, 2)
}

async function callGeminiWithSearch(
  prompt: string,
  apiKey: string
): Promise<{ text: string; sources: Array<{ title: string; uri: string }> }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`
  
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    tools: [
      {
        googleSearch: {}
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384,
    }
  }
  
  console.log('Calling Gemini API with Google Search grounding...')
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', errorText)
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }
  
  const result = await response.json()
  
  // Extract text from response
  let text = ''
  const sources: Array<{ title: string; uri: string }> = []
  
  if (result.candidates && result.candidates.length > 0) {
    const candidate = result.candidates[0]
    
    // Extract text
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          text += part.text
        }
      }
    }
    
    // Extract grounding sources
    if (candidate.groundingMetadata?.groundingChunks) {
      for (const chunk of candidate.groundingMetadata.groundingChunks) {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || 'Source',
            uri: chunk.web.uri || ''
          })
        }
      }
    }
  }
  
  return { text, sources }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyAHg70im-BbB9HYZm7TOzr3cKRQp7RWY1Q'
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const url = new URL(req.url)
    const path = url.pathname.replace('/generate-document', '')
    
    // POST / - Generate a document
    if (req.method === 'POST' && (path === '' || path === '/')) {
      const body = await req.json()
      const { symbol, asset_id, asset_type, document_type } = body
      
      if (!symbol) {
        return new Response(JSON.stringify({ error: 'Symbol is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Validate document type
      const validTypes = ['one_pager', 'memo']
      const docType = validTypes.includes(document_type) ? document_type : 'one_pager'
      
      console.log(`Generating ${docType} for ${symbol} (asset_type: ${asset_type || 'not specified'})...`)
      
      // Step 1: Fetch asset data from control-api
      // Include asset_type if provided to disambiguate symbols like COMP (Compass equity vs Compound crypto)
      let assetDataUrl = `${supabaseUrl}/functions/v1/control-api/dashboard/asset?symbol=${symbol}`
      if (asset_type) {
        assetDataUrl += `&asset_type=${asset_type}`
      }
      console.log(`Fetching asset data from: ${assetDataUrl}`)
      
      const assetResponse = await fetch(assetDataUrl)
      if (!assetResponse.ok) {
        const errorText = await assetResponse.text()
        return new Response(JSON.stringify({ error: 'Failed to fetch asset data', details: errorText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const assetData: AssetData = await assetResponse.json()
      const companyName = assetData.asset?.name || symbol
      const todayDate = new Date().toISOString().split('T')[0]
      
      // Step 2: Prepare the prompt
      const databaseContext = formatDatabaseContext(assetData)
      const template = docType === 'memo' ? MEMO_TEMPLATE : ONE_PAGER_TEMPLATE
      
      const prompt = `
# TASK: Generate Investment ${docType === 'memo' ? 'Memo' : 'One Pager'} for ${symbol}

## INPUT DATA

### Asset: ${symbol} (${companyName})
### Date: ${todayDate}

### DATABASE DATA (Use these exact numbers where applicable):
\`\`\`json
${databaseContext}
\`\`\`

### TEMPLATE (Follow this structure exactly):
\`\`\`markdown
${template}
\`\`\`

## INSTRUCTIONS

1. **First**, analyze the DATABASE DATA above. Note what quantitative data is available.

2. **Second**, use Google Search to research the following for ${symbol}:
   - Latest news and developments (last 2-4 weeks)
   - Recent earnings call highlights or guidance
   - Management commentary and strategic updates
   - Competitive landscape changes
   - Analyst ratings and price target changes
   - Any regulatory or macro risks

3. **Third**, generate the complete ${docType === 'memo' ? 'memo' : 'one pager'} following the TEMPLATE structure exactly:
   - Fill in all database-driven sections with the exact numbers from DATABASE DATA
   - Fill in all research-driven sections with findings from your Google Search
   - Cite all external sources with links
   - Be decisive in your investment stance based on the combined evidence

4. **Output**: Return ONLY the completed document in clean Markdown format.
`
      
      // Step 3: Call Gemini with Google Search
      console.log('Calling Gemini API...')
      const startTime = Date.now()
      
      const { text: documentContent, sources } = await callGeminiWithSearch(prompt, geminiApiKey)
      
      const generationTime = (Date.now() - startTime) / 1000
      console.log(`Document generated in ${generationTime}s with ${sources.length} sources`)
      
      if (!documentContent || documentContent.trim() === '') {
        return new Response(JSON.stringify({ error: 'Gemini returned empty response' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Step 4: Save to Supabase Storage
      const fileName = docType === 'one_pager'
        ? `${symbol}_One_Pager_${todayDate}.md`
        : `${symbol}_Investment_Memo_${todayDate}.md`
      
      const storagePath = `${docType}s/${asset_id || symbol}/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('asset-files')
        .upload(storagePath, documentContent, {
          contentType: 'text/markdown',
          upsert: true
        })
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        return new Response(JSON.stringify({ error: 'Failed to upload to storage', details: uploadError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('asset-files')
        .getPublicUrl(storagePath)
      
      console.log(`File uploaded to: ${urlData.publicUrl}`)
      
      // Step 5: Save record to asset_files table
      if (asset_id) {
        // Delete any existing placeholder entries
        await supabase
          .from('asset_files')
          .delete()
          .eq('asset_id', asset_id)
          .eq('file_type', docType)
          .like('description', '%Generating%')
        
        // Insert new record
        const { error: insertError } = await supabase
          .from('asset_files')
          .insert({
            asset_id,
            file_name: fileName,
            file_path: urlData.publicUrl,
            file_type: docType,
            file_size: documentContent.length,
            description: `Generated by Gemini AI (${sources.length} sources cited)`
          })
        
        if (insertError) {
          console.error('Database insert error:', insertError)
          // Don't fail the request, file is already uploaded
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        document_type: docType,
        file_name: fileName,
        file_url: urlData.publicUrl,
        storage_path: storagePath,
        generation_time_seconds: generationTime,
        sources_cited: sources.length,
        content_length: documentContent.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // GET /status - Health check
    if (req.method === 'GET' && path === '/status') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'generate-document',
        model: 'gemini-3-pro-preview',
        features: ['google_search_grounding', 'memo', 'one_pager']
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

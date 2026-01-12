// Macro Context Tool Implementation
// Add this to company-chat-api/index.ts in the unifiedFunctionDeclarations array

// 1. Tool Definition
{
  name: "get_macro_context",
  description: "Fetches the current 'State of the Market' including Risk Regime, Interest Rates, Inflation, Commodity trends, and Sector Rotation. MANDATORY USE: Call this tool FIRST if the user asks about 'buying', 'market conditions', 'risks', 'outlook', or any investment recommendation. You cannot recommend a stock without knowing if the market environment is supportive or hostile.",
  parameters: {
    type: "object",
    properties: {
      focus_sector: { 
        type: "string", 
        description: "Optional: The sector of the stock being discussed (e.g., 'Technology', 'Consumer Discretionary') to check for specific sector headwinds or tailwinds." 
      },
      days_back: {
        type: "number",
        description: "Optional: Number of days of historical macro data to retrieve (default 1 for latest, max 30 for trend analysis)"
      }
    }
  }
}

// 2. Tool Execution Function
async function executeMacroContext(
  supabase: any,
  focus_sector?: string,
  days_back: number = 1
): Promise<unknown> {
  try {
    console.log(`Fetching macro context (days_back: ${days_back}, focus_sector: ${focus_sector || 'all'})`)
    
    // Fetch latest macro data
    const { data: macroData, error } = await supabase
      .from('daily_macro_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(days_back)
    
    if (error) {
      console.error('Error fetching macro context:', error)
      return {
        error: 'Failed to fetch macro context',
        message: error.message
      }
    }
    
    if (!macroData || macroData.length === 0) {
      return {
        error: 'No macro data available',
        message: 'Macro data has not been ingested yet. Please run the ingest_macro_fmp.py script.'
      }
    }
    
    const latest = macroData[0]
    
    // Parse sector rotation data
    let sectorData = {}
    try {
      sectorData = typeof latest.sector_rotation === 'string' 
        ? JSON.parse(latest.sector_rotation) 
        : latest.sector_rotation || {}
    } catch (e) {
      console.error('Error parsing sector_rotation:', e)
    }
    
    // Build the response
    const response: any = {
      date: latest.date,
      timestamp: latest.created_at,
      
      // Market Regime
      market_regime: latest.market_regime,
      risk_premium: latest.risk_premium,
      
      // Rates & Credit
      rates: {
        us_10y_yield: latest.us10y_yield,
        us_2y_yield: latest.us2y_yield,
        yield_curve_spread: latest.yield_curve_10y_2y,
        yield_curve_status: latest.yield_curve_10y_2y < 0 ? 'INVERTED (Recession Warning)' : 'Normal'
      },
      credit: {
        junk_bond_price: latest.hyg_close,
        credit_appetite: latest.hyg_close > 80 ? 'Healthy' : 'Stressed'
      },
      
      // Commodities
      commodities: {
        oil_price: latest.oil_close,
        oil_status: latest.oil_close > 85 ? 'High (Inflation Risk)' : latest.oil_close < 70 ? 'Low (Deflationary)' : 'Normal',
        gold_price: latest.gold_close,
        gold_status: latest.gold_close > 2000 ? 'Flight to Safety' : 'Normal',
        copper_price: latest.copper_close,
        copper_status: latest.copper_close > 4 ? 'Strong Economy' : 'Weak Economy'
      },
      
      // Inflation
      inflation: {
        cpi_yoy: latest.cpi_yoy,
        status: latest.cpi_yoy > 3 ? 'Hot (Fed Concern)' : latest.cpi_yoy < 2 ? 'Cool' : 'Target Range'
      },
      
      // Market Breadth
      market_breadth: {
        spy_price: latest.spy_close,
        spy_change_pct: latest.spy_change_pct,
        iwm_price: latest.iwm_close,
        iwm_change_pct: latest.iwm_change_pct,
        breadth_rating: latest.breadth_rating,
        interpretation: latest.breadth_rating === 'Divergent' 
          ? 'WARNING: Large caps rising but small caps falling - fragile rally'
          : latest.breadth_rating === 'Strong'
          ? 'Healthy broad-based rally'
          : 'Mixed signals'
      },
      
      // Sector Rotation
      sector_rotation: sectorData,
      leading_sectors: Object.entries(sectorData)
        .sort(([,a]: any, [,b]: any) => b - a)
        .slice(0, 3)
        .map(([sector, change]) => ({ sector, change_pct: change })),
      lagging_sectors: Object.entries(sectorData)
        .sort(([,a]: any, [,b]: any) => a - b)
        .slice(0, 3)
        .map(([sector, change]) => ({ sector, change_pct: change }))
    }
    
    // Add focus sector analysis if requested
    if (focus_sector && sectorData[focus_sector] !== undefined) {
      response.focus_sector_analysis = {
        sector: focus_sector,
        performance_today: sectorData[focus_sector],
        relative_rank: Object.values(sectorData).filter((v: any) => v > sectorData[focus_sector]).length + 1,
        total_sectors: Object.keys(sectorData).length
      }
    }
    
    // Add historical trend if days_back > 1
    if (days_back > 1 && macroData.length > 1) {
      response.trend_analysis = {
        regime_changes: macroData.map(d => ({ date: d.date, regime: d.market_regime })),
        yield_curve_trend: macroData.map(d => ({ date: d.date, spread: d.yield_curve_10y_2y })),
        spy_trend: macroData.map(d => ({ date: d.date, change_pct: d.spy_change_pct }))
      }
    }
    
    return response
    
  } catch (error) {
    console.error('Error in executeMacroContext:', error)
    return {
      error: 'Internal error fetching macro context',
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// 3. Add to the function execution switch statement
// In the callGeminiWithTools function, add this case:

case 'get_macro_context':
  const macroFocusSector = functionCall.args.focus_sector
  const macroDaysBack = functionCall.args.days_back || 1
  functionResult = await executeMacroContext(supabase, macroFocusSector, macroDaysBack)
  break

// 4. System Prompt Enhancement
// Add this to the buildSystemPrompt function:

const MACRO_AWARENESS_MODULE = `
## MACRO-AWARENESS PROTOCOL

You are a sophisticated institutional-grade strategist, not just a stock picker. You must contextualize every stock recommendation within the broader economic environment.

**MANDATORY WORKFLOW:**
1. When a user asks about buying a stock, market conditions, risks, or outlook, you MUST call \`get_macro_context\` FIRST before making any recommendation.
2. Never recommend a stock without understanding the current market regime.

**MARKET PHYSICS RULES (Apply these correlations):**

1. **The Cost of Capital Rule:**
   - If 10-Year Treasury Yields are elevated (>4.5%), apply strict scrutiny to High-P/E Growth stocks (Tech, SaaS, Biotech).
   - High rates compress valuation multiples. A stock with P/E of 40 becomes less attractive when risk-free rates rise.
   - Favor Value stocks, Financials, and dividend-paying stocks in high-rate environments.

2. **The Consumer Pressure Rule:**
   - If Oil is surging (>$85/barrel) AND CPI Inflation is hot (>3%), be cautious on Consumer Discretionary stocks.
   - High energy costs + inflation = squeezed disposable income = headwind for retail, travel, restaurants.
   - Exception: Luxury goods are often insulated from this pressure.

3. **The Fear Rule:**
   - If Market Regime is "Risk-Off", demand a higher Margin of Safety for any buy recommendation.
   - In Risk-Off environments, even good companies can decline 20-30% due to forced selling.
   - Suggest waiting for regime shift or only recommend defensive sectors (Utilities, Healthcare, Consumer Staples).

4. **The Breadth Rule:**
   - If S&P 500 is rising but Small Caps (IWM) and Copper are declining, the rally is "hollow" and fragile.
   - This divergence often precedes market corrections. Flag this risk explicitly.
   - Strong breadth (both SPY and IWM rising) confirms a healthy bull market.

5. **The Yield Curve Rule:**
   - If the Yield Curve is inverted (10Y < 2Y), a recession typically follows within 12-18 months.
   - In this environment, prioritize quality over growth, and consider reducing equity exposure.

6. **The Sector Rotation Rule:**
   - Leading sectors indicate market sentiment:
     * Technology/Communication leading = Risk-On, Growth preference
     * Energy/Financials leading = Inflation concerns, Value rotation
     * Utilities/Healthcare leading = Defensive positioning, Fear
   - If the stock you're analyzing is in a lagging sector, acknowledge this headwind.

**EXAMPLE ANALYSIS STRUCTURE:**

User: "Should I buy NVDA?"

Your Response:
1. Call \`get_macro_context\` with focus_sector="Technology"
2. Analyze the macro environment:
   - "The current market regime is Risk-Off with 10Y yields at 4.7% (elevated)."
   - "Technology sector is down -1.2% today, ranking 9th out of 11 sectors."
   - "Market breadth is Divergent - SPY up but IWM down, indicating a fragile rally."
3. Provide contextualized recommendation:
   - "While NVDA's fundamentals remain strong, the macro environment is challenging for high-P/E tech stocks. The elevated cost of capital (4.7% 10Y) compresses valuation multiples. I would wait for either: (a) a shift to Risk-On regime, or (b) a 10-15% pullback to improve the risk/reward."

This approach transforms you from a reactive data retriever into a proactive strategist who sees the full chessboard.
`

// Add this module to your system prompt construction

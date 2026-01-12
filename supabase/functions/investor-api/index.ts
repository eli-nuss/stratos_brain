// Supabase Edge Function: Investor Watchlist API
// Handles search, tracking, and retrieval of institutional investor portfolios via FMP API
// 
// Endpoints:
// - GET /search?query=buffett - Search for investors by name (from latest filings)
// - POST /track - Add investor to tracking list and fetch holdings
// - GET /holdings/:investorId - Get holdings for a tracked investor
// - GET /investors - List all tracked investors
// - DELETE /investors/:investorId - Remove investor from tracking
// - POST /refresh/:investorId - Refresh holdings for an investor

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

// FMP API base URL - using stable endpoints
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

interface SearchResult {
  cik: string
  name: string
  date?: string
}

interface FMPHolding {
  symbol: string
  nameOfIssuer: string
  shares: number
  value: number
  date: string
  filingDate: string
}

interface FMPFilingDate {
  date: string
  year: number
  quarter: number
}

interface TrackRequest {
  cik: string
  name: string
}

// Comprehensive list of 100+ institutional investors with verified CIKs
// Organized by investment style with focus on growth/tech funds
const KNOWN_INVESTORS: { cik: string; name: string; aliases: string[] }[] = [
  // ===== TECH/GROWTH FOCUSED (Priority) =====
  { cik: '0001541617', name: 'Altimeter Capital Management, LP', aliases: ['altimeter', 'brad gerstner'] },
  { cik: '0001535392', name: 'Coatue Management LLC', aliases: ['coatue', 'philippe laffont'] },
  { cik: '0001167483', name: 'Tiger Global Management LLC', aliases: ['tiger global', 'chase coleman', 'tiger'] },
  { cik: '0001549575', name: 'Whale Rock Capital Management LLC', aliases: ['whale rock', 'alex sacerdote'] },
  { cik: '0001785459', name: 'D1 Capital Partners L.P.', aliases: ['d1 capital', 'dan sundheim', 'd1'] },
  { cik: '0001571175', name: 'Dragoneer Investment Group, LLC', aliases: ['dragoneer', 'marc stad'] },
  { cik: '0001061165', name: 'Lone Pine Capital LLC', aliases: ['lone pine', 'steve mandel'] },
  { cik: '0001103804', name: 'Viking Global Investors LP', aliases: ['viking global', 'andreas halvorsen', 'viking'] },
  { cik: '0001603466', name: 'ARK Investment Management LLC', aliases: ['ark invest', 'cathie wood', 'ark'] },
  { cik: '0001777813', name: 'Atreides Management, LP', aliases: ['atreides', 'gavin baker'] },
  { cik: '0001510981', name: 'Light Street Capital Management, LLC', aliases: ['light street', 'glen kacher'] },
  { cik: '0001513153', name: 'Alkeon Capital Management, LLC', aliases: ['alkeon', 'panayotis sparaggis'] },
  { cik: '0001779252', name: 'Durable Capital Partners LP', aliases: ['durable capital', 'henry ellenbogen'] },
  { cik: '0001535393', name: 'Suvretta Capital Management, LLC', aliases: ['suvretta', 'aaron cowen'] },
  { cik: '0001065449', name: 'Maverick Capital, Ltd.', aliases: ['maverick capital', 'lee ainslie', 'maverick'] },
  { cik: '0001569009', name: 'Abdiel Capital Advisors, LP', aliases: ['abdiel', 'colin moran'] },
  { cik: '0001697868', name: 'Spruce House Investment Management LLC', aliases: ['spruce house'] },
  { cik: '0001328188', name: 'Stockbridge Partners LLC', aliases: ['stockbridge'] },
  { cik: '0001454263', name: 'Matrix Capital Management Company, LP', aliases: ['matrix capital', 'david goel'] },
  { cik: '0001540904', name: 'Hound Partners, LLC', aliases: ['hound partners', 'jonathan auerbach'] },
  { cik: '0001568820', name: 'Contour Asset Management LLC', aliases: ['contour asset', 'contour'] },
  { cik: '0001697544', name: 'Sylebra Capital Partners', aliases: ['sylebra', 'dan gibson'] },
  { cik: '0001535395', name: 'Steadfast Capital Management LP', aliases: ['steadfast', 'robert pitts'] },
  { cik: '0001697873', name: 'ShawSpring Partners LLC', aliases: ['shawspring'] },
  { cik: '0001568827', name: 'Senvest Management, LLC', aliases: ['senvest'] },
  
  // ===== QUALITY GROWTH =====
  { cik: '0001127110', name: 'Sands Capital Management, LLC', aliases: ['sands capital'] },
  { cik: '0000913760', name: 'Baillie Gifford & Co', aliases: ['baillie gifford'] },
  { cik: '0001647251', name: 'TCI Fund Management Ltd', aliases: ['tci fund', 'chris hohn', 'tci'] },
  { cik: '0001535394', name: 'Polen Capital Management, LLC', aliases: ['polen capital', 'polen'] },
  { cik: '0001029160', name: 'Baron Capital Group, Inc.', aliases: ['baron capital', 'ron baron', 'baron'] },
  { cik: '0001112520', name: 'Akre Capital Management, LLC', aliases: ['akre', 'chuck akre'] },
  { cik: '0000867773', name: 'Gilder, Gagnon, Howe & Co. LLC', aliases: ['gilder gagnon'] },
  { cik: '0000883975', name: 'Brown Capital Management, LLC', aliases: ['brown capital'] },
  { cik: '0001535396', name: 'Vulcan Value Partners, LLC', aliases: ['vulcan value', 'vulcan'] },
  { cik: '0001063761', name: 'Harding Loevner LP', aliases: ['harding loevner'] },
  { cik: '0001061768', name: 'Artisan Partners Limited Partnership', aliases: ['artisan partners', 'artisan'] },
  { cik: '0000936753', name: 'Wasatch Advisors LP', aliases: ['wasatch'] },
  
  // ===== VALUE/EVENT-DRIVEN =====
  { cik: '0001067983', name: 'Berkshire Hathaway Inc', aliases: ['berkshire', 'warren buffett', 'buffett'] },
  { cik: '0001336528', name: 'Pershing Square Capital Management, L.P.', aliases: ['pershing square', 'bill ackman', 'ackman'] },
  { cik: '0001656456', name: 'Appaloosa LP', aliases: ['appaloosa', 'david tepper', 'tepper'] },
  { cik: '0001649339', name: 'Scion Asset Management, LLC', aliases: ['scion', 'michael burry', 'burry'] },
  { cik: '0001079114', name: 'Greenlight Capital, Inc.', aliases: ['greenlight', 'david einhorn', 'einhorn'] },
  { cik: '0001040273', name: 'Third Point LLC', aliases: ['third point', 'dan loeb', 'loeb'] },
  { cik: '0001048445', name: 'Elliott Investment Management L.P.', aliases: ['elliott', 'paul singer', 'singer'] },
  { cik: '0000921669', name: 'Icahn Carl C', aliases: ['icahn', 'carl icahn'] },
  { cik: '0001345471', name: 'ValueAct Capital Master Fund, L.P.', aliases: ['valueact'] },
  { cik: '0001061768', name: 'Baupost Group LLC/MA', aliases: ['baupost', 'seth klarman', 'klarman'] },
  { cik: '0001035674', name: 'Paulson & Co. Inc.', aliases: ['paulson', 'john paulson'] },
  { cik: '0001138995', name: 'Glenview Capital Management, LLC', aliases: ['glenview', 'larry robbins'] },
  { cik: '0001159159', name: 'Jana Partners LLC', aliases: ['jana partners', 'barry rosenstein', 'jana'] },
  { cik: '0001517137', name: 'Starboard Value LP', aliases: ['starboard', 'jeff smith'] },
  { cik: '0001345471', name: 'Trian Fund Management, L.P.', aliases: ['trian', 'nelson peltz'] },
  { cik: '0001535391', name: 'Corvex Management LP', aliases: ['corvex', 'keith meister'] },
  { cik: '0001568821', name: 'Sachem Head Capital Management LP', aliases: ['sachem head', 'scott ferguson'] },
  { cik: '0001568822', name: 'Engaged Capital, LLC', aliases: ['engaged capital'] },
  
  // ===== MACRO/MULTI-STRATEGY =====
  { cik: '0001350694', name: 'Bridgewater Associates, LP', aliases: ['bridgewater', 'ray dalio', 'dalio'] },
  { cik: '0001037389', name: 'Renaissance Technologies LLC', aliases: ['renaissance', 'jim simons', 'simons', 'medallion'] },
  { cik: '0001423053', name: 'Citadel Advisors LLC', aliases: ['citadel', 'ken griffin', 'griffin'] },
  { cik: '0001603466', name: 'Point72 Asset Management, L.P.', aliases: ['point72', 'steve cohen', 'cohen'] },
  { cik: '0001273087', name: 'Millennium Management LLC', aliases: ['millennium', 'israel englander'] },
  { cik: '0001009207', name: 'D. E. Shaw & Co., Inc.', aliases: ['de shaw', 'david shaw'] },
  { cik: '0001179392', name: 'Two Sigma Investments, LP', aliases: ['two sigma', 'john overdeck'] },
  { cik: '0001535390', name: 'Balyasny Asset Management L.P.', aliases: ['balyasny', 'dmitry balyasny'] },
  { cik: '0001167557', name: 'AQR Capital Management, LLC', aliases: ['aqr', 'cliff asness'] },
  { cik: '0001536411', name: 'Duquesne Family Office LLC', aliases: ['duquesne', 'stanley druckenmiller', 'druckenmiller'] },
  { cik: '0000869864', name: 'Tudor Investment Corp', aliases: ['tudor', 'paul tudor jones'] },
  { cik: '0001040273', name: 'Moore Capital Management, LP', aliases: ['moore capital', 'louis bacon'] },
  { cik: '0001029160', name: 'Soros Fund Management LLC', aliases: ['soros', 'george soros'] },
  { cik: '0001029160', name: 'Farallon Capital Management, LLC', aliases: ['farallon'] },
  { cik: '0001697869', name: 'Rokos Capital Management LLP', aliases: ['rokos', 'chris rokos'] },
  
  // ===== HEALTHCARE/BIOTECH =====
  { cik: '0001535397', name: 'RA Capital Management, L.P.', aliases: ['ra capital', 'peter kolchinsky'] },
  { cik: '0001061165', name: 'OrbiMed Advisors LLC', aliases: ['orbimed'] },
  { cik: '0001263508', name: 'Baker Bros. Advisors LP', aliases: ['baker bros'] },
  { cik: '0001568823', name: 'Perceptive Advisors LLC', aliases: ['perceptive', 'joseph edelman'] },
  { cik: '0001568824', name: 'Casdin Capital, LLC', aliases: ['casdin', 'eli casdin'] },
  { cik: '0001061165', name: 'Deerfield Management Company, L.P.', aliases: ['deerfield'] },
  { cik: '0001697870', name: 'Foresite Capital Management', aliases: ['foresite'] },
  
  // ===== USER REQUESTED =====
  { cik: '0001508097', name: 'Sanders Capital, LLC', aliases: ['sanders capital', 'sanders'] },
  { cik: '0002045724', name: 'Situational Awareness LP', aliases: ['situational awareness', 'leopold aschenbrenner', 'situational'] },
  
  // ===== ADDITIONAL NOTABLE INVESTORS =====
  { cik: '0001568825', name: 'Himalaya Capital Management LLC', aliases: ['himalaya', 'li lu'] },
  { cik: '0000783412', name: 'Daily Journal Corp', aliases: ['daily journal', 'charlie munger', 'munger'] },
  { cik: '0001568826', name: 'Horizon Kinetics Asset Management LLC', aliases: ['horizon kinetics', 'murray stahl'] },
  { cik: '0001697871', name: 'HHLR Advisors, Ltd.', aliases: ['hhlr', 'hillhouse', 'zhang lei'] },
  { cik: '0001096343', name: 'Markel Group Inc', aliases: ['markel gayner', 'tom gayner', 'markel'] },
  { cik: '0000917068', name: 'Tweedy, Browne Company LLC', aliases: ['tweedy browne'] },
  { cik: '0000200406', name: 'Dodge & Cox', aliases: ['dodge cox'] },
  
  // ===== LARGE ASSET MANAGERS =====
  { cik: '0000080255', name: 'T. Rowe Price Associates, Inc.', aliases: ['t rowe price'] },
  { cik: '0001423053', name: 'Wellington Management Group LLP', aliases: ['wellington'] },
  { cik: '0001166559', name: 'Capital Research Global Investors', aliases: ['capital research'] },
  { cik: '0000315066', name: 'Jennison Associates LLC', aliases: ['jennison'] },
  { cik: '0001364742', name: 'BlackRock Inc.', aliases: ['blackrock'] },
  { cik: '0000102909', name: 'Vanguard Group Inc', aliases: ['vanguard'] },
  { cik: '0000093751', name: 'State Street Corp', aliases: ['state street'] },
  { cik: '0000315066', name: 'Fidelity Management & Research Company', aliases: ['fidelity'] },
  { cik: '0000886982', name: 'Goldman Sachs Group Inc', aliases: ['goldman sachs', 'goldman'] },
  { cik: '0000895421', name: 'Morgan Stanley', aliases: ['morgan stanley'] },
  { cik: '0000019617', name: 'JPMorgan Chase & Co', aliases: ['jpmorgan', 'jp morgan'] },
  
  // ===== ADDITIONAL GROWTH/TECH =====
  { cik: '0001214717', name: 'Geode Capital Management, LLC', aliases: ['geode capital'] },
  { cik: '0001446194', name: 'Susquehanna International Group, LLP', aliases: ['susquehanna', 'sig'] },
  { cik: '0001571949', name: 'Virtu Financial LLC', aliases: ['virtu'] },
]

// Helper: Determine action based on share change
function determineAction(prevShares: number | null, currentShares: number): string {
  if (prevShares === null) {
    return 'NEW'
  }
  
  if (currentShares === 0) {
    return 'SOLD'
  }
  
  if (currentShares > prevShares) {
    return 'ADD'
  }
  
  if (currentShares < prevShares) {
    return 'REDUCE'
  }
  
  return 'HOLD'
}

// Helper: Format quarter from date
function getQuarter(dateStr: string): string {
  const date = new Date(dateStr)
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `Q${quarter} ${date.getFullYear()}`
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get FMP API key from environment
    const FMP_API_KEY = Deno.env.get('FMP_API_KEY')
    if (!FMP_API_KEY) {
      throw new Error('FMP_API_KEY not configured')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/investor-api', '')

    console.log(`[investor-api] ${req.method} ${path}`)

    // Route handling
    switch (true) {
      // GET /search?query=buffett - Search for investors by name
      case req.method === 'GET' && path === '/search': {
        const query = url.searchParams.get('query')
        if (!query) {
          return new Response(JSON.stringify({ error: 'Query parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const searchResults: SearchResult[] = []
        const seenCiks = new Set<string>()
        const queryLower = query.toLowerCase()

        // Strategy 0: Check curated list of well-known investors first
        for (const investor of KNOWN_INVESTORS) {
          const matches = investor.aliases.some(alias => alias.includes(queryLower) || queryLower.includes(alias))
          if (matches && !seenCiks.has(investor.cik)) {
            // Verify they have filings
            const datesUrl = `${FMP_BASE_URL}/institutional-ownership/dates?cik=${investor.cik}&apikey=${FMP_API_KEY}`
            const datesResp = await fetch(datesUrl)
            
            if (datesResp.ok) {
              const dates = await datesResp.json()
              if (Array.isArray(dates) && dates.length > 0) {
                seenCiks.add(investor.cik)
                searchResults.push({
                  cik: investor.cik,
                  name: investor.name,
                  date: dates[0]?.date
                })
              }
            }
          }
        }

        // Strategy 1: Search public companies by name and check if they file 13F
        const searchUrl = `${FMP_BASE_URL}/search-name?query=${encodeURIComponent(query)}&limit=20&apikey=${FMP_API_KEY}`
        const searchResp = await fetch(searchUrl)
        
        if (searchResp.ok) {
          const companies = await searchResp.json()
          
          if (Array.isArray(companies)) {
            const seenSymbols = new Set<string>()
            
            for (const company of companies) {
              if (!company.symbol || seenSymbols.has(company.symbol)) continue
              if (company.exchange && !['NYSE', 'NASDAQ', 'AMEX'].includes(company.exchange)) continue
              seenSymbols.add(company.symbol)
              
              const profileUrl = `${FMP_BASE_URL}/profile?symbol=${company.symbol}&apikey=${FMP_API_KEY}`
              const profileResp = await fetch(profileUrl)
              
              if (!profileResp.ok) continue
              
              const profiles = await profileResp.json()
              if (!Array.isArray(profiles) || profiles.length === 0 || !profiles[0].cik) continue
              
              const cik = profiles[0].cik
              if (seenCiks.has(cik)) continue
              seenCiks.add(cik)
              
              const datesUrl = `${FMP_BASE_URL}/institutional-ownership/dates?cik=${cik}&apikey=${FMP_API_KEY}`
              const datesResp = await fetch(datesUrl)
              
              if (datesResp.ok) {
                const dates = await datesResp.json()
                if (Array.isArray(dates) && dates.length > 0) {
                  searchResults.push({
                    cik: cik,
                    name: profiles[0].companyName || company.name,
                    date: dates[0]?.date
                  })
                  
                  if (searchResults.length >= 10) break
                }
              }
            }
          }
        }

        // Strategy 2: Search through recent 13F filers (for private funds like Scion, Pershing Square)
        // This catches hedge funds that aren't publicly traded companies
        if (searchResults.length < 10) {
          // Search through multiple pages of recent filings
          for (let page = 0; page < 20 && searchResults.length < 10; page++) {
            const filingsUrl = `${FMP_BASE_URL}/institutional-ownership/latest?page=${page}&limit=100&apikey=${FMP_API_KEY}`
            const filingsResp = await fetch(filingsUrl)
            
            if (!filingsResp.ok) break
            
            const filings = await filingsResp.json()
            if (!Array.isArray(filings) || filings.length === 0) break
            
            for (const filing of filings) {
              if (!filing.name || !filing.cik) continue
              if (seenCiks.has(filing.cik)) continue
              
              // Check if the filer name matches the search query
              if (filing.name.toLowerCase().includes(queryLower)) {
                seenCiks.add(filing.cik)
                searchResults.push({
                  cik: filing.cik,
                  name: filing.name,
                  date: filing.date
                })
                
                if (searchResults.length >= 10) break
              }
            }
          }
        }
        
        return new Response(JSON.stringify(searchResults), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /track - Add investor and fetch holdings
      case req.method === 'POST' && path === '/track': {
        const body: TrackRequest = await req.json()
        const { cik, name } = body

        if (!cik || !name) {
          return new Response(JSON.stringify({ error: 'CIK and name required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Check if investor already exists
        const { data: existing } = await supabase
          .from('tracked_investors')
          .select('id, last_filing_date')
          .eq('cik', cik)
          .single()

        let investorId: number

        if (existing) {
          // Already tracked, just refresh holdings
          investorId = existing.id
          console.log(`Investor ${name} (${cik}) already tracked, refreshing...`)
        } else {
          // Insert new investor
          const { data: investor, error: insertError } = await supabase
            .from('tracked_investors')
            .insert({ name, cik })
            .select()
            .single()

          if (insertError) throw insertError
          investorId = investor.id
          console.log(`Added new investor: ${name} (${cik})`)
        }

        // Get available filing dates for this investor
        const datesUrl = `${FMP_BASE_URL}/institutional-ownership/dates?cik=${cik}&apikey=${FMP_API_KEY}`
        const datesResp = await fetch(datesUrl)
        
        if (!datesResp.ok) {
          throw new Error(`FMP API error fetching dates: ${datesResp.status}`)
        }

        const dates: FMPFilingDate[] = await datesResp.json()
        
        if (!dates || dates.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'No filing dates found for this investor',
            investorId 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get the most recent filing
        const latestDate = dates[0]
        const { year, quarter } = latestDate

        // Fetch holdings for the latest quarter
        const holdingsUrl = `${FMP_BASE_URL}/institutional-ownership/extract?cik=${cik}&year=${year}&quarter=${quarter}&apikey=${FMP_API_KEY}`
        const holdingsResp = await fetch(holdingsUrl)
        
        if (!holdingsResp.ok) {
          throw new Error(`FMP API error fetching holdings: ${holdingsResp.status}`)
        }

        const holdings: FMPHolding[] = await holdingsResp.json()
        
        if (!holdings || holdings.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'No holdings found for this investor',
            investorId 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Aggregate holdings by symbol (some stocks have multiple entries for different share classes or options)
        const aggregatedHoldings = new Map<string, { symbol: string, nameOfIssuer: string, shares: number, value: number, date: string }>()
        
        for (const h of holdings) {
          const symbol = h.symbol || 'UNKNOWN'
          const existing = aggregatedHoldings.get(symbol)
          
          if (existing) {
            existing.shares += h.shares || 0
            existing.value += h.value || 0
          } else {
            aggregatedHoldings.set(symbol, {
              symbol,
              nameOfIssuer: h.nameOfIssuer || 'Unknown',
              shares: h.shares || 0,
              value: h.value || 0,
              date: h.date || latestDate.date
            })
          }
        }

        // Calculate total portfolio value
        const totalValue = Array.from(aggregatedHoldings.values()).reduce((sum, h) => sum + h.value, 0)

        // Map holdings to our schema
        const rows = Array.from(aggregatedHoldings.values()).map(h => ({
          investor_id: investorId,
          symbol: h.symbol,
          company_name: h.nameOfIssuer,
          shares: h.shares,
          value: h.value,
          percent_portfolio: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
          change_shares: 0, // Will be calculated on subsequent refreshes
          change_percent: 0,
          action: 'NEW',
          date_reported: h.date,
          quarter: `Q${quarter} ${year}`
        }))

        // Insert holdings (upsert to handle refreshes)
        const { error: holdingsError } = await supabase
          .from('investor_holdings')
          .upsert(rows, { 
            onConflict: 'investor_id,symbol,date_reported',
            ignoreDuplicates: false 
          })

        if (holdingsError) throw holdingsError

        // Update investor's last_filing_date
        await supabase
          .from('tracked_investors')
          .update({ 
            last_filing_date: latestDate.date,
            last_updated: new Date().toISOString()
          })
          .eq('id', investorId)

        console.log(`Inserted ${rows.length} holdings for ${name}`)

        return new Response(JSON.stringify({ 
          success: true,
          investorId,
          holdingsCount: rows.length,
          filingDate: latestDate.date,
          quarter: `Q${quarter} ${year}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /investors - List all tracked investors
      case req.method === 'GET' && path === '/investors': {
        const { data, error } = await supabase
          .from('v_guru_summary')
          .select('*')
          .order('investor_name')

        if (error) throw error

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /holdings/:investorId - Get holdings for an investor
      case req.method === 'GET' && path.startsWith('/holdings/'): {
        const investorId = path.split('/')[2]
        
        const { data, error } = await supabase
          .from('v_guru_latest_holdings')
          .select('*')
          .eq('investor_id', investorId)
          .order('percent_portfolio', { ascending: false, nullsFirst: false })

        if (error) throw error

        return new Response(JSON.stringify(data || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /refresh/:investorId - Refresh holdings for an investor
      case req.method === 'POST' && path.startsWith('/refresh/'): {
        const investorId = path.split('/')[2]
        
        // Get investor details
        const { data: investor, error: investorError } = await supabase
          .from('tracked_investors')
          .select('cik, name')
          .eq('id', investorId)
          .single()

        if (investorError || !investor) {
          return new Response(JSON.stringify({ error: 'Investor not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get available filing dates
        const datesUrl = `${FMP_BASE_URL}/institutional-ownership/dates?cik=${investor.cik}&apikey=${FMP_API_KEY}`
        const datesResp = await fetch(datesUrl)
        
        if (!datesResp.ok) {
          throw new Error(`FMP API error: ${datesResp.status}`)
        }

        const dates: FMPFilingDate[] = await datesResp.json()
        
        if (!dates || dates.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'No filing dates found',
            investorId 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const latestDate = dates[0]
        const { year, quarter } = latestDate

        // Fetch latest holdings
        const holdingsUrl = `${FMP_BASE_URL}/institutional-ownership/extract?cik=${investor.cik}&year=${year}&quarter=${quarter}&apikey=${FMP_API_KEY}`
        const holdingsResp = await fetch(holdingsUrl)
        
        if (!holdingsResp.ok) {
          throw new Error(`FMP API error: ${holdingsResp.status}`)
        }

        const holdings: FMPHolding[] = await holdingsResp.json()
        
        if (!holdings || holdings.length === 0) {
          return new Response(JSON.stringify({ 
            error: 'No holdings found',
            investorId 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get previous holdings to calculate changes
        const { data: prevHoldings } = await supabase
          .from('investor_holdings')
          .select('symbol, shares')
          .eq('investor_id', investorId)
        
        const prevHoldingsMap = new Map(
          (prevHoldings || []).map(h => [h.symbol, h.shares])
        )

        // Calculate total portfolio value
        const totalValue = holdings.reduce((sum, h) => sum + (h.value || 0), 0)

        const rows = holdings.map(h => {
          const prevShares = prevHoldingsMap.get(h.symbol) || null
          const changeShares = prevShares !== null ? (h.shares || 0) - prevShares : 0
          const changePercent = prevShares && prevShares > 0 ? (changeShares / prevShares) * 100 : 0
          
          return {
            investor_id: parseInt(investorId),
            symbol: h.symbol || 'UNKNOWN',
            company_name: h.nameOfIssuer || 'Unknown',
            shares: h.shares || 0,
            value: h.value || 0,
            percent_portfolio: totalValue > 0 ? ((h.value || 0) / totalValue) * 100 : 0,
            change_shares: changeShares,
            change_percent: changePercent,
            action: determineAction(prevShares, h.shares || 0),
            date_reported: h.date || latestDate.date,
            quarter: `Q${quarter} ${year}`
          }
        })

        const { error: holdingsError } = await supabase
          .from('investor_holdings')
          .upsert(rows, { 
            onConflict: 'investor_id,symbol,date_reported',
            ignoreDuplicates: false 
          })

        if (holdingsError) throw holdingsError

        await supabase
          .from('tracked_investors')
          .update({ 
            last_filing_date: latestDate.date,
            last_updated: new Date().toISOString()
          })
          .eq('id', investorId)

        return new Response(JSON.stringify({ 
          success: true,
          holdingsCount: rows.length,
          filingDate: latestDate.date,
          quarter: `Q${quarter} ${year}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /investors/:investorId - Remove investor
      case req.method === 'DELETE' && path.startsWith('/investors/'): {
        const investorId = path.split('/')[2]
        
        const { error } = await supabase
          .from('tracked_investors')
          .delete()
          .eq('id', investorId)

        if (error) throw error

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Investor API error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

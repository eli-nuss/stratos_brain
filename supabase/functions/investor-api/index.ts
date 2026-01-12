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

        // Search for companies by name using FMP's search endpoint
        const searchUrl = `${FMP_BASE_URL}/search-name?query=${encodeURIComponent(query)}&limit=20&apikey=${FMP_API_KEY}`
        const searchResp = await fetch(searchUrl)
        
        if (!searchResp.ok) {
          throw new Error(`FMP API error: ${searchResp.status}`)
        }

        const companies = await searchResp.json()
        
        if (!Array.isArray(companies) || companies.length === 0) {
          return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get CIK from company profile and verify they have 13F filings
        const searchResults: SearchResult[] = []
        const seenCiks = new Set<string>()
        const seenSymbols = new Set<string>()
        
        for (const company of companies) {
          // Skip if we've seen this symbol or if it's not a US exchange
          if (!company.symbol || seenSymbols.has(company.symbol)) continue
          if (company.exchange && !['NYSE', 'NASDAQ', 'AMEX'].includes(company.exchange)) continue
          seenSymbols.add(company.symbol)
          
          // Get company profile to get CIK
          const profileUrl = `${FMP_BASE_URL}/profile?symbol=${company.symbol}&apikey=${FMP_API_KEY}`
          const profileResp = await fetch(profileUrl)
          
          if (!profileResp.ok) continue
          
          const profiles = await profileResp.json()
          if (!Array.isArray(profiles) || profiles.length === 0 || !profiles[0].cik) continue
          
          const cik = profiles[0].cik
          if (seenCiks.has(cik)) continue
          seenCiks.add(cik)
          
          // Check if this CIK has 13F filings
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

        // Calculate total portfolio value
        const totalValue = holdings.reduce((sum, h) => sum + (h.value || 0), 0)

        // Map holdings to our schema
        const rows = holdings.map(h => ({
          investor_id: investorId,
          symbol: h.symbol || 'UNKNOWN',
          company_name: h.nameOfIssuer || 'Unknown',
          shares: h.shares || 0,
          value: h.value || 0,
          percent_portfolio: totalValue > 0 ? ((h.value || 0) / totalValue) * 100 : 0,
          change_shares: 0, // Will be calculated on subsequent refreshes
          change_percent: 0,
          action: 'NEW',
          date_reported: h.date || latestDate.date,
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

// Supabase Edge Function: Guru Tracker API
// Handles search, tracking, and retrieval of super-investor portfolios via FMP API
// 
// Endpoints:
// - GET /search?query=buffett - Search for investors by name
// - POST /track - Add investor to tracking list and fetch holdings
// - GET /holdings/:investorId - Get holdings for a tracked investor
// - GET /investors - List all tracked investors
// - DELETE /investors/:investorId - Remove investor from tracking
// - POST /refresh/:investorId - Refresh holdings for an investor

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

interface SearchResult {
  cik: string
  name: string
  entityType?: string
}

interface FMPHolding {
  symbol: string
  securityName: string
  shares: number
  value: number
  weightPercentage: number
  changeInSharesNumberPercentage?: number
  changeInSharesNumber?: number
  filingDate: string
}

interface TrackRequest {
  cik: string
  name: string
}

// Helper: Determine action based on share change
function determineAction(changeShares: number | null, shares: number): string {
  if (changeShares === null || changeShares === 0) {
    return 'HOLD'
  }
  
  // If current shares are equal to change, it's a new position
  if (shares === changeShares) {
    return 'NEW'
  }
  
  // If change is positive, they added
  if (changeShares > 0) {
    return 'ADD'
  }
  
  // If change is negative but still holding, they reduced
  if (changeShares < 0 && shares > 0) {
    return 'REDUCE'
  }
  
  // If shares are 0, they sold
  if (shares === 0) {
    return 'SOLD'
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
    const path = url.pathname.replace('/guru-api', '')

    // Route handling
    switch (true) {
      // GET /search?query=buffett
      case req.method === 'GET' && path === '/search': {
        const query = url.searchParams.get('query')
        if (!query) {
          return new Response(JSON.stringify({ error: 'Query parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Search for CIK using FMP API
        const searchUrl = `https://financialmodelingprep.com/api/v3/cik-search/${encodeURIComponent(query)}?apikey=${FMP_API_KEY}`
        const searchResp = await fetch(searchUrl)
        
        if (!searchResp.ok) {
          throw new Error(`FMP API error: ${searchResp.status}`)
        }

        const results: SearchResult[] = await searchResp.json()
        
        return new Response(JSON.stringify(results), {
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

        // Fetch latest 13F holdings from FMP
        // Using v4 endpoint which provides better data
        const holdingsUrl = `https://financialmodelingprep.com/api/v4/institutional-ownership/portfolio-holdings?cik=${cik}&apikey=${FMP_API_KEY}`
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

        // Get the filing date from first holding
        const filingDate = holdings[0].filingDate
        const quarter = getQuarter(filingDate)

        // Map holdings to our schema
        const rows = holdings.map(h => ({
          investor_id: investorId,
          symbol: h.symbol,
          company_name: h.securityName,
          shares: h.shares,
          value: h.value,
          percent_portfolio: h.weightPercentage,
          change_shares: h.changeInSharesNumber || 0,
          change_percent: h.changeInSharesNumberPercentage || 0,
          action: determineAction(h.changeInSharesNumber || null, h.shares),
          date_reported: filingDate,
          quarter: quarter
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
            last_filing_date: filingDate,
            last_updated: new Date().toISOString()
          })
          .eq('id', investorId)

        console.log(`Inserted ${rows.length} holdings for ${name}`)

        return new Response(JSON.stringify({ 
          success: true,
          investorId,
          holdingsCount: rows.length,
          filingDate,
          quarter
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

        return new Response(JSON.stringify(data), {
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

        return new Response(JSON.stringify(data), {
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

        // Fetch latest holdings from FMP
        const holdingsUrl = `https://financialmodelingprep.com/api/v4/institutional-ownership/portfolio-holdings?cik=${investor.cik}&apikey=${FMP_API_KEY}`
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

        const filingDate = holdings[0].filingDate
        const quarter = getQuarter(filingDate)

        const rows = holdings.map(h => ({
          investor_id: parseInt(investorId),
          symbol: h.symbol,
          company_name: h.securityName,
          shares: h.shares,
          value: h.value,
          percent_portfolio: h.weightPercentage,
          change_shares: h.changeInSharesNumber || 0,
          change_percent: h.changeInSharesNumberPercentage || 0,
          action: determineAction(h.changeInSharesNumber || null, h.shares),
          date_reported: filingDate,
          quarter: quarter
        }))

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
            last_filing_date: filingDate,
            last_updated: new Date().toISOString()
          })
          .eq('id', investorId)

        return new Response(JSON.stringify({ 
          success: true,
          holdingsCount: rows.length,
          filingDate,
          quarter
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
    console.error('Guru API error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

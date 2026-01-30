// Supabase Edge Function: Supply Chain API
// Provides REST endpoints for the AI Infrastructure Supply Chain Map
// 
// Endpoints:
// GET /supply-chain-api/tiers - Get all tiers with categories and companies

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/supply-chain-api', '')

    // Route handling
    switch (true) {
      // GET /tiers - Get all supply chain data
      case req.method === 'GET' && (path === '/tiers' || path === '' || path === '/'): {
        // Fetch tiers
        const { data: tiers, error: tiersError } = await supabase
          .from('supply_chain_tiers')
          .select('*')
          .order('display_order')
        
        if (tiersError) throw tiersError
        
        // Fetch categories
        const { data: categories, error: catsError } = await supabase
          .from('supply_chain_categories')
          .select('*')
          .order('display_order')
        
        if (catsError) throw catsError
        
        // Fetch company mappings with asset data
        const { data: mappings, error: mappingsError } = await supabase
          .from('asset_supply_chain_mapping')
          .select(`
            *,
            assets:asset_id (
              asset_id,
              symbol,
              name,
              asset_type,
              is_active
            )
          `)
        
        if (mappingsError) throw mappingsError
        
        // Fetch equity metadata for financial data
        const symbols = mappings
          ?.filter((m: any) => m.assets?.symbol)
          .map((m: any) => m.assets.symbol) || []
        
        const { data: equityData, error: eqError } = await supabase
          .from('equity_metadata')
          .select('symbol, market_cap, revenue_ttm, profit_margin, ev_to_revenue, ev_to_ebitda')
          .in('symbol', symbols)
        
        if (eqError) throw eqError
        
        const equityMap = new Map(equityData?.map((e: any) => [e.symbol, e]) || [])
        
        // Fetch private companies
        const { data: privateCompanies, error: privError } = await supabase
          .from('private_companies')
          .select('*')
        
        if (privError) throw privError
        
        // Build response structure
        const result = tiers?.map((tier: any) => {
          const tierCategories = categories?.filter((c: any) => c.tier_id === tier.tier_id) || []
          
          return {
            ...tier,
            categories: tierCategories.map((cat: any) => {
              // Get public companies for this category
              const catMappings = mappings?.filter((m: any) => m.category_id === cat.category_id && m.assets?.is_active) || []
              const publicCompanies = catMappings.map((m: any) => {
                const eq = equityMap.get(m.assets?.symbol)
                return {
                  company_id: `public_${m.assets?.asset_id}`,
                  company_type: 'public',
                  symbol: m.assets?.symbol,
                  name: m.assets?.name,
                  asset_id: m.assets?.asset_id,
                  role_description: m.role_description,
                  market_share_percent: m.market_share_percent,
                  competitive_position: m.competitive_position,
                  key_products: m.key_products,
                  display_order: m.display_order,
                  market_cap: (eq as any)?.market_cap,
                  revenue_ttm: (eq as any)?.revenue_ttm,
                  profit_margin: (eq as any)?.profit_margin,
                  ev_to_revenue: (eq as any)?.ev_to_revenue,
                  ev_to_ebitda: (eq as any)?.ev_to_ebitda,
                  return_1d: null,
                  return_7d: null,
                  return_30d: null,
                  return_1y: null
                }
              })
              
              // Get private companies for this category
              const catPrivate = privateCompanies?.filter((p: any) => p.category_id === cat.category_id) || []
              const privateComps = catPrivate.map((p: any) => ({
                company_id: `private_${p.company_id}`,
                company_type: 'private',
                symbol: null,
                name: p.name,
                role_description: p.role_description,
                market_share_percent: null,
                competitive_position: p.competitive_position,
                key_products: p.key_products,
                display_order: p.display_order,
                market_cap: null,
                revenue_ttm: null,
                profit_margin: null,
                ev_to_revenue: null,
                ev_to_ebitda: null,
                estimated_valuation: p.estimated_valuation,
                estimated_revenue: p.estimated_revenue,
                funding_stage: p.funding_stage,
                total_funding: p.total_funding,
                key_investors: p.key_investors,
                return_1d: null,
                return_7d: null,
                return_30d: null,
                return_1y: null
              }))
              
              return {
                ...cat,
                public_company_count: publicCompanies.length,
                private_company_count: privateComps.length,
                companies: [...publicCompanies, ...privateComps].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
              }
            })
          }
        })
        
        return new Response(JSON.stringify(result), {
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
    console.error('Supply Chain API error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

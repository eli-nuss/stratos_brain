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
    // Create Supabase client using service role key for public read-only access
    // This endpoint serves public supply chain data - no auth required
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
                parent_category_id: cat.parent_category_id || null,
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

      // GET /relationships - Get all supply chain relationships for flow visualization
      case req.method === 'GET' && path === '/relationships': {
        // Fetch all relationships
        const { data: relationships, error: relError } = await supabase
          .from('supply_chain_relationships')
          .select('*')
          .eq('is_active', true)
        
        if (relError) throw relError
        
        // Get all asset IDs involved
        const assetIds = new Set<number>()
        const privateIds = new Set<number>()
        
        relationships?.forEach((rel: any) => {
          if (rel.supplier_asset_id) assetIds.add(rel.supplier_asset_id)
          if (rel.customer_asset_id) assetIds.add(rel.customer_asset_id)
          if (rel.supplier_private_id) privateIds.add(rel.supplier_private_id)
          if (rel.customer_private_id) privateIds.add(rel.customer_private_id)
        })
        
        // Fetch asset details
        const { data: assets, error: assetsError } = await supabase
          .from('assets')
          .select('asset_id, symbol, name')
          .in('asset_id', Array.from(assetIds))
        
        if (assetsError) throw assetsError
        
        const assetMap = new Map(assets?.map((a: any) => [a.asset_id, a]) || [])
        
        // Fetch private company details
        const { data: privateComps, error: privError } = await supabase
          .from('private_companies')
          .select('company_id, name')
          .in('company_id', Array.from(privateIds))
        
        if (privError) throw privError
        
        const privateMap = new Map(privateComps?.map((p: any) => [p.company_id, p]) || [])
        
        // Fetch supply chain mappings to get tier info
        const { data: mappings, error: mapError } = await supabase
          .from('asset_supply_chain_mapping')
          .select(`
            asset_id,
            category:category_id (
              category_id,
              category_name,
              tier:tier_id (
                tier_id,
                tier_number,
                tier_name
              )
            )
          `)
          .in('asset_id', Array.from(assetIds))
        
        if (mapError) throw mapError
        
        const assetTierMap = new Map(mappings?.map((m: any) => [
          m.asset_id, 
          {
            tier_number: m.category?.tier?.tier_number,
            tier_name: m.category?.tier?.tier_name,
            category_name: m.category?.category_name
          }
        ]) || [])
        
        // Fetch private company tier info
        const { data: privateWithTier, error: privTierError } = await supabase
          .from('private_companies')
          .select(`
            company_id,
            category:category_id (
              category_id,
              category_name,
              tier:tier_id (
                tier_id,
                tier_number,
                tier_name
              )
            )
          `)
          .in('company_id', Array.from(privateIds))
        
        if (privTierError) throw privTierError
        
        const privateTierMap = new Map(privateWithTier?.map((p: any) => [
          p.company_id,
          {
            tier_number: p.category?.tier?.tier_number,
            tier_name: p.category?.tier?.tier_name,
            category_name: p.category?.category_name
          }
        ]) || [])
        
        // Fetch equity metadata for market cap
        const symbols = assets?.map((a: any) => a.symbol).filter(Boolean) || []
        const { data: equityData, error: eqError } = await supabase
          .from('equity_metadata')
          .select('symbol, market_cap')
          .in('symbol', symbols)
        
        if (eqError) throw eqError
        
        const equityMap = new Map(equityData?.map((e: any) => [e.symbol, e.market_cap]) || [])
        
        // Build response
        const result = relationships?.map((rel: any) => {
          // Build supplier info
          let supplier: any
          if (rel.supplier_asset_id) {
            const asset = assetMap.get(rel.supplier_asset_id)
            const tierInfo = assetTierMap.get(rel.supplier_asset_id) || {}
            supplier = {
              asset_id: rel.supplier_asset_id,
              private_id: null,
              symbol: asset?.symbol,
              name: asset?.name,
              tier_number: tierInfo.tier_number,
              tier_name: tierInfo.tier_name,
              category_name: tierInfo.category_name,
              market_cap: equityMap.get(asset?.symbol),
              is_private: false
            }
          } else {
            const priv = privateMap.get(rel.supplier_private_id)
            const tierInfo = privateTierMap.get(rel.supplier_private_id) || {}
            supplier = {
              asset_id: null,
              private_id: rel.supplier_private_id,
              symbol: null,
              name: priv?.name,
              tier_number: tierInfo.tier_number,
              tier_name: tierInfo.tier_name,
              category_name: tierInfo.category_name,
              market_cap: null,
              is_private: true
            }
          }
          
          // Build customer info
          let customer: any
          if (rel.customer_asset_id) {
            const asset = assetMap.get(rel.customer_asset_id)
            const tierInfo = assetTierMap.get(rel.customer_asset_id) || {}
            customer = {
              asset_id: rel.customer_asset_id,
              private_id: null,
              symbol: asset?.symbol,
              name: asset?.name,
              tier_number: tierInfo.tier_number,
              tier_name: tierInfo.tier_name,
              category_name: tierInfo.category_name,
              market_cap: equityMap.get(asset?.symbol),
              is_private: false
            }
          } else {
            const priv = privateMap.get(rel.customer_private_id)
            const tierInfo = privateTierMap.get(rel.customer_private_id) || {}
            customer = {
              asset_id: null,
              private_id: rel.customer_private_id,
              symbol: null,
              name: priv?.name,
              tier_number: tierInfo.tier_number,
              tier_name: tierInfo.tier_name,
              category_name: tierInfo.category_name,
              market_cap: null,
              is_private: true
            }
          }
          
          return {
            relationship_id: rel.relationship_id,
            supplier,
            customer,
            relationship_type: rel.relationship_type,
            relationship_strength: rel.relationship_strength,
            description: rel.description,
            products_services: rel.products_services,
            revenue_dependency_percent: rel.revenue_dependency_percent
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

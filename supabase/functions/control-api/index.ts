// Supabase Edge Function: Signal Engine Control API
// Provides REST endpoints for managing the signal engine from the dashboard
// 
// Authentication Options:
// 1. JWT (Supabase Auth): Authorization: Bearer <user_jwt>
// 2. API Key (scripts/n8n): x-stratos-key: <STRATOS_BRAIN_API_KEY>
// 3. Supabase Anon Key: apikey: <SUPABASE_ANON_KEY> (for browser clients)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface EnqueueRequest {
  job_type?: string
  as_of_date?: string
  universe_id?: string
  config_id?: string
  params?: Record<string, unknown>
}

// Check if the request is for a public dashboard endpoint (read-only or chat)
function isPublicDashboardEndpoint(req: Request): boolean {
  const url = new URL(req.url)
  const path = url.pathname.replace('/control-api', '')
  
  // Allow public read access to dashboard GET endpoints
  if (req.method === 'GET' && path.startsWith('/dashboard/')) {
    return true
  }
  
  // Allow public access to dashboard chat endpoint (POST)
  if (req.method === 'POST' && path === '/dashboard/chat') {
    return true
  }
  
  // Allow public access to notes endpoints (all methods)
  if (path.startsWith('/dashboard/notes') || path.startsWith('/dashboard/files')) {
    return true
  }
  
  // Allow public access to watchlist endpoints (all methods)
  if (path.startsWith('/dashboard/watchlist')) {
    return true
  }
  
  return false
}

// Validate authentication - supports multiple auth methods
function validateAuth(req: Request): { valid: boolean; error?: string } {
  // Allow public access to dashboard read endpoints
  if (isPublicDashboardEndpoint(req)) {
    console.log('Auth bypassed for public dashboard endpoint')
    return { valid: true }
  }

  // Option 1: Check for x-stratos-key header (API key for scripts/n8n)
  const stratosKey = req.headers.get('x-stratos-key')
  // Use env var if set, otherwise fall back to hardcoded key
  const expectedKey = Deno.env.get('STRATOS_BRAIN_API_KEY') || 'stratos_brain_api_key_2024'
  
  console.log('Auth check - stratosKey present:', !!stratosKey, 'expectedKey present:', !!expectedKey)
  
  if (stratosKey && expectedKey && stratosKey === expectedKey) {
    console.log('Auth success via x-stratos-key')
    return { valid: true }
  }
  
  // Option 2: Check for valid JWT in Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    // JWT validation is handled by Supabase's verify_jwt setting
    // If we get here with a Bearer token, it passed Supabase's JWT check
    return { valid: true }
  }
  
  // Option 3: Check for apikey header (Supabase anon key)
  const apiKey = req.headers.get('apikey')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (apiKey && anonKey && apiKey === anonKey) {
    return { valid: true }
  }
  
  // Note: With hardcoded fallback key, expectedKey is always set
  
  return { 
    valid: false, 
    error: 'Unauthorized. Provide x-stratos-key header or valid JWT.' 
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate authentication
    const auth = validateAuth(req)
    if (!auth.valid) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/control-api', '')

    // Route handling
    switch (true) {
      // GET /status - Get engine status
      case req.method === 'GET' && path === '/status': {
        const { data, error } = await supabase
          .from('v_signal_summary')
          .select('*')
          .single()
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /enqueue - Enqueue a new job
      case req.method === 'POST' && path === '/enqueue': {
        const body: EnqueueRequest = await req.json()
        
        const { data, error } = await supabase.rpc('enqueue_engine_job', {
          p_job_type: body.job_type || 'full_pipeline',
          p_as_of_date: body.as_of_date || new Date().toISOString().split('T')[0],
          p_universe_id: body.universe_id || null,
          p_config_id: body.config_id || null,
          p_params: body.params || {}
        })
        
        if (error) throw error
        
        return new Response(JSON.stringify({ job_id: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /configs - List engine configurations
      case req.method === 'GET' && path === '/configs': {
        const { data, error } = await supabase
          .from('engine_configs')
          .select('*')
          .order('name')
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /configs/:id - Update a configuration
      case req.method === 'PUT' && path.startsWith('/configs/'): {
        const configId = path.split('/')[2]
        const body = await req.json()
        
        const { data, error } = await supabase
          .from('engine_configs')
          .update(body)
          .eq('config_id', configId)
          .select()
          .single()
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /runs - Get recent pipeline runs
      case req.method === 'GET' && path === '/runs': {
        const limit = url.searchParams.get('limit') || '20'
        
        const { data, error } = await supabase
          .from('v_recent_runs')
          .select('*')
          .limit(parseInt(limit))
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /leaders - Get bullish leaders
      case req.method === 'GET' && path === '/leaders': {
        const limit = url.searchParams.get('limit') || '20'
        
        const { data, error } = await supabase
          .from('v_leaders')
          .select('*')
          .limit(parseInt(limit))
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /risks - Get bearish risks
      case req.method === 'GET' && path === '/risks': {
        const limit = url.searchParams.get('limit') || '20'
        
        const { data, error } = await supabase
          .from('v_risks')
          .select('*')
          .limit(parseInt(limit))
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /signals - Get active signals
      case req.method === 'GET' && path === '/signals': {
        const limit = url.searchParams.get('limit') || '50'
        const direction = url.searchParams.get('direction')
        const template = url.searchParams.get('template')
        
        let query = supabase
          .from('v_active_signals')
          .select('*')
        
        if (direction) {
          query = query.eq('direction', direction)
        }
        if (template) {
          query = query.eq('template_name', template)
        }
        
        const { data, error } = await query.limit(parseInt(limit))
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /queue-depth - Get current queue depth
      case req.method === 'GET' && path === '/queue-depth': {
        const { data, error } = await supabase.rpc('get_queue_depth')
        
        if (error) throw error
        
        return new Response(JSON.stringify({ depth: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== DASHBOARD ENDPOINTS ====================

      // GET /dashboard/inflections - Get new breakouts/reversals (high novelty)
      // Supports direction filter: 'bullish' or 'bearish'
      // Supports pagination with limit and offset
      case req.method === 'GET' && path === '/dashboard/inflections': {
        const limit = url.searchParams.get('limit') || '25'
        const offset = url.searchParams.get('offset') || '0'
        const asOfDate = url.searchParams.get('as_of_date')
        const universeId = url.searchParams.get('universe_id')
        const configId = url.searchParams.get('config_id')
        const direction = url.searchParams.get('direction') // 'bullish' or 'bearish'
        
        let query = supabase
          .from('v_dashboard_inflections')
          .select('*')
          .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
          
        if (asOfDate) {
          query = query.eq('as_of_date', asOfDate)
        }
        
        if (universeId) {
          query = query.eq('universe_id', universeId)
        }
        
        if (configId) {
          query = query.eq('config_id', configId)
        }
        
        // Filter by direction if specified
        if (direction) {
          query = query.eq('inflection_direction', direction)
        }
        
        // Order by absolute inflection score (biggest moves first)
        // For bullish: highest positive first; for bearish: most negative first
        if (direction === 'bearish') {
          query = query.order('inflection_score', { ascending: true })
        } else if (direction === 'bullish') {
          query = query.order('inflection_score', { ascending: false })
        } else {
          query = query.order('abs_inflection', { ascending: false })
        }
        
        const { data, error } = await query
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/trends - Get ongoing bullish trends (ACTIVE signals)
      case req.method === 'GET' && path === '/dashboard/trends': {
        const limit = url.searchParams.get('limit') || '25'
        const asOfDate = url.searchParams.get('as_of_date')
        const universeId = url.searchParams.get('universe_id')
        const configId = url.searchParams.get('config_id')
        
        let query = supabase
          .from('v_dashboard_trends')
          .select('*')
          .limit(parseInt(limit))
          
        if (asOfDate) {
          query = query.eq('as_of_date', asOfDate)
        }
        
        if (universeId) {
          query = query.eq('universe_id', universeId)
        }
        
        if (configId) {
          query = query.eq('config_id', configId)
        }
        
        // Order by weighted score (strongest trends first)
        query = query.order('weighted_score', { ascending: false })
        
        const { data, error } = await query
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/risk - Get bearish setups and breakdown risk
      case req.method === 'GET' && path === '/dashboard/risk': {
        const limit = url.searchParams.get('limit') || '25'
        const asOfDate = url.searchParams.get('as_of_date')
        const universeId = url.searchParams.get('universe_id')
        const configId = url.searchParams.get('config_id')
        
        let query = supabase
          .from('v_dashboard_risk')
          .select('*')
          .limit(parseInt(limit))
          
        if (asOfDate) {
          query = query.eq('as_of_date', asOfDate)
        }
        
        if (universeId) {
          query = query.eq('universe_id', universeId)
        }
        
        if (configId) {
          query = query.eq('config_id', configId)
        }
        
        // Order by weighted score ascending (most negative/risky first)
        query = query.order('weighted_score', { ascending: true })
        
        const { data, error } = await query
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== AI REVIEW ENDPOINTS ====================

      // GET /dashboard/reviews - Get AI reviews for dashboard assets
      // Supports filtering by scope, attention_level, direction
      // Supports pagination with limit and offset
      case req.method === 'GET' && path === '/dashboard/reviews': {
        const limit = url.searchParams.get('limit') || '50'
        const offset = url.searchParams.get('offset') || '0'
        const asOfDate = url.searchParams.get('as_of_date')
        const universeId = url.searchParams.get('universe_id')
        const configId = url.searchParams.get('config_id')
        const scope = url.searchParams.get('scope') // inflections_bullish, inflections_bearish, trends, risk
        const attentionLevel = url.searchParams.get('attention_level') // URGENT, FOCUS, WATCH, IGNORE
        const direction = url.searchParams.get('direction') // bullish, bearish, neutral
        
        let query = supabase
          .from('asset_ai_reviews')
          .select(`
            asset_id,
            as_of_date,
            scope,
            prompt_version,
            model,
            review_json,
            summary_text,
            attention_level,
            direction,
            setup_type,
            confidence,
            entry,
            targets,
            invalidation,
            support,
            resistance,
            pass1_review,
            tokens_in,
            tokens_out,
            created_at
          `)
          .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
          
        if (asOfDate) {
          query = query.eq('as_of_date', asOfDate)
        }
        
        if (universeId) {
          query = query.eq('universe_id', universeId)
        }
        
        if (configId) {
          query = query.eq('config_id', configId)
        }
        
        if (scope) {
          query = query.eq('scope', scope)
        }
        
        if (attentionLevel) {
          query = query.eq('attention_level', attentionLevel)
        }
        
        if (direction) {
          query = query.eq('direction', direction)
        }
        
        // Order by confidence descending, then by attention level priority
        query = query.order('confidence', { ascending: false })
        
        const { data, error } = await query
        
        if (error) throw error
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/reviews/:asset_id - Get AI review for a specific asset
      case req.method === 'GET' && path.startsWith('/dashboard/reviews/'): {
        const assetId = decodeURIComponent(path.split('/')[3])
        const asOfDate = url.searchParams.get('as_of_date')
        
        let query = supabase
          .from('asset_ai_reviews')
          .select('*')
          .eq('asset_id', assetId)
          .order('as_of_date', { ascending: false })
          .limit(1)
          
        if (asOfDate) {
          query = query.eq('as_of_date', asOfDate)
        }
        
        const { data, error } = await query
        
        if (error) throw error
        
        if (!data || data.length === 0) {
          return new Response(JSON.stringify({ error: 'Review not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data[0]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/inflections-with-reviews - Get inflections with AI reviews joined
      case req.method === 'GET' && path === '/dashboard/inflections-with-reviews': {
        const limit = url.searchParams.get('limit') || '25'
        const asOfDate = url.searchParams.get('as_of_date')
        const universeId = url.searchParams.get('universe_id')
        const configId = url.searchParams.get('config_id')
        const direction = url.searchParams.get('direction')
        
        // Build the query with a join to AI reviews
        let baseQuery = `
          SELECT 
            i.*,
            r.summary_text as ai_summary,
            r.attention_level as ai_attention_level,
            r.direction as ai_direction,
            r.setup_type as ai_setup_type,
            r.confidence as ai_confidence,
            r.review_json as ai_review
          FROM v_dashboard_inflections i
          LEFT JOIN asset_ai_reviews r ON 
            i.asset_id = r.asset_id 
            AND i.as_of_date = r.as_of_date
            AND r.source_scope LIKE 'inflections_%'
          WHERE 1=1
        `
        
        const params: string[] = []
        let paramIndex = 1
        
        if (asOfDate) {
          baseQuery += ` AND i.as_of_date = $${paramIndex}`
          params.push(asOfDate)
          paramIndex++
        }
        
        if (universeId) {
          baseQuery += ` AND i.universe_id = $${paramIndex}`
          params.push(universeId)
          paramIndex++
        }
        
        if (configId) {
          baseQuery += ` AND i.config_id = $${paramIndex}::uuid`
          params.push(configId)
          paramIndex++
        }
        
        if (direction) {
          baseQuery += ` AND i.inflection_direction = $${paramIndex}`
          params.push(direction)
          paramIndex++
        }
        
        baseQuery += ` ORDER BY i.abs_inflection DESC LIMIT $${paramIndex}`
        params.push(limit)
        
        // Use raw SQL via RPC (requires a helper function)
        // For now, we'll do two queries and merge
        let inflectionsQuery = supabase
          .from('v_dashboard_inflections')
          .select('*')
          .limit(parseInt(limit))
          
        if (asOfDate) inflectionsQuery = inflectionsQuery.eq('as_of_date', asOfDate)
        if (universeId) inflectionsQuery = inflectionsQuery.eq('universe_id', universeId)
        if (configId) inflectionsQuery = inflectionsQuery.eq('config_id', configId)
        if (direction) inflectionsQuery = inflectionsQuery.eq('inflection_direction', direction)
        inflectionsQuery = inflectionsQuery.order('abs_inflection', { ascending: false })
        
        const { data: inflections, error: inflectionsError } = await inflectionsQuery
        if (inflectionsError) throw inflectionsError
        
        // Get reviews for these assets
        const assetIds = inflections?.map(i => i.asset_id) || []
        
        if (assetIds.length > 0) {
          let reviewsQuery = supabase
            .from('asset_ai_reviews')
            .select('asset_id, summary_text, attention_level, direction, setup_type, confidence, review_json')
            .in('asset_id', assetIds)
            .like('source_scope', 'inflections_%')
            
          if (asOfDate) reviewsQuery = reviewsQuery.eq('as_of_date', asOfDate)
          
          const { data: reviews, error: reviewsError } = await reviewsQuery
          if (reviewsError) throw reviewsError
          
          // Merge reviews into inflections
          const reviewMap = new Map(reviews?.map(r => [r.asset_id, r]) || [])
          const merged = inflections?.map(i => ({
            ...i,
            ai_summary: reviewMap.get(i.asset_id)?.summary_text || null,
            ai_attention_level: reviewMap.get(i.asset_id)?.attention_level || null,
            ai_direction: reviewMap.get(i.asset_id)?.direction || null,
            ai_setup_type: reviewMap.get(i.asset_id)?.setup_type || null,
            ai_confidence: reviewMap.get(i.asset_id)?.confidence || null,
            ai_review: reviewMap.get(i.asset_id)?.review_json || null,
          }))
          
          return new Response(JSON.stringify(merged), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(inflections), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== HEALTH & DETAIL ENDPOINTS ====================

      // GET /dashboard/health - Get dashboard health/status for UI header
      case req.method === 'GET' && path === '/dashboard/health': {
        // Get latest dates
        const { data: equityDate } = await supabase.rpc('resolve_latest_date', { asset_type_param: 'equity' })
        const { data: cryptoDate } = await supabase.rpc('resolve_latest_date', { asset_type_param: 'crypto' })
        
        // Get eligible asset counts
        const { data: equityCounts } = await supabase
          .from('v_dashboard_base')
          .select('asset_id', { count: 'exact', head: true })
          .eq('asset_type', 'equity')
          .eq('as_of_date', equityDate)
        
        const { data: cryptoCounts } = await supabase
          .from('v_dashboard_base')
          .select('asset_id', { count: 'exact', head: true })
          .eq('asset_type', 'crypto')
          .eq('as_of_date', cryptoDate)
        
        // Get AI review counts for today
        const { data: aiReviewCounts } = await supabase
          .from('asset_ai_reviews')
          .select('scope, attention_level')
          .gte('created_at', new Date().toISOString().split('T')[0])
        
        const reviewsByScope = (aiReviewCounts || []).reduce((acc: Record<string, number>, r: any) => {
          acc[r.scope] = (acc[r.scope] || 0) + 1
          return acc
        }, {})
        
        const urgentCount = (aiReviewCounts || []).filter((r: any) => r.attention_level === 'URGENT').length
        
        return new Response(JSON.stringify({
          latest_dates: {
            equity: equityDate,
            crypto: cryptoDate
          },
          eligible_assets: {
            equity: equityCounts?.length || 0,
            crypto: cryptoCounts?.length || 0
          },
          ai_reviews_today: {
            total: aiReviewCounts?.length || 0,
            urgent: urgentCount,
            by_scope: reviewsByScope
          },
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/asset - Get full detail for one asset (click-through page)
      case req.method === 'GET' && path === '/dashboard/asset': {
        const assetId = url.searchParams.get('asset_id')
        const asOfDate = url.searchParams.get('as_of_date')
        const configId = url.searchParams.get('config_id')
        
        if (!assetId) {
          return new Response(JSON.stringify({ error: 'asset_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset info
        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('*')
          .eq('asset_id', assetId)
          .single()
        
        if (assetError) throw assetError
        
        // Determine date to use
        const targetDate = asOfDate || (asset.asset_type === 'crypto' 
          ? (await supabase.rpc('resolve_latest_date', { asset_type_param: 'crypto' })).data
          : (await supabase.rpc('resolve_latest_date', { asset_type_param: 'equity' })).data)
        
        // Get OHLCV (365 bars)
        const { data: ohlcv } = await supabase
          .from('daily_bars')
          .select('date, open, high, low, close, volume')
          .eq('asset_id', assetId)
          .lte('date', targetDate)
          .order('date', { ascending: false })
          .limit(365)
        
        // Get features snapshot
        const { data: features } = await supabase
          .from('daily_features')
          .select('*')
          .eq('asset_id', assetId)
          .eq('date', targetDate)
          .single()
        
        // Get score row
        let scoreQuery = supabase
          .from('daily_asset_scores')
          .select('*')
          .eq('asset_id', assetId)
          .eq('as_of_date', targetDate)
        
        if (configId) {
          scoreQuery = scoreQuery.eq('config_id', configId)
        }
        
        const { data: scores } = await scoreQuery.limit(1).single()
        
        // Get signal facts
        let signalQuery = supabase
          .from('daily_signal_facts')
          .select('*')
          .eq('asset_id', assetId)
          .eq('date', targetDate)
        
        if (configId) {
          signalQuery = signalQuery.eq('config_id', configId)
        }
        
        const { data: signals } = await signalQuery.order('strength', { ascending: false })
        
        // Get AI review (latest for this asset/date)
        let reviewQuery = supabase
          .from('asset_ai_reviews')
          .select('*')
          .eq('asset_id', assetId)
          .eq('as_of_date', targetDate)
        
        if (configId) {
          reviewQuery = reviewQuery.eq('config_id', configId)
        }
        
        const { data: reviews } = await reviewQuery.order('ai_review_version', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(1)
        const rawReview = reviews?.[0] || null
        
        // Transform review to match frontend expected field names
        const review = rawReview ? {
          ...rawReview,
          // Map ai_ prefixed columns to expected names (with fallbacks for v2/v3 schema differences)
          direction: rawReview.direction || (rawReview.ai_direction_score > 0 ? 'bullish' : rawReview.ai_direction_score < 0 ? 'bearish' : 'neutral'),
          confidence: rawReview.ai_confidence || rawReview.confidence,
          summary_text: rawReview.ai_summary_text || rawReview.summary_text,
          setup_type: rawReview.ai_setup_type || rawReview.setup_type,
          attention_level: rawReview.ai_attention_level || rawReview.attention_level,
          time_horizon: rawReview.ai_time_horizon,
          model_id: rawReview.model,
          key_levels: rawReview.ai_key_levels || rawReview.review_json?.key_levels,
          entry: rawReview.ai_entry,
          targets: rawReview.ai_targets,
          // Extract invalidation from multiple possible locations
          invalidation: rawReview.invalidation || rawReview.ai_key_levels?.invalidation || rawReview.review_json?.key_levels?.invalidation || null,
          why_now: rawReview.ai_why_now,
          risks: rawReview.ai_risks,
          what_to_watch_next: rawReview.ai_what_to_watch_next,
        } : null
        
        return new Response(JSON.stringify({
          asset,
          as_of_date: targetDate,
          ohlcv: ohlcv?.reverse() || [],
          features,
          scores,
          signals: signals || [],
          review,
          review_status: review ? 'ready' : 'missing'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/all-assets - Get ALL assets with scores and AI reviews (paginated)
      // This shows the complete universe, not just triggered assets
      case req.method === 'GET' && path === '/dashboard/all-assets': {
        const limit = url.searchParams.get('limit') || '50'
        const offset = url.searchParams.get('offset') || '0'
        const asOfDate = url.searchParams.get('as_of_date')
        const universeId = url.searchParams.get('universe_id')
        const configId = url.searchParams.get('config_id')
        const sortBy = url.searchParams.get('sort_by') || 'weighted_score'
        const sortOrder = url.searchParams.get('sort_order') || 'desc'
        const search = url.searchParams.get('search') // Optional symbol search
        
        let query = supabase
          .from('v_dashboard_all_assets')
          .select('*', { count: 'exact' })
          .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
          
        if (asOfDate) {
          query = query.eq('as_of_date', asOfDate)
        }
        
        if (universeId) {
          query = query.eq('universe_id', universeId)
        }
        
        if (configId) {
          query = query.eq('config_id', configId)
        }
        
        // Optional search by symbol
        if (search) {
          query = query.ilike('symbol', `%${search}%`)
        }
        
        // Apply sorting
        const ascending = sortOrder === 'asc'
        switch (sortBy) {
          case 'symbol':
            query = query.order('symbol', { ascending })
            break
          case 'score_delta':
            query = query.order('score_delta', { ascending })
            break
          case 'inflection_score':
            query = query.order('inflection_score', { ascending })
            break
          case 'ai_confidence':
            query = query.order('ai_confidence', { ascending, nullsFirst: false })
            break
          case 'ai_setup_quality_score':
            query = query.order('ai_setup_quality_score', { ascending, nullsFirst: false })
            break
          case 'ai_direction_score':
            query = query.order('ai_direction_score', { ascending, nullsFirst: false })
            break
          case 'market_cap':
            query = query.order('market_cap', { ascending, nullsFirst: false })
            break
          case 'close':
            query = query.order('close', { ascending, nullsFirst: false })
            break
          case 'return_1d':
            query = query.order('return_1d', { ascending, nullsFirst: false })
            break
          case 'return_7d':
            query = query.order('return_7d', { ascending, nullsFirst: false })
            break
          case 'return_30d':
            query = query.order('return_30d', { ascending, nullsFirst: false })
            break
          case 'dollar_volume_7d':
            query = query.order('dollar_volume_7d', { ascending, nullsFirst: false })
            break
          case 'vol_mc_ratio':
            // Sort by calculated ratio - we'll handle this in the response
            query = query.order('dollar_volume_7d', { ascending, nullsFirst: false })
            break
          default:
            query = query.order('ai_setup_quality_score', { ascending: false, nullsFirst: false })
            break
        }
        
        const { data, error, count } = await query
        
        if (error) throw error
        
        return new Response(JSON.stringify({
          data: data || [],
          total: count || 0,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/chat - Chat with AI about an asset's analysis
      case req.method === 'POST' && path === '/dashboard/chat': {
        const body = await req.json()
        const { asset_id, as_of_date, message, conversation_history } = body
        
        if (!asset_id || !message) {
          return new Response(JSON.stringify({ error: 'asset_id and message are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset info
        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .select('*')
          .eq('asset_id', asset_id)
          .single()
        
        if (assetError || !asset) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Determine target date
        const targetDate = as_of_date || new Date().toISOString().split('T')[0]
        
        // Get 365 days of OHLCV data
        const { data: ohlcv } = await supabase
          .from('daily_bars')
          .select('date, open, high, low, close, volume')
          .eq('asset_id', asset_id)
          .lte('date', targetDate)
          .order('date', { ascending: false })
          .limit(365)
        
        // Get features/indicators
        const { data: features } = await supabase
          .from('daily_features')
          .select('*')
          .eq('asset_id', asset_id)
          .eq('date', targetDate)
          .single()
        
        // Get signal facts
        const { data: signals } = await supabase
          .from('daily_signal_facts')
          .select('signal_type, direction, strength, evidence')
          .eq('asset_id', asset_id)
          .eq('date', targetDate)
          .order('strength', { ascending: false })
          .limit(10)
        
        // Get AI review if exists
        const { data: reviews } = await supabase
          .from('asset_ai_reviews')
          .select('*')
          .eq('asset_id', asset_id)
          .eq('as_of_date', targetDate)
          .order('created_at', { ascending: false })
          .limit(1)
        
        const review = reviews?.[0] || null
        
        // Get sector/category average performance for comparison
        // First get asset IDs for the same asset type
        const { data: sectorAssets } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('asset_type', asset.asset_type)
          .eq('is_active', true)
          .limit(500)
        
        const sectorAssetIds = sectorAssets?.map(a => a.asset_id) || []
        
        // Then get features for those assets
        const { data: sectorStats } = sectorAssetIds.length > 0 ? await supabase
          .from('daily_features')
          .select('return_1d, return_5d, return_21d, dollar_volume_sma_20')
          .eq('date', targetDate)
          .in('asset_id', sectorAssetIds)
        : { data: null }
        
        // Calculate sector averages
        const sectorAvg = sectorStats && sectorStats.length > 0 ? {
          count: sectorStats.length,
          avg_return_1d: sectorStats.reduce((sum, s) => sum + (s.return_1d || 0), 0) / sectorStats.length,
          avg_return_5d: sectorStats.reduce((sum, s) => sum + (s.return_5d || 0), 0) / sectorStats.length,
          avg_return_21d: sectorStats.reduce((sum, s) => sum + (s.return_21d || 0), 0) / sectorStats.length,
          total_volume: sectorStats.reduce((sum, s) => sum + (s.dollar_volume_sma_20 || 0), 0)
        } : null
        
        // Build context for the LLM
        const context = {
          asset: {
            symbol: asset.symbol,
            name: asset.name,
            asset_type: asset.asset_type
          },
          as_of_date: targetDate,
          ohlcv: ohlcv?.reverse().map(b => ({
            date: b.date,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume
          })) || [],
          // Computed OHLCV summary stats
          ohlcv_summary: ohlcv && ohlcv.length > 0 ? (() => {
            const bars = ohlcv.slice().reverse() // chronological order
            const closes = bars.map(b => b.close)
            const volumes = bars.map(b => b.volume)
            const highs = bars.map(b => b.high)
            const lows = bars.map(b => b.low)
            
            // Price stats
            const currentClose = closes[closes.length - 1]
            const high52w = Math.max(...highs)
            const low52w = Math.min(...lows)
            const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length
            
            // Volume stats
            const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length
            const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
            const volumeSpike = recentVolume / avgVolume
            const maxVolume = Math.max(...volumes)
            const maxVolumeDate = bars[volumes.indexOf(maxVolume)]?.date
            
            // Volatility - Average True Range approximation
            const ranges = bars.map(b => b.high - b.low)
            const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length
            const recentRange = ranges.slice(-5).reduce((a, b) => a + b, 0) / 5
            const rangeExpansion = recentRange / avgRange
            
            // Returns at different periods
            const return7d = closes.length >= 7 ? (currentClose - closes[closes.length - 7]) / closes[closes.length - 7] : null
            const return30d = closes.length >= 30 ? (currentClose - closes[closes.length - 30]) / closes[closes.length - 30] : null
            const return90d = closes.length >= 90 ? (currentClose - closes[closes.length - 90]) / closes[closes.length - 90] : null
            const return365d = closes.length >= 365 ? (currentClose - closes[0]) / closes[0] : null
            
            return {
              bars_available: bars.length,
              current_close: currentClose,
              high_52w: high52w,
              low_52w: low52w,
              pct_from_high: ((currentClose - high52w) / high52w) * 100,
              pct_from_low: ((currentClose - low52w) / low52w) * 100,
              avg_close_365d: avgClose,
              // Volume
              avg_volume_365d: avgVolume,
              recent_volume_5d: recentVolume,
              volume_spike_ratio: volumeSpike,
              max_volume: maxVolume,
              max_volume_date: maxVolumeDate,
              // Volatility
              avg_daily_range: avgRange,
              recent_daily_range_5d: recentRange,
              range_expansion_ratio: rangeExpansion,
              avg_range_pct: (avgRange / avgClose) * 100,
              // Returns
              return_7d_pct: return7d ? return7d * 100 : null,
              return_30d_pct: return30d ? return30d * 100 : null,
              return_90d_pct: return90d ? return90d * 100 : null,
              return_365d_pct: return365d ? return365d * 100 : null
            }
          })() : null,
          // Sector comparison
          sector_comparison: sectorAvg ? {
            asset_type: asset.asset_type,
            assets_in_sector: sectorAvg.count,
            sector_avg_return_1d: sectorAvg.avg_return_1d * 100,
            sector_avg_return_5d: sectorAvg.avg_return_5d * 100,
            sector_avg_return_21d: sectorAvg.avg_return_21d * 100,
            asset_vs_sector_1d: features ? (features.return_1d - sectorAvg.avg_return_1d) * 100 : null,
            asset_vs_sector_5d: features ? (features.return_5d - sectorAvg.avg_return_5d) * 100 : null,
            outperforming_1d: features ? features.return_1d > sectorAvg.avg_return_1d : null
          } : null,
          features: features ? {
            trend_regime: features.trend_regime,
            rsi_14: features.rsi_14,
            macd_histogram: features.macd_histogram,
            bb_width: features.bb_width,
            squeeze_on: features.squeeze_on,
            ma_dist_20: features.ma_dist_20,
            ma_dist_50: features.ma_dist_50,
            ma_dist_200: features.ma_dist_200,
            dist_52w_high: features.dist_52w_high,
            dist_52w_low: features.dist_52w_low,
            rvol_20: features.rvol_20,
            roc_20: features.roc_20,
            roc_63: features.roc_63
          } : {},
          signals: signals || [],
          ai_review: review ? {
            // Core analysis
            attention_level: review.ai_attention_level || review.attention_level,
            direction: review.direction,
            direction_score: review.ai_direction_score,
            setup_type: review.ai_setup_type || review.setup_type,
            setup_quality_score: review.ai_setup_quality_score,
            time_horizon: review.ai_time_horizon,
            confidence: review.ai_confidence || review.confidence,
            summary: review.ai_summary_text || review.summary_text,
            // Trade plan
            entry_zone: review.ai_entry || review.entry,
            targets: review.ai_targets || review.targets,
            key_levels: review.ai_key_levels,
            invalidation: review.ai_key_levels?.invalidation || review.invalidation,
            // Context
            why_now: review.ai_why_now,
            risks: review.ai_risks,
            what_to_watch_next: review.ai_what_to_watch_next,
            // Subscores breakdown
            subscores: review.subscores,
            // Model info
            model: review.model,
            review_version: review.ai_review_version
          } : null
        }
        
        // Build the system prompt
        const systemPrompt = `You are a technical analysis assistant for Stratos Brain, a trading signal platform.
You have access to the following data for ${asset.symbol} (${asset.name}) as of ${targetDate}:

## Price Summary (${context.ohlcv_summary?.bars_available || 0} days of data)
${context.ohlcv_summary ? `
Current Price: $${context.ohlcv_summary.current_close?.toFixed(2)}
52-Week High: $${context.ohlcv_summary.high_52w?.toFixed(2)} (${context.ohlcv_summary.pct_from_high?.toFixed(1)}% from high)
52-Week Low: $${context.ohlcv_summary.low_52w?.toFixed(2)} (+${context.ohlcv_summary.pct_from_low?.toFixed(1)}% from low)

Returns:
- 7 days: ${context.ohlcv_summary.return_7d_pct?.toFixed(1)}%
- 30 days: ${context.ohlcv_summary.return_30d_pct?.toFixed(1)}%
- 90 days: ${context.ohlcv_summary.return_90d_pct?.toFixed(1)}%
- 365 days: ${context.ohlcv_summary.return_365d_pct?.toFixed(1) || 'N/A'}%
` : 'No price data available'}

## Volume Analysis
${context.ohlcv_summary ? `
Average Daily Volume (365d): ${context.ohlcv_summary.avg_volume_365d?.toLocaleString()}
Recent Volume (5d avg): ${context.ohlcv_summary.recent_volume_5d?.toLocaleString()}
Volume Spike Ratio: ${context.ohlcv_summary.volume_spike_ratio?.toFixed(2)}x average
Max Volume: ${context.ohlcv_summary.max_volume?.toLocaleString()} on ${context.ohlcv_summary.max_volume_date}
` : 'No volume data available'}

## Volatility Analysis
${context.ohlcv_summary ? `
Average Daily Range: $${context.ohlcv_summary.avg_daily_range?.toFixed(4)} (${context.ohlcv_summary.avg_range_pct?.toFixed(2)}% of price)
Recent Daily Range (5d): $${context.ohlcv_summary.recent_daily_range_5d?.toFixed(4)}
Range Expansion: ${context.ohlcv_summary.range_expansion_ratio?.toFixed(2)}x average ${context.ohlcv_summary.range_expansion_ratio > 1.5 ? '(ELEVATED VOLATILITY)' : context.ohlcv_summary.range_expansion_ratio < 0.7 ? '(COMPRESSED)' : '(NORMAL)'}
` : 'No volatility data available'}

## ${asset.asset_type === 'crypto' ? 'Crypto' : 'Equity'} Sector Comparison
${context.sector_comparison ? `
Comparing to ${context.sector_comparison.assets_in_sector} ${context.sector_comparison.asset_type} assets:
- Sector avg 1d return: ${context.sector_comparison.sector_avg_return_1d?.toFixed(2)}%
- Sector avg 5d return: ${context.sector_comparison.sector_avg_return_5d?.toFixed(2)}%
- Sector avg 21d return: ${context.sector_comparison.sector_avg_return_21d?.toFixed(2)}%
- ${asset.symbol} vs sector (1d): ${context.sector_comparison.asset_vs_sector_1d > 0 ? '+' : ''}${context.sector_comparison.asset_vs_sector_1d?.toFixed(2)}% ${context.sector_comparison.outperforming_1d ? '(OUTPERFORMING)' : '(UNDERPERFORMING)'}
- ${asset.symbol} vs sector (5d): ${context.sector_comparison.asset_vs_sector_5d > 0 ? '+' : ''}${context.sector_comparison.asset_vs_sector_5d?.toFixed(2)}%
` : 'No sector data available'}

## Recent OHLCV (Last 30 bars)
${JSON.stringify(context.ohlcv.slice(-30), null, 2)}

## Current Technical Indicators
${JSON.stringify(context.features, null, 2)}

## Active Signals
${JSON.stringify(context.signals, null, 2)}

## AI Analysis Summary
${context.ai_review ? `
Attention Level: ${context.ai_review.attention_level}
Direction: ${context.ai_review.direction} (score: ${context.ai_review.direction_score})
Setup Type: ${context.ai_review.setup_type} (quality score: ${context.ai_review.setup_quality_score})
Time Horizon: ${context.ai_review.time_horizon || 'Not specified'}
Confidence: ${(context.ai_review.confidence * 100).toFixed(0)}%

Summary: ${context.ai_review.summary}

Trade Plan:
- Entry Zone: $${context.ai_review.entry_zone?.low || 'N/A'} - $${context.ai_review.entry_zone?.high || 'N/A'}
- Targets: ${JSON.stringify(context.ai_review.targets)}
- Invalidation: $${context.ai_review.invalidation || 'N/A'}
- Key Levels: ${JSON.stringify(context.ai_review.key_levels)}

Why Now: ${JSON.stringify(context.ai_review.why_now)}
Risks: ${JSON.stringify(context.ai_review.risks)}
What to Watch: ${JSON.stringify(context.ai_review.what_to_watch_next)}

Subscores: ${JSON.stringify(context.ai_review.subscores)}
Model: ${context.ai_review.model} (v${context.ai_review.review_version})
` : 'No AI review available'}

You can reference any of this data to answer questions about:
- Price action and chart patterns
- Support/resistance levels
- Entry/exit strategies
- Risk management
- Signal interpretation
- Technical indicator readings

Be concise but thorough. Reference specific price levels and data points when relevant.
If asked about something not in the data, acknowledge the limitation.`

        // Build conversation messages
        const messages = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: `I understand. I have access to 365 days of OHLCV data, technical indicators, active signals, and the AI analysis for ${asset.symbol}. How can I help you analyze this asset?` }] }
        ]
        
        // Add conversation history if provided
        if (conversation_history && Array.isArray(conversation_history)) {
          for (const msg of conversation_history) {
            messages.push({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.content }]
            })
          }
        }
        
        // Add current message
        messages.push({ role: 'user', parts: [{ text: message }] })
        
        // Call Gemini API
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyAHg70im-BbB9HYZm7TOzr3cKRQp7RWY1Q'
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: messages,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000
              }
            })
          }
        )
        
        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text()
          console.error('Gemini API error:', errorText)
          return new Response(JSON.stringify({ error: 'AI service error', details: errorText }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const geminiData = await geminiResponse.json()
        const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated'
        
        return new Response(JSON.stringify({
          response: aiResponse,
          context_summary: {
            symbol: asset.symbol,
            as_of_date: targetDate,
            ohlcv_bars: context.ohlcv.length,
            signals_count: context.signals.length,
            has_ai_review: !!context.ai_review
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/notes/:asset_id - Get notes for an asset
      case req.method === 'GET' && /^\/dashboard\/notes\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop() || '0')
        
        if (!assetId) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get all notes for this asset, ordered by most recent first
        const { data: notes, error: notesError } = await supabase
          .from('asset_notes')
          .select('note_id, note_text, created_at, updated_at')
          .eq('asset_id', assetId)
          .order('updated_at', { ascending: false })
        
        if (notesError) {
          return new Response(JSON.stringify({ error: notesError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({
          asset_id: assetId,
          notes: notes || [],
          latest: notes?.[0] || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/notes - Create a new note for an asset
      case req.method === 'POST' && path === '/dashboard/notes': {
        const body = await req.json()
        const { asset_id, note_text } = body
        
        if (!asset_id || !note_text?.trim()) {
          return new Response(JSON.stringify({ error: 'asset_id and note_text are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data: note, error: insertError } = await supabase
          .from('asset_notes')
          .insert({
            asset_id,
            note_text: note_text.trim()
          })
          .select()
          .single()
        
        if (insertError) {
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(note), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /dashboard/notes/:note_id - Update a note
      case req.method === 'PUT' && /^\/dashboard\/notes\/\d+$/.test(path): {
        const noteId = parseInt(path.split('/').pop() || '0')
        const body = await req.json()
        const { note_text } = body
        
        if (!noteId || !note_text?.trim()) {
          return new Response(JSON.stringify({ error: 'note_id and note_text are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data: note, error: updateError } = await supabase
          .from('asset_notes')
          .update({
            note_text: note_text.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('note_id', noteId)
          .select()
          .single()
        
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(note), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/notes/:note_id - Delete a note
      case req.method === 'DELETE' && /^\/dashboard\/notes\/\d+$/.test(path): {
        const noteId = parseInt(path.split('/').pop() || '0')
        
        if (!noteId) {
          return new Response(JSON.stringify({ error: 'note_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { error: deleteError } = await supabase
          .from('asset_notes')
          .delete()
          .eq('note_id', noteId)
        
        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/files/:asset_id - Get files for an asset
      case req.method === 'GET' && /^\/dashboard\/files\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop() || '0')
        
        if (!assetId) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get all files for this asset
        const { data: files, error: filesError } = await supabase
          .from('asset_files')
          .select('file_id, file_name, file_path, file_size, file_type, description, created_at')
          .eq('asset_id', assetId)
          .order('created_at', { ascending: false })
        
        if (filesError) {
          return new Response(JSON.stringify({ error: filesError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({ asset_id: assetId, files: files || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/files - Upload a file for an asset
      case req.method === 'POST' && path === '/dashboard/files': {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const assetId = parseInt(formData.get('asset_id') as string)
        const description = formData.get('description') as string || ''
        
        if (!file || !assetId) {
          return new Response(JSON.stringify({ error: 'file and asset_id are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Generate unique file path
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `assets/${assetId}/${timestamp}_${safeName}`
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('asset-files')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          })
        
        if (uploadError) {
          return new Response(JSON.stringify({ error: uploadError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('asset-files')
          .getPublicUrl(filePath)
        
        // Save file metadata to database
        const { data: fileRecord, error: dbError } = await supabase
          .from('asset_files')
          .insert({
            asset_id: assetId,
            file_name: file.name,
            file_path: urlData.publicUrl,
            file_size: file.size,
            file_type: file.type,
            description: description
          })
          .select()
          .single()
        
        if (dbError) {
          // Try to delete the uploaded file if DB insert fails
          await supabase.storage.from('asset-files').remove([filePath])
          return new Response(JSON.stringify({ error: dbError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(fileRecord), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/files/:file_id - Delete a file
      case req.method === 'DELETE' && /^\/dashboard\/files\/\d+$/.test(path): {
        const fileId = parseInt(path.split('/').pop() || '0')
        
        if (!fileId) {
          return new Response(JSON.stringify({ error: 'file_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get file info first
        const { data: fileInfo, error: fetchError } = await supabase
          .from('asset_files')
          .select('file_path')
          .eq('file_id', fileId)
          .single()
        
        if (fetchError || !fileInfo) {
          return new Response(JSON.stringify({ error: 'File not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Extract storage path from URL and delete from storage
        const urlParts = fileInfo.file_path.split('/asset-files/')
        if (urlParts.length > 1) {
          const storagePath = urlParts[1]
          await supabase.storage.from('asset-files').remove([storagePath])
        }
        
        // Delete from database
        const { error: deleteError } = await supabase
          .from('asset_files')
          .delete()
          .eq('file_id', fileId)
        
        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/watchlist - Get all watchlist items
      case req.method === 'GET' && path === '/dashboard/watchlist': {
        const { data: watchlist, error } = await supabase
          .from('watchlist')
          .select('asset_id, created_at')
          .order('created_at', { ascending: false })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(watchlist || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/watchlist - Add asset to watchlist
      case req.method === 'POST' && path === '/dashboard/watchlist': {
        const body = await req.json()
        const { asset_id } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('watchlist')
          .insert({ asset_id })
          .select()
          .single()
        
        if (error) {
          // If already exists, return success
          if (error.code === '23505') {
            return new Response(JSON.stringify({ success: true, already_exists: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/watchlist/:asset_id - Remove asset from watchlist
      case req.method === 'DELETE' && /^\/dashboard\/watchlist\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('asset_id', assetId)
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/watchlist/assets - Get watchlist with full asset data
      case req.method === 'GET' && path === '/dashboard/watchlist/assets': {
        // Get watchlist asset IDs
        const { data: watchlistItems, error: watchlistError } = await supabase
          .from('watchlist')
          .select('asset_id')
        
        if (watchlistError) {
          return new Response(JSON.stringify({ error: watchlistError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        if (!watchlistItems || watchlistItems.length === 0) {
          return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetIds = watchlistItems.map(w => w.asset_id)
        
        // Get the latest dates for each asset type
        const { data: latestDates } = await supabase
          .from('latest_dates')
          .select('asset_type, latest_date')
        
        const dateMap: Record<string, string> = {}
        latestDates?.forEach(d => { dateMap[d.asset_type] = d.latest_date })
        
        // Get assets with their features and AI reviews
        const { data: assets, error: assetsError } = await supabase
          .from('assets')
          .select('asset_id, symbol, name, asset_type, sector')
          .in('asset_id', assetIds)
        
        if (assetsError || !assets) {
          return new Response(JSON.stringify({ error: assetsError?.message || 'Failed to fetch assets' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Enrich with features and AI reviews
        const enrichedAssets = await Promise.all(assets.map(async (asset) => {
          const targetDate = dateMap[asset.asset_type] || new Date().toISOString().split('T')[0]
          
          const [featuresResult, reviewResult] = await Promise.all([
            supabase
              .from('daily_features')
              .select('close, return_1d, return_5d, return_21d, rsi_14, dollar_volume')
              .eq('asset_id', asset.asset_id)
              .eq('date', targetDate)
              .single(),
            supabase
              .from('asset_ai_reviews')
              .select('direction, ai_direction_score, ai_setup_quality_score, attention_level, confidence')
              .eq('asset_id', asset.asset_id)
              .eq('as_of_date', targetDate)
              .single()
          ])
          
          return {
            ...asset,
            as_of_date: targetDate,
            close: featuresResult.data?.close,
            return_1d: featuresResult.data?.return_1d,
            return_5d: featuresResult.data?.return_5d,
            return_21d: featuresResult.data?.return_21d,
            rsi_14: featuresResult.data?.rsi_14,
            dollar_volume: featuresResult.data?.dollar_volume,
            direction: reviewResult.data?.direction,
            ai_direction_score: reviewResult.data?.ai_direction_score,
            ai_setup_quality_score: reviewResult.data?.ai_setup_quality_score,
            attention_level: reviewResult.data?.attention_level,
            confidence: reviewResult.data?.confidence,
            in_watchlist: true
          }
        }))
        
        return new Response(JSON.stringify(enrichedAssets), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== END DASHBOARD ENDPOINTS ====================

      default:
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

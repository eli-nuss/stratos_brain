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
          // Map ai_ prefixed columns to expected names
          direction: rawReview.ai_direction_score > 0 ? 'bullish' : rawReview.ai_direction_score < 0 ? 'bearish' : 'neutral',
          confidence: rawReview.ai_confidence,
          summary_text: rawReview.ai_summary_text,
          setup_type: rawReview.ai_setup_type,
          attention_level: rawReview.ai_attention_level,
          time_horizon: rawReview.ai_time_horizon,
          model_id: rawReview.model,
          key_levels: rawReview.ai_key_levels,
          entry: rawReview.ai_entry,
          targets: rawReview.ai_targets,
          // Extract invalidation from ai_key_levels if not set at top level
          invalidation: rawReview.invalidation || rawReview.ai_key_levels?.invalidation || null,
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

## OHLCV Data (365 days)
${JSON.stringify(context.ohlcv.slice(-30), null, 2)}
... (${context.ohlcv.length} total bars available)

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

// NEW ENDPOINT TO ADD TO control-api/index.ts
// Add this case block before the default case (around line 735)

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
          default:
            query = query.order('weighted_score', { ascending })
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

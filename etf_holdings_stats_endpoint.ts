// New endpoint to add to control-api/index.ts
// GET /dashboard/etf-holdings-stats/:symbol - Get aggregated stats for ETF holdings

      // GET /dashboard/etf-holdings-stats/:symbol - Get aggregated stats for ETF holdings
      case req.method === 'GET' && path.startsWith('/dashboard/etf-holdings-stats/'): {
        const symbol = path.replace('/dashboard/etf-holdings-stats/', '').toUpperCase()
        
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'Symbol is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get ETF ID from symbol
        const { data: etfData, error: etfError } = await supabase
          .from('etf_assets')
          .select('etf_id')
          .eq('symbol', symbol)
          .single()
        
        if (etfError || !etfData) {
          return new Response(JSON.stringify({ error: 'ETF not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get holdings with linked asset_ids
        const { data: holdings, error: holdingsError } = await supabase
          .from('etf_holdings')
          .select('asset_id, weight_percent, market_value')
          .eq('etf_id', etfData.etf_id)
          .not('asset_id', 'is', null)
        
        if (holdingsError) {
          console.error('Holdings query error:', holdingsError)
          throw holdingsError
        }
        
        const linkedAssetIds = (holdings || [])
          .filter(h => h.asset_id)
          .map(h => h.asset_id)
        
        if (linkedAssetIds.length === 0) {
          return new Response(JSON.stringify({
            symbol,
            stats: null,
            message: 'No linked holdings with fundamental data'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get fundamentals for linked holdings
        const { data: fundamentals, error: fundError } = await supabase
          .from('v_equity_fundamentals')
          .select('asset_id, pe_ratio, pe_ratio_live, price_to_sales_ttm, quarterly_revenue_growth_yoy, market_cap, dividend_yield')
          .in('asset_id', linkedAssetIds)
        
        // Get latest daily features (returns) for linked holdings
        const { data: features, error: featError } = await supabase
          .rpc('get_latest_features_for_assets', { asset_ids: linkedAssetIds })
        
        // Build weight map from holdings
        const weightMap: Record<number, number> = {}
        holdings?.forEach(h => {
          if (h.asset_id && h.weight_percent) {
            weightMap[h.asset_id] = h.weight_percent
          }
        })
        
        // Calculate aggregated stats
        const stats = {
          // Valuation metrics
          pe_ratio: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          ps_ratio: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          dividend_yield: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          
          // Growth metrics
          revenue_growth_yoy: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          
          // Performance metrics
          return_1d: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          return_5d: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          return_21d: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          return_63d: { weighted_avg: null as number | null, median: null as number | null, count: 0 },
          
          // Coverage
          holdings_with_fundamentals: 0,
          holdings_with_features: 0,
          total_linked_holdings: linkedAssetIds.length
        }
        
        // Helper functions
        const calculateWeightedAvg = (values: { value: number; weight: number }[]): number | null => {
          if (values.length === 0) return null
          const totalWeight = values.reduce((sum, v) => sum + v.weight, 0)
          if (totalWeight === 0) return null
          return values.reduce((sum, v) => sum + (v.value * v.weight), 0) / totalWeight
        }
        
        const calculateMedian = (values: number[]): number | null => {
          if (values.length === 0) return null
          const sorted = [...values].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        }
        
        // Process fundamentals
        if (fundamentals && fundamentals.length > 0) {
          stats.holdings_with_fundamentals = fundamentals.length
          
          // P/E ratios
          const peValues = fundamentals
            .filter(f => f.pe_ratio_live && f.pe_ratio_live > 0 && f.pe_ratio_live < 1000)
            .map(f => ({ value: f.pe_ratio_live, weight: weightMap[f.asset_id] || 1 }))
          stats.pe_ratio.weighted_avg = calculateWeightedAvg(peValues)
          stats.pe_ratio.median = calculateMedian(peValues.map(v => v.value))
          stats.pe_ratio.count = peValues.length
          
          // P/S ratios
          const psValues = fundamentals
            .filter(f => f.price_to_sales_ttm && f.price_to_sales_ttm > 0 && f.price_to_sales_ttm < 1000)
            .map(f => ({ value: f.price_to_sales_ttm, weight: weightMap[f.asset_id] || 1 }))
          stats.ps_ratio.weighted_avg = calculateWeightedAvg(psValues)
          stats.ps_ratio.median = calculateMedian(psValues.map(v => v.value))
          stats.ps_ratio.count = psValues.length
          
          // Dividend yield
          const divValues = fundamentals
            .filter(f => f.dividend_yield && f.dividend_yield >= 0)
            .map(f => ({ value: f.dividend_yield, weight: weightMap[f.asset_id] || 1 }))
          stats.dividend_yield.weighted_avg = calculateWeightedAvg(divValues)
          stats.dividend_yield.median = calculateMedian(divValues.map(v => v.value))
          stats.dividend_yield.count = divValues.length
          
          // Revenue growth YoY
          const revGrowthValues = fundamentals
            .filter(f => f.quarterly_revenue_growth_yoy !== null)
            .map(f => ({ value: f.quarterly_revenue_growth_yoy * 100, weight: weightMap[f.asset_id] || 1 }))
          stats.revenue_growth_yoy.weighted_avg = calculateWeightedAvg(revGrowthValues)
          stats.revenue_growth_yoy.median = calculateMedian(revGrowthValues.map(v => v.value))
          stats.revenue_growth_yoy.count = revGrowthValues.length
        }
        
        // Process features (returns)
        if (features && features.length > 0) {
          stats.holdings_with_features = features.length
          
          const processReturn = (field: string) => {
            const values = features
              .filter((f: any) => f[field] !== null)
              .map((f: any) => ({ value: f[field] * 100, weight: weightMap[f.asset_id] || 1 }))
            return {
              weighted_avg: calculateWeightedAvg(values),
              median: calculateMedian(values.map(v => v.value)),
              count: values.length
            }
          }
          
          const r1d = processReturn('return_1d')
          stats.return_1d = r1d
          
          const r5d = processReturn('return_5d')
          stats.return_5d = r5d
          
          const r21d = processReturn('return_21d')
          stats.return_21d = r21d
          
          const r63d = processReturn('return_63d')
          stats.return_63d = r63d
        }
        
        return new Response(JSON.stringify({
          symbol,
          stats
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

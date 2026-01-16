// Supabase Edge Function: Signal Engine Control API
// Provides REST endpoints for managing the signal engine from the dashboard
// v12: Added /dashboard/financials endpoint for historical financial data
// 
// Authentication Options:
// 1. JWT (Supabase Auth): Authorization: Bearer <user_jwt>
// 2. API Key (scripts/n8n): x-stratos-key: <STRATOS_BRAIN_API_KEY>
// 3. Supabase Anon Key: apikey: <SUPABASE_ANON_KEY> (for browser clients)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { MEMO_TEMPLATE, ONE_PAGER_TEMPLATE, SYSTEM_PROMPT, formatDatabaseContext, AssetData } from "./gemini-templates.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Simple markdown to HTML converter
function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    .replace(/^\*\*\*$/gm, '<hr>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[hlopub]|<li|<hr|<blockquote)(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    // Wrap consecutive li elements in ul
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  
  return html
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
  
  // Allow public access to research-notes endpoints (all methods)
  if (path.startsWith('/dashboard/research-notes')) {
    return true
  }
  
  // Allow public access to watchlist endpoints (all methods)
  if (path.startsWith('/dashboard/watchlist')) {
    return true
  }
  
  // Allow public access to stock-lists endpoints (all methods)
  if (path.startsWith('/dashboard/stock-lists')) {
    return true
  }
  
  // Allow public access to reviewed endpoints (all methods)
  if (path.startsWith('/dashboard/reviewed')) {
    return true
  }
  
  // Allow public access to asset-tags endpoints (all methods)
  if (path.startsWith('/dashboard/asset-tags')) {
    return true
  }
  
  // Allow public access to create-document endpoint
  if (req.method === 'POST' && path === '/dashboard/create-document') {
    return true
  }
  
  // Allow public access to templates endpoints (all methods)
  if (path.startsWith('/dashboard/templates')) {
    return true
  }
  
  // Allow public access to chat-config endpoints (all methods)
  if (path.startsWith('/dashboard/chat-config')) {
    return true
  }
  
  // Allow public access to model-portfolio endpoints (all methods)
  if (path.startsWith('/dashboard/model-portfolio')) {
    return true
  }
  
  // Allow public access to core-portfolio endpoints (all methods)
  if (path.startsWith('/dashboard/core-portfolio')) {
    return true
  }
  
  // Allow public access to core-portfolio-holdings endpoints (all methods)
  if (path.startsWith('/dashboard/core-portfolio-holdings')) {
    return true
  }
  
  // Allow public access to model-portfolio-holdings endpoints (all methods)
  if (path.startsWith('/dashboard/model-portfolio-holdings')) {
    return true
  }
  
  // NOTE: memo-status endpoints removed - Gemini generation is synchronous
  
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

      // GET /dashboard/memos - Get all Gemini-generated investment memos from asset_files
      case req.method === 'GET' && path === '/dashboard/memos': {
        const limit = parseInt(url.searchParams.get('limit') || '500')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const search = url.searchParams.get('search')
        const docType = url.searchParams.get('type') || 'memo' // 'memo' or 'one_pager' or 'all'
        
        // Get generated documents from asset_files table with embedded asset info
        let query = supabase
          .from('asset_files')
          .select(`
            file_id,
            asset_id,
            file_name,
            file_path,
            file_size,
            file_type,
            description,
            created_at,
            assets!inner(symbol, name, asset_type, sector)
          `)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
        
        // Filter by document type
        if (docType === 'memo') {
          query = query.eq('file_type', 'memo')
        } else if (docType === 'one_pager') {
          query = query.eq('file_type', 'one_pager')
        } else {
          // 'all' - get both memos and one-pagers
          query = query.in('file_type', ['memo', 'one_pager'])
        }
        
        const { data: files, error } = await query
        
        if (error) {
          console.error('Memos query error:', error)
          throw error
        }
        
        // Flatten the nested asset info
        const memos = await Promise.all((files || []).map(async (f) => {
          const asset = f.assets as { symbol?: string; name?: string; asset_type?: string; sector?: string } | null
          
          // Basic memo object
          const memo: any = {
            file_id: f.file_id,
            asset_id: f.asset_id,
            file_name: f.file_name,
            file_path: f.file_path,
            file_size: f.file_size,
            file_type: f.file_type,
            description: f.description,
            created_at: f.created_at,
            symbol: asset?.symbol || `Asset ${f.asset_id}`,
            name: asset?.name || '',
            asset_type: asset?.asset_type || '',
            sector: asset?.sector || ''
          }

          // Try to extract metadata from markdown content
          try {
            const mdResponse = await fetch(f.file_path)
            if (mdResponse.ok) {
              const markdown = await mdResponse.text()
              
              // Extract Recommendation/Sentiment
              const recMatch = markdown.match(/Recommendation:\s*\[?(Long|Short|Watch|Bullish|Bearish|Neutral)\]?/i)
              if (recMatch) {
                const rec = recMatch[1].toLowerCase()
                if (rec === 'long' || rec === 'bullish') memo.sentiment = 'BULLISH'
                else if (rec === 'short' || rec === 'bearish') memo.sentiment = 'BEARISH'
                else memo.sentiment = 'NEUTRAL'
              }

              // Extract Conviction/Score
              const convictionMatch = markdown.match(/Conviction:\s*\[?(High|Medium|Low)\]?/i)
              if (convictionMatch) {
                const conv = convictionMatch[1].toLowerCase()
                if (conv === 'high') memo.score = 85
                else if (conv === 'medium') memo.score = 65
                else memo.score = 45
              }

              // Extract Thesis Hook
              const thesisMatch = markdown.match(/The Thesis in 2 Sentences:\s*\[?([^\]\n]+)\]?/i) || 
                                 markdown.match(/The Hook:\s*\[?([^\]\n]+)\]?/i)
              if (thesisMatch) {
                memo.thesis = thesisMatch[1].trim()
              }
            }
          } catch (e) {
            console.error(`Error parsing memo ${f.file_id}:`, e)
          }

          // Calculate Performance Since
          try {
            const memoDate = new Date(f.created_at).toISOString().split('T')[0]
            
            // Get price at creation
            const { data: startPriceData } = await supabase
              .from('daily_bars')
              .select('close')
              .eq('asset_id', f.asset_id)
              .lte('date', memoDate)
              .order('date', { ascending: false })
              .limit(1)
              .single()
            
            // Get current price
            const { data: currentPriceData } = await supabase
              .from('daily_bars')
              .select('close')
              .eq('asset_id', f.asset_id)
              .order('date', { ascending: false })
              .limit(1)
              .single()
            
            if (startPriceData && currentPriceData) {
              const startPrice = parseFloat(startPriceData.close)
              const currentPrice = parseFloat(currentPriceData.close)
              memo.performance_since = ((currentPrice - startPrice) / startPrice) * 100
            }
          } catch (e) {
            console.error(`Error calculating performance for memo ${f.file_id}:`, e)
          }

          // Get stock lists this asset belongs to
          try {
            const { data: listData } = await supabase
              .from('stock_list_items')
              .select('stock_lists(id, name)')
              .eq('asset_id', f.asset_id)
            
            if (listData && listData.length > 0) {
              memo.stock_lists = listData
                .map((item: any) => item.stock_lists)
                .filter((list: any) => list !== null)
                .map((list: any) => ({ id: list.id, name: list.name }))
            } else {
              memo.stock_lists = []
            }
          } catch (e) {
            console.error(`Error fetching stock lists for memo ${f.file_id}:`, e)
            memo.stock_lists = []
          }

          return memo
        }))
        
        // Filter by search if provided
        let filteredMemos = memos
        if (search) {
          const searchLower = search.toLowerCase()
          filteredMemos = memos.filter(m => 
            m.symbol?.toLowerCase().includes(searchLower) ||
            m.name?.toLowerCase().includes(searchLower) ||
            m.file_name?.toLowerCase().includes(searchLower)
          )
        }
        
        return new Response(JSON.stringify(filteredMemos), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/memo-pdf/:file_id - Generate PDF from memo markdown
      case req.method === 'GET' && path.startsWith('/dashboard/memo-pdf/'): {
        const fileId = parseInt(path.split('/')[3])
        
        if (!fileId) {
          return new Response(JSON.stringify({ error: 'File ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get the file info
        const { data: file, error: fileError } = await supabase
          .from('asset_files')
          .select('file_id, asset_id, file_name, file_path, file_type')
          .eq('file_id', fileId)
          .single()
        
        if (fileError || !file) {
          return new Response(JSON.stringify({ error: 'File not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Fetch the markdown content from storage
        const mdResponse = await fetch(file.file_path)
        if (!mdResponse.ok) {
          return new Response(JSON.stringify({ error: 'Failed to fetch markdown' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        const markdown = await mdResponse.text()
        
        // Convert markdown to styled HTML
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${file.file_name.replace('.md', '')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fff;
    }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #e5e5e5; }
    h2 { font-size: 22px; font-weight: 600; margin-top: 32px; margin-bottom: 16px; color: #333; }
    h3 { font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 12px; color: #444; }
    p { margin-bottom: 16px; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    ul, ol { margin-left: 24px; margin-bottom: 16px; }
    li { margin-bottom: 8px; }
    blockquote { border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #666; font-style: italic; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px; }
    pre { background: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; }
    pre code { background: none; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #e5e5e5; padding: 12px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 32px 0; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>`
        
        // Return HTML that can be printed to PDF
        return new Response(htmlContent, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/html; charset=utf-8'
          }
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
      // Supports lookup by asset_id OR symbol (symbol takes precedence if both provided)
      case req.method === 'GET' && path === '/dashboard/asset': {
        const assetIdParam = url.searchParams.get('asset_id')
        const symbolParam = url.searchParams.get('symbol')
        const assetTypeParam = url.searchParams.get('asset_type')
        const asOfDate = url.searchParams.get('as_of_date')
        const configId = url.searchParams.get('config_id')
        
        if (!assetIdParam && !symbolParam) {
          return new Response(JSON.stringify({ error: 'asset_id or symbol required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset info - lookup by symbol if provided, otherwise by asset_id
        // When looking up by symbol, asset_type can be used to disambiguate (e.g., COMP is both Compass equity and Compound crypto)
        let assetQuery = supabase.from('assets').select('*')
        
        if (symbolParam) {
          assetQuery = assetQuery.ilike('symbol', symbolParam)
          // If asset_type is provided, use it to disambiguate duplicate symbols
          if (assetTypeParam) {
            assetQuery = assetQuery.eq('asset_type', assetTypeParam)
          }
        } else {
          assetQuery = assetQuery.eq('asset_id', assetIdParam)
        }
        
        const { data: assetResult, error: assetError } = await assetQuery.limit(1).single()
        
        if (assetError || !assetResult) {
          const notFoundMsg = symbolParam ? `Asset not found for symbol: ${symbolParam}` : `Asset not found for id: ${assetIdParam}`
          return new Response(JSON.stringify({ error: notFoundMsg }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const asset = assetResult
        const assetId = asset.asset_id
        
        // Determine date to use
        const targetDate = asOfDate || (asset.asset_type === 'crypto' 
          ? (await supabase.rpc('resolve_latest_date', { asset_type_param: 'crypto' })).data
          : (await supabase.rpc('resolve_latest_date', { asset_type_param: 'equity' })).data)
        
        // Get enriched asset data from view (sector, industry, FVS scores, market metrics)
        // Use latest available date for FVS data (no date filter) to ensure we get the most recent scores
        const { data: enrichedAsset } = await supabase
          .from('v_dashboard_all_assets')
          .select(`
            sector, industry, market_cap,
            pe_ratio, dividend_yield, beta,
            fvs_score, fvs_profitability, fvs_solvency, fvs_growth, fvs_moat,
            fvs_confidence, fvs_reasoning, fvs_altman_z, piotroski_f_score
          `)
          .eq('asset_id', assetId)
          .order('price_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        // Merge enriched data into asset
        if (enrichedAsset) {
          // Sector and industry from view
          asset.sector = enrichedAsset.sector
          asset.industry = enrichedAsset.industry
          asset.market_cap = enrichedAsset.market_cap
          // Market metrics from view
          asset.pe_ratio = enrichedAsset.pe_ratio
          asset.dividend_yield = enrichedAsset.dividend_yield
          asset.beta = enrichedAsset.beta
          // FVS (Fundamental Vigor Score) fields
          asset.fvs_score = enrichedAsset.fvs_score
          asset.fvs_profitability = enrichedAsset.fvs_profitability
          asset.fvs_solvency = enrichedAsset.fvs_solvency
          asset.fvs_growth = enrichedAsset.fvs_growth
          asset.fvs_moat = enrichedAsset.fvs_moat
          asset.fvs_confidence = enrichedAsset.fvs_confidence
          asset.fvs_reasoning = enrichedAsset.fvs_reasoning
          asset.fvs_altman_z = enrichedAsset.fvs_altman_z
          asset.piotroski_f_score = enrichedAsset.piotroski_f_score
        }
        
        // Get company description from equity_metadata
        if (asset.asset_type === 'equity') {
          const { data: metadataDesc } = await supabase
            .from('equity_metadata')
            .select('description')
            .eq('asset_id', assetId)
            .single()
          
          if (metadataDesc?.description) {
            asset.short_description = metadataDesc.description
          }
        }
        
        // Get OHLCV (365 bars)
        const { data: ohlcv } = await supabase
          .from('daily_bars')
          .select('date, open, high, low, close, volume')
          .eq('asset_id', assetId)
          .lte('date', targetDate)
          .order('date', { ascending: false })
          .limit(365)
        
        // Add latest close price and calculate accurate 52-week high/low from OHLCV data
        if (ohlcv && ohlcv.length > 0) {
          asset.close = ohlcv[0].close
          
          // Calculate 52-week high/low from actual OHLCV data (more accurate than fundamentals)
          // Use up to 252 trading days (approximately 52 weeks)
          const tradingDays52Weeks = Math.min(ohlcv.length, 252)
          const last52WeeksData = ohlcv.slice(0, tradingDays52Weeks)
          
          const calculatedHigh = Math.max(...last52WeeksData.map(bar => bar.high))
          const calculatedLow = Math.min(...last52WeeksData.map(bar => bar.low))
          
          // Override fundamentals data with calculated values (more accurate and up-to-date)
          asset.week_52_high = calculatedHigh
          asset.week_52_low = calculatedLow
        }
        
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
        
        // Get historical AI scores (for chart overlay)
        const { data: aiScoreHistory } = await supabase
          .from('asset_ai_reviews')
          .select('as_of_date, ai_direction_score, ai_setup_quality_score')
          .eq('asset_id', assetId)
          .lte('as_of_date', targetDate)
          .order('as_of_date', { ascending: true })
          .limit(365)
        
        // Get AI review (latest for this asset/date)
        let reviewQuery = supabase
          .from('asset_ai_reviews')
          .select('*')
          .eq('asset_id', assetId)
          .lte('as_of_date', targetDate)
        
        if (configId) {
          reviewQuery = reviewQuery.eq('config_id', configId)
        }
        
        const { data: reviews } = await reviewQuery.order('as_of_date', { ascending: false }).order('ai_review_version', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(1)
        const rawReview = reviews?.[0] || null
        
        // Get stock lists this asset belongs to
        const { data: listItems } = await supabase
          .from('stock_list_items')
          .select('list_id, stock_lists(id, name, color, icon)')
          .eq('asset_id', assetId)
        
        const stockLists = listItems?.map(item => item.stock_lists).filter(Boolean) || []
        
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
          ai_score_history: aiScoreHistory || [],
          features,
          scores,
          signals: signals || [],
          review,
          review_status: review ? 'ready' : 'missing',
          stock_lists: stockLists
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
        const assetType = url.searchParams.get('asset_type') // equity or crypto
        const configId = url.searchParams.get('config_id')
        const sortBy = url.searchParams.get('sort_by') || 'weighted_score'
        const sortOrder = url.searchParams.get('sort_order') || 'desc'
        const secondarySortBy = url.searchParams.get('secondary_sort_by')
        const secondarySortOrder = url.searchParams.get('secondary_sort_order') || 'desc'
        const search = url.searchParams.get('search') // Optional symbol search
        const minMarketCap = url.searchParams.get('min_market_cap')
        const maxMarketCap = url.searchParams.get('max_market_cap')
        const industry = url.searchParams.get('industry')
        
        let query = supabase
          .from('mv_dashboard_all_assets')
          .select('*', { count: 'exact' })
          .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
          
        if (assetType) {
          // Include global_equity when equity is requested
          if (assetType === 'equity') {
            query = query.in('asset_type', ['equity', 'global_equity'])
          } else {
            query = query.eq('asset_type', assetType)
          }
        }
        
        // Optional search by symbol
        if (search) {
          query = query.ilike('symbol', `%${search}%`)
        }

        // Apply filters
        if (minMarketCap) {
          query = query.gte('market_cap', parseFloat(minMarketCap))
        }
        if (maxMarketCap) {
          query = query.lte('market_cap', parseFloat(maxMarketCap))
        }
        if (industry) {
          // Case-insensitive match for industry (database has mixed case values)
          query = query.ilike('industry', industry)
        }
        
        // Helper to apply sorting
        const applySort = (q: any, field: string, order: string) => {
          const ascending = order === 'asc'
          switch (field) {
            case 'symbol': return q.order('symbol', { ascending })
            case 'score_delta': return q.order('score_delta', { ascending })
            case 'inflection_score': return q.order('inflection_score', { ascending })
            case 'ai_confidence': return q.order('ai_confidence', { ascending, nullsFirst: false })
            case 'ai_setup_quality_score': return q.order('ai_setup_quality_score', { ascending, nullsFirst: false })
            case 'ai_direction_score': return q.order('ai_direction_score', { ascending, nullsFirst: false })
            case 'fvs_score': return q.order('fvs_score', { ascending, nullsFirst: false })
            case 'market_cap': return q.order('market_cap', { ascending, nullsFirst: false })
            case 'close': return q.order('close', { ascending, nullsFirst: false })
            case 'return_1d': return q.order('return_1d', { ascending, nullsFirst: false })
            case 'return_7d': return q.order('return_7d', { ascending, nullsFirst: false })
            case 'return_30d': return q.order('return_30d', { ascending, nullsFirst: false })
            case 'dollar_volume_7d': return q.order('dollar_volume_7d', { ascending, nullsFirst: false })
            case 'industry': return q.order('industry', { ascending, nullsFirst: false })
            case 'pe_ratio': return q.order('pe_ratio', { ascending, nullsFirst: false })
            case 'forward_pe': return q.order('forward_pe', { ascending, nullsFirst: false })
            case 'peg_ratio': return q.order('peg_ratio', { ascending, nullsFirst: false })
            case 'price_to_sales_ttm': return q.order('price_to_sales_ttm', { ascending, nullsFirst: false })
            case 'forward_ps': return q.order('forward_ps', { ascending, nullsFirst: false })
            case 'psg': return q.order('psg', { ascending, nullsFirst: false })
            case 'revenue_growth_yoy': return q.order('revenue_growth_yoy', { ascending, nullsFirst: false })
            case 'vol_mc_ratio': return q.order('dollar_volume_7d', { ascending, nullsFirst: false })
            default: return q.order('ai_setup_quality_score', { ascending: false, nullsFirst: false })
          }
        }

        // Apply primary sorting
        query = applySort(query, sortBy, sortOrder)

        // Apply secondary sorting if provided
        if (secondarySortBy && secondarySortBy !== sortBy) {
          query = applySort(query, secondarySortBy, secondarySortOrder)
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
        
        // Get assets from materialized view (no date filtering needed)
        const { data: assets, error: assetsError } = await supabase
          .from('mv_dashboard_all_assets')
          .select('*')
          .in('asset_id', assetIds)
        
        if (assetsError) {
          return new Response(JSON.stringify({ error: assetsError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Add in_watchlist flag
        const enrichedAssets = assets.map(asset => ({
          ...asset,
          in_watchlist: true
        }))
        
        return new Response(JSON.stringify(enrichedAssets), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/create-document - Create documents via async job system
      // All document types now go through generate-document edge function with async processing
      case req.method === 'POST' && path === '/dashboard/create-document': {
        const body = await req.json()
        const { symbol, asset_id, asset_type, document_type, user_id } = body
        
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'Symbol is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Forward ALL document types to generate-document edge function (async job system)
        console.log(`Forwarding ${document_type || 'one_pager'} request to generate-document edge function...`)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const generateDocUrl = `${supabaseUrl}/functions/v1/generate-document`
        
        const forwardResponse = await fetch(generateDocUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || ''
          },
          body: JSON.stringify({ symbol, asset_id, asset_type, document_type: document_type || 'one_pager', user_id })
        })
        
        const forwardData = await forwardResponse.json()
        return new Response(JSON.stringify(forwardData), {
          status: forwardResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/job-status/:job_id - Poll for async job status
      case req.method === 'GET' && path.startsWith('/dashboard/job-status/'): {
        const jobId = path.split('/').pop()
        
        if (!jobId) {
          return new Response(JSON.stringify({ error: 'Job ID is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data: job, error } = await supabase
          .from('document_jobs')
          .select('*')
          .eq('id', jobId)
          .single()
        
        if (error || !job) {
          return new Response(JSON.stringify({ error: 'Job not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(job), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // NOTE: memo-status endpoints removed - Gemini generation is synchronous
      // Legacy endpoints for Manus polling are no longer needed

      // ==================== STOCK LISTS ENDPOINTS ====================

      // GET /dashboard/stock-lists - Get all stock lists
      case req.method === 'GET' && path === '/dashboard/stock-lists': {
        const { data: lists, error } = await supabase
          .from('stock_lists')
          .select('*')
          .order('display_order', { ascending: true })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(lists || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/stock-lists - Create a new stock list
      case req.method === 'POST' && path === '/dashboard/stock-lists': {
        const body = await req.json()
        const { name, description, icon, color } = body
        
        if (!name) {
          return new Response(JSON.stringify({ error: 'name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get the max display_order to put new list at the end
        const { data: maxOrder } = await supabase
          .from('stock_lists')
          .select('display_order')
          .order('display_order', { ascending: false })
          .limit(1)
          .single()
        
        const newOrder = (maxOrder?.display_order || 0) + 1
        
        const { data: newList, error } = await supabase
          .from('stock_lists')
          .insert({
            name,
            description: description || '',
            icon: icon || 'brain',
            color: color || '#a855f7',
            display_order: newOrder
          })
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(newList), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/stock-lists/reorder - Reorder stock lists
      case req.method === 'POST' && path === '/dashboard/stock-lists/reorder': {
        const body = await req.json()
        const { list_ids } = body
        
        if (!list_ids || !Array.isArray(list_ids)) {
          return new Response(JSON.stringify({ error: 'list_ids array is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Update display_order for each list
        const updates = list_ids.map((id: number, index: number) => 
          supabase
            .from('stock_lists')
            .update({ display_order: index + 1 })
            .eq('id', id)
        )
        
        await Promise.all(updates)
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/stock-lists/:list_id/assets - Get assets in a specific list
      case req.method === 'GET' && /^\/dashboard\/stock-lists\/\d+\/assets$/.test(path): {
        const listId = parseInt(path.split('/')[3])
        
        // Get asset IDs and tags from the stock list
        const { data: listItems, error: listError } = await supabase
          .from('stock_list_items')
          .select('asset_id, tags')
          .eq('list_id', listId)
        
        if (listError) {
          return new Response(JSON.stringify({ error: listError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        if (!listItems || listItems.length === 0) {
          return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetIds = listItems.map(item => item.asset_id)
        
        // Create a map of asset_id to tags
        const tagsMap: Record<number, string[]> = {}
        listItems.forEach(item => {
          tagsMap[item.asset_id] = item.tags || []
        })
        
        // Get assets from materialized view
        const { data: assets, error: assetsError } = await supabase
          .from('mv_dashboard_all_assets')
          .select('*')
          .in('asset_id', assetIds)
        
        if (assetsError) {
          return new Response(JSON.stringify({ error: assetsError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Merge tags into assets
        const assetsWithTags = (assets || []).map(asset => ({
          ...asset,
          list_tags: tagsMap[asset.asset_id] || []
        }))
        
        return new Response(JSON.stringify(assetsWithTags), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/stock-lists/asset/:asset_id - Get lists that contain a specific asset
      case req.method === 'GET' && /^\/dashboard\/stock-lists\/asset\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        
        const { data: listItems, error } = await supabase
          .from('stock_list_items')
          .select('list_id, stock_lists(id, name, color, icon)')
          .eq('asset_id', assetId)
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const lists = listItems?.map(item => item.stock_lists) || []
        
        return new Response(JSON.stringify(lists), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/stock-lists/:list_id/assets - Add asset to a list
      case req.method === 'POST' && /^\/dashboard\/stock-lists\/\d+\/assets$/.test(path): {
        const listId = parseInt(path.split('/')[3])
        const body = await req.json()
        const { asset_id } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('stock_list_items')
          .insert({ list_id: listId, asset_id })
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

      // DELETE /dashboard/stock-lists/:list_id/assets/:asset_id - Remove asset from a list
      case req.method === 'DELETE' && /^\/dashboard\/stock-lists\/\d+\/assets\/\d+$/.test(path): {
        const pathParts = path.split('/')
        const listId = parseInt(pathParts[3])
        const assetId = parseInt(pathParts[5])
        
        const { error } = await supabase
          .from('stock_list_items')
          .delete()
          .eq('list_id', listId)
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

      // DELETE /dashboard/stock-lists/:list_id - Delete a stock list
      case req.method === 'DELETE' && /^\/dashboard\/stock-lists\/\d+$/.test(path): {
        const listId = parseInt(path.split('/')[3])
        
        // First delete all items in the list
        await supabase
          .from('stock_list_items')
          .delete()
          .eq('list_id', listId)
        
        // Then delete the list itself
        const { error } = await supabase
          .from('stock_lists')
          .delete()
          .eq('id', listId)
        
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

      // PATCH /dashboard/stock-lists/:list_id - Update a stock list (rename, change color, etc.)
      case req.method === 'PATCH' && /^\/dashboard\/stock-lists\/\d+$/.test(path): {
        const listId = parseInt(path.split('/')[3])
        const body = await req.json()
        const { name, description, color } = body
        
        const updates: Record<string, string> = {}
        if (name !== undefined) updates.name = name
        if (description !== undefined) updates.description = description
        if (color !== undefined) updates.color = color
        
        if (Object.keys(updates).length === 0) {
          return new Response(JSON.stringify({ error: 'No fields to update' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('stock_lists')
          .update(updates)
          .eq('id', listId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== REVIEWED ENDPOINTS ====================

      // GET /dashboard/reviewed - Get all reviewed asset IDs
      case req.method === 'GET' && path === '/dashboard/reviewed': {
        const { data: reviewed, error } = await supabase
          .from('asset_reviewed')
          .select('asset_id, reviewed_at')
          .order('reviewed_at', { ascending: false })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(reviewed || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/reviewed - Mark asset as reviewed
      case req.method === 'POST' && path === '/dashboard/reviewed': {
        const body = await req.json()
        const { asset_id } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('asset_reviewed')
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

      // DELETE /dashboard/reviewed/:asset_id - Remove reviewed status
      case req.method === 'DELETE' && /^\/dashboard\/reviewed\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('asset_reviewed')
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

      // ==================== ASSET TAGS ENDPOINTS ====================

      // GET /dashboard/asset-tags - Get all asset tags
      case req.method === 'GET' && path === '/dashboard/asset-tags': {
        const { data: tags, error } = await supabase
          .from('asset_tags')
          .select('asset_id, tag, created_at, updated_at')
          .order('updated_at', { ascending: false })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(tags || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /dashboard/asset-tags/:asset_id - Set or update asset tag
      case req.method === 'PUT' && /^\/dashboard\/asset-tags\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        const body = await req.json()
        const { tag } = body
        
        if (!tag || !['interesting', 'maybe', 'no'].includes(tag)) {
          return new Response(JSON.stringify({ error: 'Valid tag required (interesting, maybe, no)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Upsert the tag
        const { data, error } = await supabase
          .from('asset_tags')
          .upsert({ 
            asset_id: assetId, 
            tag, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'asset_id' })
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Sync with watchlist: if tag is 'interesting', add to watchlist; otherwise remove
        if (tag === 'interesting') {
          await supabase.from('watchlist').upsert({ asset_id: assetId }, { onConflict: 'asset_id' })
        } else {
          await supabase.from('watchlist').delete().eq('asset_id', assetId)
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/asset-tags/:asset_id - Remove asset tag
      case req.method === 'DELETE' && /^\/dashboard\/asset-tags\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('asset_tags')
          .delete()
          .eq('asset_id', assetId)
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Also remove from watchlist when tag is cleared
        await supabase.from('watchlist').delete().eq('asset_id', assetId)
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== TEMPLATE MANAGEMENT ENDPOINTS ====================

      // GET /dashboard/templates - Get all templates
      case req.method === 'GET' && path === '/dashboard/templates': {
        const { data: templates, error } = await supabase
          .from('document_templates')
          .select('*')
          .order('template_key', { ascending: true })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(templates || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/templates/:key - Get a specific template by key
      case req.method === 'GET' && /^\/dashboard\/templates\/[a-z_]+$/.test(path): {
        const templateKey = path.split('/').pop()!
        
        const { data: template, error } = await supabase
          .from('document_templates')
          .select('*')
          .eq('template_key', templateKey)
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(template), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /dashboard/templates/:key - Update a template
      case req.method === 'PUT' && /^\/dashboard\/templates\/[a-z_]+$/.test(path): {
        const templateKey = path.split('/').pop()!
        const body = await req.json()
        const { template_content, template_name, description } = body
        
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString()
        }
        
        if (template_content !== undefined) updateData.template_content = template_content
        if (template_name !== undefined) updateData.template_name = template_name
        if (description !== undefined) updateData.description = description
        
        const { data: template, error } = await supabase
          .from('document_templates')
          .update(updateData)
          .eq('template_key', templateKey)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(template), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== CHAT CONFIG ENDPOINTS ====================

      // GET /dashboard/chat-config - Get all chat configuration
      case req.method === 'GET' && path === '/dashboard/chat-config': {
        const { data: configs, error } = await supabase
          .from('chat_config')
          .select('*')
          .order('display_order', { ascending: true })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(configs || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/chat-config/:key - Get a specific config by key
      case req.method === 'GET' && /^\/dashboard\/chat-config\/[a-z_]+$/.test(path): {
        const configKey = path.split('/').pop()!
        
        const { data: config, error } = await supabase
          .from('chat_config')
          .select('*')
          .eq('config_key', configKey)
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(config), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /dashboard/chat-config/:key - Update a config value
      case req.method === 'PUT' && /^\/dashboard\/chat-config\/[a-z_]+$/.test(path): {
        const configKey = path.split('/').pop()!
        const body = await req.json()
        const { config_value, config_name, description } = body
        
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString()
        }
        
        if (config_value !== undefined) updateData.config_value = config_value
        if (config_name !== undefined) updateData.config_name = config_name
        if (description !== undefined) updateData.description = description
        
        const { data: config, error } = await supabase
          .from('chat_config')
          .update(updateData)
          .eq('config_key', configKey)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(config), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== MODEL PORTFOLIO ENDPOINTS ====================

      // GET /dashboard/model-portfolio - Get all model portfolio items
      case req.method === 'GET' && path === '/dashboard/model-portfolio': {
        const { data: items, error } = await supabase
          .from('model_portfolio_items')
          .select('asset_id, target_weight, notes, added_at')
          .order('added_at', { ascending: false })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(items || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/model-portfolio/assets - Get model portfolio with full asset data
      case req.method === 'GET' && path === '/dashboard/model-portfolio/assets': {
        const { data: portfolioItems, error: portfolioError } = await supabase
          .from('model_portfolio_items')
          .select('asset_id, target_weight, notes, added_at')
        
        if (portfolioError) {
          return new Response(JSON.stringify({ error: portfolioError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        if (!portfolioItems || portfolioItems.length === 0) {
          return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetIds = portfolioItems.map(w => w.asset_id)
        const portfolioMap = new Map(portfolioItems.map(p => [p.asset_id, p]))
        
        const { data: latestDates } = await supabase
          .from('latest_dates')
          .select('asset_type, latest_date')
        
        const dateMap: Record<string, string> = {}
        latestDates?.forEach(d => { dateMap[d.asset_type] = d.latest_date })
        
        const cryptoDate = dateMap['crypto'] || new Date().toISOString().split('T')[0]
        const equityDate = dateMap['equity'] || new Date().toISOString().split('T')[0]
        
        const [cryptoResult, equityResult] = await Promise.all([
          supabase
            .from('v_dashboard_all_assets')
            .select('*')
            .in('asset_id', assetIds)
            .eq('as_of_date', cryptoDate)
            .eq('universe_id', 'crypto_all'),
          supabase
            .from('v_dashboard_all_assets')
            .select('*')
            .in('asset_id', assetIds)
            .eq('as_of_date', equityDate)
            .eq('universe_id', 'equity_all')
        ])
        
        const assets = [...(cryptoResult.data || []), ...(equityResult.data || [])]
        
        const enrichedAssets = assets.map(asset => ({
          ...asset,
          in_model_portfolio: true,
          target_weight: portfolioMap.get(asset.asset_id)?.target_weight,
          portfolio_notes: portfolioMap.get(asset.asset_id)?.notes
        }))
        
        return new Response(JSON.stringify(enrichedAssets), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/model-portfolio - Add asset to model portfolio
      case req.method === 'POST' && path === '/dashboard/model-portfolio': {
        const body = await req.json()
        const { asset_id, target_weight, notes } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('model_portfolio_items')
          .insert({ asset_id, target_weight, notes })
          .select()
          .single()
        
        if (error) {
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

      // PATCH /dashboard/model-portfolio/:asset_id - Update model portfolio item
      case req.method === 'PATCH' && /^\/dashboard\/model-portfolio\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        const body = await req.json()
        const { target_weight, notes } = body
        
        const updates: Record<string, unknown> = {}
        if (target_weight !== undefined) updates.target_weight = target_weight
        if (notes !== undefined) updates.notes = notes
        
        if (Object.keys(updates).length === 0) {
          return new Response(JSON.stringify({ error: 'No fields to update' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('model_portfolio_items')
          .update(updates)
          .eq('asset_id', assetId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/model-portfolio/:asset_id - Remove from model portfolio
      case req.method === 'DELETE' && /^\/dashboard\/model-portfolio\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('model_portfolio_items')
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

      // ==================== CORE PORTFOLIO ENDPOINTS ====================

      // GET /dashboard/core-portfolio - Get all core portfolio items
      case req.method === 'GET' && path === '/dashboard/core-portfolio': {
        const { data: items, error } = await supabase
          .from('core_portfolio_items')
          .select('asset_id, target_weight, notes, added_at')
          .order('added_at', { ascending: false })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(items || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/core-portfolio/assets - Get core portfolio with full asset data
      case req.method === 'GET' && path === '/dashboard/core-portfolio/assets': {
        const { data: portfolioItems, error: portfolioError } = await supabase
          .from('core_portfolio_items')
          .select('asset_id, target_weight, notes, added_at')
        
        if (portfolioError) {
          return new Response(JSON.stringify({ error: portfolioError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        if (!portfolioItems || portfolioItems.length === 0) {
          return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetIds = portfolioItems.map(w => w.asset_id)
        const portfolioMap = new Map(portfolioItems.map(p => [p.asset_id, p]))
        
        const { data: latestDates } = await supabase
          .from('latest_dates')
          .select('asset_type, latest_date')
        
        const dateMap: Record<string, string> = {}
        latestDates?.forEach(d => { dateMap[d.asset_type] = d.latest_date })
        
        const cryptoDate = dateMap['crypto'] || new Date().toISOString().split('T')[0]
        const equityDate = dateMap['equity'] || new Date().toISOString().split('T')[0]
        
        const [cryptoResult, equityResult] = await Promise.all([
          supabase
            .from('v_dashboard_all_assets')
            .select('*')
            .in('asset_id', assetIds)
            .eq('as_of_date', cryptoDate)
            .eq('universe_id', 'crypto_all'),
          supabase
            .from('v_dashboard_all_assets')
            .select('*')
            .in('asset_id', assetIds)
            .eq('as_of_date', equityDate)
            .eq('universe_id', 'equity_all')
        ])
        
        const assets = [...(cryptoResult.data || []), ...(equityResult.data || [])]
        
        const enrichedAssets = assets.map(asset => ({
          ...asset,
          in_core_portfolio: true,
          target_weight: portfolioMap.get(asset.asset_id)?.target_weight,
          portfolio_notes: portfolioMap.get(asset.asset_id)?.notes
        }))
        
        return new Response(JSON.stringify(enrichedAssets), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/core-portfolio - Add asset to core portfolio
      case req.method === 'POST' && path === '/dashboard/core-portfolio': {
        const body = await req.json()
        const { asset_id, target_weight, notes } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('core_portfolio_items')
          .insert({ asset_id, target_weight, notes })
          .select()
          .single()
        
        if (error) {
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

      // PATCH /dashboard/core-portfolio/:asset_id - Update core portfolio item
      case req.method === 'PATCH' && /^\/dashboard\/core-portfolio\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        const body = await req.json()
        const { target_weight, notes } = body
        
        const updates: Record<string, unknown> = {}
        if (target_weight !== undefined) updates.target_weight = target_weight
        if (notes !== undefined) updates.notes = notes
        
        if (Object.keys(updates).length === 0) {
          return new Response(JSON.stringify({ error: 'No fields to update' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('core_portfolio_items')
          .update(updates)
          .eq('asset_id', assetId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/core-portfolio/:asset_id - Remove from core portfolio
      case req.method === 'DELETE' && /^\/dashboard\/core-portfolio\/\d+$/.test(path): {
        const assetId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('core_portfolio_items')
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

      // ==================== CORE PORTFOLIO HOLDINGS ENDPOINTS (NEW) ====================

      // GET /dashboard/core-portfolio-holdings - Get all holdings from new table
      case req.method === 'GET' && path === '/dashboard/core-portfolio-holdings': {
        const { data: holdings, error } = await supabase
          .from('v_core_portfolio_holdings')
          .select('*')
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(holdings || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/core-portfolio-holdings - Add a new holding
      case req.method === 'POST' && path === '/dashboard/core-portfolio-holdings': {
        const body = await req.json()
        const {
          asset_id,
          custom_symbol,
          custom_name,
          custom_asset_type,
          category,
          quantity,
          cost_basis,
          total_cost,
          strike_price,
          expiration_date,
          option_type,
          manual_price,
          notes
        } = body
        
        if (!category) {
          return new Response(JSON.stringify({ error: 'category is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Calculate total_cost if not provided but cost_basis is
        const calculatedTotalCost = total_cost ?? (cost_basis && quantity ? cost_basis * quantity : null)
        
        const { data, error } = await supabase
          .from('core_portfolio_holdings')
          .insert({
            asset_id,
            custom_symbol,
            custom_name,
            custom_asset_type,
            category,
            quantity: quantity || 0,
            cost_basis,
            total_cost: calculatedTotalCost,
            strike_price,
            expiration_date,
            option_type,
            manual_price,
            notes
          })
          .select()
          .single()
        
        if (error) {
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

      // PATCH /dashboard/core-portfolio-holdings/:id - Update a holding
      case req.method === 'PATCH' && /^\/dashboard\/core-portfolio-holdings\/\d+$/.test(path): {
        const holdingId = parseInt(path.split('/').pop()!)
        const body = await req.json()
        
        const allowedFields = [
          'quantity', 'cost_basis', 'total_cost', 'strike_price',
          'expiration_date', 'option_type', 'manual_price', 'notes',
          'category', 'display_order', 'custom_symbol', 'custom_name'
        ]
        
        const updates: Record<string, unknown> = {}
        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            updates[field] = body[field]
          }
        }
        
        // Recalculate total_cost if quantity or cost_basis changed
        if (updates.quantity !== undefined || updates.cost_basis !== undefined) {
          // Get current values
          const { data: current } = await supabase
            .from('core_portfolio_holdings')
            .select('quantity, cost_basis')
            .eq('id', holdingId)
            .single()
          
          if (current) {
            const newQty = updates.quantity ?? current.quantity
            const newCostBasis = updates.cost_basis ?? current.cost_basis
            if (newQty && newCostBasis) {
              updates.total_cost = newQty * newCostBasis
            }
          }
        }
        
        if (Object.keys(updates).length === 0) {
          return new Response(JSON.stringify({ error: 'No fields to update' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('core_portfolio_holdings')
          .update(updates)
          .eq('id', holdingId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/core-portfolio-holdings/:id - Soft delete a holding
      case req.method === 'DELETE' && /^\/dashboard\/core-portfolio-holdings\/\d+$/.test(path): {
        const holdingId = parseInt(path.split('/').pop()!)
        
        // Soft delete by setting is_active = false
        const { error } = await supabase
          .from('core_portfolio_holdings')
          .update({ is_active: false })
          .eq('id', holdingId)
        
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

      // ==================== MODEL PORTFOLIO HOLDINGS ENDPOINTS ====================

      // GET /dashboard/model-portfolio-holdings - Get all model holdings
      case req.method === 'GET' && path === '/dashboard/model-portfolio-holdings': {
        const { data: holdings, error } = await supabase
          .from('v_model_portfolio_holdings')
          .select('*')
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(holdings || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/model-portfolio-holdings - Add a new model holding
      case req.method === 'POST' && path === '/dashboard/model-portfolio-holdings': {
        const body = await req.json()
        const {
          asset_id,
          custom_symbol,
          custom_name,
          custom_asset_type,
          category,
          quantity,
          cost_basis,
          total_cost,
          target_weight,
          strike_price,
          expiration_date,
          option_type,
          manual_price,
          notes
        } = body
        
        if (!category) {
          return new Response(JSON.stringify({ error: 'category is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Calculate total_cost if not provided but cost_basis is
        const calculatedTotalCost = total_cost ?? (cost_basis && quantity ? cost_basis * quantity : null)
        
        const { data, error } = await supabase
          .from('model_portfolio_holdings')
          .insert({
            asset_id,
            custom_symbol,
            custom_name,
            custom_asset_type,
            category,
            quantity: quantity ?? 0,
            cost_basis,
            total_cost: calculatedTotalCost,
            target_weight,
            strike_price,
            expiration_date,
            option_type,
            manual_price,
            notes
          })
          .select()
          .single()
        
        if (error) {
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

      // PATCH /dashboard/model-portfolio-holdings/:id - Update a model holding
      case req.method === 'PATCH' && /^\/dashboard\/model-portfolio-holdings\/\d+$/.test(path): {
        const holdingId = parseInt(path.split('/').pop()!)
        const body = await req.json()
        
        const allowedFields = [
          'quantity', 'cost_basis', 'total_cost', 'target_weight', 'strike_price',
          'expiration_date', 'option_type', 'manual_price', 'notes',
          'category', 'display_order', 'custom_symbol', 'custom_name'
        ]
        
        const updates: Record<string, unknown> = {}
        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            updates[field] = body[field]
          }
        }
        
        // Recalculate total_cost if quantity or cost_basis changed
        if (updates.quantity !== undefined || updates.cost_basis !== undefined) {
          // Get current values
          const { data: current } = await supabase
            .from('model_portfolio_holdings')
            .select('quantity, cost_basis')
            .eq('id', holdingId)
            .single()
          
          if (current) {
            const newQty = updates.quantity ?? current.quantity
            const newCostBasis = updates.cost_basis ?? current.cost_basis
            if (newQty && newCostBasis) {
              updates.total_cost = newQty * newCostBasis
            }
          }
        }
        
        const { data, error } = await supabase
          .from('model_portfolio_holdings')
          .update(updates)
          .eq('id', holdingId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/model-portfolio-holdings/:id - Delete a model holding
      case req.method === 'DELETE' && /^\/dashboard\/model-portfolio-holdings\/\d+$/.test(path): {
        const holdingId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('model_portfolio_holdings')
          .delete()
          .eq('id', holdingId)
        
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

      // ==================== FEEDBACK ENDPOINTS ====================

      // GET /dashboard/feedback - Get all feedback items
      case req.method === 'GET' && path === '/dashboard/feedback': {
        const { data: items, error } = await supabase
          .from('feedback_items')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(items || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/feedback - Create a new feedback item
      case req.method === 'POST' && path === '/dashboard/feedback': {
        const body = await req.json()
        const { title, description, category, priority, page_name } = body
        
        if (!title || !page_name) {
          return new Response(JSON.stringify({ error: 'Title and page_name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('feedback_items')
          .insert({
            title,
            description: description || null,
            category: category || 'bug',
            priority: priority || 'medium',
            page_name,
            status: 'open'
          })
          .select()
          .single()
        
        if (error) {
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

      // PATCH /dashboard/feedback/:id - Update a feedback item
      case req.method === 'PATCH' && /^\/dashboard\/feedback\/\d+$/.test(path): {
        const feedbackId = parseInt(path.split('/').pop()!)
        const body = await req.json()
        
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (body.title !== undefined) updateData.title = body.title
        if (body.description !== undefined) updateData.description = body.description
        if (body.category !== undefined) updateData.category = body.category
        if (body.priority !== undefined) updateData.priority = body.priority
        if (body.status !== undefined) updateData.status = body.status
        
        const { data, error } = await supabase
          .from('feedback_items')
          .update(updateData)
          .eq('id', feedbackId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/feedback/:id - Delete a feedback item
      case req.method === 'DELETE' && /^\/dashboard\/feedback\/\d+$/.test(path): {
        const feedbackId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('feedback_items')
          .delete()
          .eq('id', feedbackId)
        
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

      // ==================== HISTORICAL FINANCIALS ENDPOINT ====================

      // GET /dashboard/financials - Get historical financial data for an asset
      case req.method === 'GET' && path === '/dashboard/financials': {
        const assetIdParam = url.searchParams.get('asset_id')
        const symbolParam = url.searchParams.get('symbol')
        const yearsParam = url.searchParams.get('years') || '5'
        
        if (!assetIdParam && !symbolParam) {
          return new Response(JSON.stringify({ error: 'asset_id or symbol required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Resolve asset_id from symbol if needed
        let assetId = assetIdParam
        if (!assetId && symbolParam) {
          const { data: assetData } = await supabase
            .from('assets')
            .select('asset_id')
            .ilike('symbol', symbolParam)
            .eq('asset_type', 'equity')
            .limit(1)
            .single()
          
          if (!assetData) {
            return new Response(JSON.stringify({ error: 'Asset not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          assetId = assetData.asset_id.toString()
        }
        
        const years = parseInt(yearsParam)
        
        // Fetch annual fundamentals (last N years) with balance sheet data for ROIC
        const { data: annualData, error: annualError } = await supabase
          .from('equity_annual_fundamentals')
          .select(`
            fiscal_date_ending,
            total_revenue,
            gross_profit,
            operating_income,
            net_income,
            ebitda,
            ebit,
            operating_cashflow,
            investing_cashflow,
            financing_cashflow,
            free_cash_flow,
            capital_expenditures,
            eps_diluted,
            total_shareholder_equity,
            long_term_debt,
            cash_and_equivalents,
            income_tax_expense,
            total_current_assets,
            total_current_liabilities
          `)
          .eq('asset_id', assetId)
          .order('fiscal_date_ending', { ascending: false })
          .limit(years + 1) // Get one extra for YoY calculations
        
        if (annualError) {
          return new Response(JSON.stringify({ error: annualError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Fetch quarterly fundamentals (last 20 quarters for quarterly view + TTM calculation)
        const { data: quarterlyData, error: quarterlyError } = await supabase
          .from('equity_quarterly_fundamentals')
          .select(`
            fiscal_date_ending,
            total_revenue,
            gross_profit,
            operating_income,
            net_income,
            ebitda,
            operating_cashflow,
            investing_cashflow,
            financing_cashflow,
            free_cash_flow,
            eps_diluted
          `)
          .eq('asset_id', assetId)
          .order('fiscal_date_ending', { ascending: false })
          .limit(20) // Get 20 quarters (5 years) for quarterly view
        
        // Calculate TTM (Trailing Twelve Months) from last 4 quarters
        let ttm = null
        if (quarterlyData && quarterlyData.length >= 4) {
          const last4Quarters = quarterlyData.slice(0, 4)
          ttm = {
            fiscal_date_ending: 'TTM',
            total_revenue: last4Quarters.reduce((sum, q) => sum + (q.total_revenue || 0), 0),
            gross_profit: last4Quarters.reduce((sum, q) => sum + (q.gross_profit || 0), 0),
            operating_income: last4Quarters.reduce((sum, q) => sum + (q.operating_income || 0), 0),
            net_income: last4Quarters.reduce((sum, q) => sum + (q.net_income || 0), 0),
            ebitda: last4Quarters.reduce((sum, q) => sum + (q.ebitda || 0), 0),
            operating_cashflow: last4Quarters.reduce((sum, q) => sum + (q.operating_cashflow || 0), 0),
            investing_cashflow: last4Quarters.reduce((sum, q) => sum + (q.investing_cashflow || 0), 0),
            financing_cashflow: last4Quarters.reduce((sum, q) => sum + (q.financing_cashflow || 0), 0),
            free_cash_flow: last4Quarters.reduce((sum, q) => sum + (q.free_cash_flow || 0), 0),
            eps_diluted: last4Quarters.reduce((sum, q) => sum + (parseFloat(q.eps_diluted) || 0), 0)
          }
        }
        
        // Fetch forward estimates from equity_metadata
        const { data: metadataData } = await supabase
          .from('equity_metadata')
          .select(`
            forward_pe,
            trailing_pe,
            peg_ratio,
            analyst_target_price,
            quarterly_earnings_growth_yoy,
            quarterly_revenue_growth_yoy
          `)
          .eq('asset_id', assetId)
          .single()
        
        // Get the symbol for FMP API call
        let symbol = symbolParam
        if (!symbol && assetId) {
          const { data: assetData } = await supabase
            .from('assets')
            .select('symbol')
            .eq('asset_id', assetId)
            .single()
          symbol = assetData?.symbol
        }
        
        // Fetch forward estimates from FMP Analyst Estimates API
        let forwardEstimates: any[] = []
        if (symbol) {
          const FMP_API_KEY = Deno.env.get('FMP_API_KEY')
          if (FMP_API_KEY) {
            try {
              const fmpResponse = await fetch(
                `https://financialmodelingprep.com/stable/analyst-estimates?symbol=${symbol}&period=annual&page=0&limit=10&apikey=${FMP_API_KEY}`
              )
              if (fmpResponse.ok) {
                const fmpData = await fmpResponse.json()
                
                // Get the latest historical fiscal year end date to determine fiscal calendar
                const latestHistoricalDate = annualData && annualData.length > 0 
                  ? new Date(annualData[0].fiscal_date_ending)
                  : new Date()
                const latestHistoricalYear = latestHistoricalDate.getFullYear()
                
                // Filter to only future estimates (dates after the latest historical data)
                // and take only the next 2 fiscal years
                const futureEstimates = fmpData
                  .filter((est: any) => {
                    const estDate = new Date(est.date)
                    return estDate > latestHistoricalDate
                  })
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 2) // Only take next 2 years
                
                // Transform FMP data to match our format
                forwardEstimates = futureEstimates.map((est: any) => {
                  const estDate = new Date(est.date)
                  const fiscalYear = estDate.getFullYear()
                  
                  // Calculate gross profit estimate (assume same gross margin as latest year)
                  let grossProfitEstimate = null
                  if (annualData && annualData.length > 0 && annualData[0].gross_profit && annualData[0].total_revenue) {
                    const grossMargin = annualData[0].gross_profit / annualData[0].total_revenue
                    grossProfitEstimate = est.revenueAvg * grossMargin
                  }
                  
                  return {
                    fiscal_date_ending: est.date,
                    fiscal_year: `FY${fiscalYear.toString().slice(-2)} Est`,
                    total_revenue: est.revenueAvg,
                    revenue_low: est.revenueLow,
                    revenue_high: est.revenueHigh,
                    gross_profit: grossProfitEstimate,
                    operating_income: est.ebitAvg, // EBIT = Operating Income
                    operating_income_low: est.ebitLow,
                    operating_income_high: est.ebitHigh,
                    ebitda: est.ebitdaAvg,
                    net_income: est.netIncomeAvg,
                    net_income_low: est.netIncomeLow,
                    net_income_high: est.netIncomeHigh,
                    eps_diluted: est.epsAvg,
                    eps_low: est.epsLow,
                    eps_high: est.epsHigh,
                    num_analysts_revenue: est.numAnalystsRevenue,
                    num_analysts_eps: est.numAnalystsEps,
                    is_estimate: true,
                    source: 'FMP Analyst Estimates'
                  }
                })
              }
            } catch (e) {
              console.error('Error fetching FMP analyst estimates:', e)
            }
          }
        }
        
        // Fallback to calculated estimates if FMP data not available
        if (forwardEstimates.length === 0 && metadataData && annualData && annualData.length > 0) {
          const latestYear = annualData[0]
          const earningsGrowth = metadataData.quarterly_earnings_growth_yoy 
            ? parseFloat(metadataData.quarterly_earnings_growth_yoy) 
            : 0.10 // Default 10% if not available
          const revenueGrowth = metadataData.quarterly_revenue_growth_yoy 
            ? parseFloat(metadataData.quarterly_revenue_growth_yoy) 
            : earningsGrowth
          
          // Project next 2 years based on growth rates
          for (let i = 1; i <= 2; i++) {
            const nextYear = parseInt(latestYear.fiscal_date_ending.substring(0, 4)) + i
            const growthMultiplier = Math.pow(1 + revenueGrowth, i)
            const earningsMultiplier = Math.pow(1 + earningsGrowth, i)
            
            forwardEstimates.push({
              fiscal_date_ending: `${nextYear}-Est`,
              fiscal_year: `FY${nextYear.toString().slice(-2)} Est`,
              total_revenue: latestYear.total_revenue ? latestYear.total_revenue * growthMultiplier : null,
              gross_profit: latestYear.gross_profit ? latestYear.gross_profit * growthMultiplier : null,
              operating_income: latestYear.operating_income ? latestYear.operating_income * earningsMultiplier : null,
              net_income: latestYear.net_income ? latestYear.net_income * earningsMultiplier : null,
              eps_diluted: latestYear.eps_diluted ? (parseFloat(latestYear.eps_diluted) * earningsMultiplier) : null,
              is_estimate: true,
              source: 'Calculated from growth rates',
              growth_assumptions: {
                revenue_growth: revenueGrowth,
                earnings_growth: earningsGrowth
              }
            })
          }
        }
        
        return new Response(JSON.stringify({
          annual: annualData || [],
          quarterly: quarterlyData || [],
          ttm,
          forward_estimates: forwardEstimates,
          metadata: metadataData || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== VALUATION HISTORY ENDPOINT ====================

      // GET /dashboard/valuation-history - Get historical valuation metrics for an asset
      case req.method === 'GET' && path === '/dashboard/valuation-history': {
        const assetIdParam = url.searchParams.get('asset_id')
        const symbolParam = url.searchParams.get('symbol')
        
        if (!assetIdParam && !symbolParam) {
          return new Response(JSON.stringify({ error: 'asset_id or symbol required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset_id if symbol was provided (ensure it's a number)
        let assetId: number | null = assetIdParam ? parseInt(assetIdParam) : null
        console.log('[valuation-history] assetIdParam:', assetIdParam, 'symbolParam:', symbolParam, 'initial assetId:', assetId)
        
        if (!assetId && symbolParam) {
          const { data: assetData, error: assetError } = await supabase
            .from('assets')
            .select('asset_id')
            .eq('symbol', symbolParam.toUpperCase())
            .single()
          console.log('[valuation-history] asset lookup result:', assetData, 'error:', assetError)
          if (assetData) assetId = assetData.asset_id
        }
        
        console.log('[valuation-history] final assetId:', assetId, 'type:', typeof assetId)
        
        if (!assetId) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Fetch annual fundamentals with EPS for P/E calculation
        const { data: annualData, error: annualError } = await supabase
          .from('equity_annual_fundamentals')
          .select(`
            fiscal_date_ending,
            eps_diluted,
            total_revenue,
            gross_profit,
            ebitda,
            net_income,
            total_shareholder_equity,
            long_term_debt,
            cash_and_equivalents,
            operating_cashflow,
            free_cash_flow
          `)
          .eq('asset_id', assetId)
          .order('fiscal_date_ending', { ascending: false })
          .limit(6)
        
        console.log('[valuation-history] annualData rows:', annualData?.length || 0, 'error:', annualError)
        if (annualData && annualData.length > 0) {
          console.log('[valuation-history] first row:', JSON.stringify(annualData[0]))
        }
        
        // Fetch price at each fiscal year end from daily_bars
        const history: any[] = []
        if (annualData) {
          for (const year of annualData) {
            const fiscalDate = year.fiscal_date_ending
            
            // Get price near fiscal year end
            const { data: priceData } = await supabase
              .from('daily_bars')
              .select('close')
              .eq('asset_id', assetId)
              .lte('date', fiscalDate)
              .order('date', { ascending: false })
              .limit(1)
              .single()
            
            const price = priceData?.close ? parseFloat(priceData.close) : null
            const eps = year.eps_diluted ? parseFloat(year.eps_diluted) : null
            const revenue = year.total_revenue
            const ebitda = year.ebitda
            
            // Calculate P/E
            const peRatio = (price && eps && eps > 0) ? price / eps : null
            
            // Calculate EV/Sales and EV/EBITDA (simplified - would need shares outstanding for accurate EV)
            // For now, use market cap proxy from price * shares (estimated from net income / eps)
            const sharesEstimate = (year.net_income && eps && eps !== 0) ? year.net_income / eps : null
            const marketCap = (price && sharesEstimate) ? price * sharesEstimate : null
            const netDebt = (year.long_term_debt || 0) - (year.cash_and_equivalents || 0)
            const ev = marketCap ? marketCap + netDebt : null
            
            const evToSales = (ev && revenue && revenue > 0) ? ev / revenue : null
            const evToEbitda = (ev && ebitda && ebitda > 0) ? ev / ebitda : null
            
            // Additional metrics for growth companies
            const grossProfit = year.gross_profit
            const evToGrossProfit = (ev && grossProfit && grossProfit > 0) ? ev / grossProfit : null
            const bookValue = year.total_shareholder_equity
            const priceToBook = (marketCap && bookValue && bookValue > 0) ? marketCap / bookValue : null
            
            // FCF Yield for profitable companies - use actual FCF from database
            const fcf = year.free_cash_flow || (year.operating_cashflow ? year.operating_cashflow * 0.85 : null)
            const fcfYield = (fcf && marketCap && marketCap > 0) ? (fcf / marketCap) * 100 : null
            
            history.push({
              fiscal_date: fiscalDate,
              fiscal_year: fiscalDate.substring(0, 4),
              pe_ratio: peRatio,
              ev_to_sales: evToSales,
              ev_to_ebitda: evToEbitda,
              ev_to_gross_profit: evToGrossProfit,
              price_to_book: priceToBook,
              fcf_yield: fcfYield,
              net_income: year.net_income
            })
          }
        }
        
        // Get current valuation from equity_metadata
        const { data: currentMetadata } = await supabase
          .from('equity_metadata')
          .select(`
            pe_ratio,
            forward_pe,
            ev_to_revenue,
            ev_to_ebitda
          `)
          .eq('asset_id', assetId)
          .single()
        
        // Get latest net income and gross margin for profitability/quality check
        const latestNetIncome = annualData && annualData.length > 0 ? annualData[0].net_income : null
        const latestRevenue = annualData && annualData.length > 0 ? annualData[0].total_revenue : null
        const latestGrossProfit = annualData && annualData.length > 0 ? annualData[0].gross_profit : null
        const latestGrossMargin = (latestRevenue && latestGrossProfit && latestRevenue > 0) 
          ? (latestGrossProfit / latestRevenue) * 100 
          : null
        
        // Get price_to_book from equity_metadata
        const { data: priceToBookData } = await supabase
          .from('equity_metadata')
          .select('price_to_book')
          .eq('asset_id', assetId)
          .single()
        
        return new Response(JSON.stringify({
          history: history.reverse(), // Oldest first for charting
          current: {
            pe_ratio: currentMetadata?.pe_ratio ? parseFloat(currentMetadata.pe_ratio) : null,
            forward_pe: currentMetadata?.forward_pe ? parseFloat(currentMetadata.forward_pe) : null,
            ev_to_sales: currentMetadata?.ev_to_revenue ? parseFloat(currentMetadata.ev_to_revenue) : null,
            ev_to_ebitda: currentMetadata?.ev_to_ebitda ? parseFloat(currentMetadata.ev_to_ebitda) : null,
            price_to_book: priceToBookData?.price_to_book ? parseFloat(priceToBookData.price_to_book) : null,
            net_income: latestNetIncome,
            gross_margin: latestGrossMargin
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== PEERS ENDPOINT ====================

      // GET /dashboard/peers - Get peer companies from the same stock lists
      case req.method === 'GET' && path === '/dashboard/peers': {
        const assetIdParam = url.searchParams.get('asset_id')
        const symbolParam = url.searchParams.get('symbol')
        const limitParam = parseInt(url.searchParams.get('limit') || '5')
        
        if (!assetIdParam && !symbolParam) {
          return new Response(JSON.stringify({ error: 'asset_id or symbol required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset_id if symbol was provided
        let assetId = assetIdParam
        if (!assetId && symbolParam) {
          const { data: assetData } = await supabase
            .from('assets')
            .select('asset_id')
            .eq('symbol', symbolParam.toUpperCase())
            .single()
          if (assetData) assetId = assetData.asset_id
        }
        
        if (!assetId) {
          return new Response(JSON.stringify({ error: 'Asset not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Find which stock lists this asset belongs to
        const { data: listMemberships } = await supabase
          .from('stock_list_items')
          .select(`
            list_id,
            stock_lists!inner (
              id,
              name
            )
          `)
          .eq('asset_id', assetId)
        
        if (!listMemberships || listMemberships.length === 0) {
          return new Response(JSON.stringify({ 
            peers: [],
            lists: [],
            message: 'Asset not in any stock lists'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const listIds = listMemberships.map(m => m.list_id)
        const listNames = listMemberships.map(m => (m.stock_lists as any)?.name).filter(Boolean)
        
        // Find peer assets in the same lists (excluding the current asset)
        const { data: peerItems } = await supabase
          .from('stock_list_items')
          .select(`
            asset_id,
            list_id
          `)
          .in('list_id', listIds)
          .neq('asset_id', assetId)
        
        if (!peerItems || peerItems.length === 0) {
          return new Response(JSON.stringify({ 
            peers: [],
            lists: listNames,
            message: 'No peers found in stock lists'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Count how many lists each peer shares with the target
        const peerCounts: Record<string, number> = {}
        for (const item of peerItems) {
          peerCounts[item.asset_id] = (peerCounts[item.asset_id] || 0) + 1
        }
        
        // Sort by number of shared lists and take top N
        const topPeerIds = Object.entries(peerCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limitParam)
          .map(([id]) => id)
        
        // Fetch peer details from v_dashboard_all_assets
        const { data: peerDetails } = await supabase
          .from('v_dashboard_all_assets')
          .select(`
            asset_id,
            symbol,
            name,
            market_cap,
            pe_ratio,
            profit_margin,
            revenue_growth,
            return_1d,
            return_5d,
            return_21d,
            ai_attention_level,
            ai_score
          `)
          .in('asset_id', topPeerIds)
        
        // Add shared list count to each peer
        const peersWithContext = (peerDetails || []).map(peer => ({
          ...peer,
          shared_lists: peerCounts[peer.asset_id] || 0
        })).sort((a, b) => b.shared_lists - a.shared_lists)
        
        return new Response(JSON.stringify({
          peers: peersWithContext,
          lists: listNames
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/momentum?asset_id=123
      // Fetches latest momentum indicators (RSI, ATR, Volatility) from daily_features
      case req.method === 'GET' && path === '/dashboard/momentum': {
        const assetIdParam = url.searchParams.get('asset_id')
        const asOfDate = url.searchParams.get('as_of_date')
        
        if (!assetIdParam) {
          return new Response(JSON.stringify({ error: 'asset_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetId = parseInt(assetIdParam)
        
        // Build query for latest momentum data
        let query = supabase
          .from('daily_features')
          .select('date, rsi_14, atr_pct, realized_vol_20')
          .eq('asset_id', assetId)
          .order('date', { ascending: false })
          .limit(1)
        
        if (asOfDate) {
          query = query.lte('date', asOfDate)
        }
        
        const { data: momentumData, error: momentumError } = await query.single()
        
        if (momentumError) {
          console.error('Momentum data error:', momentumError)
          return new Response(JSON.stringify({ 
            error: momentumError.message,
            momentum: null 
          }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Calculate RVOL (need volume data from daily_bars)
        let rvol = null
        const { data: volumeData, error: volumeError } = await supabase
          .from('daily_bars')
          .select('date, volume')
          .eq('asset_id', assetId)
          .order('date', { ascending: false })
          .limit(21) // Get last 21 days for 20-day average
        
        if (!volumeError && volumeData && volumeData.length >= 2) {
          const latestVolume = volumeData[0].volume
          const avgVolume = volumeData.slice(1).reduce((sum, d) => sum + (d.volume || 0), 0) / (volumeData.length - 1)
          if (avgVolume > 0) {
            rvol = latestVolume / avgVolume
          }
        }
        
        return new Response(JSON.stringify({
          asset_id: assetId,
          date: momentumData.date,
          rsi: momentumData.rsi_14,
          atr_pct: momentumData.atr_pct,
          realized_vol: momentumData.realized_vol_20,
          rvol: rvol
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== END DASHBOARD ENDPOINTS ====================

      // GET /dashboard/price-history?asset_id=123&days=365
      // Fetches historical daily price data for charting
      case req.method === 'GET' && path === '/dashboard/price-history': {
        const assetIdParam = url.searchParams.get('asset_id')
        const daysParam = url.searchParams.get('days') || '365'
        
        if (!assetIdParam) {
          return new Response(JSON.stringify({ error: 'asset_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetId = parseInt(assetIdParam)
        const days = Math.min(parseInt(daysParam), 2000) // Max 2000 days (~5.5 years)
        
        // Calculate the start date
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const startDateStr = startDate.toISOString().split('T')[0]
        
        // Fetch daily bars
        const { data: priceData, error: priceError } = await supabase
          .from('daily_bars')
          .select('date, open, high, low, close, volume')
          .eq('asset_id', assetId)
          .gte('date', startDateStr)
          .order('date', { ascending: false })
        
        if (priceError) {
          console.error('Price history error:', priceError)
          return new Response(JSON.stringify({ error: priceError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({
          asset_id: assetId,
          prices: priceData || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/earnings-calendar?symbol=AAPL
      // Fetches historical earnings dates from Alpha Vantage
      case req.method === 'GET' && path === '/dashboard/earnings-calendar': {
        const symbol = url.searchParams.get('symbol')
        
        if (!symbol) {
          return new Response(JSON.stringify({ error: 'Symbol required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get Alpha Vantage API key from environment
        const alphaVantageKey = Deno.env.get('ALPHAVANTAGE_API_KEY')
        if (!alphaVantageKey) {
          return new Response(JSON.stringify({ error: 'Alpha Vantage API key not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        try {
          // Fetch earnings history from Alpha Vantage
          const avUrl = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${alphaVantageKey}`
          const avResponse = await fetch(avUrl)
          const avData = await avResponse.json()
          
          if (avData.Information || avData.Note) {
            // API limit or error
            return new Response(JSON.stringify({ 
              error: avData.Information || avData.Note,
              earnings: []
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          
          // Extract quarterly earnings with reported dates
          const quarterlyEarnings = avData.quarterlyEarnings || []
          const earnings = quarterlyEarnings.map((e: any) => ({
            fiscalDateEnding: e.fiscalDateEnding,
            reportedDate: e.reportedDate,
            reportedEPS: parseFloat(e.reportedEPS) || null,
            estimatedEPS: parseFloat(e.estimatedEPS) || null,
            surprise: parseFloat(e.surprise) || null,
            surprisePercentage: parseFloat(e.surprisePercentage) || null
          })).filter((e: any) => e.reportedDate) // Only include entries with actual report dates
          
          return new Response(JSON.stringify({ 
            symbol: symbol.toUpperCase(),
            earnings 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (error) {
          console.error('Alpha Vantage API error:', error)
          return new Response(JSON.stringify({ 
            error: 'Failed to fetch earnings data',
            earnings: []
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // GET /dashboard/portfolio-risk - Calculate portfolio risk metrics
      case req.method === 'GET' && path === '/dashboard/portfolio-risk': {
        const assetIdsParam = url.searchParams.get('asset_ids')
        const lookbackDays = parseInt(url.searchParams.get('lookback_days') || url.searchParams.get('lookback') || '90')
        const riskFreeRate = parseFloat(url.searchParams.get('risk_free_rate') || '4.5') / 100 // Convert to decimal
        const annualizationFactor = parseInt(url.searchParams.get('annualization_factor') || '252')
        const benchmark = url.searchParams.get('benchmark') || 'SPY'
        
        if (!assetIdsParam) {
          return new Response(JSON.stringify({ error: 'asset_ids parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetIds = assetIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        
        if (assetIds.length === 0) {
          return new Response(JSON.stringify({ error: 'No valid asset IDs provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Fetch benchmark returns first (SPY or BTC)
        let benchmarkReturns: number[] = []
        const benchmarkSymbol = benchmark === 'BTC' ? 'BTC' : 'SPY'
        
        // Find benchmark asset
        const { data: benchmarkAsset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', benchmarkSymbol)
          .single()
        
        if (benchmarkAsset) {
          const { data: benchmarkData } = await supabase
            .from('daily_features')
            .select('date, return_1d')
            .eq('asset_id', benchmarkAsset.asset_id)
            .not('return_1d', 'is', null)
            .order('date', { ascending: false })
            .limit(lookbackDays)
          
          if (benchmarkData && benchmarkData.length > 0) {
            benchmarkReturns = benchmarkData.map(r => r.return_1d).reverse()
          }
        }
        
        // Fetch daily returns for each asset
        const assetReturns: { [assetId: number]: { symbol: string; returns: number[]; stdDev: number; beta: number; annualizedReturn: number } } = {}
        
        for (const assetId of assetIds) {
          // Get asset info
          const { data: assetData } = await supabase
            .from('assets')
            .select('symbol')
            .eq('asset_id', assetId)
            .single()
          
          // Get daily returns from daily_features
          const { data: returnsData } = await supabase
            .from('daily_features')
            .select('date, return_1d')
            .eq('asset_id', assetId)
            .not('return_1d', 'is', null)
            .order('date', { ascending: false })
            .limit(lookbackDays)
          
          if (returnsData && returnsData.length > 0) {
            const returns = returnsData.map(r => r.return_1d).reverse()
            
            // Calculate annualized standard deviation using configurable factor
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length
            const squaredDiffs = returns.map(r => Math.pow(r - mean, 2))
            const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length
            const dailyStdDev = Math.sqrt(variance)
            const annualizedStdDev = dailyStdDev * Math.sqrt(annualizationFactor)
            const annualizedReturn = mean * annualizationFactor
            
            // Calculate beta against benchmark
            let assetBeta = 1.0
            if (benchmarkReturns.length > 0) {
              const minLen = Math.min(returns.length, benchmarkReturns.length)
              if (minLen >= 10) {
                const assetSlice = returns.slice(-minLen)
                const benchSlice = benchmarkReturns.slice(-minLen)
                const avgAsset = assetSlice.reduce((a, b) => a + b, 0) / minLen
                const avgBench = benchSlice.reduce((a, b) => a + b, 0) / minLen
                
                let covariance = 0
                let benchVariance = 0
                for (let k = 0; k < minLen; k++) {
                  const diffAsset = assetSlice[k] - avgAsset
                  const diffBench = benchSlice[k] - avgBench
                  covariance += diffAsset * diffBench
                  benchVariance += diffBench * diffBench
                }
                covariance /= minLen
                benchVariance /= minLen
                
                if (benchVariance > 0) {
                  assetBeta = covariance / benchVariance
                }
              }
            }
            
            assetReturns[assetId] = {
              symbol: assetData?.symbol || `Asset ${assetId}`,
              returns,
              stdDev: annualizedStdDev,
              beta: assetBeta,
              annualizedReturn
            }
          }
        }
        
        // Calculate correlation matrix
        const assetList = Object.entries(assetReturns)
        const n = assetList.length
        const correlationMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0))
        const symbols: string[] = assetList.map(([_, data]) => data.symbol)
        
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i === j) {
              correlationMatrix[i][j] = 1
            } else if (j > i) {
              const returnsA = assetList[i][1].returns
              const returnsB = assetList[j][1].returns
              const minLen = Math.min(returnsA.length, returnsB.length)
              
              if (minLen < 2) {
                correlationMatrix[i][j] = 0
                correlationMatrix[j][i] = 0
                continue
              }
              
              const sliceA = returnsA.slice(-minLen)
              const sliceB = returnsB.slice(-minLen)
              const avgA = sliceA.reduce((a, b) => a + b, 0) / minLen
              const avgB = sliceB.reduce((a, b) => a + b, 0) / minLen
              
              let numerator = 0
              let denomA = 0
              let denomB = 0
              
              for (let k = 0; k < minLen; k++) {
                const diffA = sliceA[k] - avgA
                const diffB = sliceB[k] - avgB
                numerator += diffA * diffB
                denomA += diffA * diffA
                denomB += diffB * diffB
              }
              
              const denom = Math.sqrt(denomA * denomB)
              const corr = denom > 0 ? numerator / denom : 0
              correlationMatrix[i][j] = corr
              correlationMatrix[j][i] = corr
            }
          }
        }
        
        // Calculate average volatility and diversification metrics
        const volatilities = assetList.map(([_, data]) => data.stdDev)
        const avgVolatility = volatilities.length > 0 
          ? volatilities.reduce((a, b) => a + b, 0) / volatilities.length 
          : 0
        
        // Calculate average pairwise correlation (excluding diagonal)
        let totalCorr = 0
        let corrCount = 0
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            totalCorr += correlationMatrix[i][j]
            corrCount++
          }
        }
        const avgCorrelation = corrCount > 0 ? totalCorr / corrCount : 0
        const diversificationScore = 1 - avgCorrelation
        
        // Estimate portfolio metrics (equal weight assumption for now)
        const equalWeight = n > 0 ? 1 / n : 0
        let portfolioVariance = 0
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            portfolioVariance += equalWeight * equalWeight * correlationMatrix[i][j] * volatilities[i] * volatilities[j]
          }
        }
        const portfolioVolatility = Math.sqrt(Math.max(0, portfolioVariance))
        
        // Calculate portfolio return (weighted average of individual returns)
        const portfolioReturn = assetList.reduce((sum, [_, data]) => sum + (data.annualizedReturn || 0), 0) / n
        
        // Calculate Sharpe ratio using configurable risk-free rate
        const sharpeRatio = portfolioVolatility > 0 
          ? (portfolioReturn - riskFreeRate) / portfolioVolatility 
          : 0
        
        // Calculate portfolio beta as weighted average of individual betas
        const assetBetas = assetList.map(([_, data]) => data.beta)
        const portfolioBeta = assetBetas.length > 0
          ? assetBetas.reduce((sum, b) => sum + b, 0) / assetBetas.length
          : 1.0
        
        // Calculate max drawdown from historical returns
        let maxDrawdown = 0
        if (assetList.length > 0) {
          // Simulate portfolio value using equal weights
          const minLen = Math.min(...assetList.map(([_, data]) => data.returns.length))
          if (minLen > 0) {
            let portfolioValue = 100
            let peak = portfolioValue
            for (let i = 0; i < minLen; i++) {
              const dailyReturn = assetList.reduce((sum, [_, data]) => sum + data.returns[i], 0) / n
              portfolioValue *= (1 + dailyReturn)
              if (portfolioValue > peak) peak = portfolioValue
              const drawdown = (portfolioValue - peak) / peak
              if (drawdown < maxDrawdown) maxDrawdown = drawdown
            }
          }
        }
        
        return new Response(JSON.stringify({
          metrics: {
            volatility: portfolioVolatility,
            beta: portfolioBeta,
            sharpeRatio,
            maxDrawdown,
            diversificationScore,
            avgCorrelation,
            assetCount: n,
            portfolioReturn
          },
          correlationMatrix,
          symbols,
          assetVolatilities: Object.fromEntries(
            assetList.map(([_, data]) => [data.symbol, data.stdDev])
          ),
          assetBetas: Object.fromEntries(
            assetList.map(([_, data]) => [data.symbol, data.beta])
          ),
          settings: {
            lookbackDays,
            riskFreeRate: riskFreeRate * 100, // Convert back to percentage
            annualizationFactor,
            benchmark
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/portfolio-backtest - Historical portfolio performance backtest
      case req.method === 'GET' && path === '/dashboard/portfolio-backtest': {
        const assetIdsParam = url.searchParams.get('asset_ids')
        const weightsParam = url.searchParams.get('weights') // Comma-separated weights matching asset_ids
        const period = url.searchParams.get('period') || '90' // days
        
        if (!assetIdsParam) {
          return new Response(JSON.stringify({ error: 'asset_ids parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const assetIds = assetIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        const weights = weightsParam 
          ? weightsParam.split(',').map(w => parseFloat(w.trim()) / 100)
          : assetIds.map(() => 1 / assetIds.length) // Equal weight if not specified
        
        const lookbackDays = parseInt(period)
        
        // Fetch daily returns for each asset
        const assetReturns: { [assetId: number]: { symbol: string; returns: { date: string; return_1d: number }[] } } = {}
        
        for (let i = 0; i < assetIds.length; i++) {
          const assetId = assetIds[i]
          const { data: assetData } = await supabase
            .from('assets')
            .select('symbol')
            .eq('asset_id', assetId)
            .single()
          
          const { data: returnsData } = await supabase
            .from('daily_features')
            .select('date, return_1d')
            .eq('asset_id', assetId)
            .not('return_1d', 'is', null)
            .order('date', { ascending: true })
            .limit(lookbackDays)
          
          if (returnsData && returnsData.length > 0) {
            assetReturns[assetId] = {
              symbol: assetData?.symbol || `Asset ${assetId}`,
              returns: returnsData
            }
          }
        }
        
        // Fetch SPY returns for benchmark
        const { data: spyAsset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', 'SPY')
          .single()
        
        let spyReturns: { date: string; return_1d: number }[] = []
        if (spyAsset) {
          const { data: spyData } = await supabase
            .from('daily_features')
            .select('date, return_1d')
            .eq('asset_id', spyAsset.asset_id)
            .not('return_1d', 'is', null)
            .order('date', { ascending: true })
            .limit(lookbackDays)
          if (spyData) spyReturns = spyData
        }
        
        // Fetch BTC returns for benchmark
        const { data: btcAsset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', 'BTC')
          .single()
        
        let btcReturns: { date: string; return_1d: number }[] = []
        if (btcAsset) {
          const { data: btcData } = await supabase
            .from('daily_features')
            .select('date, return_1d')
            .eq('asset_id', btcAsset.asset_id)
            .not('return_1d', 'is', null)
            .order('date', { ascending: true })
            .limit(lookbackDays)
          if (btcData) btcReturns = btcData
        }
        
        // Find common dates across all assets
        const assetList = Object.entries(assetReturns)
        if (assetList.length === 0) {
          return new Response(JSON.stringify({ error: 'No return data found for assets' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get all unique dates from portfolio assets
        const allDates = new Set<string>()
        assetList.forEach(([_, data]) => {
          data.returns.forEach(r => allDates.add(r.date))
        })
        const sortedDates = Array.from(allDates).sort()
        
        // Build return lookup maps
        const returnMaps: { [assetId: string]: Map<string, number> } = {}
        assetList.forEach(([id, data]) => {
          returnMaps[id] = new Map(data.returns.map(r => [r.date, r.return_1d]))
        })
        const spyMap = new Map(spyReturns.map(r => [r.date, r.return_1d]))
        const btcMap = new Map(btcReturns.map(r => [r.date, r.return_1d]))
        
        // Calculate portfolio performance
        const results: { date: string; portfolio: number; spy: number; btc: number }[] = []
        let portfolioValue = 100
        let spyValue = 100
        let btcValue = 100
        let portfolioPeak = 100
        let spyPeak = 100
        let btcPeak = 100
        let portfolioMaxDD = 0
        let spyMaxDD = 0
        let btcMaxDD = 0
        let portfolioBestDay = 0
        let portfolioWorstDay = 0
        let spyBestDay = 0
        let spyWorstDay = 0
        let btcBestDay = 0
        let btcWorstDay = 0
        const portfolioDailyReturns: number[] = []
        const spyDailyReturns: number[] = []
        const btcDailyReturns: number[] = []
        
        for (const date of sortedDates) {
          // Calculate weighted portfolio return for this day
          let portfolioReturn = 0
          let totalWeight = 0
          for (let i = 0; i < assetIds.length; i++) {
            const assetId = assetIds[i]
            const weight = weights[i] || 0
            const dayReturn = returnMaps[assetId]?.get(date)
            if (dayReturn !== undefined) {
              portfolioReturn += dayReturn * weight
              totalWeight += weight
            }
          }
          if (totalWeight > 0) {
            portfolioReturn = portfolioReturn / totalWeight * totalWeight // Normalize
          }
          
          const spyReturn = spyMap.get(date) || 0
          const btcReturn = btcMap.get(date) || 0
          
          // Track daily returns for stats
          portfolioDailyReturns.push(portfolioReturn)
          spyDailyReturns.push(spyReturn)
          btcDailyReturns.push(btcReturn)
          
          // Track best/worst days
          if (portfolioReturn > portfolioBestDay) portfolioBestDay = portfolioReturn
          if (portfolioReturn < portfolioWorstDay) portfolioWorstDay = portfolioReturn
          if (spyReturn > spyBestDay) spyBestDay = spyReturn
          if (spyReturn < spyWorstDay) spyWorstDay = spyReturn
          if (btcReturn > btcBestDay) btcBestDay = btcReturn
          if (btcReturn < btcWorstDay) btcWorstDay = btcReturn
          
          // Update cumulative values
          portfolioValue *= (1 + portfolioReturn)
          spyValue *= (1 + spyReturn)
          btcValue *= (1 + btcReturn)
          
          // Track peaks and drawdowns
          if (portfolioValue > portfolioPeak) portfolioPeak = portfolioValue
          if (spyValue > spyPeak) spyPeak = spyValue
          if (btcValue > btcPeak) btcPeak = btcValue
          
          const portfolioDD = (portfolioValue - portfolioPeak) / portfolioPeak
          const spyDD = (spyValue - spyPeak) / spyPeak
          const btcDD = (btcValue - btcPeak) / btcPeak
          
          if (portfolioDD < portfolioMaxDD) portfolioMaxDD = portfolioDD
          if (spyDD < spyMaxDD) spyMaxDD = spyDD
          if (btcDD < btcMaxDD) btcMaxDD = btcDD
          
          results.push({
            date,
            portfolio: portfolioValue,
            spy: spyValue,
            btc: btcValue
          })
        }
        
        // Calculate statistics
        const calcStats = (returns: number[], finalValue: number, maxDD: number, bestDay: number, worstDay: number) => {
          const n = returns.length
          if (n === 0) return { totalReturn: 0, volatility: 0, sharpeRatio: 0, maxDrawdown: 0, bestDay: 0, worstDay: 0 }
          
          const mean = returns.reduce((a, b) => a + b, 0) / n
          const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n
          const dailyVol = Math.sqrt(variance)
          const annualizedVol = dailyVol * Math.sqrt(252)
          const annualizedReturn = mean * 252
          const riskFreeRate = 0.045 // 4.5%
          const sharpeRatio = annualizedVol > 0 ? (annualizedReturn - riskFreeRate) / annualizedVol : 0
          
          return {
            totalReturn: (finalValue - 100) / 100,
            volatility: annualizedVol,
            sharpeRatio,
            maxDrawdown: maxDD,
            bestDay,
            worstDay
          }
        }
        
        const portfolioStats = calcStats(portfolioDailyReturns, portfolioValue, portfolioMaxDD, portfolioBestDay, portfolioWorstDay)
        const spyStats = calcStats(spyDailyReturns, spyValue, spyMaxDD, spyBestDay, spyWorstDay)
        const btcStats = calcStats(btcDailyReturns, btcValue, btcMaxDD, btcBestDay, btcWorstDay)
        
        return new Response(JSON.stringify({
          results,
          portfolioStats,
          spyStats,
          btcStats,
          period: lookbackDays,
          assetCount: assetList.length,
          dataPoints: results.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/ai-analysis - AI-powered portfolio analysis
      case req.method === 'POST' && path === '/dashboard/ai-analysis': {
        const body = await req.json()
        const { prompt, type } = body
        
        if (!prompt) {
          return new Response(JSON.stringify({ error: 'prompt is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Use Gemini API for analysis
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiApiKey) {
          return new Response(JSON.stringify({ error: 'AI service not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{ text: prompt }]
                }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                }
              })
            }
          )
          
          if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text()
            console.error('Gemini API error:', errorText)
            throw new Error('AI service error')
          }
          
          const geminiData = await geminiResponse.json()
          const analysis = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
          
          return new Response(JSON.stringify({
            analysis,
            type,
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        } catch (aiError) {
          console.error('AI analysis error:', aiError)
          return new Response(JSON.stringify({ 
            error: 'AI analysis failed',
            details: aiError.message 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      // GET /dashboard/etfs - Get all ETFs with overview data
      case req.method === 'GET' && path === '/dashboard/etfs': {
        const limit = url.searchParams.get('limit') || '200'
        const offset = url.searchParams.get('offset') || '0'
        const sortBy = url.searchParams.get('sort_by') || 'dollar_volume'
        const sortOrder = url.searchParams.get('sort_order') || 'desc'
        const search = url.searchParams.get('search')
        const category = url.searchParams.get('category')
        
        let query = supabase
          .from('v_etf_overview')
          .select('*', { count: 'exact' })
          .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
        
        if (search) {
          query = query.or(`symbol.ilike.%${search}%,name.ilike.%${search}%`)
        }
        
        if (category) {
          query = query.eq('category', category)
        }
        
        // Apply sorting
        const ascending = sortOrder === 'asc'
        switch (sortBy) {
          case 'symbol': query = query.order('symbol', { ascending }); break
          case 'name': query = query.order('name', { ascending }); break
          case 'close': query = query.order('close', { ascending, nullsFirst: false }); break
          case 'return_1d': query = query.order('return_1d', { ascending, nullsFirst: false }); break
          case 'return_7d': query = query.order('return_7d', { ascending, nullsFirst: false }); break
          case 'return_30d': query = query.order('return_30d', { ascending, nullsFirst: false }); break
          case 'return_365d': query = query.order('return_365d', { ascending, nullsFirst: false }); break
          default: query = query.order('dollar_volume', { ascending: false, nullsFirst: false })
        }
        
        const { data, count, error } = await query
        
        if (error) {
          console.error('ETFs query error:', error)
          throw error
        }
        
        return new Response(JSON.stringify({
          data: data || [],
          total: count || 0,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/indices - Get all market indices with overview data
      case req.method === 'GET' && path === '/dashboard/indices': {
        const sortBy = url.searchParams.get('sort_by') || 'symbol'
        const sortOrder = url.searchParams.get('sort_order') || 'asc'
        const region = url.searchParams.get('region')
        
        let query = supabase
          .from('v_index_overview')
          .select('*', { count: 'exact' })
        
        if (region) {
          query = query.eq('region', region)
        }
        
        // Apply sorting
        const ascending = sortOrder === 'asc'
        switch (sortBy) {
          case 'symbol': query = query.order('symbol', { ascending }); break
          case 'name': query = query.order('name', { ascending }); break
          case 'close': query = query.order('close', { ascending, nullsFirst: false }); break
          case 'return_1d': query = query.order('return_1d', { ascending, nullsFirst: false }); break
          case 'return_7d': query = query.order('return_7d', { ascending, nullsFirst: false }); break
          default: query = query.order('symbol', { ascending: true })
        }
        
        const { data, count, error } = await query
        
        if (error) {
          console.error('Indices query error:', error)
          throw error
        }
        
        return new Response(JSON.stringify({
          data: data || [],
          total: count || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/commodities - Get all commodities with overview data
      case req.method === 'GET' && path === '/dashboard/commodities': {
        const sortBy = url.searchParams.get('sort_by') || 'symbol'
        const sortOrder = url.searchParams.get('sort_order') || 'asc'
        const category = url.searchParams.get('category')
        
        let query = supabase
          .from('v_commodity_overview')
          .select('*', { count: 'exact' })
        
        if (category) {
          query = query.eq('category', category)
        }
        
        // Apply sorting
        const ascending = sortOrder === 'asc'
        switch (sortBy) {
          case 'symbol': query = query.order('symbol', { ascending }); break
          case 'name': query = query.order('name', { ascending }); break
          case 'close': query = query.order('close', { ascending, nullsFirst: false }); break
          case 'return_1d': query = query.order('return_1d', { ascending, nullsFirst: false }); break
          case 'return_7d': query = query.order('return_7d', { ascending, nullsFirst: false }); break
          case 'category': query = query.order('category', { ascending }); break
          default: query = query.order('symbol', { ascending: true })
        }
        
        const { data, count, error } = await query
        
        if (error) {
          console.error('Commodities query error:', error)
          throw error
        }
        
        return new Response(JSON.stringify({
          data: data || [],
          total: count || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ==================== RESEARCH NOTES ENDPOINTS ====================

      // GET /dashboard/research-notes - Get all research notes for a user
      // Query params: user_id (required), context_type (optional), context_id (optional)
      case req.method === 'GET' && path === '/dashboard/research-notes': {
        const userId = url.searchParams.get('user_id')
        const contextType = url.searchParams.get('context_type')
        const contextId = url.searchParams.get('context_id')
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'user_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        let query = supabase
          .from('research_notes')
          .select(`
            *,
            research_note_assets (
              asset_id,
              added_at
            )
          `)
          .eq('user_id', userId)
        
        // Filter by context if provided
        if (contextType) {
          query = query.eq('context_type', contextType)
        }
        if (contextId) {
          query = query.eq('context_id', contextId)
        }
        
        const { data: notes, error } = await query
          .order('is_favorite', { ascending: false })
          .order('updated_at', { ascending: false })
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset details for linked assets
        const assetIds = new Set<number>()
        notes?.forEach(note => {
          note.research_note_assets?.forEach((link: { asset_id: number }) => {
            assetIds.add(link.asset_id)
          })
        })
        
        let assetMap = new Map<number, { symbol: string; name: string; asset_type: string }>()
        if (assetIds.size > 0) {
          const { data: assets } = await supabase
            .from('assets')
            .select('asset_id, symbol, name, asset_type')
            .in('asset_id', Array.from(assetIds))
          
          assets?.forEach(asset => {
            assetMap.set(asset.asset_id, {
              symbol: asset.symbol,
              name: asset.name,
              asset_type: asset.asset_type
            })
          })
        }
        
        // Enrich notes with asset details and context info
        const enrichedNotes = await Promise.all(notes?.map(async note => {
          let contextName = null
          
          // Get context name based on type
          if (note.context_type === 'asset' && note.context_id) {
            const { data: asset } = await supabase
              .from('assets')
              .select('symbol, name')
              .eq('asset_id', parseInt(note.context_id))
              .single()
            contextName = asset ? `${asset.symbol} - ${asset.name}` : null
          } else if (note.context_type === 'stock_list' && note.context_id) {
            const { data: list } = await supabase
              .from('stock_lists')
              .select('name')
              .eq('id', parseInt(note.context_id))
              .single()
            contextName = list?.name || null
          }
          
          return {
            ...note,
            context_name: contextName,
            assets: note.research_note_assets?.map((link: { asset_id: number; added_at: string }) => ({
              asset_id: link.asset_id,
              added_at: link.added_at,
              ...assetMap.get(link.asset_id)
            })) || []
          }
        }) || [])
        
        return new Response(JSON.stringify(enrichedNotes), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/research-notes/context - Get or create note for a specific context
      // Query params: user_id (required), context_type (required), context_id (required for asset/stock_list)
      case req.method === 'GET' && path === '/dashboard/research-notes/context': {
        const userId = url.searchParams.get('user_id')
        const contextType = url.searchParams.get('context_type')
        const contextId = url.searchParams.get('context_id')
        
        if (!userId || !contextType) {
          return new Response(JSON.stringify({ error: 'user_id and context_type are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Build query for existing note
        let query = supabase
          .from('research_notes')
          .select(`
            *,
            research_note_assets (
              asset_id,
              added_at
            )
          `)
          .eq('user_id', userId)
          .eq('context_type', contextType)
        
        if (contextId) {
          query = query.eq('context_id', contextId)
        } else {
          query = query.is('context_id', null)
        }
        
        const { data: existingNotes, error: fetchError } = await query.limit(1)
        
        if (fetchError) {
          return new Response(JSON.stringify({ error: fetchError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // If note exists, return it
        if (existingNotes && existingNotes.length > 0) {
          const note = existingNotes[0]
          
          // Get asset details for linked assets
          const assetIds = note.research_note_assets?.map((link: { asset_id: number }) => link.asset_id) || []
          let assetMap = new Map<number, { symbol: string; name: string; asset_type: string }>()
          
          if (assetIds.length > 0) {
            const { data: assets } = await supabase
              .from('assets')
              .select('asset_id, symbol, name, asset_type')
              .in('asset_id', assetIds)
            
            assets?.forEach(asset => {
              assetMap.set(asset.asset_id, {
                symbol: asset.symbol,
                name: asset.name,
                asset_type: asset.asset_type
              })
            })
          }
          
          return new Response(JSON.stringify({
            ...note,
            assets: note.research_note_assets?.map((link: { asset_id: number; added_at: string }) => ({
              asset_id: link.asset_id,
              added_at: link.added_at,
              ...assetMap.get(link.asset_id)
            })) || [],
            is_new: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Note doesn't exist, create a new one
        let defaultTitle = 'Notes'
        
        if (contextType === 'asset' && contextId) {
          const { data: asset } = await supabase
            .from('assets')
            .select('symbol, name')
            .eq('asset_id', parseInt(contextId))
            .single()
          defaultTitle = asset ? `${asset.symbol} Notes` : 'Asset Notes'
        } else if (contextType === 'stock_list' && contextId) {
          const { data: list } = await supabase
            .from('stock_lists')
            .select('name')
            .eq('id', parseInt(contextId))
            .single()
          defaultTitle = list ? `${list.name} Notes` : 'List Notes'
        } else if (contextType === 'general') {
          defaultTitle = 'General Notes'
        }
        
        const { data: newNote, error: createError } = await supabase
          .from('research_notes')
          .insert({
            user_id: userId,
            title: defaultTitle,
            content: '',
            context_type: contextType,
            context_id: contextId || null,
            is_favorite: false
          })
          .select()
          .single()
        
        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify({
          ...newNote,
          assets: [],
          is_new: true
        }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // GET /dashboard/research-notes/:id - Get a single research note
      case req.method === 'GET' && /^\/dashboard\/research-notes\/\d+$/.test(path): {
        const noteId = parseInt(path.split('/').pop()!)
        
        const { data: note, error } = await supabase
          .from('research_notes')
          .select(`
            *,
            research_note_assets (
              asset_id,
              added_at
            )
          `)
          .eq('id', noteId)
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: error.code === 'PGRST116' ? 404 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Get asset details
        const assetIds = note.research_note_assets?.map((link: { asset_id: number }) => link.asset_id) || []
        let assetMap = new Map<number, { symbol: string; name: string; asset_type: string }>()
        
        if (assetIds.length > 0) {
          const { data: assets } = await supabase
            .from('assets')
            .select('asset_id, symbol, name, asset_type')
            .in('asset_id', assetIds)
          
          assets?.forEach(asset => {
            assetMap.set(asset.asset_id, {
              symbol: asset.symbol,
              name: asset.name,
              asset_type: asset.asset_type
            })
          })
        }
        
        const enrichedNote = {
          ...note,
          assets: note.research_note_assets?.map((link: { asset_id: number; added_at: string }) => ({
            asset_id: link.asset_id,
            added_at: link.added_at,
            ...assetMap.get(link.asset_id)
          })) || []
        }
        
        return new Response(JSON.stringify(enrichedNote), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // POST /dashboard/research-notes - Create a new research note
      case req.method === 'POST' && path === '/dashboard/research-notes': {
        const body = await req.json()
        const { title, content, is_favorite, asset_ids, user_id, context_type, context_id } = body
        
        if (!title?.trim()) {
          return new Response(JSON.stringify({ error: 'title is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'user_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Create the note
        const { data: note, error: noteError } = await supabase
          .from('research_notes')
          .insert({
            title: title.trim(),
            content: content || '',
            is_favorite: is_favorite || false,
            user_id: user_id,
            context_type: context_type || 'general',
            context_id: context_id || null
          })
          .select()
          .single()
        
        if (noteError) {
          return new Response(JSON.stringify({ error: noteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Link assets if provided
        if (asset_ids && Array.isArray(asset_ids) && asset_ids.length > 0) {
          const links = asset_ids.map(asset_id => ({
            note_id: note.id,
            asset_id
          }))
          
          await supabase
            .from('research_note_assets')
            .insert(links)
        }
        
        return new Response(JSON.stringify(note), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PUT /dashboard/research-notes/:id - Update a research note
      case req.method === 'PUT' && /^\/dashboard\/research-notes\/\d+$/.test(path): {
        const noteId = parseInt(path.split('/').pop()!)
        const body = await req.json()
        const { title, content, is_favorite } = body
        
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (title !== undefined) updates.title = title.trim()
        if (content !== undefined) updates.content = content
        if (is_favorite !== undefined) updates.is_favorite = is_favorite
        
        const { data: note, error } = await supabase
          .from('research_notes')
          .update(updates)
          .eq('id', noteId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: error.code === 'PGRST116' ? 404 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(note), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/research-notes/:id - Delete a research note
      case req.method === 'DELETE' && /^\/dashboard\/research-notes\/\d+$/.test(path): {
        const noteId = parseInt(path.split('/').pop()!)
        
        const { error } = await supabase
          .from('research_notes')
          .delete()
          .eq('id', noteId)
        
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

      // POST /dashboard/research-notes/:id/assets - Add asset to a research note
      case req.method === 'POST' && /^\/dashboard\/research-notes\/\d+\/assets$/.test(path): {
        const noteId = parseInt(path.split('/')[3])
        const body = await req.json()
        const { asset_id } = body
        
        if (!asset_id) {
          return new Response(JSON.stringify({ error: 'asset_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        const { data, error } = await supabase
          .from('research_note_assets')
          .insert({ note_id: noteId, asset_id })
          .select()
          .single()
        
        if (error) {
          if (error.code === '23505') {
            return new Response(JSON.stringify({ error: 'Asset already linked to this note' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Update the note's updated_at timestamp
        await supabase
          .from('research_notes')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', noteId)
        
        return new Response(JSON.stringify(data), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // DELETE /dashboard/research-notes/:id/assets/:asset_id - Remove asset from a research note
      case req.method === 'DELETE' && /^\/dashboard\/research-notes\/\d+\/assets\/\d+$/.test(path): {
        const pathParts = path.split('/')
        const noteId = parseInt(pathParts[3])
        const assetId = parseInt(pathParts[5])
        
        const { error } = await supabase
          .from('research_note_assets')
          .delete()
          .eq('note_id', noteId)
          .eq('asset_id', assetId)
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Update the note's updated_at timestamp
        await supabase
          .from('research_notes')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', noteId)
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // PATCH /dashboard/research-notes/:id/favorite - Toggle favorite status
      case req.method === 'PATCH' && /^\/dashboard\/research-notes\/\d+\/favorite$/.test(path): {
        const noteId = parseInt(path.split('/')[3])
        const body = await req.json()
        const { is_favorite } = body
        
        const { data: note, error } = await supabase
          .from('research_notes')
          .update({ 
            is_favorite: is_favorite,
            updated_at: new Date().toISOString()
          })
          .eq('id', noteId)
          .select()
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: error.code === 'PGRST116' ? 404 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        return new Response(JSON.stringify(note), {
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
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

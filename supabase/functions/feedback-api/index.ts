// Supabase Edge Function: Feedback API
// Handles bug reports, feature requests, and improvements tracking
// v1.1 - Added x-stratos-key to CORS headers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/feedback-api', '')

    // GET / - List all feedback items
    if (req.method === 'GET' && (path === '' || path === '/')) {
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

    // POST / - Create a new feedback item
    if (req.method === 'POST' && (path === '' || path === '/')) {
      const body = await req.json()
      const { title, description, category, priority, page_name, submitted_by, user_email } = body

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
          status: 'open',
          submitted_by: submitted_by || 'Anon',
          user_email: user_email || null
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

    // PATCH /:id - Update a feedback item
    const patchMatch = path.match(/^\/(\d+)$/)
    if (req.method === 'PATCH' && patchMatch) {
      const feedbackId = parseInt(patchMatch[1])
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

    // DELETE /:id - Delete a feedback item
    const deleteMatch = path.match(/^\/(\d+)$/)
    if (req.method === 'DELETE' && deleteMatch) {
      const feedbackId = parseInt(deleteMatch[1])

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

    // Not found
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

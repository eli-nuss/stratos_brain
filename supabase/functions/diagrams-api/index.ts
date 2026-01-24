// Diagrams API - Excalidraw diagram management for Company Chat Studio
// Handles CRUD operations and PNG export for AI-generated diagrams

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Diagram types
type DiagramType = 'flowchart' | 'org_chart' | 'mind_map' | 'relationship' | 'timeline' | 'custom'
type DiagramStatus = 'generating' | 'ready' | 'error'

interface Diagram {
  diagram_id: string
  chat_id: string
  user_id: string
  name: string
  description?: string
  diagram_type?: DiagramType
  excalidraw_data: Record<string, unknown>
  thumbnail_url?: string
  generation_prompt?: string
  generation_model?: string
  is_ai_generated: boolean
  status: DiagramStatus
  error_message?: string
  created_at: string
  updated_at: string
}

interface ExcalidrawScene {
  type: 'excalidraw'
  version: number
  source: string
  elements: ExcalidrawElement[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

interface ExcalidrawElement {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
  [key: string]: unknown
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const fullPathParts = url.pathname.split('/').filter(Boolean)
    // Remove 'functions', 'v1', 'diagrams-api' prefix to get the actual route
    const apiIndex = fullPathParts.indexOf('diagrams-api')
    const pathParts = apiIndex >= 0 ? fullPathParts.slice(apiIndex + 1) : fullPathParts
    
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Create Supabase client with user's token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Get user ID from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const userId = user.id
    
    // ========================================================================
    // Route: GET /diagrams?chat_id=xxx - List diagrams for a chat
    // ========================================================================
    if (req.method === 'GET' && pathParts.length === 1 && pathParts[0] === 'diagrams') {
      const chatId = url.searchParams.get('chat_id')
      
      if (!chatId) {
        return new Response(JSON.stringify({ error: 'chat_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const { data: diagrams, error } = await supabase
        .from('chat_diagrams')
        .select('diagram_id, chat_id, name, description, diagram_type, thumbnail_url, is_ai_generated, status, created_at, updated_at')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching diagrams:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ diagrams }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ========================================================================
    // Route: GET /diagrams/:id - Get a single diagram with full data
    // ========================================================================
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'diagrams') {
      const diagramId = pathParts[1]
      
      const { data: diagram, error } = await supabase
        .from('chat_diagrams')
        .select('*')
        .eq('diagram_id', diagramId)
        .eq('user_id', userId)
        .single()
      
      if (error) {
        console.error('Error fetching diagram:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.code === 'PGRST116' ? 404 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ diagram }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ========================================================================
    // Route: POST /diagrams - Create a new diagram
    // ========================================================================
    if (req.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'diagrams') {
      const body = await req.json()
      
      const {
        chat_id,
        name,
        description,
        diagram_type,
        excalidraw_data,
        generation_prompt,
        generation_model,
        is_ai_generated = false,
        status = 'ready'
      } = body
      
      if (!chat_id || !name) {
        return new Response(JSON.stringify({ error: 'chat_id and name are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Validate excalidraw_data structure
      const validatedData: ExcalidrawScene = excalidraw_data || {
        type: 'excalidraw',
        version: 2,
        source: 'stratos-brain',
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff',
          gridSize: null
        },
        files: {}
      }
      
      const diagramData: Partial<Diagram> = {
        chat_id,
        user_id: userId,
        name,
        description,
        diagram_type,
        excalidraw_data: validatedData,
        generation_prompt,
        generation_model,
        is_ai_generated,
        status
      }
      
      const { data: newDiagram, error: insertError } = await supabase
        .from('chat_diagrams')
        .insert(diagramData)
        .select()
        .single()
      
      if (insertError) {
        console.error('Error creating diagram:', insertError)
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ diagram: newDiagram }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ========================================================================
    // Route: PUT /diagrams/:id - Update a diagram
    // ========================================================================
    if (req.method === 'PUT' && pathParts.length === 2 && pathParts[0] === 'diagrams') {
      const diagramId = pathParts[1]
      const updates = await req.json()
      
      // Only allow updating certain fields
      const allowedUpdates: Partial<Diagram> = {}
      if ('name' in updates) allowedUpdates.name = updates.name
      if ('description' in updates) allowedUpdates.description = updates.description
      if ('diagram_type' in updates) allowedUpdates.diagram_type = updates.diagram_type
      if ('excalidraw_data' in updates) allowedUpdates.excalidraw_data = updates.excalidraw_data
      if ('thumbnail_url' in updates) allowedUpdates.thumbnail_url = updates.thumbnail_url
      if ('status' in updates) allowedUpdates.status = updates.status
      if ('error_message' in updates) allowedUpdates.error_message = updates.error_message
      
      const { data: updatedDiagram, error } = await supabase
        .from('chat_diagrams')
        .update(allowedUpdates)
        .eq('diagram_id', diagramId)
        .eq('user_id', userId)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating diagram:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.code === 'PGRST116' ? 404 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ diagram: updatedDiagram }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ========================================================================
    // Route: DELETE /diagrams/:id - Delete a diagram
    // ========================================================================
    if (req.method === 'DELETE' && pathParts.length === 2 && pathParts[0] === 'diagrams') {
      const diagramId = pathParts[1]
      
      // Get diagram to check for thumbnail
      const { data: diagram } = await supabase
        .from('chat_diagrams')
        .select('thumbnail_url')
        .eq('diagram_id', diagramId)
        .eq('user_id', userId)
        .single()
      
      // Delete thumbnail from storage if exists
      if (diagram?.thumbnail_url) {
        const thumbnailPath = diagram.thumbnail_url.split('/').slice(-3).join('/')
        await supabase.storage
          .from('chat-diagrams')
          .remove([thumbnailPath])
      }
      
      // Delete diagram record
      const { error } = await supabase
        .from('chat_diagrams')
        .delete()
        .eq('diagram_id', diagramId)
        .eq('user_id', userId)
      
      if (error) {
        console.error('Error deleting diagram:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ========================================================================
    // Route: POST /diagrams/:id/thumbnail - Upload a thumbnail for a diagram
    // ========================================================================
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[0] === 'diagrams' && pathParts[2] === 'thumbnail') {
      const diagramId = pathParts[1]
      const body = await req.json()
      const { thumbnail_data } = body // Base64 encoded PNG
      
      if (!thumbnail_data) {
        return new Response(JSON.stringify({ error: 'thumbnail_data is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Verify diagram exists and belongs to user
      const { data: diagram, error: fetchError } = await supabase
        .from('chat_diagrams')
        .select('chat_id')
        .eq('diagram_id', diagramId)
        .eq('user_id', userId)
        .single()
      
      if (fetchError || !diagram) {
        return new Response(JSON.stringify({ error: 'Diagram not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Upload thumbnail to storage
      const thumbnailPath = `${userId}/${diagram.chat_id}/${diagramId}.png`
      const thumbnailBytes = Uint8Array.from(atob(thumbnail_data), c => c.charCodeAt(0))
      
      const { error: uploadError } = await supabase.storage
        .from('chat-diagrams')
        .upload(thumbnailPath, thumbnailBytes, {
          contentType: 'image/png',
          upsert: true
        })
      
      if (uploadError) {
        console.error('Thumbnail upload error:', uploadError)
        return new Response(JSON.stringify({ error: 'Failed to upload thumbnail' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-diagrams')
        .getPublicUrl(thumbnailPath)
      
      // Update diagram with thumbnail URL
      await supabase
        .from('chat_diagrams')
        .update({ thumbnail_url: publicUrl })
        .eq('diagram_id', diagramId)
      
      return new Response(JSON.stringify({ thumbnail_url: publicUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // ========================================================================
    // Route: GET /diagrams/:id/export - Export diagram as JSON
    // ========================================================================
    if (req.method === 'GET' && pathParts.length === 3 && pathParts[0] === 'diagrams' && pathParts[2] === 'export') {
      const diagramId = pathParts[1]
      
      const { data: diagram, error } = await supabase
        .from('chat_diagrams')
        .select('name, excalidraw_data')
        .eq('diagram_id', diagramId)
        .eq('user_id', userId)
        .single()
      
      if (error || !diagram) {
        return new Response(JSON.stringify({ error: 'Diagram not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Return as downloadable Excalidraw JSON
      const fileName = `${diagram.name.replace(/[^a-z0-9]/gi, '_')}.excalidraw`
      
      return new Response(JSON.stringify(diagram.excalidraw_data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      })
    }
    
    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Diagrams API error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

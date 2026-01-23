// Sources API - NotebookLM-style source management for Company Chat
// Handles file uploads, URL extraction, and text notes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

// Source types
type SourceType = 'file' | 'url' | 'text' | 'company_doc'

interface Source {
  source_id: string
  chat_id: string
  user_id: string
  source_type: SourceType
  name: string
  description?: string
  file_path?: string
  file_size?: number
  mime_type?: string
  source_url?: string
  raw_content?: string
  extracted_text?: string
  word_count?: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  error_message?: string
  is_enabled: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// Extract text from URL using Gemini
async function extractTextFromUrl(url: string): Promise<{ text: string; title: string }> {
  try {
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StratosBot/1.0)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`)
    }
    
    const html = await response.text()
    
    // Use Gemini to extract clean text and title
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Extract the main content from this HTML page. Return a JSON object with "title" (the page title) and "text" (the main article/content text, cleaned of navigation, ads, and boilerplate). HTML:\n\n${html.substring(0, 50000)}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        })
      }
    )
    
    if (!geminiResponse.ok) {
      throw new Error(`Gemini extraction failed: ${geminiResponse.status}`)
    }
    
    const geminiData = await geminiResponse.json()
    const extractedJson = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (extractedJson) {
      const parsed = JSON.parse(extractedJson)
      return {
        title: parsed.title || 'Untitled',
        text: parsed.text || ''
      }
    }
    
    throw new Error('Failed to extract content')
  } catch (error) {
    console.error('URL extraction error:', error)
    throw error
  }
}

// Extract text from PDF using Gemini's document understanding
async function extractTextFromPdf(base64Content: string, fileName: string): Promise<string> {
  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: base64Content
                }
              },
              {
                text: `Extract all text content from this PDF document "${fileName}". Return the full text content preserving the structure and formatting as much as possible. Include headers, paragraphs, tables (as markdown), and any other text content.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 32768
          }
        })
      }
    )
    
    if (!geminiResponse.ok) {
      throw new Error(`Gemini PDF extraction failed: ${geminiResponse.status}`)
    }
    
    const geminiData = await geminiResponse.json()
    const extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    
    return extractedText || ''
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw error
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const url = new URL(req.url)
    const fullPathParts = url.pathname.split('/').filter(Boolean)
    // Remove 'functions', 'v1', 'sources-api' prefix to get the actual route
    // Path looks like: /functions/v1/sources-api/sources or /functions/v1/sources-api/sources/:id
    const sourcesApiIndex = fullPathParts.indexOf('sources-api')
    const pathParts = sourcesApiIndex >= 0 ? fullPathParts.slice(sourcesApiIndex + 1) : fullPathParts
    
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
    
    // Route: GET /sources?chat_id=xxx - List sources for a chat
    if (req.method === 'GET' && pathParts.length === 1 && pathParts[0] === 'sources') {
      const chatId = url.searchParams.get('chat_id')
      
      if (!chatId) {
        return new Response(JSON.stringify({ error: 'chat_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const { data: sources, error } = await supabase
        .from('chat_sources')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching sources:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ sources }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Route: POST /sources - Create a new source
    if (req.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'sources') {
      const contentType = req.headers.get('content-type') || ''
      
      let body: {
        chat_id: string
        source_type: SourceType
        name: string
        description?: string
        content?: string
        url?: string
        file_data?: string // Base64 encoded file
        mime_type?: string
      }
      
      if (contentType.includes('multipart/form-data')) {
        // Handle file upload
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const chatId = formData.get('chat_id') as string
        const name = formData.get('name') as string || file?.name || 'Untitled'
        const description = formData.get('description') as string | undefined
        
        if (!file || !chatId) {
          return new Response(JSON.stringify({ error: 'file and chat_id are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        
        // Read file as base64
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        
        body = {
          chat_id: chatId,
          source_type: 'file',
          name,
          description,
          file_data: base64,
          mime_type: file.type
        }
      } else {
        body = await req.json()
      }
      
      const { chat_id, source_type, name, description, content, url: sourceUrl, file_data, mime_type } = body
      
      if (!chat_id || !source_type || !name) {
        return new Response(JSON.stringify({ error: 'chat_id, source_type, and name are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Create initial source record
      const sourceData: Partial<Source> = {
        chat_id,
        user_id: userId,
        source_type,
        name,
        description,
        status: 'pending',
        is_enabled: true,
        metadata: {}
      }
      
      // Handle different source types
      if (source_type === 'text') {
        // Text note - immediately ready
        sourceData.raw_content = content
        sourceData.extracted_text = content
        sourceData.word_count = content?.split(/\s+/).length || 0
        sourceData.status = 'ready'
      } else if (source_type === 'url') {
        sourceData.source_url = sourceUrl
        sourceData.status = 'processing'
      } else if (source_type === 'file') {
        sourceData.mime_type = mime_type
        sourceData.file_size = file_data ? Math.round(file_data.length * 0.75) : 0 // Approximate decoded size
        sourceData.status = 'processing'
      }
      
      // Insert source
      const { data: newSource, error: insertError } = await supabase
        .from('chat_sources')
        .insert(sourceData)
        .select()
        .single()
      
      if (insertError) {
        console.error('Error creating source:', insertError)
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Process URL or file asynchronously
      if (source_type === 'url' && sourceUrl) {
        // Process URL extraction in background
        (async () => {
          try {
            const { text, title } = await extractTextFromUrl(sourceUrl)
            await supabase
              .from('chat_sources')
              .update({
                extracted_text: text,
                word_count: text.split(/\s+/).length,
                status: 'ready',
                metadata: { extracted_title: title }
              })
              .eq('source_id', newSource.source_id)
          } catch (error) {
            await supabase
              .from('chat_sources')
              .update({
                status: 'error',
                error_message: error instanceof Error ? error.message : 'Extraction failed'
              })
              .eq('source_id', newSource.source_id)
          }
        })()
      } else if (source_type === 'file' && file_data && mime_type) {
        // Process file extraction in background
        (async () => {
          try {
            let extractedText = ''
            
            if (mime_type === 'application/pdf') {
              extractedText = await extractTextFromPdf(file_data, name)
            } else if (mime_type.startsWith('text/')) {
              // Plain text file
              extractedText = atob(file_data)
            } else {
              throw new Error(`Unsupported file type: ${mime_type}`)
            }
            
            // Upload file to storage
            const filePath = `${userId}/${chat_id}/${newSource.source_id}`
            const { error: uploadError } = await supabase.storage
              .from('chat-sources')
              .upload(filePath, Uint8Array.from(atob(file_data), c => c.charCodeAt(0)), {
                contentType: mime_type
              })
            
            if (uploadError) {
              console.error('File upload error:', uploadError)
            }
            
            await supabase
              .from('chat_sources')
              .update({
                file_path: filePath,
                extracted_text: extractedText,
                word_count: extractedText.split(/\s+/).length,
                status: 'ready'
              })
              .eq('source_id', newSource.source_id)
          } catch (error) {
            await supabase
              .from('chat_sources')
              .update({
                status: 'error',
                error_message: error instanceof Error ? error.message : 'Extraction failed'
              })
              .eq('source_id', newSource.source_id)
          }
        })()
      }
      
      return new Response(JSON.stringify({ source: newSource }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Route: PATCH /sources/:id - Update a source
    if (req.method === 'PATCH' && pathParts.length === 2 && pathParts[0] === 'sources') {
      const sourceId = pathParts[1]
      const updates = await req.json()
      
      // Only allow updating certain fields
      const allowedUpdates: Partial<Source> = {}
      if ('name' in updates) allowedUpdates.name = updates.name
      if ('description' in updates) allowedUpdates.description = updates.description
      if ('is_enabled' in updates) allowedUpdates.is_enabled = updates.is_enabled
      
      const { data: updatedSource, error } = await supabase
        .from('chat_sources')
        .update(allowedUpdates)
        .eq('source_id', sourceId)
        .eq('user_id', userId)
        .select()
        .single()
      
      if (error) {
        console.error('Error updating source:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ source: updatedSource }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Route: DELETE /sources/:id - Delete a source
    if (req.method === 'DELETE' && pathParts.length === 2 && pathParts[0] === 'sources') {
      const sourceId = pathParts[1]
      
      // Get source to check for file
      const { data: source } = await supabase
        .from('chat_sources')
        .select('file_path')
        .eq('source_id', sourceId)
        .eq('user_id', userId)
        .single()
      
      // Delete file from storage if exists
      if (source?.file_path) {
        await supabase.storage
          .from('chat-sources')
          .remove([source.file_path])
      }
      
      // Delete source record
      const { error } = await supabase
        .from('chat_sources')
        .delete()
        .eq('source_id', sourceId)
        .eq('user_id', userId)
      
      if (error) {
        console.error('Error deleting source:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Route: POST /sources/:id/reprocess - Reprocess a failed source
    if (req.method === 'POST' && pathParts.length === 3 && pathParts[0] === 'sources' && pathParts[2] === 'reprocess') {
      const sourceId = pathParts[1]
      
      const { data: source, error: fetchError } = await supabase
        .from('chat_sources')
        .select('*')
        .eq('source_id', sourceId)
        .eq('user_id', userId)
        .single()
      
      if (fetchError || !source) {
        return new Response(JSON.stringify({ error: 'Source not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Reset status to processing
      await supabase
        .from('chat_sources')
        .update({ status: 'processing', error_message: null })
        .eq('source_id', sourceId)
      
      // Reprocess based on type
      if (source.source_type === 'url' && source.source_url) {
        (async () => {
          try {
            const { text, title } = await extractTextFromUrl(source.source_url)
            await supabase
              .from('chat_sources')
              .update({
                extracted_text: text,
                word_count: text.split(/\s+/).length,
                status: 'ready',
                metadata: { extracted_title: title }
              })
              .eq('source_id', sourceId)
          } catch (error) {
            await supabase
              .from('chat_sources')
              .update({
                status: 'error',
                error_message: error instanceof Error ? error.message : 'Extraction failed'
              })
              .eq('source_id', sourceId)
          }
        })()
      }
      
      return new Response(JSON.stringify({ success: true, message: 'Reprocessing started' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Route: GET /sources/context?chat_id=xxx - Get combined context from enabled sources
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'sources' && pathParts[1] === 'context') {
      const chatId = url.searchParams.get('chat_id')
      
      if (!chatId) {
        return new Response(JSON.stringify({ error: 'chat_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      const { data: sources, error } = await supabase
        .from('chat_sources')
        .select('source_id, name, source_type, extracted_text, word_count')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .eq('is_enabled', true)
        .eq('status', 'ready')
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching source context:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Build combined context
      const contextParts = sources?.map(s => {
        return `## Source: ${s.name} (${s.source_type})\n\n${s.extracted_text || ''}`
      }) || []
      
      const combinedContext = contextParts.join('\n\n---\n\n')
      const totalWords = sources?.reduce((sum, s) => sum + (s.word_count || 0), 0) || 0
      
      return new Response(JSON.stringify({
        context: combinedContext,
        source_count: sources?.length || 0,
        total_words: totalWords,
        sources: sources?.map(s => ({ id: s.source_id, name: s.name, type: s.source_type }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // 404 for unknown routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Sources API error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

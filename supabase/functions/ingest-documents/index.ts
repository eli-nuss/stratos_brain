// supabase/functions/ingest-documents/index.ts
// Document Chunking & Embedding Ingestion System
// Processes company documents into searchable chunks with vector embeddings

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Configuration
const BATCH_SIZE = 5 // Documents per request (to avoid timeout)
const EMBEDDING_BATCH_SIZE = 20 // Texts per OpenAI API call
const CHUNK_SIZE = 1000 // Characters per chunk (~250 words)
const CHUNK_OVERLAP = 100 // Overlap between chunks

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse optional parameters from request body
    let docType: string | null = null
    let ticker: string | null = null
    let limit = BATCH_SIZE

    try {
      const body = await req.json()
      docType = body.doc_type || null
      ticker = body.ticker || null
      limit = body.limit || BATCH_SIZE
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Setup Supabase Client with service role for full access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Build query for pending documents
    let query = supabase
      .from('company_documents')
      .select('id, ticker, title, full_text, doc_type, filing_date, fiscal_year, fiscal_quarter')
      .or('is_indexed.is.null,is_indexed.eq.false')
      .not('full_text', 'is', null)
      .order('filing_date', { ascending: false }) // Process newest first
      .limit(limit)

    // Optional filters
    if (docType) {
      query = query.eq('doc_type', docType)
    }
    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase())
    }

    const { data: docs, error } = await query

    if (error) {
      console.error('Error fetching documents:', error)
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (!docs || docs.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No pending documents to process",
        status: "complete"
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`📄 Processing ${docs.length} documents...`)
    const results: Array<{
      id: string
      ticker: string
      doc_type: string
      chunks: number
      status: string
      error?: string
    }> = []

    // Process each document
    for (const doc of docs) {
      const startTime = Date.now()
      
      try {
        // A. Chunk the text using recursive splitting
        const chunks = splitTextRecursive(doc.full_text, CHUNK_SIZE, CHUNK_OVERLAP)
        console.log(`📝 ${doc.ticker} (${doc.doc_type}): ${chunks.length} chunks from ${doc.full_text.length} chars`)

        if (chunks.length === 0) {
          // Mark as indexed even if no chunks (empty document)
          await supabase
            .from('company_documents')
            .update({ is_indexed: true })
            .eq('id', doc.id)
          
          results.push({ 
            id: doc.id, 
            ticker: doc.ticker, 
            doc_type: doc.doc_type,
            chunks: 0, 
            status: "skipped_empty" 
          })
          continue
        }

        // B. Generate embeddings in batches
        const chunkRecords: Array<{
          document_id: string
          chunk_index: number
          content: string
          embedding: number[]
          ticker: string
          doc_type: string
          filing_date: string
        }> = []

        for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
          const embeddings = await getEmbeddings(batch)
          
          // Map embeddings back to chunk records
          batch.forEach((text, idx) => {
            chunkRecords.push({
              document_id: doc.id,
              chunk_index: i + idx,
              content: text,
              embedding: embeddings[idx],
              ticker: doc.ticker,
              doc_type: doc.doc_type,
              filing_date: doc.filing_date
            })
          })
        }

        // C. Insert chunks into database
        // Use upsert to handle potential duplicates
        const { error: insertError } = await supabase
          .from('document_chunks')
          .insert(chunkRecords)

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`)
        }

        // D. Mark document as indexed
        await supabase
          .from('company_documents')
          .update({ is_indexed: true })
          .eq('id', doc.id)

        const elapsed = Date.now() - startTime
        console.log(`✅ ${doc.ticker} (${doc.doc_type}): ${chunks.length} chunks indexed in ${elapsed}ms`)
        
        results.push({ 
          id: doc.id, 
          ticker: doc.ticker, 
          doc_type: doc.doc_type,
          chunks: chunks.length, 
          status: "success" 
        })

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`❌ Failed to process ${doc.ticker} (${doc.id}):`, errorMessage)
        
        results.push({ 
          id: doc.id, 
          ticker: doc.ticker,
          doc_type: doc.doc_type,
          chunks: 0,
          status: "failed", 
          error: errorMessage 
        })
      }
    }

    // Summary statistics
    const successful = results.filter(r => r.status === 'success')
    const totalChunks = successful.reduce((sum, r) => sum + r.chunks, 0)
    
    return new Response(JSON.stringify({ 
      processed: docs.length,
      successful: successful.length,
      failed: results.filter(r => r.status === 'failed').length,
      total_chunks_created: totalChunks,
      results 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Fatal error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    })
  }
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Recursive Text Splitter
 * Splits text into chunks while respecting natural boundaries (paragraphs, sentences)
 * Uses overlap to maintain context across chunk boundaries
 */
function splitTextRecursive(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.length === 0) return []
  
  // Clean the text first
  text = text.trim()
  
  const chunks: string[] = []
  let startIndex = 0

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize
    
    // If we're not at the end, try to find a natural break point
    if (endIndex < text.length) {
      // Priority 1: Look for paragraph break (double newline)
      let breakIndex = text.lastIndexOf('\n\n', endIndex)
      
      // Priority 2: Look for single line break
      if (breakIndex === -1 || breakIndex <= startIndex) {
        breakIndex = text.lastIndexOf('\n', endIndex)
      }
      
      // Priority 3: Look for sentence end (period followed by space)
      if (breakIndex === -1 || breakIndex <= startIndex) {
        breakIndex = text.lastIndexOf('. ', endIndex)
        if (breakIndex !== -1) breakIndex += 1 // Include the period
      }
      
      // Priority 4: Look for any sentence-ending punctuation
      if (breakIndex === -1 || breakIndex <= startIndex) {
        const punctuation = ['. ', '! ', '? ', '.\n', '!\n', '?\n']
        for (const p of punctuation) {
          const idx = text.lastIndexOf(p, endIndex)
          if (idx !== -1 && idx > startIndex) {
            breakIndex = idx + 1
            break
          }
        }
      }
      
      // Use the break point if found, otherwise hard chop
      if (breakIndex !== -1 && breakIndex > startIndex) {
        endIndex = breakIndex
      }
    } else {
      // We're at the end - take whatever's left
      endIndex = text.length
    }

    // Extract and clean the chunk
    const chunk = text.slice(startIndex, endIndex).trim()
    
    // Only add non-trivial chunks (more than 50 chars)
    if (chunk.length > 50) {
      chunks.push(chunk)
    }
    
    // Move start index forward, accounting for overlap
    // But ensure we always make progress
    const nextStart = endIndex - overlap
    startIndex = Math.max(nextStart, startIndex + 1)
    
    // If we've reached the end, break
    if (startIndex >= text.length) break
  }
  
  return chunks
}

/**
 * OpenAI Embedding API Wrapper
 * Generates embeddings for a batch of texts using text-embedding-3-small
 */
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: texts,
      model: 'text-embedding-3-small'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  
  // Sort by index to ensure correct order (OpenAI may return out of order)
  const sorted = data.data.sort((a: { index: number }, b: { index: number }) => a.index - b.index)
  
  return sorted.map((item: { embedding: number[] }) => item.embedding)
}

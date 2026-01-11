// Supabase Edge Function: ingest-filings
// Fetches SEC filings (10-K, 10-Q) and earnings transcripts from Financial Modeling Prep
// and stores them in the company_documents table for AI analysis

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// FMP API configuration
const FMP_API_KEY = Deno.env.get('FMP_API_KEY') || ''
const FMP_BASE_URL = 'https://financialmodelingprep.com/api'

// ============================================================================
// FMP API FUNCTIONS
// ============================================================================

interface FMPFiling {
  symbol: string
  cik: string
  type: string
  link: string
  finalLink: string
  acceptedDate: string
  fillingDate: string
}

interface FMPTranscript {
  symbol: string
  quarter: number
  year: number
  date: string
  content: string
}

// Fetch SEC filings list for a ticker
async function fetchFilingsList(ticker: string, type: '10-K' | '10-Q', limit: number = 5): Promise<FMPFiling[]> {
  const url = `${FMP_BASE_URL}/v3/sec_filings/${ticker}?type=${type}&limit=${limit}&apikey=${FMP_API_KEY}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`FMP API error for ${ticker} ${type}: ${response.status}`)
      return []
    }
    return await response.json()
  } catch (error) {
    console.error(`Error fetching filings for ${ticker}:`, error)
    return []
  }
}

// Fetch the full text of an SEC filing
async function fetchFilingContent(ticker: string, year: number, type: '10-K' | '10-Q'): Promise<string | null> {
  // FMP provides filing content via a different endpoint
  const url = `${FMP_BASE_URL}/v4/financial-reports-json?symbol=${ticker}&year=${year}&period=${type === '10-K' ? 'FY' : 'Q1'}&apikey=${FMP_API_KEY}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      // Fallback: try to get the raw filing text
      return await fetchFilingTextDirect(ticker, type, year)
    }
    const data = await response.json()
    // Convert JSON report to readable text
    return formatFinancialReport(data, ticker, type, year)
  } catch (error) {
    console.error(`Error fetching filing content for ${ticker}:`, error)
    return null
  }
}

// Fetch filing text directly from SEC EDGAR via FMP
async function fetchFilingTextDirect(ticker: string, type: string, year: number): Promise<string | null> {
  // Use FMP's SEC filings endpoint to get the filing URL, then fetch content
  const filings = await fetchFilingsList(ticker, type as '10-K' | '10-Q', 10)
  const targetFiling = filings.find(f => {
    const filingYear = new Date(f.fillingDate).getFullYear()
    return filingYear === year
  })
  
  if (!targetFiling) {
    console.log(`No ${type} filing found for ${ticker} in ${year}`)
    return null
  }
  
  // For now, return a structured summary since full text parsing is complex
  return `# ${ticker} ${type} Filing - ${year}

**Filing Date:** ${targetFiling.fillingDate}
**Accepted Date:** ${targetFiling.acceptedDate}
**CIK:** ${targetFiling.cik}

**SEC Filing Link:** ${targetFiling.finalLink}

*Note: Full text extraction from SEC EDGAR requires additional parsing. Use the link above for the complete filing.*
`
}

// Format financial report JSON into readable text
function formatFinancialReport(data: Record<string, unknown>, ticker: string, type: string, year: number): string {
  let text = `# ${ticker} ${type} Financial Report - ${year}\n\n`
  
  // Recursively format the JSON data
  function formatSection(obj: Record<string, unknown>, indent: number = 0): string {
    let result = ''
    const prefix = '  '.repeat(indent)
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue
      
      const formattedKey = key.replace(/([A-Z])/g, ' $1').trim()
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        result += `${prefix}## ${formattedKey}\n\n`
        result += formatSection(value as Record<string, unknown>, indent + 1)
      } else if (Array.isArray(value)) {
        result += `${prefix}### ${formattedKey}\n\n`
        value.forEach((item, idx) => {
          if (typeof item === 'object') {
            result += formatSection(item as Record<string, unknown>, indent + 1)
          } else {
            result += `${prefix}- ${item}\n`
          }
        })
      } else {
        // Format numbers with commas
        const displayValue = typeof value === 'number' 
          ? value.toLocaleString() 
          : String(value)
        result += `${prefix}**${formattedKey}:** ${displayValue}\n`
      }
    }
    return result
  }
  
  text += formatSection(data as Record<string, unknown>)
  return text
}

// Fetch earnings call transcripts
async function fetchTranscripts(ticker: string, limit: number = 4): Promise<FMPTranscript[]> {
  const url = `${FMP_BASE_URL}/v3/earning_call_transcript/${ticker}?apikey=${FMP_API_KEY}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`FMP API error for transcripts ${ticker}: ${response.status}`)
      return []
    }
    const transcripts = await response.json()
    return transcripts.slice(0, limit)
  } catch (error) {
    console.error(`Error fetching transcripts for ${ticker}:`, error)
    return []
  }
}

// Fetch detailed transcript content
async function fetchTranscriptContent(ticker: string, year: number, quarter: number): Promise<string | null> {
  const url = `${FMP_BASE_URL}/v4/batch_earning_call_transcript/${ticker}?year=${year}&quarter=${quarter}&apikey=${FMP_API_KEY}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      // Try alternative endpoint
      const altUrl = `${FMP_BASE_URL}/v3/earning_call_transcript/${ticker}?year=${year}&quarter=${quarter}&apikey=${FMP_API_KEY}`
      const altResponse = await fetch(altUrl)
      if (!altResponse.ok) return null
      const data = await altResponse.json()
      if (Array.isArray(data) && data.length > 0) {
        return data[0].content
      }
      return null
    }
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      return data[0].content
    }
    return null
  } catch (error) {
    console.error(`Error fetching transcript content for ${ticker}:`, error)
    return null
  }
}

// ============================================================================
// INGESTION LOGIC
// ============================================================================

interface IngestionResult {
  ticker: string
  documents_inserted: number
  documents_skipped: number
  errors: string[]
}

async function ingestDocumentsForTicker(
  supabase: ReturnType<typeof createClient>,
  ticker: string,
  assetId: number | null
): Promise<IngestionResult> {
  const result: IngestionResult = {
    ticker,
    documents_inserted: 0,
    documents_skipped: 0,
    errors: []
  }
  
  // 1. Fetch and store 10-K filings (last 3 years)
  console.log(`Fetching 10-K filings for ${ticker}...`)
  const annualFilings = await fetchFilingsList(ticker, '10-K', 3)
  
  for (const filing of annualFilings) {
    const filingDate = new Date(filing.fillingDate)
    const year = filingDate.getFullYear()
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('company_documents')
      .select('id')
      .eq('ticker', ticker)
      .eq('doc_type', '10-K')
      .eq('filing_date', filing.fillingDate)
      .single()
    
    if (existing) {
      result.documents_skipped++
      continue
    }
    
    // Fetch content
    const content = await fetchFilingContent(ticker, year, '10-K')
    if (!content) {
      result.errors.push(`Failed to fetch 10-K content for ${year}`)
      continue
    }
    
    // Insert document
    const { error } = await supabase
      .from('company_documents')
      .insert({
        ticker,
        asset_id: assetId,
        doc_type: '10-K',
        filing_date: filing.fillingDate,
        fiscal_year: year,
        title: `${ticker} Annual Report (10-K) - ${year}`,
        full_text: content,
        source_url: filing.finalLink,
        source_api: 'fmp'
      })
    
    if (error) {
      result.errors.push(`Insert error for 10-K ${year}: ${error.message}`)
    } else {
      result.documents_inserted++
    }
  }
  
  // 2. Fetch and store 10-Q filings (last 4 quarters)
  console.log(`Fetching 10-Q filings for ${ticker}...`)
  const quarterlyFilings = await fetchFilingsList(ticker, '10-Q', 4)
  
  for (const filing of quarterlyFilings) {
    const filingDate = new Date(filing.fillingDate)
    const year = filingDate.getFullYear()
    const quarter = Math.ceil((filingDate.getMonth() + 1) / 3)
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('company_documents')
      .select('id')
      .eq('ticker', ticker)
      .eq('doc_type', '10-Q')
      .eq('filing_date', filing.fillingDate)
      .single()
    
    if (existing) {
      result.documents_skipped++
      continue
    }
    
    // For 10-Q, store the filing metadata with link
    const content = `# ${ticker} Quarterly Report (10-Q) - Q${quarter} ${year}

**Filing Date:** ${filing.fillingDate}
**Accepted Date:** ${filing.acceptedDate}
**CIK:** ${filing.cik}

**SEC Filing Link:** ${filing.finalLink}

*Full quarterly report available at the SEC link above.*
`
    
    // Insert document
    const { error } = await supabase
      .from('company_documents')
      .insert({
        ticker,
        asset_id: assetId,
        doc_type: '10-Q',
        filing_date: filing.fillingDate,
        fiscal_year: year,
        fiscal_quarter: quarter,
        title: `${ticker} Quarterly Report (10-Q) - Q${quarter} ${year}`,
        full_text: content,
        source_url: filing.finalLink,
        source_api: 'fmp'
      })
    
    if (error) {
      result.errors.push(`Insert error for 10-Q Q${quarter} ${year}: ${error.message}`)
    } else {
      result.documents_inserted++
    }
  }
  
  // 3. Fetch and store earnings transcripts (last 4 quarters)
  console.log(`Fetching earnings transcripts for ${ticker}...`)
  const transcripts = await fetchTranscripts(ticker, 4)
  
  for (const transcript of transcripts) {
    // Check if already exists
    const transcriptDate = new Date(transcript.date).toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('company_documents')
      .select('id')
      .eq('ticker', ticker)
      .eq('doc_type', 'transcript')
      .eq('fiscal_year', transcript.year)
      .eq('fiscal_quarter', transcript.quarter)
      .single()
    
    if (existing) {
      result.documents_skipped++
      continue
    }
    
    // Get full transcript content
    let content = transcript.content
    if (!content) {
      content = await fetchTranscriptContent(ticker, transcript.year, transcript.quarter)
    }
    
    if (!content) {
      result.errors.push(`No transcript content for Q${transcript.quarter} ${transcript.year}`)
      continue
    }
    
    // Format transcript
    const formattedContent = `# ${ticker} Earnings Call Transcript - Q${transcript.quarter} ${transcript.year}

**Date:** ${transcript.date}
**Quarter:** Q${transcript.quarter} ${transcript.year}

---

${content}
`
    
    // Insert document
    const { error } = await supabase
      .from('company_documents')
      .insert({
        ticker,
        asset_id: assetId,
        doc_type: 'transcript',
        filing_date: transcriptDate,
        fiscal_year: transcript.year,
        fiscal_quarter: transcript.quarter,
        title: `${ticker} Earnings Call Transcript - Q${transcript.quarter} ${transcript.year}`,
        full_text: formattedContent,
        source_api: 'fmp'
      })
    
    if (error) {
      result.errors.push(`Insert error for transcript Q${transcript.quarter} ${transcript.year}: ${error.message}`)
    } else {
      result.documents_inserted++
    }
  }
  
  return result
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Check for API key
    if (!FMP_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'FMP_API_KEY not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/ingest-filings', '')

    // Route handling
    switch (true) {
      // POST /ingest - Ingest documents for specified tickers or all active equities
      case req.method === 'POST' && (path === '' || path === '/' || path === '/ingest'): {
        const body = await req.json().catch(() => ({}))
        const { tickers, limit } = body as { tickers?: string[], limit?: number }
        
        // Generate run ID for logging
        const runId = crypto.randomUUID()
        
        // Log start
        await supabase.from('document_ingestion_log').insert({
          run_id: runId,
          status: 'running'
        })
        
        let tickersToProcess: Array<{ ticker: string, asset_id: number | null }> = []
        
        if (tickers && tickers.length > 0) {
          // Process specified tickers
          for (const ticker of tickers) {
            const { data: asset } = await supabase
              .from('assets')
              .select('asset_id')
              .eq('symbol', ticker)
              .single()
            tickersToProcess.push({ ticker, asset_id: asset?.asset_id || null })
          }
        } else {
          // Get all active equities from watchlist or assets table
          const { data: assets } = await supabase
            .from('assets')
            .select('asset_id, symbol')
            .eq('asset_type', 'equity')
            .eq('is_active', true)
            .limit(limit || 50)
          
          tickersToProcess = (assets || []).map(a => ({ 
            ticker: a.symbol, 
            asset_id: a.asset_id 
          }))
        }
        
        console.log(`Processing ${tickersToProcess.length} tickers...`)
        
        // Process each ticker
        const results: IngestionResult[] = []
        let totalInserted = 0
        let totalSkipped = 0
        let totalErrors = 0
        
        for (const { ticker, asset_id } of tickersToProcess) {
          console.log(`\n--- Processing ${ticker} ---`)
          const result = await ingestDocumentsForTicker(supabase, ticker, asset_id)
          results.push(result)
          totalInserted += result.documents_inserted
          totalSkipped += result.documents_skipped
          totalErrors += result.errors.length
          
          // Rate limiting - FMP has limits
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        // Log completion
        await supabase
          .from('document_ingestion_log')
          .update({
            completed_at: new Date().toISOString(),
            tickers_processed: tickersToProcess.length,
            documents_fetched: totalInserted + totalSkipped,
            documents_inserted: totalInserted,
            documents_skipped: totalSkipped,
            errors_count: totalErrors,
            error_details: results.filter(r => r.errors.length > 0).map(r => ({
              ticker: r.ticker,
              errors: r.errors
            })),
            status: totalErrors > 0 ? 'completed' : 'completed'
          })
          .eq('run_id', runId)
        
        return new Response(JSON.stringify({
          success: true,
          run_id: runId,
          summary: {
            tickers_processed: tickersToProcess.length,
            documents_inserted: totalInserted,
            documents_skipped: totalSkipped,
            errors: totalErrors
          },
          results
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // POST /ingest/:ticker - Ingest documents for a single ticker
      case req.method === 'POST' && /^\/ingest\/[A-Z]+$/.test(path): {
        const ticker = path.split('/')[2]
        
        // Get asset_id if exists
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', ticker)
          .single()
        
        const result = await ingestDocumentsForTicker(supabase, ticker, asset?.asset_id || null)
        
        return new Response(JSON.stringify({
          success: true,
          result
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // GET /documents/:ticker - Get all documents for a ticker
      case req.method === 'GET' && /^\/documents\/[A-Z]+$/.test(path): {
        const ticker = path.split('/')[2]
        
        const { data: documents, error } = await supabase
          .from('company_documents')
          .select('id, ticker, doc_type, filing_date, fiscal_year, fiscal_quarter, title, word_count, created_at')
          .eq('ticker', ticker)
          .eq('status', 'active')
          .order('filing_date', { ascending: false })
        
        if (error) throw error
        
        return new Response(JSON.stringify({ documents }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // GET /status - Get ingestion status
      case req.method === 'GET' && path === '/status': {
        const { data: logs } = await supabase
          .from('document_ingestion_log')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(10)
        
        const { data: stats } = await supabase
          .from('company_documents')
          .select('doc_type')
          .eq('status', 'active')
        
        const docCounts = (stats || []).reduce((acc, doc) => {
          acc[doc.doc_type] = (acc[doc.doc_type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        return new Response(JSON.stringify({
          document_counts: docCounts,
          total_documents: stats?.length || 0,
          recent_runs: logs
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      default:
        return new Response(JSON.stringify({ 
          error: 'Not found',
          available_endpoints: [
            'POST /ingest - Ingest documents for all active equities',
            'POST /ingest/:ticker - Ingest documents for a single ticker',
            'GET /documents/:ticker - Get all documents for a ticker',
            'GET /status - Get ingestion status'
          ]
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

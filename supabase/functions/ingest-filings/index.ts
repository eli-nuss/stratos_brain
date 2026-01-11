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

// FMP API configuration - Using STABLE endpoints (not legacy v3/v4)
const FMP_API_KEY = Deno.env.get('FMP_API_KEY') || ''
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

// ============================================================================
// FMP API TYPES
// ============================================================================

interface FMPFiling {
  symbol: string
  cik: string
  filingDate: string
  acceptedDate: string
  formType: string
  link: string
  finalLink: string
}

interface FMPTranscriptDate {
  quarter: number
  fiscalYear: number
  date: string
}

interface FMPTranscript {
  symbol: string
  quarter: number
  year: number
  date: string
  content: string
}

// ============================================================================
// FMP API FUNCTIONS (Using /stable/ endpoints)
// ============================================================================

// Fetch SEC filings list for a ticker
async function fetchFilingsList(
  ticker: string, 
  type: '10-K' | '10-Q' | '8-K', 
  yearsBack: number = 3
): Promise<FMPFiling[]> {
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setFullYear(fromDate.getFullYear() - yearsBack)
  
  const fromStr = fromDate.toISOString().split('T')[0]
  const toStr = toDate.toISOString().split('T')[0]
  
  const url = `${FMP_BASE_URL}/sec-filings-search/symbol?symbol=${ticker}&type=${type}&from=${fromStr}&to=${toStr}&page=0&limit=100&apikey=${FMP_API_KEY}`
  
  console.log(`Fetching ${type} filings for ${ticker} from ${fromStr} to ${toStr}`)
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const text = await response.text()
      console.error(`FMP API error for ${ticker} ${type}: ${response.status} - ${text}`)
      return []
    }
    
    const data = await response.json()
    
    if (typeof data === 'string' && data.includes('Restricted')) {
      console.error(`FMP API restricted: ${data}`)
      return []
    }
    
    const filtered = (data as FMPFiling[]).filter(f => f.formType === type)
    console.log(`Found ${filtered.length} ${type} filings for ${ticker}`)
    return filtered
  } catch (error) {
    console.error(`Error fetching filings for ${ticker}:`, error)
    return []
  }
}

// Fetch available transcript dates for a ticker
async function fetchTranscriptDates(ticker: string): Promise<FMPTranscriptDate[]> {
  const url = `${FMP_BASE_URL}/earning-call-transcript-dates?symbol=${ticker}&apikey=${FMP_API_KEY}`
  
  console.log(`Fetching transcript dates for ${ticker}`)
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const text = await response.text()
      console.error(`FMP API error for transcript dates ${ticker}: ${response.status} - ${text}`)
      return []
    }
    
    const data = await response.json()
    
    if (typeof data === 'string' && data.includes('Restricted')) {
      console.error(`FMP API restricted for transcripts: ${data}`)
      return []
    }
    
    console.log(`Found ${(data as FMPTranscriptDate[]).length} transcript dates for ${ticker}`)
    return data as FMPTranscriptDate[]
  } catch (error) {
    console.error(`Error fetching transcript dates for ${ticker}:`, error)
    return []
  }
}

// Fetch a specific earnings transcript
async function fetchTranscript(ticker: string, year: number, quarter: number): Promise<FMPTranscript | null> {
  const url = `${FMP_BASE_URL}/earning-call-transcript?symbol=${ticker}&year=${year}&quarter=${quarter}&apikey=${FMP_API_KEY}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`FMP API error for transcript ${ticker} Q${quarter} ${year}: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    
    if (typeof data === 'string' && data.includes('Restricted')) {
      console.error(`FMP API restricted for transcript: ${data}`)
      return null
    }
    
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as FMPTranscript
    }
    
    return null
  } catch (error) {
    console.error(`Error fetching transcript for ${ticker} Q${quarter} ${year}:`, error)
    return null
  }
}

// Fetch SEC filing content from EDGAR
async function fetchFilingContent(filing: FMPFiling): Promise<string | null> {
  try {
    // SEC requires a proper User-Agent header with email
    const response = await fetch(filing.finalLink, {
      headers: {
        'User-Agent': 'Stratos-Brain/1.0 (eli@stratosbrain.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })
    
    if (!response.ok) {
      console.error(`Failed to fetch filing content: ${response.status}`)
      return null
    }
    
    const html = await response.text()
    
    // Basic HTML to text conversion
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/td>/gi, ' | ')
      .replace(/<\/th>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
    
    // Truncate if too long
    const maxLength = 500000
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '\n\n[Document truncated due to size]'
    }
    
    return text
  } catch (error) {
    console.error(`Error fetching filing content:`, error)
    return null
  }
}

// Create a structured document from filing metadata
function createFilingDocument(filing: FMPFiling, content: string | null): string {
  let doc = `# ${filing.symbol} ${filing.formType} Filing

**Filing Date:** ${filing.filingDate}
**Accepted Date:** ${filing.acceptedDate}
**CIK:** ${filing.cik}
**Form Type:** ${filing.formType}

**SEC EDGAR Links:**
- Index: ${filing.link}
- Document: ${filing.finalLink}

---

`
  if (content) {
    doc += content
  } else {
    doc += `*Full document content not available. Please refer to the SEC EDGAR links above.*`
  }
  
  return doc
}

// Create a structured document from transcript
function createTranscriptDocument(transcript: FMPTranscript): string {
  return `# ${transcript.symbol} Earnings Call Transcript - Q${transcript.quarter} ${transcript.year}

**Date:** ${transcript.date}
**Quarter:** Q${transcript.quarter}
**Fiscal Year:** ${transcript.year}

---

${transcript.content}
`
}

// ============================================================================
// INGESTION LOGIC
// ============================================================================

interface IngestionResult {
  ticker: string
  documents_inserted: number
  documents_skipped: number
  errors: string[]
  details: {
    '10-K': { inserted: number, skipped: number }
    '10-Q': { inserted: number, skipped: number }
    'transcript': { inserted: number, skipped: number }
  }
}

async function ingestDocumentsForTicker(
  supabase: ReturnType<typeof createClient>,
  ticker: string,
  assetId: number | null,
  options: {
    fetchContent?: boolean
    includeTranscripts?: boolean
    yearsBack?: number
  } = {}
): Promise<IngestionResult> {
  const { 
    fetchContent = false, 
    includeTranscripts = true,
    yearsBack = 3 
  } = options
  
  const result: IngestionResult = {
    ticker,
    documents_inserted: 0,
    documents_skipped: 0,
    errors: [],
    details: {
      '10-K': { inserted: 0, skipped: 0 },
      '10-Q': { inserted: 0, skipped: 0 },
      'transcript': { inserted: 0, skipped: 0 }
    }
  }
  
  // 1. Fetch and store 10-K filings
  console.log(`\n--- Fetching 10-K filings for ${ticker} ---`)
  const annualFilings = await fetchFilingsList(ticker, '10-K', yearsBack)
  
  for (const filing of annualFilings) {
    const filingDate = filing.filingDate.split(' ')[0]
    const year = new Date(filingDate).getFullYear()
    
    const { data: existing } = await supabase
      .from('company_documents')
      .select('id')
      .eq('ticker', ticker)
      .eq('doc_type', '10-K')
      .eq('filing_date', filingDate)
      .single()
    
    if (existing) {
      console.log(`  Skipping 10-K ${year} - already exists`)
      result.documents_skipped++
      result.details['10-K'].skipped++
      continue
    }
    
    let content: string | null = null
    if (fetchContent) {
      console.log(`  Fetching content for 10-K ${year}...`)
      content = await fetchFilingContent(filing)
    }
    
    const fullText = createFilingDocument(filing, content)
    
    const { error } = await supabase
      .from('company_documents')
      .insert({
        ticker,
        asset_id: assetId,
        doc_type: '10-K',
        filing_date: filingDate,
        fiscal_year: year,
        title: `${ticker} Annual Report (10-K) - FY${year}`,
        full_text: fullText,
        source_url: filing.finalLink,
        source_api: 'fmp'
      })
    
    if (error) {
      console.error(`  Error inserting 10-K ${year}:`, error.message)
      result.errors.push(`10-K ${year}: ${error.message}`)
    } else {
      console.log(`  ✓ Inserted 10-K ${year}`)
      result.documents_inserted++
      result.details['10-K'].inserted++
    }
  }
  
  // 2. Fetch and store 10-Q filings
  console.log(`\n--- Fetching 10-Q filings for ${ticker} ---`)
  const quarterlyFilings = await fetchFilingsList(ticker, '10-Q', yearsBack)
  
  for (const filing of quarterlyFilings) {
    const filingDate = filing.filingDate.split(' ')[0]
    const filingDateObj = new Date(filingDate)
    const year = filingDateObj.getFullYear()
    const quarter = Math.ceil((filingDateObj.getMonth() + 1) / 3)
    
    const { data: existing } = await supabase
      .from('company_documents')
      .select('id')
      .eq('ticker', ticker)
      .eq('doc_type', '10-Q')
      .eq('filing_date', filingDate)
      .single()
    
    if (existing) {
      console.log(`  Skipping 10-Q Q${quarter} ${year} - already exists`)
      result.documents_skipped++
      result.details['10-Q'].skipped++
      continue
    }
    
    let content: string | null = null
    if (fetchContent) {
      console.log(`  Fetching content for 10-Q Q${quarter} ${year}...`)
      content = await fetchFilingContent(filing)
    }
    
    const fullText = createFilingDocument(filing, content)
    
    const { error } = await supabase
      .from('company_documents')
      .insert({
        ticker,
        asset_id: assetId,
        doc_type: '10-Q',
        filing_date: filingDate,
        fiscal_year: year,
        fiscal_quarter: quarter,
        title: `${ticker} Quarterly Report (10-Q) - Q${quarter} ${year}`,
        full_text: fullText,
        source_url: filing.finalLink,
        source_api: 'fmp'
      })
    
    if (error) {
      console.error(`  Error inserting 10-Q Q${quarter} ${year}:`, error.message)
      result.errors.push(`10-Q Q${quarter} ${year}: ${error.message}`)
    } else {
      console.log(`  ✓ Inserted 10-Q Q${quarter} ${year}`)
      result.documents_inserted++
      result.details['10-Q'].inserted++
    }
  }
  
  // 3. Fetch and store earnings transcripts
  if (includeTranscripts) {
    console.log(`\n--- Fetching earnings transcripts for ${ticker} ---`)
    const transcriptDates = await fetchTranscriptDates(ticker)
    
    // Filter to last N years
    const cutoffYear = new Date().getFullYear() - yearsBack
    const recentTranscripts = transcriptDates.filter(t => t.fiscalYear >= cutoffYear)
    
    console.log(`Found ${recentTranscripts.length} transcripts in last ${yearsBack} years`)
    
    for (const td of recentTranscripts) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('company_documents')
        .select('id')
        .eq('ticker', ticker)
        .eq('doc_type', 'transcript')
        .eq('fiscal_year', td.fiscalYear)
        .eq('fiscal_quarter', td.quarter)
        .single()
      
      if (existing) {
        console.log(`  Skipping transcript Q${td.quarter} ${td.fiscalYear} - already exists`)
        result.documents_skipped++
        result.details['transcript'].skipped++
        continue
      }
      
      // Fetch the transcript content
      console.log(`  Fetching transcript Q${td.quarter} ${td.fiscalYear}...`)
      const transcript = await fetchTranscript(ticker, td.fiscalYear, td.quarter)
      
      if (!transcript) {
        console.log(`  No transcript content available for Q${td.quarter} ${td.fiscalYear}`)
        continue
      }
      
      const fullText = createTranscriptDocument(transcript)
      
      const { error } = await supabase
        .from('company_documents')
        .insert({
          ticker,
          asset_id: assetId,
          doc_type: 'transcript',
          filing_date: td.date,
          fiscal_year: td.fiscalYear,
          fiscal_quarter: td.quarter,
          title: `${ticker} Earnings Call Transcript - Q${td.quarter} ${td.fiscalYear}`,
          full_text: fullText,
          source_url: `https://financialmodelingprep.com/stable/earning-call-transcript?symbol=${ticker}&year=${td.fiscalYear}&quarter=${td.quarter}`,
          source_api: 'fmp'
        })
      
      if (error) {
        console.error(`  Error inserting transcript Q${td.quarter} ${td.fiscalYear}:`, error.message)
        result.errors.push(`Transcript Q${td.quarter} ${td.fiscalYear}: ${error.message}`)
      } else {
        console.log(`  ✓ Inserted transcript Q${td.quarter} ${td.fiscalYear}`)
        result.documents_inserted++
        result.details['transcript'].inserted++
      }
      
      // Rate limiting for FMP
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return result
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!FMP_API_KEY) {
      return new Response(JSON.stringify({ error: 'FMP_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const path = url.pathname.replace('/ingest-filings', '')
    
    // Parse query params
    const fetchContent = url.searchParams.get('fetch_content') === 'true'
    const includeTranscripts = url.searchParams.get('transcripts') !== 'false' // Default true
    const yearsBack = parseInt(url.searchParams.get('years') || '3')

    switch (true) {
      // POST /ingest - Ingest documents for specified tickers or all active equities
      case req.method === 'POST' && (path === '' || path === '/' || path === '/ingest'): {
        const body = await req.json().catch(() => ({}))
        const { tickers, limit } = body as { tickers?: string[], limit?: number }
        
        const runId = crypto.randomUUID()
        
        await supabase.from('document_ingestion_log').insert({
          run_id: runId,
          status: 'running'
        })
        
        let tickersToProcess: Array<{ ticker: string, asset_id: number | null }> = []
        
        if (tickers && tickers.length > 0) {
          for (const ticker of tickers) {
            const { data: asset } = await supabase
              .from('assets')
              .select('asset_id')
              .eq('symbol', ticker)
              .single()
            tickersToProcess.push({ ticker, asset_id: asset?.asset_id || null })
          }
        } else {
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
        
        console.log(`\n========================================`)
        console.log(`Processing ${tickersToProcess.length} tickers`)
        console.log(`Options: fetchContent=${fetchContent}, transcripts=${includeTranscripts}, years=${yearsBack}`)
        console.log(`========================================\n`)
        
        const results: IngestionResult[] = []
        let totalInserted = 0
        let totalSkipped = 0
        let totalErrors = 0
        
        for (const { ticker, asset_id } of tickersToProcess) {
          console.log(`\n========== Processing ${ticker} ==========`)
          const result = await ingestDocumentsForTicker(supabase, ticker, asset_id, {
            fetchContent,
            includeTranscripts,
            yearsBack
          })
          results.push(result)
          totalInserted += result.documents_inserted
          totalSkipped += result.documents_skipped
          totalErrors += result.errors.length
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
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
            status: 'completed'
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
      case req.method === 'POST' && /^\/ingest\/[A-Za-z]+$/.test(path): {
        const ticker = path.split('/')[2].toUpperCase()
        
        const { data: asset } = await supabase
          .from('assets')
          .select('asset_id')
          .eq('symbol', ticker)
          .single()
        
        console.log(`\n========== Processing ${ticker} ==========`)
        console.log(`Options: fetchContent=${fetchContent}, transcripts=${includeTranscripts}, years=${yearsBack}`)
        
        const result = await ingestDocumentsForTicker(supabase, ticker, asset?.asset_id || null, {
          fetchContent,
          includeTranscripts,
          yearsBack
        })
        
        return new Response(JSON.stringify({
          success: true,
          result
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // GET /documents/:ticker - Get all documents for a ticker
      case req.method === 'GET' && /^\/documents\/[A-Za-z]+$/.test(path): {
        const ticker = path.split('/')[2].toUpperCase()
        
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
            'POST /ingest - Ingest documents for all active equities (or specify tickers in body)',
            'POST /ingest/:ticker - Ingest documents for a single ticker',
            'GET /documents/:ticker - Get all documents for a ticker',
            'GET /status - Get ingestion status'
          ],
          query_params: [
            'fetch_content=true - Fetch full SEC filing content from EDGAR (slower)',
            'transcripts=false - Skip earnings transcripts',
            'years=N - Number of years to look back (default: 3)'
          ],
          body_params: [
            'tickers: string[] - Specific tickers to process',
            'limit: number - Max tickers when processing all equities'
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

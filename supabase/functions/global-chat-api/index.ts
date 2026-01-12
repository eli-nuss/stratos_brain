// Supabase Edge Function: Global Chat API (Stratos CIO)
// Provides a market-wide analysis agent with screening and macro capabilities
// Parallel architecture - does not touch company-chat-api

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stratos-key, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_MODEL = 'gemini-3-pro-preview';
const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY') || '';
const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX') || '';

const SYSTEM_PROMPT = `You are the Chief Investment Officer (CIO) of Stratos.
**Your Mandate:** Oversee the entire market, identify macro trends, and find investment opportunities.
**Your Capabilities:**
1. **Screening:** You can query the entire database to find assets that match specific criteria (e.g., "Find high-growth SaaS stocks").
2. **Macro:** You always contextualize opportunities with the current market regime (Risk-On/Off).
3. **Synthesis:** You combine screen results with macro trends to form a thesis.
4. **Search:** You can search for assets by name or symbol, and search the web for current news.

**Rules:**
- NEVER guess. If asked "How is Apple doing?", use 'search_assets' to find its ID, then tell the user to open the Apple Research page for detailed analysis.
- When running a screen, always explain *why* you chose those criteria.
- If the user asks for a portfolio, provide a diverse list of 5-10 assets with a clear thesis for each.
- Always call get_macro_context FIRST when discussing market conditions or making recommendations.
- Use generate_dynamic_ui to present screen results as tables for better visualization.`;

const CIO_TOOLKIT = [
  {
    name: "screen_assets",
    description: "Screen the database for assets matching specific fundamental or technical criteria. Returns a list of assets with key metrics. This is your primary tool for finding investment opportunities.",
    parameters: {
      type: "object",
      properties: {
        sector: { type: "string", description: "Filter by sector (e.g., Technology, Healthcare, Energy, Financials, Consumer Discretionary)" },
        industry: { type: "string", description: "Filter by industry (partial match supported)" },
        min_market_cap: { type: "number", description: "Min market cap in Billions (e.g., 10 for $10B)" },
        max_market_cap: { type: "number", description: "Max market cap in Billions" },
        min_revenue_growth: { type: "number", description: "Min quarterly revenue growth year-over-year (decimal, e.g., 0.20 for 20%)" },
        max_pe_ratio: { type: "number", description: "Max P/E ratio" },
        min_pe_ratio: { type: "number", description: "Min P/E ratio" },
        min_performance_1m: { type: "number", description: "Min 1-month return (decimal, e.g., 0.05 for 5%)" },
        max_performance_1m: { type: "number", description: "Max 1-month return (for finding laggards)" },
        min_performance_3m: { type: "number", description: "Min 3-month return" },
        limit: { type: "number", description: "Max results (default 20, max 50)" }
      }
    }
  },
  {
    name: "search_assets",
    description: "Search for assets by symbol or name. Use this to find asset IDs for detailed research or to answer questions about specific companies.",
    parameters: {
      type: "object",
      properties: {
        query: { 
          type: "string", 
          description: "Search query (symbol or company name)" 
        },
        asset_type: { 
          type: "string", 
          description: "Filter by asset type: 'equity' or 'crypto'" 
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_macro_context",
    description: "Fetches the current 'State of the Market' including Risk Regime, Interest Rates, Inflation, Commodity trends, and Sector Rotation. MANDATORY: Call this tool FIRST if the user asks about market conditions, risks, outlook, or any investment recommendation.",
    parameters: {
      type: "object",
      properties: {
        focus_sector: { 
          type: "string", 
          description: "Optional: The sector to check for specific headwinds or tailwinds (e.g., 'Technology', 'Healthcare')" 
        },
        days_back: {
          type: "number",
          description: "Number of days of macro history to analyze for trends (default: 1, max: 30)"
        }
      }
    }
  },
  {
    name: "web_search",
    description: "Search the web for current news, market conditions, or any other topic. Use this for real-time information not in the database.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" }
      },
      required: ["query"]
    }
  },
  {
    name: "generate_dynamic_ui",
    description: "Renders a visual UI component, such as a data table, in the chat. Use this to present screen results in a clean, readable format.",
    parameters: {
      type: "object",
      properties: {
        componentType: { 
          type: "string", 
          enum: ["DataTable"],
          description: "The type of component to render. Use DataTable for screening results." 
        },
        title: { type: "string", description: "The title of the table." },
        data: { 
          type: "object", 
          description: "JSON data for the table. Must include 'headers' (array of strings) and 'rows' (array of arrays of strings)." 
        },
        insight: { type: "string", description: "A one-sentence analyst takeaway to display below the table." }
      },
      required: ["componentType", "title", "data"]
    }
  }
];

// Execute web search using Google Custom Search API
async function executeWebSearch(query: string): Promise<unknown> {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
    console.warn('Google Search API not configured')
    return {
      query: query,
      error: 'Web search not configured. Please set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX environment variables.',
      timestamp: new Date().toISOString()
    }
  }

  try {
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1')
    searchUrl.searchParams.set('key', GOOGLE_SEARCH_API_KEY)
    searchUrl.searchParams.set('cx', GOOGLE_SEARCH_CX)
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('num', '10')

    console.log(`Executing web search for: "${query}"`)

    const response = await fetch(searchUrl.toString())

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Search API error:', errorText)
      return {
        query: query,
        error: `Search API error: ${response.status}`,
        timestamp: new Date().toISOString()
      }
    }

    const data = await response.json()

    const results = (data.items || []).map((item: { title: string; link: string; snippet: string; displayLink?: string }) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: item.displayLink || new URL(item.link).hostname
    }))

    return {
      query: query,
      total_results: data.searchInformation?.totalResults || results.length,
      results: results,
      timestamp: new Date().toISOString()
    }

  } catch (error) {
    console.error('Web search error:', error)
    return {
      query: query,
      error: error instanceof Error ? error.message : 'Unknown error during web search',
      timestamp: new Date().toISOString()
    }
  }
}

async function executeFunctionCall(supabase: any, toolCall: any) {
  const { name, args } = toolCall;

  switch (name) {
    case "screen_assets": {
      try {
        let query = supabase
          .from('equity_metadata')
          .select(`
            symbol, name, sector, industry, market_cap, pe_ratio,
            daily_features!inner(close, return_1w, return_1m, return_3m)
          `)
          .eq('daily_features.is_latest', true)
          .limit(Math.min(args.limit || 20, 50));

        // Apply filters
        if (args.sector) query = query.eq('sector', args.sector);
        if (args.industry) query = query.ilike('industry', `%${args.industry}%`);
        if (args.min_market_cap) query = query.gte('market_cap', args.min_market_cap * 1_000_000_000);
        if (args.max_market_cap) query = query.lte('market_cap', args.max_market_cap * 1_000_000_000);
        if (args.max_pe_ratio) query = query.lte('pe_ratio', args.max_pe_ratio);
        if (args.min_pe_ratio) query = query.gte('pe_ratio', args.min_pe_ratio);
        if (args.min_performance_1m) query = query.gte('daily_features.return_1m', args.min_performance_1m);
        if (args.max_performance_1m) query = query.lte('daily_features.return_1m', args.max_performance_1m);
        if (args.min_performance_3m) query = query.gte('daily_features.return_3m', args.min_performance_3m);

        const { data, error } = await query;

        if (error) throw new Error(error.message);

        return { 
          count: data.length,
          filters_applied: args,
          results: data.map((d: any) => ({
            symbol: d.symbol,
            name: d.name,
            sector: d.sector,
            industry: d.industry,
            market_cap_b: d.market_cap ? (d.market_cap / 1_000_000_000).toFixed(1) + 'B' : 'N/A',
            price: d.daily_features[0]?.close ? '$' + d.daily_features[0].close.toFixed(2) : 'N/A',
            perf_1m: d.daily_features[0]?.return_1m ? (d.daily_features[0].return_1m * 100).toFixed(1) + '%' : 'N/A',
            perf_3m: d.daily_features[0]?.return_3m ? (d.daily_features[0].return_3m * 100).toFixed(1) + '%' : 'N/A',
            pe_ratio: d.pe_ratio ? d.pe_ratio.toFixed(1) : 'N/A'
          }))
        };
      } catch (e) {
        return { error: e.message };
      }
    }

    case "search_assets": {
      try {
        let query = supabase
          .from('assets')
          .select('asset_id, symbol, name, asset_type, sector, industry')
          .eq('is_active', true)
          .or(`symbol.ilike.%${args.query}%,name.ilike.%${args.query}%`)
          .limit(10);
        
        if (args.asset_type) {
          query = query.eq('asset_type', args.asset_type);
        }
        
        const { data, error } = await query;
        
        if (error) return { error: error.message };
        return { assets: data || [], count: data?.length || 0, query: args.query };
      } catch (e) {
        return { error: e.message };
      }
    }

    case "get_macro_context": {
      const days_back = Math.min((args.days_back as number) || 1, 30);
      const focus_sector = args.focus_sector as string | undefined;
      
      try {
        const { data: macroData, error } = await supabase
          .from('daily_macro_metrics')
          .select('*')
          .order('date', { ascending: false })
          .limit(days_back);
        
        if (error) {
          console.error('Error fetching macro context:', error);
          return {
            error: 'Failed to fetch macro context',
            message: error.message
          };
        }
        
        if (!macroData || macroData.length === 0) {
          return {
            error: 'No macro data available',
            message: 'Macro data has not been ingested yet.'
          };
        }
        
        const latest = macroData[0];
        
        // Parse sector rotation data
        let sectorData: Record<string, number> = {};
        try {
          sectorData = typeof latest.sector_rotation === 'string' 
            ? JSON.parse(latest.sector_rotation) 
            : latest.sector_rotation || {};
        } catch (e) {
          console.error('Error parsing sector_rotation:', e);
        }
        
        // Build the response
        const response: Record<string, unknown> = {
          date: latest.date,
          market_regime: latest.market_regime,
          risk_premium: latest.risk_premium,
          rates: {
            us_10y_yield: latest.us10y_yield,
            us_2y_yield: latest.us2y_yield,
            yield_curve_spread: latest.yield_curve_10y_2y,
            yield_curve_status: latest.yield_curve_10y_2y < 0 ? 'INVERTED (Recession Warning)' : 'Normal'
          },
          credit: {
            junk_bond_price: latest.hyg_close,
            credit_appetite: latest.hyg_close > 80 ? 'Healthy' : 'Stressed'
          },
          commodities: {
            oil_price: latest.oil_close,
            oil_status: latest.oil_close > 85 ? 'High (Inflation Risk)' : latest.oil_close < 70 ? 'Low (Deflationary)' : 'Normal',
            gold_price: latest.gold_close,
            gold_status: latest.gold_close > 2000 ? 'Flight to Safety' : 'Normal'
          },
          inflation: {
            cpi_yoy: latest.cpi_yoy,
            status: latest.cpi_yoy > 3 ? 'Hot (Fed Concern)' : latest.cpi_yoy < 2 ? 'Cool' : 'Target Range'
          },
          market_breadth: {
            spy_price: latest.spy_close,
            spy_change_pct: latest.spy_change_pct
          },
          sector_rotation: sectorData
        };
        
        // Add sector-specific analysis if requested
        if (focus_sector && sectorData[focus_sector]) {
          response.sector_focus = {
            sector: focus_sector,
            performance: sectorData[focus_sector],
            interpretation: sectorData[focus_sector] > 0 ? 'Outperforming' : 'Underperforming'
          };
        }
        
        return response;
      } catch (e) {
        console.error('Macro context error:', e);
        return { error: e.message };
      }
    }

    case "web_search": {
      return await executeWebSearch(args.query as string);
    }

    case "generate_dynamic_ui": {
      // Pass through to frontend for rendering
      return {
        ui_component: {
          componentType: args.componentType,
          title: args.title,
          data: args.data,
          insight: args.insight || null
        },
        render_instruction: "FRONTEND_RENDER"
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { messages } = await req.json();

    // Convert messages to Gemini format
    const history = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    // First API call to Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: history, 
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          tools: [{ functionDeclarations: CIO_TOOLKIT }]
        }),
      }
    );

    const geminiResponse = await response.json();
    const responseContent = geminiResponse.candidates?.[0]?.content;

    if (!responseContent) {
      throw new Error('No response from Gemini API');
    }

    // Check if Gemini wants to call a function
    if (responseContent.parts?.[0]?.functionCall) {
      const toolCall = responseContent.parts[0].functionCall;
      console.log(`Executing tool: ${toolCall.name}`);
      
      const toolResult = await executeFunctionCall(supabase, toolCall);
      
      // Second API call with function result
      const secondResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              ...history,
              {
                role: 'model',
                parts: [{ functionCall: toolCall }]
              },
              {
                role: 'function',
                parts: [{ 
                  functionResponse: { 
                    name: toolCall.name, 
                    response: { content: toolResult } 
                  } 
                }]
              }
            ],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            tools: [{ functionDeclarations: CIO_TOOLKIT }]
          }),
        }
      );

      const finalResponse = await secondResponse.json();
      return new Response(JSON.stringify(finalResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // No function call, return the response directly
      return new Response(JSON.stringify(geminiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (e) {
    console.error('Global Chat API error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

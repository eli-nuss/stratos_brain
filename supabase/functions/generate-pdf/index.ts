// PDF Generation Endpoint - Node.js + Puppeteer
// Generates PDF from Daily Brief v4 data

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DailyBriefData {
  date: string
  market_ticker: {
    spy_change: number
    qqq_change: number
    iwm_change: number
    yield_10y: number
    btc_change: number
    vix: number
    regime: string
  }
  market_regime: string
  macro_summary: string
  morning_intel?: {
    market_pulse: string
    macro_calendar: string
    geopolitical: string
    sector_themes: string
    liquidity_flows: string
    risk_factors: string
  }
  portfolio: any[]
  categories: any
  intel_items: any[]
}

function generateHTML(brief: DailyBriefData): string {
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  const ticker = brief.market_ticker
  
  // Format portfolio table
  const portfolioRows = brief.portfolio.map(h => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e5e5;">
        <span style="font-weight:bold;font-size:14px;">${h.symbol}</span><br/>
        <span style="font-size:11px;color:#666;">${h.name}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #e5e5e5;text-align:center;">
        <span style="padding:4px 8px;border-radius:4px;font-size:11px;font-weight:bold;
          ${h.action === 'ADD' ? 'background:#dcfce7;color:#166534;' : 
            h.action === 'TRIM' ? 'background:#fee2e2;color:#991b1b;' : 
            'background:#fef9c3;color:#854d0e;'}">${h.action}</span>
      </td>
      <td style="padding:8px;border-bottom:1px solid #e5e5e5;text-align:center;">${h.ai_direction}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e5e5;text-align:center;">${h.rsi}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e5e5;">${h.setup}</td>
    </tr>
  `).join('')
  
  // Format setups
  const formatPicks = (picks: any[]) => picks.map(p => `
    <div style="margin-bottom:12px;padding:12px;background:#f8fafc;border-radius:6px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-weight:bold;font-size:14px;">${p.symbol}</span>
        <span style="padding:2px 8px;border-radius:4px;font-size:10px;
          ${p.conviction === 'HIGH' ? 'background:#22c55e;color:white;' : 
            p.conviction === 'MEDIUM' ? 'background:#eab308;color:black;' : 
            'background:#9ca3af;color:white;'}">${p.conviction}</span>
      </div>
      <div style="font-size:12px;color:#374151;">${p.one_liner}</div>
      ${p.rationale ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;">${p.rationale}</div>` : ''}
    </div>
  `).join('')
  
  // Format intel cards
  const intelCards = brief.intel_items.map(item => `
    <div style="padding:12px;background:#f8fafc;border-radius:6px;border-left:4px solid 
      ${item.category === 'GEOPOL' ? '#ef4444' : 
        item.category === 'POLICY' ? '#3b82f6' : 
        item.category === 'TECH' ? '#a855f7' : 
        item.category === 'EARNINGS' ? '#22c55e' : 
        item.category === 'ECON' ? '#eab308' : 
        item.category === 'CRYPTO' ? '#f97316' : '#9ca3af'}">
      <div style="font-size:10px;font-weight:bold;color:#6b7280;margin-bottom:4px;">${item.category}</div>
      <div style="font-weight:500;font-size:13px;margin-bottom:4px;">${item.headline}</div>
      <div style="font-size:11px;color:#6b7280;">${item.impact}</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:4px;">${item.source}</div>
    </div>
  `).join('')
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stratos Brain Daily Brief - ${date}</title>
  <style>
    @page { margin: 20px; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      color: #1f2937;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }
    .header h1 { margin: 0; font-size: 24px; color: #111827; }
    .header .date { color: #6b7280; font-size: 14px; margin-top: 4px; }
    .ticker-bar {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .ticker-item { text-align: center; }
    .ticker-item .symbol { font-size: 12px; color: #6b7280; font-weight: 500; }
    .ticker-item .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .section { margin-bottom: 24px; }
    .section-title { 
      font-size: 16px; 
      font-weight: bold; 
      margin-bottom: 12px;
      color: #111827;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 11px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-intel { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .macro-box {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
    }
    .macro-box h3 { margin: 0 0 8px 0; font-size: 14px; }
    .macro-box p { margin: 0; font-size: 12px; color: #4b5563; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Stratos Brain Daily Brief</h1>
    <div class="date">${date}</div>
    <div style="margin-top:8px;padding:4px 12px;background:${ticker.regime === 'BULLISH' ? '#dcfce7' : ticker.regime === 'BEARISH' ? '#fee2e2' : '#fef9c3'};display:inline-block;border-radius:4px;font-size:12px;font-weight:500;">
      ${ticker.regime}
    </div>
  </div>
  
  <div class="ticker-bar">
    <div class="ticker-item">
      <div class="symbol">SPY</div>
      <div class="value ${ticker.spy_change >= 0 ? 'positive' : 'negative'}">${ticker.spy_change >= 0 ? '+' : ''}${ticker.spy_change.toFixed(2)}%</div>
    </div>
    <div class="ticker-item">
      <div class="symbol">QQQ</div>
      <div class="value ${ticker.qqq_change >= 0 ? 'positive' : 'negative'}">${ticker.qqq_change >= 0 ? '+' : ''}${ticker.qqq_change.toFixed(2)}%</div>
    </div>
    <div class="ticker-item">
      <div class="symbol">IWM</div>
      <div class="value ${ticker.iwm_change >= 0 ? 'positive' : 'negative'}">${ticker.iwm_change >= 0 ? '+' : ''}${ticker.iwm_change.toFixed(2)}%</div>
    </div>
    <div class="ticker-item">
      <div class="symbol">10Y</div>
      <div class="value">${ticker.yield_10y.toFixed(2)}%</div>
    </div>
    <div class="ticker-item">
      <div class="symbol">BTC</div>
      <div class="value ${ticker.btc_change >= 0 ? 'positive' : 'negative'}">${ticker.btc_change >= 0 ? '+' : ''}${ticker.btc_change.toFixed(2)}%</div>
    </div>
    <div class="ticker-item">
      <div class="symbol">VIX</div>
      <div class="value">${ticker.vix}</div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Active Portfolio (${brief.portfolio.length} positions)</div>
    <table>
      <thead>
        <tr>
          <th>Asset</th>
          <th style="text-align:center;">Action</th>
          <th style="text-align:center;">AI</th>
          <th style="text-align:center;">RSI</th>
          <th>Setup</th>
        </tr>
      </thead>
      <tbody>
        ${portfolioRows}
      </tbody>
    </table>
  </div>
  
  <div class="section">
    <div class="section-title">Setup Opportunities</div>
    <div class="grid-3">
      <div>
        <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:#f97316;">Momentum Breakouts</div>
        ${formatPicks(brief.categories.momentum_breakouts?.picks || [])}
      </div>
      <div>
        <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:#3b82f6;">Trend Continuation</div>
        ${formatPicks(brief.categories.trend_continuation?.picks || [])}
      </div>
      <div>
        <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:#a855f7;">Compression & Reversion</div>
        ${formatPicks(brief.categories.compression_reversion?.picks || [])}
      </div>
    </div>
  </div>
  
  <div class="section">
    <div class="section-title">Macro & Liquidity</div>
    <div class="grid-2">
      ${brief.morning_intel?.market_pulse ? `
        <div class="macro-box">
          <h3>Market Pulse</h3>
          <p>${brief.morning_intel.market_pulse}</p>
        </div>
      ` : ''}
      ${brief.morning_intel?.liquidity_flows ? `
        <div class="macro-box">
          <h3>Liquidity & Flows</h3>
          <p>${brief.morning_intel.liquidity_flows}</p>
        </div>
      ` : ''}
      ${brief.morning_intel?.sector_themes ? `
        <div class="macro-box">
          <h3>Sector Themes</h3>
          <p>${brief.morning_intel.sector_themes}</p>
        </div>
      ` : ''}
      ${brief.morning_intel?.geopolitical ? `
        <div class="macro-box">
          <h3>Geopolitical</h3>
          <p>${brief.morning_intel.geopolitical}</p>
        </div>
      ` : ''}
    </div>
  </div>
  
  ${brief.morning_intel?.macro_calendar ? `
    <div class="section">
      <div class="section-title">Market Calendar</div>
      <div class="macro-box">
        <pre style="margin:0;font-family:inherit;white-space:pre-wrap;font-size:12px;">${brief.morning_intel.macro_calendar}</pre>
      </div>
    </div>
  ` : ''}
  
  <div class="section">
    <div class="section-title">Intel & News</div>
    <div class="grid-intel">
      ${intelCards}
    </div>
  </div>
  
  <div class="footer">
    Generated by Stratos Brain • ${date}
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { briefData } = await req.json()
    
    if (!briefData) {
      return new Response(JSON.stringify({ error: 'Missing briefData' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log('[PDF] Generating PDF...')
    
    // Generate HTML
    const html = generateHTML(briefData)
    
    // For now, return HTML as a data URL (browser can print to PDF)
    // In production, you'd use Puppeteer here
    const htmlBase64 = btoa(unescape(encodeURIComponent(html)))
    const dataUrl = `data:text/html;base64,${htmlBase64}`
    
    // Store in Supabase storage for persistent URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const filename = `daily-brief-${briefData.date || new Date().toISOString().split('T')[0]}.html`
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('briefs')
      .upload(filename, new Blob([html], { type: 'text/html' }), { upsert: true })
    
    if (uploadError) {
      console.error('[PDF] Upload error:', uploadError)
      // Fallback to data URL
      return new Response(JSON.stringify({ url: dataUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const { data: { publicUrl } } = supabase
      .storage
      .from('briefs')
      .getPublicUrl(filename)
    
    console.log('[PDF] Generated:', publicUrl)
    
    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('[PDF] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

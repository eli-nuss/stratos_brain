import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api/dashboard';
const STRATOS_API_KEY = process.env.STRATOS_BRAIN_API_KEY || 'stratos_brain_api_key_2024';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get the path from the catch-all route
    const pathSegments = req.query.path;
    const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';
    
    // Build the target URL
    const url = new URL(`${SUPABASE_URL}/${path}`);
    
    // Add query parameters
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    console.log(`Proxying to: ${url.toString()}`);

    // Make the request to Supabase
    const response = await fetch(url.toString(), {
      method: req.method || 'GET',
      headers: {
        'x-stratos-key': STRATOS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal Proxy Error', details: String(error) });
  }
}

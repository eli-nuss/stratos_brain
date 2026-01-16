// Vercel Edge Function to proxy dashboard API requests with proper authentication
// This adds the Authorization header with the Supabase anon key

export const config = {
  runtime: 'edge',
};

const SUPABASE_URL = 'https://wfogbaipiqootjrsprde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw';
const STRATOS_API_KEY = 'stratos_brain_api_key_2024';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/dashboard', '');
  
  // Build the target URL
  const targetUrl = `${SUPABASE_URL}/functions/v1/control-api/dashboard${path}${url.search}`;
  
  // Forward the request with proper headers
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
  headers.set('x-stratos-key', STRATOS_API_KEY);
  
  // Remove host header to avoid conflicts
  headers.delete('host');
  
  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    });
    
    // Create response with CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

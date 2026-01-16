/**
 * API Configuration
 * 
 * Contains the authentication headers needed for Supabase Edge Functions
 */

// Use direct Supabase URL since Vercel rewrites don't forward auth headers
export const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api';

// Supabase anon key for API authentication
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw';

// Stratos API key for additional authentication
export const STRATOS_API_KEY = 'stratos_brain_api_key_2024';

/**
 * Get the default headers for API requests
 */
export function getApiHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'x-stratos-key': STRATOS_API_KEY,
  };
}

/**
 * Get headers for JSON API requests
 */
export function getJsonApiHeaders(): HeadersInit {
  return {
    ...getApiHeaders(),
    'Content-Type': 'application/json',
  };
}

/**
 * Enhanced fetcher for SWR hooks with auth headers
 * Converts /api/dashboard paths to direct Supabase URLs
 */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  // Convert /api/dashboard paths to direct Supabase URL
  const fullUrl = url.startsWith('/api/dashboard') 
    ? url.replace('/api/dashboard', API_BASE + '/dashboard')
    : url.startsWith('/api/')
    ? url.replace('/api/', API_BASE + '/')
    : url;
  
  const response = await fetch(fullUrl, {
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API] Error [${response.status}] on ${url}: ${errorText}`);
    
    // Return empty array for auth errors to prevent UI breakage
    if (response.status === 401 || response.status === 403) {
      console.warn('[API] Auth error, returning empty data');
      return [] as unknown as T;
    }
    
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Handle error responses that return as JSON
  if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
    console.error(`[API] Error response: ${(data as { message: string }).message}`);
    return [] as unknown as T;
  }
  
  return data as T;
}

/**
 * Default SWR configuration for API hooks
 */
export const defaultSwrConfig = {
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  revalidateOnFocus: true,
  keepPreviousData: true,
  onError: (err: Error, key: string) => {
    console.error(`[SWR] Error fetching ${key}:`, err);
  }
};

// Export headers for direct use
export const API_HEADERS = getApiHeaders();

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  // Convert /api/dashboard paths to direct Supabase URL
  const fullUrl = url.startsWith('/api/dashboard') 
    ? url.replace('/api/dashboard', API_BASE + '/dashboard')
    : url.startsWith('/api/')
    ? url.replace('/api/', API_BASE + '/')
    : url;
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`API POST Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * PUT request helper
 */
export async function apiPut<T = unknown>(url: string, body: unknown): Promise<T> {
  // Convert /api/dashboard paths to direct Supabase URL
  const fullUrl = url.startsWith('/api/dashboard') 
    ? url.replace('/api/dashboard', API_BASE + '/dashboard')
    : url.startsWith('/api/')
    ? url.replace('/api/', API_BASE + '/')
    : url;
  
  const response = await fetch(fullUrl, {
    method: 'PUT',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`API PUT Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * PATCH request helper
 */
export async function apiPatch<T = unknown>(url: string, body: unknown): Promise<T> {
  // Convert /api/dashboard paths to direct Supabase URL
  const fullUrl = url.startsWith('/api/dashboard') 
    ? url.replace('/api/dashboard', API_BASE + '/dashboard')
    : url.startsWith('/api/')
    ? url.replace('/api/', API_BASE + '/')
    : url;
  
  const response = await fetch(fullUrl, {
    method: 'PATCH',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`API PATCH Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * DELETE request helper
 */
export async function apiDelete(url: string): Promise<void> {
  // Convert /api/dashboard paths to direct Supabase URL
  const fullUrl = url.startsWith('/api/dashboard') 
    ? url.replace('/api/dashboard', API_BASE + '/dashboard')
    : url.startsWith('/api/')
    ? url.replace('/api/', API_BASE + '/')
    : url;
  
  const response = await fetch(fullUrl, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    throw new Error(`API DELETE Error: ${response.status}`);
  }
}

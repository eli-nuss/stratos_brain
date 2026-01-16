/**
 * API Configuration
 * 
 * Contains the authentication headers needed for Supabase Edge Functions
 */

export const API_BASE = '/api';

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
 */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, {
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

/**
 * API Configuration
 * 
 * Contains the authentication headers needed for Supabase Edge Functions
 */

import { supabase } from './supabase';

// Use direct Supabase URL since Vercel rewrites don't forward auth headers
export const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api';

// Supabase anon key for API authentication
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw';

// Stratos API key for additional authentication
export const STRATOS_API_KEY = 'stratos_brain_api_key_2024';

// Cache for current user ID to avoid async calls in sync functions
let cachedUserId: string | null = null;
let cachedAccessToken: string | null = null;

// Initialize and update cached user info
export async function updateCachedAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    cachedUserId = session?.user?.id || null;
    cachedAccessToken = session?.access_token || null;
  } catch {
    cachedUserId = null;
    cachedAccessToken = null;
  }
}

// Get cached user ID (synchronous)
export function getCachedUserId(): string | null {
  return cachedUserId;
}

// Get cached access token (synchronous)
export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

// Set up auth state listener to keep cache updated
supabase.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id || null;
  cachedAccessToken = session?.access_token || null;
});

// Initialize cache on module load
updateCachedAuth();

/**
 * Get the default headers for API requests
 * Includes user ID header if authenticated
 */
export function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Authorization': `Bearer ${cachedAccessToken || SUPABASE_ANON_KEY}`,
    'x-stratos-key': STRATOS_API_KEY,
  };
  
  // Add user ID header if authenticated
  if (cachedUserId) {
    (headers as Record<string, string>)['x-user-id'] = cachedUserId;
  }
  
  return headers;
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
 * Optimized for snappy performance with stale-while-revalidate pattern
 */
export const defaultSwrConfig = {
  // Retry configuration
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  
  // Revalidation settings
  revalidateOnFocus: false,      // Don't refetch on tab focus (reduces unnecessary requests)
  revalidateOnReconnect: true,   // Refetch when network reconnects
  revalidateIfStale: true,       // Revalidate in background if data is stale
  
  // Caching settings for snappy UX
  keepPreviousData: true,        // Show old data while fetching new
  dedupingInterval: 5000,        // Dedupe requests within 5 seconds
  focusThrottleInterval: 30000,  // Throttle focus revalidation to 30s
  
  // Error handling
  onError: (err: Error, key: string) => {
    console.error(`[SWR] Error fetching ${key}:`, err);
  }
};

/**
 * SWR config for data that changes frequently (watchlist, portfolios)
 */
export const frequentUpdateSwrConfig = {
  ...defaultSwrConfig,
  refreshInterval: 30000,        // Refresh every 30 seconds
  dedupingInterval: 2000,        // Shorter dedupe for more responsive updates
};

/**
 * SWR config for static/slow-changing data (asset metadata, templates)
 */
export const staticDataSwrConfig = {
  ...defaultSwrConfig,
  revalidateOnFocus: false,
  revalidateIfStale: false,      // Only revalidate on explicit mutate
  dedupingInterval: 60000,       // Dedupe for 1 minute
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

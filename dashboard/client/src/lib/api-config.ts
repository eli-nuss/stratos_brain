/**
 * API Configuration
 * 
 * Contains the authentication headers needed for Supabase Edge Functions
 * Includes automatic stale auth detection and recovery
 * 
 * v2: Refactored to use centralized auth-storage utility for consistency
 */

import { supabase } from './supabase';
import { 
  getStoredUserId, 
  getStoredAccessToken, 
  hasValidStoredAuth,
  clearAllAuthData,
  AUTH_STATE_CHANGED_EVENT 
} from './auth-storage';

// Use direct Supabase URL since Vercel rewrites don't forward auth headers
export const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api';

// Daily Brief API base URL
export const DAILY_BRIEF_API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/daily-brief-api';

// Daily Brief V3 API URL
export const DAILY_BRIEF_V3_API = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/daily-brief-api-v3';

// Daily Brief V4 API URL (unified web + PDF)
export const DAILY_BRIEF_V4_API = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/daily-brief-api-v4';

// PDF Generation API URL
export const PDF_GENERATE_API = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/generate-pdf';

// Global Chat API base URL (Brain Chat)
export const GLOBAL_CHAT_API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/global-chat-api';

// API URL mapping
const API_URLS: Record<string, string> = {
  DAILY_BRIEF_V3: DAILY_BRIEF_V3_API,
  DAILY_BRIEF: DAILY_BRIEF_API_BASE,
  DAILY_BRIEF_V4: DAILY_BRIEF_V4_API,
  PDF_GENERATE: PDF_GENERATE_API,
};

/**
 * Get API URL by key
 */
export function getApiUrl(key: string): string {
  return API_URLS[key] || '';
}

// Supabase anon key for API authentication
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw';

// Stratos API key for additional authentication
export const STRATOS_API_KEY = 'stratos_brain_api_key_2024';

// Auth error tracking for stale auth detection
let authErrorCount = 0;
let lastAuthErrorTime = 0;
const AUTH_ERROR_THRESHOLD = 3;
const AUTH_ERROR_WINDOW = 10000; // 10 seconds

// Flag to track if we're currently recovering from stale auth
let isRecoveringAuth = false;

// Cache for auth data - updated via Supabase auth state listener
let cachedUserId: string | null = null;
let cachedAccessToken: string | null = null;

/**
 * Initialize cached auth from storage
 * This is called on module load and after auth state changes
 */
function initCachedAuth(): void {
  cachedUserId = getStoredUserId();
  cachedAccessToken = getStoredAccessToken();
  console.log('[api-config] Auth cache initialized:', {
    hasUserId: !!cachedUserId,
    hasToken: !!cachedAccessToken
  });
}

// Initialize on module load
initCachedAuth();

/**
 * Update cached auth from Supabase session
 * This should be called when auth state changes
 */
export async function updateCachedAuth(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    cachedUserId = session?.user?.id || null;
    cachedAccessToken = session?.access_token || null;
    // Reset error count on successful auth update
    authErrorCount = 0;
    console.log('[api-config] Auth cache updated from session:', {
      hasUserId: !!cachedUserId,
      hasToken: !!cachedAccessToken
    });
  } catch (err) {
    console.error('[api-config] Failed to update cached auth:', err);
    // Fall back to storage
    initCachedAuth();
  }
}

/**
 * Get cached user ID (synchronous)
 * Falls back to storage if cache is empty
 */
export function getCachedUserId(): string | null {
  if (cachedUserId) return cachedUserId;
  // Fall back to storage
  return getStoredUserId();
}

/**
 * Get cached access token (synchronous)
 * Falls back to storage if cache is empty
 */
export function getCachedAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  // Fall back to storage
  return getStoredAccessToken();
}

/**
 * Check if we have a valid auth token (user appears to be logged in)
 */
export function hasAuthToken(): boolean {
  const token = getCachedAccessToken();
  return token !== null && token !== SUPABASE_ANON_KEY;
}

/**
 * Force refresh the auth token via Supabase
 */
async function forceRefreshToken(): Promise<boolean> {
  console.log('[Auth Recovery] Attempting to refresh token...');
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('[Auth Recovery] Token refresh failed:', error.message);
      return false;
    }
    if (data.session) {
      cachedUserId = data.session.user?.id || null;
      cachedAccessToken = data.session.access_token || null;
      console.log('[Auth Recovery] Token refreshed successfully');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Auth Recovery] Token refresh exception:', err);
    return false;
  }
}

/**
 * Clear stale auth and force re-login
 * This is the nuclear option when token refresh fails
 */
async function clearStaleAuth(): Promise<void> {
  console.log('[Auth Recovery] Clearing stale auth data...');
  
  // Clear cached values
  cachedUserId = null;
  cachedAccessToken = null;
  
  // Sign out to clear Supabase state
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    console.error('[Auth Recovery] Error during signout:', err);
  }
  
  // Clear all auth data from storage
  clearAllAuthData();
  
  // Notify user
  console.log('[Auth Recovery] Stale auth cleared. Please sign in again.');
  
  // Dispatch custom event so UI can react
  window.dispatchEvent(new CustomEvent('stale-auth-cleared'));
}

/**
 * Handle auth errors and trigger recovery if needed
 * Returns true if the request should be retried
 */
async function handleAuthError(): Promise<boolean> {
  const now = Date.now();
  
  // Reset counter if outside the error window
  if (now - lastAuthErrorTime > AUTH_ERROR_WINDOW) {
    authErrorCount = 0;
  }
  
  authErrorCount++;
  lastAuthErrorTime = now;
  
  console.log(`[Auth Recovery] Auth error count: ${authErrorCount}/${AUTH_ERROR_THRESHOLD}`);
  
  // If we've hit the threshold, try to recover
  if (authErrorCount >= AUTH_ERROR_THRESHOLD && !isRecoveringAuth) {
    isRecoveringAuth = true;
    
    // First try to refresh the token
    const refreshed = await forceRefreshToken();
    if (refreshed) {
      authErrorCount = 0;
      isRecoveringAuth = false;
      return true; // Token refreshed, retry the request
    }
    
    // If refresh failed, clear stale auth
    await clearStaleAuth();
    isRecoveringAuth = false;
    
    // Reload the page to get fresh state
    window.location.reload();
    return false;
  }
  
  return false;
}

// Listen for auth state changes from Supabase
supabase.auth.onAuthStateChange((_event, session) => {
  console.log('[api-config] Auth state changed:', _event);
  cachedUserId = session?.user?.id || null;
  cachedAccessToken = session?.access_token || null;
  // Reset error count on auth state change
  authErrorCount = 0;
});

// Also listen for our custom auth state changed event
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_STATE_CHANGED_EVENT, () => {
    console.log('[api-config] Custom auth state changed event received');
    initCachedAuth();
  });
}

/**
 * Get the default headers for API requests
 * Uses anon key if no valid auth token is available
 */
export function getApiHeaders(): HeadersInit {
  // Get the current token, preferring cache but falling back to storage
  const authToken = getCachedAccessToken() || SUPABASE_ANON_KEY;
  const userId = getCachedUserId();
  
  const headers: HeadersInit = {
    'Authorization': `Bearer ${authToken}`,
    'x-stratos-key': STRATOS_API_KEY,
  };
  
  // Add user ID header if authenticated
  if (userId) {
    (headers as Record<string, string>)['x-user-id'] = userId;
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
 * Includes automatic stale auth detection and recovery
 */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  // Convert /api paths to direct Supabase URLs
  let fullUrl = url;
  if (url.startsWith('/api/global-chat-api')) {
    fullUrl = url.replace('/api/global-chat-api', GLOBAL_CHAT_API_BASE);
  } else if (url.startsWith('/api/daily-brief')) {
    fullUrl = url.replace('/api/daily-brief', DAILY_BRIEF_API_BASE);
  } else if (url.startsWith('/api/dashboard')) {
    fullUrl = url.replace('/api/dashboard', API_BASE + '/dashboard');
  } else if (url.startsWith('/api/supply-chain')) {
    // Supply chain API is served directly by the Express server
    fullUrl = url;
  } else if (url.startsWith('/api/')) {
    fullUrl = url.replace('/api/', API_BASE + '/');
  }
  
  const response = await fetch(fullUrl, {
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API] Error [${response.status}] on ${url}: ${errorText}`);
    
    // Handle auth errors with automatic recovery
    if (response.status === 401 || response.status === 403) {
      console.warn('[API] Auth error detected');
      
      // Only try to recover if we thought we were logged in
      if (hasAuthToken()) {
        const recovered = await handleAuthError();
        if (recovered) {
          // Retry the request with refreshed token
          console.log('[API] Retrying request after token refresh...');
          const retryResponse = await fetch(fullUrl, {
            headers: getApiHeaders(),
          });
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
      }
      
      // Return empty array for auth errors to prevent UI breakage
      return [] as unknown as T;
    }
    
    throw new Error(`API Error: ${response.status}`);
  }
  
  // Reset error count on successful request
  authErrorCount = 0;
  
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
 * POST request helper with auth recovery
 */
export async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  // Convert /api paths to direct Supabase URLs
  let fullUrl = url;
  if (url.startsWith('/api/global-chat-api')) {
    fullUrl = url.replace('/api/global-chat-api', GLOBAL_CHAT_API_BASE);
  } else if (url.startsWith('/api/daily-brief')) {
    fullUrl = url.replace('/api/daily-brief', DAILY_BRIEF_API_BASE);
  } else if (url.startsWith('/api/dashboard')) {
    fullUrl = url.replace('/api/dashboard', API_BASE + '/dashboard');
  } else if (url.startsWith('/api/supply-chain')) {
    // Supply chain API is served directly by the Express server
    fullUrl = url;
  } else if (url.startsWith('/api/')) {
    fullUrl = url.replace('/api/', API_BASE + '/');
  }
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    // Handle auth errors with automatic recovery
    if ((response.status === 401 || response.status === 403) && hasAuthToken()) {
      const recovered = await handleAuthError();
      if (recovered) {
        const retryResponse = await fetch(fullUrl, {
          method: 'POST',
          headers: getJsonApiHeaders(),
          body: JSON.stringify(body),
        });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
      }
    }
    throw new Error(`API POST Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * PUT request helper with auth recovery
 */
export async function apiPut<T = unknown>(url: string, body: unknown): Promise<T> {
  // Convert /api paths to direct Supabase URLs
  let fullUrl = url;
  if (url.startsWith('/api/global-chat-api')) {
    fullUrl = url.replace('/api/global-chat-api', GLOBAL_CHAT_API_BASE);
  } else if (url.startsWith('/api/daily-brief')) {
    fullUrl = url.replace('/api/daily-brief', DAILY_BRIEF_API_BASE);
  } else if (url.startsWith('/api/dashboard')) {
    fullUrl = url.replace('/api/dashboard', API_BASE + '/dashboard');
  } else if (url.startsWith('/api/supply-chain')) {
    // Supply chain API is served directly by the Express server
    fullUrl = url;
  } else if (url.startsWith('/api/')) {
    fullUrl = url.replace('/api/', API_BASE + '/');
  }
  
  const response = await fetch(fullUrl, {
    method: 'PUT',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    // Handle auth errors with automatic recovery
    if ((response.status === 401 || response.status === 403) && hasAuthToken()) {
      const recovered = await handleAuthError();
      if (recovered) {
        const retryResponse = await fetch(fullUrl, {
          method: 'PUT',
          headers: getJsonApiHeaders(),
          body: JSON.stringify(body),
        });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
      }
    }
    throw new Error(`API PUT Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * PATCH request helper with auth recovery
 */
export async function apiPatch<T = unknown>(url: string, body: unknown): Promise<T> {
  // Convert /api paths to direct Supabase URLs
  let fullUrl = url;
  if (url.startsWith('/api/global-chat-api')) {
    fullUrl = url.replace('/api/global-chat-api', GLOBAL_CHAT_API_BASE);
  } else if (url.startsWith('/api/daily-brief')) {
    fullUrl = url.replace('/api/daily-brief', DAILY_BRIEF_API_BASE);
  } else if (url.startsWith('/api/dashboard')) {
    fullUrl = url.replace('/api/dashboard', API_BASE + '/dashboard');
  } else if (url.startsWith('/api/supply-chain')) {
    // Supply chain API is served directly by the Express server
    fullUrl = url;
  } else if (url.startsWith('/api/')) {
    fullUrl = url.replace('/api/', API_BASE + '/');
  }
  
  const response = await fetch(fullUrl, {
    method: 'PATCH',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    // Handle auth errors with automatic recovery
    if ((response.status === 401 || response.status === 403) && hasAuthToken()) {
      const recovered = await handleAuthError();
      if (recovered) {
        const retryResponse = await fetch(fullUrl, {
          method: 'PATCH',
          headers: getJsonApiHeaders(),
          body: JSON.stringify(body),
        });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
      }
    }
    throw new Error(`API PATCH Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * DELETE request helper with auth recovery
 */
export async function apiDelete<T = unknown>(url: string): Promise<T> {
  // Convert /api paths to direct Supabase URLs
  let fullUrl = url;
  if (url.startsWith('/api/global-chat-api')) {
    fullUrl = url.replace('/api/global-chat-api', GLOBAL_CHAT_API_BASE);
  } else if (url.startsWith('/api/daily-brief')) {
    fullUrl = url.replace('/api/daily-brief', DAILY_BRIEF_API_BASE);
  } else if (url.startsWith('/api/dashboard')) {
    fullUrl = url.replace('/api/dashboard', API_BASE + '/dashboard');
  } else if (url.startsWith('/api/supply-chain')) {
    // Supply chain API is served directly by the Express server
    fullUrl = url;
  } else if (url.startsWith('/api/')) {
    fullUrl = url.replace('/api/', API_BASE + '/');
  }
  
  const response = await fetch(fullUrl, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    // Handle auth errors with automatic recovery
    if ((response.status === 401 || response.status === 403) && hasAuthToken()) {
      const recovered = await handleAuthError();
      if (recovered) {
        const retryResponse = await fetch(fullUrl, {
          method: 'DELETE',
          headers: getApiHeaders(),
        });
        if (retryResponse.ok) {
          return retryResponse.json();
        }
      }
    }
    throw new Error(`API DELETE Error: ${response.status}`);
  }
  
  return response.json();
}

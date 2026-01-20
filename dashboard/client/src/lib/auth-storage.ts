/**
 * Centralized Auth Storage Utility
 * 
 * This module provides a single source of truth for auth token storage and retrieval.
 * It ensures consistency across all parts of the application that need to access
 * authentication state.
 * 
 * Key Design Decisions:
 * 1. Single storage key for all auth data
 * 2. Synchronous getters for use in non-async contexts
 * 3. Event-based notifications for auth state changes
 * 4. Graceful handling of corrupted/expired tokens
 */

// The storage key used by Supabase client - MUST match supabase.ts config
export const AUTH_STORAGE_KEY = 'stratos-auth-token';

// Event name for auth state changes
export const AUTH_STATE_CHANGED_EVENT = 'stratos-auth-state-changed';

// Interface for stored auth data
interface StoredAuthData {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
}

/**
 * Get the raw auth data from localStorage
 * Returns null if no data exists or if parsing fails
 */
export function getStoredAuthData(): StoredAuthData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    return data as StoredAuthData;
  } catch (err) {
    console.warn('[auth-storage] Failed to parse stored auth data:', err);
    return null;
  }
}

/**
 * Get the user ID from stored auth data (synchronous)
 */
export function getStoredUserId(): string | null {
  const data = getStoredAuthData();
  return data?.user?.id || null;
}

/**
 * Get the access token from stored auth data (synchronous)
 */
export function getStoredAccessToken(): string | null {
  const data = getStoredAuthData();
  return data?.access_token || null;
}

/**
 * Check if there's a valid auth token stored
 * This checks both presence and expiration
 */
export function hasValidStoredAuth(): boolean {
  const data = getStoredAuthData();
  if (!data?.access_token || !data?.user?.id) return false;
  
  // Check if token is expired
  if (data.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    // Add a 60 second buffer to account for clock skew
    if (data.expires_at < now + 60) {
      console.log('[auth-storage] Token is expired or about to expire');
      return false;
    }
  }
  
  return true;
}

/**
 * Clear all auth data from localStorage
 * This is more aggressive than Supabase's signOut and ensures clean state
 */
export function clearAllAuthData(): void {
  if (typeof window === 'undefined') return;
  
  console.log('[auth-storage] Clearing all auth data...');
  
  // Remove the main auth storage key
  localStorage.removeItem(AUTH_STORAGE_KEY);
  
  // Also remove any legacy Supabase keys that might exist
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('sb-') ||
      key.includes('supabase') ||
      key === 'stratos-auth-token'
    )) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    console.log('[auth-storage] Removing key:', key);
    localStorage.removeItem(key);
  });
  
  // Dispatch event to notify listeners
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
    detail: { type: 'cleared' }
  }));
}

/**
 * Notify listeners that auth state has changed
 * This should be called after successful login/logout
 */
export function notifyAuthStateChanged(type: 'login' | 'logout' | 'refresh'): void {
  if (typeof window === 'undefined') return;
  
  window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
    detail: { type }
  }));
}

/**
 * Debug function to log current auth storage state
 */
export function debugAuthStorage(): void {
  console.group('[auth-storage] Debug Info');
  
  const data = getStoredAuthData();
  console.log('Has stored data:', !!data);
  console.log('User ID:', data?.user?.id || 'none');
  console.log('Has access token:', !!data?.access_token);
  
  if (data?.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = data.expires_at - now;
    console.log('Token expires in:', expiresIn, 'seconds');
    console.log('Token is valid:', expiresIn > 60);
  }
  
  // List all auth-related localStorage keys
  const authKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('sb-') ||
      key.includes('supabase') ||
      key.includes('stratos') ||
      key.includes('auth')
    )) {
      authKeys.push(key);
    }
  }
  console.log('Auth-related localStorage keys:', authKeys);
  
  console.groupEnd();
}

// Export a function to check auth health
export function checkAuthHealth(): { healthy: boolean; issues: string[] } {
  const issues: string[] = [];
  
  const data = getStoredAuthData();
  
  if (!data) {
    return { healthy: true, issues: [] }; // No auth data is fine (not logged in)
  }
  
  // Check for missing user ID
  if (data.access_token && !data.user?.id) {
    issues.push('Access token exists but user ID is missing');
  }
  
  // Check for expired token
  if (data.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (data.expires_at < now) {
      issues.push('Access token is expired');
    }
  }
  
  // Check for corrupted data
  if (data.access_token && typeof data.access_token !== 'string') {
    issues.push('Access token is not a string');
  }
  
  return {
    healthy: issues.length === 0,
    issues
  };
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wfogbaipiqootjrsprde.supabase.co';
// Updated anon key - the previous key was rotated/invalidated
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw';

/**
 * Custom lock implementation with timeout to prevent deadlocks.
 * This is a workaround for the Supabase Auth lock acquisition issue:
 * https://github.com/supabase/supabase-js/issues/1594
 * 
 * The default Supabase lock uses Navigator.locks API with infinite timeout,
 * which can cause deadlocks when locks aren't properly released (e.g., after
 * browser crashes, tab closures, or race conditions during OAuth callbacks).
 */
const lockWithTimeout = async (
  name: string,
  acquireTimeout: number,
  fn: () => Promise<any>
): Promise<any> => {
  // If Navigator.locks is not available, just run the function
  if (typeof navigator === 'undefined' || !navigator.locks) {
    return await fn();
  }

  // Try to acquire lock with a timeout
  const lockTimeout = 5000; // 5 second timeout for lock acquisition
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.warn('[Supabase] Lock acquisition timeout, proceeding without lock');
      // If we timeout, just run the function anyway
      fn().then(resolve).catch(reject);
    }, lockTimeout);

    navigator.locks.request(
      name,
      { mode: 'exclusive' },
      async () => {
        clearTimeout(timeoutId);
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
        // Return a promise that resolves when we're done
        return;
      }
    ).catch((error) => {
      clearTimeout(timeoutId);
      // If lock request fails, still try to run the function
      console.warn('[Supabase] Lock request failed, proceeding without lock:', error);
      fn().then(resolve).catch(reject);
    });
  });
};

/**
 * Alternative: No-op lock that skips locking entirely.
 * Use this if the timeout-based lock still causes issues.
 * The risk is potential race conditions with multiple tabs,
 * but for most single-tab use cases this is fine.
 */
const noOpLock = async (
  name: string,
  acquireTimeout: number,
  fn: () => Promise<any>
): Promise<any> => {
  return await fn();
};

// Create Supabase client with auth configuration
// Using PKCE flow which is more reliable for OAuth redirects
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Enable automatic URL detection - let Supabase handle the OAuth code exchange
    detectSessionInUrl: true,
    // Use PKCE flow for better security and reliability with OAuth
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'stratos-auth-token',
    // Use no-op lock to prevent deadlocks from Navigator.locks API issues
    // This is safe for single-tab usage and prevents the AbortError
    lock: noOpLock,
  },
});

// Types for user data
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreference {
  id: number;
  user_id: string;
  preference_key: string;
  preference_value: any;
  updated_at: string;
}

export interface UserActivity {
  id: number;
  user_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: number;
  metadata: any;
  created_at: string;
}

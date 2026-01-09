import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wfogbaipiqootjrsprde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNjQ3NzEsImV4cCI6MjA0ODc0MDc3MX0.LQEvaVwrk-Vc8QJpfMnfpfYHvOCKg-lZpYwzQcL8xGM';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Immediately process OAuth hash if present (runs on module load)
(async function processOAuthCallback() {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    console.log('[Supabase] OAuth hash detected, processing...');
    
    // Parse hash params
    const params: Record<string, string> = {};
    const hashContent = hash.substring(1);
    hashContent.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
    
    const accessToken = params['access_token'];
    const refreshToken = params['refresh_token'];
    
    if (accessToken && refreshToken) {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.error('[Supabase] Error setting session:', error);
        } else if (data.session) {
          console.log('[Supabase] Session set successfully:', data.session.user?.email);
          // Clean up URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch (err) {
        console.error('[Supabase] Exception:', err);
      }
    }
  }
})();

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

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wfogbaipiqootjrsprde.supabase.co';
// Updated anon key - the previous key was rotated/invalidated
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw';

// Create Supabase client with auth configuration
// Using implicit flow with manual token handling to work around Chrome's
// bounce tracking mitigation that blocks Supabase's automatic session detection
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // Disable automatic URL detection - we handle it manually in AuthCallback
    // This avoids Chrome blocking Supabase's internal storage operations during redirect
    detectSessionInUrl: false,
    flowType: 'implicit',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'stratos-auth-token',
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

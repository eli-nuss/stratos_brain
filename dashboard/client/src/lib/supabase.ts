import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wfogbaipiqootjrsprde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNjQ3NzEsImV4cCI6MjA0ODc0MDc3MX0.LQEvaVwrk-Vc8QJpfMnfpfYHvOCKg-lZpYwzQcL8xGM';

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

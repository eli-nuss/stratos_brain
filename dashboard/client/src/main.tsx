import { createRoot } from "react-dom/client";
import { createClient } from '@supabase/supabase-js';
import App from "./App";
import "./index.css";

// Initialize Supabase client for auth processing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Process OAuth callback hash before React renders
async function processAuthCallback() {
  const hash = window.location.hash;
  
  console.log('[Main] Checking for OAuth callback...');
  
  if (hash && hash.includes('access_token')) {
    console.log('[Main] OAuth callback detected, processing...');
    
    // Parse the hash
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
      console.log('[Main] Setting session from tokens...');
      
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.error('[Main] Error setting session:', error);
        } else if (data.session) {
          console.log('[Main] Session set successfully:', data.session.user?.email);
          // Clean up the URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } catch (err) {
        console.error('[Main] Exception setting session:', err);
      }
    }
  } else {
    console.log('[Main] No OAuth callback in URL');
  }
}

// Process auth callback then render app
processAuthCallback().then(() => {
  console.log('[Main] Rendering app...');
  createRoot(document.getElementById("root")!).render(<App />);
});

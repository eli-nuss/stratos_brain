import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in React strict mode
    if (hasProcessed.current) {
      console.log('[AuthCallback] Already processed, skipping...');
      return;
    }
    hasProcessed.current = true;

    const handleCallback = async () => {
      console.log('[AuthCallback] Starting callback processing...');
      console.log('[AuthCallback] Full URL:', window.location.href);

      try {
        // Check for error in URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (errorParam) {
          throw new Error(`Authentication error: ${errorDescription || errorParam}`);
        }

        // Check if there's a code in the URL that needs processing (PKCE flow)
        const code = urlParams.get('code');
        
        if (code) {
          console.log('[AuthCallback] Auth code found, exchanging for session...');
          
          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[AuthCallback] Code exchange error:', exchangeError);
            throw exchangeError;
          }
          
          console.log('[AuthCallback] Exchange result:', data);
          
          if (data.session) {
            console.log('[AuthCallback] Session established via code exchange for:', data.session.user.email);
            
            // Validate domain restriction
            const email = data.session.user.email || '';
            if (!email.endsWith('@stratos.xyz')) {
              console.warn('[AuthCallback] Domain restriction: user email not @stratos.xyz');
              await supabase.auth.signOut();
              throw new Error('Access restricted to @stratos.xyz email addresses only.');
            }
            
            console.log('[AuthCallback] Domain validation passed, redirecting...');
            setStatus('success');
            
            // Clean up URL and redirect immediately
            window.history.replaceState({}, document.title, '/auth/callback');
            
            // Use replace to prevent back button issues
            window.location.replace('/watchlist');
            return;
          } else {
            console.log('[AuthCallback] No session in exchange response');
          }
        }

        // No code in URL - check if we already have a session
        console.log('[AuthCallback] No code found, checking for existing session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          throw sessionError;
        }

        if (session) {
          console.log('[AuthCallback] Found existing session for:', session.user.email);
          
          // Validate domain restriction
          const email = session.user.email || '';
          if (!email.endsWith('@stratos.xyz')) {
            console.warn('[AuthCallback] Domain restriction: user email not @stratos.xyz');
            await supabase.auth.signOut();
            throw new Error('Access restricted to @stratos.xyz email addresses only.');
          }
          
          console.log('[AuthCallback] Existing session valid, redirecting...');
          setStatus('success');
          
          window.location.replace('/watchlist');
          return;
        }

        // No session and no code - user probably landed here directly
        console.log('[AuthCallback] No session or code found');
        setStatus('error');
        setError('No authentication data found. Please try signing in again.');

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        // Ignore abort errors - they happen during React strict mode cleanup
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          console.log('[AuthCallback] Request was aborted, ignoring...');
          return;
        }
        setError(err.message || 'Authentication failed');
        setStatus('error');
      }
    };

    // Small delay to ensure page is fully loaded
    const timer = setTimeout(handleCallback, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">Signing you in...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <p className="text-white text-lg">Success! Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-4xl mb-4">✗</div>
            <p className="text-white text-lg mb-2">Authentication failed</p>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button 
              onClick={() => window.location.href = '/watchlist'}
              className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

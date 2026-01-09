import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

        // With PKCE flow and detectSessionInUrl: true, Supabase automatically
        // exchanges the code for a session. We just need to wait for it.
        // The onAuthStateChange listener in AuthContext will handle the session.
        
        // Give Supabase a moment to process the auth code exchange
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if we have a session now
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          throw sessionError;
        }

        if (session) {
          console.log('[AuthCallback] Session established for:', session.user.email);
          
          // Validate domain restriction
          const email = session.user.email || '';
          if (!email.endsWith('@stratos.xyz')) {
            console.warn('[AuthCallback] Domain restriction: user email not @stratos.xyz');
            await supabase.auth.signOut();
            throw new Error('Access restricted to @stratos.xyz email addresses only.');
          }
          
          setStatus('success');
          
          // Clean up URL and redirect
          window.history.replaceState({}, document.title, '/auth/callback');
          
          setTimeout(() => {
            window.location.href = '/watchlist';
          }, 500);
          return;
        }

        // If no session yet, check if there's a code in the URL that needs processing
        const code = urlParams.get('code');
        if (code) {
          console.log('[AuthCallback] Auth code found, exchanging for session...');
          
          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[AuthCallback] Code exchange error:', exchangeError);
            throw exchangeError;
          }
          
          if (data.session) {
            console.log('[AuthCallback] Session established via code exchange for:', data.session.user.email);
            
            // Validate domain restriction
            const email = data.session.user.email || '';
            if (!email.endsWith('@stratos.xyz')) {
              console.warn('[AuthCallback] Domain restriction: user email not @stratos.xyz');
              await supabase.auth.signOut();
              throw new Error('Access restricted to @stratos.xyz email addresses only.');
            }
            
            setStatus('success');
            
            // Clean up URL and redirect
            window.history.replaceState({}, document.title, '/auth/callback');
            
            setTimeout(() => {
              window.location.href = '/watchlist';
            }, 500);
            return;
          }
        }

        // No session and no code - something went wrong
        throw new Error('Authentication failed: No session established. Please try again.');

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        setError(err.message || 'Authentication failed');
        setStatus('error');
      }
    };

    // Small delay to ensure page is fully loaded
    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
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

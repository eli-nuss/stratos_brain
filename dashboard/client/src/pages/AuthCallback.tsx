import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AuthCallback] Starting callback processing...');
      console.log('[AuthCallback] Full URL:', window.location.href);
      console.log('[AuthCallback] Hash:', window.location.hash);
      console.log('[AuthCallback] Search:', window.location.search);

      try {
        // Check for error in URL params first
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        if (errorParam) {
          throw new Error(`Authentication error: ${errorDescription || errorParam}`);
        }

        // For implicit flow, tokens come in the URL hash (#access_token=...)
        // Supabase's detectSessionInUrl should handle this automatically
        // We just need to wait for it to process and check the session
        
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log('[AuthCallback] Found access_token in hash, letting Supabase process...');
          
          // Give Supabase a moment to process the hash
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now check if session was established
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
        }

        // If no hash token, maybe we're still processing or there's an issue
        // Try getting session one more time after a delay
        console.log('[AuthCallback] No hash token found, checking for existing session...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          console.log('[AuthCallback] Found existing session for:', existingSession.user.email);
          setStatus('success');
          setTimeout(() => {
            window.location.href = '/watchlist';
          }, 500);
          return;
        }

        // No session found
        const debug = `URL: ${window.location.href}\nHash: ${hash || 'none'}\nNo session established`;
        setDebugInfo(debug);
        throw new Error('Authentication failed: No session established. Please try again.');

      } catch (err: any) {
        console.error('[AuthCallback] Error:', err);
        setError(err.message || 'Authentication failed');
        setStatus('error');
      }
    };

    // Small delay to ensure Supabase client is ready
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
            {debugInfo && (
              <pre className="text-xs text-gray-500 mb-4 text-left bg-gray-900 p-2 rounded overflow-auto max-h-32">
                {debugInfo}
              </pre>
            )}
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

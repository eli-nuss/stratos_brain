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
      console.log('[AuthCallback] Search params:', window.location.search);

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Check for error from Supabase/OAuth redirect
        if (errorParam) {
          throw new Error(`Authentication error: ${errorDescription || errorParam}`);
        }

        // PKCE flow requires a code parameter
        if (!code) {
          console.warn('[AuthCallback] No "code" parameter found in URL.');
          const debug = `URL: ${window.location.href}\nCode: missing\nThis might indicate an incomplete OAuth flow.`;
          setDebugInfo(debug);
          throw new Error('Authentication failed: Missing authorization code.');
        }

        console.log('[AuthCallback] Processing PKCE code exchange...');
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('[AuthCallback] Code exchange error:', exchangeError);
          throw exchangeError;
        }
        
        const session = data.session;
        if (session) {
          console.log('[AuthCallback] PKCE exchange successful, session for:', session.user.email);
          setStatus('success');
          
          // Clean up URL (remove query params) and redirect
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Brief delay to show success message, then redirect
          setTimeout(() => {
            window.location.href = '/watchlist';
          }, 500);
        } else {
          // This should not happen if exchangeCodeForSession was successful
          const debug = `URL: ${window.location.href}\nCode: present\nSession: null after exchange`;
          setDebugInfo(debug);
          throw new Error('No session returned after code exchange');
        }
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

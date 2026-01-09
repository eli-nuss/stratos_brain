import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AuthCallback] Processing OAuth callback...');
      console.log('[AuthCallback] Current URL:', window.location.href);
      
      const hash = window.location.hash;
      console.log('[AuthCallback] Hash length:', hash.length);
      
      setDebugInfo(`Hash length: ${hash.length}`);

      if (hash && hash.includes('access_token')) {
        console.log('[AuthCallback] Found access_token in hash');
        
        // Parse the hash
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        console.log('[AuthCallback] Access token exists:', !!accessToken);
        console.log('[AuthCallback] Refresh token:', refreshToken);
        
        setDebugInfo(prev => prev + `\nAccess token: ${accessToken?.substring(0, 20)}...`);
        setDebugInfo(prev => prev + `\nRefresh token: ${refreshToken}`);

        if (accessToken && refreshToken) {
          try {
            console.log('[AuthCallback] Calling setSession...');
            
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (sessionError) {
              console.error('[AuthCallback] setSession error:', sessionError);
              console.error('[AuthCallback] Error details:', JSON.stringify(sessionError, null, 2));
              setError(`${sessionError.message} (${sessionError.name || 'Unknown'})`);
              setDebugInfo(prev => prev + `\nError: ${JSON.stringify(sessionError)}`);
              setStatus('error');
              return;
            }

            if (data.session) {
              console.log('[AuthCallback] Session set successfully!');
              console.log('[AuthCallback] User email:', data.session.user?.email);
              setStatus('success');
              
              // Clean URL and redirect
              window.history.replaceState(null, '', '/watchlist');
              setTimeout(() => {
                window.location.href = '/watchlist';
              }, 1000);
            } else {
              console.error('[AuthCallback] No session returned');
              setError('No session returned from setSession');
              setStatus('error');
            }
          } catch (err) {
            console.error('[AuthCallback] Exception:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            setDebugInfo(prev => prev + `\nException: ${errorMessage}`);
            setStatus('error');
          }
        } else {
          setError('Missing tokens in callback URL');
          setStatus('error');
        }
      } else {
        // No hash, check if we already have a session
        console.log('[AuthCallback] No hash, checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('[AuthCallback] Found existing session, redirecting...');
          setStatus('success');
          setTimeout(() => {
            window.location.href = '/watchlist';
          }, 500);
        } else {
          setError('No authentication data found in URL');
          setStatus('error');
        }
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center max-w-md">
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
              <pre className="text-left text-xs text-gray-500 bg-gray-900 p-2 rounded mb-4 overflow-auto max-h-40">
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

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AuthCallback] Processing OAuth callback...');
      console.log('[AuthCallback] Current URL:', window.location.href);
      console.log('[AuthCallback] Hash:', window.location.hash);

      // Check if we have tokens in the hash
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('[AuthCallback] Found access_token in hash');
        
        // Parse the hash
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        console.log('[AuthCallback] Access token exists:', !!accessToken);
        console.log('[AuthCallback] Refresh token exists:', !!refreshToken);

        if (accessToken && refreshToken) {
          try {
            // Set the session
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (sessionError) {
              console.error('[AuthCallback] Error setting session:', sessionError);
              setError(sessionError.message);
              setStatus('error');
              return;
            }

            console.log('[AuthCallback] Session set successfully:', data.session?.user?.email);
            setStatus('success');
            
            // Clean URL and redirect to watchlist
            setTimeout(() => {
              window.location.href = '/watchlist';
            }, 500);
          } catch (err) {
            console.error('[AuthCallback] Exception:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStatus('error');
          }
        } else {
          setError('Missing tokens in callback');
          setStatus('error');
        }
      } else {
        // No hash, check if we already have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[AuthCallback] Already have session, redirecting...');
          setStatus('success');
          setTimeout(() => {
            window.location.href = '/watchlist';
          }, 500);
        } else {
          setError('No authentication data found');
          setStatus('error');
        }
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
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
            <p className="text-gray-400 text-sm">{error}</p>
            <button 
              onClick={() => window.location.href = '/watchlist'}
              className="mt-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AuthCallback] Starting callback processing...');
      console.log('[AuthCallback] URL:', window.location.href);
      console.log('[AuthCallback] Hash present:', !!window.location.hash);

      // Give Supabase time to process the hash automatically
      // The detectSessionInUrl option should handle this
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkSession = async (): Promise<boolean> => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[AuthCallback] Check attempt', attempts + 1, '- Session:', session?.user?.email || 'None');
        
        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError);
          return false;
        }
        
        return !!session;
      };

      // Poll for session (Supabase should process the hash automatically)
      while (attempts < maxAttempts) {
        const hasSession = await checkSession();
        
        if (hasSession) {
          console.log('[AuthCallback] Session found! Redirecting...');
          setStatus('success');
          
          // Clean up URL and redirect
          setTimeout(() => {
            window.location.href = '/watchlist';
          }, 1000);
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // If we get here, no session was found
      console.error('[AuthCallback] No session found after', maxAttempts, 'attempts');
      setError('Authentication timed out. Please try again.');
      setStatus('error');
    };

    // Small delay to let Supabase initialize
    setTimeout(handleCallback, 100);
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

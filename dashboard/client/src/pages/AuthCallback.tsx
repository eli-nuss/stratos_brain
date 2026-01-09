import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallback() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    console.log('[AuthCallback] State check - loading:', loading, 'user:', user?.email, 'hasRedirected:', hasRedirected);
    
    // Check for error in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (errorParam) {
      console.error('[AuthCallback] Error in URL:', errorParam, errorDescription);
      setError(errorDescription || errorParam);
      setStatus('error');
      return;
    }

    // Wait for auth to finish loading
    if (loading) {
      console.log('[AuthCallback] Still loading auth state...');
      return;
    }

    // If we have a user and haven't redirected yet, redirect now
    if (user && !hasRedirected) {
      console.log('[AuthCallback] User authenticated:', user.email);
      
      // Validate domain
      const email = user.email || '';
      if (!email.endsWith('@stratos.xyz')) {
        console.warn('[AuthCallback] Domain restriction failed for:', email);
        setError('Access restricted to @stratos.xyz email addresses only.');
        setStatus('error');
        return;
      }

      console.log('[AuthCallback] Domain validation passed, redirecting to /watchlist...');
      setStatus('success');
      setHasRedirected(true);
      
      // Use a small delay to show success state, then redirect
      setTimeout(() => {
        window.location.href = '/watchlist';
      }, 500);
      return;
    }

    // If not loading and no user, check if we have a code that needs processing
    const code = urlParams.get('code');
    if (code && !user) {
      console.log('[AuthCallback] Code present but no user yet - waiting for auth state change...');
      // The AuthContext should handle this via onAuthStateChange
      // Just wait a bit more
      return;
    }

    // No user and no code - show error
    if (!user && !code) {
      console.log('[AuthCallback] No user and no code - showing error');
      setError('No authentication data found. Please try signing in again.');
      setStatus('error');
    }
  }, [user, loading, hasRedirected]);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === 'processing') {
        console.log('[AuthCallback] Timeout reached - forcing error state');
        setError('Authentication timed out. Please try again.');
        setStatus('error');
      }
    }, 15000); // 15 second timeout

    return () => clearTimeout(timeout);
  }, [status]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">Signing you in...</p>
            <p className="text-gray-500 text-sm mt-2">Please wait...</p>
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

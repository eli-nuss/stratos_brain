import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallback() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);

  // Log every render to track state changes
  console.log('[AuthCallback] Render - loading:', loading, 'user:', user?.email || 'null', 'status:', status, 'hasRedirected:', hasRedirected);

  const handleRedirect = useCallback(() => {
    if (hasRedirected) return;
    
    console.log('[AuthCallback] Handling redirect for user:', user?.email);
    
    // Validate domain
    const email = user?.email || '';
    if (!email.endsWith('@stratos.xyz')) {
      console.warn('[AuthCallback] Domain restriction failed for:', email);
      setError('Access restricted to @stratos.xyz email addresses only.');
      setStatus('error');
      return;
    }

    console.log('[AuthCallback] Domain validation passed, redirecting to /watchlist...');
    setStatus('success');
    setHasRedirected(true);
    
    // Redirect immediately
    window.location.href = '/watchlist';
  }, [user, hasRedirected]);

  useEffect(() => {
    console.log('[AuthCallback] useEffect triggered - loading:', loading, 'user:', user?.email || 'null');
    
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

    // If still loading, wait
    if (loading) {
      console.log('[AuthCallback] Still loading auth state...');
      return;
    }

    // If we have a user, redirect
    if (user) {
      handleRedirect();
      return;
    }

    // Check if we have a code that might still be processing
    const code = urlParams.get('code');
    if (code) {
      console.log('[AuthCallback] Code present, waiting for auth to process it...');
      // Don't show error yet, the code might still be processing
      return;
    }

    // No user, no code, no loading - show error
    console.log('[AuthCallback] No user, no code, not loading - showing error');
    setError('No authentication data found. Please try signing in again.');
    setStatus('error');
  }, [user, loading, handleRedirect]);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === 'processing' && !hasRedirected) {
        console.log('[AuthCallback] Timeout reached after 15s');
        setError('Authentication timed out. Please try again.');
        setStatus('error');
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [status, hasRedirected]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">Signing you in...</p>
            <p className="text-gray-500 text-sm mt-2">
              {loading ? 'Verifying session...' : 'Processing...'}
            </p>
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

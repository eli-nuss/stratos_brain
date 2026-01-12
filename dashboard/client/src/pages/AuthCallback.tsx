import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);
  const manualExchangeAttempted = useRef(false);

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

  // Manually exchange the OAuth code if Supabase didn't do it automatically
  const manualCodeExchange = useCallback(async () => {
    if (manualExchangeAttempted.current) return;
    manualExchangeAttempted.current = true;
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (!code) {
      console.log('[AuthCallback] No code to exchange');
      return;
    }
    
    console.log('[AuthCallback] Attempting manual code exchange...');
    
    try {
      // Try to exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[AuthCallback] Code exchange error:', error);
        // If the code was already used, try to get the existing session
        if (error.message.includes('already used') || error.message.includes('invalid')) {
          console.log('[AuthCallback] Code may have been used, checking for existing session...');
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            console.log('[AuthCallback] Found existing session:', sessionData.session.user.email);
            // The auth state change should handle this
            return;
          }
        }
        setError(`Authentication failed: ${error.message}`);
        setStatus('error');
        return;
      }
      
      if (data?.session?.user) {
        console.log('[AuthCallback] Manual exchange successful:', data.session.user.email);
        // The auth state change listener should pick this up
        // But let's also directly redirect if needed
        const email = data.session.user.email || '';
        if (email.endsWith('@stratos.xyz')) {
          setStatus('success');
          setHasRedirected(true);
          window.location.href = '/watchlist';
        } else {
          setError('Access restricted to @stratos.xyz email addresses only.');
          setStatus('error');
          await supabase.auth.signOut();
        }
      }
    } catch (err) {
      console.error('[AuthCallback] Manual exchange exception:', err);
      // Don't set error here, let the timeout handle it
    }
  }, []);

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

    // If still loading, wait a bit then try manual exchange
    if (loading) {
      console.log('[AuthCallback] Still loading auth state...');
      // After 2 seconds of loading, try manual exchange
      const timer = setTimeout(() => {
        if (!user && !hasRedirected) {
          manualCodeExchange();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    // If we have a user, redirect
    if (user) {
      handleRedirect();
      return;
    }

    // Check if we have a code that might still be processing
    const code = urlParams.get('code');
    if (code && !manualExchangeAttempted.current) {
      console.log('[AuthCallback] Code present, attempting manual exchange...');
      manualCodeExchange();
      return;
    }

    // No user, no code, no loading - show error
    if (!code) {
      console.log('[AuthCallback] No user, no code, not loading - showing error');
      setError('No authentication data found. Please try signing in again.');
      setStatus('error');
    }
  }, [user, loading, handleRedirect, manualCodeExchange]);

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (status === 'processing' && !hasRedirected) {
        console.log('[AuthCallback] Timeout reached after 10s');
        // Try one more time to get the session
        supabase.auth.getSession().then(({ data }) => {
          if (data?.session?.user) {
            const email = data.session.user.email || '';
            if (email.endsWith('@stratos.xyz')) {
              console.log('[AuthCallback] Found session on timeout, redirecting...');
              setStatus('success');
              setHasRedirected(true);
              window.location.href = '/watchlist';
              return;
            }
          }
          setError('Authentication timed out. Please try again.');
          setStatus('error');
        }).catch(() => {
          setError('Authentication timed out. Please try again.');
          setStatus('error');
        });
      }
    }, 10000);

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
              {loading ? 'Verifying session...' : 'Processing authentication...'}
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
            <div className="space-x-2">
              <button 
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.href = '/watchlist'}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
              >
                Go to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

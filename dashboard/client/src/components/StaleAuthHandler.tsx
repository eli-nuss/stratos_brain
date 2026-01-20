import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  clearAllAuthData, 
  checkAuthHealth, 
  debugAuthStorage,
  AUTH_STATE_CHANGED_EVENT 
} from '@/lib/auth-storage';

/**
 * StaleAuthHandler component
 * 
 * Listens for stale auth events and shows appropriate UI feedback.
 * Also performs periodic health checks on auth state.
 * 
 * v2: Uses centralized auth-storage utility for consistency
 */
export function StaleAuthHandler() {
  const { signOut } = useAuth();
  const [hasShownToast, setHasShownToast] = useState(false);

  // Handle stale auth event
  const handleStaleAuth = useCallback(() => {
    if (!hasShownToast) {
      setHasShownToast(true);
      toast.error('Session Expired', {
        description: 'Your session has expired. Please sign in again.',
        duration: 5000,
      });
      
      // Reset the flag after a delay so it can show again if needed
      setTimeout(() => setHasShownToast(false), 10000);
    }
  }, [hasShownToast]);

  // Listen for stale auth events
  useEffect(() => {
    window.addEventListener('stale-auth-cleared', handleStaleAuth);
    return () => {
      window.removeEventListener('stale-auth-cleared', handleStaleAuth);
    };
  }, [handleStaleAuth]);

  // Perform auth health check on mount and periodically
  useEffect(() => {
    const checkHealth = () => {
      const health = checkAuthHealth();
      
      if (!health.healthy) {
        console.warn('[StaleAuthHandler] Auth health issues detected:', health.issues);
        
        // If there are serious issues, clear the stale auth
        if (health.issues.some(issue => 
          issue.includes('expired') || 
          issue.includes('missing')
        )) {
          console.log('[StaleAuthHandler] Clearing unhealthy auth state...');
          clearAllAuthData();
          handleStaleAuth();
        }
      }
    };

    // Check on mount
    checkHealth();

    // Check periodically (every 5 minutes)
    const interval = setInterval(checkHealth, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [handleStaleAuth]);

  // Debug logging on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      debugAuthStorage();
    }
  }, []);

  // This component doesn't render anything visible
  return null;
}

/**
 * Hook to manually clear stale auth
 * Can be used by other components if needed
 */
export function useClearStaleAuth() {
  const { signOut } = useAuth();

  const clearStaleAuth = useCallback(async () => {
    console.log('[useClearStaleAuth] Manually clearing stale auth...');
    
    // Clear all auth data using centralized utility
    clearAllAuthData();
    
    // Sign out via auth context
    try {
      await signOut();
    } catch (err) {
      console.error('[useClearStaleAuth] Error during signout:', err);
    }
    
    // Reload the page to get fresh state
    window.location.reload();
  }, [signOut]);

  return { clearStaleAuth };
}

/**
 * Hook to check auth health
 * Returns current health status and any issues
 */
export function useAuthHealth() {
  const [health, setHealth] = useState<{ healthy: boolean; issues: string[] }>({ healthy: true, issues: [] });

  useEffect(() => {
    const check = () => {
      setHealth(checkAuthHealth());
    };

    check();

    // Re-check when auth state changes
    const handleAuthChange = () => {
      setTimeout(check, 100); // Small delay to let state settle
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthChange);
    };
  }, []);

  return health;
}

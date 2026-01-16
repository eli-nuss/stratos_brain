import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

/**
 * StaleAuthHandler component
 * 
 * Listens for stale auth events and shows appropriate UI feedback.
 * Also provides a way to manually trigger auth recovery.
 */
export function StaleAuthHandler() {
  const { signOut } = useAuth();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    const handleStaleAuth = () => {
      if (!hasShownToast) {
        setHasShownToast(true);
        toast.error('Session Expired', {
          description: 'Your session has expired. Please sign in again.',
          duration: 5000,
        });
        
        // Reset the flag after a delay so it can show again if needed
        setTimeout(() => setHasShownToast(false), 10000);
      }
    };

    // Listen for the custom event from api-config
    window.addEventListener('stale-auth-cleared', handleStaleAuth);

    return () => {
      window.removeEventListener('stale-auth-cleared', handleStaleAuth);
    };
  }, [hasShownToast]);

  // Also check for auth issues on mount
  useEffect(() => {
    const checkAuthHealth = async () => {
      // Check if there are any signs of stale auth in localStorage
      const supabaseKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          supabaseKeys.push(key);
        }
      }

      // If we have supabase keys but they might be corrupted, log for debugging
      if (supabaseKeys.length > 0) {
        console.log('[StaleAuthHandler] Found Supabase localStorage keys:', supabaseKeys.length);
      }
    };

    checkAuthHealth();
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

  const clearStaleAuth = async () => {
    console.log('[useClearStaleAuth] Manually clearing stale auth...');
    
    // Clear all Supabase-related localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('sb-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Sign out
    await signOut();
    
    // Reload the page
    window.location.reload();
  };

  return { clearStaleAuth };
}

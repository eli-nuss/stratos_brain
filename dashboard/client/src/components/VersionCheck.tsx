import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { hasValidStoredAuth } from '@/lib/auth-storage';

// This version should be updated with each deployment
// It's used to detect stale tabs that need to be refreshed
const APP_VERSION = '2.1.0-robust-auth';

// Key used to store version in localStorage
const VERSION_KEY = 'stratos_app_version';

// Check interval in milliseconds (check every 5 minutes)
const CHECK_INTERVAL = 5 * 60 * 1000;

export function VersionCheck() {
  const [needsRefresh, setNeedsRefresh] = useState(false);

  useEffect(() => {
    // Check version on mount
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log(`[VersionCheck] Version mismatch: stored=${storedVersion}, current=${APP_VERSION}`);
      
      // Check if user has valid auth - if so, we need to be careful about refresh
      const hasAuth = hasValidStoredAuth();
      console.log(`[VersionCheck] User has valid auth: ${hasAuth}`);
      
      // Show the refresh prompt
      setNeedsRefresh(true);
    } else {
      // Store current version
      localStorage.setItem(VERSION_KEY, APP_VERSION);
    }

    // Also check periodically in case the app was updated while the tab was open
    const interval = setInterval(() => {
      const currentStored = localStorage.getItem(VERSION_KEY);
      if (currentStored && currentStored !== APP_VERSION) {
        console.log(`[VersionCheck] Periodic check found version mismatch`);
        setNeedsRefresh(true);
      }
    }, CHECK_INTERVAL);

    // Listen for storage events (when another tab updates the version)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === VERSION_KEY && e.newValue && e.newValue !== APP_VERSION) {
        console.log(`[VersionCheck] Storage event detected version change`);
        setNeedsRefresh(true);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleRefresh = () => {
    // Update version before refreshing to prevent infinite refresh loop
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    
    // IMPORTANT: Do NOT clear auth data on version refresh
    // The auth data should persist across version updates
    // Only clear auth data when explicitly signing out or when auth is stale
    
    // Force a hard refresh to bypass cache
    // Using location.reload() preserves the current URL and auth state
    window.location.reload();
  };

  const handleDismiss = () => {
    // User can dismiss the prompt, but we'll still update the version
    // so they don't see it again until the next actual update
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    setNeedsRefresh(false);
  };

  if (!needsRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <RefreshCw className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-sm">Update Available</p>
            <p className="text-xs opacity-90 mt-1">
              A new version of Stratos Brain is available. Refresh to get the latest features and fixes.
            </p>
            <p className="text-xs opacity-75 mt-1">
              Your login session will be preserved.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRefresh}
                className="px-4 py-1.5 bg-primary-foreground text-primary rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Refresh Now
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 bg-transparent text-primary-foreground/80 rounded-md text-sm hover:text-primary-foreground transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export version for use in other parts of the app
export const appVersion = APP_VERSION;

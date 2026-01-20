import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, UserProfile } from '@/lib/supabase';
import { mutate } from 'swr';
import { updateCachedAuth } from '@/lib/api-config';
import { 
  notifyAuthStateChanged, 
  clearAllAuthData,
  hasValidStoredAuth,
  getStoredUserId,
  cacheUserProfile,
  getCachedProfile,
  AUTH_STATE_CHANGED_EVENT 
} from '@/lib/auth-storage';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signIn: () => Promise<{ error: Error | null }>; // Shortcut for signInWithGoogle
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// Clear only user-specific SWR cache on auth state change
// This preserves public dashboard data while clearing user-specific data
const clearUserSpecificCache = () => {
  console.log('[Auth] Clearing user-specific SWR cache...');
  
  // Patterns for user-specific data that should be cleared on auth change
  const userSpecificPatterns = [
    '/notes',
    '/research-notes',
    '/chats',
    '/brain-chats',
    '/table-settings',
    'company-chat-api',
    'global-chat-api',
  ];
  
  // Clear only user-specific cache entries
  mutate(
    (key: string) => {
      if (typeof key !== 'string') return false;
      return userSpecificPatterns.some(pattern => key.includes(pattern));
    },
    undefined,
    { revalidate: false }
  );
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Allowed email domains for Google sign-in
const ALLOWED_DOMAINS = ['stratos.xyz'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Initialize profile from cache for instant display
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const cached = getCachedProfile();
    if (cached) {
      return {
        id: cached.id,
        email: cached.email,
        display_name: cached.display_name,
        created_at: '',
        updated_at: ''
      };
    }
    return null;
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);
  const initializationAttempts = useRef(0);
  const maxInitAttempts = 3;

  // Fetch user profile from our user_profiles table
  // Also caches the profile for cross-tab sync
  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    try {
      // First check if we have a cached profile
      const cached = getCachedProfile();
      if (cached && cached.id === userId) {
        console.log('[Auth] Using cached profile:', cached.display_name);
        // Return cached immediately, but still fetch fresh in background
        const cachedProfile: UserProfile = {
          id: cached.id,
          email: cached.email,
          display_name: cached.display_name,
          created_at: '',
          updated_at: ''
        };
        
        // Fetch fresh profile in background to update cache
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single()
          .then(({ data }) => {
            if (data) {
              cacheUserProfile({
                id: data.id,
                email: data.email,
                display_name: data.display_name
              });
            }
          });
        
        return cachedProfile;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Auth] Error fetching profile:', error);
        return null;
      }
      
      // Cache the profile for cross-tab sync
      if (data) {
        cacheUserProfile({
          id: data.id,
          email: data.email,
          display_name: data.display_name
        });
      }
      
      return data as UserProfile;
    } catch (err) {
      console.error('[Auth] Error fetching profile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  // Force refresh the session from Supabase
  const refreshSession = useCallback(async () => {
    console.log('[Auth] Refreshing session...');
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('[Auth] Session refresh error:', error);
        return;
      }
      if (data.session) {
        console.log('[Auth] Session refreshed successfully');
        setSession(data.session);
        setUser(data.session.user);
        await updateCachedAuth();
        notifyAuthStateChanged('refresh');
      }
    } catch (err) {
      console.error('[Auth] Session refresh exception:', err);
    }
  }, []);

  // Check if email domain is allowed
  const isEmailDomainAllowed = useCallback((email: string | undefined): boolean => {
    if (!email) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    return ALLOWED_DOMAINS.includes(domain);
  }, []);

  // Update state from session
  const updateStateFromSession = useCallback(async (currentSession: Session | null) => {
    if (currentSession?.user) {
      setSession(currentSession);
      setUser(currentSession.user);
      
      // Update cached auth for API calls
      await updateCachedAuth();
      
      // Fetch profile in background
      const profileData = await fetchProfile(currentSession.user.id);
      setProfile(profileData);
    } else {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, [fetchProfile]);

  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    console.log('[Auth] Initializing auth...');
    console.log('[Auth] Current URL:', window.location.href);
    
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;
    
    // Get initial session with retry logic
    const initializeAuth = async () => {
      initializationAttempts.current++;
      
      try {
        // Small delay to avoid race conditions with Supabase initialization
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!isMounted) return;
        
        // First check if we have stored auth that might be valid
        const hasStoredAuth = hasValidStoredAuth();
        const storedUserId = getStoredUserId();
        console.log('[Auth] Has stored auth:', hasStoredAuth, 'Stored user ID:', storedUserId);
        
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.error('[Auth] Error getting session:', error);
          
          // If we have stored auth but getSession failed, try to refresh
          if (hasStoredAuth && initializationAttempts.current < maxInitAttempts) {
            console.log('[Auth] Attempting session refresh...');
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session) {
              console.log('[Auth] Session refresh successful');
              await updateStateFromSession(refreshData.session);
              if (isMounted) setLoading(false);
              return;
            }
          }
          
          // Clear potentially stale auth data
          if (hasStoredAuth) {
            console.log('[Auth] Clearing stale auth data after failed session retrieval');
            clearAllAuthData();
          }
          
          if (isMounted) setLoading(false);
          return;
        }
        
        console.log('[Auth] Initial session:', initialSession?.user?.email || 'None');
        
        if (initialSession?.user && isMounted) {
          console.log('[Auth] Setting initial user:', initialSession.user.email);
          await updateStateFromSession(initialSession);
        } else if (hasStoredAuth) {
          // We have stored auth but no session - try to refresh
          console.log('[Auth] Stored auth exists but no session, attempting refresh...');
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session) {
            console.log('[Auth] Session refresh successful');
            await updateStateFromSession(refreshData.session);
          } else {
            // Clear stale auth
            console.log('[Auth] Session refresh failed, clearing stale auth');
            clearAllAuthData();
          }
        }
        
        if (isMounted) {
          setLoading(false);
          console.log('[Auth] Initialization complete, loading set to false');
        }
      } catch (err) {
        console.error('[Auth] Exception during initialization:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const setupAuthListener = () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (!isMounted) return;
          
          console.log('[Auth] Auth state change:', event, currentSession?.user?.email || 'No session');
          
          // Check domain restriction for new sign-ins
          if (event === 'SIGNED_IN' && currentSession?.user) {
            const email = currentSession.user.email;
            if (!isEmailDomainAllowed(email)) {
              console.warn(`[Auth] Domain not allowed for email: ${email}`);
              await supabase.auth.signOut();
              if (isMounted) {
                setUser(null);
                setProfile(null);
                setSession(null);
                setLoading(false);
              }
              return;
            }
            
            // Valid sign in - update state immediately
            console.log('[Auth] Valid sign in, updating state for:', email);
            if (isMounted) {
              setSession(currentSession);
              setUser(currentSession.user);
              setLoading(false);
              console.log('[Auth] User state updated, loading set to false');
            }
            
            // Update cached auth
            await updateCachedAuth();
            notifyAuthStateChanged('login');
            
            // Fetch profile in background (don't block state update)
            fetchProfile(currentSession.user.id).then(profileData => {
              if (isMounted) {
                console.log('[Auth] Profile fetched:', profileData?.display_name);
                setProfile(profileData);
              }
            }).catch(err => {
              console.error('[Auth] Error fetching profile:', err);
            });
            return;
          }

          // Handle sign out
          if (event === 'SIGNED_OUT') {
            console.log('[Auth] User signed out');
            if (isMounted) {
              setSession(null);
              setUser(null);
              setProfile(null);
            }
            await updateCachedAuth();
            clearUserSpecificCache();
            notifyAuthStateChanged('logout');
            return;
          }

          // Handle token refresh
          if (event === 'TOKEN_REFRESHED' && currentSession) {
            console.log('[Auth] Token refreshed');
            if (isMounted) {
              setSession(currentSession);
              setUser(currentSession.user);
            }
            await updateCachedAuth();
            notifyAuthStateChanged('refresh');
            return;
          }

          // Handle other events
          if (isMounted) {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            
            // Update cached auth for API calls
            await updateCachedAuth();
            
            // Clear SWR cache on auth state change to prevent stale data
            clearUserSpecificCache();
          }
          
          if (currentSession?.user) {
            const profileData = await fetchProfile(currentSession.user.id);
            if (isMounted) {
              setProfile(profileData);
            }
          } else {
            if (isMounted) {
              setProfile(null);
            }
          }
          
          if (isMounted) {
            setLoading(false);
          }
        }
      );
      
      authSubscription = subscription;
    };

    setupAuthListener();

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      if (authSubscription) {
        try {
          authSubscription.unsubscribe();
        } catch (err) {
          console.error('[Auth] Error unsubscribing:', err);
        }
      }
    };
  }, [fetchProfile, isEmailDomainAllowed, updateStateFromSession]);

  // Sign in with magic link
  const signInWithEmail = useCallback(async (email: string) => {
    try {
      if (!isEmailDomainAllowed(email)) {
        return { error: new Error(`Only @${ALLOWED_DOMAINS.join(', @')} email addresses are allowed`) };
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, [isEmailDomainAllowed]);

  // Sign in with Google OAuth
  const signInWithGoogle = useCallback(async () => {
    try {
      console.log('[Auth] Starting Google OAuth...');
      console.log('[Auth] Redirect URL:', `${window.location.origin}/auth/callback`);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            hd: 'stratos.xyz',
          },
        },
      });
      
      if (error) {
        console.error('[Auth] Google OAuth error:', error);
        return { error };
      }
      
      // With PKCE flow, signInWithOAuth returns a URL to redirect to
      // The redirect should happen automatically, but if not, we can handle it
      if (data?.url) {
        console.log('[Auth] Redirecting to:', data.url);
        window.location.href = data.url;
      }
      
      return { error: null };
    } catch (err) {
      console.error('[Auth] Google OAuth exception:', err);
      return { error: err as Error };
    }
  }, []);

  // Sign out - use global scope to invalidate all sessions
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
      // Still clear local state even if server-side signout fails
    }
    setUser(null);
    setProfile(null);
    setSession(null);
    
    // Clear all auth data
    clearAllAuthData();
    
    // Update cached auth and clear SWR cache
    await updateCachedAuth();
    clearUserSpecificCache();
    notifyAuthStateChanged('logout');
  }, []);

  // Shortcut for signInWithGoogle
  const signIn = signInWithGoogle;

  const value = {
    user,
    profile,
    session,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signIn,
    signOut,
    refreshProfile,
    refreshSession,
  };

  // Log context value changes (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auth] Context value - user:', user?.email || 'null', 'loading:', loading);
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

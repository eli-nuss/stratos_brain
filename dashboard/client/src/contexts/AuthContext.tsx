import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, UserProfile } from '@/lib/supabase';
import { mutate } from 'swr';
import { updateCachedAuth } from '@/lib/api-config';

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
}

// Clear all SWR cache on auth state change to prevent stale data
const clearAllCache = () => {
  console.log('[Auth] Clearing all SWR cache...');
  // Clear all SWR cache entries
  mutate(
    () => true, // Match all keys
    undefined,  // Set data to undefined
    { revalidate: false } // Don't revalidate immediately
  );
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Allowed email domains for Google sign-in
const ALLOWED_DOMAINS = ['stratos.xyz'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // Fetch user profile from our user_profiles table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as UserProfile;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Check if email domain is allowed
  const isEmailDomainAllowed = (email: string | undefined): boolean => {
    if (!email) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    return ALLOWED_DOMAINS.includes(domain);
  };

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
    
    // Get initial session with error handling
    const initializeAuth = async () => {
      try {
        // Add a small delay to avoid race conditions with Supabase initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isMounted) return;
        
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.error('[Auth] Error getting session:', error);
          if (isMounted) setLoading(false);
          return;
        }
        
        console.log('[Auth] Initial session:', initialSession?.user?.email || 'None');
        
        if (initialSession?.user && isMounted) {
          console.log('[Auth] Setting initial user:', initialSession.user.email);
          setSession(initialSession);
          setUser(initialSession.user);
          const profileData = await fetchProfile(initialSession.user.id);
          if (isMounted) {
            setProfile(profileData);
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

          // Handle other events
          if (isMounted) {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            
            // Update cached auth for API calls
            await updateCachedAuth();
            
            // Clear SWR cache on auth state change to prevent stale data
            clearAllCache();
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
  }, []);

  // Sign in with magic link
  const signInWithEmail = async (email: string) => {
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
  };

  // Sign in with Google OAuth
  const signInWithGoogle = async () => {
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
  };

  // Sign out - use global scope to invalidate all sessions
  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('[Auth] Sign out error:', err);
      // Still clear local state even if server-side signout fails
    }
    setUser(null);
    setProfile(null);
    setSession(null);
    
    // Update cached auth and clear SWR cache
    await updateCachedAuth();
    clearAllCache();
  };

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
  };

  // Log context value changes
  console.log('[Auth] Context value - user:', user?.email || 'null', 'loading:', loading);

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

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, UserProfile } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Allowed email domains for Google sign-in
const ALLOWED_DOMAINS = ['stratos.xyz'];

// Parse hash fragment from OAuth redirect
function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!hash || hash.length <= 1) return params;
  
  const hashContent = hash.substring(1); // Remove the leading #
  const pairs = hashContent.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  
  return params;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
    const initAuth = async () => {
      console.log('[Auth] Initializing auth...');
      
      // Check if we have an OAuth callback in the URL hash
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('[Auth] OAuth callback detected in URL hash');
        
        const params = parseHashParams(hash);
        const accessToken = params['access_token'];
        const refreshToken = params['refresh_token'];
        
        if (accessToken && refreshToken) {
          console.log('[Auth] Setting session from hash tokens...');
          
          try {
            // Manually set the session using the tokens from the hash
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('[Auth] Error setting session:', error);
            } else if (data.session) {
              console.log('[Auth] Session set successfully:', data.session.user?.email);
              setSession(data.session);
              setUser(data.session.user);
              
              // Fetch profile
              if (data.session.user) {
                const profileData = await fetchProfile(data.session.user.id);
                setProfile(profileData);
              }
              
              // Clean up the URL hash
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          } catch (err) {
            console.error('[Auth] Exception setting session:', err);
          }
        }
      } else {
        // No OAuth callback, check for existing session
        console.log('[Auth] Checking for existing session...');
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          console.log('[Auth] Found existing session:', existingSession.user?.email);
          setSession(existingSession);
          setUser(existingSession.user);
          
          if (existingSession.user) {
            const profileData = await fetchProfile(existingSession.user.id);
            setProfile(profileData);
          }
        } else {
          console.log('[Auth] No existing session found');
        }
      }
      
      setLoading(false);
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[Auth] Auth state change:', event, currentSession?.user?.email || 'No session');
        
        // Check domain restriction for new sign-ins
        if (event === 'SIGNED_IN' && currentSession?.user) {
          const email = currentSession.user.email;
          if (!isEmailDomainAllowed(email)) {
            console.warn(`[Auth] Domain not allowed for email: ${email}`);
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setSession(null);
            setLoading(false);
            return;
          }
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          const profileData = await fetchProfile(currentSession.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
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
          emailRedirectTo: `${window.location.origin}/`,
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            hd: 'stratos.xyz',
          },
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

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

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

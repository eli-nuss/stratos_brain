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
    // Handle OAuth callback - check if there's a hash with access_token
    const handleOAuthCallback = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        console.log('OAuth callback detected, processing...');
        // The hash contains OAuth tokens - Supabase should handle this automatically
        // but we need to wait for it to process
        try {
          // Give Supabase a moment to process the hash
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Get the session after Supabase processes the hash
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error getting session after OAuth:', error);
          } else if (session) {
            console.log('Session established after OAuth:', session.user?.email);
            setSession(session);
            setUser(session.user);
            if (session.user) {
              const profileData = await fetchProfile(session.user.id);
              setProfile(profileData);
            }
            // Clean up the URL hash
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch (err) {
          console.error('Error processing OAuth callback:', err);
        }
      }
    };

    // Initialize auth
    const initAuth = async () => {
      // First check for OAuth callback
      await handleOAuthCallback();
      
      // Then get current session
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
      }
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        // Check domain restriction for new sign-ins
        if (event === 'SIGNED_IN' && session?.user) {
          const email = session.user.email;
          if (!isEmailDomainAllowed(email)) {
            // Sign out user if domain is not allowed
            console.warn(`Domain not allowed for email: ${email}`);
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setSession(null);
            setLoading(false);
            return;
          }
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with magic link
  const signInWithEmail = async (email: string) => {
    try {
      // Check domain restriction before sending magic link
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
            // Restrict to organization domain (Google Workspace)
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

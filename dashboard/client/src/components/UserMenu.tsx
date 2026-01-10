import { useState } from 'react';
import { User, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Google icon component
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function UserMenu() {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError(null);

    const { error } = await signInWithGoogle();
    
    if (error) {
      setError(error.message);
      setIsSubmitting(false);
    }
    // Note: On success, the page will redirect to Google OAuth
  };

  const handleLogout = async () => {
    await signOut();
  };

  const closeModal = () => {
    setShowLoginModal(false);
    setError(null);
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="px-2 py-1">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) {
    // User is logged in
    return (
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/30 rounded">
              <User className="w-3 h-3" />
              <span className="max-w-[100px] truncate">
                {profile?.display_name || user.email?.split('@')[0] || 'User'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div className="font-medium">{profile?.display_name || 'User'}</div>
              <div className="text-muted-foreground">{user.email}</div>
            </div>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className="p-2 sm:p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // User is not logged in
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-3 py-2 sm:px-2 sm:py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
            aria-label="Sign in"
          >
            <User className="w-4 h-4 sm:w-3 sm:h-3" />
            <span className="hidden sm:inline">Sign in</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Sign in to save preferences</TooltipContent>
      </Tooltip>

      {/* Login Modal */}
      {showLoginModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Sign in to Stratos Brain
            </h2>
            
            <p className="text-sm text-muted-foreground mb-6">
              Sign in with your Stratos Google account to save your preferences across devices.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <GoogleIcon className="w-5 h-5" />
                  Continue with Google
                </>
              )}
            </button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Only @stratos.xyz accounts are allowed
            </p>

            <div className="mt-4 pt-4 border-t border-border">
              <button
                type="button"
                onClick={closeModal}
                className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

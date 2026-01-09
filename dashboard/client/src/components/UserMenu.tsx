import { useState } from 'react';
import { User, LogOut, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function UserMenu() {
  const { user, profile, loading, signInWithEmail, signOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const { error } = await signInWithEmail(email.trim());
    
    setIsSubmitting(false);
    
    if (error) {
      setError(error.message);
    } else {
      setEmailSent(true);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const closeModal = () => {
    setShowLoginModal(false);
    setEmail('');
    setEmailSent(false);
    setError(null);
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
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
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
            className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all flex items-center gap-1"
          >
            <User className="w-3 h-3" />
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
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Sign in to Stratos Brain
            </h2>
            
            {emailSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium mb-2">Check your email</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We sent a magic link to <strong>{email}</strong>. 
                  Click the link to sign in.
                </p>
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleLogin}>
                <p className="text-sm text-muted-foreground mb-4">
                  Enter your email to receive a magic link. No password needed.
                </p>
                
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm bg-muted/30 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                  autoFocus
                  disabled={isSubmitting}
                />
                
                {error && (
                  <p className="text-sm text-destructive mb-3">{error}</p>
                )}
                
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !email.trim()}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send magic link'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

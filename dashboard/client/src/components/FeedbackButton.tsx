import { useState } from 'react';
import { useLocation } from 'wouter';
import { MessageSquarePlus, X, Bug, Lightbulb, Sparkles, Send, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getJsonApiHeaders } from '@/lib/api-config';

// Feedback API endpoint (separate from control-api)
const FEEDBACK_API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/feedback-api';

type FeedbackCategory = 'bug' | 'feature' | 'improvement';
type FeedbackPriority = 'low' | 'medium' | 'high';

interface FeedbackFormData {
  title: string;
  description: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
}

// Map routes to friendly page names
function getPageName(pathname: string): string {
  // Remove leading slash and get first segment
  const segments = pathname.split('/').filter(Boolean);
  
  if (segments.length === 0) return 'Home';
  
  const firstSegment = segments[0].toLowerCase();
  
  // Map common routes to friendly names
  const routeMap: Record<string, string> = {
    'asset': 'Asset Page',
    'watchlist': 'Watchlist',
    'model-portfolio': 'Model Portfolio',
    'core-portfolio': 'Core Portfolio',
    'equities': 'Equities',
    'crypto': 'Crypto',
    'chat': 'Research Chat',
    'lists': 'Stock Lists',
    'todo': 'To-Do List',
    'settings': 'Settings',
  };
  
  return routeMap[firstSegment] || firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
}

const categoryConfig = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30' },
  feature: { icon: Lightbulb, label: 'Feature Request', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/30' },
  improvement: { icon: Sparkles, label: 'Improvement', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
  medium: { label: 'Medium', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  high: { label: 'High', color: 'text-red-400', bgColor: 'bg-red-500/10' },
};

export default function FeedbackButton() {
  const [location] = useLocation();
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formData, setFormData] = useState<FeedbackFormData>({
    title: '',
    description: '',
    category: 'bug',
    priority: 'medium',
  });

  const pageName = getPageName(location);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      // Get user display name
      const submittedBy = user 
        ? (profile?.display_name || user.email?.split('@')[0] || 'User')
        : 'Anon';
      const userEmail = user?.email || null;

      const response = await fetch(FEEDBACK_API_BASE, {
        method: 'POST',
        headers: getJsonApiHeaders(),
        body: JSON.stringify({
          ...formData,
          page_name: pageName,
          submitted_by: submittedBy,
          user_email: userEmail,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit feedback');

      setSubmitSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitSuccess(false);
        setFormData({
          title: '',
          description: '',
          category: 'bug',
          priority: 'medium',
        });
      }, 1500);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modal = isOpen && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isSubmitting && setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div>
            <h3 className="font-semibold text-foreground">Submit Feedback</h3>
            <p className="text-xs text-muted-foreground">Page: {pageName}</p>
          </div>
          <button
            onClick={() => !isSubmitting && setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitSuccess ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-foreground font-medium">Feedback submitted!</p>
            <p className="text-sm text-muted-foreground mt-1">Thank you for your input</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(categoryConfig) as FeedbackCategory[]).map((cat) => {
                  const config = categoryConfig[cat];
                  const Icon = config.icon;
                  const isSelected = formData.category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat }))}
                      className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                        isSelected 
                          ? `${config.bgColor} border-current ${config.color}` 
                          : 'border-border hover:border-muted-foreground/50 text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Brief summary of the issue or idea"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add more details..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Priority</label>
              <div className="flex gap-2">
                {(Object.keys(priorityConfig) as FeedbackPriority[]).map((pri) => {
                  const config = priorityConfig[pri];
                  const isSelected = formData.priority === pri;
                  return (
                    <button
                      key={pri}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: pri }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected 
                          ? `${config.bgColor} ${config.color} ring-1 ring-current` 
                          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
        title="Submit feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>
      
      {modal}
    </>
  );
}

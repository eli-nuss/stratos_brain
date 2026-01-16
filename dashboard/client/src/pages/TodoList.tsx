import { useState } from 'react';
import useSWR from 'swr';
import { 
  Bug, Lightbulb, Sparkles, Check, Clock, Play, 
  Trash2, ChevronDown, ChevronRight, Filter,
  AlertCircle, Circle, ArrowUp, ArrowRight, ArrowDown,
  Plus, X, Send, Loader2, CheckCircle2, ListTodo, Activity
} from 'lucide-react';
// PageHeader removed - using DashboardLayout
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';

type FeedbackCategory = 'bug' | 'feature' | 'improvement';
type FeedbackStatus = 'open' | 'in_progress' | 'done';
type FeedbackPriority = 'low' | 'medium' | 'high';

interface FeedbackItem {
  id: number;
  title: string;
  description: string | null;
  category: FeedbackCategory;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  page_name: string;
  created_at: string;
  updated_at: string;
  submitted_by: string;
  user_email: string | null;
}

import { apiFetcher } from "@/lib/api-config";

const categoryConfig = {
  bug: { icon: Bug, label: 'Bug', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
  feature: { icon: Lightbulb, label: 'Feature', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
  improvement: { icon: Sparkles, label: 'Improvement', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
};

const statusConfig = {
  open: { icon: Circle, label: 'Open', color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
  in_progress: { icon: Play, label: 'In Progress', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  done: { icon: Check, label: 'Done', color: 'text-green-400', bgColor: 'bg-green-500/10' },
};

const priorityConfig = {
  high: { icon: ArrowUp, label: 'High', color: 'text-red-400' },
  medium: { icon: ArrowRight, label: 'Medium', color: 'text-yellow-400' },
  low: { icon: ArrowDown, label: 'Low', color: 'text-muted-foreground' },
};

// Priority order for sorting (high = 0, medium = 1, low = 2)
const priorityOrder: Record<FeedbackPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Sort items by priority (high to low)
const sortByPriority = (items: FeedbackItem[]): FeedbackItem[] => {
  return [...items].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
};

// Available pages for selection
const availablePages = [
  'Home',
  'Asset Page',
  'Watchlist',
  'Model Portfolio',
  'Core Portfolio',
  'Equities',
  'Crypto',
  'Research Chat',
  'Stock Lists',
  'To-Do List',
  'Settings',
  'Memos',
  'Docs',
  'Templates',
  'Other',
];

export default function TodoList() {
  const { data: items, error, isLoading, mutate } = useSWR<FeedbackItem[]>(
    'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/feedback-api',
    fetcher
  );
  const { user, profile } = useAuth();

  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedCompletedPages, setExpandedCompletedPages] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | 'all'>('all');
  
  // Add Item Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: 'bug' as FeedbackCategory,
    priority: 'medium' as FeedbackPriority,
    page_name: 'Home',
  });

  const safeItems = Array.isArray(items) ? items : [];

  // Filter items
  const filteredItems = safeItems.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;
    return true;
  });

  // Group by page
  const groupedByPage = filteredItems.reduce((acc, item) => {
    if (!acc[item.page_name]) {
      acc[item.page_name] = [];
    }
    acc[item.page_name].push(item);
    return acc;
  }, {} as Record<string, FeedbackItem[]>);

  // Sort pages alphabetically
  const sortedPages = Object.keys(groupedByPage).sort();

  // Initialize all pages as expanded
  if (expandedPages.size === 0 && sortedPages.length > 0) {
    setExpandedPages(new Set(sortedPages));
  }

  const togglePage = (page: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      return next;
    });
  };

  const toggleCompletedSection = (page: string) => {
    setExpandedCompletedPages(prev => {
      const next = new Set(prev);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      return next;
    });
  };

  const updateStatus = async (id: number, status: FeedbackStatus) => {
    try {
      await fetch(`https://wfogbaipiqootjrsprde.supabase.co/functions/v1/feedback-api/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      mutate();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await fetch(`https://wfogbaipiqootjrsprde.supabase.co/functions/v1/feedback-api/${id}`, {
        method: 'DELETE',
      });
      mutate();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.title.trim()) return;

    setIsSubmitting(true);
    try {
      const submittedBy = user 
        ? (profile?.display_name || user.email?.split('@')[0] || 'User')
        : 'Anon';
      const userEmail = user?.email || null;

      const response = await fetch('https://wfogbaipiqootjrsprde.supabase.co/functions/v1/feedback-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          submitted_by: submittedBy,
          user_email: userEmail,
        }),
      });

      if (!response.ok) throw new Error('Failed to add item');

      // Reset form and close modal
      setNewItem({
        title: '',
        description: '',
        category: 'bug',
        priority: 'medium',
        page_name: 'Home',
      });
      setShowAddModal(false);
      mutate();
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render a single item row
  const renderItem = (item: FeedbackItem) => {
    const catConfig = categoryConfig[item.category];
    const statConfig = statusConfig[item.status];
    const priConfig = priorityConfig[item.priority];
    const CatIcon = catConfig.icon;
    const PriIcon = priConfig.icon;

    return (
      <div
        key={item.id}
        className={`px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors ${
          item.status === 'done' ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div className={`p-1.5 rounded ${catConfig.bgColor}`}>
            <CatIcon className={`w-4 h-4 ${catConfig.color}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${item.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {item.title}
              </span>
              <PriIcon className={`w-3.5 h-3.5 ${priConfig.color}`} />
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {item.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
              <span className={`px-1.5 py-0.5 rounded ${catConfig.bgColor} ${catConfig.color}`}>
                {catConfig.label}
              </span>
              <span className="text-muted-foreground/70">•</span>
              <span title={item.user_email || undefined}>
                by {item.submitted_by || 'Anon'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Status Dropdown */}
            <select
              value={item.status}
              onChange={(e) => updateStatus(item.id, e.target.value as FeedbackStatus)}
              className={`px-2 py-1 text-xs rounded-lg border-0 ${statConfig.bgColor} ${statConfig.color} focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer`}
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>

            {/* Delete Button */}
            <button
              onClick={() => deleteItem(item.id)}
              className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Stats
  const stats = {
    total: safeItems.length,
    open: safeItems.filter(i => i.status === 'open').length,
    inProgress: safeItems.filter(i => i.status === 'in_progress').length,
    done: safeItems.filter(i => i.status === 'done').length,
  };

  return (
    <DashboardLayout hideNavTabs>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Items</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-muted-foreground">{stats.open}</div>
            <div className="text-sm text-muted-foreground">Open</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.inProgress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats.done}</div>
            <div className="text-sm text-muted-foreground">Done</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FeedbackStatus | 'all')}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as FeedbackCategory | 'all')}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">All Types</option>
            <option value="bug">Bugs</option>
            <option value="feature">Features</option>
            <option value="improvement">Improvements</option>
          </select>

          {(filterStatus !== 'all' || filterCategory !== 'all') && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterCategory('all'); }}
              className="text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">Failed to load feedback items</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No feedback items yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Add Item" above or use the feedback button to submit bugs or feature requests
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPages.map(page => {
              const pageItems = groupedByPage[page];
              const isExpanded = expandedPages.has(page);
              const isCompletedExpanded = expandedCompletedPages.has(page);
              
              // Separate active and completed items, then sort by priority
              const activeItems = sortByPriority(pageItems.filter(i => i.status !== 'done'));
              const completedItems = sortByPriority(pageItems.filter(i => i.status === 'done'));
              
              const openCount = pageItems.filter(i => i.status === 'open').length;
              const inProgressCount = pageItems.filter(i => i.status === 'in_progress').length;

              return (
                <div key={page} className="bg-card border border-border rounded-lg overflow-hidden">
                  {/* Page Header */}
                  <button
                    onClick={() => togglePage(page)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-foreground">{page}</span>
                      <span className="text-sm text-muted-foreground">({pageItems.length} items)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {openCount > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-muted/50 text-muted-foreground">
                          {openCount} open
                        </span>
                      )}
                      {inProgressCount > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/10 text-yellow-400">
                          {inProgressCount} in progress
                        </span>
                      )}
                      {completedItems.length > 0 && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400">
                          {completedItems.length} done
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Page Items */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Active Items (Open & In Progress) - sorted by priority */}
                      {activeItems.map(item => renderItem(item))}
                      
                      {/* Completed Items Section - Collapsible */}
                      {completedItems.length > 0 && (
                        <div className="border-t border-border">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompletedSection(page);
                            }}
                            className="w-full px-4 py-2 flex items-center gap-2 hover:bg-muted/20 transition-colors bg-muted/10"
                          >
                            {isCompletedExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-green-400" />
                            )}
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-sm text-green-400 font-medium">
                              Completed ({completedItems.length})
                            </span>
                          </button>
                          
                          {isCompletedExpanded && (
                            <div className="bg-muted/5">
                              {completedItems.map(item => renderItem(item))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setShowAddModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="font-semibold text-foreground">Add New Item</h3>
              <button
                onClick={() => !isSubmitting && setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-4 space-y-4">
              {/* Page Selection */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Page</label>
                <select
                  value={newItem.page_name}
                  onChange={(e) => setNewItem(prev => ({ ...prev, page_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {availablePages.map(page => (
                    <option key={page} value={page}>{page}</option>
                  ))}
                </select>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(categoryConfig) as FeedbackCategory[]).map((cat) => {
                    const config = categoryConfig[cat];
                    const Icon = config.icon;
                    const isSelected = newItem.category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewItem(prev => ({ ...prev, category: cat }))}
                        className={`p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                          isSelected 
                            ? `${config.bgColor} ${config.borderColor} border-current ${config.color}` 
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
                  value={newItem.title}
                  onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Brief summary of the issue or idea"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Description (optional)</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
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
                    const isSelected = newItem.priority === pri;
                    return (
                      <button
                        key={pri}
                        type="button"
                        onClick={() => setNewItem(prev => ({ ...prev, priority: pri }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected 
                            ? `bg-primary/20 ${config.color} ring-1 ring-current` 
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
                disabled={isSubmitting || !newItem.title.trim()}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Item
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

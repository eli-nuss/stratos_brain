/**
 * Unified Command Bar
 * 
 * A comprehensive search interface that searches across:
 * - Assets (tickers, company names)
 * - Industries & Sectors
 * - Custom Lists
 * - Recent Items
 * 
 * Triggered by ⌘K (Mac) or Ctrl+K (Windows)
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import {
  Search,
  Command,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Building2,
  List,
  Clock,
  X,
  Loader2,
  Layers,
  Tag,
  FileText,
  Coins,
  BarChart3,
} from 'lucide-react';

import {
  useUnifiedSearch,
  SearchCategory,
  AssetResult,
  IndustryResult,
  SectorResult,
  CategoryResult,
  ListResult,
  RecentItem,
  formatPrice,
  formatMarketCap,
} from '@/hooks/useUnifiedSearch';

// ============================================================================
// Types
// ============================================================================

interface UnifiedCommandBarProps {
  className?: string;
}

type FlatItem =
  | { type: 'recent'; data: RecentItem }
  | { type: 'asset'; data: AssetResult }
  | { type: 'industry'; data: IndustryResult | SectorResult | CategoryResult }
  | { type: 'list'; data: ListResult }
  | { type: 'action'; data: QuickAction };

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Search;
  path: string;
  description?: string;
}

// ============================================================================
// Constants
// ============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  { 
    id: 'research', 
    label: 'Open Research Chat', 
    icon: Sparkles, 
    path: '/chat',
    description: 'AI-powered research assistant'
  },
  { 
    id: 'memos', 
    label: 'View Memos', 
    icon: FileText, 
    path: '/memos',
    description: 'Your research memos'
  },
  { 
    id: 'equities', 
    label: 'Browse Equities', 
    icon: BarChart3, 
    path: '/equities',
    description: 'All stocks and ETFs'
  },
  { 
    id: 'crypto', 
    label: 'Browse Crypto', 
    icon: Coins, 
    path: '/crypto',
    description: 'All cryptocurrencies'
  },
];

const CATEGORY_FILTERS: { id: SearchCategory; label: string; shortcut: string }[] = [
  { id: 'all', label: 'All', shortcut: '1' },
  { id: 'assets', label: 'Assets', shortcut: '2' },
  { id: 'industries', label: 'Industries', shortcut: '3' },
  { id: 'lists', label: 'Lists', shortcut: '4' },
];

// ============================================================================
// Component
// ============================================================================

export function UnifiedCommandBar({ className = '' }: UnifiedCommandBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  // Use unified search hook
  const {
    query,
    setQuery,
    debouncedQuery,
    category,
    setCategory,
    results,
    isLoading,
    recentItems,
    addRecentItem,
    totalResults,
  } = useUnifiedSearch({
    minChars: 1,
    maxResultsPerCategory: 6,
    enableRecent: true,
  });

  // ============================================================================
  // Flatten results for keyboard navigation
  // ============================================================================

  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];

    // If no query, show recent items and quick actions
    if (debouncedQuery.length === 0) {
      // Recent items first
      results.recent.forEach((item) => {
        items.push({ type: 'recent', data: item });
      });

      // Quick actions
      QUICK_ACTIONS.forEach((action) => {
        items.push({ type: 'action', data: action });
      });

      return items;
    }

    // With query, show search results grouped by category
    // Recent items that match
    if (category === 'all' || category === 'recent') {
      results.recent.forEach((item) => {
        items.push({ type: 'recent', data: item });
      });
    }

    // Assets
    if (category === 'all' || category === 'assets') {
      results.assets.forEach((asset) => {
        items.push({ type: 'asset', data: asset });
      });
    }

    // Industries/Sectors/Categories
    if (category === 'all' || category === 'industries') {
      results.industries.forEach((industry) => {
        items.push({ type: 'industry', data: industry });
      });
    }

    // Lists
    if (category === 'all' || category === 'lists') {
      results.lists.forEach((list) => {
        items.push({ type: 'list', data: list });
      });
    }

    return items;
  }, [debouncedQuery, results, category]);

  // ============================================================================
  // Keyboard shortcuts
  // ============================================================================

  // Global keyboard shortcut to open (CMD+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setCategory('all');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setQuery, setCategory]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery, category, flatItems.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // ============================================================================
  // Navigation handlers
  // ============================================================================

  const handleSelect = useCallback(
    (item: FlatItem) => {
      switch (item.type) {
        case 'asset':
          // Track as recent
          addRecentItem({
            item_type: 'asset',
            asset_id: item.data.asset_id,
            symbol: item.data.symbol,
            name: item.data.name,
            asset_type: item.data.asset_type,
          });
          setLocation(`/asset/${item.data.asset_id}`);
          break;

        case 'industry':
          // Navigate to filtered view
          const industryData = item.data;
          addRecentItem({
            item_type: 'industry',
            name: industryData.name,
            asset_type: industryData.asset_type,
          });
          
          if (industryData.type === 'industry') {
            setLocation(`/equities?industry=${encodeURIComponent(industryData.name)}`);
          } else if (industryData.type === 'sector') {
            setLocation(`/equities?sector=${encodeURIComponent(industryData.name)}`);
          } else if (industryData.type === 'category') {
            setLocation(`/crypto?category=${encodeURIComponent(industryData.name)}`);
          }
          break;

        case 'list':
          addRecentItem({
            item_type: 'list',
            list_id: item.data.id,
            name: item.data.name,
          });
          setLocation(`/lists/${item.data.id}`);
          break;

        case 'recent':
          // Navigate based on recent item type
          if (item.data.item_type === 'asset' && item.data.asset_id) {
            setLocation(`/asset/${item.data.asset_id}`);
          } else if (item.data.item_type === 'list' && item.data.list_id) {
            setLocation(`/lists/${item.data.list_id}`);
          } else if (item.data.item_type === 'industry') {
            if (item.data.asset_type === 'crypto') {
              setLocation(`/crypto?category=${encodeURIComponent(item.data.name)}`);
            } else {
              setLocation(`/equities?industry=${encodeURIComponent(item.data.name)}`);
            }
          }
          break;

        case 'action':
          setLocation(item.data.path);
          break;
      }

      setIsOpen(false);
      setQuery('');
      setCategory('all');
    },
    [setLocation, addRecentItem, setQuery, setCategory]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;

        case 'Enter':
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            handleSelect(flatItems[selectedIndex]);
          }
          break;

        case 'Tab':
          e.preventDefault();
          // Cycle through categories
          const currentIdx = CATEGORY_FILTERS.findIndex((f) => f.id === category);
          const nextIdx = (currentIdx + (e.shiftKey ? -1 : 1) + CATEGORY_FILTERS.length) % CATEGORY_FILTERS.length;
          setCategory(CATEGORY_FILTERS[nextIdx].id);
          break;

        // Number shortcuts for categories
        case '1':
        case '2':
        case '3':
        case '4':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            const filter = CATEGORY_FILTERS.find((f) => f.shortcut === e.key);
            if (filter) setCategory(filter.id);
          }
          break;
      }
    },
    [flatItems, selectedIndex, handleSelect, category, setCategory]
  );

  // ============================================================================
  // Render helpers
  // ============================================================================

  const renderAssetItem = (asset: AssetResult, index: number, isSelected: boolean) => (
    <button
      key={`asset-${asset.asset_id}`}
      data-index={index}
      onClick={() => handleSelect({ type: 'asset', data: asset })}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
      }`}
    >
      <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold ${
        asset.asset_type === 'crypto' 
          ? 'bg-orange-500/10 text-orange-400' 
          : 'bg-blue-500/10 text-blue-400'
      }`}>
        {asset.symbol?.slice(0, 2) || '??'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{asset.symbol}</span>
          <span className="text-xs text-muted-foreground truncate">{asset.name}</span>
        </div>
        {asset.industry && (
          <div className="text-[10px] text-muted-foreground truncate">{asset.industry}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-mono text-foreground">{formatPrice(asset.close)}</div>
        {asset.market_cap && (
          <div className="text-[10px] text-muted-foreground">{formatMarketCap(asset.market_cap)}</div>
        )}
      </div>
      <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
        asset.asset_type === 'crypto' 
          ? 'text-orange-400 bg-orange-400/10' 
          : 'text-blue-400 bg-blue-400/10'
      }`}>
        {asset.asset_type === 'crypto' ? 'C' : 'E'}
      </span>
      <ArrowRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );

  const renderIndustryItem = (
    industry: IndustryResult | SectorResult | CategoryResult,
    index: number,
    isSelected: boolean
  ) => {
    const Icon = industry.type === 'category' ? Tag : industry.type === 'sector' ? Layers : Building2;
    const typeLabel = industry.type === 'category' ? 'Category' : industry.type === 'sector' ? 'Sector' : 'Industry';
    
    return (
      <button
        key={`${industry.type}-${industry.name}`}
        data-index={index}
        onClick={() => handleSelect({ type: 'industry', data: industry })}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
        }`}
      >
        <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{industry.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {typeLabel} • {industry.asset_type === 'crypto' ? 'Crypto' : 'Equity'}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 bg-muted/50 rounded">
          {typeLabel}
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  };

  const renderListItem = (list: ListResult, index: number, isSelected: boolean) => (
    <button
      key={`list-${list.id}`}
      data-index={index}
      onClick={() => handleSelect({ type: 'list', data: list })}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
      }`}
    >
      <div 
        className="w-8 h-8 rounded flex items-center justify-center text-lg"
        style={{ backgroundColor: list.color ? `${list.color}20` : undefined }}
      >
        {list.icon || '📋'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{list.name}</div>
        {list.description && (
          <div className="text-[10px] text-muted-foreground truncate">{list.description}</div>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 bg-muted/50 rounded">
        List
      </span>
      <ArrowRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );

  const renderRecentItem = (item: RecentItem, index: number, isSelected: boolean) => {
    const Icon = item.item_type === 'list' ? List : item.item_type === 'industry' ? Building2 : TrendingUp;
    
    return (
      <button
        key={`recent-${item.timestamp}`}
        data-index={index}
        onClick={() => handleSelect({ type: 'recent', data: item })}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
        }`}
      >
        <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center">
          <Clock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {item.symbol && <span className="font-medium text-sm">{item.symbol}</span>}
            <span className={`text-sm ${item.symbol ? 'text-muted-foreground' : ''}`}>{item.name}</span>
          </div>
          <div className="text-[10px] text-muted-foreground capitalize">{item.item_type}</div>
        </div>
        <Icon className="w-4 h-4 text-muted-foreground" />
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  };

  const renderActionItem = (action: QuickAction, index: number, isSelected: boolean) => {
    const Icon = action.icon;
    
    return (
      <button
        key={`action-${action.id}`}
        data-index={index}
        onClick={() => handleSelect({ type: 'action', data: action })}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          isSelected ? 'bg-muted/50' : 'hover:bg-muted/30'
        }`}
      >
        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{action.label}</div>
          {action.description && (
            <div className="text-[10px] text-muted-foreground">{action.description}</div>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  };

  // ============================================================================
  // Main render
  // ============================================================================

  const modalContent = isOpen && (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-start justify-center pt-[12vh]"
      onClick={() => {
        setIsOpen(false);
        setQuery('');
        setCategory('all');
      }}
    >
      <div
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tickers, industries, lists..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-muted/50 rounded"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/50 rounded border border-border/50">
            ESC
          </kbd>
        </div>

        {/* Category Filters */}
        {debouncedQuery.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/20">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setCategory(filter.id)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  category === filter.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {filter.label}
                <kbd className="ml-1.5 text-[9px] opacity-60">⌘{filter.shortcut}</kbd>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {(() => {
            let currentIndex = 0;

            // No query - show recent and quick actions
            if (debouncedQuery.length === 0) {
              return (
                <>
                  {/* Recent Items */}
                  {results.recent.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        Recent
                      </div>
                      {results.recent.map((item, idx) => {
                        const itemIndex = currentIndex++;
                        return renderRecentItem(item, itemIndex, itemIndex === selectedIndex);
                      })}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="py-2">
                    <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Quick Actions
                    </div>
                    {QUICK_ACTIONS.map((action, idx) => {
                      const itemIndex = currentIndex++;
                      return renderActionItem(action, itemIndex, itemIndex === selectedIndex);
                    })}
                  </div>
                </>
              );
            }

            // With query - show search results
            const hasResults = totalResults > 0;

            if (!hasResults && !isLoading) {
              return (
                <div className="py-12 text-center text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No results found for "{debouncedQuery}"</p>
                  <p className="text-xs mt-1 opacity-60">Try searching for tickers, company names, or industries</p>
                </div>
              );
            }

            return (
              <>
                {/* Recent matches */}
                {(category === 'all' || category === 'recent') && results.recent.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Recent
                    </div>
                    {results.recent.map((item) => {
                      const itemIndex = currentIndex++;
                      return renderRecentItem(item, itemIndex, itemIndex === selectedIndex);
                    })}
                  </div>
                )}

                {/* Assets */}
                {(category === 'all' || category === 'assets') && results.assets.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" />
                      Assets
                    </div>
                    {results.assets.map((asset) => {
                      const itemIndex = currentIndex++;
                      return renderAssetItem(asset, itemIndex, itemIndex === selectedIndex);
                    })}
                  </div>
                )}

                {/* Industries/Sectors/Categories */}
                {(category === 'all' || category === 'industries') && results.industries.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Building2 className="w-3 h-3" />
                      Industries & Sectors
                    </div>
                    {results.industries.map((industry) => {
                      const itemIndex = currentIndex++;
                      return renderIndustryItem(industry, itemIndex, itemIndex === selectedIndex);
                    })}
                  </div>
                )}

                {/* Lists */}
                {(category === 'all' || category === 'lists') && results.lists.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <List className="w-3 h-3" />
                      Lists
                    </div>
                    {results.lists.map((list) => {
                      const itemIndex = currentIndex++;
                      return renderListItem(list, itemIndex, itemIndex === selectedIndex);
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted/50 rounded">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted/50 rounded">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted/50 rounded">Tab</kbd> Categories
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <kbd className="px-1 py-0.5 bg-muted/50 rounded">⌘K</kbd> Open
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-lg text-sm text-muted-foreground transition-all group ${className}`}
      >
        <Search className="w-4 h-4" />
        <span className="hidden lg:inline">Search anything...</span>
        <span className="hidden md:inline lg:hidden">Search...</span>
        <span className="md:hidden">Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-muted/50 rounded border border-border/50 ml-auto">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* Modal Portal */}
      {typeof document !== 'undefined' && createPortal(modalContent, document.body)}
    </>
  );
}

export default UnifiedCommandBar;

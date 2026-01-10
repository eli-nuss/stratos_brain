import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Command, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { useLocation } from 'wouter';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Asset {
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: string;
}

interface SearchResponse {
  data: Asset[];
  total: number;
}

interface CommandBarProps {
  className?: string;
}

export function CommandBar({ className = '' }: CommandBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  // Fetch assets for search using the all-assets endpoint with search parameter
  const { data: searchResponse } = useSWR<SearchResponse>(
    query.length >= 1 ? `/api/dashboard/all-assets?search=${encodeURIComponent(query)}&limit=8` : null,
    fetcher
  );

  // Extract assets from response - handle both array and object with data property
  const assets = Array.isArray(searchResponse) 
    ? searchResponse 
    : (searchResponse?.data || []);
  
  // Filter results
  const results = assets.slice(0, 8);

  // Quick actions
  const quickActions = [
    { id: 'research', label: 'Open Research Chat', icon: Sparkles, path: '/chat' },
    { id: 'memos', label: 'View Memos', icon: TrendingUp, path: '/memos' },
  ];

  // Combined results for keyboard navigation
  const allItems = query.length >= 1 
    ? results.map(a => ({ type: 'asset' as const, data: a }))
    : quickActions.map(a => ({ type: 'action' as const, data: a }));

  // Keyboard shortcut to open (CMD+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, assets]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      const item = allItems[selectedIndex];
      if (item.type === 'asset') {
        // Navigate using symbol for cleaner URLs
        setLocation(`/asset/${item.data.symbol}`);
      } else {
        setLocation(item.data.path);
      }
      setIsOpen(false);
      setQuery('');
    }
  }, [allItems, selectedIndex, setLocation]);

  const handleSelect = (item: typeof allItems[0]) => {
    if (item.type === 'asset') {
      // Navigate using symbol for cleaner URLs
      setLocation(`/asset/${item.data.symbol}`);
    } else {
      setLocation(item.data.path);
    }
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-lg text-sm text-muted-foreground transition-all group ${className}`}
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">Search ticker, command, or ask Stratos...</span>
        <span className="md:hidden">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-muted/50 rounded border border-border/50 ml-auto">
          <Command className="w-2.5 h-2.5" />K
        </kbd>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[100] flex items-start justify-center pt-[15vh]"
          onClick={() => {
            setIsOpen(false);
            setQuery('');
          }}
        >
          <div 
            className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
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
                placeholder="Search ticker, command, or ask Stratos..."
                className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/50 rounded border border-border/50">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto">
              {query.length >= 1 ? (
                // Asset search results
                results.length > 0 ? (
                  <div className="py-2">
                    <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Assets
                    </div>
                    {results.map((asset, index) => (
                      <button
                        key={asset.asset_id}
                        onClick={() => handleSelect({ type: 'asset', data: asset })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          index === selectedIndex ? 'bg-muted/50' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {asset.symbol?.slice(0, 2) || '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{asset.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate">{asset.name}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase px-1.5 py-0.5 bg-muted/50 rounded">
                          {asset.asset_type}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No assets found for "{query}"</p>
                  </div>
                )
              ) : (
                // Quick actions when no query
                <div className="py-2">
                  <div className="px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Quick Actions
                  </div>
                  {quickActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleSelect({ type: 'action', data: action })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          index === selectedIndex ? 'bg-muted/50' : 'hover:bg-muted/30'
                        }`}
                      >
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="flex-1 text-sm">{action.label}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
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
                <kbd className="px-1 py-0.5 bg-muted/50 rounded">ESC</kbd> Close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CommandBar;

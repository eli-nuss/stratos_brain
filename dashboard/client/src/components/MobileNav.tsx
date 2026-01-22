import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Menu, 
  X, 
  MessageSquare, 
  FileText, 
  BookOpen, 
  CheckSquare, 
  Settings,
  Search,
  Brain,
  Users,
  StickyNote,
  Home,
  Star,
  TrendingUp,
  Bitcoin,
  Layers,
  BarChart3,
  Package,
  Briefcase,
  PieChart,
  ChevronRight,
  Clock,
  Building2,
  List,
  ArrowRight,
  Loader2,
  Sparkles,
  Coins,
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useUnifiedSearch,
  AssetResult,
  IndustryResult,
  SectorResult,
  CategoryResult,
  ListResult,
  RecentItem,
  formatPrice,
  formatMarketCap,
} from '@/hooks/useUnifiedSearch';

interface MobileNavProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Grouped navigation for mobile
const mobileNavGroups = [
  {
    label: 'AI Research',
    items: [
      { href: '/chat', label: 'Company Chat', icon: MessageSquare },
      { href: '/brain', label: 'Stratos Brain', icon: Brain },
    ]
  },
  {
    label: 'Library',
    items: [
      { href: '/notes', label: 'Notes', icon: StickyNote },
      { href: '/memos', label: 'Memos', icon: FileText },
      { href: '/docs', label: 'Docs', icon: BookOpen },
    ]
  },
  {
    label: 'Tools',
    items: [
      { href: '/smart-money', label: 'Smart Money', icon: Users },
      { href: '/todo', label: 'To-Do', icon: CheckSquare },
      { href: '/admin/templates', label: 'Templates', icon: Settings },
    ]
  },
];

// Dashboard quick access tabs
const dashboardTabs = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/equities', label: 'Equities', icon: TrendingUp },
  { href: '/crypto', label: 'Crypto', icon: Bitcoin },
  { href: '/etfs', label: 'ETFs', icon: Layers },
  { href: '/indices', label: 'Indices', icon: BarChart3 },
  { href: '/commodities', label: 'Commodities', icon: Package },
  { href: '/core-portfolio', label: 'Active Portfolio', icon: Briefcase },
  { href: '/model-portfolio', label: 'Model Portfolio', icon: PieChart },
];

// Bottom nav items for quick access (most used features)
const bottomNavItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/chat', label: 'Research', icon: MessageSquare },
  { href: '/brain', label: 'Brain', icon: Brain },
];

// Quick actions for mobile search
const MOBILE_QUICK_ACTIONS = [
  { id: 'research', label: 'Research Chat', icon: Sparkles, path: '/chat' },
  { id: 'memos', label: 'View Memos', icon: FileText, path: '/memos' },
  { id: 'equities', label: 'Browse Equities', icon: BarChart3, path: '/equities' },
  { id: 'crypto', label: 'Browse Crypto', icon: Coins, path: '/crypto' },
];

export function MobileNav({ searchQuery = '', onSearchChange }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [location, setLocation] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use unified search
  const {
    query,
    setQuery,
    debouncedQuery,
    results,
    isLoading,
    addRecentItem,
  } = useUnifiedSearch({
    minChars: 1,
    maxResultsPerCategory: 5,
    enableRecent: true,
  });

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close menu on route change
  useEffect(() => {
    closeMenu();
    setShowSearch(false);
    setQuery('');
  }, [location, setQuery]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Check if we're on the main dashboard
  const isMainDashboard = location === "/" || location === "/watchlist" || 
    location === "/equities" || location === "/crypto" || 
    location === "/etfs" || location === "/indices" || location === "/commodities" ||
    location === "/model-portfolio" || location === "/core-portfolio" ||
    location.startsWith("/list/");

  // Handle selection
  const handleSelectAsset = useCallback((asset: AssetResult) => {
    addRecentItem({
      item_type: 'asset',
      asset_id: asset.asset_id,
      symbol: asset.symbol,
      name: asset.name,
      asset_type: asset.asset_type,
    });
    setLocation(`/asset/${asset.asset_id}`);
    setShowSearch(false);
    setQuery('');
  }, [addRecentItem, setLocation, setQuery]);

  const handleSelectIndustry = useCallback((industry: IndustryResult | SectorResult | CategoryResult) => {
    addRecentItem({
      item_type: 'industry',
      name: industry.name,
      asset_type: industry.asset_type,
    });
    
    if (industry.type === 'industry') {
      setLocation(`/equities?industry=${encodeURIComponent(industry.name)}`);
    } else if (industry.type === 'sector') {
      setLocation(`/equities?sector=${encodeURIComponent(industry.name)}`);
    } else if (industry.type === 'category') {
      setLocation(`/crypto?category=${encodeURIComponent(industry.name)}`);
    }
    setShowSearch(false);
    setQuery('');
  }, [addRecentItem, setLocation, setQuery]);

  const handleSelectList = useCallback((list: ListResult) => {
    addRecentItem({
      item_type: 'list',
      list_id: list.id,
      name: list.name,
    });
    setLocation(`/lists/${list.id}`);
    setShowSearch(false);
    setQuery('');
  }, [addRecentItem, setLocation, setQuery]);

  const handleSelectRecent = useCallback((item: RecentItem) => {
    if (item.item_type === 'asset' && item.asset_id) {
      setLocation(`/asset/${item.asset_id}`);
    } else if (item.item_type === 'list' && item.list_id) {
      setLocation(`/lists/${item.list_id}`);
    } else if (item.item_type === 'industry') {
      if (item.asset_type === 'crypto') {
        setLocation(`/crypto?category=${encodeURIComponent(item.name)}`);
      } else {
        setLocation(`/equities?industry=${encodeURIComponent(item.name)}`);
      }
    }
    setShowSearch(false);
    setQuery('');
  }, [setLocation, setQuery]);

  const handleSelectAction = useCallback((path: string) => {
    setLocation(path);
    setShowSearch(false);
    setQuery('');
  }, [setLocation, setQuery]);

  const hasResults = results.assets.length > 0 || results.industries.length > 0 || results.lists.length > 0;

  return (
    <>
      {/* Mobile Menu Button and Dropdown Container */}
      <div className="relative md:hidden" ref={menuRef}>
        <button
          onClick={toggleMenu}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Dropdown Menu - Opens Downward */}
        {isOpen && (
          <div 
            className="absolute top-full right-0 mt-2 w-72 max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-border shadow-xl z-[100]"
            style={{ backgroundColor: 'hsl(222, 47%, 11%)' }}
          >
            {/* Quick Navigation Links */}
            <div className="p-2 border-b border-border">
              <div className="grid grid-cols-3 gap-1">
                {dashboardTabs.slice(0, 6).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = location === tab.href;
                  
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={closeMenu}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors text-center',
                        isActive
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-medium truncate w-full">{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Grouped Navigation */}
            <div className="p-2">
              {mobileNavGroups.map((group, groupIndex) => (
                <div key={group.label} className={cn(groupIndex > 0 && "mt-3 pt-3 border-t border-border/50")}>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                    {group.label}
                  </h3>
                  <nav className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMenu}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                            isActive
                              ? 'bg-primary/20 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="text-sm flex-1">{item.label}</span>
                          <ChevronRight className="w-3 h-3 opacity-50" />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* More Asset Lists */}
            <div className="p-2 border-t border-border">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                More Lists
              </h3>
              <div className="grid grid-cols-2 gap-1">
                {dashboardTabs.slice(6).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = location === tab.href;
                  
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      onClick={closeMenu}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
                        isActive
                          ? 'bg-primary/20 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                      )}
                    >
                      <Icon className="w-3 h-3 flex-shrink-0" />
                      <span className="text-xs truncate">{tab.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Modal Overlay - Now with Unified Search */}
      {showSearch && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] md:hidden animate-in fade-in duration-200"
          onClick={() => {
            setShowSearch(false);
            setQuery('');
          }}
        >
          <div 
            className="absolute top-0 left-0 right-0 max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-top duration-300"
            style={{ backgroundColor: 'hsl(222, 47%, 11%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="p-4 border-b border-border flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search tickers, industries, lists..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 text-base bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {isLoading && (
                  <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {debouncedQuery.length === 0 ? (
                // Show recent items and quick actions when no query
                <>
                  {/* Recent Items */}
                  {results.recent.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        Recent
                      </div>
                      {results.recent.map((item) => (
                        <button
                          key={`recent-${item.timestamp}`}
                          onClick={() => handleSelectRecent(item)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {item.symbol && <span className="font-medium text-sm">{item.symbol}</span>}
                              <span className={`text-sm truncate ${item.symbol ? 'text-muted-foreground' : ''}`}>{item.name}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground capitalize">{item.item_type}</div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="py-2 border-t border-border">
                    <div className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      Quick Actions
                    </div>
                    {MOBILE_QUICK_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleSelectAction(action.path)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
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
                </>
              ) : !hasResults && !isLoading ? (
                // No results
                <div className="py-12 text-center text-muted-foreground">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No results for "{debouncedQuery}"</p>
                  <p className="text-xs mt-1 opacity-60">Try tickers, names, or industries</p>
                </div>
              ) : (
                // Search results
                <>
                  {/* Assets */}
                  {results.assets.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" />
                        Assets
                      </div>
                      {results.assets.map((asset) => (
                        <button
                          key={`asset-${asset.asset_id}`}
                          onClick={() => handleSelectAsset(asset)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
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
                            <div className="text-xs font-mono">{formatPrice(asset.close)}</div>
                            {asset.market_cap && (
                              <div className="text-[10px] text-muted-foreground">{formatMarketCap(asset.market_cap)}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Industries */}
                  {results.industries.length > 0 && (
                    <div className="py-2 border-t border-border">
                      <div className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Building2 className="w-3 h-3" />
                        Industries & Sectors
                      </div>
                      {results.industries.map((industry) => {
                        const Icon = industry.type === 'category' ? Tag : industry.type === 'sector' ? Layers : Building2;
                        const typeLabel = industry.type === 'category' ? 'Category' : industry.type === 'sector' ? 'Sector' : 'Industry';
                        
                        return (
                          <button
                            key={`${industry.type}-${industry.name}`}
                            onClick={() => handleSelectIndustry(industry)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
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
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Lists */}
                  {results.lists.length > 0 && (
                    <div className="py-2 border-t border-border">
                      <div className="px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <List className="w-3 h-3" />
                        Lists
                      </div>
                      {results.lists.map((list) => (
                        <button
                          key={`list-${list.id}`}
                          onClick={() => handleSelectList(list)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
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
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar - Fixed at bottom on mobile */}
      <div 
        className="fixed bottom-0 left-0 right-0 h-16 border-t border-border z-[50] md:hidden safe-area-inset-bottom"
        style={{ backgroundColor: 'hsl(222, 47%, 11%)' }}
      >
        <nav className="flex items-center justify-around h-full px-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            // Special handling for Home - active when on dashboard pages
            const isActive = item.href === '/' 
              ? isMainDashboard 
              : location === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "fill-primary/20")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Search button */}
          <button
            onClick={() => setShowSearch(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
              'text-muted-foreground hover:text-foreground'
            )}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium">Search</span>
          </button>
          
          {/* More button to open dropdown */}
          <button
            onClick={toggleMenu}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
              isOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      </div>
    </>
  );
}

import { useState } from 'react';
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
  Activity,
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
  PieChart
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  { href: '/', label: 'Dashboard', icon: Home },
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

export function MobileNav({ searchQuery = '', onSearchChange }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [location] = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  // Check if we're on the main dashboard
  const isMainDashboard = location === "/" || location === "/watchlist" || 
    location === "/equities" || location === "/crypto" || 
    location === "/etfs" || location === "/indices" || location === "/commodities" ||
    location === "/model-portfolio" || location === "/core-portfolio" ||
    location.startsWith("/list/");

  return (
    <>
      {/* Mobile Menu Button - visible only on small screens (in header) */}
      <div className="flex items-center gap-1 md:hidden">
        {/* Only show hamburger in header - search is in bottom nav */}
        <button
          onClick={toggleMenu}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Search Modal Overlay */}
      {showSearch && (
        <div 
          className="fixed inset-0 bg-black/60 z-[60] md:hidden animate-in fade-in duration-200"
          onClick={() => setShowSearch(false)}
        >
          <div 
            className="absolute top-0 left-0 right-0 p-4 bg-card border-b border-border animate-in slide-in-from-top duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-10 py-3 text-base bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => setShowSearch(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[55] md:hidden animate-in fade-in duration-200"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-72 border-l border-border z-[56] md:hidden',
          'transform transition-transform duration-300 ease-out overflow-y-auto',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ backgroundColor: 'hsl(var(--card))' }}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 z-10" style={{ backgroundColor: 'hsl(var(--card))' }}>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">STRATOSBRAIN</span>
          </div>
          <button
            onClick={closeMenu}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grouped Navigation */}
        <div className="p-3" style={{ backgroundColor: 'hsl(var(--card))' }}>
          {mobileNavGroups.map((group, groupIndex) => (
            <div key={group.label} className={cn(groupIndex > 0 && "mt-4")}>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-2">
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                        'min-h-[44px]',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Dashboard Quick Access */}
        <div className="p-3 border-t border-border" style={{ backgroundColor: 'hsl(var(--card))' }}>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-2">
            Asset Lists
          </h3>
          <nav className="grid grid-cols-2 gap-1">
            {dashboardTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location === tab.href;
              
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={closeMenu}
                  className={cn(
                    'flex items-center gap-2 px-2 py-2 rounded-lg transition-colors',
                    'min-h-[40px]',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate">{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer spacer for bottom nav */}
        <div className="h-24" />
      </div>

      {/* Bottom Navigation Bar - Fixed at bottom on mobile */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-[50] md:hidden safe-area-inset-bottom">
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
          
          {/* More button to open drawer */}
          <button
            onClick={toggleMenu}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
              'text-muted-foreground hover:text-foreground'
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

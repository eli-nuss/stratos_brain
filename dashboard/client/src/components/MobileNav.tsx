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
  LayoutDashboard,
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

// Main navigation links (same as desktop header)
const mainNavLinks = [
  { href: '/chat', label: 'Research', icon: MessageSquare },
  { href: '/brain', label: 'Stratos Brain', icon: Brain },
  { href: '/smart-money', label: 'Smart Money', icon: Users },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/memos', label: 'Memos', icon: FileText },
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/todo', label: 'To-Do', icon: CheckSquare },
  { href: '/admin/templates', label: 'Templates', icon: Settings },
];

// Dashboard tabs (for quick access)
const dashboardTabs = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/?tab=watchlist', label: 'Watchlist', icon: Star },
  { href: '/?tab=equities', label: 'Equities', icon: TrendingUp },
  { href: '/?tab=crypto', label: 'Crypto', icon: Bitcoin },
  { href: '/?tab=etfs', label: 'ETFs', icon: Layers },
  { href: '/?tab=indices', label: 'Indices', icon: BarChart3 },
  { href: '/?tab=commodities', label: 'Commodities', icon: Package },
  { href: '/?tab=core-portfolio', label: 'Active Portfolio', icon: Briefcase },
  { href: '/?tab=model-portfolio', label: 'Model Portfolio', icon: PieChart },
];

export function MobileNav({ searchQuery = '', onSearchChange }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [location] = useLocation();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Menu Button - visible only on small screens */}
      <div className="flex items-center gap-2 sm:hidden">
        {/* Search Button */}
        {onSearchChange && (
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
        
        {/* Hamburger Button */}
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
          className="fixed inset-0 bg-black/60 z-[60] sm:hidden animate-in fade-in duration-200"
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
          className="fixed inset-0 bg-black/60 z-[55] sm:hidden animate-in fade-in duration-200"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-72 bg-card border-l border-border z-[56] sm:hidden',
          'transform transition-transform duration-300 ease-out overflow-y-auto',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            <span className="font-semibold">Menu</span>
          </div>
          <button
            onClick={closeMenu}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation Links */}
        <div className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Navigation
          </h3>
          <nav className="space-y-1">
            {mainNavLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    'min-h-[44px]', // Minimum touch target
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Dashboard Tabs Section */}
        <div className="p-4 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Dashboard
          </h3>
          <nav className="space-y-1">
            {dashboardTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location === '/' && tab.href === '/';
              
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={closeMenu}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    'min-h-[44px]', // Minimum touch target
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer spacer */}
        <div className="h-20" />
      </div>
    </>
  );
}

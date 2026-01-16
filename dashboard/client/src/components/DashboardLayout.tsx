import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { Activity, MessageSquare, FileText, BookOpen, CheckSquare, Settings, Brain, Users, StickyNote } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { CommandBar } from "@/components/CommandBar";
import { DataStatusIndicator } from "@/components/DataStatusIndicator";
import { ListSidebar } from "@/components/ListSidebar";
import { StockList } from "@/hooks/useStockLists";
import { TabType } from "@/pages/Home";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  hideNavTabs?: boolean;
  stockLists?: StockList[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onListCreated?: () => void;
  onListsReordered?: (lists: StockList[]) => void;
  onListDeleted?: () => void;
  onListRenamed?: () => void;
}

// Navigation links for the app bar
const navLinks = [
  { href: '/chat', label: 'Research', icon: MessageSquare },
  { href: '/brain', label: 'Stratos Brain', icon: Brain },
  { href: '/smart-money', label: 'Smart Money', icon: Users },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/memos', label: 'Memos', icon: FileText },
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/todo', label: 'To-Do', icon: CheckSquare },
];

export default function DashboardLayout({ 
  children, 
  activeTab = "watchlist", 
  onTabChange = () => {}, 
  hideNavTabs = false,
  stockLists = [],
  searchQuery = "",
  onSearchChange = () => {},
  onListCreated,
  onListsReordered,
  onListDeleted,
  onListRenamed
}: DashboardLayoutProps) {
  const { data: health } = useSWR("/api/dashboard/health", fetcher, {
    refreshInterval: 60000,
  });
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check if current page is a detail/sub-page (not main dashboard)
  const isMainDashboard = location === "/" || location === "/watchlist" || 
    location === "/equities" || location === "/crypto" || 
    location === "/etfs" || location === "/indices" || location === "/commodities" ||
    location === "/model-portfolio" || location === "/model-portfolio-sandbox" || 
    location === "/core-portfolio" ||
    location.startsWith("/list/");

  return (
    // Root Container - Viewport-Fixed Application Shell
    // h-screen: Fill entire viewport height
    // overflow-hidden: Prevent body scroll - only specific panels scroll
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Header - Fixed at top, never scrolls */}
      <header className="flex-none h-[52px] border-b border-border bg-card/80 backdrop-blur-sm z-50 flex items-center px-4 gap-4">
        {/* Left: Logo + Nav Tabs */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Activity className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold tracking-tight hidden sm:inline">
              STRATOS<span className="text-muted-foreground font-normal">BRAIN</span>
            </span>
          </Link>

          {/* Divider */}
          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Navigation Tabs - App Style */}
          <nav className="hidden sm:flex items-center">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors relative",
                    isActive
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
            
            {/* Templates - admin only, less prominent */}
            <Link
              href="/admin/templates"
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground/60 hover:text-muted-foreground rounded-md transition-colors hidden lg:block"
            >
              Templates
            </Link>
          </nav>
        </div>

        {/* Center: Command Bar */}
        <div className="flex-1 flex justify-center max-w-xl mx-auto">
          <CommandBar className="w-full" />
        </div>

        {/* Right: Status + User */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Data Status Indicator */}
          <DataStatusIndicator
            equityDate={health?.latest_dates?.equity}
            cryptoDate={health?.latest_dates?.crypto}
          />

          {/* Divider */}
          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* User Menu */}
          <UserMenu />

          {/* Mobile Nav */}
          <MobileNav searchQuery={searchQuery} onSearchChange={onSearchChange} />
        </div>
      </header>

      {/* Main Body Wrapper - Takes remaining vertical space */}
      {/* flex-1: Grow to fill remaining space after header */}
      {/* overflow-hidden: Prevent this container from scrolling */}
      {isMainDashboard && !hideNavTabs ? (
        // Dashboard view with sidebar
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Left Sidebar - Fixed width, scrolls internally */}
          <aside className={cn(
            "hidden md:flex flex-col flex-none h-full border-r border-border overflow-y-auto bg-card transition-all duration-200",
            sidebarCollapsed ? "w-0" : "w-64"
          )}>
            <ListSidebar
              activeTab={activeTab}
              onTabChange={onTabChange}
              stockLists={stockLists}
              searchQuery={searchQuery}
              onSearchChange={onSearchChange}
              onListCreated={onListCreated}
              onListsReordered={onListsReordered}
              onListDeleted={onListDeleted}
              onListRenamed={onListRenamed}
            />
          </aside>

          {/* Center Panel - The ONLY scrollable content area */}
          <main className="flex-1 h-full overflow-y-auto scroll-smooth bg-background">
            <div className="container py-4">
              {children}
            </div>
          </main>
        </div>
      ) : (
        // Sub-page view (no sidebar) - Scrollable content area
        <main className="flex-1 overflow-y-auto scroll-smooth bg-background">
          {children}
        </main>
      )}
    </div>
  );
}

import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { 
  Activity, 
  MessageSquare, 
  FileText, 
  BookOpen, 
  CheckSquare, 
  Brain, 
  Users, 
  StickyNote,
  Home,
  ChevronDown,
  Settings
} from "lucide-react";
import UserMenu from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { CommandBar } from "@/components/CommandBar";
import { DataStatusIndicator } from "@/components/DataStatusIndicator";
import { ListSidebar } from "@/components/ListSidebar";
import { StockList } from "@/hooks/useStockLists";
import { TabType } from "@/pages/Home";
import { apiFetcher } from "@/lib/api-config";

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

// Grouped navigation structure
const navGroups = [
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
];

// Standalone nav items
const standaloneNavItems = [
  { href: '/smart-money', label: 'Smart Money', icon: Users },
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
  const { data: health } = useSWR<{ latest_dates?: { equity?: string; crypto?: string } }>("/api/dashboard/health", apiFetcher, {
    refreshInterval: 60000,
  });
  const [location] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Check if current page is a detail/sub-page (not main dashboard)
  const isMainDashboard = location === "/" || location === "/watchlist" || 
    location === "/equities" || location === "/crypto" || 
    location === "/etfs" || location === "/indices" || location === "/commodities" ||
    location === "/model-portfolio" || location === "/model-portfolio-sandbox" || 
    location === "/core-portfolio" ||
    location.startsWith("/list/");

  // Check if any item in a group is active
  const isGroupActive = (items: { href: string }[]) => 
    items.some(item => location === item.href);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex-none h-[52px] border-b border-border bg-card/80 backdrop-blur-sm z-50 flex items-center px-2 md:px-4 gap-2 md:gap-3">
        {/* Left: Logo + Home + Nav */}
        <div className="flex items-center gap-2">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Activity className="w-5 h-5 text-primary" />
            <span className="text-base font-bold tracking-tight hidden md:inline">
              STRATOS<span className="text-muted-foreground font-normal">BRAIN</span>
            </span>
          </Link>

          {/* Divider */}
          <div className="h-4 w-px bg-border hidden md:block mx-1" />

          {/* Dashboard/Home Link */}
          <Link
            href="/"
            className={cn(
              "hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
              isMainDashboard
                ? "text-foreground bg-muted"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>

          {/* Navigation Groups with Dropdowns */}
          <nav className="hidden md:flex items-center gap-1">
            {navGroups.map((group) => {
              const isActive = isGroupActive(group.items);
              const isOpen = openDropdown === group.label;
              
              return (
                <div 
                  key={group.label} 
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(group.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                      isActive
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {group.label}
                    <ChevronDown className={cn(
                      "w-3 h-3 transition-transform",
                      isOpen && "rotate-180"
                    )} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isOpen && (
                    <div className="absolute top-full left-0 pt-1 z-50">
                      <div className="py-1 bg-card border border-border rounded-lg shadow-lg min-w-[160px]">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const itemActive = location === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                              itemActive
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            <Icon className="w-4 h-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Standalone Items */}
            {standaloneNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                    isActive
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}

            {/* To-Do - slightly less prominent */}
            <Link
              href="/todo"
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                location === "/todo"
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
              )}
            >
              To-Do
            </Link>
          </nav>
        </div>

        {/* Center: Command Bar - hidden on mobile, use bottom nav search instead */}
        <div className="hidden md:flex flex-1 justify-center max-w-md mx-auto">
          <CommandBar className="w-full" />
        </div>

        {/* Spacer for mobile to push right items to the end */}
        <div className="flex-1 md:hidden" />

        {/* Right: Status + User + Admin */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Data Status Indicator */}
          <DataStatusIndicator
            equityDate={health?.latest_dates?.equity}
            cryptoDate={health?.latest_dates?.crypto}
          />

          {/* Divider */}
          <div className="h-4 w-px bg-border hidden md:block" />

          {/* Templates (Admin) - icon only on desktop */}
          <Link
            href="/admin/templates"
            className={cn(
              "hidden lg:flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              location === "/admin/templates"
                ? "text-foreground bg-muted"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
            )}
            title="Templates"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* User Menu */}
          <UserMenu />

          {/* Mobile Nav */}
          <MobileNav searchQuery={searchQuery} onSearchChange={onSearchChange} />
        </div>
      </header>

      {/* Main Body Wrapper */}
      {isMainDashboard && !hideNavTabs ? (
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Left Sidebar */}
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

          {/* Center Panel */}
          <main className="flex-1 h-full overflow-y-auto scroll-smooth bg-background">
            <div className="container py-4">
              {children}
            </div>
          </main>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto scroll-smooth bg-background">
          {children}
        </main>
      )}
    </div>
  );
}

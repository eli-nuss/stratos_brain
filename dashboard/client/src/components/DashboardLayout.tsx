import { ReactNode } from "react";
import useSWR from "swr";
import { Activity, Brain, Bot, Pill, Rocket, BookOpen, Settings, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StockList } from "@/hooks/useStockLists";
import { TabType } from "@/pages/Home";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Map icon names to Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  robot: Bot,
  pill: Pill,
  rocket: Rocket,
};

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  stockLists?: StockList[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function DashboardLayout({ 
  children, 
  activeTab, 
  onTabChange, 
  stockLists = [],
  searchQuery = "",
  onSearchChange
}: DashboardLayoutProps) {
  const { data: health } = useSWR("/api/dashboard/health", fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || Brain;
  };

  // Format date to be more compact (e.g., "Jan 7" instead of "2026-01-07")
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "...";
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Status Bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container h-12 flex items-center justify-between">
          {/* Left: Logo + Data Status */}
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-base font-bold tracking-tight flex items-center gap-1.5 cursor-help">
                  <Activity className="w-4 h-4 text-primary" />
                  STRATOS<span className="text-muted-foreground font-normal">BRAIN</span>
                </h1>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                AI-powered technical analysis dashboard for crypto and equity markets.
              </TooltipContent>
            </Tooltip>
            
            {/* Data Status - 2 row layout */}
            <div className="flex flex-col gap-0.5 text-[10px] font-mono text-muted-foreground/70">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground/50">Crypto:</span>
                <span>{formatDate(health?.latest_dates?.crypto)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground/50">Equity:</span>
                <span>{formatDate(health?.latest_dates?.equity)}</span>
              </div>
            </div>
          </div>

          {/* Center: Navigation Tabs */}
          <nav className="flex items-center">
            <div className="flex items-center bg-muted/30 p-0.5 rounded-lg gap-0.5">
              {/* Watchlist */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("watchlist")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                      activeTab === "watchlist"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    Watchlist
                  </button>
                </TooltipTrigger>
                <TooltipContent>Your personal watchlist</TooltipContent>
              </Tooltip>
              
              <div className="h-3 w-px bg-border/50 mx-0.5" />
              
              {/* Equities */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("equity")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                      activeTab === "equity"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    Equities
                  </button>
                </TooltipTrigger>
                <TooltipContent>US equity stocks</TooltipContent>
              </Tooltip>
              
              {/* Crypto */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("crypto")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                      activeTab === "crypto"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    Crypto
                  </button>
                </TooltipTrigger>
                <TooltipContent>Cryptocurrency assets (24/7 data)</TooltipContent>
              </Tooltip>
              
              {/* Stock Lists */}
              {stockLists.length > 0 && <div className="h-3 w-px bg-border/50 mx-0.5" />}
              {stockLists.map((list) => {
                const Icon = getIcon(list.icon);
                const tabId = `list-${list.id}` as TabType;
                return (
                  <Tooltip key={list.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTabChange(tabId)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                          activeTab === tabId
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span style={{ color: list.color }}><Icon className="w-3 h-3" /></span>
                        {list.name}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{list.description}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </nav>

          {/* Right: Search + Links */}
          <div className="flex items-center gap-2">
            {/* Global Search */}
            {onSearchChange && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-32 pl-7 pr-2 py-1 text-xs bg-muted/30 border border-border/50 rounded focus:outline-none focus:ring-1 focus:ring-primary focus:w-48 transition-all"
                />
              </div>
            )}
            
            <div className="h-3 w-px bg-border/50" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/docs"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Documentation</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/admin/templates"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all"
                >
                  <Settings className="w-3.5 h-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Template Editor</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-4">
        {children}
      </main>
    </div>
  );
}

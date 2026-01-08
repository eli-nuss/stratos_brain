import { ReactNode } from "react";
import useSWR from "swr";
import { Activity, Database, Brain, Clock, AlertTriangle, Info, BookOpen, Bot, Pill, Rocket } from "lucide-react";
import { format } from "date-fns";
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
}

export default function DashboardLayout({ children, activeTab, onTabChange, stockLists = [] }: DashboardLayoutProps) {
  const { data: health } = useSWR("/api/dashboard/health", fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || Brain;
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Status Bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2 cursor-help">
                  <Activity className="w-5 h-5 text-primary" />
                  STRATOS<span className="text-muted-foreground font-normal">BRAIN</span>
                </h1>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                AI-powered technical analysis dashboard. Monitors crypto and equity markets for high-probability trading setups using quantitative signals and chart pattern recognition.
              </TooltipContent>
            </Tooltip>
            
            <div className="h-4 w-px bg-border" />
            
            {/* Health Stats */}
            <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Clock className="w-3 h-3" />
                    <span>EQ: {health?.latest_dates?.equity || "..."}</span>
                    <span className="text-border">|</span>
                    <span>CRYPTO: {health?.latest_dates?.crypto || "..."}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Latest data dates for each asset class. Equity data updates after market close (4 PM ET). Crypto data updates continuously (24/7).
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Database className="w-3 h-3" />
                    <span>{(health?.eligible_assets?.equity || 0) + (health?.eligible_assets?.crypto || 0)} ASSETS</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Total number of assets being monitored. Assets must meet minimum liquidity and volume requirements to be included in the analysis universe.
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Brain className="w-3 h-3" />
                    <span>AI REVIEWS: {health?.ai_reviews_today?.total || 0}</span>
                    {health?.ai_reviews_today?.urgent > 0 && (
                      <span className="text-attention-urgent flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {health.ai_reviews_today.urgent} URGENT
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    <div><strong>AI Reviews:</strong> Number of assets analyzed by AI today based on signal triggers.</div>
                    {health?.ai_reviews_today?.urgent > 0 && (
                      <div><strong>URGENT:</strong> High-conviction setups requiring immediate attention. These have strong technical evidence and favorable risk/reward.</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/docs"
                  className="px-3 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4" />
                  Docs
                </a>
              </TooltipTrigger>
              <TooltipContent>
                AI Analysis system documentation and methodology
              </TooltipContent>
            </Tooltip>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center bg-muted/50 p-1 rounded-lg gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("watchlist")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      activeTab === "watchlist"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ⭐ Watchlist
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Your personal watchlist. Add assets from Crypto or Equities tabs.
                </TooltipContent>
              </Tooltip>
              
              {/* Stock List Tabs */}
              {stockLists.map((list) => {
                const Icon = getIcon(list.icon);
                const tabId = `list-${list.id}` as TabType;
                return (
                  <Tooltip key={list.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTabChange(tabId)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                          activeTab === tabId
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: list.color }} />
                        {list.name}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {list.description}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              
              <div className="h-4 w-px bg-border mx-1" />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("crypto")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      activeTab === "crypto"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Crypto
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Cryptocurrency assets including BTC, ETH, and altcoins. Data updates 24/7.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("equity")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      activeTab === "equity"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Equities
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  US equity stocks. Data updates after market close (4 PM ET).
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-6">
        {children}
      </main>
    </div>
  );
}

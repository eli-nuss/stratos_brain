// Daily Brief V4 - Enhanced with live data, alerts, visual polish, and PDF export
// Dark theme, green/red color coding, information-dense layout

import { useState, useRef } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Card, CardContent, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { 
  RefreshCw, TrendingUp, TrendingDown, ChevronDown, 
  Landmark, Sparkles, ArrowUpRight, ArrowDownRight,
  ExternalLink, Clock, Briefcase, Newspaper,
  AlertCircle, Info, Bell, FileDown, Zap, Target, Activity,
  Plus, Minus, Hand, AlertTriangle, CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { getApiUrl } from "@/lib/api-config";
import { format } from "date-fns";

// --- Helper Functions ---

const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

// Smart truncation at word boundaries
const smartTruncate = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > maxLength * 0.7 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
};

// Format price with appropriate decimals
const formatPrice = (price: number): string => {
  if (!price || price === 0) return '-';
  if (price < 1) return price.toFixed(4);
  if (price < 10) return price.toFixed(3);
  if (price < 100) return price.toFixed(2);
  return price.toFixed(2);
};

// Format percentage change
const formatChange = (change: number): string => {
  if (change === 0 || change === undefined) return '0.00%';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
};

// --- Types ---

interface PortfolioHolding {
  asset_id: number;
  symbol: string;
  name: string;
  asset_type?: string;
  action: "ADD" | "TRIM" | "HOLD";
  cost_basis?: number;
  current_price?: number;
  change_pct?: number;
  ai_direction: number | string;
  rsi: number;
  setup: string;
  news: string;
  news_full?: string;
  news_url?: string;
  news_time?: string;
  asset_url: string;
}

interface MarketTicker {
  spy_price?: number;
  spy_change: number;
  qqq_price?: number;
  qqq_change: number;
  iwm_price?: number;
  iwm_change: number;
  btc_price?: number;
  btc_change: number;
  yield_10y: number;
  vix: number;
  regime: string;
  last_updated?: string;
}

interface Alert {
  symbol: string;
  name: string;
  alert_type: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  asset_url: string;
}

interface IntelItem {
  category: string;
  headline: string;
  impact: string;
  url: string;
  source: string;
  date: string;
  time_ago?: string;
}

interface AssetPick {
  asset_id?: number;
  symbol: string;
  name?: string;
  conviction: "HIGH" | "MEDIUM" | "LOW";
  setup_type: string;
  score?: number;
  asset_url?: string;
}

interface CategoryData {
  theme_summary: string;
  picks: AssetPick[];
}

interface MorningIntel {
  market_pulse: string;
  macro_calendar: string;
  liquidity_flows: string;
  generated_at: string;
}

interface DailyBriefData {
  date: string;
  market_ticker: MarketTicker;
  market_regime: string;
  macro_summary: string;
  morning_intel: MorningIntel;
  portfolio: PortfolioHolding[];
  alerts?: Alert[];
  categories: {
    momentum_breakouts: CategoryData;
    trend_continuation: CategoryData;
    compression_reversion: CategoryData;
  };
  intel_items: IntelItem[];
  tokens?: { in: number; out: number };
}

// --- Components ---

function MarketTickerBar({ ticker }: { ticker: MarketTicker }) {
  const regimeColors: Record<string, string> = {
    BULLISH: "text-green-400 bg-green-500/10 border-green-500/30",
    BEARISH: "text-red-400 bg-red-500/10 border-red-500/30",
    VOLATILE: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    NEUTRAL: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    Neutral: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  };
  
  const ChangeDisplay = ({ label, price, change }: { label: string, price?: number, change: number }) => (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      {price && price > 0 && (
        <span className="font-mono text-sm">${formatPrice(price)}</span>
      )}
      <span className={cn(
        "font-mono text-sm font-medium",
        change > 0 ? "text-green-400" : change < 0 ? "text-red-400" : "text-muted-foreground"
      )}>
        {formatChange(change)}
      </span>
    </div>
  );
  
  return (
    <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4 md:gap-6">
        <div className={cn(
          "px-3 py-1.5 rounded-md border text-sm font-semibold",
          regimeColors[ticker.regime] || "text-muted-foreground bg-muted border-border"
        )}>
          {ticker.regime?.toUpperCase() || "NEUTRAL"}
        </div>
        
        <ChangeDisplay label="SPY" price={ticker.spy_price} change={ticker.spy_change} />
        <ChangeDisplay label="QQQ" price={ticker.qqq_price} change={ticker.qqq_change} />
        <ChangeDisplay label="IWM" price={ticker.iwm_price} change={ticker.iwm_change} />
        <ChangeDisplay label="BTC" price={ticker.btc_price} change={ticker.btc_change} />
        
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">VIX</span>
          <span className={cn(
            "font-mono text-sm font-medium",
            ticker.vix > 25 ? "text-red-400" : ticker.vix > 20 ? "text-yellow-400" : "text-green-400"
          )}>
            {ticker.vix?.toFixed(1) || "14.0"}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">10Y</span>
          <span className="font-mono text-sm">{ticker.yield_10y?.toFixed(2) || "4.26"}</span>
        </div>
      </div>
    </div>
  );
}

function AlertsSection({ alerts, navigate }: { alerts: Alert[], navigate: (path: string) => void }) {
  if (!alerts || alerts.length === 0) return null;
  
  const severityColors = {
    HIGH: "border-l-red-500 bg-red-500/5",
    MEDIUM: "border-l-yellow-500 bg-yellow-500/5",
    LOW: "border-l-blue-500 bg-blue-500/5"
  };
  
  const severityIcons = {
    HIGH: AlertTriangle,
    MEDIUM: Bell,
    LOW: Info
  };
  
  return (
    <Card className="bg-card/50 border-border mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-yellow-400" />
          Portfolio Alerts
          <Badge variant="outline" className="text-xs ml-2">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {alerts.map((alert, i) => {
            const Icon = severityIcons[alert.severity];
            return (
              <div 
                key={i}
                onClick={() => navigate(alert.asset_url)}
                className={cn(
                  "p-3 rounded border-l-2 cursor-pointer hover:bg-muted/50 transition-colors",
                  severityColors[alert.severity]
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    alert.severity === 'HIGH' ? "text-red-400" : 
                    alert.severity === 'MEDIUM' ? "text-yellow-400" : "text-blue-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{alert.symbol}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioSection({ 
  holdings, 
  navigate 
}: { 
  holdings: PortfolioHolding[], 
  navigate: (path: string) => void 
}) {
  if (!holdings || holdings.length === 0) {
    return (
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            Active Portfolio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No active portfolio holdings found
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const actionColors = {
    ADD: "bg-green-500/20 text-green-400 border-green-500/30",
    TRIM: "bg-red-500/20 text-red-400 border-red-500/30",
    HOLD: "bg-blue-500/20 text-blue-400 border-blue-500/30"
  };
  
  const actionIcons = {
    ADD: Plus,
    TRIM: Minus,
    HOLD: Hand
  };
  
  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" />
          Active Portfolio
          <span className="text-xs text-muted-foreground font-normal">({holdings.length} positions)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Action</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Asset</th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">Price</th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">Change</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">AI Dir</th>
                <th className="text-center py-2 px-4 font-medium text-muted-foreground">RSI</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">Setup</th>
                <th className="text-left py-2 px-4 font-medium text-muted-foreground hidden lg:table-cell">Intel</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const ActionIcon = actionIcons[h.action];
                return (
                  <tr 
                    key={h.asset_id} 
                    onClick={() => navigate(h.asset_url)}
                    className="border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <Badge className={cn("text-xs font-medium border flex items-center gap-1 w-fit", actionColors[h.action])}>
                        <ActionIcon className="w-3 h-3" />
                        {h.action}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold">{h.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{h.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="font-mono text-sm">
                        {h.current_price && h.current_price > 0 ? `$${formatPrice(h.current_price)}` : '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={cn(
                        "font-mono text-sm font-medium",
                        (h.change_pct || 0) > 0 ? "text-green-400" : (h.change_pct || 0) < 0 ? "text-red-400" : "text-muted-foreground"
                      )}>
                        {formatChange(h.change_pct || 0)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={cn(
                        "font-mono",
                        typeof h.ai_direction === 'number' && h.ai_direction > 60 ? "text-green-400" : 
                        typeof h.ai_direction === 'number' && h.ai_direction < 40 ? "text-red-400" : "text-foreground"
                      )}>
                        {h.ai_direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={cn(
                        "font-mono",
                        h.rsi > 70 ? "text-red-400" : h.rsi < 30 ? "text-green-400" : "text-foreground"
                      )}>
                        {h.rsi}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant="outline" className="text-xs font-normal">
                        {h.setup}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 hidden lg:table-cell">
                      {h.news ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-pointer group">
                              <span className="text-xs text-muted-foreground truncate block max-w-[180px] group-hover:text-foreground transition-colors">
                                {smartTruncate(decodeHtmlEntities(h.news), 45)}
                              </span>
                              {h.news_url && (
                                <a 
                                  href={h.news_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </a>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[350px] p-3">
                            <div className="space-y-2">
                              <p className="font-medium text-sm">{decodeHtmlEntities(h.news)}</p>
                              {h.news_full && (
                                <p className="text-xs text-muted-foreground">
                                  {decodeHtmlEntities(h.news_full)}
                                </p>
                              )}
                              {h.news_url && (
                                <a 
                                  href={h.news_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  Read full article <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">
                          No recent news
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SetupOpportunities({ 
  title, 
  icon: Icon, 
  data,
  colorClass,
  navigate
}: { 
  title: string;
  icon: React.ElementType;
  data: CategoryData;
  colorClass: string;
  navigate: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (!data || data.picks.length === 0) {
    return (
      <Card className={cn("bg-card/50 border-border border-l-2", colorClass)}>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3">
          <p className="text-xs text-muted-foreground">No setups detected</p>
        </CardContent>
      </Card>
    );
  }
  
  const convictionColors = {
    HIGH: "bg-green-500/20 text-green-400 border-green-500/30",
    MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    LOW: "bg-muted text-muted-foreground border-border"
  };
  
  return (
    <Card className={cn("bg-card/50 border-border border-l-2", colorClass)}>
      <CardHeader 
        className="pb-2 pt-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" />
            {title}
            <span className="text-xs text-muted-foreground font-normal">
              ({data.picks.length})
            </span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform",
            isExpanded ? "rotate-0" : "-rotate-90"
          )} />
        </CardTitle>
        <p className="text-xs text-muted-foreground">{data.theme_summary}</p>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 pb-3 space-y-2">
          {data.picks.map((pick, i) => (
            <div 
              key={i} 
              onClick={() => pick.asset_url && navigate(pick.asset_url)}
              className="flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Badge className={cn("text-[10px] px-1.5 py-0 border", convictionColors[pick.conviction])}>
                  {pick.conviction}
                </Badge>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{pick.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">{pick.name}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{pick.setup_type}</div>
                {pick.score && (
                  <div className="text-xs font-mono text-primary">Score: {pick.score}</div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function IntelSection({ items }: { items: IntelItem[] }) {
  if (!items || items.length === 0) {
    return (
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-primary" />
            Market Intel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No intel items available
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const categoryColors: Record<string, string> = {
    GEOPOL: "border-l-red-500",
    POLICY: "border-l-purple-500",
    TECH: "border-l-blue-500",
    EARNINGS: "border-l-green-500",
    ECON: "border-l-yellow-500",
    CRYPTO: "border-l-orange-500",
  };
  
  const categoryIcons: Record<string, React.ElementType> = {
    GEOPOL: AlertTriangle,
    POLICY: Landmark,
    TECH: Zap,
    EARNINGS: TrendingUp,
    ECON: Activity,
    CRYPTO: Target,
  };
  
  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          Market Intel
          <span className="text-xs text-muted-foreground font-normal">({items.length} items)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, i) => {
            const Icon = categoryIcons[item.category] || Activity;
            return (
              <div 
                key={i} 
                className={cn(
                  "p-3 bg-muted/30 rounded border-l-2 hover:bg-muted/50 transition-colors",
                  categoryColors[item.category] || "border-l-muted-foreground"
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {item.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{item.source}</span>
                      {item.time_ago && (
                        <span className="text-[10px] text-muted-foreground">• {item.time_ago}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1 line-clamp-2">
                      {decodeHtmlEntities(item.headline)}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {decodeHtmlEntities(item.impact)}
                    </p>
                    {item.url && (
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Read more <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MacroInsightsSection({ intel }: { intel: MorningIntel }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const sections = [
    { key: 'market_pulse', label: 'Market Pulse', icon: Activity },
    { key: 'liquidity_flows', label: 'Liquidity & Flows', icon: TrendingUp },
    { key: 'macro_calendar', label: 'Calendar', icon: Clock },
  ];
  
  const hasContent = sections.some(s => (intel as any)[s.key] && 
    (intel as any)[s.key] !== 'Search timeout' && 
    (intel as any)[s.key] !== 'Search unavailable');
  
  if (!hasContent) return null;
  
  return (
    <Card className="bg-card/50 border-border">
      <CardHeader 
        className="pb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" />
            Macro Insights
          </div>
          <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded ? "rotate-0" : "-rotate-90")} />
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {sections.map(({ key, label, icon: Icon }) => {
            const content = (intel as any)[key];
            if (!content || content === 'Search timeout' || content === 'Search unavailable') return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {label}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

// --- Main Page ---

export default function DailyBriefV4() {
  const [, navigate] = useLocation();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Fetch function that supports force refresh
  const fetchBrief = async (forceRefresh: boolean = false) => {
    const endpoint = getApiUrl("DAILY_BRIEF_V4");
    if (!endpoint) {
      throw new Error("Daily Brief API endpoint not configured");
    }
    // Add refresh=true query param to force regeneration
    const url = forceRefresh ? `${endpoint}?refresh=true` : endpoint;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };
  
  const { data, error, isLoading, mutate } = useSWR<DailyBriefData>(
    "daily-brief-v4",
    () => fetchBrief(false), // Normal load uses cache
    { 
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // 5 minutes - don't re-fetch too often
      refreshInterval: 0 // No auto-refresh
    }
  );
  
  // Manual refresh forces regeneration
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Force refresh by fetching with refresh=true
      const freshData = await fetchBrief(true);
      // Update SWR cache with fresh data
      await mutate(freshData, false);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    
    // Create a simple text export for now
    const briefText = `
STRATOS BRAIN DAILY BRIEF
${format(new Date(), "EEEE, MMMM d, yyyy")}

MARKET REGIME: ${data?.market_regime || 'NEUTRAL'}
${data?.macro_summary || ''}

PORTFOLIO (${data?.portfolio?.length || 0} positions)
${data?.portfolio?.map(h => `${h.symbol}: ${h.action} | Price: $${formatPrice(h.current_price || 0)} | Change: ${formatChange(h.change_pct || 0)} | RSI: ${h.rsi}`).join('\n') || 'No holdings'}

ALERTS (${data?.alerts?.length || 0})
${data?.alerts?.map(a => `${a.symbol}: ${a.message}`).join('\n') || 'No alerts'}

MARKET INTEL
${data?.intel_items?.map(i => `[${i.category}] ${i.headline}`).join('\n') || 'No intel'}

Generated: ${format(new Date(), "h:mm a")}
    `.trim();
    
    // Create blob and download
    const blob = new Blob([briefText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-brief-${format(new Date(), "yyyy-MM-dd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <h1 className="text-xl font-bold mb-2">Failed to Load Daily Brief</h1>
            <p className="text-muted-foreground mb-4 max-w-md">
              {error.message || "Unable to fetch daily brief data. Please try again."}
            </p>
            <Button onClick={handleManualRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <TooltipProvider>
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto" ref={contentRef}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              Stratos Brain Daily Brief
            </h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPDF}
              disabled={isLoading || !data}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManualRefresh} 
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", (isLoading || isRefreshing) && "animate-spin")} />
              {isRefreshing ? "Regenerating..." : "Refresh"}
            </Button>
          </div>
        </div>
        
        {/* Loading State */}
        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading daily brief...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Market Ticker */}
            <MarketTickerBar ticker={data.market_ticker} />
            
            {/* Alerts Section */}
            <AlertsSection alerts={data.alerts || []} navigate={navigate} />
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Portfolio & Intel */}
              <div className="lg:col-span-2 space-y-6">
                <PortfolioSection holdings={data.portfolio || []} navigate={navigate} />
                
                {/* Setup Opportunities */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Setup Opportunities
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SetupOpportunities 
                      title="Momentum" 
                      icon={Zap}
                      data={data.categories.momentum_breakouts}
                      colorClass="border-l-orange-500"
                      navigate={navigate}
                    />
                    <SetupOpportunities 
                      title="Trend" 
                      icon={TrendingUp}
                      data={data.categories.trend_continuation}
                      colorClass="border-l-blue-500"
                      navigate={navigate}
                    />
                    <SetupOpportunities 
                      title="Compression" 
                      icon={Activity}
                      data={data.categories.compression_reversion}
                      colorClass="border-l-purple-500"
                      navigate={navigate}
                    />
                  </div>
                </div>
                
                <IntelSection items={data.intel_items || []} />
              </div>
              
              {/* Right Column - Macro & Stats */}
              <div className="space-y-6">
                <MacroInsightsSection intel={data.morning_intel} />
                
                {/* Quick Stats */}
                <Card className="bg-card/50 border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Portfolio Positions</span>
                      <span className="font-mono font-medium">{data.portfolio?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Alerts</span>
                      <span className="font-mono font-medium">{data.alerts?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Active Setups</span>
                      <span className="font-mono font-medium">
                        {(data.categories.momentum_breakouts?.picks?.length || 0) +
                         (data.categories.trend_continuation?.picks?.length || 0) +
                         (data.categories.compression_reversion?.picks?.length || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Intel Items</span>
                      <span className="font-mono font-medium">{data.intel_items?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Market Regime</span>
                      <Badge variant="outline" className="text-xs">
                        {data.market_regime || "Unknown"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Last refreshed: {format(lastRefresh, "h:mm a")}
                </div>
                {data._meta?.cached && (
                  <div className="flex items-center gap-1 text-blue-400">
                    <CheckCircle className="w-3 h-3" />
                    Cached
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {data._meta?.generation_time_ms && (
                  <div>
                    Generated in {(data._meta.generation_time_ms / 1000).toFixed(1)}s
                  </div>
                )}
                {data._meta?.cached_at && (
                  <div className="text-muted-foreground">
                    Cached at {format(new Date(data._meta.cached_at), "h:mm a")}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Data Available</h2>
            <p className="text-muted-foreground mb-4">
              The daily brief data could not be loaded.
            </p>
            <Button onClick={handleManualRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
    </TooltipProvider>
  );
}

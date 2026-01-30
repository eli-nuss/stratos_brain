// Daily Brief v4 - Redesigned to match site style
// Dark theme, green/red color coding, information-dense layout

import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  RefreshCw, Zap, TrendingUp, TrendingDown, ChevronRight, ChevronDown, 
  Target, Calendar, Globe, Landmark, PieChart, 
  Droplets, Activity, Sparkles, ArrowUpRight, ArrowDownRight, Layers, 
  Flag, FileDown, Eye, AlertTriangle, ArrowUp, ArrowDown, 
  Minus, ExternalLink, Clock, BarChart3, Briefcase, Newspaper,
  AlertCircle, CheckCircle2, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { getApiUrl, getJsonApiHeaders, apiFetcher, API_BASE } from "@/lib/api-config";
import { format } from "date-fns";

// --- Helper Functions ---

// Decode HTML entities that may come from RSS feeds
const decodeHtmlEntities = (text: string): string => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

// --- Types ---

interface PortfolioHolding {
  asset_id: number;
  symbol: string;
  name: string;
  action: "ADD" | "TRIM" | "HOLD";
  price: number;
  ai_direction: number | string;
  rsi: number;
  setup: string;
  news: string;
  news_full?: string;  // Full description for tooltip
  news_url?: string;   // Link to the news article
  catalysts: string;
  asset_url: string;
}

interface MarketTicker {
  spy_change: number;
  qqq_change: number;
  iwm_change: number;
  yield_10y: number;
  btc_change: number;
  vix: number;
  regime: string;
}

interface IntelItem {
  category: "GEOPOL" | "POLICY" | "TECH" | "EARNINGS" | "ECON" | "CRYPTO" | "DEFAULT";
  headline: string;
  impact: string;
  url: string;
  source: string;
  date: string;
}

interface AssetPick {
  symbol: string;
  name?: string;
  conviction: "HIGH" | "MEDIUM" | "LOW";
  setup_type: string;
  one_liner: string;
  rationale?: string;
}

interface CategoryData {
  theme_summary: string;
  picks: AssetPick[];
}

interface MorningIntel {
  market_pulse: string;
  macro_calendar: string;
  geopolitical: string;
  sector_themes: string;
  liquidity_flows: string;
  risk_factors: string;
  generated_at: string;
}

interface DailyBriefData {
  date: string;
  market_ticker: MarketTicker;
  market_regime: string;
  macro_summary: string;
  morning_intel?: MorningIntel;
  portfolio: PortfolioHolding[];
  categories: {
    momentum_breakouts: CategoryData;
    trend_continuation: CategoryData;
    compression_reversion: CategoryData;
  };
  intel_items: IntelItem[];
  tokens?: { in: number; out: number };
}

// --- Helper Functions ---

const formatPercent = (value: number) => {
  const formatted = value.toFixed(2);
  return value >= 0 ? `+${formatted}%` : `${formatted}%`;
};

const formatNumber = (value: number, decimals = 2) => {
  return value.toFixed(decimals);
};

// --- Components ---

function MarketTickerBar({ ticker }: { ticker?: MarketTicker }) {
  if (!ticker) return null;
  
  const items = [
    { symbol: "SPY", value: ticker.spy_change, suffix: "%" },
    { symbol: "QQQ", value: ticker.qqq_change, suffix: "%" },
    { symbol: "IWM", value: ticker.iwm_change, suffix: "%" },
    { symbol: "BTC", value: ticker.btc_change, suffix: "%" },
    { symbol: "VIX", value: ticker.vix, suffix: "", isNeutral: true },
    { symbol: "10Y", value: ticker.yield_10y, suffix: "%", isNeutral: true },
  ];
  
  const regimeColors: Record<string, string> = {
    "BULLISH": "text-green-400 bg-green-500/20 border-green-500/30",
    "BEARISH": "text-red-400 bg-red-500/20 border-red-500/30",
    "NEUTRAL": "text-yellow-400 bg-yellow-500/20 border-yellow-500/30",
    "HIGH VOLATILITY": "text-orange-400 bg-orange-500/20 border-orange-500/30",
    "Risk-On": "text-green-400 bg-green-500/20 border-green-500/30",
    "Risk-Off": "text-red-400 bg-red-500/20 border-red-500/30",
  };
  
  return (
    <div className="bg-card/50 border border-border rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4 md:gap-6">
        {/* Market Regime Badge */}
        <div className={cn(
          "px-3 py-1.5 rounded-md border text-sm font-semibold",
          regimeColors[ticker.regime] || "text-muted-foreground bg-muted border-border"
        )}>
          {ticker.regime || "NEUTRAL"}
        </div>
        
        {/* Ticker Items */}
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          {items.map((item) => (
            <div key={item.symbol} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{item.symbol}</span>
              <span className={cn(
                "font-mono text-sm font-semibold",
                item.isNeutral ? "text-foreground" :
                item.value >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {item.isNeutral ? formatNumber(item.value) : formatPercent(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortfolioSection({ holdings, onAssetClick }: { 
  holdings: PortfolioHolding[];
  onAssetClick: (assetId: string) => void;
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
  
  const getActionBadge = (action: string) => {
    switch (action) {
      case "ADD":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">ADD</Badge>;
      case "TRIM":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">TRIM</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">HOLD</Badge>;
    }
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
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-2 px-4 font-medium">Action</th>
                <th className="text-left py-2 px-4 font-medium">Asset</th>
                <th className="text-right py-2 px-4 font-medium">AI Dir</th>
                <th className="text-right py-2 px-4 font-medium">RSI</th>
                <th className="text-left py-2 px-4 font-medium">Setup</th>
                <th className="text-left py-2 px-4 font-medium hidden lg:table-cell">Intel</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr 
                  key={h.asset_id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onAssetClick(String(h.asset_id))}
                >
                  <td className="py-2.5 px-4">
                    {getActionBadge(h.action)}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{h.symbol}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {h.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-4">
                    <span className={cn(
                      "font-mono font-medium",
                      typeof h.ai_direction === 'number' && h.ai_direction > 60 ? "text-green-400" :
                      typeof h.ai_direction === 'number' && h.ai_direction < 40 ? "text-red-400" : "text-foreground"
                    )}>
                      {typeof h.ai_direction === 'number' ? h.ai_direction : 'N/A'}
                    </span>
                  </td>
                  <td className="text-right py-2.5 px-4">
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
                              {decodeHtmlEntities(h.news)}
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
              ))}
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
  onAssetClick
}: { 
  title: string; 
  icon: any; 
  data?: CategoryData;
  colorClass: string;
  onAssetClick: (symbol: string) => void;
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
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </CardTitle>
        {data.theme_summary && (
          <CardDescription className="text-xs">{data.theme_summary}</CardDescription>
        )}
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 pb-3 space-y-2">
          {data.picks.map((pick, i) => (
            <div 
              key={i} 
              className="flex items-start gap-2 p-2 bg-muted/30 rounded hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onAssetClick(pick.symbol)}
            >
              <Badge className={cn("text-xs shrink-0", convictionColors[pick.conviction])}>
                {pick.conviction}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{pick.symbol}</span>
                  {pick.name && (
                    <span className="text-xs text-muted-foreground truncate">{pick.name}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{pick.one_liner}</p>
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
  
  const categoryIcons: Record<string, any> = {
    GEOPOL: Globe,
    POLICY: Landmark,
    TECH: Zap,
    EARNINGS: BarChart3,
    ECON: Activity,
    CRYPTO: Layers,
    DEFAULT: Flag
  };
  
  const categoryColors: Record<string, string> = {
    GEOPOL: "border-l-red-500",
    POLICY: "border-l-blue-500",
    TECH: "border-l-purple-500",
    EARNINGS: "border-l-green-500",
    ECON: "border-l-yellow-500",
    CRYPTO: "border-l-orange-500",
    DEFAULT: "border-l-muted-foreground"
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
            const Icon = categoryIcons[item.category] || Flag;
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
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                      {item.source && (
                        <span className="text-xs text-muted-foreground">{item.source}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-tight">{decodeHtmlEntities(item.headline)}</p>
                    {item.impact && (
                      <p className="text-xs text-muted-foreground mt-1">{decodeHtmlEntities(item.impact)}</p>
                    )}
                    {item.url && (
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Read more
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

function MacroInsights({ intel }: { intel?: MorningIntel }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (!intel) return null;
  
  const sections = [
    { key: 'market_pulse', label: 'Market Pulse', icon: Activity },
    { key: 'liquidity_flows', label: 'Liquidity & Flows', icon: Droplets },
    { key: 'macro_calendar', label: 'Calendar', icon: Calendar },
  ];
  
  const hasContent = sections.some(s => (intel as any)[s.key]);
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
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
  
  // Fetch daily brief data
  const { data, error, isLoading, mutate } = useSWR<DailyBriefData>(
    "daily-brief-v4",
    async () => {
      const endpoint = getApiUrl("DAILY_BRIEF_V4");
      if (!endpoint) {
        throw new Error("Daily Brief API endpoint not configured");
      }
      const res = await fetch(endpoint, { headers: getJsonApiHeaders() });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      return res.json();
    },
    { 
      refreshInterval: 0, 
      revalidateOnFocus: false,
      errorRetryCount: 2,
      errorRetryInterval: 3000
    }
  );
  
  // Handle asset click - navigate to asset detail
  const handleAssetClick = (assetId: string) => {
    navigate(`/asset/${assetId}`);
  };
  
  // Handle symbol click - search for asset and navigate
  const handleSymbolClick = async (symbol: string) => {
    try {
      // Try to find the asset by symbol
      const res = await fetch(`${API_BASE}/dashboard/all-assets?search=${encodeURIComponent(symbol)}&limit=1`, {
        headers: getJsonApiHeaders()
      });
      if (res.ok) {
        const result = await res.json();
        if (result.data && result.data.length > 0) {
          navigate(`/asset/${result.data[0].asset_id}`);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to find asset:", e);
    }
    // Fallback: just show a message
    console.log(`Could not find asset for symbol: ${symbol}`);
  };
  
  const handleManualRefresh = () => {
    mutate();
    setLastRefresh(new Date());
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
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <TooltipProvider>
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
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
              onClick={handleManualRefresh} 
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Refresh
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
            {/* Market Ticker Bar */}
            <MarketTickerBar ticker={data.market_ticker} />
            
            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Portfolio & Setups */}
              <div className="lg:col-span-2 space-y-6">
                {/* Portfolio Holdings */}
                <PortfolioSection 
                  holdings={data.portfolio} 
                  onAssetClick={handleAssetClick}
                />
                
                {/* Setup Opportunities */}
                <div>
                  <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Setup Opportunities
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SetupOpportunities 
                      title="Momentum" 
                      icon={Zap} 
                      data={data.categories.momentum_breakouts}
                      colorClass="border-l-orange-500"
                      onAssetClick={handleSymbolClick}
                    />
                    <SetupOpportunities 
                      title="Trend" 
                      icon={TrendingUp} 
                      data={data.categories.trend_continuation}
                      colorClass="border-l-blue-500"
                      onAssetClick={handleSymbolClick}
                    />
                    <SetupOpportunities 
                      title="Compression" 
                      icon={Activity} 
                      data={data.categories.compression_reversion}
                      colorClass="border-l-purple-500"
                      onAssetClick={handleSymbolClick}
                    />
                  </div>
                </div>
                
                {/* Intel Section */}
                <IntelSection items={data.intel_items} />
              </div>
              
              {/* Right Column - Macro Insights */}
              <div className="space-y-6">
                <MacroInsights intel={data.morning_intel} />
                
                {/* Quick Stats Card */}
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
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Last refreshed: {format(lastRefresh, "h:mm a")}
              </div>
              {data.tokens && (
                <div>
                  Tokens: {data.tokens.in.toLocaleString()} in / {data.tokens.out.toLocaleString()} out
                </div>
              )}
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

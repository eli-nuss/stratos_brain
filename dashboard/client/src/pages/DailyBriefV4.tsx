// Daily Brief v4 - Unified Web + PDF Architecture
// Feature-flagged: Can revert to V3 via UI toggle

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Collapsible, CollapsibleContent, CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  RefreshCw, Zap, TrendingUp, ChevronRight, ChevronDown, 
  Target, Shield, Calendar, Globe, Landmark, PieChart, 
  Droplets, Activity, Sparkles, ArrowUpRight, Layers, 
  Flag, FileDown, Eye, AlertTriangle, ArrowUp, ArrowDown, 
  Minus, ExternalLink, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { getApiUrl, getJsonApiHeaders } from "@/lib/api-config";
import { format } from "date-fns";

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

// --- Components ---

function TickerCard({ symbol, value, suffix = "" }: { symbol: string; value: number; suffix?: string }) {
  const isPositive = value >= 0;
  return (
    <Card className={cn(
      "border-l-4",
      isPositive ? "border-l-green-500" : "border-l-red-500"
    )}>
      <CardContent className="p-3">
        <div className="text-xs font-medium text-muted-foreground">{symbol}</div>
        <div className={cn(
          "text-xl font-bold",
          isPositive ? "text-green-600" : "text-red-600"
        )}>
          {isPositive ? "+" : ""}{value.toFixed(2)}{suffix}
        </div>
      </CardContent>
    </Card>
  );
}

function MarketTickerHeader({ ticker }: { ticker?: MarketTicker }) {
  if (!ticker) return null;
  
  const regimeColors: Record<string, string> = {
    "BULLISH": "bg-green-500",
    "BEARISH": "bg-red-500",
    "NEUTRAL": "bg-yellow-500",
    "HIGH VOLATILITY": "bg-orange-500"
  };
  
  return (
    <div className="mb-6">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3">
        <TickerCard symbol="SPY" value={ticker.spy_change} suffix="%" />
        <TickerCard symbol="QQQ" value={ticker.qqq_change} suffix="%" />
        <TickerCard symbol="IWM" value={ticker.iwm_change} suffix="%" />
        <TickerCard symbol="10Y" value={ticker.yield_10y} />
        <TickerCard symbol="BTC" value={ticker.btc_change} suffix="%" />
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3">
            <div className="text-xs font-medium text-muted-foreground">VIX</div>
            <div className="text-xl font-bold">{ticker.vix}</div>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-3">
        <Badge className={cn("text-white", regimeColors[ticker.regime] || "bg-gray-500")}>
          {ticker.regime}
        </Badge>
        <span className="text-sm text-muted-foreground">
          10Y at {ticker.yield_10y}% • VIX at {ticker.vix}
        </span>
      </div>
    </div>
  );
}

function PortfolioTable({ holdings }: { holdings: PortfolioHolding[] }) {
  const [, navigate] = useLocation();
  
  const getActionIcon = (action: string) => {
    switch (action) {
      case "ADD": return <ArrowDown className="w-4 h-4 text-green-600" />;
      case "TRIM": return <ArrowUp className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-yellow-600" />;
    }
  };
  
  const getActionColor = (action: string) => {
    switch (action) {
      case "ADD": return "bg-green-100 text-green-700 border-green-300";
      case "TRIM": return "bg-red-100 text-red-700 border-red-300";
      default: return "bg-yellow-100 text-yellow-700 border-yellow-300";
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChart className="w-5 h-5" />
          Active Portfolio ({holdings.length} positions)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-2">Action</th>
                <th className="text-left py-2 px-2">Asset</th>
                <th className="text-right py-2 px-2">AI</th>
                <th className="text-right py-2 px-2">RSI</th>
                <th className="text-left py-2 px-2">Setup</th>
                <th className="text-left py-2 px-2 hidden md:table-cell">Intel</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr 
                  key={h.asset_id}
                  className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/asset/${h.asset_id}`)}
                >
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1">
                      {getActionIcon(h.action)}
                      <Badge variant="outline" className={cn("text-xs", getActionColor(h.action))}>
                        {h.action}
                      </Badge>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-medium">{h.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {h.name}
                    </div>
                  </td>
                  <td className="text-right py-2 px-2">
                    <span className={cn(
                      "font-medium",
                      typeof h.ai_direction === 'number' && h.ai_direction > 60 ? "text-green-600" :
                      typeof h.ai_direction === 'number' && h.ai_direction < 40 ? "text-red-600" : ""
                    )}>
                      {typeof h.ai_direction === 'number' ? h.ai_direction : 'N/A'}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2">
                    <span className={cn(
                      h.rsi > 70 ? "text-red-600" : h.rsi < 30 ? "text-green-600" : ""
                    )}>
                      {h.rsi}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      {h.setup}
                    </span>
                  </td>
                  <td className="py-2 px-2 hidden md:table-cell">
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {h.news}
                    </div>
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

function SetupCategory({ 
  title, 
  icon: Icon, 
  data,
  color
}: { 
  title: string; 
  icon: any; 
  data?: CategoryData;
  color: string;
}) {
  if (!data || data.picks.length === 0) return null;
  
  const convictionColors = {
    HIGH: "bg-green-500",
    MEDIUM: "bg-yellow-500",
    LOW: "bg-gray-400"
  };
  
  return (
    <Card className={cn("border-t-4", color)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>{data.theme_summary}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.picks.map((pick, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Badge className={cn("shrink-0", convictionColors[pick.conviction])}>
                {pick.conviction}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{pick.symbol}</div>
                <div className="text-sm text-muted-foreground">{pick.one_liner}</div>
                {pick.rationale && (
                  <div className="text-xs text-muted-foreground mt-1">{pick.rationale}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function IntelGrid({ items }: { items: IntelItem[] }) {
  const categoryIcons: Record<string, any> = {
    GEOPOL: Globe,
    POLICY: Landmark,
    TECH: Zap,
    EARNINGS: PieChart,
    ECON: Activity,
    CRYPTO: Layers,
    DEFAULT: Flag
  };
  
  const categoryColors: Record<string, string> = {
    GEOPOL: "border-red-400",
    POLICY: "border-blue-400",
    TECH: "border-purple-400",
    EARNINGS: "border-green-400",
    ECON: "border-yellow-400",
    CRYPTO: "border-orange-400",
    DEFAULT: "border-gray-400"
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item, i) => {
        const Icon = categoryIcons[item.category] || Flag;
        return (
          <Card key={i} className={cn("border-l-4", categoryColors[item.category])}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <Badge variant="secondary" className="text-xs mb-2">
                    {item.category}
                  </Badge>
                  <div className="font-medium text-sm">{item.headline}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.impact}</div>
                  {item.url && (
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {item.source}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MacroLiquidityPanel({ intel }: { intel?: MorningIntel }) {
  if (!intel) return null;
  
  const sections = [
    { key: 'market_pulse', label: 'Market Pulse', icon: Activity },
    { key: 'liquidity_flows', label: 'Liquidity & Flows', icon: Droplets },
    { key: 'sector_themes', label: 'Sector Themes', icon: PieChart },
    { key: 'geopolitical', label: 'Geopolitical', icon: Globe },
  ];
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Landmark className="w-5 h-5" />
          Macro & Liquidity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sections.map(({ key, label, icon: Icon }) => {
            const content = (intel as any)[key];
            if (!content) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
                <p className="text-sm text-muted-foreground">{content}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MarketCalendar({ intel }: { intel?: MorningIntel }) {
  if (!intel?.macro_calendar) return null;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Market Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
          {intel.macro_calendar}
        </pre>
      </CardContent>
    </Card>
  );
}

// --- PDF Preview Dialog ---

function PDFPreviewDialog({ onGenerate }: { onGenerate: () => Promise<string> }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleGenerate = async () => {
    setLoading(true);
    try {
      const url = await onGenerate();
      setPdfUrl(url);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-2" />
          Preview PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Daily Brief PDF Preview</DialogTitle>
        </DialogHeader>
        {!pdfUrl ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 h-full">
            <iframe src={pdfUrl} className="flex-1 w-full border rounded" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPdfUrl(null)}>
                Regenerate
              </Button>
              <Button asChild>
                <a href={pdfUrl} download={`stratos-brief-${new Date().toISOString().split('T')[0]}.pdf`}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---

export default function DailyBriefV4() {
  const [version, setVersion] = useState<"v3" | "v4">("v4");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  const { data, error, isLoading, mutate } = useSWR<DailyBriefData>(
    version === "v4" ? "daily-brief-v4" : "daily-brief-v3",
    async () => {
      const endpoint = version === "v4" ? getApiUrl("DAILY_BRIEF_V4") : getApiUrl("DAILY_BRIEF_V3");
      const res = await fetch(endpoint, { headers: getJsonApiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    { refreshInterval: 0, revalidateOnFocus: false }
  );
  
  // Auto-refresh at 6am PT
  useEffect(() => {
    const scheduleRefresh = () => {
      const now = new Date();
      const ptNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
      const target = new Date(ptNow);
      target.setHours(6, 0, 0, 0);
      
      if (target <= ptNow) target.setDate(target.getDate() + 1);
      
      const msUntil = target.getTime() - ptNow.getTime() + (now.getTime() - ptNow.getTime());
      
      console.log(`[DailyBrief] Next refresh scheduled in ${Math.round(msUntil / 1000 / 60)} minutes`);
      
      return setTimeout(() => {
        mutate();
        setLastRefresh(new Date());
      }, msUntil);
    };
    
    const timeout = scheduleRefresh();
    return () => clearTimeout(timeout);
  }, [mutate]);
  
  const handleManualRefresh = () => {
    mutate();
    setLastRefresh(new Date());
  };
  
  const generatePDF = async (): Promise<string> => {
    const res = await fetch(getApiUrl("PDF_GENERATE"), {
      method: "POST",
      headers: getJsonApiHeaders(),
      body: JSON.stringify({ briefData: data })
    });
    if (!res.ok) throw new Error("PDF generation failed");
    const { url } = await res.json();
    return url;
  };
  
  if (version === "v3") {
    // Redirect to V3 component
    window.location.href = "/daily-brief-v3";
    return null;
  }
  
  if (error) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h1 className="text-xl font-bold mb-2">Failed to load Daily Brief</h1>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={handleManualRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
          <div className="mt-4">
            <Select value={version} onValueChange={(v) => setVersion(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v4">Daily Brief v4 (New)</SelectItem>
                <SelectItem value="v3">Daily Brief v3 (Classic)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-500" />
              Stratos Brain Daily Brief
            </h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={version} onValueChange={(v) => setVersion(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v4">v4 (New)</SelectItem>
                <SelectItem value="v3">v3 (Classic)</SelectItem>
              </SelectContent>
            </Select>
            
            <PDFPreviewDialog onGenerate={generatePDF} />
            
            <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isLoading}>
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {isLoading && !data ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Market Ticker */}
            <MarketTickerHeader ticker={data.market_ticker} />
            
            {/* Portfolio */}
            <PortfolioTable holdings={data.portfolio} />
            
            {/* Setup Opportunities */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Setup Opportunities
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SetupCategory 
                  title="Momentum Breakouts" 
                  icon={Zap} 
                  data={data.categories.momentum_breakouts}
                  color="border-t-orange-500"
                />
                <SetupCategory 
                  title="Trend Continuation" 
                  icon={TrendingUp} 
                  data={data.categories.trend_continuation}
                  color="border-t-blue-500"
                />
                <SetupCategory 
                  title="Compression & Reversion" 
                  icon={Activity} 
                  data={data.categories.compression_reversion}
                  color="border-t-purple-500"
                />
              </div>
            </div>
            
            {/* Macro & Calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MacroLiquidityPanel intel={data.morning_intel} />
              <MarketCalendar intel={data.morning_intel} />
            </div>
            
            {/* Intel Grid */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Flag className="w-5 h-5" />
                Intel & News
              </h2>
              <IntelGrid items={data.intel_items} />
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
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
        ) : null}
      </div>
    </DashboardLayout>
  );
}

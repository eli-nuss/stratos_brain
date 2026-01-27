import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { 
  RefreshCw, 
  Zap, 
  TrendingUp, 
  Magnet, 
  Quote,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Target,
  Shield,
  Calendar,
  Globe,
  Landmark,
  PieChart,
  Droplets,
  ShieldAlert,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { getApiUrl, getJsonApiHeaders } from "@/lib/api-config";
import { format } from "date-fns";

// --- Types ---

interface AssetPick {
  asset_id?: number;
  symbol: string;
  name?: string;
  sector?: string;
  conviction: "HIGH" | "MEDIUM" | "LOW";
  setup_type: string;
  one_liner: string;
  entry?: number;
  stop?: number;
  target?: number;
  risk_reward?: number;
  composite_score?: number;
  purity_score?: number;
  direction_score?: number;
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

interface PortfolioAlert {
  type: "add_on" | "concentration" | "exit";
  symbol: string;
  message: string;
}

interface ActionItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  symbol: string;
  action: string;
  rationale: string;
}

interface DailyBriefData {
  date: string;
  market_regime: string;
  macro_summary: string;
  morning_intel?: MorningIntel;
  categories: {
    momentum_breakouts: CategoryData;
    trend_continuation: CategoryData;
    compression_reversion: CategoryData;
  };
  portfolio_alerts: PortfolioAlert[];
  action_items: ActionItem[];
  tokens?: { in: number; out: number };
}

// --- Components ---

function StrategyHeader({ 
  title, 
  icon: Icon, 
  count, 
  colorClass,
  borderColor
}: { 
  title: string; 
  icon: React.ElementType; 
  count: number; 
  colorClass: string;
  borderColor: string;
}) {
  return (
    <div className={cn("flex items-center justify-between p-4 border-b", borderColor)}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {count} {count === 1 ? "opportunity" : "opportunities"}
          </p>
        </div>
      </div>
    </div>
  );
}

function AssetCard({ pick, onClick }: { pick: AssetPick; onClick: () => void }) {
  const convictionColors = {
    HIGH: "bg-green-500/10 text-green-600 border-green-500/20",
    MEDIUM: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    LOW: "bg-gray-500/10 text-gray-600 border-gray-500/20"
  };

  return (
    <div 
      onClick={onClick}
      className="group flex flex-col gap-2 p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-all"
    >
      {/* Top Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base group-hover:text-primary transition-colors">
            {pick.symbol}
          </span>
          <Badge 
            variant="outline" 
            className={cn("text-[10px] h-5 font-medium", convictionColors[pick.conviction])}
          >
            {pick.conviction}
          </Badge>
        </div>
        {pick.risk_reward && (
          <span className="text-xs font-mono text-muted-foreground">
            {pick.risk_reward.toFixed(1)}:1
          </span>
        )}
      </div>

      {/* Setup Type */}
      <Badge variant="secondary" className="w-fit text-[10px] px-2 h-5 font-normal">
        {pick.setup_type.replace(/_/g, " ")}
      </Badge>

      {/* One-liner */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {pick.one_liner}
      </p>

      {/* Entry/Stop/Target Row */}
      {(pick.entry || pick.stop || pick.target) && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-1">
          {pick.entry && (
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              Entry: ${pick.entry.toFixed(2)}
            </span>
          )}
          {pick.stop && (
            <span className="flex items-center gap-1 text-red-500">
              <Shield className="w-3 h-3" />
              Stop: ${pick.stop.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Chevron */}
      <div className="flex justify-end">
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/70 transition-all group-hover:translate-x-1" />
      </div>
    </div>
  );
}

// Intel Section Component
function IntelSection({ 
  title, 
  icon: Icon, 
  content, 
  colorClass,
  defaultOpen = false
}: { 
  title: string; 
  icon: React.ElementType; 
  content: string;
  colorClass: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-muted/50",
          isOpen && "bg-muted/30"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", colorClass)}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">{title}</span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pt-1">
          <div className="pl-11 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Main Page ---

export default function DailyBriefV3() {
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch the latest brief
  const { data: response, mutate, isLoading } = useSWR<{ success: boolean; brief: DailyBriefData }>(
    getApiUrl("DAILY_BRIEF_V3"),
    async (url: string) => {
      const res = await fetch(url, { headers: getJsonApiHeaders() });
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  const brief = response?.brief;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(getApiUrl("DAILY_BRIEF_V3"), { 
        method: "POST", 
        headers: getJsonApiHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        mutate();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  // Navigate directly to asset summary page
  const handleAssetClick = (pick: AssetPick) => {
    if (pick.asset_id) {
      setLocation(`/asset/${pick.asset_id}`);
    } else {
      // Fallback: log warning if asset_id is missing
      console.warn(`No asset_id for ${pick.symbol}, cannot navigate`);
    }
  };

  const regimeBadge = useMemo(() => {
    if (!brief?.market_regime) return null;
    const regime = brief.market_regime.toLowerCase();
    if (regime.includes("bullish") || regime.includes("risk-on")) {
      return <Badge className="bg-green-500 text-white">Bullish</Badge>;
    } else if (regime.includes("bearish") || regime.includes("risk-off")) {
      return <Badge className="bg-red-500 text-white">Bearish</Badge>;
    }
    return <Badge variant="secondary">Neutral</Badge>;
  }, [brief?.market_regime]);

  return (
    <DashboardLayout hideNavTabs>
      <div className="min-h-screen bg-background pb-20">
        
        {/* Header */}
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container max-w-7xl mx-auto py-4 px-4 md:px-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                CIO Daily Briefing
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                {brief?.date ? format(new Date(brief.date), "EEEE, MMMM d, yyyy") : "Loading..."} 
                {regimeBadge && <span className="ml-2">{regimeBadge}</span>}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleGenerate} 
              disabled={isGenerating}
              className="gap-2"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
              {isGenerating ? "Generating..." : "Regenerate"}
            </Button>
          </div>
        </header>

        <main className="container max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
          
          {/* Morning Intel - Enhanced */}
          <section>
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Quote className="w-4 h-4 text-primary" />
                  Morning Intel
                </CardTitle>
                <CardDescription>
                  Real-time market intelligence powered by AI research
                  {brief?.morning_intel?.generated_at && (
                    <span className="ml-2 text-xs">
                      • Updated {format(new Date(brief.morning_intel.generated_at), "h:mm a")}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-12 w-full bg-muted animate-pulse rounded" />
                    <div className="h-12 w-full bg-muted animate-pulse rounded" />
                    <div className="h-12 w-full bg-muted animate-pulse rounded" />
                  </div>
                ) : brief?.morning_intel ? (
                  <div className="space-y-1">
                    <IntelSection
                      title="Market Pulse"
                      icon={Activity}
                      content={brief.morning_intel.market_pulse}
                      colorClass="bg-blue-500/10 text-blue-600"
                      defaultOpen={true}
                    />
                    <IntelSection
                      title="Macro Calendar"
                      icon={Calendar}
                      content={brief.morning_intel.macro_calendar}
                      colorClass="bg-purple-500/10 text-purple-600"
                    />
                    <IntelSection
                      title="Geopolitical & Policy"
                      icon={Globe}
                      content={brief.morning_intel.geopolitical}
                      colorClass="bg-orange-500/10 text-orange-600"
                    />
                    <IntelSection
                      title="Sector Themes"
                      icon={PieChart}
                      content={brief.morning_intel.sector_themes}
                      colorClass="bg-emerald-500/10 text-emerald-600"
                    />
                    <IntelSection
                      title="Liquidity & Flows"
                      icon={Droplets}
                      content={brief.morning_intel.liquidity_flows}
                      colorClass="bg-cyan-500/10 text-cyan-600"
                    />
                    <IntelSection
                      title="Risk Factors"
                      icon={ShieldAlert}
                      content={brief.morning_intel.risk_factors}
                      colorClass="bg-red-500/10 text-red-600"
                      defaultOpen={true}
                    />
                  </div>
                ) : (
                  // Fallback to old format if no morning_intel
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                    {brief?.macro_summary && (
                      <p className="mb-3">{brief.macro_summary}</p>
                    )}
                    {brief?.categories?.momentum_breakouts?.theme_summary && (
                      <p className="mb-2"><strong>Momentum:</strong> {brief.categories.momentum_breakouts.theme_summary}</p>
                    )}
                    {brief?.categories?.trend_continuation?.theme_summary && (
                      <p className="mb-2"><strong>Trends:</strong> {brief.categories.trend_continuation.theme_summary}</p>
                    )}
                    {brief?.categories?.compression_reversion?.theme_summary && (
                      <p className="mb-2"><strong>Pullbacks:</strong> {brief.categories.compression_reversion.theme_summary}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Three Pillars */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Momentum Breakouts */}
            <Card className="overflow-hidden border-t-4 border-t-indigo-500 flex flex-col">
              <StrategyHeader 
                title="Momentum Breakouts" 
                icon={Zap} 
                count={brief?.categories?.momentum_breakouts?.picks?.length || 0}
                colorClass="bg-indigo-500/10 text-indigo-600" 
                borderColor="border-indigo-500/20"
              />
              <ScrollArea className="flex-1 max-h-[500px]">
                {brief?.categories?.momentum_breakouts?.picks?.map((pick, i) => (
                  <AssetCard key={i} pick={pick} onClick={() => handleAssetClick(pick)} />
                )) || (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No picks available
                  </div>
                )}
              </ScrollArea>
            </Card>

            {/* Trend Continuation */}
            <Card className="overflow-hidden border-t-4 border-t-emerald-500 flex flex-col">
              <StrategyHeader 
                title="Trend Continuation" 
                icon={TrendingUp} 
                count={brief?.categories?.trend_continuation?.picks?.length || 0}
                colorClass="bg-emerald-500/10 text-emerald-600" 
                borderColor="border-emerald-500/20"
              />
              <ScrollArea className="flex-1 max-h-[500px]">
                {brief?.categories?.trend_continuation?.picks?.map((pick, i) => (
                  <AssetCard key={i} pick={pick} onClick={() => handleAssetClick(pick)} />
                )) || (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No picks available
                  </div>
                )}
              </ScrollArea>
            </Card>

            {/* Compression & Reversion */}
            <Card className="overflow-hidden border-t-4 border-t-amber-500 flex flex-col">
              <StrategyHeader 
                title="Pullbacks & Squeezes" 
                icon={Magnet} 
                count={brief?.categories?.compression_reversion?.picks?.length || 0}
                colorClass="bg-amber-500/10 text-amber-600" 
                borderColor="border-amber-500/20"
              />
              <ScrollArea className="flex-1 max-h-[500px]">
                {brief?.categories?.compression_reversion?.picks?.map((pick, i) => (
                  <AssetCard key={i} pick={pick} onClick={() => handleAssetClick(pick)} />
                )) || (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No picks available
                  </div>
                )}
              </ScrollArea>
            </Card>

          </section>

          {/* Portfolio Alerts */}
          {brief?.portfolio_alerts && brief.portfolio_alerts.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Portfolio Alerts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {brief.portfolio_alerts.map((alert, i) => (
                  <Card key={i} className={cn(
                    "border-l-4",
                    alert.type === "add_on" ? "border-l-green-500" :
                    alert.type === "concentration" ? "border-l-yellow-500" :
                    "border-l-red-500"
                  )}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">{alert.symbol}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {alert.type.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Action Items */}
          {brief?.action_items && brief.action_items.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Priority Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brief.action_items.slice(0, 6).map((item, i) => (
                  <Card key={i} className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn(
                          "text-[10px]",
                          item.priority === "HIGH" ? "bg-red-500" :
                          item.priority === "MEDIUM" ? "bg-yellow-500" :
                          "bg-gray-500"
                        )}>
                          {item.priority}
                        </Badge>
                        <span className="font-bold text-sm">{item.symbol}</span>
                      </div>
                      <p className="text-xs font-medium mb-1">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.rationale}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

        </main>

      </div>
    </DashboardLayout>
  );
}

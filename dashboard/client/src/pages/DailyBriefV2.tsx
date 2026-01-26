import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar, 
  RefreshCw, 
  ChevronRight,
  Zap,
  Target,
  AlertTriangle,
  BarChart3,
  Bitcoin,
  Building2,
  Clock,
  Sparkles,
  DollarSign,
  Shield,
  Briefcase,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle2,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { apiFetcher, getJsonApiHeaders } from "@/lib/api-config";
import { format, parseISO } from "date-fns";

// API Base URL for v2
const DAILY_BRIEF_V2_API = "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/daily-brief-api-v2";

// Types matching the v2 backend
interface MarketPulse {
  regime: string;
  confidence: number;
  summary: string;
  dominant_theme: string;
  fear_greed: number;
  indices: Array<{
    symbol: string;
    price: number;
    change_1d: number;
    change_5d: number;
  }>;
  breadth: {
    advancing: number;
    declining: number;
    ratio: number;
  };
}

interface MacroContext {
  yield_curve: {
    status: string;
    spread_10y_2y: number;
    trend: string;
  };
  rates: {
    fed_funds: number;
    ten_year: number;
    direction: string;
  };
  commodities: {
    oil: { price: number; change: number };
    gold: { price: number; change: number };
    copper: { price: number; change: number };
  };
  risk_assessment: string;
}

interface TechnicalCluster {
  theme_name: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  catalyst: string;
  assets: Array<{
    symbol: string;
    name: string;
    price: number;
    change_1d: number;
    setup_type: string;
  }>;
  aggregate_conviction: number;
}

interface TopSetup {
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: string;
  price: number;
  change_1d: number;
  setup_type: string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  risk_reward: number;
  fvs_score: number | null;
  fvs_label: string | null;
  ai_conviction: number;
  reasoning: string;
  bear_case: string;
}

interface FundamentalLeader {
  asset_id: number;
  symbol: string;
  name: string;
  fvs_score: number;
  profitability_score: number;
  growth_score: number;
  ai_summary: string;
}

interface SignalAlert {
  signal_type: string;
  direction: string;
  strength: number;
  count: number;
  notable_assets: string[];
  interpretation: string;
}

interface SkepticWarning {
  warning_type: string;
  severity: string;
  assets: string[];
  explanation: string;
}

interface SectorAnalysis {
  sector: string;
  performance_1d: number;
  sentiment: string;
  top_performers: string[];
  key_themes: string[];
}

interface PortfolioAnalysis {
  total_value: number;
  cash_position: number;
  positions: Array<{
    symbol: string;
    market_value: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
  }>;
  rebalancing_suggestions: string[];
  risk_assessment: string;
}

interface CryptoSpotlight {
  btc_dominance: number;
  top_movers: Array<{
    symbol: string;
    name: string;
    price: number;
    change_24h: number;
  }>;
  defi_themes: string[];
  narrative_summary: string;
}

interface ActionItem {
  priority: string;
  action_type: string;
  symbol: string;
  description: string;
  trigger: string;
  reasoning: string;
}

interface DailyBriefV2 {
  brief_id: number;
  brief_date: string;
  market_pulse: MarketPulse;
  macro_context: MacroContext;
  technical_clusters: TechnicalCluster[];
  top_setups: TopSetup[];
  fundamental_leaders: FundamentalLeader[];
  signal_alerts: SignalAlert[];
  skeptics_corner: SkepticWarning[];
  sector_analysis: SectorAnalysis[];
  portfolio_analysis: PortfolioAnalysis | null;
  crypto_spotlight: CryptoSpotlight;
  action_items: ActionItem[];
  model_used: string;
  generation_stats: {
    total_tokens_in: number;
    total_tokens_out: number;
    generation_time_ms: number;
    sections_generated: number;
  };
  created_at: string;
}

// Regime Badge Component
function RegimeBadge({ regime, confidence }: { regime: string; confidence: number }) {
  const getRegimeColor = () => {
    switch (regime.toLowerCase()) {
      case 'risk-on': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'risk-off': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };
  
  return (
    <Badge className={cn("text-sm px-3 py-1", getRegimeColor())}>
      {regime.toUpperCase()} ({confidence}% confidence)
    </Badge>
  );
}

// Market Pulse Section
function MarketPulseSection({ data }: { data: MarketPulse }) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Market Pulse</CardTitle>
          </div>
          <RegimeBadge regime={data.regime} confidence={data.confidence} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{data.summary}</p>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Theme: {data.dominant_theme}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Fear/Greed: {data.fear_greed}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.indices?.map((idx) => (
            <div key={idx.symbol} className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium">{idx.symbol}</div>
              <div className="text-lg font-bold">
                ${idx.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className={cn(
                "text-sm flex items-center gap-1",
                idx.change_1d >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {idx.change_1d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {idx.change_1d?.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-400">↑ {data.breadth?.advancing} advancing</span>
          <span className="text-red-400">↓ {data.breadth?.declining} declining</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Macro Context Section
function MacroContextSection({ data }: { data: MacroContext }) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Macro Context</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Yield Curve</div>
            <div className="text-lg font-bold capitalize">{data.yield_curve?.status}</div>
            <div className="text-xs">{data.yield_curve?.spread_10y_2y?.toFixed(2)}% spread</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">10Y Treasury</div>
            <div className="text-lg font-bold">{data.rates?.ten_year?.toFixed(2)}%</div>
            <div className="text-xs capitalize">{data.rates?.direction}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Oil (WTI)</div>
            <div className="text-lg font-bold">${data.commodities?.oil?.price?.toFixed(2)}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Gold</div>
            <div className="text-lg font-bold">${data.commodities?.gold?.price?.toFixed(2)}</div>
          </div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Risk Assessment</div>
          <p className="text-sm">{data.risk_assessment}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Top Setups Section
function TopSetupsSection({ setups, onAssetClick }: { setups: TopSetup[]; onAssetClick: (id: number) => void }) {
  if (!setups || setups.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Top Setups</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No setups identified today</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Top Setups ({setups.length})</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {setups.slice(0, 5).map((setup) => (
            <div 
              key={setup.asset_id}
              className="bg-muted/50 rounded-lg p-4 cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => onAssetClick(setup.asset_id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{setup.symbol}</span>
                  <Badge variant="outline" className="text-xs">{setup.setup_type}</Badge>
                  {setup.fvs_label && (
                    <Badge className="text-xs bg-blue-500/20 text-blue-400">{setup.fvs_label}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">${setup.price?.toLocaleString()}</span>
                  <span className={cn(
                    "text-sm",
                    setup.change_1d >= 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {setup.change_1d >= 0 ? '+' : ''}{setup.change_1d?.toFixed(2)}%
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                <div>
                  <span className="text-muted-foreground">Entry:</span> ${setup.entry_price?.toFixed(2)}
                </div>
                <div>
                  <span className="text-muted-foreground">Target:</span> ${setup.target_price?.toFixed(2)}
                </div>
                <div>
                  <span className="text-muted-foreground">Stop:</span> ${setup.stop_loss?.toFixed(2)}
                </div>
                <div>
                  <span className="text-muted-foreground">R:R:</span> {setup.risk_reward?.toFixed(2)}
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">{setup.reasoning}</p>
              
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-yellow-400" />
                <span className="text-xs text-yellow-400">{setup.bear_case}</span>
              </div>
              
              <div className="mt-2">
                <Progress value={setup.ai_conviction} className="h-1" />
                <span className="text-xs text-muted-foreground">Conviction: {setup.ai_conviction}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Signal Alerts Section
function SignalAlertsSection({ alerts }: { alerts: SignalAlert[] }) {
  if (!alerts || alerts.length === 0) return null;
  
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Signal Alerts</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert, idx) => (
            <div key={idx} className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "text-xs",
                    alert.direction === 'bullish' 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-red-500/20 text-red-400"
                  )}>
                    {alert.direction}
                  </Badge>
                  <span className="font-medium">{alert.signal_type}</span>
                </div>
                <Badge variant="outline">{alert.count} assets</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{alert.interpretation}</p>
              <div className="flex flex-wrap gap-1">
                {alert.notable_assets?.slice(0, 5).map((asset) => (
                  <Badge key={asset} variant="secondary" className="text-xs">{asset}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Skeptics Corner Section
function SkepticsCornerSection({ warnings }: { warnings: SkepticWarning[] }) {
  if (!warnings || warnings.length === 0) return null;
  
  return (
    <Card className="bg-card/50 backdrop-blur border-yellow-500/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <CardTitle className="text-lg text-yellow-400">Skeptic's Corner</CardTitle>
        </div>
        <CardDescription>Risks and warning signs to watch</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {warnings.map((warning, idx) => (
            <div key={idx} className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn(
                  "text-xs",
                  warning.severity === 'high' ? "bg-red-500/20 text-red-400" :
                  warning.severity === 'medium' ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-blue-500/20 text-blue-400"
                )}>
                  {warning.severity}
                </Badge>
                <span className="font-medium capitalize">{warning.warning_type.replace('_', ' ')}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{warning.explanation}</p>
              <div className="flex flex-wrap gap-1">
                {warning.assets?.slice(0, 5).map((asset) => (
                  <Badge key={asset} variant="outline" className="text-xs">{asset}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Crypto Spotlight Section
function CryptoSpotlightSection({ data }: { data: CryptoSpotlight }) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bitcoin className="h-5 w-5 text-orange-400" />
          <CardTitle className="text-lg">Crypto Spotlight</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Badge variant="outline">BTC Dominance: {data.btc_dominance?.toFixed(1)}%</Badge>
        </div>
        
        <p className="text-sm text-muted-foreground">{data.narrative_summary}</p>
        
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Top Movers</div>
          {data.top_movers?.slice(0, 5).map((mover) => (
            <div key={mover.symbol} className="flex items-center justify-between bg-muted/50 rounded p-2">
              <div>
                <span className="font-medium">{mover.symbol}</span>
                <span className="text-xs text-muted-foreground ml-2">{mover.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>${mover.price?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                <span className={cn(
                  "text-sm",
                  mover.change_24h >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {mover.change_24h >= 0 ? '+' : ''}{mover.change_24h?.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {data.defi_themes && data.defi_themes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.defi_themes.map((theme) => (
              <Badge key={theme} variant="secondary" className="text-xs">{theme}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Action Items Section
function ActionItemsSection({ items }: { items: ActionItem[] }) {
  if (!items || items.length === 0) return null;
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'immediate': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'watch': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };
  
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'entry': return <ArrowUpRight className="h-4 w-4 text-green-400" />;
      case 'exit': return <ArrowDownRight className="h-4 w-4 text-red-400" />;
      case 'add': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'reduce': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <Eye className="h-4 w-4 text-yellow-400" />;
    }
  };
  
  return (
    <Card className="bg-card/50 backdrop-blur border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Action Items</CardTitle>
        </div>
        <CardDescription>Prioritized next steps based on today's analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getActionIcon(item.action_type)}
                  <span className="font-bold">{item.symbol}</span>
                  <Badge className={cn("text-xs", getPriorityColor(item.priority))}>
                    {item.priority}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">{item.action_type}</Badge>
                </div>
              </div>
              <p className="text-sm mb-2">{item.description}</p>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Trigger:</span> {item.trigger}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Why:</span> {item.reasoning}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Fundamental Leaders Section
function FundamentalLeadersSection({ leaders, onAssetClick }: { leaders: FundamentalLeader[]; onAssetClick: (id: number) => void }) {
  if (!leaders || leaders.length === 0) return null;
  
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Fundamental Leaders</CardTitle>
        </div>
        <CardDescription>Highest quality companies by FVS score</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaders.slice(0, 5).map((leader) => (
            <div 
              key={leader.asset_id}
              className="bg-muted/50 rounded-lg p-3 cursor-pointer hover:bg-muted/70 transition-colors"
              onClick={() => onAssetClick(leader.asset_id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{leader.symbol}</span>
                  <span className="text-sm text-muted-foreground">{leader.name}</span>
                </div>
                <Badge className="bg-green-500/20 text-green-400">
                  FVS: {leader.fvs_score?.toFixed(1)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>Profitability: {leader.profitability_score?.toFixed(0)}</div>
                <div>Growth: {leader.growth_score?.toFixed(0)}</div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{leader.ai_summary}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Component
export default function DailyBriefV2Page() {
  const [, navigate] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: brief, error, isLoading, mutate } = useSWR<DailyBriefV2>(
    `${DAILY_BRIEF_V2_API}/latest`,
    async (url: string) => {
      const response = await fetch(url, {
        headers: getJsonApiHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch brief');
      return response.json();
    },
    { revalidateOnFocus: false }
  );
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${DAILY_BRIEF_V2_API}/generate`, {
        method: 'POST',
        headers: getJsonApiHeaders()
      });
      if (!response.ok) throw new Error('Failed to generate brief');
      await mutate();
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleAssetClick = (assetId: number) => {
    navigate(`/assets/${assetId}`);
  };
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Daily Brief
            </h1>
            <p className="text-muted-foreground">
              AI-powered market analysis and top trading setups
            </p>
          </div>
          <div className="flex items-center gap-4">
            {brief && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Generated {format(parseISO(brief.created_at), 'h:mm a')}
              </div>
            )}
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating}
              variant="outline"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
              {isGenerating ? 'Generating...' : 'Regenerate'}
            </Button>
          </div>
        </div>
        
        {/* Brief Date and Model */}
        {brief && (
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(brief.brief_date), 'EEEE, MMMM d, yyyy')}
            </Badge>
            <Badge variant="secondary">{brief.model_used}</Badge>
            <Badge variant="outline" className="text-xs">
              {brief.generation_stats?.total_tokens_in?.toLocaleString()} tokens in / {brief.generation_stats?.total_tokens_out?.toLocaleString()} out
            </Badge>
          </div>
        )}
        
        {!brief ? (
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Brief Available</h3>
              <p className="text-muted-foreground mb-4">Generate today's market brief to see the top trading opportunities.</p>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Brief
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {brief.market_pulse && <MarketPulseSection data={brief.market_pulse} />}
              {brief.macro_context && <MacroContextSection data={brief.macro_context} />}
              {brief.top_setups && <TopSetupsSection setups={brief.top_setups} onAssetClick={handleAssetClick} />}
              {brief.signal_alerts && <SignalAlertsSection alerts={brief.signal_alerts} />}
            </div>
            
            {/* Right Column */}
            <div className="space-y-6">
              {brief.action_items && <ActionItemsSection items={brief.action_items} />}
              {brief.skeptics_corner && <SkepticsCornerSection warnings={brief.skeptics_corner} />}
              {brief.crypto_spotlight && <CryptoSpotlightSection data={brief.crypto_spotlight} />}
              {brief.fundamental_leaders && <FundamentalLeadersSection leaders={brief.fundamental_leaders} onAssetClick={handleAssetClick} />}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

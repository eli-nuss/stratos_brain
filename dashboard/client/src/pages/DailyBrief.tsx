import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { apiFetcher, DAILY_BRIEF_API_BASE, getJsonApiHeaders } from "@/lib/api-config";
import { format, parseISO } from "date-fns";

// Types matching the backend
interface SetupHighlight {
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: 'crypto' | 'equity';
  price: number;
  change_1d: number;
  score: number;
  reasoning: string;
  key_levels: {
    support?: number;
    resistance?: number;
    entry?: number;
    target?: number;
    stop_loss?: number;
  };
  signals: string[];
  confidence: 'high' | 'medium' | 'low';
}

interface SignalHighlight {
  signal_type: string;
  count: number;
  direction: 'bullish' | 'bearish';
  notable_assets: string[];
  interpretation: string;
}

interface SectorAnalysis {
  sector: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  top_performers: string[];
  key_themes: string[];
}

interface DailyBrief {
  brief_id: number;
  brief_date: string;
  market_overview: string;
  top_bullish_setups: SetupHighlight[];
  top_bearish_setups: SetupHighlight[];
  key_signals: SignalHighlight[];
  sector_analysis: SectorAnalysis[];
  crypto_highlights: SetupHighlight[];
  equity_highlights: SetupHighlight[];
  generated_at: string;
  model_used: string;
  tokens_in: number;
  tokens_out: number;
}

// Setup Card Component
function SetupCard({ 
  setup, 
  direction,
  onAssetClick 
}: { 
  setup: SetupHighlight; 
  direction: 'bullish' | 'bearish';
  onAssetClick: (assetId: string) => void;
}) {
  const isBullish = direction === 'bullish';
  
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isBullish ? "hover:border-green-500/50" : "hover:border-red-500/50"
      )}
      onClick={() => onAssetClick(String(setup.asset_id))}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {setup.asset_type === 'crypto' ? (
              <Bitcoin className="w-4 h-4 text-orange-500" />
            ) : (
              <Building2 className="w-4 h-4 text-blue-500" />
            )}
            <div>
              <span className="font-semibold text-sm">{setup.symbol}</span>
              <span className="text-xs text-muted-foreground ml-2">{setup.name}</span>
            </div>
          </div>
          <Badge 
            variant={setup.confidence === 'high' ? 'default' : setup.confidence === 'medium' ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {setup.confidence}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 mb-3">
          <span className="text-lg font-bold">
            ${setup.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={cn(
            "text-sm font-medium flex items-center gap-1",
            setup.change_1d >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {setup.change_1d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {setup.change_1d >= 0 ? '+' : ''}{setup.change_1d?.toFixed(2)}%
          </span>
          <Badge variant="outline" className="text-xs">
            Score: {setup.score?.toFixed(1)}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {setup.reasoning}
        </p>
        
        {/* Key Levels */}
        {(setup.key_levels?.entry || setup.key_levels?.target || setup.key_levels?.stop_loss) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {setup.key_levels.entry && (
              <Badge variant="outline" className="text-xs bg-blue-500/10">
                Entry: ${setup.key_levels.entry.toLocaleString()}
              </Badge>
            )}
            {setup.key_levels.target && (
              <Badge variant="outline" className="text-xs bg-green-500/10">
                Target: ${setup.key_levels.target.toLocaleString()}
              </Badge>
            )}
            {setup.key_levels.stop_loss && (
              <Badge variant="outline" className="text-xs bg-red-500/10">
                Stop: ${setup.key_levels.stop_loss.toLocaleString()}
              </Badge>
            )}
          </div>
        )}
        
        {/* Active Signals */}
        {setup.signals && setup.signals.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {setup.signals.slice(0, 3).map((signal, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {signal.replace(/_/g, ' ')}
              </Badge>
            ))}
            {setup.signals.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{setup.signals.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Signal Highlight Card
function SignalCard({ signal }: { signal: SignalHighlight }) {
  const isBullish = signal.direction === 'bullish';
  
  return (
    <Card className={cn(
      "border-l-4",
      isBullish ? "border-l-green-500" : "border-l-red-500"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className={cn(
              "w-4 h-4",
              isBullish ? "text-green-500" : "text-red-500"
            )} />
            <span className="font-semibold text-sm capitalize">
              {signal.signal_type.replace(/_/g, ' ')}
            </span>
          </div>
          <Badge variant={isBullish ? "default" : "destructive"}>
            {signal.count} assets
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-2">
          {signal.interpretation}
        </p>
        
        <div className="flex flex-wrap gap-1">
          {signal.notable_assets.slice(0, 5).map((asset, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {asset}
            </Badge>
          ))}
          {signal.notable_assets.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{signal.notable_assets.length - 5} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Sector Analysis Card
function SectorCard({ sector }: { sector: SectorAnalysis }) {
  const sentimentColor = {
    bullish: "text-green-600 bg-green-500/10",
    bearish: "text-red-600 bg-red-500/10",
    neutral: "text-yellow-600 bg-yellow-500/10"
  };
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-sm">{sector.sector}</span>
          <Badge className={cn("capitalize", sentimentColor[sector.sentiment])}>
            {sector.sentiment}
          </Badge>
        </div>
        
        {sector.key_themes.length > 0 && (
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">Key Themes:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {sector.key_themes.map((theme, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {theme}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {sector.top_performers.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Top Performers:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {sector.top_performers.map((performer, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {performer}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function BriefSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-32" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

export default function DailyBrief() {
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Fetch the latest brief
  const { data: brief, error, mutate, isLoading } = useSWR<DailyBrief>(
    `/api/daily-brief/latest`,
    apiFetcher,
    { revalidateOnFocus: false }
  );
  
  // Fetch list of available briefs
  const { data: briefList } = useSWR<{ brief_date: string; generated_at: string }[]>(
    `/api/daily-brief/list`,
    apiFetcher
  );
  
  const handleAssetClick = (assetId: string) => {
    setLocation(`/asset/${assetId}`);
  };
  
  const handleGenerateBrief = async (force: boolean = false) => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${DAILY_BRIEF_API_BASE}/generate`, {
        method: 'POST',
        headers: getJsonApiHeaders(),
        body: JSON.stringify({ date: selectedDate, force })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to generate brief');
      }
      
      const result = await response.json();
      mutate(result.brief);
    } catch (err) {
      console.error('Error generating brief:', err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };
  
  const formatTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <DashboardLayout hideNavTabs>
      <div className="container py-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">Daily Brief</h1>
            </div>
            <p className="text-muted-foreground">
              AI-powered market analysis and top trading setups
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {brief && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Generated {formatTime(brief.generated_at)}
              </div>
            )}
            <Button 
              onClick={() => handleGenerateBrief(true)} 
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isGenerating && "animate-spin")} />
              {isGenerating ? 'Generating...' : 'Regenerate'}
            </Button>
          </div>
        </div>
        
        {/* Date Badge */}
        {brief && (
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatDate(brief.brief_date)}</span>
            <Badge variant="secondary" className="text-xs">
              {brief.model_used}
            </Badge>
          </div>
        )}
        
        {/* Loading State */}
        {isLoading && <BriefSkeleton />}
        
        {/* Error State */}
        {error && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Brief Available</h3>
              <p className="text-muted-foreground text-center mb-4">
                Generate today's market brief to see the top trading opportunities.
              </p>
              <Button onClick={() => handleGenerateBrief(false)} disabled={isGenerating}>
                <Sparkles className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Brief'}
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Brief Content */}
        {brief && !isLoading && (
          <div className="space-y-6">
            {/* Market Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Market Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {brief.market_overview.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Top Setups Tabs */}
            <Tabs defaultValue="bullish" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="bullish" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Bullish Setups ({brief.top_bullish_setups?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="bearish" className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Bearish Setups ({brief.top_bearish_setups?.length || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="bullish" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {brief.top_bullish_setups?.map((setup, i) => (
                    <SetupCard 
                      key={i} 
                      setup={setup} 
                      direction="bullish"
                      onAssetClick={handleAssetClick}
                    />
                  ))}
                </div>
                {(!brief.top_bullish_setups || brief.top_bullish_setups.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No bullish setups identified today.
                  </p>
                )}
              </TabsContent>
              
              <TabsContent value="bearish" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {brief.top_bearish_setups?.map((setup, i) => (
                    <SetupCard 
                      key={i} 
                      setup={setup} 
                      direction="bearish"
                      onAssetClick={handleAssetClick}
                    />
                  ))}
                </div>
                {(!brief.top_bearish_setups || brief.top_bearish_setups.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No bearish setups identified today.
                  </p>
                )}
              </TabsContent>
            </Tabs>
            
            {/* Asset Type Highlights */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Crypto Highlights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bitcoin className="w-5 h-5 text-orange-500" />
                    Crypto Highlights
                  </CardTitle>
                  <CardDescription>
                    Top cryptocurrency opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {brief.crypto_highlights?.map((setup, i) => (
                        <div 
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleAssetClick(String(setup.asset_id))}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{setup.symbol}</span>
                              <Badge variant={setup.confidence === 'high' ? 'default' : 'secondary'} className="text-xs">
                                {setup.confidence}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                              {setup.reasoning}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${setup.price?.toLocaleString()}</div>
                            <div className={cn(
                              "text-xs",
                              setup.change_1d >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {setup.change_1d >= 0 ? '+' : ''}{setup.change_1d?.toFixed(2)}%
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))}
                      {(!brief.crypto_highlights || brief.crypto_highlights.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">
                          No crypto highlights today.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              
              {/* Equity Highlights */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    Equity Highlights
                  </CardTitle>
                  <CardDescription>
                    Top stock opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {brief.equity_highlights?.map((setup, i) => (
                        <div 
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleAssetClick(String(setup.asset_id))}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{setup.symbol}</span>
                              <Badge variant={setup.confidence === 'high' ? 'default' : 'secondary'} className="text-xs">
                                {setup.confidence}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                              {setup.reasoning}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${setup.price?.toLocaleString()}</div>
                            <div className={cn(
                              "text-xs",
                              setup.change_1d >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {setup.change_1d >= 0 ? '+' : ''}{setup.change_1d?.toFixed(2)}%
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))}
                      {(!brief.equity_highlights || brief.equity_highlights.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">
                          No equity highlights today.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            {/* Key Signals */}
            {brief.key_signals && brief.key_signals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    Key Signals
                  </CardTitle>
                  <CardDescription>
                    Notable technical signals firing across the market
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {brief.key_signals.map((signal, i) => (
                      <SignalCard key={i} signal={signal} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Sector Analysis */}
            {brief.sector_analysis && brief.sector_analysis.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    Sector Analysis
                  </CardTitle>
                  <CardDescription>
                    Performance and sentiment by sector
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {brief.sector_analysis.map((sector, i) => (
                      <SectorCard key={i} sector={sector} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

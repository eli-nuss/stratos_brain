import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Activity, MessageCircle, Info, ExternalLink, Tag, FileText, ChevronDown, ChevronUp, Maximize2, Minimize2, Camera, Crosshair, Zap, CheckCircle2, Sparkles, Clock } from "lucide-react";
import html2canvas from "html2canvas";
import { Area, Line, ComposedChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Legend } from "recharts";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  SIGNAL_DEFINITIONS, 
  TRADE_PLAN_DEFINITIONS, 
  formatSignalType, 
  getSignalTooltip 
} from "@/lib/signalDefinitions";

import { NotesHistory } from "./NotesHistory";
import { FilesSection } from "./FilesSection";
import TradingViewWidget from "./TradingViewWidget";
import { FundamentalsSummary } from "./FundamentalsSummary";
import { HistoricalFinancials } from "./HistoricalFinancials";
import { TechnicalsSidebar } from "./TechnicalsSidebar";
import { FundamentalsSidebar } from "./FundamentalsSidebar";
import { DocumentsSection } from "./DocumentsSection";
import { InlineOnePager } from "./InlineOnePager";
import AddToPortfolioButton from "./AddToPortfolioButton";
import AssetTagButton from "./AssetTagButton";
import { apiFetcher } from "@/lib/api-config";

interface AssetDetailProps {
  assetId: string;
  onClose: () => void;
}

// Helper component for info tooltips
function InfoTooltip({ content, className = "" }: { content: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className={`w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help transition-colors ${className}`} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left whitespace-pre-wrap">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

// Format setup name for display
function formatSetupName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Setup Badge Component
function SetupBadge({ setup, purity }: { setup: string; purity: number }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
        <Crosshair className="w-4 h-4" />
        <span>{formatSetupName(setup)}</span>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
        <span className="text-[10px] text-muted-foreground uppercase">Purity</span>
        <span className={`text-sm font-bold ${
          purity >= 85 ? "text-emerald-400" : purity >= 70 ? "text-yellow-400" : "text-orange-400"
        }`}>
          {purity}%
        </span>
      </div>
    </div>
  );
}

// Trade Ladder Component
function TradeLadder({ 
  entry, 
  targets, 
  stop,
  quantEntry,
  quantStop,
  quantTarget,
  aiAdjustedEntry,
  aiAdjustedStop,
  aiAdjustedTarget
}: { 
  entry: { low: number; high: number } | null; 
  targets: number[] | null; 
  stop: number | null;
  quantEntry?: number | null;
  quantStop?: number | null;
  quantTarget?: number | null;
  aiAdjustedEntry?: number | null;
  aiAdjustedStop?: number | null;
  aiAdjustedTarget?: number | null;
}) {
  const displayEntry = aiAdjustedEntry || quantEntry || entry?.low;
  const displayStop = aiAdjustedStop || quantStop || stop;
  const displayTarget = aiAdjustedTarget || quantTarget || (targets && targets.length > 0 ? targets[targets.length - 1] : null);
  
  const risk = displayEntry && displayStop ? displayEntry - displayStop : 0;
  const reward = displayEntry && displayTarget ? displayTarget - displayEntry : 0;
  const riskReward = risk > 0 ? (reward / risk).toFixed(2) : '—';
  
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Trade Plan</h3>
          <InfoTooltip content="AI-generated trade plan with specific price levels. Entry zone is where to consider initiating positions. Targets are profit-taking levels. Stop is where the thesis fails." />
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded">
          <span className="text-[10px] text-muted-foreground">R:R</span>
          <span className="text-xs font-bold text-blue-400">{riskReward}</span>
        </div>
      </div>
      
      <div className="p-4">
        <div className="relative space-y-4">
          {/* Target */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Target</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-mono font-bold text-blue-400">
                  {displayTarget ? `$${displayTarget.toFixed(2)}` : '—'}
                </span>
                {targets && targets.length > 1 && (
                  <span className="text-xs text-muted-foreground">
                    ({targets.map(t => `$${t.toFixed(2)}`).join(' → ')})
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Entry */}
          <div className="flex items-center gap-3 pl-4">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Entry</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-mono font-bold text-purple-400">
                  {displayEntry ? `$${displayEntry.toFixed(2)}` : '—'}
                </span>
                {entry && entry.low !== entry.high && (
                  <span className="text-xs text-muted-foreground">
                    (${entry.low?.toFixed(2)} - ${entry.high?.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Stop */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Stop</div>
              <span className="text-lg font-mono font-bold text-red-400">
                {displayStop ? `$${displayStop.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Why Now Section Component
function WhyNowSection({ reasons }: { reasons: string[] | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!reasons || reasons.length === 0) return null;
  
  const displayReasons = isExpanded ? reasons : reasons.slice(0, 3);
  
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h3 className="font-semibold text-sm">Why Now</h3>
        <InfoTooltip content="Specific reasons why this setup is actionable right now based on technical and market conditions." />
      </div>
      <div className="p-3 space-y-2">
        {displayReasons.map((reason, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span>{reason}</span>
          </div>
        ))}
        {reasons.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show {reasons.length - 3} more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Risks Section Component  
function RisksSection({ risks }: { risks: string[] | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!risks || risks.length === 0) return null;
  
  const displayRisks = isExpanded ? risks : risks.slice(0, 2);
  
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-400" />
        <h3 className="font-semibold text-sm">Key Risks</h3>
        <InfoTooltip content="Risk factors and potential issues to watch that could invalidate the trade thesis." />
      </div>
      <div className="p-3 space-y-2">
        {displayRisks.map((risk, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
            <span>{risk}</span>
          </div>
        ))}
        {risks.length > 2 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show {risks.length - 2} more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}


export default function AssetDetail({ assetId, onClose }: AssetDetailProps) {
  const { data, isLoading } = useSWR(`/api/dashboard/asset?asset_id=${assetId}`, apiFetcher);

  const [chartView, setChartView] = useState<'tradingview' | 'financials'>('tradingview');
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const chartRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureChart = async () => {
    if (!chartRef.current) return;
    
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `${data?.asset?.symbol || 'chart'}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to capture chart:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const { asset, ohlcv, ai_score_history, features, review, review_status, stock_lists } = data;

  // Merge OHLCV data with AI score history for chart overlay
  const chartData = ohlcv?.map((bar: any) => {
    const aiScore = ai_score_history?.find((s: any) => s.as_of_date === bar.date);
    return {
      ...bar,
      ai_direction_score: aiScore?.ai_direction_score ?? null
    };
  }) || [];
  const isBullish = review?.direction === "bullish";
  const signalColor = isBullish ? "text-signal-bullish" : "text-signal-bearish";
  const signalBg = isBullish ? "bg-signal-bullish/10" : "bg-signal-bearish/10";

  const getTradingViewUrl = (symbol: string, assetType: string) => {
    if (assetType === 'crypto') {
      return `https://www.tradingview.com/chart/?symbol=CRYPTO:${symbol}USD`;
    } else {
      return `https://www.tradingview.com/chart/?symbol=${symbol}`;
    }
  };

  // Check if we have v3 data
  const hasV3Data = review?.primary_setup || review?.setup_purity_score;

  return (
    <>
      <div className="flex flex-col h-full bg-card text-foreground overflow-hidden">
        {/* Header - Compact */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-border flex justify-between items-center bg-muted/10">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight">{asset.symbol}</h2>
              <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[100px] sm:max-w-none">
                {asset.name}
              </span>
            </div>
            <span className="font-mono text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              {data.as_of_date}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <AddToPortfolioButton assetId={asset.asset_id} symbol={asset.symbol} />
            <AssetTagButton assetId={asset.asset_id} />
            <a 
              href={getTradingViewUrl(asset.symbol, asset.asset_type)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-muted/50 rounded-md hover:bg-muted"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              TradingView
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-3 sm:gap-4">
            {/* Left Column: Chart, AI Analysis, Trade Plan (70% = 7 cols) */}
            <div className="lg:col-span-7 space-y-3 sm:space-y-4">
              {/* Chart Section */}
              <div className={`bg-card border border-border rounded-lg overflow-hidden ${isChartFullscreen ? 'fixed inset-4 z-50' : ''}`}>
                <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChartView('tradingview')}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        chartView === 'tradingview' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Chart
                    </button>
                    <button
                      onClick={() => setChartView('financials')}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        chartView === 'financials' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Financials
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={captureChart}
                      disabled={isCapturing}
                      className="p-1.5 hover:bg-muted rounded transition-colors"
                      title="Capture chart"
                    >
                      <Camera className={`w-4 h-4 ${isCapturing ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={() => setIsChartFullscreen(!isChartFullscreen)}
                      className="p-1.5 hover:bg-muted rounded transition-colors"
                    >
                      {isChartFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div ref={chartRef} className={`${isChartFullscreen ? 'h-[calc(100%-48px)]' : 'h-[350px] sm:h-[400px]'}`}>
                  {chartView === 'tradingview' ? (
                    <TradingViewWidget symbol={asset.symbol} assetType={asset.asset_type} />
                  ) : (
                    <HistoricalFinancials assetId={parseInt(assetId)} symbol={asset.symbol} />
                  )}
                </div>
              </div>

              {/* V3 Setup Badge - Show prominently if available */}
              {hasV3Data && review?.primary_setup && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <SetupBadge 
                    setup={review.primary_setup} 
                    purity={review.setup_purity_score || 0} 
                  />
                  {review.historical_profit_factor && review.historical_profit_factor > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Historical Profit Factor:</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {review.historical_profit_factor.toFixed(2)}
                      </span>
                      <InfoTooltip content="Profit factor from backtested trades using this setup. Values above 1.5 indicate strong historical performance." />
                    </div>
                  )}
                </div>
              )}

              {/* AI Summary */}
              {chartView !== 'financials' && review?.summary_text && (
                <div className="bg-muted/10 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">AI Summary</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70 font-mono">
                      <Sparkles className="w-3 h-3" />
                      <span>{review.model_id || "gemini-3-flash-preview"}</span>
                      {review.as_of_date && (
                        <>
                          <span>•</span>
                          <Clock className="w-3 h-3" />
                          <span>{review.as_of_date}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {review.summary_text}
                  </p>
                </div>
              )}

              {/* Trade Plan & Why Now - Grid Layout */}
              {chartView !== 'financials' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Trade Ladder */}
                  <TradeLadder 
                    entry={review?.entry}
                    targets={review?.targets}
                    stop={review?.invalidation}
                    quantEntry={review?.quant_entry_price}
                    quantStop={review?.quant_stop_loss}
                    quantTarget={review?.quant_target_price}
                    aiAdjustedEntry={review?.ai_adjusted_entry}
                    aiAdjustedStop={review?.ai_adjusted_stop}
                    aiAdjustedTarget={review?.ai_adjusted_target}
                  />
                  
                  {/* Why Now */}
                  {review?.why_now && review.why_now.length > 0 ? (
                    <WhyNowSection reasons={review.why_now} />
                  ) : (
                    /* Signals fallback if no why_now */
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">Signals</h3>
                        <InfoTooltip content="Quantitative signals that triggered this asset's score. Each signal has a strength from 0-100 based on technical criteria." />
                      </div>
                      <div className="p-3 max-h-[180px] overflow-y-auto">
                        {review?.signal_facts && review.signal_facts.length > 0 ? (
                          <div className="space-y-1.5">
                            {review.signal_facts.map((signal: any, i: number) => (
                              <Tooltip key={i}>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-between p-1.5 bg-muted/20 rounded cursor-help hover:bg-muted/30 transition-colors">
                                    <span className="text-xs font-medium truncate">
                                      {formatSignalType(signal.signal_type)}
                                    </span>
                                    <span className={`text-xs font-mono ml-2 ${
                                      signal.strength >= 70 ? 'text-signal-bullish' : 
                                      signal.strength >= 40 ? 'text-yellow-500' : 
                                      'text-muted-foreground'
                                    }`}>
                                      {signal.strength}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {getSignalTooltip(signal.signal_type)}
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            No signal data available
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Key Risks */}
              {chartView !== 'financials' && review?.risks && review.risks.length > 0 && (
                <RisksSection risks={review.risks} />
              )}

              {/* Inline One Pager */}
              <InlineOnePager assetId={parseInt(assetId)} symbol={asset.symbol} />
            </div>

            {/* Right Column: About, Fundamentals, Documents, Notes, Files (30% = 3 cols) */}
            <div className="lg:col-span-3 space-y-3">
              {/* About Section */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('about')}
                  className="w-full bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">About</h3>
                  </div>
                  {collapsedSections['about'] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                </button>
                {!collapsedSections['about'] && (
                  <div className="p-3">
                    {asset.short_description ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {asset.short_description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic">No description available</p>
                    )}
                    {(asset.sector || asset.industry) && (
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                        {asset.sector && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Sector</span>
                            <span className="font-medium">{asset.sector}</span>
                          </div>
                        )}
                        {asset.industry && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Industry</span>
                            <span className="font-medium truncate max-w-[150px]">{asset.industry}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fundamentals Summary */}
              <FundamentalsSummary asset={asset} />

              {/* Stock Lists */}
              {stock_lists && stock_lists.length > 0 && (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Lists</h3>
                  </div>
                  <div className="p-3 flex flex-wrap gap-2">
                    {stock_lists.map((list: any) => (
                      <span 
                        key={list.id}
                        className="px-2 py-1 text-xs rounded-full"
                        style={{ 
                          backgroundColor: `${list.color}20`,
                          color: list.color,
                          border: `1px solid ${list.color}40`
                        }}
                      >
                        {list.icon && <span className="mr-1">{list.icon}</span>}
                        {list.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents */}
              <DocumentsSection assetId={parseInt(assetId)} symbol={asset.symbol} />

              {/* Notes */}
              <NotesHistory assetId={parseInt(assetId)} />

              {/* Files */}
              <FilesSection assetId={parseInt(assetId)} symbol={asset.symbol} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Activity, MessageCircle, Info, ExternalLink, Tag, FileText, ChevronDown, ChevronUp, Maximize2, Minimize2, Camera } from "lucide-react";
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
import { getSetupDefinition, SETUP_DEFINITIONS } from "@/lib/setupDefinitions";

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
import AssetDetailSkeleton from "./AssetDetailSkeleton";
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

// Confidence meter component
function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  
  // Color based on confidence level
  const getColor = () => {
    if (percentage >= 75) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-muted-foreground';
  };
  
  const getTextColor = () => {
    if (percentage >= 75) return 'text-emerald-500';
    if (percentage >= 50) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-medium ${getTextColor()}`}>
        {percentage}%
      </span>
    </div>
  );
}


export default function AssetDetail({ assetId, onClose }: AssetDetailProps) {
  const { data, isLoading } = useSWR(`/api/dashboard/asset?asset_id=${assetId}`, apiFetcher);

  const [chartView, setChartView] = useState<'tradingview' | 'financials'>('tradingview');
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ about: true });

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
      });
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            // Show brief success feedback
            alert('Chart copied to clipboard!');
          } catch (err) {
            // Fallback: download the image
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${asset?.symbol || 'chart'}_${format(new Date(), 'yyyy-MM-dd')}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to capture chart:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  if (isLoading) {
    return <AssetDetailSkeleton />;
  }

  if (!data || !data.asset) return null;

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
      // For crypto, use CRYPTO exchange with USD pair
      return `https://www.tradingview.com/chart/?symbol=CRYPTO:${symbol}USD`;
    } else {
      // For equities, just use the symbol
      return `https://www.tradingview.com/chart/?symbol=${symbol}`;
    }
  };

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
          <div className="flex items-center gap-2">
            {/* TradingView link */}
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={getTradingViewUrl(asset.symbol, asset.asset_type)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full transition-colors text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                Open chart on TradingView
              </TooltipContent>
            </Tooltip>
            {/* Add to Portfolio button */}
            <AddToPortfolioButton assetId={parseInt(assetId)} assetType={asset?.asset_type} />
            
            {/* Asset Tag button */}
            <AssetTagButton assetId={parseInt(assetId)} />
            
            {/* Research Chat button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <a 
                  href={`/chat?asset_id=${assetId}&symbol=${encodeURIComponent(asset?.symbol || '')}&name=${encodeURIComponent(asset?.name || '')}&asset_type=${asset?.asset_type || 'equity'}`}
                  className="p-2 rounded-full transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <MessageCircle className="w-5 h-5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                Open full research chat
              </TooltipContent>
            </Tooltip>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content - 70/30 split */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-10 gap-3 sm:gap-4">
          {/* Left Column: Chart, AI Analysis, Trade Plan & Signals (70% = 7 cols) */}
          <div className="lg:col-span-7 space-y-4 flex flex-col">
            {/* Chart - Expanded */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Price Chart</h3>
                  {/* Chart View Toggle */}
                  <div className="flex items-center bg-muted/30 rounded-md p-0.5">
                    <button
                      onClick={() => setChartView('tradingview')}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        chartView === 'tradingview'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      TradingView
                    </button>

                    {asset.asset_type === 'equity' && (
                      <button
                        onClick={() => setChartView('financials')}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          chartView === 'financials'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Financials
                      </button>
                    )}

                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={captureChart}
                    disabled={isCapturing}
                    className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    title="Copy chart to clipboard"
                  >
                    <Camera className={`w-4 h-4 ${isCapturing ? 'animate-pulse' : ''}`} />
                  </button>
                  <button
                    onClick={() => setIsChartFullscreen(!isChartFullscreen)}
                    className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    title={isChartFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {isChartFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <a
                    href={getTradingViewUrl(asset.symbol, asset.asset_type)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    Open in TradingView <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              
              {chartView === 'financials' ? (
                <div className={`${isChartFullscreen ? 'min-h-[600px]' : 'min-h-[450px]'} w-full transition-all duration-300`}>
                  <HistoricalFinancials assetId={parseInt(assetId)} assetType={asset.asset_type} symbol={asset.symbol} embedded={true} />
                </div>
              ) : (
                <div className={`${isChartFullscreen ? 'h-[600px]' : 'h-[450px]'} w-full rounded-lg border border-border overflow-hidden transition-all duration-300`}>
                  <TradingViewWidget
                    symbol={asset.symbol}
                    assetType={asset.asset_type === 'crypto' ? 'crypto' : 'equity'}
                    theme="dark"
                    interval="D"
                  />
                </div>
              )}
            </div>

            {/* AI Analysis - Different content based on view */}
            {chartView === 'financials' && asset.asset_type === 'equity' ? (
              /* Fundamental Vigor Score (FVS) Thesis for Fundamentals View */
              <div className="bg-muted/10 border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Fundamental Analysis</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {asset.fvs_score != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">FVS Score:<InfoTooltip content="Fundamental Vigor Score (0-100) is a weighted composite of Profitability (30%), Solvency (25%), Growth (25%), and Moat (20%). Scores ≥80 indicate Quality fundamentals, 60-79 are Quality-leaning, 40-59 are Speculative, and <40 indicate Distressed financials." /></span>
                        <span className={`text-lg font-bold ${
                          asset.fvs_score >= 80 ? 'text-emerald-400' :
                          asset.fvs_score >= 60 ? 'text-blue-400' :
                          asset.fvs_score >= 40 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {asset.fvs_score.toFixed(0)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          asset.fvs_score >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                          asset.fvs_score >= 60 ? 'bg-blue-500/20 text-blue-400' :
                          asset.fvs_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {asset.fvs_score >= 80 ? 'QUALITY' :
                           asset.fvs_score >= 60 ? 'QUALITY' :
                           asset.fvs_score >= 40 ? 'SPECULATIVE' : 'DISTRESSED'}
                        </span>
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground/70 font-mono">
                      gemini-3-pro-preview
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {asset.fvs_reasoning ? (
                    <div className="space-y-4">
                      {/* FVS Pillar Scores */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <span>Profitability</span>
                            <InfoTooltip content="Measures the company's ability to generate profits. Evaluates gross margin, operating margin, net margin, ROE, and ROA. Higher scores indicate stronger profit generation and efficient use of capital." />
                          </div>
                          <div className={`text-sm font-semibold ${
                            (asset.fvs_profitability || 0) >= 70 ? 'text-emerald-400' :
                            (asset.fvs_profitability || 0) >= 50 ? 'text-blue-400' :
                            (asset.fvs_profitability || 0) >= 30 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{asset.fvs_profitability || '-'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <span>Solvency</span>
                            <InfoTooltip content="Assesses financial stability and ability to meet obligations. Analyzes current ratio, debt-to-equity, interest coverage, and Altman Z-Score. Higher scores indicate lower bankruptcy risk and stronger balance sheet." />
                          </div>
                          <div className={`text-sm font-semibold ${
                            (asset.fvs_solvency || 0) >= 70 ? 'text-emerald-400' :
                            (asset.fvs_solvency || 0) >= 50 ? 'text-blue-400' :
                            (asset.fvs_solvency || 0) >= 30 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{asset.fvs_solvency || '-'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <span>Growth</span>
                            <InfoTooltip content="Evaluates revenue and earnings expansion. Measures revenue CAGR, earnings growth, and recent acceleration trends. Higher scores indicate stronger growth trajectory and momentum." />
                          </div>
                          <div className={`text-sm font-semibold ${
                            (asset.fvs_growth || 0) >= 70 ? 'text-emerald-400' :
                            (asset.fvs_growth || 0) >= 50 ? 'text-blue-400' :
                            (asset.fvs_growth || 0) >= 30 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{asset.fvs_growth || '-'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-1">
                            <span>Moat</span>
                            <InfoTooltip content="Measures competitive advantage durability. Analyzes FCF/Net Income ratio (cash conversion quality) and Piotroski F-Score (financial strength). Higher scores suggest sustainable competitive positioning." />
                          </div>
                          <div className={`text-sm font-semibold ${
                            (asset.fvs_moat || 0) >= 70 ? 'text-emerald-400' :
                            (asset.fvs_moat || 0) >= 50 ? 'text-blue-400' :
                            (asset.fvs_moat || 0) >= 30 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{asset.fvs_moat || '-'}</div>
                        </div>
                      </div>
                      {/* FVS Summary/Thesis */}
                      <div className="bg-muted/20 rounded-lg p-3">
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {asset.fvs_reasoning}
                        </p>
                      </div>
                      {/* Altman Z-Score indicator */}
                      {asset.fvs_altman_z != null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">Altman Z-Score:<InfoTooltip content="The Altman Z-Score predicts bankruptcy probability using 5 financial ratios. Scores >2.99 indicate Safe Zone (low bankruptcy risk), 1.81-2.99 is Grey Zone (moderate risk), and <1.81 is Distress Zone (high bankruptcy risk). Developed by Edward Altman in 1968." /></span>
                          <span className={`font-mono ${
                            asset.fvs_altman_z >= 2.99 ? 'text-emerald-400' :
                            asset.fvs_altman_z >= 1.81 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {asset.fvs_altman_z.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground/60">
                            ({asset.fvs_altman_z >= 2.99 ? 'Safe Zone' :
                              asset.fvs_altman_z >= 1.81 ? 'Grey Zone' : 'Distress Zone'})
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground/60 italic">Fundamental analysis not yet available for this equity</p>
                      <p className="text-xs text-muted-foreground/40 mt-1">FVS scores are generated during scheduled analysis runs</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* AI Summary for Technicals View - Enhanced */
              review?.summary_text && (
                <div className="bg-gradient-to-br from-muted/20 to-muted/5 border border-border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold">AI Analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/70 font-mono px-2 py-0.5 bg-muted/30 rounded">
                        {review.model_id || "gemini-3-pro-preview"}
                      </span>
                      {review.as_of_date && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {review.as_of_date}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-4">
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {review.summary_text}
                    </p>
                    
                    {/* Quick Stats Row */}
                    {(review.time_horizon || review.why_now || review.risks) && (
                      <div className="mt-4 pt-3 border-t border-border/30 space-y-2">
                        {review.time_horizon && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-20 flex-shrink-0">Horizon</span>
                            <span className="text-xs text-foreground/80">{review.time_horizon}</span>
                          </div>
                        )}
                        {review.why_now && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-20 flex-shrink-0">Catalyst</span>
                            <span className="text-xs text-foreground/80">{review.why_now}</span>
                          </div>
                        )}
                        {review.risks && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-amber-400 uppercase tracking-wide w-20 flex-shrink-0">Risks</span>
                            <span className="text-xs text-foreground/80">{review.risks}</span>
                          </div>
                        )}
                        {review.what_to_watch_next && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] text-blue-400 uppercase tracking-wide w-20 flex-shrink-0">Watch</span>
                            <span className="text-xs text-foreground/80">{review.what_to_watch_next}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {/* Trade Plan & Signals - Only show in Technicals view */}
            {chartView !== 'financials' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Trade Plan - Enhanced */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">Trade Plan</h3>
                    </div>
                    <InfoTooltip content="AI-generated trade plan with specific price levels. Entry zone is where to consider initiating positions. Targets are profit-taking levels. Invalidation is where the thesis fails." />
                  </div>
                  {review ? (
                    <div className="p-3 space-y-3">
                      {/* Entry Zone */}
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Entry Zone</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold text-primary">
                            ${review.entry?.low?.toFixed(2) || review.entry?.toFixed?.(2) || "—"}
                          </span>
                          {review.entry?.high && (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-mono text-lg font-bold text-primary">
                                ${review.entry.high.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Targets Row */}
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Profit Targets</span>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {review.targets?.slice(0, 3).map((target: number, i: number) => (
                            <div key={i} className="bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1.5">
                              <span className="text-[9px] text-emerald-400/70 block">T{i + 1}</span>
                              <span className="font-mono text-sm font-semibold text-emerald-400">
                                ${typeof target === 'object' ? (target as any).price?.toFixed(2) : target?.toFixed(2) || "—"}
                              </span>
                            </div>
                          )) || (
                            <span className="text-xs text-muted-foreground/50">No targets set</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Stop Loss */}
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Invalidation</span>
                          </div>
                          <span className="font-mono text-lg font-bold text-red-400">
                            ${review.invalidation?.toFixed(2) || "—"}
                          </span>
                        </div>
                      </div>
                      
                      {/* Risk/Reward if available */}
                      {review.risk_reward && (
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-[10px] text-muted-foreground">Risk/Reward Ratio</span>
                          <span className={`font-mono text-sm font-semibold ${
                            review.risk_reward >= 3 ? 'text-emerald-400' :
                            review.risk_reward >= 2 ? 'text-blue-400' :
                            review.risk_reward >= 1.5 ? 'text-amber-400' : 'text-muted-foreground'
                          }`}>
                            {review.risk_reward.toFixed(1)}:1
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center">
                      <Target className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No trade plan available</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">Run AI analysis to generate levels</p>
                    </div>
                  )}
                </div>

                {/* Setup Section - Next to Trade Plan */}
                {(() => {
                  const setupType = review?.setup_type;
                  const setup = getSetupDefinition(setupType);
                  
                  // Trading guidance for each setup type
                  const SETUP_TRADING_GUIDANCE: Record<string, { howToTrade: string; keyPoints: string[] }> = {
                    rs_breakout: {
                      howToTrade: "Enter on the breakout above resistance with volume confirmation. Set stop below the breakout level or recent swing low. Trail stop as price advances.",
                      keyPoints: [
                        "Wait for volume spike (1.5x+ average) on breakout",
                        "Buy on first pullback to breakout level if missed",
                        "Use 8-21 EMA as trailing stop guide"
                      ]
                    },
                    donchian_55_breakout: {
                      howToTrade: "Enter when price closes above the 55-day high. Use ATR-based stop (2x ATR below entry). Hold until opposite signal or trailing stop hit.",
                      keyPoints: [
                        "Classic turtle trading entry signal",
                        "Works best in trending markets",
                        "Consider scaling in on pullbacks"
                      ]
                    },
                    trend_pullback_50ma: {
                      howToTrade: "Enter near the 50MA when price shows reversal candle (hammer, engulfing). Stop below the 50MA or recent low. Target previous highs.",
                      keyPoints: [
                        "Confirm uptrend: price above 50MA & 200MA",
                        "Look for RSI oversold bounce (30-40 range)",
                        "Best when volume dries up on pullback"
                      ]
                    },
                    vcp_squeeze: {
                      howToTrade: "Enter on breakout from the tight range with volume. Stop just below the consolidation low. Target measured move equal to prior advance.",
                      keyPoints: [
                        "Tighter the range, more explosive the move",
                        "Volume should contract during squeeze",
                        "Breakout volume should be 2x+ average"
                      ]
                    },
                    adx_holy_grail: {
                      howToTrade: "Enter when price pulls back to 20 EMA while ADX > 30. Stop below the 20 EMA. Target continuation of the strong trend.",
                      keyPoints: [
                        "ADX > 30 confirms strong trend",
                        "Entry on touch of 20 EMA, not break",
                        "Works in both uptrends and downtrends"
                      ]
                    },
                    gap_up_momentum: {
                      howToTrade: "Enter if gap holds first 30 mins. Stop below gap low or VWAP. Trail stop using 5-min chart structure for day trades.",
                      keyPoints: [
                        "Gap must hold and not fill in first hour",
                        "Higher volume = more conviction",
                        "Consider partial profits at 2R"
                      ]
                    },
                    golden_cross: {
                      howToTrade: "Enter on pullback after the cross occurs. Stop below the 200MA. This is a longer-term signal - hold for weeks to months.",
                      keyPoints: [
                        "Lagging indicator - confirms trend change",
                        "Best for position trading, not day trading",
                        "Combine with other signals for timing"
                      ]
                    },
                    breakout_confirmed: {
                      howToTrade: "Enter on the confirmed breakout or first pullback to breakout level. Stop below breakout zone. Target measured move from base.",
                      keyPoints: [
                        "Confirmation = close above resistance + volume",
                        "Failed breakouts reverse quickly - honor stops",
                        "Add to position on successful retest"
                      ]
                    },
                    oversold_bounce: {
                      howToTrade: "Enter when RSI crosses back above 30 with bullish candle. Tight stop below recent low. Quick profit target - this is mean reversion.",
                      keyPoints: [
                        "Counter-trend trade - use smaller size",
                        "Best in stocks with strong fundamentals",
                        "Take profits quickly at resistance"
                      ]
                    },
                    acceleration_turn: {
                      howToTrade: "Enter when momentum turns positive after consolidation. Stop below the consolidation low. Ride the acceleration phase.",
                      keyPoints: [
                        "Look for MACD histogram turning positive",
                        "Volume should increase with price",
                        "Early signal - may need patience"
                      ]
                    },
                    weinstein_stage2: {
                      howToTrade: "Enter on breakout from long base (100+ days). Stop below base low. This is a major signal - hold for big move potential.",
                      keyPoints: [
                        "Rare but powerful signal",
                        "Base should be 3-6 months minimum",
                        "Volume on breakout should be highest in months"
                      ]
                    }
                  };
                  
                  const tradingGuidance = setupType ? SETUP_TRADING_GUIDANCE[setupType.toLowerCase()] : null;
                  
                  if (!setup) return null;
                  
                  return (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          <h3 className="font-semibold text-sm">Setup</h3>
                        </div>
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ 
                            backgroundColor: `${setup.color}20`, 
                            color: setup.color,
                            border: `1px solid ${setup.color}40`
                          }}
                        >
                          {setup.icon} {setup.shortName}
                        </span>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Setup Description */}
                        <p className="text-xs text-foreground/90 leading-relaxed">
                          {setup.description}
                        </p>
                        
                        {/* How to Trade Section */}
                        {tradingGuidance && (
                          <div className="bg-muted/20 rounded-lg p-2.5 space-y-2">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              How to Trade
                            </div>
                            <p className="text-[11px] text-foreground/80 leading-relaxed">
                              {tradingGuidance.howToTrade}
                            </p>
                            <ul className="space-y-1 mt-2">
                              {tradingGuidance.keyPoints.map((point, idx) => (
                                <li key={idx} className="text-[10px] text-muted-foreground/80 flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Historical Financials is now available in the chart tabs above */}

            {/* Inline One Pager - Full width in left column */}
            <InlineOnePager assetId={parseInt(assetId)} symbol={asset.symbol} />
          </div>

          {/* Right Column: About, Fundamentals, Documents, Notes, Files (30% = 3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            {/* About Section - TOP - Enhanced */}
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
              <div className="p-4 space-y-3">
                {/* Market Cap & Enterprise Value - Prominent Display */}
                {asset.asset_type === 'equity' && (asset.enterprise_value || asset.market_cap) && (
                  <div className="grid grid-cols-2 gap-2">
                    {asset.market_cap && (
                      <div className="bg-muted/20 rounded-lg p-2.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide block mb-0.5">Market Cap</span>
                        <span className="text-lg font-mono font-bold text-foreground">
                          {asset.market_cap >= 1e12 ? `$${(asset.market_cap / 1e12).toFixed(2)}T` :
                           asset.market_cap >= 1e9 ? `$${(asset.market_cap / 1e9).toFixed(1)}B` :
                           asset.market_cap >= 1e6 ? `$${(asset.market_cap / 1e6).toFixed(0)}M` :
                           `$${asset.market_cap.toLocaleString()}`}
                        </span>
                      </div>
                    )}
                    {asset.enterprise_value && (
                      <div className="bg-muted/20 rounded-lg p-2.5">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wide block mb-0.5">Enterprise Value</span>
                        <span className="text-lg font-mono font-bold text-foreground">
                          {asset.enterprise_value >= 1e12 ? `$${(asset.enterprise_value / 1e12).toFixed(2)}T` :
                           asset.enterprise_value >= 1e9 ? `$${(asset.enterprise_value / 1e9).toFixed(1)}B` :
                           asset.enterprise_value >= 1e6 ? `$${(asset.enterprise_value / 1e6).toFixed(0)}M` :
                           `$${asset.enterprise_value.toLocaleString()}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sector & Industry Tags */}
                {(asset.sector || asset.industry) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {asset.sector && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {asset.sector}
                      </span>
                    )}
                    {asset.industry && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border">
                        {asset.industry}
                      </span>
                    )}
                  </div>
                )}

                {/* Category Badge (for crypto) */}
                {asset.category && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {asset.category}
                    </span>
                  </div>
                )}
                
                {/* Stock List Tags (Subsectors/Themes) */}
                {stock_lists && stock_lists.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {stock_lists.map((list: { id: number; name: string; color: string; icon: string }) => (
                      <span
                        key={list.id}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: `${list.color}15`,
                          borderColor: `${list.color}40`,
                          color: list.color
                        }}
                      >
                        {list.icon && <span className="mr-1">{list.icon}</span>}
                        {list.name}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Description */}
                {asset.short_description ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {asset.short_description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    No description available
                  </p>
                )}
              </div>
              )}
            </div>

            {/* Dynamic Sidebar based on active tab */}
            {chartView === 'financials' && asset.asset_type === 'equity' ? (
              <FundamentalsSidebar 
                assetId={assetId}
                asset={asset}
                review={review}
              />
            ) : (
              <TechnicalsSidebar 
                asset={asset}
                review={review}
                features={features}
              />
            )}

            {/* AI Documents Section */}
            <DocumentsSection 
              assetId={parseInt(assetId)} 
              symbol={asset.symbol} 
              companyName={asset.name}
              assetType={asset.asset_type}
            />

            {/* Notes History */}
            <NotesHistory assetId={parseInt(assetId)} />

            {/* Files Section - BOTTOM */}
            <FilesSection assetId={parseInt(assetId)} />
          </div>
        </div>
      </div>


    </>
  );
}

import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Activity, Info, ExternalLink, Tag, FileText, ChevronDown, ChevronUp, Maximize2, Minimize2, Camera } from "lucide-react";
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
  const { data, isLoading } = useSWR(`/api/dashboard/asset?asset_id=${assetId}`, fetcher);

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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
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
            
            {/* Research Chat button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <a 
                  href={`/chat?asset_id=${assetId}&symbol=${encodeURIComponent(asset?.symbol || '')}&name=${encodeURIComponent(asset?.name || '')}&asset_type=${asset?.asset_type || 'equity'}`}
                  className="p-2 rounded-full transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Activity className="w-5 h-5" />
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
              /* AI Summary for Technicals View */
              review?.summary_text && (
                <div className="bg-muted/10 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">AI Summary</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 font-mono">
                      {review.model_id || "gemini-3-pro-preview"}
                      {review.as_of_date && ` • ${review.as_of_date}`}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {review.summary_text}
                  </p>
                </div>
              )
            )}

            {/* Trade Plan & Signals - Only show in Technicals view */}
            {chartView !== 'financials' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Trade Plan */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Trade Plan</h3>
                    <InfoTooltip content="AI-generated trade plan with specific price levels. Entry zone is where to consider initiating positions. Targets are profit-taking levels. Invalidation is where the thesis fails." />
                  </div>
                  {review ? (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Entry</span>
                        <span className="font-mono text-sm font-semibold text-primary">
                          ${review.entry?.low?.toFixed(2) || "—"} - ${review.entry?.high?.toFixed(2) || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Targets</span>
                        <div className="flex gap-2">
                          {review.targets?.slice(0, 3).map((target: number, i: number) => (
                            <span key={i} className="font-mono text-xs text-signal-bullish">
                              ${target?.toFixed(2) || "—"}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Stop</span>
                        <span className="font-mono text-sm font-semibold text-signal-bearish">
                          ${review.invalidation?.toFixed(2) || "—"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">No trade plan available</p>
                    </div>
                  )}
                </div>

                {/* Signals */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold text-sm">Signals</h3>
                    <InfoTooltip content="Quantitative signals that triggered this asset's score. Each signal has a strength from 0-100 based on technical criteria." />
                  </div>
                  <div className="p-3 max-h-[120px] overflow-y-auto">
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
              </div>
            )}

            {/* Historical Financials is now available in the chart tabs above */}

            {/* Inline One Pager - Full width in left column */}
            <InlineOnePager assetId={parseInt(assetId)} symbol={asset.symbol} />
          </div>

          {/* Right Column: About, Fundamentals, Documents, Notes, Files (30% = 3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            {/* About Section - TOP */}
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
                {/* Category Badge */}
                {asset.category && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {asset.category}
                    </span>
                  </div>
                )}
                
                {/* Stock List Tags (Subsectors) */}
                {stock_lists && stock_lists.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
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

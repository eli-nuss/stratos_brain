import useSWR from "swr";
import { useState, useRef } from "react";
import { X, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Activity, Info, MessageCircle, ExternalLink, Tag, FileText, ChevronDown, ChevronUp, Maximize2, Minimize2, Camera } from "lucide-react";
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
import { ChatSidebar } from "./ChatSidebar";
import { NotesHistory } from "./NotesHistory";
import { FilesSection } from "./FilesSection";
import TradingViewWidget from "./TradingViewWidget";
import { FundamentalsSummary } from "./FundamentalsSummary";

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chartView, setChartView] = useState<'ai_score' | 'tradingview'>('ai_score');
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

  const { asset, ohlcv, ai_score_history, review, review_status } = data;

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


  // Generate TradingView URL for an asset
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
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{asset.symbol}</h2>
              <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {asset.name}
              </span>
            </div>
            <span className="font-mono text-sm text-muted-foreground">
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
            {/* Chat button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`p-2 rounded-full transition-colors ${
                    isChatOpen 
                      ? 'bg-emerald-600 text-white' 
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isChatOpen ? 'Close chat' : 'Chat with AI about this analysis'}
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
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-10 gap-4">
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
                      onClick={() => setChartView('ai_score')}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        chartView === 'ai_score'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      AI Score
                    </button>
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
              
              {chartView === 'ai_score' ? (
                <div ref={chartRef} className={`${isChartFullscreen ? 'h-[600px]' : 'h-[450px]'} w-full bg-muted/5 rounded-lg border border-border p-4 transition-all duration-300`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis 
                        yAxisId="price"
                        orientation="left"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                        tickFormatter={(value) => `$${value.toFixed(0)}`}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={{ stroke: 'var(--border)' }}
                        domain={['auto', 'auto']}
                      />
                      <YAxis 
                        yAxisId="score"
                        orientation="right"
                        domain={[-100, 100]}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={{ stroke: 'var(--border)' }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                        formatter={(value: any, name: string) => {
                          if (name === 'close') return [`$${Number(value).toFixed(2)}`, 'Price'];
                          if (name === 'ai_direction_score') return [value, 'AI Direction'];
                          return [value, name];
                        }}
                        labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={36}
                        formatter={(value) => {
                          if (value === 'close') return 'Price';
                          if (value === 'ai_direction_score') return 'AI Direction';
                          return value;
                        }}
                      />
                      <Area
                        yAxisId="price"
                        type="monotone"
                        dataKey="close"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fill="url(#colorPrice)"
                        dot={false}
                        name="close"
                      />
                      <Line
                        yAxisId="score"
                        type="monotone"
                        dataKey="ai_direction_score"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                        name="ai_direction_score"
                        connectNulls={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
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

            {/* AI Analysis */}
            {review ? (
              <div className="bg-muted/10 border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`font-semibold cursor-help ${signalColor}`}>
                          {isBullish ? "BULLISH" : "BEARISH"} {review.setup_type?.toUpperCase()}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <strong>Setup Type:</strong> {review.setup_type}
                        <br />
                        {review.setup_type === 'breakout' && "Price is breaking above key resistance with momentum."}
                        {review.setup_type === 'breakdown' && "Price is breaking below key support with momentum."}
                        {review.setup_type === 'reversal' && "Price is showing signs of trend reversal."}
                        {review.setup_type === 'pullback' && "Price is pulling back within an existing trend."}
                        {review.setup_type === 'mean_reversion' && "Price is extended and likely to revert to average."}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {review.model_id || "gemini-2.0-flash"}
                    {review.as_of_date && (
                      <span className="ml-2 text-muted-foreground/70">• {review.as_of_date}</span>
                    )}
                  </span>
                </div>
                
                {/* Confidence Meter */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <ConfidenceMeter confidence={review.confidence || 0} />
                </div>
                
                {/* Summary */}
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {review.summary_text}
                </p>
              </div>
            ) : (
              <div className="bg-muted/10 border border-border rounded-lg p-6 text-center">
                <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  AI analysis not available for this asset/date.
                </p>
              </div>
            )}

            {/* Trade Plan & Signals - 2 Column Layout (wider, shorter) */}
            <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Right Column: Fundamentals, About, Notes, Files (30% = 3 cols) */}
          <div className="lg:col-span-3 space-y-3 overflow-y-auto">
            {/* Fundamentals Summary - TOP */}
            <FundamentalsSummary asset={{...asset, close: ohlcv?.[0]?.close}} />

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

            {/* Notes History */}
            <NotesHistory assetId={parseInt(assetId)} />

            {/* Files Section - BOTTOM */}
            <FilesSection assetId={parseInt(assetId)} />
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      <ChatSidebar
        assetId={parseInt(assetId)}
        assetSymbol={asset.symbol}
        asOfDate={data.as_of_date}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </>
  );
}

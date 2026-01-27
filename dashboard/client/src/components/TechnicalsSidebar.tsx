import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Shield, 
  Activity,
  Zap,
  BarChart3,
  Gauge,
  Users,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp as TrendUp,
  Percent,
  Timer,
  Award,
  BarChart2,
  LineChart
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSetupDefinition, getPurityInterpretation } from "@/lib/setupDefinitions";

interface TechnicalsSidebarProps {
  asset: any;
  review: any;
  features?: any;
}

// Helper for info tooltips
function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

// Confidence meter component
function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  
  const getColor = () => {
    if (percentage >= 75) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-mono font-medium text-foreground">
        {percentage}%
      </span>
    </div>
  );
}

// RSI Gauge component - visual semicircle gauge
function RSIGauge({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return (
      <div className="text-center py-2">
        <span className="text-muted-foreground/50 text-xs">—</span>
      </div>
    );
  }

  const rsi = Math.round(value);
  const getZone = () => {
    if (rsi <= 30) return { label: 'Oversold', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    if (rsi >= 70) return { label: 'Overbought', color: 'text-red-400', bg: 'bg-red-500/20' };
    if (rsi >= 50) return { label: 'Bullish', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    return { label: 'Bearish', color: 'text-amber-400', bg: 'bg-amber-500/20' };
  };

  const zone = getZone();
  // Calculate rotation for the needle (0-100 maps to -90 to 90 degrees)
  const rotation = (rsi / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center">
      {/* Gauge visualization */}
      <div className="relative w-24 h-12 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0 rounded-t-full border-4 border-muted/30" 
             style={{ borderBottomWidth: 0 }} />
        {/* Colored zones */}
        <div className="absolute inset-0">
          <div className="absolute left-0 top-0 w-1/3 h-full rounded-tl-full bg-emerald-500/20" />
          <div className="absolute left-1/3 top-0 w-1/3 h-full bg-blue-500/10" />
          <div className="absolute right-0 top-0 w-1/3 h-full rounded-tr-full bg-red-500/20" />
        </div>
        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-0.5 h-10 bg-white origin-bottom transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 w-2 h-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-white" />
      </div>
      {/* Value and zone */}
      <div className="mt-1 text-center">
        <span className={`text-lg font-bold font-mono ${zone.color}`}>{rsi}</span>
        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${zone.bg} ${zone.color}`}>
          {zone.label}
        </span>
      </div>
    </div>
  );
}

// MACD Status indicator
function MACDStatus({ line, signal }: { line: number | null; signal: number | null }) {
  if (line === null || signal === null) {
    return <span className="text-muted-foreground/50">—</span>;
  }

  const histogram = line - signal;
  const isBullish = histogram > 0;
  const isStrong = Math.abs(histogram) > Math.abs(signal) * 0.5;

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 ${isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
        {isBullish ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span className="text-sm font-medium">{isBullish ? 'Bullish' : 'Bearish'}</span>
      </div>
      {isStrong && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isBullish ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          Strong
        </span>
      )}
    </div>
  );
}

// Price level pill component
function PricePill({ 
  label, 
  value, 
  type 
}: { 
  label: string; 
  value: number | null; 
  type: 'entry' | 'target' | 'stop' 
}) {
  if (!value) return null;
  
  const colors = {
    entry: 'bg-primary/20 text-primary border-primary/30',
    target: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    stop: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  return (
    <div className={`px-2 py-1 rounded border ${colors[type]} text-xs font-mono`}>
      <span className="text-muted-foreground mr-1">{label}</span>
      <span className="font-medium">${value.toFixed(2)}</span>
    </div>
  );
}

// Metric card for the grid - IMPROVED with huge numbers
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  tooltip,
  status = 'neutral',
  compact = false
}: { 
  icon: any; 
  label: string; 
  value: string | number | null; 
  tooltip: string;
  status?: 'bullish' | 'bearish' | 'neutral' | 'warning' | 'muted';
  compact?: boolean;
}) {
  const statusColors = {
    bullish: 'text-emerald-400',
    bearish: 'text-red-400',
    neutral: 'text-white',
    warning: 'text-amber-400',
    muted: 'text-muted-foreground/50'
  };

  const statusBg = {
    bullish: 'bg-emerald-500/10',
    bearish: 'bg-red-500/10',
    neutral: 'bg-muted/20',
    warning: 'bg-amber-500/10',
    muted: 'bg-muted/10'
  };

  const hasValue = value !== null && value !== '—';

  return (
    <div className={`${statusBg[hasValue ? status : 'muted']} rounded-lg ${compact ? 'p-2' : 'p-3'} border border-border/30`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider font-medium">{label}</span>
        </div>
        <InfoTooltip content={tooltip} />
      </div>
      <div className={`${compact ? 'text-lg' : 'text-xl'} font-mono font-bold ${statusColors[hasValue ? status : 'muted']}`}>
        {value ?? '—'}
      </div>
    </div>
  );
}

// Performance return pill
function ReturnPill({ 
  label, 
  value, 
  period 
}: { 
  label: string; 
  value: number | null; 
  period: string;
}) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-muted-foreground/50">—</span>
      </div>
    );
  }

  const pct = (value * 100).toFixed(2);
  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.001;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {!isNeutral && (
          isPositive ? 
            <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : 
            <ArrowDownRight className="w-3 h-3 text-red-400" />
        )}
        {isNeutral && <Minus className="w-3 h-3 text-muted-foreground" />}
        <span className={`text-xs font-mono font-medium ${
          isNeutral ? 'text-muted-foreground' :
          isPositive ? 'text-emerald-400' : 'text-red-400'
        }`}>
          {isPositive ? '+' : ''}{pct}%
        </span>
      </div>
    </div>
  );
}

// Setup Quality Card component
function SetupQualityCard({ 
  setupType, 
  purityScore, 
  profitFactor, 
  riskReward 
}: { 
  setupType: string | null; 
  purityScore: number | null;
  profitFactor: number | null;
  riskReward: number | null;
}) {
  const setup = getSetupDefinition(setupType);
  const purity = getPurityInterpretation(purityScore);

  if (!setupType && !purityScore) {
    return null;
  }

  return (
    <div className="bg-muted/5 rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Setup Quality</h3>
        </div>
        {setup && (
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
        )}
      </div>
      
      <div className="p-3 space-y-3">
        {/* Purity Score */}
        {purityScore !== null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                Purity Score
                <InfoTooltip content="How closely this setup matches the ideal pattern. 90+ is textbook, 80+ is strong, 70+ is solid, 60+ is moderate, below 60 is weak." />
              </span>
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: `${purity.color}20`, color: purity.color }}
              >
                {purity.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500 rounded-full"
                  style={{ 
                    width: `${purityScore}%`,
                    backgroundColor: purity.color
                  }}
                />
              </div>
              <span className="text-sm font-mono font-bold" style={{ color: purity.color }}>
                {purityScore}
              </span>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Historical Profit Factor */}
          <div className="bg-muted/20 rounded p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1">
              Profit Factor
              <InfoTooltip content="Historical profit factor from backtesting this setup. >1.5 is good, >2.0 is excellent. Measures gross profits / gross losses." />
            </div>
            <div className={`text-lg font-mono font-bold ${
              profitFactor && profitFactor >= 2 ? 'text-emerald-400' :
              profitFactor && profitFactor >= 1.5 ? 'text-blue-400' :
              profitFactor && profitFactor >= 1 ? 'text-amber-400' :
              'text-muted-foreground/50'
            }`}>
              {profitFactor ? profitFactor.toFixed(2) : '—'}
            </div>
          </div>

          {/* Risk/Reward */}
          <div className="bg-muted/20 rounded p-2">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5 flex items-center gap-1">
              Risk/Reward
              <InfoTooltip content="Potential reward relative to risk. 2:1 means you can make 2x what you risk. Higher is better but may have lower win rate." />
            </div>
            <div className={`text-lg font-mono font-bold ${
              riskReward && riskReward >= 3 ? 'text-emerald-400' :
              riskReward && riskReward >= 2 ? 'text-blue-400' :
              riskReward && riskReward >= 1.5 ? 'text-amber-400' :
              'text-muted-foreground/50'
            }`}>
              {riskReward ? `${riskReward.toFixed(1)}:1` : '—'}
            </div>
          </div>
        </div>

        {/* Setup Description */}
        {setup && (
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            {setup.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Support/Resistance level row
function LevelRow({ 
  price, 
  type, 
  strength,
  currentPrice
}: { 
  price: number; 
  type: 'support' | 'resistance'; 
  strength: 'strong' | 'moderate' | 'weak';
  currentPrice?: number;
}) {
  const strengthColors = {
    strong: 'bg-primary',
    moderate: 'bg-primary/60',
    weak: 'bg-primary/30'
  };

  // Calculate distance from current price
  const distance = currentPrice ? ((price - currentPrice) / currentPrice * 100) : null;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${strengthColors[strength]}`} />
        <span className="text-xs font-mono">${price.toFixed(2)}</span>
        {distance !== null && (
          <span className={`text-[10px] ${
            type === 'resistance' ? 'text-muted-foreground/60' : 'text-muted-foreground/60'
          }`}>
            ({distance > 0 ? '+' : ''}{distance.toFixed(1)}%)
          </span>
        )}
      </div>
      <span className={`text-[10px] uppercase font-medium ${
        type === 'resistance' ? 'text-red-400' : 'text-emerald-400'
      }`}>
        {type}
      </span>
    </div>
  );
}

export function TechnicalsSidebar({ asset, review, features }: TechnicalsSidebarProps) {
  const [levelsExpanded, setLevelsExpanded] = useState(true);
  const [technicalExpanded, setTechnicalExpanded] = useState(true);
  const [performanceExpanded, setPerformanceExpanded] = useState(true);
  
  const hasReview = review && review.direction;
  const isBullish = review?.direction === 'bullish';
  const signalColor = isBullish ? 'text-emerald-400' : 'text-red-400';
  const signalBg = hasReview 
    ? (isBullish ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30')
    : 'bg-muted/10 border-border';

  // Extract trade plan from review
  const tradePlan = review?.trade_plan || {};
  const entryZone = tradePlan.entry_zone;
  const targets = tradePlan.targets || [];
  const stopLoss = tradePlan.stop_loss;
  
  // Check if we have a complete trade plan
  const hasTradePlan = entryZone || targets.length > 0 || stopLoss;

  // Technical metrics from daily_features
  const technicalMetrics = {
    rvol: features?.rvol_20 ?? null,
    atr: features?.atr_14 ? parseFloat(features.atr_14) : null,
    rsi: features?.rsi_14 ? parseFloat(features.rsi_14) : null,
    macdLine: features?.macd_line ? parseFloat(features.macd_line) : null,
    macdSignal: features?.macd_signal ? parseFloat(features.macd_signal) : null,
    bbWidthPctile: features?.bb_width_pctile ? parseFloat(features.bb_width_pctile) : null,
    squeezeFlag: features?.squeeze_flag ?? null,
    rsVsBenchmark: features?.rs_vs_benchmark ? parseFloat(features.rs_vs_benchmark) : null,
    rsRoc20: features?.rs_roc_20 ? parseFloat(features.rs_roc_20) : null,
    attentionScore: features?.attention_score ? parseFloat(features.attention_score) : null,
    return1d: features?.return_1d ? parseFloat(features.return_1d) : null,
    return5d: features?.return_5d ? parseFloat(features.return_5d) : null,
    return21d: features?.return_21d ? parseFloat(features.return_21d) : null,
    sma20: features?.sma_20 ? parseFloat(features.sma_20) : null,
    sma50: features?.sma_50 ? parseFloat(features.sma_50) : null,
    sma200: features?.sma_200 ? parseFloat(features.sma_200) : null,
  };

  // Setup data from review
  const setupData = {
    setupType: review?.setup_type || asset?.primary_setup || null,
    purityScore: asset?.setup_purity_score ?? review?.ai_setup_quality_score ?? null,
    profitFactor: asset?.historical_profit_factor ?? null,
    riskReward: review?.risk_reward ?? null,
  };

  // Determine status based on values
  const getRvolStatus = (val: number | null) => {
    if (!val) return 'muted';
    if (val >= 2) return 'bullish';
    if (val >= 1.5) return 'neutral';
    if (val < 0.8) return 'bearish';
    return 'neutral';
  };

  const getRsStatus = (val: number | null) => {
    if (!val) return 'muted';
    if (val > 0.1) return 'bullish';
    if (val < -0.1) return 'bearish';
    return 'neutral';
  };

  // Current price
  const currentPrice = asset?.close ? parseFloat(asset.close) : null;

  // Support/resistance levels from 52W high/low and MAs
  const levels = [];
  
  if (asset.week_52_high) {
    levels.push({ 
      price: parseFloat(asset.week_52_high), 
      type: 'resistance' as const, 
      strength: 'strong' as const 
    });
  }
  
  if (technicalMetrics.sma200 && currentPrice && technicalMetrics.sma200 > currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma200, 
      type: 'resistance' as const, 
      strength: 'moderate' as const 
    });
  }
  
  if (technicalMetrics.sma50 && currentPrice && technicalMetrics.sma50 > currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma50, 
      type: 'resistance' as const, 
      strength: 'weak' as const 
    });
  }
  
  if (technicalMetrics.sma50 && currentPrice && technicalMetrics.sma50 < currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma50, 
      type: 'support' as const, 
      strength: 'weak' as const 
    });
  }
  
  if (technicalMetrics.sma200 && currentPrice && technicalMetrics.sma200 < currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma200, 
      type: 'support' as const, 
      strength: 'moderate' as const 
    });
  }
  
  if (asset.week_52_low) {
    levels.push({ 
      price: parseFloat(asset.week_52_low), 
      type: 'support' as const, 
      strength: 'strong' as const 
    });
  }

  // Sort levels by price descending
  levels.sort((a, b) => b.price - a.price);

  return (
    <div className="space-y-4">
      {/* Module A: AI Trade Card */}
      <div className={`rounded-lg border ${signalBg} p-4`}>
        {hasReview ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isBullish ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-bold text-lg ${signalColor}`}>
                  {isBullish ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
              {review?.setup_type && (
                <span className="text-xs bg-muted/50 px-2 py-0.5 rounded text-muted-foreground uppercase">
                  {review.setup_type.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {/* Confidence */}
            {review?.confidence !== undefined && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <InfoTooltip content="AI confidence in this trade setup based on technical and fundamental factors." />
                </div>
                <ConfidenceMeter confidence={review.confidence} />
              </div>
            )}

            {/* Trade Plan Pills */}
            {hasTradePlan ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Trade Plan
                </div>
                
                {/* Entry Zone */}
                {entryZone && (
                  <div className="flex flex-wrap gap-1.5">
                    <PricePill 
                      label="Entry" 
                      value={typeof entryZone === 'object' ? entryZone.low : entryZone} 
                      type="entry" 
                    />
                    {typeof entryZone === 'object' && entryZone.high && (
                      <PricePill 
                        label="to" 
                        value={entryZone.high} 
                        type="entry" 
                      />
                    )}
                  </div>
                )}

                {/* Targets */}
                {targets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {targets.slice(0, 3).map((target: any, idx: number) => (
                      <PricePill 
                        key={idx}
                        label={`T${idx + 1}`} 
                        value={typeof target === 'object' ? target.price : target} 
                        type="target" 
                      />
                    ))}
                  </div>
                )}

                {/* Stop Loss */}
                {stopLoss && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-red-400" />
                    <PricePill 
                      label="Stop" 
                      value={typeof stopLoss === 'object' ? stopLoss.price : stopLoss} 
                      type="stop" 
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70 py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Generating trade levels...</span>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/70">No AI analysis available</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Run analysis to generate signals</p>
          </div>
        )}
      </div>

      {/* Module B: Setup Quality */}
      <SetupQualityCard 
        setupType={setupData.setupType}
        purityScore={setupData.purityScore}
        profitFactor={setupData.profitFactor}
        riskReward={setupData.riskReward}
      />

      {/* Module C: Technical Indicators */}
      <div className="bg-muted/5 rounded-lg border border-border overflow-hidden">
        <button 
          onClick={() => setTechnicalExpanded(!technicalExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Technical Indicators</h3>
          </div>
          {technicalExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {technicalExpanded && (
          <div className="px-3 pb-3 space-y-3">
            {/* RSI Gauge */}
            <div className="bg-muted/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">RSI (14)</span>
                <InfoTooltip content="Relative Strength Index measures momentum. Below 30 is oversold (potential bounce), above 70 is overbought (potential pullback)." />
              </div>
              <RSIGauge value={technicalMetrics.rsi} />
            </div>

            {/* MACD Status */}
            <div className="bg-muted/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">MACD</span>
                <InfoTooltip content="Moving Average Convergence Divergence. Bullish when MACD line is above signal line, bearish when below." />
              </div>
              <MACDStatus line={technicalMetrics.macdLine} signal={technicalMetrics.macdSignal} />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard 
                icon={Zap}
                label="RVOL"
                value={technicalMetrics.rvol ? `${technicalMetrics.rvol.toFixed(1)}x` : null}
                tooltip="Relative Volume: Today's volume vs 20-day average. >2x indicates significant interest."
                status={getRvolStatus(technicalMetrics.rvol)}
                compact
              />
              <MetricCard 
                icon={Gauge}
                label="ATR"
                value={technicalMetrics.atr ? `$${technicalMetrics.atr.toFixed(2)}` : null}
                tooltip="Average True Range (14-day): Measures volatility. Use for position sizing and stop placement."
                status="neutral"
                compact
              />
              <MetricCard 
                icon={TrendUp}
                label="RS vs SPY"
                value={technicalMetrics.rsVsBenchmark ? `${(technicalMetrics.rsVsBenchmark * 100).toFixed(1)}%` : null}
                tooltip="Relative Strength vs benchmark. Positive means outperforming the market."
                status={getRsStatus(technicalMetrics.rsVsBenchmark)}
                compact
              />
              <MetricCard 
                icon={BarChart2}
                label="BB Width"
                value={technicalMetrics.bbWidthPctile ? `${technicalMetrics.bbWidthPctile.toFixed(0)}%` : null}
                tooltip="Bollinger Band Width Percentile. Low values indicate squeeze (potential breakout), high values indicate extended move."
                status={technicalMetrics.squeezeFlag ? 'warning' : 'neutral'}
                compact
              />
            </div>

            {/* Squeeze Alert */}
            {technicalMetrics.squeezeFlag && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Volatility Squeeze Active</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Module D: Performance */}
      <div className="bg-muted/5 rounded-lg border border-border overflow-hidden">
        <button 
          onClick={() => setPerformanceExpanded(!performanceExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Performance</h3>
          </div>
          {performanceExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {performanceExpanded && (
          <div className="px-3 pb-3">
            <ReturnPill label="1 Day" value={technicalMetrics.return1d} period="1d" />
            <ReturnPill label="5 Days" value={technicalMetrics.return5d} period="5d" />
            <ReturnPill label="21 Days" value={technicalMetrics.return21d} period="21d" />
            
            {/* Distance from 52W */}
            {asset.week_52_high && currentPrice && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>From 52W High</span>
                  <span className={`font-mono ${
                    ((currentPrice - parseFloat(asset.week_52_high)) / parseFloat(asset.week_52_high) * 100) > -10 
                      ? 'text-emerald-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {((currentPrice - parseFloat(asset.week_52_high)) / parseFloat(asset.week_52_high) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>From 52W Low</span>
                  <span className="font-mono text-emerald-400">
                    +{((currentPrice - parseFloat(asset.week_52_low)) / parseFloat(asset.week_52_low) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Module E: Key Levels */}
      <div className="bg-muted/5 rounded-lg border border-border overflow-hidden">
        <button 
          onClick={() => setLevelsExpanded(!levelsExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Key Levels</h3>
          </div>
          {levelsExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {levelsExpanded && (
          <div className="px-3 pb-3">
            {/* Current Price */}
            {currentPrice && (
              <div className="flex items-center justify-between py-2 mb-2 border-b border-primary/30 bg-primary/5 -mx-3 px-3">
                <span className="text-xs font-medium text-primary">Current Price</span>
                <span className="text-sm font-mono font-bold text-primary">${currentPrice.toFixed(2)}</span>
              </div>
            )}
            
            {levels.length > 0 ? (
              <div className="space-y-0">
                {levels.map((level, idx) => (
                  <LevelRow 
                    key={idx}
                    price={level.price}
                    type={level.type}
                    strength={level.strength}
                    currentPrice={currentPrice ?? undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic py-2 text-center">
                No levels detected
              </div>
            )}
            
            {/* MA Distances */}
            {(technicalMetrics.sma20 || technicalMetrics.sma50 || technicalMetrics.sma200) && currentPrice && (
              <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-2">Distance from MAs</div>
                {technicalMetrics.sma20 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">20 SMA</span>
                    <span className={`font-mono ${currentPrice > technicalMetrics.sma20 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {((currentPrice - technicalMetrics.sma20) / technicalMetrics.sma20 * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {technicalMetrics.sma50 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">50 SMA</span>
                    <span className={`font-mono ${currentPrice > technicalMetrics.sma50 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {((currentPrice - technicalMetrics.sma50) / technicalMetrics.sma50 * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {technicalMetrics.sma200 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">200 SMA</span>
                    <span className={`font-mono ${currentPrice > technicalMetrics.sma200 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {((currentPrice - technicalMetrics.sma200) / technicalMetrics.sma200 * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TechnicalsSidebar;

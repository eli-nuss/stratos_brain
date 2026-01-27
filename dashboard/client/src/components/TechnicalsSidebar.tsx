import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Shield, 
  Activity,
  Zap,
  Gauge,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp as TrendUp,
  Percent,
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
import { TradePlanVisual } from "./TradePlanVisual";

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

// RSI Gauge component - visual semicircle gauge with colored border segments
function RSIGauge({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return (
      <div className="text-center py-4">
        <span className="text-muted-foreground/50 text-sm">—</span>
      </div>
    );
  }

  const rsi = Math.round(value);
  
  // Get zone info based on RSI value
  const getZone = () => {
    if (rsi < 30) return { label: 'Oversold', color: '#ef4444', textColor: 'text-red-400' };
    if (rsi < 50) return { label: 'Bearish', color: '#f97316', textColor: 'text-orange-400' };
    if (rsi < 70) return { label: 'Bullish', color: '#22c55e', textColor: 'text-emerald-400' };
    return { label: 'Overbought', color: '#ef4444', textColor: 'text-red-400' };
  };

  const zone = getZone();
  const rotation = (rsi / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center">
      {/* Semicircle gauge */}
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Colored arc border - using CSS border trick for semicircle */}
        <div 
          className="absolute w-32 h-32 rounded-full border-8"
          style={{ 
            borderTopColor: '#ef4444',      // Red (overbought)
            borderRightColor: '#22c55e',    // Green (bullish)
            borderBottomColor: 'transparent',
            borderLeftColor: '#f97316',     // Orange (bearish)
            transform: 'rotate(-90deg)'
          }} 
        />
        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-12 bg-white origin-bottom rounded-full transition-transform duration-500"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-white rounded-full -translate-x-1/2" />
      </div>
      {/* Value and label */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-2xl font-bold text-white font-mono">{rsi}</span>
        <span 
          className="text-sm px-2 py-0.5 rounded text-white font-medium"
          style={{ backgroundColor: zone.color }}
        >
          {zone.label}
        </span>
      </div>
    </div>
  );
}

// MACD Status indicator
function MACDStatus({ line, signal }: { line: number | null; signal: number | null }) {
  if (line === null || signal === null) {
    return <span className="text-muted-foreground/50 text-xs">—</span>;
  }

  const isBullish = line > signal;
  const histogram = line - signal;
  const isStrong = Math.abs(histogram) > 0.5;

  return (
    <div className="flex items-center gap-2">
      {isBullish ? (
        <TrendingUp className="w-4 h-4 text-emerald-400" />
      ) : (
        <TrendingDown className="w-4 h-4 text-red-400" />
      )}
      <span className={`text-sm font-medium ${isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
        {isBullish ? 'Bullish' : 'Bearish'}
      </span>
      {isStrong && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          isBullish ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        }`}>
          Strong
        </span>
      )}
    </div>
  );
}

// Metric card component with optional date annotation for stale data
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  tooltip,
  status = 'neutral',
  compact = false,
  asOfDate
}: { 
  icon: any; 
  label: string; 
  value: string | null;
  tooltip: string;
  status?: 'bullish' | 'bearish' | 'neutral' | 'muted' | 'low' | 'high' | 'warning';
  compact?: boolean;
  asOfDate?: string | null;
}) {
  const statusColors = {
    bullish: 'text-emerald-400',
    bearish: 'text-red-400',
    neutral: 'text-foreground',
    muted: 'text-muted-foreground/50',
    low: 'text-amber-400',
    high: 'text-emerald-400',
    warning: 'text-amber-400'
  };

  // Format date as short form (e.g., "Jan 23")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={`bg-muted/10 rounded-lg ${compact ? 'p-2' : 'p-3'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <InfoTooltip content={tooltip} />
      </div>
      <div className={`${compact ? 'text-sm' : 'text-lg'} font-mono font-bold ${statusColors[status]}`}>
        {value || '—'}
      </div>
      {asOfDate && (
        <div className="text-[9px] text-muted-foreground/60 mt-0.5">
          as of {formatDate(asOfDate)}
        </div>
      )}
    </div>
  );
}

// Return pill component
function ReturnPill({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  
  const pct = (value * 100).toFixed(2);
  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.001;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
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

  const distance = currentPrice ? ((price - currentPrice) / currentPrice * 100) : null;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${strengthColors[strength]}`} />
        <span className="text-xs font-mono">${price.toFixed(2)}</span>
        {distance !== null && (
          <span className="text-[10px] text-muted-foreground/60">
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

  // Extract trade plan from review
  const tradePlan = review?.trade_plan || {};
  const entryZone = tradePlan.entry_zone;
  const targets = tradePlan.targets || [];
  const stopLoss = tradePlan.stop_loss;

  // Technical metrics from daily_features
  const technicalMetrics = {
    rvol: features?.rvol_20 ?? null,
    atr: features?.atr_pct ? parseFloat(features.atr_pct) : null,
    rsi: features?.rsi_14 ? parseFloat(features.rsi_14) : null,
    macdLine: features?.macd_line ? parseFloat(features.macd_line) : null,
    macdSignal: features?.macd_signal ? parseFloat(features.macd_signal) : null,
    bbWidthPctile: features?.bb_width_pctile ? parseFloat(features.bb_width_pctile) : null,
    bbWidthPctileDate: features?.bb_width_pctile_date ?? null,
    squeezeFlag: features?.squeeze_flag ?? null,
    rsVsBenchmark: features?.rs_vs_benchmark ? parseFloat(features.rs_vs_benchmark) : null,
    rsVsBenchmarkDate: features?.rs_vs_benchmark_date ?? null,
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

  // RVOL status - FIXED: Now uses Low/Normal/High instead of Bullish/Bearish
  const getRvolStatus = (val: number | null): 'low' | 'neutral' | 'high' | 'muted' => {
    if (!val) return 'muted';
    if (val < 0.8) return 'low';
    if (val >= 1.5) return 'high';
    return 'neutral';
  };

  const getRvolLabel = (val: number | null): string => {
    if (!val) return '—';
    if (val < 0.8) return `${val.toFixed(1)}x (Low)`;
    if (val >= 1.5) return `${val.toFixed(1)}x (High)`;
    return `${val.toFixed(1)}x`;
  };

  const getRsStatus = (val: number | null): 'bullish' | 'bearish' | 'neutral' | 'muted' => {
    if (!val) return 'muted';
    if (val > 0.1) return 'bullish';
    if (val < -0.1) return 'bearish';
    return 'neutral';
  };

  // Current price
  const currentPrice = asset?.close ? parseFloat(asset.close) : null;

  // Support/resistance levels from 52W high/low and MAs
  const levels: { price: number; type: 'support' | 'resistance'; strength: 'strong' | 'moderate' | 'weak' }[] = [];
  
  if (asset.week_52_high) {
    levels.push({ 
      price: parseFloat(asset.week_52_high), 
      type: 'resistance', 
      strength: 'strong' 
    });
  }
  
  if (technicalMetrics.sma200 && currentPrice && technicalMetrics.sma200 > currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma200, 
      type: 'resistance', 
      strength: 'moderate' 
    });
  }
  
  if (technicalMetrics.sma50 && currentPrice && technicalMetrics.sma50 > currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma50, 
      type: 'resistance', 
      strength: 'weak' 
    });
  }
  
  if (technicalMetrics.sma50 && currentPrice && technicalMetrics.sma50 < currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma50, 
      type: 'support', 
      strength: 'weak' 
    });
  }
  
  if (technicalMetrics.sma200 && currentPrice && technicalMetrics.sma200 < currentPrice) {
    levels.push({ 
      price: technicalMetrics.sma200, 
      type: 'support', 
      strength: 'moderate' 
    });
  }
  
  if (asset.week_52_low) {
    levels.push({ 
      price: parseFloat(asset.week_52_low), 
      type: 'support', 
      strength: 'strong' 
    });
  }

  // Sort levels by price descending
  levels.sort((a, b) => b.price - a.price);

  // Extract trade plan values for TradePlanVisual
  const entryLow = typeof entryZone === 'object' ? entryZone?.low : entryZone;
  const entryHigh = typeof entryZone === 'object' ? entryZone?.high : null;
  const target1 = targets[0] ? (typeof targets[0] === 'object' ? targets[0].price : targets[0]) : null;
  const target2 = targets[1] ? (typeof targets[1] === 'object' ? targets[1].price : targets[1]) : null;
  const stopLossValue = typeof stopLoss === 'object' ? stopLoss?.price : stopLoss;

  return (
    <div className="space-y-4">
      {/* Module A: Setup Quality (moved to top - most actionable) */}
      <SetupQualityCard 
        setupType={setupData.setupType}
        purityScore={setupData.purityScore}
        profitFactor={setupData.profitFactor}
        riskReward={setupData.riskReward}
      />

      {/* Module B: Trade Plan Visual (condensed visualization) */}
      <TradePlanVisual
        entryLow={entryLow}
        entryHigh={entryHigh}
        target1={target1}
        target2={target2}
        stopLoss={stopLossValue}
        currentPrice={currentPrice}
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

            {/* Metrics Grid - FIXED: RVOL now shows Low/Normal/High */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard 
                icon={Zap}
                label="RVOL"
                value={getRvolLabel(technicalMetrics.rvol)}
                tooltip="Relative Volume: Today's volume vs 20-day average. >1.5x indicates significant interest, <0.8x is low activity."
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
                asOfDate={technicalMetrics.rsVsBenchmarkDate}
              />
              <MetricCard 
                icon={BarChart2}
                label="BB Width"
                value={technicalMetrics.bbWidthPctile ? `${technicalMetrics.bbWidthPctile.toFixed(0)}%` : null}
                tooltip="Bollinger Band Width Percentile. Low values indicate squeeze (potential breakout), high values indicate extended move."
                status={technicalMetrics.squeezeFlag ? 'warning' : 'neutral'}
                compact
                asOfDate={technicalMetrics.bbWidthPctileDate}
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
            <ReturnPill label="1 Day" value={technicalMetrics.return1d} />
            <ReturnPill label="5 Days" value={technicalMetrics.return5d} />
            <ReturnPill label="21 Days" value={technicalMetrics.return21d} />
            
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
            {currentPrice && (technicalMetrics.sma20 || technicalMetrics.sma50 || technicalMetrics.sma200) && (
              <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Distance from MAs</div>
                {technicalMetrics.sma20 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">20 SMA</span>
                    <span className={`font-mono ${
                      currentPrice > technicalMetrics.sma20 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {((currentPrice - technicalMetrics.sma20) / technicalMetrics.sma20 * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {technicalMetrics.sma50 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">50 SMA</span>
                    <span className={`font-mono ${
                      currentPrice > technicalMetrics.sma50 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {((currentPrice - technicalMetrics.sma50) / technicalMetrics.sma50 * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
                {technicalMetrics.sma200 && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">200 SMA</span>
                    <span className={`font-mono ${
                      currentPrice > technicalMetrics.sma200 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
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

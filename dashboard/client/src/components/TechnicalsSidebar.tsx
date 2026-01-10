import { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Shield, 
  AlertTriangle, 
  Activity,
  Zap,
  BarChart3,
  Gauge,
  Users,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TechnicalsSidebarProps {
  asset: any;
  review: any;
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

// Metric card for the grid
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  tooltip,
  status = 'neutral'
}: { 
  icon: any; 
  label: string; 
  value: string | number | null; 
  tooltip: string;
  status?: 'bullish' | 'bearish' | 'neutral' | 'warning';
}) {
  const statusColors = {
    bullish: 'text-emerald-400',
    bearish: 'text-red-400',
    neutral: 'text-foreground',
    warning: 'text-amber-400'
  };

  const statusBg = {
    bullish: 'bg-emerald-500/10',
    bearish: 'bg-red-500/10',
    neutral: 'bg-muted/30',
    warning: 'bg-amber-500/10'
  };

  return (
    <div className={`${statusBg[status]} rounded-lg p-2.5 border border-border/50`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        </div>
        <InfoTooltip content={tooltip} />
      </div>
      <div className={`text-sm font-mono font-semibold ${statusColors[status]}`}>
        {value ?? '—'}
      </div>
    </div>
  );
}

// Support/Resistance level row
function LevelRow({ 
  price, 
  type, 
  strength 
}: { 
  price: number; 
  type: 'support' | 'resistance'; 
  strength: 'strong' | 'moderate' | 'weak';
}) {
  const strengthColors = {
    strong: 'bg-primary',
    moderate: 'bg-primary/60',
    weak: 'bg-primary/30'
  };

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${strengthColors[strength]}`} />
        <span className="text-xs font-mono">${price.toFixed(2)}</span>
      </div>
      <span className={`text-[10px] uppercase ${
        type === 'resistance' ? 'text-red-400' : 'text-emerald-400'
      }`}>
        {type}
      </span>
    </div>
  );
}

export function TechnicalsSidebar({ asset, review }: TechnicalsSidebarProps) {
  const [levelsExpanded, setLevelsExpanded] = useState(true);
  
  const isBullish = review?.direction === 'bullish';
  const signalColor = isBullish ? 'text-emerald-400' : 'text-red-400';
  const signalBg = isBullish ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30';

  // Extract trade plan from review
  const tradePlan = review?.trade_plan || {};
  const entryZone = tradePlan.entry_zone;
  const targets = tradePlan.targets || [];
  const stopLoss = tradePlan.stop_loss;

  // Mock technical metrics (to be populated with real data later)
  const technicalMetrics = {
    rvol: null, // Relative Volume
    floatRotation: null, // Float Rotation %
    atr: null, // Average True Range
    shortFloat: null, // Short Interest %
  };

  // Mock support/resistance levels (to be derived by AI later)
  const levels = [
    { price: asset.week_52_high ? parseFloat(asset.week_52_high) : 0, type: 'resistance' as const, strength: 'strong' as const },
    { price: asset.week_52_low ? parseFloat(asset.week_52_low) : 0, type: 'support' as const, strength: 'strong' as const },
  ].filter(l => l.price > 0);

  return (
    <div className="space-y-4">
      {/* Module A: AI Trade Card */}
      <div className={`rounded-lg border ${signalBg} p-4`}>
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
              {review.setup_type}
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

          {/* No trade plan available */}
          {!entryZone && targets.length === 0 && !stopLoss && (
            <div className="text-xs text-muted-foreground italic py-2">
              No trade plan available. Run AI analysis to generate.
            </div>
          )}
        </div>
      </div>

      {/* Module B: Under the Hood Grid */}
      <div className="bg-muted/5 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Under the Hood</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <MetricCard 
            icon={Zap}
            label="RVOL"
            value={technicalMetrics.rvol ? `${technicalMetrics.rvol}x` : '—'}
            tooltip="Relative Volume: Today's volume compared to average. >2x is significant momentum."
            status={technicalMetrics.rvol && technicalMetrics.rvol > 2 ? 'bullish' : 'neutral'}
          />
          <MetricCard 
            icon={BarChart3}
            label="Float Rot"
            value={technicalMetrics.floatRotation ? `${technicalMetrics.floatRotation}%` : '—'}
            tooltip="Float Rotation: % of tradeable shares that have changed hands today. High = momentum."
            status="neutral"
          />
          <MetricCard 
            icon={Gauge}
            label="ATR"
            value={technicalMetrics.atr ? `$${technicalMetrics.atr.toFixed(2)}` : '—'}
            tooltip="Average True Range: Measures volatility. Use for stop-loss sizing."
            status="neutral"
          />
          <MetricCard 
            icon={Users}
            label="Short %"
            value={technicalMetrics.shortFloat ? `${technicalMetrics.shortFloat}%` : '—'}
            tooltip="Short Interest as % of Float. >20% = potential squeeze candidate."
            status={technicalMetrics.shortFloat && technicalMetrics.shortFloat > 20 ? 'warning' : 'neutral'}
          />
        </div>

        <div className="mt-2 text-[10px] text-muted-foreground/70 text-center">
          Technical metrics coming soon
        </div>
      </div>

      {/* Module C: Automated Levels */}
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
            {levels.length > 0 ? (
              <div className="space-y-0">
                {levels.map((level, idx) => (
                  <LevelRow 
                    key={idx}
                    price={level.price}
                    type={level.type}
                    strength={level.strength}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic py-2 text-center">
                No levels detected
              </div>
            )}
            
            <div className="mt-2 pt-2 border-t border-border/30">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>52W High</span>
                <span className="font-mono">
                  {asset.week_52_high ? `$${parseFloat(asset.week_52_high).toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                <span>52W Low</span>
                <span className="font-mono">
                  {asset.week_52_low ? `$${parseFloat(asset.week_52_low).toFixed(2)}` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TechnicalsSidebar;

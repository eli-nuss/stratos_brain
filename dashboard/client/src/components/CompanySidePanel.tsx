import { useState, useEffect } from 'react';
import { 
  Activity, BarChart3, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Target, Shield, AlertTriangle, Zap, CheckCircle2,
  ChevronDown, ChevronUp, Clock, Sparkles, Crosshair
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============ TYPES ============

interface FundamentalsData {
  market_cap?: number;
  revenue_ttm?: number;
  quarterly_revenue_growth_yoy?: number;
  eps?: number;
  pe_ratio?: number;
  profit_margin?: number;
  operating_margin_ttm?: number;
  current_price?: number;
  name?: string;
  symbol?: string;
  sector?: string;
}

interface QuantSetup {
  setup_name: string;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  risk_reward: number;
  historical_profit_factor: number;
}

interface AIReviewData {
  as_of_date: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  ai_direction_score: number;
  ai_confidence: number;
  ai_summary_text: string;
  ai_key_levels: {
    support: number[];
    resistance: number[];
    invalidation: number;
  };
  ai_entry: {
    low: number;
    high: number;
  };
  ai_targets: number[];
  ai_risks: string[];
  ai_why_now: string[];
  primary_setup: string | null;
  setup_purity_score: number | null;
  historical_profit_factor: number | null;
  active_quant_setups: QuantSetup[] | null;
  quant_entry_price: number | null;
  quant_stop_loss: number | null;
  quant_target_price: number | null;
  ai_adjusted_entry: number | null;
  ai_adjusted_stop: number | null;
  ai_adjusted_target: number | null;
  model: string;
  prompt_version: string;
}

interface MomentumData {
  asset_id: number;
  date: string;
  rsi: number | null;
  atr_pct: number | null;
  realized_vol: number | null;
  rvol: number | null;
}

interface CompanySidePanelProps {
  assetId: number | string;
  assetType: 'equity' | 'crypto';
  className?: string;
}

// ============ HELPERS ============

function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  if (Math.abs(value) >= 1e12) return (value / 1e12).toFixed(2) + 'T';
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const pct = value * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return '$' + value.toFixed(2);
}

function formatSetupName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ============ TECHNICALS COMPONENTS ============

function SetupBadge({ setup, purity }: { setup: string; purity: number }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2",
        "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
      )}>
        <Crosshair className="w-4 h-4" />
        <span>{formatSetupName(setup)}</span>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
        <span className="text-[10px] text-muted-foreground uppercase">Purity</span>
        <span className={cn(
          "text-sm font-bold",
          purity >= 85 ? "text-emerald-400" : purity >= 70 ? "text-yellow-400" : "text-orange-400"
        )}>
          {purity}%
        </span>
      </div>
    </div>
  );
}

function DirectionCard({ direction, score, profitFactor }: { direction: string; score: number; profitFactor?: number | null }) {
  const isBullish = direction === 'bullish' || score > 0;
  const isBearish = direction === 'bearish' || score < 0;
  
  return (
    <div className="flex items-center gap-3 mt-4">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg flex-1",
        isBullish && "bg-emerald-500/10 border border-emerald-500/30",
        isBearish && "bg-red-500/10 border border-red-500/30",
        !isBullish && !isBearish && "bg-muted border border-border"
      )}>
        {isBullish ? (
          <ArrowUpRight className="w-5 h-5 text-emerald-400" />
        ) : isBearish ? (
          <ArrowDownRight className="w-5 h-5 text-red-400" />
        ) : (
          <Activity className="w-5 h-5 text-muted-foreground" />
        )}
        <div className="flex flex-col">
          <span className={cn(
            "text-xs font-bold uppercase",
            isBullish ? "text-emerald-400" : isBearish ? "text-red-400" : "text-muted-foreground"
          )}>
            {direction}
          </span>
          <span className={cn(
            "text-lg font-mono font-bold",
            score > 0 ? "text-emerald-400" : score < 0 ? "text-red-400" : "text-muted-foreground"
          )}>
            {score > 0 ? '+' : ''}{score}
          </span>
        </div>
      </div>
      
      {profitFactor && profitFactor > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg cursor-help">
              <span className="text-[10px] text-muted-foreground">PF</span>
              <span className="text-lg font-bold text-emerald-400">
                {profitFactor.toFixed(2)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Historical Profit Factor from backtested setup</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

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
  entry: { low: number; high: number }; 
  targets: number[]; 
  stop: number;
  quantEntry?: number | null;
  quantStop?: number | null;
  quantTarget?: number | null;
  aiAdjustedEntry?: number | null;
  aiAdjustedStop?: number | null;
  aiAdjustedTarget?: number | null;
}) {
  const displayEntry = aiAdjustedEntry || quantEntry || entry.low;
  const displayStop = aiAdjustedStop || quantStop || stop;
  const displayTarget = aiAdjustedTarget || quantTarget || targets[targets.length - 1];
  
  const risk = displayEntry - displayStop;
  const reward = displayTarget - displayEntry;
  const riskReward = risk > 0 ? (reward / risk).toFixed(2) : '—';
  
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Target className="w-3.5 h-3.5" />
          Trade Plan
        </h3>
        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded">
          <span className="text-[10px] text-muted-foreground">R:R</span>
          <span className="text-xs font-bold text-blue-400">{riskReward}</span>
        </div>
      </div>
      
      <div className="relative bg-muted/50 rounded-xl p-4 border border-border">
        {/* Target */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Target</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-mono font-bold text-blue-400">{formatPrice(displayTarget)}</span>
              {targets.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  ({targets.map(t => formatPrice(t)).join(' → ')})
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Connector line */}
        <div className="absolute left-8 top-16 bottom-16 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-red-500" />
        
        {/* Entry */}
        <div className="flex items-center gap-3 my-4 pl-4">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 border-2 border-purple-500 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Entry</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-mono font-bold text-purple-400">{formatPrice(displayEntry)}</span>
              {entry.low !== entry.high && (
                <span className="text-xs text-muted-foreground">
                  ({formatPrice(entry.low)} - {formatPrice(entry.high)})
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Stop */}
        <div className="flex items-center gap-3 mt-4">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Stop</div>
            <span className="text-xl font-mono font-bold text-red-400">{formatPrice(displayStop)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhyNowSection({ reasons }: { reasons: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!reasons || reasons.length === 0) return null;
  
  const displayReasons = isExpanded ? reasons : reasons.slice(0, 2);
  
  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        Why Now
      </h3>
      <div className="space-y-2">
        {displayReasons.map((reason, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span>{reason}</span>
          </div>
        ))}
        {reasons.length > 2 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show {reasons.length - 2} more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function KeyLevelsGrid({ support, resistance }: { support: number[]; resistance: number[] }) {
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5" />
        Key Levels
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
          <div className="text-[10px] text-red-400 uppercase mb-2 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Resistance
          </div>
          <div className="space-y-1">
            {(resistance || []).slice(0, 3).map((level, idx) => (
              <div key={idx} className="text-sm font-mono text-red-300">
                {formatPrice(level)}
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
          <div className="text-[10px] text-emerald-400 uppercase mb-2 flex items-center gap-1">
            <Target className="w-3 h-3" />
            Support
          </div>
          <div className="space-y-1">
            {(support || []).slice(0, 3).map((level, idx) => (
              <div key={idx} className="text-sm font-mono text-emerald-300">
                {formatPrice(level)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RisksSection({ risks }: { risks: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!risks || risks.length === 0) return null;
  
  const displayRisks = isExpanded ? risks : risks.slice(0, 2);
  
  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
        Key Risks
      </h3>
      <div className="space-y-2">
        {displayRisks.map((risk, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
            <span>{risk}</span>
          </div>
        ))}
        {risks.length > 2 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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

function QuantSetupCard({ setup }: { setup: QuantSetup }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-cyan-400">
          {formatSetupName(setup.setup_name)}
        </span>
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 rounded text-[10px] text-emerald-400">
          <span>PF</span>
          <span className="font-bold">{setup.historical_profit_factor.toFixed(2)}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Entry</div>
          <div className="font-mono text-foreground">{formatPrice(setup.entry_price)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Target</div>
          <div className="font-mono text-blue-400">{formatPrice(setup.target_price)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Stop</div>
          <div className="font-mono text-red-400">{formatPrice(setup.stop_loss)}</div>
        </div>
      </div>
    </div>
  );
}

function ModelFooter({ model, version, date }: { model: string; version: string; date: string }) {
  return (
    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-3 mt-4 border-t border-border">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3 h-3" />
        <span>{model || 'gemini'}</span>
        <span>•</span>
        <span>{version || 'v3'}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>{date}</span>
      </div>
    </div>
  );
}

// ============ TAB COMPONENTS ============

function TechnicalsTab({ aiReview }: { aiReview: AIReviewData | null }) {
  if (!aiReview) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">No technical analysis available</span>
      </div>
    );
  }

  const hasSetup = aiReview.primary_setup && aiReview.setup_purity_score;
  
  return (
    <div className="py-4">
      {/* Setup Badge */}
      {hasSetup && (
        <SetupBadge 
          setup={aiReview.primary_setup!} 
          purity={aiReview.setup_purity_score!} 
        />
      )}
      
      {/* Direction + Profit Factor */}
      <DirectionCard 
        direction={aiReview.direction} 
        score={aiReview.ai_direction_score}
        profitFactor={aiReview.historical_profit_factor}
      />
      
      {/* AI Summary */}
      {aiReview.ai_summary_text && (
        <div className="mt-4 bg-muted/30 rounded-lg p-3 border border-border">
          <p className="text-sm text-foreground/80 leading-relaxed">
            {aiReview.ai_summary_text}
          </p>
        </div>
      )}
      
      {/* Trade Ladder */}
      {aiReview.ai_entry && aiReview.ai_targets && aiReview.ai_key_levels && (
        <TradeLadder 
          entry={aiReview.ai_entry}
          targets={aiReview.ai_targets}
          stop={aiReview.ai_key_levels.invalidation}
          quantEntry={aiReview.quant_entry_price}
          quantStop={aiReview.quant_stop_loss}
          quantTarget={aiReview.quant_target_price}
          aiAdjustedEntry={aiReview.ai_adjusted_entry}
          aiAdjustedStop={aiReview.ai_adjusted_stop}
          aiAdjustedTarget={aiReview.ai_adjusted_target}
        />
      )}
      
      {/* Why Now */}
      {aiReview.ai_why_now && aiReview.ai_why_now.length > 0 && (
        <WhyNowSection reasons={aiReview.ai_why_now} />
      )}
      
      {/* Key Levels */}
      {aiReview.ai_key_levels && (
        <KeyLevelsGrid 
          support={aiReview.ai_key_levels.support || []}
          resistance={aiReview.ai_key_levels.resistance || []}
        />
      )}
      
      {/* Active Quant Setups (if multiple) */}
      {aiReview.active_quant_setups && aiReview.active_quant_setups.length > 1 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            All Active Setups ({aiReview.active_quant_setups.length})
          </h3>
          <div className="space-y-2">
            {aiReview.active_quant_setups.map((setup, idx) => (
              <QuantSetupCard key={idx} setup={setup} />
            ))}
          </div>
        </div>
      )}
      
      {/* Key Risks */}
      {aiReview.ai_risks && aiReview.ai_risks.length > 0 && (
        <RisksSection risks={aiReview.ai_risks} />
      )}
      
      {/* Model Footer */}
      <ModelFooter 
        model={aiReview.model} 
        version={aiReview.prompt_version} 
        date={aiReview.as_of_date}
      />
    </div>
  );
}

function FundamentalsTab({ fundamentals }: { fundamentals: FundamentalsData | null }) {
  if (!fundamentals) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">No fundamental data available</span>
      </div>
    );
  }
  
  return (
    <div className="py-4 space-y-4">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase mb-1">Market Cap</div>
          <div className="text-lg font-bold text-foreground">{formatNumber(fundamentals.market_cap)}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase mb-1">Revenue TTM</div>
          <div className="text-lg font-bold text-foreground">{formatNumber(fundamentals.revenue_ttm)}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase mb-1">P/E Ratio</div>
          <div className="text-lg font-bold text-foreground">{fundamentals.pe_ratio?.toFixed(1) || '—'}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 border border-border">
          <div className="text-[10px] text-muted-foreground uppercase mb-1">EPS</div>
          <div className="text-lg font-bold text-foreground">${fundamentals.eps?.toFixed(2) || '—'}</div>
        </div>
      </div>
      
      {/* Growth & Margins */}
      <div className="space-y-3">
        <h3 className="text-xs text-muted-foreground uppercase tracking-wide">Growth & Margins</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Revenue Growth (YoY)</span>
            <span className={cn(
              "text-sm font-bold",
              (fundamentals.quarterly_revenue_growth_yoy || 0) >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {formatPercent(fundamentals.quarterly_revenue_growth_yoy)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Profit Margin</span>
            <span className="text-sm font-bold text-foreground">{formatPercent(fundamentals.profit_margin)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Operating Margin</span>
            <span className="text-sm font-bold text-foreground">{formatPercent(fundamentals.operating_margin_ttm)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 px-3 py-3 xl:py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
        "touch-manipulation",
        active 
          ? "text-foreground border-b-2 border-primary bg-primary/5" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted"
      )}
    >
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <span>{label}</span>
      </div>
    </button>
  );
}

export function CompanySidePanel({ assetId, assetType, className }: CompanySidePanelProps) {
  const [fundamentals, setFundamentals] = useState<FundamentalsData | null>(null);
  const [aiReview, setAIReview] = useState<AIReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'technicals' | 'fundamentals'>('technicals');

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch fundamentals
      const fundResponse = await fetch(
        `/api/company-chat-api/fundamentals/${assetId}?asset_type=${assetType}`
      );
      if (fundResponse.ok) {
        const fundData = await fundResponse.json();
        setFundamentals(fundData);
      }
      
      // Fetch AI review
      const aiResponse = await fetch(
        `/api/company-chat-api/ai-review/${assetId}?asset_type=${assetType}`
      );
      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        setAIReview(aiData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [assetId, assetType]);

  if (isLoading) {
    return (
      <div className={cn("bg-card border border-border rounded-lg p-4 flex items-center justify-center", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-card border-0 xl:border xl:border-border xl:rounded-lg flex flex-col h-full overflow-hidden",
      className
    )}>
      {/* Tab Header */}
      <div className="flex border-b border-border bg-card sticky top-0 z-10">
        <TabButton
          active={activeTab === 'technicals'}
          onClick={() => setActiveTab('technicals')}
          icon={<Activity className="w-3.5 h-3.5 xl:w-3 xl:h-3" />}
          label="Technicals"
        />
        <TabButton
          active={activeTab === 'fundamentals'}
          onClick={() => setActiveTab('fundamentals')}
          icon={<BarChart3 className="w-3.5 h-3.5 xl:w-3 xl:h-3" />}
          label="Fundamentals"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 xl:px-3 pb-6 xl:pb-3 scrollbar-minimal">
        {activeTab === 'technicals' ? (
          <TechnicalsTab aiReview={aiReview} />
        ) : (
          <FundamentalsTab fundamentals={fundamentals} />
        )}
      </div>
    </div>
  );
}

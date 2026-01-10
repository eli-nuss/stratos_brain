import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, 
  ChevronDown, ChevronUp, RefreshCw, AlertCircle, Target, 
  Shield, AlertTriangle, Eye, Crosshair, ArrowUpRight, ArrowDownRight,
  Activity, Zap, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

interface FundamentalsData {
  market_cap?: number;
  revenue_ttm?: number;
  quarterly_revenue_growth_yoy?: number;
  quarterly_earnings_growth_yoy?: number;
  eps?: number;
  pe_ratio?: number;
  forward_pe?: number;
  peg_ratio?: number;
  price_to_sales_ttm?: number;
  forward_price_to_sales?: number;
  price_to_book?: number;
  profit_margin?: number;
  operating_margin_ttm?: number;
  return_on_equity_ttm?: number;
  return_on_assets_ttm?: number;
  beta?: number;
  analyst_target_price?: number;
  week_52_low?: number;
  week_52_high?: number;
  dividend_yield?: number;
  name?: string;
  symbol?: string;
  sector?: string;
  industry?: string;
  last_updated?: string;
  current_price?: number;
}

interface AIReviewData {
  as_of_date: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  setup_type: string;
  ai_direction_score: number;
  ai_setup_quality_score: number;
  ai_attention_level: string;
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
  if (Math.abs(value) >= 1e3) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const pct = value * 100;
  return pct.toFixed(1) + '%';
}

function formatRatio(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return value.toFixed(2);
}

function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return '$' + value.toFixed(2);
}

// ============ COMPONENTS ============

function MetricRow({ 
  label, 
  value, 
  isPercent = false,
  highlight = false 
}: { 
  label: string; 
  value: string; 
  isPercent?: boolean;
  highlight?: boolean;
}) {
  const valueColor = isPercent 
    ? (value.startsWith('-') ? 'text-red-400' : value !== '—' ? 'text-emerald-400' : 'text-zinc-400')
    : 'text-zinc-100';
  
  return (
    <div className={cn(
      "flex justify-between items-center py-1",
      highlight && "bg-zinc-800/30 -mx-2 px-2 rounded"
    )}>
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className={cn("text-[11px] font-medium font-mono", valueColor)}>
        {value}
      </span>
    </div>
  );
}

function RangeBar({ low, high, current }: { low?: number; high?: number; current?: number }) {
  if (!low || !high) return <span className="text-zinc-500">—</span>;
  
  const range = high - low;
  const position = current ? Math.min(100, Math.max(0, ((current - low) / range) * 100)) : 50;
  
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[10px] text-zinc-500 w-12">${low.toFixed(0)}</span>
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full relative">
        <div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full"
          style={{ width: '100%' }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full border-2 border-zinc-900 shadow-lg"
          style={{ left: `${position}%`, marginLeft: '-5px' }}
        />
      </div>
      <span className="text-[10px] text-zinc-500 w-12 text-right">${high.toFixed(0)}</span>
    </div>
  );
}

function DirectionBadge({ direction, score }: { direction: string; score: number }) {
  const isBullish = direction === 'bullish';
  const isBearish = direction === 'bearish';
  
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
      isBullish && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
      isBearish && "bg-red-500/20 text-red-400 border border-red-500/30",
      !isBullish && !isBearish && "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30"
    )}>
      {isBullish ? <ArrowUpRight className="w-3.5 h-3.5" /> : isBearish ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
      <span className="uppercase">{direction}</span>
      <span className="opacity-70">({score > 0 ? '+' : ''}{score})</span>
    </div>
  );
}

function AttentionBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    'FOCUS': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'WATCH': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'MONITOR': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    'IGNORE': 'bg-zinc-700/20 text-zinc-500 border-zinc-700/30',
  };
  
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-semibold uppercase border",
      colors[level] || colors['MONITOR']
    )}>
      {level}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = confidence * 100;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-400 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function LevelPill({ value, type }: { value: number; type: 'support' | 'resistance' | 'target' | 'invalidation' | 'entry' }) {
  const colors = {
    support: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    resistance: 'bg-red-500/10 text-red-400 border-red-500/20',
    target: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    invalidation: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    entry: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[11px] font-mono border",
      colors[type]
    )}>
      ${value.toFixed(2)}
    </span>
  );
}

function CollapsibleSection({ 
  title, 
  icon: Icon, 
  iconColor,
  children,
  defaultOpen = true
}: { 
  title: string; 
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-zinc-700/30 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2 hover:bg-zinc-800/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("w-3.5 h-3.5", iconColor)} />
          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>
      {isOpen && <div className="pb-3">{children}</div>}
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function CompanySidePanel({ assetId, assetType, className }: CompanySidePanelProps) {
  const [fundamentals, setFundamentals] = useState<FundamentalsData | null>(null);
  const [aiReview, setAIReview] = useState<AIReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fundamentals' | 'analysis'>('analysis');

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
      <div className={cn("bg-card border border-border rounded-xl p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-card backdrop-blur-sm border border-border rounded-xl shadow-xl flex flex-col h-full",
      className
    )}>
      {/* Tab Header */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('analysis')}
          className={cn(
            "flex-1 px-4 py-2.5 text-xs font-semibold transition-colors",
            activeTab === 'analysis' 
              ? "text-primary border-b-2 border-primary bg-primary/5" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            AI Analysis
          </div>
        </button>
        <button
          onClick={() => setActiveTab('fundamentals')}
          className={cn(
            "flex-1 px-4 py-2.5 text-xs font-semibold transition-colors",
            activeTab === 'fundamentals' 
              ? "text-primary border-b-2 border-primary bg-primary/5" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Fundamentals
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'analysis' ? (
          <AIAnalysisTab aiReview={aiReview} currentPrice={fundamentals?.current_price} />
        ) : (
          <FundamentalsTab fundamentals={fundamentals} />
        )}
      </div>
    </div>
  );
}

// ============ TAB COMPONENTS ============

function AIAnalysisTab({ aiReview, currentPrice }: { aiReview: AIReviewData | null; currentPrice?: number }) {
  if (!aiReview) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">No AI analysis available</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Direction & Attention Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-700/30">
        <DirectionBadge direction={aiReview.direction} score={aiReview.ai_direction_score} />
        <AttentionBadge level={aiReview.ai_attention_level} />
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-800/30 rounded-lg p-2.5">
          <div className="text-[10px] text-zinc-500 uppercase mb-1">Setup Quality</div>
          <div className="text-lg font-bold text-white">{aiReview.ai_setup_quality_score}</div>
          <div className="text-[10px] text-zinc-500">/ 100</div>
        </div>
        <div className="bg-zinc-800/30 rounded-lg p-2.5">
          <div className="text-[10px] text-zinc-500 uppercase mb-1">Confidence</div>
          <ConfidenceBar confidence={aiReview.ai_confidence} />
        </div>
      </div>

      {/* Summary */}
      <CollapsibleSection title="Summary" icon={Eye} iconColor="text-blue-400">
        <p className="text-[11px] text-zinc-300 leading-relaxed">
          {aiReview.ai_summary_text}
        </p>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
          <Clock className="w-3 h-3" />
          As of {new Date(aiReview.as_of_date).toLocaleDateString()}
        </div>
      </CollapsibleSection>

      {/* Trade Plan */}
      <CollapsibleSection title="Trade Plan" icon={Crosshair} iconColor="text-purple-400">
        <div className="space-y-3">
          {/* Entry Zone */}
          {aiReview.ai_entry && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase mb-1.5">Entry Zone</div>
              <div className="flex items-center gap-2">
                <LevelPill value={aiReview.ai_entry.low} type="entry" />
                <span className="text-zinc-500">—</span>
                <LevelPill value={aiReview.ai_entry.high} type="entry" />
              </div>
            </div>
          )}

          {/* Targets */}
          {Array.isArray(aiReview.ai_targets) && aiReview.ai_targets.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase mb-1.5">Targets</div>
              <div className="flex flex-wrap gap-1.5">
                {aiReview.ai_targets.map((target, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-500">T{i + 1}:</span>
                    <LevelPill value={target} type="target" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invalidation */}
          {aiReview.ai_key_levels?.invalidation && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase mb-1.5">Invalidation</div>
              <LevelPill value={aiReview.ai_key_levels.invalidation} type="invalidation" />
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Key Levels */}
      <CollapsibleSection title="Key Levels" icon={Target} iconColor="text-amber-400">
        <div className="space-y-3">
          {/* Support */}
          {aiReview.ai_key_levels?.support && Array.isArray(aiReview.ai_key_levels.support) && aiReview.ai_key_levels.support.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-zinc-500 uppercase">Support</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {aiReview.ai_key_levels.support.map((level, i) => (
                  <LevelPill key={i} value={level} type="support" />
                ))}
              </div>
            </div>
          )}

          {/* Resistance */}
          {aiReview.ai_key_levels?.resistance && Array.isArray(aiReview.ai_key_levels.resistance) && aiReview.ai_key_levels.resistance.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingDown className="w-3 h-3 text-red-400" />
                <span className="text-[10px] text-zinc-500 uppercase">Resistance</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {aiReview.ai_key_levels.resistance.map((level, i) => (
                  <LevelPill key={i} value={level} type="resistance" />
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Risks */}
      {Array.isArray(aiReview.ai_risks) && aiReview.ai_risks.length > 0 && (
        <CollapsibleSection title="Risks" icon={AlertTriangle} iconColor="text-red-400" defaultOpen={false}>
          <ul className="space-y-2">
            {aiReview.ai_risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2">
                <Shield className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-[11px] text-zinc-400">{risk}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  );
}

function FundamentalsTab({ fundamentals }: { fundamentals: FundamentalsData | null }) {
  if (!fundamentals) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">Fundamentals unavailable</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Sector Badge */}
      {fundamentals.sector && (
        <div className="pb-2 mb-2 border-b border-zinc-700/30">
          <span className="text-[10px] px-2 py-0.5 bg-zinc-700/50 text-zinc-400 rounded-full">
            {fundamentals.sector}
          </span>
        </div>
      )}

      {/* Size & Growth */}
      <CollapsibleSection title="Size & Growth" icon={DollarSign} iconColor="text-blue-400">
        <div className="space-y-0.5">
          <MetricRow label="Market Cap" value={'$' + formatNumber(fundamentals.market_cap)} />
          <MetricRow label="Revenue (TTM)" value={'$' + formatNumber(fundamentals.revenue_ttm)} />
          <MetricRow label="Rev Growth" value={formatPercent(fundamentals.quarterly_revenue_growth_yoy)} isPercent />
          <MetricRow label="EPS Growth" value={formatPercent(fundamentals.quarterly_earnings_growth_yoy)} isPercent />
        </div>
      </CollapsibleSection>

      {/* Valuation */}
      <CollapsibleSection title="Valuation" icon={TrendingUp} iconColor="text-purple-400">
        <div className="space-y-0.5">
          <MetricRow label="P/E (TTM)" value={formatRatio(fundamentals.pe_ratio)} highlight={fundamentals.pe_ratio !== undefined && fundamentals.pe_ratio < 15} />
          <MetricRow label="Forward P/E" value={formatRatio(fundamentals.forward_pe)} />
          <MetricRow label="PEG" value={formatRatio(fundamentals.peg_ratio)} highlight={fundamentals.peg_ratio !== undefined && fundamentals.peg_ratio < 1} />
          <MetricRow label="P/S (TTM)" value={formatRatio(fundamentals.price_to_sales_ttm)} />
          <MetricRow label="P/B" value={formatRatio(fundamentals.price_to_book)} />
        </div>
      </CollapsibleSection>

      {/* Profitability */}
      <CollapsibleSection title="Profitability" icon={Percent} iconColor="text-emerald-400">
        <div className="space-y-0.5">
          <MetricRow label="Profit Margin" value={formatPercent(fundamentals.profit_margin)} isPercent />
          <MetricRow label="Op Margin" value={formatPercent(fundamentals.operating_margin_ttm)} isPercent />
          <MetricRow label="ROE" value={formatPercent(fundamentals.return_on_equity_ttm)} isPercent />
        </div>
      </CollapsibleSection>

      {/* Other */}
      <CollapsibleSection title="Other" icon={BarChart3} iconColor="text-yellow-400">
        <div className="space-y-0.5">
          <MetricRow label="Beta" value={formatRatio(fundamentals.beta)} />
          <MetricRow label="Analyst Target" value={fundamentals.analyst_target_price ? '$' + formatNumber(fundamentals.analyst_target_price) : '—'} />
          {fundamentals.dividend_yield !== undefined && fundamentals.dividend_yield > 0 && (
            <MetricRow label="Div Yield" value={formatPercent(fundamentals.dividend_yield)} isPercent />
          )}
        </div>
      </CollapsibleSection>

      {/* 52-Week Range */}
      <div className="pt-2">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          52W Range
        </div>
        <RangeBar 
          low={fundamentals.week_52_low} 
          high={fundamentals.week_52_high}
          current={fundamentals.current_price}
        />
      </div>

      {/* Last Updated */}
      {fundamentals.last_updated && (
        <div className="pt-2 mt-2 border-t border-zinc-700/30">
          <span className="text-[10px] text-zinc-500">
            Updated: {new Date(fundamentals.last_updated).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}

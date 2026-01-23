import { useState, useEffect } from 'react';
import { 
  Activity, BarChart3, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface AIReviewData {
  as_of_date: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  ai_direction_score: number;
  ai_setup_quality_score: number;
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

// ============ VISUAL COMPONENTS ============

function ScoreCard({ direction, score, confidence }: { direction: string; score: number; confidence: number }) {
  const isBullish = direction === 'bullish';
  const isBearish = direction === 'bearish';
  const confidencePct = confidence * 100;
  
  return (
    <div className="pb-3 border-b border-border">
      {/* Signal Badge - Minimal */}
      <div className="flex items-center justify-between mb-2">
        <div className={cn(
          "flex items-center gap-1.5 text-xs font-bold uppercase",
          isBullish && "text-emerald-400",
          isBearish && "text-red-400",
          !isBullish && !isBearish && "text-zinc-400"
        )}>
          {isBullish ? <ArrowUpRight className="w-3.5 h-3.5" /> : isBearish ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
          <span>{direction}</span>
          <span className="text-zinc-500">({score > 0 ? '+' : ''}{score})</span>
        </div>
      </div>
      
      {/* Confidence Bar - Thin */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Confidence</span>
          <span className="text-xs font-mono text-zinc-300">{confidencePct.toFixed(0)}%</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              confidencePct >= 75 ? "bg-emerald-600" : confidencePct >= 50 ? "bg-yellow-600" : "bg-red-600"
            )}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PriceLadderBracket({ entry, targets, invalidation, currentPrice }: { 
  entry: { low: number; high: number }; 
  targets: number[]; 
  invalidation: number;
  currentPrice?: number;
}) {
  // Calculate distances from current price
  const getDistance = (price: number) => {
    if (!currentPrice) return null;
    const pct = ((price - currentPrice) / currentPrice) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };
  
  return (
    <div className="py-3 border-b border-border">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-3">Trade Plan</h3>
      
      <div className="space-y-2 pl-3 border-l-2 border-zinc-700">
        {/* Targets */}
        {targets.map((target, idx) => (
          <div key={idx} className="relative -ml-3">
            <div className="absolute left-0 top-1/2 w-3 h-px bg-emerald-600" />
            <div className="pl-4 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Target {idx + 1}</span>
              <div className="text-right">
                <span className="text-xs font-mono text-emerald-400">${target.toFixed(2)}</span>
                {getDistance(target) && (
                  <span className="text-[10px] text-zinc-600 ml-1">{getDistance(target)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Entry */}
        <div className="relative -ml-3">
          <div className="absolute left-0 top-1/2 w-3 h-px bg-zinc-500" />
          <div className="pl-4 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Entry</span>
            <div className="text-right">
              <span className="text-xs font-mono text-zinc-300">${entry.low.toFixed(2)}-${entry.high.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Stop */}
        <div className="relative -ml-3">
          <div className="absolute left-0 top-1/2 w-3 h-px bg-red-600" />
          <div className="pl-4 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">Stop</span>
            <div className="text-right">
              <span className="text-xs font-mono text-red-400">${invalidation.toFixed(2)}</span>
              {getDistance(invalidation) && (
                <span className="text-[10px] text-zinc-600 ml-1">{getDistance(invalidation)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MomentumBars({ momentum }: { momentum: MomentumData | null }) {
  if (!momentum) {
    return (
      <div className="py-3 border-b border-border">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Momentum <span className="text-[9px] text-zinc-600">(No Data)</span></h3>
      </div>
    );
  }
  
  const rvol = momentum.rvol ? Number(momentum.rvol.toFixed(1)) : 0;
  const rsi = momentum.rsi ? Math.round(momentum.rsi) : 0; // Round to whole number
  const adr = momentum.atr_pct ? Number((momentum.atr_pct * 100).toFixed(1)) : 0; // Convert to percentage
  
  return (
    <div className="py-3 border-b border-border space-y-2">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Momentum</h3>
      
      {/* RVOL */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500">RVOL</span>
          <span className={cn(
            "text-[10px] font-mono",
            rvol >= 1.5 ? "text-emerald-500" : rvol >= 1.0 ? "text-yellow-500" : "text-zinc-400"
          )}>
            {rvol.toFixed(1)}x
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full",
              rvol >= 1.5 ? "bg-emerald-700" : rvol >= 1.0 ? "bg-yellow-700" : "bg-zinc-600"
            )}
            style={{ width: `${Math.min(100, (rvol / 2) * 100)}%` }}
          />
        </div>
      </div>
      
      {/* RSI */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500">RSI</span>
          <span className={cn(
            "text-[10px] font-mono",
            rsi >= 70 ? "text-red-500" : rsi >= 30 ? "text-zinc-300" : "text-emerald-500"
          )}>
            {rsi}
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden relative">
          {/* 30/70 zone markers */}
          <div className="absolute left-[30%] top-0 w-px h-full bg-zinc-600" />
          <div className="absolute left-[70%] top-0 w-px h-full bg-zinc-600" />
          <div 
            className={cn(
              "h-full rounded-full",
              rsi >= 70 ? "bg-red-700" : rsi >= 30 ? "bg-zinc-600" : "bg-emerald-700"
            )}
            style={{ width: `${rsi}%` }}
          />
        </div>
      </div>
      
      {/* ADR / Volatility */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500">ADR</span>
          <span className={cn(
            "text-[10px] font-mono",
            adr >= 5 ? "text-emerald-500" : "text-zinc-400"
          )}>
            {adr.toFixed(1)}%
          </span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full",
              adr >= 5 ? "bg-emerald-700" : "bg-zinc-600"
            )}
            style={{ width: `${Math.min(100, (adr / 10) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function KeyLevelsGrid({ support, resistance, currentPrice }: { support: number[]; resistance: number[]; currentPrice?: number }) {
  const getDistance = (price: number) => {
    if (!currentPrice) return '';
    const pct = ((price - currentPrice) / currentPrice) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  };
  
  return (
    <div className="py-3">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Key Levels</h3>
      
      <div className="space-y-1 text-xs">
        {/* Resistance */}
        {resistance.map((level, idx) => (
          <div key={`r${idx}`} className="flex items-center justify-between">
            <span className="text-zinc-500">Resistance {idx + 1}</span>
            <div className="font-mono">
              <span className="text-red-400">${level.toFixed(2)}</span>
              {currentPrice && (
                <span className="text-zinc-600 ml-1 text-[10px]">{getDistance(level)}</span>
              )}
            </div>
          </div>
        ))}
        
        {/* Support */}
        {support.map((level, idx) => (
          <div key={`s${idx}`} className="flex items-center justify-between">
            <span className="text-zinc-500">Support {idx + 1}</span>
            <div className="font-mono">
              <span className="text-emerald-400">${level.toFixed(2)}</span>
              {currentPrice && (
                <span className="text-zinc-600 ml-1 text-[10px]">{getDistance(level)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("font-mono font-medium", valueColor || "text-zinc-300")}>{value}</span>
    </div>
  );
}

function SmartMoneyBars() {
  // Mock data - in production, fetch real insider/institutional data
  const insiderBuying = 65;
  const institutionalAccumulation = 72;
  
  return (
    <div className="py-3 border-b border-border space-y-2">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Smart Money <span className="text-[9px] text-zinc-600">(Placeholder)</span></h3>
      
      {/* Insider Activity */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500">Insider Activity</span>
          <span className="text-[10px] font-mono text-emerald-500">{insiderBuying}% Buy</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="bg-emerald-700" style={{ width: `${insiderBuying}%` }} />
          <div className="bg-red-700" style={{ width: `${100 - insiderBuying}%` }} />
        </div>
      </div>
      
      {/* Institutional Flow */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500">Institutional Flow</span>
          <span className="text-[10px] font-mono text-emerald-500">{institutionalAccumulation}% Accum</span>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="bg-emerald-700" style={{ width: `${institutionalAccumulation}%` }} />
          <div className="bg-red-700" style={{ width: `${100 - institutionalAccumulation}%` }} />
        </div>
      </div>
    </div>
  );
}

function ValuationTable({ fundamentals }: { fundamentals: FundamentalsData | null }) {
  if (!fundamentals) return null;
  
  return (
    <div className="py-3 border-b border-border">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Valuation</h3>
      <div className="space-y-1">
        <DataRow label="P/E Ratio" value={fundamentals.pe_ratio?.toFixed(1) || '—'} />
        <DataRow label="Market Cap" value={formatNumber(fundamentals.market_cap)} />
        <DataRow label="Revenue" value={formatNumber(fundamentals.revenue_ttm)} />
      </div>
    </div>
  );
}

function PeerRankTable() {
  return (
    <div className="py-3 border-b border-border">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Peer Rank <span className="text-[9px] text-zinc-600">(Placeholder)</span></h3>
      <div className="space-y-1">
        <DataRow label="Rank in Sector" value="#3 of 42" valueColor="text-zinc-300" />
        <DataRow label="Revenue Growth" value="Top 10%" valueColor="text-emerald-400" />
        <DataRow label="Margins" value="Bottom 40%" valueColor="text-red-400" />
      </div>
    </div>
  );
}

function KeyMetricsTable({ fundamentals }: { fundamentals: FundamentalsData | null }) {
  if (!fundamentals) return null;
  
  const growthColor = (fundamentals.quarterly_revenue_growth_yoy || 0) >= 0 ? "text-emerald-400" : "text-red-400";
  
  return (
    <div className="py-3">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Key Metrics</h3>
      <div className="space-y-1">
        <DataRow label="Revenue" value={formatNumber(fundamentals.revenue_ttm)} />
        <DataRow label="Growth YoY" value={formatPercent(fundamentals.quarterly_revenue_growth_yoy)} valueColor={growthColor} />
        <DataRow label="Profit Margin" value={formatPercent(fundamentals.profit_margin)} />
        <DataRow label="EPS" value={fundamentals.eps ? `$${fundamentals.eps.toFixed(2)}` : '—'} />
      </div>
    </div>
  );
}

// ============ TAB COMPONENTS ============

function TechnicalsTab({ aiReview, currentPrice, momentum }: { aiReview: AIReviewData | null; currentPrice?: number; momentum: MomentumData | null }) {
  if (!aiReview) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">No technical analysis available</span>
      </div>
    );
  }
  
  return (
    <div>
      {/* Score Card */}
      <ScoreCard 
        direction={aiReview.direction}
        score={aiReview.ai_direction_score}
        confidence={aiReview.ai_confidence}
      />
      
      {/* Price Ladder Bracket */}
      <PriceLadderBracket 
        entry={aiReview.ai_entry}
        targets={aiReview.ai_targets}
        invalidation={aiReview.ai_key_levels.invalidation}
        currentPrice={currentPrice}
      />
      
      {/* Momentum Bars */}
      <MomentumBars momentum={momentum} />
      
      {/* Key Levels Grid */}
      <KeyLevelsGrid 
        support={aiReview.ai_key_levels.support}
        resistance={aiReview.ai_key_levels.resistance}
        currentPrice={currentPrice}
      />
    </div>
  );
}

function FundamentalsTab({ fundamentals }: { fundamentals: FundamentalsData | null }) {
  if (!fundamentals) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm">No fundamental data available</span>
      </div>
    );
  }
  
  return (
    <div>
      {/* Valuation */}
      <ValuationTable fundamentals={fundamentals} />
      
      {/* Smart Money */}
      <SmartMoneyBars />
      
      {/* Peer Rank */}
      <PeerRankTable />
      
      {/* Key Metrics */}
      <KeyMetricsTable fundamentals={fundamentals} />
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
        "touch-manipulation", // Optimize for touch
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
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
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
      
      // Fetch momentum indicators
      const momentumResponse = await fetch(
        `/api/dashboard/momentum?asset_id=${assetId}`
      );
      if (momentumResponse.ok) {
        const momentumData = await momentumResponse.json();
        setMomentum(momentumData);
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
      {/* Tab Header - Sticky on mobile */}
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

      {/* Content - Improved scrolling on mobile */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 xl:px-3 pb-6 xl:pb-3 scrollbar-minimal">
        {activeTab === 'technicals' ? (
          <TechnicalsTab aiReview={aiReview} currentPrice={fundamentals?.current_price} momentum={momentum} />
        ) : (
          <FundamentalsTab fundamentals={fundamentals} />
        )}
      </div>
    </div>
  );
}

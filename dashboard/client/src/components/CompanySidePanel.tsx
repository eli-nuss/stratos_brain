import { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, BarChart3, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight, Circle
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

function PriceLadder({ entry, targets, invalidation, currentPrice }: { 
  entry: { low: number; high: number }; 
  targets: number[]; 
  invalidation: number;
  currentPrice?: number;
}) {
  // Calculate positions for visualization
  const allPrices = [...targets, entry.high, entry.low, invalidation];
  const maxPrice = Math.max(...allPrices);
  const minPrice = Math.min(...allPrices);
  const range = maxPrice - minPrice;
  
  const getPosition = (price: number) => {
    return ((maxPrice - price) / range) * 100;
  };
  
  const currentPos = currentPrice ? getPosition(currentPrice) : null;
  
  return (
    <div className="py-3 border-b border-border">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-3">Trade Plan</h3>
      
      <div className="flex gap-3">
        {/* Price Ladder Visualization */}
        <div className="relative w-1 bg-zinc-800 rounded-full flex-shrink-0" style={{ height: '200px' }}>
          {/* Targets */}
          {targets.map((target, idx) => {
            const pos = getPosition(target);
            return (
              <div 
                key={idx}
                className="absolute left-0 w-full"
                style={{ top: `${pos}%` }}
              >
                <div className="absolute left-0 w-2 h-2 -ml-0.5 bg-blue-500 rounded-full border-2 border-background" />
              </div>
            );
          })}
          
          {/* Entry Zone */}
          <div 
            className="absolute left-0 w-full bg-purple-500/20"
            style={{ 
              top: `${getPosition(entry.high)}%`,
              height: `${getPosition(entry.low) - getPosition(entry.high)}%`
            }}
          />
          
          {/* Stop */}
          <div 
            className="absolute left-0 w-full"
            style={{ top: `${getPosition(invalidation)}%` }}
          >
            <div className="absolute left-0 w-2 h-2 -ml-0.5 bg-red-500 rounded-full border-2 border-background" />
          </div>
          
          {/* Current Price Indicator */}
          {currentPos !== null && (
            <div 
              className="absolute left-0 w-full"
              style={{ top: `${currentPos}%` }}
            >
              <div className="absolute left-0 w-3 h-3 -ml-1 bg-white rounded-full border-2 border-background shadow-lg" />
            </div>
          )}
        </div>
        
        {/* Price Labels */}
        <div className="flex-1 relative" style={{ height: '200px' }}>
          {/* Targets */}
          {targets.map((target, idx) => {
            const pos = getPosition(target);
            return (
              <div 
                key={idx}
                className="absolute left-0 flex items-center gap-2"
                style={{ top: `${pos}%`, transform: 'translateY(-50%)' }}
              >
                <span className="text-[10px] text-zinc-500 w-4">T{idx + 1}</span>
                <span className="text-xs font-mono text-blue-400">${target.toFixed(2)}</span>
              </div>
            );
          })}
          
          {/* Entry */}
          <div 
            className="absolute left-0 flex items-center gap-2"
            style={{ top: `${(getPosition(entry.high) + getPosition(entry.low)) / 2}%`, transform: 'translateY(-50%)' }}
          >
            <span className="text-[10px] text-zinc-500 w-4">E</span>
            <span className="text-xs font-mono text-purple-400">${entry.low.toFixed(2)}-${entry.high.toFixed(2)}</span>
          </div>
          
          {/* Stop */}
          <div 
            className="absolute left-0 flex items-center gap-2"
            style={{ top: `${getPosition(invalidation)}%`, transform: 'translateY(-50%)' }}
          >
            <span className="text-[10px] text-zinc-500 w-4">S</span>
            <span className="text-xs font-mono text-red-400">${invalidation.toFixed(2)}</span>
          </div>
          
          {/* Current Price */}
          {currentPrice && currentPos !== null && (
            <div 
              className="absolute left-0 flex items-center gap-2"
              style={{ top: `${currentPos}%`, transform: 'translateY(-50%)' }}
            >
              <Circle className="w-3 h-3 text-white fill-white" />
              <span className="text-xs font-mono font-bold text-white">${currentPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MomentumRow() {
  // Mock data - in production, fetch real momentum data
  const rvol = 1.5;
  const rsi = 63;
  const smaDistance = 4.2;
  
  return (
    <div className="py-3 border-b border-border">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Momentum</h3>
      
      <div className="text-xs font-mono space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">RVOL</span>
          <span className={cn(
            "font-bold",
            rvol >= 1.5 ? "text-emerald-400" : rvol >= 1.0 ? "text-yellow-400" : "text-zinc-400"
          )}>
            {rvol.toFixed(1)}x
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">RSI</span>
          <span className={cn(
            "font-bold",
            rsi >= 70 ? "text-red-400" : rsi >= 30 ? "text-zinc-300" : "text-emerald-400"
          )}>
            {rsi}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">SMA20</span>
          <span className={cn(
            "font-bold",
            smaDistance >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {smaDistance >= 0 ? '+' : ''}{smaDistance.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function KeyLevels({ support, resistance }: { support: number[]; resistance: number[] }) {
  return (
    <div className="py-3">
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Key Levels</h3>
      
      <div className="space-y-2 text-xs font-mono">
        {/* Resistance */}
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">RESISTANCE</div>
          <div className="space-y-0.5">
            {resistance.map((level, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-zinc-600">R{idx + 1}</span>
                <span className="text-red-400">${level.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Support */}
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">SUPPORT</div>
          <div className="space-y-0.5">
            {support.map((level, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-zinc-600">S{idx + 1}</span>
                <span className="text-emerald-400">${level.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
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
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Smart Money</h3>
      
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
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Peer Rank</h3>
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

function TechnicalsTab({ aiReview, currentPrice }: { aiReview: AIReviewData | null; currentPrice?: number }) {
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
      
      {/* Price Ladder */}
      <PriceLadder 
        entry={aiReview.ai_entry}
        targets={aiReview.ai_targets}
        invalidation={aiReview.ai_key_levels.invalidation}
        currentPrice={currentPrice}
      />
      
      {/* Momentum */}
      <MomentumRow />
      
      {/* Key Levels */}
      <KeyLevels 
        support={aiReview.ai_key_levels.support}
        resistance={aiReview.ai_key_levels.resistance}
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
      "bg-card border border-border rounded-lg flex flex-col h-full overflow-hidden",
      className
    )}>
      {/* Tab Header */}
      <div className="flex border-b border-border bg-card">
        <button
          onClick={() => setActiveTab('technicals')}
          className={cn(
            "flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
            activeTab === 'technicals' 
              ? "text-foreground border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Activity className="w-3 h-3" />
            Technicals
          </div>
        </button>
        <button
          onClick={() => setActiveTab('fundamentals')}
          className={cn(
            "flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
            activeTab === 'fundamentals' 
              ? "text-foreground border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <BarChart3 className="w-3 h-3" />
            Fundamentals
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 scrollbar-minimal">
        {activeTab === 'technicals' ? (
          <TechnicalsTab aiReview={aiReview} currentPrice={fundamentals?.current_price} />
        ) : (
          <FundamentalsTab fundamentals={fundamentals} />
        )}
      </div>
    </div>
  );
}

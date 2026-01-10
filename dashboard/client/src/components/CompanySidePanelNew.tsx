import { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, DollarSign, Target, Shield, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Zap, BarChart3, RefreshCw, AlertCircle,
  Users, Building2, TrendingDown
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
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl p-4 border border-zinc-700/50">
      {/* Signal Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold",
          isBullish && "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
          isBearish && "bg-red-500/20 text-red-400 border border-red-500/40",
          !isBullish && !isBearish && "bg-zinc-500/20 text-zinc-400 border border-zinc-500/40"
        )}>
          {isBullish ? <ArrowUpRight className="w-4 h-4" /> : isBearish ? <ArrowDownRight className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          <span className="uppercase">{direction}</span>
          <span className="opacity-80">({score > 0 ? '+' : ''}{score})</span>
        </div>
      </div>
      
      {/* Confidence Bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-400 uppercase tracking-wide">Confidence</span>
          <span className="text-sm font-bold text-white">{confidencePct.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              confidencePct >= 75 ? "bg-emerald-500" : confidencePct >= 50 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TradePlanLadder({ entry, targets, invalidation }: { entry: { low: number; high: number }; targets: number[]; invalidation: number }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs text-zinc-400 uppercase tracking-wide mb-3">Trade Plan</h3>
      
      {/* Targets */}
      <div className="space-y-1.5">
        {targets.map((target, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-blue-400">T{idx + 1}</span>
            </div>
            <div className="flex-1 h-8 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center px-3">
              <span className="text-sm font-mono font-bold text-blue-400">${target.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Entry Zone */}
      <div className="flex items-center gap-2 mt-3">
        <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
          <ArrowUpRight className="w-3 h-3 text-purple-400" />
        </div>
        <div className="flex-1 h-8 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center justify-between px-3">
          <span className="text-xs font-mono text-purple-400">${entry.low.toFixed(2)}</span>
          <span className="text-[10px] text-zinc-500">ENTRY</span>
          <span className="text-xs font-mono text-purple-400">${entry.high.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Invalidation */}
      <div className="flex items-center gap-2 mt-1.5">
        <div className="w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-3 h-3 text-red-400" />
        </div>
        <div className="flex-1 h-8 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center px-3">
          <span className="text-sm font-mono font-bold text-red-400">${invalidation.toFixed(2)}</span>
          <span className="text-[10px] text-zinc-500 ml-2">STOP</span>
        </div>
      </div>
    </div>
  );
}

function MomentumIndicators() {
  // Mock data - in production, fetch real momentum data
  const rvol = 1.5;
  const rsi = 63;
  const smaDistance = 4.2;
  
  return (
    <div className="space-y-3">
      <h3 className="text-xs text-zinc-400 uppercase tracking-wide">Momentum</h3>
      
      <div className="grid grid-cols-3 gap-2">
        {/* RVOL */}
        <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
          <div className="text-[10px] text-zinc-500 mb-1">RVOL</div>
          <div className={cn(
            "text-lg font-bold",
            rvol >= 1.5 ? "text-emerald-400" : rvol >= 1.0 ? "text-yellow-400" : "text-zinc-400"
          )}>
            {rvol.toFixed(1)}x
          </div>
        </div>
        
        {/* RSI */}
        <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
          <div className="text-[10px] text-zinc-500 mb-1">RSI</div>
          <div className={cn(
            "text-lg font-bold",
            rsi >= 70 ? "text-red-400" : rsi >= 30 ? "text-zinc-300" : "text-emerald-400"
          )}>
            {rsi}
          </div>
        </div>
        
        {/* SMA Distance */}
        <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
          <div className="text-[10px] text-zinc-500 mb-1">SMA20</div>
          <div className={cn(
            "text-lg font-bold",
            smaDistance >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {smaDistance >= 0 ? '+' : ''}{smaDistance.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyLevels({ support, resistance }: { support: number[]; resistance: number[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs text-zinc-400 uppercase tracking-wide">Key Levels</h3>
      
      {/* Resistance */}
      <div>
        <div className="text-[10px] text-zinc-500 mb-1.5 flex items-center gap-1">
          <Shield className="w-3 h-3 text-red-400" />
          RESISTANCE
        </div>
        <div className="flex flex-wrap gap-1.5">
          {resistance.map((level, idx) => (
            <button
              key={idx}
              className="px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-md text-xs font-mono text-red-400 hover:bg-red-500/20 transition-colors"
            >
              ${level.toFixed(2)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Support */}
      <div>
        <div className="text-[10px] text-zinc-500 mb-1.5 flex items-center gap-1">
          <Target className="w-3 h-3 text-emerald-400" />
          SUPPORT
        </div>
        <div className="flex flex-wrap gap-1.5">
          {support.map((level, idx) => (
            <button
              key={idx}
              className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs font-mono text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            >
              ${level.toFixed(2)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ValuationSparkline({ peRatio }: { peRatio?: number }) {
  // Mock sparkline data - in production, fetch historical P/E data
  const historicalPE = [22, 24, 26, 28, 25, 23, 21, 24, 26, 25];
  const avg = historicalPE.reduce((a, b) => a + b, 0) / historicalPE.length;
  const stdDev = Math.sqrt(historicalPE.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / historicalPE.length);
  const upperBand = avg + stdDev;
  const lowerBand = avg - stdDev;
  
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400">P/E Ratio</span>
        <span className="text-lg font-bold text-white">{peRatio?.toFixed(1) || '—'}</span>
      </div>
      
      {/* Simplified sparkline visualization */}
      <div className="h-12 flex items-end gap-0.5">
        {historicalPE.map((val, idx) => {
          const height = (val / Math.max(...historicalPE)) * 100;
          const isAboveAvg = val > avg;
          return (
            <div
              key={idx}
              className={cn(
                "flex-1 rounded-t transition-all",
                isAboveAvg ? "bg-red-500/40" : "bg-emerald-500/40"
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
      
      <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
        <span>-1σ: {lowerBand.toFixed(1)}</span>
        <span>Avg: {avg.toFixed(1)}</span>
        <span>+1σ: {upperBand.toFixed(1)}</span>
      </div>
    </div>
  );
}

function SmartMoneyFlow() {
  // Mock data - in production, fetch real insider/institutional data
  const insiderBuying = 65; // 65% buying
  const institutionalAccumulation = 72; // 72% accumulation
  
  return (
    <div className="space-y-3">
      <h3 className="text-xs text-zinc-400 uppercase tracking-wide">Smart Money</h3>
      
      {/* Insider Activity */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Users className="w-3 h-3" />
            INSIDER ACTIVITY
          </span>
          <span className="text-xs font-bold text-emerald-400">{insiderBuying}% Buying</span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500" style={{ width: `${insiderBuying}%` }} />
          <div className="bg-red-500" style={{ width: `${100 - insiderBuying}%` }} />
        </div>
      </div>
      
      {/* Institutional Flow */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            INSTITUTIONAL FLOW
          </span>
          <span className="text-xs font-bold text-emerald-400">{institutionalAccumulation}% Accumulation</span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500" style={{ width: `${institutionalAccumulation}%` }} />
          <div className="bg-red-500" style={{ width: `${100 - institutionalAccumulation}%` }} />
        </div>
      </div>
    </div>
  );
}

function PeerRank() {
  // Mock data - in production, fetch real peer comparison data
  return (
    <div className="space-y-2">
      <h3 className="text-xs text-zinc-400 uppercase tracking-wide">Peer Rank</h3>
      
      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Rank in Sector</span>
          <span className="text-sm font-bold text-white">#3 of 42</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Rev Growth</span>
          <span className="text-sm font-bold text-emerald-400">Top 10%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">Margins</span>
          <span className="text-sm font-bold text-red-400">Bottom 40%</span>
        </div>
      </div>
    </div>
  );
}

function KeyMetrics({ fundamentals }: { fundamentals: FundamentalsData | null }) {
  if (!fundamentals) return null;
  
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
        <div className="text-[10px] text-zinc-500 mb-0.5">Revenue</div>
        <div className="text-sm font-bold text-white">{formatNumber(fundamentals.revenue_ttm)}</div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
        <div className="text-[10px] text-zinc-500 mb-0.5">Growth</div>
        <div className={cn(
          "text-sm font-bold",
          (fundamentals.quarterly_revenue_growth_yoy || 0) >= 0 ? "text-emerald-400" : "text-red-400"
        )}>
          {formatPercent(fundamentals.quarterly_revenue_growth_yoy)}
        </div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
        <div className="text-[10px] text-zinc-500 mb-0.5">Margin</div>
        <div className="text-sm font-bold text-white">{formatPercent(fundamentals.profit_margin)}</div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/30">
        <div className="text-[10px] text-zinc-500 mb-0.5">EPS</div>
        <div className="text-sm font-bold text-white">${fundamentals.eps?.toFixed(2) || '—'}</div>
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
    <div className="space-y-4">
      {/* Score Card - Sticky visual */}
      <ScoreCard 
        direction={aiReview.direction}
        score={aiReview.ai_direction_score}
        confidence={aiReview.ai_confidence}
      />
      
      {/* Trade Plan - Visual ladder */}
      <TradePlanLadder 
        entry={aiReview.ai_entry}
        targets={aiReview.ai_targets}
        invalidation={aiReview.ai_key_levels.invalidation}
      />
      
      {/* Momentum Indicators */}
      <MomentumIndicators />
      
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
    <div className="space-y-4">
      {/* Valuation Context */}
      <ValuationSparkline peRatio={fundamentals.pe_ratio} />
      
      {/* Smart Money Flow */}
      <SmartMoneyFlow />
      
      {/* Peer Rank */}
      <PeerRank />
      
      {/* Key Metrics */}
      <div className="space-y-2">
        <h3 className="text-xs text-zinc-400 uppercase tracking-wide">Key Metrics</h3>
        <KeyMetrics fundamentals={fundamentals} />
      </div>
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
      <div className={cn("bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center justify-center", className)}>
        <div className="flex items-center gap-2 text-zinc-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col h-full overflow-hidden",
      className
    )}>
      {/* Tab Header */}
      <div className="flex border-b border-zinc-700 bg-zinc-900/50 backdrop-blur-sm">
        <button
          onClick={() => setActiveTab('technicals')}
          className={cn(
            "flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wide transition-all",
            activeTab === 'technicals' 
              ? "text-white border-b-2 border-emerald-500 bg-emerald-500/10" 
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Technicals
          </div>
        </button>
        <button
          onClick={() => setActiveTab('fundamentals')}
          className={cn(
            "flex-1 px-4 py-3 text-xs font-bold uppercase tracking-wide transition-all",
            activeTab === 'fundamentals' 
              ? "text-white border-b-2 border-blue-500 bg-blue-500/10" 
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" />
            Fundamentals
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-minimal">
        {activeTab === 'technicals' ? (
          <TechnicalsTab aiReview={aiReview} currentPrice={fundamentals?.current_price} />
        ) : (
          <FundamentalsTab fundamentals={fundamentals} />
        )}
      </div>
    </div>
  );
}

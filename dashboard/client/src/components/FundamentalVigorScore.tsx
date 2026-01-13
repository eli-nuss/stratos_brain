import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Shield, Zap, Award, AlertTriangle,
  RefreshCw, AlertCircle, ChevronDown, ChevronUp, Info, Target,
  BarChart3, Activity, DollarSign, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

interface FVSData {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  asOfDate: string;
  
  // Pillar scores (0-100)
  profitabilityScore: number;
  solvencyScore: number;
  growthScore: number;
  moatScore: number;
  
  // Final score (0-100)
  finalScore: number;
  
  // Metadata
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  dataQualityScore: number;
  piotroskiFScore: number | null;
  altmanZScore: number | null;
  
  // Reasoning
  finalReasoningParagraph: string;
  keyStrengths: string[];
  keyRisks: string[];
  qualityTier: string;
  
  // Cache info
  cachedAt: string | null;
}

interface FVSProps {
  assetId: number | string;
  symbol: string;
  className?: string;
  compact?: boolean;
}

// ============ HELPERS ============

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-yellow-400';
  if (score >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/20 border-emerald-500/40';
  if (score >= 60) return 'bg-blue-500/20 border-blue-500/40';
  if (score >= 40) return 'bg-yellow-500/20 border-yellow-500/40';
  if (score >= 20) return 'bg-orange-500/20 border-orange-500/40';
  return 'bg-red-500/20 border-red-500/40';
}

function getScoreGradient(score: number): string {
  if (score >= 80) return 'from-emerald-600 to-emerald-400';
  if (score >= 60) return 'from-blue-600 to-blue-400';
  if (score >= 40) return 'from-yellow-600 to-yellow-400';
  if (score >= 20) return 'from-orange-600 to-orange-400';
  return 'from-red-600 to-red-400';
}

function getTierLabel(tier: string): { label: string; color: string; icon: React.ReactNode } {
  switch (tier) {
    case 'fortress':
      return { label: 'Fortress', color: 'text-emerald-400', icon: <Shield className="w-4 h-4" /> };
    case 'quality':
      return { label: 'Quality', color: 'text-blue-400', icon: <Award className="w-4 h-4" /> };
    case 'average':
      return { label: 'Average', color: 'text-yellow-400', icon: <Activity className="w-4 h-4" /> };
    case 'speculative':
      return { label: 'Speculative', color: 'text-orange-400', icon: <Zap className="w-4 h-4" /> };
    case 'distressed':
      return { label: 'Distressed', color: 'text-red-400', icon: <AlertTriangle className="w-4 h-4" /> };
    default:
      return { label: 'Unknown', color: 'text-zinc-400', icon: <Info className="w-4 h-4" /> };
  }
}

function getConfidenceColor(level: string): string {
  switch (level) {
    case 'HIGH': return 'text-emerald-400';
    case 'MEDIUM': return 'text-yellow-400';
    case 'LOW': return 'text-red-400';
    default: return 'text-zinc-400';
  }
}

// ============ SUB-COMPONENTS ============

function ScoreGauge({ score, label, icon }: { score: number; label: string; icon: React.ReactNode }) {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-zinc-700"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className={cn(
                score >= 80 ? "stop-color-emerald-600" :
                score >= 60 ? "stop-color-blue-600" :
                score >= 40 ? "stop-color-yellow-600" :
                score >= 20 ? "stop-color-orange-600" : "stop-color-red-600"
              )} stopColor={
                score >= 80 ? "#059669" :
                score >= 60 ? "#2563eb" :
                score >= 40 ? "#ca8a04" :
                score >= 20 ? "#ea580c" : "#dc2626"
              } />
              <stop offset="100%" stopColor={
                score >= 80 ? "#34d399" :
                score >= 60 ? "#60a5fa" :
                score >= 40 ? "#fbbf24" :
                score >= 20 ? "#fb923c" : "#f87171"
              } />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Score value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-xl font-bold", getScoreColor(score))}>{score}</span>
        </div>
      </div>
      
      {/* Label */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-zinc-400">{icon}</span>
        <span className="text-xs text-zinc-400 font-medium">{label}</span>
      </div>
    </div>
  );
}

function PillarBar({ label, score, weight, icon }: { label: string; score: number; weight: number; icon: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">{icon}</span>
          <span className="text-xs text-zinc-400">{label}</span>
          <span className="text-[10px] text-zinc-600">({(weight * 100).toFixed(0)}%)</span>
        </div>
        <span className={cn("text-sm font-bold", getScoreColor(score))}>{score}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-700 bg-gradient-to-r", getScoreGradient(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function ShadowScores({ piotroski, altman }: { piotroski: number | null; altman: number | null }) {
  const piotroskiColor = piotroski !== null ? (
    piotroski >= 7 ? 'text-emerald-400' :
    piotroski >= 4 ? 'text-yellow-400' : 'text-red-400'
  ) : 'text-zinc-500';
  
  const altmanColor = altman !== null ? (
    altman >= 3 ? 'text-emerald-400' :
    altman >= 1.8 ? 'text-yellow-400' : 'text-red-400'
  ) : 'text-zinc-500';
  
  const altmanLabel = altman !== null ? (
    altman >= 3 ? 'Safe Zone' :
    altman >= 1.8 ? 'Gray Zone' : 'Distress Zone'
  ) : 'N/A';
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Piotroski F-Score */}
      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Piotroski F</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-2xl font-bold", piotroskiColor)}>
            {piotroski !== null ? piotroski : '—'}
          </span>
          <span className="text-xs text-zinc-500">/9</span>
        </div>
      </div>
      
      {/* Altman Z-Score */}
      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Altman Z</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-2xl font-bold", altmanColor)}>
            {altman !== null ? altman.toFixed(1) : '—'}
          </span>
        </div>
        <span className={cn("text-[10px]", altmanColor)}>{altmanLabel}</span>
      </div>
    </div>
  );
}

function StrengthsRisks({ strengths, risks }: { strengths: string[]; risks: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Strengths */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-zinc-400 uppercase tracking-wide">Strengths</span>
        </div>
        <ul className="space-y-1.5">
          {strengths.slice(0, 3).map((s, i) => (
            <li key={i} className="text-xs text-zinc-300 flex items-start gap-1.5">
              <span className="text-emerald-400 mt-0.5">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Risks */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-zinc-400 uppercase tracking-wide">Risks</span>
        </div>
        <ul className="space-y-1.5">
          {risks.slice(0, 3).map((r, i) => (
            <li key={i} className="text-xs text-zinc-300 flex items-start gap-1.5">
              <span className="text-red-400 mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============ COMPACT BADGE COMPONENT ============

export function FVSBadge({ score, className }: { score: number; className?: string }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-bold",
      getScoreBgColor(score),
      className
    )}>
      <BarChart3 className="w-3 h-3" />
      <span className={getScoreColor(score)}>{score.toFixed(0)}</span>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function FundamentalVigorScore({ assetId, symbol, className, compact = false }: FVSProps) {
  const [fvsData, setFvsData] = useState<FVSData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fetchFVS = async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    
    try {
      const endpoint = forceRefresh 
        ? `/api/fvs-api/score/${symbol}?refresh=true`
        : `/api/fvs-api/latest/${symbol}`;
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        if (response.status === 404 && !forceRefresh) {
          // No cached data, try to generate
          return fetchFVS(true);
        }
        throw new Error('Failed to fetch FVS');
      }
      
      const data = await response.json();
      setFvsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FVS');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchFVS();
  }, [assetId, symbol]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className={cn("bg-zinc-900 border border-zinc-700 rounded-xl p-4", className)}>
        <div className="flex items-center justify-center gap-2 text-zinc-400 py-8">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading Fundamental Vigor Score...</span>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !fvsData) {
    return (
      <div className={cn("bg-zinc-900 border border-zinc-700 rounded-xl p-4", className)}>
        <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-8">
          <AlertCircle className="w-8 h-8" />
          <span className="text-sm">{error || 'No FVS data available'}</span>
          <button 
            onClick={() => fetchFVS(true)}
            className="mt-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
          >
            Generate Score
          </button>
        </div>
      </div>
    );
  }
  
  const tier = getTierLabel(fvsData.qualityTier);
  
  // Compact view (for table cells)
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <FVSBadge score={fvsData.finalScore} />
        <span className={cn("text-xs", tier.color)}>{tier.label}</span>
      </div>
    );
  }
  
  // Full view
  return (
    <div className={cn("bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-white">Fundamental Vigor Score</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs", getConfidenceColor(fvsData.confidenceLevel))}>
              {fvsData.confidenceLevel} Confidence
            </span>
            <button 
              onClick={() => fetchFVS(true)}
              disabled={isRefreshing}
              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-400", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Score */}
      <div className="p-4 space-y-4">
        {/* Score and Tier */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center border-4",
                getScoreBgColor(fvsData.finalScore)
              )}>
                <span className={cn("text-3xl font-bold", getScoreColor(fvsData.finalScore))}>
                  {fvsData.finalScore.toFixed(0)}
                </span>
              </div>
            </div>
            <div>
              <div className={cn("flex items-center gap-2 text-lg font-bold", tier.color)}>
                {tier.icon}
                <span>{tier.label}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {fvsData.sector} • {fvsData.industry}
              </div>
            </div>
          </div>
        </div>
        
        {/* Four Pillars */}
        <div className="space-y-3">
          <PillarBar 
            label="Profitability" 
            score={fvsData.profitabilityScore} 
            weight={0.35}
            icon={<DollarSign className="w-3 h-3" />}
          />
          <PillarBar 
            label="Solvency" 
            score={fvsData.solvencyScore} 
            weight={0.25}
            icon={<Shield className="w-3 h-3" />}
          />
          <PillarBar 
            label="Growth" 
            score={fvsData.growthScore} 
            weight={0.20}
            icon={<TrendingUp className="w-3 h-3" />}
          />
          <PillarBar 
            label="Moat" 
            score={fvsData.moatScore} 
            weight={0.20}
            icon={<Award className="w-3 h-3" />}
          />
        </div>
        
        {/* Shadow Scores */}
        <ShadowScores 
          piotroski={fvsData.piotroskiFScore} 
          altman={fvsData.altmanZScore} 
        />
        
        {/* Expandable Details */}
        <div className="border-t border-zinc-700/50 pt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <span>View Analysis Details</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {isExpanded && (
            <div className="mt-3 space-y-4">
              {/* Reasoning */}
              <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs text-zinc-400 uppercase tracking-wide">AI Analysis</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {fvsData.finalReasoningParagraph}
                </p>
              </div>
              
              {/* Strengths & Risks */}
              <StrengthsRisks 
                strengths={fvsData.keyStrengths} 
                risks={fvsData.keyRisks} 
              />
              
              {/* Metadata */}
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span>As of: {fvsData.asOfDate}</span>
                <span>Data Quality: {(fvsData.dataQualityScore * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FundamentalVigorScore;

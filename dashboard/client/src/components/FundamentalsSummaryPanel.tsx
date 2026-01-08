import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Percent, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FundamentalsData {
  // Size & Growth
  market_cap?: number;
  revenue_ttm?: number;
  quarterly_revenue_growth_yoy?: number;
  quarterly_earnings_growth_yoy?: number;
  eps?: number;
  
  // Valuation
  pe_ratio?: number;
  forward_pe?: number;
  peg_ratio?: number;
  price_to_sales_ttm?: number;
  forward_price_to_sales?: number;
  price_to_book?: number;
  
  // Profitability
  profit_margin?: number;
  operating_margin_ttm?: number;
  return_on_equity_ttm?: number;
  return_on_assets_ttm?: number;
  
  // Other
  beta?: number;
  analyst_target_price?: number;
  week_52_low?: number;
  week_52_high?: number;
  dividend_yield?: number;
  
  // Meta
  name?: string;
  symbol?: string;
  sector?: string;
  industry?: string;
  last_updated?: string;
}

interface FundamentalsSummaryPanelProps {
  assetId: number | string;
  assetType: 'equity' | 'crypto';
  className?: string;
}

// Format large numbers with abbreviations
function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  if (Math.abs(value) >= 1e12) return (value / 1e12).toFixed(2) + 'T';
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (Math.abs(value) >= 1e3) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

// Format percentage
function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const pct = value * 100;
  return pct.toFixed(1) + '%';
}

// Format ratio (like P/E)
function formatRatio(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return value.toFixed(2);
}

// Color for percentage values
function getPercentColor(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'text-zinc-400';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-zinc-400';
}

// 52-week range bar component
function RangeBar({ low, high, current }: { low?: number; high?: number; current?: number }) {
  if (!low || !high) return <span className="text-zinc-500">—</span>;
  
  const range = high - low;
  const position = current ? Math.min(100, Math.max(0, ((current - low) / range) * 100)) : 50;
  
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[10px] text-zinc-500">${formatNumber(low)}</span>
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
      <span className="text-[10px] text-zinc-500">${formatNumber(high)}</span>
    </div>
  );
}

// Individual metric row
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
      "flex justify-between items-center py-1.5",
      highlight && "bg-zinc-800/30 -mx-2 px-2 rounded"
    )}>
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={cn("text-xs font-medium font-mono", valueColor)}>
        {value}
      </span>
    </div>
  );
}

export function FundamentalsSummaryPanel({ assetId, assetType, className }: FundamentalsSummaryPanelProps) {
  const [data, setData] = useState<FundamentalsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const fetchFundamentals = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/company-chat-api/fundamentals/${assetId}?asset_type=${assetType}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch fundamentals');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFundamentals();
  }, [assetId, assetType]);

  if (isLoading) {
    return (
      <div className={cn("bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-4", className)}>
        <div className="flex items-center gap-2 text-zinc-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading fundamentals...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn("bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-4", className)}>
        <div className="flex items-center gap-2 text-zinc-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Fundamentals unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 rounded-xl shadow-xl",
      className
    )}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/50 cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">Fundamentals</span>
          {data.sector && (
            <span className="text-[10px] px-2 py-0.5 bg-zinc-700/50 text-zinc-400 rounded-full">
              {data.sector}
            </span>
          )}
        </div>
        <button className="p-1 hover:bg-zinc-700/50 rounded transition-colors">
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Size & Growth */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Size & Growth
              </span>
            </div>
            <div className="space-y-0.5">
              <MetricRow label="Market Cap" value={'$' + formatNumber(data.market_cap)} />
              <MetricRow label="Revenue (TTM)" value={'$' + formatNumber(data.revenue_ttm)} />
              <MetricRow 
                label="Rev Growth" 
                value={formatPercent(data.quarterly_revenue_growth_yoy)} 
                isPercent 
              />
              <MetricRow 
                label="EPS Growth" 
                value={formatPercent(data.quarterly_earnings_growth_yoy)} 
                isPercent 
              />
            </div>
          </div>

          {/* Valuation */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Valuation
              </span>
            </div>
            <div className="space-y-0.5">
              <MetricRow 
                label="P/E (TTM)" 
                value={formatRatio(data.pe_ratio)} 
                highlight={data.pe_ratio !== undefined && data.pe_ratio < 15}
              />
              <MetricRow label="Forward P/E" value={formatRatio(data.forward_pe)} />
              <MetricRow 
                label="PEG" 
                value={formatRatio(data.peg_ratio)} 
                highlight={data.peg_ratio !== undefined && data.peg_ratio < 1}
              />
              <MetricRow label="P/S (TTM)" value={formatRatio(data.price_to_sales_ttm)} />
              <MetricRow label="Fwd P/S" value={formatRatio(data.forward_price_to_sales)} />
              <MetricRow label="P/B" value={formatRatio(data.price_to_book)} />
            </div>
          </div>

          {/* Profitability */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Profitability
              </span>
            </div>
            <div className="space-y-0.5">
              <MetricRow 
                label="Profit Margin" 
                value={formatPercent(data.profit_margin)} 
                isPercent 
              />
              <MetricRow 
                label="Op Margin" 
                value={formatPercent(data.operating_margin_ttm)} 
                isPercent 
              />
              <MetricRow 
                label="ROE" 
                value={formatPercent(data.return_on_equity_ttm)} 
                isPercent 
              />
            </div>
          </div>

          {/* Other */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Other
              </span>
            </div>
            <div className="space-y-0.5">
              <MetricRow label="Beta" value={formatRatio(data.beta)} />
              <MetricRow 
                label="Analyst Target" 
                value={data.analyst_target_price ? '$' + formatNumber(data.analyst_target_price) : '—'} 
              />
              {data.dividend_yield !== undefined && data.dividend_yield > 0 && (
                <MetricRow 
                  label="Div Yield" 
                  value={formatPercent(data.dividend_yield)} 
                  isPercent 
                />
              )}
            </div>
          </div>

          {/* 52-Week Range */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                52W Range
              </span>
            </div>
            <RangeBar 
              low={data.week_52_low} 
              high={data.week_52_high} 
            />
          </div>

          {/* Last Updated */}
          {data.last_updated && (
            <div className="pt-2 border-t border-zinc-700/30">
              <span className="text-[10px] text-zinc-500">
                Updated: {new Date(data.last_updated).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

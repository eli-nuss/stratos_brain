import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";

interface ListSummaryBoxProps {
  assets: any[];
  listName?: string;
}

// Helper functions for statistical calculations
function calculateMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateMarketCapWeightedAvg(assets: any[], field: string): number | null {
  const validAssets = assets.filter(a => 
    a.market_cap != null && 
    a.market_cap > 0 && 
    a[field] != null
  );
  
  if (validAssets.length === 0) return null;
  
  const totalMarketCap = validAssets.reduce((sum, a) => sum + a.market_cap, 0);
  const weightedSum = validAssets.reduce((sum, a) => sum + (a[field] * a.market_cap), 0);
  
  return weightedSum / totalMarketCap;
}

function getNumericValues(assets: any[], field: string): number[] {
  return assets
    .map(a => a[field])
    .filter((val): val is number => val != null && typeof val === 'number' && !isNaN(val));
}

// Format helpers
const formatPercent = (num: number | null) => {
  if (num === null) return "-";
  const pct = num * 100;
  const color = pct >= 0 ? "text-signal-bullish" : "text-signal-bearish";
  return <span className={color}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>;
};

const formatMarketCap = (num: number | null) => {
  if (num === null) return "-";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  return `$${num.toLocaleString()}`;
};

const formatNumber = (num: number | null, decimals: number = 1) => {
  if (num === null) return "-";
  return num.toFixed(decimals);
};

const formatScore = (num: number | null) => {
  if (num === null) return "-";
  const color = num > 0 ? "text-signal-bullish" : num < 0 ? "text-signal-bearish" : "text-muted-foreground";
  return <span className={color}>{num > 0 ? "+" : ""}{num.toFixed(0)}</span>;
};

// Column definitions for the summary table
const SUMMARY_COLUMNS = [
  { id: 'dir_score', label: 'Dir Score', field: 'ai_direction_score', format: 'score' },
  { id: 'market_cap', label: 'Mkt Cap', field: 'market_cap', format: 'marketcap' },
  { id: 'return_7d', label: '7d%', field: 'return_7d', format: 'percent' },
  { id: 'return_30d', label: '30d%', field: 'return_30d', format: 'percent' },
  { id: 'return_365d', label: '365d%', field: 'return_365d', format: 'percent' },
  { id: 'pe_ratio', label: 'P/E', field: 'pe_ratio', format: 'number', decimals: 1 },
  { id: 'forward_pe', label: 'Fwd P/E', field: 'forward_pe', format: 'number', decimals: 1 },
  { id: 'peg_ratio', label: 'PEG', field: 'peg_ratio', format: 'number', decimals: 2 },
  { id: 'price_to_sales', label: 'P/S', field: 'price_to_sales_ttm', format: 'number', decimals: 1 },
  { id: 'forward_ps', label: 'Fwd P/S', field: 'forward_ps', format: 'number', decimals: 1 },
  { id: 'psg', label: 'PSG', field: 'psg', format: 'number', decimals: 2 },
];

export default function ListSummaryBox({ assets, listName }: ListSummaryBoxProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate all summary statistics
  const summaryStats = useMemo(() => {
    if (!assets || assets.length === 0) return null;

    const stats: Record<string, { mean: number | null; median: number | null; mcWeighted: number | null }> = {};
    
    for (const col of SUMMARY_COLUMNS) {
      const values = getNumericValues(assets, col.field);
      stats[col.field] = {
        mean: calculateMean(values),
        median: calculateMedian(values),
        mcWeighted: calculateMarketCapWeightedAvg(assets, col.field)
      };
    }
    
    // Calculate total market cap
    const totalMarketCap = assets.reduce((sum, a) => sum + (a.market_cap || 0), 0);
    
    return {
      count: assets.length,
      totalMarketCap,
      stats
    };
  }, [assets]);

  if (!summaryStats) return null;

  // Format value based on column type
  const formatValue = (value: number | null, format: string, decimals?: number) => {
    switch (format) {
      case 'score':
        return formatScore(value);
      case 'marketcap':
        return formatMarketCap(value);
      case 'percent':
        return formatPercent(value);
      case 'number':
        return formatNumber(value, decimals);
      default:
        return value?.toString() ?? "-";
    }
  };

  const { stats, count, totalMarketCap } = summaryStats;

  return (
    <div className="mb-3 border border-border rounded-lg bg-muted/20 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">
            Summary Statistics
          </span>
          <span className="text-xs text-muted-foreground">
            ({count} assets • {formatMarketCap(totalMarketCap)} total)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Summary Table */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground w-28"></th>
                {SUMMARY_COLUMNS.map(col => (
                  <th key={col.id} className="px-2 py-1.5 text-center font-medium text-muted-foreground whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Raw Average Row */}
              <tr className="border-b border-border/30 hover:bg-muted/20">
                <td className="px-3 py-1.5 font-medium text-muted-foreground">Raw Avg.</td>
                {SUMMARY_COLUMNS.map(col => (
                  <td key={col.id} className="px-2 py-1.5 text-center font-mono">
                    {col.field === 'market_cap' 
                      ? formatMarketCap(stats[col.field]?.mean ?? null)
                      : formatValue(stats[col.field]?.mean ?? null, col.format, col.decimals)
                    }
                  </td>
                ))}
              </tr>
              
              {/* MC Weighted Average Row */}
              <tr className="border-b border-border/30 hover:bg-muted/20 bg-primary/5">
                <td className="px-3 py-1.5 font-medium text-primary">MC Wtd. Avg.</td>
                {SUMMARY_COLUMNS.map(col => (
                  <td key={col.id} className="px-2 py-1.5 text-center font-mono font-medium">
                    {col.field === 'market_cap' 
                      ? formatMarketCap(totalMarketCap)
                      : formatValue(stats[col.field]?.mcWeighted ?? null, col.format, col.decimals)
                    }
                  </td>
                ))}
              </tr>
              
              {/* Median Row */}
              <tr className="hover:bg-muted/20">
                <td className="px-3 py-1.5 font-medium text-muted-foreground">Median</td>
                {SUMMARY_COLUMNS.map(col => (
                  <td key={col.id} className="px-2 py-1.5 text-center font-mono">
                    {col.field === 'market_cap' 
                      ? formatMarketCap(stats[col.field]?.median ?? null)
                      : formatValue(stats[col.field]?.median ?? null, col.format, col.decimals)
                    }
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

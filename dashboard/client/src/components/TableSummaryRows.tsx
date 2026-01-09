import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { ColumnDef } from "@/hooks/useColumnConfig";

interface TableSummaryRowsProps {
  assets: any[];
  visibleColumns: ColumnDef[];
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

function calculateSum(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, val) => sum + val, 0);
}

// Column ID to data field mapping
const COLUMN_FIELD_MAP: Record<string, string> = {
  direction: 'ai_direction_score',
  quality: 'ai_setup_quality_score',
  market_cap: 'market_cap',
  price: 'close',
  return_1d: 'return_1d',
  return_7d: 'return_7d',
  return_30d: 'return_30d',
  return_365d: 'return_365d',
  volume_7d: 'dollar_volume_7d',
  volume_30d: 'dollar_volume_30d',
  pe_ratio: 'pe_ratio',
  forward_pe: 'forward_pe',
  peg_ratio: 'peg_ratio',
  price_to_sales: 'price_to_sales_ttm',
  forward_ps: 'forward_ps',
  psg: 'psg',
};

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

const formatPrice = (num: number | null) => {
  if (num === null) return "-";
  if (num >= 1000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  return `$${num.toPrecision(3)}`;
};

export default function TableSummaryRows({ assets, visibleColumns, listName }: TableSummaryRowsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate all summary statistics
  const summaryStats = useMemo(() => {
    if (!assets || assets.length === 0) return null;

    const stats: Record<string, { mean: number | null; median: number | null; mcWeighted: number | null; sum: number | null }> = {};
    
    for (const [colId, field] of Object.entries(COLUMN_FIELD_MAP)) {
      const values = getNumericValues(assets, field);
      stats[colId] = {
        mean: calculateMean(values),
        median: calculateMedian(values),
        mcWeighted: calculateMarketCapWeightedAvg(assets, field),
        sum: calculateSum(values)
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

  const { stats, count, totalMarketCap } = summaryStats;

  // Render a cell value based on column type and stat type
  const renderCell = (colId: string, statType: 'mean' | 'median' | 'mcWeighted') => {
    // Non-numeric columns
    if (colId === 'actions' || colId === 'asset' || colId === 'category' || colId === 'description' || colId === 'notes') {
      if (colId === 'asset' && statType === 'mean') {
        return (
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium">Raw Avg</span>
          </div>
        );
      }
      if (colId === 'asset' && statType === 'mcWeighted') {
        return (
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium text-primary">MC Wtd</span>
          </div>
        );
      }
      if (colId === 'asset' && statType === 'median') {
        return (
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3 text-primary" />
            <span className="text-xs font-medium">Median</span>
          </div>
        );
      }
      return "";
    }

    const stat = stats[colId];
    if (!stat) return "-";

    const value = stat[statType];

    // Format based on column type
    switch (colId) {
      case 'direction':
        return formatScore(value);
      case 'quality':
        return <span className="font-mono text-xs">{value != null ? Math.round(value) : "-"}</span>;
      case 'market_cap':
        // For market cap: show mean for Raw Avg, dash for MC Wtd (not applicable), median for Median
        if (statType === 'mcWeighted') {
          return <span className="font-mono text-xs text-muted-foreground">-</span>;
        }
        return <span className="font-mono text-xs">{formatMarketCap(value)}</span>;
      case 'price':
        return <span className="font-mono text-xs">{formatPrice(value)}</span>;
      case 'return_1d':
      case 'return_7d':
      case 'return_30d':
      case 'return_365d':
        return <span className="font-mono text-xs">{formatPercent(value)}</span>;
      case 'volume_7d':
      case 'volume_30d':
        // For volume: show MC weighted avg for MC Wtd row, mean/median for others
        return <span className="font-mono text-xs">{formatMarketCap(value)}</span>;
      case 'pe_ratio':
      case 'forward_pe':
        return <span className="font-mono text-xs">{formatNumber(value, 1)}</span>;
      case 'peg_ratio':
      case 'psg':
        return <span className="font-mono text-xs">{formatNumber(value, 2)}</span>;
      case 'price_to_sales':
      case 'forward_ps':
        return <span className="font-mono text-xs">{formatNumber(value, 1)}</span>;
      default:
        return "-";
    }
  };

  // Sticky row base styling - these rows stick below the page header and table header
  // Page header is ~140px, table header is ~28px = 168px base
  // Using fully opaque backgrounds so content is visible when scrolling
  const stickyBase = "sticky z-20";
  const baseRowClass = "border-b border-border text-xs";
  
  // Toggle row - sticks below table header (140px page header + 28px table header = 168px)
  const toggleRowClass = `${baseRowClass} ${stickyBase} top-[168px] bg-[#1e1e24] cursor-pointer hover:bg-[#2a2a32] transition-colors`;
  
  // Summary rows - stack below toggle row - fully opaque backgrounds
  const meanRowClass = `${baseRowClass} ${stickyBase} top-[192px] bg-[#18181c]`;
  const mcWeightedRowClass = `${baseRowClass} ${stickyBase} top-[216px] bg-[#0c1929]`;
  const medianRowClass = `${baseRowClass} ${stickyBase} top-[240px] bg-[#18181c]`;

  // Toggle row
  const toggleRow = (
    <tr 
      className={toggleRowClass}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <td colSpan={visibleColumns.length} className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Summary</span>
          <span className="text-xs text-muted-foreground">({count} assets • {formatMarketCap(totalMarketCap)} total)</span>
          <div className="ml-auto">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
      </td>
    </tr>
  );

  if (!isExpanded) {
    return toggleRow;
  }

  return (
    <>
      {toggleRow}
      {/* Raw Average Row */}
      <tr className={meanRowClass}>
        {visibleColumns.map((column) => (
          <td 
            key={column.id} 
            className={`px-2 py-1.5 bg-[#18181c] ${
              column.align === "center" ? "text-center" : 
              column.align === "right" ? "text-right" : "text-left"
            } ${column.sticky ? "sticky z-30" : ""}`}
            style={column.sticky && column.stickyOffset ? { left: column.stickyOffset } : undefined}
          >
            {renderCell(column.id, 'mean')}
          </td>
        ))}
      </tr>
      
      {/* MC Weighted Average Row */}
      <tr className={mcWeightedRowClass}>
        {visibleColumns.map((column) => (
          <td 
            key={column.id} 
            className={`px-2 py-1.5 font-medium bg-[#0c1929] ${
              column.align === "center" ? "text-center" : 
              column.align === "right" ? "text-right" : "text-left"
            } ${column.sticky ? "sticky z-30" : ""}`}
            style={column.sticky && column.stickyOffset ? { left: column.stickyOffset } : undefined}
          >
            {renderCell(column.id, 'mcWeighted')}
          </td>
        ))}
      </tr>
      
      {/* Median Row */}
      <tr className={medianRowClass}>
        {visibleColumns.map((column) => (
          <td 
            key={column.id} 
            className={`px-2 py-1.5 bg-[#18181c] ${
              column.align === "center" ? "text-center" : 
              column.align === "right" ? "text-right" : "text-left"
            } ${column.sticky ? "sticky z-30" : ""}`}
            style={column.sticky && column.stickyOffset ? { left: column.stickyOffset } : undefined}
          >
            {renderCell(column.id, 'median')}
          </td>
        ))}
      </tr>
      
      {/* Separator row */}
      <tr className="h-1 bg-border"></tr>
    </>
  );
}

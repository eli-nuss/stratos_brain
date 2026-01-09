import { useMemo } from "react";
import { ColumnDef } from "@/hooks/useColumnConfig";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart3 } from "lucide-react";

interface ListSummaryRowProps {
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

// Format helpers
const formatPercent = (num: number | null) => {
  if (num === null) return "-";
  const pct = num * 100;
  const color = pct >= 0 ? "text-signal-bullish" : "text-signal-bearish";
  return <span className={color}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>;
};

const formatMarketCap = (num: number | null) => {
  if (num === null) return "-";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return `$${num.toLocaleString()}`;
};

const formatVolume = (num: number | null) => {
  if (num === null) return "-";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

const formatNumber = (num: number | null, decimals: number = 1) => {
  if (num === null) return "-";
  return num.toFixed(decimals);
};

export default function ListSummaryRow({ assets, visibleColumns, listName }: ListSummaryRowProps) {
  // Calculate all summary statistics
  const summaryStats = useMemo(() => {
    if (!assets || assets.length === 0) return null;

    // Fields that should use market cap weighted average
    const mcWeightedFields = ['ai_direction_score', 'ai_setup_quality_score', 'return_1d', 'return_7d', 'return_30d', 'return_365d'];
    
    // Calculate stats for each numeric field
    const stats: Record<string, { mean: number | null; median: number | null; mcWeighted: number | null }> = {};
    
    const numericFields = [
      'ai_direction_score', 'ai_setup_quality_score', 'market_cap', 'close',
      'return_1d', 'return_7d', 'return_30d', 'return_365d',
      'dollar_volume_7d', 'dollar_volume_30d',
      'pe_ratio', 'forward_pe', 'peg_ratio', 'price_to_sales_ttm', 'forward_ps', 'psg'
    ];
    
    for (const field of numericFields) {
      const values = getNumericValues(assets, field);
      stats[field] = {
        mean: calculateMean(values),
        median: calculateMedian(values),
        mcWeighted: mcWeightedFields.includes(field) ? calculateMarketCapWeightedAvg(assets, field) : null
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

  // Render summary cell based on column ID
  const renderSummaryCell = (columnId: string) => {
    const { stats, count, totalMarketCap } = summaryStats;
    
    switch (columnId) {
      case "actions":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <span>List Summary ({count} assets)</span>
            </TooltipContent>
          </Tooltip>
        );
      case "asset":
        return (
          <div className="flex flex-col">
            <span className="font-medium text-primary text-xs">SUMMARY</span>
            <span className="text-xs text-muted-foreground">{count} assets</span>
          </div>
        );
      case "direction": {
        const mcw = stats.ai_direction_score?.mcWeighted;
        const mean = stats.ai_direction_score?.mean;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`font-mono text-xs font-medium ${
                (mcw ?? 0) > 0 ? "text-signal-bullish" : 
                (mcw ?? 0) < 0 ? "text-signal-bearish" : "text-muted-foreground"
              }`}>
                {mcw != null ? (mcw > 0 ? "+" : "") + mcw.toFixed(0) : "-"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>MC Weighted: {mcw?.toFixed(1) ?? "-"}</div>
              <div>Mean: {mean?.toFixed(1) ?? "-"}</div>
              <div>Median: {stats.ai_direction_score?.median?.toFixed(1) ?? "-"}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "quality": {
        const mcw = stats.ai_setup_quality_score?.mcWeighted;
        const mean = stats.ai_setup_quality_score?.mean;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`font-mono text-xs font-medium ${
                (mcw ?? 0) >= 70 ? "text-signal-bullish" :
                (mcw ?? 0) >= 40 ? "text-yellow-400" : "text-muted-foreground"
              }`}>
                {mcw != null ? mcw.toFixed(0) : "-"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>MC Weighted: {mcw?.toFixed(1) ?? "-"}</div>
              <div>Mean: {mean?.toFixed(1) ?? "-"}</div>
              <div>Median: {stats.ai_setup_quality_score?.median?.toFixed(1) ?? "-"}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "market_cap":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs font-medium">{formatMarketCap(totalMarketCap)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Total: {formatMarketCap(totalMarketCap)}</div>
              <div>Mean: {formatMarketCap(stats.market_cap?.mean ?? null)}</div>
              <div>Median: {formatMarketCap(stats.market_cap?.median ?? null)}</div>
            </TooltipContent>
          </Tooltip>
        );
      case "price": {
        const mean = stats.close?.mean;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">avg</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Mean: ${mean?.toFixed(2) ?? "-"}</div>
              <div>Median: ${stats.close?.median?.toFixed(2) ?? "-"}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "return_1d": {
        const mcw = stats.return_1d?.mcWeighted;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs font-medium">{formatPercent(mcw ?? null)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>MC Weighted: {mcw != null ? (mcw * 100).toFixed(2) + "%" : "-"}</div>
              <div>Mean: {stats.return_1d?.mean != null ? (stats.return_1d.mean * 100).toFixed(2) + "%" : "-"}</div>
              <div>Median: {stats.return_1d?.median != null ? (stats.return_1d.median * 100).toFixed(2) + "%" : "-"}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "return_7d": {
        const mcw = stats.return_7d?.mcWeighted;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs font-medium">{formatPercent(mcw ?? null)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>MC Weighted: {mcw != null ? (mcw * 100).toFixed(2) + "%" : "-"}</div>
              <div>Mean: {stats.return_7d?.mean != null ? (stats.return_7d.mean * 100).toFixed(2) + "%" : "-"}</div>
              <div>Median: {stats.return_7d?.median != null ? (stats.return_7d.median * 100).toFixed(2) + "%" : "-"}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "return_30d": {
        const mcw = stats.return_30d?.mcWeighted;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs font-medium">{formatPercent(mcw ?? null)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>MC Weighted: {mcw != null ? (mcw * 100).toFixed(2) + "%" : "-"}</div>
              <div>Mean: {stats.return_30d?.mean != null ? (stats.return_30d.mean * 100).toFixed(2) + "%" : "-"}</div>
              <div>Median: {stats.return_30d?.median != null ? (stats.return_30d.median * 100).toFixed(2) + "%" : "-"}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "return_365d": {
        const mcw = stats.return_365d?.mcWeighted;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs font-medium">{formatPercent(mcw ?? null)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>MC Weighted: {mcw != null ? (mcw * 100).toFixed(2) + "%" : "-"}</div>
              <div>Mean: {stats.return_365d?.mean != null ? (stats.return_365d.mean * 100).toFixed(2) + "%" : "-"}</div>
              <div>Median: {stats.return_365d?.median != null ? (stats.return_365d.median * 100).toFixed(2) + "%" : "-"}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "volume_7d": {
        const mean = stats.dollar_volume_7d?.mean;
        const total = assets.reduce((sum, a) => sum + (a.dollar_volume_7d || 0), 0);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatVolume(total)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Total: {formatVolume(total)}</div>
              <div>Mean: {formatVolume(mean ?? null)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "volume_30d": {
        const mean = stats.dollar_volume_30d?.mean;
        const total = assets.reduce((sum, a) => sum + (a.dollar_volume_30d || 0), 0);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatVolume(total)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Total: {formatVolume(total)}</div>
              <div>Mean: {formatVolume(mean ?? null)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "pe_ratio": {
        const mean = stats.pe_ratio?.mean;
        const median = stats.pe_ratio?.median;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatNumber(median, 1)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Mean: {formatNumber(mean, 1)}</div>
              <div>Median: {formatNumber(median, 1)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "forward_pe": {
        const mean = stats.forward_pe?.mean;
        const median = stats.forward_pe?.median;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatNumber(median, 1)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Mean: {formatNumber(mean, 1)}</div>
              <div>Median: {formatNumber(median, 1)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "peg_ratio": {
        const mean = stats.peg_ratio?.mean;
        const median = stats.peg_ratio?.median;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatNumber(median, 2)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Mean: {formatNumber(mean, 2)}</div>
              <div>Median: {formatNumber(median, 2)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "price_to_sales": {
        const mean = stats.price_to_sales_ttm?.mean;
        const median = stats.price_to_sales_ttm?.median;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatNumber(median, 2)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Mean: {formatNumber(mean, 2)}</div>
              <div>Median: {formatNumber(median, 2)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "forward_ps": {
        const mean = stats.forward_ps?.mean;
        const median = stats.forward_ps?.median;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatNumber(median, 2)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Mean: {formatNumber(mean, 2)}</div>
              <div>Median: {formatNumber(median, 2)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "psg": {
        const mean = stats.psg?.mean;
        const median = stats.psg?.median;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground">{formatNumber(median, 2)}</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <div>Mean: {formatNumber(mean, 2)}</div>
              <div>Median: {formatNumber(median, 2)}</div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "category":
      case "description":
      case "notes":
        return <span className="text-xs text-muted-foreground">-</span>;
      default:
        return <span className="text-xs text-muted-foreground">-</span>;
    }
  };

  return (
    <tr className="bg-primary/5 border-b-2 border-primary/20 hover:bg-primary/10 transition-colors">
      {visibleColumns.map((column) => (
        <td
          key={column.id}
          className={`px-2 py-2 ${
            column.sticky ? "sticky bg-primary/5" : ""
          }`}
          style={column.sticky && column.stickyOffset ? { left: column.stickyOffset } : {}}
        >
          <div className={`flex ${
            column.align === "center" ? "justify-center" : 
            column.align === "right" ? "justify-end" : "justify-start"
          }`}>
            {renderSummaryCell(column.id)}
          </div>
        </td>
      ))}
    </tr>
  );
}

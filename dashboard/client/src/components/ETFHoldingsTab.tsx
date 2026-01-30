import useSWR from "swr";
import { useState } from "react";
import { ArrowUpDown, TrendingUp, ExternalLink, Package, PieChart, DollarSign, Percent, Building2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetcher } from "@/lib/api-config";

interface ETFHoldingsTabProps {
  symbol: string;
  assetId: number;
  onHoldingClick?: (assetId: number) => void;
}

interface Holding {
  id: number;
  symbol: string | null;
  holding_name: string;
  weight_percent: number | null;
  shares_held: number | null;
  market_value: number | null;
  asset_id: number | null;
  is_tracked: boolean;
}

interface ETFInfo {
  name: string | null;
  expense_ratio: number | null;
  aum: number | null;
  holdings_count: number | null;
  sector_weightings: Record<string, number> | null;
}

export function ETFHoldingsTab({ symbol, assetId, onHoldingClick }: ETFHoldingsTabProps) {
  const [sortBy, setSortBy] = useState<'weight' | 'name' | 'value'>('weight');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);

  const { data: holdingsData, isLoading: holdingsLoading } = useSWR(
    `/api/dashboard/etf-holdings/${symbol}`,
    apiFetcher
  );

  const { data: infoData, isLoading: infoLoading } = useSWR(
    `/api/dashboard/etf-info/${symbol}`,
    apiFetcher
  );

  const holdings: Holding[] = holdingsData?.holdings || [];
  const info: ETFInfo | null = infoData?.info || null;
  const holdingsCount = infoData?.holdingsCount || holdings.length;
  const top10Concentration = infoData?.top10Concentration || 0;

  // Sort holdings
  const sortedHoldings = [...holdings].sort((a, b) => {
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'weight':
        return multiplier * ((a.weight_percent || 0) - (b.weight_percent || 0));
      case 'name':
        return multiplier * (a.holding_name || '').localeCompare(b.holding_name || '');
      case 'value':
        return multiplier * ((a.market_value || 0) - (b.market_value || 0));
      default:
        return 0;
    }
  });

  const displayedHoldings = showAll ? sortedHoldings : sortedHoldings.slice(0, 25);

  const toggleSort = (column: 'weight' | 'name' | 'value') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString();
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  };

  if (holdingsLoading || infoLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-muted/30 rounded-lg" />
        <div className="h-64 bg-muted/30 rounded-lg" />
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No holdings data available for {symbol}</p>
        <p className="text-sm mt-2">Holdings data may not be available for this ETF.</p>
      </div>
    );
  }

  // Calculate sector breakdown from holdings if available
  const sectorWeightings = info?.sector_weightings || {};

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-muted/20 rounded-lg p-3 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Package className="w-3.5 h-3.5" />
            Total Holdings
          </div>
          <div className="text-lg font-semibold">{holdingsCount}</div>
        </div>
        
        <div className="bg-muted/20 rounded-lg p-3 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <PieChart className="w-3.5 h-3.5" />
            Top 10 Concentration
          </div>
          <div className="text-lg font-semibold">{formatPercent(top10Concentration)}</div>
        </div>
        
        <div className="bg-muted/20 rounded-lg p-3 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Percent className="w-3.5 h-3.5" />
            Expense Ratio
          </div>
          <div className="text-lg font-semibold">
            {info?.expense_ratio ? `${(info.expense_ratio * 100).toFixed(2)}%` : '-'}
          </div>
        </div>
        
        <div className="bg-muted/20 rounded-lg p-3 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            AUM
          </div>
          <div className="text-lg font-semibold">{formatCurrency(info?.aum || null)}</div>
        </div>
      </div>

      {/* Sector Breakdown (if available) */}
      {Object.keys(sectorWeightings).length > 0 && (
        <div className="bg-muted/10 rounded-lg p-4 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm">Sector Breakdown</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(sectorWeightings)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .slice(0, 8)
              .map(([sector, weight]) => (
                <div key={sector} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate">{sector}</span>
                  <span className="font-mono">{formatPercent(weight as number)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Holdings Table */}
      <div className="bg-muted/10 rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h4 className="font-semibold text-sm">Holdings</h4>
          <span className="text-xs text-muted-foreground">
            Showing {displayedHoldings.length} of {holdings.length}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  <button 
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Holding
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                  <button 
                    onClick={() => toggleSort('weight')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    Weight
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">
                  Shares
                </th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                  <button 
                    onClick={() => toggleSort('value')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    Market Value
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-4 py-2 font-medium text-muted-foreground w-16">
                  Track
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedHoldings.map((holding, index) => (
                <tr 
                  key={holding.id || index}
                  className={`border-t border-border/50 hover:bg-muted/20 transition-colors ${
                    holding.is_tracked ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => {
                    if (holding.is_tracked && holding.asset_id && onHoldingClick) {
                      onHoldingClick(holding.asset_id);
                    }
                  }}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {holding.symbol && (
                        <span className="font-mono font-semibold text-primary">
                          {holding.symbol}
                        </span>
                      )}
                      <span className="text-muted-foreground truncate max-w-[200px]">
                        {holding.holding_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    <div className="flex items-center justify-end gap-2">
                      <div 
                        className="h-1.5 bg-primary/30 rounded-full"
                        style={{ width: `${Math.min((holding.weight_percent || 0) * 10, 100)}px` }}
                      />
                      <span className={holding.weight_percent && holding.weight_percent >= 1 ? 'font-semibold' : ''}>
                        {formatPercent(holding.weight_percent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground hidden md:table-cell">
                    {formatNumber(holding.shares_held)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatCurrency(holding.market_value)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {holding.is_tracked ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Tracked in Stratos - Click to view
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {holdings.length > 25 && (
          <div className="px-4 py-3 border-t border-border text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              {showAll ? 'Show Less' : `Show All ${holdings.length} Holdings`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ETFHoldingsTab;

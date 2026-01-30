import useSWR from "swr";
import { useState, useMemo } from "react";
import { ArrowUpDown, TrendingUp, TrendingDown, Package, PieChart, DollarSign, Percent, Building2, BarChart3, Activity, Calculator, Search, Filter, Target, ChevronDown, ChevronUp } from "lucide-react";
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
  // Enriched data
  sector: string | null;
  pe_ratio: number | null;
  ps_ratio: number | null;
  return_1d: number | null;
  return_5d: number | null;
  return_21d: number | null;
  return_63d: number | null;
  rs_vs_spy: number | null;
  setup_count: number;
  setup_names: string[];
}

interface ETFInfo {
  name: string | null;
  expense_ratio: number | null;
  aum: number | null;
  holdings_count: number | null;
  sector_weightings: Record<string, number> | null;
}

interface StatMetric {
  weighted_avg: number | null;
  median: number | null;
  count: number;
}

interface HoldingsStats {
  pe_ratio: StatMetric;
  ps_ratio: StatMetric;
  dividend_yield: StatMetric;
  revenue_growth_yoy: StatMetric;
  return_1d: StatMetric;
  return_5d: StatMetric;
  return_21d: StatMetric;
  return_63d: StatMetric;
  holdings_with_fundamentals: number;
  holdings_with_features: number;
  total_linked_holdings: number;
}

type SortField = 'weight' | 'name' | 'value' | 'return_1d' | 'return_5d' | 'return_21d' | 'return_63d' | 'pe_ratio' | 'ps_ratio' | 'rs_vs_spy' | 'setup_count';

export function ETFHoldingsTab({ symbol, assetId, onHoldingClick }: ETFHoldingsTabProps) {
  const [sortBy, setSortBy] = useState<SortField>('weight');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [onlyWithSetups, setOnlyWithSetups] = useState(false);

  const { data: holdingsData, isLoading: holdingsLoading } = useSWR(
    `/api/dashboard/etf-holdings/${symbol}`,
    apiFetcher
  );

  const { data: infoData, isLoading: infoLoading } = useSWR(
    `/api/dashboard/etf-info/${symbol}`,
    apiFetcher
  );

  const { data: statsData, isLoading: statsLoading } = useSWR(
    `/api/dashboard/etf-holdings-stats/${symbol}`,
    apiFetcher
  );

  const holdings: Holding[] = holdingsData?.holdings || [];
  const sectors: string[] = holdingsData?.sectors || [];
  const info: ETFInfo | null = infoData?.info || null;
  const holdingsCount = infoData?.holdingsCount || holdings.length;
  const top10Concentration = infoData?.top10Concentration || 0;
  const stats: HoldingsStats | null = statsData?.stats || null;

  // Filter and sort holdings
  const filteredAndSortedHoldings = useMemo(() => {
    let filtered = [...holdings];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(h => 
        (h.symbol?.toLowerCase().includes(query)) ||
        (h.holding_name?.toLowerCase().includes(query))
      );
    }
    
    // Apply sector filter
    if (sectorFilter !== 'all') {
      filtered = filtered.filter(h => h.sector === sectorFilter);
    }
    
    // Apply setups filter
    if (onlyWithSetups) {
      filtered = filtered.filter(h => h.setup_count > 0);
    }
    
    // Sort
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'weight':
          return multiplier * ((a.weight_percent || 0) - (b.weight_percent || 0));
        case 'name':
          return multiplier * (a.holding_name || '').localeCompare(b.holding_name || '');
        case 'value':
          return multiplier * ((a.market_value || 0) - (b.market_value || 0));
        case 'return_1d':
          return multiplier * ((a.return_1d || 0) - (b.return_1d || 0));
        case 'return_5d':
          return multiplier * ((a.return_5d || 0) - (b.return_5d || 0));
        case 'return_21d':
          return multiplier * ((a.return_21d || 0) - (b.return_21d || 0));
        case 'return_63d':
          return multiplier * ((a.return_63d || 0) - (b.return_63d || 0));
        case 'pe_ratio':
          return multiplier * ((a.pe_ratio || 999) - (b.pe_ratio || 999));
        case 'ps_ratio':
          return multiplier * ((a.ps_ratio || 999) - (b.ps_ratio || 999));
        case 'rs_vs_spy':
          return multiplier * ((a.rs_vs_spy || -999) - (b.rs_vs_spy || -999));
        case 'setup_count':
          return multiplier * ((a.setup_count || 0) - (b.setup_count || 0));
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [holdings, searchQuery, sectorFilter, onlyWithSetups, sortBy, sortOrder]);

  const displayedHoldings = showAll ? filteredAndSortedHoldings : filteredAndSortedHoldings.slice(0, 25);

  const toggleSort = (column: SortField) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'name' ? 'asc' : 'desc');
    }
  };

  const formatCurrency = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    if (numValue >= 1e12) return `$${(numValue / 1e12).toFixed(2)}T`;
    if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(2)}B`;
    if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(2)}M`;
    if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(2)}K`;
    return `$${numValue.toFixed(2)}`;
  };

  const formatNumber = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return numValue.toLocaleString();
  };

  const formatPercent = (value: number | null | undefined | string) => {
    if (value === null || value === undefined || value === '') return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return `${numValue.toFixed(2)}%`;
  };

  const formatRatio = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    if (isNaN(value)) return '-';
    return value.toFixed(2);
  };

  const formatReturnPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    if (isNaN(value)) return '-';
    const formatted = value.toFixed(2);
    return value >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const getReturnColor = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return 'text-muted-foreground';
    return value >= 0 ? 'text-emerald-500' : 'text-red-500';
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
            {info?.expense_ratio != null && !isNaN(Number(info.expense_ratio)) 
              ? `${(Number(info.expense_ratio) * 100).toFixed(2)}%` 
              : '-'}
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

      {/* Aggregated Holdings Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Valuation Metrics */}
          <div className="bg-muted/10 rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Valuation Metrics</h4>
              <span className="text-xs text-muted-foreground ml-auto">
                {stats.holdings_with_fundamentals} holdings with data
              </span>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-muted-foreground">Metric</div>
                <div className="text-muted-foreground text-right">Wtd Avg</div>
                <div className="text-muted-foreground text-right">Median</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm border-t border-border/50 pt-2">
                <div className="flex items-center gap-1">
                  <span>P/E Ratio</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs text-muted-foreground">({stats.pe_ratio.count})</span>
                    </TooltipTrigger>
                    <TooltipContent>Based on {stats.pe_ratio.count} holdings</TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-right font-mono">{formatRatio(stats.pe_ratio.weighted_avg)}</div>
                <div className="text-right font-mono text-muted-foreground">{formatRatio(stats.pe_ratio.median)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <span>P/S Ratio</span>
                  <span className="text-xs text-muted-foreground">({stats.ps_ratio.count})</span>
                </div>
                <div className="text-right font-mono">{formatRatio(stats.ps_ratio.weighted_avg)}</div>
                <div className="text-right font-mono text-muted-foreground">{formatRatio(stats.ps_ratio.median)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <span>Div Yield</span>
                  <span className="text-xs text-muted-foreground">({stats.dividend_yield.count})</span>
                </div>
                <div className="text-right font-mono">{formatPercent(stats.dividend_yield.weighted_avg)}</div>
                <div className="text-right font-mono text-muted-foreground">{formatPercent(stats.dividend_yield.median)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <span>Rev Growth YoY</span>
                  <span className="text-xs text-muted-foreground">({stats.revenue_growth_yoy.count})</span>
                </div>
                <div className={`text-right font-mono ${(stats.revenue_growth_yoy.weighted_avg || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatReturnPercent(stats.revenue_growth_yoy.weighted_avg)}
                </div>
                <div className={`text-right font-mono ${(stats.revenue_growth_yoy.median || 0) >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                  {formatReturnPercent(stats.revenue_growth_yoy.median)}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-muted/10 rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Holdings Performance</h4>
              <span className="text-xs text-muted-foreground ml-auto">
                {stats.holdings_with_features} holdings with data
              </span>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-muted-foreground">Timeframe</div>
                <div className="text-muted-foreground text-right">Wtd Avg</div>
                <div className="text-muted-foreground text-right">Median</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm border-t border-border/50 pt-2">
                <div className="flex items-center gap-1">
                  <span>1 Day</span>
                  <span className="text-xs text-muted-foreground">({stats.return_1d.count})</span>
                </div>
                <div className={`text-right font-mono ${(stats.return_1d.weighted_avg || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatReturnPercent(stats.return_1d.weighted_avg)}
                </div>
                <div className={`text-right font-mono ${(stats.return_1d.median || 0) >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                  {formatReturnPercent(stats.return_1d.median)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <span>5 Days</span>
                  <span className="text-xs text-muted-foreground">({stats.return_5d.count})</span>
                </div>
                <div className={`text-right font-mono ${(stats.return_5d.weighted_avg || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatReturnPercent(stats.return_5d.weighted_avg)}
                </div>
                <div className={`text-right font-mono ${(stats.return_5d.median || 0) >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                  {formatReturnPercent(stats.return_5d.median)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <span>1 Month</span>
                  <span className="text-xs text-muted-foreground">({stats.return_21d.count})</span>
                </div>
                <div className={`text-right font-mono ${(stats.return_21d.weighted_avg || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatReturnPercent(stats.return_21d.weighted_avg)}
                </div>
                <div className={`text-right font-mono ${(stats.return_21d.median || 0) >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                  {formatReturnPercent(stats.return_21d.median)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <span>3 Months</span>
                  <span className="text-xs text-muted-foreground">({stats.return_63d.count})</span>
                </div>
                <div className={`text-right font-mono ${(stats.return_63d.weighted_avg || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatReturnPercent(stats.return_63d.weighted_avg)}
                </div>
                <div className={`text-right font-mono ${(stats.return_63d.median || 0) >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                  {formatReturnPercent(stats.return_63d.median)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading state for stats */}
      {statsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-muted/30 rounded-lg animate-pulse" />
          <div className="h-48 bg-muted/30 rounded-lg animate-pulse" />
        </div>
      )}

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
        {/* Header with search and filters */}
        <div className="px-4 py-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Holdings</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Showing {displayedHoldings.length} of {filteredAndSortedHoldings.length}
                {filteredAndSortedHoldings.length !== holdings.length && ` (filtered from ${holdings.length})`}
              </span>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded-md transition-colors ${showFilters ? 'bg-primary/20 text-primary' : 'hover:bg-muted/50 text-muted-foreground'}`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Search and Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search holdings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-muted/30 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            {/* Sector Filter */}
            {showFilters && sectors.length > 0 && (
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-muted/30 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Sectors</option>
                {sectors.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            )}
            
            {/* Setups Filter */}
            {showFilters && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyWithSetups}
                  onChange={(e) => setOnlyWithSetups(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground">With Setups Only</span>
              </label>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/30">
                  <button 
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Holding
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground">
                  <button 
                    onClick={() => toggleSort('weight')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    Weight
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground">
                  <button 
                    onClick={() => toggleSort('return_1d')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    1D
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground hidden sm:table-cell">
                  <button 
                    onClick={() => toggleSort('return_5d')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    5D
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground hidden md:table-cell">
                  <button 
                    onClick={() => toggleSort('return_21d')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    1M
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground hidden lg:table-cell">
                  <button 
                    onClick={() => toggleSort('pe_ratio')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    P/E
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-2 py-2 font-medium text-muted-foreground hidden lg:table-cell">
                  <button 
                    onClick={() => toggleSort('rs_vs_spy')}
                    className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                  >
                    RS
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-2 py-2 font-medium text-muted-foreground">
                  <button 
                    onClick={() => toggleSort('setup_count')}
                    className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
                  >
                    <Target className="w-3 h-3" />
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
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
                  <td className="px-3 py-2 sticky left-0 bg-background">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {holding.symbol && (
                          <span className="font-mono font-semibold text-primary">
                            {holding.symbol}
                          </span>
                        )}
                        {holding.is_tracked && (
                          <TrendingUp className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-muted-foreground text-xs truncate max-w-[180px]">
                        {holding.holding_name}
                      </span>
                      {holding.sector && (
                        <span className="text-muted-foreground/60 text-[10px]">
                          {holding.sector}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    <div className="flex items-center justify-end gap-1">
                      <div 
                        className="h-1 bg-primary/30 rounded-full hidden sm:block"
                        style={{ width: `${Math.min((holding.weight_percent || 0) * 8, 60)}px` }}
                      />
                      <span className={holding.weight_percent && holding.weight_percent >= 1 ? 'font-semibold' : 'text-muted-foreground'}>
                        {formatPercent(holding.weight_percent)}
                      </span>
                    </div>
                  </td>
                  <td className={`px-2 py-2 text-right font-mono ${getReturnColor(holding.return_1d)}`}>
                    {formatReturnPercent(holding.return_1d)}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono hidden sm:table-cell ${getReturnColor(holding.return_5d)}`}>
                    {formatReturnPercent(holding.return_5d)}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono hidden md:table-cell ${getReturnColor(holding.return_21d)}`}>
                    {formatReturnPercent(holding.return_21d)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-muted-foreground hidden lg:table-cell">
                    {formatRatio(holding.pe_ratio)}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono hidden lg:table-cell ${
                    holding.rs_vs_spy != null 
                      ? holding.rs_vs_spy > 0 ? 'text-emerald-500' : 'text-red-500'
                      : 'text-muted-foreground'
                  }`}>
                    {holding.rs_vs_spy != null ? (holding.rs_vs_spy > 0 ? '+' : '') + holding.rs_vs_spy.toFixed(1) : '-'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {holding.setup_count > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-primary/20 text-primary rounded">
                            {holding.setup_count}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <div className="font-semibold mb-1">Active Setups:</div>
                            {holding.setup_names.map((name, i) => (
                              <div key={i}>{name}</div>
                            ))}
                          </div>
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
        
        {filteredAndSortedHoldings.length > 25 && (
          <div className="px-4 py-3 border-t border-border text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 mx-auto"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show All {filteredAndSortedHoldings.length} Holdings
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ETFHoldingsTab;

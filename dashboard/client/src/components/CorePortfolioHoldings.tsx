import { useState, useMemo, useRef, useEffect } from "react";
import { 
  Plus, X, Edit2, Save, ChevronDown, ChevronUp, 
  TrendingUp, TrendingDown, Activity, DollarSign, Search, Loader2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import useSWR from "swr";
import {
  useCorePortfolioHoldings,
  useCorePortfolioByCategory,
  addHolding,
  updateHolding,
  removeHolding,
  CorePortfolioHolding,
  PortfolioCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  AddHoldingInput,
} from "@/hooks/useCorePortfolioHoldings";

interface EditingState {
  id: number;
  field: string;
  value: string;
}

interface SearchResult {
  asset_id: number;
  symbol: string;
  name: string;
  close: number | null;
  market_cap: number | null;
  asset_type: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CorePortfolioHoldings({ onAssetClick }: { onAssetClick: (assetId: string) => void }) {
  const { holdings, isLoading, mutate } = useCorePortfolioHoldings();
  const { categories, categorySummaries, totalValue } = useCorePortfolioByCategory();
  
  const [expandedCategories, setExpandedCategories] = useState<Set<PortfolioCategory>>(
    new Set(CATEGORY_ORDER)
  );
  const [editing, setEditing] = useState<EditingState | null>(null);
  
  // Add entry state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMode, setAddMode] = useState<'search' | 'manual' | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [addingAssetId, setAddingAssetId] = useState<number | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  
  // Manual entry state
  const [newHolding, setNewHolding] = useState<Partial<AddHoldingInput>>({
    category: 'other',
    quantity: 0,
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
        setAddMode(null);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search results
  const { data: cryptoData, isLoading: cryptoLoading } = useSWR<{ data: SearchResult[] }>(
    debouncedQuery.length >= 1
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=crypto_top_500&limit=10`
      : null,
    fetcher
  );

  const { data: equityData, isLoading: equityLoading } = useSWR<{ data: SearchResult[] }>(
    debouncedQuery.length >= 1
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=equity_all&limit=10`
      : null,
    fetcher
  );

  const searchLoading = cryptoLoading || equityLoading;
  
  // Combine and dedupe results
  const searchResults = useMemo(() => {
    const results: SearchResult[] = [];
    const seenIds = new Set<number>();
    const allResults = [...(cryptoData?.data || []), ...(equityData?.data || [])];
    
    allResults.sort((a, b) => {
      const queryLower = debouncedQuery.toLowerCase();
      const aSymbol = a.symbol.toLowerCase();
      const bSymbol = b.symbol.toLowerCase();
      if (aSymbol === queryLower && bSymbol !== queryLower) return -1;
      if (bSymbol === queryLower && aSymbol !== queryLower) return 1;
      if (aSymbol.startsWith(queryLower) && !bSymbol.startsWith(queryLower)) return -1;
      if (bSymbol.startsWith(queryLower) && !aSymbol.startsWith(queryLower)) return 1;
      return (b.market_cap || 0) - (a.market_cap || 0);
    });

    for (const item of allResults) {
      if (!seenIds.has(item.asset_id)) {
        seenIds.add(item.asset_id);
        results.push(item);
      }
    }
    return results.slice(0, 15);
  }, [cryptoData, equityData, debouncedQuery]);

  const existingAssetIds = useMemo(() => 
    new Set(holdings.filter(h => h.asset_id).map(h => h.asset_id as number)),
    [holdings]
  );

  // Calculate portfolio summary with defensive array check
  const summary = useMemo(() => {
    const safeHoldings = Array.isArray(holdings) ? holdings : [];
    const totalCost = safeHoldings.reduce((sum, h) => sum + (h.total_cost || 0), 0);
    const totalVal = safeHoldings.reduce((sum, h) => sum + (h.current_value || 0), 0);
    const gainLoss = totalVal - totalCost;
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
    return { totalCost, totalValue: totalVal, gainLoss, gainLossPct };
  }, [holdings]);

  const toggleCategory = (category: PortfolioCategory) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleAddFromSearch = async (asset: SearchResult) => {
    setAddingAssetId(asset.asset_id);
    const category: PortfolioCategory = asset.asset_type === 'crypto' ? 'tokens' : 'equities';
    
    try {
      await addHolding({
        asset_id: asset.asset_id,
        category,
        quantity: 0,
      });
      mutate();
    } catch (error) {
      console.error('Failed to add holding:', error);
    } finally {
      setAddingAssetId(null);
    }
  };

  const handleAddManual = async () => {
    if (!newHolding.custom_symbol || !newHolding.category) return;
    
    try {
      await addHolding({
        custom_symbol: newHolding.custom_symbol,
        custom_name: newHolding.custom_name || newHolding.custom_symbol,
        custom_asset_type: newHolding.custom_asset_type || 'other',
        category: newHolding.category,
        quantity: newHolding.quantity || 0,
        cost_basis: newHolding.cost_basis,
        total_cost: newHolding.total_cost,
        manual_price: newHolding.manual_price,
        notes: newHolding.notes,
        strike_price: newHolding.strike_price,
        expiration_date: newHolding.expiration_date,
        option_type: newHolding.option_type,
      });
      mutate();
      setShowAddMenu(false);
      setAddMode(null);
      setNewHolding({ category: 'other', quantity: 0 });
    } catch (error) {
      console.error('Failed to add manual holding:', error);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await removeHolding(id);
      mutate();
    } catch (error) {
      console.error('Failed to remove holding:', error);
    }
  };

  const startEditing = (id: number, field: string, currentValue: string | number | null) => {
    setEditing({ id, field, value: String(currentValue ?? '') });
  };

  const saveEditing = async () => {
    if (!editing) return;
    
    try {
      const updateData: Record<string, unknown> = {
        id: editing.id,
        [editing.field]: editing.field === 'notes' ? editing.value : parseFloat(editing.value) || null,
      };
      await updateHolding(updateData as any);
      mutate();
      setEditing(null);
    } catch (error) {
      console.error('Failed to update holding:', error);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | null, decimals = 2) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getPercentColor = (value: number | null) => {
    if (value === null || value === undefined) return 'text-muted-foreground';
    return value >= 0 ? 'text-signal-bullish' : 'text-signal-bearish';
  };

  const formatPrice = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num < 0.0001) return num.toExponential(2);
    if (num < 1) return `$${num.toFixed(4)}`;
    if (num < 100) return `$${num.toFixed(2)}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatMarketCap = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "";
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
    return "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal-bullish"></span>
            Core Portfolio
            <span className="text-sm font-normal text-muted-foreground">
              ({holdings.length} positions)
            </span>
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Value: <span className="text-foreground font-mono">{formatCurrency(summary.totalValue)}</span>
            </span>
            <span className="text-muted-foreground">
              Cost: <span className="text-foreground font-mono">{formatCurrency(summary.totalCost)}</span>
            </span>
            <span className={getPercentColor(summary.gainLossPct)}>
              <span className="font-mono">{formatPercent(summary.gainLossPct)}</span>
              <span className="text-muted-foreground ml-1">
                ({formatCurrency(summary.gainLoss)})
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Portfolio Table by Category */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8"></th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Quantity</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost Basis</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Cost</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Price</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Value</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Gain/Loss</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Weight</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Notes</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map(category => {
              const categoryHoldings = categories[category];
              if (categoryHoldings.length === 0) return null;
              
              const catSummary = categorySummaries.find(s => s.category === category);
              const isExpanded = expandedCategories.has(category);
              
              return (
                <tbody key={category}>
                  {/* Category Header Row */}
                  <tr 
                    className="bg-muted/20 cursor-pointer hover:bg-muted/30"
                    onClick={() => toggleCategory(category)}
                  >
                    <td className="px-3 py-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold" colSpan={3}>
                      {CATEGORY_LABELS[category]}
                      <span className="text-muted-foreground font-normal ml-2">
                        ({categoryHoldings.length})
                      </span>
                    </td>
                    <td className="text-right px-3 py-2 font-mono">
                      {formatCurrency(catSummary?.category_cost || 0)}
                    </td>
                    <td className="text-right px-3 py-2"></td>
                    <td className="text-right px-3 py-2 font-mono">
                      {formatCurrency(catSummary?.category_value || 0)}
                    </td>
                    <td className={`text-right px-3 py-2 font-mono ${getPercentColor(catSummary?.category_gain_loss_pct || 0)}`}>
                      {formatPercent(catSummary?.category_gain_loss_pct || 0)}
                    </td>
                    <td className="text-right px-3 py-2 font-mono text-muted-foreground">
                      {formatPercent(catSummary?.weight_pct || 0)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                  
                  {/* Holdings Rows */}
                  {isExpanded && categoryHoldings.map((holding) => {
                    const weight = totalValue > 0 ? ((holding.current_value || 0) / totalValue) * 100 : 0;
                    
                    return (
                      <tr key={holding.id} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span 
                              className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                                holding.asset_type === 'crypto' 
                                  ? 'text-orange-400 bg-orange-400/10' 
                                  : 'text-blue-400 bg-blue-400/10'
                              }`}
                            >
                              {holding.asset_type === 'crypto' ? 'C' : 'E'}
                            </span>
                            <div>
                              <span 
                                className="font-mono font-medium cursor-pointer hover:text-primary"
                                onClick={() => holding.asset_id && onAssetClick(String(holding.asset_id))}
                              >
                                {holding.symbol}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {holding.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="text-right px-3 py-2">
                          {editing?.id === holding.id && editing.field === 'quantity' ? (
                            <input
                              type="number"
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={saveEditing}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                              className="w-24 px-1 py-0.5 bg-background border border-primary rounded text-sm text-right font-mono"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="font-mono cursor-pointer hover:text-primary"
                              onClick={() => startEditing(holding.id, 'quantity', holding.quantity)}
                            >
                              {formatNumber(holding.quantity, 4)}
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2">
                          {editing?.id === holding.id && editing.field === 'cost_basis' ? (
                            <input
                              type="number"
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={saveEditing}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                              className="w-24 px-1 py-0.5 bg-background border border-primary rounded text-sm text-right font-mono"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="font-mono cursor-pointer hover:text-primary"
                              onClick={() => startEditing(holding.id, 'cost_basis', holding.cost_basis)}
                            >
                              {formatPrice(holding.cost_basis)}
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2 font-mono">
                          {formatCurrency(holding.total_cost)}
                        </td>
                        <td className="text-right px-3 py-2">
                          {holding.manual_price !== null ? (
                            editing?.id === holding.id && editing.field === 'manual_price' ? (
                              <input
                                type="number"
                                value={editing.value}
                                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                onBlur={saveEditing}
                                onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                className="w-24 px-1 py-0.5 bg-background border border-primary rounded text-sm text-right font-mono"
                                autoFocus
                              />
                            ) : (
                              <span 
                                className="font-mono cursor-pointer hover:text-primary"
                                onClick={() => startEditing(holding.id, 'manual_price', holding.manual_price)}
                                title="Manual price (click to edit)"
                              >
                                {formatPrice(holding.manual_price)}*
                              </span>
                            )
                          ) : (
                            <span className="font-mono">
                              {formatPrice(holding.current_price)}
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2 font-mono">
                          {formatCurrency(holding.current_value)}
                        </td>
                        <td className={`text-right px-3 py-2 font-mono ${getPercentColor(holding.gain_loss_pct)}`}>
                          {formatPercent(holding.gain_loss_pct)}
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-muted-foreground">
                          {formatPercent(weight)}
                        </td>
                        <td className="px-3 py-2">
                          {editing?.id === holding.id && editing.field === 'notes' ? (
                            <input
                              type="text"
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={saveEditing}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                              className="w-full px-1 py-0.5 bg-background border border-primary rounded text-sm"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="text-xs text-muted-foreground cursor-pointer hover:text-foreground truncate block max-w-[150px]"
                              onClick={() => startEditing(holding.id, 'notes', holding.notes)}
                              title={holding.notes || 'Click to add notes'}
                            >
                              {holding.notes || '-'}
                            </span>
                          )}
                        </td>
                        <td className="text-center px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            {holding.asset_id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={`/chat?asset_id=${holding.asset_id}&symbol=${encodeURIComponent(holding.symbol || '')}&name=${encodeURIComponent(holding.name || '')}&asset_type=${holding.asset_type || 'equity'}`}
                                    className="p-1 rounded hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                                  >
                                    <Activity className="w-3.5 h-3.5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>Research chat</TooltipContent>
                              </Tooltip>
                            )}
                            <button
                              onClick={() => handleRemove(holding.id)}
                              className="p-1 text-muted-foreground hover:text-signal-bearish transition-colors"
                              title="Remove position"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </tbody>
        </table>
        
        {/* Add Entry Row - Always visible at bottom of table */}
        <div ref={addMenuRef}>
          <div className="border-t border-border">
            <button
              onClick={() => {
                setShowAddMenu(!showAddMenu);
                setAddMode(null);
                setSearchQuery("");
              }}
              className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
          
          {/* Add Menu - Inline below button */}
          {showAddMenu && (
            <div className="border-t border-border bg-muted/10">
              {!addMode && (
                <div className="p-2 flex gap-2">
                  <button
                    onClick={() => setAddMode('search')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search Database</span>
                  </button>
                  <button
                    onClick={() => setAddMode('manual')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Manual Entry</span>
                  </button>
                </div>
              )}
              
              {/* Search Mode */}
              {addMode === 'search' && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setAddMode(null)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium">Search Database</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by symbol or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                  
                  {/* Search Results */}
                  {searchQuery.length >= 1 && (
                    <div className="mt-2 max-h-64 overflow-auto">
                      {searchLoading && searchResults.length === 0 ? (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Searching...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="py-4 text-center text-muted-foreground text-sm">
                          No assets found for "{searchQuery}"
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {searchResults.map((asset) => {
                            const isInPortfolio = existingAssetIds.has(asset.asset_id);
                            const isAdding = addingAssetId === asset.asset_id;
                            
                            return (
                              <div
                                key={asset.asset_id}
                                className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 rounded-lg transition-colors"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span
                                    className={`text-[9px] px-1 py-0.5 rounded font-medium shrink-0 ${
                                      asset.asset_type === "crypto"
                                        ? "text-orange-400 bg-orange-400/10"
                                        : "text-blue-400 bg-blue-400/10"
                                    }`}
                                  >
                                    {asset.asset_type === "crypto" ? "C" : "E"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium text-foreground text-sm">
                                        {asset.symbol}
                                      </span>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {asset.name}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="text-xs font-mono text-foreground">
                                      {formatPrice(asset.close)}
                                    </div>
                                    {asset.market_cap && (
                                      <div className="text-[10px] text-muted-foreground">
                                        {formatMarketCap(asset.market_cap)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => !isInPortfolio && !isAdding && handleAddFromSearch(asset)}
                                  disabled={isInPortfolio || isAdding}
                                  className={`ml-2 p-1.5 rounded transition-colors shrink-0 ${
                                    isInPortfolio
                                      ? "text-signal-bullish bg-signal-bullish/10 cursor-default"
                                      : isAdding
                                      ? "text-muted-foreground cursor-wait"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                  }`}
                                >
                                  {isAdding ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : isInPortfolio ? (
                                    <span className="text-xs">Added</span>
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Manual Entry Mode */}
              {addMode === 'manual' && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setAddMode(null)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium">Manual Entry</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Symbol *</label>
                      <input
                        type="text"
                        value={newHolding.custom_symbol || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, custom_symbol: e.target.value })}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        placeholder="e.g., BTC-CALL"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Name</label>
                      <input
                        type="text"
                        value={newHolding.custom_name || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, custom_name: e.target.value })}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        placeholder="e.g., BTC Jan Call"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Category *</label>
                      <select
                        value={newHolding.category}
                        onChange={(e) => setNewHolding({ ...newHolding, category: e.target.value as PortfolioCategory })}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                      >
                        {CATEGORY_ORDER.map(cat => (
                          <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Quantity</label>
                      <input
                        type="number"
                        value={newHolding.quantity || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Cost Basis</label>
                      <input
                        type="number"
                        value={newHolding.cost_basis || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, cost_basis: parseFloat(e.target.value) || undefined })}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        placeholder="Per unit cost"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Manual Price</label>
                      <input
                        type="number"
                        value={newHolding.manual_price || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, manual_price: parseFloat(e.target.value) || undefined })}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        placeholder="Current price"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Notes</label>
                      <input
                        type="text"
                        value={newHolding.notes || ''}
                        onChange={(e) => setNewHolding({ ...newHolding, notes: e.target.value })}
                        className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        placeholder="Optional notes..."
                      />
                    </div>
                  </div>
                  
                  {/* Options fields if category is options */}
                  {newHolding.category === 'options' && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Strike Price</label>
                        <input
                          type="number"
                          value={newHolding.strike_price || ''}
                          onChange={(e) => setNewHolding({ ...newHolding, strike_price: parseFloat(e.target.value) || undefined })}
                          className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Expiration</label>
                        <input
                          type="date"
                          value={newHolding.expiration_date || ''}
                          onChange={(e) => setNewHolding({ ...newHolding, expiration_date: e.target.value })}
                          className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Option Type</label>
                        <select
                          value={newHolding.option_type || ''}
                          onChange={(e) => setNewHolding({ ...newHolding, option_type: e.target.value })}
                          className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                        >
                          <option value="">Select...</option>
                          <option value="call">Call</option>
                          <option value="put">Put</option>
                        </select>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => {
                        setAddMode(null);
                        setNewHolding({ category: 'other', quantity: 0 });
                      }}
                      className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddManual}
                      disabled={!newHolding.custom_symbol}
                      className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                    >
                      Add Position
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {holdings.length === 0 && !showAddMenu && (
          <div className="text-center py-12 text-muted-foreground border-t border-border">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No positions in portfolio</p>
            <p className="text-sm mt-1">Click "Add Entry" below to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo, useRef, useEffect } from "react";
import React from "react";
import { 
  Plus, X, ChevronDown, ChevronUp, 
  Activity, Search, Loader2, AlertCircle, DollarSign
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import useSWR from "swr";
import {
  useModelPortfolioHoldings,
  useModelPortfolioByCategory,
  addModelHolding,
  updateModelHolding,
  removeModelHolding,
  ModelPortfolioHolding,
  PortfolioCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  AddHoldingInput,
} from "@/hooks/useModelPortfolioHoldings";

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

export default function ModelPortfolioHoldings({ onAssetClick }: { onAssetClick: (assetId: string) => void }) {
  const { holdings, isLoading: holdingsLoading, mutate } = useModelPortfolioHoldings();
  const { categories, categorySummaries, corePortfolioValue, totalWeight, isLoading } = useModelPortfolioByCategory();
  
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
    target_weight: 0,
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
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=crypto_all&limit=10`
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
      await addModelHolding({
        asset_id: asset.asset_id,
        category,
        target_weight: 0, // User will set the weight after adding
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
      await addModelHolding({
        custom_symbol: newHolding.custom_symbol,
        custom_name: newHolding.custom_name || newHolding.custom_symbol,
        custom_asset_type: newHolding.custom_asset_type || 'other',
        category: newHolding.category,
        target_weight: newHolding.target_weight || 0,
        manual_price: newHolding.manual_price,
        notes: newHolding.notes,
        strike_price: newHolding.strike_price,
        expiration_date: newHolding.expiration_date,
        option_type: newHolding.option_type,
      });
      mutate();
      setShowAddMenu(false);
      setAddMode(null);
      setNewHolding({ category: 'other', target_weight: 0 });
    } catch (error) {
      console.error('Failed to add manual holding:', error);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await removeModelHolding(id);
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
      await updateModelHolding(updateData as any);
      mutate();
      setEditing(null);
    } catch (error) {
      console.error('Failed to update holding:', error);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number | null | undefined, decimals = 4) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
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

  const remainingWeight = 100 - totalWeight;

  return (
    <div className="space-y-4">
      {/* Header with Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Model Portfolio
            <span className="text-sm font-normal text-muted-foreground">
              ({holdings.length} positions)
            </span>
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              Base Value: <span className="text-foreground font-mono">{formatCurrency(corePortfolioValue)}</span>
              <span className="text-xs text-muted-foreground ml-1">(from Core)</span>
            </span>
            <span className="text-muted-foreground">
              Allocated: <span className={`font-mono ${totalWeight > 100 ? 'text-signal-bearish' : 'text-foreground'}`}>
                {formatPercent(totalWeight)}
              </span>
            </span>
            {remainingWeight !== 0 && (
              <span className={`font-mono ${remainingWeight < 0 ? 'text-signal-bearish' : 'text-signal-bullish'}`}>
                {remainingWeight > 0 ? `+${formatPercent(remainingWeight)} unallocated` : `${formatPercent(remainingWeight)} over`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Warning if no Core Portfolio value */}
      {corePortfolioValue === 0 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Add positions to your Core Portfolio first to set the base value for modeling.</span>
        </div>
      )}

      {/* Portfolio Table by Category */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8"></th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Weight %</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Target Value</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Price</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Target Qty</th>
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
                <React.Fragment key={category}>
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
                    <td className="px-3 py-2 font-semibold">
                      {CATEGORY_LABELS[category]}
                      <span className="text-muted-foreground font-normal ml-2">
                        ({categoryHoldings.length})
                      </span>
                    </td>
                    <td className="text-right px-3 py-2 font-mono font-semibold">
                      {formatPercent(catSummary?.target_weight_pct || 0)}
                    </td>
                    <td className="text-right px-3 py-2 font-mono">
                      {formatCurrency(catSummary?.target_value || 0)}
                    </td>
                    <td className="text-right px-3 py-2"></td>
                    <td className="text-right px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                  
                  {/* Holdings Rows */}
                  {isExpanded && categoryHoldings.map((holding) => (
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
                        {editing?.id === holding.id && editing.field === 'target_weight' ? (
                          <input
                            type="number"
                            step="0.1"
                            className="w-20 px-2 py-1 bg-background border border-border rounded text-right font-mono"
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            onBlur={saveEditing}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-mono cursor-pointer hover:text-primary"
                            onClick={() => startEditing(holding.id, 'target_weight', holding.target_weight)}
                          >
                            {formatPercent(holding.target_weight)}
                          </span>
                        )}
                      </td>
                      <td className="text-right px-3 py-2 font-mono text-muted-foreground">
                        {formatCurrency(holding.target_value)}
                      </td>
                      <td className="text-right px-3 py-2 font-mono">
                        {formatPrice(holding.current_price || holding.manual_price)}
                      </td>
                      <td className="text-right px-3 py-2 font-mono text-muted-foreground">
                        {formatNumber(holding.target_quantity)}
                      </td>
                      <td className="px-3 py-2">
                        {editing?.id === holding.id && editing.field === 'notes' ? (
                          <input
                            type="text"
                            className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            onBlur={saveEditing}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="text-xs text-muted-foreground cursor-pointer hover:text-primary truncate block max-w-[150px]"
                            onClick={() => startEditing(holding.id, 'notes', holding.notes)}
                          >
                            {holding.notes || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={`/chat?asset=${holding.symbol}`}
                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Activity className="w-4 h-4" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>Research Chat</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-signal-bearish"
                                onClick={() => handleRemove(holding.id)}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Remove</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            
            {/* Add Entry Row */}
            <tr className="border-t border-border">
              <td colSpan={8} className="p-0">
                <div ref={addMenuRef}>
                  <button
                    className="w-full px-3 py-3 text-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center justify-center gap-2"
                    onClick={() => setShowAddMenu(!showAddMenu)}
                  >
                    <Plus className="w-4 h-4" />
                    Add Entry
                  </button>
                  
                  {/* Expanded Add Menu */}
                  {showAddMenu && (
                    <div className="border-t border-border bg-muted/10">
                      {/* Mode Selection */}
                      {!addMode && (
                        <div className="grid grid-cols-2 divide-x divide-border">
                          <button
                            className="px-4 py-3 hover:bg-muted/30 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                            onClick={() => setAddMode('search')}
                          >
                            <Search className="w-4 h-4" />
                            Search Database
                          </button>
                          <button
                            className="px-4 py-3 hover:bg-muted/30 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                            onClick={() => setAddMode('manual')}
                          >
                            <Plus className="w-4 h-4" />
                            Manual Entry
                          </button>
                        </div>
                      )}
                      
                      {/* Search Mode */}
                      {addMode === 'search' && (
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => { setAddMode(null); setSearchQuery(""); }}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <span className="font-medium">Search Database</span>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Search by symbol or name..."
                              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              autoFocus
                            />
                          </div>
                          
                          {/* Search Results */}
                          {searchLoading && (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          
                          {!searchLoading && searchResults.length > 0 && (
                            <div className="max-h-64 overflow-y-auto space-y-1">
                              {searchResults.map((result) => {
                                const isAdded = existingAssetIds.has(result.asset_id);
                                const isAdding = addingAssetId === result.asset_id;
                                
                                return (
                                  <div
                                    key={result.asset_id}
                                    className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 rounded-lg"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span 
                                        className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                                          result.asset_type === 'crypto' 
                                            ? 'text-orange-400 bg-orange-400/10' 
                                            : 'text-blue-400 bg-blue-400/10'
                                        }`}
                                      >
                                        {result.asset_type === 'crypto' ? 'C' : 'E'}
                                      </span>
                                      <span className="font-mono font-medium">{result.symbol}</span>
                                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                        {result.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <div className="font-mono text-sm">{formatPrice(result.close)}</div>
                                        <div className="text-xs text-muted-foreground">{formatMarketCap(result.market_cap)}</div>
                                      </div>
                                      {isAdded ? (
                                        <span className="text-xs text-signal-bullish px-2 py-1 bg-signal-bullish/10 rounded">
                                          Added
                                        </span>
                                      ) : (
                                        <button
                                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary disabled:opacity-50"
                                          onClick={() => handleAddFromSearch(result)}
                                          disabled={isAdding}
                                        >
                                          {isAdding ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Plus className="w-4 h-4" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {!searchLoading && debouncedQuery.length >= 1 && searchResults.length === 0 && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              No results found for "{debouncedQuery}"
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Manual Entry Mode */}
                      {addMode === 'manual' && (
                        <div className="p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => setAddMode(null)}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <span className="font-medium">Manual Entry</span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Symbol *</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                                placeholder="BTC"
                                value={newHolding.custom_symbol || ''}
                                onChange={(e) => setNewHolding({ ...newHolding, custom_symbol: e.target.value.toUpperCase() })}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Name</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                                placeholder="Bitcoin"
                                value={newHolding.custom_name || ''}
                                onChange={(e) => setNewHolding({ ...newHolding, custom_name: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Category *</label>
                              <select
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                                value={newHolding.category || 'other'}
                                onChange={(e) => setNewHolding({ ...newHolding, category: e.target.value as PortfolioCategory })}
                              >
                                {CATEGORY_ORDER.map(cat => (
                                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Target Weight %</label>
                              <input
                                type="number"
                                step="0.1"
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                                placeholder="0"
                                value={newHolding.target_weight || ''}
                                onChange={(e) => setNewHolding({ ...newHolding, target_weight: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs text-muted-foreground block mb-1">Manual Price</label>
                              <input
                                type="number"
                                step="0.01"
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                                placeholder="0.00"
                                value={newHolding.manual_price || ''}
                                onChange={(e) => setNewHolding({ ...newHolding, manual_price: parseFloat(e.target.value) || undefined })}
                              />
                            </div>
                            <div className="col-span-2 md:col-span-3">
                              <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 bg-background border border-border rounded"
                                placeholder="Optional notes..."
                                value={newHolding.notes || ''}
                                onChange={(e) => setNewHolding({ ...newHolding, notes: e.target.value })}
                              />
                            </div>
                          </div>
                          
                          {/* Options fields */}
                          {newHolding.category === 'options' && (
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Strike Price</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full px-3 py-2 bg-background border border-border rounded"
                                  value={newHolding.strike_price || ''}
                                  onChange={(e) => setNewHolding({ ...newHolding, strike_price: parseFloat(e.target.value) || undefined })}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Expiration</label>
                                <input
                                  type="date"
                                  className="w-full px-3 py-2 bg-background border border-border rounded"
                                  value={newHolding.expiration_date || ''}
                                  onChange={(e) => setNewHolding({ ...newHolding, expiration_date: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Type</label>
                                <select
                                  className="w-full px-3 py-2 bg-background border border-border rounded"
                                  value={newHolding.option_type || ''}
                                  onChange={(e) => setNewHolding({ ...newHolding, option_type: e.target.value })}
                                >
                                  <option value="">Select...</option>
                                  <option value="call">Call</option>
                                  <option value="put">Put</option>
                                </select>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex justify-end">
                            <button
                              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                              onClick={handleAddManual}
                              disabled={!newHolding.custom_symbol}
                            >
                              Add Position
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        
        {/* Empty State */}
        {holdings.length === 0 && !showAddMenu && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <DollarSign className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">No positions in model portfolio</p>
            <p className="text-sm">Click "Add Entry" to start building your model</p>
          </div>
        )}
      </div>
    </div>
  );
}


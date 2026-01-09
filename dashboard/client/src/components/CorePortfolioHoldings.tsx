import { useState, useMemo } from "react";
import { 
  Plus, X, Edit2, Save, ChevronDown, ChevronUp, 
  TrendingUp, TrendingDown, Activity, DollarSign
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AssetSearchDropdown from "@/components/AssetSearchDropdown";
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

export default function CorePortfolioHoldings({ onAssetClick }: { onAssetClick: (assetId: string) => void }) {
  const { holdings, isLoading, mutate } = useCorePortfolioHoldings();
  const { categories, categorySummaries, totalValue } = useCorePortfolioByCategory();
  
  const [expandedCategories, setExpandedCategories] = useState<Set<PortfolioCategory>>(
    new Set(CATEGORY_ORDER)
  );
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [newHolding, setNewHolding] = useState<Partial<AddHoldingInput>>({
    category: 'other',
    quantity: 0,
  });

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

  const handleAddFromSearch = async (asset: { asset_id: number; symbol: string; name: string; asset_type: string }) => {
    // Determine category based on asset type
    let category: PortfolioCategory = 'other';
    if (asset.asset_type === 'crypto') {
      category = 'tokens';
    } else if (asset.asset_type === 'equity') {
      category = 'equities';
    }
    
    try {
      await addHolding({
        asset_id: asset.asset_id,
        category,
        quantity: 0,
      });
      mutate();
    } catch (error) {
      console.error('Failed to add holding:', error);
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
      setShowAddManual(false);
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
        
        <div className="flex items-center gap-2">
          <AssetSearchDropdown
            existingAssetIds={new Set(holdings.filter(h => h.asset_id).map(h => h.asset_id as number))}
            onAddAsset={async (assetId: number) => {
              // Find the asset info from the search results (we'll fetch it)
              try {
                const res = await fetch(`/api/dashboard/asset/${assetId}`);
                const asset = await res.json();
                const category: PortfolioCategory = asset.asset_type === 'crypto' ? 'tokens' : 'equities';
                await addHolding({
                  asset_id: assetId,
                  category,
                  quantity: 0,
                });
                mutate();
              } catch (error) {
                console.error('Failed to add holding:', error);
              }
            }}
            placeholder="Search to add..."
          />
          <button
            onClick={() => setShowAddManual(!showAddManual)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Manual Entry
          </button>
        </div>
      </div>

      {/* Manual Entry Form */}
      {showAddManual && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-medium">Add Manual Position</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Symbol *</label>
              <input
                type="text"
                value={newHolding.custom_symbol || ''}
                onChange={(e) => setNewHolding({ ...newHolding, custom_symbol: e.target.value })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                placeholder="e.g., BTC-CALL-125"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                type="text"
                value={newHolding.custom_name || ''}
                onChange={(e) => setNewHolding({ ...newHolding, custom_name: e.target.value })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                placeholder="e.g., BTC Jan 26 Call"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category *</label>
              <select
                value={newHolding.category}
                onChange={(e) => setNewHolding({ ...newHolding, category: e.target.value as PortfolioCategory })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
              >
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={newHolding.custom_asset_type || 'other'}
                onChange={(e) => setNewHolding({ ...newHolding, custom_asset_type: e.target.value })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
              >
                <option value="equity">Equity</option>
                <option value="crypto">Crypto</option>
                <option value="option">Option</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Quantity</label>
              <input
                type="number"
                value={newHolding.quantity || ''}
                onChange={(e) => setNewHolding({ ...newHolding, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cost Basis</label>
              <input
                type="number"
                value={newHolding.cost_basis || ''}
                onChange={(e) => setNewHolding({ ...newHolding, cost_basis: parseFloat(e.target.value) || undefined })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                placeholder="Per unit cost"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Total Cost</label>
              <input
                type="number"
                value={newHolding.total_cost || ''}
                onChange={(e) => setNewHolding({ ...newHolding, total_cost: parseFloat(e.target.value) || undefined })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                placeholder="Or enter total"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Current Price</label>
              <input
                type="number"
                value={newHolding.manual_price || ''}
                onChange={(e) => setNewHolding({ ...newHolding, manual_price: parseFloat(e.target.value) || undefined })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                placeholder="Manual price"
              />
            </div>
            {(newHolding.category === 'options') && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Strike Price</label>
                  <input
                    type="number"
                    value={newHolding.strike_price || ''}
                    onChange={(e) => setNewHolding({ ...newHolding, strike_price: parseFloat(e.target.value) || undefined })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Expiration</label>
                  <input
                    type="date"
                    value={newHolding.expiration_date || ''}
                    onChange={(e) => setNewHolding({ ...newHolding, expiration_date: e.target.value })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Option Type</label>
                  <select
                    value={newHolding.option_type || ''}
                    onChange={(e) => setNewHolding({ ...newHolding, option_type: e.target.value })}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="call">Call</option>
                    <option value="put">Put</option>
                  </select>
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <input
                type="text"
                value={newHolding.notes || ''}
                onChange={(e) => setNewHolding({ ...newHolding, notes: e.target.value })}
                className="w-full px-2 py-1 bg-background border border-border rounded text-sm"
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddManual(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleAddManual}
              disabled={!newHolding.custom_symbol}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              Add Position
            </button>
          </div>
        </div>
      )}

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
                  {isExpanded && categoryHoldings.map(holding => {
                    const weight = totalValue > 0 ? ((holding.current_value || 0) / totalValue) * 100 : 0;
                    
                    return (
                      <tr 
                        key={holding.id}
                        className="border-t border-border/50 hover:bg-muted/10"
                      >
                        <td className="px-3 py-2"></td>
                        <td 
                          className="px-3 py-2 cursor-pointer"
                          onClick={() => holding.asset_id && onAssetClick(String(holding.asset_id))}
                        >
                          <div className="flex flex-col">
                            <span className="font-mono font-medium">{holding.symbol}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {holding.name}
                            </span>
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
                              className="w-20 px-1 py-0.5 bg-background border border-primary rounded text-right text-sm"
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
                              className="w-20 px-1 py-0.5 bg-background border border-primary rounded text-right text-sm"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="font-mono text-muted-foreground cursor-pointer hover:text-primary"
                              onClick={() => startEditing(holding.id, 'cost_basis', holding.cost_basis)}
                            >
                              {holding.cost_basis ? `$${formatNumber(holding.cost_basis)}` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2">
                          {editing?.id === holding.id && editing.field === 'total_cost' ? (
                            <input
                              type="number"
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={saveEditing}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                              className="w-24 px-1 py-0.5 bg-background border border-primary rounded text-right text-sm"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="font-mono cursor-pointer hover:text-primary"
                              onClick={() => startEditing(holding.id, 'total_cost', holding.total_cost)}
                            >
                              {formatCurrency(holding.total_cost)}
                            </span>
                          )}
                        </td>
                        <td className="text-right px-3 py-2">
                          {editing?.id === holding.id && editing.field === 'manual_price' ? (
                            <input
                              type="number"
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={saveEditing}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                              className="w-20 px-1 py-0.5 bg-background border border-primary rounded text-right text-sm"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className={`font-mono cursor-pointer hover:text-primary ${holding.manual_price ? 'text-yellow-400' : ''}`}
                              onClick={() => startEditing(holding.id, 'manual_price', holding.manual_price || holding.current_price)}
                              title={holding.manual_price ? 'Manual price override' : 'Click to set manual price'}
                            >
                              {holding.current_price ? `$${formatNumber(holding.current_price)}` : '-'}
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
        
        {holdings.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No positions in portfolio</p>
            <p className="text-sm mt-1">Add assets from the search or create manual entries</p>
          </div>
        )}
      </div>
    </div>
  );
}

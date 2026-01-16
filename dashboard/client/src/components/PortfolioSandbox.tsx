import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Play, Save, X, RotateCcw, AlertTriangle, TrendingUp, 
  Activity, BarChart3, Percent, ChevronDown, ChevronUp,
  Calculator, Zap, Shield, Plus, Search, Loader2, AlertCircle, DollarSign, Wallet, Brain, Clock, PieChart, AlertTriangle as StressIcon, BookOpen
} from "lucide-react";
import { RebalanceCalculator } from "./RebalanceCalculator";
import { CorrelationMatrix } from "./CorrelationMatrix";
import { ScenarioSimulator } from "./ScenarioSimulator";
import { RiskAttribution } from "./RiskAttribution";
import { TimeTravelBacktester } from "./TimeTravelBacktester";
import { AIInvestmentCommittee } from "./AIInvestmentCommittee";
import { RiskMetricsExplainer } from "./RiskMetricsExplainer";
import { RiskSettings, RiskSettingsSummary, RiskSettingsValues, DEFAULT_RISK_SETTINGS } from "./RiskSettings";
import useSWR from 'swr';
import { 
  useModelPortfolioHoldings,
  useModelPortfolioByCategory,
  addModelHolding,
  updateModelHolding,
  removeModelHolding,
  ModelPortfolioHolding,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PortfolioCategory,
  AddHoldingInput,
} from "@/hooks/useModelPortfolioHoldings";
import { useCorePortfolioValue } from "@/hooks/useModelPortfolioHoldings";

interface PortfolioSandboxProps {
  onAssetClick?: (assetId: string) => void;
}

interface RiskMetrics {
  volatility: number;
  beta: number;
  sharpeRatio: number;
  maxDrawdown: number;
  diversificationScore: number;
}

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

import { apiFetcher } from "@/lib/api-config";

export function PortfolioSandbox({ onAssetClick }: PortfolioSandboxProps) {
  const { holdings, isLoading: holdingsLoading, mutate } = useModelPortfolioHoldings();
  const { categories, categorySummaries, corePortfolioValue, totalWeight, isLoading } = useModelPortfolioByCategory();
  
  const [activeTab, setActiveTab] = useState<'holdings' | 'sandbox' | 'rebalance' | 'analytics' | 'ai' | 'learn'>('holdings');
  const [expandedCategories, setExpandedCategories] = useState<Set<PortfolioCategory>>(
    new Set(CATEGORY_ORDER)
  );
  const [editing, setEditing] = useState<EditingState | null>(null);
  
  // Sandbox mode state
  const [isEditing, setIsEditing] = useState(false);
  const [draftWeights, setDraftWeights] = useState<{ [id: number]: number }>({});
  
  // Add entry state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMode, setAddMode] = useState<'search' | 'manual' | 'cash' | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [addingAssetId, setAddingAssetId] = useState<number | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  
  // Manual entry state
  const [newHolding, setNewHolding] = useState<Partial<AddHoldingInput>>({
    category: 'other',
    target_weight: 0,
  });
  
  // Cash entry state
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashNotes, setCashNotes] = useState<string>('');
  
  // Risk settings state
  const [riskSettings, setRiskSettings] = useState<RiskSettingsValues>(DEFAULT_RISK_SETTINGS);

  // Fetch risk metrics from backend
  const assetIds = holdings.map(h => h.asset_id).filter(Boolean).join(',');
  const riskQueryParams = new URLSearchParams({
    asset_ids: assetIds,
    lookback_days: String(riskSettings.lookbackDays),
    risk_free_rate: String(riskSettings.riskFreeRate),
    annualization_factor: String(riskSettings.annualizationFactor),
    benchmark: riskSettings.benchmark,
  }).toString();
  const { data: riskData } = useSWR<{ metrics: RiskMetrics; correlationMatrix: number[][] }>(
    assetIds ? `/api/dashboard/portfolio-risk?${riskQueryParams}` : null,
    apiFetcher
  );

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

  // Initialize draft weights from holdings
  useEffect(() => {
    const weights: { [id: number]: number } = {};
    holdings.forEach(h => {
      weights[h.id] = h.target_weight || 0;
    });
    setDraftWeights(weights);
  }, [holdings]);

  // Search results
  const { data: cryptoData, isLoading: cryptoLoading } = useSWR<{ data: SearchResult[] }>(
    debouncedQuery.length >= 1
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=crypto_all&limit=10`
      : null,
    apiFetcher
  );

  const { data: equityData, isLoading: equityLoading } = useSWR<{ data: SearchResult[] }>(
    debouncedQuery.length >= 1
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=equity_all&limit=10`
      : null,
    apiFetcher
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

  // Calculate totals
  const draftTotalWeight = useMemo(() => 
    Object.values(draftWeights).reduce((sum, w) => sum + w, 0),
    [draftWeights]
  );

  const hasChanges = useMemo(() => {
    return holdings.some(h => draftWeights[h.id] !== (h.target_weight || 0));
  }, [holdings, draftWeights]);

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
        target_weight: 0,
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

  const handleAddCash = async () => {
    if (cashAmount <= 0) return;
    
    // Calculate cash weight as percentage of core portfolio
    const cashWeight = corePortfolioValue > 0 ? (cashAmount / corePortfolioValue) * 100 : 0;
    
    try {
      await addModelHolding({
        custom_symbol: 'CASH',
        custom_name: 'Cash Position',
        custom_asset_type: 'cash',
        category: 'cash',
        target_weight: cashWeight,
        manual_price: 1, // Cash is always $1
        notes: cashNotes || `$${cashAmount.toLocaleString()} cash position`,
      });
      mutate();
      setShowAddMenu(false);
      setAddMode(null);
      setCashAmount(0);
      setCashNotes('');
    } catch (error) {
      console.error('Failed to add cash position:', error);
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

  const handleWeightChange = (holdingId: number, newWeight: number[]) => {
    setDraftWeights(prev => ({ ...prev, [holdingId]: newWeight[0] }));
  };

  const handleSaveWeights = async () => {
    try {
      const updates = holdings.filter(h => draftWeights[h.id] !== (h.target_weight || 0));
      await Promise.all(
        updates.map(h => 
          updateModelHolding({ id: h.id, target_weight: draftWeights[h.id] })
        )
      );
      mutate();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save weights:', error);
    }
  };

  const handleResetWeights = () => {
    const weights: { [id: number]: number } = {};
    holdings.forEach(h => {
      weights[h.id] = h.target_weight || 0;
    });
    setDraftWeights(weights);
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

  // Prepare data for rebalance calculator
  const rebalanceHoldings = holdings.map(h => ({
    symbol: h.symbol || h.custom_symbol || 'Unknown',
    name: h.name || h.custom_name || '',
    assetId: h.asset_id || 0,
    quantity: 0,
    price: h.current_price || h.manual_price || 0,
    currentValue: corePortfolioValue * ((h.target_weight || 0) / 100),
    currentWeight: h.target_weight || 0,
  }));

  const targetWeights = Object.fromEntries(
    holdings.map(h => [h.symbol || h.custom_symbol || '', draftWeights[h.id] || 0])
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const remainingWeight = 100 - totalWeight;
  const displayTotalWeight = activeTab === 'sandbox' && isEditing ? draftTotalWeight : totalWeight;

  // Use real risk metrics from backend - show null/loading state if not available
  const riskMetrics: RiskMetrics | null = riskData?.metrics || null;
  const isRiskLoading = assetIds && !riskData;
  
  // Extract real volatilities and betas from API response
  const assetVolatilities: Record<string, number> = riskData?.assetVolatilities || {};
  const assetBetas: Record<string, number> = riskData?.assetBetas || {};

  return (
    <div className="space-y-4">
      {/* Header with Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
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
            <Badge variant={displayTotalWeight > 100 ? "destructive" : displayTotalWeight < 100 ? "secondary" : "default"}>
              {formatPercent(displayTotalWeight)} Allocated
            </Badge>
            {remainingWeight !== 0 && activeTab === 'holdings' && (
              <span className={`font-mono text-sm ${remainingWeight < 0 ? 'text-red-500' : 'text-green-500'}`}>
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="holdings" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Holdings
            </TabsTrigger>
            <TabsTrigger value="sandbox" className="gap-2">
              <Play className="w-4 h-4" />
              Sandbox
            </TabsTrigger>
            <TabsTrigger value="rebalance" className="gap-2">
              <Calculator className="w-4 h-4" />
              Rebalance
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Brain className="w-4 h-4" />
              AI Review
            </TabsTrigger>
            <TabsTrigger value="learn" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Learn
            </TabsTrigger>
          </TabsList>

          {/* Sandbox mode controls */}
          {activeTab === 'sandbox' && (
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  <Play className="w-4 h-4 mr-1" />
                  Adjust Weights
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleResetWeights} disabled={!hasChanges}>
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { handleResetWeights(); setIsEditing(false); }}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveWeights} disabled={!hasChanges}>
                    <Save className="w-4 h-4 mr-1" />
                    Save Model
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Holdings Tab - Full CRUD functionality */}
        <TabsContent value="holdings" className="mt-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-8"></th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asset</th>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground cursor-help">Weight %</th>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Target allocation percentage for this asset in your model portfolio. Click to edit.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground cursor-help">Target Value</th>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Dollar amount to hold based on your Core Portfolio value and target weight. Target Value = Core Portfolio × Weight %.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground cursor-help">Price</th>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Current market price from live data. For manual entries, you can set a custom price.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground cursor-help">Target Qty</th>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Number of shares/units to buy to reach your target value. Target Qty = Target Value ÷ Price.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground cursor-help">Notes</th>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Personal notes about this position (thesis, entry criteria, etc.). Click to edit.</p>
                    </TooltipContent>
                  </Tooltip>
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
                                    : holding.asset_type === 'cash' || holding.category === 'cash'
                                    ? 'text-green-400 bg-green-400/10'
                                    : 'text-blue-400 bg-blue-400/10'
                                }`}
                              >
                                {holding.asset_type === 'crypto' ? 'C' : holding.asset_type === 'cash' || holding.category === 'cash' ? '$' : 'E'}
                              </span>
                              <div>
                                <span 
                                  className="font-mono font-medium cursor-pointer hover:text-primary"
                                  onClick={() => holding.asset_id && onAssetClick?.(String(holding.asset_id))}
                                >
                                  {holding.symbol || holding.custom_symbol}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {holding.name || holding.custom_name}
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
                                  <button
                                    className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-red-500"
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
                            <div className="grid grid-cols-3 divide-x divide-border">
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
                              <button
                                className="px-4 py-3 hover:bg-muted/30 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                                onClick={() => setAddMode('cash')}
                              >
                                <Wallet className="w-4 h-4" />
                                Add Cash
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
                                            <span className="text-xs text-green-500 px-2 py-1 bg-green-500/10 rounded">
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
                          
                          {/* Cash Entry Mode */}
                          {addMode === 'cash' && (
                            <div className="p-4 space-y-4">
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => setAddMode(null)}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <span className="font-medium">Add Cash Position</span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">Cash Amount ($)</label>
                                  <input
                                    type="number"
                                    step="100"
                                    className="w-full px-3 py-2 bg-background border border-border rounded"
                                    placeholder="10000"
                                    value={cashAmount || ''}
                                    onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                                    autoFocus
                                  />
                                  {corePortfolioValue > 0 && cashAmount > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      = {((cashAmount / corePortfolioValue) * 100).toFixed(2)}% of portfolio
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-border rounded"
                                    placeholder="Emergency fund, dry powder, etc."
                                    value={cashNotes}
                                    onChange={(e) => setCashNotes(e.target.value)}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex justify-end">
                                <button
                                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                                  onClick={handleAddCash}
                                  disabled={cashAmount <= 0}
                                >
                                  Add Cash Position
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
        </TabsContent>

        {/* Sandbox Tab - Interactive weight adjustment */}
        <TabsContent value="sandbox" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Allocation Panel */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CardTitle className="text-base cursor-help">Asset Allocation</CardTitle>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Adjust target weights for each asset using the sliders. Changes are applied in real-time for what-if analysis. Click "Save Model" to persist changes.</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="text-sm text-muted-foreground">
                      {isEditing && (
                        <Badge variant={draftTotalWeight > 100 ? "destructive" : draftTotalWeight < 100 ? "secondary" : "default"}>
                          {formatPercent(draftTotalWeight)} Allocated
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {CATEGORY_ORDER.map(category => {
                    const categoryHoldings = categories[category];
                    if (categoryHoldings.length === 0) return null;
                    
                    const isExpanded = expandedCategories.has(category);
                    const categoryWeight = categoryHoldings.reduce((sum, h) => 
                      sum + (isEditing ? (draftWeights[h.id] || 0) : (h.target_weight || 0)), 0
                    );

                    return (
                      <div key={category} className="border rounded-lg overflow-hidden">
                        {/* Category Header */}
                        <div 
                          className="flex items-center justify-between px-4 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCategory(category)}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            <span className="font-semibold">{CATEGORY_LABELS[category]}</span>
                            <span className="text-muted-foreground text-sm">({categoryHoldings.length})</span>
                          </div>
                          <div className="font-mono font-medium">{formatPercent(categoryWeight)}</div>
                        </div>

                        {/* Holdings */}
                        {isExpanded && (
                          <div className="divide-y">
                            {categoryHoldings.map(holding => {
                              const currentWeight = isEditing ? draftWeights[holding.id] : (holding.target_weight || 0);
                              const targetValue = corePortfolioValue * (currentWeight / 100);

                              return (
                                <div key={holding.id} className="px-4 py-3 hover:bg-muted/10">
                                  <div className="flex items-center gap-4">
                                    {/* Asset Info */}
                                    <div className="w-24">
                                      <div 
                                        className="font-mono font-medium cursor-pointer hover:text-primary"
                                        onClick={() => holding.asset_id && onAssetClick?.(String(holding.asset_id))}
                                      >
                                        {holding.symbol || holding.custom_symbol}
                                      </div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        {holding.name || holding.custom_name}
                                      </div>
                                    </div>

                                    {/* Slider or Bar */}
                                    <div className="flex-1">
                                      {isEditing ? (
                                        <Slider 
                                          value={[currentWeight]} 
                                          max={50} 
                                          step={0.5} 
                                          onValueChange={(val) => handleWeightChange(holding.id, val)}
                                          className="cursor-pointer"
                                        />
                                      ) : (
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-primary transition-all duration-300" 
                                            style={{ width: `${Math.min(currentWeight * 2, 100)}%` }}
                                          />
                                        </div>
                                      )}
                                    </div>

                                    {/* Weight Display */}
                                    <div className="w-16 text-right font-mono font-medium">
                                      {formatPercent(currentWeight)}
                                    </div>

                                    {/* Target Value */}
                                    <div className="w-24 text-right text-sm text-muted-foreground font-mono">
                                      {formatCurrency(targetValue)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {holdings.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No positions in model portfolio. Add assets in the Holdings tab to get started.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Correlation Matrix */}
              <CorrelationMatrix
                holdings={holdings}
                correlationData={riskData?.correlationMatrix}
              />
            </div>

            {/* Risk Metrics Panel */}
            <div className="space-y-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CardTitle className="text-sm uppercase text-muted-foreground flex items-center gap-2 cursor-help">
                          <Shield className="w-4 h-4" />
                          Risk Metrics
                        </CardTitle>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Key risk indicators for your portfolio. These metrics help you understand the risk profile and potential volatility of your allocation.</p>
                      </TooltipContent>
                    </Tooltip>
                    <RiskSettings settings={riskSettings} onChange={setRiskSettings} compact />
                  </div>
                  <div className="mt-2">
                    <RiskSettingsSummary settings={riskSettings} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isRiskLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Calculating risk metrics...</span>
                    </div>
                  ) : !riskMetrics ? (
                    <div className="text-sm text-muted-foreground">
                      Add assets with historical data to see risk metrics.
                    </div>
                  ) : (
                    <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <div className="text-3xl font-bold text-blue-500">
                          {(riskMetrics.volatility * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Annualized Volatility</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-semibold">Annualized Volatility</p>
                      <p className="text-xs font-mono bg-muted/50 px-1 rounded my-1">σ_annual = σ_daily × √{riskSettings.annualizationFactor}</p>
                      <p className="text-xs">Based on {riskSettings.lookbackDays} days of returns, annualized using {riskSettings.annualizationFactor} days/year.</p>
                      <p className="text-xs mt-1 text-muted-foreground">{'<'}15% low | 15-25% moderate | {'>'}25% high</p>
                    </TooltipContent>
                  </Tooltip>

                  <div className="pt-4 border-t space-y-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex justify-between text-sm cursor-help">
                          <span className="text-muted-foreground">Beta</span>
                          <span className="font-bold font-mono">{riskMetrics.beta.toFixed(2)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold">Beta (β)</p>
                        <p className="text-xs font-mono bg-muted/50 px-1 rounded my-1">β = Cov(R_p, R_m) / Var(R_m)</p>
                        <p className="text-xs">Sensitivity to {riskSettings.benchmark}. β=1.0 moves with market, β=1.5 is 50% more volatile.</p>
                        <p className="text-xs mt-1 text-muted-foreground">Based on {riskSettings.lookbackDays} days vs {riskSettings.benchmark}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex justify-between text-sm cursor-help">
                          <span className="text-muted-foreground">Sharpe Ratio</span>
                          <span className={`font-bold font-mono ${riskMetrics.sharpeRatio > 1 ? 'text-green-500' : 'text-yellow-500'}`}>
                            {riskMetrics.sharpeRatio.toFixed(2)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold">Sharpe Ratio</p>
                        <p className="text-xs font-mono bg-muted/50 px-1 rounded my-1">Sharpe = (R_p - R_f) / σ_p</p>
                        <p className="text-xs">Excess return per unit of risk. R_f = {riskSettings.riskFreeRate}% (risk-free rate).</p>
                        <p className="text-xs mt-1 text-muted-foreground">{'<'}1 suboptimal | 1-2 good | {'>'}2 excellent</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex justify-between text-sm cursor-help">
                          <span className="text-muted-foreground">Max Drawdown</span>
                          <span className="font-bold font-mono text-red-500">
                            {(riskMetrics.maxDrawdown * 100).toFixed(1)}%
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold">Maximum Drawdown</p>
                        <p className="text-xs font-mono bg-muted/50 px-1 rounded my-1">Max DD = max[(Peak - Trough) / Peak]</p>
                        <p className="text-xs">Largest peak-to-trough decline over {riskSettings.lookbackDays} days.</p>
                        <p className="text-xs mt-1 text-muted-foreground">-20% normal | -40% severe | -60% catastrophic</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex justify-between text-sm cursor-help">
                          <span className="text-muted-foreground">Diversification</span>
                          <span className={`font-bold font-mono ${riskMetrics.diversificationScore > 0.5 ? 'text-green-500' : 'text-yellow-500'}`}>
                            {(riskMetrics.diversificationScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold">Diversification Score</p>
                        <p className="text-xs font-mono bg-muted/50 px-1 rounded my-1">Score = 1 - Avg(Correlation)</p>
                        <p className="text-xs">Higher = assets move more independently, reducing overall risk.</p>
                        <p className="text-xs mt-1 text-muted-foreground">{'<'}30% poor | 30-50% moderate | {'>'}50% good</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p><strong>Tip:</strong> Click "Adjust Weights" to use sliders for what-if analysis.</p>
                    <p>Risk metrics update in real-time as you adjust weights.</p>
                    <p>Click "Save Model" to persist your changes.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Rebalance Tab */}
        <TabsContent value="rebalance" className="mt-4">
          <RebalanceCalculator
            currentHoldings={rebalanceHoldings}
            targetWeights={targetWeights}
            corePortfolioValue={corePortfolioValue}
          />
        </TabsContent>

        {/* Analytics Tab - Stress Testing, Risk Attribution, Backtester */}
        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scenario Stress Tester */}
            <ScenarioSimulator
              portfolio={holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                weight: h.target_weight,
                beta: assetBetas[h.symbol], // Real beta from API
                assetType: h.category === 'tokens' ? 'crypto' : h.category === 'cash' ? 'cash' : 'equity',
              }))}
            />

            {/* Risk Attribution */}
            <RiskAttribution
              portfolio={holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                weight: h.target_weight,
                volatility: assetVolatilities[h.symbol], // Real volatility from API
                assetType: h.category === 'tokens' ? 'crypto' : h.category === 'cash' ? 'cash' : 'equity',
                category: h.category,
              }))}
              portfolioVolatility={riskMetrics?.volatility}
            />
          </div>

          {/* Time Travel Backtester - Full Width */}
          <div className="mt-6">
            <TimeTravelBacktester
              portfolio={holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                weight: h.target_weight,
                assetId: h.asset_id,
                assetType: h.category === 'tokens' ? 'crypto' : h.category === 'cash' ? 'cash' : 'equity',
              }))}
              corePortfolioValue={corePortfolioValue}
            />
          </div>
        </TabsContent>

        {/* AI Review Tab */}
        <TabsContent value="ai" className="mt-4">
          <AIInvestmentCommittee
            portfolio={holdings.map(h => ({
              symbol: h.symbol,
              name: h.name,
              weight: h.target_weight,
              assetType: h.category === 'tokens' ? 'crypto' : h.category === 'cash' ? 'cash' : 'equity',
              category: h.category,
            }))}
            corePortfolioValue={corePortfolioValue}
            riskMetrics={riskMetrics ? {
              volatility: riskMetrics.volatility,
              beta: riskMetrics.beta,
              sharpeRatio: riskMetrics.sharpeRatio,
            } : undefined}
          />
        </TabsContent>

        {/* Learn Tab - How metrics are calculated */}
        <TabsContent value="learn" className="mt-4">
          <RiskMetricsExplainer settings={riskSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PortfolioSandbox;

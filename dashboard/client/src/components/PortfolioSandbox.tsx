import React, { useState, useEffect, useMemo } from 'react';
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Play, Save, X, RotateCcw, AlertTriangle, TrendingUp, 
  Activity, BarChart3, Percent, ChevronDown, ChevronUp,
  Calculator, Zap, Shield
} from "lucide-react";
import { RebalanceCalculator } from "./RebalanceCalculator";
import { CorrelationMatrix } from "./CorrelationMatrix";
import { 
  useModelPortfolioHoldings,
  updateModelHolding,
  ModelPortfolioHolding,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PortfolioCategory,
} from "@/hooks/useModelPortfolioHoldings";
import { useCorePortfolioValue } from "@/hooks/useModelPortfolioHoldings";
import useSWR from 'swr';

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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function PortfolioSandbox({ onAssetClick }: PortfolioSandboxProps) {
  const { holdings, isLoading, mutate } = useModelPortfolioHoldings();
  const { totalValue: corePortfolioValue } = useCorePortfolioValue();
  
  const [isEditing, setIsEditing] = useState(false);
  const [draftWeights, setDraftWeights] = useState<{ [id: number]: number }>({});
  const [showRebalancer, setShowRebalancer] = useState(false);
  const [showCorrelation, setShowCorrelation] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<PortfolioCategory>>(
    new Set(CATEGORY_ORDER)
  );

  // Fetch risk metrics from backend
  const assetIds = holdings.map(h => h.asset_id).filter(Boolean).join(',');
  const { data: riskData } = useSWR<{ metrics: RiskMetrics; correlationMatrix: number[][] }>(
    assetIds ? `/api/dashboard/portfolio-risk?asset_ids=${assetIds}` : null,
    fetcher
  );

  // Initialize draft weights from holdings
  useEffect(() => {
    const weights: { [id: number]: number } = {};
    holdings.forEach(h => {
      weights[h.id] = h.target_weight || 0;
    });
    setDraftWeights(weights);
  }, [holdings]);

  // Calculate totals
  const currentTotalWeight = useMemo(() => 
    holdings.reduce((sum, h) => sum + (h.target_weight || 0), 0),
    [holdings]
  );

  const draftTotalWeight = useMemo(() => 
    Object.values(draftWeights).reduce((sum, w) => sum + w, 0),
    [draftWeights]
  );

  const hasChanges = useMemo(() => {
    return holdings.some(h => draftWeights[h.id] !== (h.target_weight || 0));
  }, [holdings, draftWeights]);

  // Group holdings by category
  const categorizedHoldings = useMemo(() => {
    const categories: Record<PortfolioCategory, ModelPortfolioHolding[]> = {
      dats: [],
      tokens: [],
      equities: [],
      options: [],
      cash: [],
      other: [],
    };
    holdings.forEach(h => {
      const cat = h.category || 'other';
      if (categories[cat]) {
        categories[cat].push(h);
      } else {
        categories.other.push(h);
      }
    });
    return categories;
  }, [holdings]);

  const handleWeightChange = (holdingId: number, newWeight: number[]) => {
    setDraftWeights(prev => ({ ...prev, [holdingId]: newWeight[0] }));
  };

  const handleSave = async () => {
    try {
      // Save all changed weights
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

  const handleReset = () => {
    const weights: { [id: number]: number } = {};
    holdings.forEach(h => {
      weights[h.id] = h.target_weight || 0;
    });
    setDraftWeights(weights);
  };

  const handleCancel = () => {
    handleReset();
    setIsEditing(false);
  };

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

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(1)}%`;
  };

  const formatPrice = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num < 0.0001) return num.toExponential(2);
    if (num < 1) return `$${num.toFixed(4)}`;
    if (num < 100) return `$${num.toFixed(2)}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // Prepare data for rebalance calculator
  const rebalanceHoldings = holdings.map(h => ({
    symbol: h.symbol || h.custom_symbol || 'Unknown',
    name: h.name || h.custom_name || '',
    assetId: h.asset_id || 0,
    quantity: 0, // Model portfolio doesn't track actual quantity
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

  const displayTotalWeight = isEditing ? draftTotalWeight : currentTotalWeight;
  const remainingWeight = 100 - displayTotalWeight;

  // Mock risk metrics if not available from backend
  const riskMetrics: RiskMetrics = riskData?.metrics || {
    volatility: 0.18,
    beta: 1.15,
    sharpeRatio: 1.2,
    maxDrawdown: -0.15,
    diversificationScore: 0.65,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Portfolio Sandbox
          </h2>
          <Badge variant={displayTotalWeight > 100 ? "destructive" : displayTotalWeight < 100 ? "secondary" : "default"}>
            {formatPercent(displayTotalWeight)} Allocated
          </Badge>
          {remainingWeight !== 0 && (
            <span className={`text-sm font-mono ${remainingWeight < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {remainingWeight > 0 ? `${formatPercent(remainingWeight)} unallocated` : `${formatPercent(Math.abs(remainingWeight))} over`}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowCorrelation(!showCorrelation)}>
                <BarChart3 className="w-4 h-4 mr-1" />
                Correlation
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRebalancer(!showRebalancer)}>
                <Calculator className="w-4 h-4 mr-1" />
                Rebalance
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                <Play className="w-4 h-4 mr-1" />
                Adjust Weights
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                <Save className="w-4 h-4 mr-1" />
                Save Model
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Warning if over-allocated */}
      {displayTotalWeight > 100 && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Portfolio is over-allocated by {formatPercent(displayTotalWeight - 100)}. Reduce weights to 100% or less.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Allocation Panel */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Asset Allocation</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Base Value: <span className="font-mono font-medium text-foreground">{formatCurrency(corePortfolioValue)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {CATEGORY_ORDER.map(category => {
                const categoryHoldings = categorizedHoldings[category];
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

                                {/* Price */}
                                <div className="w-20 text-right text-sm text-muted-foreground font-mono">
                                  {formatPrice(holding.current_price || holding.manual_price)}
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
                  No positions in model portfolio. Add assets to get started.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rebalance Calculator */}
          {showRebalancer && (
            <RebalanceCalculator
              currentHoldings={rebalanceHoldings}
              targetWeights={targetWeights}
              corePortfolioValue={corePortfolioValue}
              onClose={() => setShowRebalancer(false)}
            />
          )}

          {/* Correlation Matrix */}
          {showCorrelation && (
            <CorrelationMatrix
              holdings={holdings}
              correlationData={riskData?.correlationMatrix}
            />
          )}
        </div>

        {/* Risk Metrics Panel */}
        <div className="space-y-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Risk Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-bold text-blue-500">
                  {(riskMetrics.volatility * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Annualized Volatility</div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Beta</span>
                  <span className="font-bold font-mono">{riskMetrics.beta.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sharpe Ratio</span>
                  <span className={`font-bold font-mono ${riskMetrics.sharpeRatio > 1 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {riskMetrics.sharpeRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Drawdown</span>
                  <span className="font-bold font-mono text-red-500">
                    {(riskMetrics.maxDrawdown * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Diversification</span>
                  <span className={`font-bold font-mono ${riskMetrics.diversificationScore > 0.5 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {(riskMetrics.diversificationScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-muted-foreground flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowRebalancer(!showRebalancer)}>
                <Calculator className="w-4 h-4 mr-2" />
                {showRebalancer ? 'Hide' : 'Show'} Rebalancer
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setShowCorrelation(!showCorrelation)}>
                <BarChart3 className="w-4 h-4 mr-2" />
                {showCorrelation ? 'Hide' : 'Show'} Correlations
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground space-y-2">
                <p><strong>Tip:</strong> Use the sliders to model different allocation scenarios.</p>
                <p>Risk metrics update in real-time as you adjust weights.</p>
                <p>Click "Save Model" to persist your changes.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default PortfolioSandbox;

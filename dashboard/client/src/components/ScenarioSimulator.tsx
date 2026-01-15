import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, TrendingDown, TrendingUp, Zap, Info, RefreshCw } from "lucide-react";

interface PortfolioAsset {
  symbol: string;
  name?: string;
  weight: number; // 0-100 (percentage)
  beta?: number;
  assetType?: string;
}

interface ScenarioSimulatorProps {
  portfolio: PortfolioAsset[];
  onRefreshBetas?: () => void;
}

// Default betas by asset type - in production, calculate from OHLCV data
const DEFAULT_BETAS: Record<string, number> = {
  // Crypto (high beta to BTC/market)
  'BTC': 1.0,    // Bitcoin IS the market for crypto
  'ETH': 1.3,
  'SOL': 1.8,
  'FARTCOIN': 2.5,
  'DOGE': 2.2,
  'SHIB': 2.8,
  // Stablecoins
  'USDC': 0.0,
  'USDT': 0.0,
  'DAI': 0.0,
  // Tech stocks (high beta)
  'NVDA': 1.8,
  'TSLA': 2.1,
  'AAPL': 1.2,
  'MSFT': 0.95,
  'GOOGL': 1.1,
  'AMZN': 1.3,
  'META': 1.4,
  // Defensive stocks (low beta)
  'JNJ': 0.6,
  'PG': 0.5,
  'KO': 0.6,
  'LLY': 0.8,
  // Bitcoin proxies
  'MSTR': 2.5,
  'COIN': 2.2,
  // Growth stocks
  'RKLB': 2.0,
  'IREN': 1.9,
  // Cash
  'CASH': 0.0,
};

// Preset scenarios
const PRESET_SCENARIOS = [
  { name: 'Mild Correction', shock: -5, description: 'Typical pullback' },
  { name: 'Market Crash', shock: -20, description: '2020 COVID-style' },
  { name: 'Black Swan', shock: -35, description: '2008 Financial Crisis' },
  { name: 'Bull Run', shock: 15, description: 'Strong rally' },
];

export function ScenarioSimulator({ portfolio, onRefreshBetas }: ScenarioSimulatorProps) {
  const [marketShock, setMarketShock] = useState<number>(-10);
  const [benchmarkType, setBenchmarkType] = useState<'spx' | 'btc'>('spx');

  // Get beta for an asset
  const getBeta = (symbol: string, assetType?: string): number => {
    // Check if we have a specific beta for this symbol
    if (DEFAULT_BETAS[symbol] !== undefined) {
      return DEFAULT_BETAS[symbol];
    }
    // Default by asset type
    if (assetType === 'crypto') return 1.5;
    if (assetType === 'cash') return 0;
    return 1.0; // Default equity beta
  };

  // Calculate portfolio-level metrics
  const analysis = useMemo(() => {
    const assetsWithBeta = portfolio.map(asset => ({
      ...asset,
      beta: asset.beta ?? getBeta(asset.symbol, asset.assetType),
      weightDecimal: asset.weight / 100,
    }));

    // Portfolio Beta (weighted average)
    const portfolioBeta = assetsWithBeta.reduce(
      (acc, asset) => acc + (asset.beta * asset.weightDecimal),
      0
    );

    // Projected portfolio impact
    const projectedImpact = marketShock * portfolioBeta;

    // Individual asset impacts
    const assetImpacts = assetsWithBeta.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      weight: asset.weight,
      beta: asset.beta,
      impact: marketShock * asset.beta,
      contributionToImpact: (marketShock * asset.beta * asset.weightDecimal),
    })).sort((a, b) => a.impact - b.impact); // Sort by impact (worst first for negative shocks)

    // Find biggest losers and winners
    const biggestLoser = assetImpacts[0];
    const biggestWinner = assetImpacts[assetImpacts.length - 1];

    // Calculate dollar impact (if we had portfolio value)
    const riskContributors = assetImpacts
      .filter(a => Math.abs(a.contributionToImpact) > 0.1)
      .sort((a, b) => Math.abs(b.contributionToImpact) - Math.abs(a.contributionToImpact));

    return {
      portfolioBeta,
      projectedImpact,
      assetImpacts,
      biggestLoser,
      biggestWinner,
      riskContributors,
    };
  }, [portfolio, marketShock]);

  const getImpactColor = (impact: number) => {
    if (impact >= 5) return 'text-green-500';
    if (impact >= 0) return 'text-green-400';
    if (impact >= -5) return 'text-yellow-500';
    if (impact >= -15) return 'text-orange-500';
    return 'text-red-500';
  };

  const getImpactBgColor = (impact: number) => {
    if (impact >= 0) return 'bg-green-500';
    if (impact >= -10) return 'bg-yellow-500';
    if (impact >= -20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Stress Test Simulator
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              Portfolio β: {analysis.portfolioBeta.toFixed(2)}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Beta measures sensitivity to market movements. A beta of 1.5 means the asset moves 1.5% for every 1% market move.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preset Scenarios */}
        <div className="flex flex-wrap gap-2">
          {PRESET_SCENARIOS.map(scenario => (
            <Tooltip key={scenario.name}>
              <TooltipTrigger asChild>
                <Button
                  variant={marketShock === scenario.shock ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMarketShock(scenario.shock)}
                  className={scenario.shock < 0 ? 'hover:border-red-500' : 'hover:border-green-500'}
                >
                  {scenario.name}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{scenario.description}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* The Slider Control */}
        <div className="space-y-4">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-muted-foreground">If the Market Moves...</span>
            <span className={marketShock >= 0 ? "text-green-600 font-mono" : "text-red-600 font-mono"}>
              {marketShock >= 0 ? '+' : ''}{marketShock}%
            </span>
          </div>
          <Slider 
            value={[marketShock]} 
            min={-40} 
            max={20} 
            step={1}
            onValueChange={(val) => setMarketShock(val[0])}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-40% (Crash)</span>
            <span>0%</span>
            <span>+20% (Rally)</span>
          </div>
        </div>

        {/* The Result Display */}
        <div className={`p-4 rounded-lg border-2 ${
          analysis.projectedImpact >= 0 
            ? 'bg-green-500/10 border-green-500/30' 
            : analysis.projectedImpact >= -10 
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : analysis.projectedImpact >= -20
            ? 'bg-orange-500/10 border-orange-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-muted-foreground">Projected Portfolio Impact</div>
              <div className={`text-3xl font-bold font-mono ${getImpactColor(analysis.projectedImpact)}`}>
                {analysis.projectedImpact >= 0 ? '+' : ''}{analysis.projectedImpact.toFixed(2)}%
              </div>
            </div>
            <div className="text-right">
              {analysis.projectedImpact < 0 ? (
                <TrendingDown className="w-10 h-10 text-red-500" />
              ) : (
                <TrendingUp className="w-10 h-10 text-green-500" />
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Based on weighted beta multiplier of <strong>{analysis.portfolioBeta.toFixed(2)}x</strong>
          </div>
        </div>

        {/* Top Risk Contributors */}
        {analysis.riskContributors.length > 0 && marketShock < 0 && (
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
            <div className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Biggest Risk Contributors
            </div>
            <div className="space-y-1">
              {analysis.riskContributors.slice(0, 3).map(asset => (
                <div key={asset.symbol} className="flex justify-between text-sm">
                  <span className="font-mono">{asset.symbol}</span>
                  <span className="text-red-500 font-mono">
                    {asset.contributionToImpact.toFixed(2)}% of total impact
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asset Breakdown */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Asset Impact Breakdown
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {analysis.assetImpacts.map(asset => (
              <div key={asset.symbol} className="flex items-center text-sm py-1">
                <div className="w-20 font-mono font-medium">{asset.symbol}</div>
                <div className="w-12 text-xs text-muted-foreground">β {asset.beta.toFixed(1)}</div>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden flex relative">
                  {/* Center line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
                  {/* Negative bar (left side) */}
                  <div className="w-1/2 flex justify-end">
                    {asset.impact < 0 && (
                      <div 
                        className="h-full bg-red-500 rounded-l-full" 
                        style={{ width: `${Math.min(Math.abs(asset.impact), 50) * 2}%` }} 
                      />
                    )}
                  </div>
                  {/* Positive bar (right side) */}
                  <div className="w-1/2 flex justify-start">
                    {asset.impact > 0 && (
                      <div 
                        className="h-full bg-green-500 rounded-r-full" 
                        style={{ width: `${Math.min(asset.impact, 50) * 2}%` }} 
                      />
                    )}
                  </div>
                </div>
                <div className={`w-16 text-right font-mono ${getImpactColor(asset.impact)}`}>
                  {asset.impact >= 0 ? '+' : ''}{asset.impact.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Biggest Loser</div>
            <div className="font-mono font-medium">{analysis.biggestLoser?.symbol}</div>
            <div className="text-red-500 font-mono">
              {analysis.biggestLoser?.impact.toFixed(1)}%
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Most Resilient</div>
            <div className="font-mono font-medium">{analysis.biggestWinner?.symbol}</div>
            <div className={`font-mono ${getImpactColor(analysis.biggestWinner?.impact || 0)}`}>
              {(analysis.biggestWinner?.impact || 0) >= 0 ? '+' : ''}
              {analysis.biggestWinner?.impact.toFixed(1)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ScenarioSimulator;

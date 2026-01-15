import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PieChart, AlertTriangle, Info, TrendingUp } from "lucide-react";

interface PortfolioAsset {
  symbol: string;
  name?: string;
  weight: number; // 0-100 (percentage)
  volatility?: number; // Annualized volatility (0-1)
  beta?: number;
  assetType?: string;
}

interface RiskAttributionProps {
  portfolio: PortfolioAsset[];
  portfolioVolatility?: number; // Real portfolio volatility from API
}

// Default volatilities by asset type (annualized)
const DEFAULT_VOLATILITIES: Record<string, number> = {
  // Crypto (very high volatility)
  'BTC': 0.60,
  'ETH': 0.75,
  'SOL': 0.95,
  'FARTCOIN': 1.50,
  'DOGE': 1.20,
  'SHIB': 1.40,
  // Stablecoins
  'USDC': 0.01,
  'USDT': 0.01,
  'DAI': 0.02,
  // Tech stocks
  'NVDA': 0.55,
  'TSLA': 0.65,
  'AAPL': 0.28,
  'MSFT': 0.25,
  'GOOGL': 0.30,
  'AMZN': 0.35,
  'META': 0.40,
  // Defensive stocks
  'JNJ': 0.15,
  'PG': 0.14,
  'KO': 0.16,
  'LLY': 0.30,
  // Bitcoin proxies
  'MSTR': 0.85,
  'COIN': 0.80,
  // Growth stocks
  'RKLB': 0.70,
  'IREN': 0.75,
  // Cash
  'CASH': 0.0,
};

// Colors for the charts
const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

export function RiskAttribution({ portfolio, portfolioVolatility }: RiskAttributionProps) {
  // Get volatility for an asset - prioritize real data from props, fallback to defaults
  const getVolatility = (symbol: string, providedVolatility?: number, assetType?: string): number => {
    // Use real volatility from API if provided
    if (providedVolatility !== undefined && !isNaN(providedVolatility)) {
      return providedVolatility;
    }
    // Fallback to hardcoded defaults
    if (DEFAULT_VOLATILITIES[symbol] !== undefined) {
      return DEFAULT_VOLATILITIES[symbol];
    }
    if (assetType === 'crypto') return 0.80;
    if (assetType === 'cash') return 0;
    return 0.25; // Default equity volatility
  };
  
  // Check if we're using real data
  const hasRealVolatilities = portfolio.some(p => p.volatility !== undefined && !isNaN(p.volatility));

  // Calculate risk attribution
  const analysis = useMemo(() => {
    const assetsWithRisk = portfolio.map((asset, index) => ({
      ...asset,
      volatility: getVolatility(asset.symbol, asset.volatility, asset.assetType),
      usingRealVolatility: asset.volatility !== undefined && !isNaN(asset.volatility),
      weightDecimal: asset.weight / 100,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

    // Calculate marginal contribution to risk (simplified: weight * volatility)
    // In a full implementation, this would use the covariance matrix
    const totalRiskContribution = assetsWithRisk.reduce(
      (acc, asset) => acc + (asset.weightDecimal * asset.volatility),
      0
    );

    // Calculate risk attribution for each asset
    const riskAttribution = assetsWithRisk.map(asset => {
      const riskContribution = asset.weightDecimal * asset.volatility;
      const riskWeight = totalRiskContribution > 0 
        ? (riskContribution / totalRiskContribution) * 100 
        : 0;
      
      return {
        ...asset,
        riskContribution,
        riskWeight,
        capitalWeight: asset.weight,
        riskToCapitalRatio: asset.weight > 0 ? riskWeight / asset.weight : 0,
      };
    }).sort((a, b) => b.riskWeight - a.riskWeight);

    // Find concentration issues
    const concentrationWarnings = riskAttribution.filter(
      a => a.riskToCapitalRatio > 2 && a.riskWeight > 5
    );

    // Portfolio-level stats - use real volatility from API if available
    const calculatedVolatility = totalRiskContribution;
    const topRiskContributor = riskAttribution[0];
    const diversificationBenefit = 1 - (calculatedVolatility / 
      assetsWithRisk.reduce((acc, a) => acc + a.volatility * a.weightDecimal, 0));

    return {
      riskAttribution,
      calculatedVolatility,
      topRiskContributor,
      concentrationWarnings,
      diversificationBenefit,
      hasRealData: assetsWithRisk.some(a => a.usingRealVolatility),
    };
  }, [portfolio]);
  
  // Use real portfolio volatility from API if provided, otherwise use calculated
  const displayVolatility = portfolioVolatility ?? analysis.calculatedVolatility;

  // SVG Donut Chart Component
  const DonutChart = ({ 
    data, 
    valueKey, 
    title 
  }: { 
    data: typeof analysis.riskAttribution; 
    valueKey: 'capitalWeight' | 'riskWeight';
    title: string;
  }) => {
    const size = 160;
    const strokeWidth = 30;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    
    let accumulatedOffset = 0;
    
    return (
      <div className="flex flex-col items-center">
        <div className="text-sm font-medium text-muted-foreground mb-2">{title}</div>
        <svg width={size} height={size} className="transform -rotate-90">
          {data.map((asset, index) => {
            const value = asset[valueKey];
            const dashLength = (value / 100) * circumference;
            const dashOffset = accumulatedOffset;
            accumulatedOffset += dashLength;
            
            if (value < 0.5) return null; // Skip tiny slices
            
            return (
              <circle
                key={asset.symbol}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={asset.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-dashOffset}
                className="transition-all duration-300"
              />
            );
          })}
          {/* Center circle for donut effect */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - strokeWidth / 2}
            fill="var(--background)"
          />
        </svg>
        {/* Center text */}
        <div className="absolute text-center" style={{ marginTop: size / 2 - 20 }}>
          <div className="text-lg font-bold">100%</div>
        </div>
      </div>
    );
  };

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-500" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">Risk Attribution</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Compares where your money is allocated (Capital) vs. where your risk is concentrated (Risk). High-volatility assets contribute more risk than their capital weight suggests.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <div className="flex items-center gap-2">
            {(portfolioVolatility || analysis.hasRealData) && (
              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">
                Live Data
              </Badge>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="font-mono cursor-help">
                  Vol: {(displayVolatility * 100).toFixed(1)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p><strong>Portfolio Volatility:</strong> {portfolioVolatility ? 'Calculated from real historical returns.' : 'Estimated based on asset volatilities.'} Higher values mean more price swings. 20% vol means roughly ±20% moves in a typical year.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Concentration Warnings */}
        {analysis.concentrationWarnings.length > 0 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-yellow-600 text-sm font-medium mb-2 cursor-help">
                  <AlertTriangle className="w-4 h-4" />
                  Risk Concentration Warning
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>These assets contribute disproportionately more risk than their capital allocation. A 10% position contributing 25% of risk means that asset is 2.5x more volatile than average.</p>
              </TooltipContent>
            </Tooltip>
            <div className="text-sm text-muted-foreground">
              {analysis.concentrationWarnings.map(a => (
                <div key={a.symbol}>
                  <strong>{a.symbol}</strong> is {a.capitalWeight.toFixed(1)}% of capital but{' '}
                  <span className="text-yellow-600 font-medium">{a.riskWeight.toFixed(1)}%</span> of risk
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Side-by-side Donut Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="relative flex flex-col items-center">
            <DonutChart 
              data={analysis.riskAttribution} 
              valueKey="capitalWeight" 
              title="Capital Allocation" 
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-muted-foreground mt-2 cursor-help">Where your money is</div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p><strong>Capital Allocation:</strong> The percentage of your total portfolio value in each asset. This is what you see in your account balance.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="relative flex flex-col items-center">
            <DonutChart 
              data={analysis.riskAttribution} 
              valueKey="riskWeight" 
              title="Risk Allocation" 
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-muted-foreground mt-2 cursor-help">Where your anxiety is</div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p><strong>Risk Allocation:</strong> The percentage of total portfolio volatility each asset contributes. High-volatility assets like crypto often dominate risk even with small allocations.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {analysis.riskAttribution.slice(0, 10).map(asset => (
            <div key={asset.symbol} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: asset.color }}
              />
              <span className="font-mono truncate">{asset.symbol}</span>
            </div>
          ))}
        </div>

        {/* Detailed Breakdown Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Asset</th>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="text-right px-3 py-2 font-medium cursor-help">Capital %</th>
                  </TooltipTrigger>
                  <TooltipContent>Percentage of portfolio value in this asset</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="text-right px-3 py-2 font-medium cursor-help">Risk %</th>
                  </TooltipTrigger>
                  <TooltipContent>Percentage of portfolio volatility from this asset</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="text-right px-3 py-2 font-medium cursor-help">Ratio</th>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p><strong>Risk/Capital Ratio:</strong> How much more (or less) risk an asset contributes relative to its capital weight. 2.0x means it contributes twice as much risk as capital.</p>
                  </TooltipContent>
                </Tooltip>
              </tr>
            </thead>
            <tbody>
              {analysis.riskAttribution.map(asset => (
                <tr key={asset.symbol} className="border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: asset.color }}
                      />
                      <span className="font-mono">{asset.symbol}</span>
                    </div>
                  </td>
                  <td className="text-right px-3 py-2 font-mono">
                    {asset.capitalWeight.toFixed(1)}%
                  </td>
                  <td className="text-right px-3 py-2 font-mono">
                    <span className={asset.riskWeight > asset.capitalWeight * 1.5 ? 'text-red-500' : ''}>
                      {asset.riskWeight.toFixed(1)}%
                    </span>
                  </td>
                  <td className="text-right px-3 py-2">
                    <Badge 
                      variant={asset.riskToCapitalRatio > 2 ? "destructive" : asset.riskToCapitalRatio > 1.5 ? "secondary" : "outline"}
                      className="font-mono"
                    >
                      {asset.riskToCapitalRatio.toFixed(2)}x
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Insights */}
        <div className="p-3 bg-muted/30 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Info className="w-4 h-4" />
            Key Insight
          </div>
          <p>
            <strong>{analysis.topRiskContributor?.symbol}</strong> contributes{' '}
            <span className="text-purple-500 font-medium">
              {analysis.topRiskContributor?.riskWeight.toFixed(1)}%
            </span>{' '}
            of your portfolio's risk while only representing{' '}
            {analysis.topRiskContributor?.capitalWeight.toFixed(1)}% of capital.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default RiskAttribution;

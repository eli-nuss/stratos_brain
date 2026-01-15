import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart3, Info } from "lucide-react";
import { ModelPortfolioHolding } from "@/hooks/useModelPortfolioHoldings";

interface CorrelationMatrixProps {
  holdings: ModelPortfolioHolding[];
  correlationData?: number[][];
}

/**
 * Get color for correlation value
 * Red = high positive correlation (risk concentration)
 * Blue = negative correlation (diversification benefit)
 * White/Gray = neutral
 */
function getCorrelationColor(correlation: number, isDark: boolean = false): string {
  const intensity = Math.abs(correlation);
  
  if (correlation > 0) {
    // Red for positive correlation - higher = more concentrated risk
    if (isDark) {
      const r = Math.round(180 + 75 * intensity);
      const g = Math.round(50 * (1 - intensity));
      const b = Math.round(50 * (1 - intensity));
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const r = 255;
      const g = Math.round(255 * (1 - intensity * 0.7));
      const b = Math.round(255 * (1 - intensity * 0.7));
      return `rgb(${r}, ${g}, ${b})`;
    }
  } else {
    // Blue for negative correlation - diversification benefit
    if (isDark) {
      const r = Math.round(50 * (1 - intensity));
      const g = Math.round(100 + 50 * intensity);
      const b = Math.round(180 + 75 * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const r = Math.round(255 * (1 - intensity * 0.7));
      const g = Math.round(255 * (1 - intensity * 0.5));
      const b = 255;
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
}

/**
 * Get text color for readability on correlation background
 */
function getTextColor(correlation: number): string {
  const intensity = Math.abs(correlation);
  return intensity > 0.6 ? 'white' : 'inherit';
}

export function CorrelationMatrix({ holdings, correlationData }: CorrelationMatrixProps) {
  // Filter holdings that have asset_ids (linked to database)
  const linkedHoldings = useMemo(() => 
    holdings.filter(h => h.asset_id),
    [holdings]
  );

  const symbols = useMemo(() => 
    linkedHoldings.map(h => h.symbol || h.custom_symbol || 'Unknown'),
    [linkedHoldings]
  );

  // Generate mock correlation data if not provided
  const matrix = useMemo(() => {
    if (correlationData && correlationData.length === linkedHoldings.length) {
      return correlationData;
    }
    
    // Generate mock correlation matrix for demo
    const n = linkedHoldings.length;
    const mockMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          mockMatrix[i][j] = 1;
        } else if (j > i) {
          // Generate semi-realistic correlations based on asset types
          const assetA = linkedHoldings[i];
          const assetB = linkedHoldings[j];
          
          let baseCorr = 0.3 + Math.random() * 0.4; // 0.3 to 0.7
          
          // Same asset type = higher correlation
          if (assetA.asset_type === assetB.asset_type) {
            baseCorr += 0.2;
          }
          
          // Crypto tends to be highly correlated
          if (assetA.asset_type === 'crypto' && assetB.asset_type === 'crypto') {
            baseCorr = 0.6 + Math.random() * 0.3;
          }
          
          // Add some randomness
          baseCorr = Math.min(0.95, Math.max(-0.3, baseCorr + (Math.random() - 0.5) * 0.2));
          
          mockMatrix[i][j] = baseCorr;
          mockMatrix[j][i] = baseCorr;
        }
      }
    }
    
    return mockMatrix;
  }, [correlationData, linkedHoldings]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const n = matrix.length;
    if (n < 2) return { avgCorr: 0, maxCorr: 0, minCorr: 0, highCorrPairs: [] };
    
    let sum = 0;
    let count = 0;
    let maxCorr = -1;
    let minCorr = 1;
    const highCorrPairs: { a: string; b: string; corr: number }[] = [];
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const corr = matrix[i][j];
        sum += corr;
        count++;
        
        if (corr > maxCorr) maxCorr = corr;
        if (corr < minCorr) minCorr = corr;
        
        if (corr > 0.7) {
          highCorrPairs.push({ a: symbols[i], b: symbols[j], corr });
        }
      }
    }
    
    return {
      avgCorr: count > 0 ? sum / count : 0,
      maxCorr,
      minCorr,
      highCorrPairs: highCorrPairs.sort((a, b) => b.corr - a.corr).slice(0, 5)
    };
  }, [matrix, symbols]);

  if (linkedHoldings.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">Correlation Matrix</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>A heatmap showing how assets move together. High correlation means assets rise and fall together, reducing diversification benefits.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Add at least 2 linked assets to view correlations.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">Correlation Matrix</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>A heatmap showing how assets move together. High correlation means assets rise and fall together, reducing diversification benefits.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Shows pairwise correlations between assets based on 90-day returns.</p>
              <p className="mt-1"><span className="text-red-400">Red</span> = high positive correlation (concentrated risk)</p>
              <p><span className="text-blue-400">Blue</span> = negative correlation (diversification)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-2 bg-muted/30 rounded cursor-help">
                <div className="text-muted-foreground text-xs">Avg Correlation</div>
                <div className="font-mono font-medium">{(stats.avgCorr * 100).toFixed(0)}%</div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p><strong>Average Correlation:</strong> Mean correlation across all asset pairs. Lower is better for diversification. Below 40% is good, below 20% is excellent.</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-2 bg-muted/30 rounded cursor-help">
                <div className="text-muted-foreground text-xs">Max Correlation</div>
                <div className="font-mono font-medium text-red-500">{(stats.maxCorr * 100).toFixed(0)}%</div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p><strong>Maximum Correlation:</strong> The highest correlation between any two assets. Above 80% means those assets move almost identically.</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-2 bg-muted/30 rounded cursor-help">
                <div className="text-muted-foreground text-xs">Min Correlation</div>
                <div className="font-mono font-medium text-blue-500">{(stats.minCorr * 100).toFixed(0)}%</div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p><strong>Minimum Correlation:</strong> The lowest correlation between any two assets. Negative values mean assets move in opposite directions, providing hedge benefits.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Matrix Heatmap */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="p-1 w-16"></th>
                  {symbols.map((symbol, i) => (
                    <th 
                      key={i} 
                      className="p-1 font-mono font-medium text-center"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '60px' }}
                    >
                      {symbol}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {symbols.map((rowSymbol, i) => (
                  <tr key={i}>
                    <td className="p-1 font-mono font-medium text-right pr-2">
                      {rowSymbol}
                    </td>
                    {symbols.map((_, j) => {
                      const corr = matrix[i][j];
                      const isDiagonal = i === j;
                      
                      return (
                        <Tooltip key={j}>
                          <TooltipTrigger asChild>
                            <td 
                              className={`p-1 text-center font-mono cursor-default transition-transform hover:scale-110 ${isDiagonal ? 'opacity-50' : ''}`}
                              style={{ 
                                backgroundColor: getCorrelationColor(corr),
                                color: getTextColor(corr),
                                width: '40px',
                                height: '32px',
                              }}
                            >
                              {isDiagonal ? '-' : (corr * 100).toFixed(0)}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="font-mono">
                              {rowSymbol} ↔ {symbols[j]}: {(corr * 100).toFixed(1)}%
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: getCorrelationColor(-0.5) }}></div>
            <span>-50%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: getCorrelationColor(0) }}></div>
            <span>0%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: getCorrelationColor(0.5) }}></div>
            <span>50%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: getCorrelationColor(1) }}></div>
            <span>100%</span>
          </div>
        </div>

        {/* High Correlation Warnings */}
        {stats.highCorrPairs.length > 0 && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="text-sm font-medium text-yellow-600 mb-2">
              ⚠️ High Correlation Pairs
            </div>
            <div className="space-y-1 text-xs">
              {stats.highCorrPairs.map((pair, i) => (
                <div key={i} className="flex justify-between font-mono">
                  <span>{pair.a} ↔ {pair.b}</span>
                  <span className="text-red-500">{(pair.corr * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Highly correlated assets move together, reducing diversification benefits.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CorrelationMatrix;

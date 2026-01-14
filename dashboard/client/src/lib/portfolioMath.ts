/**
 * Portfolio Math Utilities
 * 
 * Functions for calculating portfolio risk metrics including:
 * - Correlation between assets
 * - Portfolio volatility (standard deviation)
 * - Covariance matrix
 * - Diversification score
 * - Beta calculations
 */

export interface AssetReturnData {
  symbol: string;
  assetId: number;
  returns: number[]; // Daily percentage returns (e.g., 0.01 for 1%)
  stdDev: number;    // Annualized standard deviation
  avgReturn: number; // Average daily return
}

export interface PortfolioRiskMetrics {
  volatility: number;           // Annualized portfolio volatility
  diversificationScore: number; // 0-1, higher = more diversified
  beta: number;                 // Portfolio beta vs benchmark
  sharpeRatio: number;          // Risk-adjusted return
  maxDrawdown: number;          // Maximum historical drawdown
  correlationMatrix: number[][]; // NxN correlation matrix
}

/**
 * Calculate daily returns from price series
 */
export function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/**
 * Calculate annualized standard deviation from daily returns
 * Assumes 252 trading days per year
 */
export function calculateAnnualizedStdDev(returns: number[]): number {
  if (returns.length === 0) return 0;
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
  const dailyStdDev = Math.sqrt(variance);
  
  // Annualize: multiply by sqrt(252) for equities, sqrt(365) for crypto
  return dailyStdDev * Math.sqrt(252);
}

/**
 * Calculate correlation between two assets
 */
export function calculateCorrelation(assetA: AssetReturnData, assetB: AssetReturnData): number {
  const n = Math.min(assetA.returns.length, assetB.returns.length);
  if (n < 2) return 0;

  const returnsA = assetA.returns.slice(-n);
  const returnsB = assetB.returns.slice(-n);

  const avgA = returnsA.reduce((a, b) => a + b, 0) / n;
  const avgB = returnsB.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    const diffA = returnsA[i] - avgA;
    const diffB = returnsB[i] - avgB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  const denominator = Math.sqrt(denomA * denomB);
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Build a full correlation matrix for all assets
 */
export function buildCorrelationMatrix(assets: AssetReturnData[]): number[][] {
  const n = assets.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const corr = calculateCorrelation(assets[i], assets[j]);
        matrix[i][j] = corr;
        matrix[j][i] = corr; // Symmetric
      }
    }
  }

  return matrix;
}

/**
 * Calculate Total Portfolio Volatility (Standard Deviation)
 * Uses the variance-covariance approach
 */
export function calculatePortfolioVolatility(
  assets: AssetReturnData[],
  weights: { [symbol: string]: number } // Weights sum to 1.0
): number {
  let variance = 0;

  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      const symA = assets[i].symbol;
      const symB = assets[j].symbol;
      const weightA = weights[symA] || 0;
      const weightB = weights[symB] || 0;
      
      if (weightA === 0 || weightB === 0) continue;

      const corr = calculateCorrelation(assets[i], assets[j]);
      const volA = assets[i].stdDev;
      const volB = assets[j].stdDev;

      variance += weightA * weightB * corr * volA * volB;
    }
  }

  return Math.sqrt(Math.max(0, variance));
}

/**
 * Calculate diversification score
 * 1 = perfectly diversified (no correlation)
 * 0 = no diversification (perfect correlation)
 */
export function calculateDiversificationScore(
  assets: AssetReturnData[],
  weights: { [symbol: string]: number }
): number {
  // Weighted average of individual volatilities
  let weightedAvgVol = 0;
  for (const asset of assets) {
    const weight = weights[asset.symbol] || 0;
    weightedAvgVol += weight * asset.stdDev;
  }

  // Portfolio volatility (accounts for correlations)
  const portfolioVol = calculatePortfolioVolatility(assets, weights);

  // Diversification benefit = reduction in volatility due to diversification
  if (weightedAvgVol === 0) return 0;
  
  return 1 - (portfolioVol / weightedAvgVol);
}

/**
 * Calculate portfolio beta vs a benchmark
 */
export function calculatePortfolioBeta(
  assets: AssetReturnData[],
  weights: { [symbol: string]: number },
  benchmarkReturns: number[]
): number {
  // Calculate weighted portfolio returns
  const minLength = Math.min(
    ...assets.map(a => a.returns.length),
    benchmarkReturns.length
  );
  
  if (minLength < 2) return 1;

  const portfolioReturns: number[] = [];
  for (let i = 0; i < minLength; i++) {
    let dayReturn = 0;
    for (const asset of assets) {
      const weight = weights[asset.symbol] || 0;
      const assetReturn = asset.returns[asset.returns.length - minLength + i] || 0;
      dayReturn += weight * assetReturn;
    }
    portfolioReturns.push(dayReturn);
  }

  // Calculate covariance and variance
  const benchSlice = benchmarkReturns.slice(-minLength);
  const avgPortfolio = portfolioReturns.reduce((a, b) => a + b, 0) / minLength;
  const avgBench = benchSlice.reduce((a, b) => a + b, 0) / minLength;

  let covariance = 0;
  let benchVariance = 0;

  for (let i = 0; i < minLength; i++) {
    const diffP = portfolioReturns[i] - avgPortfolio;
    const diffB = benchSlice[i] - avgBench;
    covariance += diffP * diffB;
    benchVariance += diffB * diffB;
  }

  if (benchVariance === 0) return 1;
  
  return covariance / benchVariance;
}

/**
 * Calculate Sharpe Ratio
 * Assumes risk-free rate of 4% annually
 */
export function calculateSharpeRatio(
  portfolioReturn: number, // Annualized return
  portfolioVolatility: number,
  riskFreeRate: number = 0.04
): number {
  if (portfolioVolatility === 0) return 0;
  return (portfolioReturn - riskFreeRate) / portfolioVolatility;
}

/**
 * Calculate maximum drawdown from a price series
 */
export function calculateMaxDrawdown(prices: number[]): number {
  if (prices.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = prices[0];

  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    const drawdown = (peak - price) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculate all portfolio risk metrics
 */
export function calculatePortfolioRiskMetrics(
  assets: AssetReturnData[],
  weights: { [symbol: string]: number },
  benchmarkReturns?: number[]
): PortfolioRiskMetrics {
  const volatility = calculatePortfolioVolatility(assets, weights);
  const diversificationScore = calculateDiversificationScore(assets, weights);
  const correlationMatrix = buildCorrelationMatrix(assets);
  
  // Calculate weighted portfolio return
  let portfolioReturn = 0;
  for (const asset of assets) {
    const weight = weights[asset.symbol] || 0;
    portfolioReturn += weight * asset.avgReturn * 252; // Annualize
  }

  const beta = benchmarkReturns 
    ? calculatePortfolioBeta(assets, weights, benchmarkReturns)
    : 1;
  
  const sharpeRatio = calculateSharpeRatio(portfolioReturn, volatility);

  // Max drawdown requires portfolio price series - estimate from volatility
  const maxDrawdown = volatility * 2; // Rough estimate

  return {
    volatility,
    diversificationScore,
    beta,
    sharpeRatio,
    maxDrawdown,
    correlationMatrix,
  };
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Get correlation color for heatmap
 * Red = high positive, Blue = high negative, White = neutral
 */
export function getCorrelationColor(correlation: number): string {
  const intensity = Math.abs(correlation);
  if (correlation > 0) {
    // Red for positive correlation
    const r = 255;
    const g = Math.round(255 * (1 - intensity));
    const b = Math.round(255 * (1 - intensity));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Blue for negative correlation
    const r = Math.round(255 * (1 - intensity));
    const g = Math.round(255 * (1 - intensity));
    const b = 255;
    return `rgb(${r}, ${g}, ${b})`;
  }
}

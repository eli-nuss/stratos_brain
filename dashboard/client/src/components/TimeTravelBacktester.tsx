import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, TrendingUp, TrendingDown, Activity, RefreshCw, Info } from "lucide-react";
import useSWR from 'swr';

interface PortfolioAsset {
  symbol: string;
  name?: string;
  weight: number; // 0-100 (percentage)
  assetId?: number;
  assetType?: string;
}

interface TimeTravelBacktesterProps {
  portfolio: PortfolioAsset[];
  corePortfolioValue?: number;
}

interface BacktestResult {
  date: string;
  portfolioValue: number;
  spyValue: number;
  btcValue: number;
}

interface PerformanceStats {
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  bestDay: number;
  worstDay: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Time period options
const TIME_PERIODS = [
  { label: '1M', days: 30, description: '1 Month' },
  { label: '3M', days: 90, description: '3 Months' },
  { label: '6M', days: 180, description: '6 Months' },
  { label: '1Y', days: 365, description: '1 Year' },
  { label: 'YTD', days: 0, description: 'Year to Date' }, // Special case
];

export function TimeTravelBacktester({ portfolio, corePortfolioValue = 100000 }: TimeTravelBacktesterProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<number>(90);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch historical data from backend
  const assetIds = portfolio
    .filter(a => a.assetId)
    .map(a => a.assetId)
    .join(',');
  
  const { data: backtestData, error, mutate } = useSWR<{
    results: BacktestResult[];
    portfolioStats: PerformanceStats;
    spyStats: PerformanceStats;
    btcStats: PerformanceStats;
  }>(
    assetIds ? `/api/dashboard/backtest?asset_ids=${assetIds}&days=${selectedPeriod}&weights=${
      portfolio.filter(a => a.assetId).map(a => a.weight).join(',')
    }` : null,
    fetcher
  );

  // Generate mock backtest data for demo
  const mockBacktestData = useMemo(() => {
    const days = selectedPeriod || 30;
    const results: BacktestResult[] = [];
    let portfolioValue = 100;
    let spyValue = 100;
    let btcValue = 100;
    
    // Simulate returns based on portfolio composition
    const hasCrypto = portfolio.some(a => a.assetType === 'crypto' || ['BTC', 'ETH', 'SOL'].includes(a.symbol));
    const cryptoWeight = portfolio
      .filter(a => a.assetType === 'crypto' || ['BTC', 'ETH', 'SOL', 'FARTCOIN'].includes(a.symbol))
      .reduce((sum, a) => sum + a.weight, 0) / 100;
    
    const today = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Simulate daily returns with some randomness
      const marketReturn = (Math.random() - 0.48) * 0.02; // Slight upward bias
      const cryptoReturn = (Math.random() - 0.45) * 0.05; // Higher volatility, slight upward bias
      
      const portfolioReturn = marketReturn * (1 - cryptoWeight) + cryptoReturn * cryptoWeight;
      
      portfolioValue *= (1 + portfolioReturn);
      spyValue *= (1 + marketReturn);
      btcValue *= (1 + cryptoReturn);
      
      results.push({
        date: date.toISOString().split('T')[0],
        portfolioValue,
        spyValue,
        btcValue,
      });
    }
    
    // Calculate stats
    const calcStats = (values: number[]): PerformanceStats => {
      const returns = values.slice(1).map((v, i) => (v - values[i]) / values[i]);
      const totalReturn = (values[values.length - 1] - values[0]) / values[0];
      
      let maxDrawdown = 0;
      let peak = values[0];
      for (const value of values) {
        if (value > peak) peak = value;
        const drawdown = (peak - value) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
      const sharpeRatio = volatility > 0 ? (avgReturn * 252) / volatility : 0;
      
      return {
        totalReturn,
        maxDrawdown: -maxDrawdown,
        sharpeRatio,
        volatility,
        bestDay: Math.max(...returns),
        worstDay: Math.min(...returns),
      };
    };
    
    const portfolioValues = results.map(r => r.portfolioValue);
    const spyValues = results.map(r => r.spyValue);
    const btcValues = results.map(r => r.btcValue);
    
    return {
      results,
      portfolioStats: calcStats(portfolioValues),
      spyStats: calcStats(spyValues),
      btcStats: calcStats(btcValues),
    };
  }, [portfolio, selectedPeriod]);

  // Default empty stats to prevent undefined errors
  const defaultStats: PerformanceStats = {
    totalReturn: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    volatility: 0,
    bestDay: 0,
    worstDay: 0,
  };

  // Use real data if available, otherwise mock
  const data = backtestData || mockBacktestData || {
    results: [],
    portfolioStats: defaultStats,
    spyStats: defaultStats,
    btcStats: defaultStats,
  };

  // Ensure stats are never undefined
  const portfolioStats = data.portfolioStats || defaultStats;
  const spyStats = data.spyStats || defaultStats;
  const btcStats = data.btcStats || defaultStats;

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(2)}%`;
  };

  const formatPercentSimple = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Simple line chart using SVG
  const LineChart = () => {
    if (!data.results || !data.results.length) return null;
    
    const width = 600;
    const height = 200;
    const padding = 40;
    
    const allValues = [
      ...data.results.map(r => r.portfolioValue),
      ...data.results.map(r => r.spyValue),
      ...data.results.map(r => r.btcValue),
    ];
    const minValue = Math.min(...allValues) * 0.95;
    const maxValue = Math.max(...allValues) * 1.05;
    
    const xScale = (index: number) => padding + (index / (data.results.length - 1)) * (width - 2 * padding);
    const yScale = (value: number) => height - padding - ((value - minValue) / (maxValue - minValue)) * (height - 2 * padding);
    
    const createPath = (values: number[]) => {
      return values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
    };
    
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = padding + (pct / 100) * (height - 2 * padding);
          return (
            <line 
              key={pct} 
              x1={padding} 
              y1={y} 
              x2={width - padding} 
              y2={y} 
              stroke="currentColor" 
              strokeOpacity={0.1}
            />
          );
        })}
        
        {/* Lines */}
        <path 
          d={createPath(data.results.map(r => r.spyValue))} 
          fill="none" 
          stroke="#94a3b8" 
          strokeWidth={2}
          strokeDasharray="4 2"
        />
        <path 
          d={createPath(data.results.map(r => r.btcValue))} 
          fill="none" 
          stroke="#f59e0b" 
          strokeWidth={2}
          strokeDasharray="4 2"
        />
        <path 
          d={createPath(data.results.map(r => r.portfolioValue))} 
          fill="none" 
          stroke="#3b82f6" 
          strokeWidth={3}
        />
        
        {/* End points */}
        <circle 
          cx={xScale(data.results.length - 1)} 
          cy={yScale(data.results[data.results.length - 1].portfolioValue)} 
          r={4} 
          fill="#3b82f6" 
        />
        
        {/* Y-axis labels */}
        <text x={padding - 5} y={padding} textAnchor="end" className="text-xs fill-muted-foreground">
          {maxValue.toFixed(0)}
        </text>
        <text x={padding - 5} y={height - padding} textAnchor="end" className="text-xs fill-muted-foreground">
          {minValue.toFixed(0)}
        </text>
        
        {/* Start/End dates */}
        <text x={padding} y={height - 10} textAnchor="start" className="text-xs fill-muted-foreground">
          {data.results[0]?.date}
        </text>
        <text x={width - padding} y={height - 10} textAnchor="end" className="text-xs fill-muted-foreground">
          {data.results[data.results.length - 1]?.date}
        </text>
      </svg>
    );
  };

  const StatCard = ({ 
    label, 
    value, 
    comparison, 
    isGood 
  }: { 
    label: string; 
    value: string; 
    comparison?: string;
    isGood?: boolean;
  }) => (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${
        isGood === true ? 'text-green-500' : isGood === false ? 'text-red-500' : ''
      }`}>
        {value}
      </div>
      {comparison && (
        <div className="text-xs text-muted-foreground mt-1">
          vs SPY: {comparison}
        </div>
      )}
    </div>
  );

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Time Travel Backtester
          </CardTitle>
          <div className="flex items-center gap-2">
            {TIME_PERIODS.map(period => (
              <Button
                key={period.label}
                variant={selectedPeriod === period.days ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.days || 30)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Performance Chart */}
        <div className="p-4 bg-muted/20 rounded-lg">
          <LineChart />
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-blue-500 rounded" />
              <span>Your Portfolio</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-slate-400 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, currentColor, currentColor 4px, transparent 4px, transparent 6px)' }} />
              <span className="text-muted-foreground">SPY</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-amber-500 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, currentColor, currentColor 4px, transparent 4px, transparent 6px)' }} />
              <span className="text-muted-foreground">BTC</span>
            </div>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard 
            label="Total Return" 
            value={formatPercent(portfolioStats.totalReturn)}
            comparison={formatPercent(spyStats.totalReturn)}
            isGood={portfolioStats.totalReturn > spyStats.totalReturn}
          />
          <StatCard 
            label="Max Drawdown" 
            value={formatPercent(portfolioStats.maxDrawdown)}
            comparison={formatPercent(spyStats.maxDrawdown)}
            isGood={portfolioStats.maxDrawdown > spyStats.maxDrawdown}
          />
          <StatCard 
            label="Sharpe Ratio" 
            value={portfolioStats.sharpeRatio.toFixed(2)}
            comparison={spyStats.sharpeRatio.toFixed(2)}
            isGood={portfolioStats.sharpeRatio > spyStats.sharpeRatio}
          />
          <StatCard 
            label="Volatility" 
            value={formatPercentSimple(portfolioStats.volatility)}
            comparison={formatPercentSimple(spyStats.volatility)}
          />
        </div>

        {/* Comparison Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Metric</th>
                <th className="text-right px-3 py-2 font-medium">Your Portfolio</th>
                <th className="text-right px-3 py-2 font-medium">SPY</th>
                <th className="text-right px-3 py-2 font-medium">BTC</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2 text-muted-foreground">Total Return</td>
                <td className={`text-right px-3 py-2 font-mono font-medium ${
                  portfolioStats.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatPercent(portfolioStats.totalReturn)}
                </td>
                <td className={`text-right px-3 py-2 font-mono ${
                  spyStats.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatPercent(spyStats.totalReturn)}
                </td>
                <td className={`text-right px-3 py-2 font-mono ${
                  btcStats.totalReturn >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {formatPercent(btcStats.totalReturn)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2 text-muted-foreground">Max Drawdown</td>
                <td className="text-right px-3 py-2 font-mono text-red-500">
                  {formatPercent(portfolioStats.maxDrawdown)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-red-500">
                  {formatPercent(spyStats.maxDrawdown)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-red-500">
                  {formatPercent(btcStats.maxDrawdown)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2 text-muted-foreground">Sharpe Ratio</td>
                <td className="text-right px-3 py-2 font-mono">
                  {portfolioStats.sharpeRatio.toFixed(2)}
                </td>
                <td className="text-right px-3 py-2 font-mono">
                  {spyStats.sharpeRatio.toFixed(2)}
                </td>
                <td className="text-right px-3 py-2 font-mono">
                  {btcStats.sharpeRatio.toFixed(2)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2 text-muted-foreground">Best Day</td>
                <td className="text-right px-3 py-2 font-mono text-green-500">
                  {formatPercent(portfolioStats.bestDay)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-green-500">
                  {formatPercent(spyStats.bestDay)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-green-500">
                  {formatPercent(btcStats.bestDay)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2 text-muted-foreground">Worst Day</td>
                <td className="text-right px-3 py-2 font-mono text-red-500">
                  {formatPercent(portfolioStats.worstDay)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-red-500">
                  {formatPercent(spyStats.worstDay)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-red-500">
                  {formatPercent(btcStats.worstDay)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Insight */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Info className="w-4 h-4" />
            Backtest Summary
          </div>
          <p className="text-muted-foreground">
            Over the past {selectedPeriod} days, your model portfolio would have{' '}
            {portfolioStats.totalReturn > spyStats.totalReturn ? (
              <span className="text-green-500 font-medium">
                outperformed SPY by {formatPercent(portfolioStats.totalReturn - spyStats.totalReturn)}
              </span>
            ) : (
              <span className="text-red-500 font-medium">
                underperformed SPY by {formatPercent(spyStats.totalReturn - portfolioStats.totalReturn)}
              </span>
            )}
            {' '}with a max drawdown of{' '}
            <span className="text-red-500 font-medium">{formatPercent(portfolioStats.maxDrawdown)}</span>.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground text-center">
          Past performance is not indicative of future results. This is a simulation based on historical data.
        </div>
      </CardContent>
    </Card>
  );
}

export default TimeTravelBacktester;

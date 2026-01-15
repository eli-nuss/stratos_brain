import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Copy, Download, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Holding {
  symbol: string;
  name: string;
  assetId: number;
  quantity: number;
  price: number;
  currentValue: number;
  currentWeight: number; // 0-100
}

interface RebalanceCalculatorProps {
  currentHoldings: Holding[];
  targetWeights: { [symbol: string]: number }; // 0-100 (percentages)
  corePortfolioValue: number;
  onClose?: () => void;
}

interface Trade {
  symbol: string;
  name: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  shares: number;
  amount: number;
  price: number;
  currentWeight: number;
  targetWeight: number;
  currentValue: number;
  targetValue: number;
}

export function RebalanceCalculator({ 
  currentHoldings, 
  targetWeights, 
  corePortfolioValue,
  onClose 
}: RebalanceCalculatorProps) {
  const [additionalCash, setAdditionalCash] = useState<number>(0);
  
  const newTotalEquity = corePortfolioValue + additionalCash;

  const trades = useMemo(() => {
    return currentHoldings.map(holding => {
      const targetWeight = targetWeights[holding.symbol] || 0;
      const targetValue = newTotalEquity * (targetWeight / 100);
      const currentValue = holding.currentValue;
      const diffValue = targetValue - currentValue;
      const sharesToTrade = holding.price > 0 ? Math.round(diffValue / holding.price) : 0;
      
      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (sharesToTrade > 0) action = 'BUY';
      else if (sharesToTrade < 0) action = 'SELL';
      
      return {
        symbol: holding.symbol,
        name: holding.name,
        action,
        shares: Math.abs(sharesToTrade),
        amount: Math.abs(diffValue),
        price: holding.price,
        currentWeight: holding.currentWeight,
        targetWeight,
        currentValue,
        targetValue,
      };
    }).sort((a, b) => b.amount - a.amount); // Sort by trade size
  }, [currentHoldings, targetWeights, newTotalEquity]);

  const activeTrades = trades.filter(t => t.action !== 'HOLD' && t.shares > 0);
  const totalBuys = activeTrades.filter(t => t.action === 'BUY').reduce((sum, t) => sum + t.amount, 0);
  const totalSells = activeTrades.filter(t => t.action === 'SELL').reduce((sum, t) => sum + t.amount, 0);
  const netCashFlow = totalSells - totalBuys;

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPrice = (value: number) => {
    if (value < 1) return `$${value.toFixed(4)}`;
    return `$${value.toFixed(2)}`;
  };

  const copyTradeSheet = () => {
    const lines = activeTrades.map(t => 
      `${t.action}\t${t.symbol}\t${t.shares}\t${formatPrice(t.price)}\t${formatCurrency(t.amount)}`
    );
    const header = 'Action\tSymbol\tShares\tPrice\tAmount';
    const text = [header, ...lines].join('\n');
    navigator.clipboard.writeText(text);
  };

  const downloadCSV = () => {
    const lines = activeTrades.map(t => 
      `${t.action},${t.symbol},${t.shares},${t.price.toFixed(2)},${t.amount.toFixed(2)}`
    );
    const header = 'Action,Symbol,Shares,Price,Amount';
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebalance_trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">Rebalance Calculator</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Calculates the exact trades needed to align your current holdings with your target model portfolio weights. Shows buy/sell amounts and share counts.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={copyTradeSheet}>
                  <Copy className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy Trade Sheet</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download CSV</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cash Input */}
        <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <label htmlFor="cash" className="text-sm font-medium text-muted-foreground cursor-help">
                  Additional Cash to Invest
                </label>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Enter new cash you want to add to your portfolio. The calculator will factor this into the rebalancing trades, prioritizing buys over sells.</p>
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-muted-foreground">$</span>
              <Input 
                id="cash" 
                type="number" 
                value={additionalCash} 
                onChange={(e) => setAdditionalCash(Number(e.target.value))} 
                placeholder="0.00"
                className="max-w-[200px] font-mono"
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">New Total Equity</div>
            <div className="text-lg font-bold font-mono">{formatCurrency(newTotalEquity)}</div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg cursor-help">
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  Total Buys
                </div>
                <div className="text-lg font-bold font-mono text-green-600">
                  {formatCurrency(totalBuys)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Total dollar amount of all buy orders needed to reach your target weights.</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg cursor-help">
                <div className="flex items-center gap-1 text-red-600 text-sm">
                  <TrendingDown className="w-4 h-4" />
                  Total Sells
                </div>
                <div className="text-lg font-bold font-mono text-red-600">
                  {formatCurrency(totalSells)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Total dollar amount of all sell orders needed to reach your target weights.</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`p-3 rounded-lg cursor-help ${netCashFlow >= 0 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-orange-500/10 border border-orange-500/30'}`}>
                <div className="text-sm text-muted-foreground">Net Cash Flow</div>
                <div className={`text-lg font-bold font-mono ${netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p><strong>Net Cash Flow:</strong> Sells minus Buys. Positive means you'll have cash left over after rebalancing. Negative means you need additional cash to complete all trades.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Trade Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="text-left px-3 py-2 font-medium cursor-help">Action</th>
                  </TooltipTrigger>
                  <TooltipContent>BUY, SELL, or HOLD based on weight difference</TooltipContent>
                </Tooltip>
                <th className="text-left px-3 py-2 font-medium">Symbol</th>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="text-right px-3 py-2 font-medium cursor-help">Shares</th>
                  </TooltipTrigger>
                  <TooltipContent>Number of shares to buy or sell</TooltipContent>
                </Tooltip>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="text-right px-3 py-2 font-medium cursor-help">Amount</th>
                  </TooltipTrigger>
                  <TooltipContent>Dollar value of the trade (Shares × Price)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="text-right px-3 py-2 font-medium cursor-help">Weight Δ</th>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Weight change: Current weight → Target weight. Shows how the allocation will shift after executing the trade.</p>
                  </TooltipContent>
                </Tooltip>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr 
                  key={trade.symbol} 
                  className={`border-t ${trade.action === 'HOLD' ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-2">
                    {trade.action === 'BUY' && (
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30">
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        BUY
                      </Badge>
                    )}
                    {trade.action === 'SELL' && (
                      <Badge className="bg-red-500/20 text-red-600 border-red-500/30 hover:bg-red-500/30">
                        <ArrowDownRight className="w-3 h-3 mr-1" />
                        SELL
                      </Badge>
                    )}
                    {trade.action === 'HOLD' && (
                      <Badge variant="outline" className="text-muted-foreground">
                        HOLD
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono font-medium">{trade.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {trade.name}
                    </div>
                  </td>
                  <td className="text-right px-3 py-2 font-mono">
                    {trade.shares > 0 ? trade.shares : '-'}
                  </td>
                  <td className="text-right px-3 py-2 font-mono text-muted-foreground">
                    {formatPrice(trade.price)}
                  </td>
                  <td className="text-right px-3 py-2 font-mono">
                    {trade.amount > 0 ? formatCurrency(trade.amount) : '-'}
                  </td>
                  <td className="text-right px-3 py-2 font-mono">
                    <span className={trade.targetWeight > trade.currentWeight ? 'text-green-600' : trade.targetWeight < trade.currentWeight ? 'text-red-600' : 'text-muted-foreground'}>
                      {trade.currentWeight.toFixed(1)}% → {trade.targetWeight.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {trades.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    No positions in portfolio
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {activeTrades.length === 0 && trades.length > 0 && (
          <div className="text-center py-4 text-muted-foreground bg-muted/30 rounded-lg">
            ✓ Portfolio is balanced. No trades needed.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RebalanceCalculator;

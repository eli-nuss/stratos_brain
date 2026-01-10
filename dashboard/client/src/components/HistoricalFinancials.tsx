import { useState } from "react";
import useSWR from "swr";
import { TrendingUp, TrendingDown, Minus, BarChart3, DollarSign, ArrowRightLeft, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface HistoricalFinancialsProps {
  assetId: number;
  assetType: string;
  embedded?: boolean; // When true, removes outer card styling for embedding in tabs
}

interface AnnualData {
  fiscal_date_ending: string;
  total_revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  operating_cashflow: number | null;
  investing_cashflow: number | null;
  financing_cashflow: number | null;
  free_cash_flow: number | null;
  ebitda: number | null;
}

// Format large numbers (in billions/millions)
const formatLargeNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absValue >= 1e12) return `${sign}$${(absValue / 1e12).toFixed(1)}T`;
  if (absValue >= 1e9) return `${sign}$${(absValue / 1e9).toFixed(1)}B`;
  if (absValue >= 1e6) return `${sign}$${(absValue / 1e6).toFixed(0)}M`;
  if (absValue >= 1e3) return `${sign}$${(absValue / 1e3).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
};

// Calculate YoY growth rate
const calculateGrowth = (current: number | null, previous: number | null): number | null => {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

// Get color for growth values
const getGrowthColor = (value: number | null): string => {
  if (value === null) return "text-muted-foreground";
  if (value > 10) return "text-emerald-400";
  if (value > 0) return "text-emerald-400/70";
  if (value < -10) return "text-red-400";
  if (value < 0) return "text-red-400/70";
  return "text-muted-foreground";
};

// Get color for cash flow values (positive is good for CFO, negative is typical for CFI/CFF)
const getCashFlowColor = (value: number | null, type: 'cfo' | 'cfi' | 'cff'): string => {
  if (value === null) return "text-muted-foreground";
  if (type === 'cfo') {
    // Operating cash flow: positive is good
    return value > 0 ? "text-emerald-400" : "text-red-400";
  }
  // Investing/Financing: just show the value, context matters
  return "text-foreground";
};

// Mini sparkline component
function Sparkline({ data, positive = true }: { data: (number | null)[]; positive?: boolean }) {
  const validData = data.filter((d): d is number => d !== null);
  if (validData.length < 2) return null;

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;
  
  const width = 60;
  const height = 20;
  const padding = 2;
  
  const points = validData.map((value, index) => {
    const x = padding + (index / (validData.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  // Determine trend direction
  const firstVal = validData[0];
  const lastVal = validData[validData.length - 1];
  const isUp = lastVal > firstVal;
  const strokeColor = isUp ? (positive ? '#34d399' : '#f87171') : (positive ? '#f87171' : '#34d399');

  return (
    <svg width={width} height={height} className="inline-block ml-2">
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Trend indicator component
function TrendIndicator({ current, previous }: { current: number | null; previous: number | null }) {
  const growth = calculateGrowth(current, previous);
  if (growth === null) return <Minus className="w-3 h-3 text-muted-foreground" />;
  
  if (growth > 5) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (growth < -5) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

// Extract fiscal year from date string
const getFiscalYear = (dateStr: string): string => {
  return dateStr.substring(0, 4);
};

// Row component for financial data
function FinancialRow({ 
  label, 
  values, 
  tooltip,
  sparklinePositive = true,
  isCashFlow = false,
  cashFlowType
}: { 
  label: string; 
  values: (number | null)[];
  tooltip: string;
  sparklinePositive?: boolean;
  isCashFlow?: boolean;
  cashFlowType?: 'cfo' | 'cfi' | 'cff';
}) {
  // Calculate growth rates
  const growthRates = values.map((val, idx) => 
    idx > 0 ? calculateGrowth(val, values[idx - 1]) : null
  );

  return (
    <tr className="border-b border-border/30 hover:bg-muted/10 transition-colors">
      <td className="py-2 pr-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground cursor-help flex items-center gap-1">
              {label}
              <Info className="w-3 h-3 text-muted-foreground/50" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </td>
      {values.map((value, idx) => (
        <td key={idx} className="py-2 px-2 text-right">
          <div className="flex flex-col items-end">
            <span className={`font-mono text-xs ${
              isCashFlow && cashFlowType 
                ? getCashFlowColor(value, cashFlowType)
                : value !== null && value < 0 ? 'text-red-400' : 'text-foreground'
            }`}>
              {formatLargeNumber(value)}
            </span>
            {idx > 0 && growthRates[idx] !== null && (
              <span className={`text-[10px] ${getGrowthColor(growthRates[idx])}`}>
                {growthRates[idx]! > 0 ? '+' : ''}{growthRates[idx]!.toFixed(0)}%
              </span>
            )}
          </div>
        </td>
      ))}
      <td className="py-2 pl-2">
        <Sparkline data={values} positive={sparklinePositive} />
      </td>
    </tr>
  );
}

export function HistoricalFinancials({ assetId, assetType, embedded = false }: HistoricalFinancialsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Only show for equities
  if (assetType !== 'equity') {
    return null;
  }

  const { data, isLoading, error } = useSWR<{ annual: AnnualData[] }>(
    `/api/dashboard/financials?asset_id=${assetId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Historical Financials</span>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted/30 rounded w-full"></div>
          <div className="h-4 bg-muted/30 rounded w-3/4"></div>
          <div className="h-4 bg-muted/30 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data?.annual || data.annual.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Historical Financials</span>
        </div>
        <p className="text-xs text-muted-foreground">No historical financial data available.</p>
      </div>
    );
  }

  // Get last 5 years of data (most recent first in API, so reverse for display)
  const annualData = data.annual.slice(0, 5).reverse();
  const years = annualData.map(d => getFiscalYear(d.fiscal_date_ending));

  // Extract values for each metric
  const revenue = annualData.map(d => d.total_revenue);
  const grossProfit = annualData.map(d => d.gross_profit);
  const operatingIncome = annualData.map(d => d.operating_income);
  const netIncome = annualData.map(d => d.net_income);
  const cfo = annualData.map(d => d.operating_cashflow);
  const cfi = annualData.map(d => d.investing_cashflow);
  const cff = annualData.map(d => d.financing_cashflow);
  const fcf = annualData.map(d => d.free_cash_flow);

  // Calculate margins for the most recent year
  const latestData = annualData[annualData.length - 1];
  const grossMargin = latestData.total_revenue && latestData.gross_profit 
    ? ((latestData.gross_profit / latestData.total_revenue) * 100).toFixed(1) 
    : null;
  const operatingMargin = latestData.total_revenue && latestData.operating_income
    ? ((latestData.operating_income / latestData.total_revenue) * 100).toFixed(1)
    : null;
  const netMargin = latestData.total_revenue && latestData.net_income
    ? ((latestData.net_income / latestData.total_revenue) * 100).toFixed(1)
    : null;

  // For embedded mode, show the table directly without the collapsible card wrapper
  if (embedded) {
    return (
      <div className="bg-muted/5 rounded-lg border border-border p-4 overflow-x-auto">
        {/* Header with margin indicators */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Historical Financials</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {years.length}Y
            </span>
          </div>
          <div className="flex items-center gap-3">
            {grossMargin && (
              <span className="text-[10px] text-muted-foreground">
                GM: <span className="text-foreground font-mono">{grossMargin}%</span>
              </span>
            )}
            {operatingMargin && (
              <span className="text-[10px] text-muted-foreground">
                OM: <span className="text-foreground font-mono">{operatingMargin}%</span>
              </span>
            )}
            {netMargin && (
              <span className="text-[10px] text-muted-foreground">
                NM: <span className="text-foreground font-mono">{netMargin}%</span>
              </span>
            )}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-32">Metric</th>
              {years.map(year => (
                <th key={year} className="text-right py-2 px-2 text-xs font-medium text-muted-foreground w-20">
                  FY{year.slice(2)}
                </th>
              ))}
              <th className="text-left py-2 pl-2 text-xs font-medium text-muted-foreground w-16">Trend</th>
            </tr>
          </thead>
          <tbody>
            {/* Income Statement Section */}
            <tr>
              <td colSpan={years.length + 2} className="pt-3 pb-1">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Income Statement</span>
                </div>
              </td>
            </tr>
            <FinancialRow 
              label="Revenue" 
              values={revenue} 
              tooltip="Total revenue from all sources (top line)"
            />
            <FinancialRow 
              label="Gross Profit" 
              values={grossProfit} 
              tooltip="Revenue minus cost of goods sold"
            />
            <FinancialRow 
              label="Operating Income" 
              values={operatingIncome} 
              tooltip="Profit from core operations before interest and taxes (EBIT)"
            />
            <FinancialRow 
              label="Net Income" 
              values={netIncome} 
              tooltip="Bottom line profit after all expenses, interest, and taxes"
            />

            {/* Cash Flow Section */}
            <tr>
              <td colSpan={years.length + 2} className="pt-4 pb-1">
                <div className="flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Cash Flow Statement</span>
                </div>
              </td>
            </tr>
            <FinancialRow 
              label="CFO" 
              values={cfo} 
              tooltip="Cash Flow from Operations - cash generated from core business activities"
              isCashFlow
              cashFlowType="cfo"
            />
            <FinancialRow 
              label="CFI" 
              values={cfi} 
              tooltip="Cash Flow from Investing - cash used for/from investments, acquisitions, and capex (typically negative)"
              isCashFlow
              cashFlowType="cfi"
              sparklinePositive={false}
            />
            <FinancialRow 
              label="CFF" 
              values={cff} 
              tooltip="Cash Flow from Financing - cash from/used for debt, equity, and dividends"
              isCashFlow
              cashFlowType="cff"
            />
            <FinancialRow 
              label="Free Cash Flow" 
              values={fcf} 
              tooltip="Cash available after capital expenditures (CFO - CapEx)"
            />
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Historical Financials</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {years.length}Y
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick margin indicators */}
          {grossMargin && (
            <span className="text-[10px] text-muted-foreground">
              GM: <span className="text-foreground font-mono">{grossMargin}%</span>
            </span>
          )}
          {operatingMargin && (
            <span className="text-[10px] text-muted-foreground">
              OM: <span className="text-foreground font-mono">{operatingMargin}%</span>
            </span>
          )}
          {netMargin && (
            <span className="text-[10px] text-muted-foreground">
              NM: <span className="text-foreground font-mono">{netMargin}%</span>
            </span>
          )}
          {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {!isCollapsed && (
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-32">Metric</th>
                {years.map(year => (
                  <th key={year} className="text-right py-2 px-2 text-xs font-medium text-muted-foreground w-20">
                    FY{year.slice(2)}
                  </th>
                ))}
                <th className="text-left py-2 pl-2 text-xs font-medium text-muted-foreground w-16">Trend</th>
              </tr>
            </thead>
            <tbody>
              {/* Income Statement Section */}
              <tr>
                <td colSpan={years.length + 2} className="pt-3 pb-1">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Income Statement</span>
                  </div>
                </td>
              </tr>
              <FinancialRow 
                label="Revenue" 
                values={revenue} 
                tooltip="Total revenue from all sources (top line)"
              />
              <FinancialRow 
                label="Gross Profit" 
                values={grossProfit} 
                tooltip="Revenue minus cost of goods sold"
              />
              <FinancialRow 
                label="Operating Income" 
                values={operatingIncome} 
                tooltip="Profit from core operations before interest and taxes (EBIT)"
              />
              <FinancialRow 
                label="Net Income" 
                values={netIncome} 
                tooltip="Bottom line profit after all expenses, interest, and taxes"
              />

              {/* Cash Flow Section */}
              <tr>
                <td colSpan={years.length + 2} className="pt-4 pb-1">
                  <div className="flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Cash Flow Statement</span>
                  </div>
                </td>
              </tr>
              <FinancialRow 
                label="CFO" 
                values={cfo} 
                tooltip="Cash Flow from Operations - cash generated from core business activities"
                isCashFlow
                cashFlowType="cfo"
              />
              <FinancialRow 
                label="CFI" 
                values={cfi} 
                tooltip="Cash Flow from Investing - cash used for/from investments, acquisitions, and capex (typically negative)"
                isCashFlow
                cashFlowType="cfi"
                sparklinePositive={false}
              />
              <FinancialRow 
                label="CFF" 
                values={cff} 
                tooltip="Cash Flow from Financing - cash from/used for debt, equity, and dividends"
                isCashFlow
                cashFlowType="cff"
              />
              <FinancialRow 
                label="Free Cash Flow" 
                values={fcf} 
                tooltip="Cash available after capital expenditures (CFO - CapEx)"
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

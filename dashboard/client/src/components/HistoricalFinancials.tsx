import { useState } from "react";
import useSWR from "swr";
import { BarChart3, DollarSign, ArrowRightLeft, ChevronDown, ChevronUp, Info, Percent } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface HistoricalFinancialsProps {
  assetId: number;
  assetType: string;
  embedded?: boolean;
}

interface FinancialData {
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
  eps_diluted: string | null;
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

// Format percentage values
const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
};

// Format EPS values
const formatEPS = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return "—";
  return `$${numValue.toFixed(2)}`;
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

// Get color for margin change (expansion = good, compression = bad)
const getMarginChangeColor = (current: number | null, previous: number | null): string => {
  if (current === null || previous === null) return "text-muted-foreground";
  const change = current - previous;
  if (change > 1) return "text-emerald-400"; // Margin expansion > 1pp
  if (change > 0) return "text-emerald-400/70";
  if (change < -1) return "text-red-400"; // Margin compression > 1pp
  if (change < 0) return "text-red-400/70";
  return "text-muted-foreground";
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

// Extract fiscal year/quarter from date string
const getFiscalYear = (dateStr: string): string => {
  return dateStr.substring(0, 4);
};

const getQuarterLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  const month = date.getMonth();
  const year = date.getFullYear().toString().slice(2);
  // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
  if (month <= 2) return `Q1'${year}`;
  if (month <= 5) return `Q2'${year}`;
  if (month <= 8) return `Q3'${year}`;
  return `Q4'${year}`;
};

// Row component for financial data
function FinancialRow({ 
  label, 
  values, 
  tooltip,
  sparklinePositive = true,
  isNeutralColor = false,
  formatFn = formatLargeNumber
}: { 
  label: string; 
  values: (number | null)[];
  tooltip: string;
  sparklinePositive?: boolean;
  isNeutralColor?: boolean;
  formatFn?: (value: number | null | undefined) => string;
}) {
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
              isNeutralColor 
                ? 'text-blue-400' 
                : value !== null && value < 0 ? 'text-red-400' : 'text-foreground'
            }`}>
              {formatFn(value)}
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

// Margin row component (shows percentage and pp change)
function MarginRow({ 
  label, 
  values, 
  tooltip
}: { 
  label: string; 
  values: (number | null)[];
  tooltip: string;
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/10 transition-colors bg-muted/5">
      <td className="py-1.5 pr-4 pl-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[11px] text-muted-foreground/80 cursor-help flex items-center gap-1 italic">
              {label}
              <Info className="w-2.5 h-2.5 text-muted-foreground/40" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </td>
      {values.map((value, idx) => {
        const prevValue = idx > 0 ? values[idx - 1] : null;
        const change = value !== null && prevValue !== null ? value - prevValue : null;
        return (
          <td key={idx} className="py-1.5 px-2 text-right">
            <div className="flex flex-col items-end">
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatPercent(value)}
              </span>
              {idx > 0 && change !== null && (
                <span className={`text-[9px] ${getMarginChangeColor(value, prevValue)}`}>
                  {change > 0 ? '+' : ''}{change.toFixed(1)}pp
                </span>
              )}
            </div>
          </td>
        );
      })}
      <td className="py-1.5 pl-2">
        <Sparkline data={values} positive={true} />
      </td>
    </tr>
  );
}

// EPS row component
function EPSRow({ 
  label, 
  values, 
  tooltip
}: { 
  label: string; 
  values: (string | number | null)[];
  tooltip: string;
}) {
  const numericValues = values.map(v => {
    if (v === null) return null;
    const num = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(num) ? null : num;
  });

  const growthRates = numericValues.map((val, idx) => 
    idx > 0 ? calculateGrowth(val, numericValues[idx - 1]) : null
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
            <span className="font-mono text-xs text-foreground">
              {formatEPS(value)}
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
        <Sparkline data={numericValues} positive={true} />
      </td>
    </tr>
  );
}

export function HistoricalFinancials({ assetId, assetType, embedded = false }: HistoricalFinancialsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'annual' | 'quarterly'>('annual');
  
  if (assetType !== 'equity') {
    return null;
  }

  const { data, isLoading, error } = useSWR<{ annual: FinancialData[], quarterly: FinancialData[] }>(
    `/api/dashboard/financials?asset_id=${assetId}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className={embedded ? "bg-muted/5 rounded-lg border border-border p-4" : "bg-card border border-border rounded-lg p-4"}>
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
      <div className={embedded ? "bg-muted/5 rounded-lg border border-border p-4" : "bg-card border border-border rounded-lg p-4"}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Historical Financials</span>
        </div>
        <p className="text-xs text-muted-foreground">No historical financial data available.</p>
      </div>
    );
  }

  // Get data based on view mode
  const displayData = viewMode === 'annual' 
    ? data.annual.slice(0, 5).reverse() 
    : (data.quarterly || []).slice(0, 8).reverse();
  
  const labels = viewMode === 'annual'
    ? displayData.map(d => `FY${getFiscalYear(d.fiscal_date_ending).slice(2)}`)
    : displayData.map(d => getQuarterLabel(d.fiscal_date_ending));

  // Extract values for each metric
  const revenue = displayData.map(d => d.total_revenue);
  const grossProfit = displayData.map(d => d.gross_profit);
  const operatingIncome = displayData.map(d => d.operating_income);
  const netIncome = displayData.map(d => d.net_income);
  const cfo = displayData.map(d => d.operating_cashflow);
  const cfi = displayData.map(d => d.investing_cashflow);
  const cff = displayData.map(d => d.financing_cashflow);
  const fcf = displayData.map(d => d.free_cash_flow);
  const eps = displayData.map(d => d.eps_diluted);

  // Calculate margins for each period
  const grossMargins = displayData.map(d => 
    d.total_revenue && d.gross_profit ? (d.gross_profit / d.total_revenue) * 100 : null
  );
  const operatingMargins = displayData.map(d => 
    d.total_revenue && d.operating_income ? (d.operating_income / d.total_revenue) * 100 : null
  );
  const netMargins = displayData.map(d => 
    d.total_revenue && d.net_income ? (d.net_income / d.total_revenue) * 100 : null
  );

  // Latest margins for header display
  const latestGrossMargin = grossMargins[grossMargins.length - 1];
  const latestOperatingMargin = operatingMargins[operatingMargins.length - 1];
  const latestNetMargin = netMargins[netMargins.length - 1];

  const renderTable = () => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-32">Metric</th>
          {labels.map((label, idx) => (
            <th key={idx} className="text-right py-2 px-2 text-xs font-medium text-muted-foreground w-20">
              {label}
            </th>
          ))}
          <th className="text-left py-2 pl-2 text-xs font-medium text-muted-foreground w-16">Trend</th>
        </tr>
      </thead>
      <tbody>
        {/* Income Statement Section */}
        <tr>
          <td colSpan={labels.length + 2} className="pt-3 pb-1">
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
        <MarginRow 
          label="↳ Gross Margin %" 
          values={grossMargins} 
          tooltip="Gross Profit / Revenue. Shows pricing power and cost efficiency. Expanding margins = good, compressing = concerning."
        />
        <FinancialRow 
          label="Operating Income" 
          values={operatingIncome} 
          tooltip="Profit from core operations before interest and taxes (EBIT)"
        />
        <MarginRow 
          label="↳ Operating Margin %" 
          values={operatingMargins} 
          tooltip="Operating Income / Revenue. Shows operational efficiency after all operating expenses."
        />
        <FinancialRow 
          label="Net Income" 
          values={netIncome} 
          tooltip="Bottom line profit after all expenses, interest, and taxes"
        />
        <MarginRow 
          label="↳ Net Margin %" 
          values={netMargins} 
          tooltip="Net Income / Revenue. Final profitability after all costs including taxes and interest."
        />
        <EPSRow 
          label="Diluted EPS" 
          values={eps} 
          tooltip="Earnings Per Share (diluted). Net income divided by all potential shares. Key metric for stock valuation - watch for dilution from stock-based compensation."
        />

        {/* Cash Flow Section */}
        <tr>
          <td colSpan={labels.length + 2} className="pt-4 pb-1">
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Cash Flow Statement</span>
            </div>
          </td>
        </tr>
        <FinancialRow 
          label="CFO" 
          values={cfo} 
          tooltip="Cash Flow from Operations - cash generated from core business activities. Should be positive and growing."
        />
        <FinancialRow 
          label="CFI" 
          values={cfi} 
          tooltip="Cash Flow from Investing - cash used for investments, acquisitions, and capex. Typically negative for growth companies (spending on future growth)."
          isNeutralColor={true}
          sparklinePositive={false}
        />
        <FinancialRow 
          label="CFF" 
          values={cff} 
          tooltip="Cash Flow from Financing - cash from/used for debt, equity, and dividends. Context matters: buybacks (negative) can be good, dilution (positive) can be bad."
          isNeutralColor={true}
        />
        <FinancialRow 
          label="Free Cash Flow" 
          values={fcf} 
          tooltip="Cash available after capital expenditures (CFO - CapEx). The real cash a company generates for shareholders."
        />
      </tbody>
    </table>
  );

  // Embedded mode (in tabs)
  if (embedded) {
    return (
      <div className="bg-muted/5 rounded-lg border border-border p-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Historical Financials</h3>
            {/* Annual/Quarterly Toggle */}
            <div className="flex items-center bg-muted/30 rounded-md p-0.5 ml-2">
              <button
                onClick={() => setViewMode('annual')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  viewMode === 'annual'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
              </button>
              <button
                onClick={() => setViewMode('quarterly')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  viewMode === 'quarterly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Quarterly
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {latestGrossMargin && (
              <span className="text-[10px] text-muted-foreground">
                GM: <span className="text-foreground font-mono">{latestGrossMargin.toFixed(1)}%</span>
              </span>
            )}
            {latestOperatingMargin && (
              <span className="text-[10px] text-muted-foreground">
                OM: <span className="text-foreground font-mono">{latestOperatingMargin.toFixed(1)}%</span>
              </span>
            )}
            {latestNetMargin && (
              <span className="text-[10px] text-muted-foreground">
                NM: <span className="text-foreground font-mono">{latestNetMargin.toFixed(1)}%</span>
              </span>
            )}
          </div>
        </div>
        {renderTable()}
      </div>
    );
  }

  // Card mode (standalone)
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Historical Financials</h3>
          {/* Annual/Quarterly Toggle */}
          <div className="flex items-center bg-muted/50 rounded-md p-0.5 ml-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setViewMode('annual')}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === 'annual'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => setViewMode('quarterly')}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === 'quarterly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Quarterly
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {latestGrossMargin && (
            <span className="text-[10px] text-muted-foreground">
              GM: <span className="text-foreground font-mono">{latestGrossMargin.toFixed(1)}%</span>
            </span>
          )}
          {latestOperatingMargin && (
            <span className="text-[10px] text-muted-foreground">
              OM: <span className="text-foreground font-mono">{latestOperatingMargin.toFixed(1)}%</span>
            </span>
          )}
          {latestNetMargin && (
            <span className="text-[10px] text-muted-foreground">
              NM: <span className="text-foreground font-mono">{latestNetMargin.toFixed(1)}%</span>
            </span>
          )}
          {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {!isCollapsed && (
        <div className="p-4 overflow-x-auto">
          {renderTable()}
        </div>
      )}
    </div>
  );
}

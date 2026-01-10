import { useState } from "react";
import useSWR from "swr";
import { BarChart3, DollarSign, ArrowRightLeft, ChevronDown, ChevronUp, Info, TrendingUp } from "lucide-react";
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
  total_shareholder_equity?: number | null;
  long_term_debt?: number | null;
  cash_and_equivalents?: number | null;
  income_tax_expense?: number | null;
  is_estimate?: boolean;
}

interface ForwardEstimates {
  fiscal_date_ending: string;
  total_revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  eps_diluted: string | null;
  is_estimate: boolean;
  growth_assumptions: {
    revenue_growth: number;
    earnings_growth: number;
    forward_pe: number | null;
    peg_ratio: number | null;
    analyst_target: number | null;
  };
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
  if (change > 1) return "text-emerald-400";
  if (change > 0) return "text-emerald-400/70";
  if (change < -1) return "text-red-400";
  if (change < 0) return "text-red-400/70";
  return "text-muted-foreground";
};

// Interactive sparkline component with hover tooltips
function Sparkline({ 
  data, 
  labels,
  positive = true,
  formatFn = formatLargeNumber
}: { 
  data: (number | null)[]; 
  labels: string[];
  positive?: boolean;
  formatFn?: (value: number | null | undefined) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const validData = data.map((d, i) => ({ value: d, index: i, label: labels[i] })).filter(d => d.value !== null);
  if (validData.length < 2) return null;

  const values = validData.map(d => d.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const width = 70;
  const height = 24;
  const padding = 4;
  
  const points = validData.map((d, i) => {
    const x = padding + (i / (validData.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((d.value as number - min) / range) * (height - 2 * padding);
    return { x, y, value: d.value, label: d.label, originalIndex: d.index };
  });

  const pathPoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const isUp = lastVal > firstVal;
  const strokeColor = isUp ? (positive ? '#34d399' : '#f87171') : (positive ? '#f87171' : '#34d399');

  return (
    <div className="relative inline-block">
      <svg 
        width={width} 
        height={height} 
        className="inline-block ml-2"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <polyline
          points={pathPoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Interactive hit areas for each point */}
        {points.map((point, idx) => (
          <circle
            key={idx}
            cx={point.x}
            cy={point.y}
            r={hoveredIndex === idx ? 4 : 3}
            fill={hoveredIndex === idx ? strokeColor : 'transparent'}
            stroke={strokeColor}
            strokeWidth={hoveredIndex === idx ? 2 : 0}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoveredIndex(idx)}
          />
        ))}
      </svg>
      {/* Tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div 
          className="absolute z-50 bg-popover border border-border rounded-md px-2 py-1 shadow-lg text-xs whitespace-nowrap"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '4px'
          }}
        >
          <div className="font-medium">{points[hoveredIndex].label}</div>
          <div className="text-muted-foreground">{formatFn(points[hoveredIndex].value)}</div>
        </div>
      )}
    </div>
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
  if (month <= 2) return `Q1'${year}`;
  if (month <= 5) return `Q2'${year}`;
  if (month <= 8) return `Q3'${year}`;
  return `Q4'${year}`;
};

// Calculate ROIC: NOPAT / Invested Capital
const calculateROIC = (data: FinancialData): number | null => {
  if (!data.operating_income || !data.total_shareholder_equity) return null;
  
  // Estimate tax rate (typically ~21% for US companies, but we can calculate from data)
  const taxRate = data.income_tax_expense && data.operating_income 
    ? Math.min(0.35, Math.max(0, data.income_tax_expense / data.operating_income))
    : 0.21;
  
  // NOPAT = Operating Income * (1 - Tax Rate)
  const nopat = data.operating_income * (1 - taxRate);
  
  // Invested Capital = Total Equity + Long-term Debt - Cash
  const investedCapital = 
    (data.total_shareholder_equity || 0) + 
    (data.long_term_debt || 0) - 
    (data.cash_and_equivalents || 0);
  
  if (investedCapital <= 0) return null;
  
  return (nopat / investedCapital) * 100;
};

// Row component for financial data
function FinancialRow({ 
  label, 
  values, 
  labels,
  tooltip,
  sparklinePositive = true,
  isNeutralColor = false,
  formatFn = formatLargeNumber,
  isEstimateColumn = false
}: { 
  label: string; 
  values: (number | null)[];
  labels: string[];
  tooltip: string;
  sparklinePositive?: boolean;
  isNeutralColor?: boolean;
  formatFn?: (value: number | null | undefined) => string;
  isEstimateColumn?: boolean;
}) {
  const growthRates = values.map((val, idx) => 
    idx > 0 ? calculateGrowth(val, values[idx - 1]) : null
  );

  // Separate actual vs estimate values for sparkline (don't include estimates)
  const actualValues = isEstimateColumn ? values.slice(0, -1) : values;
  const actualLabels = isEstimateColumn ? labels.slice(0, -1) : labels;

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
      {values.map((value, idx) => {
        const isEstimate = isEstimateColumn && idx === values.length - 1;
        return (
          <td 
            key={idx} 
            className={`py-2 px-2 text-right ${isEstimate ? 'bg-amber-500/5' : ''}`}
          >
            <div className="flex flex-col items-end">
              <span className={`font-mono text-xs ${
                isEstimate 
                  ? 'text-amber-400/80 italic' 
                  : isNeutralColor 
                    ? 'text-blue-400' 
                    : value !== null && value < 0 ? 'text-red-400' : 'text-foreground'
              }`}>
                {formatFn(value)}
              </span>
              {idx > 0 && growthRates[idx] !== null && !isNaN(growthRates[idx]!) && isFinite(growthRates[idx]!) && (
                <span className={`text-[10px] ${isEstimate ? 'text-amber-400/60' : getGrowthColor(growthRates[idx])}`}>
                  {growthRates[idx]! > 0 ? '+' : ''}{growthRates[idx]!.toFixed(0)}%
                </span>
              )}
            </div>
          </td>
        );
      })}
      <td className="py-2 pl-2">
        <Sparkline data={actualValues} labels={actualLabels} positive={sparklinePositive} formatFn={formatFn} />
      </td>
    </tr>
  );
}

// Margin row component (shows percentage and pp change)
function MarginRow({ 
  label, 
  values, 
  labels,
  tooltip,
  isEstimateColumn = false
}: { 
  label: string; 
  values: (number | null)[];
  labels: string[];
  tooltip: string;
  isEstimateColumn?: boolean;
}) {
  const actualValues = isEstimateColumn ? values.slice(0, -1) : values;
  const actualLabels = isEstimateColumn ? labels.slice(0, -1) : labels;

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
        const isEstimate = isEstimateColumn && idx === values.length - 1;
        return (
          <td key={idx} className={`py-1.5 px-2 text-right ${isEstimate ? 'bg-amber-500/5' : ''}`}>
            <div className="flex flex-col items-end">
              <span className={`font-mono text-[11px] ${isEstimate ? 'text-amber-400/60 italic' : 'text-muted-foreground'}`}>
                {formatPercent(value)}
              </span>
              {idx > 0 && change !== null && (
                <span className={`text-[9px] ${isEstimate ? 'text-amber-400/50' : getMarginChangeColor(value, prevValue)}`}>
                  {change > 0 ? '+' : ''}{change.toFixed(1)}pp
                </span>
              )}
            </div>
          </td>
        );
      })}
      <td className="py-1.5 pl-2">
        <Sparkline data={actualValues} labels={actualLabels} positive={true} formatFn={formatPercent} />
      </td>
    </tr>
  );
}

// EPS row component
function EPSRow({ 
  label, 
  values, 
  labels,
  tooltip,
  isEstimateColumn = false
}: { 
  label: string; 
  values: (string | number | null)[];
  labels: string[];
  tooltip: string;
  isEstimateColumn?: boolean;
}) {
  const numericValues = values.map(v => {
    if (v === null) return null;
    const num = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(num) ? null : num;
  });

  const growthRates = numericValues.map((val, idx) => 
    idx > 0 ? calculateGrowth(val, numericValues[idx - 1]) : null
  );

  const actualValues = isEstimateColumn ? numericValues.slice(0, -1) : numericValues;
  const actualLabels = isEstimateColumn ? labels.slice(0, -1) : labels;

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
      {values.map((value, idx) => {
        const isEstimate = isEstimateColumn && idx === values.length - 1;
        return (
          <td key={idx} className={`py-2 px-2 text-right ${isEstimate ? 'bg-amber-500/5' : ''}`}>
            <div className="flex flex-col items-end">
              <span className={`font-mono text-xs ${isEstimate ? 'text-amber-400/80 italic' : 'text-foreground'}`}>
                {formatEPS(value)}
              </span>
              {idx > 0 && growthRates[idx] !== null && !isNaN(growthRates[idx]!) && isFinite(growthRates[idx]!) && (
                <span className={`text-[10px] ${isEstimate ? 'text-amber-400/60' : getGrowthColor(growthRates[idx])}`}>
                  {growthRates[idx]! > 0 ? '+' : ''}{growthRates[idx]!.toFixed(0)}%
                </span>
              )}
            </div>
          </td>
        );
      })}
      <td className="py-2 pl-2">
        <Sparkline data={actualValues} labels={actualLabels} positive={true} formatFn={formatEPS} />
      </td>
    </tr>
  );
}

// ROIC row component
function ROICRow({ 
  label, 
  values, 
  labels,
  tooltip
}: { 
  label: string; 
  values: (number | null)[];
  labels: string[];
  tooltip: string;
}) {
  const growthRates = values.map((val, idx) => 
    idx > 0 && val !== null && values[idx - 1] !== null 
      ? val - (values[idx - 1] as number) 
      : null
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
              value !== null && value > 15 ? 'text-emerald-400' : 
              value !== null && value > 10 ? 'text-foreground' : 
              value !== null && value > 0 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {value !== null ? `${value.toFixed(1)}%` : '—'}
            </span>
            {idx > 0 && growthRates[idx] !== null && !isNaN(growthRates[idx]!) && isFinite(growthRates[idx]!) && (
              <span className={`text-[10px] ${
                growthRates[idx]! > 1 ? 'text-emerald-400' : 
                growthRates[idx]! > 0 ? 'text-emerald-400/70' : 
                growthRates[idx]! < -1 ? 'text-red-400' : 'text-red-400/70'
              }`}>
                {growthRates[idx]! > 0 ? '+' : ''}{growthRates[idx]!.toFixed(1)}pp
              </span>
            )}
          </div>
        </td>
      ))}
      <td className="py-2 pl-2">
        <Sparkline data={values} labels={labels} positive={true} formatFn={(v) => v !== null ? `${v.toFixed(1)}%` : '—'} />
      </td>
    </tr>
  );
}

// Net Debt / EBITDA row component (leverage metric)
function LeverageRow({ 
  label, 
  values, 
  labels,
  tooltip
}: { 
  label: string; 
  values: (number | null)[];
  labels: string[];
  tooltip: string;
}) {
  const changes = values.map((val, idx) => 
    idx > 0 && val !== null && values[idx - 1] !== null 
      ? val - (values[idx - 1] as number) 
      : null
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
              value === null ? 'text-muted-foreground' :
              value < 0 ? 'text-emerald-400' : // Net cash position
              value < 1 ? 'text-emerald-400' : 
              value < 2 ? 'text-foreground' : 
              value < 3 ? 'text-amber-400' : 
              'text-red-400' // High leverage warning
            }`}>
              {value !== null ? (value < 0 ? 'Net Cash' : `${value.toFixed(1)}x`) : '—'}
            </span>
            {idx > 0 && changes[idx] !== null && !isNaN(changes[idx]!) && isFinite(changes[idx]!) && (
              <span className={`text-[10px] ${
                changes[idx]! < -0.5 ? 'text-emerald-400' : // Deleveraging is good
                changes[idx]! < 0 ? 'text-emerald-400/70' : 
                changes[idx]! > 0.5 ? 'text-red-400' : // Increasing leverage is concerning
                'text-red-400/70'
              }`}>
                {changes[idx]! > 0 ? '+' : ''}{changes[idx]!.toFixed(1)}x
              </span>
            )}
          </div>
        </td>
      ))}
      <td className="py-2 pl-2">
        <Sparkline data={values} labels={labels} positive={false} formatFn={(v) => v !== null ? (v < 0 ? 'Net Cash' : `${v.toFixed(1)}x`) : '—'} />
      </td>
    </tr>
  );
}

// Calculate Net Debt / EBITDA
const calculateNetDebtToEBITDA = (data: FinancialData): number | null => {
  if (!data.ebitda || data.ebitda <= 0) return null;
  
  const netDebt = (data.long_term_debt || 0) - (data.cash_and_equivalents || 0);
  
  // If net debt is negative (more cash than debt), return negative to indicate net cash position
  return netDebt / data.ebitda;
};

export function HistoricalFinancials({ assetId, assetType, embedded = false }: HistoricalFinancialsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<'annual' | 'quarterly'>('annual');
  const [showForward, setShowForward] = useState(true);
  
  if (assetType !== 'equity') {
    return null;
  }

  const { data, isLoading, error } = useSWR<{ 
    annual: FinancialData[], 
    quarterly: FinancialData[],
    forward_estimates: ForwardEstimates | null,
    metadata: any
  }>(
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
  const isAnnual = viewMode === 'annual';
  const baseData = isAnnual 
    ? data.annual.slice(0, 5).reverse() 
    : (data.quarterly || []).slice(0, 8).reverse();
  
  // Add forward estimates for annual view if available and enabled
  const hasForward = isAnnual && showForward && data.forward_estimates;
  const displayData = hasForward 
    ? [...baseData, data.forward_estimates as any]
    : baseData;
  
  const labels = displayData.map((d, idx) => {
    if (d.is_estimate) {
      return `FY${d.fiscal_date_ending.substring(2, 4)} Est`;
    }
    return isAnnual
      ? `FY${getFiscalYear(d.fiscal_date_ending).slice(2)}`
      : getQuarterLabel(d.fiscal_date_ending);
  });

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

  // Calculate ROIC for each period (only for annual data with balance sheet info)
  const roicValues = isAnnual 
    ? baseData.map(d => calculateROIC(d))
    : [];

  // Calculate Net Debt / EBITDA for each period (leverage metric)
  const netDebtToEBITDAValues = isAnnual 
    ? baseData.map(d => calculateNetDebtToEBITDA(d))
    : [];

  // Latest margins for header display
  const latestActual = baseData[baseData.length - 1];
  const latestGrossMargin = latestActual.total_revenue && latestActual.gross_profit 
    ? (latestActual.gross_profit / latestActual.total_revenue) * 100 : null;
  const latestOperatingMargin = latestActual.total_revenue && latestActual.operating_income 
    ? (latestActual.operating_income / latestActual.total_revenue) * 100 : null;
  const latestNetMargin = latestActual.total_revenue && latestActual.net_income 
    ? (latestActual.net_income / latestActual.total_revenue) * 100 : null;
  const latestROIC = isAnnual ? calculateROIC(latestActual) : null;

  const renderTable = () => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground w-32">Metric</th>
          {labels.map((label, idx) => {
            const isEstimate = hasForward && idx === labels.length - 1;
            return (
              <th 
                key={idx} 
                className={`text-right py-2 px-2 text-xs font-medium w-20 ${
                  isEstimate 
                    ? 'text-amber-400 bg-amber-500/5' 
                    : 'text-muted-foreground'
                }`}
                style={isEstimate ? { 
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(251, 191, 36, 0.03) 5px, rgba(251, 191, 36, 0.03) 10px)'
                } : {}}
              >
                {label}
                {isEstimate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-1 cursor-help">
                        <TrendingUp className="w-3 h-3 inline text-amber-400/60" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs font-normal">
                        <strong>Consensus Estimate</strong><br/>
                        Based on {data.forward_estimates?.growth_assumptions.earnings_growth 
                          ? `${(data.forward_estimates.growth_assumptions.earnings_growth * 100).toFixed(0)}%` 
                          : 'analyst'} earnings growth.
                        {data.forward_estimates?.growth_assumptions.forward_pe && (
                          <><br/>Forward P/E: {data.forward_estimates.growth_assumptions.forward_pe.toFixed(1)}x</>
                        )}
                        {data.forward_estimates?.growth_assumptions.analyst_target && (
                          <><br/>Analyst Target: ${data.forward_estimates.growth_assumptions.analyst_target.toFixed(0)}</>
                        )}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </th>
            );
          })}
          <th className="text-left py-2 pl-2 text-xs font-medium text-muted-foreground w-20">Trend</th>
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
          labels={labels}
          tooltip="Total revenue from all sources (top line)"
          isEstimateColumn={hasForward}
        />
        <FinancialRow 
          label="Gross Profit" 
          values={grossProfit} 
          labels={labels}
          tooltip="Revenue minus cost of goods sold"
          isEstimateColumn={hasForward}
        />
        <MarginRow 
          label="↳ Gross Margin %" 
          values={grossMargins} 
          labels={labels}
          tooltip="Gross Profit / Revenue. Shows pricing power and cost efficiency. Expanding margins = good, compressing = concerning."
          isEstimateColumn={hasForward}
        />
        <FinancialRow 
          label="Operating Income" 
          values={operatingIncome} 
          labels={labels}
          tooltip="Profit from core operations before interest and taxes (EBIT)"
          isEstimateColumn={hasForward}
        />
        <MarginRow 
          label="↳ Operating Margin %" 
          values={operatingMargins} 
          labels={labels}
          tooltip="Operating Income / Revenue. Shows operational efficiency after all operating expenses."
          isEstimateColumn={hasForward}
        />
        <FinancialRow 
          label="Net Income" 
          values={netIncome} 
          labels={labels}
          tooltip="Bottom line profit after all expenses, interest, and taxes"
          isEstimateColumn={hasForward}
        />
        <MarginRow 
          label="↳ Net Margin %" 
          values={netMargins} 
          labels={labels}
          tooltip="Net Income / Revenue. Final profitability after all costs including taxes and interest."
          isEstimateColumn={hasForward}
        />
        <EPSRow 
          label="Diluted EPS" 
          values={eps} 
          labels={labels}
          tooltip="Earnings Per Share (diluted). Net income divided by all potential shares. Key metric for stock valuation - watch for dilution from stock-based compensation."
          isEstimateColumn={hasForward}
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
          labels={labels}
          tooltip="Cash Flow from Operations - cash generated from core business activities. Should be positive and growing."
          isEstimateColumn={hasForward}
        />
        <FinancialRow 
          label="CFI" 
          values={cfi} 
          labels={labels}
          tooltip="Cash Flow from Investing - cash used for investments, acquisitions, and capex. Typically negative for growth companies (spending on future growth)."
          isNeutralColor={true}
          sparklinePositive={false}
          isEstimateColumn={hasForward}
        />
        <FinancialRow 
          label="CFF" 
          values={cff} 
          labels={labels}
          tooltip="Cash Flow from Financing - cash from/used for debt, equity, and dividends. Context matters: buybacks (negative) can be good, dilution (positive) can be bad."
          isNeutralColor={true}
          isEstimateColumn={hasForward}
        />
        <FinancialRow 
          label="Free Cash Flow" 
          values={fcf} 
          labels={labels}
          tooltip="Cash available after capital expenditures (CFO - CapEx). The real cash a company generates for shareholders."
          isEstimateColumn={hasForward}
        />

        {/* Efficiency Section - Only for Annual view */}
        {isAnnual && roicValues.length > 0 && roicValues.some(v => v !== null) && (
          <>
            <tr>
              <td colSpan={labels.length + 2} className="pt-4 pb-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Capital Efficiency</span>
                </div>
              </td>
            </tr>
            <ROICRow 
              label="ROIC" 
              values={hasForward ? [...roicValues, null] : roicValues}
              labels={hasForward ? labels.slice(0, -1) : labels}
              tooltip="Return on Invested Capital. NOPAT / (Equity + Debt - Cash). The gold standard for capital efficiency. >15% is excellent, >10% is good."
            />
            {netDebtToEBITDAValues.some(v => v !== null) && (
              <LeverageRow 
                label="Net Debt/EBITDA" 
                values={hasForward ? [...netDebtToEBITDAValues, null] : netDebtToEBITDAValues}
                labels={hasForward ? labels.slice(0, -1) : labels}
                tooltip="Net Debt / EBITDA. Measures leverage and ability to pay off debt. <1x is excellent, 1-2x is healthy, 2-3x is moderate, >3x is high leverage (risk). Negative means net cash position (more cash than debt)."
              />
            )}
          </>
        )}
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
            {/* Forward Estimates Toggle (only for annual) */}
            {isAnnual && data.forward_estimates && (
              <button
                onClick={() => setShowForward(!showForward)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ml-1 ${
                  showForward
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                }`}
              >
                + Est
              </button>
            )}
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
            {latestROIC && (
              <span className="text-[10px] text-muted-foreground">
                ROIC: <span className={`font-mono ${latestROIC > 15 ? 'text-emerald-400' : latestROIC > 10 ? 'text-foreground' : 'text-amber-400'}`}>{latestROIC.toFixed(1)}%</span>
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
          {/* Forward Estimates Toggle */}
          {isAnnual && data.forward_estimates && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowForward(!showForward); }}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ml-1 ${
                showForward
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              + Est
            </button>
          )}
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
          {latestROIC && (
            <span className="text-[10px] text-muted-foreground">
              ROIC: <span className={`font-mono ${latestROIC > 15 ? 'text-emerald-400' : latestROIC > 10 ? 'text-foreground' : 'text-amber-400'}`}>{latestROIC.toFixed(1)}%</span>
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

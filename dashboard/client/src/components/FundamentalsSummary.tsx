import { DollarSign, BarChart3, Percent, Activity, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FundamentalsSummaryProps {
  asset: {
    asset_type: string;
    close: number;
    market_cap: number | null;
    // Earnings-based metrics
    pe_ratio: number | null;
    forward_pe: number | null;
    peg_ratio: number | null;
    eps: number | null;
    earnings_growth_yoy: number | null;
    // Sales-based metrics
    price_to_sales_ttm: number | null;
    forward_ps: number | null;
    psg: number | null;
    revenue_ttm: number | null;
    revenue_growth_yoy: number | null;
    // Profitability
    profit_margin: number | null;
    operating_margin: number | null;
    roe: number | null;
    roa: number | null;
    // Other
    beta: number | null;
    week_52_high: number | null;
    week_52_low: number | null;
    dividend_yield: number | null;
    ev_to_ebitda: number | null;
    ev_to_revenue: number | null;
    price_to_book: number | null;
    analyst_target_price: number | null;
  };
}

// Helper to format numbers
const formatNumber = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return value.toFixed(decimals);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
};

const formatLargeNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
};

// Metric row component with leader dots and tooltip
function MetricRow({ 
  label, 
  value, 
  tooltip, 
  isApproximation = false,
  valueColor = "text-foreground",
  highlight = false
}: { 
  label: string; 
  value: string; 
  tooltip: string;
  isApproximation?: boolean;
  valueColor?: string;
  highlight?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center py-2 cursor-help hover:bg-muted/20 transition-colors rounded px-1 -mx-1 ${highlight ? 'bg-primary/5 border-l-2 border-primary/30 pl-2' : ''}`}>
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            {label}
            {isApproximation && (
              <Info className="w-3 h-3 text-muted-foreground/50" />
            )}
          </span>
          {/* Leader dots */}
          <span className="flex-1 mx-2 border-b border-dotted border-border/30"></span>
          <span className={`font-mono text-xs font-medium shrink-0 ${valueColor}`}>{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// 52-Week Range visual gauge component
function RangeGauge({ 
  low, 
  high, 
  current 
}: { 
  low: number | null; 
  high: number | null; 
  current: number | null;
}) {
  if (low === null || high === null || current === null || high === low) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  
  const position = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-help">
          {/* Low label */}
          <span className="text-[10px] text-muted-foreground/70 font-mono w-12 text-right">
            ${low >= 1000 ? (low / 1000).toFixed(0) + 'K' : low.toFixed(0)}
          </span>
          {/* Gauge bar */}
          <div className="relative flex-1 h-1.5 bg-muted/30 rounded-full min-w-[60px]">
            {/* Track */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/20 via-yellow-500/20 to-emerald-500/20"></div>
            {/* Current position dot */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background shadow-sm"
              style={{ left: `calc(${position}% - 5px)` }}
            ></div>
          </div>
          {/* High label */}
          <span className="text-[10px] text-muted-foreground/70 font-mono w-12">
            ${high >= 1000 ? (high / 1000).toFixed(0) + 'K' : high.toFixed(0)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <div>52-Week Low: <span className="font-mono">${formatNumber(low)}</span></div>
          <div>Current: <span className="font-mono">${formatNumber(current)}</span></div>
          <div>52-Week High: <span className="font-mono">${formatNumber(high)}</span></div>
          <div className="text-muted-foreground pt-1">Position: {position.toFixed(0)}% from low</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Section header component
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3 pb-1.5 border-b border-border/50">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">
        {title}
      </span>
    </div>
  );
}

export function FundamentalsSummary({ asset }: FundamentalsSummaryProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Only show for equities
  if (asset.asset_type !== 'equity') {
    return null;
  }

  // Determine if we should emphasize P/S or P/E metrics
  const profitMargin = asset.profit_margin;
  const isProfitable = profitMargin !== null && profitMargin > 0.05;
  const hasReasonablePE = asset.pe_ratio !== null && asset.pe_ratio > 0 && asset.pe_ratio < 100;
  const useSalesMetrics = !isProfitable || !hasReasonablePE;

  // Color logic for growth rates (semantic coloring)
  const getGrowthColor = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "text-foreground";
    if (value > 0.2) return "text-emerald-400";
    if (value > 0) return "text-emerald-400/70";
    if (value < -0.1) return "text-red-400";
    return "text-foreground";
  };

  // Color logic for margins (semantic coloring)
  const getMarginColor = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "text-foreground";
    if (value > 0.2) return "text-emerald-400";
    if (value > 0) return "text-foreground";
    if (value < 0) return "text-red-400";
    return "text-foreground";
  };

  // Color logic for PEG (contextual - green if undervalued)
  const getPEGColor = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "text-foreground";
    if (value > 0 && value < 1) return "text-emerald-400";
    if (value > 2) return "text-yellow-400";
    return "text-foreground";
  };

  // Color logic for PSG (contextual - green if undervalued)
  const getPSGColor = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "text-foreground";
    if (value > 0 && value < 0.5) return "text-emerald-400";
    if (value > 1) return "text-yellow-400";
    return "text-foreground";
  };

  // Calculate analyst upside
  const analystUpside = asset.analyst_target_price && asset.close
    ? ((asset.analyst_target_price - asset.close) / asset.close * 100)
    : null;

  const getAnalystColor = (upside: number | null): string => {
    if (upside === null) return "text-foreground";
    if (upside > 15) return "text-emerald-400";
    if (upside < -10) return "text-red-400";
    return "text-foreground";
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Fundamentals</h3>
          {/* Badge indicating which metrics are emphasized */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            useSalesMetrics 
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {useSalesMetrics ? 'Sales-Based' : 'Earnings-Based'}
          </span>
        </div>
        {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>
      
      {!isCollapsed && (
        <div className="p-4">
          {/* Two-column layout */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column: Size & Growth + Profitability */}
            <div className="space-y-4">
              {/* Size & Growth Section */}
              <div>
                <SectionHeader icon={DollarSign} title="Size & Growth" />
                <div className="space-y-0.5">
                  <MetricRow 
                    label="Market Cap" 
                    value={formatLargeNumber(asset.market_cap)}
                    tooltip="Total market value of the company's outstanding shares"
                  />
                  <MetricRow 
                    label="Revenue (TTM)" 
                    value={formatLargeNumber(asset.revenue_ttm)}
                    tooltip="Total revenue over the trailing twelve months"
                  />
                  <MetricRow 
                    label="Rev Growth" 
                    value={formatPercent(asset.revenue_growth_yoy)}
                    tooltip="Year-over-year quarterly revenue growth rate"
                    valueColor={getGrowthColor(asset.revenue_growth_yoy)}
                  />
                  <MetricRow 
                    label="EPS Growth" 
                    value={formatPercent(asset.earnings_growth_yoy)}
                    tooltip="Year-over-year quarterly earnings growth rate"
                    valueColor={getGrowthColor(asset.earnings_growth_yoy)}
                  />
                </div>
              </div>

              {/* Profitability Section */}
              <div>
                <SectionHeader icon={Percent} title="Profitability" />
                <div className="space-y-0.5">
                  <MetricRow 
                    label="Profit Margin" 
                    value={formatPercent(asset.profit_margin)}
                    tooltip="Net income as a percentage of revenue. Negative margins indicate the company is not profitable."
                    valueColor={getMarginColor(asset.profit_margin)}
                  />
                  <MetricRow 
                    label="Op Margin" 
                    value={formatPercent(asset.operating_margin)}
                    tooltip="Operating income as a percentage of revenue"
                    valueColor={getMarginColor(asset.operating_margin)}
                  />
                  <MetricRow 
                    label="ROE" 
                    value={formatPercent(asset.roe)}
                    tooltip="Return on Equity - Net income divided by shareholders' equity. Measures profitability relative to equity."
                    valueColor={getMarginColor(asset.roe)}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Valuation + Other */}
            <div className="space-y-4">
              {/* Valuation Section */}
              <div>
                <SectionHeader icon={Activity} title="Valuation" />
                <div className="space-y-0.5">
                  {/* Earnings-based metrics */}
                  <MetricRow 
                    label="P/E (TTM)" 
                    value={formatNumber(asset.pe_ratio)}
                    tooltip="Price-to-Earnings ratio. Lower generally means cheaper, but can be misleading for unprofitable companies."
                    highlight={!useSalesMetrics}
                  />
                  <MetricRow 
                    label="Forward P/E" 
                    value={formatNumber(asset.forward_pe)}
                    tooltip="Price divided by estimated future earnings. Based on analyst estimates."
                    highlight={!useSalesMetrics}
                  />
                  <MetricRow 
                    label="PEG" 
                    value={formatNumber(asset.peg_ratio)}
                    tooltip="P/E divided by earnings growth rate. PEG < 1 may indicate undervaluation relative to growth. PEG > 2 may indicate overvaluation."
                    valueColor={getPEGColor(asset.peg_ratio)}
                    highlight={!useSalesMetrics}
                  />

                  {/* Visual separator */}
                  <div className="h-2"></div>
                  
                  {/* Sales-based metrics */}
                  <MetricRow 
                    label="P/S (TTM)" 
                    value={formatNumber(asset.price_to_sales_ttm)}
                    tooltip="Price-to-Sales ratio. Useful for unprofitable high-growth companies."
                    highlight={useSalesMetrics}
                  />
                  <MetricRow 
                    label="Fwd P/S" 
                    value={formatNumber(asset.forward_ps)}
                    tooltip="Forward P/S (approximation): Market Cap / Est. NTM Revenue. Uses log-dampened historical growth to estimate next year's revenue. Analyst estimates may differ."
                    isApproximation={true}
                    highlight={useSalesMetrics}
                  />
                  <MetricRow 
                    label="PSG" 
                    value={formatNumber(asset.psg)}
                    tooltip="Price-to-Sales-Growth (approximation): Forward P/S / Dampened Growth %. Lower = cheaper relative to growth. PSG < 0.5 may indicate undervaluation. Uses log dampening for extreme growth rates."
                    isApproximation={true}
                    valueColor={getPSGColor(asset.psg)}
                    highlight={useSalesMetrics}
                  />
                </div>
              </div>

              {/* Other Section */}
              <div>
                <SectionHeader icon={BarChart3} title="Other" />
                <div className="space-y-0.5">
                  <MetricRow 
                    label="Beta" 
                    value={formatNumber(asset.beta)}
                    tooltip="Measure of volatility relative to the market. Beta > 1 means more volatile than the market."
                  />
                  
                  {analystUpside !== null && (
                    <MetricRow 
                      label="Analyst Target" 
                      value={`${analystUpside > 0 ? '+' : ''}${analystUpside.toFixed(0)}%`}
                      tooltip={`Analyst consensus price target: $${formatNumber(asset.analyst_target_price)}. Shows potential upside/downside from current price.`}
                      valueColor={getAnalystColor(analystUpside)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* 52-Week Range - Full width at bottom */}
          <div className="mt-4 pt-3 border-t border-border/50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">52W Range</span>
              <div className="flex-1">
                <RangeGauge 
                  low={asset.week_52_low} 
                  high={asset.week_52_high} 
                  current={asset.close} 
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

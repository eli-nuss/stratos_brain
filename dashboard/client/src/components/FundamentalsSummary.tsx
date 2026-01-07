import { TrendingUp, TrendingDown, DollarSign, BarChart3, Percent, Activity, ChevronDown, ChevronUp } from "lucide-react";
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

// Metric row component with tooltip
function MetricRow({ 
  label, 
  value, 
  tooltip, 
  highlight = false,
  valueColor = "text-foreground"
}: { 
  label: string; 
  value: string; 
  tooltip: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex justify-between items-center py-1.5 px-2 rounded cursor-help hover:bg-muted/30 transition-colors ${highlight ? 'bg-primary/5' : ''}`}>
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={`font-mono text-xs font-medium ${valueColor}`}>{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function FundamentalsSummary({ asset }: FundamentalsSummaryProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Only show for equities
  if (asset.asset_type !== 'equity') {
    return null;
  }

  // Determine if we should emphasize P/S or P/E metrics
  // Use P/S if: no P/E, negative P/E, very high P/E (>100), or low profit margin (<5%)
  const profitMargin = asset.profit_margin;
  const isProfitable = profitMargin !== null && profitMargin > 0.05;
  const hasReasonablePE = asset.pe_ratio !== null && asset.pe_ratio > 0 && asset.pe_ratio < 100;
  const useSalesMetrics = !isProfitable || !hasReasonablePE;

  // Calculate 52-week position
  const week52Position = asset.week_52_high && asset.week_52_low && asset.close
    ? ((asset.close - asset.week_52_low) / (asset.week_52_high - asset.week_52_low) * 100)
    : null;

  // Calculate upside to analyst target
  const analystUpside = asset.analyst_target_price && asset.close
    ? ((asset.analyst_target_price - asset.close) / asset.close * 100)
    : null;

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
        <div className="p-3">
          {/* Two-column layout */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column: Size & Growth */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Size & Growth
              </div>
              
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
                highlight={useSalesMetrics}
                valueColor={asset.revenue_growth_yoy && asset.revenue_growth_yoy > 0.2 ? 'text-emerald-400' : 'text-foreground'}
              />
              
              <MetricRow 
                label="EPS Growth" 
                value={formatPercent(asset.earnings_growth_yoy)}
                tooltip="Year-over-year quarterly earnings growth rate"
                highlight={!useSalesMetrics}
                valueColor={asset.earnings_growth_yoy && asset.earnings_growth_yoy > 0.2 ? 'text-emerald-400' : 'text-foreground'}
              />

              {/* Profitability section */}
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-2 flex items-center gap-1">
                <Percent className="w-3 h-3" />
                Profitability
              </div>
              
              <MetricRow 
                label="Profit Margin" 
                value={formatPercent(asset.profit_margin)}
                tooltip="Net income as a percentage of revenue. Negative margins indicate the company is not profitable."
                valueColor={profitMargin && profitMargin > 0 ? 'text-emerald-400' : profitMargin && profitMargin < 0 ? 'text-red-400' : 'text-foreground'}
              />
              
              <MetricRow 
                label="Op Margin" 
                value={formatPercent(asset.operating_margin)}
                tooltip="Operating income as a percentage of revenue"
              />
              
              <MetricRow 
                label="ROE" 
                value={formatPercent(asset.roe)}
                tooltip="Return on Equity - Net income divided by shareholders' equity. Measures profitability relative to equity."
                valueColor={asset.roe && asset.roe > 0.15 ? 'text-emerald-400' : 'text-foreground'}
              />
            </div>

            {/* Right Column: Valuation */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Valuation
              </div>
              
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
                tooltip="P/E divided by earnings growth rate. PEG < 1 may indicate undervaluation relative to growth."
                highlight={!useSalesMetrics}
                valueColor={asset.peg_ratio && asset.peg_ratio < 1 && asset.peg_ratio > 0 ? 'text-emerald-400' : 'text-foreground'}
              />

              {/* Divider */}
              <div className="border-t border-border/50 my-2"></div>
              
              {/* Sales-based metrics */}
              <MetricRow 
                label="P/S (TTM)" 
                value={formatNumber(asset.price_to_sales_ttm)}
                tooltip="Price-to-Sales ratio. Useful for unprofitable high-growth companies."
                highlight={useSalesMetrics}
              />
              
              <MetricRow 
                label="Fwd P/S*" 
                value={formatNumber(asset.forward_ps)}
                tooltip="Forward P/S (approx): Market Cap / Est. NTM Revenue. Uses log-dampened historical growth to estimate next year's revenue."
                highlight={useSalesMetrics}
              />
              
              <MetricRow 
                label="PSG*" 
                value={formatNumber(asset.psg)}
                tooltip="Price-to-Sales-Growth (approx): Forward P/S / Dampened Growth %. Lower = cheaper relative to growth. Uses log dampening for extreme growth rates."
                highlight={useSalesMetrics}
                valueColor={asset.psg && asset.psg < 0.5 && asset.psg > 0 ? 'text-emerald-400' : 'text-foreground'}
              />

              {/* Other metrics */}
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Other
              </div>
              
              <MetricRow 
                label="Beta" 
                value={formatNumber(asset.beta)}
                tooltip="Measure of volatility relative to the market. Beta > 1 means more volatile than the market."
              />
              
              <MetricRow 
                label="52W Range" 
                value={week52Position !== null ? `${week52Position.toFixed(0)}%` : '—'}
                tooltip={`Current price position within 52-week range. Low: $${formatNumber(asset.week_52_low)}, High: $${formatNumber(asset.week_52_high)}`}
                valueColor={week52Position && week52Position > 80 ? 'text-yellow-400' : week52Position && week52Position < 20 ? 'text-blue-400' : 'text-foreground'}
              />
              
              {analystUpside !== null && (
                <MetricRow 
                  label="Analyst Target" 
                  value={`${analystUpside > 0 ? '+' : ''}${analystUpside.toFixed(0)}%`}
                  tooltip={`Analyst consensus price target: $${formatNumber(asset.analyst_target_price)}. Shows potential upside/downside from current price.`}
                  valueColor={analystUpside > 10 ? 'text-emerald-400' : analystUpside < -10 ? 'text-red-400' : 'text-foreground'}
                />
              )}
            </div>
          </div>
          
          {/* Footer note about approximations */}
          <div className="mt-3 pt-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground/70">
              * Approximations using log-dampened historical growth rates. Actual analyst estimates may differ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

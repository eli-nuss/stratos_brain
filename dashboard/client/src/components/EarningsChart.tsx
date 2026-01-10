import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  Label,
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface EarningsChartProps {
  symbol: string;
  assetId: number;
}

interface EarningsData {
  fiscalDateEnding: string;
  reportedDate: string;
  reportedEPS: number | null;
  estimatedEPS: number | null;
  surprise: number | null;
  surprisePercentage: number | null;
}

interface PriceData {
  date: string;
  close: number;
  high: number;
  low: number;
}

interface EarningsWithReaction extends EarningsData {
  priceReaction: number | null; // % change from day before to day after earnings
  priceOnReport: number | null;
}

// Custom tooltip for chart hover
const ChartTooltip = ({ active, payload, label, earningsWithReaction }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  const earning = earningsWithReaction?.find((e: EarningsWithReaction) => e.reportedDate === label);
  const priceData = payload[0]?.payload;
  
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-medium text-foreground">
        ${priceData?.close?.toFixed(2)}
      </p>
      {earning && (
        <div className="mt-2 pt-2 border-t border-border space-y-1">
          <p className="font-medium text-amber-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Earnings Report
          </p>
          <p className="text-muted-foreground">
            Est: <span className="text-foreground">${earning.estimatedEPS?.toFixed(2)}</span>
            {' → '}
            Act: <span className="text-foreground font-medium">${earning.reportedEPS?.toFixed(2)}</span>
          </p>
          {earning.surprisePercentage !== null && (
            <p className={earning.surprisePercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {earning.surprisePercentage >= 0 ? 'Beat' : 'Miss'}: {earning.surprisePercentage >= 0 ? '+' : ''}{earning.surprisePercentage.toFixed(1)}%
            </p>
          )}
          {earning.priceReaction !== null && (
            <p className={`font-medium ${earning.priceReaction >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Price Reaction: {earning.priceReaction >= 0 ? '+' : ''}{earning.priceReaction.toFixed(1)}%
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Custom label component for reaction tags on reference lines
const ReactionLabel = ({ viewBox, reaction }: { viewBox?: any; reaction: number | null }) => {
  if (reaction === null || !viewBox) return null;
  const isPositive = reaction >= 0;
  
  return (
    <g>
      <rect
        x={viewBox.x - 18}
        y={8}
        width={36}
        height={16}
        rx={3}
        fill={isPositive ? '#059669' : '#dc2626'}
        opacity={0.9}
      />
      <text
        x={viewBox.x}
        y={19}
        textAnchor="middle"
        fill="white"
        fontSize={9}
        fontWeight={600}
      >
        {isPositive ? '+' : ''}{reaction.toFixed(0)}%
      </text>
    </g>
  );
};

export function EarningsChart({ symbol, assetId }: EarningsChartProps) {
  const [useLogScale, setUseLogScale] = useState(false);
  
  // Fetch earnings calendar
  const { data: earningsData, error: earningsError } = useSWR<{ symbol: string; earnings: EarningsData[] }>(
    `/api/dashboard/earnings-calendar?symbol=${symbol}`,
    fetcher
  );

  // Fetch price history (last 5 years of daily data)
  const { data: priceData, error: priceError } = useSWR<{ prices: PriceData[] }>(
    `/api/dashboard/price-history?asset_id=${assetId}&days=1825`,
    fetcher
  );

  // Format price data for the chart (oldest to newest)
  const chartData = useMemo(() => {
    if (!priceData?.prices) return [];
    return priceData.prices
      .map((p) => ({
        date: p.date,
        close: p.close,
        high: p.high,
        low: p.low,
      }))
      .reverse();
  }, [priceData]);

  // Create price lookup map for calculating reactions
  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    chartData.forEach((p) => {
      map[p.date] = p.close;
    });
    return map;
  }, [chartData]);

  // Calculate price reaction for each earnings date
  const earningsWithReaction = useMemo((): EarningsWithReaction[] => {
    if (!earningsData?.earnings || !chartData.length) return [];
    
    return earningsData.earnings.map((e) => {
      let priceReaction: number | null = null;
      let priceOnReport: number | null = null;
      
      if (e.reportedDate && Object.keys(priceMap).length > 0) {
        // Find the closest trading day before and after the report
        const sortedDates = Object.keys(priceMap).sort();
        const reportIdx = sortedDates.findIndex(d => d >= e.reportedDate);
        
        if (reportIdx > 0 && reportIdx < sortedDates.length) {
          const dayBefore = sortedDates[reportIdx - 1];
          const dayAfter = sortedDates[Math.min(reportIdx + 1, sortedDates.length - 1)];
          const priceBefore = priceMap[dayBefore];
          const priceAfter = priceMap[dayAfter];
          priceOnReport = priceMap[sortedDates[reportIdx]] || priceAfter;
          
          if (priceBefore && priceAfter) {
            priceReaction = ((priceAfter - priceBefore) / priceBefore) * 100;
          }
        }
      }
      
      return {
        ...e,
        priceReaction,
        priceOnReport,
      };
    });
  }, [earningsData, priceMap, chartData]);

  // Get earnings dates for reference lines (limited to last 12 quarters for cleaner display)
  const earningsDates = useMemo(() => {
    return earningsWithReaction
      .filter((e) => e.reportedDate)
      .slice(0, 12);
  }, [earningsWithReaction]);

  const isLoading = !earningsData && !earningsError;
  const hasError = earningsError || priceError;

  if (isLoading) {
    return (
      <div className="h-44 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading earnings chart...</div>
      </div>
    );
  }

  if (hasError || !chartData.length) {
    return (
      <div className="h-44 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">
          {hasError ? "Failed to load chart data" : "No price data available"}
        </div>
      </div>
    );
  }

  // Calculate price range for Y axis
  const prices = chartData.map((d) => d.close).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  
  // For log scale, we need positive values
  const logMinPrice = Math.max(minPrice * 0.9, 1);
  const logMaxPrice = maxPrice * 1.1;

  return (
    <div className="w-full">
      {/* Compact header with controls */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Price & Earnings
        </h3>
        <div className="flex items-center gap-3 text-xs">
          {/* Log scale toggle */}
          <button
            onClick={() => setUseLogScale(!useLogScale)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              useLogScale 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-muted/30 text-muted-foreground hover:text-foreground'
            }`}
          >
            Log
          </button>
          {/* Legend */}
          <span className="flex items-center gap-1 text-muted-foreground">
            <div className="w-2.5 h-0.5 bg-blue-500"></div>
            Price
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <div className="w-0.5 h-2.5 bg-amber-400"></div>
            Earnings
          </span>
        </div>
      </div>
      
      {/* Compact chart - reduced height */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            
            <XAxis
              dataKey="date"
              tick={{ fill: "#666", fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: "#333" }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
              }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            
            <YAxis
              scale={useLogScale ? "log" : "linear"}
              domain={useLogScale ? [logMinPrice, logMaxPrice] : [minPrice * 0.95, maxPrice * 1.05]}
              tick={{ fill: "#666", fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: "#333" }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              width={45}
            />
            
            <Tooltip
              content={(props) => <ChartTooltip {...props} earningsWithReaction={earningsWithReaction} />}
            />
            
            {/* Earnings date reference lines with reaction tags */}
            {earningsDates.map((earning) => (
              <ReferenceLine
                key={earning.reportedDate}
                x={earning.reportedDate}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeWidth={1}
                opacity={0.6}
              >
                <Label
                  content={<ReactionLabel reaction={earning.priceReaction} />}
                  position="top"
                />
              </ReferenceLine>
            ))}
            
            {/* Price area */}
            <Area
              type="monotone"
              dataKey="close"
              stroke="none"
              fill="url(#priceGradient)"
            />
            
            {/* Price line */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#3b82f6" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Compact earnings cards - inline with explicit labels */}
      {earningsWithReaction.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {earningsWithReaction.slice(0, 6).reverse().map((e, i) => (
              <div 
                key={i} 
                className="flex-shrink-0 bg-muted/20 rounded px-2 py-1.5 cursor-help relative group min-w-[100px]"
              >
                {/* Hover tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-2 bg-card border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 w-44 pointer-events-none">
                  <div className="text-xs space-y-1">
                    <div className="font-medium text-foreground">
                      {new Date(e.fiscalDateEnding).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} Earnings
                    </div>
                    {e.reportedDate && (
                      <div className="text-muted-foreground">
                        Reported: {new Date(e.reportedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                    <div className="pt-1 border-t border-border">
                      <span className="text-muted-foreground">Est:</span>
                      <span className="text-foreground ml-1">${e.estimatedEPS?.toFixed(2) || '—'}</span>
                      <span className="text-muted-foreground ml-2">Act:</span>
                      <span className="text-foreground ml-1 font-medium">${e.reportedEPS?.toFixed(2) || '—'}</span>
                    </div>
                    {e.surprisePercentage !== null && (
                      <div className={e.surprisePercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {e.surprisePercentage >= 0 ? 'Beat' : 'Miss'}: {e.surprisePercentage >= 0 ? '+' : ''}{e.surprisePercentage.toFixed(1)}%
                      </div>
                    )}
                    {e.priceReaction !== null && (
                      <div className={`font-medium pt-1 border-t border-border ${e.priceReaction >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        Price Reaction: {e.priceReaction >= 0 ? '+' : ''}{e.priceReaction.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Card content - compact with explicit labels */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(e.fiscalDateEnding).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">${e.reportedEPS?.toFixed(2) || '—'}</span>
                      {e.estimatedEPS && (
                        <span className="text-[10px]"> vs {e.estimatedEPS.toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    {e.surprisePercentage !== null && (
                      <p className={`text-[10px] ${e.surprisePercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {e.surprisePercentage >= 0 ? 'Beat' : 'Miss'}
                      </p>
                    )}
                    {e.priceReaction !== null && (
                      <p className={`text-xs font-semibold ${e.priceReaction >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {e.priceReaction >= 0 ? '+' : ''}{e.priceReaction.toFixed(0)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

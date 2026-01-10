import { useMemo } from "react";
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
} from "recharts";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";

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

// Custom tooltip for earnings markers
const EarningsTooltip = ({ active, payload, label, earningsMap }: any) => {
  if (!active || !payload || !payload.length) return null;
  
  const earning = earningsMap?.[label];
  const priceData = payload[0]?.payload;
  
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground">
        ${priceData?.close?.toFixed(2)}
      </p>
      {earning && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs font-medium text-amber-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Earnings: {earning.reportedDate}
          </p>
          <div className="mt-1 space-y-0.5">
            <p className="text-xs text-muted-foreground">
              EPS: <span className="text-foreground">${earning.reportedEPS?.toFixed(2)}</span>
              {earning.estimatedEPS && (
                <span className="text-muted-foreground"> vs ${earning.estimatedEPS?.toFixed(2)} est</span>
              )}
            </p>
            {earning.surprisePercentage !== null && (
              <p className={`text-xs ${earning.surprisePercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {earning.surprisePercentage >= 0 ? '▲' : '▼'} {Math.abs(earning.surprisePercentage).toFixed(1)}% {earning.surprisePercentage >= 0 ? 'beat' : 'miss'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export function EarningsChart({ symbol, assetId }: EarningsChartProps) {
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

  // Create a map of earnings dates for quick lookup
  const earningsMap = useMemo(() => {
    if (!earningsData?.earnings) return {};
    const map: Record<string, EarningsData> = {};
    earningsData.earnings.forEach((e) => {
      if (e.reportedDate) {
        map[e.reportedDate] = e;
      }
    });
    return map;
  }, [earningsData]);

  // Get earnings dates for reference lines
  const earningsDates = useMemo(() => {
    if (!earningsData?.earnings) return [];
    return earningsData.earnings
      .filter((e) => e.reportedDate)
      .map((e) => e.reportedDate)
      .slice(0, 20); // Last 20 quarters (5 years)
  }, [earningsData]);

  // Format price data for the chart
  const chartData = useMemo(() => {
    if (!priceData?.prices) return [];
    return priceData.prices
      .map((p) => ({
        date: p.date,
        close: p.close,
        high: p.high,
        low: p.low,
      }))
      .reverse(); // Oldest to newest
  }, [priceData]);

  const isLoading = !earningsData && !earningsError;
  const hasError = earningsError || priceError;

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading earnings chart...</div>
      </div>
    );
  }

  if (hasError || !chartData.length) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">
          {hasError ? "Failed to load chart data" : "No price data available"}
        </div>
      </div>
    );
  }

  // Calculate price range for Y axis
  const prices = chartData.map((d) => d.close).filter(Boolean);
  const minPrice = Math.min(...prices) * 0.95;
  const maxPrice = Math.max(...prices) * 1.05;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          Price History with Earnings
        </h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500"></div>
            Price
          </span>
          <span className="flex items-center gap-1">
            <div className="w-0.5 h-3 bg-amber-400"></div>
            Earnings
          </span>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            
            <XAxis
              dataKey="date"
              tick={{ fill: "#888", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#333" }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
              }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fill: "#888", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#333" }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              width={50}
            />
            
            <Tooltip
              content={(props) => <EarningsTooltip {...props} earningsMap={earningsMap} />}
            />
            
            {/* Earnings date reference lines */}
            {earningsDates.map((date) => (
              <ReferenceLine
                key={date}
                x={date}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeWidth={1}
                opacity={0.7}
              />
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
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Earnings summary */}
      {earningsData?.earnings && earningsData.earnings.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Recent Earnings</h4>
          <div className="grid grid-cols-4 gap-2">
            {earningsData.earnings.slice(0, 4).map((e, i) => (
              <div key={i} className="bg-muted/30 rounded p-2">
                <p className="text-xs text-muted-foreground">
                  {new Date(e.fiscalDateEnding).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                </p>
                <p className="text-sm font-medium text-foreground">
                  ${e.reportedEPS?.toFixed(2) || '—'}
                </p>
                {e.surprisePercentage !== null && (
                  <p className={`text-xs ${e.surprisePercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {e.surprisePercentage >= 0 ? '+' : ''}{e.surprisePercentage.toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Info, BarChart2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ValuationData {
  fiscal_year: string;
  pe_ratio: number | null;
  ev_to_sales: number | null;
  ev_to_ebitda: number | null;
}

interface ValuationHistoryProps {
  assetId: string;
  currentPE?: number | null;
  currentEVSales?: number | null;
  currentEVEBITDA?: number | null;
  forwardPE?: number | null;
}

// Mini chart component for valuation metrics
function ValuationChart({ 
  data, 
  currentValue,
  forwardValue,
  label,
  tooltip,
  formatFn = (v: number) => v.toFixed(1) + 'x'
}: { 
  data: (number | null)[];
  currentValue?: number | null;
  forwardValue?: number | null;
  label: string;
  tooltip: string;
  formatFn?: (v: number) => string;
}) {
  const validData = data.filter((v): v is number => v !== null && !isNaN(v) && isFinite(v));
  
  if (validData.length === 0 && !currentValue) {
    return null;
  }

  // Calculate stats
  const allValues = [...validData];
  if (currentValue && !isNaN(currentValue) && isFinite(currentValue)) {
    allValues.push(currentValue);
  }
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  
  // Determine if current is expensive or cheap relative to history
  const isExpensive = currentValue && currentValue > avg * 1.2;
  const isCheap = currentValue && currentValue < avg * 0.8;

  // SVG dimensions
  const width = 200;
  const height = 50;
  const padding = 5;
  
  // Calculate points for the line
  const range = max - min || 1;
  const points = validData.map((val, idx) => {
    const x = padding + (idx / Math.max(validData.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return { x, y, value: val };
  });

  // Current value position
  const currentY = currentValue 
    ? height - padding - ((currentValue - min) / range) * (height - 2 * padding)
    : null;

  // Average line position
  const avgY = height - padding - ((avg - min) / range) * (height - 2 * padding);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground cursor-help flex items-center gap-1">
              {label}
              <Info className="w-3 h-3 text-muted-foreground/50" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2">
          {currentValue && (
            <span className={`text-xs font-mono font-medium ${
              isExpensive ? 'text-red-400' : isCheap ? 'text-emerald-400' : 'text-foreground'
            }`}>
              {formatFn(currentValue)}
              {isExpensive && <TrendingUp className="w-3 h-3 inline ml-1" />}
              {isCheap && <TrendingDown className="w-3 h-3 inline ml-1" />}
            </span>
          )}
        </div>
      </div>
      
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Average line */}
        <line 
          x1={padding} 
          y1={avgY} 
          x2={width - padding} 
          y2={avgY} 
          stroke="currentColor" 
          strokeOpacity={0.2}
          strokeDasharray="4,4"
        />
        
        {/* Historical line */}
        {points.length > 1 && (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeOpacity={0.5}
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
          />
        )}
        
        {/* Data points */}
        {points.map((point, idx) => (
          <Tooltip key={idx}>
            <TooltipTrigger asChild>
              <circle
                cx={point.x}
                cy={point.y}
                r={3}
                fill="currentColor"
                fillOpacity={0.6}
                className="cursor-pointer hover:fill-opacity-100"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              FY{(validData.length - idx + 20).toString().slice(-2)}: {formatFn(point.value)}
            </TooltipContent>
          </Tooltip>
        ))}
        
        {/* Current value indicator */}
        {currentY !== null && (
          <>
            <line 
              x1={width - padding - 10} 
              y1={currentY} 
              x2={width - padding} 
              y2={currentY} 
              stroke={isExpensive ? '#f87171' : isCheap ? '#34d399' : 'currentColor'}
              strokeWidth={2}
            />
            <circle
              cx={width - padding}
              cy={currentY}
              r={4}
              fill={isExpensive ? '#f87171' : isCheap ? '#34d399' : 'currentColor'}
            />
          </>
        )}
        
        {/* Forward PE indicator (if available) */}
        {forwardValue && label === 'P/E Ratio' && (
          <>
            {(() => {
              const forwardY = height - padding - ((forwardValue - min) / range) * (height - 2 * padding);
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <circle
                      cx={width - padding + 8}
                      cy={forwardY}
                      r={3}
                      fill="#fbbf24"
                      fillOpacity={0.8}
                      stroke="#fbbf24"
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      className="cursor-pointer"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    Forward P/E: {formatFn(forwardValue)}
                  </TooltipContent>
                </Tooltip>
              );
            })()}
          </>
        )}
      </svg>
      
      {/* Stats row */}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>5Y Low: {formatFn(min)}</span>
        <span>Avg: {formatFn(avg)}</span>
        <span>5Y High: {formatFn(max)}</span>
      </div>
    </div>
  );
}

export function ValuationHistory({ 
  assetId, 
  currentPE, 
  currentEVSales,
  currentEVEBITDA,
  forwardPE
}: ValuationHistoryProps) {
  const [historicalData, setHistoricalData] = useState<ValuationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchValuationHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/dashboard/valuation-history?asset_id=${assetId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch valuation history');
        }
        const data = await response.json();
        setHistoricalData(data.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (assetId) {
      fetchValuationHistory();
    }
  }, [assetId]);

  // Extract historical values
  const historicalPE = historicalData.map(d => d.pe_ratio);
  const historicalEVSales = historicalData.map(d => d.ev_to_sales);
  const historicalEVEBITDA = historicalData.map(d => d.ev_to_ebitda);

  if (loading) {
    return (
      <div className="bg-muted/30 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Valuation History</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-muted/50 rounded" />
          <div className="h-16 bg-muted/50 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail - don't show error to user
  }

  return (
    <div className="bg-muted/30 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Valuation History</h3>
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">5Y</span>
      </div>
      
      <ValuationChart 
        data={historicalPE}
        currentValue={currentPE}
        forwardValue={forwardPE}
        label="P/E Ratio"
        tooltip="Price-to-Earnings ratio. Compare current to historical average to assess if the stock is expensive or cheap relative to its own history."
      />
      
      <ValuationChart 
        data={historicalEVSales}
        currentValue={currentEVSales}
        label="EV/Sales"
        tooltip="Enterprise Value to Sales. Critical for high-growth companies that may not be profitable yet. Lower is generally better."
      />
      
      <ValuationChart 
        data={historicalEVEBITDA}
        currentValue={currentEVEBITDA}
        label="EV/EBITDA"
        tooltip="Enterprise Value to EBITDA. A more complete valuation metric that accounts for debt. Useful for comparing companies with different capital structures."
      />
      
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Relative to 5Y Avg:</span>
          {currentPE && historicalPE.length > 0 && (() => {
            const avg = historicalPE.filter((v): v is number => v !== null).reduce((a, b) => a + b, 0) / historicalPE.filter(v => v !== null).length;
            const pctDiff = ((currentPE - avg) / avg) * 100;
            return (
              <span className={`font-mono ${pctDiff > 20 ? 'text-red-400' : pctDiff < -20 ? 'text-emerald-400' : 'text-foreground'}`}>
                {pctDiff > 0 ? '+' : ''}{pctDiff.toFixed(0)}% P/E
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default ValuationHistory;

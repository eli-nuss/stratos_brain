import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart2, 
  Users, 
  Building2,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarValuationGrid } from './SidebarValuationGrid';

interface FundamentalsSidebarProps {
  assetId: string;
  asset: any;
  review: any;
}

// Helper for info tooltips
function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

// Valuation chart with σ bands
function ValuationChart({ 
  label,
  currentValue,
  historicalData,
  tooltip,
  formatFn = (v: number) => v.toFixed(1) + 'x'
}: { 
  label: string;
  currentValue: number | null;
  historicalData: { date: string; value: number }[];
  tooltip: string;
  formatFn?: (v: number) => string;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; value: number; x: number; y: number } | null>(null);
  
  // Sort by date ascending (oldest first, newest last = left to right)
  const sortedData = [...historicalData]
    .filter(d => d.value !== null && !isNaN(d.value) && isFinite(d.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const validValues = sortedData.map(d => d.value);
  
  if (validValues.length < 2 && !currentValue) {
    return null;
  }

  // Calculate statistics
  const allValues = [...validValues];
  if (currentValue && !isNaN(currentValue) && isFinite(currentValue)) {
    allValues.push(currentValue);
  }
  
  const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
  const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length;
  const stdDev = Math.sqrt(variance);
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  
  // Determine valuation status
  const zScore = currentValue ? (currentValue - mean) / (stdDev || 1) : 0;
  const isExpensive = zScore > 1;
  const isCheap = zScore < -1;
  const isVeryExpensive = zScore > 2;
  const isVeryCheap = zScore < -2;

  // SVG dimensions
  const width = 200;
  const height = 60;
  const padding = 8;
  const chartHeight = height - 2 * padding;

  // Calculate Y positions
  const getY = (val: number) => padding + chartHeight - ((val - min) / range) * chartHeight;
  
  const meanY = getY(mean);
  const plus1SigmaY = getY(mean + stdDev);
  const minus1SigmaY = getY(mean - stdDev);
  const plus2SigmaY = getY(mean + 2 * stdDev);
  const minus2SigmaY = getY(mean - 2 * stdDev);

  // Historical line points (sorted oldest to newest = left to right)
  const points = sortedData.map((d, idx) => {
    const x = padding + (idx / Math.max(sortedData.length - 1, 1)) * (width - 3 * padding);
    const y = getY(d.value);
    return { x, y, value: d.value, date: d.date };
  });

  // Current value position
  const currentX = width - padding - 5;
  const currentY = currentValue ? getY(currentValue) : null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <InfoTooltip content={tooltip} />
        </div>
        <div className="flex items-center gap-1">
          {currentValue && (
            <>
              <span className={`text-xs font-mono font-semibold ${
                isVeryExpensive ? 'text-red-400' : 
                isExpensive ? 'text-amber-400' : 
                isVeryCheap ? 'text-emerald-400' : 
                isCheap ? 'text-emerald-400/80' : 
                'text-foreground'
              }`}>
                {formatFn(currentValue)}
              </span>
              {(isExpensive || isCheap) && (
                <span className={`text-[9px] px-1 py-0.5 rounded ${
                  isExpensive ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {isVeryExpensive ? '+2σ' : isExpensive ? '+1σ' : isVeryCheap ? '-2σ' : '-1σ'}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* σ bands */}
        <rect 
          x={padding} 
          y={Math.min(plus1SigmaY, minus1SigmaY)} 
          width={width - 2 * padding} 
          height={Math.abs(minus1SigmaY - plus1SigmaY)}
          fill="currentColor"
          fillOpacity={0.05}
        />
        
        {/* +1σ and -1σ lines */}
        <line 
          x1={padding} y1={plus1SigmaY} 
          x2={width - padding} y2={plus1SigmaY}
          stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2,2"
        />
        <line 
          x1={padding} y1={minus1SigmaY} 
          x2={width - padding} y2={minus1SigmaY}
          stroke="currentColor" strokeOpacity={0.15} strokeDasharray="2,2"
        />
        
        {/* Mean line */}
        <line 
          x1={padding} y1={meanY} 
          x2={width - padding} y2={meanY}
          stroke="currentColor" strokeOpacity={0.3}
        />
        
        {/* Historical line */}
        {points.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
          />
        )}
        
        {/* Interactive hit areas for each point */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={8}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredPoint({ date: p.date, value: p.value, x: p.x, y: p.y })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
        
        {/* Visible dots on hover */}
        {points.map((p, idx) => (
          <circle
            key={`dot-${idx}`}
            cx={p.x}
            cy={p.y}
            r={hoveredPoint?.date === p.date ? 4 : 2}
            fill="var(--primary)"
            fillOpacity={hoveredPoint?.date === p.date ? 1 : 0.4}
            className="transition-all duration-150 pointer-events-none"
          />
        ))}
        
        {/* Current value dot - larger and more distinct */}
        {currentY !== null && (
          <>
            {/* Outer glow ring */}
            <circle
              cx={currentX}
              cy={currentY}
              r={8}
              fill={currentValue && currentValue > mean ? '#f8717130' : '#34d39930'}
            />
            {/* Middle ring */}
            <circle
              cx={currentX}
              cy={currentY}
              r={6}
              fill="none"
              stroke={currentValue && currentValue > mean ? '#f87171' : '#34d399'}
              strokeWidth={1.5}
              strokeOpacity={0.5}
            />
            {/* Inner solid dot */}
            <circle
              cx={currentX}
              cy={currentY}
              r={4}
              fill={currentValue && currentValue > mean ? '#f87171' : '#34d399'}
            />
            {/* Center highlight */}
            <circle
              cx={currentX - 1}
              cy={currentY - 1}
              r={1.5}
              fill="white"
              fillOpacity={0.4}
            />
          </>
        )}
        
        {/* Hover tooltip */}
        {hoveredPoint && (
          <g>
            <rect
              x={Math.min(hoveredPoint.x - 30, width - 65)}
              y={hoveredPoint.y - 28}
              width={60}
              height={22}
              rx={4}
              fill="#1a1a1a"
              stroke="#333"
              strokeWidth={1}
            />
            <text
              x={Math.min(hoveredPoint.x, width - 35)}
              y={hoveredPoint.y - 17}
              fontSize="8"
              fill="#888"
              textAnchor="middle"
            >
              {new Date(hoveredPoint.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </text>
            <text
              x={Math.min(hoveredPoint.x, width - 35)}
              y={hoveredPoint.y - 8}
              fontSize="9"
              fill="white"
              fontWeight="bold"
              textAnchor="middle"
            >
              {formatFn(hoveredPoint.value)}
            </text>
          </g>
        )}
        
        {/* Labels */}
        <text x={width - padding + 2} y={meanY + 3} fontSize="8" fill="currentColor" fillOpacity={0.4}>avg</text>
        <text x={width - padding + 2} y={plus1SigmaY + 3} fontSize="7" fill="currentColor" fillOpacity={0.3}>+1σ</text>
        <text x={width - padding + 2} y={minus1SigmaY + 3} fontSize="7" fill="currentColor" fillOpacity={0.3}>-1σ</text>
      </svg>
      
      {/* Stats row */}
      <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-0.5">
        <span>5Y Low: {formatFn(min)}</span>
        <span>Avg: {formatFn(mean)}</span>
        <span>5Y High: {formatFn(max)}</span>
      </div>
    </div>
  );
}

// Sentiment meter component
function SentimentMeter({ 
  label, 
  value, 
  tooltip,
  icon: Icon
}: { 
  label: string; 
  value: number | null; // -100 to +100
  tooltip: string;
  icon: any;
}) {
  const normalizedValue = value !== null ? Math.max(-100, Math.min(100, value)) : 0;
  const isPositive = normalizedValue > 0;
  const isNegative = normalizedValue < 0;
  const absValue = Math.abs(normalizedValue);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
          <InfoTooltip content={tooltip} />
        </div>
        {value !== null ? (
          <span className={`text-xs font-mono font-medium ${
            isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-muted-foreground'
          }`}>
            {isPositive ? '+' : ''}{normalizedValue}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      
      <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
        
        {value !== null && (
          <div 
            className={`absolute top-0 bottom-0 ${
              isPositive ? 'left-1/2 bg-emerald-500' : 'right-1/2 bg-red-500'
            } transition-all duration-500`}
            style={{ 
              width: `${absValue / 2}%`,
            }}
          />
        )}
      </div>
      
      <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
        <span>Selling</span>
        <span>Buying</span>
      </div>
    </div>
  );
}

// Collapsible accordion for Bull/Bear case
function ThesisAccordion({ 
  title, 
  points, 
  type,
  defaultExpanded = false
}: { 
  title: string; 
  points: string[]; 
  type: 'bull' | 'bear';
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const Icon = type === 'bull' ? CheckCircle2 : XCircle;
  const iconColor = type === 'bull' ? 'text-emerald-400' : 'text-red-400';
  const bgColor = type === 'bull' ? 'bg-emerald-500/5' : 'bg-red-500/5';
  const borderColor = type === 'bull' ? 'border-emerald-500/20' : 'border-red-500/20';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className="text-xs font-medium">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      
      {expanded && (
        <div className="px-2.5 pb-2.5">
          <ul className="space-y-1.5">
            {points.length > 0 ? (
              points.slice(0, 3).map((point, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className={`mt-1.5 w-1 h-1 rounded-full flex-shrink-0 ${
                    type === 'bull' ? 'bg-emerald-400' : 'bg-red-400'
                  }`} />
                  <span className="line-clamp-2">{point}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-muted-foreground/70 italic">
                Run AI analysis to generate thesis points
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FundamentalsSidebar({ assetId, asset, review }: FundamentalsSidebarProps) {
  const [valuationHistory, setValuationHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchValuationHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/dashboard/valuation-history?asset_id=${assetId}`);
        if (response.ok) {
          const data = await response.json();
          setValuationHistory(data);
        }
      } catch (err) {
        console.error('Failed to fetch valuation history:', err);
      } finally {
        setLoading(false);
      }
    };

    if (assetId) {
      fetchValuationHistory();
    }
  }, [assetId]);

  // Extract historical values with dates
  const historicalPE = valuationHistory?.history?.filter((h: any) => h.pe_ratio).map((h: any) => ({ date: h.fiscal_date || h.date, value: h.pe_ratio })) || [];
  const historicalEVSales = valuationHistory?.history?.filter((h: any) => h.ev_to_sales).map((h: any) => ({ date: h.fiscal_date || h.date, value: h.ev_to_sales })) || [];
  const historicalEVEBITDA = valuationHistory?.history?.filter((h: any) => h.ev_to_ebitda).map((h: any) => ({ date: h.fiscal_date || h.date, value: h.ev_to_ebitda })) || [];
  const historicalEVGrossProfit = valuationHistory?.history?.filter((h: any) => h.ev_to_gross_profit).map((h: any) => ({ date: h.fiscal_date || h.date, value: h.ev_to_gross_profit })) || [];
  const historicalPriceToBook = valuationHistory?.history?.filter((h: any) => h.price_to_book).map((h: any) => ({ date: h.fiscal_date || h.date, value: h.price_to_book })) || [];
  const historicalFCFYield = valuationHistory?.history?.filter((h: any) => h.fcf_yield).map((h: any) => ({ date: h.fiscal_date || h.date, value: h.fcf_yield })) || [];

  // Current values
  const currentPE = asset.pe_ratio ? parseFloat(asset.pe_ratio) : valuationHistory?.current?.pe_ratio;
  const currentEVSales = asset.ev_to_revenue ? parseFloat(asset.ev_to_revenue) : valuationHistory?.current?.ev_to_sales;
  const currentEVEBITDA = asset.ev_to_ebitda ? parseFloat(asset.ev_to_ebitda) : valuationHistory?.current?.ev_to_ebitda;
  const currentEVGrossProfit = valuationHistory?.current?.ev_to_gross_profit;
  const currentPriceToBook = asset.price_to_book ? parseFloat(asset.price_to_book) : valuationHistory?.current?.price_to_book;
  const currentFCFYield = valuationHistory?.current?.fcf_yield;

  // Determine valuation mode based on profitability AND margin quality
  // Logic:
  // - Show Revenue-Based (Growth) view ONLY if:
  //   1. Unprofitable (Net Income < 0), OR
  //   2. High P/E (>100) AND High Margin (>40%)
  // - Otherwise, show Earnings-Based (Value) view
  const netIncome = valuationHistory?.current?.net_income;
  const latestGrossMargin = valuationHistory?.current?.gross_margin;
  
  const isUnprofitable = !netIncome || netIncome <= 0;
  const isHighMultiple = currentPE && currentPE > 100;
  const isHighMargin = latestGrossMargin && latestGrossMargin > 40;
  
  // Only use Revenue-Based for unprofitable OR (high P/E AND high margin)
  // Low-margin profitable companies (like CHRW) should ALWAYS use Earnings-Based
  const showRevenueValuation = isUnprofitable || (isHighMultiple && isHighMargin);
  const valuationMode = showRevenueValuation ? 'REVENUE_BASED' : 'EARNINGS_BASED';

  // Mock smart money data (to be populated later)
  const insiderActivity = null; // -100 to +100
  const institutionalChange = null; // -100 to +100

  // Extract thesis from review
  const bullCase = review?.bull_case || review?.thesis?.bull_case || [];
  const bearCase = review?.bear_case || review?.thesis?.bear_case || [];

  return (
    <div className="space-y-4">
      {/* Module A: Valuation Context - New Grid Layout */}
      <div className="bg-muted/5 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Valuation Context</h3>
        </div>
        
        {loading ? (
          <div className="animate-pulse grid grid-cols-2 gap-2">
            <div className="h-20 bg-muted/30 rounded" />
            <div className="h-20 bg-muted/30 rounded" />
            <div className="h-20 bg-muted/30 rounded" />
            <div className="h-20 bg-muted/30 rounded" />
          </div>
        ) : (
          <SidebarValuationGrid 
            data={{
              pe_ratio: currentPE,
              forward_pe: asset.forward_pe ? parseFloat(asset.forward_pe) : null,
              peg_ratio: asset.peg_ratio ? parseFloat(asset.peg_ratio) : null,
              price_to_sales_ttm: currentEVSales, // Using EV/Sales as proxy for P/S
              forward_price_to_sales: asset.forward_price_to_sales ? parseFloat(asset.forward_price_to_sales) : null,
              price_to_book: currentPriceToBook,
            }}
          />
        )}
      </div>

      {/* Module B: Smart Money Flow */}
      <div className="bg-muted/5 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Smart Money</h3>
        </div>
        
        {(insiderActivity !== null || institutionalChange !== null) ? (
          <>
            {insiderActivity !== null && (
              <SentimentMeter 
                label="Insider Activity"
                value={insiderActivity}
                tooltip="Net insider buying vs selling over the last 6 months. Positive = insiders buying."
                icon={Users}
              />
            )}
            
            {institutionalChange !== null && (
              <SentimentMeter 
                label="Institutional Flow"
                value={institutionalChange}
                tooltip="Net change in institutional ownership. Positive = funds adding positions."
                icon={Building2}
              />
            )}
          </>
        ) : (
          <div className="text-center py-3">
            <Users className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground/60">Smart money data coming soon</p>
          </div>
        )}
      </div>

    </div>
  );
}

export default FundamentalsSidebar;

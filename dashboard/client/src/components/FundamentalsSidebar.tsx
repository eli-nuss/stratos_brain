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
  historicalValues,
  tooltip,
  formatFn = (v: number) => v.toFixed(1) + 'x'
}: { 
  label: string;
  currentValue: number | null;
  historicalValues: number[];
  tooltip: string;
  formatFn?: (v: number) => string;
}) {
  const validData = historicalValues.filter(v => v !== null && !isNaN(v) && isFinite(v));
  
  if (validData.length < 2 && !currentValue) {
    return null;
  }

  // Calculate statistics
  const allValues = [...validData];
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

  // Historical line points
  const points = validData.map((val, idx) => {
    const x = padding + (idx / Math.max(validData.length - 1, 1)) * (width - 3 * padding);
    const y = getY(val);
    return { x, y, value: val };
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
        
        {/* Current value dot */}
        {currentY !== null && (
          <circle
            cx={currentX}
            cy={currentY}
            r={4}
            fill={isExpensive ? '#f87171' : isCheap ? '#34d399' : 'var(--primary)'}
          />
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

  // Extract historical values
  const historicalPE = valuationHistory?.history?.map((h: any) => h.pe_ratio).filter(Boolean) || [];
  const historicalEVSales = valuationHistory?.history?.map((h: any) => h.ev_to_sales).filter(Boolean) || [];
  const historicalEVEBITDA = valuationHistory?.history?.map((h: any) => h.ev_to_ebitda).filter(Boolean) || [];

  // Current values
  const currentPE = asset.pe_ratio ? parseFloat(asset.pe_ratio) : valuationHistory?.current?.pe_ratio;
  const currentEVSales = asset.ev_to_revenue ? parseFloat(asset.ev_to_revenue) : valuationHistory?.current?.ev_to_sales;
  const currentEVEBITDA = asset.ev_to_ebitda ? parseFloat(asset.ev_to_ebitda) : valuationHistory?.current?.ev_to_ebitda;

  // Mock smart money data (to be populated later)
  const insiderActivity = null; // -100 to +100
  const institutionalChange = null; // -100 to +100

  // Extract thesis from review
  const bullCase = review?.bull_case || review?.thesis?.bull_case || [];
  const bearCase = review?.bear_case || review?.thesis?.bear_case || [];

  return (
    <div className="space-y-4">
      {/* Module A: Valuation Context */}
      <div className="bg-muted/5 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Valuation Context</h3>
          <span className="text-[9px] text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">5Y</span>
        </div>
        
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted/30 rounded" />
            <div className="h-16 bg-muted/30 rounded" />
          </div>
        ) : (
          <>
            <ValuationChart 
              label="P/E Ratio"
              currentValue={currentPE}
              historicalValues={historicalPE}
              tooltip="Price-to-Earnings ratio with ±1σ bands. Values above +1σ indicate expensive relative to history."
            />
            
            <ValuationChart 
              label="EV/Sales"
              currentValue={currentEVSales}
              historicalValues={historicalEVSales}
              tooltip="Enterprise Value to Sales. Critical for high-growth companies. Compare to historical range."
            />
            
            <ValuationChart 
              label="EV/EBITDA"
              currentValue={currentEVEBITDA}
              historicalValues={historicalEVEBITDA}
              tooltip="Enterprise Value to EBITDA. Accounts for debt. Lower is generally better."
            />
          </>
        )}
      </div>

      {/* Module B: Smart Money Flow */}
      <div className="bg-muted/5 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Smart Money</h3>
        </div>
        
        <SentimentMeter 
          label="Insider Activity"
          value={insiderActivity}
          tooltip="Net insider buying vs selling over the last 6 months. Positive = insiders buying."
          icon={Users}
        />
        
        <SentimentMeter 
          label="Institutional Flow"
          value={institutionalChange}
          tooltip="Net change in institutional ownership. Positive = funds adding positions."
          icon={Building2}
        />
        
        <div className="text-[10px] text-muted-foreground/70 text-center mt-1">
          Smart money data coming soon
        </div>
      </div>

      {/* Module C: AI Thesis */}
      <div className="bg-muted/5 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">AI Thesis</h3>
        </div>
        
        <div className="space-y-2">
          <ThesisAccordion 
            title="Bull Case"
            points={Array.isArray(bullCase) ? bullCase : [bullCase].filter(Boolean)}
            type="bull"
            defaultExpanded={true}
          />
          
          <ThesisAccordion 
            title="Bear Case"
            points={Array.isArray(bearCase) ? bearCase : [bearCase].filter(Boolean)}
            type="bear"
            defaultExpanded={false}
          />
        </div>
      </div>
    </div>
  );
}

export default FundamentalsSidebar;

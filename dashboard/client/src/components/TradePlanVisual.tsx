import { Target, Shield } from 'lucide-react';

interface TradePlanVisualProps {
  entryLow: number | null;
  entryHigh: number | null;
  target1: number | null;
  target2: number | null;
  stopLoss: number | null;
  currentPrice: number | null;
  riskReward: number | null;
}

export function TradePlanVisual({
  entryLow,
  entryHigh,
  target1,
  target2,
  stopLoss,
  currentPrice,
  riskReward
}: TradePlanVisualProps) {
  // Need at least stop and one target to render
  if (!stopLoss || (!target1 && !target2)) {
    return null;
  }

  const maxTarget = target2 || target1 || 0;
  const range = maxTarget - stopLoss;
  
  if (range <= 0) return null;

  const getPosition = (price: number | null) => {
    if (!price) return 0;
    return Math.max(0, Math.min(100, ((price - stopLoss) / range) * 100));
  };

  return (
    <div className="bg-muted/10 rounded-lg p-4 border border-border/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Trade Plan</span>
        </div>
        {riskReward && (
          <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${
            riskReward >= 3 ? 'bg-emerald-500/20 text-emerald-400' :
            riskReward >= 2 ? 'bg-blue-500/20 text-blue-400' :
            'bg-muted/30 text-muted-foreground'
          }`}>
            R:R {riskReward.toFixed(1)}:1
          </span>
        )}
      </div>
      
      {/* Visual price bar */}
      <div className="relative h-8 bg-muted/20 rounded-lg overflow-hidden mb-3">
        {/* Entry zone */}
        {entryLow && entryHigh && (
          <div 
            className="absolute h-full bg-blue-500/30 border-l-2 border-r-2 border-blue-500"
            style={{ 
              left: `${getPosition(entryLow)}%`, 
              width: `${getPosition(entryHigh) - getPosition(entryLow)}%` 
            }}
          />
        )}
        
        {/* Single entry if no range */}
        {entryLow && !entryHigh && (
          <div 
            className="absolute top-0 bottom-0 w-1 bg-blue-500"
            style={{ left: `${getPosition(entryLow)}%` }}
          />
        )}
        
        {/* Current price marker */}
        {currentPrice && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
            style={{ left: `${getPosition(currentPrice)}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
          </div>
        )}
        
        {/* Target 1 */}
        {target1 && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-500"
            style={{ left: `${getPosition(target1)}%` }}
          />
        )}
        
        {/* Target 2 */}
        {target2 && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-400"
            style={{ left: `${getPosition(target2)}%` }}
          />
        )}
        
        {/* Invalidation/Stop */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-red-500"
          style={{ left: '0%' }}
        />
      </div>
      
      {/* Price labels */}
      <div className="flex justify-between text-xs">
        <div className="text-red-400">
          <div className="flex items-center gap-1 font-medium">
            <Shield className="w-3 h-3" />
            Stop
          </div>
          <div className="font-mono">${stopLoss.toFixed(2)}</div>
        </div>
        
        {(entryLow || entryHigh) && (
          <div className="text-blue-400 text-center">
            <div className="font-medium">Entry</div>
            <div className="font-mono">
              {entryLow && entryHigh 
                ? `$${entryLow.toFixed(0)}-${entryHigh.toFixed(0)}`
                : entryLow 
                  ? `$${entryLow.toFixed(2)}`
                  : `$${entryHigh?.toFixed(2)}`
              }
            </div>
          </div>
        )}
        
        <div className="text-emerald-400 text-right">
          <div className="flex items-center gap-1 font-medium justify-end">
            <Target className="w-3 h-3" />
            Targets
          </div>
          <div className="font-mono">
            {target1 && target2 
              ? `$${target1.toFixed(0)} / $${target2.toFixed(0)}`
              : target1 
                ? `$${target1.toFixed(2)}`
                : `$${target2?.toFixed(2)}`
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default TradePlanVisual;

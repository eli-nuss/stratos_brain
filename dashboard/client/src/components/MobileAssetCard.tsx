import { TrendingUp, TrendingDown, Star, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileAssetCardProps {
  asset: {
    asset_id: number;
    symbol: string;
    name: string;
    close_price?: number;
    return_1d?: number;
    return_7d?: number;
    market_cap?: number;
    ai_direction_score?: number;
    ai_setup_quality_score?: number;
    ai_direction?: string;
    is_watchlisted?: boolean;
  };
  onClick: () => void;
  onWatchlistToggle?: () => void;
  showWatchlist?: boolean;
}

const formatNumber = (num: number | null | undefined, decimals = 2): string => {
  if (num === null || num === undefined) return "—";
  return num.toFixed(decimals);
};

const formatMarketCap = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "—";
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return `$${num.toLocaleString()}`;
};

const formatPrice = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "—";
  if (num >= 1000) return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (num >= 1) return `$${num.toFixed(2)}`;
  return `$${num.toFixed(4)}`;
};

export function MobileAssetCard({ 
  asset, 
  onClick, 
  onWatchlistToggle,
  showWatchlist = true 
}: MobileAssetCardProps) {
  const return1d = asset.return_1d ?? 0;
  const return7d = asset.return_7d ?? 0;
  const directionScore = asset.ai_direction_score ?? 0;
  const qualityScore = asset.ai_setup_quality_score ?? 0;
  
  const getDirectionColor = (direction: string | undefined) => {
    if (!direction) return "text-muted-foreground";
    if (direction.toLowerCase().includes("bullish")) return "text-emerald-500";
    if (direction.toLowerCase().includes("bearish")) return "text-red-500";
    return "text-amber-500";
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return "text-emerald-500";
    if (score >= 4) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-4 active:bg-muted/50 transition-colors cursor-pointer"
    >
      {/* Header: Symbol, Name, Watchlist */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{asset.symbol}</span>
            {asset.ai_direction && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                asset.ai_direction.toLowerCase().includes("bullish") 
                  ? "bg-emerald-500/10 text-emerald-500"
                  : asset.ai_direction.toLowerCase().includes("bearish")
                  ? "bg-red-500/10 text-red-500"
                  : "bg-amber-500/10 text-amber-500"
              )}>
                {asset.ai_direction}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {asset.name}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {showWatchlist && onWatchlistToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWatchlistToggle();
              }}
              className={cn(
                "p-2 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                asset.is_watchlisted 
                  ? "text-amber-500 bg-amber-500/10" 
                  : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
              )}
              aria-label={asset.is_watchlisted ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star className={cn("w-5 h-5", asset.is_watchlisted && "fill-current")} />
            </button>
          )}
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      {/* Price and Returns Row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-lg font-semibold">{formatPrice(asset.close_price)}</p>
          <p className="text-xs text-muted-foreground">
            MCap: {formatMarketCap(asset.market_cap)}
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">1D</p>
            <p className={cn(
              "font-medium flex items-center justify-end gap-1",
              return1d > 0 ? "text-emerald-500" : return1d < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {return1d > 0 ? <TrendingUp className="w-3 h-3" /> : return1d < 0 ? <TrendingDown className="w-3 h-3" /> : null}
              {return1d > 0 ? "+" : ""}{formatNumber(return1d, 1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">7D</p>
            <p className={cn(
              "font-medium",
              return7d > 0 ? "text-emerald-500" : return7d < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {return7d > 0 ? "+" : ""}{formatNumber(return7d, 1)}%
            </p>
          </div>
        </div>
      </div>

      {/* AI Scores Row */}
      <div className="flex items-center gap-4 pt-3 border-t border-border">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Direction Score</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  directionScore >= 7 ? "bg-emerald-500" : directionScore >= 4 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${(directionScore / 10) * 100}%` }}
              />
            </div>
            <span className={cn("text-sm font-medium", getScoreColor(directionScore))}>
              {formatNumber(directionScore, 1)}
            </span>
          </div>
        </div>
        
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">Quality Score</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  qualityScore >= 7 ? "bg-emerald-500" : qualityScore >= 4 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${(qualityScore / 10) * 100}%` }}
              />
            </div>
            <span className={cn("text-sm font-medium", getScoreColor(qualityScore))}>
              {formatNumber(qualityScore, 1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MobileAssetListProps {
  assets: Array<{
    asset_id: number;
    symbol: string;
    name: string;
    close_price?: number;
    return_1d?: number;
    return_7d?: number;
    market_cap?: number;
    ai_direction_score?: number;
    ai_setup_quality_score?: number;
    ai_direction?: string;
    is_watchlisted?: boolean;
  }>;
  onAssetClick: (assetId: string) => void;
  onWatchlistToggle?: (assetId: number) => void;
  showWatchlist?: boolean;
  isLoading?: boolean;
}

export function MobileAssetList({
  assets,
  onAssetClick,
  onWatchlistToggle,
  showWatchlist = true,
  isLoading = false
}: MobileAssetListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="h-5 w-16 bg-muted rounded mb-2" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
              <div className="h-10 w-10 bg-muted rounded-full" />
            </div>
            <div className="flex justify-between mb-3">
              <div className="h-6 w-20 bg-muted rounded" />
              <div className="flex gap-4">
                <div className="h-6 w-12 bg-muted rounded" />
                <div className="h-6 w-12 bg-muted rounded" />
              </div>
            </div>
            <div className="flex gap-4 pt-3 border-t border-border">
              <div className="flex-1 h-8 bg-muted rounded" />
              <div className="flex-1 h-8 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">No assets found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {assets.map((asset) => (
        <MobileAssetCard
          key={asset.asset_id}
          asset={asset}
          onClick={() => onAssetClick(String(asset.asset_id))}
          onWatchlistToggle={onWatchlistToggle ? () => onWatchlistToggle(asset.asset_id) : undefined}
          showWatchlist={showWatchlist}
        />
      ))}
    </div>
  );
}

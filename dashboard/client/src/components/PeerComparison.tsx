import { useState, useEffect } from 'react';
import { Users, TrendingUp, TrendingDown, ExternalLink, Tag, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PeerData {
  asset_id: string;
  symbol: string;
  name: string;
  market_cap: number | null;
  pe_ratio: string | null;
  profit_margin: string | null;
  revenue_growth: string | null;
  return_1d: number | null;
  return_5d: number | null;
  return_21d: number | null;
  ai_attention_level: string | null;
  ai_score: number | null;
  shared_lists: number;
}

interface PeerComparisonProps {
  assetId: string;
  currentSymbol: string;
  onPeerClick?: (assetId: string) => void;
}

// Format large numbers
function formatMarketCap(value: number | null): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

// Format percentage
function formatPercent(value: string | number | null, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return `${num >= 0 ? '+' : ''}${(num * 100).toFixed(decimals)}%`;
}

// Get color for return values
function getReturnColor(value: number | null): string {
  if (value === null) return 'text-muted-foreground';
  if (value > 0.05) return 'text-emerald-400';
  if (value > 0) return 'text-emerald-400/70';
  if (value < -0.05) return 'text-red-400';
  if (value < 0) return 'text-red-400/70';
  return 'text-foreground';
}

// Get attention level badge color
function getAttentionColor(level: string | null): string {
  switch (level?.toLowerCase()) {
    case 'high': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'low': return 'bg-muted/50 text-muted-foreground border-border';
    default: return 'bg-muted/30 text-muted-foreground border-border';
  }
}

export function PeerComparison({ assetId, currentSymbol, onPeerClick }: PeerComparisonProps) {
  const [peers, setPeers] = useState<PeerData[]>([]);
  const [lists, setLists] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPeers = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/dashboard/peers?asset_id=${assetId}&limit=6`);
        if (!response.ok) {
          throw new Error('Failed to fetch peers');
        }
        const data = await response.json();
        setPeers(data.peers || []);
        setLists(data.lists || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (assetId) {
      fetchPeers();
    }
  }, [assetId]);

  if (loading) {
    return (
      <div className="bg-muted/5 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Peer Comparison</h3>
        </div>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-muted/30 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || peers.length === 0) {
    return (
      <div className="bg-muted/5 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Peer Comparison</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          {error || 'No peers found in stock lists'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-muted/5 rounded-lg border border-border p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Peer Comparison</h3>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {lists.slice(0, 3).map((list, idx) => (
            <span 
              key={idx}
              className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20"
            >
              {list}
            </span>
          ))}
          {lists.length > 3 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-muted-foreground cursor-help">
                  +{lists.length - 3} more
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">{lists.slice(3).join(', ')}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 pr-2 font-medium">Ticker</th>
            <th className="text-right py-2 px-2 font-medium">Mkt Cap</th>
            <th className="text-right py-2 px-2 font-medium">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">P/E</span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Price-to-Earnings Ratio</p>
                </TooltipContent>
              </Tooltip>
            </th>
            <th className="text-right py-2 px-2 font-medium">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">Rev Gr</span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Revenue Growth (YoY)</p>
                </TooltipContent>
              </Tooltip>
            </th>
            <th className="text-right py-2 px-2 font-medium">1M</th>
            <th className="text-right py-2 pl-2 font-medium">AI</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((peer) => (
            <tr 
              key={peer.asset_id}
              className="border-b border-border/30 hover:bg-muted/10 transition-colors cursor-pointer"
              onClick={() => onPeerClick?.(peer.asset_id)}
            >
              <td className="py-2 pr-2">
                <div className="flex flex-col">
                  <span className="font-mono font-medium text-foreground">{peer.symbol}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {peer.name}
                  </span>
                </div>
              </td>
              <td className="text-right py-2 px-2 font-mono">
                {formatMarketCap(peer.market_cap)}
              </td>
              <td className="text-right py-2 px-2 font-mono">
                {peer.pe_ratio ? parseFloat(peer.pe_ratio).toFixed(1) : '—'}
              </td>
              <td className={`text-right py-2 px-2 font-mono ${
                peer.revenue_growth 
                  ? parseFloat(peer.revenue_growth) > 0 
                    ? 'text-emerald-400' 
                    : 'text-red-400'
                  : 'text-muted-foreground'
              }`}>
                {peer.revenue_growth 
                  ? `${(parseFloat(peer.revenue_growth) * 100).toFixed(0)}%` 
                  : '—'}
              </td>
              <td className={`text-right py-2 px-2 font-mono ${getReturnColor(peer.return_21d)}`}>
                {peer.return_21d !== null 
                  ? `${(peer.return_21d * 100).toFixed(1)}%` 
                  : '—'}
              </td>
              <td className="text-right py-2 pl-2">
                {peer.ai_attention_level && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getAttentionColor(peer.ai_attention_level)}`}>
                    {peer.ai_attention_level.charAt(0).toUpperCase()}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>Peers from shared stock lists. Click to view details.</span>
        </div>
      </div>
    </div>
  );
}

export default PeerComparison;

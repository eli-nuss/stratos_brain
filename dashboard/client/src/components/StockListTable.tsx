import { useState } from "react";
import { TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, ExternalLink, X, Brain, Bot, Pill, Rocket, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteCell } from "@/components/NoteCell";
import { useStockListAssets, removeFromList, StockList } from "@/hooks/useStockLists";
import AddToListButton from "@/components/AddToListButton";
import { WatchlistToggle } from "@/components/WatchlistToggle";

interface StockListTableProps {
  list: StockList;
  onAssetClick: (assetId: string) => void;
  watchlist?: number[];
  toggleWatchlist?: (assetId: number) => void;
}

type SortField = "symbol" | "ai_direction_score" | "ai_setup_quality_score" | "market_cap" | "close" | "return_1d" | "return_7d" | "return_30d" | "return_365d" | "dollar_volume_7d" | "dollar_volume_30d" | "pe_ratio" | "forward_pe" | "peg_ratio" | "price_to_sales_ttm" | "forward_ps" | "psg";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 50;

// Map icon names to Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  robot: Bot,
  pill: Pill,
  rocket: Rocket,
};

export default function StockListTable({ list, onAssetClick, watchlist = [], toggleWatchlist }: StockListTableProps) {
  const { assets, isLoading, mutate: mutateAssets } = useStockListAssets(list.id);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("ai_direction_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Filter and sort locally
  const filteredAssets = assets.filter((asset: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      asset.symbol?.toLowerCase().includes(searchLower) ||
      asset.name?.toLowerCase().includes(searchLower)
    );
  });

  const sortedAssets = [...filteredAssets].sort((a: any, b: any) => {
    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const paginatedAssets = sortedAssets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const total = filteredAssets.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const handleRemove = async (e: React.MouseEvent, assetId: number) => {
    e.stopPropagation();
    await removeFromList(list.id, assetId);
    mutateAssets();
  };

  const isInWatchlist = (assetId: number) => watchlist.includes(assetId);

  const getDirectionIcon = (direction: string) => {
    if (direction === "bullish") return <TrendingUp className="w-3 h-3 text-signal-bullish" />;
    if (direction === "bearish") return <TrendingDown className="w-3 h-3 text-signal-bearish" />;
    return <span className="text-muted-foreground">-</span>;
  };

  const getTradingViewUrl = (symbol: string, assetType: string) => {
    if (assetType === 'crypto') {
      return `https://www.tradingview.com/chart/?symbol=CRYPTO:${symbol}USD`;
    } else {
      return `https://www.tradingview.com/chart/?symbol=${symbol}`;
    }
  };

  const formatPrice = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num < 0.0001) return num.toExponential(2);
    if (num < 1) return num.toFixed(6);
    if (num < 100) return num.toFixed(2);
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined) return <span className="text-muted-foreground">-</span>;
    const pct = num * 100;
    const color = pct >= 0 ? "text-signal-bullish" : "text-signal-bearish";
    return <span className={color}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>;
  };

  const formatVolume = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const formatMarketCap = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatRatio = (num: number | null | undefined) => {
    if (num === null || num === undefined) return <span className="text-muted-foreground">-</span>;
    return num.toFixed(2);
  };

  const SortHeader = ({ field, children, tooltip }: { field: SortField; children: React.ReactNode; tooltip?: string }) => (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortBy === field ? (
          sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        )}
      </button>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const HeaderWithTooltip = ({ children, tooltip }: { children: React.ReactNode; tooltip: string }) => (
    <div className="flex items-center justify-center gap-1">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-left">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );

  const Icon = iconMap[list.icon] || Brain;

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: list.color }} />
          {list.name}
          <span className="text-xs text-muted-foreground">({total} assets)</span>
        </h3>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-40"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-muted/50 border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 w-20 sticky left-0 z-20 bg-muted/50"></th>
              <th className="px-3 py-2 font-medium sticky left-20 z-20 bg-muted/50">
                <SortHeader field="symbol" tooltip="Asset name and symbol">Asset</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_direction_score" tooltip="AI directional conviction (-100 to +100)">Dir</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_setup_quality_score" tooltip="AI setup quality score (0-100)">Quality</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="market_cap" tooltip="Market capitalization">Mkt Cap</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="close" tooltip="Latest closing price">Price</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_1d" tooltip="24-hour price change">24h</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_7d" tooltip="7-day price change">7d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_30d" tooltip="30-day price change">30d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_365d" tooltip="365-day price change">365d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="dollar_volume_7d" tooltip="7-day trading volume">Vol 7d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="dollar_volume_30d" tooltip="30-day trading volume">Vol 30d</SortHeader>
              </th>
              {/* Equity-specific columns */}
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="pe_ratio" tooltip="Price-to-Earnings ratio (trailing 12 months)">P/E</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="forward_pe" tooltip="Forward Price-to-Earnings ratio based on analyst estimates">Fwd P/E</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="peg_ratio" tooltip="Price/Earnings-to-Growth ratio (P/E divided by earnings growth rate)">PEG</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="price_to_sales_ttm" tooltip="Price-to-Sales ratio (trailing twelve months)">P/S</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="forward_ps" tooltip="Forward P/S (approx): Market Cap / Est. NTM Revenue. Uses log-dampened growth rate to compress extreme values (e.g., 420% → 238%).">Fwd P/S*</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="psg" tooltip="Price-to-Sales-Growth (approx): Forward P/S / Dampened Growth %. Uses log dampening for extreme growth rates. Lower = cheaper relative to growth.">PSG*</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Stock industry classification">Industry</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Brief description of the asset">Description</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Your personal notes">Notes</HeaderWithTooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={21} className="px-2 py-4 text-center text-muted-foreground">Loading...</td></tr>
            ) : paginatedAssets.length === 0 ? (
              <tr><td colSpan={21} className="px-2 py-4 text-center text-muted-foreground">No assets in this list</td></tr>
            ) : (
              paginatedAssets.map((row: any) => (
                <tr
                  key={row.asset_id}
                  className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onAssetClick(row.asset_id)}
                >
                  {/* Watchlist + Add to List + Remove */}
                  <td className="px-2 py-2 sticky left-0 z-10 bg-background" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {toggleWatchlist && (
                        <div onClick={() => toggleWatchlist(row.asset_id)}>
                          <WatchlistToggle isInWatchlist={isInWatchlist(row.asset_id)} />
                        </div>
                      )}
                      <AddToListButton assetId={row.asset_id} onUpdate={() => mutateAssets()} />
                      <button
                        onClick={(e) => handleRemove(e, row.asset_id)}
                        className="p-1 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
                        title="Remove from list"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  {/* Asset */}
                  <td className="px-3 py-2 sticky left-20 z-10 bg-background">
                    <div className="flex flex-col">
                      <span className="font-mono font-medium text-foreground">{row.symbol}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{row.name}</span>
                    </div>
                  </td>
                  {/* Direction Score */}
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getDirectionIcon(row.ai_direction)}
                      <span className={`font-mono text-xs ${
                        row.ai_direction_score > 0 ? 'text-signal-bullish' : 
                        row.ai_direction_score < 0 ? 'text-signal-bearish' : 'text-muted-foreground'
                      }`}>
                        {row.ai_direction_score != null ? (row.ai_direction_score > 0 ? '+' : '') + row.ai_direction_score : '-'}
                      </span>
                    </div>
                  </td>
                  {/* Quality Score */}
                  <td className="px-2 py-2 text-center">
                    <span className={`font-mono text-xs ${
                      row.ai_setup_quality_score >= 70 ? 'text-signal-bullish' : 
                      row.ai_setup_quality_score >= 40 ? 'text-yellow-500' : 'text-muted-foreground'
                    }`}>
                      {row.ai_setup_quality_score ?? '-'}
                    </span>
                  </td>
                  {/* Market Cap */}
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatMarketCap(row.market_cap)}</td>
                  {/* Price */}
                  <td className="px-2 py-2 text-center font-mono text-xs">${formatPrice(row.close)}</td>
                  {/* Returns */}
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatPercent(row.return_1d)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatPercent(row.return_7d)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatPercent(row.return_30d)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatPercent(row.return_365d)}</td>
                  {/* Volume */}
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatVolume(row.dollar_volume_7d)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatVolume(row.dollar_volume_30d)}</td>
                  {/* Equity-specific: P/E, Fwd P/E, PEG, P/S, Fwd P/S, PSG */}
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatRatio(row.pe_ratio)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatRatio(row.forward_pe)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatRatio(row.peg_ratio)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatRatio(row.price_to_sales_ttm)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatRatio(row.forward_ps)}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">{formatRatio(row.psg)}</td>
                  {/* Industry */}
                  <td className="px-2 py-2 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground truncate max-w-[80px] block cursor-help">
                          {row.industry || row.category || "-"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.industry || row.category || "No industry data"}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  {/* Description */}
                  <td className="px-2 py-2 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground truncate max-w-[120px] block cursor-help">
                          {row.short_description ? row.short_description.substring(0, 50) + "..." : "-"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {row.short_description || "No description available"}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  {/* Notes */}
                  <NoteCell assetId={row.asset_id} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

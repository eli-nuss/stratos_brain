import { useState } from "react";
import { TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, ExternalLink, X, Brain, Bot, Pill, Rocket } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteCell } from "@/components/NoteCell";
import { useStockListAssets, removeFromList, StockList } from "@/hooks/useStockLists";
import AddToListButton from "@/components/AddToListButton";

interface StockListTableProps {
  list: StockList;
  onAssetClick: (assetId: string) => void;
}

type SortField = "symbol" | "ai_direction_score" | "ai_setup_quality_score" | "market_cap" | "close" | "return_1d" | "return_7d" | "return_30d" | "return_365d" | "dollar_volume_7d" | "dollar_volume_30d";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 50;

// Map icon names to Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  robot: Bot,
  pill: Pill,
  rocket: Rocket,
};

export default function StockListTable({ list, onAssetClick }: StockListTableProps) {
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
          <thead className="text-xs text-muted-foreground bg-muted/10 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th className="px-3 py-2 font-medium sticky left-0 z-20 bg-muted/10 backdrop-blur-sm">
                <SortHeader field="symbol">Asset</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_direction_score" tooltip="AI-determined directional conviction (-100 to +100)">Dir</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_setup_quality_score" tooltip="AI-determined setup quality score (0-100)">Quality</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="market_cap" tooltip="Market capitalization">Mkt Cap</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="close" tooltip="Latest closing price">Price</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_1d" tooltip="Price change over the last 24 hours">24h</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_7d" tooltip="Price change over the last 7 days">7d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_30d" tooltip="Price change over the last 30 days">30d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_365d" tooltip="Price change over the last 365 days">365d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="dollar_volume_7d" tooltip="Trading volume over the last 7 days">Vol 7d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="dollar_volume_30d" tooltip="Trading volume over the last 30 days">Vol 30d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Category (crypto) or Sector (equities)">Cat/Sector</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Brief description of the asset">Description</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Your personal notes">Notes</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Add to lists">+</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Remove from this list">×</HeaderWithTooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-3 py-3"><div className="h-4 w-20 bg-muted rounded" /></td>
                  {[...Array(15)].map((_, j) => (
                    <td key={j} className="px-2 py-3"><div className="h-4 w-12 bg-muted rounded mx-auto" /></td>
                  ))}
                </tr>
              ))
            ) : paginatedAssets.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? "No assets match your search" : "No assets in this list yet"}
                </td>
              </tr>
            ) : (
              paginatedAssets.map((asset: any) => (
                <tr
                  key={asset.asset_id}
                  onClick={() => onAssetClick(String(asset.asset_id))}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {asset.symbol}
                          <a
                            href={getTradingViewUrl(asset.symbol, asset.asset_type)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[120px]">{asset.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getDirectionIcon(asset.ai_direction)}
                      <span className={
                        asset.ai_direction_score > 0 ? "text-signal-bullish" :
                        asset.ai_direction_score < 0 ? "text-signal-bearish" :
                        "text-muted-foreground"
                      }>
                        {asset.ai_direction_score != null ? asset.ai_direction_score : "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={
                      asset.ai_setup_quality_score >= 70 ? "text-signal-bullish" :
                      asset.ai_setup_quality_score >= 40 ? "text-yellow-500" :
                      "text-muted-foreground"
                    }>
                      {asset.ai_setup_quality_score != null ? asset.ai_setup_quality_score : "-"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{formatMarketCap(asset.market_cap)}</td>
                  <td className="px-2 py-2 text-center font-mono">${formatPrice(asset.close)}</td>
                  <td className="px-2 py-2 text-center">{formatPercent(asset.return_1d)}</td>
                  <td className="px-2 py-2 text-center">{formatPercent(asset.return_7d)}</td>
                  <td className="px-2 py-2 text-center">{formatPercent(asset.return_30d)}</td>
                  <td className="px-2 py-2 text-center">{formatPercent(asset.return_365d)}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{formatVolume(asset.dollar_volume_7d)}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground">{formatVolume(asset.dollar_volume_30d)}</td>
                  <td className="px-2 py-2 text-center">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-[80px] inline-block">
                      {asset.category || asset.sector || "-"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px] inline-block cursor-help">
                          {asset.short_description?.slice(0, 30) || "-"}
                          {asset.short_description?.length > 30 ? "..." : ""}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-left">
                        {asset.short_description || "No description available"}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <NoteCell assetId={asset.asset_id} />
                  </td>
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <AddToListButton assetId={asset.asset_id} onUpdate={() => mutateAssets()} />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={(e) => handleRemove(e, asset.asset_id)}
                      className="p-1 rounded hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
                      title="Remove from list"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
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
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
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

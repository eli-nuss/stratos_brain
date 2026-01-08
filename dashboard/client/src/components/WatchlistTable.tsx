import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteCell } from "@/components/NoteCell";
import AddToListButton from "@/components/AddToListButton";
import AssetTagButton from "@/components/AssetTagButton";
import AssetSearchDropdown from "@/components/AssetSearchDropdown";
import { useWatchlistAssets, useWatchlist } from "@/hooks/useWatchlist";

interface WatchlistTableProps {
  onAssetClick: (assetId: string) => void;
}

type SortField = "symbol" | "ai_direction_score" | "ai_setup_quality_score" | "market_cap" | "close" | "return_1d" | "return_7d" | "return_30d" | "return_365d" | "dollar_volume_7d" | "dollar_volume_30d" | "pe_ratio" | "forward_pe" | "peg_ratio" | "price_to_sales_ttm" | "forward_ps" | "psg";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 50;

export default function WatchlistTable({ onAssetClick }: WatchlistTableProps) {
  const { assets, isLoading, mutate: mutateAssets } = useWatchlistAssets();
  const { addToWatchlist, watchlistIds } = useWatchlist();
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("ai_direction_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Compute existing asset IDs for the search dropdown
  const existingAssetIds = useMemo(() => {
    return new Set<number>(assets.map((a: any) => a.asset_id as number));
  }, [assets]);

  // Handle adding asset from search dropdown
  const handleAddAsset = async (assetId: number) => {
    await addToWatchlist(assetId);
    mutateAssets();
  };

  // Sort assets
  const sortedAssets = [...assets].sort((a: any, b: any) => {
    const aVal = a[sortBy] ?? (sortOrder === "asc" ? Infinity : -Infinity);
    const bVal = b[sortBy] ?? (sortOrder === "asc" ? Infinity : -Infinity);
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const paginatedAssets = sortedAssets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const total = assets.length;
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

  const getDirectionIcon = (score: number | null | undefined) => {
    if (score === null || score === undefined) return <span className="text-muted-foreground">-</span>;
    if (score > 0) return <TrendingUp className="w-3 h-3 text-signal-bullish" />;
    if (score < 0) return <TrendingDown className="w-3 h-3 text-signal-bearish" />;
    return <span className="text-muted-foreground">-</span>;
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
          <TooltipContent className="max-w-xs text-left">{tooltip}</TooltipContent>
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
        <TooltipContent className="max-w-xs text-left">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );

  // Check if any assets are equities to show equity-specific columns
  const hasEquities = assets.some((a: any) => a.asset_type === 'equity');

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          Watchlist
          <span className="text-xs text-muted-foreground">({total} assets)</span>
        </h3>
        <AssetSearchDropdown
          existingAssetIds={existingAssetIds}
          onAddAsset={handleAddAsset}
          placeholder="Search to add..."
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-muted/50 border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2 w-16 sticky left-0 z-20 bg-muted/50"></th>
              <th className="px-3 py-2 font-medium sticky left-16 z-20 bg-muted/50">
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
              {/* Equity-specific columns - always show if any equities in watchlist */}
              {hasEquities && (
                <>
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
                    <SortHeader field="forward_ps" tooltip="Forward P/S (approx): Market Cap / Est. NTM Revenue">Fwd P/S*</SortHeader>
                  </th>
                  <th className="px-2 py-2 font-medium text-center">
                    <SortHeader field="psg" tooltip="Price-to-Sales-Growth (approx): Forward P/S / Dampened Growth %">PSG*</SortHeader>
                  </th>
                </>
              )}
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Category (crypto) or Industry (equities)">
                  Cat/Industry
                </HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Brief description of the asset">Description</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Your personal notes">Notes</HeaderWithTooltip>
              </th>

            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={hasEquities ? 21 : 15} className="px-2 py-4 text-center text-muted-foreground">Loading...</td></tr>
            ) : paginatedAssets.length === 0 ? (
              <tr><td colSpan={hasEquities ? 21 : 15} className="px-2 py-4 text-center text-muted-foreground">
                Your watchlist is empty. Use the search above to add assets.
              </td></tr>
            ) : (
              paginatedAssets.map((row: any) => (
                <tr key={row.asset_id} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onAssetClick(row.asset_id)}>
                  <td className="px-2 py-2 sticky left-0 z-10 bg-background" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <AssetTagButton assetId={row.asset_id} onUpdate={() => mutateAssets()} />
                      <AddToListButton assetId={row.asset_id} />
                    </div>
                  </td>
                  <td className="px-3 py-2 sticky left-16 z-10 bg-background">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        row.asset_type === 'crypto' 
                          ? 'text-orange-400 bg-orange-400/10' 
                          : 'text-blue-400 bg-blue-400/10'
                      }`}>
                        {row.asset_type === 'crypto' ? 'C' : 'E'}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-mono font-medium text-foreground">{row.symbol}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{row.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getDirectionIcon(row.ai_direction_score)}
                      <span className={`font-mono text-xs ${
                        row.ai_direction_score > 0 ? "text-signal-bullish" : 
                        row.ai_direction_score < 0 ? "text-signal-bearish" : "text-muted-foreground"
                      }`}>
                        {row.ai_direction_score != null ? (row.ai_direction_score > 0 ? "+" : "") + row.ai_direction_score : "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`font-mono text-xs ${
                      row.ai_setup_quality_score >= 70 ? "text-signal-bullish" :
                      row.ai_setup_quality_score >= 40 ? "text-yellow-400" : "text-muted-foreground"
                    }`}>
                      {row.ai_setup_quality_score ?? "-"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatMarketCap(row.market_cap)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    ${formatPrice(row.close)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatPercent(row.return_1d)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatPercent(row.return_7d)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatPercent(row.return_30d)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatPercent(row.return_365d)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                    {formatVolume(row.dollar_volume_7d)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                    {formatVolume(row.dollar_volume_30d)}
                  </td>
                  {/* Equity-specific columns - show dash for crypto */}
                  {hasEquities && (
                    <>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.asset_type === 'equity' && row.pe_ratio ? row.pe_ratio.toFixed(1) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.asset_type === 'equity' && row.forward_pe ? row.forward_pe.toFixed(1) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.asset_type === 'equity' && row.peg_ratio ? row.peg_ratio.toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.asset_type === 'equity' && row.price_to_sales_ttm ? row.price_to_sales_ttm.toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.asset_type === 'equity' && row.forward_ps ? row.forward_ps.toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.asset_type === 'equity' && row.psg ? row.psg.toFixed(2) : "-"}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2 text-center text-xs text-muted-foreground truncate max-w-[80px]">
                    {row.category || row.industry || row.sector || "-"}
                  </td>
                  <td className="px-2 py-2 text-left text-xs text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate block max-w-[150px] cursor-help">
                          {row.short_description ? row.short_description.substring(0, 50) + (row.short_description.length > 50 ? "..." : "") : "-"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md text-left">
                        {row.short_description || "No description available"}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <NoteCell assetId={row.asset_id} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between bg-muted/20">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {totalPages || 1} | {total} results
        </span>
        <div className="flex gap-1">
          <button onClick={() => setPage(0)} disabled={page === 0} className="p-1 hover:bg-muted disabled:opacity-50" title="First page">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 hover:bg-muted disabled:opacity-50" title="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 hover:bg-muted disabled:opacity-50" title="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-1 hover:bg-muted disabled:opacity-50" title="Last page">
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

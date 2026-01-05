import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, ExternalLink, StickyNote } from "lucide-react";
import { useAllAssets, AssetType, SortField, SortOrder } from "@/hooks/useAllAssets";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COLUMN_DEFINITIONS } from "@/lib/signalDefinitions";
import { NoteCell } from "@/components/NoteCell";

interface AllAssetsTableProps {
  assetType: AssetType;
  date?: string;
  onAssetClick: (assetId: string) => void;
}

const PAGE_SIZE = 50;

export default function AllAssetsTable({ assetType, date, onAssetClick }: AllAssetsTableProps) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("ai_direction_score"); // Default to AI direction score
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, total, isLoading } = useAllAssets({
    assetType,
    date,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortOrder,
    search: search || undefined,
  });

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

  const getAttentionColor = (level: string) => {
    switch (level) {
      case "URGENT": return "text-red-400 border-red-400/30 bg-red-400/10";
      case "FOCUS": return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
      case "WATCH": return "text-blue-400 border-blue-400/30 bg-blue-400/10";
      default: return "text-muted-foreground border-border bg-muted/10";
    }
  };

  const getAttentionTooltip = (level: string) => {
    switch (level) {
      case "URGENT": return "Immediate attention warranted. High-conviction setup with favorable risk/reward.";
      case "FOCUS": return "Monitor closely. Developing setup that may become actionable soon.";
      case "WATCH": return "On the radar. Keep watching for potential entry opportunities.";
      default: return "";
    }
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === "bullish") return <TrendingUp className="w-3 h-3 text-signal-bullish" />;
    if (direction === "bearish") return <TrendingDown className="w-3 h-3 text-signal-bearish" />;
    return <span className="text-muted-foreground">-</span>;
  };

  const getSignalCategoryBadge = (category: string) => {
    switch (category) {
      case "inflection_bullish":
        return <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-signal-bullish border-signal-bullish/30 bg-signal-bullish/10">INFLECTION ↑</span>;
      case "inflection_bearish":
        return <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-signal-bearish border-signal-bearish/30 bg-signal-bearish/10">INFLECTION ↓</span>;
      case "trend":
        return <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-emerald-400 border-emerald-400/30 bg-emerald-400/10">TREND</span>;
      case "risk":
        return <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-destructive border-destructive/30 bg-destructive/10">RISK</span>;
      default:
        return <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-muted-foreground border-border bg-muted/10">-</span>;
    }
  };

  const getSignalCategoryTooltip = (category: string) => {
    switch (category) {
      case "inflection_bullish":
        return "Bullish inflection point detected. Price breaking out or reversing higher with strong momentum signals.";
      case "inflection_bearish":
        return "Bearish inflection point detected. Price breaking down or reversing lower with negative momentum signals.";
      case "trend":
        return "Established trend continuation. Asset showing consistent directional movement with healthy pullbacks.";
      case "risk":
        return "Risk warning. Technical deterioration or potential breakdown pattern identified.";
      default:
        return "No significant signal category assigned.";
    }
  };

  // Generate TradingView URL for an asset
  const getTradingViewUrl = (symbol: string, assetType: string) => {
    if (assetType === 'crypto') {
      // For crypto, use CRYPTO exchange with USD pair
      return `https://www.tradingview.com/chart/?symbol=CRYPTO:${symbol}USD`;
    } else {
      // For equities, just use the symbol
      return `https://www.tradingview.com/chart/?symbol=${symbol}`;
    }
  };

  const getSetupTooltip = (setup: string) => {
    switch (setup) {
      case "breakout":
        return "Breakout: Price clearing a key resistance level with volume confirmation, suggesting continuation higher.";
      case "reversal":
        return "Reversal: Trend change pattern identified, suggesting a shift in the prevailing direction.";
      case "mean_reversion":
        return "Mean Reversion: Extended price likely to return toward moving average. Counter-trend opportunity.";
      case "continuation":
        return "Continuation: Pullback within an established trend offering a lower-risk entry point.";
      default:
        return "";
    }
  };

  // Sort header with tooltip
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

  // Column header with tooltip (non-sortable)
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

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          {assetType === "crypto" ? "🪙" : "📈"} All {assetType === "crypto" ? "Crypto" : "Equity"} Assets
          <span className="text-xs text-muted-foreground">({total} total)</span>
        </h3>
        
        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-7 pr-2 py-1 text-xs bg-background border border-border rounded w-32 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
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
              <th className="px-4 py-2 font-medium">
                <SortHeader field="symbol">Asset</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_direction_score" tooltip="AI-determined directional conviction (-100 to +100). Positive = bullish, Negative = bearish.">AI Dir</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_setup_quality_score" tooltip="AI-determined setup quality score (0-100). Higher = better technical setup.">AI Quality</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="market_cap" tooltip="Market capitalization (Close Price × Circulating Supply)">Mkt Cap</SortHeader>
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
                <HeaderWithTooltip tooltip={COLUMN_DEFINITIONS.setup.description}>Setup</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip={COLUMN_DEFINITIONS.attention.description}>Attn</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Open chart on TradingView">Chart</HeaderWithTooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip="Your personal notes for this asset. Click to add or edit.">Notes</HeaderWithTooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-12 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? `No assets found matching "${search}"` : "No data available"}
                </td>
              </tr>
            ) : (
              data.map((row: any) => (
                <tr
                  key={row.asset_id}
                  onClick={() => onAssetClick(row.asset_id)}
                  className="hover:bg-muted/20 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="font-mono font-medium text-foreground">{row.symbol}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{row.name}</span>
                    </div>
                  </td>
                  <td className={`px-2 py-2 font-mono text-center text-xs rounded ${
                    row.ai_direction_score > 0 ? "text-signal-bullish bg-signal-bullish/10" : row.ai_direction_score < 0 ? "text-signal-bearish bg-signal-bearish/10" : "text-muted-foreground bg-muted/10"
                  }`}>
                    {row.ai_direction_score ? Math.round(row.ai_direction_score) : "-"}
                  </td>
                  <td className="px-2 py-2 font-mono text-center text-xs bg-blue-500/10 text-blue-400 rounded">
                    {row.ai_setup_quality_score ? Math.round(row.ai_setup_quality_score) : "-"}
                  </td>
                  <td className="px-2 py-2 font-mono text-center text-xs text-muted-foreground">
                    {row.market_cap ? (
                      row.market_cap >= 1e12 ? `$${(row.market_cap / 1e12).toFixed(1)}T` :
                      row.market_cap >= 1e9 ? `$${(row.market_cap / 1e9).toFixed(1)}B` :
                      row.market_cap >= 1e6 ? `$${(row.market_cap / 1e6).toFixed(1)}M` :
                      `$${row.market_cap.toLocaleString()}`
                    ) : "-"}
                  </td>
                  <td className="px-2 py-2 font-mono text-center text-xs text-foreground">
                    {row.close != null ? (
                      row.close >= 1000 ? `$${row.close.toLocaleString(undefined, {maximumFractionDigits: 0})}` :
                      row.close >= 1 ? `$${row.close.toFixed(2)}` :
                      row.close >= 0.01 ? `$${row.close.toFixed(4)}` :
                      `$${row.close.toPrecision(3)}`
                    ) : "-"}
                  </td>

                  <td className={`px-2 py-2 font-mono text-center text-xs ${row.return_1d > 0 ? "text-signal-bullish" : row.return_1d < 0 ? "text-signal-bearish" : "text-muted-foreground"}`}>
                    {row.return_1d != null ? `${row.return_1d > 0 ? "+" : ""}${(row.return_1d * 100).toFixed(1)}%` : "-"}
                  </td>
                  <td className={`px-2 py-2 font-mono text-center text-xs ${row.return_7d > 0 ? "text-signal-bullish" : row.return_7d < 0 ? "text-signal-bearish" : "text-muted-foreground"}`}>
                    {row.return_7d != null ? `${row.return_7d > 0 ? "+" : ""}${(row.return_7d * 100).toFixed(1)}%` : "-"}
                  </td>
                  <td className={`px-2 py-2 font-mono text-center text-xs ${row.return_30d > 0 ? "text-signal-bullish" : row.return_30d < 0 ? "text-signal-bearish" : "text-muted-foreground"}`}>
                    {row.return_30d != null ? `${row.return_30d > 0 ? "+" : ""}${(row.return_30d * 100).toFixed(1)}%` : "-"}
                  </td>

                  <td className="px-2 py-2 text-xs text-muted-foreground text-center">
                    {row.setup_type ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help truncate max-w-[80px] block">
                            {row.setup_type}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {getSetupTooltip(row.setup_type)}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {row.ai_attention ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium cursor-help ${getAttentionColor(row.ai_attention)}`}>
                            {row.ai_attention}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {getAttentionTooltip(row.ai_attention)}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <a
                      href={getTradingViewUrl(row.symbol, assetType)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Open on TradingView"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                  <NoteCell assetId={row.asset_id} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-muted/30">
        <span className="text-xs text-muted-foreground">
          Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 text-xs">
            Page {page + 1} of {totalPages || 1}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

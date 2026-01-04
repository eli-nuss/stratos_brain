import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useAllAssets, AssetType, SortField, SortOrder } from "@/hooks/useAllAssets";

interface AllAssetsTableProps {
  assetType: AssetType;
  date?: string;
  onAssetClick: (assetId: string) => void;
}

const PAGE_SIZE = 50;

export default function AllAssetsTable({ assetType, date, onAssetClick }: AllAssetsTableProps) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("weighted_score");
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

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
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
              <th className="px-2 py-2 font-medium text-right">
                <SortHeader field="weighted_score">Score</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-right">
                <SortHeader field="score_delta">Δ</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium">Signal</th>
              <th className="px-2 py-2 font-medium">Setup</th>
              <th className="px-2 py-2 font-medium">Attn</th>
              <th className="px-2 py-2 font-medium">Dir</th>
              <th className="px-4 py-2 font-medium text-right">
                <SortHeader field="ai_confidence">Conf.</SortHeader>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-10 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-8 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-12 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-8 bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 bg-muted rounded ml-auto" /></td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
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
                  <td className={`px-2 py-2 font-mono text-right ${
                    row.weighted_score > 0 ? "text-signal-bullish" : row.weighted_score < 0 ? "text-signal-bearish" : "text-muted-foreground"
                  }`}>
                    {Math.round(row.weighted_score)}
                  </td>
                  <td className={`px-2 py-2 font-mono text-right text-xs ${
                    row.score_delta > 0 ? "text-signal-bullish" : row.score_delta < 0 ? "text-signal-bearish" : "text-muted-foreground"
                  }`}>
                    {row.score_delta > 0 ? "+" : ""}{Math.round(row.score_delta)}
                  </td>
                  <td className="px-2 py-2">
                    {getSignalCategoryBadge(row.signal_category)}
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground truncate max-w-[80px]">
                    {row.setup_type || "-"}
                  </td>
                  <td className="px-2 py-2">
                    {row.ai_attention ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getAttentionColor(row.ai_attention)}`}>
                        {row.ai_attention}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {getDirectionIcon(row.ai_direction)}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-right text-xs text-muted-foreground">
                    {row.ai_confidence ? `${Math.round(row.ai_confidence * 100)}%` : "-"}
                  </td>
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

import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, ExternalLink, StickyNote, X } from "lucide-react";
import { useAllAssets, AssetType, SortField, SortOrder } from "@/hooks/useAllAssets";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { COLUMN_DEFINITIONS } from "@/lib/signalDefinitions";
import { NoteCell } from "@/components/NoteCell";
import WatchlistToggle from "@/components/WatchlistToggle";
import { useWatchlist } from "@/hooks/useWatchlist";

interface AllAssetsTableProps {
  assetType: AssetType;
  date?: string;
  onAssetClick: (assetId: string) => void;
  showWatchlistColumn?: boolean;
}

const PAGE_SIZE = 50;

interface FilterThresholds {
  aiDirScore?: { min?: number; max?: number };
  aiQualityScore?: { min?: number; max?: number };
  aiConfidence?: { min?: number; max?: number };
  return1d?: { min?: number; max?: number };
  volume7d?: { min?: number; max?: number };
  marketCap?: { min?: number; max?: number };
}

export default function AllAssetsTable({ assetType, date, onAssetClick, showWatchlistColumn = true }: AllAssetsTableProps) {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("ai_direction_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Threshold filters
  const [filterThresholds, setFilterThresholds] = useState<FilterThresholds>({});
  const [filterInputs, setFilterInputs] = useState({
    aiDirScoreMin: "",
    aiDirScoreMax: "",
    aiQualityScoreMin: "",
    aiQualityScoreMax: "",
    aiConfidenceMin: "",
    aiConfidenceMax: "",
    return1dMin: "",
    return1dMax: "",
    volume7dMin: "",
    marketCapMin: "",
  });

  const { data = [], total, isLoading } = useAllAssets({
    assetType,
    date,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortOrder,
    search: search || undefined,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Apply threshold filters to data client-side
  const filteredData = data.filter(row => {
    if (filterThresholds.aiDirScore) {
      const score = row.ai_direction_score || 0;
      if (filterThresholds.aiDirScore.min !== undefined && score < filterThresholds.aiDirScore.min) return false;
      if (filterThresholds.aiDirScore.max !== undefined && score > filterThresholds.aiDirScore.max) return false;
    }
    if (filterThresholds.aiQualityScore) {
      const score = row.ai_setup_quality_score || 0;
      if (filterThresholds.aiQualityScore.min !== undefined && score < filterThresholds.aiQualityScore.min) return false;
      if (filterThresholds.aiQualityScore.max !== undefined && score > filterThresholds.aiQualityScore.max) return false;
    }
    if (filterThresholds.aiConfidence) {
      const conf = row.ai_confidence || 0;
      if (filterThresholds.aiConfidence.min !== undefined && conf < filterThresholds.aiConfidence.min) return false;
      if (filterThresholds.aiConfidence.max !== undefined && conf > filterThresholds.aiConfidence.max) return false;
    }
    if (filterThresholds.return1d) {
      const ret = row.return_1d || 0;
      if (filterThresholds.return1d.min !== undefined && ret < filterThresholds.return1d.min) return false;
      if (filterThresholds.return1d.max !== undefined && ret > filterThresholds.return1d.max) return false;
    }
    if (filterThresholds.volume7d) {
      const vol = row.dollar_volume_7d || 0;
      if (filterThresholds.volume7d.min !== undefined && vol < filterThresholds.volume7d.min) return false;
      if (filterThresholds.volume7d.max !== undefined && vol > filterThresholds.volume7d.max) return false;
    }
    if (filterThresholds.marketCap) {
      const mc = row.market_cap || 0;
      if (filterThresholds.marketCap.min !== undefined && mc < filterThresholds.marketCap.min) return false;
      if (filterThresholds.marketCap.max !== undefined && mc > filterThresholds.marketCap.max) return false;
    }
    return true;
  });

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

  const applyThresholdFilters = () => {
    const newThresholds: FilterThresholds = {};
    if (filterInputs.aiDirScoreMin || filterInputs.aiDirScoreMax) {
      newThresholds.aiDirScore = {
        min: filterInputs.aiDirScoreMin ? parseFloat(filterInputs.aiDirScoreMin) : undefined,
        max: filterInputs.aiDirScoreMax ? parseFloat(filterInputs.aiDirScoreMax) : undefined,
      };
    }
    if (filterInputs.aiQualityScoreMin || filterInputs.aiQualityScoreMax) {
      newThresholds.aiQualityScore = {
        min: filterInputs.aiQualityScoreMin ? parseFloat(filterInputs.aiQualityScoreMin) : undefined,
        max: filterInputs.aiQualityScoreMax ? parseFloat(filterInputs.aiQualityScoreMax) : undefined,
      };
    }
    if (filterInputs.aiConfidenceMin || filterInputs.aiConfidenceMax) {
      newThresholds.aiConfidence = {
        min: filterInputs.aiConfidenceMin ? parseFloat(filterInputs.aiConfidenceMin) : undefined,
        max: filterInputs.aiConfidenceMax ? parseFloat(filterInputs.aiConfidenceMax) : undefined,
      };
    }
    if (filterInputs.return1dMin || filterInputs.return1dMax) {
      newThresholds.return1d = {
        min: filterInputs.return1dMin ? parseFloat(filterInputs.return1dMin) : undefined,
        max: filterInputs.return1dMax ? parseFloat(filterInputs.return1dMax) : undefined,
      };
    }
    if (filterInputs.volume7dMin) {
      newThresholds.volume7d = {
        min: parseFloat(filterInputs.volume7dMin) * 1e6,
      };
    }
    if (filterInputs.marketCapMin) {
      newThresholds.marketCap = {
        min: parseFloat(filterInputs.marketCapMin) * 1e9,
      };
    }
    setFilterThresholds(newThresholds);
    setPage(0);
  };

  const clearThresholdFilters = () => {
    setFilterThresholds({});
    setFilterInputs({
      aiDirScoreMin: "",
      aiDirScoreMax: "",
      aiQualityScoreMin: "",
      aiQualityScoreMax: "",
      aiConfidenceMin: "",
      aiConfidenceMax: "",
      return1dMin: "",
      return1dMax: "",
      volume7dMin: "",
      marketCapMin: "",
    });
    setPage(0);
  };

  const hasActiveFilters = Object.keys(filterThresholds).length > 0;

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
      case "inflection_bullish": return "bg-signal-bullish/20 text-signal-bullish border-signal-bullish/30";
      case "inflection_bearish": return "bg-signal-bearish/20 text-signal-bearish border-signal-bearish/30";
      case "trend": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "risk": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default: return "bg-muted/20 text-muted-foreground border-border";
    }
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

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {assetType === "crypto" ? "🪙" : "📈"} All {assetType === "crypto" ? "Crypto" : "Equity"} Assets
          <span className="text-xs text-muted-foreground">({filteredData.length} / {total} total)</span>
        </h3>
        
        {/* Search & Filter Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              hasActiveFilters
                ? "bg-signal-bullish/20 border-signal-bullish/50 text-signal-bullish"
                : "bg-muted/20 border-border hover:bg-muted/30"
            }`}
          >
            {showFilters ? "Hide" : "Show"} Filters {hasActiveFilters && `(${Object.keys(filterThresholds).length})`}
          </button>

          <form onSubmit={handleSearch} className="flex items-center gap-1 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </form>
        </div>

        {/* Threshold Filters Panel */}
        {showFilters && (
          <div className="border-t border-border pt-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {/* AI Direction Score */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">AI Dir Score</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={filterInputs.aiDirScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMin: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={filterInputs.aiDirScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMax: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* AI Quality Score */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">AI Quality</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={filterInputs.aiQualityScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiQualityScoreMin: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={filterInputs.aiQualityScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiQualityScoreMax: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* AI Confidence */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Confidence %</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={filterInputs.aiConfidenceMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiConfidenceMin: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={filterInputs.aiConfidenceMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiConfidenceMax: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* 24h Return */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">24h Ret %</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filterInputs.return1dMin}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMin: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filterInputs.return1dMax}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMax: e.target.value})}
                    className="flex-1 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* 7d Volume */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Vol 7d ($M)</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={filterInputs.volume7dMin}
                  onChange={(e) => setFilterInputs({...filterInputs, volume7dMin: e.target.value})}
                  className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                />
              </div>

              {/* Market Cap */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">MC ($B)</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={filterInputs.marketCapMin}
                  onChange={(e) => setFilterInputs({...filterInputs, marketCapMin: e.target.value})}
                  className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={applyThresholdFilters}
                className="text-xs px-3 py-1 bg-signal-bullish/20 border border-signal-bullish/50 rounded hover:bg-signal-bullish/30 transition-colors"
              >
                Apply
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearThresholdFilters}
                  className="text-xs px-3 py-1 bg-muted/20 border border-border rounded hover:bg-muted/30 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-muted/50 border-b border-border">
            <tr>
              {showWatchlistColumn && <th className="px-2 py-2 w-8"></th>}
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="symbol" tooltip="Asset symbol">Symbol</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="weighted_score" tooltip={COLUMN_DEFINITIONS.score.description}>Score</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_direction_score" tooltip="AI directional bias">Dir</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_setup_quality_score" tooltip="AI-determined setup quality">Quality</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="ai_confidence" tooltip="AI confidence level">Conf %</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_1d" tooltip="24h price change">24h %</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="dollar_volume_7d" tooltip="7-day average volume">Vol 7d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="market_cap" tooltip="Market capitalization">Mkt Cap</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="pe_ratio" tooltip="Price-to-Earnings ratio">P/E</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="industry" tooltip="Industry sector">Industry</SortHeader>
              </th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={showWatchlistColumn ? 12 : 11} className="px-2 py-4 text-center text-muted-foreground">Loading...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={showWatchlistColumn ? 12 : 11} className="px-2 py-4 text-center text-muted-foreground">No assets match your filters</td></tr>
            ) : (
              filteredData.map((row) => (
                <tr key={row.asset_id} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onAssetClick(row.asset_id)}>
                  {showWatchlistColumn && (
                    <td className="px-2 py-2" onClick={(e) => { e.stopPropagation(); toggleWatchlist(row.asset_id); }}>
                      <WatchlistToggle isInWatchlist={isInWatchlist(row.asset_id)} />
                    </td>
                  )}
                  <td className="px-2 py-2 font-mono text-sm font-bold text-foreground">{row.symbol}</td>
                  <td className="px-2 py-2 font-mono text-center text-xs">{row.weighted_score?.toFixed(1) || "-"}</td>
                  <td className="px-2 py-2 text-center">{getDirectionIcon(row.ai_direction_score > 0 ? "bullish" : "bearish")}</td>
                  <td className="px-2 py-2 font-mono text-center text-xs">{row.ai_setup_quality_score?.toFixed(0) || "-"}</td>
                  <td className="px-2 py-2 font-mono text-center text-xs">{row.ai_confidence?.toFixed(0) || "-"}%</td>
                  <td className={`px-2 py-2 font-mono text-center text-xs ${(row.return_1d || 0) > 0 ? "text-signal-bullish" : "text-signal-bearish"}`}>
                    {row.return_1d?.toFixed(2) || "-"}%
                  </td>
                  <td className="px-2 py-2 font-mono text-center text-xs text-muted-foreground">
                    {row.dollar_volume_7d ? (row.dollar_volume_7d >= 1e9 ? `$${(row.dollar_volume_7d / 1e9).toFixed(1)}B` : `$${(row.dollar_volume_7d / 1e6).toFixed(0)}M`) : "-"}
                  </td>
                  <td className="px-2 py-2 font-mono text-center text-xs text-muted-foreground">
                    {row.market_cap ? (row.market_cap >= 1e12 ? `$${(row.market_cap / 1e12).toFixed(1)}T` : row.market_cap >= 1e9 ? `$${(row.market_cap / 1e9).toFixed(1)}B` : `$${(row.market_cap / 1e6).toFixed(1)}M`) : "-"}
                  </td>
                  <td className="px-2 py-2 font-mono text-center text-xs text-muted-foreground">
                    {row.pe_ratio ? row.pe_ratio.toFixed(1) : "-"}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                    {row.industry ? row.industry : "-"}
                  </td>
                  <td className="px-2 py-2 w-8">
                    <NoteCell assetId={row.asset_id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between bg-muted/20">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {totalPages} | {filteredData.length} results
        </span>
        <div className="flex gap-1">
          <button onClick={() => setPage(0)} disabled={page === 0} className="p-1 hover:bg-muted disabled:opacity-50" title="First page">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 hover:bg-muted disabled:opacity-50" title="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="p-1 hover:bg-muted disabled:opacity-50" title="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} className="p-1 hover:bg-muted disabled:opacity-50" title="Last page">
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

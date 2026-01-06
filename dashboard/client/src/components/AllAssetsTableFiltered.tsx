import { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, ExternalLink, StickyNote, X, Filter } from "lucide-react";
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

// Available categories for filtering
const CATEGORIES = [
  "AI", "DeFi", "Meme", "L1", "L2", "L0", "Privacy", "Gaming", "NFT", 
  "Infrastructure", "RWA", "CeFi", "Stablecoins", "Payment Solutions",
  "Exchange-based Tokens", "Launchpad", "Smart Contract", "Wallets",
  "Yield-Bearing", "Bridge Governance Tokens", "Bridged-Tokens",
  "Ethereum Ecosystem", "Solana Ecosystem", "BNB Chain Ecosystem"
];

interface FilterThresholds {
  aiDirScore?: { min?: number; max?: number };
  aiQualityScore?: { min?: number; max?: number };
  return1d?: { min?: number; max?: number };
  volume7d?: { min?: number };
  marketCap?: { min?: number };
  category?: string;
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
    return1dMin: "",
    return1dMax: "",
    volume7dMin: "",
    marketCapMin: "",
    category: "",
  });

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
    if (filterThresholds.return1d) {
      const ret = row.return_1d || 0;
      if (filterThresholds.return1d.min !== undefined && ret < filterThresholds.return1d.min) return false;
      if (filterThresholds.return1d.max !== undefined && ret > filterThresholds.return1d.max) return false;
    }
    if (filterThresholds.volume7d) {
      const vol = row.dollar_volume_7d || 0;
      if (filterThresholds.volume7d.min !== undefined && vol < filterThresholds.volume7d.min) return false;
    }
    if (filterThresholds.marketCap) {
      const mc = row.market_cap || 0;
      if (filterThresholds.marketCap.min !== undefined && mc < filterThresholds.marketCap.min) return false;
    }
    if (filterThresholds.category) {
      const cat = row.category || "";
      if (cat !== filterThresholds.category) return false;
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
    if (filterInputs.category) {
      newThresholds.category = filterInputs.category;
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
      return1dMin: "",
      return1dMax: "",
      volume7dMin: "",
      marketCapMin: "",
      category: "",
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
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {assetType === "crypto" ? "🪙" : "📈"} All {assetType === "crypto" ? "Crypto" : "Equity"} Assets
            <span className="text-xs text-muted-foreground font-normal">({filteredData.length} / {total} total)</span>
          </h3>
        </div>
        
        {/* Search & Filter Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-1.5 ${
              hasActiveFilters
                ? "bg-signal-bullish/20 border-signal-bullish/50 text-signal-bullish"
                : "bg-muted/20 border-border hover:bg-muted/30"
            }`}
          >
            <Filter className="w-3 h-3" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && <span className="ml-1 px-1.5 py-0.5 bg-signal-bullish/30 rounded text-[10px]">{Object.keys(filterThresholds).length}</span>}
          </button>

          <form onSubmit={handleSearch} className="flex items-center gap-1 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(""); setSearchInput(""); setPage(0); }}
                className="text-xs text-muted-foreground hover:text-foreground p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        </div>

        {/* Threshold Filters Panel */}
        {showFilters && (
          <div className="border-t border-border pt-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {/* Category Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                <select
                  value={filterInputs.category}
                  onChange={(e) => setFilterInputs({...filterInputs, category: e.target.value})}
                  className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* AI Direction Score */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dir Score</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={filterInputs.aiDirScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMin: e.target.value})}
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={filterInputs.aiDirScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMax: e.target.value})}
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* AI Quality Score */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Quality</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Min"
                    value={filterInputs.aiQualityScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiQualityScoreMin: e.target.value})}
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Max"
                    value={filterInputs.aiQualityScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiQualityScoreMax: e.target.value})}
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* 24h Return */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">24h Ret %</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filterInputs.return1dMin}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMin: e.target.value})}
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filterInputs.return1dMax}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMax: e.target.value})}
                    className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* 7d Volume */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Vol 7d ($M)</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={filterInputs.volume7dMin}
                  onChange={(e) => setFilterInputs({...filterInputs, volume7dMin: e.target.value})}
                  className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Market Cap */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Mkt Cap ($B)</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={filterInputs.marketCapMin}
                  onChange={(e) => setFilterInputs({...filterInputs, marketCapMin: e.target.value})}
                  className="w-full text-xs bg-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="flex gap-2">
                  <button
                    onClick={applyThresholdFilters}
                    className="flex-1 text-xs px-3 py-1.5 bg-signal-bullish/20 border border-signal-bullish/50 text-signal-bullish rounded hover:bg-signal-bullish/30 transition-colors font-medium"
                  >
                    Apply
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={clearThresholdFilters}
                      className="text-xs px-3 py-1.5 bg-muted/20 border border-border rounded hover:bg-muted/30 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
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
                <SortHeader field="ai_setup_quality_score" tooltip="AI setup quality assessment">Quality</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="market_cap" tooltip="Market capitalization">Mkt Cap</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="price" tooltip="Current price">Price</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_1d" tooltip="24 hour return">24h</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_7d" tooltip="7 day return">7d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_30d" tooltip="30 day return">30d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="return_365d" tooltip="365 day return">365d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="dollar_volume_7d" tooltip="7 day dollar volume">Vol 7d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <SortHeader field="dollar_volume_30d" tooltip="30 day dollar volume">Vol 30d</SortHeader>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center justify-center gap-1 cursor-help">
                      Cat/Sector
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Category or sector classification</TooltipContent>
                </Tooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center justify-center gap-1 cursor-help">
                      Description
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Short description of the asset</TooltipContent>
                </Tooltip>
              </th>
              <th className="px-2 py-2 font-medium text-center">Notes</th>
              {showWatchlistColumn && <th className="px-2 py-2 w-8 text-center">★</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={17} className="text-center py-8 text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={17} className="text-center py-8 text-muted-foreground">
                  No assets found
                </td>
              </tr>
            ) : (
              filteredData.map((row) => (
                <tr
                  key={row.asset_id}
                  onClick={() => onAssetClick(row.asset_id)}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  {showWatchlistColumn && (
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <WatchlistToggle
                        assetId={row.asset_id}
                        isInWatchlist={isInWatchlist(row.asset_id)}
                        onToggle={() => toggleWatchlist(row.asset_id)}
                      />
                    </td>
                  )}
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{row.asset_type === "crypto" ? "🪙" : "📈"}</span>
                      <div>
                        <div className="font-medium text-foreground">{row.symbol}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{row.name}</div>
                      </div>
                      {row.attention_level && row.attention_level !== "NONE" && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getAttentionColor(row.attention_level)}`}>
                          {row.attention_level}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`font-mono text-xs ${
                      (row.weighted_score || 0) >= 70 ? "text-signal-bullish" :
                      (row.weighted_score || 0) >= 40 ? "text-yellow-400" :
                      "text-muted-foreground"
                    }`}>
                      {row.weighted_score?.toFixed(0) || "-"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getDirectionIcon(row.ai_direction || "")}
                      <span className={`font-mono text-xs ${
                        row.ai_direction === "bullish" ? "text-signal-bullish" :
                        row.ai_direction === "bearish" ? "text-signal-bearish" :
                        "text-muted-foreground"
                      }`}>
                        {row.ai_direction_score !== null ? `${row.ai_direction_score > 0 ? "+" : ""}${row.ai_direction_score}` : "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`font-mono text-xs ${
                      (row.ai_setup_quality_score || 0) >= 80 ? "text-signal-bullish" :
                      (row.ai_setup_quality_score || 0) >= 60 ? "text-yellow-400" :
                      "text-muted-foreground"
                    }`}>
                      {row.ai_setup_quality_score || "-"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                    {row.market_cap ? `$${(row.market_cap / 1e9).toFixed(2)}B` : "-"}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-xs">
                    ${row.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: row.price < 0.01 ? 6 : 2 }) || "-"}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono text-xs ${
                    (row.return_1d || 0) > 0 ? "text-signal-bullish" :
                    (row.return_1d || 0) < 0 ? "text-signal-bearish" :
                    "text-muted-foreground"
                  }`}>
                    {row.return_1d !== null ? `${row.return_1d > 0 ? "+" : ""}${row.return_1d.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono text-xs ${
                    (row.return_7d || 0) > 0 ? "text-signal-bullish" :
                    (row.return_7d || 0) < 0 ? "text-signal-bearish" :
                    "text-muted-foreground"
                  }`}>
                    {row.return_7d !== null ? `${row.return_7d > 0 ? "+" : ""}${row.return_7d.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono text-xs ${
                    (row.return_30d || 0) > 0 ? "text-signal-bullish" :
                    (row.return_30d || 0) < 0 ? "text-signal-bearish" :
                    "text-muted-foreground"
                  }`}>
                    {row.return_30d !== null ? `${row.return_30d > 0 ? "+" : ""}${row.return_30d.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono text-xs ${
                    (row.return_365d || 0) > 0 ? "text-signal-bullish" :
                    (row.return_365d || 0) < 0 ? "text-signal-bearish" :
                    "text-muted-foreground"
                  }`}>
                    {row.return_365d !== null ? `${row.return_365d > 0 ? "+" : ""}${row.return_365d.toFixed(1)}%` : "-"}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                    {row.dollar_volume_7d ? `$${(row.dollar_volume_7d / 1e6).toFixed(1)}M` : "-"}
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                    {row.dollar_volume_30d ? `$${(row.dollar_volume_30d / 1e9).toFixed(1)}B` : "-"}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                    {row.category || "-"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px] block cursor-help">
                          {row.short_description ? row.short_description.substring(0, 50) + "..." : "-"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {row.short_description || "No description available"}
                      </TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <NoteCell assetId={row.asset_id} />
                  </td>
                  {showWatchlistColumn && (
                    <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <WatchlistToggle
                        assetId={row.asset_id}
                        isInWatchlist={isInWatchlist(row.asset_id)}
                        onToggle={() => toggleWatchlist(row.asset_id)}
                      />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-2 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// Force rebuild

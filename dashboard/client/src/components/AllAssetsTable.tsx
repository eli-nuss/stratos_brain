import { useState } from "react";
import { TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, X } from "lucide-react";
import { useAllAssets, AssetType, SortField, SortOrder } from "@/hooks/useAllAssets";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteCell } from "@/components/NoteCell";
import WatchlistToggle from "@/components/WatchlistToggle";
import AddToListButton from "@/components/AddToListButton";
import { useWatchlist } from "@/hooks/useWatchlist";

interface AllAssetsTableProps {
  assetType: AssetType;
  date?: string;
  onAssetClick: (assetId: string) => void;
  showWatchlistColumn?: boolean;
}

const PAGE_SIZE = 50;

// Available categories for crypto filtering
const CRYPTO_CATEGORIES = [
  "AI", "DeFi", "Meme", "L1", "L2", "L0", "Privacy", "Gaming", "NFT", 
  "Infrastructure", "RWA", "CeFi", "Stablecoins", "Payment Solutions",
  "Exchange-based Tokens", "Launchpad", "Smart Contract", "Wallets",
  "Yield-Bearing", "Bridge Governance Tokens", "Bridged-Tokens"
];

// Available industries for equity filtering
const EQUITY_INDUSTRIES = [
  "Aerospace & Defense", "Airlines", "Asset Management", "Auto Manufacturers",
  "Auto Parts", "Banks - Diversified", "Banks - Regional", "Biotechnology",
  "Broadcasting", "Building Materials", "Capital Markets", "Chemicals",
  "Communication Equipment", "Computer Hardware", "Conglomerates",
  "Consulting Services", "Consumer Electronics", "Credit Services",
  "Diagnostics & Research", "Discount Stores", "Drug Manufacturers - General",
  "Drug Manufacturers - Specialty & Generic", "Education & Training Services",
  "Electrical Equipment & Parts", "Electronic Components", "Engineering & Construction",
  "Entertainment", "Farm & Heavy Construction Machinery", "Farm Products",
  "Financial Data & Stock Exchanges", "Food Distribution", "Gold",
  "Health Information Services", "Healthcare Plans", "Home Improvement Retail",
  "Household & Personal Products", "Industrial Distribution", "Information Technology Services",
  "Insurance - Diversified", "Insurance - Life", "Insurance - Property & Casualty",
  "Insurance - Specialty", "Insurance Brokers", "Integrated Freight & Logistics",
  "Internet Content & Information", "Internet Retail", "Leisure", "Lodging",
  "Luxury Goods", "Marine Shipping", "Medical Care Facilities", "Medical Devices",
  "Medical Distribution", "Medical Instruments & Supplies", "Metal Fabrication",
  "Mortgage Finance", "Oil & Gas E&P", "Oil & Gas Equipment & Services",
  "Oil & Gas Integrated", "Oil & Gas Midstream", "Oil & Gas Refining & Marketing",
  "Other Industrial Metals & Mining", "Packaged Foods", "Packaging & Containers",
  "Paper & Paper Products", "Personal Services", "Pharmaceuticals",
  "Pollution & Treatment Controls", "Publishing", "Railroads",
  "Real Estate - Development", "Real Estate - Diversified", "Real Estate Services",
  "REIT - Diversified", "REIT - Healthcare Facilities", "REIT - Hotel & Motel",
  "REIT - Industrial", "REIT - Mortgage", "REIT - Office", "REIT - Residential",
  "REIT - Retail", "REIT - Specialty", "Rental & Leasing Services",
  "Residential Construction", "Resorts & Casinos", "Restaurants",
  "Scientific & Technical Instruments", "Security & Protection Services",
  "Semiconductor Equipment & Materials", "Semiconductors", "Software - Application",
  "Software - Infrastructure", "Solar", "Specialty Business Services",
  "Specialty Chemicals", "Specialty Industrial Machinery", "Specialty Retail",
  "Staffing & Employment Services", "Steel", "Telecom Services", "Tobacco",
  "Travel Services", "Trucking", "Uranium", "Utilities - Diversified",
  "Utilities - Regulated Electric", "Utilities - Regulated Gas",
  "Utilities - Regulated Water", "Utilities - Renewable", "Waste Management"
];

interface FilterThresholds {
  aiDirScore?: { min?: number; max?: number };
  aiQualityScore?: { min?: number; max?: number };
  return1d?: { min?: number; max?: number };
  volume7d?: { min?: number; max?: number };
  marketCap?: { min?: number; max?: number };
  peRatio?: { min?: number; max?: number };
  forwardPe?: { min?: number; max?: number };
  pegRatio?: { min?: number; max?: number };
  priceToSalesTtm?: { min?: number; max?: number };
  forwardPs?: { min?: number; max?: number };
  psg?: { min?: number; max?: number };
}

export default function AllAssetsTable({ assetType, date, onAssetClick, showWatchlistColumn = true }: AllAssetsTableProps) {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("ai_direction_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
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
    peRatioMin: "",  // For equity
    peRatioMax: "",  // For equity
    forwardPeMin: "",  // For equity
    forwardPeMax: "",  // For equity
    pegRatioMin: "",  // For equity
    pegRatioMax: "",  // For equity
    priceToSalesTtmMin: "",  // For equity - P/S TTM
    priceToSalesTtmMax: "",  // For equity
    forwardPsMin: "",  // For equity - Forward P/S (approx)
    forwardPsMax: "",  // For equity
    psgMin: "",  // For equity - PSG (approx)
    psgMax: "",  // For equity
    category: "",  // For crypto
    industry: "",  // For equity
  });

  const { data = [], total, isLoading } = useAllAssets({
    assetType,
    date,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortOrder,
    search: search || undefined,
    industry: assetType === "equity" && filterInputs.industry ? filterInputs.industry : undefined,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
    if (filterThresholds.peRatio) {
      const pe = row.pe_ratio;
      if (pe === null || pe === undefined) return false; // Exclude assets without P/E if filter is set
      if (filterThresholds.peRatio.min !== undefined && pe < filterThresholds.peRatio.min) return false;
      if (filterThresholds.peRatio.max !== undefined && pe > filterThresholds.peRatio.max) return false;
    }
    if (filterThresholds.forwardPe) {
      const fpe = row.forward_pe;
      if (fpe === null || fpe === undefined) return false; // Exclude assets without Forward P/E if filter is set
      if (filterThresholds.forwardPe.min !== undefined && fpe < filterThresholds.forwardPe.min) return false;
      if (filterThresholds.forwardPe.max !== undefined && fpe > filterThresholds.forwardPe.max) return false;
    }
    if (filterThresholds.pegRatio) {
      const peg = row.peg_ratio;
      if (peg === null || peg === undefined) return false; // Exclude assets without PEG if filter is set
      if (filterThresholds.pegRatio.min !== undefined && peg < filterThresholds.pegRatio.min) return false;
      if (filterThresholds.pegRatio.max !== undefined && peg > filterThresholds.pegRatio.max) return false;
    }
    if (filterThresholds.priceToSalesTtm) {
      const ps = row.price_to_sales_ttm;
      if (ps === null || ps === undefined) return false;
      if (filterThresholds.priceToSalesTtm.min !== undefined && ps < filterThresholds.priceToSalesTtm.min) return false;
      if (filterThresholds.priceToSalesTtm.max !== undefined && ps > filterThresholds.priceToSalesTtm.max) return false;
    }
    if (filterThresholds.forwardPs) {
      const fps = row.forward_ps;
      if (fps === null || fps === undefined) return false;
      if (filterThresholds.forwardPs.min !== undefined && fps < filterThresholds.forwardPs.min) return false;
      if (filterThresholds.forwardPs.max !== undefined && fps > filterThresholds.forwardPs.max) return false;
    }
    if (filterThresholds.psg) {
      const psgVal = row.psg;
      if (psgVal === null || psgVal === undefined) return false;
      if (filterThresholds.psg.min !== undefined && psgVal < filterThresholds.psg.min) return false;
      if (filterThresholds.psg.max !== undefined && psgVal > filterThresholds.psg.max) return false;
    }
    // Category filter
    if (filterInputs.category && row.category !== filterInputs.category) {
      return false;
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
      newThresholds.volume7d = { min: parseFloat(filterInputs.volume7dMin) * 1e6 };
    }
    if (filterInputs.marketCapMin) {
      newThresholds.marketCap = { min: parseFloat(filterInputs.marketCapMin) * 1e9 };
    }
    if (filterInputs.peRatioMin || filterInputs.peRatioMax) {
      newThresholds.peRatio = {
        min: filterInputs.peRatioMin ? parseFloat(filterInputs.peRatioMin) : undefined,
        max: filterInputs.peRatioMax ? parseFloat(filterInputs.peRatioMax) : undefined,
      };
    }
    if (filterInputs.forwardPeMin || filterInputs.forwardPeMax) {
      newThresholds.forwardPe = {
        min: filterInputs.forwardPeMin ? parseFloat(filterInputs.forwardPeMin) : undefined,
        max: filterInputs.forwardPeMax ? parseFloat(filterInputs.forwardPeMax) : undefined,
      };
    }
    if (filterInputs.pegRatioMin || filterInputs.pegRatioMax) {
      newThresholds.pegRatio = {
        min: filterInputs.pegRatioMin ? parseFloat(filterInputs.pegRatioMin) : undefined,
        max: filterInputs.pegRatioMax ? parseFloat(filterInputs.pegRatioMax) : undefined,
      };
    }
    if (filterInputs.priceToSalesTtmMin || filterInputs.priceToSalesTtmMax) {
      newThresholds.priceToSalesTtm = {
        min: filterInputs.priceToSalesTtmMin ? parseFloat(filterInputs.priceToSalesTtmMin) : undefined,
        max: filterInputs.priceToSalesTtmMax ? parseFloat(filterInputs.priceToSalesTtmMax) : undefined,
      };
    }
    if (filterInputs.forwardPsMin || filterInputs.forwardPsMax) {
      newThresholds.forwardPs = {
        min: filterInputs.forwardPsMin ? parseFloat(filterInputs.forwardPsMin) : undefined,
        max: filterInputs.forwardPsMax ? parseFloat(filterInputs.forwardPsMax) : undefined,
      };
    }
    if (filterInputs.psgMin || filterInputs.psgMax) {
      newThresholds.psg = {
        min: filterInputs.psgMin ? parseFloat(filterInputs.psgMin) : undefined,
        max: filterInputs.psgMax ? parseFloat(filterInputs.psgMax) : undefined,
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
      return1dMin: "",
      return1dMax: "",
      volume7dMin: "",
      marketCapMin: "",
      peRatioMin: "",
      peRatioMax: "",
      forwardPeMin: "",
      forwardPeMax: "",
      pegRatioMin: "",
      pegRatioMax: "",
      priceToSalesTtmMin: "",
      priceToSalesTtmMax: "",
      forwardPsMin: "",
      forwardPsMax: "",
      psgMin: "",
      psgMax: "",
      category: "",
      industry: "",
    });
    setPage(0);
  };

  const hasActiveFilters = Object.keys(filterThresholds).length > 0 || filterInputs.category !== "" || filterInputs.industry !== "";

  const getDirectionIcon = (direction: string) => {
    if (direction === "bullish") return <TrendingUp className="w-3 h-3 text-signal-bullish" />;
    if (direction === "bearish") return <TrendingDown className="w-3 h-3 text-signal-bearish" />;
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

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          {assetType === "crypto" ? "🪙" : "📈"} All {assetType === "crypto" ? "Crypto" : "Equity"} Assets
          <span className="text-xs text-muted-foreground ml-2">({filteredData.length} / {total} total)</span>
        </h3>
        
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">
                  {assetType === "crypto" ? "Category" : "Industry"}
                </label>
                {assetType === "crypto" ? (
                  <select
                    value={filterInputs.category}
                    onChange={(e) => setFilterInputs({...filterInputs, category: e.target.value})}
                    className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  >
                    <option value="">All Categories</option>
                    {CRYPTO_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={filterInputs.industry}
                    onChange={(e) => {
                      setFilterInputs({...filterInputs, industry: e.target.value});
                      setPage(0);
                    }}
                    className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none"
                  >
                    <option value="">All Industries</option>
                    {EQUITY_INDUSTRIES.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Dir Score</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="Min" value={filterInputs.aiDirScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMin: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                  <input type="number" placeholder="Max" value={filterInputs.aiDirScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMax: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Quality Score</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="Min" value={filterInputs.aiQualityScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiQualityScoreMin: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                  <input type="number" placeholder="Max" value={filterInputs.aiQualityScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiQualityScoreMax: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">24h Ret %</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="Min" value={filterInputs.return1dMin}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMin: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                  <input type="number" placeholder="Max" value={filterInputs.return1dMax}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMax: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Vol 7d ($M)</label>
                <input type="number" placeholder="Min" value={filterInputs.volume7dMin}
                  onChange={(e) => setFilterInputs({...filterInputs, volume7dMin: e.target.value})}
                  className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Mkt Cap ($B)</label>
                <input type="number" placeholder="Min" value={filterInputs.marketCapMin}
                  onChange={(e) => setFilterInputs({...filterInputs, marketCapMin: e.target.value})}
                  className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
              </div>
              {assetType === "equity" && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">P/E Ratio</label>
                    <div className="flex gap-1">
                      <input type="number" placeholder="Min" value={filterInputs.peRatioMin}
                        onChange={(e) => setFilterInputs({...filterInputs, peRatioMin: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                      <input type="number" placeholder="Max" value={filterInputs.peRatioMax}
                        onChange={(e) => setFilterInputs({...filterInputs, peRatioMax: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Forward P/E</label>
                    <div className="flex gap-1">
                      <input type="number" placeholder="Min" value={filterInputs.forwardPeMin}
                        onChange={(e) => setFilterInputs({...filterInputs, forwardPeMin: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                      <input type="number" placeholder="Max" value={filterInputs.forwardPeMax}
                        onChange={(e) => setFilterInputs({...filterInputs, forwardPeMax: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">PEG Ratio</label>
                    <div className="flex gap-1">
                      <input type="number" placeholder="Min" value={filterInputs.pegRatioMin}
                        onChange={(e) => setFilterInputs({...filterInputs, pegRatioMin: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                      <input type="number" placeholder="Max" value={filterInputs.pegRatioMax}
                        onChange={(e) => setFilterInputs({...filterInputs, pegRatioMax: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">P/S (TTM)</label>
                    <div className="flex gap-1">
                      <input type="number" placeholder="Min" value={filterInputs.priceToSalesTtmMin}
                        onChange={(e) => setFilterInputs({...filterInputs, priceToSalesTtmMin: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                      <input type="number" placeholder="Max" value={filterInputs.priceToSalesTtmMax}
                        onChange={(e) => setFilterInputs({...filterInputs, priceToSalesTtmMax: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Fwd P/S*</label>
                    <div className="flex gap-1">
                      <input type="number" placeholder="Min" value={filterInputs.forwardPsMin}
                        onChange={(e) => setFilterInputs({...filterInputs, forwardPsMin: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                      <input type="number" placeholder="Max" value={filterInputs.forwardPsMax}
                        onChange={(e) => setFilterInputs({...filterInputs, forwardPsMax: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">PSG*</label>
                    <div className="flex gap-1">
                      <input type="number" placeholder="Min" value={filterInputs.psgMin}
                        onChange={(e) => setFilterInputs({...filterInputs, psgMin: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                      <input type="number" placeholder="Max" value={filterInputs.psgMax}
                        onChange={(e) => setFilterInputs({...filterInputs, psgMax: e.target.value})}
                        className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={applyThresholdFilters}
                className="text-xs px-3 py-1 bg-signal-bullish/20 border border-signal-bullish/50 rounded hover:bg-signal-bullish/30 transition-colors">
                Apply
              </button>
              {hasActiveFilters && (
                <button onClick={clearThresholdFilters}
                  className="text-xs px-3 py-1 bg-muted/20 border border-border rounded hover:bg-muted/30 transition-colors">
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
          <thead className="sticky top-0 bg-muted/50 border-b border-border text-xs text-muted-foreground">
            <tr>
              {showWatchlistColumn && <th className="px-2 py-2 w-16 sticky left-0 z-20 bg-muted/50"></th>}
              <th className={`px-3 py-2 font-medium sticky z-20 bg-muted/50 ${showWatchlistColumn ? 'left-16' : 'left-0'}`}>
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
              {assetType === "equity" && (
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
                    <SortHeader field="forward_ps" tooltip="Forward P/S (approx): Market Cap / Est. NTM Revenue. Uses log-dampened growth rate to compress extreme values (e.g., 420% → 238%).">Fwd P/S*</SortHeader>
                  </th>
                  <th className="px-2 py-2 font-medium text-center">
                    <SortHeader field="psg" tooltip="Price-to-Sales-Growth (approx): Forward P/S / Dampened Growth %. Uses log dampening for extreme growth rates. Lower = cheaper relative to growth.">PSG*</SortHeader>
                  </th>
                </>
              )}
              <th className="px-2 py-2 font-medium text-center">
                <HeaderWithTooltip tooltip={assetType === "crypto" ? "Token category" : "Stock industry classification"}>
                  {assetType === "crypto" ? "Category" : "Industry"}
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
              <tr><td colSpan={assetType === "equity" ? (showWatchlistColumn ? 21 : 20) : (showWatchlistColumn ? 16 : 15)} className="px-2 py-4 text-center text-muted-foreground">Loading...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={assetType === "equity" ? (showWatchlistColumn ? 21 : 20) : (showWatchlistColumn ? 16 : 15)} className="px-2 py-4 text-center text-muted-foreground">No assets match your filters</td></tr>
            ) : (
              filteredData.map((row) => (
                <tr key={row.asset_id} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onAssetClick(row.asset_id)}>
                  {showWatchlistColumn && (
                    <td className="px-2 py-2 sticky left-0 z-10 bg-background" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <div onClick={() => toggleWatchlist(row.asset_id)}>
                          <WatchlistToggle isInWatchlist={isInWatchlist(row.asset_id)} />
                        </div>
                        <AddToListButton assetId={row.asset_id} />
                      </div>
                    </td>
                  )}
                  <td className={`px-3 py-2 sticky z-10 bg-background ${showWatchlistColumn ? 'left-16' : 'left-0'}`}>
                    <div className="flex flex-col">
                      <span className="font-mono font-medium text-foreground">{row.symbol}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {getDirectionIcon(row.ai_direction_score > 0 ? "bullish" : row.ai_direction_score < 0 ? "bearish" : "neutral")}
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
                  {assetType === "equity" && (
                    <>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.pe_ratio ? row.pe_ratio.toFixed(1) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.forward_pe ? row.forward_pe.toFixed(1) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.peg_ratio ? row.peg_ratio.toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.price_to_sales_ttm ? row.price_to_sales_ttm.toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.forward_ps ? row.forward_ps.toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                        {row.psg ? row.psg.toFixed(2) : "-"}
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

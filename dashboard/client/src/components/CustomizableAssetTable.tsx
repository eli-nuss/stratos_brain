// Customizable Asset Table with drag-and-drop column reordering and show/hide
import { useState, useCallback, useEffect } from "react";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, X, GripVertical, Activity, LayoutGrid, Table2, Star } from "lucide-react";
import { useSearchContext } from "@/contexts/SearchContext";
import { useAllAssets, AssetType } from "@/hooks/useAllAssets";
import { useSortPreferences, SortField, SortOrder } from "@/hooks/useSortPreferences";
import { useColumnConfig, ColumnDef, ALL_COLUMNS } from "@/hooks/useColumnConfig";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteCell } from "@/components/NoteCell";
import { getSetupDefinition, getPurityInterpretation, SETUP_DEFINITIONS } from "@/lib/setupDefinitions";
import TableSummaryRows from "@/components/TableSummaryRows";
import AddToListButton from "@/components/AddToListButton";
import AddToPortfolioButton from "@/components/AddToPortfolioButton";
import AssetTagButton from "@/components/AssetTagButton";
import ColumnCustomizer from "@/components/ColumnCustomizer";
import { MobileAssetList } from "@/components/MobileAssetCard";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useAssetTags } from "@/hooks/useAssetTags";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CustomizableAssetTableProps {
  assetType: AssetType;
  date?: string;
  onAssetClick: (assetId: string) => void;
  showWatchlistColumn?: boolean;
  /** Initial industry filter from URL */
  initialIndustry?: string;
  /** Initial sector filter from URL */
  initialSector?: string;
  /** Initial category filter from URL (crypto) */
  initialCategory?: string;
}

const PAGE_SIZE = 100;

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
  setupPurityScore?: { min?: number; max?: number };
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

// Draggable header component
function DraggableHeader({
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  column: ColumnDef;
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : column.sticky ? 20 : "auto",
    ...(column.sticky && column.stickyOffset 
      ? { left: column.stickyOffset, position: "sticky" as const } 
      : {}),
  };

  const isSorted = sortBy === column.sortField;
  const canSort = !!column.sortField;

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-2 py-2 font-medium text-xs text-muted-foreground group ${
        column.sticky ? "bg-muted/50" : ""
      } ${isDragging ? "bg-muted" : ""}`}
    >
      <div className={`flex items-center gap-1 ${
        column.align === "center" ? "justify-center" : 
        column.align === "right" ? "justify-end" : "justify-start"
      }`}>
        {/* Drag handle */}
        {!column.required && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-opacity"
          >
            <GripVertical className="w-3 h-3" />
          </span>
        )}

        {/* Sort button or plain label */}
        {canSort ? (
          <button
            onClick={() => onSort(column.sortField as SortField)}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {column.sortField === "interesting_first" ? (
              <Star className={`w-3 h-3 ${isSorted ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
            ) : (
              column.label
            )}
            {isSorted ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )
            ) : column.sortField !== "interesting_first" ? (
              <ArrowUpDown className="w-3 h-3 opacity-50" />
            ) : null}
          </button>
        ) : (
          <span>{column.label}</span>
        )}

        {/* Tooltip */}
        {column.tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-left">
              {column.tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </th>
  );
}

export default function CustomizableAssetTable({ 
  assetType, 
  date, 
  onAssetClick, 
  showWatchlistColumn = true,
  initialIndustry,
  initialSector,
  initialCategory,
}: CustomizableAssetTableProps) {
  const { mutate: mutateWatchlist } = useWatchlist();
  const { tagsMap } = useAssetTags();
  
  // Get search state from context (synced with ⌘K search bar)
  const { globalSearchQuery, isCommandBarOpen, appliedFilter, clearFilter } = useSearchContext();
  const tableType = assetType === "crypto" ? "crypto" : "equity";
  const { 
    config, 
    getVisibleColumns, 
    getAvailableColumns, 
    toggleColumn, 
    reorderColumns, 
    resetToDefaults,
    isColumnVisible 
  } = useColumnConfig(tableType);
  
  const [page, setPage] = useState(0);
  const { sortBy, sortOrder, handleSort } = useSortPreferences(assetType);

  const [showFilters, setShowFilters] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Detect mobile screen and auto-switch to card view
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      setIsMobileView(isMobile);
      if (isMobile && viewMode === 'table') {
        setViewMode('cards');
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const [filterThresholds, setFilterThresholds] = useState<FilterThresholds>({});
  const [filterMode, setFilterMode] = useState<'and' | 'or'>('and');
  const [filterInputs, setFilterInputs] = useState({
    aiDirScoreMin: "",
    aiDirScoreMax: "",
    setupPurityScoreMin: "",
    setupPurityScoreMax: "",
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
    category: initialCategory || "",
    industry: initialIndustry || initialSector || "",
    setupType: "",
  });

  // Update filter inputs when initial values change (from URL navigation)
  useEffect(() => {
    if (initialIndustry || initialSector) {
      setFilterInputs(prev => ({
        ...prev,
        industry: initialIndustry || initialSector || ""
      }));
    }
    if (initialCategory) {
      setFilterInputs(prev => ({
        ...prev,
        category: initialCategory || ""
      }));
    }
  }, [initialIndustry, initialSector, initialCategory]);

  // Use global search query from the ⌘K command bar
  // When command bar is open, use live query; when closed, use the applied filter
  const effectiveSearch = isCommandBarOpen 
    ? (globalSearchQuery.length >= 1 ? globalSearchQuery : undefined)
    : (appliedFilter.length >= 1 ? appliedFilter : undefined);
  
  const { data = [], total, isLoading, isTagSorting } = useAllAssets({
    assetType,
    date,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortOrder,
    search: effectiveSearch,
    industry: assetType === "equity" && filterInputs.industry ? filterInputs.industry : undefined,
    primarySetup: filterInputs.setupType || undefined,
  });

  // When tag sorting, we have all data client-side, so calculate pages from sorted data length
  const effectiveTotal = isTagSorting ? data.length : total;
  const totalPages = Math.ceil(effectiveTotal / PAGE_SIZE);
  const visibleColumns = getVisibleColumns();
  const availableColumns = getAvailableColumns();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end for header reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = config.columnOrder.indexOf(active.id as string);
      const newIndex = config.columnOrder.indexOf(over.id as string);
      const newOrder = arrayMove(config.columnOrder, oldIndex, newIndex);
      reorderColumns(newOrder);
    }
  };

  // Filter logic
  const checkFilter = (row: any, filterKey: keyof FilterThresholds): boolean => {
    const threshold = filterThresholds[filterKey];
    if (!threshold) return true;
    
    switch (filterKey) {
      case 'aiDirScore': {
        const score = row.ai_direction_score || 0;
        if ((threshold as any).min !== undefined && score < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && score > (threshold as any).max) return false;
        return true;
      }
      case 'setupPurityScore': {
        const score = row.setup_purity_score || 0;
        if ((threshold as any).min !== undefined && score < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && score > (threshold as any).max) return false;
        return true;
      }
      case 'return1d': {
        const ret = row.return_1d || 0;
        if ((threshold as any).min !== undefined && ret < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && ret > (threshold as any).max) return false;
        return true;
      }
      case 'volume7d': {
        const vol = row.dollar_volume_7d || 0;
        if ((threshold as any).min !== undefined && vol < (threshold as any).min) return false;
        return true;
      }
      case 'marketCap': {
        const mc = row.market_cap || 0;
        if ((threshold as any).min !== undefined && mc < (threshold as any).min) return false;
        return true;
      }
      case 'peRatio': {
        const pe = row.pe_ratio;
        if (pe === null || pe === undefined) return false;
        if ((threshold as any).min !== undefined && pe < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && pe > (threshold as any).max) return false;
        return true;
      }
      case 'forwardPe': {
        const fpe = row.forward_pe;
        if (fpe === null || fpe === undefined) return false;
        if ((threshold as any).min !== undefined && fpe < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && fpe > (threshold as any).max) return false;
        return true;
      }
      case 'pegRatio': {
        const peg = row.peg_ratio;
        if (peg === null || peg === undefined) return false;
        if ((threshold as any).min !== undefined && peg < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && peg > (threshold as any).max) return false;
        return true;
      }
      case 'priceToSalesTtm': {
        const ps = row.price_to_sales_ttm;
        if (ps === null || ps === undefined) return false;
        if ((threshold as any).min !== undefined && ps < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && ps > (threshold as any).max) return false;
        return true;
      }
      case 'forwardPs': {
        const fps = row.forward_ps;
        if (fps === null || fps === undefined) return false;
        if ((threshold as any).min !== undefined && fps < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && fps > (threshold as any).max) return false;
        return true;
      }
      case 'psg': {
        const psgVal = row.psg;
        if (psgVal === null || psgVal === undefined) return false;
        if ((threshold as any).min !== undefined && psgVal < (threshold as any).min) return false;
        if ((threshold as any).max !== undefined && psgVal > (threshold as any).max) return false;
        return true;
      }
      default:
        return true;
    }
  };

  const filteredData = data.filter(row => {
    if (filterInputs.category && row.category !== filterInputs.category) {
      return false;
    }
    
    const activeFilterKeys = Object.keys(filterThresholds) as (keyof FilterThresholds)[];
    
    if (activeFilterKeys.length === 0) return true;
    
    if (filterMode === 'and') {
      return activeFilterKeys.every(key => checkFilter(row, key));
    } else {
      return activeFilterKeys.some(key => checkFilter(row, key));
    }
  });

  // Apply client-side sorting for interesting_first (since tags are stored separately)
  const sortedDataAll = sortBy === "interesting_first" 
    ? [...filteredData].sort((a: any, b: any) => {
        const aTag = tagsMap.get(a.asset_id);
        const bTag = tagsMap.get(b.asset_id);
        // Priority: interesting (0) > maybe (1) > no (2) > no tag (3)
        const tagPriority = (tag: string | undefined) => {
          if (tag === 'interesting') return 0;
          if (tag === 'maybe') return 1;
          if (tag === 'no') return 2;
          return 3;
        };
        const aPriority = tagPriority(aTag);
        const bPriority = tagPriority(bTag);
        if (aPriority !== bPriority) {
          return sortOrder === "asc" ? bPriority - aPriority : aPriority - bPriority;
        }
        // Secondary sort by ai_direction_score when tags are equal
        const aScore = a.ai_direction_score ?? -Infinity;
        const bScore = b.ai_direction_score ?? -Infinity;
        return bScore - aScore;
      })
    : filteredData;

  // Apply client-side pagination when tag sorting (since we fetched all data)
  const sortedData = isTagSorting 
    ? sortedDataAll.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : sortedDataAll;

  const onSort = (field: SortField) => {
    handleSort(field);
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
    if (filterInputs.setupPurityScoreMin || filterInputs.setupPurityScoreMax) {
      newThresholds.setupPurityScore = {
        min: filterInputs.setupPurityScoreMin ? parseFloat(filterInputs.setupPurityScoreMin) : undefined,
        max: filterInputs.setupPurityScoreMax ? parseFloat(filterInputs.setupPurityScoreMax) : undefined,
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
      setupPurityScoreMin: "",
      setupPurityScoreMax: "",
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
      setupType: "",
    });
    setPage(0);
  };

  const hasActiveFilters = Object.keys(filterThresholds).length > 0 || filterInputs.category !== "" || filterInputs.industry !== "" || filterInputs.setupType !== "";

  // Format helpers
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

  // Render cell content based on column ID
  const renderCell = (row: any, columnId: string) => {
    switch (columnId) {
      case "actions":
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <AssetTagButton assetId={row.asset_id} onUpdate={() => mutateWatchlist()} />
            <AddToPortfolioButton assetId={row.asset_id} assetType={row.asset_type} />
            <AddToListButton assetId={row.asset_id} />
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`/chat?asset_id=${row.asset_id}&symbol=${encodeURIComponent(row.symbol || '')}&name=${encodeURIComponent(row.name || '')}&asset_type=${row.asset_type || 'equity'}`}
                  className="p-1 rounded hover:bg-primary/20 transition-colors text-muted-foreground hover:text-primary"
                >
                  <Activity className="w-3.5 h-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Research chat</TooltipContent>
            </Tooltip>
          </div>
        );
      case "asset":
        return (
          <div className="flex flex-col">
            <span className="font-mono font-medium text-foreground">{row.symbol}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">{row.name}</span>
          </div>
        );
      case "direction":
        return (
          <div className="flex items-center justify-center gap-1">
            {getDirectionIcon(row.ai_direction_score > 0 ? "bullish" : row.ai_direction_score < 0 ? "bearish" : "neutral")}
            <span className={`font-mono text-xs ${
              row.ai_direction_score > 0 ? "text-signal-bullish" : 
              row.ai_direction_score < 0 ? "text-signal-bearish" : "text-muted-foreground"
            }`}>
              {row.ai_direction_score != null ? (row.ai_direction_score > 0 ? "+" : "") + row.ai_direction_score : "-"}
            </span>
          </div>
        );
      case "primary_setup": {
        const setupDef = getSetupDefinition(row.primary_setup);
        if (!setupDef) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <span 
                className="text-xs font-medium"
                style={{ color: setupDef.color }}
              >
                {setupDef.shortName}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1.5">
                <div className="font-semibold text-sm" style={{ color: setupDef.color }}>
                  {setupDef.fullName}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {setupDef.description}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "setup_purity_score": {
        const purity = getPurityInterpretation(row.setup_purity_score);
        if (row.setup_purity_score == null) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-1.5 cursor-help">
              <span 
                className="font-mono text-xs font-medium"
                style={{ color: purity.color }}
              >
                {row.setup_purity_score.toFixed(0)}
              </span>
              <span 
                className="text-[10px] px-1 py-0.5 rounded"
                style={{ 
                  backgroundColor: `${purity.color}20`,
                  color: purity.color 
                }}
              >
                {purity.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <div className="font-semibold text-sm" style={{ color: purity.color }}>
                  {purity.label} Setup ({row.setup_purity_score}%)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {purity.description}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      }
      case "fvs_score":
        return (
          <span className={`font-mono text-xs ${
            row.fvs_score >= 80 ? "text-emerald-400" :
            row.fvs_score >= 60 ? "text-blue-400" :
            row.fvs_score >= 40 ? "text-yellow-400" :
            row.fvs_score >= 20 ? "text-orange-400" : "text-red-400"
          }`}>
            {row.fvs_score != null ? row.fvs_score.toFixed(0) : "-"}
          </span>
        );
      case "market_cap":
        return <span className="font-mono text-xs">{formatMarketCap(row.market_cap)}</span>;
      case "price":
        return <span className="font-mono text-xs">${formatPrice(row.close)}</span>;
      case "return_1d":
        return <span className="font-mono text-xs">{formatPercent(row.return_1d)}</span>;
      case "return_7d":
        return <span className="font-mono text-xs">{formatPercent(row.return_7d)}</span>;
      case "return_30d":
        return <span className="font-mono text-xs">{formatPercent(row.return_30d)}</span>;
      case "return_365d":
        return <span className="font-mono text-xs">{formatPercent(row.return_365d)}</span>;
      case "volume_7d":
        return <span className="font-mono text-xs text-muted-foreground">{formatVolume(row.dollar_volume_7d)}</span>;
      case "volume_30d":
        return <span className="font-mono text-xs text-muted-foreground">{formatVolume(row.dollar_volume_30d)}</span>;
      case "pe_ratio":
        return <span className="font-mono text-xs text-muted-foreground">{row.pe_ratio ? row.pe_ratio.toFixed(1) : "-"}</span>;
      case "forward_pe":
        return <span className="font-mono text-xs text-muted-foreground">{row.forward_pe ? row.forward_pe.toFixed(1) : "-"}</span>;
      case "peg_ratio":
        return <span className="font-mono text-xs text-muted-foreground">{row.peg_ratio ? row.peg_ratio.toFixed(2) : "-"}</span>;
      case "price_to_sales":
        return <span className="font-mono text-xs text-muted-foreground">{row.price_to_sales_ttm ? row.price_to_sales_ttm.toFixed(2) : "-"}</span>;
      case "forward_ps":
        return <span className="font-mono text-xs text-muted-foreground">{row.forward_ps ? row.forward_ps.toFixed(2) : "-"}</span>;
      case "psg":
        return <span className="font-mono text-xs text-muted-foreground">{row.psg ? row.psg.toFixed(2) : "-"}</span>;
      case "revenue_growth_yoy":
        return (
          <span className={`font-mono text-xs ${
            row.revenue_growth_yoy > 0 ? "text-signal-bullish" : 
            row.revenue_growth_yoy < 0 ? "text-signal-bearish" : "text-muted-foreground"
          }`}>
            {row.revenue_growth_yoy != null ? formatPercent(row.revenue_growth_yoy) : "-"}
          </span>
        );
      case "category":
        return <span className="text-xs text-muted-foreground truncate max-w-[80px]">{row.category || row.industry || row.sector || "-"}</span>;
      case "description":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate block max-w-[150px] cursor-help text-xs text-muted-foreground">
                {row.short_description ? row.short_description.substring(0, 50) + (row.short_description.length > 50 ? "..." : "") : "-"}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md text-left">
              {row.short_description || "No description available"}
            </TooltipContent>
          </Tooltip>
        );
      case "notes":
        return <NoteCell assetId={row.asset_id} />;
      default:
        return "-";
    }
  };

  const colCount = visibleColumns.length;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-[800px] bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            All {assetType === "crypto" ? "Crypto" : "Equity"} Assets
            <span className="text-xs text-muted-foreground ml-2">({isTagSorting ? sortedDataAll.length : sortedData.length} / {total} total)</span>
          </h3>
          
          {/* Column customizer - hidden on mobile */}
          <div className="hidden md:block">
            <ColumnCustomizer
              availableColumns={availableColumns}
              visibleColumnIds={config.visibleColumns}
              columnOrder={config.columnOrder}
              onToggleColumn={toggleColumn}
              onReorderColumns={reorderColumns}
              onReset={resetToDefaults}
            />
          </div>
          
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5 flex items-center justify-center ${
                viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5 flex items-center justify-center ${
                viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-muted/20 text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Table view"
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Show active search indicator when global search is filtering */}
          {effectiveSearch && (
            <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 border border-primary/30 rounded text-xs text-primary">
              <span>Filtering: "{effectiveSearch}"</span>
              <span className="text-muted-foreground">({total} results)</span>
              <button
                onClick={clearFilter}
                className="ml-1 p-0.5 hover:bg-primary/20 rounded transition-colors"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
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
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="p-3 bg-muted/20 rounded-lg border border-border space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* AI Direction Score */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">AI Dir Score</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="Min" value={filterInputs.aiDirScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMin: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                  <input type="number" placeholder="Max" value={filterInputs.aiDirScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, aiDirScoreMax: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                </div>
              </div>
              {/* Setup Purity Score */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Purity</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="Min" value={filterInputs.setupPurityScoreMin}
                    onChange={(e) => setFilterInputs({...filterInputs, setupPurityScoreMin: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                  <input type="number" placeholder="Max" value={filterInputs.setupPurityScoreMax}
                    onChange={(e) => setFilterInputs({...filterInputs, setupPurityScoreMax: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                </div>
              </div>
              {/* 24h Return */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">24h Return %</label>
                <div className="flex gap-1">
                  <input type="number" placeholder="Min" value={filterInputs.return1dMin}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMin: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                  <input type="number" placeholder="Max" value={filterInputs.return1dMax}
                    onChange={(e) => setFilterInputs({...filterInputs, return1dMax: e.target.value})}
                    className="w-1/2 min-w-0 text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
                </div>
              </div>
              {/* Volume 7d */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Vol 7d (M)</label>
                <input type="number" placeholder="Min" value={filterInputs.volume7dMin}
                  onChange={(e) => setFilterInputs({...filterInputs, volume7dMin: e.target.value})}
                  className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
              </div>
              {/* Market Cap */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Mkt Cap (B)</label>
                <input type="number" placeholder="Min" value={filterInputs.marketCapMin}
                  onChange={(e) => setFilterInputs({...filterInputs, marketCapMin: e.target.value})}
                  className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none" />
              </div>
              {/* Setup Type */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Setup Type</label>
                <select value={filterInputs.setupType}
                  onChange={(e) => {
                    setFilterInputs({...filterInputs, setupType: e.target.value});
                    setPage(0);
                  }}
                  className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none">
                  <option value="">All Setups</option>
                  {Object.values(SETUP_DEFINITIONS).map(setup => (
                    <option key={setup.id} value={setup.id}>{setup.shortName}</option>
                  ))}
                </select>
              </div>
              {/* Category/Industry */}
              {assetType === "crypto" ? (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Category</label>
                  <select value={filterInputs.category}
                    onChange={(e) => setFilterInputs({...filterInputs, category: e.target.value})}
                    className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none">
                    <option value="">All</option>
                    {CRYPTO_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Industry</label>
                  <select value={filterInputs.industry}
                    onChange={(e) => setFilterInputs({...filterInputs, industry: e.target.value})}
                    className="w-full text-[10px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none">
                    <option value="">All</option>
                    {EQUITY_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
              )}
              {/* Equity-specific filters */}
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
            <div className="flex items-center gap-3 pt-2">
              {/* AND/OR Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Filter Mode:</span>
                <div className="flex items-center bg-muted/30 rounded-md p-0.5">
                  <button
                    type="button"
                    onClick={() => setFilterMode('and')}
                    className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                      filterMode === 'and'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    AND
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('or')}
                    className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                      filterMode === 'or'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    OR
                  </button>
                </div>
                <span className="text-[9px] text-muted-foreground">
                  {filterMode === 'and' ? 'Match all filters' : 'Match any filter'}
                </span>
              </div>
              
              <div className="flex gap-2 ml-auto">
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
          </div>
        )}
      </div>

      {/* Card View for Mobile */}
      {viewMode === 'cards' ? (
        <div className="flex-1 overflow-y-auto">
          <MobileAssetList
            assets={sortedData.map(row => ({
              asset_id: row.asset_id,
              symbol: row.symbol,
              name: row.name,
              close_price: row.close,
              return_1d: row.return_1d ? row.return_1d * 100 : undefined,
              return_7d: row.return_7d ? row.return_7d * 100 : undefined,
              market_cap: row.market_cap,
              ai_direction_score: row.ai_direction_score,
              ai_setup_quality_score: row.ai_setup_quality_score,
              ai_direction: row.ai_direction_score > 0 ? 'Bullish' : row.ai_direction_score < 0 ? 'Bearish' : 'Neutral',
              is_watchlisted: row.is_watchlisted,
            }))}
            onAssetClick={onAssetClick}
            onWatchlistToggle={showWatchlistColumn ? (assetId) => {
              // Toggle watchlist - this would need to be implemented
              mutateWatchlist();
            } : undefined}
            showWatchlist={showWatchlistColumn}
            isLoading={isLoading}
          />
        </div>
      ) : (
        /* Table View */
        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full text-sm text-left min-w-[1200px]">
              <thead className="sticky top-0 z-40 bg-table-header border-b border-border text-xs text-muted-foreground">
                <SortableContext
                  items={visibleColumns.map(c => c.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <tr>
                    {visibleColumns.map((column) => (
                      <DraggableHeader
                        key={column.id}
                        column={column}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={onSort}
                      />
                    ))}
                  </tr>
                </SortableContext>
              </thead>
              <tbody>
                {/* Summary Rows */}
                {!isLoading && sortedData.length > 0 && (
                  <TableSummaryRows assets={isTagSorting ? sortedDataAll : sortedData} visibleColumns={visibleColumns} listName={assetType === 'crypto' ? 'Crypto' : 'Equities'} />
                )}
                {isLoading ? (
                  <tr><td colSpan={colCount} className="px-2 py-4 text-center text-muted-foreground">Loading...</td></tr>
                ) : sortedData.length === 0 ? (
                  <tr><td colSpan={colCount} className="px-2 py-4 text-center text-muted-foreground">No assets match your filters</td></tr>
                ) : (
                  sortedData.map((row) => (
                    <tr 
                      key={row.asset_id} 
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer" 
                      onClick={() => onAssetClick(row.asset_id)}
                    >
                      {visibleColumns.map((column) => (
                        <td 
                          key={column.id} 
                          className={`px-2 py-2 ${
                            column.align === "center" ? "text-center" : 
                            column.align === "right" ? "text-right" : "text-left"
                          } ${column.sticky ? "sticky bg-background z-10" : ""}`}
                          style={column.sticky && column.stickyOffset ? { left: column.stickyOffset } : undefined}
                        >
                          {renderCell(row, column.id)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DndContext>
        </div>
      )}

      {/* Pagination */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between bg-muted/20">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {totalPages} | {isTagSorting ? sortedDataAll.length : sortedData.length} results
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

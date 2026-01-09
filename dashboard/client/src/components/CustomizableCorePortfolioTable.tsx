// Customizable Watchlist Table with drag-and-drop column reordering and show/hide
import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, Info, X, GripVertical, Activity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NoteCell } from "@/components/NoteCell";
import TableSummaryRows from "@/components/TableSummaryRows";
import AddToListButton from "@/components/AddToListButton";
import AssetTagButton from "@/components/AssetTagButton";
import AssetSearchDropdown from "@/components/AssetSearchDropdown";
import ColumnCustomizer from "@/components/ColumnCustomizer";
import { useCorePortfolioAssets, useCorePortfolio } from "@/hooks/useCorePortfolio";
import AddToPortfolioButton from "@/components/AddToPortfolioButton";
import { useColumnConfig, ColumnDef } from "@/hooks/useColumnConfig";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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

interface CustomizableCorePortfolioTableProps {
  onAssetClick: (assetId: string) => void;
}

type SortField = "symbol" | "ai_direction_score" | "ai_setup_quality_score" | "market_cap" | "close" | "return_1d" | "return_7d" | "return_30d" | "return_365d" | "dollar_volume_7d" | "dollar_volume_30d" | "pe_ratio" | "forward_pe" | "peg_ratio" | "price_to_sales_ttm" | "forward_ps" | "psg";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 50;

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
            {column.label}
            {isSorted ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-50" />
            )}
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

export default function CustomizableCorePortfolioTable({ onAssetClick }: CustomizableCorePortfolioTableProps) {
  const { assets, isLoading, mutate: mutateAssets } = useCorePortfolioAssets();
  const { addToCorePortfolio, mutate: mutatePortfolio } = useCorePortfolio();
  const { 
    config, 
    getVisibleColumns, 
    getAvailableColumns, 
    toggleColumn, 
    reorderColumns, 
    resetToDefaults 
  } = useColumnConfig("stocklist");
  
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("ai_direction_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Ensure assets is always an array for safety
  const safeAssets = Array.isArray(assets) ? assets : [];

  // Compute existing asset IDs for the search dropdown
  const existingAssetIds = useMemo(() => {
    return new Set<number>(safeAssets.map((a: any) => a.asset_id as number));
  }, [safeAssets]);

  // Handle adding asset from search dropdown
  const handleAddAsset = async (assetId: number) => {
    await addToCorePortfolio(assetId);
    mutateAssets();
  };

  // Sort assets
  const sortedAssets = [...safeAssets].sort((a: any, b: any) => {
    const aVal = a[sortBy] ?? (sortOrder === "asc" ? Infinity : -Infinity);
    const bVal = b[sortBy] ?? (sortOrder === "asc" ? Infinity : -Infinity);
    if (sortOrder === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const paginatedAssets = sortedAssets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const total = safeAssets.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

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

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  // Format helpers
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

  // Render cell content based on column ID
  const renderCell = (row: any, columnId: string) => {
    switch (columnId) {
      case "actions":
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <AssetTagButton assetId={row.asset_id} onUpdate={() => mutatePortfolio()} />
            <AddToPortfolioButton assetId={row.asset_id} assetType={row.asset_type} onUpdate={() => mutateAssets()} />
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
            {getDirectionIcon(row.ai_direction_score)}
            <span className={`font-mono text-xs ${
              row.ai_direction_score > 0 ? "text-signal-bullish" : 
              row.ai_direction_score < 0 ? "text-signal-bearish" : "text-muted-foreground"
            }`}>
              {row.ai_direction_score != null ? (row.ai_direction_score > 0 ? "+" : "") + row.ai_direction_score : "-"}
            </span>
          </div>
        );
      case "quality":
        return (
          <span className={`font-mono text-xs ${
            row.ai_setup_quality_score >= 70 ? "text-signal-bullish" :
            row.ai_setup_quality_score >= 40 ? "text-yellow-400" : "text-muted-foreground"
          }`}>
            {row.ai_setup_quality_score ?? "-"}
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
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          Core Portfolio
          <span className="text-xs text-muted-foreground">({total} assets)</span>
        </h3>
        <div className="flex items-center gap-2">
          <AssetSearchDropdown
            existingAssetIds={existingAssetIds}
            onAddAsset={handleAddAsset}
            placeholder="Search to add..."
          />
          <ColumnCustomizer
            availableColumns={availableColumns}
            visibleColumnIds={config.visibleColumns}
            columnOrder={config.columnOrder}
            onToggleColumn={toggleColumn}
            onReorderColumns={reorderColumns}
            onReset={resetToDefaults}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-thin">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <table className="w-full text-sm text-left min-w-[1200px]">
            <thead className="sticky top-0 z-40 bg-[#0a0a0c] border-b border-border text-xs text-muted-foreground">
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
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </SortableContext>
            </thead>
            <tbody>
              {/* Summary Rows */}
              {!isLoading && safeAssets.length > 0 && (
                <TableSummaryRows assets={safeAssets} visibleColumns={visibleColumns} listName="Core Portfolio" />
              )}
              {isLoading ? (
                <tr><td colSpan={colCount} className="px-2 py-4 text-center text-muted-foreground">Loading...</td></tr>
              ) : paginatedAssets.length === 0 ? (
                <tr><td colSpan={colCount} className="px-2 py-4 text-center text-muted-foreground">
                  Core portfolio is empty. Use the search above to add assets.
                </td></tr>
              ) : (
                paginatedAssets.map((row: any) => (
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

      {/* Pagination */}
      <div className="border-t border-border px-3 py-2 flex items-center justify-between bg-muted/20">
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of {Math.max(1, totalPages)} | {total} assets
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

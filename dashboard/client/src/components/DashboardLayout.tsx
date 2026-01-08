import { ReactNode, useState } from "react";
import useSWR from "swr";
import { Activity, BookOpen, Settings, Search, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StockList } from "@/hooks/useStockLists";
import { TabType } from "@/pages/Home";
import CreateListButton from "@/components/CreateListButton";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  stockLists?: StockList[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onListCreated?: () => void;
  onListsReordered?: (lists: StockList[]) => void;
}

// Sortable list item component
function SortableListTab({ 
  list, 
  activeTab, 
  onTabChange 
}: { 
  list: StockList; 
  activeTab: TabType; 
  onTabChange: (tab: TabType) => void;
}) {
  const tabId = `list-${list.id}` as TabType;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onTabChange(tabId)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 group ${
              activeTab === tabId
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {/* Drag handle - only visible on hover */}
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity -ml-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-3 h-3" />
            </span>
            <span 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: list.color }}
            />
            {list.name}
          </button>
        </TooltipTrigger>
        <TooltipContent>{list.description}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function DashboardLayout({ 
  children, 
  activeTab, 
  onTabChange, 
  stockLists = [],
  searchQuery = "",
  onSearchChange,
  onListCreated,
  onListsReordered
}: DashboardLayoutProps) {
  const { data: health } = useSWR("/api/dashboard/health", fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stockLists.findIndex((list) => list.id === active.id);
      const newIndex = stockLists.findIndex((list) => list.id === over.id);
      
      const newOrder = arrayMove(stockLists, oldIndex, newIndex);
      
      // Optimistically update the UI
      if (onListsReordered) {
        onListsReordered(newOrder);
      }
      
      // Persist to backend
      try {
        await fetch("/api/dashboard/stock-lists/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            list_ids: newOrder.map((list) => list.id),
          }),
        });
      } catch (error) {
        console.error("Failed to save list order:", error);
        // Could revert here if needed
      }
    }
  };

  // Format date to be more compact (e.g., "Jan 7" instead of "2026-01-07")
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "...";
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Status Bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container h-12 flex items-center justify-between">
          {/* Left: Logo + Data Status */}
          <div className="flex items-center gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-base font-bold tracking-tight flex items-center gap-1.5 cursor-help">
                  <Activity className="w-4 h-4 text-primary" />
                  STRATOS<span className="text-muted-foreground font-normal">BRAIN</span>
                </h1>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                AI-powered technical analysis dashboard for crypto and equity markets.
              </TooltipContent>
            </Tooltip>
            
            {/* Data Status - 2 row layout */}
            <div className="flex flex-col gap-0.5 text-[10px] font-mono text-muted-foreground/70">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground/50">Crypto:</span>
                <span>{formatDate(health?.latest_dates?.crypto)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground/50">Equity:</span>
                <span>{formatDate(health?.latest_dates?.equity)}</span>
              </div>
            </div>
          </div>

          {/* Center: Navigation Tabs */}
          <nav className="flex items-center">
            <div className="flex items-center bg-muted/30 p-0.5 rounded-lg gap-0.5">
              {/* Watchlist - Fixed */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("watchlist")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                      activeTab === "watchlist"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    Watchlist
                  </button>
                </TooltipTrigger>
                <TooltipContent>Your personal watchlist</TooltipContent>
              </Tooltip>
              
              <div className="h-3 w-px bg-border/50 mx-0.5" />
              
              {/* Equities - Fixed */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("equity")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                      activeTab === "equity"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    Equities
                  </button>
                </TooltipTrigger>
                <TooltipContent>US equity stocks</TooltipContent>
              </Tooltip>
              
              {/* Crypto - Fixed */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange("crypto")}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                      activeTab === "crypto"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    Crypto
                  </button>
                </TooltipTrigger>
                <TooltipContent>Cryptocurrency assets (24/7 data)</TooltipContent>
              </Tooltip>
              
              {/* Stock Lists - Draggable */}
              {stockLists.length > 0 && <div className="h-3 w-px bg-border/50 mx-0.5" />}
              
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stockLists.map((list) => list.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex items-center gap-0.5">
                    {stockLists.map((list) => (
                      <SortableListTab
                        key={list.id}
                        list={list}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              
              {/* Create new list button */}
              {onListCreated && <CreateListButton onListCreated={onListCreated} />}
            </div>
          </nav>

          {/* Right: Search + Links */}
          <div className="flex items-center gap-2">
            {/* Global Search */}
            {onSearchChange && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-32 pl-7 pr-2 py-1 text-xs bg-muted/30 border border-border/50 rounded focus:outline-none focus:ring-1 focus:ring-primary focus:w-48 transition-all"
                />
              </div>
            )}
            
            <div className="h-3 w-px bg-border/50" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/docs"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Documentation</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/admin/templates"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all"
                >
                  <Settings className="w-3.5 h-3.5" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Template Editor</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-4">
        {children}
      </main>
    </div>
  );
}

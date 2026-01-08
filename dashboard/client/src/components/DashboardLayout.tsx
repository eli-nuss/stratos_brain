import { ReactNode, useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Activity, BookOpen, Settings, Search, GripVertical, Pencil, Trash2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StockList } from "@/hooks/useStockLists";
import { TabType } from "@/pages/Home";
import CreateListButton from "@/components/CreateListButton";
import { createPortal } from "react-dom";
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
  onListDeleted?: () => void;
  onListRenamed?: () => void;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  list: StockList | null;
}

interface RenameModalState {
  isOpen: boolean;
  list: StockList | null;
  newName: string;
}

// Sortable list item component with context menu
function SortableListTab({ 
  list, 
  activeTab, 
  onTabChange,
  onContextMenu,
  showDivider
}: { 
  list: StockList; 
  activeTab: TabType; 
  onTabChange: (tab: TabType) => void;
  onContextMenu: (e: React.MouseEvent, list: StockList) => void;
  showDivider?: boolean;
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
      {showDivider && <div className="h-3 w-px bg-border/50 mx-1" />}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onTabChange(tabId)}
            onContextMenu={(e) => onContextMenu(e, list)}
            className={`px-2 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 group ${
              activeTab === tabId
                ? "bg-muted text-foreground"
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
            {list.name}
          </button>
        </TooltipTrigger>
        <TooltipContent>Right-click for options</TooltipContent>
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
  onListsReordered,
  onListDeleted,
  onListRenamed
}: DashboardLayoutProps) {
  const { data: health } = useSWR("/api/dashboard/health", fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    list: null
  });
  
  // Rename modal state
  const [renameModal, setRenameModal] = useState<RenameModalState>({
    isOpen: false,
    list: null,
    newName: ""
  });
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showAllLists, setShowAllLists] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    };
    
    if (contextMenu.isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu.isOpen]);

  // Focus rename input when modal opens
  useEffect(() => {
    if (renameModal.isOpen && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameModal.isOpen]);

  const handleContextMenu = (e: React.MouseEvent, list: StockList) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      list
    });
  };

  const handleRename = () => {
    if (contextMenu.list) {
      setRenameModal({
        isOpen: true,
        list: contextMenu.list,
        newName: contextMenu.list.name
      });
    }
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const handleRenameSubmit = async () => {
    if (!renameModal.list || !renameModal.newName.trim()) return;
    
    setIsRenaming(true);
    try {
      await fetch(`/api/dashboard/stock-lists/${renameModal.list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameModal.newName.trim() })
      });
      
      if (onListRenamed) {
        onListRenamed();
      }
      
      setRenameModal({ isOpen: false, list: null, newName: "" });
    } catch (error) {
      console.error("Failed to rename list:", error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu.list) return;
    
    const listToDelete = contextMenu.list;
    setContextMenu(prev => ({ ...prev, isOpen: false }));
    
    if (!confirm(`Are you sure you want to delete "${listToDelete.name}"? This cannot be undone.`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      await fetch(`/api/dashboard/stock-lists/${listToDelete.id}`, {
        method: "DELETE"
      });
      
      // Switch to watchlist if we deleted the active tab
      if (activeTab === `list-${listToDelete.id}`) {
        onTabChange("watchlist");
      }
      
      if (onListDeleted) {
        onListDeleted();
      }
    } catch (error) {
      console.error("Failed to delete list:", error);
    } finally {
      setIsDeleting(false);
    }
  };

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
      }
    }
  };

  // Format date to be more compact (e.g., "Jan 7" instead of "2026-01-07")
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "...";
    try {
      const date = new Date(dateStr + "T00:00:00");
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}-${day}-${year}`;
    } catch {
      return dateStr;
    }
  };

  // Context menu portal
  const contextMenuPortal = contextMenu.isOpen && createPortal(
    <div
      ref={contextMenuRef}
      className="fixed bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px] z-[9999]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        onClick={handleRename}
        className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-muted/50 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
        Rename
      </button>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-muted/50 transition-colors text-destructive"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </div>,
    document.body
  );

  // Rename modal portal
  const renameModalPortal = renameModal.isOpen && createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-popover border border-border rounded-lg shadow-xl p-4 w-80">
        <h3 className="text-sm font-medium mb-3">Rename List</h3>
        <input
          ref={renameInputRef}
          type="text"
          value={renameModal.newName}
          onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setRenameModal({ isOpen: false, list: null, newName: "" });
          }}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="List name"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setRenameModal({ isOpen: false, list: null, newName: "" })}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRenameSubmit}
            disabled={isRenaming || !renameModal.newName.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRenaming ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        {/* Row 1: Logo, Data Status, Search, Page Links */}
        <div className="container py-2 flex items-start justify-between">
          {/* Left: Logo + Data Status stacked vertically */}
          <div className="flex flex-col">
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 cursor-help">
                    <Activity className="w-8 h-8 text-primary" />
                    <span className="hidden sm:inline">STRATOS</span>
                    <span className="sm:hidden">S</span>
                    <span className="text-muted-foreground font-normal hidden sm:inline">BRAIN</span>
                    <span className="text-muted-foreground font-normal sm:hidden">B</span>
                  </h1>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  AI-powered technical analysis dashboard for crypto and equity markets.
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* Data Status - directly under logo with more spacing */}
            <div className="hidden md:flex flex-col text-[10px] font-mono text-muted-foreground mt-2 pl-10 gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/70">Equities Last Updated:</span>
                <span className="font-medium text-blue-400">{formatDate(health?.latest_dates?.equity)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/70">Crypto Last Updated:</span>
                <span className="font-medium text-blue-400">{formatDate(health?.latest_dates?.crypto)}</span>
              </div>
            </div>
          </div>
          
          {/* Right: Search + Page Links */}
          <div className="flex items-center gap-2">
            {/* Global Search - hidden on small mobile */}
            {onSearchChange && (
              <div className="relative hidden sm:block">
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
            
            <div className="h-3 w-px bg-border/50 hidden sm:block" />
            
            <a
              href="/memos"
              className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all"
            >
              Memos
            </a>
            
            <a
              href="/docs"
              className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all"
            >
              Docs
            </a>
            
            <a
              href="/admin/templates"
              className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all hidden sm:block"
            >
              Templates
            </a>
          </div>
        </div>
        
        {/* Row 2: Navigation - centered below, scrollable on mobile */}
        <div className="container pb-2 flex flex-col items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {/* Fixed views - highlighted with primary color */}
          <div className="flex items-center bg-primary/10 border border-primary/20 p-0.5 rounded-lg gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTabChange("watchlist")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                    activeTab === "watchlist"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-primary/70 hover:text-primary hover:bg-primary/20"
                  }`}
                >
                  Watchlist
                </button>
              </TooltipTrigger>
              <TooltipContent>Your personal watchlist</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTabChange("equity")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                    activeTab === "equity"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-primary/70 hover:text-primary hover:bg-primary/20"
                  }`}
                >
                  Equities
                </button>
              </TooltipTrigger>
              <TooltipContent>US equity stocks</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTabChange("crypto")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                    activeTab === "crypto"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-primary/70 hover:text-primary hover:bg-primary/20"
                  }`}
                >
                  Crypto
                </button>
              </TooltipTrigger>
              <TooltipContent>Cryptocurrency assets (24/7 data)</TooltipContent>
            </Tooltip>
          </div>
          
          {/* Custom lists - centered, max 5 visible collapsed, rows of 9 when expanded */}
          {(stockLists.length > 0 || onListCreated) && (
            <div className="flex flex-col items-center gap-1 w-full">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stockLists.map((list) => list.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {showAllLists ? (
                    // Expanded view: show all lists in rows of 9
                    <div className="flex flex-col items-center gap-1">
                      {Array.from({ length: Math.ceil(stockLists.length / 9) }, (_, rowIndex) => (
                        <div key={rowIndex} className="flex items-center justify-center">
                          {stockLists.slice(rowIndex * 9, (rowIndex + 1) * 9).map((list, index) => (
                            <SortableListTab
                              key={list.id}
                              list={list}
                              activeTab={activeTab}
                              onTabChange={onTabChange}
                              onContextMenu={handleContextMenu}
                              showDivider={index > 0}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Collapsed view: show first 5 lists
                    <div className="flex items-center">
                      {stockLists.slice(0, 5).map((list, index) => (
                        <SortableListTab
                          key={list.id}
                          list={list}
                          activeTab={activeTab}
                          onTabChange={onTabChange}
                          onContextMenu={handleContextMenu}
                          showDivider={index > 0}
                        />
                      ))}
                    </div>
                  )}
                </SortableContext>
              </DndContext>
              
              {/* Show more/less button and Create button row */}
              <div className="flex items-center gap-1">
                {stockLists.length > 5 && (
                  <button
                    onClick={() => setShowAllLists(!showAllLists)}
                    className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-all flex items-center gap-0.5"
                  >
                    {showAllLists ? (
                      <><ChevronUp className="w-3 h-3" /> Less</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" /> +{stockLists.length - 5}</>
                    )}
                  </button>
                )}
                
                {/* Create new list button */}
                {onListCreated && <CreateListButton onListCreated={onListCreated} />}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-4">
        {children}
      </main>

      {/* Portals */}
      {contextMenuPortal}
      {renameModalPortal}
    </div>
  );
}

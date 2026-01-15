import { useState, useRef, useEffect } from 'react';
import { Search, GripVertical, Pencil, Trash2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentedControl } from './SegmentedControl';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StockList } from '@/hooks/useStockLists';
import { TabType } from '@/pages/Home';
import CreateListButton from '@/components/CreateListButton';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';



interface ListSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  stockLists: StockList[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onListCreated?: () => void;
  onListsReordered?: (lists: StockList[]) => void;
  onListDeleted?: () => void;
  onListRenamed?: () => void;
  className?: string;
}

// Sortable list item component
function SortableListItem({ 
  list, 
  activeTab, 
  onTabChange,
  onContextMenu,
}: { 
  list: StockList; 
  activeTab: TabType; 
  onTabChange: (tab: TabType) => void;
  onContextMenu: (e: React.MouseEvent, list: StockList) => void;
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
    <div 
      ref={setNodeRef} 
      style={style}
      onClick={() => onTabChange(tabId)}
      onContextMenu={(e) => onContextMenu(e, list)}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group',
        activeTab === tabId
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </span>
      <span className="text-xs font-medium truncate flex-1">{list.name}</span>
    </div>
  );
}

export function ListSidebar({
  activeTab,
  onTabChange,
  stockLists,
  searchQuery,
  onSearchChange,
  onListCreated,
  onListsReordered,
  onListDeleted,
  onListRenamed,
  className = '',
}: ListSidebarProps) {

  const [showAllLists, setShowAllLists] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    list: StockList | null;
  }>({ isOpen: false, x: 0, y: 0, list: null });
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean;
    list: StockList | null;
    newName: string;
  }>({ isOpen: false, list: null, newName: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Get main view type
  const getMainView = (): 'watchlist' | 'model' | 'core' => {
    if (activeTab === 'model-portfolio') return 'model';
    if (activeTab === 'core-portfolio') return 'core';
    return 'watchlist';
  };

  const handleMainViewChange = (view: string) => {
    if (view === 'model') onTabChange('model-portfolio');
    else if (view === 'core') onTabChange('core-portfolio');
    else onTabChange('watchlist');
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
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
      
      if (onListsReordered) {
        onListsReordered(newOrder);
      }
      
      try {
        await fetch('/api/dashboard/stock-lists/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ list_ids: newOrder.map((list) => list.id) }),
        });
      } catch (error) {
        console.error('Failed to save list order:', error);
      }
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, list: StockList) => {
    e.preventDefault();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, list });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      }
    };
    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.isOpen]);

  useEffect(() => {
    if (renameModal.isOpen && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameModal.isOpen]);

  const handleRename = () => {
    if (contextMenu.list) {
      setRenameModal({
        isOpen: true,
        list: contextMenu.list,
        newName: contextMenu.list.name,
      });
    }
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  };

  const handleRenameSubmit = async () => {
    if (!renameModal.list || !renameModal.newName.trim()) return;
    setIsRenaming(true);
    try {
      await fetch(`/api/dashboard/stock-lists/${renameModal.list.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameModal.newName.trim() }),
      });
      if (onListRenamed) onListRenamed();
      setRenameModal({ isOpen: false, list: null, newName: '' });
    } catch (error) {
      console.error('Failed to rename list:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu.list) return;
    const listToDelete = contextMenu.list;
    setContextMenu(prev => ({ ...prev, isOpen: false }));
    
    if (!confirm(`Are you sure you want to delete "${listToDelete.name}"?`)) return;
    
    setIsDeleting(true);
    try {
      await fetch(`/api/dashboard/stock-lists/${listToDelete.id}`, { method: 'DELETE' });
      if (activeTab === `list-${listToDelete.id}`) {
        onTabChange('watchlist');
      }
      if (onListDeleted) onListDeleted();
    } catch (error) {
      console.error('Failed to delete list:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const visibleLists = showAllLists ? stockLists : stockLists.slice(0, 20);

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
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>,
    document.body
  );

  // Rename modal portal
  const renameModalPortal = renameModal.isOpen && createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={(e) => e.target === e.currentTarget && setRenameModal({ isOpen: false, list: null, newName: '' })}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl p-4 w-80">
        <h3 className="text-sm font-semibold mb-3">Rename List</h3>
        <input
          ref={renameInputRef}
          type="text"
          value={renameModal.newName}
          onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
          className="w-full px-3 py-2 text-sm bg-muted/30 border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="List name"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setRenameModal({ isOpen: false, list: null, newName: '' })}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleRenameSubmit}
            disabled={isRenaming}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isRenaming ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div className={cn('flex flex-col h-full bg-card/50 border-r border-border', className)}>
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ticker..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Portfolio Selector - Portfolio (Core) on left, Model on right */}
      <div className="p-3 border-b border-border">
        <SegmentedControl
          segments={[
            { id: 'core', label: 'Active Portfolio' },
            { id: 'model', label: 'Model Portfolio' },
          ]}
          value={getMainView() === 'core' ? 'core' : getMainView() === 'model' ? 'model' : ''}
          onChange={handleMainViewChange}
        />
      </div>

      {/* Asset Type Tabs - Watchlist, Equities, Crypto */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange('watchlist')}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'watchlist'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Watchlist
          </button>
          <button
            onClick={() => onTabChange('equity')}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'equity'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Equities
          </button>
          <button
            onClick={() => onTabChange('crypto')}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'crypto'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Crypto
          </button>
          <button
            onClick={() => onTabChange('etfs')}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'etfs'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            ETFs
          </button>
          <button
            onClick={() => onTabChange('indices')}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'indices'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Indices
          </button>
          <button
            onClick={() => onTabChange('commodities')}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
              activeTab === 'commodities'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            Commodities
          </button>
        </div>
      </div>

      {/* Custom Lists */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Custom Lists
          </span>
          {onListCreated && <CreateListButton onListCreated={onListCreated} />}
        </div>
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={stockLists.map((list) => list.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {visibleLists.map((list) => (
                <SortableListItem
                  key={list.id}
                  list={list}
                  activeTab={activeTab}
                  onTabChange={onTabChange}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
        {stockLists.length > 5 && (
          <button
            onClick={() => setShowAllLists(!showAllLists)}
            className="w-full mt-2 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
          >
            {showAllLists ? (
              <><ChevronUp className="w-3 h-3" /> Show less</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> +{stockLists.length - 5} more</>
            )}
          </button>
        )}
      </div>

      {/* Portals */}
      {contextMenuPortal}
      {renameModalPortal}
    </div>
  );
}

export default ListSidebar;

import { useState, useRef, useEffect } from "react";
import { Settings2, GripVertical, Eye, EyeOff, RotateCcw, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColumnDef, ALL_COLUMNS } from "@/hooks/useColumnConfig";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ColumnCustomizerProps {
  availableColumns: ColumnDef[];
  visibleColumnIds: string[];
  columnOrder: string[];
  onToggleColumn: (columnId: string) => void;
  onReorderColumns: (newOrder: string[]) => void;
  onReset: () => void;
}

// Sortable column item
function SortableColumnItem({
  column,
  isVisible,
  onToggle,
}: {
  column: ColumnDef;
  isVisible: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : "auto" as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
        isDragging ? "bg-muted" : "hover:bg-muted/50"
      } ${!isVisible ? "opacity-50" : ""}`}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>

      {/* Column name */}
      <span className="flex-1 truncate">{column.label || column.id}</span>

      {/* Visibility toggle */}
      {!column.required ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`p-0.5 rounded transition-colors ${
            isVisible
              ? "text-signal-bullish hover:text-signal-bullish/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      ) : (
        <span className="p-0.5 text-muted-foreground/50">
          <Check className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );
}

export default function ColumnCustomizer({
  availableColumns,
  visibleColumnIds,
  columnOrder,
  onToggleColumn,
  onReorderColumns,
  onReset,
}: ColumnCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

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

  // Get columns in order, filtered to available ones
  const orderedColumns = columnOrder
    .map(id => availableColumns.find(c => c.id === id))
    .filter((c): c is ColumnDef => c !== undefined);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as string);
      const newIndex = columnOrder.indexOf(over.id as string);
      const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
      onReorderColumns(newOrder);
    }
  };

  const visibleCount = visibleColumnIds.filter(id => 
    availableColumns.some(c => c.id === id)
  ).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-1.5 rounded transition-colors ${
              isOpen
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Customize columns</TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg min-w-[200px] max-h-[400px] overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/30">
            <span className="text-xs font-medium">
              Columns ({visibleCount}/{availableColumns.length})
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onReset}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reset to defaults</TooltipContent>
            </Tooltip>
          </div>

          {/* Column list */}
          <div className="p-1 max-h-[350px] overflow-y-auto scrollbar-thin">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedColumns.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {orderedColumns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    isVisible={visibleColumnIds.includes(column.id)}
                    onToggle={() => onToggleColumn(column.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-border bg-muted/20">
            <span className="text-[10px] text-muted-foreground">
              Drag to reorder • Click eye to show/hide
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

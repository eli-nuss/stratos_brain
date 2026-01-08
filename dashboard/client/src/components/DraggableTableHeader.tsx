import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpDown, ArrowUp, ArrowDown, Info, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ColumnDef } from "@/hooks/useColumnConfig";

interface DraggableTableHeaderProps {
  column: ColumnDef;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: string) => void;
  isSticky?: boolean;
  stickyOffset?: string;
}

export default function DraggableTableHeader({
  column,
  sortBy,
  sortOrder,
  onSort,
  isSticky,
  stickyOffset,
}: DraggableTableHeaderProps) {
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
    zIndex: isDragging ? 100 : isSticky ? 20 : "auto",
    ...(isSticky && stickyOffset ? { left: stickyOffset, position: "sticky" as const } : {}),
  };

  const isSorted = sortBy === column.sortField;
  const canSort = !!column.sortField && !!onSort;

  const handleSort = () => {
    if (canSort && column.sortField) {
      onSort(column.sortField);
    }
  };

  // For required/sticky columns, don't show drag handle
  const showDragHandle = !column.required;

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={`px-2 py-2 font-medium text-xs text-muted-foreground ${
        isSticky ? "bg-muted/50" : ""
      } ${isDragging ? "bg-muted" : ""}`}
    >
      <div className={`flex items-center gap-1 ${column.align === "center" ? "justify-center" : column.align === "right" ? "justify-end" : "justify-start"}`}>
        {/* Drag handle - only for non-required columns */}
        {showDragHandle && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-3 h-3" />
          </span>
        )}

        {/* Sort button or plain label */}
        {canSort ? (
          <button
            onClick={handleSort}
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

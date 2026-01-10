import { useState, useEffect, useCallback } from "react";

// Column definition type
export interface ColumnDef {
  id: string;
  label: string;
  tooltip?: string;
  sortField?: string;
  minWidth?: string;
  align?: "left" | "center" | "right";
  sticky?: boolean;
  stickyOffset?: string;
  // Which table types this column applies to
  appliesTo?: ("crypto" | "equity" | "watchlist" | "stocklist")[];
  // Whether this column is always visible (can't be hidden)
  required?: boolean;
}

// All available columns for asset tables
export const ALL_COLUMNS: ColumnDef[] = [
  { id: "actions", label: "", tooltip: "Actions", minWidth: "64px", align: "center", sticky: true, stickyOffset: "0", required: true },
  { id: "asset", label: "Asset", tooltip: "Asset name and symbol", sortField: "symbol", minWidth: "120px", align: "left", sticky: true, stickyOffset: "64px", required: true },
  { id: "direction", label: "Dir", tooltip: "AI directional conviction (-100 to +100)", sortField: "ai_direction_score", minWidth: "70px", align: "center" },
  { id: "quality", label: "Quality", tooltip: "AI setup quality score (0-100)", sortField: "ai_setup_quality_score", minWidth: "70px", align: "center" },
  { id: "market_cap", label: "Mkt Cap", tooltip: "Market capitalization", sortField: "market_cap", minWidth: "90px", align: "right" },
  { id: "price", label: "Price", tooltip: "Latest closing price", sortField: "close", minWidth: "80px", align: "right" },
  { id: "return_1d", label: "24h", tooltip: "24-hour price change", sortField: "return_1d", minWidth: "70px", align: "right" },
  { id: "return_7d", label: "7d", tooltip: "7-day price change", sortField: "return_7d", minWidth: "70px", align: "right" },
  { id: "return_30d", label: "30d", tooltip: "30-day price change", sortField: "return_30d", minWidth: "70px", align: "right" },
  { id: "return_365d", label: "365d", tooltip: "365-day price change", sortField: "return_365d", minWidth: "70px", align: "right" },
  { id: "volume_7d", label: "Vol 7d", tooltip: "7-day trading volume", sortField: "dollar_volume_7d", minWidth: "80px", align: "right" },
  { id: "volume_30d", label: "Vol 30d", tooltip: "30-day trading volume", sortField: "dollar_volume_30d", minWidth: "80px", align: "right" },
  { id: "pe_ratio", label: "P/E", tooltip: "Price-to-Earnings ratio (trailing 12 months)", sortField: "pe_ratio", minWidth: "60px", align: "center", appliesTo: ["equity", "watchlist", "stocklist"] },
  { id: "forward_pe", label: "Fwd P/E", tooltip: "Forward Price-to-Earnings ratio based on analyst estimates", sortField: "forward_pe", minWidth: "70px", align: "center", appliesTo: ["equity", "watchlist", "stocklist"] },
  { id: "peg_ratio", label: "PEG", tooltip: "Price/Earnings-to-Growth ratio (P/E divided by earnings growth rate)", sortField: "peg_ratio", minWidth: "60px", align: "center", appliesTo: ["equity", "watchlist", "stocklist"] },
  { id: "price_to_sales", label: "P/S", tooltip: "Price-to-Sales ratio (trailing twelve months)", sortField: "price_to_sales_ttm", minWidth: "60px", align: "center", appliesTo: ["equity", "watchlist", "stocklist"] },
  { id: "forward_ps", label: "Fwd P/S*", tooltip: "Forward P/S (approx): Market Cap / Est. NTM Revenue. Uses log-dampened growth rate.", sortField: "forward_ps", minWidth: "70px", align: "center", appliesTo: ["equity", "watchlist", "stocklist"] },
  { id: "psg", label: "PSG*", tooltip: "Price-to-Sales-Growth (approx): Forward P/S / Dampened Growth %. Lower = cheaper relative to growth.", sortField: "psg", minWidth: "60px", align: "center", appliesTo: ["equity", "watchlist", "stocklist"] },
  { id: "revenue_growth_yoy", label: "Rev Gr%", tooltip: "Year-over-year revenue growth rate", sortField: "revenue_growth_yoy", minWidth: "70px", align: "center", appliesTo: ["equity", "watchlist", "stocklist"] },
  { id: "category", label: "Industry", tooltip: "Category (crypto) or Industry (equities)", minWidth: "100px", align: "center" },
  { id: "description", label: "Description", tooltip: "Brief description of the asset", minWidth: "150px", align: "left" },
  { id: "notes", label: "Notes", tooltip: "Your personal notes", minWidth: "100px", align: "center" },
];

// Default visible columns for each table type
export const DEFAULT_VISIBLE_COLUMNS: Record<string, string[]> = {
  crypto: ["actions", "asset", "direction", "quality", "market_cap", "price", "return_1d", "return_7d", "return_30d", "return_365d", "volume_7d", "volume_30d", "category", "description", "notes"],
  equity: ["actions", "asset", "direction", "quality", "market_cap", "price", "return_1d", "return_7d", "return_30d", "return_365d", "volume_7d", "volume_30d", "pe_ratio", "forward_pe", "peg_ratio", "price_to_sales", "forward_ps", "psg", "revenue_growth_yoy", "category", "description", "notes"],
  watchlist: ["actions", "asset", "direction", "quality", "market_cap", "price", "return_1d", "return_7d", "return_30d", "return_365d", "volume_7d", "volume_30d", "pe_ratio", "forward_pe", "peg_ratio", "price_to_sales", "forward_ps", "psg", "revenue_growth_yoy", "category", "description", "notes"],
  stocklist: ["actions", "asset", "direction", "quality", "market_cap", "price", "return_1d", "return_7d", "return_30d", "return_365d", "volume_7d", "volume_30d", "pe_ratio", "forward_pe", "peg_ratio", "price_to_sales", "forward_ps", "psg", "revenue_growth_yoy", "category", "description", "notes"],
};

// Default column order (same as ALL_COLUMNS order)
export const DEFAULT_COLUMN_ORDER = ALL_COLUMNS.map(c => c.id);

export interface ColumnConfig {
  visibleColumns: string[];
  columnOrder: string[];
}

const STORAGE_KEY_PREFIX = "stratos_column_config_";

function getStorageKey(tableType: string): string {
  return `${STORAGE_KEY_PREFIX}${tableType}`;
}

function loadConfig(tableType: string): ColumnConfig | null {
  try {
    const stored = localStorage.getItem(getStorageKey(tableType));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load column config from localStorage:", e);
  }
  return null;
}

function saveConfig(tableType: string, config: ColumnConfig): void {
  try {
    localStorage.setItem(getStorageKey(tableType), JSON.stringify(config));
  } catch (e) {
    console.warn("Failed to save column config to localStorage:", e);
  }
}

export function useColumnConfig(tableType: "crypto" | "equity" | "watchlist" | "stocklist") {
  const [config, setConfig] = useState<ColumnConfig>(() => {
    const saved = loadConfig(tableType);
    if (saved) {
      return saved;
    }
    return {
      visibleColumns: DEFAULT_VISIBLE_COLUMNS[tableType] || DEFAULT_VISIBLE_COLUMNS.crypto,
      columnOrder: DEFAULT_COLUMN_ORDER,
    };
  });

  // Save to localStorage whenever config changes
  useEffect(() => {
    saveConfig(tableType, config);
  }, [tableType, config]);

  // Get columns in the correct order, filtered by visibility
  const getVisibleColumns = useCallback((): ColumnDef[] => {
    const orderedColumns: ColumnDef[] = [];
    
    for (const colId of config.columnOrder) {
      if (config.visibleColumns.includes(colId)) {
        const colDef = ALL_COLUMNS.find(c => c.id === colId);
        if (colDef) {
          // Check if column applies to this table type
          if (!colDef.appliesTo || colDef.appliesTo.includes(tableType)) {
            orderedColumns.push(colDef);
          }
        }
      }
    }
    
    return orderedColumns;
  }, [config, tableType]);

  // Get all available columns for this table type (for the column picker)
  const getAvailableColumns = useCallback((): ColumnDef[] => {
    return ALL_COLUMNS.filter(col => !col.appliesTo || col.appliesTo.includes(tableType));
  }, [tableType]);

  // Toggle column visibility
  const toggleColumn = useCallback((columnId: string) => {
    setConfig(prev => {
      const colDef = ALL_COLUMNS.find(c => c.id === columnId);
      if (colDef?.required) {
        return prev; // Can't toggle required columns
      }
      
      const isVisible = prev.visibleColumns.includes(columnId);
      return {
        ...prev,
        visibleColumns: isVisible
          ? prev.visibleColumns.filter(id => id !== columnId)
          : [...prev.visibleColumns, columnId],
      };
    });
  }, []);

  // Reorder columns
  const reorderColumns = useCallback((newOrder: string[]) => {
    setConfig(prev => ({
      ...prev,
      columnOrder: newOrder,
    }));
  }, []);

  // Move a column to a new position
  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    setConfig(prev => {
      const newOrder = [...prev.columnOrder];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return {
        ...prev,
        columnOrder: newOrder,
      };
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setConfig({
      visibleColumns: DEFAULT_VISIBLE_COLUMNS[tableType] || DEFAULT_VISIBLE_COLUMNS.crypto,
      columnOrder: DEFAULT_COLUMN_ORDER,
    });
  }, [tableType]);

  // Check if a column is visible
  const isColumnVisible = useCallback((columnId: string): boolean => {
    return config.visibleColumns.includes(columnId);
  }, [config.visibleColumns]);

  return {
    config,
    getVisibleColumns,
    getAvailableColumns,
    toggleColumn,
    reorderColumns,
    moveColumn,
    resetToDefaults,
    isColumnVisible,
  };
}

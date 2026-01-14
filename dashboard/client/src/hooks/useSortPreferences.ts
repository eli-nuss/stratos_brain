import { useState, useEffect, useCallback } from "react";

export type SortField = 
  | "weighted_score" 
  | "symbol" 
  | "score_delta" 
  | "inflection_score" 
  | "ai_confidence" 
  | "ai_setup_quality_score" 
  | "ai_direction_score" 
  | "fvs_score" 
  | "market_cap" 
  | "return_1d" 
  | "return_7d" 
  | "return_30d" 
  | "return_365d" 
  | "close" 
  | "dollar_volume_7d" 
  | "dollar_volume_30d" 
  | "industry" 
  | "pe_ratio" 
  | "forward_pe" 
  | "peg_ratio" 
  | "price_to_sales_ttm" 
  | "forward_ps" 
  | "psg" 
  | "revenue_growth_yoy" 
  | "interesting_first";

export type SortOrder = "asc" | "desc";

interface SortPreferences {
  sortBy: SortField;
  sortOrder: SortOrder;
}

const STORAGE_KEY_PREFIX = "stratos_sort_";
const DEFAULT_SORT_BY: SortField = "market_cap";
const DEFAULT_SORT_ORDER: SortOrder = "desc";

/**
 * Custom hook for managing sort preferences with localStorage persistence.
 * Each table type gets its own persisted preferences.
 * 
 * @param tableKey - Unique identifier for the table (e.g., "equity", "crypto", "watchlist", "stocklist-{id}")
 */
export function useSortPreferences(tableKey: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${tableKey}`;

  // Initialize state from localStorage or use defaults
  const [sortBy, setSortByState] = useState<SortField>(() => {
    if (typeof window === "undefined") return DEFAULT_SORT_BY;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: SortPreferences = JSON.parse(stored);
        return parsed.sortBy || DEFAULT_SORT_BY;
      }
    } catch (e) {
      console.warn("Failed to parse sort preferences from localStorage:", e);
    }
    return DEFAULT_SORT_BY;
  });

  const [sortOrder, setSortOrderState] = useState<SortOrder>(() => {
    if (typeof window === "undefined") return DEFAULT_SORT_ORDER;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: SortPreferences = JSON.parse(stored);
        return parsed.sortOrder || DEFAULT_SORT_ORDER;
      }
    } catch (e) {
      console.warn("Failed to parse sort preferences from localStorage:", e);
    }
    return DEFAULT_SORT_ORDER;
  });

  // Persist to localStorage whenever sort preferences change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const preferences: SortPreferences = { sortBy, sortOrder };
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch (e) {
      console.warn("Failed to save sort preferences to localStorage:", e);
    }
  }, [sortBy, sortOrder, storageKey]);

  // Wrapper to set sortBy
  const setSortBy = useCallback((field: SortField) => {
    setSortByState(field);
  }, []);

  // Wrapper to set sortOrder
  const setSortOrder = useCallback((order: SortOrder) => {
    setSortOrderState(order);
  }, []);

  // Handle sort toggle (same field toggles order, different field sets new field with desc)
  const handleSort = useCallback((field: SortField) => {
    if (sortBy === field) {
      setSortOrderState(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortByState(field);
      setSortOrderState("desc");
    }
  }, [sortBy]);

  return {
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    handleSort,
  };
}

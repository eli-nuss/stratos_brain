/**
 * Search Context
 * 
 * Provides a shared search state that syncs the global ⌘K search
 * with the asset table filtering.
 * 
 * Two types of search state:
 * - `globalSearchQuery`: The live query as user types in ⌘K (for dropdown results)
 * - `appliedFilter`: The filter that persists on the table after closing ⌘K
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SearchContextValue {
  /** Current search query (live as user types) */
  globalSearchQuery: string;
  /** Set the global search query */
  setGlobalSearchQuery: (query: string) => void;
  /** The filter currently applied to the table (persists after closing ⌘K) */
  appliedFilter: string;
  /** Apply the current search as a persistent filter */
  applyFilter: (filter: string) => void;
  /** Clear the applied filter */
  clearFilter: () => void;
  /** Whether the command bar is open */
  isCommandBarOpen: boolean;
  /** Set command bar open state */
  setIsCommandBarOpen: (open: boolean) => void;
  /** Clear everything (query and filter) */
  clearAll: () => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

  const applyFilter = useCallback((filter: string) => {
    setAppliedFilter(filter);
  }, []);

  const clearFilter = useCallback(() => {
    setAppliedFilter('');
  }, []);

  const clearAll = useCallback(() => {
    setGlobalSearchQuery('');
    setAppliedFilter('');
  }, []);

  return (
    <SearchContext.Provider
      value={{
        globalSearchQuery,
        setGlobalSearchQuery,
        appliedFilter,
        applyFilter,
        clearFilter,
        isCommandBarOpen,
        setIsCommandBarOpen,
        clearAll,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}

/**
 * Hook to get just the applied filter (for components that only need to read the table filter)
 */
export function useAppliedFilter() {
  const { appliedFilter } = useSearchContext();
  return appliedFilter;
}

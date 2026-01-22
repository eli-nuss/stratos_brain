/**
 * Search Context
 * 
 * Provides a shared search state that syncs the global ⌘K search
 * with the asset table filtering.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface SearchContextValue {
  /** Current search query */
  globalSearchQuery: string;
  /** Set the global search query */
  setGlobalSearchQuery: (query: string) => void;
  /** Whether the command bar is open */
  isCommandBarOpen: boolean;
  /** Set command bar open state */
  setIsCommandBarOpen: (open: boolean) => void;
  /** Clear the search */
  clearSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isCommandBarOpen, setIsCommandBarOpen] = useState(false);

  const clearSearch = useCallback(() => {
    setGlobalSearchQuery('');
  }, []);

  // Clear search when navigating away (optional - can be removed if you want persistence)
  // useEffect(() => {
  //   return () => clearSearch();
  // }, []);

  return (
    <SearchContext.Provider
      value={{
        globalSearchQuery,
        setGlobalSearchQuery,
        isCommandBarOpen,
        setIsCommandBarOpen,
        clearSearch,
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
 * Hook to get just the search query (for components that only need to read)
 */
export function useGlobalSearchQuery() {
  const { globalSearchQuery } = useSearchContext();
  return globalSearchQuery;
}

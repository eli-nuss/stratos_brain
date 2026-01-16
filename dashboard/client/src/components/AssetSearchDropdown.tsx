import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Check, X, Loader2 } from "lucide-react";
import useSWR from "swr";

interface SearchResult {
  asset_id: number;
  symbol: string;
  name: string;
  close: number | null;
  market_cap: number | null;
  asset_type: string;
}

interface AssetSearchDropdownProps {
  /** IDs of assets already in the list */
  existingAssetIds: Set<number>;
  /** Callback when user adds an asset */
  onAddAsset: (assetId: number) => Promise<void>;
  /** Placeholder text for search input */
  placeholder?: string;
}

import { apiFetcher } from "@/lib/api-config";

export default function AssetSearchDropdown({
  existingAssetIds,
  onAddAsset,
  placeholder = "Search to add...",
}: AssetSearchDropdownProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 320 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results from both crypto and equity universes
  const { data: cryptoData, isLoading: cryptoLoading } = useSWR<{ data: SearchResult[] }>(
    debouncedQuery.length >= 1
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=crypto_top_500&limit=10`
      : null,
    apiFetcher
  );

  const { data: equityData, isLoading: equityLoading } = useSWR<{ data: SearchResult[] }>(
    debouncedQuery.length >= 1
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=equity_all&limit=10`
      : null,
    apiFetcher
  );

  const isLoading = cryptoLoading || equityLoading;

  // Combine and dedupe results, prioritizing exact matches
  const results: SearchResult[] = [];
  const seenIds = new Set<number>();

  const allResults = [...(cryptoData?.data || []), ...(equityData?.data || [])];
  
  // Sort by relevance (exact symbol match first, then starts with, then contains)
  allResults.sort((a, b) => {
    const queryLower = debouncedQuery.toLowerCase();
    const aSymbol = a.symbol.toLowerCase();
    const bSymbol = b.symbol.toLowerCase();
    
    // Exact match first
    if (aSymbol === queryLower && bSymbol !== queryLower) return -1;
    if (bSymbol === queryLower && aSymbol !== queryLower) return 1;
    
    // Starts with second
    if (aSymbol.startsWith(queryLower) && !bSymbol.startsWith(queryLower)) return -1;
    if (bSymbol.startsWith(queryLower) && !aSymbol.startsWith(queryLower)) return 1;
    
    // Then by market cap
    return (b.market_cap || 0) - (a.market_cap || 0);
  });

  for (const item of allResults) {
    if (!seenIds.has(item.asset_id)) {
      seenIds.add(item.asset_id);
      results.push(item);
    }
  }

  // Limit to 15 results
  const displayResults = results.slice(0, 15);

  // Update dropdown position when input is focused or query changes
  useLayoutEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: 320,
      });
    }
  }, [isOpen, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  const handleAddAsset = async (assetId: number) => {
    setAddingId(assetId);
    try {
      await onAddAsset(assetId);
    } finally {
      setAddingId(null);
    }
  };

  const formatPrice = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num < 0.0001) return num.toExponential(2);
    if (num < 1) return `$${num.toFixed(4)}`;
    if (num < 100) return `$${num.toFixed(2)}`;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatMarketCap = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "";
    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
    return "";
  };

  const dropdownContent = isOpen && query.length >= 1 && (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 9999,
      }}
      className="max-h-80 overflow-auto bg-popover border border-border rounded-lg shadow-lg"
    >
      {isLoading && displayResults.length === 0 ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Searching...
        </div>
      ) : displayResults.length === 0 ? (
        <div className="py-4 text-center text-muted-foreground text-xs">
          No assets found for "{query}"
        </div>
      ) : (
        <div className="py-1">
          {displayResults.map((asset) => {
            const isInList = existingAssetIds.has(asset.asset_id);
            const isAdding = addingId === asset.asset_id;

            return (
              <div
                key={asset.asset_id}
                className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Asset type badge */}
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded font-medium shrink-0 ${
                      asset.asset_type === "crypto"
                        ? "text-orange-400 bg-orange-400/10"
                        : "text-blue-400 bg-blue-400/10"
                    }`}
                  >
                    {asset.asset_type === "crypto" ? "C" : "E"}
                  </span>

                  {/* Symbol and name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-foreground text-sm">
                        {asset.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {asset.name}
                      </span>
                    </div>
                  </div>

                  {/* Price and market cap */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono text-foreground">
                      {formatPrice(asset.close)}
                    </div>
                    {asset.market_cap && (
                      <div className="text-[10px] text-muted-foreground">
                        {formatMarketCap(asset.market_cap)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add/Check button */}
                <button
                  onClick={() => !isInList && !isAdding && handleAddAsset(asset.asset_id)}
                  disabled={isInList || isAdding}
                  className={`ml-2 p-1 rounded transition-colors shrink-0 ${
                    isInList
                      ? "text-signal-bullish bg-signal-bullish/10 cursor-default"
                      : isAdding
                      ? "text-muted-foreground cursor-wait"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isInList ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-7 pr-7 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary w-48"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Portal dropdown to body to avoid overflow issues */}
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}

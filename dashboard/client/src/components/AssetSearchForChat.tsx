import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2 } from "lucide-react";
import useSWR from "swr";

interface SearchResult {
  asset_id: number;
  symbol: string;
  name: string;
  close: number | null;
  market_cap: number | null;
  asset_type: string;
}

interface AssetSearchForChatProps {
  /** Callback when user selects an asset */
  onSelect: (asset: SearchResult) => void;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AssetSearchForChat({
  onSelect,
  placeholder = "Search for a company...",
  disabled = false,
}: AssetSearchForChatProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 400 });
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
    fetcher
  );

  const { data: equityData, isLoading: equityLoading } = useSWR<{ data: SearchResult[] }>(
    debouncedQuery.length >= 1
      ? `/api/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&universe_id=equity_all&limit=10`
      : null,
    fetcher
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
        width: Math.max(rect.width, 400),
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

  const handleSelect = (asset: SearchResult) => {
    onSelect(asset);
    setQuery("");
    setIsOpen(false);
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
      className="max-h-80 overflow-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl"
    >
      {isLoading && displayResults.length === 0 ? (
        <div className="flex items-center justify-center py-4 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Searching...
        </div>
      ) : displayResults.length === 0 ? (
        <div className="py-4 text-center text-zinc-500 text-sm">
          No assets found for "{query}"
        </div>
      ) : (
        <div className="py-1">
          {displayResults.map((asset) => (
            <button
              key={asset.asset_id}
              onClick={() => handleSelect(asset)}
              className="flex items-center justify-between w-full px-4 py-3 hover:bg-zinc-700/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Asset type badge */}
                <span
                  className={`text-xs px-2 py-1 rounded font-medium shrink-0 ${
                    asset.asset_type === "crypto"
                      ? "text-orange-400 bg-orange-400/10"
                      : "text-blue-400 bg-blue-400/10"
                  }`}
                >
                  {asset.asset_type === "crypto" ? "Crypto" : "Equity"}
                </span>

                {/* Symbol and name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-white text-sm">
                      {asset.symbol}
                    </span>
                    <span className="text-sm text-zinc-400 truncate">
                      {asset.name}
                    </span>
                  </div>
                </div>

                {/* Price and market cap */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono text-zinc-300">
                    {formatPrice(asset.close)}
                  </div>
                  {asset.market_cap && (
                    <div className="text-xs text-zinc-500">
                      {formatMarketCap(asset.market_cap)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
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
          disabled={disabled}
          className="w-full pl-12 pr-10 py-3 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              setIsOpen(false);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Portal dropdown to body to avoid overflow issues */}
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}

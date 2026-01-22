/**
 * Unified Search Hook
 * 
 * Provides a single search interface across all data types:
 * - Assets (tickers, company names)
 * - Industries
 * - Sectors
 * - Categories (crypto)
 * - Custom Lists
 * - Recent Items
 * 
 * Features:
 * - Fuzzy matching for typo tolerance (e.g., "Nvdia" → NVIDIA)
 * - Ticker aliases (e.g., "Google" → GOOGL)
 * - Relevance-based scoring and sorting
 * 
 * @version 1.1.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { apiFetcher, API_BASE } from '@/lib/api-config';
import { useUserPreferences, PREFERENCE_KEYS } from './useUserPreferences';
import { useStockLists, StockList } from './useStockLists';
import { 
  fuzzyMatch, 
  resolveTickerAlias, 
  getTickerAliases,
  FuzzyMatchResult 
} from '@/lib/fuzzySearch';

// ============================================================================
// Types
// ============================================================================

export type SearchCategory = 'all' | 'assets' | 'industries' | 'lists' | 'recent';

export interface AssetResult {
  type: 'asset';
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: 'crypto' | 'equity';
  close?: number | null;
  market_cap?: number | null;
  return_1d?: number | null;
  industry?: string | null;
  sector?: string | null;
  category?: string | null;
  // Fuzzy match metadata
  matchScore?: number;
  matchType?: FuzzyMatchResult['matchType'];
  matchedVia?: string; // e.g., "alias: google"
}

export interface IndustryResult {
  type: 'industry';
  name: string;
  asset_type: 'equity';
  count: number;
  matchScore?: number;
}

export interface SectorResult {
  type: 'sector';
  name: string;
  asset_type: 'equity';
  count: number;
  matchScore?: number;
}

export interface CategoryResult {
  type: 'category';
  name: string;
  asset_type: 'crypto';
  count: number;
  matchScore?: number;
}

export interface ListResult {
  type: 'list';
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  asset_count?: number;
  matchScore?: number;
}

export interface RecentItem {
  type: 'recent';
  item_type: 'asset' | 'list' | 'industry';
  asset_id?: number;
  list_id?: number;
  symbol?: string;
  name: string;
  asset_type?: 'crypto' | 'equity';
  timestamp: number;
}

export type SearchResult = 
  | AssetResult 
  | IndustryResult 
  | SectorResult 
  | CategoryResult 
  | ListResult 
  | RecentItem;

export interface GroupedResults {
  recent: RecentItem[];
  assets: AssetResult[];
  industries: (IndustryResult | SectorResult | CategoryResult)[];
  lists: ListResult[];
}

// ============================================================================
// Constants
// ============================================================================

const RECENT_ITEMS_KEY = 'recent_search_items';
const MAX_RECENT_ITEMS = 10;
const DEBOUNCE_MS = 200;
const FUZZY_MIN_SCORE = 35; // Minimum score to include fuzzy matches

// Static list of industries for quick matching
const EQUITY_INDUSTRIES = [
  "Aerospace & Defense", "Airlines", "Asset Management", "Auto Manufacturers",
  "Auto Parts", "Banks - Diversified", "Banks - Regional", "Beverages - Brewers",
  "Beverages - Non-Alcoholic", "Biotechnology", "Broadcasting", "Building Materials",
  "Building Products & Equipment", "Capital Markets", "Chemicals", "Coal",
  "Communication Equipment", "Computer Hardware", "Conglomerates",
  "Consulting Services", "Consumer Electronics", "Credit Services",
  "Diagnostics & Research", "Discount Stores", "Drug Manufacturers - General",
  "Drug Manufacturers - Specialty & Generic", "Education & Training Services",
  "Electrical Equipment & Parts", "Electronic Components", "Engineering & Construction",
  "Entertainment", "Farm & Heavy Construction Machinery", "Farm Products",
  "Financial Conglomerates", "Financial Data & Stock Exchanges", "Food Distribution",
  "Footwear & Accessories", "Furnishings, Fixtures & Appliances",
  "Gambling", "Gold", "Health Care Plans", "Health Information Services",
  "Healthcare Plans", "Home Improvement Retail", "Household & Personal Products",
  "Industrial Distribution", "Information Technology Services", "Insurance - Diversified",
  "Insurance - Life", "Insurance - Property & Casualty", "Insurance - Reinsurance",
  "Insurance - Specialty", "Insurance Brokers", "Integrated Freight & Logistics",
  "Internet Content & Information", "Internet Retail", "Leisure",
  "Luxury Goods", "Marine Shipping", "Medical Care Facilities",
  "Medical Devices", "Medical Distribution", "Medical Instruments & Supplies",
  "Metal Fabrication", "Oil & Gas E&P", "Oil & Gas Equipment & Services",
  "Oil & Gas Integrated", "Oil & Gas Midstream", "Oil & Gas Refining & Marketing",
  "Other Industrial Metals & Mining", "Other Precious Metals & Mining",
  "Packaged Foods", "Paper & Paper Products", "Personal Services",
  "Pharmaceutical Retailers", "Pollution & Treatment Controls", "Publishing",
  "REIT - Diversified", "REIT - Healthcare Facilities", "REIT - Hotel & Motel",
  "REIT - Industrial", "REIT - Mortgage", "REIT - Office", "REIT - Residential",
  "REIT - Retail", "REIT - Specialty", "Railroads", "Real Estate - Development",
  "Real Estate - Diversified", "Real Estate Services", "Recreational Vehicles",
  "Rental & Leasing Services", "Residential Construction", "Restaurants",
  "Scientific & Technical Instruments", "Security & Protection Services",
  "Semiconductor Equipment & Materials", "Semiconductors", "Shell Companies",
  "Silver", "Software - Application", "Software - Infrastructure",
  "Solar", "Specialty Business Services", "Specialty Chemicals",
  "Specialty Industrial Machinery", "Specialty Retail", "Staffing & Employment Services",
  "Steel", "Telecom Services", "Textile Manufacturing", "Thermal Coal",
  "Tobacco", "Tools & Accessories", "Travel Services", "Trucking",
  "Uranium", "Utilities - Diversified", "Utilities - Independent Power Producers",
  "Utilities - Regulated Electric", "Utilities - Regulated Gas",
  "Utilities - Regulated Water", "Utilities - Renewable", "Waste Management"
];

const EQUITY_SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Consumer Cyclical",
  "Communication Services", "Industrials", "Consumer Defensive", "Energy",
  "Basic Materials", "Real Estate", "Utilities"
];

const CRYPTO_CATEGORIES = [
  "AI", "DeFi", "Meme", "L1", "L2", "L0", "Privacy", "Gaming", "NFT",
  "Infrastructure", "Oracle", "Exchange", "Stablecoin", "Wrapped",
  "Storage", "Social", "DAO", "Metaverse", "RWA", "DePin"
];

// ============================================================================
// Hook
// ============================================================================

interface UseUnifiedSearchOptions {
  /** Minimum characters to trigger search */
  minChars?: number;
  /** Maximum results per category */
  maxResultsPerCategory?: number;
  /** Enable recent items tracking */
  enableRecent?: boolean;
  /** Enable fuzzy matching */
  enableFuzzy?: boolean;
}

interface UseUnifiedSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  debouncedQuery: string;
  category: SearchCategory;
  setCategory: (category: SearchCategory) => void;
  results: GroupedResults;
  isLoading: boolean;
  error: Error | null;
  recentItems: RecentItem[];
  addRecentItem: (item: Omit<RecentItem, 'type' | 'timestamp'>) => void;
  clearRecentItems: () => void;
  totalResults: number;
}

export function useUnifiedSearch(options: UseUnifiedSearchOptions = {}): UseUnifiedSearchReturn {
  const {
    minChars = 1,
    maxResultsPerCategory = 8,
    enableRecent = true,
    enableFuzzy = true,
  } = options;

  // State
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');

  // Hooks
  const { getPreference, setPreference, isLoggedIn } = useUserPreferences();
  const { lists: stockLists } = useStockLists();

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // ============================================================================
  // Resolve Ticker Aliases
  // ============================================================================
  
  // Check if the query matches any ticker aliases
  const resolvedTickers = useMemo(() => {
    if (!enableFuzzy || debouncedQuery.length < 2) return [];
    return resolveTickerAlias(debouncedQuery);
  }, [debouncedQuery, enableFuzzy]);

  // Build search queries - include both original query and resolved aliases
  const searchQueries = useMemo(() => {
    const queries = [debouncedQuery];
    // Add resolved tickers to search
    resolvedTickers.forEach((ticker) => {
      if (!queries.includes(ticker)) {
        queries.push(ticker);
      }
    });
    return queries;
  }, [debouncedQuery, resolvedTickers]);

  // ============================================================================
  // Recent Items Management
  // ============================================================================

  const recentItems = useMemo(() => {
    if (!enableRecent) return [];
    const stored = getPreference<RecentItem[]>(RECENT_ITEMS_KEY, []);
    return stored.slice(0, MAX_RECENT_ITEMS);
  }, [getPreference, enableRecent]);

  const addRecentItem = useCallback(
    (item: Omit<RecentItem, 'type' | 'timestamp'>) => {
      if (!enableRecent || !isLoggedIn) return;

      const newItem: RecentItem = {
        ...item,
        type: 'recent',
        timestamp: Date.now(),
      };

      // Remove duplicates and add new item at the beginning
      const filtered = recentItems.filter((r) => {
        if (item.item_type === 'asset' && r.item_type === 'asset') {
          return r.asset_id !== item.asset_id;
        }
        if (item.item_type === 'list' && r.item_type === 'list') {
          return r.list_id !== item.list_id;
        }
        if (item.item_type === 'industry' && r.item_type === 'industry') {
          return r.name !== item.name;
        }
        return true;
      });

      const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);
      setPreference(RECENT_ITEMS_KEY, updated);
    },
    [recentItems, enableRecent, isLoggedIn, setPreference]
  );

  const clearRecentItems = useCallback(() => {
    if (!enableRecent || !isLoggedIn) return;
    setPreference(RECENT_ITEMS_KEY, []);
  }, [enableRecent, isLoggedIn, setPreference]);

  // ============================================================================
  // Asset Search (API) - Search with original query and resolved aliases
  // ============================================================================

  const shouldSearchAssets = debouncedQuery.length >= minChars && 
    (category === 'all' || category === 'assets');

  // Primary search with original query
  const { data: cryptoData, isLoading: cryptoLoading } = useSWR<{ data: any[] }>(
    shouldSearchAssets
      ? `${API_BASE}/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&asset_type=crypto&limit=${maxResultsPerCategory * 2}`
      : null,
    apiFetcher,
    { dedupingInterval: 1000 }
  );

  const { data: equityData, isLoading: equityLoading } = useSWR<{ data: any[] }>(
    shouldSearchAssets
      ? `${API_BASE}/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&asset_type=equity&limit=${maxResultsPerCategory * 2}`
      : null,
    apiFetcher,
    { dedupingInterval: 1000 }
  );

  // Additional search for resolved ticker aliases (if different from original query)
  const aliasSearchQuery = resolvedTickers.length > 0 ? resolvedTickers[0] : null;
  const shouldSearchAlias = shouldSearchAssets && aliasSearchQuery && 
    aliasSearchQuery.toLowerCase() !== debouncedQuery.toLowerCase();

  const { data: aliasCryptoData } = useSWR<{ data: any[] }>(
    shouldSearchAlias
      ? `${API_BASE}/dashboard/all-assets?search=${encodeURIComponent(aliasSearchQuery!)}&asset_type=crypto&limit=${maxResultsPerCategory}`
      : null,
    apiFetcher,
    { dedupingInterval: 1000 }
  );

  const { data: aliasEquityData } = useSWR<{ data: any[] }>(
    shouldSearchAlias
      ? `${API_BASE}/dashboard/all-assets?search=${encodeURIComponent(aliasSearchQuery!)}&asset_type=equity&limit=${maxResultsPerCategory}`
      : null,
    apiFetcher,
    { dedupingInterval: 1000 }
  );

  // ============================================================================
  // Industry/Sector/Category Search (Client-side with Fuzzy Matching)
  // ============================================================================

  const industryResults = useMemo((): (IndustryResult | SectorResult | CategoryResult)[] => {
    if (debouncedQuery.length < minChars) return [];
    if (category !== 'all' && category !== 'industries') return [];

    const results: (IndustryResult | SectorResult | CategoryResult & { matchScore: number })[] = [];

    // Search industries with fuzzy matching
    EQUITY_INDUSTRIES.forEach((industry) => {
      const match = fuzzyMatch(debouncedQuery, industry);
      if (match.score >= FUZZY_MIN_SCORE) {
        results.push({
          type: 'industry',
          name: industry,
          asset_type: 'equity',
          count: 0,
          matchScore: match.score,
        });
      }
    });

    // Search sectors with fuzzy matching
    EQUITY_SECTORS.forEach((sector) => {
      const match = fuzzyMatch(debouncedQuery, sector);
      if (match.score >= FUZZY_MIN_SCORE) {
        results.push({
          type: 'sector',
          name: sector,
          asset_type: 'equity',
          count: 0,
          matchScore: match.score,
        });
      }
    });

    // Search crypto categories with fuzzy matching
    CRYPTO_CATEGORIES.forEach((cat) => {
      const match = fuzzyMatch(debouncedQuery, cat);
      if (match.score >= FUZZY_MIN_SCORE) {
        results.push({
          type: 'category',
          name: cat,
          asset_type: 'crypto',
          count: 0,
          matchScore: match.score,
        });
      }
    });

    // Sort by match score (highest first)
    results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    return results.slice(0, maxResultsPerCategory);
  }, [debouncedQuery, minChars, category, maxResultsPerCategory]);

  // ============================================================================
  // List Search (Client-side with Fuzzy Matching)
  // ============================================================================

  const listResults = useMemo((): ListResult[] => {
    if (debouncedQuery.length < minChars) return [];
    if (category !== 'all' && category !== 'lists') return [];

    const results: (ListResult & { matchScore: number })[] = [];

    stockLists.forEach((list) => {
      // Match against list name and description
      const nameMatch = fuzzyMatch(debouncedQuery, list.name);
      const descMatch = list.description 
        ? fuzzyMatch(debouncedQuery, list.description) 
        : { score: 0, matchType: 'none' as const };
      
      const bestScore = Math.max(nameMatch.score, descMatch.score * 0.8); // Description match weighted less

      if (bestScore >= FUZZY_MIN_SCORE) {
        results.push({
          type: 'list',
          id: list.id,
          name: list.name,
          description: list.description,
          icon: list.icon,
          color: list.color,
          matchScore: bestScore,
        });
      }
    });

    // Sort by match score
    results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    return results.slice(0, maxResultsPerCategory);
  }, [debouncedQuery, minChars, category, stockLists, maxResultsPerCategory]);

  // ============================================================================
  // Combine and Score Asset Results
  // ============================================================================

  const assetResults = useMemo((): AssetResult[] => {
    const allAssets: (AssetResult & { matchScore: number })[] = [];
    const seenIds = new Set<number>();

    // Helper to process assets and add match scores
    const processAssets = (assets: any[], source: 'direct' | 'alias') => {
      assets.forEach((asset) => {
        if (seenIds.has(asset.asset_id)) return;
        seenIds.add(asset.asset_id);

        // Get aliases for this ticker
        const aliases = getTickerAliases(asset.symbol);
        
        // Calculate match score
        const symbolMatch = fuzzyMatch(debouncedQuery, asset.symbol, aliases);
        const nameMatch = fuzzyMatch(debouncedQuery, asset.name || '');
        
        // Use the better match
        let bestMatch = symbolMatch.score >= nameMatch.score ? symbolMatch : nameMatch;
        let matchedVia: string | undefined;

        // If this came from alias search, boost the score
        if (source === 'alias' && bestMatch.score < 50) {
          bestMatch = { score: 85, matchType: 'alias' };
          matchedVia = `alias: ${debouncedQuery}`;
        } else if (bestMatch.matchedAlias) {
          matchedVia = `alias: ${bestMatch.matchedAlias}`;
        }

        allAssets.push({
          type: 'asset',
          asset_id: asset.asset_id,
          symbol: asset.symbol,
          name: asset.name,
          asset_type: asset.asset_type,
          close: asset.close,
          market_cap: asset.market_cap,
          return_1d: asset.return_1d,
          industry: asset.industry,
          sector: asset.sector,
          category: asset.category,
          matchScore: bestMatch.score,
          matchType: bestMatch.matchType,
          matchedVia,
        });
      });
    };

    // Process direct search results
    const cryptoAssets = cryptoData?.data || [];
    const equityAssets = equityData?.data || [];
    processAssets([...cryptoAssets, ...equityAssets], 'direct');

    // Process alias search results
    const aliasCryptoAssets = aliasCryptoData?.data || [];
    const aliasEquityAssets = aliasEquityData?.data || [];
    processAssets([...aliasCryptoAssets, ...aliasEquityAssets], 'alias');

    // Sort by match score, then by market cap for ties
    allAssets.sort((a, b) => {
      const scoreDiff = (b.matchScore || 0) - (a.matchScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.market_cap || 0) - (a.market_cap || 0);
    });

    return allAssets.slice(0, maxResultsPerCategory * 2);
  }, [cryptoData, equityData, aliasCryptoData, aliasEquityData, debouncedQuery, maxResultsPerCategory]);

  // ============================================================================
  // Filtered Recent Items (with Fuzzy Matching)
  // ============================================================================

  const filteredRecentItems = useMemo((): RecentItem[] => {
    if (!enableRecent) return [];
    if (category !== 'all' && category !== 'recent') return [];

    if (debouncedQuery.length === 0) {
      return recentItems.slice(0, 5);
    }

    // Filter recent items with fuzzy matching
    const matched = recentItems
      .map((item) => {
        const nameMatch = fuzzyMatch(debouncedQuery, item.name || '');
        const symbolMatch = item.symbol 
          ? fuzzyMatch(debouncedQuery, item.symbol, getTickerAliases(item.symbol))
          : { score: 0, matchType: 'none' as const };
        
        return {
          item,
          score: Math.max(nameMatch.score, symbolMatch.score),
        };
      })
      .filter(({ score }) => score >= FUZZY_MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    return matched.map(({ item }) => item).slice(0, 5);
  }, [recentItems, debouncedQuery, enableRecent, category]);

  // ============================================================================
  // Final Grouped Results
  // ============================================================================

  const results: GroupedResults = useMemo(() => ({
    recent: filteredRecentItems,
    assets: assetResults,
    industries: industryResults,
    lists: listResults,
  }), [filteredRecentItems, assetResults, industryResults, listResults]);

  const totalResults = useMemo(() => {
    return (
      results.recent.length +
      results.assets.length +
      results.industries.length +
      results.lists.length
    );
  }, [results]);

  const isLoading = cryptoLoading || equityLoading;

  return {
    query,
    setQuery,
    debouncedQuery,
    category,
    setCategory,
    results,
    isLoading,
    error: null,
    recentItems,
    addRecentItem,
    clearRecentItems,
    totalResults,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function formatPrice(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  if (num < 0.0001) return num.toExponential(2);
  if (num < 1) return `$${num.toFixed(4)}`;
  if (num < 100) return `$${num.toFixed(2)}`;
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatMarketCap(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  return `$${num.toLocaleString()}`;
}

export function formatReturn(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-';
  const pct = num * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

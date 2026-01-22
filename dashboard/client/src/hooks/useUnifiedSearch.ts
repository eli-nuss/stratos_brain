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
 * @version 1.0.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { apiFetcher, API_BASE } from '@/lib/api-config';
import { useUserPreferences, PREFERENCE_KEYS } from './useUserPreferences';
import { useStockLists, StockList } from './useStockLists';

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
}

export interface IndustryResult {
  type: 'industry';
  name: string;
  asset_type: 'equity';
  count: number;
}

export interface SectorResult {
  type: 'sector';
  name: string;
  asset_type: 'equity';
  count: number;
}

export interface CategoryResult {
  type: 'category';
  name: string;
  asset_type: 'crypto';
  count: number;
}

export interface ListResult {
  type: 'list';
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  asset_count?: number;
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
  // Asset Search (API)
  // ============================================================================

  const shouldSearchAssets = debouncedQuery.length >= minChars && 
    (category === 'all' || category === 'assets');

  // Search both crypto and equity
  const { data: cryptoData, isLoading: cryptoLoading } = useSWR<{ data: any[] }>(
    shouldSearchAssets
      ? `${API_BASE}/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&asset_type=crypto&limit=${maxResultsPerCategory}`
      : null,
    apiFetcher,
    { dedupingInterval: 1000 }
  );

  const { data: equityData, isLoading: equityLoading } = useSWR<{ data: any[] }>(
    shouldSearchAssets
      ? `${API_BASE}/dashboard/all-assets?search=${encodeURIComponent(debouncedQuery)}&asset_type=equity&limit=${maxResultsPerCategory}`
      : null,
    apiFetcher,
    { dedupingInterval: 1000 }
  );

  // ============================================================================
  // Industry/Sector/Category Search (Client-side)
  // ============================================================================

  const industryResults = useMemo((): (IndustryResult | SectorResult | CategoryResult)[] => {
    if (debouncedQuery.length < minChars) return [];
    if (category !== 'all' && category !== 'industries') return [];

    const queryLower = debouncedQuery.toLowerCase();
    const results: (IndustryResult | SectorResult | CategoryResult)[] = [];

    // Search industries
    EQUITY_INDUSTRIES.forEach((industry) => {
      if (industry.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'industry',
          name: industry,
          asset_type: 'equity',
          count: 0, // Will be populated by API if needed
        });
      }
    });

    // Search sectors
    EQUITY_SECTORS.forEach((sector) => {
      if (sector.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'sector',
          name: sector,
          asset_type: 'equity',
          count: 0,
        });
      }
    });

    // Search crypto categories
    CRYPTO_CATEGORIES.forEach((cat) => {
      if (cat.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'category',
          name: cat,
          asset_type: 'crypto',
          count: 0,
        });
      }
    });

    // Sort by relevance (exact match first, then starts with, then contains)
    results.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Exact match first
      if (aName === queryLower && bName !== queryLower) return -1;
      if (bName === queryLower && aName !== queryLower) return 1;

      // Starts with second
      if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
      if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;

      return 0;
    });

    return results.slice(0, maxResultsPerCategory);
  }, [debouncedQuery, minChars, category, maxResultsPerCategory]);

  // ============================================================================
  // List Search (Client-side)
  // ============================================================================

  const listResults = useMemo((): ListResult[] => {
    if (debouncedQuery.length < minChars) return [];
    if (category !== 'all' && category !== 'lists') return [];

    const queryLower = debouncedQuery.toLowerCase();

    return stockLists
      .filter((list) => list.name.toLowerCase().includes(queryLower))
      .map((list) => ({
        type: 'list' as const,
        id: list.id,
        name: list.name,
        description: list.description,
        icon: list.icon,
        color: list.color,
      }))
      .slice(0, maxResultsPerCategory);
  }, [debouncedQuery, minChars, category, stockLists, maxResultsPerCategory]);

  // ============================================================================
  // Combine Results
  // ============================================================================

  const assetResults = useMemo((): AssetResult[] => {
    const allAssets: AssetResult[] = [];
    const seenIds = new Set<number>();

    // Combine crypto and equity results
    const cryptoAssets = cryptoData?.data || [];
    const equityAssets = equityData?.data || [];

    [...cryptoAssets, ...equityAssets].forEach((asset) => {
      if (!seenIds.has(asset.asset_id)) {
        seenIds.add(asset.asset_id);
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
        });
      }
    });

    // Sort by relevance
    const queryLower = debouncedQuery.toLowerCase();
    allAssets.sort((a, b) => {
      const aSymbol = a.symbol.toLowerCase();
      const bSymbol = b.symbol.toLowerCase();

      // Exact symbol match first
      if (aSymbol === queryLower && bSymbol !== queryLower) return -1;
      if (bSymbol === queryLower && aSymbol !== queryLower) return 1;

      // Symbol starts with query second
      if (aSymbol.startsWith(queryLower) && !bSymbol.startsWith(queryLower)) return -1;
      if (bSymbol.startsWith(queryLower) && !aSymbol.startsWith(queryLower)) return 1;

      // Then by market cap
      return (b.market_cap || 0) - (a.market_cap || 0);
    });

    return allAssets.slice(0, maxResultsPerCategory * 2); // Allow more assets
  }, [cryptoData, equityData, debouncedQuery, maxResultsPerCategory]);

  // ============================================================================
  // Filtered Recent Items
  // ============================================================================

  const filteredRecentItems = useMemo((): RecentItem[] => {
    if (!enableRecent) return [];
    if (category !== 'all' && category !== 'recent') return [];

    if (debouncedQuery.length === 0) {
      return recentItems.slice(0, 5);
    }

    const queryLower = debouncedQuery.toLowerCase();
    return recentItems
      .filter((item) => {
        const name = item.name?.toLowerCase() || '';
        const symbol = item.symbol?.toLowerCase() || '';
        return name.includes(queryLower) || symbol.includes(queryLower);
      })
      .slice(0, 5);
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

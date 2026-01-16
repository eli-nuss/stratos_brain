import useSWR from 'swr'
import { apiFetcher, apiPost, apiDelete, frequentUpdateSwrConfig } from '@/lib/api-config'

const API_BASE = '/api'

// Wrapper to ensure array return
const arrayFetcher = async (url: string) => {
  const data = await apiFetcher(url);
  return Array.isArray(data) ? data : [];
};

interface WatchlistItem {
  asset_id: number
  created_at: string
}

export function useWatchlist() {
  const { data, error, isLoading, mutate } = useSWR<WatchlistItem[]>(
    `${API_BASE}/dashboard/watchlist`,
    arrayFetcher,
    frequentUpdateSwrConfig
  )

  // Ensure data is an array before mapping
  const safeData = Array.isArray(data) ? data : [];
  const watchlistIds = new Set(safeData.map(item => item.asset_id))

  const addToWatchlist = async (assetId: number) => {
    // Optimistically update BEFORE the API call for instant feedback
    const optimisticData = [...safeData, { asset_id: assetId, created_at: new Date().toISOString() }];
    mutate(optimisticData, { revalidate: false });
    
    try {
      await apiPost(`${API_BASE}/dashboard/watchlist`, { asset_id: assetId });
      // Revalidate to confirm server state
      mutate();
      return true;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      // Rollback on error
      mutate(safeData, { revalidate: false });
      return false;
    }
  }

  const removeFromWatchlist = async (assetId: number) => {
    // Optimistically update BEFORE the API call for instant feedback
    const optimisticData = safeData.filter(item => item.asset_id !== assetId);
    mutate(optimisticData, { revalidate: false });
    
    try {
      await apiDelete(`${API_BASE}/dashboard/watchlist/${assetId}`);
      // Revalidate to confirm server state
      mutate();
      return true;
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      // Rollback on error
      mutate(safeData, { revalidate: false });
      return false;
    }
  }

  const toggleWatchlist = async (assetId: number) => {
    if (watchlistIds.has(assetId)) {
      return removeFromWatchlist(assetId)
    } else {
      return addToWatchlist(assetId)
    }
  }

  const isInWatchlist = (assetId: number) => watchlistIds.has(assetId)

  return {
    watchlist: safeData,
    watchlistIds,
    isLoading,
    error,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    isInWatchlist,
    mutate
  }
}

export function useWatchlistAssets() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE}/dashboard/watchlist/assets`,
    arrayFetcher,
    frequentUpdateSwrConfig
  )

  // Ensure data is an array
  const safeAssets = Array.isArray(data) ? data : [];

  return {
    assets: safeAssets,
    isLoading,
    error,
    mutate
  }
}

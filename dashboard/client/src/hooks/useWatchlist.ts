import useSWR from 'swr'
import { apiFetcher, apiPost, apiDelete, API_HEADERS } from '@/lib/api-config'

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
    {
      // Retry on error
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      // Revalidate on focus to catch stale data
      revalidateOnFocus: true,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Handle errors gracefully
      onError: (err) => {
        console.error('Watchlist fetch error:', err)
      }
    }
  )

  // Ensure data is an array before mapping
  const safeData = Array.isArray(data) ? data : [];
  const watchlistIds = new Set(safeData.map(item => item.asset_id))

  const addToWatchlist = async (assetId: number) => {
    try {
      await apiPost(`${API_BASE}/dashboard/watchlist`, { asset_id: assetId })
      
      // Optimistically update the cache
      mutate([...safeData, { asset_id: assetId, created_at: new Date().toISOString() }], false)
      
      return true
    } catch (error) {
      console.error('Error adding to watchlist:', error)
      return false
    }
  }

  const removeFromWatchlist = async (assetId: number) => {
    try {
      await apiDelete(`${API_BASE}/dashboard/watchlist/${assetId}`)
      
      // Optimistically update the cache
      mutate(safeData.filter(item => item.asset_id !== assetId), false)
      
      return true
    } catch (error) {
      console.error('Error removing from watchlist:', error)
      return false
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
    {
      // Retry on error
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      // Revalidate on focus to catch stale data
      revalidateOnFocus: true,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Handle errors gracefully
      onError: (err) => {
        console.error('Watchlist assets fetch error:', err)
      }
    }
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

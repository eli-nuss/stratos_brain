import useSWR from 'swr'

const API_BASE = '/api'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface WatchlistItem {
  asset_id: number
  created_at: string
}

export function useWatchlist() {
  const { data, error, isLoading, mutate } = useSWR<WatchlistItem[]>(
    `${API_BASE}/dashboard/watchlist`,
    fetcher
  )

  const watchlistIds = new Set(data?.map(item => item.asset_id) || [])

  const addToWatchlist = async (assetId: number) => {
    try {
      const response = await fetch(`${API_BASE}/dashboard/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId })
      })
      
      if (!response.ok) {
        throw new Error('Failed to add to watchlist')
      }
      
      // Optimistically update the cache
      mutate([...(data || []), { asset_id: assetId, created_at: new Date().toISOString() }], false)
      
      return true
    } catch (error) {
      console.error('Error adding to watchlist:', error)
      return false
    }
  }

  const removeFromWatchlist = async (assetId: number) => {
    try {
      const response = await fetch(`${API_BASE}/dashboard/watchlist/${assetId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to remove from watchlist')
      }
      
      // Optimistically update the cache
      mutate(data?.filter(item => item.asset_id !== assetId) || [], false)
      
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
    watchlist: data || [],
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
    fetcher
  )

  return {
    assets: data || [],
    isLoading,
    error,
    mutate
  }
}

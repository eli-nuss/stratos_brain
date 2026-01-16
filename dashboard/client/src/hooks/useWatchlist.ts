import useSWR from 'swr'

const API_BASE = '/api'

// Supabase anon key for API authentication
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmb2diYWlwaXFvb3RqcnNwcmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxOTQ4NDQsImV4cCI6MjA4MTc3MDg0NH0.DWjb0nVian7a9njxbGR9VjAsWQuWuHI375PgEHH1TRw';

// Enhanced fetcher with auth header and error handling
const fetcher = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-stratos-key': 'stratos_brain_api_key_2024',
    }
  })
  
  // Check if response is ok
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`API Error [${response.status}]: ${errorText}`)
    
    // Return empty array for auth errors to prevent UI breakage
    if (response.status === 401 || response.status === 403) {
      console.warn('Auth error on API call, returning empty data')
      return []
    }
    
    throw new Error(`API Error: ${response.status}`)
  }
  
  const data = await response.json()
  
  // Handle error responses that return as JSON
  if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
    console.error(`API returned error: ${data.message}`)
    // Return empty array for error responses to prevent UI breakage
    return []
  }
  
  return data
}

interface WatchlistItem {
  asset_id: number
  created_at: string
}

export function useWatchlist() {
  const { data, error, isLoading, mutate } = useSWR<WatchlistItem[]>(
    `${API_BASE}/dashboard/watchlist`,
    fetcher,
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
      const response = await fetch(`${API_BASE}/dashboard/watchlist`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-stratos-key': 'stratos_brain_api_key_2024',
        },
        body: JSON.stringify({ asset_id: assetId })
      })
      
      if (!response.ok) {
        throw new Error('Failed to add to watchlist')
      }
      
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
      const response = await fetch(`${API_BASE}/dashboard/watchlist/${assetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'x-stratos-key': 'stratos_brain_api_key_2024',
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to remove from watchlist')
      }
      
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
    fetcher,
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

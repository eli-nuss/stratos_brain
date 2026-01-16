import useSWR from 'swr';

// Enhanced fetcher with error handling
const fetcher = async (url: string) => {
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`API Error [${response.status}]: ${errorText}`);
    
    // Return empty array for auth errors to prevent UI breakage
    if (response.status === 401 || response.status === 403) {
      console.warn('Auth error on API call, returning empty data');
      return [];
    }
    
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Handle error responses that return as JSON
  if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
    console.error(`API returned error: ${data.message}`);
    return [];
  }
  
  return data;
};

export interface StockList {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  display_order: number;
}

// Get all stock lists
export function useStockLists() {
  const { data, error, isLoading, mutate } = useSWR<StockList[]>(
    '/api/dashboard/stock-lists',
    fetcher,
    {
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      onError: (err) => {
        console.error('Stock lists fetch error:', err);
      }
    }
  );

  // Ensure data is an array
  const safeLists = Array.isArray(data) ? data : [];

  return {
    lists: safeLists,
    isLoading,
    error,
    mutate,
  };
}

// Get assets in a specific list
export function useStockListAssets(listId: number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    listId ? `/api/dashboard/stock-lists/${listId}/assets` : null,
    fetcher,
    {
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      onError: (err) => {
        console.error('Stock list assets fetch error:', err);
      }
    }
  );

  // Ensure data is an array
  const safeAssets = Array.isArray(data) ? data : [];

  return {
    assets: safeAssets,
    isLoading,
    error,
    mutate,
  };
}

// Get lists that contain a specific asset
export function useAssetLists(assetId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<StockList[]>(
    assetId ? `/api/dashboard/stock-lists/asset/${assetId}` : null,
    fetcher,
    {
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      onError: (err) => {
        console.error('Asset lists fetch error:', err);
      }
    }
  );

  // Ensure data is an array
  const safeLists = Array.isArray(data) ? data : [];

  return {
    lists: safeLists,
    isLoading,
    error,
    mutate,
  };
}

// Add asset to a list
export async function addToList(listId: number, assetId: number) {
  const response = await fetch(`/api/dashboard/stock-lists/${listId}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId }),
  });
  return response.json();
}

// Remove asset from a list
export async function removeFromList(listId: number, assetId: number) {
  const response = await fetch(`/api/dashboard/stock-lists/${listId}/assets/${assetId}`, {
    method: 'DELETE',
  });
  return response.json();
}

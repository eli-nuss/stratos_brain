import useSWR from 'swr';
import { apiFetcher, defaultSwrConfig, getJsonApiHeaders, API_BASE } from '../lib/api-config';

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
    `${API_BASE}/dashboard/stock-lists`,
    apiFetcher,
    defaultSwrConfig
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
    listId ? `${API_BASE}/dashboard/stock-lists/${listId}/assets` : null,
    apiFetcher,
    defaultSwrConfig
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
    assetId ? `${API_BASE}/dashboard/stock-lists/asset/${assetId}` : null,
    apiFetcher,
    defaultSwrConfig
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
  const response = await fetch(`${API_BASE}/dashboard/stock-lists/${listId}/assets`, {
    method: 'POST',
    headers: getJsonApiHeaders(),
    body: JSON.stringify({ asset_id: assetId }),
  });
  return response.json();
}

// Remove asset from a list
export async function removeFromList(listId: number, assetId: number) {
  const response = await fetch(`${API_BASE}/dashboard/stock-lists/${listId}/assets/${assetId}`, {
    method: 'DELETE',
    headers: getJsonApiHeaders(),
  });
  return response.json();
}

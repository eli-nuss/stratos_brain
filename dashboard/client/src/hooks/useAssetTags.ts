import useSWR from 'swr';
import { apiFetcher, defaultSwrConfig, getJsonApiHeaders, getApiHeaders, API_BASE } from '../lib/api-config';

export type AssetTag = 'interesting' | 'maybe' | 'no';

export interface AssetTagItem {
  asset_id: number;
  tag: AssetTag;
  created_at: string;
  updated_at: string;
}

export function useAssetTags() {
  const { data, error, mutate } = useSWR<AssetTagItem[]>(
    `${API_BASE}/dashboard/asset-tags`,
    apiFetcher,
    defaultSwrConfig
  );
  
  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];
  
  const tagsMap = new Map<number, AssetTag>();
  safeData.forEach(item => tagsMap.set(item.asset_id, item.tag));
  
  return {
    tags: safeData,
    tagsMap,
    getTag: (assetId: number): AssetTag | null => tagsMap.get(assetId) || null,
    isLoading: !error && !data,
    error,
    mutate
  };
}

export async function setAssetTag(assetId: number, tag: AssetTag): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/asset-tags/${assetId}`, {
      method: 'PUT',
      headers: getJsonApiHeaders(),
      body: JSON.stringify({ tag })
    });
    return response.ok;
  } catch (error) {
    console.error('Error setting asset tag:', error);
    return false;
  }
}

export async function clearAssetTag(assetId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/asset-tags/${assetId}`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    return response.ok;
  } catch (error) {
    console.error('Error clearing asset tag:', error);
    return false;
  }
}

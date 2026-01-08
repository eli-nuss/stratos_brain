import useSWR from 'swr';

const API_BASE = '/api/dashboard';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export type AssetTag = 'interesting' | 'maybe' | 'no';

export interface AssetTagItem {
  asset_id: number;
  tag: AssetTag;
  created_at: string;
  updated_at: string;
}

export function useAssetTags() {
  const { data, error, mutate } = useSWR<AssetTagItem[]>(`${API_BASE}/asset-tags`, fetcher);
  
  const tagsMap = new Map<number, AssetTag>();
  (data || []).forEach(item => tagsMap.set(item.asset_id, item.tag));
  
  return {
    tags: data || [],
    tagsMap,
    getTag: (assetId: number): AssetTag | null => tagsMap.get(assetId) || null,
    isLoading: !error && !data,
    error,
    mutate
  };
}

export async function setAssetTag(assetId: number, tag: AssetTag): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/asset-tags/${assetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE}/asset-tags/${assetId}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error clearing asset tag:', error);
    return false;
  }
}

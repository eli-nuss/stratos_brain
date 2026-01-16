import useSWR from 'swr';
import { apiFetcher, defaultSwrConfig, getJsonApiHeaders, getApiHeaders, API_BASE } from '../lib/api-config';

export interface ReviewedItem {
  asset_id: number;
  reviewed_at: string;
}

export function useReviewed() {
  const { data, error, mutate } = useSWR<ReviewedItem[]>(
    `${API_BASE}/dashboard/reviewed`,
    apiFetcher,
    defaultSwrConfig
  );
  
  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];
  
  return {
    reviewed: safeData,
    reviewedIds: safeData.map(item => item.asset_id),
    isLoading: !error && !data,
    error,
    mutate
  };
}

export async function markAsReviewed(assetId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/reviewed`, {
      method: 'POST',
      headers: getJsonApiHeaders(),
      body: JSON.stringify({ asset_id: assetId })
    });
    return response.ok;
  } catch (error) {
    console.error('Error marking as reviewed:', error);
    return false;
  }
}

export async function unmarkAsReviewed(assetId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/reviewed/${assetId}`, {
      method: 'DELETE',
      headers: getApiHeaders(),
    });
    return response.ok;
  } catch (error) {
    console.error('Error unmarking as reviewed:', error);
    return false;
  }
}

export async function toggleReviewed(assetId: number, isCurrentlyReviewed: boolean): Promise<boolean> {
  if (isCurrentlyReviewed) {
    return unmarkAsReviewed(assetId);
  } else {
    return markAsReviewed(assetId);
  }
}

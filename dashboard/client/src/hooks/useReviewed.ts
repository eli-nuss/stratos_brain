import useSWR from 'swr';

const API_BASE = '/api/dashboard';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export interface ReviewedItem {
  asset_id: number;
  reviewed_at: string;
}

export function useReviewed() {
  const { data, error, mutate } = useSWR<ReviewedItem[]>(`${API_BASE}/reviewed`, fetcher);
  
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
    const response = await fetch(`${API_BASE}/reviewed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE}/reviewed/${assetId}`, {
      method: 'DELETE'
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

import useSWR from 'swr';

const API_BASE = '';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface CorePortfolioItem {
  asset_id: number;
  target_weight: number | null;
  notes: string | null;
  added_at: string;
}

export function useCorePortfolio() {
  const { data, error, isLoading, mutate } = useSWR<CorePortfolioItem[]>(
    `${API_BASE}/api/dashboard/core-portfolio`,
    fetcher
  );

  const portfolioIds = new Set(data?.map(item => item.asset_id) || []);

  const addToCorePortfolio = async (assetId: number, options?: { target_weight?: number; notes?: string }) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/core-portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          asset_id: assetId,
          target_weight: options?.target_weight,
          notes: options?.notes
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to core portfolio');
      }
      
      // Optimistically update the cache
      mutate([...(data || []), { 
        asset_id: assetId, 
        target_weight: options?.target_weight || null,
        notes: options?.notes || null,
        added_at: new Date().toISOString() 
      }], false);
      
      return true;
    } catch (error) {
      console.error('Error adding to core portfolio:', error);
      return false;
    }
  };

  const removeFromCorePortfolio = async (assetId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/core-portfolio/${assetId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from core portfolio');
      }
      
      // Optimistically update the cache
      mutate(data?.filter(item => item.asset_id !== assetId) || [], false);
      
      return true;
    } catch (error) {
      console.error('Error removing from core portfolio:', error);
      return false;
    }
  };

  const updateCorePortfolioItem = async (assetId: number, updates: { target_weight?: number; notes?: string }) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/core-portfolio/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update core portfolio item');
      }
      
      // Refresh the cache
      mutate();
      
      return true;
    } catch (error) {
      console.error('Error updating core portfolio item:', error);
      return false;
    }
  };

  const toggleCorePortfolio = async (assetId: number) => {
    if (portfolioIds.has(assetId)) {
      return removeFromCorePortfolio(assetId);
    } else {
      return addToCorePortfolio(assetId);
    }
  };

  const isInCorePortfolio = (assetId: number) => portfolioIds.has(assetId);

  return {
    portfolio: data || [],
    portfolioIds,
    isLoading,
    error,
    addToCorePortfolio,
    removeFromCorePortfolio,
    updateCorePortfolioItem,
    toggleCorePortfolio,
    isInCorePortfolio,
    mutate
  };
}

export function useCorePortfolioAssets() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE}/api/dashboard/core-portfolio/assets`,
    fetcher
  );

  return {
    assets: data || [],
    isLoading,
    error,
    mutate
  };
}

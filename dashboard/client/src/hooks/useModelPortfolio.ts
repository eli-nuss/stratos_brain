import useSWR from 'swr';

const API_BASE = '';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ModelPortfolioItem {
  asset_id: number;
  target_weight: number | null;
  notes: string | null;
  added_at: string;
}

export function useModelPortfolio() {
  const { data, error, isLoading, mutate } = useSWR<ModelPortfolioItem[]>(
    `${API_BASE}/api/dashboard/model-portfolio`,
    fetcher
  );

  const portfolioIds = new Set(data?.map(item => item.asset_id) || []);

  const addToModelPortfolio = async (assetId: number, options?: { target_weight?: number; notes?: string }) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/model-portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          asset_id: assetId,
          target_weight: options?.target_weight,
          notes: options?.notes
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to model portfolio');
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
      console.error('Error adding to model portfolio:', error);
      return false;
    }
  };

  const removeFromModelPortfolio = async (assetId: number) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/model-portfolio/${assetId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from model portfolio');
      }
      
      // Optimistically update the cache
      mutate(data?.filter(item => item.asset_id !== assetId) || [], false);
      
      return true;
    } catch (error) {
      console.error('Error removing from model portfolio:', error);
      return false;
    }
  };

  const updateModelPortfolioItem = async (assetId: number, updates: { target_weight?: number; notes?: string }) => {
    try {
      const response = await fetch(`${API_BASE}/api/dashboard/model-portfolio/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update model portfolio item');
      }
      
      // Refresh the cache
      mutate();
      
      return true;
    } catch (error) {
      console.error('Error updating model portfolio item:', error);
      return false;
    }
  };

  const toggleModelPortfolio = async (assetId: number) => {
    if (portfolioIds.has(assetId)) {
      return removeFromModelPortfolio(assetId);
    } else {
      return addToModelPortfolio(assetId);
    }
  };

  const isInModelPortfolio = (assetId: number) => portfolioIds.has(assetId);

  return {
    portfolio: data || [],
    portfolioIds,
    isLoading,
    error,
    addToModelPortfolio,
    removeFromModelPortfolio,
    updateModelPortfolioItem,
    toggleModelPortfolio,
    isInModelPortfolio,
    mutate
  };
}

export function useModelPortfolioAssets() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE}/api/dashboard/model-portfolio/assets`,
    fetcher
  );

  return {
    assets: data || [],
    isLoading,
    error,
    mutate
  };
}

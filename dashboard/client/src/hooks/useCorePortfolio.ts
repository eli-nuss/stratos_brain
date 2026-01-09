import useSWR from 'swr';

const API_BASE = '';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const data = await res.json();
  // Ensure we always return an array
  return Array.isArray(data) ? data : [];
};

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

  // Ensure data is always an array before mapping
  const safeData = Array.isArray(data) ? data : [];
  const portfolioIds = new Set(safeData.map(item => item.asset_id));

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
      mutate([...safeData, { 
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
      mutate(safeData.filter(item => item.asset_id !== assetId), false);
      
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
    portfolio: safeData,
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

  // Ensure assets is always an array
  const assets = Array.isArray(data) ? data : [];

  return {
    assets,
    isLoading,
    error,
    mutate
  };
}

// New hook for the redesigned core portfolio holdings
export function useCorePortfolioHoldingsCheck() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE}/api/core-portfolio-holdings`,
    fetcher
  );

  const safeData = Array.isArray(data) ? data : [];
  const holdingAssetIds = new Set(safeData.filter(h => h.asset_id).map(h => h.asset_id));

  const addToCoreHoldings = async (assetId: number, assetType?: string) => {
    try {
      // Determine category based on asset type
      let category = 'other';
      if (assetType === 'crypto') {
        category = 'tokens';
      } else if (assetType === 'equity') {
        category = 'equities';
      }

      const response = await fetch(`${API_BASE}/api/core-portfolio-holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          asset_id: assetId,
          category,
          quantity: 0
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to core holdings');
      }
      
      mutate();
      return true;
    } catch (error) {
      console.error('Error adding to core holdings:', error);
      return false;
    }
  };

  const removeFromCoreHoldings = async (assetId: number) => {
    try {
      // Find the holding by asset_id
      const holding = safeData.find(h => h.asset_id === assetId);
      if (!holding) return false;

      const response = await fetch(`${API_BASE}/api/core-portfolio-holdings/${holding.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from core holdings');
      }
      
      mutate();
      return true;
    } catch (error) {
      console.error('Error removing from core holdings:', error);
      return false;
    }
  };

  const isInCoreHoldings = (assetId: number) => holdingAssetIds.has(assetId);

  return {
    holdings: safeData,
    holdingAssetIds,
    isLoading,
    error,
    addToCoreHoldings,
    removeFromCoreHoldings,
    isInCoreHoldings,
    mutate
  };
}

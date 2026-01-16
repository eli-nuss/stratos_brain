import useSWR from 'swr';
import { apiFetcher, apiPost, apiDelete, apiPatch } from '@/lib/api-config';

const API_BASE = '';

// Wrapper to ensure array return
const arrayFetcher = async (url: string) => {
  const data = await apiFetcher(url);
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
    arrayFetcher
  );

  // Ensure data is always an array before mapping
  const safeData = Array.isArray(data) ? data : [];
  const portfolioIds = new Set(safeData.map(item => item.asset_id));

  const addToCorePortfolio = async (assetId: number, options?: { target_weight?: number; notes?: string }) => {
    try {
      await apiPost(`${API_BASE}/api/dashboard/core-portfolio`, { 
        asset_id: assetId,
        target_weight: options?.target_weight,
        notes: options?.notes
      });
      
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
      await apiDelete(`${API_BASE}/api/dashboard/core-portfolio/${assetId}`);
      
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
      await apiPatch(`${API_BASE}/api/dashboard/core-portfolio/${assetId}`, updates);
      
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
    arrayFetcher
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
    `${API_BASE}/api/dashboard/core-portfolio-holdings`,
    arrayFetcher
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

      await apiPost(`${API_BASE}/api/dashboard/core-portfolio-holdings`, { 
        asset_id: assetId,
        category,
        quantity: 0
      });
      
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

      await apiDelete(`${API_BASE}/api/dashboard/core-portfolio-holdings/${holding.id}`);
      
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

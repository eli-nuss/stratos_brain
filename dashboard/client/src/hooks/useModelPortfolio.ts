import useSWR from 'swr';
import { apiFetcher, apiPost, apiDelete, apiPatch } from '@/lib/api-config';

const API_BASE = '';

// Wrapper to ensure array return
const arrayFetcher = async (url: string) => {
  const data = await apiFetcher(url);
  return Array.isArray(data) ? data : [];
};

export interface ModelPortfolioItem {
  asset_id: number;
  target_weight: number | null;
  notes: string | null;
  added_at: string;
}

export function useModelPortfolio() {
  const { data, error, isLoading, mutate } = useSWR<ModelPortfolioItem[]>(
    `${API_BASE}/api/dashboard/model-portfolio`,
    arrayFetcher
  );

  // Ensure data is always an array before mapping
  const safeData = Array.isArray(data) ? data : [];
  const portfolioIds = new Set(safeData.map(item => item.asset_id));

  const addToModelPortfolio = async (assetId: number, options?: { target_weight?: number; notes?: string }) => {
    try {
      await apiPost(`${API_BASE}/api/dashboard/model-portfolio`, { 
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
      console.error('Error adding to model portfolio:', error);
      return false;
    }
  };

  const removeFromModelPortfolio = async (assetId: number) => {
    try {
      await apiDelete(`${API_BASE}/api/dashboard/model-portfolio/${assetId}`);
      
      // Optimistically update the cache
      mutate(safeData.filter(item => item.asset_id !== assetId), false);
      
      return true;
    } catch (error) {
      console.error('Error removing from model portfolio:', error);
      return false;
    }
  };

  const updateModelPortfolioItem = async (assetId: number, updates: { target_weight?: number; notes?: string }) => {
    try {
      await apiPatch(`${API_BASE}/api/dashboard/model-portfolio/${assetId}`, updates);
      
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
    portfolio: safeData,
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

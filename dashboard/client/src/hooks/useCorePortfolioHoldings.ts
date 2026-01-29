import useSWR from "swr";
import { apiFetcher, apiPost, apiPatch, apiDelete } from "@/lib/api-config";

// Wrapper to ensure array return
const arrayFetcher = async (url: string) => {
  const data = await apiFetcher(url);
  return Array.isArray(data) ? data : [];
};

export type PortfolioCategory = 'dats' | 'tokens' | 'equities' | 'options' | 'cash' | 'other';

export interface CorePortfolioHolding {
  id: number;
  asset_id: number | null;
  custom_symbol: string | null;
  custom_name: string | null;
  custom_asset_type: string | null;
  category: PortfolioCategory;
  quantity: number;
  cost_basis: number | null;
  total_cost: number | null;
  strike_price: number | null;
  expiration_date: string | null;
  option_type: string | null;
  manual_price: number | null;
  notes: string | null;
  display_order: number;
  is_active: boolean;
  added_at: string;
  updated_at: string;
  // Computed fields from view
  symbol: string;
  name: string;
  asset_type: string;
  sector: string | null;
  industry: string | null;
  current_price: number | null;
  current_value: number | null;
  gain_loss_pct: number | null;
  gain_loss_value: number | null;
}

export interface PortfolioSummary {
  total_positions: number;
  total_value: number;
  total_cost: number;
  total_gain_loss_pct: number;
  total_gain_loss_value: number;
}

export interface CategorySummary {
  category: PortfolioCategory;
  position_count: number;
  category_value: number;
  category_cost: number;
  category_gain_loss_pct: number;
  weight_pct: number;
}

export interface AddHoldingInput {
  asset_id?: number | null;
  custom_symbol?: string | null;
  custom_name?: string | null;
  custom_asset_type?: string | null;
  category: PortfolioCategory;
  quantity: number;
  cost_basis?: number | null;
  total_cost?: number | null;
  strike_price?: number | null;
  expiration_date?: string | null;
  option_type?: string | null;
  manual_price?: number | null;
  notes?: string | null;
}

export interface UpdateHoldingInput {
  id: number;
  quantity?: number;
  cost_basis?: number | null;
  total_cost?: number | null;
  strike_price?: number | null;
  expiration_date?: string | null;
  option_type?: string | null;
  manual_price?: number | null;
  notes?: string | null;
  category?: PortfolioCategory;
  display_order?: number;
}

// Hook to fetch all portfolio holdings
export function useCorePortfolioHoldings() {
  const { data, error, isLoading, mutate } = useSWR<CorePortfolioHolding[]>(
    "/api/dashboard/core-portfolio-holdings",
    arrayFetcher
  );

  // Ensure holdings is always an array
  const holdings = Array.isArray(data) ? data : [];

  return {
    holdings,
    isLoading,
    isError: error,
    mutate,
  };
}

// Hook to get portfolio summary
export function useCorePortfolioSummary() {
  const { holdings } = useCorePortfolioHoldings();
  
  // Ensure holdings is an array
  const safeHoldings = Array.isArray(holdings) ? holdings : [];
  
  const summary: PortfolioSummary = {
    total_positions: safeHoldings.length,
    total_value: safeHoldings.reduce((sum, h) => sum + (h.current_value || 0), 0),
    total_cost: safeHoldings.reduce((sum, h) => sum + (h.total_cost || 0), 0),
    total_gain_loss_pct: 0,
    total_gain_loss_value: 0,
  };
  
  if (summary.total_cost > 0) {
    summary.total_gain_loss_value = summary.total_value - summary.total_cost;
    summary.total_gain_loss_pct = (summary.total_gain_loss_value / summary.total_cost) * 100;
  }
  
  return summary;
}

// Hook to get holdings grouped by category
export function useCorePortfolioByCategory() {
  const { holdings, isLoading, mutate } = useCorePortfolioHoldings();
  
  // Ensure holdings is an array
  const safeHoldings = Array.isArray(holdings) ? holdings : [];
  
  const totalValue = safeHoldings.reduce((sum, h) => sum + (h.current_value || 0), 0);
  
  const categories: Record<PortfolioCategory, CorePortfolioHolding[]> = {
    dats: [],
    tokens: [],
    equities: [],
    options: [],
    cash: [],
    other: [],
  };
  
  // Sort holdings by id for stable ordering (id is auto-incrementing)
  const sortedHoldings = [...safeHoldings].sort((a, b) => a.id - b.id);
  
  sortedHoldings.forEach((h) => {
    if (h.category && categories[h.category]) {
      categories[h.category].push(h);
    } else {
      categories.other.push(h);
    }
  });
  
  const categorySummaries: CategorySummary[] = Object.entries(categories)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => {
      const categoryValue = items.reduce((sum, h) => sum + (h.current_value || 0), 0);
      const categoryCost = items.reduce((sum, h) => sum + (h.total_cost || 0), 0);
      return {
        category: category as PortfolioCategory,
        position_count: items.length,
        category_value: categoryValue,
        category_cost: categoryCost,
        category_gain_loss_pct: categoryCost > 0 ? ((categoryValue - categoryCost) / categoryCost) * 100 : 0,
        weight_pct: totalValue > 0 ? (categoryValue / totalValue) * 100 : 0,
      };
    });
  
  return {
    categories,
    categorySummaries,
    totalValue,
    isLoading,
    mutate,
  };
}

// Add a new holding
export async function addHolding(input: AddHoldingInput): Promise<CorePortfolioHolding> {
  return apiPost("/api/dashboard/core-portfolio-holdings", input);
}

// Update an existing holding
export async function updateHolding(input: UpdateHoldingInput): Promise<CorePortfolioHolding> {
  return apiPatch(`/api/dashboard/core-portfolio-holdings/${input.id}`, input);
}

// Remove a holding (soft delete)
export async function removeHolding(id: number): Promise<void> {
  return apiDelete(`/api/dashboard/core-portfolio-holdings/${id}`);
}

// Add holding from existing asset
export async function addHoldingFromAsset(
  assetId: number,
  category: PortfolioCategory,
  quantity: number,
  costBasis?: number,
  notes?: string
): Promise<CorePortfolioHolding> {
  return addHolding({
    asset_id: assetId,
    category,
    quantity,
    cost_basis: costBasis,
    total_cost: costBasis ? quantity * costBasis : undefined,
    notes,
  });
}

// Category display names
export const CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  dats: "DATS",
  tokens: "Tokens",
  equities: "Equities",
  options: "Options",
  cash: "Cash",
  other: "Other",
};

// Category order for display
export const CATEGORY_ORDER: PortfolioCategory[] = [
  'dats',
  'tokens',
  'equities',
  'options',
  'cash',
  'other',
];

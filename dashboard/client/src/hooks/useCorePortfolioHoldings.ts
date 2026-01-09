import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
    "/api/core-portfolio-holdings",
    fetcher
  );

  return {
    holdings: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// Hook to get portfolio summary
export function useCorePortfolioSummary() {
  const { holdings } = useCorePortfolioHoldings();
  
  const summary: PortfolioSummary = {
    total_positions: holdings.length,
    total_value: holdings.reduce((sum, h) => sum + (h.current_value || 0), 0),
    total_cost: holdings.reduce((sum, h) => sum + (h.total_cost || 0), 0),
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
  
  const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);
  
  const categories: Record<PortfolioCategory, CorePortfolioHolding[]> = {
    dats: [],
    tokens: [],
    equities: [],
    options: [],
    cash: [],
    other: [],
  };
  
  holdings.forEach((h) => {
    categories[h.category].push(h);
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
  const response = await fetch("/api/core-portfolio-holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error("Failed to add holding");
  }
  
  return response.json();
}

// Update an existing holding
export async function updateHolding(input: UpdateHoldingInput): Promise<CorePortfolioHolding> {
  const response = await fetch(`/api/core-portfolio-holdings/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update holding");
  }
  
  return response.json();
}

// Remove a holding (soft delete)
export async function removeHolding(id: number): Promise<void> {
  const response = await fetch(`/api/core-portfolio-holdings/${id}`, {
    method: "DELETE",
  });
  
  if (!response.ok) {
    throw new Error("Failed to remove holding");
  }
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

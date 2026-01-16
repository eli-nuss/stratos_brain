import useSWR from "swr";
import { apiFetcher } from "@/lib/api-config";

// Wrapper to ensure array return
const arrayFetcher = async (url: string) => {
  const data = await apiFetcher(url);
  return Array.isArray(data) ? data : [];
};

export type PortfolioCategory = 'dats' | 'tokens' | 'equities' | 'options' | 'cash' | 'other';

export interface ModelPortfolioHolding {
  id: number;
  asset_id: number | null;
  custom_symbol: string | null;
  custom_name: string | null;
  custom_asset_type: string | null;
  category: PortfolioCategory;
  target_weight: number | null;
  strike_price: number | null;
  expiration_date: string | null;
  option_type: string | null;
  manual_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields from view
  symbol: string;
  name: string;
  asset_type: string;
  current_price: number | null;
  // These will be calculated client-side based on Core Portfolio value
  target_value?: number | null;
  target_quantity?: number | null;
}

export interface CorePortfolioHolding {
  id: number;
  current_value: number | null;
  total_cost: number | null;
}

export interface CategorySummary {
  category: PortfolioCategory;
  position_count: number;
  target_weight_pct: number;
  target_value: number;
}

export interface AddHoldingInput {
  asset_id?: number | null;
  custom_symbol?: string | null;
  custom_name?: string | null;
  custom_asset_type?: string | null;
  category: PortfolioCategory;
  target_weight?: number | null;
  strike_price?: number | null;
  expiration_date?: string | null;
  option_type?: string | null;
  manual_price?: number | null;
  notes?: string | null;
}

export interface UpdateHoldingInput {
  id: number;
  target_weight?: number | null;
  strike_price?: number | null;
  expiration_date?: string | null;
  option_type?: string | null;
  manual_price?: number | null;
  notes?: string | null;
  category?: PortfolioCategory;
}

// Hook to fetch Core Portfolio total value
export function useCorePortfolioValue() {
  const { data, error, isLoading } = useSWR<CorePortfolioHolding[]>(
    "/api/dashboard/core-portfolio-holdings",
    arrayFetcher
  );

  const holdings = Array.isArray(data) ? data : [];
  const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);

  return {
    totalValue,
    isLoading,
    isError: error,
  };
}

// Hook to fetch all model portfolio holdings
export function useModelPortfolioHoldings() {
  const { data, error, isLoading, mutate } = useSWR<ModelPortfolioHolding[]>(
    "/api/dashboard/model-portfolio-holdings",
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

// Hook to get model portfolio with calculated values based on Core Portfolio
export function useModelPortfolioWithValues() {
  const { holdings, isLoading: holdingsLoading, mutate } = useModelPortfolioHoldings();
  const { totalValue: corePortfolioValue, isLoading: coreLoading } = useCorePortfolioValue();

  // Calculate target values and quantities based on weights
  const holdingsWithValues = holdings.map(h => {
    const targetWeight = h.target_weight || 0;
    const targetValue = corePortfolioValue * (targetWeight / 100);
    const currentPrice = h.current_price || h.manual_price || 0;
    const targetQuantity = currentPrice > 0 ? targetValue / currentPrice : 0;

    return {
      ...h,
      target_value: targetValue,
      target_quantity: targetQuantity,
    };
  });

  // Calculate total weight
  const totalWeight = holdings.reduce((sum, h) => sum + (h.target_weight || 0), 0);

  return {
    holdings: holdingsWithValues,
    corePortfolioValue,
    totalWeight,
    isLoading: holdingsLoading || coreLoading,
    mutate,
  };
}

// Hook to get holdings grouped by category with calculated values
export function useModelPortfolioByCategory() {
  const { holdings, corePortfolioValue, totalWeight, isLoading, mutate } = useModelPortfolioWithValues();

  const categories: Record<PortfolioCategory, (ModelPortfolioHolding & { target_value?: number; target_quantity?: number })[]> = {
    dats: [],
    tokens: [],
    equities: [],
    options: [],
    cash: [],
    other: [],
  };

  holdings.forEach((h) => {
    if (h.category && categories[h.category]) {
      categories[h.category].push(h);
    } else {
      categories.other.push(h);
    }
  });

  const categorySummaries: CategorySummary[] = Object.entries(categories)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => {
      const targetWeightPct = items.reduce((sum, h) => sum + (h.target_weight || 0), 0);
      const targetValue = items.reduce((sum, h) => sum + (h.target_value || 0), 0);
      return {
        category: category as PortfolioCategory,
        position_count: items.length,
        target_weight_pct: targetWeightPct,
        target_value: targetValue,
      };
    });

  return {
    categories,
    categorySummaries,
    corePortfolioValue,
    totalWeight,
    isLoading,
    mutate,
  };
}

// Add a new holding
export async function addModelHolding(input: AddHoldingInput): Promise<ModelPortfolioHolding> {
  const response = await fetch("/api/dashboard/model-portfolio-holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      quantity: 0, // Quantity is calculated, not stored
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to add holding");
  }

  return response.json();
}

// Update an existing holding
export async function updateModelHolding(input: UpdateHoldingInput): Promise<ModelPortfolioHolding> {
  const response = await fetch(`/api/dashboard/model-portfolio-holdings/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to update holding");
  }

  return response.json();
}

// Remove a holding
export async function removeModelHolding(id: number): Promise<void> {
  const response = await fetch(`/api/dashboard/model-portfolio-holdings/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to remove holding");
  }
}

// Add holding from existing asset with target weight
export async function addModelHoldingFromAsset(
  assetId: number,
  category: PortfolioCategory,
  targetWeight: number,
  notes?: string
): Promise<ModelPortfolioHolding> {
  return addModelHolding({
    asset_id: assetId,
    category,
    target_weight: targetWeight,
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

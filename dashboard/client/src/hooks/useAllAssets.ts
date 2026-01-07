import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type AssetType = "crypto" | "equity";
export type SortField = "weighted_score" | "symbol" | "score_delta" | "inflection_score" | "ai_confidence" | "ai_setup_quality_score" | "ai_direction_score" | "market_cap" | "return_1d" | "return_7d" | "return_30d" | "return_365d" | "close" | "dollar_volume_7d" | "dollar_volume_30d" | "industry" | "pe_ratio" | "forward_pe" | "peg_ratio" | "price_to_sales_ttm" | "forward_ps" | "psg";
export type SortOrder = "asc" | "desc";

interface UseAllAssetsParams {
  assetType: AssetType;
  date?: string;
  limit?: number;
  offset?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  secondarySortBy?: SortField | null;
  secondarySortOrder?: SortOrder;
  search?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  industry?: string;
}

interface AllAssetsResponse {
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

export function useAllAssets({
  assetType,
  date,
  limit = 50,
  offset = 0,
  sortBy = "ai_setup_quality_score", // Default to AI quality score
  sortOrder = "desc",
  secondarySortBy = null,
  secondarySortOrder = "desc",
  search,
  minMarketCap,
  maxMarketCap,
  industry,
}: UseAllAssetsParams) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    universe_id: assetType === "crypto" ? "crypto_all" : "equity_all",
    sort_by: sortBy || "ai_setup_quality_score", // Default to AI score
    sort_order: sortOrder,
  });

  if (secondarySortBy) {
    params.append("secondary_sort_by", secondarySortBy);
    params.append("secondary_sort_order", secondarySortOrder);
  }

  if (date) {
    params.append("as_of_date", date);
  }

  if (search) {
    params.append("search", search);
  }

  if (minMarketCap !== undefined) {
    params.append("min_market_cap", (minMarketCap * 1e9).toString()); // Convert B to actual
  }

  if (maxMarketCap !== undefined) {
    params.append("max_market_cap", (maxMarketCap * 1e9).toString()); // Convert B to actual
  }

  if (industry) {
    params.append("industry", industry);
  }

  const url = `/api/dashboard/all-assets?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<AllAssetsResponse>(
    date ? url : null,
    fetcher,
    {
      refreshInterval: 60000,
      keepPreviousData: true,
    }
  );

  const assets = data?.data || [];
  
  return {
    data: assets,
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
  };
}

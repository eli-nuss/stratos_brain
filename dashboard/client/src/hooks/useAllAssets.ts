import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type AssetType = "crypto" | "equity";
export type SortField = "weighted_score" | "symbol" | "score_delta" | "inflection_score" | "ai_confidence" | "ai_setup_quality_score" | "ai_direction_score" | "market_cap" | "return_1d" | "return_7d" | "return_30d" | "close";
export type SortOrder = "asc" | "desc";

interface UseAllAssetsParams {
  assetType: AssetType;
  date?: string;
  limit?: number;
  offset?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  search?: string;
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
  search,
}: UseAllAssetsParams) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    universe_id: assetType === "crypto" ? "crypto_all" : "equities_all",
    sort_by: sortBy || "ai_setup_quality_score", // Default to AI score
    sort_order: sortOrder,
  });

  if (date) {
    params.append("as_of_date", date);
  }

  if (search) {
    params.append("search", search);
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

  return {
    data: data?.data || [],
    total: data?.total || 0,
    isLoading,
    error,
    mutate,
  };
}

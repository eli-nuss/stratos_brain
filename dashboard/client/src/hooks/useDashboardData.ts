import useSWR from "swr";
import { apiFetcher, defaultSwrConfig, API_BASE } from "../lib/api-config";

export type AssetType = "crypto" | "equity";
export type TableType = "inflections_bullish" | "inflections_bearish" | "trends" | "risk";

interface UseDashboardDataParams {
  type: TableType;
  assetType: AssetType;
  date?: string;
  limit?: number;
  offset?: number;
}

export function useDashboardData({
  type,
  assetType,
  date,
  limit = 25,
  offset = 0,
}: UseDashboardDataParams) {
  // Map table type to API endpoint and params
  let endpoint = "";
  let params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    universe_id: assetType === "crypto" ? "crypto_all" : "equities_top500", // Default universes
  });

  if (date) {
    params.append("as_of_date", date);
  }

  switch (type) {
    case "inflections_bullish":
      endpoint = `${API_BASE}/dashboard/inflections`;
      params.append("direction", "bullish");
      break;
    case "inflections_bearish":
      endpoint = `${API_BASE}/dashboard/inflections`;
      params.append("direction", "bearish");
      break;
    case "trends":
      endpoint = `${API_BASE}/dashboard/trends`;
      break;
    case "risk":
      endpoint = `${API_BASE}/dashboard/risk`;
      break;
  }

  const url = `${endpoint}?${params.toString()}`;
  
  const { data, error, isLoading } = useSWR(date ? url : null, apiFetcher, {
    ...defaultSwrConfig,
    refreshInterval: 60000,
    keepPreviousData: false,
  });

  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];

  return {
    data: safeData,
    isLoading,
    error,
  };
}

import { useState } from "react";
import useSWR from "swr";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetcher } from "@/lib/api-config";

interface MarketIndex {
  index_id: number;
  symbol: string;
  name: string;
  region: string;
  country: string;
  index_type: string;
  last_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  return_1d: number;
  return_7d: number;
  return_30d: number;
  return_365d: number;
}

type SortField = "symbol" | "name" | "close" | "return_1d" | "return_7d";

export default function IndicesTable() {
  const [sortBy, setSortBy] = useState<SortField>("symbol");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data, error, isLoading } = useSWR(
    `/api/dashboard/indices?sort_by=${sortBy}&sort_order=${sortOrder}`,
    apiFetcher
  );

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const formatNumber = (num: number | null, decimals = 2) => {
    if (num === null || num === undefined) return "-";
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatPercent = (num: number | null) => {
    if (num === null || num === undefined) return "-";
    const formatted = num.toFixed(2);
    return num >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field ? (
          sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );

  if (error) return <div className="p-4 text-red-500">Error loading indices</div>;

  // Group indices by region
  const groupedByRegion: Record<string, MarketIndex[]> = {};
  data?.data?.forEach((idx: MarketIndex) => {
    const region = idx.region || "Other";
    if (!groupedByRegion[region]) groupedByRegion[region] = [];
    groupedByRegion[region].push(idx);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">Global Market Indices</h2>
          <p className="text-xs text-muted-foreground">
            {data?.total || 0} indices across {Object.keys(groupedByRegion).length} regions
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card border-b border-border">
            <tr>
              <SortHeader field="symbol" label="Symbol" />
              <SortHeader field="name" label="Name" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Region</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Country</th>
              <SortHeader field="close" label="Value" />
              <SortHeader field="return_1d" label="1D" />
              <SortHeader field="return_7d" label="7D" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">30D</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">1Y</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : (
              data?.data?.map((idx: MarketIndex) => (
                <tr
                  key={idx.index_id}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2 text-sm font-medium">{idx.symbol}</td>
                  <td className="px-3 py-2 text-sm text-muted-foreground truncate max-w-[250px]">{idx.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{idx.region || "-"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{idx.country || "-"}</td>
                  <td className="px-3 py-2 text-sm">{formatNumber(idx.close)}</td>
                  <td className={cn("px-3 py-2 text-sm", idx.return_1d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(idx.return_1d)}
                  </td>
                  <td className={cn("px-3 py-2 text-sm", idx.return_7d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(idx.return_7d)}
                  </td>
                  <td className={cn("px-3 py-2 text-sm", idx.return_30d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(idx.return_30d)}
                  </td>
                  <td className={cn("px-3 py-2 text-sm", idx.return_365d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(idx.return_365d)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

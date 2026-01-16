import { useState } from "react";
import useSWR from "swr";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetcher } from "@/lib/api-config";

interface ETF {
  etf_id: number;
  symbol: string;
  name: string;
  asset_class: string;
  geography: string;
  category: string;
  issuer: string;
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
  dollar_volume: number;
}

type SortField = "symbol" | "name" | "close" | "return_1d" | "return_7d" | "return_30d" | "return_365d" | "dollar_volume";

export default function ETFTable() {
  const [sortBy, setSortBy] = useState<SortField>("dollar_volume");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, error, isLoading } = useSWR(
    `/api/dashboard/etfs?sort_by=${sortBy}&sort_order=${sortOrder}${search ? `&search=${search}` : ""}`,
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

  const formatVolume = (num: number | null) => {
    if (num === null || num === undefined) return "-";
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
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

  if (error) return <div className="p-4 text-red-500">Error loading ETFs</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">ETFs Overview</h2>
          <p className="text-xs text-muted-foreground">
            {data?.total || 0} ETFs
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ETFs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-muted/30 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card border-b border-border">
            <tr>
              <SortHeader field="symbol" label="Symbol" />
              <SortHeader field="name" label="Name" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
              <SortHeader field="close" label="Price" />
              <SortHeader field="return_1d" label="1D" />
              <SortHeader field="return_7d" label="7D" />
              <SortHeader field="return_30d" label="30D" />
              <SortHeader field="return_365d" label="1Y" />
              <SortHeader field="dollar_volume" label="$ Volume" />
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
              data?.data?.map((etf: ETF) => (
                <tr
                  key={etf.etf_id}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2 text-sm font-medium">{etf.symbol}</td>
                  <td className="px-3 py-2 text-sm text-muted-foreground truncate max-w-[200px]">{etf.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{etf.category || "-"}</td>
                  <td className="px-3 py-2 text-sm">${formatNumber(etf.close)}</td>
                  <td className={cn("px-3 py-2 text-sm", etf.return_1d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(etf.return_1d)}
                  </td>
                  <td className={cn("px-3 py-2 text-sm", etf.return_7d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(etf.return_7d)}
                  </td>
                  <td className={cn("px-3 py-2 text-sm", etf.return_30d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(etf.return_30d)}
                  </td>
                  <td className={cn("px-3 py-2 text-sm", etf.return_365d >= 0 ? "text-green-500" : "text-red-500")}>
                    {formatPercent(etf.return_365d)}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">{formatVolume(etf.dollar_volume)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

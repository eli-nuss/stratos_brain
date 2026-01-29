import { useState } from "react";
import useSWR from "swr";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetcher } from "@/lib/api-config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MarketIndex {
  index_id: number;
  asset_id: number;
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
  // Setup fields
  setup_count: number;
  setup_names: string[];
  best_risk_reward: number;
  avg_profit_factor: number;
}

interface IndicesTableProps {
  onAssetClick?: (assetId: string) => void;
}

type SortField = "symbol" | "name" | "close" | "return_1d" | "return_7d" | "setup_count" | "best_risk_reward";

// Setup name display mapping
const setupDisplayNames: Record<string, string> = {
  donchian_55_breakout: "Donchian 55",
  golden_cross: "Golden Cross",
  trend_pullback_50ma: "50MA Pullback",
  gap_up_momentum: "Gap Up",
  adx_holy_grail: "ADX Holy Grail",
  oversold_bounce: "Oversold Bounce",
};

export default function IndicesTable({ onAssetClick }: IndicesTableProps) {
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

  const handleRowClick = (idx: MarketIndex) => {
    if (onAssetClick && idx.asset_id) {
      onAssetClick(String(idx.asset_id));
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

  const formatRiskReward = (num: number | null) => {
    if (num === null || num === undefined || num === 0) return "-";
    return `${num.toFixed(1)}:1`;
  };

  const formatProfitFactor = (num: number | null) => {
    if (num === null || num === undefined || num === 0) return "-";
    return num.toFixed(2);
  };

  const getSetupDisplay = (names: string[] | null) => {
    if (!names || names.length === 0) return null;
    return names.map(name => setupDisplayNames[name] || name);
  };

  const SortHeader = ({ field, label, tooltip }: { field: SortField; label: string; tooltip?: string }) => {
    const content = (
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field ? (
          sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    );

    if (tooltip) {
      return (
        <th
          className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => handleSort(field)}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </th>
      );
    }

    return (
      <th
        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={() => handleSort(field)}
      >
        {content}
      </th>
    );
  };

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
              <SortHeader field="setup_count" label="Setups" tooltip="Number of active trading setups (last 7 days)" />
              <SortHeader field="best_risk_reward" label="R:R" tooltip="Best risk/reward ratio among active setups" />
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
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : (
              data?.data?.map((idx: MarketIndex) => {
                const setupNames = getSetupDisplay(idx.setup_names);
                const hasSetups = idx.setup_count > 0;
                const isClickable = !!onAssetClick && !!idx.asset_id;
                
                return (
                  <tr
                    key={idx.index_id}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      isClickable && "cursor-pointer"
                    )}
                    onClick={() => handleRowClick(idx)}
                  >
                    <td className="px-3 py-2 text-sm font-medium">{idx.symbol}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground truncate max-w-[250px]">{idx.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{idx.region || "-"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{idx.country || "-"}</td>
                    <td className="px-3 py-2">
                      {hasSetups ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-green-500" />
                              <span className="text-sm font-medium text-green-500">{idx.setup_count}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <p className="font-medium mb-1">Active Setups:</p>
                              {setupNames?.map((name, i) => (
                                <p key={i}>• {name}</p>
                              ))}
                              {idx.avg_profit_factor > 0 && (
                                <p className="mt-1 text-muted-foreground">
                                  Avg Profit Factor: {formatProfitFactor(idx.avg_profit_factor)}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn(
                        "text-sm",
                        idx.best_risk_reward >= 3 ? "text-green-500 font-medium" :
                        idx.best_risk_reward >= 2 ? "text-yellow-500" : "text-muted-foreground"
                      )}>
                        {formatRiskReward(idx.best_risk_reward)}
                      </span>
                    </td>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

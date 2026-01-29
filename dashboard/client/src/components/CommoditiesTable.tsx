import { useState } from "react";
import useSWR from "swr";
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetcher } from "@/lib/api-config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Commodity {
  commodity_id: number;
  symbol: string;
  name: string;
  category: string;
  unit: string;
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

type SortField = "symbol" | "name" | "close" | "return_1d" | "return_7d" | "category" | "setup_count" | "best_risk_reward";

// Category colors for visual grouping
const categoryColors: Record<string, string> = {
  "Precious Metals": "bg-yellow-500/20 text-yellow-500",
  "Energy": "bg-orange-500/20 text-orange-500",
  "Base Metals": "bg-slate-500/20 text-slate-400",
  "Agriculture": "bg-green-500/20 text-green-500",
  "Livestock": "bg-red-500/20 text-red-400",
  "Interest Rate Futures": "bg-blue-500/20 text-blue-500",
  "Index Futures": "bg-purple-500/20 text-purple-500",
  "Currency": "bg-cyan-500/20 text-cyan-500",
};

// Setup name display mapping
const setupDisplayNames: Record<string, string> = {
  donchian_55_breakout: "Donchian 55",
  golden_cross: "Golden Cross",
  trend_pullback_50ma: "50MA Pullback",
  gap_up_momentum: "Gap Up",
  adx_holy_grail: "ADX Holy Grail",
  oversold_bounce: "Oversold Bounce",
};

export default function CommoditiesTable() {
  const [sortBy, setSortBy] = useState<SortField>("category");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data, error, isLoading } = useSWR(
    `/api/dashboard/commodities?sort_by=${sortBy}&sort_order=${sortOrder}`,
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

  if (error) return <div className="p-4 text-red-500">Error loading commodities</div>;

  // Count by category
  const categoryCounts: Record<string, number> = {};
  data?.data?.forEach((c: Commodity) => {
    const cat = c.category || "Other";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">Commodities Overview</h2>
          <p className="text-xs text-muted-foreground">
            {data?.total || 0} commodities across {Object.keys(categoryCounts).length} categories
          </p>
        </div>
        {/* Category legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <span
              key={cat}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded",
                categoryColors[cat] || "bg-muted text-muted-foreground"
              )}
            >
              {cat} ({count})
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-card border-b border-border">
            <tr>
              <SortHeader field="symbol" label="Symbol" />
              <SortHeader field="name" label="Name" />
              <SortHeader field="category" label="Category" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Unit</th>
              <SortHeader field="setup_count" label="Setups" tooltip="Number of active trading setups (last 7 days)" />
              <SortHeader field="best_risk_reward" label="R:R" tooltip="Best risk/reward ratio among active setups" />
              <SortHeader field="close" label="Price" />
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
              data?.data?.map((commodity: Commodity) => {
                const setupNames = getSetupDisplay(commodity.setup_names);
                const hasSetups = commodity.setup_count > 0;
                
                return (
                  <tr
                    key={commodity.commodity_id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-sm font-medium">{commodity.symbol}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground truncate max-w-[200px]">{commodity.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-medium rounded",
                          categoryColors[commodity.category] || "bg-muted text-muted-foreground"
                        )}
                      >
                        {commodity.category || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{commodity.unit || "-"}</td>
                    <td className="px-3 py-2">
                      {hasSetups ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-green-500" />
                              <span className="text-sm font-medium text-green-500">{commodity.setup_count}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs">
                              <p className="font-medium mb-1">Active Setups:</p>
                              {setupNames?.map((name, i) => (
                                <p key={i}>• {name}</p>
                              ))}
                              {commodity.avg_profit_factor > 0 && (
                                <p className="mt-1 text-muted-foreground">
                                  Avg Profit Factor: {formatProfitFactor(commodity.avg_profit_factor)}
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
                        commodity.best_risk_reward >= 3 ? "text-green-500 font-medium" :
                        commodity.best_risk_reward >= 2 ? "text-yellow-500" : "text-muted-foreground"
                      )}>
                        {formatRiskReward(commodity.best_risk_reward)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm">${formatNumber(commodity.close)}</td>
                    <td className={cn("px-3 py-2 text-sm", commodity.return_1d >= 0 ? "text-green-500" : "text-red-500")}>
                      {formatPercent(commodity.return_1d)}
                    </td>
                    <td className={cn("px-3 py-2 text-sm", commodity.return_7d >= 0 ? "text-green-500" : "text-red-500")}>
                      {formatPercent(commodity.return_7d)}
                    </td>
                    <td className={cn("px-3 py-2 text-sm", commodity.return_30d >= 0 ? "text-green-500" : "text-red-500")}>
                      {formatPercent(commodity.return_30d)}
                    </td>
                    <td className={cn("px-3 py-2 text-sm", commodity.return_365d >= 0 ? "text-green-500" : "text-red-500")}>
                      {formatPercent(commodity.return_365d)}
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

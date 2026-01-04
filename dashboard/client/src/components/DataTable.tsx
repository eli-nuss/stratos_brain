import { ArrowRight, TrendingUp, TrendingDown, AlertTriangle, Eye, AlertCircle } from "lucide-react";
import { AssetType, TableType, useDashboardData } from "@/hooks/useDashboardData";
import { useState } from "react";

interface DataTableProps {
  title: string;
  type: TableType;
  assetType: AssetType;
  date?: string;
  onAssetClick: (assetId: string) => void;
}

export default function DataTable({ title, type, assetType, date, onAssetClick }: DataTableProps) {
  const [page, setPage] = useState(0);
  const limit = 10;
  
  const { data, isLoading } = useDashboardData({
    type,
    assetType,
    date,
    limit,
    offset: page * limit,
  });

  const getAttentionColor = (level: string) => {
    switch (level) {
      case "URGENT": return "text-red-400 border-red-400/30 bg-red-400/10";
      case "FOCUS": return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
      case "WATCH": return "text-blue-400 border-blue-400/30 bg-blue-400/10";
      default: return "text-muted-foreground border-border bg-muted/10";
    }
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === "bullish") return <TrendingUp className="w-3 h-3 text-signal-bullish" />;
    if (direction === "bearish") return <TrendingDown className="w-3 h-3 text-signal-bearish" />;
    return <span className="text-muted-foreground">-</span>;
  };

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          {type.includes("bullish") && <TrendingUp className="w-4 h-4 text-signal-bullish" />}
          {type.includes("bearish") && <TrendingDown className="w-4 h-4 text-signal-bearish" />}
          {type === "risk" && <AlertTriangle className="w-4 h-4 text-destructive" />}
          {title}
        </h3>
        <div className="flex gap-1">
          <button 
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="p-1 hover:bg-muted rounded disabled:opacity-50"
          >
            ←
          </button>
          <button 
            disabled={data.length < limit}
            onClick={() => setPage(p => p + 1)}
            className="p-1 hover:bg-muted rounded disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground bg-muted/10 sticky top-0 z-10 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-2 font-medium">Asset</th>
              <th className="px-2 py-2 font-medium text-right">Score</th>
              <th className="px-2 py-2 font-medium">Setup</th>
              <th className="px-2 py-2 font-medium">Attn</th>
              <th className="px-2 py-2 font-medium">Dir</th>
              <th className="px-4 py-2 font-medium text-right">Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-8 bg-muted rounded ml-auto" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-12 bg-muted rounded" /></td>
                  <td className="px-2 py-3"><div className="h-4 w-8 bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 bg-muted rounded ml-auto" /></td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No signals found
                </td>
              </tr>
            ) : (
              data.map((row: any) => (
                <tr 
                  key={row.asset_id} 
                  onClick={() => onAssetClick(row.asset_id)}
                  className="hover:bg-muted/20 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-2 font-mono font-medium text-foreground">
                    {row.symbol}
                  </td>
                  <td className={`px-2 py-2 font-mono text-right ${
                    row.weighted_score > 0 ? "text-signal-bullish" : "text-signal-bearish"
                  }`}>
                    {Math.round(row.weighted_score)}
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground truncate max-w-[100px]">
                    {row.setup_type || "-"}
                  </td>
                  <td className="px-2 py-2">
                    {row.attention_level ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getAttentionColor(row.attention_level)}`}>
                        {row.attention_level}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      {getDirectionIcon(row.ai_direction)}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-right text-xs text-muted-foreground">
                    {row.ai_confidence ? `${Math.round(row.ai_confidence * 100)}%` : "-"}
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

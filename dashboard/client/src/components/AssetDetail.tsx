import useSWR from "swr";
import { X, TrendingUp, TrendingDown, Target, Shield, AlertTriangle, Activity, Info } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  SIGNAL_DEFINITIONS, 
  TRADE_PLAN_DEFINITIONS, 
  formatSignalType, 
  getSignalTooltip 
} from "@/lib/signalDefinitions";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AssetDetailProps {
  assetId: string;
  onClose: () => void;
}

// Helper component for info tooltips
function InfoTooltip({ content, className = "" }: { content: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className={`w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help transition-colors ${className}`} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left whitespace-pre-wrap">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export default function AssetDetail({ assetId, onClose }: AssetDetailProps) {
  const { data, isLoading } = useSWR(`/api/dashboard/asset?asset_id=${assetId}`, fetcher);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data || !data.asset) return null;

  const { asset, ohlcv, review, review_status } = data;
  const isBullish = review?.direction === "bullish";
  const signalColor = isBullish ? "text-signal-bullish" : "text-signal-bearish";
  const signalBg = isBullish ? "bg-signal-bullish/10" : "bg-signal-bearish/10";

  return (
    <div className="flex flex-col h-full bg-card text-foreground overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border flex justify-between items-start bg-muted/10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold tracking-tight">{asset.symbol}</h2>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {asset.name}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-mono text-muted-foreground">
              {data.as_of_date}
            </span>
            {review && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded border cursor-help ${
                    review.attention_level === "URGENT" 
                      ? "border-attention-urgent/30 text-attention-urgent bg-attention-urgent/10" 
                      : review.attention_level === "FOCUS"
                      ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/10"
                      : "border-border text-muted-foreground"
                  }`}>
                    {review.attention_level === "URGENT" && <AlertTriangle className="w-3 h-3" />}
                    {review.attention_level}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {review.attention_level === "URGENT" 
                    ? "Immediate attention warranted. High-conviction setup with favorable risk/reward."
                    : review.attention_level === "FOCUS"
                    ? "Monitor closely. Developing setup that may become actionable soon."
                    : "On the radar. Keep watching for potential entry opportunities."}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Chart & Key Levels */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          <div className="h-[300px] w-full bg-muted/5 rounded-lg border border-border p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ohlcv}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(str) => format(new Date(str), "MMM d")}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  domain={['auto', 'auto']}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                  labelStyle={{ color: 'var(--muted-foreground)' }}
                  formatter={(val: number) => [val.toFixed(2), "Price"]}
                  labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                />
                <Area 
                  type="monotone" 
                  dataKey="close" 
                  stroke="var(--primary)" 
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* AI Reasoning */}
          {review ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                AI Analysis
                <InfoTooltip content="AI-generated analysis based on technical chart patterns, price action, and quantitative signals. The model evaluates multiple timeframes and indicators to form a directional bias." />
              </h3>
              
              <div className="bg-muted/10 border border-border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`text-sm font-bold uppercase cursor-help ${signalColor}`}>
                          {review.direction} {review.setup_type}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <strong>{review.setup_type?.charAt(0).toUpperCase() + review.setup_type?.slice(1)}</strong>: {
                          review.setup_type === "breakout" 
                            ? "Price clearing a key resistance level with volume confirmation, suggesting continuation higher."
                            : review.setup_type === "reversal"
                            ? "Trend change pattern identified, suggesting a shift in the prevailing direction."
                            : review.setup_type === "mean_reversion"
                            ? "Extended price likely to return toward moving average. Counter-trend opportunity."
                            : review.setup_type === "continuation"
                            ? "Pullback within an established trend offering a lower-risk entry point."
                            : "Chart pattern identified by AI analysis."
                        }
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground border-l border-border pl-2 cursor-help">
                          {Math.round(review.confidence * 100)}% Confidence
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        AI confidence in this analysis. Above 85% indicates high conviction with clear technical evidence. 70-85% is moderate conviction. Below 70% suggests mixed signals.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {review.model}
                  </span>
                </div>
                
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {review.summary_text}
                  </p>
                </div>

                {/* Why Now Bullets (if available in JSON) */}
                {review.review_json?.why_now && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">Why Now?</h4>
                    <ul className="space-y-1">
                      {review.review_json.why_now.map((point: string, i: number) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1.5">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-border rounded-lg text-muted-foreground">
              AI Review pending or not available for this date.
            </div>
          )}
        </div>

        {/* Right Column: Trade Plan */}
        <div className="space-y-6">
          {review && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center gap-2">
                <h3 className="font-semibold text-sm">Trade Plan</h3>
                <InfoTooltip content="AI-generated trade plan with specific entry, target, and stop levels. These are suggestions based on technical analysis - always apply your own risk management." />
              </div>
              
              <div className="p-4 space-y-6">
                {/* Entry Zone */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                    <Target className="w-4 h-4" />
                    ENTRY ZONE
                    <InfoTooltip content={TRADE_PLAN_DEFINITIONS.entry_zone.description} />
                  </div>
                  <div className="font-mono text-xl font-bold">
                    {review.entry 
                      ? `$${review.entry.low} - $${review.entry.high}`
                      : "N/A"}
                  </div>
                </div>

                {/* Targets */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                    <TrendingUp className="w-4 h-4" />
                    TARGETS
                    <InfoTooltip content={TRADE_PLAN_DEFINITIONS.targets.description} />
                  </div>
                  <div className="space-y-1">
                    {review.targets?.map((target: number, i: number) => (
                      <div key={i} className="flex justify-between items-center font-mono text-sm">
                        <span className="text-muted-foreground">TP{i+1}</span>
                        <span className="text-signal-bullish font-medium">${target}</span>
                      </div>
                    )) || "N/A"}
                  </div>
                </div>

                {/* Invalidation */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                    <Shield className="w-4 h-4" />
                    INVALIDATION
                    <InfoTooltip content={TRADE_PLAN_DEFINITIONS.invalidation.description} />
                  </div>
                  <div className="font-mono text-lg font-bold text-destructive">
                    {review.invalidation ? `$${review.invalidation}` : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signal Facts */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center gap-2">
              <h3 className="font-semibold text-sm">Signal Drivers</h3>
              <InfoTooltip content="Quantitative signals that triggered this asset's score. Each signal has a strength from 0-100 based on technical criteria. Multiple strong signals increase conviction." />
            </div>
            <div className="divide-y divide-border">
              {data.signals?.length > 0 ? (
                data.signals.slice(0, 5).map((signal: any, i: number) => {
                  const signalDef = SIGNAL_DEFINITIONS[signal.signal_type];
                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <div className="p-3 flex justify-between items-center cursor-help hover:bg-muted/20 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {formatSignalType(signal.signal_type)}
                            </span>
                            {signalDef && (
                              <span className="text-xs text-muted-foreground">
                                {signalDef.shortDescription}
                              </span>
                            )}
                          </div>
                          <span className={`text-sm font-mono font-bold px-2 py-1 rounded ${
                            signal.direction === "bullish" 
                              ? "bg-signal-bullish/10 text-signal-bullish" 
                              : "bg-signal-bearish/10 text-signal-bearish"
                          }`}>
                            {Math.round(signal.strength)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-sm text-left">
                        <div className="space-y-2">
                          <div className="font-semibold">{formatSignalType(signal.signal_type)}</div>
                          {signalDef ? (
                            <>
                              <div className="text-xs">
                                <strong>Methodology:</strong> {signalDef.methodology}
                              </div>
                              <div className="text-xs">
                                <strong>Interpretation:</strong> {signalDef.interpretation}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs">Signal methodology not available.</div>
                          )}
                          <div className="text-xs pt-1 border-t border-border">
                            <strong>Strength:</strong> {Math.round(signal.strength)}/100 • 
                            <strong> Direction:</strong> {signal.direction}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No active signals for this date.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

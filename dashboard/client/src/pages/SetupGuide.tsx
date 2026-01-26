import { useState } from "react";
import { 
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Target,
  BarChart3,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Setup data with backtest results
const SETUPS = [
  {
    id: "rs_breakout",
    name: "Relative Strength Breakout",
    shortName: "RS Break",
    category: "Breakout",
    color: "#22c55e",
    profitFactor: 2.03,
    avgRiskReward: 1.39,
    signalCount: 717,
    description: "A stock breaking out to new highs while showing stronger relative performance than the overall market. This indicates institutional accumulation and leadership potential.",
    howToIdentify: [
      "Stock making new 52-week or all-time highs",
      "Relative strength line (vs SPY) also at new highs",
      "Volume expansion on the breakout day",
      "Price above all major moving averages (20, 50, 200 MA)"
    ],
    howToTrade: [
      "Entry: Buy on breakout above resistance with volume confirmation",
      "Stop: Below the breakout level or recent swing low (typically 5-8%)",
      "Target: Use measured move from prior base, or trail with 20 MA",
      "Position size: Full position for textbook setups (purity 90+)"
    ],
    keyInsights: [
      "Highest profit factor (2.03) of all setups - strong edge",
      "Works best in bull markets when leadership is rewarded",
      "Relative strength is a leading indicator of institutional interest",
      "Failed breakouts are quick to identify - cut losses fast"
    ],
    chartPattern: "rs_breakout"
  },
  {
    id: "donchian_55_breakout",
    name: "55-Day Channel Breakout",
    shortName: "55D Break",
    category: "Breakout",
    color: "#3b82f6",
    profitFactor: 1.99,
    avgRiskReward: 7.10,
    signalCount: 825,
    description: "Price breaking above its highest point in the last 55 trading days. This classic trend-following signal, popularized by the Turtle Traders, often marks the start of a sustained trend.",
    howToIdentify: [
      "Price closes above the 55-day high",
      "Ideally accompanied by volume expansion",
      "Prior consolidation or base formation",
      "Moving averages starting to turn up"
    ],
    howToTrade: [
      "Entry: Buy on close above 55-day high",
      "Stop: At the 20-day low (classic Turtle rule) or 2x ATR below entry",
      "Target: Trail stop using 20-day low, let winners run",
      "Position size: Use ATR-based sizing for consistent risk"
    ],
    keyInsights: [
      "Highest average R:R (7.10) - big winners offset small losses",
      "Trend-following system - expect ~40% win rate but large wins",
      "Works across all asset classes and timeframes",
      "Requires patience - many small losses before catching a trend"
    ],
    chartPattern: "donchian_breakout"
  },
  {
    id: "trend_pullback_50ma",
    name: "Trend Pullback to 50MA",
    shortName: "Pullback",
    category: "Trend Following",
    color: "#8b5cf6",
    profitFactor: 1.97,
    avgRiskReward: 1.99,
    signalCount: 571,
    description: "A stock in a confirmed uptrend that has pulled back to test its 50-day moving average. This is a classic 'buy the dip' setup in a trending market.",
    howToIdentify: [
      "Stock in established uptrend (higher highs, higher lows)",
      "Price pulls back to touch or approach 50-day MA",
      "50 MA is rising (not flat or declining)",
      "RSI pulls back to 40-50 range (not oversold)"
    ],
    howToTrade: [
      "Entry: Buy when price bounces off 50 MA with bullish candle",
      "Stop: Below the 50 MA or recent swing low (3-5%)",
      "Target: Prior high, then trail with 20 MA",
      "Position size: Standard position, add if bounce confirms"
    ],
    keyInsights: [
      "Lower risk entry than breakout buying",
      "Best when overall market is also in uptrend",
      "Multiple touches of 50 MA weaken the support level",
      "Watch for volume dry-up on pullback, expansion on bounce"
    ],
    chartPattern: "pullback_50ma"
  },
  {
    id: "vcp_squeeze",
    name: "Volatility Contraction Pattern",
    shortName: "VCP",
    category: "Squeeze",
    color: "#f59e0b",
    profitFactor: 1.69,
    avgRiskReward: 3.12,
    signalCount: 1063,
    description: "Price volatility contracting into a tight range after a move up, forming a series of higher lows. This 'coiling' pattern often precedes explosive breakouts as supply dries up.",
    howToIdentify: [
      "Series of contracting price ranges (tightening)",
      "Each pullback is shallower than the last",
      "Volume declining during contraction",
      "Price holding above key moving averages"
    ],
    howToTrade: [
      "Entry: Buy on breakout from the tight range with volume",
      "Stop: Below the most recent pivot low (tight stop)",
      "Target: Measured move equal to the prior advance",
      "Position size: Can use larger size due to tight stop"
    ],
    keyInsights: [
      "Most frequent setup (1,063 signals) - many opportunities",
      "Tight stops allow larger position sizes",
      "Pattern developed by Mark Minervini for growth stocks",
      "Best when preceded by a strong prior advance (30%+)"
    ],
    chartPattern: "vcp"
  },
  {
    id: "adx_holy_grail",
    name: "ADX Holy Grail",
    shortName: "ADX Setup",
    category: "Trend Following",
    color: "#ec4899",
    profitFactor: 1.71,
    avgRiskReward: 3.34,
    signalCount: 653,
    description: "A strong trending stock (ADX > 30) that pulls back to the 20-day EMA. Named 'Holy Grail' by Linda Raschke because it combines trend strength confirmation with an optimal entry point.",
    howToIdentify: [
      "ADX reading above 30 (strong trend)",
      "Price pulls back to 20-day EMA",
      "+DI above -DI for uptrend (or vice versa for downtrend)",
      "Pullback on declining volume"
    ],
    howToTrade: [
      "Entry: Buy when price touches 20 EMA and shows reversal candle",
      "Stop: Below the 20 EMA or swing low",
      "Target: Prior high, then use trailing stop",
      "Position size: Standard position"
    ],
    keyInsights: [
      "ADX confirms trend strength before entry",
      "Works in both directions (long and short)",
      "20 EMA is the 'line in the sand' for the trend",
      "Multiple ADX Holy Grail setups can occur in strong trends"
    ],
    chartPattern: "adx_holy_grail"
  },
  {
    id: "gap_up_momentum",
    name: "Gap Up Momentum",
    shortName: "Gap Up",
    category: "Momentum",
    color: "#14b8a6",
    profitFactor: 1.58,
    avgRiskReward: 3.06,
    signalCount: 230,
    description: "A stock that gaps up significantly on high volume, often due to earnings, news, or sector rotation. Strong gaps that hold can signal the start of a new trend leg.",
    howToIdentify: [
      "Gap up of 3%+ from prior close",
      "Volume at least 2x average",
      "Gap holds above prior day's high",
      "Often follows a catalyst (earnings, news)"
    ],
    howToTrade: [
      "Entry: Buy if gap holds after first 30 min, or on pullback to gap level",
      "Stop: Below the gap fill level (prior day's high)",
      "Target: Use prior resistance levels or trail stop",
      "Position size: Smaller initial position, add on confirmation"
    ],
    keyInsights: [
      "Gaps that don't fill in first hour often continue",
      "Earnings gaps have highest follow-through",
      "Watch for 'gap and go' vs 'gap and fade' patterns",
      "Volume is critical - low volume gaps often fail"
    ],
    chartPattern: "gap_up"
  },
  {
    id: "golden_cross",
    name: "Golden Cross",
    shortName: "Golden X",
    category: "Trend Following",
    color: "#eab308",
    profitFactor: 1.53,
    avgRiskReward: 3.19,
    signalCount: 1059,
    description: "The 50-day moving average crossing above the 200-day moving average. This widely-watched signal suggests a shift from bearish to bullish long-term trend.",
    howToIdentify: [
      "50 MA crosses above 200 MA",
      "Price above both moving averages",
      "Ideally, both MAs are rising",
      "Volume expansion around the cross"
    ],
    howToTrade: [
      "Entry: Buy on the cross or on pullback to 50 MA after cross",
      "Stop: Below the 200 MA (wider stop for longer-term signal)",
      "Target: Use trailing stop, this is a trend-following signal",
      "Position size: Standard position, this is a longer-term setup"
    ],
    keyInsights: [
      "Lagging indicator - trend already underway when signal fires",
      "Best used as confirmation, not primary entry signal",
      "Death Cross (opposite) is bearish equivalent",
      "Works better on indices than individual stocks"
    ],
    chartPattern: "golden_cross"
  },
  {
    id: "oversold_bounce",
    name: "Oversold Bounce",
    shortName: "Bounce",
    category: "Mean Reversion",
    color: "#06b6d4",
    profitFactor: 1.52,
    avgRiskReward: 1.07,
    signalCount: 307,
    description: "A stock that has become extremely oversold (RSI below 30) and is showing signs of reversal. This is a mean-reversion play expecting a bounce from depressed levels.",
    howToIdentify: [
      "RSI below 30 (oversold)",
      "Price extended below 20 MA",
      "Bullish reversal candle (hammer, engulfing)",
      "Volume spike on reversal day"
    ],
    howToTrade: [
      "Entry: Buy on bullish reversal candle with RSI < 30",
      "Stop: Below the recent low (tight stop)",
      "Target: 20 MA or prior support-turned-resistance",
      "Position size: Smaller position - counter-trend trade"
    ],
    keyInsights: [
      "Counter-trend setup - lower win rate expected",
      "Best in range-bound or bull markets, avoid in bear markets",
      "Quick trades - take profits at first resistance",
      "Lowest R:R (1.07) - need high win rate to be profitable"
    ],
    chartPattern: "oversold_bounce"
  },
  {
    id: "acceleration_turn",
    name: "Acceleration Turn",
    shortName: "Accel Turn",
    category: "Momentum",
    color: "#f97316",
    profitFactor: 1.48,
    avgRiskReward: 1.19,
    signalCount: 185,
    description: "Momentum accelerating after a period of consolidation or decline. The rate of price change is increasing, suggesting building buying pressure.",
    howToIdentify: [
      "Price momentum turning from negative to positive",
      "Rate of change (ROC) increasing",
      "Volume expanding on up days",
      "Breaking out of consolidation pattern"
    ],
    howToTrade: [
      "Entry: Buy when momentum confirms acceleration",
      "Stop: Below recent consolidation low",
      "Target: Use momentum indicators to trail",
      "Position size: Start small, add on confirmation"
    ],
    keyInsights: [
      "Early signal - catches turns before breakouts",
      "Higher false signal rate - use with other confirmation",
      "Best when market regime is also turning bullish",
      "Watch for divergences between price and momentum"
    ],
    chartPattern: "acceleration"
  },
  {
    id: "breakout_confirmed",
    name: "Confirmed Breakout",
    shortName: "Breakout",
    category: "Breakout",
    color: "#22c55e",
    profitFactor: 1.45,
    avgRiskReward: 2.26,
    signalCount: 55,
    description: "Price has broken above a key resistance level with strong volume confirmation. The breakout has been validated by follow-through buying.",
    howToIdentify: [
      "Clear resistance level broken",
      "Volume 50%+ above average on breakout",
      "Follow-through buying in subsequent sessions",
      "Prior consolidation or base formation"
    ],
    howToTrade: [
      "Entry: Buy after breakout is confirmed (not on initial break)",
      "Stop: Below breakout level or base",
      "Target: Measured move from base height",
      "Position size: Standard position"
    ],
    keyInsights: [
      "Confirmation reduces false breakout risk",
      "May miss some of the move waiting for confirmation",
      "Lower signal count (55) - more selective",
      "Best when overall market is supportive"
    ],
    chartPattern: "breakout"
  },
  {
    id: "weinstein_stage2",
    name: "Weinstein Stage 2 Breakout",
    shortName: "Stage 2",
    category: "Breakout",
    color: "#10b981",
    profitFactor: 4.09,
    avgRiskReward: 3.50,
    signalCount: 0,
    description: "A stock breaking out of a long consolidation base (100+ days) into Stage 2 of the Weinstein market cycle. This rare but powerful signal often marks the beginning of a major multi-month uptrend.",
    howToIdentify: [
      "Long base formation (100+ trading days minimum)",
      "Base range within 15% from high to low",
      "Price breaking above base resistance with 1.5x+ volume",
      "30-week (150-day) moving average flattening or turning up",
      "Stock emerging from Stage 1 (basing) into Stage 2 (advancing)"
    ],
    howToTrade: [
      "Entry: Buy on breakout above base with volume confirmation",
      "Stop: Below the base low or 2x ATR (wider stop for longer-term trade)",
      "Target: Trail with 30-week MA, expect 20%+ moves",
      "Position size: Can use larger size due to high profit factor",
      "Hold time: Position trade - expect to hold for months"
    ],
    keyInsights: [
      "Highest profit factor (4.09) of ALL setups - exceptional edge",
      "Very rare - requires 100+ day base, few signals per year",
      "Based on Stan Weinstein's 'Secrets for Profiting in Bull and Bear Markets'",
      "Best for position traders with longer time horizons",
      "The longer the base, the bigger the potential move"
    ],
    chartPattern: "weinstein_stage2"
  }
];

// SVG Chart Components for each pattern
function ChartPattern({ pattern }: { pattern: string }) {
  const width = 300;
  const height = 150;
  const padding = 20;
  
  // Generate chart paths based on pattern type
  const getChartPath = () => {
    switch (pattern) {
      case "rs_breakout":
        return (
          <>
            {/* Price making higher highs */}
            <path 
              d="M 20 120 L 60 100 L 80 110 L 120 80 L 140 95 L 180 60 L 200 75 L 240 40 L 280 30" 
              fill="none" 
              stroke="#22c55e" 
              strokeWidth="2"
            />
            {/* Resistance line being broken */}
            <line x1="20" y1="60" x2="200" y2="60" stroke="#6b7280" strokeWidth="1" strokeDasharray="4" />
            {/* Breakout arrow */}
            <path d="M 230 50 L 250 30 L 245 40 M 250 30 L 240 35" stroke="#22c55e" strokeWidth="2" fill="none" />
            {/* Volume bars */}
            <rect x="230" y="130" width="15" height="20" fill="#22c55e" opacity="0.5" />
            <rect x="250" y="120" width="15" height="30" fill="#22c55e" opacity="0.7" />
            <rect x="270" y="110" width="15" height="40" fill="#22c55e" opacity="0.9" />
          </>
        );
      case "donchian_breakout":
        return (
          <>
            {/* 55-day channel */}
            <line x1="20" y1="40" x2="220" y2="40" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
            <line x1="20" y1="110" x2="220" y2="110" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
            {/* Price consolidating then breaking out */}
            <path 
              d="M 20 80 L 50 70 L 80 90 L 110 75 L 140 85 L 170 70 L 200 80 L 220 45 L 250 35 L 280 25" 
              fill="none" 
              stroke="#3b82f6" 
              strokeWidth="2"
            />
            {/* Breakout annotation */}
            <circle cx="220" cy="45" r="8" fill="none" stroke="#3b82f6" strokeWidth="2" />
          </>
        );
      case "pullback_50ma":
        return (
          <>
            {/* 50 MA line */}
            <path 
              d="M 20 100 L 80 85 L 140 70 L 200 60 L 260 55 L 280 52" 
              fill="none" 
              stroke="#8b5cf6" 
              strokeWidth="2"
              strokeDasharray="6"
            />
            {/* Price pulling back to MA */}
            <path 
              d="M 20 90 L 60 60 L 100 50 L 140 70 L 160 65 L 180 60 L 200 45 L 240 35 L 280 25" 
              fill="none" 
              stroke="#8b5cf6" 
              strokeWidth="2"
            />
            {/* Bounce point */}
            <circle cx="180" cy="60" r="6" fill="#8b5cf6" opacity="0.3" />
            <circle cx="180" cy="60" r="3" fill="#8b5cf6" />
          </>
        );
      case "vcp":
        return (
          <>
            {/* VCP pattern - contracting volatility */}
            <path 
              d="M 20 100 L 40 50 L 60 80 L 80 55 L 100 70 L 120 58 L 140 65 L 160 60 L 180 63 L 200 61 L 220 40 L 260 25 L 280 20" 
              fill="none" 
              stroke="#f59e0b" 
              strokeWidth="2"
            />
            {/* Contraction lines */}
            <line x1="40" y1="50" x2="200" y2="58" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3" opacity="0.5" />
            <line x1="60" y1="80" x2="200" y2="65" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3" opacity="0.5" />
            {/* Pivot point */}
            <circle cx="200" cy="61" r="5" fill="none" stroke="#f59e0b" strokeWidth="2" />
          </>
        );
      case "adx_holy_grail":
        return (
          <>
            {/* 20 EMA */}
            <path 
              d="M 20 90 L 80 70 L 140 55 L 200 50 L 260 45 L 280 42" 
              fill="none" 
              stroke="#ec4899" 
              strokeWidth="2"
              strokeDasharray="6"
            />
            {/* Price touching EMA and bouncing */}
            <path 
              d="M 20 80 L 60 50 L 100 40 L 130 55 L 150 52 L 170 50 L 190 35 L 230 25 L 280 15" 
              fill="none" 
              stroke="#ec4899" 
              strokeWidth="2"
            />
            {/* ADX indicator box */}
            <rect x="230" y="100" width="45" height="25" fill="#ec4899" opacity="0.2" rx="3" />
            <text x="252" y="117" fontSize="10" fill="#ec4899" textAnchor="middle">ADX 35</text>
          </>
        );
      case "gap_up":
        return (
          <>
            {/* Price with gap */}
            <path 
              d="M 20 110 L 60 100 L 100 105 L 140 95" 
              fill="none" 
              stroke="#14b8a6" 
              strokeWidth="2"
            />
            {/* Gap */}
            <line x1="140" y1="95" x2="140" y2="95" stroke="#14b8a6" strokeWidth="2" />
            <path 
              d="M 160 55 L 200 50 L 240 45 L 280 35" 
              fill="none" 
              stroke="#14b8a6" 
              strokeWidth="2"
            />
            {/* Gap area */}
            <rect x="140" y="55" width="20" height="40" fill="#14b8a6" opacity="0.2" />
            {/* Volume spike */}
            <rect x="155" y="110" width="15" height="40" fill="#14b8a6" opacity="0.8" />
          </>
        );
      case "golden_cross":
        return (
          <>
            {/* 200 MA */}
            <path 
              d="M 20 60 L 100 65 L 180 70 L 260 80 L 280 82" 
              fill="none" 
              stroke="#ef4444" 
              strokeWidth="2"
              strokeDasharray="6"
            />
            {/* 50 MA crossing above */}
            <path 
              d="M 20 100 L 80 85 L 140 70 L 180 65 L 220 55 L 280 40" 
              fill="none" 
              stroke="#eab308" 
              strokeWidth="2"
            />
            {/* Cross point */}
            <circle cx="160" cy="68" r="8" fill="none" stroke="#eab308" strokeWidth="2" />
            {/* Price */}
            <path 
              d="M 20 90 L 60 80 L 100 75 L 140 60 L 180 50 L 220 40 L 280 25" 
              fill="none" 
              stroke="#6b7280" 
              strokeWidth="1"
              opacity="0.5"
            />
          </>
        );
      case "oversold_bounce":
        return (
          <>
            {/* Downtrend then bounce */}
            <path 
              d="M 20 30 L 60 50 L 100 70 L 140 100 L 160 120 L 180 110 L 220 90 L 260 70 L 280 60" 
              fill="none" 
              stroke="#06b6d4" 
              strokeWidth="2"
            />
            {/* RSI indicator */}
            <rect x="20" y="130" width="260" height="20" fill="#1f2937" rx="2" />
            <path 
              d="M 25 145 L 60 143 L 100 142 L 140 148 L 160 149 L 180 147 L 220 144 L 260 142 L 275 141" 
              fill="none" 
              stroke="#06b6d4" 
              strokeWidth="1"
            />
            <line x1="25" y1="147" x2="275" y2="147" stroke="#ef4444" strokeWidth="1" strokeDasharray="2" opacity="0.5" />
            {/* Bounce point */}
            <circle cx="160" cy="120" r="6" fill="#06b6d4" opacity="0.3" />
          </>
        );
      case "acceleration":
        return (
          <>
            {/* Consolidation then acceleration */}
            <path 
              d="M 20 90 L 50 85 L 80 88 L 110 83 L 140 86 L 160 80 L 180 70 L 200 55 L 230 35 L 260 20 L 280 10" 
              fill="none" 
              stroke="#f97316" 
              strokeWidth="2"
            />
            {/* Momentum indicator */}
            <path 
              d="M 20 120 L 80 118 L 140 115 L 180 100 L 220 80 L 260 60 L 280 50" 
              fill="none" 
              stroke="#f97316" 
              strokeWidth="1"
              strokeDasharray="4"
            />
            {/* Turn point */}
            <circle cx="160" cy="80" r="5" fill="none" stroke="#f97316" strokeWidth="2" />
          </>
        );
      case "breakout":
        return (
          <>
            {/* Base pattern */}
            <path 
              d="M 20 80 L 50 75 L 80 85 L 110 70 L 140 80 L 170 72 L 200 78" 
              fill="none" 
              stroke="#22c55e" 
              strokeWidth="2"
            />
            {/* Resistance */}
            <line x1="20" y1="65" x2="200" y2="65" stroke="#6b7280" strokeWidth="1" strokeDasharray="4" />
            {/* Breakout with confirmation */}
            <path 
              d="M 200 78 L 220 55 L 240 50 L 260 45 L 280 35" 
              fill="none" 
              stroke="#22c55e" 
              strokeWidth="2"
            />
            {/* Confirmation candles */}
            <rect x="215" y="50" width="8" height="15" fill="#22c55e" opacity="0.7" />
            <rect x="235" y="45" width="8" height="12" fill="#22c55e" opacity="0.7" />
            <rect x="255" y="40" width="8" height="10" fill="#22c55e" opacity="0.7" />
          </>
        );
      case "weinstein_stage2":
        return (
          <>
            {/* Long base formation (100+ days) */}
            <rect x="20" y="70" width="180" height="40" fill="#10b981" opacity="0.1" rx="2" />
            {/* Base price action - sideways consolidation */}
            <path 
              d="M 25 90 L 40 85 L 55 92 L 70 88 L 85 95 L 100 87 L 115 93 L 130 86 L 145 91 L 160 84 L 175 90 L 190 82" 
              fill="none" 
              stroke="#6b7280" 
              strokeWidth="1.5"
            />
            {/* Resistance line at top of base */}
            <line x1="20" y1="75" x2="200" y2="75" stroke="#ef4444" strokeWidth="1" strokeDasharray="4" />
            {/* Support line at bottom of base */}
            <line x1="20" y1="100" x2="200" y2="100" stroke="#22c55e" strokeWidth="1" strokeDasharray="4" />
            {/* 30-week MA flattening */}
            <path 
              d="M 20 110 L 60 105 L 100 98 L 140 93 L 180 88 L 200 85" 
              fill="none" 
              stroke="#eab308" 
              strokeWidth="1.5"
              strokeDasharray="3"
            />
            {/* Breakout with volume */}
            <path 
              d="M 190 82 L 210 65 L 230 50 L 250 40 L 270 25 L 280 20" 
              fill="none" 
              stroke="#10b981" 
              strokeWidth="2.5"
            />
            {/* Volume spike on breakout */}
            <rect x="200" y="120" width="12" height="25" fill="#10b981" opacity="0.6" />
            <rect x="215" y="110" width="12" height="35" fill="#10b981" opacity="0.8" />
            <rect x="230" y="105" width="12" height="40" fill="#10b981" opacity="0.9" />
            {/* "100+ days" label */}
            <text x="100" y="115" fill="#6b7280" fontSize="10" textAnchor="middle">100+ days</text>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <svg width={width} height={height} className="bg-card/50 rounded-lg border border-border">
      {getChartPath()}
    </svg>
  );
}

interface SetupCardProps {
  setup: typeof SETUPS[0];
  isExpanded: boolean;
  onToggle: () => void;
}

function SetupCard({ setup, isExpanded, onToggle }: SetupCardProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
      >
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: setup.color }}
        />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{setup.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {setup.category}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {setup.description}
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="hidden sm:flex items-center gap-6 text-sm">
          <Tooltip>
            <TooltipTrigger>
              <div className="text-center">
                <div className="font-mono font-semibold" style={{ color: setup.profitFactor >= 1.7 ? '#22c55e' : setup.profitFactor >= 1.5 ? '#eab308' : '#f97316' }}>
                  {setup.profitFactor.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">PF</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Profit Factor - Gross profits / Gross losses</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger>
              <div className="text-center">
                <div className="font-mono font-semibold text-blue-400">
                  {setup.avgRiskReward.toFixed(1)}:1
                </div>
                <div className="text-xs text-muted-foreground">R:R</div>
              </div>
            </TooltipTrigger>
            <TooltipContent>Average Risk:Reward ratio</TooltipContent>
          </Tooltip>
          
          <div className="text-center">
            <div className="font-mono text-muted-foreground">
              {setup.signalCount}
            </div>
            <div className="text-xs text-muted-foreground">Signals</div>
          </div>
        </div>
        
        <div className="ml-2">
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            {/* Left Column - Chart and Description */}
            <div className="space-y-4">
              {/* Chart Pattern */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Pattern Visualization
                </h4>
                <ChartPattern pattern={setup.chartPattern} />
              </div>
              
              {/* Description */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  What It Means
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {setup.description}
                </p>
              </div>
              
              {/* Mobile Stats */}
              <div className="sm:hidden grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="font-mono font-semibold" style={{ color: setup.profitFactor >= 1.7 ? '#22c55e' : setup.profitFactor >= 1.5 ? '#eab308' : '#f97316' }}>
                    {setup.profitFactor.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">Profit Factor</div>
                </div>
                <div className="text-center">
                  <div className="font-mono font-semibold text-blue-400">
                    {setup.avgRiskReward.toFixed(1)}:1
                  </div>
                  <div className="text-xs text-muted-foreground">Avg R:R</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-muted-foreground">
                    {setup.signalCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Signals</div>
                </div>
              </div>
            </div>
            
            {/* Right Column - How To */}
            <div className="space-y-4">
              {/* How to Identify */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  How to Identify
                </h4>
                <ul className="space-y-1.5">
                  {setup.howToIdentify.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* How to Trade */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  How to Trade
                </h4>
                <ul className="space-y-1.5">
                  {setup.howToTrade.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <ArrowUpRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Key Insights */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Key Insights from Backtesting
                </h4>
                <ul className="space-y-1.5">
                  {setup.keyInsights.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Minus className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupGuide() {
  const [expandedSetups, setExpandedSetups] = useState<Set<string>>(new Set(["rs_breakout"]));
  
  const toggleSetup = (id: string) => {
    setExpandedSetups(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const expandAll = () => {
    setExpandedSetups(new Set(SETUPS.map(s => s.id)));
  };
  
  const collapseAll = () => {
    setExpandedSetups(new Set());
  };

  // Sort setups by profit factor
  const sortedSetups = [...SETUPS].sort((a, b) => b.profitFactor - a.profitFactor);

  return (
    <DashboardLayout hideNavTabs>
      <main className="container px-4 py-4 sm:py-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Trading Setup Guide</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Learn about each quantitative trading setup, how to identify them, and their historical performance from our backtesting.
          </p>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-card/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-green-500">10</div>
            <div className="text-sm text-muted-foreground">Active Setups</div>
          </div>
          <div className="p-4 bg-card/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-blue-500">5,665</div>
            <div className="text-sm text-muted-foreground">Total Signals</div>
          </div>
          <div className="p-4 bg-card/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-yellow-500">1.73</div>
            <div className="text-sm text-muted-foreground">Avg Profit Factor</div>
          </div>
          <div className="p-4 bg-card/50 rounded-lg border border-border">
            <div className="text-2xl font-bold text-purple-500">2.87:1</div>
            <div className="text-sm text-muted-foreground">Avg Risk:Reward</div>
          </div>
        </div>
        
        {/* Understanding the Metrics */}
        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="font-semibold text-blue-400 mb-2">Understanding the Metrics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Profit Factor (PF):</span> Total gross profits divided by total gross losses. A PF of 2.0 means the setup generates $2 in profits for every $1 in losses. Above 1.5 is good, above 2.0 is excellent.
            </div>
            <div>
              <span className="font-medium text-foreground">Risk:Reward (R:R):</span> Average reward divided by average risk per trade. A 3:1 R:R means the average winner is 3x the size of the average loser.
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            Sorted by Profit Factor (highest first)
          </div>
          <div className="flex gap-2">
            <button 
              onClick={expandAll}
              className="text-xs px-3 py-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
            >
              Expand All
            </button>
            <button 
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
        
        {/* Setup Cards */}
        <div className="space-y-3">
          {sortedSetups.map(setup => (
            <SetupCard
              key={setup.id}
              setup={setup}
              isExpanded={expandedSetups.has(setup.id)}
              onToggle={() => toggleSetup(setup.id)}
            />
          ))}
        </div>
        
        {/* Footer Note */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
          <p>
            <strong>Note:</strong> Past performance does not guarantee future results. These setups are identified by our quantitative system and should be used as part of a comprehensive trading strategy that includes proper risk management, position sizing, and consideration of current market conditions.
          </p>
        </div>
      </main>
    </DashboardLayout>
  );
}

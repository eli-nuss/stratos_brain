// Signal type definitions and methodology explanations
// Used for tooltips throughout the dashboard

export interface SignalDefinition {
  name: string;
  shortDescription: string;
  methodology: string;
  interpretation: string;
}

export const SIGNAL_DEFINITIONS: Record<string, SignalDefinition> = {
  breakout_participation: {
    name: "Breakout Participation",
    shortDescription: "Price breaking above key resistance with volume confirmation",
    methodology: "Triggers when price breaks above the 20-day Donchian high with expanding Bollinger Band width and OBV confirmation. Base strength of 60 is adjusted by volume, volatility expansion, and breakout confirmation factors.",
    interpretation: "Higher scores indicate stronger breakout conviction. Scores above 70 suggest high-probability continuation. Look for follow-through volume in subsequent sessions."
  },
  trend_ignition: {
    name: "Trend Ignition",
    shortDescription: "Early momentum shift signaling potential trend change",
    methodology: "Detects squeeze releases (BB width expansion after contraction) combined with positive MACD histogram and relative volume above 1.0x. Evaluates rate-of-change acceleration across 5, 20, and 63-day periods.",
    interpretation: "Signals the beginning of a potential new trend. Best used in conjunction with other signals. Higher strength indicates more conviction in the trend shift."
  },
  squeeze_release: {
    name: "Squeeze Release",
    shortDescription: "Volatility expansion after period of compression",
    methodology: "Identifies when Bollinger Band width percentile expands after being in the lower quartile. Confirms with MACD histogram direction and breakout confirmation. Base strength adjusted by momentum and volume factors.",
    interpretation: "Volatility squeezes often precede significant moves. Direction is determined by the breakout direction. Higher scores indicate cleaner squeeze patterns."
  },
  volatility_shock: {
    name: "Volatility Shock",
    shortDescription: "Sudden increase in price volatility",
    methodology: "Measures ATR expansion relative to recent history. Triggers when current ATR exceeds 1.5x the 20-day average ATR. Strength is scaled by the magnitude of the volatility increase.",
    interpretation: "Indicates regime change in volatility. Can signal both opportunity and risk. Use with directional signals to determine trade direction."
  },
  mean_reversion: {
    name: "Mean Reversion",
    shortDescription: "Price extended from moving averages, likely to revert",
    methodology: "Triggers when price deviates more than 2 standard deviations from the 20-day SMA. Strength increases with the magnitude of deviation and RSI extremes (oversold <30 or overbought >70).",
    interpretation: "Counter-trend signal. Higher strength indicates more extreme extension. Best used with clear support/resistance levels for entry timing."
  },
  momentum_divergence: {
    name: "Momentum Divergence",
    shortDescription: "Price and momentum indicators moving in opposite directions",
    methodology: "Detects divergence between price action and RSI/MACD. Bullish divergence: price makes lower low while indicator makes higher low. Bearish divergence: price makes higher high while indicator makes lower high.",
    interpretation: "Early warning of potential trend reversal. Requires confirmation from price action. Multiple timeframe divergence increases reliability."
  },
  volume_climax: {
    name: "Volume Climax",
    shortDescription: "Extreme volume spike indicating potential exhaustion",
    methodology: "Triggers when volume exceeds 3x the 20-day average. Evaluates price action context (gap, range expansion) to determine if climax is bullish or bearish.",
    interpretation: "Can indicate capitulation (reversal) or breakout confirmation. Context matters - climax at support is bullish, at resistance is bearish."
  },
  trend_continuation: {
    name: "Trend Continuation",
    shortDescription: "Pullback within established trend offering entry",
    methodology: "Identifies pullbacks to key moving averages (20, 50 SMA) within an established trend. Requires price above MA200 for bullish, below for bearish. Strength based on trend strength and pullback depth.",
    interpretation: "Lower-risk entry within existing trend. Best when pullback holds above prior support. Higher strength indicates healthier trend structure."
  }
};

// Column definitions for the main table
export const COLUMN_DEFINITIONS: Record<string, { title: string; description: string }> = {
  score: {
    title: "Weighted Score",
    description: "Composite score combining all active signal strengths. Positive scores indicate bullish bias, negative scores indicate bearish bias. Scores above 100 are considered strong signals."
  },
  score_delta: {
    title: "Score Change (Δ)",
    description: "Change in weighted score from the previous trading day. Large positive changes indicate emerging bullish momentum; large negative changes indicate emerging bearish pressure."
  },
  signal: {
    title: "Signal Category",
    description: "Primary signal classification: INFLECTION (new breakout/breakdown), TREND (continuation pattern), or RISK (warning signal). Arrow indicates direction."
  },
  setup: {
    title: "Setup Type",
    description: "The dominant chart pattern identified: breakout (price clearing resistance), reversal (trend change), mean_reversion (extended price returning to average), or continuation (trend resumption)."
  },
  attention: {
    title: "Attention Level",
    description: "AI-assigned priority: URGENT (immediate action warranted), FOCUS (monitor closely), WATCH (on radar). Based on signal strength, setup quality, and risk/reward profile."
  },
  direction: {
    title: "AI Direction",
    description: "The AI's directional bias based on chart analysis: bullish (expecting higher prices) or bearish (expecting lower prices)."
  },
  confidence: {
    title: "AI Confidence",
    description: "The AI's confidence level in its analysis (0-100%). Higher confidence indicates clearer chart patterns and stronger technical evidence. Above 85% is high conviction."
  }
};

// Trade plan definitions
export const TRADE_PLAN_DEFINITIONS: Record<string, { title: string; description: string }> = {
  entry_zone: {
    title: "Entry Zone",
    description: "Optimal price range for position entry. The low end represents aggressive entry, high end represents conservative entry. Wait for price to enter this zone before initiating positions."
  },
  targets: {
    title: "Price Targets",
    description: "TP1: First target for partial profit taking (typically 1R). TP2: Second target (typically 2R). TP3: Extended target for runners. Scale out at each level to lock in gains."
  },
  invalidation: {
    title: "Invalidation Level",
    description: "Price level where the trade thesis is invalidated. Place stop-loss at or below this level. If price reaches invalidation, the setup has failed and position should be closed."
  }
};

// Helper function to format signal type to display name
export function formatSignalType(signalType: string): string {
  const definition = SIGNAL_DEFINITIONS[signalType];
  if (definition) {
    return definition.name;
  }
  // Fallback: convert snake_case to Title Case
  return signalType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper function to get signal tooltip content
export function getSignalTooltip(signalType: string): string {
  const definition = SIGNAL_DEFINITIONS[signalType];
  if (definition) {
    return `${definition.methodology}\n\nInterpretation: ${definition.interpretation}`;
  }
  return "Signal methodology not available.";
}

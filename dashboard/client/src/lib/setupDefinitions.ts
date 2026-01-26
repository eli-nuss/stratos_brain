/**
 * Setup Definitions
 * 
 * Human-readable names, descriptions, and metadata for quantitative trading setups.
 * These setups are identified by our backtesting system and represent specific
 * technical patterns that have historically shown positive returns.
 */

export interface SetupDefinition {
  /** Internal database name */
  id: string;
  /** Short display name for tables */
  shortName: string;
  /** Full display name */
  fullName: string;
  /** Plain-English description for tooltips */
  description: string;
  /** Category of setup */
  category: 'breakout' | 'momentum' | 'trend' | 'reversal' | 'squeeze';
  /** Color for visual distinction */
  color: string;
  /** Emoji icon */
  icon: string;
}

export const SETUP_DEFINITIONS: Record<string, SetupDefinition> = {
  rs_breakout: {
    id: 'rs_breakout',
    shortName: 'RS Break',
    fullName: 'Relative Strength Breakout',
    description: 'Stock is breaking out to new highs while showing stronger performance than the overall market. This indicates institutional buying and leadership potential.',
    category: 'breakout',
    color: '#22c55e', // green
    icon: '🚀',
  },
  donchian_55_breakout: {
    id: 'donchian_55_breakout',
    shortName: '55D Break',
    fullName: '55-Day Channel Breakout',
    description: 'Price has broken above its highest point in the last 55 trading days. This classic trend-following signal often marks the start of a sustained move.',
    category: 'breakout',
    color: '#3b82f6', // blue
    icon: '📈',
  },
  trend_pullback_50ma: {
    id: 'trend_pullback_50ma',
    shortName: 'Pullback',
    fullName: 'Trend Pullback to 50MA',
    description: 'Stock in an uptrend has pulled back to its 50-day moving average, a common support level. This is often a lower-risk entry point in a continuing trend.',
    category: 'trend',
    color: '#8b5cf6', // purple
    icon: '🎯',
  },
  vcp_squeeze: {
    id: 'vcp_squeeze',
    shortName: 'VCP',
    fullName: 'Volatility Contraction Pattern',
    description: 'Price volatility is contracting into a tight range after a move up. This "coiling" pattern often precedes explosive breakouts as supply dries up.',
    category: 'squeeze',
    color: '#f59e0b', // amber
    icon: '🔥',
  },
  adx_holy_grail: {
    id: 'adx_holy_grail',
    shortName: 'ADX Setup',
    fullName: 'ADX Holy Grail',
    description: 'Strong trend (high ADX) combined with a pullback to the 20-day moving average. Named "Holy Grail" because it combines trend strength with an optimal entry point.',
    category: 'trend',
    color: '#ec4899', // pink
    icon: '⚡',
  },
  gap_up_momentum: {
    id: 'gap_up_momentum',
    shortName: 'Gap Up',
    fullName: 'Gap Up Momentum',
    description: 'Stock gapped up significantly on high volume, often due to news or earnings. Strong gaps that hold can signal the start of a new trend leg.',
    category: 'momentum',
    color: '#14b8a6', // teal
    icon: '💨',
  },
  golden_cross: {
    id: 'golden_cross',
    shortName: 'Golden X',
    fullName: 'Golden Cross',
    description: 'The 50-day moving average has crossed above the 200-day moving average. This widely-watched signal suggests a shift from bearish to bullish long-term trend.',
    category: 'trend',
    color: '#eab308', // yellow
    icon: '✨',
  },
  breakout_confirmed: {
    id: 'breakout_confirmed',
    shortName: 'Breakout',
    fullName: 'Confirmed Breakout',
    description: 'Price has broken above a key resistance level with strong volume confirmation. The breakout has been validated by follow-through buying.',
    category: 'breakout',
    color: '#22c55e', // green
    icon: '🎉',
  },
  oversold_bounce: {
    id: 'oversold_bounce',
    shortName: 'Bounce',
    fullName: 'Oversold Bounce',
    description: 'Stock has become extremely oversold (RSI below 30) and is showing signs of reversal. This is a mean-reversion play expecting a bounce from depressed levels.',
    category: 'reversal',
    color: '#06b6d4', // cyan
    icon: '↩️',
  },
  acceleration_turn: {
    id: 'acceleration_turn',
    shortName: 'Accel Turn',
    fullName: 'Acceleration Turn',
    description: 'Momentum is accelerating after a period of consolidation or decline. The rate of price change is increasing, suggesting building buying pressure.',
    category: 'momentum',
    color: '#f97316', // orange
    icon: '🔄',
  },
};

/**
 * Get setup definition by ID, with fallback for unknown setups
 */
export function getSetupDefinition(setupId: string | null | undefined): SetupDefinition | null {
  if (!setupId) return null;
  
  const normalized = setupId.toLowerCase().trim();
  
  if (SETUP_DEFINITIONS[normalized]) {
    return SETUP_DEFINITIONS[normalized];
  }
  
  // Fallback for unknown setups - create a generic definition
  return {
    id: normalized,
    shortName: normalized.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').substring(0, 12),
    fullName: normalized.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: 'A quantitative trading setup identified by our backtesting system.',
    category: 'breakout',
    color: '#6b7280', // gray
    icon: '📊',
  };
}

/**
 * Get category label
 */
export function getCategoryLabel(category: SetupDefinition['category']): string {
  const labels: Record<SetupDefinition['category'], string> = {
    breakout: 'Breakout',
    momentum: 'Momentum',
    trend: 'Trend Following',
    reversal: 'Mean Reversion',
    squeeze: 'Volatility Setup',
  };
  return labels[category] || category;
}

/**
 * Get purity score interpretation
 */
export function getPurityInterpretation(score: number | null | undefined): {
  label: string;
  description: string;
  color: string;
} {
  if (score === null || score === undefined) {
    return {
      label: '—',
      description: 'No purity score available',
      color: '#6b7280',
    };
  }
  
  if (score >= 90) {
    return {
      label: 'Textbook',
      description: 'Near-perfect setup with all criteria strongly met. These are rare and often the highest-probability trades.',
      color: '#22c55e',
    };
  }
  if (score >= 80) {
    return {
      label: 'Strong',
      description: 'High-quality setup with most criteria well-met. Good candidate for position sizing.',
      color: '#84cc16',
    };
  }
  if (score >= 70) {
    return {
      label: 'Solid',
      description: 'Decent setup that meets core criteria. May have some minor imperfections.',
      color: '#eab308',
    };
  }
  if (score >= 60) {
    return {
      label: 'Moderate',
      description: 'Setup is present but not ideal. Consider waiting for improvement or using smaller size.',
      color: '#f97316',
    };
  }
  return {
    label: 'Weak',
    description: 'Setup criteria are barely met. Higher risk of failure.',
    color: '#ef4444',
  };
}

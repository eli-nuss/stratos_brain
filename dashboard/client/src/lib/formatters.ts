/**
 * Centralized formatting utilities for consistent data display
 */

// Number formatting
export function formatNumber(value: number | null | undefined, options?: {
  decimals?: number;
  compact?: boolean;
  prefix?: string;
  suffix?: string;
}): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  const { decimals = 2, compact = false, prefix = '', suffix = '' } = options || {};
  
  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1e12) return `${prefix}${(value / 1e12).toFixed(decimals)}T${suffix}`;
    if (absValue >= 1e9) return `${prefix}${(value / 1e9).toFixed(decimals)}B${suffix}`;
    if (absValue >= 1e6) return `${prefix}${(value / 1e6).toFixed(decimals)}M${suffix}`;
    if (absValue >= 1e3) return `${prefix}${(value / 1e3).toFixed(decimals)}K${suffix}`;
  }
  
  return `${prefix}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

// Currency formatting
export function formatCurrency(value: number | null | undefined, options?: {
  compact?: boolean;
  decimals?: number;
  currency?: string;
}): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  const { compact = true, decimals = 2, currency = '$' } = options || {};
  
  if (compact) {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (absValue >= 1e12) return `${sign}${currency}${(absValue / 1e12).toFixed(decimals)}T`;
    if (absValue >= 1e9) return `${sign}${currency}${(absValue / 1e9).toFixed(decimals)}B`;
    if (absValue >= 1e6) return `${sign}${currency}${(absValue / 1e6).toFixed(decimals)}M`;
    if (absValue >= 1e3) return `${sign}${currency}${(absValue / 1e3).toFixed(decimals)}K`;
    return `${sign}${currency}${absValue.toFixed(decimals)}`;
  }
  
  return `${currency}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// Percentage formatting
export function formatPercent(value: number | null | undefined, options?: {
  decimals?: number;
  showSign?: boolean;
  multiply?: boolean;
}): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  const { decimals = 1, showSign = true, multiply = false } = options || {};
  const displayValue = multiply ? value * 100 : value;
  const sign = showSign && displayValue > 0 ? '+' : '';
  
  return `${sign}${displayValue.toFixed(decimals)}%`;
}

// Ratio formatting (P/E, P/S, etc.)
export function formatRatio(value: number | null | undefined, options?: {
  decimals?: number;
  suffix?: string;
}): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  const { decimals = 2, suffix = '' } = options || {};
  return `${value.toFixed(decimals)}${suffix}`;
}

// Date formatting
export function formatDate(dateStr: string | Date | null | undefined, options?: {
  format?: 'short' | 'medium' | 'long' | 'relative';
}): string {
  if (!dateStr) return '-';
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const { format = 'medium' } = options || {};
  
  if (format === 'relative') {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }
  
  const formats = {
    short: { month: 'numeric', day: 'numeric' } as const,
    medium: { month: 'short', day: 'numeric', year: 'numeric' } as const,
    long: { month: 'long', day: 'numeric', year: 'numeric' } as const,
  };
  
  return date.toLocaleDateString(undefined, formats[format]);
}

// Market cap tier
export function getMarketCapTier(marketCap: number | null | undefined): string {
  if (!marketCap) return '-';
  
  if (marketCap >= 200e9) return 'Mega Cap';
  if (marketCap >= 10e9) return 'Large Cap';
  if (marketCap >= 2e9) return 'Mid Cap';
  if (marketCap >= 300e6) return 'Small Cap';
  return 'Micro Cap';
}

// Signal color class
export function getSignalColorClass(value: number | null | undefined, options?: {
  invert?: boolean;
  threshold?: number;
}): string {
  if (value === null || value === undefined || isNaN(value)) return 'text-muted-foreground';
  
  const { invert = false, threshold = 0 } = options || {};
  const isPositive = invert ? value < threshold : value > threshold;
  const isNegative = invert ? value > threshold : value < threshold;
  
  if (isPositive) return 'text-signal-bullish';
  if (isNegative) return 'text-signal-bearish';
  return 'text-muted-foreground';
}

// Quality score color
export function getQualityColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-muted-foreground';
  
  if (score >= 80) return 'text-signal-bullish';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-signal-bearish';
}

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Database, Check, X, Table, BarChart3, FileJson } from 'lucide-react';
import { ToolCall } from '@/hooks/useCompanyChats';
import { cn } from '@/lib/utils';

interface ToolCallBlockProps {
  toolCalls: ToolCall[];
}

// Format large numbers with commas and abbreviations
function formatNumber(value: number): string {
  if (Math.abs(value) >= 1e12) {
    return (value / 1e12).toFixed(2) + 'T';
  }
  if (Math.abs(value) >= 1e9) {
    return (value / 1e9).toFixed(2) + 'B';
  }
  if (Math.abs(value) >= 1e6) {
    return (value / 1e6).toFixed(2) + 'M';
  }
  if (Math.abs(value) >= 1e3) {
    return value.toLocaleString();
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2);
}

// Format percentage values
function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

// Check if a value looks like a percentage (between -1 and 1, or field name suggests it)
function isLikelyPercent(key: string, value: number): boolean {
  const percentKeys = ['margin', 'yield', 'ratio', 'growth', 'change', 'return', 'roe', 'roa', 'percent', 'pct'];
  const keyLower = key.toLowerCase();
  return percentKeys.some(pk => keyLower.includes(pk)) && Math.abs(value) <= 5;
}

// Format a key name to be human-readable
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Render a value with appropriate formatting
function FormattedValue({ keyName, value }: { keyName: string; value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-500 italic">N/A</span>;
  }
  
  if (typeof value === 'boolean') {
    return (
      <span className={cn(
        "px-2 py-0.5 rounded text-xs font-medium",
        value ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-700 text-zinc-400"
      )}>
        {value ? 'Yes' : 'No'}
      </span>
    );
  }
  
  if (typeof value === 'number') {
    if (isLikelyPercent(keyName, value)) {
      const formatted = formatPercent(value);
      const isPositive = value > 0;
      const isNegative = value < 0;
      return (
        <span className={cn(
          "font-mono",
          isPositive && "text-emerald-400",
          isNegative && "text-red-400",
          !isPositive && !isNegative && "text-zinc-200"
        )}>
          {isPositive && '+'}{formatted}
        </span>
      );
    }
    return <span className="font-mono text-zinc-200">{formatNumber(value)}</span>;
  }
  
  if (typeof value === 'string') {
    // Check if it's a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return <span className="text-zinc-300">{new Date(value).toLocaleDateString()}</span>;
    }
    return <span className="text-zinc-200">{value}</span>;
  }
  
  if (Array.isArray(value)) {
    return <span className="text-zinc-400 text-xs">[{value.length} items]</span>;
  }
  
  if (typeof value === 'object') {
    return <span className="text-zinc-400 text-xs">{Object.keys(value).length} fields</span>;
  }
  
  return <span className="text-zinc-200">{String(value)}</span>;
}

// Render data as a nice table
function DataTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([_, v]) => v !== null && v !== undefined);
  
  if (entries.length === 0) {
    return <p className="text-zinc-500 text-sm italic">No data available</p>;
  }

  // Group entries by category if possible
  const grouped = useMemo(() => {
    const groups: Record<string, [string, unknown][]> = {
      'Valuation': [],
      'Profitability': [],
      'Growth': [],
      'Financial Health': [],
      'Other': [],
    };

    entries.forEach(([key, value]) => {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('pe') || keyLower.includes('pb') || keyLower.includes('ps') || keyLower.includes('market') || keyLower.includes('cap') || keyLower.includes('price') || keyLower.includes('ev')) {
        groups['Valuation'].push([key, value]);
      } else if (keyLower.includes('margin') || keyLower.includes('roe') || keyLower.includes('roa') || keyLower.includes('profit')) {
        groups['Profitability'].push([key, value]);
      } else if (keyLower.includes('growth') || keyLower.includes('change') || keyLower.includes('yoy')) {
        groups['Growth'].push([key, value]);
      } else if (keyLower.includes('debt') || keyLower.includes('ratio') || keyLower.includes('current') || keyLower.includes('quick')) {
        groups['Financial Health'].push([key, value]);
      } else {
        groups['Other'].push([key, value]);
      }
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [entries]);

  // If we have meaningful groups, render grouped
  if (grouped.length > 1 && grouped.some(([name]) => name !== 'Other')) {
    return (
      <div className="space-y-4">
        {grouped.map(([groupName, items]) => (
          <div key={groupName}>
            <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              {groupName}
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {items.map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-1.5 border-b border-zinc-800/50 min-w-0 overflow-hidden">
                  <span className="text-xs text-zinc-400 truncate flex-shrink-0 mr-2">{formatKey(key)}</span>
                  <FormattedValue keyName={key} value={value} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Simple table for ungrouped data
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between items-center py-1.5 border-b border-zinc-800/50 min-w-0 overflow-hidden">
          <span className="text-xs text-zinc-400 truncate flex-shrink-0 mr-2">{formatKey(key)}</span>
          <FormattedValue keyName={key} value={value} />
        </div>
      ))}
    </div>
  );
}

export function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set([0])); // First one expanded by default

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedCalls);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCalls(newExpanded);
  };

  const formatFunctionName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const isError = (result: unknown): boolean => {
    return typeof result === 'object' && result !== null && 'error' in result;
  };

  const getIcon = (name: string) => {
    if (name.includes('fundamental') || name.includes('financial')) return BarChart3;
    if (name.includes('price') || name.includes('history')) return Table;
    return Database;
  };

  return (
    <div className="my-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1 bg-purple-500/20 rounded">
          <Database className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Data Retrieved ({toolCalls.length} {toolCalls.length === 1 ? 'query' : 'queries'})
        </span>
      </div>

      {toolCalls.map((call, idx) => {
        const isExpanded = expandedCalls.has(idx);
        const hasError = isError(call.result);
        const Icon = getIcon(call.name);

        return (
          <div
            key={idx}
            className="rounded-xl border border-zinc-700/50 overflow-hidden bg-zinc-900/80 shadow-lg"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-zinc-800/80 to-zinc-800/60 cursor-pointer hover:from-zinc-800 hover:to-zinc-800/80 transition-all"
              onClick={() => toggleExpand(idx)}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-1.5 rounded-lg",
                  hasError ? "bg-red-500/20" : "bg-purple-500/20"
                )}>
                  {isExpanded ? (
                    <ChevronDown className={cn("w-4 h-4", hasError ? "text-red-400" : "text-purple-400")} />
                  ) : (
                    <ChevronRight className={cn("w-4 h-4", hasError ? "text-red-400" : "text-purple-400")} />
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-zinc-200">
                    {formatFunctionName(call.name)}
                  </span>
                </div>
                
                <div className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium",
                  hasError
                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                )}>
                  {hasError ? (
                    <>
                      <X className="w-3 h-3" /> Error
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" /> Success
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="p-4 bg-zinc-950/40">
                {hasError ? (
                  <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-lg">
                    <p className="text-sm text-red-300">
                      {typeof call.result === 'object' && call.result !== null && 'error' in call.result
                        ? String((call.result as { error: unknown }).error)
                        : 'An error occurred'}
                    </p>
                  </div>
                ) : call.result && typeof call.result === 'object' ? (
                  <DataTable data={call.result as Record<string, unknown>} />
                ) : (
                  <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">
                    {JSON.stringify(call.result, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

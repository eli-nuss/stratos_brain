import { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Check, X } from 'lucide-react';
import { ToolCall } from '@/hooks/useCompanyChats';
import { cn } from '@/lib/utils';

interface ToolCallBlockProps {
  toolCalls: ToolCall[];
}

export function ToolCallBlock({ toolCalls }: ToolCallBlockProps) {
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set());

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

  return (
    <div className="my-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
          Database Queries ({toolCalls.length})
        </span>
      </div>

      {toolCalls.map((call, idx) => {
        const isExpanded = expandedCalls.has(idx);
        const hasError = isError(call.result);

        return (
          <div
            key={idx}
            className="rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 cursor-pointer"
              onClick={() => toggleExpand(idx)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                )}
                <span className="text-xs font-medium text-zinc-300">
                  {formatFunctionName(call.name)}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded',
                    hasError
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  )}
                >
                  {hasError ? (
                    <>
                      <X className="w-3 h-3" /> Error
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" /> Success
                    </>
                  )}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">
                {Object.keys(call.args).length} params
              </span>
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="divide-y divide-zinc-700">
                {/* Arguments */}
                <div className="p-3">
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                    Arguments
                  </span>
                  <pre className="mt-2 text-xs font-mono text-zinc-400 whitespace-pre-wrap">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                </div>

                {/* Result */}
                <div className="p-3 bg-zinc-950/50">
                  <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                    Result
                  </span>
                  <pre
                    className={cn(
                      'mt-2 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto',
                      hasError ? 'text-red-400' : 'text-zinc-400'
                    )}
                  >
                    {JSON.stringify(call.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

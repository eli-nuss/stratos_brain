import { useState } from 'react';
import { ChevronDown, ChevronRight, Code, Terminal, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeExecutionBlockProps {
  code?: string;
  language?: string;
  output?: string;
  outcome?: 'OUTCOME_OK' | 'OUTCOME_FAILED' | string;
}

export function CodeExecutionBlock({ code, language = 'python', output, outcome }: CodeExecutionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSuccess = outcome === 'OUTCOME_OK' || !outcome;

  return (
    <div className="my-3 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
          <Code className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium text-zinc-300">
            {language.charAt(0).toUpperCase() + language.slice(1)} Code
          </span>
          {outcome && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded',
                isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              )}
            >
              {isSuccess ? 'Success' : 'Error'}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="p-1 rounded hover:bg-zinc-700 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="divide-y divide-zinc-700">
          {/* Code */}
          {code && (
            <div className="p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                {code}
              </pre>
            </div>
          )}

          {/* Output */}
          {output && (
            <div className="p-3 bg-zinc-950/50">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  Output
                </span>
              </div>
              <pre
                className={cn(
                  'text-xs font-mono whitespace-pre-wrap',
                  isSuccess ? 'text-zinc-400' : 'text-red-400'
                )}
              >
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Code, Terminal, Copy, Check, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

  // Parse the output if it's JSON (from E2B)
  const parsedOutput = useMemo(() => {
    if (!output) return null;
    
    try {
      const parsed = JSON.parse(output);
      if (parsed.output !== undefined) {
        return {
          success: parsed.success !== false && !parsed.error,
          output: parsed.output || '',
          error: parsed.error || null,
          purpose: parsed.purpose || null,
        };
      }
    } catch {
      // Not JSON, return as-is
    }
    
    return {
      success: outcome === 'OUTCOME_OK' || !outcome,
      output: output,
      error: null,
      purpose: null,
    };
  }, [output, outcome]);

  const isSuccess = parsedOutput?.success ?? (outcome === 'OUTCOME_OK' || !outcome);
  const displayOutput = parsedOutput?.output || output || '';
  const displayError = parsedOutput?.error;

  return (
    <div className="my-4 rounded-xl border border-zinc-700/50 overflow-hidden bg-zinc-900/80 shadow-lg max-w-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-zinc-800/80 to-zinc-800/60 cursor-pointer hover:from-zinc-800 hover:to-zinc-800/80 transition-all"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-1.5 rounded-lg",
            isSuccess ? "bg-emerald-500/20" : "bg-red-500/20"
          )}>
            {isExpanded ? (
              <ChevronDown className={cn("w-4 h-4", isSuccess ? "text-emerald-400" : "text-red-400")} />
            ) : (
              <ChevronRight className={cn("w-4 h-4", isSuccess ? "text-emerald-400" : "text-red-400")} />
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-zinc-200">
              {language.charAt(0).toUpperCase() + language.slice(1)} Code
            </span>
          </div>
          
          <div className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium",
            isSuccess
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          )}>
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Executed
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                Error
              </>
            )}
          </div>
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-700/50 transition-colors text-zinc-400 hover:text-white"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div>
          {/* Code */}
          {code && (
            <div className="border-b border-zinc-700/30">
              <SyntaxHighlighter
                language={language}
                style={oneDark}
                wrapLines={true}
                wrapLongLines={true}
                customStyle={{
                  margin: 0,
                  padding: '1rem 1.25rem',
                  background: 'transparent',
                  fontSize: '0.8125rem',
                  lineHeight: '1.7',
                  overflowX: 'auto',
                  maxWidth: '100%',
                }}
                codeTagProps={{
                  style: {
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  }
                }}
                showLineNumbers={code.split('\n').length > 3}
                lineNumberStyle={{
                  minWidth: '2.5em',
                  paddingRight: '1em',
                  color: 'rgb(113 113 122)',
                  fontSize: '0.75rem',
                }}
              >
                {code.trim()}
              </SyntaxHighlighter>
            </div>
          )}

          {/* Output */}
          {(displayOutput || displayError) && (
            <div className="bg-zinc-950/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "p-1 rounded",
                  isSuccess ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  {isSuccess ? (
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {isSuccess ? 'Output' : 'Error'}
                </span>
              </div>
              
              <div className={cn(
                "font-mono text-sm p-3 rounded-lg border",
                isSuccess 
                  ? "bg-zinc-900/50 border-zinc-700/30 text-emerald-300" 
                  : "bg-red-950/30 border-red-900/30 text-red-300"
              )}>
                <pre className="whitespace-pre-wrap break-words leading-relaxed">
                  {displayError || displayOutput}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

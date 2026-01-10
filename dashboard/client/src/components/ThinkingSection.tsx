import { useState } from 'react';
import { ChevronDown, Sparkles, Database, Code, Search, Globe, ExternalLink, Check, X, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCall, GroundingMetadata } from '@/hooks/useCompanyChats';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ThinkingSectionProps {
  toolCalls?: ToolCall[];
  codeExecution?: {
    code?: string;
    language?: string;
    output?: string;
    outcome?: string;
  };
  groundingMetadata?: GroundingMetadata;
}

export function ThinkingSection({ toolCalls, codeExecution, groundingMetadata }: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Check if there's any thinking content to show
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasCodeExecution = codeExecution?.code;
  const hasGrounding = groundingMetadata?.groundingChunks?.length || groundingMetadata?.webSearchQueries?.length;
  
  if (!hasToolCalls && !hasCodeExecution && !hasGrounding) {
    return null;
  }

  // Count total items for the summary
  const itemCount = (toolCalls?.length || 0) + (hasCodeExecution ? 1 : 0) + (groundingMetadata?.groundingChunks?.length || 0);

  const handleCopyCode = async () => {
    if (codeExecution?.code) {
      await navigator.clipboard.writeText(codeExecution.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="mb-3">
      {/* Collapsed Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-medium">
          {isExpanded ? 'Hide thinking' : 'Show thinking'}
        </span>
        <ChevronDown 
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isExpanded && "rotate-180"
          )} 
        />
        {!isExpanded && (
          <span className="text-xs text-muted-foreground/60">
            ({itemCount} {itemCount === 1 ? 'step' : 'steps'})
          </span>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-3 pl-6 border-l-2 border-border/50 space-y-3">
          {/* Tool Calls */}
          {hasToolCalls && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-medium uppercase tracking-wider">Data Retrieved</span>
              </div>
              {toolCalls!.map((call, idx) => {
                const hasError = typeof call.result === 'object' && call.result !== null && 'error' in call.result;
                return (
                  <div key={idx} className="rounded-lg bg-muted/30 border border-border/50 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground/80">
                          {call.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        {hasError ? (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                            <X className="w-2.5 h-2.5" /> Error
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                            <Check className="w-2.5 h-2.5" /> Success
                          </span>
                        )}
                      </div>
                    </div>
                    {call.result && typeof call.result === 'object' && !hasError && (
                      <div className="px-3 pb-2">
                        <div className="text-[10px] text-muted-foreground">
                          {Object.keys(call.result).length} fields returned
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Code Execution */}
          {hasCodeExecution && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-medium uppercase tracking-wider">Code Executed</span>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                  <span className="text-xs font-medium text-foreground/80">
                    {(codeExecution.language || 'python').charAt(0).toUpperCase() + (codeExecution.language || 'python').slice(1)}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-2.5 h-2.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <SyntaxHighlighter
                  language={codeExecution.language || 'python'}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    background: 'transparent',
                    fontSize: '0.7rem',
                    lineHeight: '1.5',
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    }
                  }}
                >
                  {codeExecution.code!.trim()}
                </SyntaxHighlighter>
                {codeExecution.output && (
                  <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
                    <div className="text-[10px] text-muted-foreground mb-1">Output:</div>
                    <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                      {codeExecution.output.length > 200 
                        ? codeExecution.output.slice(0, 200) + '...' 
                        : codeExecution.output}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Web Search / Grounding */}
          {hasGrounding && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-medium uppercase tracking-wider">Web Search</span>
              </div>
              
              {/* Search Queries */}
              {groundingMetadata?.webSearchQueries && groundingMetadata.webSearchQueries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {groundingMetadata.webSearchQueries.map((query, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    >
                      {query}
                    </span>
                  ))}
                </div>
              )}

              {/* Sources */}
              {groundingMetadata?.groundingChunks && groundingMetadata.groundingChunks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {groundingMetadata.groundingChunks.slice(0, 5).map((chunk, idx) => {
                    if (!chunk.web) return null;
                    const domain = new URL(chunk.web.uri).hostname.replace('www.', '');
                    return (
                      <a
                        key={idx}
                        href={chunk.web.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/50"
                      >
                        <Globe className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[120px]">{domain}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    );
                  })}
                  {groundingMetadata.groundingChunks.length > 5 && (
                    <span className="text-[10px] px-2 py-1 text-muted-foreground">
                      +{groundingMetadata.groundingChunks.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

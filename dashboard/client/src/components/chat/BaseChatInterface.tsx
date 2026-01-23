import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { 
  Send, Loader2, RefreshCw, ChevronRight, ChevronDown, Bot, User, 
  Trash2, CheckCircle, XCircle, Search, Code, Database, Globe, 
  FileText, Wrench, Download, FileDown, ExternalLink, Zap, 
  PanelRightClose, PanelRightOpen, RotateCcw, AlertTriangle
} from 'lucide-react';
import { ThinkingSection } from '../ThinkingSection';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { GenerativeUIRenderer } from '../GenerativeUIRenderer';
import { cn } from '@/lib/utils';

// ============ TYPES ============

export interface BaseMessage {
  message_id: string;
  chat_id: string;
  sequence_num: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_calls: ToolCall[] | null;
  executable_code: string | null;
  code_execution_result: string | null;
  grounding_metadata: GroundingMetadata | null;
  attachments: Attachment[] | null;
  model: string | null;
  latency_ms: number | null;
  created_at: string;
  metadata?: {
    agent_summary?: string;
    skeptic_verdict?: {
      verdict: 'PASS' | 'FAIL';
      confidence: number;
      issues: string[];
      corrections: string[];
      reasoning: string;
    };
  } | null;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface GroundingMetadata {
  searchEntryPoint?: {
    renderedContent: string;
  };
  groundingChunks?: Array<{
    web?: {
      uri: string;
      title: string;
    };
  }>;
  webSearchQueries?: string[];
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  mime_type: string;
  name?: string;
}

export interface JobToolCall {
  tool_name: string;
  status: 'started' | 'completed' | 'failed';
  timestamp: string;
  data?: unknown;
}

export interface SummaryResult {
  title: string;
  content: string;
  public_url?: string;
}

export interface SuggestedQuestion {
  text: string;
  icon: string;
}

// ============ THEME VARIANTS ============

export type ChatTheme = 'company' | 'brain';

const themeConfig = {
  company: {
    primaryColor: 'primary',
    gradientFrom: 'primary',
    gradientTo: 'primary',
    avatarBg: 'bg-muted',
    avatarIcon: Bot,
    accentColor: 'text-primary',
    buttonBg: 'bg-primary hover:bg-primary/90',
    modelFlashBg: 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20',
    modelProBg: 'bg-purple-500/10 border-purple-500/30 text-purple-500 hover:bg-purple-500/20',
  },
  brain: {
    primaryColor: 'purple-500',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-pink-500',
    avatarBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
    avatarIcon: Bot,
    accentColor: 'text-purple-500',
    buttonBg: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
    modelFlashBg: 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30',
    modelProBg: 'bg-purple-500/20 text-purple-500 hover:bg-purple-500/30',
  },
};

// ============ EXPANDABLE TOOL CALL COMPONENT ============

export function ExpandableToolCall({ toolCall, theme = 'company' }: { toolCall: JobToolCall; theme?: ChatTheme }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = toolCall.data && Object.keys(toolCall.data as object).length > 0;
  
  const getToolIcon = (name: string) => {
    if (name.includes('search') || name.includes('google') || name.includes('screen')) return <Search className="w-3 h-3" />;
    if (name.includes('python') || name.includes('code') || name.includes('execute')) return <Code className="w-3 h-3" />;
    if (name.includes('database') || name.includes('query') || name.includes('get_') || name.includes('fundamentals')) return <Database className="w-3 h-3" />;
    if (name.includes('web') || name.includes('browse') || name.includes('grounded')) return <Globe className="w-3 h-3" />;
    if (name.includes('document') || name.includes('export')) return <FileText className="w-3 h-3" />;
    return <Wrench className="w-3 h-3" />;
  };
  
  const formatToolName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  const renderToolDetails = () => {
    const data = toolCall.data as Record<string, unknown> | undefined;
    if (!data) return null;
    
    const args = data.args as Record<string, unknown> | undefined;
    
    // search_company_docs - show query and search type
    if (toolCall.tool_name === 'search_company_docs') {
      const query = args?.query || data.query;
      const searchType = args?.search_type || data.search_type || 'all';
      const resultCount = data.result_count;
      return (
        <div className="space-y-2">
          {Boolean(query) && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Search Query</span>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground/80">
                <Search className="w-2.5 h-2.5 text-primary/60" />
                <span>"{String(query)}"</span>
              </div>
            </div>
          )}
          {searchType && (
            <div className="text-xs text-muted-foreground">
              Searching: <span className="text-foreground/80">{String(searchType)}</span>
            </div>
          )}
          {resultCount !== undefined && (
            <div className="text-xs text-green-500/80">
              Found {String(resultCount)} results
            </div>
          )}
        </div>
      );
    }
    
    // Web search / Google - show queries and sources
    if (toolCall.tool_name.includes('google') || toolCall.tool_name.includes('web_search')) {
      return (
        <div className="space-y-2">
          {Boolean(data.queries && Array.isArray(data.queries) && (data.queries as string[]).length > 0) && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Search Queries</span>
              <div className="mt-1 space-y-1">
                {(data.queries as string[]).map((q: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-foreground/80">
                    <Search className="w-2.5 h-2.5 text-primary/60" />
                    <span>"{String(q)}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Boolean(data.sources && Array.isArray(data.sources) && (data.sources as unknown[]).length > 0) && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Sources Found</span>
              <div className="mt-1 space-y-1">
                {(data.sources as Array<{title?: string; url?: string}>).slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <Globe className="w-2.5 h-2.5 text-green-500/60" />
                    <span className="text-foreground/80 truncate" title={s.url}>{s.title || s.url}</span>
                  </div>
                ))}
                {(data.sources as Array<unknown>).length > 5 && (
                  <span className="text-[10px] text-muted-foreground">+{(data.sources as Array<unknown>).length - 5} more sources</span>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    
    // Code execution - show code snippet
    if (toolCall.tool_name.includes('python') || toolCall.tool_name.includes('execute')) {
      return (
        <div className="space-y-2">
          {Boolean(data.code) && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Code</span>
              <pre className="mt-1 text-[10px] bg-background/50 p-2 rounded overflow-x-auto max-h-24 text-foreground/80">
                {String(data.code).slice(0, 300)}{String(data.code).length > 300 ? '...' : ''}
              </pre>
            </div>
          )}
          {Boolean(data.output) && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Output</span>
              <pre className="mt-1 text-[10px] bg-background/50 p-2 rounded overflow-x-auto max-h-16 text-green-400/80">
                {String(data.output).slice(0, 200)}{String(data.output).length > 200 ? '...' : ''}
              </pre>
            </div>
          )}
        </div>
      );
    }
    
    // Database/function calls - show parameters in a cleaner format
    if (data.params || args) {
      const params = (data.params || args) as Record<string, unknown>;
      const resultCount = data.result_count as number | undefined;
      
      const cleanParams = Object.entries(params)
        .filter(([_, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => ({ key: k.replace(/_/g, ' '), value: v }));
      
      return (
        <div className="space-y-2">
          {cleanParams.length > 0 && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Parameters</span>
              <div className="mt-1 space-y-0.5">
                {cleanParams.slice(0, 5).map(({ key, value }, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="text-foreground/80">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
                {cleanParams.length > 5 && (
                  <span className="text-[10px] text-muted-foreground">+{cleanParams.length - 5} more params</span>
                )}
              </div>
            </div>
          )}
          {resultCount !== undefined && (
            <div className="text-xs text-green-500/80">
              Returned {resultCount} results
            </div>
          )}
        </div>
      );
    }
    
    // Generic fallback - show raw data
    return (
      <pre className="text-[10px] bg-background/50 p-2 rounded overflow-x-auto max-h-24 text-foreground/80">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };
  
  const statusColor = theme === 'brain' ? 'text-purple-500' : 'text-primary';
  
  return (
    <div className="text-xs">
      <button
        onClick={() => hasData && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 w-full text-left",
          Boolean(hasData) && "cursor-pointer hover:bg-background/30 -mx-1 px-1 rounded transition-colors"
        )}
        disabled={!hasData}
      >
        {toolCall.status === 'started' && (
          <Loader2 className={cn("w-3 h-3 animate-spin flex-shrink-0", statusColor)} />
        )}
        {toolCall.status === 'completed' && (
          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
        )}
        {toolCall.status === 'failed' && (
          <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />
        )}
        <span className="text-muted-foreground flex-1">
          {formatToolName(toolCall.tool_name)}
        </span>
        {Boolean(hasData) && (
          <ChevronDown className={cn(
            "w-3 h-3 text-muted-foreground/50 transition-transform",
            isExpanded && "rotate-180"
          )} />
        )}
      </button>
      
      {isExpanded && Boolean(hasData) && (
        <div className="mt-2 ml-5 pl-2 border-l border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
          {renderToolDetails()}
        </div>
      )}
    </div>
  );
}

// ============ MESSAGE BUBBLE COMPONENT ============

interface MessageBubbleProps {
  message: BaseMessage;
  theme?: ChatTheme;
  AvatarIcon?: React.ComponentType<{ className?: string }>;
}

export function MessageBubble({ message, theme = 'company', AvatarIcon }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasCodeExecution = message.executable_code || message.code_execution_result;
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const hasGrounding = message.grounding_metadata;
  const hasThinkingContent = hasToolCalls || hasCodeExecution || hasGrounding;
  
  const config = themeConfig[theme];
  const Icon = AvatarIcon || config.avatarIcon;

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary' : config.avatarBg
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Icon className={cn("w-4 h-4", theme === 'brain' ? "text-white" : "text-primary")} />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[85%] min-w-0 overflow-hidden', isUser ? 'text-right' : 'text-left')}>
        {/* Thinking Section - Collapsible, shown before the message */}
        {hasThinkingContent && !isUser && (
          <ThinkingSection
            toolCalls={message.tool_calls || undefined}
            codeExecution={hasCodeExecution ? {
              code: message.executable_code || undefined,
              output: message.code_execution_result || undefined,
              language: 'python',
            } : undefined}
            groundingMetadata={message.grounding_metadata || undefined}
          />
        )}

        {/* Generative UI Components - Rendered before text content */}
        {!isUser && message.tool_calls?.map((tool, idx) => {
          if (tool.name === 'generate_dynamic_ui' && tool.result) {
            const result = tool.result as { ui_component?: { componentType: 'FinancialChart' | 'MetricCard' | 'RiskGauge' | 'DataTable' | 'ComparisonChart' | 'InteractiveModel'; title: string; data: unknown; insight?: string } };
            if (result.ui_component) {
              return (
                <div key={`ui-${idx}`} className="w-full max-w-2xl mb-3">
                  <GenerativeUIRenderer toolCall={result.ui_component} />
                </div>
              );
            }
          }
          // Document Export Card
          if (tool.name === 'create_and_export_document' && tool.result) {
            const result = tool.result as {
              document_created?: {
                success: boolean;
                title: string;
                document_type: string;
                markdown_url?: string;
                message: string;
              };
              download_data?: {
                title: string;
                content: string;
                markdown_url?: string;
                export_format: string;
              };
            };
            if (result.document_created?.success && result.download_data) {
              const { title, content, markdown_url, export_format } = result.download_data;
              
              const handleDownloadMarkdown = () => {
                const blob = new Blob([content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              };
              
              const handleDownloadPdf = async () => {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>${title}</title>
                        <style>
                          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                          h1, h2, h3 { margin-top: 1.5em; }
                          table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                          th { background: #f5f5f5; }
                          pre { background: #f5f5f5; padding: 1em; overflow-x: auto; }
                          code { background: #f5f5f5; padding: 2px 4px; }
                        </style>
                      </head>
                      <body>
                        <div id="content"></div>
                        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                        <script>
                          document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
                          setTimeout(() => window.print(), 500);
                        </script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }
              };
              
              return (
                <div key={`doc-${idx}`} className="w-full max-w-md mb-3">
                  <div className={cn(
                    "border rounded-xl p-4",
                    theme === 'brain' 
                      ? "bg-gradient-to-br from-purple-500/5 to-pink-500/10 border-purple-500/20"
                      : "bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        theme === 'brain' ? "bg-purple-500/10" : "bg-primary/10"
                      )}>
                        <FileText className={cn("w-5 h-5", theme === 'brain' ? "text-purple-500" : "text-primary")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-foreground truncate">{title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.document_created.document_type.charAt(0).toUpperCase() + result.document_created.document_type.slice(1)} • Ready to download
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleDownloadMarkdown}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-background hover:bg-muted border border-border rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Markdown
                      </button>
                      {(export_format === 'pdf' || export_format === 'both') && (
                        <button
                          onClick={handleDownloadPdf}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-background hover:bg-muted border border-border rounded-lg transition-colors"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      )}
                      {markdown_url && (
                        <a
                          href={markdown_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-background hover:bg-muted border border-border rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          }
          return null;
        })}

        {/* Message Content */}
        {message.content && (
          <div
            className={cn(
              'inline-block rounded-2xl px-4 py-3 text-left',
              isUser
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
            )}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>
        )}

        {/* Timestamp and Agent Info */}
        <div className={cn(
          'flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground flex-wrap',
          isUser ? 'justify-end' : 'justify-start'
        )}>
          <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {message.model && !isUser && (
            <span className="opacity-50">• {message.model}</span>
          )}
          {/* Skeptic Agent Badge */}
          {message.metadata?.agent_summary && !isUser && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {message.metadata.agent_summary}
            </span>
          )}
          {message.metadata?.skeptic_verdict && !isUser && (
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border',
              message.metadata.skeptic_verdict.verdict === 'PASS' 
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            )}>
              {message.metadata.skeptic_verdict.verdict === 'PASS' ? '✓' : '✗'} Skeptic: {message.metadata.skeptic_verdict.verdict}
              <span className="opacity-60">({message.metadata.skeptic_verdict.confidence}%)</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ ERROR RECOVERY BANNER ============

interface ErrorRecoveryBannerProps {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
  lastUserMessage?: string;
}

export function ErrorRecoveryBanner({ 
  error, 
  onRetry, 
  onDismiss, 
  isRetrying = false,
  lastUserMessage 
}: ErrorRecoveryBannerProps) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">Analysis Failed</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
          {lastUserMessage && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              Last message: "{lastUserMessage.slice(0, 50)}{lastUserMessage.length > 50 ? '...' : ''}"
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive/20 hover:bg-destructive/30 text-destructive rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className={cn("w-3.5 h-3.5", isRetrying && "animate-spin")} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ MOBILE DRAWER COMPONENT ============

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function MobileDrawer({ isOpen, onClose, title, children }: MobileDrawerProps) {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 xl:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={cn(
        "fixed inset-x-0 bottom-0 z-50 xl:hidden",
        "bg-card border-t border-border rounded-t-2xl",
        "animate-in slide-in-from-bottom duration-300 ease-out",
        "max-h-[85vh] flex flex-col"
      )}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground bg-muted rounded-lg"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}

// ============ SUMMARY RESULT CARD ============

interface SummaryResultCardProps {
  summaryResult: SummaryResult;
  onClose: () => void;
  theme?: ChatTheme;
}

export function SummaryResultCard({ summaryResult, onClose, theme = 'company' }: SummaryResultCardProps) {
  const handleDownloadMarkdown = () => {
    const blob = new Blob([summaryResult.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summaryResult.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${summaryResult.title}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
              h1, h2, h3 { margin-top: 1.5em; }
              table { border-collapse: collapse; width: 100%; margin: 1em 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
              pre { background: #f5f5f5; padding: 1em; overflow-x-auto; }
              code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
            </style>
          </head>
          <body>
            <div id="content"></div>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
            <script>
              document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(summaryResult.content)});
              setTimeout(() => window.print(), 500);
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className={cn(
      "border rounded-xl p-4 max-w-2xl",
      theme === 'brain'
        ? "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30"
        : "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <FileText className={cn("w-5 h-5", theme === 'brain' ? "text-purple-500" : "text-primary")} />
          <div>
            <h4 className="font-medium text-foreground text-sm">{summaryResult.title}</h4>
            <p className="text-xs text-muted-foreground">Chat summary generated</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownloadMarkdown}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors",
            theme === 'brain'
              ? "bg-purple-500/20 hover:bg-purple-500/30 text-purple-400"
              : "bg-primary/20 hover:bg-primary/30 text-primary"
          )}
        >
          <Download className="w-3.5 h-3.5" />
          Download Markdown
        </button>
        <button
          onClick={handleDownloadPdf}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors",
            theme === 'brain'
              ? "bg-pink-500/20 hover:bg-pink-500/30 text-pink-400"
              : "bg-primary/20 hover:bg-primary/30 text-primary"
          )}
        >
          <FileDown className="w-3.5 h-3.5" />
          Export as PDF
        </button>
        {summaryResult.public_url && (
          <a
            href={summaryResult.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </a>
        )}
      </div>
    </div>
  );
}

// ============ MAIN BASE CHAT INTERFACE ============

export interface BaseChatInterfaceProps<TMessage extends BaseMessage> {
  // Core props
  chatId: string;
  displayName: string;
  theme?: ChatTheme;
  
  // Messages
  messages: TMessage[];
  messagesLoading: boolean;
  refreshMessages: () => Promise<unknown>;
  
  // Send message
  sendMessage: (content: string, model?: 'flash' | 'pro') => Promise<string | null>;
  resetSendState: () => void;
  isSending: boolean;
  isProcessing: boolean;
  isRecovering: boolean;
  isComplete: boolean;
  error: string | null;
  
  // Streaming
  streamingText: string;
  activeTools: string[];
  isStreaming: boolean;
  toolCalls: JobToolCall[];
  
  // Optional callbacks
  onRefresh?: () => void;
  onClearChat?: () => Promise<void>;
  onSummarize?: () => Promise<SummaryResult | null>;
  onRefreshContext?: () => Promise<void>;
  
  // Side panel (optional)
  sidePanel?: ReactNode;
  sidePanelTitle?: string;
  
  // Customization
  suggestedQuestions?: SuggestedQuestion[];
  welcomeTitle?: ReactNode;
  welcomeSubtitle?: string;
  placeholder?: string;
  AvatarIcon?: React.ComponentType<{ className?: string }>;
}

export function BaseChatInterface<TMessage extends BaseMessage>({
  chatId,
  displayName,
  theme = 'company',
  messages,
  messagesLoading,
  refreshMessages,
  sendMessage,
  resetSendState,
  isSending,
  isProcessing,
  isRecovering,
  isComplete,
  error,
  streamingText,
  activeTools,
  isStreaming,
  toolCalls,
  onRefresh,
  onClearChat,
  onSummarize,
  onRefreshContext,
  sidePanel,
  sidePanelTitle = 'Data',
  suggestedQuestions = [],
  welcomeTitle,
  welcomeSubtitle,
  placeholder = 'Ask me anything...',
  AvatarIcon,
}: BaseChatInterfaceProps<TMessage>) {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<'flash' | 'pro'>('flash');
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  
  const config = themeConfig[theme];
  const Icon = AvatarIcon || config.avatarIcon;

  // Track if user has scrolled up from the bottom
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Check if user is within 100px of the bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setIsUserScrolledUp(!isNearBottom);
  }, []);

  // Auto-scroll to bottom when new messages arrive, but only if user hasn't scrolled up
  useEffect(() => {
    if (!isUserScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText, toolCalls, isUserScrolledUp]);

  // Handle job completion
  useEffect(() => {
    if (isComplete && !error) {
      refreshMessages();
      setPendingUserMessage(null);
      setLastFailedMessage(null);
      onRefresh?.();
      resetSendState();
    }
  }, [isComplete, error, refreshMessages, onRefresh, resetSendState]);

  // Track failed messages for retry
  useEffect(() => {
    if (error && pendingUserMessage) {
      setLastFailedMessage(pendingUserMessage);
      setPendingUserMessage(null);
    }
  }, [error, pendingUserMessage]);

  // Clear summary result when switching chats
  useEffect(() => {
    setSummaryResult(null);
    setLastFailedMessage(null);
  }, [chatId]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [chatId]);

  const handleSend = async () => {
    if (!input.trim() || isSending || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setPendingUserMessage(userMessage);
    setLastFailedMessage(null);

    await sendMessage(userMessage, selectedModel);
  };

  const handleRetry = async () => {
    if (!lastFailedMessage || isRetrying) return;
    
    setIsRetrying(true);
    setPendingUserMessage(lastFailedMessage);
    resetSendState();
    
    try {
      await sendMessage(lastFailedMessage, selectedModel);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDismissError = () => {
    setLastFailedMessage(null);
    resetSendState();
  };

  const handleRefreshContext = async () => {
    if (!onRefreshContext) return;
    setIsRefreshingContext(true);
    try {
      await onRefreshContext();
    } finally {
      setIsRefreshingContext(false);
    }
  };

  const handleClearChat = async () => {
    if (!onClearChat) return;
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
      return;
    }
    
    setIsClearingChat(true);
    try {
      await onClearChat();
      await refreshMessages();
      onRefresh?.();
    } finally {
      setIsClearingChat(false);
    }
  };

  const handleSummarize = async () => {
    if (!onSummarize || messages.length === 0) return;
    
    setIsSummarizing(true);
    setSummaryResult(null);
    
    try {
      const result = await onSummarize();
      if (result) {
        setSummaryResult(result);
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "p-2 rounded-lg flex-shrink-0",
              theme === 'brain' 
                ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20" 
                : "bg-primary/10"
            )}>
              <Icon className={cn("w-4 h-4", theme === 'brain' ? "text-purple-500" : "text-primary")} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground text-sm truncate">{displayName}</h3>
              <p className="text-[11px] text-muted-foreground">
                Powered by Gemini 3 Pro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Real-time streaming indicator */}
            {isStreaming && (
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md",
                theme === 'brain'
                  ? "text-purple-500 bg-purple-500/10"
                  : "text-yellow-500 bg-yellow-500/10"
              )}>
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">Live</span>
              </div>
            )}
            {onSummarize && (
              <button
                onClick={handleSummarize}
                disabled={isSummarizing || messages.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-md transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
                title="Summarize chat to document"
              >
                <FileDown className={cn('w-3.5 h-3.5', isSummarizing && 'animate-pulse')} />
                <span className="hidden sm:inline">{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
              </button>
            )}
            {onClearChat && (
              <button
                onClick={handleClearChat}
                disabled={isClearingChat || messages.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
                title="Clear all messages"
              >
                <Trash2 className={cn('w-3.5 h-3.5', isClearingChat && 'animate-pulse')} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            {onRefreshContext && (
              <button
                onClick={handleRefreshContext}
                disabled={isRefreshingContext}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
                title="Refresh data context"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isRefreshingContext && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}
            {sidePanel && (
              <button
                onClick={() => setShowSidePanel(!showSidePanel)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors",
                  showSidePanel 
                    ? `${config.accentColor} bg-${config.primaryColor}/10` 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title={showSidePanel ? `Hide ${sidePanelTitle}` : `Show ${sidePanelTitle}`}
              >
                {showSidePanel ? (
                  <PanelRightClose className="w-3.5 h-3.5" />
                ) : (
                  <PanelRightOpen className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{showSidePanel ? 'Hide' : sidePanelTitle}</span>
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-6 space-y-6 scrollbar-minimal"
        >
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto">
              {/* Welcome Section */}
              <div className="text-center mb-8">
                <div className={cn(
                  "inline-flex p-4 rounded-full mb-4",
                  theme === 'brain'
                    ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20"
                    : "bg-primary/10"
                )}>
                  <Icon className={cn(
                    "w-8 h-8",
                    theme === 'brain' ? "text-purple-500" : "text-primary"
                  )} />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {welcomeTitle || (
                    theme === 'brain' 
                      ? <>Welcome to <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Stratos Brain</span></>
                      : <>Start researching <span className={config.accentColor}>{displayName}</span></>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {welcomeSubtitle || 'I can analyze data, search the web, and run calculations'}
                </p>
              </div>

              {/* Suggested Questions */}
              {suggestedQuestions.length > 0 && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 text-center">
                    Suggested questions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {suggestedQuestions.map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(question.text);
                          inputRef.current?.focus();
                        }}
                        className="flex items-center gap-3 text-left text-sm text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 p-3 rounded-xl transition-all group border border-transparent hover:border-border"
                      >
                        <span className="text-base">{question.icon}</span>
                        <span className="flex-1">{question.text}</span>
                        <ChevronRight className={cn(
                          "w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity",
                          config.accentColor
                        )} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble 
                key={msg.message_id} 
                message={msg} 
                theme={theme}
                AvatarIcon={AvatarIcon}
              />
            ))
          )}

          {/* Optimistic User Message */}
          {pendingUserMessage && (isSending || isProcessing) && !messages.some(m => m.role === 'user' && m.content === pendingUserMessage) && (
            <div className="flex gap-3 flex-row-reverse animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1 max-w-[85%] min-w-0 overflow-hidden text-right">
                <div className="inline-block rounded-2xl px-4 py-3 text-left bg-primary text-primary-foreground rounded-br-sm">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{pendingUserMessage}</p>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground justify-end">
                  <span>Just now</span>
                </div>
              </div>
            </div>
          )}

          {/* AI Thinking Indicator */}
          {(isSending || isProcessing) && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                config.avatarBg
              )}>
                <Icon className={cn("w-4 h-4", theme === 'brain' ? "text-white" : "text-primary")} />
              </div>
              <div className="flex-1 max-w-[85%]">
                {/* Streaming text */}
                {streamingText && (
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 mb-2">
                    <MarkdownRenderer content={streamingText} />
                    <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
                  </div>
                )}
                
                {/* Active tools indicator */}
                {activeTools && activeTools.length > 0 && !streamingText && (
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 mb-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Running: {activeTools.join(', ')}</span>
                    </div>
                  </div>
                )}
                
                {/* Thinking/Processing indicator */}
                {!streamingText && !activeTools?.length && (
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex gap-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-bounce",
                          theme === 'brain' ? "bg-purple-500" : "bg-primary"
                        )} style={{ animationDelay: '0ms' }} />
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-bounce",
                          theme === 'brain' ? "bg-purple-500" : "bg-primary"
                        )} style={{ animationDelay: '150ms' }} />
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-bounce",
                          theme === 'brain' ? "bg-purple-500" : "bg-primary"
                        )} style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {isRecovering ? 'Reconnecting...' : isProcessing ? 'Analyzing...' : 'Starting...'}
                      </span>
                    </div>
                    {/* Real-time tool execution progress */}
                    {toolCalls && toolCalls.length > 0 && (
                      <div className="space-y-1.5 border-t border-border/50 pt-2 mt-2">
                        {(() => {
                          const consolidated = new Map<string, JobToolCall>();
                          toolCalls.forEach((tc) => {
                            const existing = consolidated.get(tc.tool_name);
                            if (!existing || tc.status !== 'started' || existing.status === 'started') {
                              const mergedData = { ...(existing?.data as object || {}), ...(tc.data as object || {}) };
                              consolidated.set(tc.tool_name, { ...tc, data: Object.keys(mergedData).length > 0 ? mergedData : undefined });
                            }
                          });
                          return Array.from(consolidated.values()).map((tc, idx) => (
                            <ExpandableToolCall key={`${tc.tool_name}-${idx}`} toolCall={tc} theme={theme} />
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Recovery Banner */}
          {error && lastFailedMessage && (
            <ErrorRecoveryBanner
              error={error}
              onRetry={handleRetry}
              onDismiss={handleDismissError}
              isRetrying={isRetrying}
              lastUserMessage={lastFailedMessage}
            />
          )}

          {/* Summary Result Card */}
          {summaryResult && (
            <SummaryResultCard 
              summaryResult={summaryResult} 
              onClose={() => setSummaryResult(null)}
              theme={theme}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t border-border bg-card">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            {/* Model Toggle */}
            <div className="flex-shrink-0">
              <button
                onClick={() => setSelectedModel(selectedModel === 'flash' ? 'pro' : 'flash')}
                disabled={isSending || isProcessing}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all",
                  "border disabled:opacity-50 disabled:cursor-not-allowed",
                  selectedModel === 'flash'
                    ? config.modelFlashBg
                    : config.modelProBg
                )}
                title={selectedModel === 'flash' ? 'Flash: Faster responses' : 'Pro: More powerful analysis'}
              >
                <Zap className={cn(
                  "w-3.5 h-3.5",
                  selectedModel === 'flash' ? "text-amber-500" : "text-purple-500"
                )} />
                <span className="hidden sm:inline">{selectedModel === 'flash' ? 'Flash' : 'Pro'}</span>
              </button>
            </div>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                  "w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none transition-all",
                  theme === 'brain'
                    ? "focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                    : "focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                )}
                rows={1}
                disabled={isSending}
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending || isProcessing}
              className={cn(
                "p-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100",
                "disabled:bg-muted disabled:cursor-not-allowed",
                config.buttonBg
              )}
            >
              {(isSending || isProcessing) ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center hidden sm:block">
            Press Enter to send • Shift+Enter for new line • {selectedModel === 'flash' ? '⚡ Flash mode (faster)' : '🔮 Pro mode (powerful)'}
          </p>
        </div>
      </div>

      {/* Side Panel - Desktop */}
      {sidePanel && showSidePanel && (
        <>
          {/* Desktop: inline panel */}
          <aside className="hidden xl:block flex-none w-96 h-full overflow-y-auto border-l border-border bg-card scrollbar-minimal">
            {sidePanel}
          </aside>
          
          {/* Mobile: drawer */}
          <MobileDrawer
            isOpen={showSidePanel}
            onClose={() => setShowSidePanel(false)}
            title={sidePanelTitle}
          >
            {sidePanel}
          </MobileDrawer>
        </>
      )}
    </div>
  );
}

export default BaseChatInterface;

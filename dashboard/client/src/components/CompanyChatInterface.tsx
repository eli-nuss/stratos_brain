import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, RefreshCw, ChevronRight, ChevronDown, Bot, User, PanelRightClose, PanelRightOpen, Trash2, MessageSquare, Wrench, CheckCircle, XCircle, Search, Code, Database, Globe, FileText, Download, FileDown, ExternalLink, Zap } from 'lucide-react';
import {
  useChatMessages,
  useSendMessage,
  refreshChatContext,
  clearChatMessages,
  ChatMessage,
  CompanyChat,
} from '@/hooks/useCompanyChats';
// useStreamingChat removed - now using broadcast streaming via useSendMessage
import { useAuth } from '@/contexts/AuthContext';
import { ThinkingSection } from './ThinkingSection';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CompanySidePanel } from './CompanySidePanel';
import { GenerativeUIRenderer } from './GenerativeUIRenderer';
import { cn } from '@/lib/utils';

interface CompanyChatInterfaceProps {
  chat: CompanyChat;
  onRefresh?: () => void;
}

// Tool call type from the job
interface JobToolCall {
  tool_name: string;
  status: 'started' | 'completed' | 'failed';
  timestamp: string;
  data?: unknown;
}

// Expandable tool call component for real-time progress
function ExpandableToolCall({ toolCall }: { toolCall: JobToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = toolCall.data && Object.keys(toolCall.data as object).length > 0;
  
  // Get icon based on tool name
  const getToolIcon = (name: string) => {
    if (name.includes('search') || name.includes('google')) return <Search className="w-3 h-3" />;
    if (name.includes('python') || name.includes('code') || name.includes('execute')) return <Code className="w-3 h-3" />;
    if (name.includes('database') || name.includes('query') || name.includes('get_')) return <Database className="w-3 h-3" />;
    if (name.includes('web') || name.includes('browse')) return <Globe className="w-3 h-3" />;
    return <Wrench className="w-3 h-3" />;
  };
  
  // Format tool name for display
  const formatToolName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Render tool-specific details
  const renderToolDetails = () => {
    const data = toolCall.data as Record<string, unknown> | undefined;
    if (!data) return null;
    
    // Extract args if present (from started event)
    const args = data.args as Record<string, unknown> | undefined;
    
    // search_company_docs - show query and search type
    if (toolCall.tool_name === 'search_company_docs') {
      const query = args?.query || data.query;
      const searchType = args?.search_type || data.search_type || 'all';
      const resultCount = data.result_count;
      return (
        <div className="space-y-2">
          {query && (
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
              Found {resultCount} results
            </div>
          )}
        </div>
      );
    }
    
    // Web search / Google - show queries and sources
    if (toolCall.tool_name.includes('google') || toolCall.tool_name.includes('web_search')) {
      return (
        <div className="space-y-2">
          {data.queries && Array.isArray(data.queries) && (data.queries as string[]).length > 0 && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Search Queries</span>
              <div className="mt-1 space-y-1">
                {(data.queries as string[]).map((q, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-foreground/80">
                    <Search className="w-2.5 h-2.5 text-primary/60" />
                    <span>"{q}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.sources && Array.isArray(data.sources) && (data.sources as unknown[]).length > 0 && (
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
          {data.code && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground/70 font-medium">Code</span>
              <pre className="mt-1 text-[10px] bg-background/50 p-2 rounded overflow-x-auto max-h-24 text-foreground/80">
                {String(data.code).slice(0, 300)}{String(data.code).length > 300 ? '...' : ''}
              </pre>
            </div>
          )}
          {data.output && (
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
      
      // Filter out empty/null values and format nicely
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
  
  return (
    <div className="text-xs">
      <button
        onClick={() => hasData && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 w-full text-left",
          hasData && "cursor-pointer hover:bg-background/30 -mx-1 px-1 rounded transition-colors"
        )}
        disabled={!hasData}
      >
        {toolCall.status === 'started' && (
          <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
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
        {hasData && (
          <ChevronDown className={cn(
            "w-3 h-3 text-muted-foreground/50 transition-transform",
            isExpanded && "rotate-180"
          )} />
        )}
      </button>
      
      {/* Expanded details */}
      {isExpanded && hasData && (
        <div className="mt-2 ml-5 pl-2 border-l border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
          {renderToolDetails()}
        </div>
      )}
    </div>
  );
}

// Individual message component
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const hasCodeExecution = message.executable_code || message.code_execution_result;
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const hasGrounding = message.grounding_metadata;
  const hasThinkingContent = hasToolCalls || hasCodeExecution || hasGrounding;

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary' : 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[85%] min-w-0 overflow-hidden', isUser ? 'text-right' : 'text-left')}>
        {/* Thinking Section - Collapsible, shown before the message */}
        {hasThinkingContent && !isUser && (
          <ThinkingSection
            toolCalls={message.tool_calls}
            codeExecution={hasCodeExecution ? {
              code: message.executable_code || undefined,
              output: message.code_execution_result || undefined,
              language: 'python',
            } : undefined}
            groundingMetadata={message.grounding_metadata}
          />
        )}

        {/* Generative UI Components - Rendered before text content */}
        {!isUser && message.tool_calls?.map((tool, idx) => {
          if (tool.name === 'generate_dynamic_ui' && tool.result) {
            // Extract the UI component data from the tool result
            const result = tool.result as { ui_component?: { componentType: string; title: string; data: any; insight?: string } };
            if (result.ui_component) {
              return (
                <div key={`ui-${idx}`} className="w-full max-w-2xl mb-3">
                  <GenerativeUIRenderer toolCall={result.ui_component as any} />
                </div>
              );
            }
          }
          // Document Export Card - shown when AI creates a document
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
                // Use browser print to PDF as a simple solution
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
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-foreground truncate">{title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.document_created.document_type.charAt(0).toUpperCase() + result.document_created.document_type.slice(1)} • Saved to documents
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
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
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-3 text-left max-w-full overflow-hidden',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm'
          )}
        >
          {message.content && (
            isUser ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <MarkdownRenderer content={message.content} className="text-sm" />
            )
          )}
        </div>

        {/* Timestamp and metadata */}
        <div
          className={cn(
            'flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground',
            isUser ? 'justify-end' : 'justify-start'
          )}
        >
          <span>
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.latency_ms && !isUser && (
            <span className="hidden sm:inline">• {(message.latency_ms / 1000).toFixed(1)}s</span>
          )}
          {message.model && !isUser && (
            <span className="hidden sm:inline">• {message.model.split('/').pop()}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CompanyChatInterface({ chat, onRefresh }: CompanyChatInterfaceProps) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { messages, isLoading: messagesLoading, refresh: refreshMessages } = useChatMessages(chat.chat_id);
  const [input, setInput] = useState('');
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{ title: string; content: string; public_url?: string } | null>(null);
  const [showFundamentals, setShowFundamentals] = useState(false);
  // Model selection: 'flash' (fast, default) or 'pro' (powerful)
  const [selectedModel, setSelectedModel] = useState<'flash' | 'pro'>('flash');
  // Optimistic user message - shown immediately while waiting for API response
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use the job-based message sending hook with broadcast streaming
  const {
    sendMessage,
    reset: resetSendState,
    isSending,
    isProcessing,
    toolCalls,
    isComplete,
    error,
    isRecovering,
    // Real-time broadcast streaming state
    streamingText,
    activeTools,
    isStreaming,
  } = useSendMessage(chat.chat_id);

  // Show fundamentals panel by default on larger screens
  useEffect(() => {
    const checkScreenSize = () => {
      setShowFundamentals(window.innerWidth >= 1280);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Scroll to bottom when new messages arrive, tool calls update, or pending message appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolCalls, pendingUserMessage]);

  // Refresh messages when job completes
  useEffect(() => {
    if (isComplete) {
      refreshMessages();
      onRefresh?.();
      resetSendState();
      // Clear the pending message since it's now in the actual messages
      setPendingUserMessage(null);
    }
  }, [isComplete, refreshMessages, onRefresh, resetSendState]);

  // Clear summary result when switching chats
  useEffect(() => {
    setSummaryResult(null);
  }, [chat.chat_id]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [chat.chat_id]);

  const handleSend = async () => {
    if (!input.trim() || isSending || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    
    // Show user message immediately (optimistic update)
    setPendingUserMessage(userMessage);

    await sendMessage(userMessage, selectedModel);
  };

  const handleRefreshContext = async () => {
    setIsRefreshingContext(true);
    try {
      await refreshChatContext(chat.chat_id, userId);
    } catch (err) {
      console.error('Failed to refresh context:', err);
    } finally {
      setIsRefreshingContext(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
      return;
    }
    
    setIsClearingChat(true);
    try {
      await clearChatMessages(chat.chat_id, userId);
      await refreshMessages();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to clear chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear chat');
    } finally {
      setIsClearingChat(false);
    }
  };

  const handleSummarizeChat = async () => {
    if (messages.length === 0) return;
    
    setIsSummarizing(true);
    setSummaryResult(null);
    
    try {
      const response = await fetch(`/api/company-chat-api/chats/${chat.chat_id}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || '',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to summarize chat');
      }
      
      const data = await response.json();
      setSummaryResult(data);
    } catch (err) {
      console.error('Failed to summarize chat:', err);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDownloadSummaryMarkdown = () => {
    if (!summaryResult) return;
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

  const handleDownloadSummaryPdf = () => {
    if (!summaryResult) return;
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
              pre { background: #f5f5f5; padding: 1em; overflow-x: auto; }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    { text: "What are the key financial metrics?", icon: "📊" },
    { text: "Analyze the recent price action", icon: "📈" },
    { text: "What are the main risks?", icon: "⚠️" },
    { text: "Compare to sector peers", icon: "🔍" },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* 
        Main Chat Column
        - flex-1 to take remaining space
        - flex flex-col to stack header, messages, input vertically
        - overflow-hidden on the container, overflow-y-auto on messages only
      */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - fixed at top of chat column */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground text-sm truncate">{chat.display_name}</h3>
              <p className="text-[11px] text-muted-foreground">
                Powered by Gemini 3 Pro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Real-time streaming indicator */}
            {isStreaming && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-yellow-500 bg-yellow-500/10 rounded-md">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">Live</span>
              </div>
            )}
            <button
              onClick={handleSummarizeChat}
              disabled={isSummarizing || messages.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-md transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
              title="Summarize chat to document"
            >
              <FileDown className={cn('w-3.5 h-3.5', isSummarizing && 'animate-pulse')} />
              <span className="hidden sm:inline">{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
            </button>
            <button
              onClick={handleClearChat}
              disabled={isClearingChat || messages.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
              title="Clear all messages"
            >
              <Trash2 className={cn('w-3.5 h-3.5', isClearingChat && 'animate-pulse')} />
              <span className="hidden sm:inline">Clear</span>
            </button>
            <button
              onClick={handleRefreshContext}
              disabled={isRefreshingContext}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
              title="Refresh company data context"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshingContext && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setShowFundamentals(!showFundamentals)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors",
                showFundamentals 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={showFundamentals ? 'Hide data panel' : 'Show data panel'}
            >
              {showFundamentals ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{showFundamentals ? 'Hide' : 'Data'}</span>
            </button>
          </div>
        </div>

        {/* Messages - this is the ONLY scrollable area in the chat column */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-6 space-y-6 scrollbar-minimal">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto">
              {/* Welcome Section */}
              <div className="text-center mb-8">
                <div className="inline-flex p-4 bg-primary/10 rounded-full mb-4">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Start researching <span className="text-primary">{chat.display_name}</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  I can analyze data, search the web, and run calculations
                </p>
              </div>

              {/* Suggested Questions */}
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
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.message_id} message={msg} />
            ))
          )}

          {/* Optimistic User Message - shown immediately while waiting for response */}
          {/* Only show if the message hasn't been saved to DB yet (not in messages array) */}
          {pendingUserMessage && (isSending || isProcessing) && !messages.some(m => m.role === 'user' && m.content === pendingUserMessage) && (
            <div className="flex gap-3 flex-row-reverse animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Avatar */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="w-4 h-4 text-primary-foreground" />
              </div>
              {/* Content */}
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

          {/* AI Thinking Indicator with Real-time Tool Progress and Streaming Text */}
          {(isSending || isProcessing) && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 max-w-[85%]">
                {/* Streaming text - show real-time response */}
                {streamingText && (
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 mb-2">
                    <MarkdownRenderer content={streamingText} />
                    <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse ml-0.5" />
                  </div>
                )}
                
                {/* Active tools indicator from broadcast */}
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
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {isRecovering ? 'Reconnecting to analysis...' : isProcessing ? 'Analyzing...' : 'Starting...'}
                      </span>
                    </div>
                    {/* Real-time tool execution progress */}
                    {toolCalls && toolCalls.length > 0 && (
                      <div className="space-y-1.5 border-t border-border/50 pt-2 mt-2">
                        {/* Consolidate tool calls by name - show only the latest status for each tool */}
                        {(() => {
                          const consolidated = new Map<string, JobToolCall>();
                          toolCalls.forEach((tc) => {
                            const existing = consolidated.get(tc.tool_name);
                            // Keep the completed/failed status over started, or the most recent one
                            if (!existing || tc.status !== 'started' || existing.status === 'started') {
                              // Merge data from both started and completed calls
                              const mergedData = { ...(existing?.data as object || {}), ...(tc.data as object || {}) };
                              consolidated.set(tc.tool_name, { ...tc, data: Object.keys(mergedData).length > 0 ? mergedData : undefined });
                            }
                          });
                          return Array.from(consolidated.values()).map((tc, idx) => (
                            <ExpandableToolCall key={`${tc.tool_name}-${idx}`} toolCall={tc} />
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Summary Result Card */}
          {summaryResult && (
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4 max-w-2xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-500" />
                  <div>
                    <h4 className="font-medium text-foreground text-sm">{summaryResult.title}</h4>
                    <p className="text-xs text-muted-foreground">Chat summary generated</p>
                  </div>
                </div>
                <button
                  onClick={() => setSummaryResult(null)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadSummaryMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Markdown
                </button>
                <button
                  onClick={handleDownloadSummaryPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded-lg transition-colors"
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
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - fixed at bottom of chat column */}
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
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20"
                    : "bg-purple-500/10 border-purple-500/30 text-purple-500 hover:bg-purple-500/20"
                )}
                title={selectedModel === 'flash' ? 'Flash: Faster responses' : 'Pro: More powerful analysis'}
              >
                <Zap className={cn("w-3.5 h-3.5", selectedModel === 'flash' ? "text-amber-500" : "text-purple-500")} />
                <span className="hidden sm:inline">{selectedModel === 'flash' ? 'Flash' : 'Pro'}</span>
              </button>
            </div>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the company..."
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
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
              className="p-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed rounded-xl transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              {(isSending || isProcessing) ? (
                <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-primary-foreground" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center hidden sm:block">
            Press Enter to send • Shift+Enter for new line • {selectedModel === 'flash' ? '⚡ Flash mode (faster)' : '🔮 Pro mode (powerful)'}
          </p>
        </div>
      </div>

      {/* 
        Right Sidebar - Fundamentals Panel
        - On mobile: fixed overlay
        - On desktop (xl+): sticky to viewport, stays in place while chat scrolls
      */}
      {showFundamentals && (
        <>
          {/* Mobile overlay */}
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 xl:hidden animate-in fade-in duration-200"
            onClick={() => setShowFundamentals(false)}
          />
          
          {/* Panel */}
          <aside className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-card border-l border-border",
            "animate-in slide-in-from-right duration-300 ease-out",
            "xl:relative xl:flex-none xl:w-96 xl:h-full xl:overflow-y-auto xl:z-auto xl:animate-none"
          )}>
            {/* Mobile close button */}
            <button
              onClick={() => setShowFundamentals(false)}
              className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground bg-muted rounded-lg xl:hidden z-10"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
            
            {/* CompanySidePanel has its own internal scrolling */}
            <CompanySidePanel
              assetId={chat.asset_id}
              assetType={chat.asset_type}
              className="h-full overflow-y-auto scrollbar-minimal"
            />
          </aside>
        </>
      )}
    </div>
  );
}

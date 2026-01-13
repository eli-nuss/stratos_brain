import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Brain, RefreshCw, ChevronRight, ChevronDown, Bot, User, Trash2, CheckCircle, XCircle, Search, Code, Database, Globe, FileText, Wrench, Download, FileDown, ExternalLink } from 'lucide-react';
import {
  useBrainMessages,
  useSendBrainMessage,
  clearBrainMessages,
  BrainMessage,
  BrainChat,
} from '@/hooks/useBrainChats';
import { useAuth } from '@/contexts/AuthContext';
import { ThinkingSection } from './ThinkingSection';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GenerativeUIRenderer } from './GenerativeUIRenderer';
import { cn } from '@/lib/utils';

interface BrainChatInterfaceProps {
  chat: BrainChat;
  onRefresh?: () => void;
}

// Expandable tool call component for real-time progress
function ExpandableToolCall({ toolCall }: { toolCall: { tool_name: string; status: 'started' | 'completed' | 'failed'; timestamp: string; data?: unknown } }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = toolCall.data && Object.keys(toolCall.data as object).length > 0;
  
  // Get icon based on tool name
  const getToolIcon = (name: string) => {
    if (name.includes('search') || name.includes('google') || name.includes('screen')) return <Search className="w-3 h-3" />;
    if (name.includes('python') || name.includes('code') || name.includes('execute')) return <Code className="w-3 h-3" />;
    if (name.includes('database') || name.includes('query') || name.includes('get_') || name.includes('fundamentals')) return <Database className="w-3 h-3" />;
    if (name.includes('web') || name.includes('browse') || name.includes('grounded')) return <Globe className="w-3 h-3" />;
    if (name.includes('document') || name.includes('export')) return <FileText className="w-3 h-3" />;
    return <Wrench className="w-3 h-3" />;
  };
  
  // Format tool name for display
  const formatToolName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  
  // Get status icon
  const getStatusDisplay = () => {
    switch (toolCall.status) {
      case 'started':
        return <Loader2 className="w-3 h-3 animate-spin text-purple-500" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />;
    }
  };
  
  return (
    <div className="border-l-2 border-purple-500/30 pl-2 py-1">
      <button
        onClick={() => hasData && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 w-full text-left",
          hasData && "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
        )}
        disabled={!hasData}
      >
        <span className="text-muted-foreground">{getToolIcon(toolCall.tool_name)}</span>
        <span className="text-xs text-foreground/80 flex-1 truncate">
          {formatToolName(toolCall.tool_name)}
        </span>
        {getStatusDisplay()}
        {hasData && (
          isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && hasData && (
        <div className="mt-1.5 ml-5 p-2 bg-muted/30 rounded text-xs">
          <pre className="whitespace-pre-wrap text-muted-foreground overflow-x-auto">
            {JSON.stringify(toolCall.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Individual message component
function MessageBubble({ message }: { message: BrainMessage }) {
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
          isUser ? 'bg-primary' : 'bg-gradient-to-br from-purple-500 to-pink-500'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Brain className="w-4 h-4 text-white" />
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
            const result = tool.result as { ui_component?: { componentType: string; title: string; data: unknown; insight?: string } };
            if (result.ui_component) {
              return (
                <div key={`ui-${idx}`} className="w-full max-w-2xl mb-3">
                  <GenerativeUIRenderer toolCall={result.ui_component as { componentType: string; title: string; data: unknown; insight?: string }} />
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
                  <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <FileText className="w-5 h-5 text-purple-500" />
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-500 hover:bg-purple-500/10 rounded-lg transition-colors"
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

export function BrainChatInterface({ chat, onRefresh }: BrainChatInterfaceProps) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { messages, isLoading: messagesLoading, refresh: refreshMessages } = useBrainMessages(chat.chat_id);
  const [input, setInput] = useState('');
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{ title: string; content: string; public_url?: string } | null>(null);
  // Optimistic user message - shown immediately while waiting for job to complete
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    sendMessage,
    reset: resetSendState,
    isSending,
    isProcessing,
    toolCalls,
    isComplete,
    error,
    isRecovering,
  } = useSendBrainMessage(chat.chat_id);

  // Scroll to bottom when new messages arrive, tool calls update, or optimistic message appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolCalls, pendingUserMessage]);

  // Refresh messages when job completes
  useEffect(() => {
    if (isComplete) {
      refreshMessages();
      onRefresh?.();
      resetSendState();
      // Clear optimistic message when job completes
      setPendingUserMessage(null);
    }
  }, [isComplete, refreshMessages, onRefresh, resetSendState]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [chat.chat_id]);

  const handleSend = async () => {
    if (!input.trim() || isSending || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    
    // Show optimistic user message immediately
    setPendingUserMessage(userMessage);

    await sendMessage(userMessage);
  };

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
      return;
    }
    
    setIsClearingChat(true);
    try {
      await clearBrainMessages(chat.chat_id, userId);
      await refreshMessages();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to clear chat:', err);
    } finally {
      setIsClearingChat(false);
    }
  };

  const handleSummarizeChat = async () => {
    if (messages.length === 0) return;
    
    setIsSummarizing(true);
    setSummaryResult(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/global-chat-api/chats/${chat.chat_id}/summarize`, {
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
    { text: "What's the current market regime?", icon: "📊" },
    { text: "Find me high-growth tech stocks", icon: "🔍" },
    { text: "Analyze the macro environment", icon: "🌍" },
    { text: "Build me a diversified portfolio", icon: "💼" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex-shrink-0">
            <Brain className="w-5 h-5 text-purple-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground text-sm truncate">{chat.title}</h3>
            <p className="text-[11px] text-muted-foreground">
              Powered by Gemini 3 Pro
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
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
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-6 space-y-6 scrollbar-minimal">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto">
            {/* Welcome Section */}
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4">
                <Brain className="w-10 h-10 text-purple-500" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Welcome to <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Stratos Brain</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Your autonomous Chief Investment Officer. I can screen markets, analyze macro conditions, and help build investment theses.
              </p>
            </div>

            {/* Suggested Questions */}
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 text-center">
                Try asking
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
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-purple-500" />
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

        {/* Optimistic User Message - shown immediately while waiting for job */}
        {pendingUserMessage && (isSending || isProcessing) && (
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

        {/* AI Thinking Indicator with Real-time Tool Progress */}
        {(isSending || isProcessing) && (
          <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 min-w-[200px]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {isRecovering ? 'Reconnecting...' : isProcessing ? 'Analyzing...' : 'Starting...'}
                </span>
              </div>
              {/* Real-time tool execution progress - expandable */}
              {toolCalls && toolCalls.length > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2 mt-2">
                  {/* Consolidate tool calls by name - show only the latest status for each tool */}
                  {(() => {
                    const consolidated = new Map<string, typeof toolCalls[0]>();
                    toolCalls.forEach((tc) => {
                      const existing = consolidated.get(tc.tool_name);
                      if (!existing || new Date(tc.timestamp) > new Date(existing.timestamp)) {
                        consolidated.set(tc.tool_name, tc);
                      }
                    });
                    return Array.from(consolidated.values()).map((tc, idx) => (
                      <ExpandableToolCall key={`${tc.tool_name}-${idx}`} toolCall={tc} />
                    ));
                  })()}
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

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border bg-card">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to screen stocks, analyze markets, or build a portfolio..."
              className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
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
            className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-muted disabled:to-muted disabled:cursor-not-allowed rounded-xl transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
          >
            {(isSending || isProcessing) ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center hidden sm:block">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

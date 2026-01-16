// GlobalChatInterface.tsx - Market-wide CIO chat agent
// Updated with UI improvements from CompanyChatInterface

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Bot, User, AlertCircle, ChevronRight, ChevronDown, Wrench, CheckCircle, XCircle, Search, Code, Database, Globe, FileText, Download, FileDown, ExternalLink } from 'lucide-react';
import { ThinkingSection } from './ThinkingSection';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GenerativeUIRenderer } from './GenerativeUIRenderer';
import { cn } from '@/lib/utils';
import { API_BASE, getJsonApiHeaders } from '@/lib/api-config';

interface SimpleMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
  timestamp?: string;
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

// Real-time tool call tracking for progress display
interface LiveToolCall {
  tool_name: string;
  status: 'started' | 'completed' | 'failed';
  timestamp: string;
  data?: unknown;
}

// Expandable tool call component for real-time progress
function ExpandableToolCall({ toolCall }: { toolCall: LiveToolCall }) {
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
  
  // Get status icon and color
  const getStatusDisplay = () => {
    switch (toolCall.status) {
      case 'started':
        return <Loader2 className="w-3 h-3 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />;
    }
  };
  
  return (
    <div className="border-l-2 border-primary/30 pl-2 py-1">
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

export function GlobalChatInterface() {
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [liveToolCalls, setLiveToolCalls] = useState<LiveToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Optimistic user message - shown immediately while waiting for API response
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, liveToolCalls, pendingUserMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const messageContent = input.trim();
    
    // Show optimistic user message immediately
    setPendingUserMessage(messageContent);
    setInput('');
    setIsSending(true);
    setError(null);
    setLiveToolCalls([]);

    const userMessage: SimpleMessage = { 
      role: 'user', 
      content: messageContent,
      timestamp: new Date().toISOString()
    };

    const currentHistory = [...messages, userMessage];

    try {
      const response = await fetch(`${API_BASE}/global-chat-api`, {
        method: 'POST',
        headers: getJsonApiHeaders(),
        body: JSON.stringify({ messages: currentHistory }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        throw new Error('No response from AI');
      }

      // Extract tool calls if any
      const toolCalls: ToolCall[] = [];
      if (data.toolCalls && Array.isArray(data.toolCalls)) {
        // Use the processed tool calls from the backend
        for (const tc of data.toolCalls) {
          toolCalls.push({
            name: tc.name,
            args: tc.args || {},
            result: tc.result
          });
        }
      } else if (candidate.content?.parts) {
        // Fallback to extracting from parts
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            toolCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            });
          }
        }
      }

      // Extract text content
      let textContent = '';
      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            textContent += part.text;
          }
        }
      }

      // Add user message to history (now confirmed)
      setMessages(prev => [...prev, userMessage]);
      setPendingUserMessage(null);

      const assistantMessage: SimpleMessage = {
        role: 'assistant',
        content: textContent || 'I processed your request.',
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      // Add user message even on error
      setMessages(prev => [...prev, userMessage]);
      setPendingUserMessage(null);
      
      const errorMessage: SimpleMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setLiveToolCalls([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    { text: "Find me growth stocks with strong momentum", icon: "📈" },
    { text: "What's the current market regime?", icon: "🌍" },
    { text: "Screen for undervalued tech stocks", icon: "🔍" },
    { text: "What are the top sector performers?", icon: "📊" },
  ];

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-6 p-4 pr-2 scrollbar-minimal">
        {messages.length === 0 && !pendingUserMessage && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              Welcome to Stratos CIO
            </h3>
            <p className="text-slate-400 max-w-md mb-6">
              I can help you screen for stocks, analyze market conditions, and build investment theses.
            </p>
            
            {/* Suggested Questions Grid */}
            <div className="w-full max-w-lg space-y-2">
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
        )}

        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}

        {/* Optimistic User Message - shown immediately while waiting for response */}
        {pendingUserMessage && isSending && !messages.some(m => m.role === 'user' && m.content === pendingUserMessage) && (
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
        {isSending && (
          <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 min-w-[200px]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-muted-foreground">Analyzing...</span>
              </div>
              {/* Real-time tool execution progress */}
              {liveToolCalls.length > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2 mt-2">
                  {/* Consolidate tool calls by name - show only the latest status for each tool */}
                  {(() => {
                    const consolidated = new Map<string, LiveToolCall>();
                    liveToolCalls.forEach((tc) => {
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

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/20 rounded-lg px-4 py-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-end gap-3">
          <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mb-3" />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to screen for stocks, analyze the macro environment, or build a portfolio..."
            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent max-h-32"
            rows={1}
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            className="p-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors flex-shrink-0 mb-0.5"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Individual message component with document export support
function MessageBubble({ message }: { message: SimpleMessage }) {
  const isUser = message.role === 'user';
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;

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
        {hasToolCalls && !isUser && (
          <ThinkingSection toolCalls={message.tool_calls} />
        )}

        {/* Generative UI Components - Rendered before text content */}
        {!isUser && message.tool_calls?.map((tool, idx) => {
          if (tool.name === 'generate_dynamic_ui' && tool.result) {
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
        {message.content && (
          <div
            className={cn(
              'inline-block rounded-2xl px-4 py-3 text-left max-w-full overflow-hidden',
              isUser
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
            )}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            ) : (
              <MarkdownRenderer content={message.content} className="text-sm" />
            )}
          </div>
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <div
            className={cn(
              'flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground',
              isUser ? 'justify-end' : 'justify-start'
            )}
          >
            <span>
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

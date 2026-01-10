import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, RefreshCw, ChevronRight, Bot, User, PanelRightClose, PanelRightOpen, Trash2, MessageSquare } from 'lucide-react';
import {
  useChatMessages,
  sendChatMessage,
  refreshChatContext,
  clearChatMessages,
  ChatMessage,
  CompanyChat,
} from '@/hooks/useCompanyChats';
import { useAuth } from '@/contexts/AuthContext';
import { CodeExecutionBlock } from './CodeExecutionBlock';
import { SearchCitationBlock } from './SearchCitationBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CompanySidePanel } from './CompanySidePanel';
import { cn } from '@/lib/utils';

interface CompanyChatInterfaceProps {
  chat: CompanyChat;
  onRefresh?: () => void;
}

// Individual message component
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const hasCodeExecution = message.executable_code || message.code_execution_result;
  const hasToolCalls = message.tool_calls && message.tool_calls.length > 0;
  const hasGrounding = message.grounding_metadata;

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

          {/* Tool Calls */}
          {hasToolCalls && !isUser && (
            <ToolCallBlock toolCalls={message.tool_calls!} />
          )}

          {/* Code Execution */}
          {hasCodeExecution && !isUser && (
            <CodeExecutionBlock
              code={message.executable_code || undefined}
              output={message.code_execution_result || undefined}
            />
          )}

          {/* Grounding/Search Citations */}
          {hasGrounding && !isUser && (
            <SearchCitationBlock metadata={message.grounding_metadata!} />
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
  const [isSending, setIsSending] = useState(false);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFundamentals, setShowFundamentals] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Show fundamentals panel by default on larger screens
  useEffect(() => {
    const checkScreenSize = () => {
      setShowFundamentals(window.innerWidth >= 1280);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [chat.chat_id]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setIsSending(true);

    try {
      await sendChatMessage(chat.chat_id, userMessage, userId);
      await refreshMessages();
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
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
    <div className="flex h-full bg-background overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
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

          {/* AI Thinking Indicator */}
          {isSending && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
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
              disabled={!input.trim() || isSending}
              className="p-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed rounded-xl transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              <Send className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center hidden sm:block">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Fundamentals Panel */}
      {showFundamentals && (
        <>
          {/* Mobile overlay */}
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 xl:hidden animate-in fade-in duration-200"
            onClick={() => setShowFundamentals(false)}
          />
          
          {/* Panel - fixed height, doesn't scroll with chat */}
          <div className={cn(
            "fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-card border-l border-border",
            "animate-in slide-in-from-right duration-300 ease-out",
            "xl:relative xl:w-96 xl:max-w-none xl:flex-shrink-0 xl:z-auto xl:animate-none xl:h-full"
          )}>
            {/* Mobile close button */}
            <button
              onClick={() => setShowFundamentals(false)}
              className="absolute top-3 right-3 p-2 text-muted-foreground hover:text-foreground bg-muted rounded-lg xl:hidden z-10"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
            
            <CompanySidePanel
              assetId={chat.asset_id}
              assetType={chat.asset_type}
              className="h-full overflow-y-auto scrollbar-minimal"
            />
          </div>
        </>
      )}
    </div>
  );
}

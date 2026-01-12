import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Brain, RefreshCw, ChevronRight, Bot, User, Trash2, CheckCircle, XCircle } from 'lucide-react';
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

  // Scroll to bottom when new messages arrive or tool calls update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolCalls]);

  // Refresh messages when job completes
  useEffect(() => {
    if (isComplete) {
      refreshMessages();
      onRefresh?.();
      resetSendState();
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
              {/* Real-time tool execution progress */}
              {toolCalls && toolCalls.length > 0 && (
                <div className="space-y-1.5 border-t border-border/50 pt-2 mt-2">
                  {toolCalls.map((tc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {tc.status === 'started' && (
                        <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                      )}
                      {tc.status === 'completed' && (
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      )}
                      {tc.status === 'failed' && (
                        <XCircle className="w-3 h-3 text-destructive" />
                      )}
                      <span className="text-muted-foreground">
                        {tc.tool_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  ))}
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

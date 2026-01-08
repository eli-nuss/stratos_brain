import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, RefreshCw, ChevronRight, Bot, User, PanelRightClose, PanelRightOpen } from 'lucide-react';
import {
  useChatMessages,
  sendChatMessage,
  refreshChatContext,
  ChatMessage,
  CompanyChat,
} from '@/hooks/useCompanyChats';
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
          isUser ? 'bg-emerald-600' : 'bg-zinc-700'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-emerald-400" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[85%] min-w-0 overflow-hidden', isUser ? 'text-right' : 'text-left')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-3 text-left max-w-full overflow-hidden',
            isUser
              ? 'bg-emerald-600 text-white rounded-br-md'
              : 'bg-zinc-800/80 text-zinc-100 rounded-bl-md border border-zinc-700/30'
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
            'flex items-center gap-2 mt-1 text-[10px] text-zinc-500',
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
            <span className="text-zinc-600">• {(message.latency_ms / 1000).toFixed(1)}s</span>
          )}
          {message.model && !isUser && (
            <span className="text-zinc-600">• {message.model.split('/').pop()}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CompanyChatInterface({ chat, onRefresh }: CompanyChatInterfaceProps) {
  const { messages, isLoading: messagesLoading, refresh: refreshMessages } = useChatMessages(chat.chat_id);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFundamentals, setShowFundamentals] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      await sendChatMessage(chat.chat_id, userMessage);
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
      await refreshChatContext(chat.chat_id);
    } catch (err) {
      console.error('Failed to refresh context:', err);
    } finally {
      setIsRefreshingContext(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What are the key financial metrics for this company?",
    "Analyze the recent price action and identify support/resistance levels",
    "What are the main risks and opportunities?",
    "Compare this company to its sector peers",
    "What do the technical indicators suggest?",
  ];

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{chat.display_name}</h3>
              <p className="text-xs text-zinc-500">
                Powered by Gemini 3 Pro • Code Execution • Search • Database Access
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshContext}
              disabled={isRefreshingContext}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50"
              title="Refresh company data context"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshingContext && 'animate-spin')} />
              Refresh Context
            </button>
            <button
              onClick={() => setShowFundamentals(!showFundamentals)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
              title={showFundamentals ? 'Hide fundamentals panel' : 'Show fundamentals panel'}
            >
              {showFundamentals ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-6">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="inline-flex p-4 bg-zinc-800/50 rounded-full mb-4">
                  <Bot className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-zinc-400">
                  Start researching <span className="text-emerald-400 font-medium">{chat.display_name}</span>
                </p>
                <p className="text-zinc-600 text-sm mt-1">
                  I can analyze data, search the web, and run calculations
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium px-1">
                  Suggested questions
                </p>
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(question);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center gap-3 w-full text-left text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/70 p-3 rounded-lg transition-all group border border-transparent hover:border-zinc-700/50"
                  >
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                    <span>{question}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.message_id} message={msg} />
            ))
          )}

          {/* Sending indicator */}
          {isSending && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="bg-zinc-800/80 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-3 border border-zinc-700/30">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-zinc-400">Analyzing...</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/80">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the company..."
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
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
              className="p-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 text-center">
            Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Fundamentals Panel */}
      {showFundamentals && (
        <div className="w-96 flex-shrink-0 border-l border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <CompanySidePanel
            assetId={chat.asset_id}
            assetType={chat.asset_type}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}

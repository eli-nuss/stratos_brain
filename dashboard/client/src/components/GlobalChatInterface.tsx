// GlobalChatInterface.tsx - Market-wide CIO chat agent
// Parallel architecture - does not touch CompanyChatInterface

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Bot, User, AlertCircle } from 'lucide-react';
import { ThinkingSection } from './ThinkingSection';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GenerativeUIRenderer } from './GenerativeUIRenderer';
import { cn } from '@/lib/utils';

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

export function GlobalChatInterface() {
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending, currentToolCalls]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage: SimpleMessage = { 
      role: 'user', 
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);
    setError(null);
    setCurrentToolCalls([]);

    const currentHistory = [...messages, userMessage];

    try {
      const response = await fetch('/api/global-chat-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (candidate.content?.parts) {
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
      
      const errorMessage: SimpleMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setCurrentToolCalls([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-6 p-4 pr-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              Welcome to Stratos CIO
            </h3>
            <p className="text-slate-400 max-w-md mb-6">
              I can help you screen for stocks, analyze market conditions, and build investment theses. Try asking:
            </p>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="bg-slate-800/50 rounded-lg px-4 py-2 text-left">
                "Find me technology stocks with over 20% revenue growth"
              </div>
              <div className="bg-slate-800/50 rounded-lg px-4 py-2 text-left">
                "What's the current market regime?"
              </div>
              <div className="bg-slate-800/50 rounded-lg px-4 py-2 text-left">
                "Build me a diversified growth portfolio"
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}

        {isSending && (
          <div className="flex gap-3 flex-row">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 max-w-[85%]">
              {currentToolCalls.length > 0 && (
                <ThinkingSection toolCalls={currentToolCalls} />
              )}
              <div className="inline-block rounded-2xl px-4 py-3 bg-muted text-foreground rounded-bl-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
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

// Individual message component
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

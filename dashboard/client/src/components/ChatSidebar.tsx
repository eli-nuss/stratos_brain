import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, MessageCircle, X, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { API_BASE, getJsonApiHeaders } from '@/lib/api-config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSidebarProps {
  assetId: number;
  assetSymbol: string;
  asOfDate: string;
  isOpen: boolean;
  onClose: () => void;
}

// Simple markdown renderer for chat messages
function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  const rendered = useMemo(() => {
    let html = content
      // Escape HTML first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/__(.+?)__/g, '<strong class="font-semibold text-white">$1</strong>')
      // Italic: *text* or _text_
      .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
      .replace(/_([^_]+)_/g, '<em class="italic">$1</em>')
      // Code inline: `code`
      .replace(/`([^`]+)`/g, '<code class="bg-zinc-700/50 px-1.5 py-0.5 rounded text-emerald-300 text-xs font-mono">$1</code>')
      // Headers: ### Header
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-3 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white mt-3 mb-1">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-3 mb-2">$1</h1>')
      // Bullet lists: - item or * item
      .replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc list-outside text-zinc-200">$1</li>')
      // Numbered lists: 1. item
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal list-outside text-zinc-200">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mt-2">')
      .replace(/\n/g, '<br/>');
    
    // Wrap consecutive list items
    html = html.replace(/(<li[^>]*>.*?<\/li>)(\s*<br\/>)*(<li)/g, '$1$3');
    html = html.replace(/(<li class="ml-4 list-disc[^>]*>)/g, '<ul class="my-2">$1');
    html = html.replace(/(<li class="ml-4 list-decimal[^>]*>)/g, '<ol class="my-2">$1');
    html = html.replace(/(<\/li>)(?![\s\S]*<li)/g, '$1</ul>');
    
    return `<p>${html}</p>`;
  }, [content]);

  return (
    <div 
      className={`prose prose-sm prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

export function ChatSidebar({ assetId, assetSymbol, asOfDate, isOpen, onClose }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset chat when asset changes
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [assetId]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch(`${API_BASE}/dashboard/chat`, {
        method: 'POST',
        headers: getJsonApiHeaders(),
        body: JSON.stringify({
          asset_id: assetId,
          as_of_date: asOfDate,
          message: userMessage,
          conversation_history: conversationHistory
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      
      // Add assistant response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "What are the key support and resistance levels?",
    "Is this a good entry point?",
    "What's the risk/reward ratio?",
    "Explain the signals in detail",
    "What would invalidate this setup?"
  ];

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Chat panel - slides in from right - responsive width */}
      <div 
        className={`fixed right-0 top-0 h-full w-full sm:w-[560px] sm:max-w-[95vw] bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border-l border-zinc-700/50 flex flex-col z-50 shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-700/50 bg-zinc-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Analysis Chat</h3>
              <p className="text-xs text-zinc-500">Powered by Gemini</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 sm:p-2 hover:bg-zinc-800 rounded-lg transition-colors group min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close chat"
          >
            <X className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Context indicator */}
        <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-emerald-500/5 to-transparent border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold text-lg">{assetSymbol}</span>
            <span className="text-zinc-500 text-sm">•</span>
            <span className="text-zinc-400 text-sm font-mono">{asOfDate}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">365d OHLCV</span>
            <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">Technicals</span>
            <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">Signals</span>
            <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">AI Review</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="inline-flex p-4 bg-zinc-800/50 rounded-full mb-4">
                  <MessageCircle className="w-8 h-8 text-zinc-500" />
                </div>
                <p className="text-zinc-400">
                  Ask me anything about <span className="text-emerald-400 font-medium">{assetSymbol}</span>'s analysis
                </p>
                <p className="text-zinc-600 text-sm mt-1">
                  I have access to the full chart data and technical analysis
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium px-1">Quick questions</p>
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(question);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center gap-3 w-full text-left text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/70 p-3 sm:p-3 min-h-[48px] rounded-lg transition-all group border border-transparent hover:border-zinc-700/50 active:bg-zinc-800"
                  >
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                    <span className="leading-snug">{question}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-zinc-800/80 text-zinc-100 rounded-bl-md border border-zinc-700/30'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownContent content={msg.content} className="text-sm leading-relaxed" />
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
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
          
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 sm:p-5 border-t border-zinc-800/50 bg-zinc-900/80 backdrop-blur-sm safe-area-inset-bottom">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the analysis..."
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                rows={1}
                disabled={isLoading}
                style={{ minHeight: '48px', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="p-3.5 sm:p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-xl transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100 min-w-[48px] min-h-[48px] flex items-center justify-center"
              aria-label="Send message"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 text-center">
            Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}

// useStreamingChat.ts - Hook for real-time streaming chat responses
// Uses Server-Sent Events (SSE) for instant token-by-token updates

import { useState, useCallback, useRef } from 'react';
import { getStoredUserId, getStoredAccessToken } from '@/lib/auth-storage';

// SSE Event types from the streaming API
export type SSEEventType = 'connected' | 'thinking' | 'tool_start' | 'tool_complete' | 'token' | 'done' | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
}

export interface StreamingState {
  isStreaming: boolean;
  isConnected: boolean;
  currentText: string;
  toolsInProgress: string[];
  completedTools: Array<{ name: string; success: boolean }>;
  error: string | null;
  thinkingMessage: string | null;
}

export interface UseStreamingChatOptions {
  onToken?: (text: string) => void;
  onToolStart?: (toolName: string) => void;
  onToolComplete?: (toolName: string, success: boolean) => void;
  onComplete?: (fullText: string, toolCalls: unknown[]) => void;
  onError?: (error: string) => void;
}

export function useStreamingChat(chatId: string | null, options: UseStreamingChatOptions = {}) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    isConnected: false,
    currentText: '',
    toolsInProgress: [],
    completedTools: [],
    error: null,
    thinkingMessage: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Send a message and start streaming the response
  const sendMessage = useCallback(async (content: string) => {
    if (!chatId || !content.trim()) return;
    
    // Reset state
    setState({
      isStreaming: true,
      isConnected: false,
      currentText: '',
      toolsInProgress: [],
      completedTools: [],
      error: null,
      thinkingMessage: 'Connecting...',
    });
    
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const userId = getStoredUserId();
      const accessToken = getStoredAccessToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (userId) headers['x-user-id'] = userId;
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      
      const response = await fetch(`/api/company-chat-stream/stream/${chatId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get response stream');
      
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            
            try {
              const event: SSEEvent = JSON.parse(jsonStr);
              
              switch (event.type) {
                case 'connected':
                  setState(prev => ({ ...prev, isConnected: true, thinkingMessage: null }));
                  break;
                  
                case 'thinking':
                  setState(prev => ({ 
                    ...prev, 
                    thinkingMessage: (event.data as { message: string }).message 
                  }));
                  break;
                  
                case 'tool_start': {
                  const toolName = (event.data as { tool: string }).tool;
                  setState(prev => ({
                    ...prev,
                    toolsInProgress: [...prev.toolsInProgress, toolName],
                    thinkingMessage: `Running ${toolName}...`,
                  }));
                  options.onToolStart?.(toolName);
                  break;
                }
                  
                case 'tool_complete': {
                  const { tool, success } = event.data as { tool: string; success: boolean };
                  setState(prev => ({
                    ...prev,
                    toolsInProgress: prev.toolsInProgress.filter(t => t !== tool),
                    completedTools: [...prev.completedTools, { name: tool, success }],
                    thinkingMessage: prev.toolsInProgress.length > 1 
                      ? `Running ${prev.toolsInProgress.filter(t => t !== tool).join(', ')}...`
                      : null,
                  }));
                  options.onToolComplete?.(tool, success);
                  break;
                }
                  
                case 'token': {
                  const text = (event.data as { text: string }).text;
                  accumulatedText += text;
                  setState(prev => ({ 
                    ...prev, 
                    currentText: accumulatedText,
                    thinkingMessage: null,
                  }));
                  options.onToken?.(text);
                  break;
                }
                  
                case 'done': {
                  const { fullText, toolCalls } = event.data as { fullText: string; toolCalls: unknown[] };
                  setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    currentText: fullText,
                    thinkingMessage: null,
                  }));
                  options.onComplete?.(fullText, toolCalls);
                  break;
                }
                  
                case 'error': {
                  const errorMsg = (event.data as { message: string }).message;
                  setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    error: errorMsg,
                    thinkingMessage: null,
                  }));
                  options.onError?.(errorMsg);
                  break;
                }
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Stream was intentionally aborted
        setState(prev => ({ ...prev, isStreaming: false }));
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: errorMsg,
          thinkingMessage: null,
        }));
        options.onError?.(errorMsg);
      }
    }
  }, [chatId, options]);

  // Cancel the current stream
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    cancelStream();
    setState({
      isStreaming: false,
      isConnected: false,
      currentText: '',
      toolsInProgress: [],
      completedTools: [],
      error: null,
      thinkingMessage: null,
    });
  }, [cancelStream]);

  return {
    ...state,
    sendMessage,
    cancelStream,
    reset,
  };
}

export default useStreamingChat;

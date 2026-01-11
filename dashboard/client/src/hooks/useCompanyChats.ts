import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Types
export interface CompanyChat {
  id: string;
  asset_id: string;
  asset_type: 'equity' | 'crypto';
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  ui_components?: unknown[];
  created_at: string;
}

export interface ChatJob {
  id: string;
  chat_id: string;
  user_message_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  tool_calls: ToolCall[];
  result?: {
    content: string;
    ui_components?: unknown[];
  };
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface ToolCall {
  tool_name: string;
  status: 'started' | 'completed' | 'failed';
  timestamp: string;
  error?: string;
}

// Helper to get user ID from localStorage
function getUserId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('stratos_user_id');
  }
  return null;
}

// Helper to get access token from localStorage
function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('stratos_access_token');
  }
  return null;
}

// Hook to fetch and subscribe to a specific chat's messages
export function useCompanyChat(chatId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch messages for this chat
  const fetchMessages = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setMessages(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!chatId) return;

    // Initial fetch
    fetchMessages();

    // Set up realtime subscription
    const channel = supabase
      .channel(`chat-messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatId, fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    refetch: fetchMessages,
  };
}

// Hook to fetch user's chats
export function useUserChats() {
  const [chats, setChats] = useState<CompanyChat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setChats([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('company_chats')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;
      setChats(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return {
    chats,
    isLoading,
    error,
    refetch: fetchChats,
  };
}

// Hook to subscribe to a chat job's status and tool calls
export function useChatJob(jobId: string | null) {
  const [job, setJob] = useState<ChatJob | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch initial job state
  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      setIsComplete(false);
      setIsProcessing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chat_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      
      setJob(data);
      setIsComplete(data.status === 'completed' || data.status === 'failed');
      setIsProcessing(data.status === 'pending' || data.status === 'processing');
    } catch (err) {
      console.error('Error fetching job:', err);
    }
  }, [jobId]);

  // Subscribe to job updates
  useEffect(() => {
    if (!jobId) return;

    // Initial fetch
    fetchJob();

    // Set up realtime subscription
    const channel = supabase
      .channel(`chat-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updatedJob = payload.new as ChatJob;
          setJob(updatedJob);
          setIsComplete(updatedJob.status === 'completed' || updatedJob.status === 'failed');
          setIsProcessing(updatedJob.status === 'pending' || updatedJob.status === 'processing');
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [jobId, fetchJob]);

  return {
    job,
    isComplete,
    isProcessing,
    toolCalls: job?.tool_calls || [],
    result: job?.result,
    error: job?.error,
  };
}

// Hook to manage sending messages with job-based processing
// Handles timeout gracefully by polling for job completion
export function useSendMessage(chatId: string | null) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const requestStartTimeRef = useRef<number | null>(null);

  const { job, isComplete, isProcessing, toolCalls, result, error: jobError } = useChatJob(currentJobId);

  // Reset when job completes
  useEffect(() => {
    if (isComplete) {
      setIsSending(false);
      setIsRecovering(false);
      if (jobError) {
        setError(jobError);
      } else {
        // Clear any timeout error since job completed successfully
        setError(null);
      }
    }
  }, [isComplete, jobError]);

  // Poll for latest job when recovering from timeout
  // Only looks for jobs created within the last 2 minutes
  const pollForLatestJob = useCallback(async (): Promise<string | null> => {
    if (!chatId) return null;
    
    try {
      // Calculate time threshold (2 minutes ago)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      console.log('[Timeout Recovery] Polling for recent jobs in chat:', chatId);
      console.log('[Timeout Recovery] Looking for jobs created after:', twoMinutesAgo);
      
      // Query the chat_jobs table for the most recent job for this chat
      // that was created in the last 2 minutes
      const { data, error: queryError } = await supabase
        .from('chat_jobs')
        .select('*')
        .eq('chat_id', chatId)
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (queryError) {
        console.log('[Timeout Recovery] Query error:', queryError.message);
        return null;
      }
      
      if (data) {
        console.log('[Timeout Recovery] Found job:', data.id, 'status:', data.status);
        return data.id;
      }
      
      console.log('[Timeout Recovery] No recent jobs found');
      return null;
    } catch (err) {
      console.error('[Timeout Recovery] Error polling for job:', err);
      return null;
    }
  }, [chatId]);

  const sendMessage = useCallback(async (content: string): Promise<string | null> => {
    if (!chatId) {
      setError('No chat selected');
      return null;
    }

    setIsSending(true);
    setError(null);
    setCurrentJobId(null);
    setIsRecovering(false);
    requestStartTimeRef.current = Date.now();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    const userId = getUserId();
    if (userId) {
      headers['x-user-id'] = userId;
    }
    
    const accessToken = getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute client timeout

    try {
      console.log('[SendMessage] Sending message to chat:', chatId);
      
      const response = await fetch(`/api/company-chat-api/chats/${chatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      console.log('[SendMessage] Response status:', response.status);
      
      // Try to parse response as JSON
      let data;
      try {
        data = await response.json();
        console.log('[SendMessage] Response data:', data);
      } catch (parseError) {
        console.error('[SendMessage] Failed to parse response as JSON:', parseError);
        throw new Error('Server returned invalid response');
      }

      if (response.status === 202) {
        // Job-based response - got job_id, now track it
        console.log('[SendMessage] Got job_id:', data.job_id);
        setCurrentJobId(data.job_id);
        return data.job_id;
      } else if (response.ok) {
        // Legacy synchronous response
        console.log('[SendMessage] Legacy synchronous response');
        setIsSending(false);
        return null;
      } else {
        // Server returned an error - this might be a timeout
        console.log('[SendMessage] Server error:', data.error);
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorName = err instanceof Error ? err.name : '';
      
      console.log('[SendMessage] Caught error:', errorName, errorMessage);
      
      // Check if this looks like a timeout or server error that might have a background job
      // We're being very permissive here - any error during a long-running request should trigger recovery
      const requestDuration = requestStartTimeRef.current ? Date.now() - requestStartTimeRef.current : 0;
      const isLongRunningRequest = requestDuration > 10000; // More than 10 seconds
      
      const isTimeoutLike = 
        errorName === 'AbortError' || 
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('took too long') ||
        errorMessage.toLowerCase().includes('analysis took') ||
        errorMessage.toLowerCase().includes('aborted') ||
        errorMessage.toLowerCase().includes('failed to fetch') ||
        errorMessage.toLowerCase().includes('gateway') ||
        errorMessage.toLowerCase().includes('504') ||
        errorMessage.toLowerCase().includes('502');
      
      console.log('[SendMessage] Request duration:', requestDuration, 'ms');
      console.log('[SendMessage] Is timeout-like error:', isTimeoutLike);
      console.log('[SendMessage] Is long-running request:', isLongRunningRequest);
      
      // Try to recover if it's a timeout-like error OR if the request was long-running
      if (isTimeoutLike || isLongRunningRequest) {
        console.log('[SendMessage] Attempting timeout recovery...');
        setIsRecovering(true);
        setError(null); // Clear error during recovery
        
        // Poll for the job multiple times with increasing delays
        for (let attempt = 1; attempt <= 5; attempt++) {
          console.log(`[Timeout Recovery] Attempt ${attempt}/5...`);
          
          // Wait before polling (increasing delay)
          const delay = attempt * 2000; // 2s, 4s, 6s, 8s, 10s
          await new Promise(resolve => setTimeout(resolve, delay));
          
          const jobId = await pollForLatestJob();
          
          if (jobId) {
            console.log('[Timeout Recovery] SUCCESS! Found job:', jobId);
            setCurrentJobId(jobId);
            // Keep isSending true - the job subscription will handle completion
            return jobId;
          }
        }
        
        // All attempts failed - show error
        console.log('[Timeout Recovery] FAILED - no job found after 5 attempts');
        setError('Request timed out and could not recover. Please try again.');
        setIsSending(false);
        setIsRecovering(false);
        return null;
      } else {
        // Not a timeout - show the error immediately
        console.log('[SendMessage] Not a timeout error, showing error immediately');
        setError(errorMessage);
        setIsSending(false);
        return null;
      }
    }
  }, [chatId, pollForLatestJob]);

  const reset = useCallback(() => {
    setCurrentJobId(null);
    setIsSending(false);
    setError(null);
    setIsRecovering(false);
    requestStartTimeRef.current = null;
  }, []);

  return {
    sendMessage,
    reset,
    isSending,
    isProcessing: isProcessing || isRecovering,
    currentJobId,
    job,
    toolCalls,
    result,
    isComplete,
    error,
    isRecovering,
  };
}

// Function to create or get a chat for an asset (user-specific)
export async function createOrGetChat(
  assetId: number | string,
  assetType?: 'equity' | 'crypto',
  displayName?: string,
  userId?: string | null
): Promise<CompanyChat> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Get userId from parameter or from localStorage
  const effectiveUserId = userId || getUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  // Add authorization header
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch('/api/company-chat-api/chats', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      asset_id: String(assetId),
      asset_type: assetType,
      display_name: displayName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create chat');
  }

  return response.json();
}

// Function to delete a chat
export async function deleteChat(chatId: string): Promise<void> {
  const headers: HeadersInit = {};
  
  const userId = getUserId();
  if (userId) {
    headers['x-user-id'] = userId;
  }
  
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`/api/company-chat-api/chats/${chatId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete chat');
  }
}

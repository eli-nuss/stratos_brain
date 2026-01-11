import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';

// Helper to get user ID for API calls
export function getUserId(): string | null {
  // This is a simple approach - we'll also create a hook version
  // For now, we read from localStorage where Supabase stores session
  try {
    const storageKey = Object.keys(localStorage).find(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );
    if (storageKey) {
      const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return data?.user?.id || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Helper to get access token for API calls
export function getAccessToken(): string | null {
  try {
    const storageKey = Object.keys(localStorage).find(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );
    if (storageKey) {
      const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return data?.access_token || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Create a fetcher that includes user_id header and authorization
const createFetcher = (userId: string | null, accessToken: string | null) => async (url: string) => {
  const headers: HeadersInit = {};
  if (userId) {
    headers['x-user-id'] = userId;
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const res = await fetch(url, { headers });
  return res.json();
};

export interface CompanyChat {
  chat_id: string;
  asset_id: string;
  asset_type: 'equity' | 'crypto';
  display_name: string;
  status: 'active' | 'archived';
  last_message_at: string | null;
  created_at: string;
  message_count: number;
  user_id?: string | null;
}

export interface ChatMessage {
  message_id: string;
  chat_id: string;
  sequence_num: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_calls: ToolCall[] | null;
  executable_code: string | null;
  code_execution_result: string | null;
  grounding_metadata: GroundingMetadata | null;
  attachments: Attachment[] | null;
  model: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface GroundingMetadata {
  searchEntryPoint?: {
    renderedContent: string;
  };
  groundingChunks?: Array<{
    web?: {
      uri: string;
      title: string;
    };
  }>;
  webSearchQueries?: string[];
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  mime_type: string;
  name?: string;
}

// Job status interface for background processing
export interface ChatJob {
  id: string;
  chat_id: string;
  user_message: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result: SendMessageResponse | null;
  tool_calls: Array<{
    tool_name: string;
    status: 'started' | 'completed' | 'failed';
    timestamp: string;
    data?: unknown;
  }> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SendMessageResponse {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  tool_calls: ToolCall[];
  code_executions: Array<{
    code?: string;
    language?: string;
    output?: string;
    outcome?: string;
  }>;
  grounding_metadata: GroundingMetadata | null;
}

// New interface for job-based response
export interface JobCreatedResponse {
  job_id: string;
  status: 'pending';
  message: string;
  chat_id: string;
}

// Hook to list all company chats for the current user
export function useCompanyChats() {
  const { user, session } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  const { data, error, isLoading, mutate } = useSWR<{ chats: CompanyChat[] }>(
    '/api/company-chat-api/chats',
    createFetcher(userId, accessToken),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  return {
    chats: data?.chats || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

// Hook to get a single chat's details
export function useCompanyChat(chatId: string | null) {
  const { user, session } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  const { data, error, isLoading, mutate } = useSWR<CompanyChat>(
    chatId ? `/api/company-chat-api/chats/${chatId}` : null,
    createFetcher(userId, accessToken)
  );

  return {
    chat: data,
    isLoading,
    error,
    refresh: mutate,
  };
}

// Hook to get messages for a chat
export function useChatMessages(chatId: string | null, limit = 50) {
  const { user, session } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  const { data, error, isLoading, mutate } = useSWR<{
    messages: ChatMessage[];
    total: number;
    has_more: boolean;
  }>(
    chatId ? `/api/company-chat-api/chats/${chatId}/messages?limit=${limit}` : null,
    createFetcher(userId, accessToken),
    {
      refreshInterval: 0, // Don't auto-refresh, we'll manually update
    }
  );

  return {
    messages: data?.messages || [],
    total: data?.total || 0,
    hasMore: data?.has_more || false,
    isLoading,
    error,
    refresh: mutate,
  };
}

// Hook to subscribe to job updates via Supabase Realtime
export function useChatJob(jobId: string | null) {
  const [job, setJob] = useState<ChatJob | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setIsComplete(false);
      return;
    }

    // Initial fetch
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from('chat_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (!error && data) {
        setJob(data as ChatJob);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsComplete(true);
        }
      }
    };

    fetchJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`job-${jobId}`)
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
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            setIsComplete(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return {
    job,
    isComplete,
    isProcessing: job?.status === 'processing',
    isPending: job?.status === 'pending',
    isFailed: job?.status === 'failed',
    toolCalls: job?.tool_calls || [],
    result: job?.result,
    error: job?.error_message,
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
    throw new Error(error.error || 'Failed to create chat');
  }

  return response.json();
}

// Legacy function to send a message and get AI response (synchronous - kept for backward compatibility)
export async function sendChatMessage(
  chatId: string,
  content: string,
  userId?: string | null
): Promise<SendMessageResponse | JobCreatedResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  const effectiveUserId = userId || getUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  // Add authorization header
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`/api/company-chat-api/chats/${chatId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });

  if (!response.ok && response.status !== 202) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
}

// Function to poll job status (alternative to realtime for environments where it's not available)
export async function pollJobStatus(jobId: string): Promise<ChatJob> {
  const headers: HeadersInit = {};
  
  const userId = getUserId();
  if (userId) {
    headers['x-user-id'] = userId;
  }
  
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`/api/company-chat-api/jobs/${jobId}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get job status');
  }

  return response.json();
}

// Function to archive a chat
export async function archiveChat(chatId: string, userId?: string | null): Promise<void> {
  const headers: HeadersInit = {};
  
  const effectiveUserId = userId || getUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  // Add authorization header
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
    throw new Error(error.error || 'Failed to archive chat');
  }
}

// Function to refresh context snapshot
export async function refreshChatContext(chatId: string, userId?: string | null): Promise<void> {
  const headers: HeadersInit = {};
  
  const effectiveUserId = userId || getUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  // Add authorization header
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`/api/company-chat-api/chats/${chatId}/context`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to refresh context');
  }
}

// Function to clear all messages from a chat
export async function clearChatMessages(chatId: string, userId?: string | null): Promise<void> {
  const headers: HeadersInit = {};
  
  const effectiveUserId = userId || getUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  // Add authorization header
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`/api/company-chat-api/chats/${chatId}/messages`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clear chat');
  }
}

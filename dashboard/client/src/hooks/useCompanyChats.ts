import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback } from 'react';

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
export function useSendMessage(chatId: string | null) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { job, isComplete, isProcessing, toolCalls, result, error: jobError } = useChatJob(currentJobId);

  // Reset when job completes
  useEffect(() => {
    if (isComplete) {
      setIsSending(false);
      if (jobError) {
        setError(jobError);
      }
    }
  }, [isComplete, jobError]);

  const sendMessage = useCallback(async (content: string): Promise<string | null> => {
    if (!chatId) {
      setError('No chat selected');
      return null;
    }

    setIsSending(true);
    setError(null);
    setCurrentJobId(null);

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

    try {
      const response = await fetch(`/api/company-chat-api/chats/${chatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
      });

      const data = await response.json();

      if (response.status === 202) {
        // Job-based response
        setCurrentJobId(data.job_id);
        return data.job_id;
      } else if (response.ok) {
        // Legacy synchronous response (shouldn't happen with new API)
        setIsSending(false);
        return null;
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsSending(false);
      return null;
    }
  }, [chatId]);

  const reset = useCallback(() => {
    setCurrentJobId(null);
    setIsSending(false);
    setError(null);
  }, []);

  return {
    sendMessage,
    reset,
    isSending,
    isProcessing,
    currentJobId,
    job,
    toolCalls,
    result,
    isComplete,
    error,
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

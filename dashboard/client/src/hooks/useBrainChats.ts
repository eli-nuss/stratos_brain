import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';

// Helper to get user ID for API calls
export function getUserId(): string | null {
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

export interface BrainChat {
  chat_id: string;
  title: string;
  status: 'active' | 'archived';
  last_message_at: string | null;
  created_at: string;
  user_id?: string | null;
}

export interface BrainMessage {
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
export interface BrainJob {
  id: string;
  chat_id: string;
  user_message: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result: { message_id?: string } | null;
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

// Hook to list all brain chats for the current user
// Requires authentication - returns empty array if not logged in
export function useBrainChats() {
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  // Also check localStorage for auth token as a fallback
  // This helps when the auth context hasn't fully propagated yet
  const hasLocalStorageAuth = typeof window !== 'undefined' && 
    Object.keys(localStorage).some(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );
  
  // Use either context user OR localStorage auth as indicator
  const isAuthenticated = userId !== null || (hasLocalStorageAuth && !authLoading);
  const shouldFetch = !authLoading && isAuthenticated;
  
  // If we have localStorage auth but no userId yet, try to get it from localStorage
  const effectiveUserId = userId || getUserId();
  const effectiveAccessToken = accessToken || getAccessToken();
  
  const { data, error, isLoading, mutate } = useSWR<{ chats: BrainChat[] }>(
    shouldFetch ? '/api/global-chat-api/chats' : null,
    createFetcher(effectiveUserId, effectiveAccessToken),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  return {
    chats: data?.chats || [],
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate,
    // Indicate if user needs to log in to use chat
    // Only show requiresAuth if we're sure there's no auth (context AND localStorage)
    requiresAuth: !authLoading && !userId && !hasLocalStorageAuth,
  };
}

// Hook to get messages for a chat
export function useBrainMessages(chatId: string | null, limit = 50) {
  const { user, session } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  const { data, error, isLoading, mutate } = useSWR<{
    messages: BrainMessage[];
    total: number;
  }>(
    chatId ? `/api/global-chat-api/chats/${chatId}/messages?limit=${limit}` : null,
    createFetcher(userId, accessToken),
    {
      refreshInterval: 0, // Don't auto-refresh, we'll manually update
    }
  );

  return {
    messages: data?.messages || [],
    total: data?.total || 0,
    isLoading,
    error,
    refresh: mutate,
  };
}

// Hook to subscribe to job updates via Supabase Realtime
export function useBrainJob(jobId: string | null) {
  const [job, setJob] = useState<BrainJob | null>(null);
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
        .from('brain_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (!error && data) {
        setJob(data as BrainJob);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsComplete(true);
        }
      }
    };

    fetchJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`brain-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'brain_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updatedJob = payload.new as BrainJob;
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
export function useSendBrainMessage(chatId: string | null) {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const requestStartTimeRef = useRef<number | null>(null);

  const { job, isComplete, isProcessing, toolCalls, result, error: jobError } = useBrainJob(currentJobId);

  // Reset when job completes
  useEffect(() => {
    if (isComplete) {
      setIsSending(false);
      setIsRecovering(false);
      if (jobError) {
        setError(jobError);
      } else {
        setError(null);
      }
    }
  }, [isComplete, jobError]);

  // Poll for latest job when recovering from timeout
  const pollForLatestJob = useCallback(async (): Promise<string | null> => {
    if (!chatId) return null;
    
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const { data, error: queryError } = await supabase
        .from('brain_jobs')
        .select('*')
        .eq('chat_id', chatId)
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (queryError) return null;
      if (data) return data.id;
      return null;
    } catch {
      return null;
    }
  }, [chatId]);

  const sendMessage = useCallback(async (content: string, model?: 'flash' | 'pro'): Promise<string | null> => {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`/api/global-chat-api/chats/${chatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, model: model || 'flash' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Server returned invalid response');
      }

      if (response.status === 202) {
        setCurrentJobId(data.job_id);
        return data.job_id;
      } else if (response.ok) {
        setIsSending(false);
        return null;
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorName = err instanceof Error ? err.name : '';
      
      const requestDuration = requestStartTimeRef.current ? Date.now() - requestStartTimeRef.current : 0;
      const isLongRunningRequest = requestDuration > 10000;
      
      const isTimeoutLike = 
        errorName === 'AbortError' || 
        errorMessage.toLowerCase().includes('timeout') ||
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('aborted') ||
        errorMessage.toLowerCase().includes('failed to fetch');
      
      if (isTimeoutLike || isLongRunningRequest) {
        setIsRecovering(true);
        setError(null);
        
        for (let attempt = 1; attempt <= 5; attempt++) {
          const delay = attempt * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          const jobId = await pollForLatestJob();
          
          if (jobId) {
            setCurrentJobId(jobId);
            return jobId;
          }
        }
        
        setError('Request timed out. Please try again.');
        setIsSending(false);
        setIsRecovering(false);
        return null;
      } else {
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
    toolCalls,
    isComplete,
    error,
    isRecovering,
    job,
  };
}

// Create a new brain chat
export async function createBrainChat(title?: string, userId?: string | null): Promise<BrainChat> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (userId) {
    headers['x-user-id'] = userId;
  }
  
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch('/api/global-chat-api/chats', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: title || 'New Chat' }),
  });

  if (!response.ok) {
    throw new Error('Failed to create chat');
  }

  return response.json();
}

// Delete a brain chat
export async function deleteBrainChat(chatId: string, userId?: string | null): Promise<void> {
  const headers: HeadersInit = {};
  
  if (userId) {
    headers['x-user-id'] = userId;
  }
  
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`/api/global-chat-api/chats/${chatId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete chat');
  }
}

// Clear messages in a brain chat
export async function clearBrainMessages(chatId: string, userId?: string | null): Promise<void> {
  const headers: HeadersInit = {};
  
  if (userId) {
    headers['x-user-id'] = userId;
  }
  
  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`/api/global-chat-api/chats/${chatId}/messages`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to clear messages');
  }
}

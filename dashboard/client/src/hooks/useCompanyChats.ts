import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  getStoredUserId, 
  getStoredAccessToken, 
  hasValidStoredAuth,
  AUTH_STORAGE_KEY 
} from '@/lib/auth-storage';

/**
 * Get user ID for API calls (synchronous)
 * Uses the centralized auth storage utility
 */
export function getUserId(): string | null {
  return getStoredUserId();
}

/**
 * Get access token for API calls (synchronous)
 * Uses the centralized auth storage utility
 */
export function getAccessToken(): string | null {
  return getStoredAccessToken();
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
  
  // Handle auth errors gracefully
  if (res.status === 401 || res.status === 403) {
    console.warn('[useCompanyChats] Auth error:', res.status);
    return { chats: [] };
  }
  
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
  result?: unknown;
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

/**
 * Hook to list all company chats for the current user
 * Requires authentication - returns empty array if not logged in
 */
export function useCompanyChats() {
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  // Check localStorage for auth token as a fallback
  // This helps when the auth context hasn't fully propagated yet
  const hasLocalStorageAuth = hasValidStoredAuth();
  
  // IMPORTANT: Don't fetch until auth is loaded
  // Only fetch when user is authenticated (chats are user-specific)
  // Use either context user OR localStorage auth as indicator
  const isAuthenticated = userId !== null || (hasLocalStorageAuth && !authLoading);
  const shouldFetch = !authLoading && isAuthenticated;
  
  // If we have localStorage auth but no userId yet, try to get it from localStorage
  const effectiveUserId = userId || getStoredUserId();
  const effectiveAccessToken = accessToken || getStoredAccessToken();
  
  const { data, error, isLoading, mutate } = useSWR<{ chats: CompanyChat[] }>(
    // Only create the SWR key when we should fetch - null key means no fetch
    shouldFetch ? `/api/company-chat-api/chats` : null,
    createFetcher(effectiveUserId, effectiveAccessToken),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      dedupingInterval: 2000, // Prevent duplicate requests within 2 seconds
    }
  );

  return {
    chats: data?.chats || [],
    // Show loading if auth is still loading OR if we're fetching chats
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate,
    // Indicate if user needs to log in to use chat
    // Only show requiresAuth if we're sure there's no auth (context AND localStorage)
    requiresAuth: !authLoading && !userId && !hasLocalStorageAuth,
  };
}

// Hook to get a single chat's details
export function useCompanyChat(chatId: string | null) {
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  // Wait for auth to load before fetching
  const shouldFetch = !authLoading && chatId !== null;
  
  const { data, error, isLoading, mutate } = useSWR<CompanyChat>(
    shouldFetch ? `/api/company-chat-api/chats/${chatId}` : null,
    createFetcher(userId, accessToken)
  );

  return {
    chat: data,
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate,
  };
}

// Hook to get messages for a chat
export function useChatMessages(chatId: string | null, limit = 50) {
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.id || null;
  const accessToken = session?.access_token || null;
  
  // Wait for auth to load before fetching
  const shouldFetch = !authLoading && chatId !== null;
  
  const { data, error, isLoading, mutate } = useSWR<{
    messages: ChatMessage[];
    total: number;
    has_more: boolean;
  }>(
    shouldFetch ? `/api/company-chat-api/chats/${chatId}/messages?limit=${limit}` : null,
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
    
    // Use centralized auth storage
    const userId = getStoredUserId();
    if (userId) {
      headers['x-user-id'] = userId;
    }
    
    const accessToken = getStoredAccessToken();
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
        
        // If we still couldn't find a job after all attempts, show the error
        console.log('[Timeout Recovery] FAILED - No job found after all attempts');
        setIsRecovering(false);
        setError('Request timed out. Please try again.');
        setIsSending(false);
        return null;
      }
      
      // For non-timeout errors, show the error immediately
      setError(errorMessage);
      setIsSending(false);
      return null;
    }
  }, [chatId, pollForLatestJob]);

  const reset = useCallback(() => {
    setCurrentJobId(null);
    setIsSending(false);
    setError(null);
    setIsRecovering(false);
  }, []);

  return {
    sendMessage,
    reset,
    isSending,
    isRecovering,
    isProcessing,
    error,
    job,
    result,
    toolCalls,
    isComplete,
  };
}

// Create a new chat for a company
export async function createChat(
  assetId: number,
  assetType: 'equity' | 'crypto',
  displayName: string,
  userId: string | null
): Promise<CompanyChat> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Use centralized auth storage
  const effectiveUserId = userId || getStoredUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch('/api/company-chat-api/chats', {
    method: 'POST',
    headers,
    body: JSON.stringify({ asset_id: assetId, asset_type: assetType, display_name: displayName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create chat');
  }

  return response.json();
}

// Archive a chat
export async function archiveChat(chatId: string, userId: string | null): Promise<void> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Use centralized auth storage
  const effectiveUserId = userId || getStoredUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`/api/company-chat-api/chats/${chatId}/archive`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to archive chat');
  }
}


/**
 * Refresh chat context - triggers a revalidation of the chat data
 * This is a no-op function that can be used to trigger SWR revalidation
 */
export async function refreshChatContext(chatId: string): Promise<void> {
  // This function is called to signal that chat context should be refreshed
  // The actual refresh is handled by SWR's mutate function in the hooks
  console.log('[useCompanyChats] refreshChatContext called for chat:', chatId);
}

/**
 * Clear chat messages - used when starting a new conversation
 * This is a no-op function as message clearing is handled by the backend
 */
export async function clearChatMessages(chatId: string): Promise<void> {
  console.log('[useCompanyChats] clearChatMessages called for chat:', chatId);
  // Messages are managed by the backend, this is just a signal function
}


/**
 * Create or get an existing chat for a company
 * If a chat already exists for this asset and user, returns the existing chat
 */
export async function createOrGetChat(
  assetId: string | number,
  assetType: 'equity' | 'crypto',
  displayName: string,
  userId: string | null
): Promise<CompanyChat> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Use centralized auth storage
  const effectiveUserId = userId || getStoredUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // The backend POST /chats endpoint already handles create-or-get logic
  const response = await fetch('/api/company-chat-api/chats', {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      asset_id: typeof assetId === 'string' ? parseInt(assetId, 10) : assetId, 
      asset_type: assetType, 
      display_name: displayName 
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create or get chat');
  }

  return response.json();
}

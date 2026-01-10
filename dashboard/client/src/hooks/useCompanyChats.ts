import useSWR from 'swr';
import { useAuth } from '@/contexts/AuthContext';

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

// Create a fetcher that includes user_id header
const createFetcher = (userId: string | null) => async (url: string) => {
  const headers: HeadersInit = {};
  if (userId) {
    headers['x-user-id'] = userId;
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

// Hook to list all company chats for the current user
export function useCompanyChats() {
  const { user } = useAuth();
  const userId = user?.id || null;
  
  const { data, error, isLoading, mutate } = useSWR<{ chats: CompanyChat[] }>(
    '/api/company-chat-api/chats',
    createFetcher(userId),
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
  const { user } = useAuth();
  const userId = user?.id || null;
  
  const { data, error, isLoading, mutate } = useSWR<CompanyChat>(
    chatId ? `/api/company-chat-api/chats/${chatId}` : null,
    createFetcher(userId)
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
  const { user } = useAuth();
  const userId = user?.id || null;
  
  const { data, error, isLoading, mutate } = useSWR<{
    messages: ChatMessage[];
    total: number;
    has_more: boolean;
  }>(
    chatId ? `/api/company-chat-api/chats/${chatId}/messages?limit=${limit}` : null,
    createFetcher(userId),
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

// Function to send a message and get AI response
export async function sendChatMessage(
  chatId: string,
  content: string,
  userId?: string | null
): Promise<SendMessageResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  const effectiveUserId = userId || getUserId();
  if (effectiveUserId) {
    headers['x-user-id'] = effectiveUserId;
  }
  
  const response = await fetch(`/api/company-chat-api/chats/${chatId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
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
  
  const response = await fetch(`/api/company-chat-api/chats/${chatId}/messages`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clear chat');
  }
}

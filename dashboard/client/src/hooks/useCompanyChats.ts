import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface CompanyChat {
  chat_id: string;
  asset_id: string;
  asset_type: 'equity' | 'crypto';
  display_name: string;
  status: 'active' | 'archived';
  last_message_at: string | null;
  created_at: string;
  message_count: number;
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

// Hook to list all company chats
export function useCompanyChats() {
  const { data, error, isLoading, mutate } = useSWR<{ chats: CompanyChat[] }>(
    '/api/company-chat-api/chats',
    fetcher,
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
  const { data, error, isLoading, mutate } = useSWR<CompanyChat>(
    chatId ? `/api/company-chat-api/chats/${chatId}` : null,
    fetcher
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
  const { data, error, isLoading, mutate } = useSWR<{
    messages: ChatMessage[];
    total: number;
    has_more: boolean;
  }>(
    chatId ? `/api/company-chat-api/chats/${chatId}/messages?limit=${limit}` : null,
    fetcher,
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

// Function to create or get a chat for an asset
export async function createOrGetChat(
  assetId: number | string,
  assetType?: 'equity' | 'crypto',
  displayName?: string
): Promise<CompanyChat> {
  const response = await fetch('/api/company-chat-api/chats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
  content: string
): Promise<SendMessageResponse> {
  const response = await fetch(`/api/company-chat-api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
}

// Function to archive a chat
export async function archiveChat(chatId: string): Promise<void> {
  const response = await fetch(`/api/company-chat-api/chats/${chatId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to archive chat');
  }
}

// Function to refresh context snapshot
export async function refreshChatContext(chatId: string): Promise<void> {
  const response = await fetch(`/api/company-chat-api/chats/${chatId}/context`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to refresh context');
  }
}

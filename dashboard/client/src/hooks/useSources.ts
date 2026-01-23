import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface Source {
  source_id: string;
  chat_id: string;
  source_type: 'file' | 'url' | 'text' | 'company_doc';
  name: string;
  description?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  source_url?: string;
  extracted_text?: string;
  word_count?: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message?: string;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UseSourcesOptions {
  chatId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSourcesReturn {
  sources: Source[];
  isLoading: boolean;
  error: string | null;
  addSource: (source: {
    source_type: 'file' | 'url' | 'text';
    name: string;
    description?: string;
    content?: string;
    url?: string;
    file?: File;
  }) => Promise<void>;
  toggleSource: (sourceId: string, enabled: boolean) => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
  reprocessSource: (sourceId: string) => Promise<void>;
  refreshSources: () => Promise<void>;
  getSourceContext: () => Promise<{ context: string; sourceCount: number; totalWords: number }>;
}

const SUPABASE_URL = 'https://wfogbaipiqootjrsprde.supabase.co';

export function useSources({ chatId, autoRefresh = true, refreshInterval = 5000 }: UseSourcesOptions): UseSourcesReturn {
  const { session } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    };
  }, [session?.access_token]);

  // Fetch sources
  const refreshSources = useCallback(async () => {
    if (!chatId || !session?.access_token) return;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/sources-api/sources?chat_id=${chatId}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sources');
      }

      const data = await response.json();
      setSources(data.sources || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sources');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, session?.access_token, getAuthHeaders]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    refreshSources();

    // Auto-refresh for processing sources
    if (autoRefresh) {
      const hasProcessing = sources.some(s => s.status === 'processing' || s.status === 'pending');
      if (hasProcessing) {
        const interval = setInterval(refreshSources, refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [chatId, refreshSources, autoRefresh, refreshInterval, sources]);

  // Add source
  const addSource = useCallback(async (source: {
    source_type: 'file' | 'url' | 'text';
    name: string;
    description?: string;
    content?: string;
    url?: string;
    file?: File;
  }) => {
    if (!session?.access_token) throw new Error('Not authenticated');

    let response: Response;

    if (source.source_type === 'file' && source.file) {
      // Use FormData for file uploads
      const formData = new FormData();
      formData.append('file', source.file);
      formData.append('chat_id', chatId);
      formData.append('name', source.name);
      if (source.description) formData.append('description', source.description);

      response = await fetch(
        `${SUPABASE_URL}/functions/v1/sources-api/sources`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );
    } else {
      // Use JSON for URL and text sources
      response = await fetch(
        `${SUPABASE_URL}/functions/v1/sources-api/sources`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            chat_id: chatId,
            source_type: source.source_type,
            name: source.name,
            description: source.description,
            content: source.content,
            url: source.url,
          }),
        }
      );
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add source');
    }

    const data = await response.json();
    setSources(prev => [data.source, ...prev]);
  }, [chatId, session?.access_token, getAuthHeaders]);

  // Toggle source
  const toggleSource = useCallback(async (sourceId: string, enabled: boolean) => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sources-api/sources/${sourceId}`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_enabled: enabled }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to toggle source');
    }

    setSources(prev =>
      prev.map(s => s.source_id === sourceId ? { ...s, is_enabled: enabled } : s)
    );
  }, [session?.access_token, getAuthHeaders]);

  // Delete source
  const deleteSource = useCallback(async (sourceId: string) => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sources-api/sources/${sourceId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete source');
    }

    setSources(prev => prev.filter(s => s.source_id !== sourceId));
  }, [session?.access_token, getAuthHeaders]);

  // Reprocess source
  const reprocessSource = useCallback(async (sourceId: string) => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sources-api/sources/${sourceId}/reprocess`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to reprocess source');
    }

    setSources(prev =>
      prev.map(s => s.source_id === sourceId ? { ...s, status: 'processing', error_message: undefined } : s)
    );
  }, [session?.access_token, getAuthHeaders]);

  // Get combined context from enabled sources
  const getSourceContext = useCallback(async () => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sources-api/sources/context?chat_id=${chatId}`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) {
      throw new Error('Failed to get source context');
    }

    const data = await response.json();
    return {
      context: data.context || '',
      sourceCount: data.source_count || 0,
      totalWords: data.total_words || 0,
    };
  }, [chatId, session?.access_token, getAuthHeaders]);

  return {
    sources,
    isLoading,
    error,
    addSource,
    toggleSource,
    deleteSource,
    reprocessSource,
    refreshSources,
    getSourceContext,
  };
}

export default useSources;

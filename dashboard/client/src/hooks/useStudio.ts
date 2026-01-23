import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { OutputType, StudioOutput } from '@/components/StudioPanel';

const SUPABASE_URL = 'https://wfogbaipiqootjrsprde.supabase.co';

interface UseStudioOptions {
  chatId: string;
}

interface UseStudioReturn {
  outputs: StudioOutput[];
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  generate: (type: OutputType, prompt?: string) => Promise<StudioOutput>;
  deleteOutput: (outputId: string) => Promise<void>;
  refreshOutputs: () => Promise<void>;
  clearOutputs: () => void;
}

export function useStudio({ chatId }: UseStudioOptions): UseStudioReturn {
  const { session } = useAuth();
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const loadAttemptRef = useRef(0);

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [session]);

  // Load persisted outputs
  const refreshOutputs = useCallback(async () => {
    if (!chatId) {
      setIsLoading(false);
      return;
    }
    
    // Wait for session to be available
    if (!session?.access_token) {
      // If no session yet, don't set loading to false - wait for session
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useStudio] Loading outputs for chat:', chatId);
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/studio-api/outputs/${chatId}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      console.log('[useStudio] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load outputs');
      }

      const data = await response.json();
      console.log('[useStudio] Loaded outputs:', data.outputs?.length || 0);
      setOutputs(data.outputs || []);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('[useStudio] Failed to load outputs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load outputs');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, session?.access_token, getAuthHeaders]);

  // Load outputs when session becomes available or chatId changes
  useEffect(() => {
    // Reset loading state when chatId changes
    if (chatId) {
      hasLoadedRef.current = false;
      loadAttemptRef.current = 0;
    }
  }, [chatId]);

  useEffect(() => {
    // Only attempt to load if we have a session and haven't successfully loaded yet
    if (session?.access_token && chatId && !hasLoadedRef.current) {
      loadAttemptRef.current += 1;
      console.log('[useStudio] Attempting to load outputs, attempt:', loadAttemptRef.current);
      refreshOutputs();
    } else if (!session?.access_token && chatId) {
      // Still waiting for session, keep loading state
      setIsLoading(true);
    }
  }, [session?.access_token, chatId, refreshOutputs]);

  // Also set up a retry mechanism in case session takes time to load
  useEffect(() => {
    if (!hasLoadedRef.current && chatId && loadAttemptRef.current < 3) {
      const timer = setTimeout(() => {
        if (!hasLoadedRef.current && session?.access_token) {
          console.log('[useStudio] Retry loading outputs');
          refreshOutputs();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [chatId, session?.access_token, refreshOutputs]);

  const generate = useCallback(async (type: OutputType, prompt?: string): Promise<StudioOutput> => {
    setIsGenerating(true);
    setError(null);

    // Create a placeholder output
    const placeholderOutput: StudioOutput = {
      id: `temp-${Date.now()}`,
      type,
      title: getDefaultTitle(type),
      status: 'generating',
      createdAt: new Date().toISOString(),
    };

    setOutputs(prev => [placeholderOutput, ...prev]);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/studio-api/generate`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            chat_id: chatId,
            output_type: type,
            prompt,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate ${type}`);
      }

      const data = await response.json();

      const completedOutput: StudioOutput = {
        id: data.output_id || data.id || `output-${Date.now()}`,
        type,
        title: data.title || getDefaultTitle(type),
        status: 'ready',
        content: data.content,
        diagramData: data.diagramData,
        createdAt: data.created_at || new Date().toISOString(),
      };

      // Replace placeholder with completed output
      setOutputs(prev => prev.map(o => 
        o.id === placeholderOutput.id ? completedOutput : o
      ));

      return completedOutput;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      setError(errorMessage);

      // Update placeholder to error state
      const errorOutput: StudioOutput = {
        ...placeholderOutput,
        status: 'error',
        error: errorMessage,
      };

      setOutputs(prev => prev.map(o => 
        o.id === placeholderOutput.id ? errorOutput : o
      ));

      return errorOutput;
    } finally {
      setIsGenerating(false);
    }
  }, [chatId, getAuthHeaders]);

  const deleteOutput = useCallback(async (outputId: string): Promise<void> => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/studio-api/outputs/${outputId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete output');
      }

      // Remove from local state
      setOutputs(prev => prev.filter(o => o.id !== outputId));
    } catch (err) {
      console.error('Failed to delete output:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete output');
      throw err;
    }
  }, [getAuthHeaders]);

  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  return {
    outputs,
    isGenerating,
    isLoading,
    error,
    generate,
    deleteOutput,
    refreshOutputs,
    clearOutputs,
  };
}

function getDefaultTitle(type: OutputType): string {
  const now = new Date();
  const timestamp = now.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit' 
  });

  switch (type) {
    case 'report':
      return `Investment Report - ${timestamp}`;
    case 'slides':
      return `Presentation - ${timestamp}`;
    case 'diagram':
      return `Diagram - ${timestamp}`;
    case 'table':
      return `Data Table - ${timestamp}`;
    default:
      return `Output - ${timestamp}`;
  }
}

export default useStudio;

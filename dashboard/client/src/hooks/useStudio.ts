import { useState, useCallback, useEffect } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [session]);

  // Load persisted outputs on mount and when chatId changes
  const refreshOutputs = useCallback(async () => {
    if (!chatId || !session?.access_token) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/studio-api/outputs/${chatId}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load outputs');
      }

      const data = await response.json();
      setOutputs(data.outputs || []);
    } catch (err) {
      console.error('Failed to load outputs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load outputs');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, session?.access_token, getAuthHeaders]);

  // Load outputs when component mounts or chatId changes
  useEffect(() => {
    refreshOutputs();
  }, [refreshOutputs]);

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

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { OutputType, StudioOutput } from '@/components/StudioPanel';

const SUPABASE_URL = 'https://wfogbaipiqootjrsprde.supabase.co';

interface UseStudioOptions {
  chatId: string;
}

interface UseStudioReturn {
  outputs: StudioOutput[];
  isGenerating: boolean;
  error: string | null;
  generate: (type: OutputType, prompt?: string) => Promise<StudioOutput>;
  clearOutputs: () => void;
}

export function useStudio({ chatId }: UseStudioOptions): UseStudioReturn {
  const { session } = useAuth();
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
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
        id: data.output_id || `output-${Date.now()}`,
        type,
        title: data.title || getDefaultTitle(type),
        status: 'ready',
        content: data.content,
        diagramData: data.diagramData,
        createdAt: new Date().toISOString(),
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

  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  return {
    outputs,
    isGenerating,
    error,
    generate,
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface Diagram {
  diagram_id: string;
  chat_id: string;
  user_id: string;
  name: string;
  description?: string;
  diagram_type?: 'flowchart' | 'org_chart' | 'mind_map' | 'relationship' | 'timeline' | 'custom';
  excalidraw_data: ExcalidrawScene;
  thumbnail_url?: string;
  generation_prompt?: string;
  generation_model?: string;
  is_ai_generated: boolean;
  status: 'generating' | 'ready' | 'error';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ExcalidrawScene {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: ExcalidrawElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  text?: string;
  points?: number[][];
  [key: string]: unknown;
}

// Generation progress types
export interface GenerationProgress {
  stage: 'starting' | 'thinking' | 'tool_call' | 'tool_result' | 'parsing' | 'saving' | 'retrying' | 'complete' | 'error';
  message: string;
  tool?: string;
  args?: Record<string, unknown>;
  iteration?: number;
}

interface UseDiagramsOptions {
  chatId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseDiagramsReturn {
  diagrams: Diagram[];
  isLoading: boolean;
  isGenerating: boolean;
  generationProgress: GenerationProgress | null;
  toolCalls: Array<{ tool: string; args?: Record<string, unknown>; status: 'running' | 'complete' }>;
  error: string | null;
  createDiagram: (diagram: {
    name: string;
    description?: string;
    diagram_type?: string;
    excalidraw_data?: ExcalidrawScene;
    generation_prompt?: string;
    is_ai_generated?: boolean;
  }) => Promise<Diagram>;
  generateDiagram: (request: string, companySymbol?: string, companyName?: string, chatSummary?: string) => Promise<Diagram>;
  updateDiagram: (diagramId: string, updates: Partial<Diagram>) => Promise<Diagram>;
  deleteDiagram: (diagramId: string) => Promise<void>;
  getDiagram: (diagramId: string) => Promise<Diagram>;
  uploadThumbnail: (diagramId: string, thumbnailData: string) => Promise<string>;
  exportDiagram: (diagramId: string) => Promise<ExcalidrawScene>;
  refreshDiagrams: () => Promise<void>;
}

const SUPABASE_URL = 'https://wfogbaipiqootjrsprde.supabase.co';

export function useDiagrams({ chatId, autoRefresh = false, refreshInterval = 5000 }: UseDiagramsOptions): UseDiagramsReturn {
  const { session } = useAuth();
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [toolCalls, setToolCalls] = useState<Array<{ tool: string; args?: Record<string, unknown>; status: 'running' | 'complete' }>>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getAuthHeaders = useCallback(() => {
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    };
  }, [session?.access_token]);

  // Fetch diagrams
  const refreshDiagrams = useCallback(async () => {
    if (!chatId || !session?.access_token) return;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/diagrams-api/diagrams?chat_id=${chatId}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch diagrams');
      }

      const data = await response.json();
      setDiagrams(data.diagrams || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching diagrams:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch diagrams');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, session?.access_token, getAuthHeaders]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    refreshDiagrams();

    if (autoRefresh) {
      const hasGenerating = diagrams.some(d => d.status === 'generating');
      if (hasGenerating) {
        const interval = setInterval(refreshDiagrams, refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [chatId, refreshDiagrams, autoRefresh, refreshInterval, diagrams]);

  // Generate diagram using AI with streaming progress
  const generateDiagram = useCallback(async (
    request: string,
    companySymbol?: string,
    companyName?: string,
    chatSummary?: string
  ): Promise<Diagram> => {
    if (!session?.access_token) throw new Error('Not authenticated');

    // Cancel any existing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsGenerating(true);
    setError(null);
    setGenerationProgress({ stage: 'starting', message: 'Starting diagram generation...' });
    setToolCalls([]);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/diagram-generator`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            chat_id: chatId,
            user_id: session.user?.id,
            request: request,
            company_symbol: companySymbol,
            company_name: companyName,
            chat_context: chatSummary,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate diagram');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let resultDiagram: Diagram | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle different event types based on data content
              if (data.stage) {
                setGenerationProgress({
                  stage: data.stage,
                  message: data.message || '',
                  iteration: data.iteration,
                });
              }
              
              if (data.tool) {
                if (data.success !== undefined) {
                  // Tool result
                  setToolCalls(prev => 
                    prev.map(tc => tc.tool === data.tool ? { ...tc, status: 'complete' as const } : tc)
                  );
                } else {
                  // Tool call
                  setToolCalls(prev => [...prev, { tool: data.tool, args: data.args, status: 'running' as const }]);
                }
              }
              
              if (data.success && data.diagram) {
                resultDiagram = data.diagram;
                setGenerationProgress({ stage: 'complete', message: data.message || 'Done!' });
              }
              
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              console.error('Error parsing SSE data:', parseErr, line);
            }
          }
        }
      }

      if (!resultDiagram) {
        throw new Error('No diagram received from generation');
      }

      // Add the new diagram to the list
      setDiagrams(prev => [resultDiagram!, ...prev]);
      return resultDiagram;

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Generation cancelled');
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate diagram';
      setError(errorMessage);
      setGenerationProgress({ stage: 'error', message: errorMessage });
      throw err;
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [chatId, session?.access_token, session?.user?.id, getAuthHeaders]);

  // Create diagram (manual/blank)
  const createDiagram = useCallback(async (diagram: {
    name: string;
    description?: string;
    diagram_type?: string;
    excalidraw_data?: ExcalidrawScene;
    generation_prompt?: string;
    is_ai_generated?: boolean;
  }): Promise<Diagram> => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/diagrams-api/diagrams`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          chat_id: chatId,
          user_id: session.user?.id,
          ...diagram,
          excalidraw_data: diagram.excalidraw_data || {
            type: 'excalidraw',
            version: 2,
            source: 'stratos-brain',
            elements: [],
            appState: { viewBackgroundColor: '#121212' },
            files: {},
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create diagram');
    }

    const data = await response.json();
    setDiagrams(prev => [data.diagram, ...prev]);
    return data.diagram;
  }, [chatId, session?.access_token, session?.user?.id, getAuthHeaders]);

  // Update diagram
  const updateDiagram = useCallback(async (diagramId: string, updates: Partial<Diagram>): Promise<Diagram> => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/diagrams-api/diagrams/${diagramId}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update diagram');
    }

    const data = await response.json();
    setDiagrams(prev =>
      prev.map(d => d.diagram_id === diagramId ? data.diagram : d)
    );
    return data.diagram;
  }, [session?.access_token, getAuthHeaders]);

  // Delete diagram
  const deleteDiagram = useCallback(async (diagramId: string) => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/diagrams-api/diagrams/${diagramId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete diagram');
    }

    setDiagrams(prev => prev.filter(d => d.diagram_id !== diagramId));
  }, [session?.access_token, getAuthHeaders]);

  // Get single diagram with full data
  const getDiagram = useCallback(async (diagramId: string): Promise<Diagram> => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/diagrams-api/diagrams/${diagramId}`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) {
      throw new Error('Failed to get diagram');
    }

    const data = await response.json();
    return data.diagram;
  }, [session?.access_token, getAuthHeaders]);

  // Upload thumbnail
  const uploadThumbnail = useCallback(async (diagramId: string, thumbnailData: string): Promise<string> => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/diagrams-api/diagrams/${diagramId}/thumbnail`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ thumbnail_data: thumbnailData }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload thumbnail');
    }

    const data = await response.json();
    
    setDiagrams(prev =>
      prev.map(d => d.diagram_id === diagramId ? { ...d, thumbnail_url: data.thumbnail_url } : d)
    );
    
    return data.thumbnail_url;
  }, [session?.access_token, getAuthHeaders]);

  // Export diagram as Excalidraw JSON
  const exportDiagram = useCallback(async (diagramId: string): Promise<ExcalidrawScene> => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/diagrams-api/diagrams/${diagramId}/export`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) {
      throw new Error('Failed to export diagram');
    }

    return await response.json();
  }, [session?.access_token, getAuthHeaders]);

  return {
    diagrams,
    isLoading,
    isGenerating,
    generationProgress,
    toolCalls,
    error,
    createDiagram,
    generateDiagram,
    updateDiagram,
    deleteDiagram,
    getDiagram,
    uploadThumbnail,
    exportDiagram,
    refreshDiagrams,
  };
}

export default useDiagrams;

import { useState, useEffect, useCallback } from 'react';
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

interface UseDiagramsOptions {
  chatId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseDiagramsReturn {
  diagrams: Diagram[];
  isLoading: boolean;
  error: string | null;
  createDiagram: (diagram: {
    name: string;
    description?: string;
    diagram_type?: string;
    excalidraw_data?: ExcalidrawScene;
    generation_prompt?: string;
    is_ai_generated?: boolean;
  }) => Promise<Diagram>;
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
  const [error, setError] = useState<string | null>(null);

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

    // Auto-refresh for generating diagrams
    if (autoRefresh) {
      const hasGenerating = diagrams.some(d => d.status === 'generating');
      if (hasGenerating) {
        const interval = setInterval(refreshDiagrams, refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [chatId, refreshDiagrams, autoRefresh, refreshInterval, diagrams]);

  // Create diagram
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
          ...diagram,
          excalidraw_data: diagram.excalidraw_data || {
            type: 'excalidraw',
            version: 2,
            source: 'stratos-brain',
            elements: [],
            appState: { viewBackgroundColor: '#ffffff' },
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
  }, [chatId, session?.access_token, getAuthHeaders]);

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
    
    // Update local state with new thumbnail URL
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
    error,
    createDiagram,
    updateDiagram,
    deleteDiagram,
    getDiagram,
    uploadThumbnail,
    exportDiagram,
    refreshDiagrams,
  };
}

export default useDiagrams;

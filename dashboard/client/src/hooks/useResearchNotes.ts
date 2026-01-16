import useSWR, { mutate as globalMutate } from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetcher, defaultSwrConfig, getJsonApiHeaders, getApiHeaders, API_BASE } from "../lib/api-config";

export type NoteContextType = 'general' | 'asset' | 'stock_list';

export interface NoteContext {
  type: NoteContextType;
  id?: string | number;
  name?: string;
}

export interface ResearchNoteAsset {
  asset_id: number;
  symbol: string;
  name: string;
  asset_type: string;
  added_at: string;
}

export interface ResearchNote {
  id: number;
  title: string;
  content: string;
  is_favorite: boolean;
  user_id: string;
  context_type: NoteContextType;
  context_id: string | null;
  context_name?: string | null;
  created_at: string;
  updated_at: string;
  assets: ResearchNoteAsset[];
  is_new?: boolean;
}

// Hook to get all research notes for the current user
export function useResearchNotes(contextType?: NoteContextType, contextId?: string) {
  const { user } = useAuth();
  
  let url = user?.id ? `${API_BASE}/dashboard/research-notes?user_id=${user.id}` : null;
  if (url && contextType) {
    url += `&context_type=${contextType}`;
  }
  if (url && contextId) {
    url += `&context_id=${contextId}`;
  }
  
  const { data, error, isLoading, mutate } = useSWR<ResearchNote[]>(
    url,
    apiFetcher,
    {
      ...defaultSwrConfig,
      revalidateOnFocus: false,
    }
  );

  // Ensure data is an array
  const safeNotes = Array.isArray(data) ? data : [];

  return {
    notes: safeNotes,
    isLoading,
    error,
    mutate,
  };
}

// Hook to get a single research note
export function useResearchNote(noteId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<ResearchNote>(
    noteId ? `${API_BASE}/dashboard/research-notes/${noteId}` : null,
    apiFetcher,
    {
      ...defaultSwrConfig,
      revalidateOnFocus: false,
    }
  );

  return {
    note: data || null,
    isLoading,
    error,
    mutate,
  };
}

// Hook to get or create a note for a specific context
export function useContextNote(context: NoteContext | null) {
  const { user } = useAuth();
  
  let url = null;
  if (user?.id && context) {
    url = `${API_BASE}/dashboard/research-notes/context?user_id=${user.id}&context_type=${context.type}`;
    if (context.id) {
      url += `&context_id=${context.id}`;
    }
  }
  
  const { data, error, isLoading, mutate } = useSWR<ResearchNote>(
    url,
    apiFetcher,
    {
      ...defaultSwrConfig,
      revalidateOnFocus: false,
    }
  );

  return {
    note: data || null,
    isLoading,
    error,
    mutate,
  };
}

// Create a new research note
export async function createResearchNote(
  userId: string,
  title: string,
  content?: string,
  is_favorite?: boolean,
  context_type?: NoteContextType,
  context_id?: string,
  asset_ids?: number[]
): Promise<ResearchNote> {
  const response = await fetch(`${API_BASE}/dashboard/research-notes`, {
    method: 'POST',
    headers: getJsonApiHeaders(),
    body: JSON.stringify({ 
      user_id: userId,
      title, 
      content, 
      is_favorite, 
      context_type,
      context_id,
      asset_ids 
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create note');
  }
  
  const note = await response.json();
  globalMutate((key: string) => typeof key === 'string' && key.startsWith(`${API_BASE}/dashboard/research-notes`));
  return note;
}

// Update a research note
export async function updateResearchNote(
  noteId: number,
  updates: { title?: string; content?: string; is_favorite?: boolean }
): Promise<ResearchNote> {
  const response = await fetch(`${API_BASE}/dashboard/research-notes/${noteId}`, {
    method: 'PUT',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update note');
  }
  
  const note = await response.json();
  globalMutate((key: string) => typeof key === 'string' && key.startsWith(`${API_BASE}/dashboard/research-notes`));
  return note;
}

// Delete a research note
export async function deleteResearchNote(noteId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/dashboard/research-notes/${noteId}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete note');
  }
  
  globalMutate((key: string) => typeof key === 'string' && key.startsWith(`${API_BASE}/dashboard/research-notes`));
}

// Add asset to a research note
export async function addAssetToNote(noteId: number, assetId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/dashboard/research-notes/${noteId}/assets`, {
    method: 'POST',
    headers: getJsonApiHeaders(),
    body: JSON.stringify({ asset_id: assetId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add asset to note');
  }
  
  globalMutate((key: string) => typeof key === 'string' && key.startsWith(`${API_BASE}/dashboard/research-notes`));
}

// Remove asset from a research note
export async function removeAssetFromNote(noteId: number, assetId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/dashboard/research-notes/${noteId}/assets/${assetId}`, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove asset from note');
  }
  
  globalMutate((key: string) => typeof key === 'string' && key.startsWith(`${API_BASE}/dashboard/research-notes`));
}

// Toggle favorite status
export async function toggleNoteFavorite(noteId: number, isFavorite: boolean): Promise<ResearchNote> {
  const response = await fetch(`${API_BASE}/dashboard/research-notes/${noteId}/favorite`, {
    method: 'PATCH',
    headers: getJsonApiHeaders(),
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update favorite status');
  }
  
  const note = await response.json();
  globalMutate((key: string) => typeof key === 'string' && key.startsWith(`${API_BASE}/dashboard/research-notes`));
  return note;
}

// Format date for display
export function formatNoteDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Format full date for tooltip
export function formatNoteDateFull(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Get context type label
export function getContextTypeLabel(type: NoteContextType): string {
  switch (type) {
    case 'asset': return 'Asset';
    case 'stock_list': return 'List';
    case 'general': return 'General';
    default: return type;
  }
}

// Get context icon class
export function getContextTypeIcon(type: NoteContextType): string {
  switch (type) {
    case 'asset': return 'building-2';
    case 'stock_list': return 'list';
    case 'general': return 'file-text';
    default: return 'file-text';
  }
}

import useSWR, { mutate as globalMutate } from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
  created_at: string;
  updated_at: string;
  assets: ResearchNoteAsset[];
}

// Hook to get all research notes
export function useResearchNotes() {
  const { data, error, isLoading, mutate } = useSWR<ResearchNote[]>(
    '/api/dashboard/research-notes',
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    notes: data || [],
    isLoading,
    error,
    mutate,
  };
}

// Hook to get a single research note
export function useResearchNote(noteId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<ResearchNote>(
    noteId ? `/api/dashboard/research-notes/${noteId}` : null,
    fetcher,
    {
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
  title: string,
  content?: string,
  is_favorite?: boolean,
  asset_ids?: number[]
): Promise<ResearchNote> {
  const response = await fetch('/api/dashboard/research-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, is_favorite, asset_ids }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create note');
  }
  
  const note = await response.json();
  globalMutate('/api/dashboard/research-notes');
  return note;
}

// Update a research note
export async function updateResearchNote(
  noteId: number,
  updates: { title?: string; content?: string; is_favorite?: boolean }
): Promise<ResearchNote> {
  const response = await fetch(`/api/dashboard/research-notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update note');
  }
  
  const note = await response.json();
  globalMutate('/api/dashboard/research-notes');
  globalMutate(`/api/dashboard/research-notes/${noteId}`);
  return note;
}

// Delete a research note
export async function deleteResearchNote(noteId: number): Promise<void> {
  const response = await fetch(`/api/dashboard/research-notes/${noteId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete note');
  }
  
  globalMutate('/api/dashboard/research-notes');
}

// Add asset to a research note
export async function addAssetToNote(noteId: number, assetId: number): Promise<void> {
  const response = await fetch(`/api/dashboard/research-notes/${noteId}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add asset to note');
  }
  
  globalMutate('/api/dashboard/research-notes');
  globalMutate(`/api/dashboard/research-notes/${noteId}`);
}

// Remove asset from a research note
export async function removeAssetFromNote(noteId: number, assetId: number): Promise<void> {
  const response = await fetch(`/api/dashboard/research-notes/${noteId}/assets/${assetId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove asset from note');
  }
  
  globalMutate('/api/dashboard/research-notes');
  globalMutate(`/api/dashboard/research-notes/${noteId}`);
}

// Toggle favorite status
export async function toggleNoteFavorite(noteId: number, isFavorite: boolean): Promise<ResearchNote> {
  const response = await fetch(`/api/dashboard/research-notes/${noteId}/favorite`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update favorite status');
  }
  
  const note = await response.json();
  globalMutate('/api/dashboard/research-notes');
  globalMutate(`/api/dashboard/research-notes/${noteId}`);
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

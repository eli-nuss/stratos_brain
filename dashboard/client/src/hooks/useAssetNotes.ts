import useSWR, { mutate as globalMutate } from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface AssetNote {
  note_id: number;
  note_text: string;
  created_at: string;
  updated_at: string;
}

interface NotesResponse {
  asset_id: number;
  notes: AssetNote[];
  latest: AssetNote | null;
}

// Hook to get notes for a single asset
export function useAssetNotes(assetId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<NotesResponse>(
    assetId ? `/api/dashboard/notes/${assetId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    notes: data?.notes || [],
    latestNote: data?.latest || null,
    isLoading,
    error,
    mutate,
  };
}

// Hook to get latest notes for multiple assets (for table view)
export function useAssetNotesMap(assetIds: number[]) {
  // Fetch notes for all assets in parallel using individual SWR calls
  // This is handled by the component using multiple useAssetNotes calls
  // For efficiency, we'll batch fetch in the API later if needed
  return null;
}

// Create a new note
export async function createNote(assetId: number, noteText: string): Promise<AssetNote> {
  const response = await fetch('/api/dashboard/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_id: assetId, note_text: noteText }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create note');
  }
  
  const note = await response.json();
  
  // Revalidate the notes for this asset
  globalMutate(`/api/dashboard/notes/${assetId}`);
  
  return note;
}

// Update an existing note
export async function updateNote(noteId: number, noteText: string, assetId: number): Promise<AssetNote> {
  const response = await fetch(`/api/dashboard/notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note_text: noteText }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update note');
  }
  
  const note = await response.json();
  
  // Revalidate the notes for this asset
  globalMutate(`/api/dashboard/notes/${assetId}`);
  
  return note;
}

// Delete a note
export async function deleteNote(noteId: number, assetId: number): Promise<void> {
  const response = await fetch(`/api/dashboard/notes/${noteId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete note');
  }
  
  // Revalidate the notes for this asset
  globalMutate(`/api/dashboard/notes/${assetId}`);
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

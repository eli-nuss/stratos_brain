import { useState, useRef, useEffect } from 'react';
import { StickyNote, Plus, Pencil, Trash2, Check, X, Clock } from 'lucide-react';
import { 
  useAssetNotes, 
  createNote, 
  updateNote, 
  deleteNote,
  formatNoteDateFull,
  AssetNote 
} from '@/hooks/useAssetNotes';

interface NotesHistoryProps {
  assetId: number;
}

export function NotesHistory({ assetId }: NotesHistoryProps) {
  const { notes, isLoading, mutate } = useAssetNotes(assetId);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if ((isAdding || editingId) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding, editingId]);

  const handleStartAdd = () => {
    setEditText('');
    setIsAdding(true);
    setEditingId(null);
  };

  const handleStartEdit = (note: AssetNote) => {
    setEditText(note.note_text);
    setEditingId(note.note_id);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setEditText('');
  };

  const handleSave = async () => {
    if (!editText.trim()) {
      handleCancel();
      return;
    }

    setIsSaving(true);
    try {
      if (isAdding) {
        await createNote(assetId, editText);
      } else if (editingId) {
        await updateNote(editingId, editText, assetId);
      }
      await mutate();
      handleCancel();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    if (!confirm('Delete this note?')) return;
    
    try {
      await deleteNote(noteId, assetId);
      await mutate();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-yellow-500" />
          <h3 className="font-semibold text-sm">Notes</h3>
        </div>
        <div className="p-4">
          <div className="h-16 bg-muted/30 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-yellow-500" />
          <h3 className="font-semibold text-sm">Notes</h3>
          <span className="text-xs text-muted-foreground">({notes.length})</span>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Note
          </button>
        )}
      </div>

      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {/* Add new note form */}
        {isAdding && (
          <div className="p-3 bg-muted/10">
            <textarea
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your note..."
              className="w-full h-20 text-sm bg-background border border-primary/50 rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isSaving}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">
                Cmd/Ctrl+Enter to save
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editText.trim()}
                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes list */}
        {notes.length === 0 && !isAdding ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notes yet. Click "Add Note" to create one.
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.note_id} className="p-3 hover:bg-muted/10 transition-colors group">
              {editingId === note.note_id ? (
                <div>
                  <textarea
                    ref={inputRef}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full h-20 text-sm bg-background border border-primary/50 rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    disabled={isSaving}
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !editText.trim()}
                      className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap text-foreground">
                    {note.note_text}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatNoteDateFull(note.updated_at)}
                      {note.created_at !== note.updated_at && (
                        <span className="text-muted-foreground/50">(edited)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(note)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.note_id)}
                        className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

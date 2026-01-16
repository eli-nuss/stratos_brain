import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Star, Trash2, Search, X, 
  ChevronRight, Loader2, Save, Building2, Link2
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  useResearchNotes, 
  useResearchNote,
  createResearchNote, 
  updateResearchNote, 
  deleteResearchNote,
  addAssetToNote,
  removeAssetFromNote,
  toggleNoteFavorite,
  formatNoteDate,
  formatNoteDateFull,
  ResearchNote,
  ResearchNoteAsset
} from '@/hooks/useResearchNotes';
import AssetSearchDropdown from '@/components/AssetSearchDropdown';
import { cn } from '@/lib/utils';

export default function ResearchNotes() {
  const { notes, isLoading, mutate } = useResearchNotes();
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Get the selected note details
  const { note: selectedNote, mutate: mutateSelectedNote } = useResearchNote(selectedNoteId);

  // Update edit fields when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title);
      setEditContent(selectedNote.content || '');
      setHasUnsavedChanges(false);
    }
  }, [selectedNote]);

  // Filter notes based on search query
  const filteredNotes = notes.filter(note => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content?.toLowerCase().includes(query) ||
      note.assets.some(a => 
        a.symbol.toLowerCase().includes(query) || 
        a.name?.toLowerCase().includes(query)
      )
    );
  });

  // Create a new note
  const handleCreateNote = async () => {
    setIsCreating(true);
    try {
      const newNote = await createResearchNote('Untitled Note', '');
      setSelectedNoteId(newNote.id);
      mutate();
      // Focus the title input after creation
      setTimeout(() => titleRef.current?.select(), 100);
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Save the current note
  const handleSaveNote = async () => {
    if (!selectedNoteId || !hasUnsavedChanges) return;
    
    setIsSaving(true);
    try {
      await updateResearchNote(selectedNoteId, {
        title: editTitle.trim() || 'Untitled Note',
        content: editContent,
      });
      setHasUnsavedChanges(false);
      mutate();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a note
  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
      await deleteResearchNote(noteId);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
      mutate();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (noteId: number, currentStatus: boolean) => {
    try {
      await toggleNoteFavorite(noteId, !currentStatus);
      mutate();
      mutateSelectedNote();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  // Add asset to note
  const handleAddAsset = async (assetId: number) => {
    if (!selectedNoteId) return;
    try {
      await addAssetToNote(selectedNoteId, assetId);
      mutateSelectedNote();
      mutate();
    } catch (error) {
      console.error('Failed to add asset:', error);
    }
  };

  // Remove asset from note
  const handleRemoveAsset = async (assetId: number) => {
    if (!selectedNoteId) return;
    try {
      await removeAssetFromNote(selectedNoteId, assetId);
      mutateSelectedNote();
      mutate();
    } catch (error) {
      console.error('Failed to remove asset:', error);
    }
  };

  // Auto-save on blur or after delay
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    
    const timer = setTimeout(() => {
      handleSaveNote();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [editTitle, editContent, hasUnsavedChanges]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveNote();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, hasUnsavedChanges, editTitle, editContent]);

  // Get existing asset IDs for the search dropdown
  const existingAssetIds = new Set(selectedNote?.assets.map(a => a.asset_id) || []);

  return (
    <DashboardLayout hideNavTabs>
      <div className="flex h-[calc(100vh-52px)]">
        {/* Sidebar - Note List */}
        <div className="w-80 border-r border-border flex flex-col bg-card/50">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Research Notes
              </h1>
              <button
                onClick={handleCreateNote}
                disabled={isCreating}
                className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? 'No notes found' : 'No notes yet'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={handleCreateNote}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Create your first note
                  </button>
                )}
              </div>
            ) : (
              <div className="py-2">
                {filteredNotes.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    isSelected={selectedNoteId === note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    onDelete={() => handleDeleteNote(note.id)}
                    onToggleFavorite={() => handleToggleFavorite(note.id, note.is_favorite)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Note Editor */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedNote ? (
            <>
              {/* Editor Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3 flex-1">
                  <input
                    ref={titleRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    onBlur={handleSaveNote}
                    placeholder="Note title..."
                    className="text-xl font-semibold bg-transparent border-none focus:outline-none flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges && (
                    <span className="text-xs text-muted-foreground">Unsaved changes</span>
                  )}
                  <button
                    onClick={handleSaveNote}
                    disabled={!hasUnsavedChanges || isSaving}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                      hasUnsavedChanges
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => handleToggleFavorite(selectedNote.id, selectedNote.is_favorite)}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      selectedNote.is_favorite
                        ? "text-yellow-500 bg-yellow-500/10"
                        : "text-muted-foreground hover:text-yellow-500 hover:bg-muted"
                    )}
                  >
                    <Star className={cn("w-4 h-4", selectedNote.is_favorite && "fill-current")} />
                  </button>
                </div>
              </div>

              {/* Linked Assets */}
              <div className="px-6 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link2 className="w-3.5 h-3.5" />
                    Linked Companies:
                  </div>
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    {selectedNote.assets.map((asset) => (
                      <AssetTag
                        key={asset.asset_id}
                        asset={asset}
                        onRemove={() => handleRemoveAsset(asset.asset_id)}
                      />
                    ))}
                    <AssetSearchDropdown
                      existingAssetIds={existingAssetIds}
                      onAddAsset={handleAddAsset}
                      placeholder="Add company..."
                    />
                  </div>
                </div>
              </div>

              {/* Content Editor */}
              <div className="flex-1 overflow-y-auto p-6">
                <textarea
                  ref={contentRef}
                  value={editContent}
                  onChange={(e) => {
                    setEditContent(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  onBlur={handleSaveNote}
                  placeholder="Write your notes here...

You can use this space to:
• Track companies you're researching
• List key points and observations
• Write conclusions and investment theses
• Compare companies in a sector"
                  className="w-full h-full min-h-[400px] bg-transparent border-none focus:outline-none resize-none text-sm leading-relaxed"
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-2 border-t border-border text-xs text-muted-foreground">
                Last updated: {formatNoteDateFull(selectedNote.updated_at)}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a note or create a new one</p>
                <button
                  onClick={handleCreateNote}
                  className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Note
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Note list item component
function NoteListItem({
  note,
  isSelected,
  onClick,
  onDelete,
  onToggleFavorite,
}: {
  note: ResearchNote;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 cursor-pointer transition-colors border-l-2 group",
        isSelected
          ? "bg-primary/10 border-l-primary"
          : "border-l-transparent hover:bg-muted/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {note.is_favorite && (
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
            )}
            <h3 className="font-medium text-sm truncate">{note.title}</h3>
          </div>
          {note.content && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {note.content}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground">
              {formatNoteDate(note.updated_at)}
            </span>
            {note.assets.length > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {note.assets.length} {note.assets.length === 1 ? 'company' : 'companies'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              "p-1 rounded transition-colors",
              note.is_favorite
                ? "text-yellow-500"
                : "text-muted-foreground hover:text-yellow-500"
            )}
          >
            <Star className={cn("w-3.5 h-3.5", note.is_favorite && "fill-current")} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Asset tag component
function AssetTag({
  asset,
  onRemove,
}: {
  asset: ResearchNoteAsset;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs group">
      <span
        className={cn(
          "text-[9px] px-1 py-0.5 rounded font-medium",
          asset.asset_type === "crypto"
            ? "text-orange-400 bg-orange-400/10"
            : "text-blue-400 bg-blue-400/10"
        )}
      >
        {asset.asset_type === "crypto" ? "C" : "E"}
      </span>
      <span className="font-mono font-medium">{asset.symbol}</span>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

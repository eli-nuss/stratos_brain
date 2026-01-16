import { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Star, Trash2, Search, X, 
  Loader2, Save, Building2, List, StickyNote, ChevronLeft
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useNotepad } from '@/contexts/NoteContext';
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
  getContextTypeLabel,
  ResearchNote,
  ResearchNoteAsset,
  NoteContextType
} from '@/hooks/useResearchNotes';
import AssetSearchDropdown from '@/components/AssetSearchDropdown';
import { cn } from '@/lib/utils';

// Context type filter options
const contextFilters: { value: NoteContextType | 'all'; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Notes', shortLabel: 'All', icon: <StickyNote className="w-3.5 h-3.5" /> },
  { value: 'general', label: 'General', shortLabel: 'Gen', icon: <FileText className="w-3.5 h-3.5" /> },
  { value: 'asset', label: 'Assets', shortLabel: 'Asset', icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: 'stock_list', label: 'Lists', shortLabel: 'List', icon: <List className="w-3.5 h-3.5" /> },
];

export default function ResearchNotes() {
  const { user } = useAuth();
  const { openNotepad } = useNotepad();
  const { notes, isLoading, mutate } = useResearchNotes();
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextFilter, setContextFilter] = useState<NoteContextType | 'all'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showMobileEditor, setShowMobileEditor] = useState(false);
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

  // Filter notes based on search query and context filter
  const filteredNotes = notes.filter(note => {
    // Context filter
    if (contextFilter !== 'all' && note.context_type !== contextFilter) {
      return false;
    }
    
    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content?.toLowerCase().includes(query) ||
      note.context_name?.toLowerCase().includes(query) ||
      note.assets?.some(a => 
        a.symbol.toLowerCase().includes(query) || 
        a.name?.toLowerCase().includes(query)
      )
    );
  });

  // Create a new note
  const handleCreateNote = async () => {
    if (!user?.id) return;
    
    setIsCreating(true);
    try {
      const newNote = await createResearchNote(user.id, 'Untitled Note', '', false, 'general');
      setSelectedNoteId(newNote.id);
      setShowMobileEditor(true);
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
        setShowMobileEditor(false);
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

  // Handle note selection (with mobile navigation)
  const handleSelectNote = (noteId: number) => {
    setSelectedNoteId(noteId);
    setShowMobileEditor(true);
  };

  // Handle back button on mobile
  const handleMobileBack = () => {
    if (hasUnsavedChanges) {
      handleSaveNote();
    }
    setShowMobileEditor(false);
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
  const existingAssetIds = new Set(selectedNote?.assets?.map(a => a.asset_id) || []);

  // If user is not logged in, show login prompt
  if (!user) {
    return (
      <DashboardLayout hideNavTabs>
        <div className="flex items-center justify-center h-[calc(100vh-52px)]">
          <div className="text-center px-4">
            <StickyNote className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-lg font-semibold mb-2">Sign in to view your notes</h2>
            <p className="text-sm text-muted-foreground">
              Notes are personal and require authentication.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout hideNavTabs>
      <div className="flex h-[calc(100vh-52px)]">
        {/* Sidebar - Note List */}
        <div className={cn(
          "flex flex-col bg-card/50 border-r border-border",
          // Mobile: full width when editor is hidden, hidden when editor is shown
          "w-full md:w-80",
          showMobileEditor && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-primary" />
                Notes Library
              </h1>
              <button
                onClick={handleCreateNote}
                disabled={isCreating}
                className="p-2 sm:p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2.5 sm:py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Context Filter */}
            <div className="flex gap-1 flex-wrap">
              {contextFilters.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setContextFilter(filter.value)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1.5 sm:py-1 text-xs rounded-md transition-colors min-h-[36px] sm:min-h-0",
                    contextFilter === filter.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter.icon}
                  <span className="hidden sm:inline">{filter.label}</span>
                  <span className="sm:hidden">{filter.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-4">
                <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchQuery || contextFilter !== 'all' ? 'No notes found' : 'No notes yet'}
                </p>
                {!searchQuery && contextFilter === 'all' && (
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
                    onClick={() => handleSelectNote(note.id)}
                    onDelete={() => handleDeleteNote(note.id)}
                    onToggleFavorite={() => handleToggleFavorite(note.id, note.is_favorite)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {notes.length} total notes • {notes.filter(n => n.is_favorite).length} favorites
          </div>
        </div>

        {/* Main Content - Note Editor */}
        <div className={cn(
          "flex-1 flex flex-col bg-background",
          // Mobile: full width when shown, hidden when list is shown
          !showMobileEditor && "hidden md:flex"
        )}>
          {selectedNote ? (
            <>
              {/* Editor Header */}
              <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border gap-2">
                {/* Mobile back button */}
                <button
                  onClick={handleMobileBack}
                  className="md:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
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
                    className="text-base sm:text-xl font-semibold bg-transparent border-none focus:outline-none flex-1 min-w-0"
                  />
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {/* Context badge - hidden on mobile */}
                  <span className={cn(
                    "hidden sm:flex items-center gap-1 px-2 py-1 text-xs rounded-md",
                    selectedNote.context_type === 'asset' ? "bg-blue-500/10 text-blue-500" :
                    selectedNote.context_type === 'stock_list' ? "bg-purple-500/10 text-purple-500" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {selectedNote.context_type === 'asset' ? <Building2 className="w-3 h-3" /> :
                     selectedNote.context_type === 'stock_list' ? <List className="w-3 h-3" /> :
                     <FileText className="w-3 h-3" />}
                    {selectedNote.context_name || getContextTypeLabel(selectedNote.context_type)}
                  </span>
                  
                  {/* Unsaved indicator - hidden on mobile */}
                  {hasUnsavedChanges && (
                    <span className="hidden sm:inline text-xs text-muted-foreground">Unsaved</span>
                  )}
                  
                  {/* Save button */}
                  <button
                    onClick={handleSaveNote}
                    disabled={!hasUnsavedChanges || isSaving}
                    className={cn(
                      "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs rounded-md transition-colors min-h-[36px]",
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
                    <span className="hidden sm:inline">Save</span>
                  </button>
                  
                  {/* Favorite button */}
                  <button
                    onClick={() => handleToggleFavorite(selectedNote.id, selectedNote.is_favorite)}
                    className={cn(
                      "p-2 sm:p-1.5 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center",
                      selectedNote.is_favorite
                        ? "text-yellow-500 bg-yellow-500/10"
                        : "text-muted-foreground hover:text-yellow-500 hover:bg-muted"
                    )}
                  >
                    <Star className={cn("w-4 h-4", selectedNote.is_favorite && "fill-current")} />
                  </button>
                </div>
              </div>

              {/* Mobile context badge */}
              <div className="sm:hidden px-3 py-2 border-b border-border">
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md",
                  selectedNote.context_type === 'asset' ? "bg-blue-500/10 text-blue-500" :
                  selectedNote.context_type === 'stock_list' ? "bg-purple-500/10 text-purple-500" :
                  "bg-muted text-muted-foreground"
                )}>
                  {selectedNote.context_type === 'asset' ? <Building2 className="w-3 h-3" /> :
                   selectedNote.context_type === 'stock_list' ? <List className="w-3 h-3" /> :
                   <FileText className="w-3 h-3" />}
                  {selectedNote.context_name || getContextTypeLabel(selectedNote.context_type)}
                </span>
              </div>

              {/* Linked Assets (only show for general notes) */}
              {selectedNote.context_type === 'general' && (
                <div className="px-3 sm:px-6 py-3 border-b border-border bg-muted/30">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                      Linked Companies:
                    </div>
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      {selectedNote.assets?.map((asset) => (
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
              )}

              {/* Content Editor */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
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
                  className="w-full h-full min-h-[300px] sm:min-h-[400px] bg-transparent border-none focus:outline-none resize-none text-sm leading-relaxed"
                />
              </div>

              {/* Footer */}
              <div className="px-3 sm:px-6 py-2 border-t border-border text-xs text-muted-foreground">
                Last updated: {formatNoteDateFull(selectedNote.updated_at)}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center px-4">
                <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
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
        "px-3 sm:px-4 py-3 cursor-pointer transition-colors border-l-2 group active:bg-muted/70",
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
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              {formatNoteDate(note.updated_at)}
            </span>
            {/* Context indicator */}
            <span className={cn(
              "flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded",
              note.context_type === 'asset' ? "bg-blue-500/10 text-blue-500" :
              note.context_type === 'stock_list' ? "bg-purple-500/10 text-purple-500" :
              "bg-muted text-muted-foreground"
            )}>
              {note.context_type === 'asset' ? <Building2 className="w-2.5 h-2.5" /> :
               note.context_type === 'stock_list' ? <List className="w-2.5 h-2.5" /> :
               <FileText className="w-2.5 h-2.5" />}
              <span className="hidden sm:inline">{note.context_name || getContextTypeLabel(note.context_type)}</span>
            </span>
          </div>
        </div>
        {/* Actions - always visible on mobile, hover on desktop */}
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className={cn(
              "p-2 sm:p-1 rounded transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center",
              note.is_favorite
                ? "text-yellow-500"
                : "text-muted-foreground hover:text-yellow-500"
            )}
          >
            <Star className={cn("w-4 h-4 sm:w-3.5 sm:h-3.5", note.is_favorite && "fill-current")} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 sm:p-1 rounded text-muted-foreground hover:text-destructive transition-colors min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
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
    <span className="inline-flex items-center gap-1 px-2 py-1.5 sm:py-1 bg-muted rounded-md text-xs group">
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
        className="ml-1 text-muted-foreground hover:text-destructive transition-all p-1 -mr-1"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

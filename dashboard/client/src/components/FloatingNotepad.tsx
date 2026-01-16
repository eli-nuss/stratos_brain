import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  StickyNote, X, Star, Loader2, Maximize2, Minimize2,
  FileText, Building2, List, ExternalLink, Check
} from 'lucide-react';
import { useNotepad } from '@/contexts/NoteContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useContextNote, 
  updateResearchNote, 
  toggleNoteFavorite,
  formatNoteDateFull,
  NoteContextType
} from '@/hooks/useResearchNotes';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

// Get icon for context type
function ContextIcon({ type, className }: { type: NoteContextType; className?: string }) {
  switch (type) {
    case 'asset':
      return <Building2 className={className} />;
    case 'stock_list':
      return <List className={className} />;
    case 'general':
    default:
      return <FileText className={className} />;
  }
}

// Get label for context type
function getContextLabel(type: NoteContextType, name?: string): string {
  if (name) return name;
  switch (type) {
    case 'asset': return 'Asset Notes';
    case 'stock_list': return 'List Notes';
    case 'general': return 'General Notes';
    default: return 'Notes';
  }
}

// Get context color
function getContextColor(type: NoteContextType): string {
  switch (type) {
    case 'asset': return 'text-blue-400';
    case 'stock_list': return 'text-violet-400';
    case 'general':
    default: return 'text-amber-400';
  }
}

export default function FloatingNotepad() {
  const { isOpen, currentContext, closeNotepad, openNotepad } = useNotepad();
  const { user } = useAuth();
  const { note, isLoading, mutate } = useContextNote(isOpen ? currentContext : null);
  
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Update local state when note changes
  useEffect(() => {
    if (note) {
      setEditTitle(note.title);
      setEditContent(note.content || '');
      setHasUnsavedChanges(false);
    }
  }, [note?.id, note?.title, note?.content]);

  // Initialize position on mount - taller panel
  useEffect(() => {
    setPosition({
      x: window.innerWidth - 440,
      y: window.innerHeight - 620
    });
  }, []);

  // Save note
  const handleSave = async () => {
    if (!note || !hasUnsavedChanges) return;
    
    setIsSaving(true);
    try {
      await updateResearchNote(note.id, {
        title: editTitle.trim() || 'Untitled Note',
        content: editContent,
      });
      setHasUnsavedChanges(false);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
      mutate();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save after delay
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    
    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [editContent, editTitle, hasUnsavedChanges]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && isOpen) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape' && isOpen) {
        closeNotepad();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasUnsavedChanges, editTitle, editContent, note]);

  // Toggle favorite
  const handleToggleFavorite = async () => {
    if (!note) return;
    try {
      await toggleNoteFavorite(note.id, !note.is_favorite);
      mutate();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;
    
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 420, dragRef.current.initialX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.initialY + deltaY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Don't render if user is not logged in
  if (!user) return null;

  const contextColor = getContextColor(currentContext?.type || 'general');

  // Floating button (always visible) - positioned to the left of the feedback button
  const floatingButton = (
    <button
      onClick={() => openNotepad(currentContext || { type: 'general' })}
      className={cn(
        "fixed bottom-6 right-20 z-50 p-3 rounded-full shadow-lg transition-all",
        "bg-amber-500 text-white hover:bg-amber-600",
        "hover:scale-105 active:scale-95",
        isOpen && "hidden"
      )}
      title="Open Notepad"
    >
      <StickyNote className="w-5 h-5" />
    </button>
  );

  // Notepad panel - Elegant Agenda/Ulysses inspired design
  const notepadPanel = isOpen && (
    <div
      style={{
        position: 'fixed',
        left: isExpanded ? 0 : position.x,
        top: isExpanded ? 0 : position.y,
        width: isExpanded ? '100%' : 420,
        height: isExpanded ? '100%' : 580,
        zIndex: 9999,
      }}
      className={cn(
        "flex flex-col overflow-hidden",
        "bg-zinc-900/95 backdrop-blur-xl",
        "border border-zinc-700/50",
        "shadow-2xl shadow-black/50",
        isExpanded ? "rounded-none" : "rounded-2xl",
        isDragging && "cursor-grabbing"
      )}
    >
      {/* Header - Minimal and elegant */}
      <div 
        className="flex items-center justify-between px-5 py-4 cursor-grab select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn("p-2 rounded-lg bg-zinc-800/80", contextColor)}>
            <ContextIcon type={currentContext?.type || 'general'} className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">
              {getContextLabel(currentContext?.type || 'general', currentContext?.name)}
            </h3>
            <p className="text-[11px] text-zinc-500">
              {note?.updated_at ? `Last edited ${formatNoteDateFull(note.updated_at)}` : 'New note'}
            </p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {(hasUnsavedChanges || isSaving || showSaved) && (
            <span className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
              isSaving ? "bg-amber-500/20 text-amber-400" :
              showSaved ? "bg-emerald-500/20 text-emerald-400" :
              "bg-zinc-700/50 text-zinc-400"
            )}>
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </>
              ) : showSaved ? (
                <>
                  <Check className="w-3 h-3" />
                  Saved
                </>
              ) : (
                "Editing"
              )}
            </span>
          )}
        </div>
      </div>

      {/* Toolbar - Subtle divider */}
      <div className="flex items-center justify-between px-5 py-2 border-y border-zinc-800/80">
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleFavorite}
            className={cn(
              "p-2 rounded-lg transition-all",
              note?.is_favorite
                ? "text-amber-400 bg-amber-500/15 hover:bg-amber-500/25"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
            )}
            title={note?.is_favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={cn("w-4 h-4", note?.is_favorite && "fill-current")} />
          </button>
          <Link href="/notes">
            <a 
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-all"
              title="View all notes"
              onClick={closeNotepad}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-all"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={closeNotepad}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition-all"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            <span className="text-sm text-zinc-500">Loading note...</span>
          </div>
        </div>
      ) : note ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Title Input - Large and prominent */}
          <div className="px-5 pt-5 pb-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Note title..."
              className={cn(
                "w-full text-xl font-semibold tracking-tight",
                "bg-transparent border-none focus:outline-none",
                "text-zinc-100 placeholder:text-zinc-600",
                "selection:bg-amber-500/30"
              )}
            />
          </div>

          {/* Editor - Clean writing area */}
          <div className="flex-1 overflow-hidden px-5 pb-5">
            <textarea
              ref={contentRef}
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Start writing..."
              className={cn(
                "w-full h-full",
                "bg-transparent border-none focus:outline-none resize-none",
                "text-[15px] leading-[1.8] tracking-wide",
                "text-zinc-300 placeholder:text-zinc-600",
                "selection:bg-amber-500/30",
                // Custom scrollbar
                "scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
              )}
              style={{
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <StickyNote className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
            <p className="text-sm text-zinc-500">Unable to load note</p>
          </div>
        </div>
      )}

      {/* Footer - Keyboard hint */}
      <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/50">
        <div className="flex items-center justify-between text-[11px] text-zinc-600">
          <span>
            Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">⌘S</kbd> to save
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 font-mono">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {floatingButton}
      {notepadPanel}
    </>,
    document.body
  );
}

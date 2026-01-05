import { useState, useRef, useEffect } from 'react';
import { StickyNote, Pencil, Check, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAssetNotes, createNote, updateNote, formatNoteDateFull } from '@/hooks/useAssetNotes';

interface NoteCellProps {
  assetId: number;
  onClick?: (e: React.MouseEvent) => void;
}

export function NoteCell({ assetId, onClick }: NoteCellProps) {
  const { latestNote, isLoading, mutate } = useAssetNotes(assetId);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(latestNote?.note_text || '');
    setIsEditing(true);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditText('');
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editText.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      if (latestNote) {
        await updateNote(latestNote.note_id, editText, assetId);
      } else {
        await createNote(assetId, editText);
      }
      await mutate();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText('');
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave(e as any);
    }
  };

  if (isLoading) {
    return (
      <td className="px-2 py-2 text-center" onClick={onClick}>
        <div className="h-4 w-16 bg-muted/30 rounded animate-pulse" />
      </td>
    );
  }

  if (isEditing) {
    return (
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <textarea
            ref={inputRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add note..."
            className="w-32 h-16 text-xs bg-background border border-primary/50 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isSaving}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="p-1 hover:bg-primary/20 rounded text-primary disabled:opacity-50"
              title="Save (Enter)"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="p-1 hover:bg-muted rounded text-muted-foreground"
              title="Cancel (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </td>
    );
  }

  if (!latestNote) {
    return (
      <td className="px-2 py-2 text-center" onClick={onClick}>
        <button
          onClick={handleStartEdit}
          className="p-1 hover:bg-muted rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Add note"
        >
          <StickyNote className="w-3.5 h-3.5" />
        </button>
      </td>
    );
  }

  // Truncate note text for display
  const displayText = latestNote.note_text.length > 30
    ? latestNote.note_text.substring(0, 30) + '...'
    : latestNote.note_text;

  return (
    <td className="px-2 py-2" onClick={onClick}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className="flex items-center gap-1 group cursor-pointer max-w-[140px]"
            onClick={handleStartEdit}
          >
            <StickyNote className="w-3 h-3 text-yellow-500/70 flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
              {displayText}
            </span>
            <Pencil className="w-2.5 h-2.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="text-sm whitespace-pre-wrap">{latestNote.note_text}</p>
            <p className="text-[10px] text-muted-foreground">
              Updated: {formatNoteDateFull(latestNote.updated_at)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </td>
  );
}

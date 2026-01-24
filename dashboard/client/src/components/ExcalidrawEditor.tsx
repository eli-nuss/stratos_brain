import { useState, useCallback, useRef, Suspense, lazy } from 'react';
import { X, Save, FileJson, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Diagram, ExcalidrawScene } from '@/hooks/useDiagrams';

// ✅ OFFICIAL FIX: Lazy load Excalidraw to prevent React 18 Strict Mode crashes
const Excalidraw = lazy(() => 
  import('@excalidraw/excalidraw').then(module => ({ default: module.Excalidraw }))
);

interface ExcalidrawEditorProps {
  isOpen: boolean;
  diagram: Diagram | null;
  onClose: () => void;
  onSave: (diagramId: string, data: ExcalidrawScene) => Promise<void>;
  onExportPng: (diagramId: string) => Promise<void>;
  onExportJson: (diagramId: string) => Promise<void>;
}

export function ExcalidrawEditor({
  isOpen,
  diagram,
  onClose,
  onSave,
  onExportPng,
  onExportJson,
}: ExcalidrawEditorProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const excalidrawAPIRef = useRef<any>(null);

  const handleSave = useCallback(async () => {
    if (!diagram || !excalidrawAPIRef.current) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const elements = excalidrawAPIRef.current.getSceneElements();
      const appState = excalidrawAPIRef.current.getAppState();
      const files = excalidrawAPIRef.current.getFiles();

      const sceneData: ExcalidrawScene = {
        type: 'excalidraw',
        version: 2,
        source: 'stratos-brain',
        elements: elements as any[],
        appState: {
          viewBackgroundColor: appState?.viewBackgroundColor || '#1e1e1e',
          gridSize: appState?.gridSize || null,
        },
        files: files,
      };

      await onSave(diagram.diagram_id, sceneData);
      setHasChanges(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save diagram:', error);
      setSaveStatus('idle');
    } finally {
      setIsSaving(false);
    }
  }, [diagram, onSave]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col">
      {/* TOOLBAR */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <span className="text-sm font-medium text-white">
              {diagram?.name || 'Untitled Diagram'}
            </span>
            {diagram?.is_ai_generated && (
              <span className="ml-2 text-[10px] text-purple-400">AI Generated</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Status */}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
          {hasChanges && saveStatus === 'idle' && (
            <span className="text-xs text-amber-400">Unsaved changes</span>
          )}

          {/* Export Buttons */}
          <button
            onClick={() => diagram && onExportPng(diagram.diagram_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            PNG
          </button>
          <button
            onClick={() => diagram && onExportJson(diagram.diagram_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded transition-colors",
              hasChanges
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </button>
        </div>
      </div>

      {/* CANVAS CONTAINER - Explicit height is strictly required for Excalidraw */}
      <div className="flex-1 relative bg-[#121212]" style={{ height: 'calc(100vh - 48px)', width: '100%' }}>
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          }
        >
          <Excalidraw
            excalidrawAPI={(api: any) => {
              excalidrawAPIRef.current = api;
            }}
            initialData={{
              elements: diagram?.excalidraw_data?.elements || [],
              appState: {
                viewBackgroundColor: '#121212',
                theme: 'dark',
                gridSize: 20,
              },
              scrollToContent: true,
            }}
            onChange={() => setHasChanges(true)}
            theme="dark"
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveToActiveFile: false,
              },
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default ExcalidrawEditor;

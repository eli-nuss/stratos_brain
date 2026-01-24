import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { Diagram, ExcalidrawScene } from '@/hooks/useDiagrams';

interface ExcalidrawEditorProps {
  isOpen: boolean;
  diagram: Diagram | null;
  onClose: () => void;
  onSave: (diagramId: string, data: ExcalidrawScene) => Promise<void>;
  onExportPng: (diagramId: string) => Promise<void>;
  onExportJson: (diagramId: string) => Promise<void>;
}

export function ExcalidrawEditor({
  isOpen, diagram, onClose, onSave, onExportPng, onExportJson
}: ExcalidrawEditorProps) {
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const excalidrawAPIRef = useRef<any>(null);

  // Dynamically import Excalidraw only when modal opens
  useEffect(() => {
    if (isOpen && !ExcalidrawComponent) {
      setIsLoading(true);
      setLoadError(null);
      
      import('@excalidraw/excalidraw')
        .then((module) => {
          setExcalidrawComponent(() => module.Excalidraw);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load Excalidraw:', err);
          setLoadError('Failed to load diagram editor');
          setIsLoading(false);
        });
    }
  }, [isOpen, ExcalidrawComponent]);

  const handleSave = useCallback(async () => {
    if (!diagram || !excalidrawAPIRef.current) return;
    
    try {
      const elements = excalidrawAPIRef.current.getSceneElements();
      const appState = excalidrawAPIRef.current.getAppState();
      const files = excalidrawAPIRef.current.getFiles();
      
      await onSave(diagram.diagram_id, {
        type: 'excalidraw',
        version: 2,
        source: 'stratos-brain',
        elements,
        appState: { viewBackgroundColor: appState?.viewBackgroundColor || '#121212' },
        files
      });
      alert("Diagram saved!");
    } catch (err) {
      console.error('Save failed:', err);
      alert("Failed to save diagram");
    }
  }, [diagram, onSave]);

  // Keyboard shortcut for save
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSave, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        zIndex: 9999,
        backgroundColor: '#121212'
      }}
    >
      {/* Minimal floating toolbar */}
      <div 
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10000,
          display: 'flex',
          gap: '8px',
          padding: '8px',
          backgroundColor: 'rgba(30, 30, 30, 0.9)',
          borderRadius: '8px',
          border: '1px solid #333'
        }}
      >
        <button
          onClick={handleSave}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          💾 Save
        </button>
        <button
          onClick={() => diagram && onExportJson(diagram.diagram_id)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#374151',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          📄 JSON
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Excalidraw Canvas */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
      ) : loadError ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444' }}>
          {loadError}
        </div>
      ) : ExcalidrawComponent ? (
        <ExcalidrawComponent
          excalidrawAPI={(api: any) => { excalidrawAPIRef.current = api; }}
          initialData={{
            elements: diagram?.excalidraw_data?.elements || [],
            appState: { 
              viewBackgroundColor: '#121212', 
              theme: 'dark',
              currentItemFontFamily: 1
            },
            scrollToContent: true,
          }}
          theme="dark"
          UIOptions={{
            canvasActions: {
              loadScene: true,
              export: { saveFileToDisk: true },
              saveToActiveFile: false,
            },
          }}
        />
      ) : null}
    </div>
  );
}

export default ExcalidrawEditor;

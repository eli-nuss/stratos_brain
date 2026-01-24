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
  const [ExcalidrawModule, setExcalidrawModule] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const excalidrawAPIRef = useRef<any>(null);

  // Dynamically import Excalidraw only when modal opens
  useEffect(() => {
    if (isOpen && !ExcalidrawModule) {
      setIsLoading(true);
      setLoadError(null);
      
      import('@excalidraw/excalidraw')
        .then((module) => {
          setExcalidrawModule(module);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load Excalidraw:', err);
          setLoadError('Failed to load diagram editor: ' + err.message);
          setIsLoading(false);
        });
    }
  }, [isOpen, ExcalidrawModule]);

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
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSave]);

  if (!isOpen) return null;

  // Get components from module
  const Excalidraw = ExcalidrawModule?.Excalidraw;
  const MainMenu = ExcalidrawModule?.MainMenu;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      width: '100vw', 
      height: '100vh', 
      zIndex: 9999,
      backgroundColor: '#121212'
    }}>
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
      ) : loadError ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444', gap: '16px' }}>
          <p>{loadError}</p>
          <button 
            onClick={onClose}
            style={{ padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      ) : Excalidraw ? (
        <Excalidraw
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
        >
          {/* Custom MainMenu with our actions - this is the correct API per Excalidraw docs */}
          {MainMenu && (
            <MainMenu>
              <MainMenu.DefaultItems.LoadScene />
              <MainMenu.DefaultItems.Export />
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.Separator />
              <MainMenu.Item onSelect={handleSave}>
                💾 Save to Stratos Brain
              </MainMenu.Item>
              <MainMenu.Item onSelect={() => diagram && onExportJson(diagram.diagram_id)}>
                📄 Export as JSON
              </MainMenu.Item>
              <MainMenu.Separator />
              <MainMenu.Item onSelect={onClose}>
                ❌ Close & Return to Chat
              </MainMenu.Item>
            </MainMenu>
          )}
        </Excalidraw>
      ) : null}
    </div>
  );
}

export default ExcalidrawEditor;

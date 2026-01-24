import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { Diagram, ExcalidrawScene } from '@/hooks/useDiagrams';

// CRITICAL: Import Excalidraw CSS - required for proper rendering
import '@excalidraw/excalidraw/index.css';

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
  const [convertedElements, setConvertedElements] = useState<any[]>([]);
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

  // Convert skeleton elements to full Excalidraw elements when diagram or module changes
  useEffect(() => {
    if (!ExcalidrawModule || !diagram?.excalidraw_data?.elements) {
      setConvertedElements([]);
      return;
    }

    const rawElements = diagram.excalidraw_data.elements;
    
    // Check if elements need conversion (have 'label' property = skeleton format)
    const needsConversion = rawElements.some((el: any) => el.label !== undefined);
    
    if (needsConversion && ExcalidrawModule.convertToExcalidrawElements) {
      try {
        console.log('Converting skeleton elements to Excalidraw format...');
        const converted = ExcalidrawModule.convertToExcalidrawElements(rawElements);
        console.log('Converted', rawElements.length, 'skeleton elements to', converted.length, 'Excalidraw elements');
        setConvertedElements(converted);
      } catch (err) {
        console.error('Failed to convert elements:', err);
        // Fall back to raw elements
        setConvertedElements(rawElements);
      }
    } else {
      // Elements are already in full format
      setConvertedElements(rawElements);
    }
  }, [ExcalidrawModule, diagram]);

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

  // Keyboard shortcut for save and close
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

  // Get components from module
  const Excalidraw = ExcalidrawModule?.Excalidraw;
  const MainMenu = ExcalidrawModule?.MainMenu;

  // Check if we're still converting elements
  const isConverting = ExcalidrawModule && diagram?.excalidraw_data?.elements?.length > 0 && convertedElements.length === 0;

  return (
    // Fixed fullscreen container
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#121212',
        overflow: 'hidden'
      }}
    >
      {(isLoading || isConverting) ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            {isConverting ? 'Converting diagram elements...' : 'Loading editor...'}
          </span>
        </div>
      ) : loadError ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ef4444', gap: '16px' }}>
          <p>{loadError}</p>
          <button 
            onClick={onClose}
            style={{ padding: '8px 16px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      ) : Excalidraw ? (
        // CRITICAL: Container MUST have explicit height for Excalidraw to render
        <div style={{ height: '100vh', width: '100vw' }}>
          <Excalidraw
            excalidrawAPI={(api: any) => { excalidrawAPIRef.current = api; }}
            initialData={{
              elements: convertedElements,
              appState: { 
                viewBackgroundColor: diagram?.excalidraw_data?.appState?.viewBackgroundColor || '#121212', 
                theme: 'dark',
              },
              scrollToContent: true,
            }}
            theme="dark"
          >
            {/* Custom MainMenu with our actions */}
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
        </div>
      ) : null}
    </div>
  );
}

export default ExcalidrawEditor;

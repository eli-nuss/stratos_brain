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
  const [convertedElements, setConvertedElements] = useState<any[] | null>(null);
  const [elementsReady, setElementsReady] = useState(false);
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
    if (!ExcalidrawModule || !diagram) {
      setConvertedElements(null);
      setElementsReady(false);
      return;
    }

    const rawElements = diagram.excalidraw_data?.elements || [];
    
    // If no elements, we're ready with empty array
    if (rawElements.length === 0) {
      console.log('[ExcalidrawEditor] No elements to convert, using empty array');
      setConvertedElements([]);
      setElementsReady(true);
      return;
    }
    
    // Check if elements need conversion (have 'label' property = skeleton format)
    const needsConversion = rawElements.some((el: any) => el.label !== undefined);
    
    if (needsConversion && ExcalidrawModule.convertToExcalidrawElements) {
      try {
        console.log('[ExcalidrawEditor] Converting skeleton elements to Excalidraw format...');
        console.log('[ExcalidrawEditor] Raw elements:', rawElements);
        const converted = ExcalidrawModule.convertToExcalidrawElements(rawElements);
        console.log('[ExcalidrawEditor] Converted', rawElements.length, 'skeleton elements to', converted.length, 'Excalidraw elements');
        console.log('[ExcalidrawEditor] Converted elements:', converted);
        setConvertedElements(converted);
        setElementsReady(true);
      } catch (err) {
        console.error('[ExcalidrawEditor] Failed to convert elements:', err);
        // Fall back to raw elements
        setConvertedElements(rawElements);
        setElementsReady(true);
      }
    } else {
      // Elements are already in full format
      console.log('[ExcalidrawEditor] Elements already in full format, using as-is');
      setConvertedElements(rawElements);
      setElementsReady(true);
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

  // Determine if we're still loading/converting
  const isProcessing = isLoading || !elementsReady;

  // Create a unique key based on diagram ID and element count to force remount when data changes
  const excalidrawKey = diagram ? `${diagram.diagram_id}-${convertedElements?.length || 0}` : 'empty';

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
      {isProcessing ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            {isLoading ? 'Loading editor...' : 'Preparing diagram...'}
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
      ) : Excalidraw && elementsReady ? (
        // CRITICAL: Container MUST have explicit height for Excalidraw to render
        // Key forces remount when diagram changes
        <div style={{ height: '100vh', width: '100vw' }} key={excalidrawKey}>
          <Excalidraw
            excalidrawAPI={(api: any) => { excalidrawAPIRef.current = api; }}
            initialData={{
              elements: convertedElements || [],
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

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Save, Download, FileJson, Image as ImageIcon,
  Loader2, Check, Undo2, Redo2, ZoomIn, ZoomOut, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Diagram, ExcalidrawScene } from '@/hooks/useDiagrams';

// ============ TYPES ============

interface ExcalidrawEditorProps {
  isOpen: boolean;
  diagram: Diagram | null;
  onClose: () => void;
  onSave: (diagramId: string, data: ExcalidrawScene) => Promise<void>;
  onExportPng: (diagramId: string) => Promise<void>;
  onExportJson: (diagramId: string) => Promise<void>;
}

// Excalidraw types (simplified for our use)
interface ExcalidrawAPI {
  updateScene: (scene: { elements?: unknown[]; appState?: unknown }) => void;
  getSceneElements: () => unknown[];
  getAppState: () => unknown;
  getFiles: () => Record<string, unknown>;
  resetScene: () => void;
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  exportToBlob: (opts: { mimeType: string; quality?: number }) => Promise<Blob>;
  scrollToContent: () => void;
}

// ============ ELEMENT CONVERSION ============

// Convert our simplified element format to full Excalidraw elements
function convertToExcalidrawElements(elements: unknown[]): unknown[] {
  if (!Array.isArray(elements)) return [];
  
  return elements.map((el: any, index: number) => {
    // Generate a unique ID if not provided
    const id = el.id || `element-${index}-${Date.now()}`;
    
    // Base properties all elements need
    const baseProps = {
      id,
      x: el.x || 0,
      y: el.y || 0,
      width: el.width || 100,
      height: el.height || 100,
      angle: el.angle || 0,
      strokeColor: el.strokeColor || '#000000',
      backgroundColor: el.backgroundColor || 'transparent',
      fillStyle: el.fillStyle || 'solid',
      strokeWidth: el.strokeWidth || 2,
      strokeStyle: el.strokeStyle || 'solid',
      roughness: el.roughness ?? 1,
      opacity: el.opacity ?? 100,
      groupIds: el.groupIds || [],
      frameId: el.frameId || null,
      roundness: el.roundness || null,
      seed: el.seed || Math.floor(Math.random() * 1000000),
      version: el.version || 1,
      versionNonce: el.versionNonce || Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: el.boundElements || null,
      updated: Date.now(),
      link: el.link || null,
      locked: el.locked || false,
    };

    switch (el.type) {
      case 'rectangle':
      case 'ellipse':
      case 'diamond':
        return {
          ...baseProps,
          type: el.type,
          // Handle label (text inside shape)
          ...(el.label && {
            boundElements: [
              {
                id: `${id}-label`,
                type: 'text',
              },
            ],
          }),
        };

      case 'text':
        return {
          ...baseProps,
          type: 'text',
          text: el.text || '',
          fontSize: el.fontSize || 20,
          fontFamily: el.fontFamily || 1, // 1 = Hand-drawn, 2 = Normal, 3 = Code
          textAlign: el.textAlign || 'center',
          verticalAlign: el.verticalAlign || 'middle',
          containerId: el.containerId || null,
          originalText: el.text || '',
          lineHeight: el.lineHeight || 1.25,
          baseline: el.baseline || 18,
        };

      case 'arrow':
      case 'line':
        return {
          ...baseProps,
          type: el.type,
          points: el.points || [[0, 0], [el.width || 100, el.height || 0]],
          lastCommittedPoint: null,
          startBinding: el.start?.id ? { elementId: el.start.id, focus: 0, gap: 1 } : null,
          endBinding: el.end?.id ? { elementId: el.end.id, focus: 0, gap: 1 } : null,
          startArrowhead: el.startArrowhead || null,
          endArrowhead: el.type === 'arrow' ? (el.endArrowhead || 'triangle') : null,
        };

      default:
        return {
          ...baseProps,
          type: el.type || 'rectangle',
        };
    }
  });
}

// Process elements with labels - create separate text elements for labels
function processElementsWithLabels(elements: unknown[]): unknown[] {
  if (!Array.isArray(elements)) return [];
  
  const result: unknown[] = [];
  
  elements.forEach((el: any, index: number) => {
    const id = el.id || `element-${index}-${Date.now()}`;
    
    // Add the main element
    result.push(el);
    
    // If element has a label, create a text element for it
    if (el.label && (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond')) {
      const labelId = `${id}-label`;
      const labelText = {
        type: 'text',
        id: labelId,
        x: (el.x || 0) + (el.width || 100) / 2,
        y: (el.y || 0) + (el.height || 100) / 2,
        text: el.label.text || '',
        fontSize: el.label.fontSize || 16,
        strokeColor: el.label.strokeColor || '#000000',
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: id,
      };
      result.push(labelText);
    }
    
    // If arrow has a label, create a text element for it
    if (el.label && (el.type === 'arrow' || el.type === 'line')) {
      const labelId = `${id}-arrow-label`;
      const labelText = {
        type: 'text',
        id: labelId,
        x: (el.x || 0) + (el.width || 100) / 2,
        y: (el.y || 0) + (el.height || 0) / 2 - 10,
        text: el.label.text || '',
        fontSize: el.label.fontSize || 14,
        strokeColor: el.label.strokeColor || '#000000',
        textAlign: 'center',
        verticalAlign: 'middle',
      };
      result.push(labelText);
    }
  });
  
  return result;
}

// ============ MAIN COMPONENT ============

export function ExcalidrawEditor({
  isOpen,
  diagram,
  onClose,
  onSave,
  onExportPng,
  onExportJson,
}: ExcalidrawEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [ExcalidrawComponent, setExcalidrawComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialElements, setInitialElements] = useState<unknown[]>([]);
  const [initialFiles, setInitialFiles] = useState<Record<string, unknown>>({});
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);

  // Dynamically import Excalidraw and process elements
  useEffect(() => {
    if (isOpen && diagram) {
      setIsLoading(true);
      setLoadError(null);
      
      const loadExcalidraw = async () => {
        try {
          // Load Excalidraw component
          const module = await import('@excalidraw/excalidraw');
          setExcalidrawComponent(() => module.Excalidraw);
          
          // Get diagram data
          const diagramData = diagram.excalidraw_data;
          console.log('Loading diagram data:', diagramData);
          
          if (diagramData?.elements && Array.isArray(diagramData.elements)) {
            // Process elements - handle labels and convert to full format
            const processedElements = processElementsWithLabels(diagramData.elements);
            const convertedElements = convertToExcalidrawElements(processedElements);
            
            console.log('Processed elements:', convertedElements.length);
            setInitialElements(convertedElements);
            setInitialFiles(diagramData.files || {});
          } else {
            console.log('No elements found, starting with empty canvas');
            setInitialElements([]);
            setInitialFiles({});
          }
          
          setIsLoading(false);
        } catch (err) {
          console.error('Failed to load Excalidraw:', err);
          setIsLoading(false);
          setLoadError(`Failed to load editor: ${err}`);
        }
      };
      
      loadExcalidraw();
    }
  }, [isOpen, diagram]);

  // Handle save
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
          viewBackgroundColor: (appState as any)?.viewBackgroundColor || '#1e1e1e',
          gridSize: (appState as any)?.gridSize || null,
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

  // Handle change detection
  const handleChange = useCallback(() => {
    setHasChanges(true);
    setSaveStatus('idle');
  }, []);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      // Escape to close
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSave, handleClose]);

  // Scroll to content after elements are loaded
  useEffect(() => {
    if (excalidrawAPIRef.current && initialElements.length > 0) {
      setTimeout(() => {
        excalidrawAPIRef.current?.scrollToContent();
      }, 200);
    }
  }, [initialElements]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-4 z-10">
        {/* Left: Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-medium text-white">
              {diagram?.name || 'Untitled Diagram'}
            </h2>
            {diagram?.is_ai_generated && (
              <span className="text-[10px] text-purple-400">AI Generated</span>
            )}
          </div>
        </div>

        {/* Center: Tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => excalidrawAPIRef.current?.undo()}
            className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => excalidrawAPIRef.current?.redo()}
            className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-zinc-700 mx-2" />
          <button
            onClick={() => excalidrawAPIRef.current?.zoomOut()}
            className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => excalidrawAPIRef.current?.zoomIn()}
            className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Actions */}
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

      {/* Excalidraw Canvas */}
      <div className="absolute top-12 left-0 right-0 bottom-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Loading Excalidraw...</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <p className="text-sm text-red-400 mb-2">Load Error</p>
              <p className="text-xs text-zinc-500 mb-4">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 mx-auto px-4 py-2 text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded"
              >
                <RefreshCw className="w-3 h-3" />
                Reload page
              </button>
            </div>
          </div>
        ) : ExcalidrawComponent ? (
          <ExcalidrawComponent
            excalidrawAPI={(api: ExcalidrawAPI) => {
              excalidrawAPIRef.current = api;
            }}
            initialData={{
              elements: initialElements,
              appState: {
                viewBackgroundColor: '#1e1e1e',
                theme: 'dark',
              },
              files: initialFiles,
              scrollToContent: true,
            }}
            onChange={handleChange}
            theme="dark"
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveToActiveFile: false,
              },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-red-400">Failed to load Excalidraw</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
              >
                Reload page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExcalidrawEditor;

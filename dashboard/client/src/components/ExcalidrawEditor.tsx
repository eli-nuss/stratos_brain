import { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { Diagram, ExcalidrawScene } from '@/hooks/useDiagrams';

// CRITICAL: Import Excalidraw CSS - required for proper rendering
import '@excalidraw/excalidraw/index.css';

// ============ ELEMENT CONVERSION HELPERS ============

// Helper: Calculate center of a shape
function getCenter(el: any) {
  return {
    x: (el.x || 0) + (el.width || 100) / 2,
    y: (el.y || 0) + (el.height || 100) / 2,
  };
}

// Process skeleton elements into proper Excalidraw format with text binding and arrow math
function processSkeletonElements(elements: unknown[]): unknown[] {
  if (!Array.isArray(elements)) return [];
  
  const result: any[] = [];
  const elementMap = new Map<string, any>();

  // First pass: Assign IDs and map elements
  const baseElements = elements.map((el: any, index: number) => {
    const id = el.id || `el-${index}-${Date.now()}`;
    const baseEl = { ...el, id };
    elementMap.set(id, baseEl);
    return baseEl;
  });

  // Second pass: Process shapes, generate text, calculate arrows
  baseElements.forEach((el: any) => {
    const processedShape = { ...el };

    // A. HANDLE SHAPES WITH TEXT LABELS (MUTUAL BINDING)
    if (el.label && ['rectangle', 'ellipse', 'diamond'].includes(el.type)) {
      const textId = `${el.id}-text`;
      const shapeWidth = el.width || 250;
      const shapeHeight = el.height || 100;
      
      // 1. Tell shape it owns this text
      processedShape.boundElements = [{ id: textId, type: "text" }];

      // 2. Create the text element centered in the shape
      result.push({
        type: 'text',
        id: textId,
        x: el.x + (shapeWidth / 2),
        y: el.y + (shapeHeight / 2),
        text: el.label.text || '',
        fontSize: el.label.fontSize || 20,
        fontFamily: 1, // Virgil
        strokeColor: el.label.strokeColor || '#ffffff',
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: el.id, // 3. Tell text it is owned by the shape
      });
      
      // Remove label from shape (it's now a separate text element)
      delete processedShape.label;
    }

    // B. HANDLE ARROW MATH
    if (['arrow', 'line'].includes(el.type)) {
      const sourceId = el.start?.id;
      const targetId = el.end?.id;
      const source = sourceId ? elementMap.get(sourceId) : null;
      const target = targetId ? elementMap.get(targetId) : null;

      if (source && target) {
        const startCenter = getCenter(source);
        const endCenter = getCenter(target);

        // Excalidraw arrows start at their x,y and move relative via points
        processedShape.x = startCenter.x;
        processedShape.y = startCenter.y;
        processedShape.points = [
          [0, 0],
          [endCenter.x - startCenter.x, endCenter.y - startCenter.y]
        ];

        // Bindings to snap the arrow to the boxes
        processedShape.startBinding = { elementId: source.id, focus: 0, gap: 1 };
        processedShape.endBinding = { elementId: target.id, focus: 0, gap: 1 };
        
        // Also update the source shape to know it has a bound arrow
        const sourceInResult = result.find((r: any) => r.id === source.id);
        if (sourceInResult) {
          sourceInResult.boundElements = sourceInResult.boundElements || [];
          sourceInResult.boundElements.push({ id: el.id, type: 'arrow' });
        }
        const targetInResult = result.find((r: any) => r.id === target.id);
        if (targetInResult) {
          targetInResult.boundElements = targetInResult.boundElements || [];
          targetInResult.boundElements.push({ id: el.id, type: 'arrow' });
        }

        // Process arrow labels (optional)
        if (el.label) {
          result.push({
            type: 'text',
            id: `${el.id}-label`,
            x: startCenter.x + (endCenter.x - startCenter.x) / 2,
            y: startCenter.y + (endCenter.y - startCenter.y) / 2 - 15,
            text: el.label.text || '',
            fontSize: 14,
            fontFamily: 1,
            strokeColor: '#ced4da',
            textAlign: 'center',
          });
        }
      } else {
        // Fallback: use provided x,y or defaults, with basic points
        processedShape.x = el.x || 0;
        processedShape.y = el.y || 0;
        processedShape.points = el.points || [[0, 0], [100, 50]];
      }
      
      // Clean up start/end binding objects (they're now in startBinding/endBinding)
      delete processedShape.start;
      delete processedShape.end;
      delete processedShape.label;
    }

    result.push(processedShape);
  });
  
  return result;
}

// Enforce strict Excalidraw schema - add all required fields
function enforceExcalidrawSchema(elements: unknown[]): unknown[] {
  if (!Array.isArray(elements)) return [];
  
  return elements.map((el: any) => {
    const baseElement = {
      id: el.id || `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: el.type || 'rectangle',
      x: el.x ?? 0,
      y: el.y ?? 0,
      width: el.width ?? 100,
      height: el.height ?? 100,
      angle: el.angle ?? 0,
      strokeColor: el.strokeColor || '#ced4da',
      backgroundColor: el.backgroundColor || 'transparent',
      fillStyle: el.fillStyle || 'solid',
      strokeWidth: el.strokeWidth ?? 2,
      strokeStyle: el.strokeStyle || 'solid',
      roughness: el.roughness ?? 1,
      opacity: el.opacity ?? 100,
      groupIds: el.groupIds || [],
      frameId: el.frameId ?? null,
      roundness: el.roundness || { type: 3 },
      seed: el.seed ?? Math.floor(Math.random() * 1000000),
      version: el.version ?? 1,
      versionNonce: el.versionNonce ?? Math.floor(Math.random() * 1000000),
      isDeleted: el.isDeleted ?? false,
      boundElements: el.boundElements || null,
      updated: el.updated ?? Date.now(),
      link: el.link ?? null,
      locked: el.locked ?? false,
    };

    // Type-specific required fields
    if (el.type === 'text') {
      return {
        ...baseElement,
        text: el.text || '',
        fontSize: el.fontSize ?? 20,
        fontFamily: el.fontFamily ?? 1,
        textAlign: el.textAlign || 'center',
        verticalAlign: el.verticalAlign || 'middle',
        containerId: el.containerId ?? null,
        originalText: el.originalText || el.text || '',
        lineHeight: el.lineHeight ?? 1.25,
        baseline: el.baseline ?? 18,
      };
    }
    
    if (['arrow', 'line'].includes(el.type)) {
      return {
        ...baseElement,
        points: el.points || [[0, 0], [100, 50]],
        lastCommittedPoint: el.lastCommittedPoint ?? null,
        startBinding: el.startBinding ?? null,
        endBinding: el.endBinding ?? null,
        startArrowhead: el.startArrowhead ?? null,
        endArrowhead: el.endArrowhead ?? 'triangle',
      };
    }

    return baseElement;
  });
}

// ============ MAIN COMPONENT ============

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
  const [processedElements, setProcessedElements] = useState<any[] | null>(null);
  const [elementsReady, setElementsReady] = useState(false);
  const [sceneUpdated, setSceneUpdated] = useState(false);
  const excalidrawAPIRef = useRef<any>(null);
  const diagramIdRef = useRef<string | null>(null);

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

  // Process elements when diagram changes
  useEffect(() => {
    if (!diagram) {
      setProcessedElements(null);
      setElementsReady(false);
      setSceneUpdated(false);
      return;
    }

    // Reset scene updated flag when diagram changes
    if (diagramIdRef.current !== diagram.diagram_id) {
      diagramIdRef.current = diagram.diagram_id;
      setSceneUpdated(false);
    }

    const rawElements = diagram.excalidraw_data?.elements || [];
    
    // If no elements, we're ready with empty array
    if (rawElements.length === 0) {
      console.log('[ExcalidrawEditor] No elements, using empty array');
      setProcessedElements([]);
      setElementsReady(true);
      return;
    }
    
    // Check if elements need processing (have 'label' or 'start'/'end' properties = skeleton format)
    const needsProcessing = rawElements.some((el: any) => 
      el.label !== undefined || el.start !== undefined || el.end !== undefined
    );
    
    try {
      console.log('[ExcalidrawEditor] Processing elements...');
      console.log('[ExcalidrawEditor] Raw elements:', rawElements);
      
      let processed = rawElements;
      if (needsProcessing) {
        // First process skeleton format (labels, arrow bindings)
        processed = processSkeletonElements(rawElements);
        console.log('[ExcalidrawEditor] After skeleton processing:', processed);
      }
      
      // Then enforce strict schema
      const final = enforceExcalidrawSchema(processed);
      console.log('[ExcalidrawEditor] Final elements:', final);
      
      setProcessedElements(final);
      setElementsReady(true);
    } catch (err) {
      console.error('[ExcalidrawEditor] Failed to process elements:', err);
      // Fall back to enforcing schema on raw elements
      const fallback = enforceExcalidrawSchema(rawElements);
      setProcessedElements(fallback);
      setElementsReady(true);
    }
  }, [diagram]);

  // Update scene via API after Excalidraw mounts
  useEffect(() => {
    if (!excalidrawAPIRef.current || !elementsReady || !processedElements || sceneUpdated) {
      return;
    }

    // Small delay to ensure Excalidraw is fully initialized
    const timer = setTimeout(() => {
      const api = excalidrawAPIRef.current;
      if (!api) return;

      console.log('[ExcalidrawEditor] Updating scene via API with', processedElements.length, 'elements');
      
      try {
        // Update the scene with processed elements
        api.updateScene({
          elements: processedElements,
          appState: {
            viewBackgroundColor: diagram?.excalidraw_data?.appState?.viewBackgroundColor || '#1e1e1e',
          }
        });

        // Scroll to content after a brief delay
        setTimeout(() => {
          if (api && processedElements.length > 0) {
            api.scrollToContent(processedElements, { fitToContent: true, animate: true });
            console.log('[ExcalidrawEditor] Scrolled to content');
          }
        }, 100);

        setSceneUpdated(true);
      } catch (err) {
        console.error('[ExcalidrawEditor] Failed to update scene:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [elementsReady, processedElements, sceneUpdated, diagram]);

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
        appState: { viewBackgroundColor: appState?.viewBackgroundColor || '#1e1e1e' },
        files
      });
      alert("Diagram saved!");
    } catch (err) {
      console.error('Save failed:', err);
      alert("Failed to save diagram");
    }
  }, [diagram, onSave]);

  // Keyboard shortcuts
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

  // Handle API ready callback
  const handleExcalidrawAPI = useCallback((api: any) => {
    console.log('[ExcalidrawEditor] Excalidraw API ready');
    excalidrawAPIRef.current = api;
    
    // Trigger scene update after API is ready
    if (elementsReady && processedElements && processedElements.length > 0) {
      setSceneUpdated(false);
    }
  }, [elementsReady, processedElements]);

  if (!isOpen) return null;

  const Excalidraw = ExcalidrawModule?.Excalidraw;
  const MainMenu = ExcalidrawModule?.MainMenu;
  const isProcessing = isLoading || !elementsReady;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#1e1e1e',
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
        <div style={{ height: '100vh', width: '100vw' }}>
          <Excalidraw
            excalidrawAPI={handleExcalidrawAPI}
            initialData={{
              elements: [],
              appState: { 
                viewBackgroundColor: diagram?.excalidraw_data?.appState?.viewBackgroundColor || '#1e1e1e', 
                theme: 'dark',
              },
            }}
            theme="dark"
          >
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

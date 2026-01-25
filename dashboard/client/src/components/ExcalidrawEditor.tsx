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

// Helper: Calculate edge connection points for arrows
// Connects from bottom edge of source to top edge of target
function getEdgePoints(source: any, target: any) {
  const sourceCenter = getCenter(source);
  const targetCenter = getCenter(target);
  
  // Determine if arrow goes primarily vertical or horizontal
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  
  let startX, startY, endX, endY;
  
  if (Math.abs(dy) > Math.abs(dx)) {
    // Primarily vertical - connect top/bottom edges
    if (dy > 0) {
      // Target is below source - connect source bottom to target top
      startX = sourceCenter.x;
      startY = (source.y || 0) + (source.height || 100);
      endX = targetCenter.x;
      endY = target.y || 0;
    } else {
      // Target is above source - connect source top to target bottom
      startX = sourceCenter.x;
      startY = source.y || 0;
      endX = targetCenter.x;
      endY = (target.y || 0) + (target.height || 100);
    }
  } else {
    // Primarily horizontal - connect left/right edges
    if (dx > 0) {
      // Target is to the right - connect source right to target left
      startX = (source.x || 0) + (source.width || 100);
      startY = sourceCenter.y;
      endX = target.x || 0;
      endY = targetCenter.y;
    } else {
      // Target is to the left - connect source left to target right
      startX = source.x || 0;
      startY = sourceCenter.y;
      endX = (target.x || 0) + (target.width || 100);
      endY = targetCenter.y;
    }
  }
  
  return { startX, startY, endX, endY };
}

// Generate unique ID
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Process skeleton elements into proper Excalidraw format with text binding and arrow math
function processSkeletonElements(elements: unknown[]): unknown[] {
  if (!Array.isArray(elements)) return [];
  
  const result: any[] = [];
  const elementMap = new Map<string, any>();

  // First pass: Build a map of ALL element IDs (original IDs from AI)
  // This is critical for arrow binding to work
  const processedShapes: any[] = [];
  
  elements.forEach((el: any, index: number) => {
    // IMPORTANT: Preserve the original ID from the AI
    // Only generate a new one if none exists
    const id = el.id || `el-${index}-${generateId()}`;
    const baseEl = { ...el, id };
    
    // Map the element by its ID
    elementMap.set(id, baseEl);
    
    // Also map by original ID if different (for arrow binding)
    if (el.id && el.id !== id) {
      elementMap.set(el.id, baseEl);
    }
    
    // Only process shapes in first pass (not arrows)
    if (!['arrow', 'line'].includes(el.type)) {
      processedShapes.push(baseEl);
    }
  });
  
  console.log('[processSkeletonElements] Element map keys:', Array.from(elementMap.keys()));

  // Second pass: Process shapes with labels
  processedShapes.forEach((el: any) => {
    const processedShape = { ...el };

    // HANDLE SHAPES WITH TEXT LABELS (MUTUAL BINDING)
    if (el.label && ['rectangle', 'ellipse', 'diamond'].includes(el.type)) {
      const textId = `${el.id}-text`;
      const shapeWidth = el.width || 250;
      const shapeHeight = el.height || 100;
      
      // Tell shape it owns this text
      processedShape.boundElements = [{ id: textId, type: "text" }];

      // Determine text color based on background brightness
      // All Excalidraw pastel colors are light, so use dark text
      const bgColor = el.backgroundColor || 'transparent';
      // Check if it's a dark background (starts with #1, #2, #3, #4, #5)
      const isDarkBg = bgColor.match(/^#[0-5]/);
      const textColor = el.label.strokeColor || (isDarkBg ? '#ffffff' : '#1e1e1e');
      
      // Create the text element bound to the shape
      // For bound text, x/y should match the container's position
      // Excalidraw will auto-center based on textAlign and verticalAlign
      result.push({
        type: 'text',
        id: textId,
        x: el.x,  // Use container's x, not center
        y: el.y,  // Use container's y, not center
        width: shapeWidth,   // Match container width for proper centering
        height: shapeHeight, // Match container height for proper centering
        text: el.label.text || '',
        fontSize: el.label.fontSize || 16,
        fontFamily: 1,
        strokeColor: textColor,
        textAlign: 'center',
        verticalAlign: 'middle',
        containerId: el.id,
        originalText: el.label.text || '',
        lineHeight: 1.25,
      });
      
      delete processedShape.label;
    }

    result.push(processedShape);
  });

  // Third pass: Process arrows with ROBUST ID matching
  elements.forEach((el: any) => {
    if (!['arrow', 'line'].includes(el.type)) return;
    
    const processedArrow = { ...el, id: el.id || `arrow-${generateId()}` };
    
    // Get source and target IDs - handle various formats
    let sourceId = el.start?.id || el.startId || el.sourceId;
    let targetId = el.end?.id || el.endId || el.targetId;
    
    console.log('[processSkeletonElements] Arrow:', el.id, 'start:', sourceId, 'end:', targetId);
    
    // Try to find source and target in our element map
    let source = sourceId ? elementMap.get(sourceId) : null;
    let target = targetId ? elementMap.get(targetId) : null;
    
    // If not found, try case-insensitive matching
    if (!source && sourceId) {
      const lowerSourceId = sourceId.toLowerCase();
      for (const [key, val] of elementMap.entries()) {
        if (key.toLowerCase() === lowerSourceId) {
          source = val;
          break;
        }
      }
    }
    if (!target && targetId) {
      const lowerTargetId = targetId.toLowerCase();
      for (const [key, val] of elementMap.entries()) {
        if (key.toLowerCase() === lowerTargetId) {
          target = val;
          break;
        }
      }
    }
    
    console.log('[processSkeletonElements] Found source:', !!source, 'target:', !!target);

    if (source && target) {
      // Calculate edge connection points (not centers)
      const { startX, startY, endX, endY } = getEdgePoints(source, target);

      // Set arrow position and points - start from edge, end at edge
      processedArrow.x = startX;
      processedArrow.y = startY;
      processedArrow.points = [
        [0, 0],
        [endX - startX, endY - startY]
      ];

      // Bindings with proper focus and gap for edge connection
      processedArrow.startBinding = { elementId: source.id, focus: 0, gap: 4 };
      processedArrow.endBinding = { elementId: target.id, focus: 0, gap: 4 };
      
      // Update source/target shapes to know they have bound arrows
      const sourceInResult = result.find((r: any) => r.id === source.id);
      if (sourceInResult) {
        sourceInResult.boundElements = sourceInResult.boundElements || [];
        if (!sourceInResult.boundElements.find((b: any) => b.id === processedArrow.id)) {
          sourceInResult.boundElements.push({ id: processedArrow.id, type: 'arrow' });
        }
      }
      const targetInResult = result.find((r: any) => r.id === target.id);
      if (targetInResult) {
        targetInResult.boundElements = targetInResult.boundElements || [];
        if (!targetInResult.boundElements.find((b: any) => b.id === processedArrow.id)) {
          targetInResult.boundElements.push({ id: processedArrow.id, type: 'arrow' });
        }
      }
    } else {
      // FALLBACK: If we can't find the elements, try to use explicit x/y/points from AI
      // Or calculate from the arrow's own position data
      if (el.x !== undefined && el.y !== undefined && el.points && el.points.length >= 2) {
        // AI provided explicit coordinates - use them
        processedArrow.x = el.x;
        processedArrow.y = el.y;
        processedArrow.points = el.points;
        console.log('[processSkeletonElements] Using explicit arrow coords:', el.x, el.y);
      } else {
        // Last resort: Don't add the arrow at all if we can't position it
        // This prevents arrows from piling up at (0,0)
        console.warn('[processSkeletonElements] Skipping arrow with no valid position:', el.id);
        return; // Skip this arrow entirely
      }
    }
    
    delete processedArrow.start;
    delete processedArrow.end;
    delete processedArrow.label;

    result.push(processedArrow);
  });
  
  return result;
}

// Enforce strict Excalidraw schema - add all required fields
function enforceExcalidrawSchema(elements: unknown[]): unknown[] {
  if (!Array.isArray(elements)) return [];
  
  return elements.map((el: any, index: number) => {
    const seed = Math.floor(Math.random() * 2000000000);
    const versionNonce = Math.floor(Math.random() * 2000000000);
    
    const baseElement: any = {
      id: el.id || `el-${index}-${generateId()}`,
      type: el.type || 'rectangle',
      x: typeof el.x === 'number' ? el.x : 0,
      y: typeof el.y === 'number' ? el.y : 0,
      width: el.width ?? (el.type === 'text' ? undefined : 100),
      height: el.height ?? (el.type === 'text' ? undefined : 100),
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
      roundness: el.roundness ?? (el.type === 'text' ? null : { type: 3 }),
      seed: seed,
      version: el.version ?? 1,
      versionNonce: versionNonce,
      isDeleted: el.isDeleted ?? false,
      boundElements: el.boundElements || null,
      updated: el.updated ?? Date.now(),
      link: el.link ?? null,
      locked: el.locked ?? false,
    };

    // Text elements
    if (el.type === 'text') {
      const fontSize = el.fontSize ?? 16;
      const text = el.text || '';
      const lines = text.split('\n');
      const maxLineLength = Math.max(...lines.map((l: string) => l.length));
      // Estimate width based on font size and character count
      const estimatedWidth = maxLineLength * fontSize * 0.6;
      const estimatedHeight = lines.length * fontSize * 1.25;
      
      return {
        ...baseElement,
        text: text,
        fontSize: fontSize,
        fontFamily: el.fontFamily ?? 1,
        textAlign: el.textAlign || 'center',
        verticalAlign: el.verticalAlign || 'middle',
        containerId: el.containerId ?? null,
        originalText: el.originalText || text,
        lineHeight: el.lineHeight ?? 1.25,
        baseline: el.baseline ?? Math.round(fontSize * 0.9),
        // Excalidraw needs width/height for text to render
        width: el.width ?? estimatedWidth,
        height: el.height ?? estimatedHeight,
        autoResize: true,
      };
    }
    
    // Arrow/line elements
    if (['arrow', 'line'].includes(el.type)) {
      return {
        ...baseElement,
        points: el.points || [[0, 0], [100, 50]],
        lastCommittedPoint: el.lastCommittedPoint ?? null,
        startBinding: el.startBinding ?? null,
        endBinding: el.endBinding ?? null,
        startArrowhead: el.startArrowhead ?? null,
        endArrowhead: el.type === 'arrow' ? (el.endArrowhead ?? 'triangle') : null,
        // Remove width/height for arrows - they use points
        width: undefined,
        height: undefined,
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
  const [renderKey, setRenderKey] = useState(0); // Force re-render of Excalidraw
  const excalidrawAPIRef = useRef<any>(null);

  // Dynamically import Excalidraw only when modal opens
  useEffect(() => {
    if (isOpen && !ExcalidrawModule) {
      setIsLoading(true);
      setLoadError(null);
      
      import('@excalidraw/excalidraw')
        .then((module) => {
          console.log('[ExcalidrawEditor] Module loaded');
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
    if (!diagram || !isOpen || !ExcalidrawModule) {
      setProcessedElements(null);
      return;
    }

    const rawElements = diagram.excalidraw_data?.elements || [];
    
    if (rawElements.length === 0) {
      console.log('[ExcalidrawEditor] No elements, using empty array');
      setProcessedElements([]);
      setRenderKey(prev => prev + 1);
      return;
    }
    
    // Check if elements need processing (skeleton format with label, start, end)
    const needsProcessing = rawElements.some((el: any) => 
      el.label !== undefined || el.start !== undefined || el.end !== undefined
    );
    
    try {
      console.log('[ExcalidrawEditor] Processing elements...');
      console.log('[ExcalidrawEditor] Raw elements:', JSON.stringify(rawElements, null, 2));
      
      let processed = rawElements;
      
      // ALWAYS use our manual processing for skeleton elements
      // The Excalidraw API doesn't handle arrow binding well with AI-generated IDs
      if (needsProcessing) {
        console.log('[ExcalidrawEditor] Using manual skeleton processing for better arrow handling');
        processed = processSkeletonElements(rawElements);
        console.log('[ExcalidrawEditor] After manual skeleton processing:', processed.length, 'elements');
      }
      
      const final = enforceExcalidrawSchema(processed);
      console.log('[ExcalidrawEditor] Final elements:', JSON.stringify(final, null, 2));
      
      setProcessedElements(final);
      setRenderKey(prev => prev + 1); // Force Excalidraw to re-mount with new data
    } catch (err) {
      console.error('[ExcalidrawEditor] Failed to process elements:', err);
      const fallback = enforceExcalidrawSchema(rawElements);
      setProcessedElements(fallback);
      setRenderKey(prev => prev + 1);
    }
  }, [diagram, isOpen, ExcalidrawModule]);

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
        appState: { viewBackgroundColor: appState?.viewBackgroundColor || '#f8f9fa' },
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
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Escape to close
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSave, onClose]);

  if (!isOpen) return null;

  const Excalidraw = ExcalidrawModule?.Excalidraw;

  // Get app state from diagram data or use defaults
  const appState = diagram?.excalidraw_data?.appState || {};
  const initialAppState = {
    viewBackgroundColor: appState.viewBackgroundColor || '#f8f9fa', // Light background
    theme: 'light' as const,
    zenModeEnabled: false,
    gridSize: null,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            ← Back
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {diagram?.name || 'Diagram Editor'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => diagram && onExportPng(diagram.diagram_id)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Export PNG
          </button>
          <button
            onClick={() => diagram && onExportJson(diagram.diagram_id)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Export JSON
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            Save
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading editor...</span>
          </div>
        )}
        
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <p className="text-red-600 mb-2">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        )}
        
        {!isLoading && !loadError && Excalidraw && processedElements && (
          <Excalidraw
            key={renderKey}
            excalidrawAPI={(api: any) => {
              excalidrawAPIRef.current = api;
            }}
            initialData={{
              elements: processedElements,
              appState: initialAppState,
              files: diagram?.excalidraw_data?.files || {},
            }}
            theme="light"
            langCode="en"
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveToActiveFile: false,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

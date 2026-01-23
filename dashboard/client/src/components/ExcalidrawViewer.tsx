import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { X, Download, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';

// Lazy load Excalidraw to reduce bundle size
const Excalidraw = lazy(() => 
  import('@excalidraw/excalidraw').then(mod => ({ default: mod.Excalidraw }))
);

interface ExcalidrawViewerProps {
  elements: ExcalidrawElement[];
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (elements: ExcalidrawElement[]) => void;
}

export function ExcalidrawViewer({
  elements: initialElements,
  title = 'Diagram',
  isOpen,
  onClose,
  onSave,
}: ExcalidrawViewerProps) {
  const [elements, setElements] = useState<ExcalidrawElement[]>(initialElements);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setElements(initialElements);
  }, [initialElements]);

  const handleChange = useCallback((
    newElements: readonly ExcalidrawElement[],
    _appState: AppState,
    _files: BinaryFiles
  ) => {
    setElements([...newElements]);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements,
        mimeType: 'image/png',
        appState: {
          exportWithDarkMode: true,
        },
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export diagram:', error);
    }
  }, [elements, title]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(elements);
    }
    onClose();
  }, [elements, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={cn(
        "bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200",
        isFullscreen ? "w-full h-full rounded-none" : "w-[90vw] h-[85vh] max-w-6xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 flex-shrink-0 bg-zinc-800">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
              title="Export as PNG"
            >
              <Download className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-zinc-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-zinc-400" />
              )}
            </button>
            <button
              onClick={handleSave}
              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Excalidraw Canvas */}
        <div className="flex-1 bg-white">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-zinc-100">
              <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
            </div>
          }>
            <Excalidraw
              initialData={{
                elements,
                appState: {
                  viewBackgroundColor: '#ffffff',
                  theme: 'light',
                },
              }}
              onChange={handleChange}
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
    </div>
  );
}

// Helper function to convert simple diagram data to Excalidraw elements
export function createExcalidrawElements(nodes: Array<{
  id: string;
  label: string;
  x?: number;
  y?: number;
}>, connections: Array<{
  from: string;
  to: string;
  label?: string;
}>): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];
  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  
  // Create rectangle elements for nodes
  nodes.forEach((node, index) => {
    const x = node.x ?? (index % 3) * 250 + 50;
    const y = node.y ?? Math.floor(index / 3) * 150 + 50;
    const width = Math.max(150, node.label.length * 10);
    const height = 60;
    
    nodePositions[node.id] = { x, y, width, height };
    
    // Rectangle
    elements.push({
      id: `rect-${node.id}`,
      type: 'rectangle',
      x,
      y,
      width,
      height,
      angle: 0,
      strokeColor: '#1e1e1e',
      backgroundColor: '#a5d8ff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      index: `a${index}`,
      roundness: { type: 3 },
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
    } as ExcalidrawElement);
    
    // Text label
    elements.push({
      id: `text-${node.id}`,
      type: 'text',
      x: x + width / 2,
      y: y + height / 2,
      width: width - 20,
      height: 20,
      angle: 0,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      index: `a${index + nodes.length}`,
      roundness: null,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: node.label,
      fontSize: 16,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      containerId: null,
      originalText: node.label,
      autoResize: true,
      lineHeight: 1.25,
    } as ExcalidrawElement);
  });
  
  // Create arrow elements for connections
  connections.forEach((conn, index) => {
    const fromPos = nodePositions[conn.from];
    const toPos = nodePositions[conn.to];
    
    if (!fromPos || !toPos) return;
    
    const startX = fromPos.x + fromPos.width / 2;
    const startY = fromPos.y + fromPos.height;
    const endX = toPos.x + toPos.width / 2;
    const endY = toPos.y;
    
    elements.push({
      id: `arrow-${conn.from}-${conn.to}`,
      type: 'arrow',
      x: startX,
      y: startY,
      width: endX - startX,
      height: endY - startY,
      angle: 0,
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      index: `b${index}`,
      roundness: { type: 2 },
      seed: Math.floor(Math.random() * 100000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 100000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      points: [[0, 0], [endX - startX, endY - startY]],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: 'arrow',
      elbowed: false,
    } as ExcalidrawElement);
  });
  
  return elements;
}

export default ExcalidrawViewer;

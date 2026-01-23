import { useCallback, useEffect, useState, useRef, lazy, Suspense } from 'react';
import { createShapeId } from 'tldraw';
import {
  X, Maximize2, Minimize2, Loader2,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy load tldraw component only
const TldrawComponent = lazy(() => import('tldraw').then(mod => ({ default: mod.Tldraw })));

// ============ TYPES ============

interface DiagramNode {
  id: string;
  label: string;
  value?: number;
  valueLabel?: string;
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral';
  color?: string;
  icon?: string;
}

interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  value?: number;
}

interface DiagramMetric {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DiagramData {
  chartType?: 'flowchart' | 'sankey' | 'pie' | 'bar' | 'treemap';
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  metrics?: DiagramMetric[];
}

interface TldrawEditorProps {
  title: string;
  description?: string;
  diagramData?: DiagramData;
  isOpen: boolean;
  onClose: () => void;
}

// ============ CATEGORY COLORS ============

const categoryToColor: Record<string, 'green' | 'red' | 'blue' | 'violet' | 'orange' | 'grey'> = {
  revenue: 'green',
  cost: 'red',
  asset: 'blue',
  metric: 'violet',
  risk: 'orange',
  neutral: 'grey',
};

// ============ METRICS PANEL ============

function MetricsPanel({ metrics }: { metrics: DiagramMetric[] }) {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-zinc-800/50 border-b border-zinc-700">
      {metrics.map((metric, index) => (
        <div 
          key={index}
          className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 rounded-lg border border-zinc-700"
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{metric.label}</div>
            <div className="text-lg font-bold text-white">{metric.value}</div>
          </div>
          {metric.change && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
              metric.trend === 'up' && "bg-emerald-500/20 text-emerald-400",
              metric.trend === 'down' && "bg-red-500/20 text-red-400",
              metric.trend === 'neutral' && "bg-zinc-500/20 text-zinc-400",
            )}>
              {metric.trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {metric.trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {metric.trend === 'neutral' && <Minus className="w-3 h-3" />}
              {metric.change}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============ ERROR BOUNDARY ============

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-900">
      <div className="text-center max-w-md p-6">
        <div className="text-red-400 text-lg font-semibold mb-2">Failed to load canvas</div>
        <div className="text-zinc-500 text-sm mb-4">{error.message}</div>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ============ TLDRAW WRAPPER ============

function TldrawWrapper({ diagramData }: { diagramData?: DiagramData }) {
  const [cssLoaded, setCssLoaded] = useState(false);
  const shapesCreatedRef = useRef(false);
  const editorRef = useRef<any>(null);

  // Load CSS dynamically
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/tldraw@4.3.0/tldraw.css';
    link.onload = () => setCssLoaded(true);
    document.head.appendChild(link);
    
    return () => {
      try {
        document.head.removeChild(link);
      } catch (e) {
        // Link may already be removed
      }
    };
  }, []);

  // Reset shapesCreated when diagramData changes
  useEffect(() => {
    shapesCreatedRef.current = false;
  }, [diagramData]);

  const handleMount = useCallback((editor: any) => {
    console.log('Tldraw mounted, diagramData:', diagramData, 'shapesCreated:', shapesCreatedRef.current);
    
    // Store editor reference
    editorRef.current = editor;
    
    // Skip if shapes already created or no data
    if (shapesCreatedRef.current) {
      console.log('Shapes already created, skipping');
      return;
    }
    
    if (!diagramData || !diagramData.nodes || diagramData.nodes.length === 0) {
      console.log('No diagram data to render');
      return;
    }

    // Mark shapes as created immediately to prevent double creation
    shapesCreatedRef.current = true;

    // Import toRichText dynamically since it's needed for geo shape text
    import('tldraw').then(({ toRichText }) => {
      // Calculate layout positions
      const nodePositions: Record<string, { x: number; y: number }> = {};
      const cols = Math.ceil(Math.sqrt(diagramData.nodes.length));
      const spacingX = 280;
      const spacingY = 180;
      const startX = 200;
      const startY = 200;

      // Position nodes in a grid
      diagramData.nodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        nodePositions[node.id] = {
          x: startX + col * spacingX,
          y: startY + row * spacingY,
        };
      });

      // Create shapes using the editor API
      const shapeIds: Record<string, ReturnType<typeof createShapeId>> = {};
      
      try {
        // Create node shapes
        diagramData.nodes.forEach((node) => {
          const pos = nodePositions[node.id];
          const shapeId = createShapeId();
          shapeIds[node.id] = shapeId;

          const color = categoryToColor[node.category || 'neutral'] || 'grey';
          const labelText = node.valueLabel 
            ? `${node.label}\n${node.valueLabel}`
            : node.label;

          console.log('Creating shape:', { id: shapeId, label: labelText, pos, color });

          // Use richText instead of text for geo shapes in tldraw 4.x
          editor.createShape({
            id: shapeId,
            type: 'geo',
            x: pos.x,
            y: pos.y,
            props: {
              w: 200,
              h: 100,
              geo: 'rectangle',
              color: color,
              fill: 'solid',
              dash: 'solid',
              size: 'm',
              font: 'sans',
              align: 'middle',
              verticalAlign: 'middle',
              richText: toRichText(labelText),
              labelColor: 'white',
              growY: 0,
              scale: 1,
            },
          });
        });

        console.log('Created shapes:', Object.keys(shapeIds).length);

        // Create connection arrows
        diagramData.connections.forEach((conn) => {
          const fromId = shapeIds[conn.from];
          const toId = shapeIds[conn.to];
          
          if (fromId && toId) {
            const arrowId = createShapeId();
            
            console.log('Creating arrow:', { from: conn.from, to: conn.to, arrowId });

            editor.createShape({
              id: arrowId,
              type: 'arrow',
              props: {
                color: 'grey',
                size: 'm',
                arrowheadEnd: 'arrow',
                arrowheadStart: 'none',
                start: {
                  type: 'binding',
                  boundShapeId: fromId,
                  normalizedAnchor: { x: 0.5, y: 1 },
                  isExact: false,
                  isPrecise: false,
                },
                end: {
                  type: 'binding',
                  boundShapeId: toId,
                  normalizedAnchor: { x: 0.5, y: 0 },
                  isExact: false,
                  isPrecise: false,
                },
              },
            });
          }
        });

        // Zoom to fit all shapes after a short delay
        setTimeout(() => {
          try {
            editor.zoomToFit({ animation: { duration: 300 } });
          } catch (e) {
            console.error('Error zooming to fit:', e);
          }
        }, 200);
        
      } catch (err) {
        console.error('Error creating shapes:', err);
        // Reset flag so it can try again
        shapesCreatedRef.current = false;
      }
    }).catch(err => {
      console.error('Error importing toRichText:', err);
      shapesCreatedRef.current = false;
    });
  }, [diagramData]);

  if (!cssLoaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TldrawComponent
        onMount={handleMount}
        inferDarkMode
      />
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function TldrawEditor({
  title,
  description,
  diagramData,
  isOpen,
  onClose,
}: TldrawEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleRetry = () => {
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={cn(
        "bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200",
        isFullscreen ? "w-full h-full rounded-none" : "w-[95vw] h-[90vh] max-w-7xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 flex-shrink-0 bg-zinc-800">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-500/20 text-indigo-300 rounded">
              Canvas Editor
            </span>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
            <p className="text-xs text-zinc-400">{description}</p>
          </div>
        )}

        {/* Metrics Panel */}
        {diagramData?.metrics && diagramData.metrics.length > 0 && (
          <MetricsPanel metrics={diagramData.metrics} />
        )}

        {/* Tldraw Canvas */}
        <div className="flex-1 relative" style={{ minHeight: '500px' }}>
          {error ? (
            <ErrorFallback error={error} onRetry={handleRetry} />
          ) : (
            <Suspense fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="text-sm text-zinc-400">Loading canvas...</span>
                </div>
              </div>
            }>
              <TldrawWrapper diagramData={diagramData} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

export default TldrawEditor;

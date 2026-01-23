import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Maximize2, Minimize2, Download, ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, TrendingDown, Minus, Move
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface DiagramCanvasProps {
  title: string;
  description?: string;
  diagramData?: DiagramData;
  isOpen: boolean;
  onClose: () => void;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============ CATEGORY COLORS ============

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  revenue: { bg: '#065f46', border: '#10b981', text: '#ecfdf5' },
  cost: { bg: '#7f1d1d', border: '#ef4444', text: '#fef2f2' },
  asset: { bg: '#1e3a8a', border: '#3b82f6', text: '#eff6ff' },
  metric: { bg: '#581c87', border: '#a855f7', text: '#faf5ff' },
  risk: { bg: '#7c2d12', border: '#f97316', text: '#fff7ed' },
  neutral: { bg: '#374151', border: '#6b7280', text: '#f9fafb' },
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

// ============ CANVAS COMPONENT ============

function Canvas({ diagramData }: { diagramData?: DiagramData }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Initialize positions
  useEffect(() => {
    if (!diagramData?.nodes) return;
    
    const cols = Math.ceil(Math.sqrt(diagramData.nodes.length));
    const nodeWidth = 180;
    const nodeHeight = 80;
    const spacingX = 220;
    const spacingY = 140;
    const startX = 100;
    const startY = 100;

    const initialPositions: Record<string, NodePosition> = {};
    diagramData.nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      initialPositions[node.id] = {
        x: startX + col * spacingX,
        y: startY + row * spacingY,
        width: nodeWidth,
        height: nodeHeight,
      };
    });
    setPositions(initialPositions);
  }, [diagramData]);

  // Handle mouse down on node
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const pos = positions[nodeId];
    if (!pos) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragging(nodeId);
    setDragOffset({
      x: (e.clientX - rect.left - pan.x) / zoom - pos.x,
      y: (e.clientY - rect.top - pan.y) / zoom - pos.y,
    });
  }, [positions, zoom, pan]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (dragging) {
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;
      setPositions(prev => ({
        ...prev,
        [dragging]: { ...prev[dragging], x, y },
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [dragging, dragOffset, zoom, pan, isPanning, panStart]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  // Handle canvas mouse down for panning
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      });
    }
  }, [pan]);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.25), 3));
  }, []);

  // Export to PNG
  const exportToPng = useCallback(async () => {
    if (!canvasRef.current) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#18181b',
        scale: 2,
      });
      
      const link = document.createElement('a');
      link.download = 'diagram.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error exporting to PNG:', err);
    }
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Calculate arrow path between two nodes
  const getArrowPath = (from: NodePosition, to: NodePosition): string => {
    const fromCenterX = from.x + from.width / 2;
    const fromCenterY = from.y + from.height / 2;
    const toCenterX = to.x + to.width / 2;
    const toCenterY = to.y + to.height / 2;

    // Determine which edges to connect
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    
    let startX, startY, endX, endY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      if (dx > 0) {
        startX = from.x + from.width;
        endX = to.x;
      } else {
        startX = from.x;
        endX = to.x + to.width;
      }
      startY = fromCenterY;
      endY = toCenterY;
    } else {
      // Vertical connection
      if (dy > 0) {
        startY = from.y + from.height;
        endY = to.y;
      } else {
        startY = from.y;
        endY = to.y + to.height;
      }
      startX = fromCenterX;
      endX = toCenterX;
    }

    // Create curved path
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    return `M ${startX} ${startY} Q ${midX} ${startY}, ${midX} ${midY} T ${endX} ${endY}`;
  };

  if (!diagramData?.nodes) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        No diagram data available
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
        <button
          onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
          className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-zinc-400" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z * 0.8, 0.25))}
          className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-zinc-400" />
        </button>
        <span className="text-xs text-zinc-500 min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={resetView}
          className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Move className="w-3 h-3" />
          <span>Drag nodes to reposition</span>
        </div>
        <button
          onClick={exportToPng}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium text-white transition-colors"
        >
          <Download className="w-3 h-3" />
          Export PNG
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden bg-zinc-900 canvas-bg"
        style={{ cursor: isPanning ? 'grabbing' : dragging ? 'move' : 'grab' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid background */}
        <div 
          className="absolute inset-0 canvas-bg"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* SVG layer for connections */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>
          {diagramData.connections.map((conn, index) => {
            const from = positions[conn.from];
            const to = positions[conn.to];
            if (!from || !to) return null;
            
            return (
              <path
                key={index}
                d={getArrowPath(from, to)}
                fill="none"
                stroke="#6b7280"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
        </svg>

        {/* Nodes layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {diagramData.nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            
            const colors = categoryColors[node.category || 'neutral'];
            
            return (
              <div
                key={node.id}
                className="absolute rounded-lg shadow-lg cursor-move select-none transition-shadow hover:shadow-xl"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: pos.width,
                  height: pos.height,
                  backgroundColor: colors.bg,
                  border: `2px solid ${colors.border}`,
                  color: colors.text,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              >
                <div className="flex flex-col items-center justify-center h-full p-3 text-center">
                  <div className="font-semibold text-sm leading-tight">{node.label}</div>
                  {node.valueLabel && (
                    <div className="text-lg font-bold mt-1">{node.valueLabel}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function DiagramCanvas({
  title,
  description,
  diagramData,
  isOpen,
  onClose,
}: DiagramCanvasProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={cn(
          "bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200",
          isFullscreen ? "w-full h-full rounded-none" : "w-[95vw] h-[90vh] max-w-7xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 flex-shrink-0 bg-zinc-800">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-500/20 text-indigo-300 rounded">
              Diagram Editor
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

        {/* Canvas */}
        <Canvas diagramData={diagramData} />
      </div>
    </div>
  );
}

export default DiagramCanvas;

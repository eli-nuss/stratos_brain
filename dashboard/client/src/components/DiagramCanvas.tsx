import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  X, Maximize2, Minimize2, Download, ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, TrendingDown, Minus, Move, Edit3, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

type LayoutType = 'treemap' | 'hierarchy' | 'waterfall' | 'sankey' | 'comparison' | 'timeline';

interface DiagramNode {
  id: string;
  label: string;
  value?: number;
  valueLabel?: string;
  percentage?: number;
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral';
  parentId?: string;
  children?: string[];
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
  layoutType: LayoutType;
  title: string;
  subtitle?: string;
  totalValue?: number;
  totalLabel?: string;
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

const categoryColors: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  revenue: { bg: '#065f46', border: '#10b981', text: '#ecfdf5', gradient: 'from-emerald-600 to-emerald-800' },
  cost: { bg: '#7f1d1d', border: '#ef4444', text: '#fef2f2', gradient: 'from-red-600 to-red-800' },
  asset: { bg: '#1e3a8a', border: '#3b82f6', text: '#eff6ff', gradient: 'from-blue-600 to-blue-800' },
  metric: { bg: '#581c87', border: '#a855f7', text: '#faf5ff', gradient: 'from-purple-600 to-purple-800' },
  risk: { bg: '#7c2d12', border: '#f97316', text: '#fff7ed', gradient: 'from-orange-600 to-orange-800' },
  neutral: { bg: '#374151', border: '#6b7280', text: '#f9fafb', gradient: 'from-gray-600 to-gray-800' },
};

// ============ LAYOUT BADGE ============

const layoutLabels: Record<LayoutType, string> = {
  treemap: 'Treemap',
  hierarchy: 'Hierarchy',
  waterfall: 'Waterfall',
  sankey: 'Flow',
  comparison: 'Comparison',
  timeline: 'Timeline',
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

// ============ TREEMAP LAYOUT ============

function TreemapLayout({ 
  nodes, 
  totalValue,
  containerWidth,
  containerHeight,
  onNodeClick,
  editingNode,
  onEditChange,
  onEditSubmit
}: { 
  nodes: DiagramNode[];
  totalValue?: number;
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
  editingNode: string | null;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
}) {
  // Calculate treemap layout using simple squarified algorithm
  const treemapNodes = useMemo(() => {
    const total = totalValue || nodes.reduce((sum, n) => sum + (n.value || 0), 0);
    if (total === 0) return [];

    const padding = 8;
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;
    
    // Sort nodes by value descending
    const sortedNodes = [...nodes].sort((a, b) => (b.value || 0) - (a.value || 0));
    
    // Simple row-based layout
    const result: Array<DiagramNode & NodePosition> = [];
    let currentY = padding;
    let remainingNodes = [...sortedNodes];
    
    while (remainingNodes.length > 0) {
      // Determine how many nodes fit in this row
      const rowHeight = Math.min(
        (availableHeight - (currentY - padding)) / Math.ceil(remainingNodes.length / 3),
        150
      );
      
      // Calculate how many nodes to put in this row based on their values
      let rowNodes: DiagramNode[] = [];
      let rowValue = 0;
      const targetRowValue = total * (rowHeight / availableHeight);
      
      for (const node of remainingNodes) {
        if (rowNodes.length < 4 && (rowValue < targetRowValue || rowNodes.length === 0)) {
          rowNodes.push(node);
          rowValue += node.value || 0;
        } else {
          break;
        }
      }
      
      if (rowNodes.length === 0) break;
      
      // Layout nodes in this row
      let currentX = padding;
      for (const node of rowNodes) {
        const nodeRatio = (node.value || 0) / rowValue;
        const nodeWidth = Math.max(availableWidth * nodeRatio, 100);
        
        result.push({
          ...node,
          x: currentX,
          y: currentY,
          width: Math.min(nodeWidth, availableWidth - (currentX - padding)),
          height: rowHeight - 8,
        });
        
        currentX += nodeWidth + 8;
      }
      
      currentY += rowHeight;
      remainingNodes = remainingNodes.filter(n => !rowNodes.includes(n));
    }
    
    return result;
  }, [nodes, totalValue, containerWidth, containerHeight]);

  return (
    <div className="relative w-full h-full">
      {treemapNodes.map((node) => {
        const colors = categoryColors[node.category || 'neutral'];
        const isEditing = editingNode === node.id;
        
        return (
          <div
            key={node.id}
            className={cn(
              "absolute rounded-lg shadow-lg cursor-pointer transition-all duration-200",
              "hover:shadow-xl hover:scale-[1.02] hover:z-10",
              `bg-gradient-to-br ${colors.gradient}`
            )}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              border: `2px solid ${colors.border}`,
            }}
            onClick={() => onNodeClick(node.id)}
          >
            <div className="flex flex-col items-center justify-center h-full p-3 text-center">
              {isEditing ? (
                <div className="flex flex-col gap-2 w-full" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    defaultValue={node.label}
                    className="bg-black/30 border border-white/20 rounded px-2 py-1 text-sm text-white text-center"
                    onChange={(e) => onEditChange(e.target.value)}
                    autoFocus
                  />
                  <button 
                    onClick={onEditSubmit}
                    className="flex items-center justify-center gap-1 bg-white/20 hover:bg-white/30 rounded px-2 py-1 text-xs"
                  >
                    <Check className="w-3 h-3" /> Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="font-semibold text-sm leading-tight text-white drop-shadow-md">
                    {node.label}
                  </div>
                  {node.valueLabel && (
                    <div className="text-xl font-bold mt-1 text-white drop-shadow-md">
                      {node.valueLabel}
                    </div>
                  )}
                  {node.percentage !== undefined && (
                    <div className="text-xs mt-1 text-white/80">
                      {node.percentage}%
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ HIERARCHY LAYOUT ============

function HierarchyLayout({ 
  nodes, 
  connections,
  containerWidth,
  containerHeight,
  onNodeClick,
  editingNode,
  onEditChange,
  onEditSubmit
}: { 
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
  editingNode: string | null;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
}) {
  // Build hierarchy levels
  const hierarchyNodes = useMemo(() => {
    // Find root nodes (no parentId or parentId not in nodes)
    const nodeIds = new Set(nodes.map(n => n.id));
    const rootNodes = nodes.filter(n => !n.parentId || !nodeIds.has(n.parentId));
    
    // Build levels
    const levels: DiagramNode[][] = [rootNodes];
    let currentLevel = rootNodes;
    
    while (currentLevel.length > 0) {
      const nextLevel = nodes.filter(n => 
        currentLevel.some(parent => parent.id === n.parentId)
      );
      if (nextLevel.length > 0) {
        levels.push(nextLevel);
        currentLevel = nextLevel;
      } else {
        break;
      }
    }
    
    // If no hierarchy found, create simple levels
    if (levels.length === 1 && levels[0].length === nodes.length) {
      const cols = Math.ceil(Math.sqrt(nodes.length));
      const rows = Math.ceil(nodes.length / cols);
      levels.length = 0;
      for (let i = 0; i < rows; i++) {
        levels.push(nodes.slice(i * cols, (i + 1) * cols));
      }
    }
    
    // Position nodes
    const result: Array<DiagramNode & NodePosition> = [];
    const nodeWidth = 160;
    const nodeHeight = 80;
    const levelHeight = containerHeight / (levels.length + 1);
    
    levels.forEach((level, levelIndex) => {
      const levelWidth = level.length * (nodeWidth + 40);
      const startX = (containerWidth - levelWidth) / 2 + 20;
      
      level.forEach((node, nodeIndex) => {
        result.push({
          ...node,
          x: startX + nodeIndex * (nodeWidth + 40),
          y: 60 + levelIndex * levelHeight,
          width: nodeWidth,
          height: nodeHeight,
        });
      });
    });
    
    return result;
  }, [nodes, containerWidth, containerHeight]);

  // Calculate connection paths
  const connectionPaths = useMemo(() => {
    return connections.map(conn => {
      const fromNode = hierarchyNodes.find(n => n.id === conn.from);
      const toNode = hierarchyNodes.find(n => n.id === conn.to);
      if (!fromNode || !toNode) return null;
      
      const fromX = fromNode.x + fromNode.width / 2;
      const fromY = fromNode.y + fromNode.height;
      const toX = toNode.x + toNode.width / 2;
      const toY = toNode.y;
      
      const midY = (fromY + toY) / 2;
      
      return {
        path: `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`,
        label: conn.label,
        labelX: (fromX + toX) / 2,
        labelY: midY,
      };
    }).filter(Boolean);
  }, [hierarchyNodes, connections]);

  return (
    <div className="relative w-full h-full">
      {/* Connections */}
      <svg className="absolute inset-0 pointer-events-none">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
          </marker>
        </defs>
        {connectionPaths.map((conn, i) => conn && (
          <g key={i}>
            <path
              d={conn.path}
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            {conn.label && (
              <text
                x={conn.labelX}
                y={conn.labelY}
                textAnchor="middle"
                className="fill-zinc-400 text-xs"
              >
                {conn.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      
      {/* Nodes */}
      {hierarchyNodes.map((node) => {
        const colors = categoryColors[node.category || 'neutral'];
        const isEditing = editingNode === node.id;
        
        return (
          <div
            key={node.id}
            className={cn(
              "absolute rounded-lg shadow-lg cursor-pointer transition-all duration-200",
              "hover:shadow-xl hover:scale-105 hover:z-10",
              `bg-gradient-to-br ${colors.gradient}`
            )}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              border: `2px solid ${colors.border}`,
            }}
            onClick={() => onNodeClick(node.id)}
          >
            <div className="flex flex-col items-center justify-center h-full p-2 text-center">
              <div className="font-semibold text-sm leading-tight text-white drop-shadow-md">
                {node.label}
              </div>
              {node.valueLabel && (
                <div className="text-lg font-bold mt-1 text-white drop-shadow-md">
                  {node.valueLabel}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ WATERFALL LAYOUT ============

function WaterfallLayout({ 
  nodes, 
  containerWidth,
  containerHeight,
  onNodeClick,
}: { 
  nodes: DiagramNode[];
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
}) {
  const waterfallData = useMemo(() => {
    const barWidth = Math.min(120, (containerWidth - 100) / nodes.length - 20);
    const maxValue = Math.max(...nodes.map(n => Math.abs(n.value || 0)));
    const chartHeight = containerHeight - 120;
    const baselineY = containerHeight - 60;
    
    let runningTotal = 0;
    
    return nodes.map((node, index) => {
      const value = node.value || 0;
      const barHeight = (Math.abs(value) / maxValue) * (chartHeight * 0.7);
      const isPositive = value >= 0;
      
      const x = 50 + index * (barWidth + 20);
      const previousTotal = runningTotal;
      runningTotal += value;
      
      // For waterfall, bars start from the previous running total
      const barY = isPositive 
        ? baselineY - (previousTotal / maxValue) * (chartHeight * 0.7) - barHeight
        : baselineY - (previousTotal / maxValue) * (chartHeight * 0.7);
      
      return {
        ...node,
        x,
        y: barY,
        width: barWidth,
        height: barHeight,
        isPositive,
        runningTotal,
      };
    });
  }, [nodes, containerWidth, containerHeight]);

  return (
    <div className="relative w-full h-full">
      {/* Baseline */}
      <div 
        className="absolute left-0 right-0 h-px bg-zinc-600"
        style={{ bottom: 60 }}
      />
      
      {/* Bars */}
      {waterfallData.map((node, index) => {
        const colors = node.isPositive 
          ? categoryColors.revenue 
          : categoryColors.cost;
        
        return (
          <div key={node.id}>
            {/* Connector line */}
            {index > 0 && (
              <div
                className="absolute h-px bg-zinc-500"
                style={{
                  left: waterfallData[index - 1].x + waterfallData[index - 1].width,
                  top: node.isPositive ? node.y + node.height : node.y,
                  width: 20,
                }}
              />
            )}
            
            {/* Bar */}
            <div
              className={cn(
                "absolute rounded-t-lg cursor-pointer transition-all duration-200",
                "hover:opacity-90",
                `bg-gradient-to-t ${colors.gradient}`
              )}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                border: `2px solid ${colors.border}`,
              }}
              onClick={() => onNodeClick(node.id)}
            >
              <div className="absolute -top-6 left-0 right-0 text-center">
                <span className="text-sm font-bold text-white">
                  {node.valueLabel}
                </span>
              </div>
            </div>
            
            {/* Label */}
            <div
              className="absolute text-center"
              style={{
                left: node.x,
                bottom: 20,
                width: node.width,
              }}
            >
              <span className="text-xs text-zinc-400 truncate block">
                {node.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ COMPARISON LAYOUT ============

function ComparisonLayout({ 
  nodes, 
  containerWidth,
  containerHeight,
  onNodeClick,
}: { 
  nodes: DiagramNode[];
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
}) {
  const comparisonData = useMemo(() => {
    const maxValue = Math.max(...nodes.map(n => n.value || 0));
    const barWidth = Math.min(100, (containerWidth - 100) / nodes.length - 30);
    const chartHeight = containerHeight - 100;
    
    return nodes.map((node, index) => {
      const value = node.value || 0;
      const barHeight = (value / maxValue) * (chartHeight * 0.8);
      
      return {
        ...node,
        x: 50 + index * (barWidth + 30),
        y: chartHeight - barHeight + 20,
        width: barWidth,
        height: barHeight,
      };
    });
  }, [nodes, containerWidth, containerHeight]);

  return (
    <div className="relative w-full h-full">
      {comparisonData.map((node) => {
        const colors = categoryColors[node.category || 'neutral'];
        
        return (
          <div key={node.id}>
            {/* Bar */}
            <div
              className={cn(
                "absolute rounded-t-lg cursor-pointer transition-all duration-200",
                "hover:opacity-90 hover:scale-105",
                `bg-gradient-to-t ${colors.gradient}`
              )}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                border: `2px solid ${colors.border}`,
              }}
              onClick={() => onNodeClick(node.id)}
            >
              {/* Value label on bar */}
              <div className="absolute -top-8 left-0 right-0 text-center">
                <span className="text-sm font-bold text-white">
                  {node.valueLabel}
                </span>
              </div>
              {node.percentage !== undefined && (
                <div className="absolute top-2 left-0 right-0 text-center">
                  <span className="text-xs text-white/80 bg-black/20 px-1 rounded">
                    {node.percentage}%
                  </span>
                </div>
              )}
            </div>
            
            {/* Label */}
            <div
              className="absolute text-center"
              style={{
                left: node.x,
                bottom: 10,
                width: node.width,
              }}
            >
              <span className="text-xs text-zinc-400 truncate block">
                {node.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ MAIN CANVAS COMPONENT ============

function Canvas({ diagramData }: { diagramData?: DiagramData }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  // Measure container
  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setEditingNode(nodeId);
  }, []);

  const handleEditSubmit = useCallback(() => {
    // In a real implementation, this would update the node
    setEditingNode(null);
    setEditValue('');
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

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 2));
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
      link.download = `${diagramData?.title || 'diagram'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error exporting to PNG:', err);
    }
  }, [diagramData?.title]);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  if (!diagramData?.nodes) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500">
        No diagram data available
      </div>
    );
  }

  const layoutType = diagramData.layoutType || 'treemap';

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
        <span className="px-2 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded">
          {layoutLabels[layoutType]}
        </span>
        <div className="w-px h-4 bg-zinc-700" />
        <button
          onClick={() => setZoom(z => Math.min(z * 1.2, 2))}
          className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-zinc-400" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z * 0.8, 0.5))}
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
          <Edit3 className="w-3 h-3" />
          <span>Click nodes to edit</span>
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
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid background */}
        <div 
          className="absolute inset-0 canvas-bg pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Content layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {layoutType === 'treemap' && (
            <TreemapLayout
              nodes={diagramData.nodes}
              totalValue={diagramData.totalValue}
              containerWidth={containerSize.width / zoom}
              containerHeight={containerSize.height / zoom}
              onNodeClick={handleNodeClick}
              editingNode={editingNode}
              onEditChange={setEditValue}
              onEditSubmit={handleEditSubmit}
            />
          )}
          
          {layoutType === 'hierarchy' && (
            <HierarchyLayout
              nodes={diagramData.nodes}
              connections={diagramData.connections}
              containerWidth={containerSize.width / zoom}
              containerHeight={containerSize.height / zoom}
              onNodeClick={handleNodeClick}
              editingNode={editingNode}
              onEditChange={setEditValue}
              onEditSubmit={handleEditSubmit}
            />
          )}
          
          {layoutType === 'waterfall' && (
            <WaterfallLayout
              nodes={diagramData.nodes}
              containerWidth={containerSize.width / zoom}
              containerHeight={containerSize.height / zoom}
              onNodeClick={handleNodeClick}
            />
          )}
          
          {(layoutType === 'comparison' || layoutType === 'sankey' || layoutType === 'timeline') && (
            <ComparisonLayout
              nodes={diagramData.nodes}
              containerWidth={containerSize.width / zoom}
              containerHeight={containerSize.height / zoom}
              onNodeClick={handleNodeClick}
            />
          )}
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
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-white">{diagramData?.title || title}</h3>
            {(diagramData?.subtitle || description) && (
              <p className="text-xs text-zinc-400 mt-0.5">{diagramData?.subtitle || description}</p>
            )}
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

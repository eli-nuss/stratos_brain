import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  X, Maximize2, Minimize2, Download, ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, TrendingDown, Minus, Edit3, Check, Sun, Moon, Palette,
  Share2, Copy, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

type LayoutType = 'treemap' | 'hierarchy' | 'waterfall' | 'sankey' | 'comparison' | 'timeline';
type ThemeMode = 'dark' | 'light';
type ColorScheme = 'default' | 'vibrant' | 'pastel' | 'monochrome';
type ExportSize = 'small' | 'medium' | 'large';

interface DiagramNode {
  id: string;
  label: string;
  value?: number;
  valueLabel?: string;
  percentage?: number;
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral';
  parentId?: string;
  children?: string[];
  color?: string; // Custom color override
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
  onTitleChange?: (title: string) => void;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============ COLOR SCHEMES ============

const colorSchemes: Record<ColorScheme, Record<string, { bg: string; border: string; text: string; hover: string }>> = {
  default: {
    revenue: { bg: '#065f46', border: '#10b981', text: '#ecfdf5', hover: '#047857' },
    cost: { bg: '#7f1d1d', border: '#ef4444', text: '#fef2f2', hover: '#991b1b' },
    asset: { bg: '#1e3a8a', border: '#3b82f6', text: '#eff6ff', hover: '#1e40af' },
    metric: { bg: '#581c87', border: '#a855f7', text: '#faf5ff', hover: '#6b21a8' },
    risk: { bg: '#7c2d12', border: '#f97316', text: '#fff7ed', hover: '#9a3412' },
    neutral: { bg: '#374151', border: '#6b7280', text: '#f9fafb', hover: '#4b5563' },
  },
  vibrant: {
    revenue: { bg: '#059669', border: '#34d399', text: '#ffffff', hover: '#10b981' },
    cost: { bg: '#dc2626', border: '#f87171', text: '#ffffff', hover: '#ef4444' },
    asset: { bg: '#2563eb', border: '#60a5fa', text: '#ffffff', hover: '#3b82f6' },
    metric: { bg: '#7c3aed', border: '#a78bfa', text: '#ffffff', hover: '#8b5cf6' },
    risk: { bg: '#ea580c', border: '#fb923c', text: '#ffffff', hover: '#f97316' },
    neutral: { bg: '#4b5563', border: '#9ca3af', text: '#ffffff', hover: '#6b7280' },
  },
  pastel: {
    revenue: { bg: '#a7f3d0', border: '#6ee7b7', text: '#064e3b', hover: '#6ee7b7' },
    cost: { bg: '#fecaca', border: '#fca5a5', text: '#7f1d1d', hover: '#fca5a5' },
    asset: { bg: '#bfdbfe', border: '#93c5fd', text: '#1e3a8a', hover: '#93c5fd' },
    metric: { bg: '#ddd6fe', border: '#c4b5fd', text: '#4c1d95', hover: '#c4b5fd' },
    risk: { bg: '#fed7aa', border: '#fdba74', text: '#7c2d12', hover: '#fdba74' },
    neutral: { bg: '#e5e7eb', border: '#d1d5db', text: '#1f2937', hover: '#d1d5db' },
  },
  monochrome: {
    revenue: { bg: '#1f2937', border: '#4b5563', text: '#f9fafb', hover: '#374151' },
    cost: { bg: '#374151', border: '#6b7280', text: '#f9fafb', hover: '#4b5563' },
    asset: { bg: '#4b5563', border: '#9ca3af', text: '#f9fafb', hover: '#6b7280' },
    metric: { bg: '#6b7280', border: '#d1d5db', text: '#f9fafb', hover: '#9ca3af' },
    risk: { bg: '#9ca3af', border: '#e5e7eb', text: '#1f2937', hover: '#d1d5db' },
    neutral: { bg: '#d1d5db', border: '#f3f4f6', text: '#1f2937', hover: '#e5e7eb' },
  },
};

// Generate unique colors for each node based on index
const getNodeColor = (index: number, total: number, scheme: ColorScheme, category?: string) => {
  if (category && colorSchemes[scheme][category]) {
    // Vary the shade based on index for same-category nodes
    const baseColors = colorSchemes[scheme][category];
    const hueShift = (index / total) * 20 - 10; // -10 to +10 degree shift
    return baseColors;
  }
  
  // Generate distinct colors for nodes without category
  const hue = (index / total) * 360;
  return {
    bg: `hsl(${hue}, 60%, 35%)`,
    border: `hsl(${hue}, 70%, 50%)`,
    text: '#ffffff',
    hover: `hsl(${hue}, 65%, 40%)`,
  };
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

function MetricsPanel({ metrics, theme }: { metrics: DiagramMetric[]; theme: ThemeMode }) {
  return (
    <div className={cn(
      "flex flex-wrap gap-3 p-4 border-b",
      theme === 'dark' ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-100 border-gray-200"
    )}>
      {metrics.map((metric, index) => (
        <div 
          key={index}
          className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-lg border",
            theme === 'dark' 
              ? "bg-zinc-900/50 border-zinc-700" 
              : "bg-white border-gray-200 shadow-sm"
          )}
        >
          <div>
            <div className={cn(
              "text-[10px] uppercase tracking-wider",
              theme === 'dark' ? "text-zinc-500" : "text-gray-500"
            )}>{metric.label}</div>
            <div className={cn(
              "text-lg font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{metric.value}</div>
          </div>
          {metric.change && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
              metric.trend === 'up' && "bg-emerald-500/20 text-emerald-500",
              metric.trend === 'down' && "bg-red-500/20 text-red-500",
              metric.trend === 'neutral' && "bg-zinc-500/20 text-zinc-500",
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

// ============ TOOLTIP ============

interface TooltipProps {
  node: DiagramNode;
  position: { x: number; y: number };
  theme: ThemeMode;
}

function Tooltip({ node, position, theme }: TooltipProps) {
  return (
    <div
      className={cn(
        "fixed z-[100] px-3 py-2 rounded-lg shadow-xl pointer-events-none",
        "transform -translate-x-1/2 -translate-y-full",
        theme === 'dark' 
          ? "bg-zinc-800 border border-zinc-600 text-white" 
          : "bg-white border border-gray-200 text-gray-900"
      )}
      style={{
        left: position.x,
        top: position.y - 10,
      }}
    >
      <div className="font-semibold text-sm">{node.label}</div>
      {node.valueLabel && (
        <div className="text-lg font-bold">{node.valueLabel}</div>
      )}
      {node.percentage !== undefined && (
        <div className={cn(
          "text-xs",
          theme === 'dark' ? "text-zinc-400" : "text-gray-500"
        )}>
          {node.percentage}% of total
        </div>
      )}
      {node.category && (
        <div className={cn(
          "text-xs mt-1 capitalize",
          theme === 'dark' ? "text-zinc-500" : "text-gray-400"
        )}>
          Category: {node.category}
        </div>
      )}
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
  onNodeHover,
  hoveredNode,
  editingNode,
  onEditChange,
  onEditSubmit,
  theme,
  colorScheme,
}: { 
  nodes: DiagramNode[];
  totalValue?: number;
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null, event?: React.MouseEvent) => void;
  hoveredNode: string | null;
  editingNode: string | null;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
  theme: ThemeMode;
  colorScheme: ColorScheme;
}) {
  // Calculate treemap layout using simple squarified algorithm
  const treemapNodes = useMemo(() => {
    const total = totalValue || nodes.reduce((sum, n) => sum + (n.value || 0), 0);
    if (total === 0) return [];

    const padding = 8;
    const gap = 4; // Gap between nodes
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;
    
    // Sort nodes by value descending
    const sortedNodes = [...nodes].sort((a, b) => (b.value || 0) - (a.value || 0));
    
    // Simple row-based layout with gaps
    const result: Array<DiagramNode & NodePosition & { colorIndex: number }> = [];
    let currentY = padding;
    let remainingNodes = [...sortedNodes];
    let colorIndex = 0;
    
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
      
      // Layout nodes in this row with gaps
      let currentX = padding;
      for (const node of rowNodes) {
        const nodeRatio = (node.value || 0) / rowValue;
        const nodeWidth = Math.max((availableWidth - gap * (rowNodes.length - 1)) * nodeRatio, 80);
        
        result.push({
          ...node,
          x: currentX,
          y: currentY,
          width: Math.min(nodeWidth, availableWidth - (currentX - padding)),
          height: rowHeight - gap,
          colorIndex: colorIndex++,
        });
        
        currentX += nodeWidth + gap;
      }
      
      currentY += rowHeight;
      remainingNodes = remainingNodes.filter(n => !rowNodes.includes(n));
    }
    
    return result;
  }, [nodes, totalValue, containerWidth, containerHeight]);

  return (
    <div className="relative w-full h-full">
      {treemapNodes.map((node) => {
        const colors = getNodeColor(node.colorIndex, treemapNodes.length, colorScheme, node.category);
        const isEditing = editingNode === node.id;
        const isHovered = hoveredNode === node.id;
        
        return (
          <div
            key={node.id}
            className={cn(
              "absolute rounded-lg cursor-pointer transition-all duration-200",
              isHovered && "shadow-2xl z-20 scale-[1.03]",
              !isHovered && "shadow-lg hover:shadow-xl"
            )}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              backgroundColor: isHovered ? colors.hover : colors.bg,
              border: `3px solid ${colors.border}`,
              color: colors.text,
            }}
            onClick={() => onNodeClick(node.id)}
            onMouseEnter={(e) => onNodeHover(node.id, e)}
            onMouseLeave={() => onNodeHover(null)}
          >
            <div className="flex flex-col items-center justify-center h-full p-3 text-center">
              {isEditing ? (
                <div className="flex flex-col gap-2 w-full" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    defaultValue={node.label}
                    className="bg-black/30 border border-white/20 rounded px-2 py-1 text-sm text-center"
                    style={{ color: colors.text }}
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
                  <div className="font-semibold text-sm leading-tight drop-shadow-md">
                    {node.label}
                  </div>
                  {node.valueLabel && (
                    <div className="text-xl font-bold mt-1 drop-shadow-md">
                      {node.valueLabel}
                    </div>
                  )}
                  {node.percentage !== undefined && (
                    <div className="text-xs mt-1 opacity-80">
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

// ============ WATERFALL LAYOUT ============

function WaterfallLayout({ 
  nodes, 
  containerWidth,
  containerHeight,
  onNodeClick,
  onNodeHover,
  hoveredNode,
  theme,
  colorScheme,
}: { 
  nodes: DiagramNode[];
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null, event?: React.MouseEvent) => void;
  hoveredNode: string | null;
  theme: ThemeMode;
  colorScheme: ColorScheme;
}) {
  const waterfallData = useMemo(() => {
    const padding = 40;
    const barWidth = Math.min(80, (containerWidth - padding * 2) / nodes.length - 20);
    const chartHeight = containerHeight - 100;
    
    // Find max absolute value for scaling
    const maxValue = Math.max(...nodes.map(n => Math.abs(n.value || 0)));
    const scale = (chartHeight * 0.4) / maxValue;
    
    let runningTotal = 0;
    const baseline = chartHeight / 2 + 20;
    
    return nodes.map((node, index) => {
      const value = node.value || 0;
      const isPositive = value >= 0;
      const barHeight = Math.abs(value) * scale;
      
      const prevTotal = runningTotal;
      runningTotal += value;
      
      return {
        ...node,
        x: padding + index * (barWidth + 20),
        y: isPositive ? baseline - barHeight : baseline,
        width: barWidth,
        height: barHeight,
        isPositive,
        prevTotal,
        runningTotal,
        colorIndex: index,
      };
    });
  }, [nodes, containerWidth, containerHeight]);

  return (
    <div className="relative w-full h-full">
      {/* Baseline */}
      <div
        className={cn(
          "absolute h-px",
          theme === 'dark' ? "bg-zinc-600" : "bg-gray-300"
        )}
        style={{
          left: 20,
          right: 20,
          top: containerHeight / 2 + 20,
        }}
      />
      
      {waterfallData.map((node, index) => {
        const colors = getNodeColor(node.colorIndex, waterfallData.length, colorScheme, 
          node.isPositive ? 'revenue' : 'cost');
        const isHovered = hoveredNode === node.id;
        
        return (
          <div key={node.id}>
            {/* Connector line */}
            {index > 0 && (
              <div
                className={cn(
                  "absolute h-px",
                  theme === 'dark' ? "bg-zinc-500" : "bg-gray-400"
                )}
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
                isHovered && "shadow-xl scale-105 z-10"
              )}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                backgroundColor: isHovered ? colors.hover : colors.bg,
                border: `2px solid ${colors.border}`,
              }}
              onClick={() => onNodeClick(node.id)}
              onMouseEnter={(e) => onNodeHover(node.id, e)}
              onMouseLeave={() => onNodeHover(null)}
            >
              <div className="absolute -top-6 left-0 right-0 text-center">
                <span className={cn(
                  "text-sm font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
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
              <span className={cn(
                "text-xs truncate block",
                theme === 'dark' ? "text-zinc-400" : "text-gray-600"
              )}>
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
  onNodeHover,
  hoveredNode,
  theme,
  colorScheme,
}: { 
  nodes: DiagramNode[];
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null, event?: React.MouseEvent) => void;
  hoveredNode: string | null;
  theme: ThemeMode;
  colorScheme: ColorScheme;
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
        colorIndex: index,
      };
    });
  }, [nodes, containerWidth, containerHeight]);

  return (
    <div className="relative w-full h-full">
      {comparisonData.map((node) => {
        const colors = getNodeColor(node.colorIndex, comparisonData.length, colorScheme, node.category);
        const isHovered = hoveredNode === node.id;
        
        return (
          <div key={node.id}>
            {/* Bar */}
            <div
              className={cn(
                "absolute rounded-t-lg cursor-pointer transition-all duration-200",
                isHovered && "shadow-xl scale-105 z-10"
              )}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                backgroundColor: isHovered ? colors.hover : colors.bg,
                border: `2px solid ${colors.border}`,
              }}
              onClick={() => onNodeClick(node.id)}
              onMouseEnter={(e) => onNodeHover(node.id, e)}
              onMouseLeave={() => onNodeHover(null)}
            >
              {/* Value label on bar */}
              <div className="absolute -top-8 left-0 right-0 text-center">
                <span className={cn(
                  "text-sm font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
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
              <span className={cn(
                "text-xs truncate block",
                theme === 'dark' ? "text-zinc-400" : "text-gray-600"
              )}>
                {node.label}
              </span>
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
  onNodeHover,
  hoveredNode,
  editingNode,
  onEditChange,
  onEditSubmit,
  theme,
  colorScheme,
}: { 
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  containerWidth: number;
  containerHeight: number;
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null, event?: React.MouseEvent) => void;
  hoveredNode: string | null;
  editingNode: string | null;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
  theme: ThemeMode;
  colorScheme: ColorScheme;
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
    
    // If no hierarchy found, create simple grid
    if (levels.length === 1 && levels[0].length === nodes.length && nodes.length > 1) {
      const cols = Math.ceil(Math.sqrt(nodes.length));
      levels.length = 0;
      for (let i = 0; i < nodes.length; i += cols) {
        levels.push(nodes.slice(i, i + cols));
      }
    }
    
    // Calculate positions
    const padding = 40;
    const levelHeight = (containerHeight - padding * 2) / Math.max(levels.length, 1);
    const nodeWidth = 160;
    const nodeHeight = 80;
    
    const result: Array<DiagramNode & NodePosition & { colorIndex: number }> = [];
    let colorIndex = 0;
    
    levels.forEach((level, levelIndex) => {
      const levelWidth = level.length * nodeWidth + (level.length - 1) * 40;
      const startX = (containerWidth - levelWidth) / 2;
      
      level.forEach((node, nodeIndex) => {
        result.push({
          ...node,
          x: startX + nodeIndex * (nodeWidth + 40),
          y: padding + levelIndex * levelHeight,
          width: nodeWidth,
          height: nodeHeight,
          colorIndex: colorIndex++,
        });
      });
    });
    
    return result;
  }, [nodes, containerWidth, containerHeight]);

  // Get node position by id
  const getNodePosition = useCallback((id: string) => {
    return hierarchyNodes.find(n => n.id === id);
  }, [hierarchyNodes]);

  return (
    <div className="relative w-full h-full">
      {/* Connection lines */}
      <svg className="absolute inset-0 pointer-events-none">
        {connections.map((conn, index) => {
          const fromNode = getNodePosition(conn.from);
          const toNode = getNodePosition(conn.to);
          if (!fromNode || !toNode) return null;
          
          const x1 = fromNode.x + fromNode.width / 2;
          const y1 = fromNode.y + fromNode.height;
          const x2 = toNode.x + toNode.width / 2;
          const y2 = toNode.y;
          
          return (
            <g key={index}>
              <path
                d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                fill="none"
                stroke={theme === 'dark' ? '#6b7280' : '#9ca3af'}
                strokeWidth="2"
                strokeDasharray="4"
              />
              {conn.label && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2}
                  textAnchor="middle"
                  className={cn(
                    "text-xs",
                    theme === 'dark' ? "fill-zinc-400" : "fill-gray-500"
                  )}
                >
                  {conn.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      
      {/* Nodes */}
      {hierarchyNodes.map((node) => {
        const colors = getNodeColor(node.colorIndex, hierarchyNodes.length, colorScheme, node.category);
        const isEditing = editingNode === node.id;
        const isHovered = hoveredNode === node.id;
        
        return (
          <div
            key={node.id}
            className={cn(
              "absolute rounded-lg cursor-pointer transition-all duration-200",
              isHovered && "shadow-2xl z-20 scale-105"
            )}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
              backgroundColor: isHovered ? colors.hover : colors.bg,
              border: `2px solid ${colors.border}`,
              color: colors.text,
            }}
            onClick={() => onNodeClick(node.id)}
            onMouseEnter={(e) => onNodeHover(node.id, e)}
            onMouseLeave={() => onNodeHover(null)}
          >
            <div className="flex flex-col items-center justify-center h-full p-2 text-center">
              {isEditing ? (
                <div className="flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    defaultValue={node.label}
                    className="bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-center"
                    onChange={(e) => onEditChange(e.target.value)}
                    autoFocus
                  />
                  <button 
                    onClick={onEditSubmit}
                    className="flex items-center justify-center gap-1 bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 text-xs"
                  >
                    <Check className="w-3 h-3" /> Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="font-semibold text-sm leading-tight">
                    {node.label}
                  </div>
                  {node.valueLabel && (
                    <div className="text-base font-bold mt-1">
                      {node.valueLabel}
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

// ============ SETTINGS PANEL ============

interface SettingsPanelProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  exportSize: ExportSize;
  setExportSize: (size: ExportSize) => void;
}

function SettingsPanel({ 
  theme, setTheme, 
  colorScheme, setColorScheme,
  exportSize, setExportSize 
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-1.5 rounded transition-colors",
          theme === 'dark' ? "hover:bg-zinc-700" : "hover:bg-gray-200"
        )}
        title="Settings"
      >
        <Palette className={cn(
          "w-4 h-4",
          theme === 'dark' ? "text-zinc-400" : "text-gray-600"
        )} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className={cn(
            "absolute right-0 top-full mt-2 w-64 rounded-lg shadow-xl z-50 p-4",
            theme === 'dark' 
              ? "bg-zinc-800 border border-zinc-700" 
              : "bg-white border border-gray-200"
          )}>
            {/* Theme Toggle */}
            <div className="mb-4">
              <label className={cn(
                "text-xs font-medium mb-2 block",
                theme === 'dark' ? "text-zinc-400" : "text-gray-600"
              )}>Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    theme === 'dark' 
                      ? "bg-indigo-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    theme === 'light' 
                      ? "bg-indigo-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <Sun className="w-4 h-4" /> Light
                </button>
              </div>
            </div>
            
            {/* Color Scheme */}
            <div className="mb-4">
              <label className={cn(
                "text-xs font-medium mb-2 block",
                theme === 'dark' ? "text-zinc-400" : "text-gray-600"
              )}>Color Scheme</label>
              <div className="grid grid-cols-2 gap-2">
                {(['default', 'vibrant', 'pastel', 'monochrome'] as ColorScheme[]).map((scheme) => (
                  <button
                    key={scheme}
                    onClick={() => setColorScheme(scheme)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs capitalize transition-colors",
                      colorScheme === scheme
                        ? "bg-indigo-600 text-white"
                        : theme === 'dark'
                          ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {scheme}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Export Size */}
            <div>
              <label className={cn(
                "text-xs font-medium mb-2 block",
                theme === 'dark' ? "text-zinc-400" : "text-gray-600"
              )}>Export Size</label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as ExportSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setExportSize(size)}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg text-xs capitalize transition-colors",
                      exportSize === size
                        ? "bg-indigo-600 text-white"
                        : theme === 'dark'
                          ? "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ MAIN CANVAS COMPONENT ============

function Canvas({ 
  diagramData,
  theme,
  colorScheme,
  exportSize,
  onExport,
}: { 
  diagramData?: DiagramData;
  theme: ThemeMode;
  colorScheme: ColorScheme;
  exportSize: ExportSize;
  onExport: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

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

  const handleNodeHover = useCallback((nodeId: string | null, event?: React.MouseEvent) => {
    setHoveredNode(nodeId);
    if (event && nodeId) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const handleEditSubmit = useCallback(() => {
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
    if (hoveredNode) {
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, panStart, hoveredNode]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 2));
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  if (!diagramData?.nodes) {
    return (
      <div className={cn(
        "flex-1 flex items-center justify-center",
        theme === 'dark' ? "text-zinc-500" : "text-gray-400"
      )}>
        No diagram data available
      </div>
    );
  }

  const layoutType = diagramData.layoutType || 'treemap';
  const hoveredNodeData = hoveredNode ? diagramData.nodes.find(n => n.id === hoveredNode) : null;

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 border-b",
        theme === 'dark' ? "bg-zinc-800/50 border-zinc-700" : "bg-gray-50 border-gray-200"
      )}>
        <span className="px-2 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-400 rounded">
          {layoutLabels[layoutType]}
        </span>
        <div className={cn(
          "w-px h-4",
          theme === 'dark' ? "bg-zinc-700" : "bg-gray-300"
        )} />
        <button
          onClick={() => setZoom(z => Math.min(z * 1.2, 2))}
          className={cn(
            "p-1.5 rounded transition-colors",
            theme === 'dark' ? "hover:bg-zinc-700" : "hover:bg-gray-200"
          )}
          title="Zoom In"
        >
          <ZoomIn className={cn(
            "w-4 h-4",
            theme === 'dark' ? "text-zinc-400" : "text-gray-600"
          )} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z * 0.8, 0.5))}
          className={cn(
            "p-1.5 rounded transition-colors",
            theme === 'dark' ? "hover:bg-zinc-700" : "hover:bg-gray-200"
          )}
          title="Zoom Out"
        >
          <ZoomOut className={cn(
            "w-4 h-4",
            theme === 'dark' ? "text-zinc-400" : "text-gray-600"
          )} />
        </button>
        <span className={cn(
          "text-xs min-w-[50px] text-center",
          theme === 'dark' ? "text-zinc-500" : "text-gray-500"
        )}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={resetView}
          className={cn(
            "p-1.5 rounded transition-colors",
            theme === 'dark' ? "hover:bg-zinc-700" : "hover:bg-gray-200"
          )}
          title="Reset View"
        >
          <RotateCcw className={cn(
            "w-4 h-4",
            theme === 'dark' ? "text-zinc-400" : "text-gray-600"
          )} />
        </button>
        <div className="flex-1" />
        <div className={cn(
          "flex items-center gap-1 text-xs",
          theme === 'dark' ? "text-zinc-500" : "text-gray-500"
        )}>
          <Edit3 className="w-3 h-3" />
          <span>Click nodes to edit</span>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium text-white transition-colors"
        >
          <Download className="w-3 h-3" />
          Export PNG
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className={cn(
          "flex-1 relative overflow-hidden canvas-bg",
          theme === 'dark' ? "bg-zinc-900" : "bg-gray-100"
        )}
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
            backgroundImage: theme === 'dark' 
              ? `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`
              : `linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)`,
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
              onNodeHover={handleNodeHover}
              hoveredNode={hoveredNode}
              editingNode={editingNode}
              onEditChange={setEditValue}
              onEditSubmit={handleEditSubmit}
              theme={theme}
              colorScheme={colorScheme}
            />
          )}
          
          {layoutType === 'hierarchy' && (
            <HierarchyLayout
              nodes={diagramData.nodes}
              connections={diagramData.connections}
              containerWidth={containerSize.width / zoom}
              containerHeight={containerSize.height / zoom}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              hoveredNode={hoveredNode}
              editingNode={editingNode}
              onEditChange={setEditValue}
              onEditSubmit={handleEditSubmit}
              theme={theme}
              colorScheme={colorScheme}
            />
          )}
          
          {layoutType === 'waterfall' && (
            <WaterfallLayout
              nodes={diagramData.nodes}
              containerWidth={containerSize.width / zoom}
              containerHeight={containerSize.height / zoom}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              hoveredNode={hoveredNode}
              theme={theme}
              colorScheme={colorScheme}
            />
          )}
          
          {(layoutType === 'comparison' || layoutType === 'sankey' || layoutType === 'timeline') && (
            <ComparisonLayout
              nodes={diagramData.nodes}
              containerWidth={containerSize.width / zoom}
              containerHeight={containerSize.height / zoom}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              hoveredNode={hoveredNode}
              theme={theme}
              colorScheme={colorScheme}
            />
          )}
        </div>
      </div>
      
      {/* Tooltip */}
      {hoveredNodeData && (
        <Tooltip 
          node={hoveredNodeData} 
          position={tooltipPosition}
          theme={theme}
        />
      )}
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
  onTitleChange,
}: DiagramCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
  const [exportSize, setExportSize] = useState<ExportSize>('medium');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(diagramData?.title || title);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Export to PNG
  const exportToPng = useCallback(async () => {
    const canvasElement = document.querySelector('.canvas-bg') as HTMLElement;
    if (!canvasElement) return;
    
    const scaleMap: Record<ExportSize, number> = {
      small: 1,
      medium: 2,
      large: 3,
    };
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: theme === 'dark' ? '#18181b' : '#f3f4f6',
        scale: scaleMap[exportSize],
      });
      
      const link = document.createElement('a');
      link.download = `${diagramData?.title || 'diagram'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error exporting to PNG:', err);
    }
  }, [diagramData?.title, theme, exportSize]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    const canvasElement = document.querySelector('.canvas-bg') as HTMLElement;
    if (!canvasElement) return;
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(canvasElement, {
        backgroundColor: theme === 'dark' ? '#18181b' : '#f3f4f6',
        scale: 2,
      });
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        }
      });
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  }, [theme]);

  // Handle title save
  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false);
    if (onTitleChange && editedTitle !== (diagramData?.title || title)) {
      onTitleChange(editedTitle);
    }
  }, [editedTitle, diagramData?.title, title, onTitleChange]);

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
        ref={canvasRef}
        className={cn(
          "border rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200",
          isFullscreen ? "w-full h-full rounded-none" : "w-[95vw] h-[90vh] max-w-7xl",
          theme === 'dark' 
            ? "bg-zinc-900 border-zinc-700" 
            : "bg-white border-gray-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3 border-b flex-shrink-0",
          theme === 'dark' ? "bg-zinc-800 border-zinc-700" : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex flex-col flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className={cn(
                    "text-sm font-semibold bg-transparent border-b-2 outline-none",
                    theme === 'dark' 
                      ? "text-white border-indigo-500" 
                      : "text-gray-900 border-indigo-500"
                  )}
                  autoFocus
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                />
                <button
                  onClick={handleTitleSave}
                  className="p-1 hover:bg-zinc-700 rounded"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            ) : (
              <h3 
                className={cn(
                  "text-sm font-semibold cursor-pointer hover:opacity-80 truncate",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                {diagramData?.title || title}
              </h3>
            )}
            {(diagramData?.subtitle || description) && (
              <p className={cn(
                "text-xs mt-0.5 truncate",
                theme === 'dark' ? "text-zinc-400" : "text-gray-500"
              )}>{diagramData?.subtitle || description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Settings */}
            <SettingsPanel
              theme={theme}
              setTheme={setTheme}
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              exportSize={exportSize}
              setExportSize={setExportSize}
            />
            
            {/* Share Menu */}
            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-zinc-700" : "hover:bg-gray-200"
                )}
                title="Share"
              >
                <Share2 className={cn(
                  "w-4 h-4",
                  theme === 'dark' ? "text-zinc-400" : "text-gray-600"
                )} />
              </button>
              
              {showShareMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowShareMenu(false)} 
                  />
                  <div className={cn(
                    "absolute right-0 top-full mt-2 w-48 rounded-lg shadow-xl z-50 py-2",
                    theme === 'dark' 
                      ? "bg-zinc-800 border border-zinc-700" 
                      : "bg-white border border-gray-200"
                  )}>
                    <button
                      onClick={() => {
                        copyToClipboard();
                        setShowShareMenu(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                        theme === 'dark' 
                          ? "text-zinc-300 hover:bg-zinc-700" 
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Copy className="w-4 h-4" />
                      {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                    <button
                      onClick={() => {
                        exportToPng();
                        setShowShareMenu(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                        theme === 'dark' 
                          ? "text-zinc-300 hover:bg-zinc-700" 
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Download className="w-4 h-4" />
                      Download PNG
                    </button>
                  </div>
                </>
              )}
            </div>
            
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                theme === 'dark' ? "hover:bg-zinc-700" : "hover:bg-gray-200"
              )}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className={cn(
                  "w-4 h-4",
                  theme === 'dark' ? "text-zinc-400" : "text-gray-600"
                )} />
              ) : (
                <Maximize2 className={cn(
                  "w-4 h-4",
                  theme === 'dark' ? "text-zinc-400" : "text-gray-600"
                )} />
              )}
            </button>
            <button
              onClick={onClose}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                theme === 'dark' ? "hover:bg-zinc-700" : "hover:bg-gray-200"
              )}
              title="Close"
            >
              <X className={cn(
                "w-4 h-4",
                theme === 'dark' ? "text-zinc-400" : "text-gray-600"
              )} />
            </button>
          </div>
        </div>

        {/* Metrics Panel */}
        {diagramData?.metrics && diagramData.metrics.length > 0 && (
          <MetricsPanel metrics={diagramData.metrics} theme={theme} />
        )}

        {/* Canvas */}
        <Canvas 
          diagramData={diagramData} 
          theme={theme}
          colorScheme={colorScheme}
          exportSize={exportSize}
          onExport={exportToPng}
        />
      </div>
    </div>
  );
}

export default DiagramCanvas;

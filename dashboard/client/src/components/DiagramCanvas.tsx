import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X, Maximize2, Minimize2, Download, ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, TrendingDown, Minus, Edit3, Check, Sun, Moon, Palette,
  Share2, Copy, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import diagram utilities and renderers
import {
  type LayoutType,
  type ThemeMode,
  type ColorScheme,
  type DiagramNode,
  type DiagramConnection,
  type DiagramMetric,
  type DiagramData,
  type NodePosition,
  type NodeColors,
  themeStyles,
  colorSchemes,
  excalidrawCategoryColors,
  excalidrawPrimary,
  excalidrawFontFamily,
  excalidrawFontFamilyUI,
  openColors,
  formatValue,
  generateHandDrawnRect,
  getNodeColorHelper,
} from './diagrams';

type ExportSize = 'small' | 'medium' | 'large';

// Import layout renderers
import { WaterfallRenderer } from './diagrams/WaterfallRenderer';
import { HierarchyRenderer } from './diagrams/HierarchyRenderer';
import { TimelineRenderer } from './diagrams/TimelineRenderer';
import { SankeyRenderer } from './diagrams/SankeyRenderer';

// Re-export types for external use
export type { DiagramData, DiagramNode, DiagramConnection, DiagramMetric };

interface DiagramCanvasProps {
  title: string;
  description?: string;
  diagramData?: DiagramData;
  isOpen: boolean;
  onClose: () => void;
  onTitleChange?: (title: string) => void;
}

// Squarified treemap algorithm
const squarify = (
  nodes: DiagramNode[],
  containerX: number,
  containerY: number,
  containerWidth: number,
  containerHeight: number
): Map<string, NodePosition> => {
  const positions = new Map<string, NodePosition>();
  
  const totalValue = nodes.reduce((sum, n) => sum + (n.percentage || n.value || 0), 0);
  if (totalValue === 0 || nodes.length === 0) return positions;

  const sortedNodes = [...nodes].sort((a, b) => 
    (b.percentage || b.value || 0) - (a.percentage || a.value || 0)
  );

  let x = containerX;
  let y = containerY;
  let remainingWidth = containerWidth;
  let remainingHeight = containerHeight;
  let remainingValue = totalValue;

  for (const node of sortedNodes) {
    const nodeValue = node.percentage || node.value || 0;
    const ratio = nodeValue / remainingValue;
    
    let nodeWidth: number;
    let nodeHeight: number;
    
    if (remainingWidth > remainingHeight) {
      nodeWidth = remainingWidth * ratio;
      nodeHeight = remainingHeight;
      positions.set(node.id, { x, y, width: nodeWidth - 4, height: nodeHeight - 4 });
      x += nodeWidth;
      remainingWidth -= nodeWidth;
    } else {
      nodeWidth = remainingWidth;
      nodeHeight = remainingHeight * ratio;
      positions.set(node.id, { x, y, width: nodeWidth - 4, height: nodeHeight - 4 });
      y += nodeHeight;
      remainingHeight -= nodeHeight;
    }
    
    remainingValue -= nodeValue;
  }

  return positions;
};

// ============ MAIN COMPONENT ============

export function DiagramCanvas({
  title,
  description,
  diagramData,
  isOpen,
  onClose,
  onTitleChange,
}: DiagramCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('excalidraw');
  const [showSettings, setShowSettings] = useState(false);
  const [exportSize, setExportSize] = useState<ExportSize>('medium');
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const lastPanPosition = useRef({ x: 0, y: 0 });

  const currentTheme = themeStyles[theme];
  const currentColors = colorSchemes[colorScheme];

  // Dynamic canvas sizing based on layout type
  const canvasDimensions = useMemo(() => {
    const baseWidth = 900;
    const baseHeight = 500;
    
    if (!diagramData) return { width: baseWidth, height: baseHeight };
    
    switch (diagramData.layoutType) {
      case 'waterfall':
        return { 
          width: Math.max(baseWidth, (diagramData.nodes.length * 100) + 200), 
          height: baseHeight + 80 
        };
      case 'hierarchy':
        return { 
          width: Math.max(baseWidth, 800), 
          height: Math.max(baseHeight, 500) 
        };
      case 'timeline':
        return { 
          width: Math.max(baseWidth, (diagramData.nodes.length * 120) + 200), 
          height: baseHeight 
        };
      case 'sankey':
        return { 
          width: baseWidth, 
          height: Math.max(baseHeight, 450) 
        };
      default:
        return { width: baseWidth, height: baseHeight };
    }
  }, [diagramData]);

  const canvasWidth = canvasDimensions.width;
  const canvasHeight = canvasDimensions.height;

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true;
      lastPanPosition.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPanPosition.current.x;
      const dy = e.clientY - lastPanPosition.current.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPosition.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.25), 4));
  }, []);

  // Export to PNG
  const exportToPNG = useCallback(async () => {
    if (!svgRef.current) return;
    
    const sizes = { small: 800, medium: 1200, large: 1920 };
    const targetWidth = sizes[exportSize];
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = targetWidth / img.width;
      canvas.width = targetWidth;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = currentTheme.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${editedTitle.replace(/[^a-z0-9]/gi, '_')}.png`;
            a.click();
            URL.revokeObjectURL(downloadUrl);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [exportSize, editedTitle, currentTheme.bg]);

  // Title editing
  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false);
    if (onTitleChange && editedTitle !== title) {
      onTitleChange(editedTitle);
    }
  }, [editedTitle, title, onTitleChange]);

  // Node positions for treemap
  const nodePositions = useMemo(() => {
    if (!diagramData || diagramData.layoutType !== 'treemap') return new Map();
    return squarify(diagramData.nodes, 50, 120, canvasWidth - 100, canvasHeight - 170);
  }, [diagramData, canvasWidth, canvasHeight]);

  // Get color for node
  const getNodeColor = useCallback((node: DiagramNode, index: number): NodeColors => {
    return getNodeColorHelper(node, index, colorScheme);
  }, [colorScheme]);

  if (!isOpen) return null;

  // Render the appropriate layout
  const renderLayout = () => {
    if (!diagramData) return null;

    const commonProps = {
      nodes: diagramData.nodes,
      connections: diagramData.connections,
      canvasWidth,
      canvasHeight,
      theme: currentTheme,
      colorScheme,
      hoveredNode,
      onNodeHover: setHoveredNode,
      getNodeColor,
    };

    switch (diagramData.layoutType) {
      case 'waterfall':
        return <WaterfallRenderer {...commonProps} />;
      
      case 'hierarchy':
        return <HierarchyRenderer {...commonProps} />;
      
      case 'timeline':
        return <TimelineRenderer {...commonProps} />;
      
      case 'sankey':
        return <SankeyRenderer {...commonProps} />;
      
      case 'treemap':
        return renderTreemap();
      
      case 'comparison':
        return renderComparison();
      
      default:
        // Fallback to treemap for unknown layouts
        return renderTreemap();
    }
  };

  // Treemap renderer (inline for backward compatibility)
  const renderTreemap = () => {
    if (!diagramData) return null;
    
    return (
      <g>
        {diagramData.nodes.map((node, index) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          
          const colors = getNodeColor(node, index);
          const isHovered = hoveredNode === node.id;
          
          return (
            <g 
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Hand-drawn style rectangle */}
              <path
                d={generateHandDrawnRect(pos.x + 2, pos.y + 2, pos.width, pos.height, index)}
                fill={isHovered ? colors.border : colors.bg}
                stroke={colors.border}
                strokeWidth={2}
                style={{
                  transition: 'all 0.2s ease',
                  filter: isHovered ? 'brightness(1.05)' : 'none',
                }}
              />
              
              {/* Label */}
              {pos.width > 60 && pos.height > 40 && (
                <>
                  <text
                    x={pos.x + pos.width / 2 + 2}
                    y={pos.y + pos.height / 2 - 10}
                    textAnchor="middle"
                    fontSize={Math.min(16, pos.width / 8)}
                    fontWeight="500"
                    fill={isHovered ? '#ffffff' : colors.text}
                    fontFamily={excalidrawFontFamily}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label}
                  </text>
                  <text
                    x={pos.x + pos.width / 2 + 2}
                    y={pos.y + pos.height / 2 + 12}
                    textAnchor="middle"
                    fontSize={Math.min(20, pos.width / 6)}
                    fontWeight="700"
                    fill={isHovered ? '#ffffff' : colors.text}
                    fontFamily={excalidrawFontFamily}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.valueLabel || formatValue(node.value)}
                  </text>
                  {node.percentage !== undefined && (
                    <text
                      x={pos.x + pos.width / 2 + 2}
                      y={pos.y + pos.height / 2 + 32}
                      textAnchor="middle"
                      fontSize={Math.min(12, pos.width / 10)}
                      fill={isHovered ? 'rgba(255,255,255,0.8)' : colors.border}
                      fontFamily={excalidrawFontFamilyUI}
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.percentage}%
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // Comparison bar chart renderer (inline for backward compatibility)
  const renderComparison = () => {
    if (!diagramData) return null;
    
    const nodes = diagramData.nodes;
    if (!nodes || nodes.length === 0) return null;
    
    // Determine which metrics to display
    const hasNestedMetrics = nodes.some(n => n.metrics);
    const metricKeys = hasNestedMetrics 
      ? ['yield', 'growth', 'peRatio'].filter(key => 
          nodes.some(n => n.metrics && n.metrics[key] !== undefined && n.metrics[key] !== null)
        )
      : [];
    
    const chartHeight = canvasHeight - 280;
    const chartTop = 140;
    const chartLeft = 80;
    const chartRight = canvasWidth - 60;
    const chartWidth = chartRight - chartLeft;
    
    // For grouped bars
    const groupWidth = chartWidth / nodes.length;
    const barPadding = 8;
    
    // Calculate bar width based on number of metrics
    const numBars = hasNestedMetrics ? Math.max(metricKeys.length, 1) : 1;
    const barWidth = Math.min(
      (groupWidth - barPadding * 2) / numBars - 4,
      50
    );
    
    // Calculate max values for scaling
    const maxValues: Record<string, number> = {};
    if (hasNestedMetrics) {
      metricKeys.forEach(key => {
        maxValues[key] = Math.max(
          ...nodes.map(n => {
            const val = n.metrics?.[key];
            return typeof val === 'number' ? Math.abs(val) : 0;
          })
        );
      });
    }
    const singleMaxValue = Math.max(...nodes.map(n => Math.abs(n.value || n.percentage || 0)));

    // Metric colors
    const metricColors = [
      { bg: openColors.blue[1], border: openColors.blue[6], text: openColors.blue[9] },
      { bg: openColors.teal[1], border: openColors.teal[6], text: openColors.teal[9] },
      { bg: openColors.violet[1], border: openColors.violet[6], text: openColors.violet[9] },
    ];

    return (
      <g>
        {/* Y-axis */}
        <line
          x1={chartLeft}
          y1={chartTop}
          x2={chartLeft}
          y2={chartTop + chartHeight}
          stroke={currentTheme.border}
          strokeWidth={2}
        />
        
        {/* X-axis */}
        <line
          x1={chartLeft}
          y1={chartTop + chartHeight}
          x2={chartRight}
          y2={chartTop + chartHeight}
          stroke={currentTheme.border}
          strokeWidth={2}
        />

        {/* Legend for grouped bars */}
        {hasNestedMetrics && metricKeys.length > 0 && (
          <g transform={`translate(${chartLeft}, ${chartTop - 30})`}>
            {metricKeys.map((key, i) => (
              <g key={key} transform={`translate(${i * 100}, 0)`}>
                <rect
                  x={0}
                  y={0}
                  width={14}
                  height={14}
                  fill={metricColors[i % metricColors.length].bg}
                  stroke={metricColors[i % metricColors.length].border}
                  strokeWidth={1}
                />
                <text
                  x={20}
                  y={11}
                  fontSize={11}
                  fill={currentTheme.text}
                  fontFamily={excalidrawFontFamilyUI}
                  style={{ textTransform: 'capitalize' }}
                >
                  {key === 'peRatio' ? 'P/E Ratio' : key}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Bars */}
        {nodes.map((node, nodeIndex) => {
          const groupX = chartLeft + nodeIndex * groupWidth + barPadding;
          const isHovered = hoveredNode === node.id;
          
          if (hasNestedMetrics && metricKeys.length > 0) {
            // Render grouped bars for each metric
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                {metricKeys.map((key, barIndex) => {
                  const val = node.metrics?.[key];
                  const value = typeof val === 'number' ? val : 0;
                  const maxVal = maxValues[key] || 25;
                  const barHeight = Math.max(4, (value / maxVal) * chartHeight);
                  const x = groupX + barIndex * (barWidth + 4);
                  const y = chartTop + chartHeight - barHeight;
                  const colors = metricColors[barIndex % metricColors.length];
                  
                  return (
                    <g key={key}>
                      <path
                        d={generateHandDrawnRect(x, y, barWidth, barHeight, nodeIndex * 10 + barIndex)}
                        fill={isHovered ? colors.border : colors.bg}
                        stroke={colors.border}
                        strokeWidth={2}
                        style={{
                          transition: 'all 0.2s ease',
                          filter: isHovered ? 'brightness(1.1)' : 'none',
                        }}
                      />
                      {/* Value on top */}
                      <text
                        x={x + barWidth / 2}
                        y={y - 6}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight="600"
                        fill={currentTheme.text}
                        fontFamily={excalidrawFontFamily}
                      >
                        {value.toFixed(1)}{key === 'yield' || key === 'growth' ? '%' : ''}
                      </text>
                    </g>
                  );
                })}
                
                {/* Company label */}
                <text
                  x={groupX + (metricKeys.length * (barWidth + 4)) / 2}
                  y={chartTop + chartHeight + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill={currentTheme.text}
                  fontFamily={excalidrawFontFamily}
                >
                  {node.label.length > 12 ? node.label.substring(0, 10) + '...' : node.label}
                </text>
                
                {/* Category/ticker */}
                <text
                  x={groupX + (metricKeys.length * (barWidth + 4)) / 2}
                  y={chartTop + chartHeight + 32}
                  textAnchor="middle"
                  fontSize={9}
                  fill={currentTheme.muted}
                  fontFamily={excalidrawFontFamilyUI}
                >
                  {node.id}
                </text>
              </g>
            );
          } else {
            // Single bar per node
            const value = node.value || node.percentage || 0;
            const barHeight = Math.max(4, (value / (singleMaxValue || 100)) * chartHeight);
            const x = groupX + (groupWidth - barWidth) / 2 - barPadding;
            const y = chartTop + chartHeight - barHeight;
            const colors = getNodeColor(node, nodeIndex);
            
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={generateHandDrawnRect(x, y, barWidth, barHeight, nodeIndex)}
                  fill={isHovered ? colors.border : colors.bg}
                  stroke={colors.border}
                  strokeWidth={2}
                  style={{
                    transition: 'all 0.2s ease',
                    filter: isHovered ? 'brightness(1.05)' : 'none',
                  }}
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="600"
                  fill={currentTheme.text}
                  fontFamily={excalidrawFontFamily}
                >
                  {node.valueLabel || formatValue(node.value)}
                </text>
                <text
                  x={groupX + groupWidth / 2 - barPadding}
                  y={chartTop + chartHeight + 20}
                  textAnchor="middle"
                  fontSize={11}
                  fill={currentTheme.text}
                  fontFamily={excalidrawFontFamily}
                >
                  {node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label}
                </text>
              </g>
            );
          }
        })}
      </g>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div 
        className={cn(
          "relative flex flex-col rounded-lg shadow-2xl overflow-hidden transition-all duration-300",
          isFullscreen ? "w-full h-full rounded-none" : "w-[95vw] max-w-5xl h-[85vh]"
        )}
        style={{ 
          backgroundColor: currentTheme.panel,
          border: `2px solid ${currentTheme.border}`,
          fontFamily: excalidrawFontFamilyUI,
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ 
            borderColor: currentTheme.border,
            backgroundColor: currentTheme.bg,
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="px-2 py-1 rounded text-lg font-medium"
                  style={{ 
                    backgroundColor: currentTheme.panel,
                    color: currentTheme.text,
                    border: `2px solid ${excalidrawPrimary.violet}`,
                    fontFamily: excalidrawFontFamily,
                  }}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                />
                <button
                  onClick={handleTitleSave}
                  className="p-1 rounded hover:bg-opacity-20"
                  style={{ color: excalidrawPrimary.violet }}
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h3 
                className="text-lg font-medium cursor-pointer hover:opacity-80 flex items-center gap-2"
                style={{ 
                  color: currentTheme.text,
                  fontFamily: excalidrawFontFamily,
                }}
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                {editedTitle}
                <Edit3 className="w-4 h-4 opacity-50" />
              </h3>
            )}
            {description && (
              <span 
                className="text-sm opacity-70"
                style={{ color: currentTheme.muted }}
              >
                {description}
              </span>
            )}
            {/* Layout type badge */}
            {diagramData?.layoutType && (
              <span 
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ 
                  backgroundColor: excalidrawPrimary.violet,
                  color: '#ffffff',
                }}
              >
                {diagramData.layoutType}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Settings Button */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  color: currentTheme.muted,
                  backgroundColor: showSettings ? currentTheme.border : 'transparent',
                }}
                title="Settings"
              >
                <Palette className="w-5 h-5" />
              </button>
              
              {showSettings && (
                <div 
                  className="absolute right-0 top-full mt-2 p-4 rounded-lg shadow-xl z-10 min-w-[200px]"
                  style={{ 
                    backgroundColor: currentTheme.panel,
                    border: `2px solid ${currentTheme.border}`,
                  }}
                >
                  <div className="mb-4">
                    <label 
                      className="text-xs font-medium mb-2 block"
                      style={{ color: currentTheme.muted }}
                    >
                      Color Scheme
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['excalidraw', 'vibrant', 'pastel', 'monochrome'] as ColorScheme[]).map((scheme) => (
                        <button
                          key={scheme}
                          onClick={() => setColorScheme(scheme)}
                          className={cn(
                            "px-3 py-1.5 rounded text-xs capitalize transition-all",
                            colorScheme === scheme && "ring-2"
                          )}
                          style={{
                            backgroundColor: colorScheme === scheme ? excalidrawPrimary.violet : currentTheme.bg,
                            color: colorScheme === scheme ? '#ffffff' : currentTheme.text,
                            // ringColor handled by ring-2 class
                          }}
                        >
                          {scheme}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label 
                      className="text-xs font-medium mb-2 block"
                      style={{ color: currentTheme.muted }}
                    >
                      Export Size
                    </label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large'] as ExportSize[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => setExportSize(size)}
                          className={cn(
                            "px-3 py-1.5 rounded text-xs capitalize transition-all flex-1"
                          )}
                          style={{
                            backgroundColor: exportSize === size ? excalidrawPrimary.violet : currentTheme.bg,
                            color: exportSize === size ? '#ffffff' : currentTheme.text,
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg transition-colors"
              style={{ color: currentTheme.muted }}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Share */}
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: currentTheme.muted }}
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: currentTheme.muted }}
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: currentTheme.muted }}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          ref={canvasRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative"
          style={{ backgroundColor: currentTheme.bg }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center',
            }}
          >
            {/* Background */}
            <rect 
              x="0" 
              y="0" 
              width={canvasWidth} 
              height={canvasHeight} 
              fill={currentTheme.bg}
            />

            {/* Title */}
            {diagramData?.title && (
              <text
                x={canvasWidth / 2}
                y={35}
                textAnchor="middle"
                fontSize={20}
                fontWeight="600"
                fill={currentTheme.text}
                fontFamily={excalidrawFontFamily}
              >
                {diagramData.title}
              </text>
            )}

            {/* Subtitle */}
            {diagramData?.subtitle && (
              <text
                x={canvasWidth / 2}
                y={58}
                textAnchor="middle"
                fontSize={12}
                fill={currentTheme.muted}
                fontFamily={excalidrawFontFamilyUI}
              >
                {diagramData.subtitle}
              </text>
            )}

            {/* Metrics Header */}
            {diagramData?.metrics && diagramData.metrics.length > 0 && (
              <g>
                {diagramData.metrics.map((metric, i) => {
                  const metricWidth = 150;
                  const totalMetricsWidth = diagramData.metrics!.length * (metricWidth + 20) - 20;
                  const startX = (canvasWidth - totalMetricsWidth) / 2 + i * (metricWidth + 20);
                  return (
                    <g key={i}>
                      <rect
                        x={startX}
                        y={70}
                        width={metricWidth}
                        height={55}
                        rx={8}
                        fill={currentTheme.panel}
                        stroke={currentTheme.border}
                        strokeWidth={2}
                      />
                      <text
                        x={startX + 12}
                        y={88}
                        fontSize={10}
                        fill={currentTheme.muted}
                        fontFamily={excalidrawFontFamilyUI}
                      >
                        {metric.label}
                      </text>
                      <text
                        x={startX + 12}
                        y={110}
                        fontSize={18}
                        fontWeight="600"
                        fill={currentTheme.text}
                        fontFamily={excalidrawFontFamily}
                      >
                        {metric.value}
                      </text>
                      {metric.change && (
                        <text
                          x={startX + metricWidth - 12}
                          y={110}
                          textAnchor="end"
                          fontSize={11}
                          fill={
                            metric.trend === 'up' ? openColors.teal[6] :
                            metric.trend === 'down' ? openColors.red[6] :
                            currentTheme.muted
                          }
                          fontFamily={excalidrawFontFamilyUI}
                        >
                          {metric.trend === 'up' ? '▲' : metric.trend === 'down' ? '▼' : ''} {metric.change}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Render the appropriate layout */}
            {renderLayout()}

            {/* Tooltip */}
            {hoveredNode && diagramData && (
              (() => {
                const node = diagramData.nodes.find(n => n.id === hoveredNode);
                if (!node) return null;
                
                // Find position based on layout type
                let tooltipX = canvasWidth - 190;
                let tooltipY = 140;
                
                if (diagramData.layoutType === 'treemap') {
                  const pos = nodePositions.get(hoveredNode);
                  if (pos) {
                    tooltipX = Math.min(pos.x + pos.width + 10, canvasWidth - 180);
                    tooltipY = Math.max(pos.y, 20);
                  }
                }
                
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={tooltipX}
                      y={tooltipY}
                      width={170}
                      height={node.details ? 110 : 90}
                      rx={8}
                      fill={currentTheme.panel}
                      stroke={excalidrawPrimary.violet}
                      strokeWidth={2}
                      filter="drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))"
                    />
                    <text
                      x={tooltipX + 12}
                      y={tooltipY + 22}
                      fontSize={13}
                      fontWeight="600"
                      fill={currentTheme.text}
                      fontFamily={excalidrawFontFamily}
                    >
                      {node.label}
                    </text>
                    <text
                      x={tooltipX + 12}
                      y={tooltipY + 44}
                      fontSize={11}
                      fill={currentTheme.muted}
                      fontFamily={excalidrawFontFamilyUI}
                    >
                      Value: {node.valueLabel || formatValue(node.value)}
                    </text>
                    {node.percentage !== undefined && (
                      <text
                        x={tooltipX + 12}
                        y={tooltipY + 62}
                        fontSize={11}
                        fill={currentTheme.muted}
                        fontFamily={excalidrawFontFamilyUI}
                      >
                        Share: {node.percentage}% of total
                      </text>
                    )}
                    {node.category && (
                      <text
                        x={tooltipX + 12}
                        y={tooltipY + 80}
                        fontSize={10}
                        fill={excalidrawPrimary.violet}
                        fontFamily={excalidrawFontFamilyUI}
                      >
                        Category: {node.category}
                      </text>
                    )}
                    {node.details && (
                      <text
                        x={tooltipX + 12}
                        y={tooltipY + 98}
                        fontSize={9}
                        fill={currentTheme.muted}
                        fontFamily={excalidrawFontFamilyUI}
                      >
                        {node.details.substring(0, 30)}...
                      </text>
                    )}
                  </g>
                );
              })()
            )}

            {/* Instructions */}
            <text
              x={canvasWidth - 20}
              y={canvasHeight - 15}
              textAnchor="end"
              fontSize={10}
              fill={currentTheme.muted}
              fontFamily={excalidrawFontFamilyUI}
              opacity={0.6}
            >
              Click nodes to explore • Scroll to zoom • Drag to pan
            </text>
          </svg>

          {/* Zoom Controls */}
          <div 
            className="absolute bottom-4 left-4 flex items-center gap-2 p-2 rounded-lg"
            style={{ 
              backgroundColor: currentTheme.panel,
              border: `2px solid ${currentTheme.border}`,
            }}
          >
            <button
              onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.25))}
              className="p-1.5 rounded transition-colors"
              style={{ color: currentTheme.muted }}
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div 
              className="w-24 h-1.5 rounded-full relative"
              style={{ backgroundColor: currentTheme.border }}
            >
              <div 
                className="absolute h-full rounded-full transition-all"
                style={{ 
                  width: `${((zoom - 0.25) / 3.75) * 100}%`,
                  backgroundColor: excalidrawPrimary.violet,
                }}
              />
            </div>
            <button
              onClick={() => setZoom(prev => Math.min(prev * 1.2, 4))}
              className="p-1.5 rounded transition-colors"
              style={{ color: currentTheme.muted }}
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="p-1.5 rounded transition-colors ml-1"
              style={{ color: currentTheme.muted }}
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={exportToPNG}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
            style={{ 
              backgroundColor: excalidrawPrimary.violet,
              color: '#ffffff',
              fontFamily: excalidrawFontFamilyUI,
            }}
          >
            <Download className="w-4 h-4" />
            Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}

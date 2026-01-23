import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  X, Maximize2, Minimize2, Download, ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, TrendingDown, Minus, Edit3, Check, Sun, Moon, Palette,
  Share2, Copy, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import diagram utilities and types
import {
  type ThemeMode,
  type ColorScheme,
  type DiagramData,
  type DiagramSpec,
  type DiagramNode,
  type DiagramConnection,
  type DiagramMetric,
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

// Import the new flexible renderer
import FlexibleRenderer from './diagrams/FlexibleRenderer';

type ExportSize = 'small' | 'medium' | 'large';

// Re-export types for external use
export type { DiagramData, DiagramNode, DiagramConnection, DiagramMetric };

interface DiagramCanvasProps {
  title: string;
  description?: string;
  diagramData?: DiagramData | DiagramSpec;
  isOpen: boolean;
  onClose: () => void;
  onTitleChange?: (title: string) => void;
}

// Check if data is new flexible format
const isFlexibleSpec = (data: DiagramData | DiagramSpec | undefined): data is DiagramSpec => {
  if (!data) return false;
  return 'canvas' in data && 'elements' in data && Array.isArray((data as DiagramSpec).elements);
};

// Squarified treemap algorithm (for legacy support)
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

const DiagramCanvas: React.FC<DiagramCanvasProps> = ({
  title: initialTitle,
  description,
  diagramData,
  isOpen,
  onClose,
  onTitleChange,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('excalidraw');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [exportSize, setExportSize] = useState<ExportSize>('medium');
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if using new flexible format
  const isFlexible = isFlexibleSpec(diagramData);
  const flexibleSpec = isFlexible ? diagramData as DiagramSpec : null;
  const legacyData = !isFlexible ? diagramData as DiagramData : null;

  // Get title and subtitle from either format
  const displayTitle = flexibleSpec?.canvas?.title || legacyData?.title || title;
  const displaySubtitle = flexibleSpec?.canvas?.subtitle || legacyData?.subtitle || description;
  
  // Get layout type for badge (flexible format uses layout.arrangement)
  const layoutType = flexibleSpec?.layout?.arrangement || legacyData?.layoutType || 'flexible';

  // Canvas dimensions based on content
  const canvasWidth = 900;
  const canvasHeight = 600;

  // Current theme
  const currentTheme = themeStyles[themeMode];

  // Node color helper
  const getNodeColor = useCallback((node: DiagramNode, index: number): NodeColors => {
    return getNodeColorHelper(node, index, colorScheme);
  }, [colorScheme]);

  // Handle zoom
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  // Handle pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Export to PNG
  const exportToPNG = useCallback(async () => {
    if (!svgRef.current) return;

    const sizeMultipliers = { small: 1, medium: 2, large: 3 };
    const multiplier = sizeMultipliers[exportSize];
    
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * multiplier;
      canvas.height = canvasHeight * multiplier;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = currentTheme.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${displayTitle.replace(/[^a-z0-9]/gi, '_')}_diagram.png`;
        downloadLink.click();
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  }, [exportSize, currentTheme.bg, canvasWidth, canvasHeight, displayTitle]);

  // Handle title edit
  const handleTitleSubmit = useCallback(() => {
    setIsEditingTitle(false);
    if (onTitleChange && title !== initialTitle) {
      onTitleChange(title);
    }
  }, [title, initialTitle, onTitleChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        if (isEditingTitle) {
          setIsEditingTitle(false);
          setTitle(initialTitle);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
      if (e.key === '+' || e.key === '=') handleZoom(0.1);
      if (e.key === '-') handleZoom(-0.1);
      if (e.key === '0') resetView();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditingTitle, isFullscreen, initialTitle, onClose, handleZoom, resetView]);

  if (!isOpen) return null;

  // Render the diagram content
  const renderDiagramContent = () => {
    if (isFlexible && flexibleSpec) {
      // Use new flexible renderer
      return (
        <FlexibleRenderer
          spec={flexibleSpec}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          theme={currentTheme}
          colorScheme={colorScheme}
          hoveredElement={hoveredNode}
          onElementHover={setHoveredNode}
        />
      );
    }

    // No data available - show appropriate message
    if (!diagramData) {
      return (
        <g>
          <text
            x={canvasWidth / 2}
            y={canvasHeight / 2 - 20}
            textAnchor="middle"
            fill={currentTheme.muted}
            fontSize={18}
            fontFamily={excalidrawFontFamily}
          >
            Loading diagram...
          </text>
          <text
            x={canvasWidth / 2}
            y={canvasHeight / 2 + 10}
            textAnchor="middle"
            fill={currentTheme.muted}
            fontSize={12}
            fontFamily={excalidrawFontFamilyUI}
          >
            Please wait while the visualization is being generated
          </text>
        </g>
      );
    }

    // Legacy rendering for old format
    if (!legacyData || !legacyData.nodes || legacyData.nodes.length === 0) {
      return (
        <text
          x={canvasWidth / 2}
          y={canvasHeight / 2}
          textAnchor="middle"
          fill={currentTheme.muted}
          fontSize={16}
          fontFamily={excalidrawFontFamilyUI}
        >
          No diagram data available
        </text>
      );
    }

    // Legacy treemap rendering
    const positions = squarify(
      legacyData.nodes,
      60,
      120,
      canvasWidth - 120,
      canvasHeight - 200
    );

    return (
      <g>
        {legacyData.nodes.map((node, index) => {
          const pos = positions.get(node.id);
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
              <path
                d={generateHandDrawnRect(pos.x, pos.y, pos.width, pos.height, index)}
                fill={isHovered ? colors.border : colors.bg}
                stroke={colors.border}
                strokeWidth={2}
                style={{
                  transition: 'all 0.2s ease',
                  filter: isHovered ? 'brightness(1.05)' : 'none',
                }}
              />
              {pos.width > 60 && pos.height > 40 && (
                <>
                  <text
                    x={pos.x + pos.width / 2}
                    y={pos.y + pos.height / 2 - 8}
                    textAnchor="middle"
                    fontSize={Math.min(14, pos.width / 8)}
                    fontWeight="600"
                    fill={currentTheme.text}
                    fontFamily={excalidrawFontFamily}
                  >
                    {node.label}
                  </text>
                  <text
                    x={pos.x + pos.width / 2}
                    y={pos.y + pos.height / 2 + 12}
                    textAnchor="middle"
                    fontSize={Math.min(12, pos.width / 10)}
                    fill={currentTheme.muted}
                    fontFamily={excalidrawFontFamilyUI}
                  >
                    {node.valueLabel || (node.percentage ? `${node.percentage}%` : formatValue(node.value))}
                  </text>
                </>
              )}
            </g>
          );
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
        ref={containerRef}
        className={cn(
          "flex flex-col rounded-lg shadow-2xl overflow-hidden transition-all duration-300",
          isFullscreen ? "w-full h-full rounded-none" : "w-[95vw] max-w-5xl h-[85vh]"
        )}
        style={{ backgroundColor: currentTheme.panel }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: currentTheme.border }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                  onBlur={handleTitleSubmit}
                  autoFocus
                  className="px-2 py-1 text-lg font-semibold bg-transparent border rounded outline-none"
                  style={{ 
                    color: currentTheme.text, 
                    borderColor: excalidrawPrimary,
                    fontFamily: excalidrawFontFamily 
                  }}
                />
                <button
                  onClick={handleTitleSubmit}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <Check size={16} style={{ color: excalidrawPrimary }} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h2 
                  className="text-lg font-semibold truncate"
                  style={{ color: currentTheme.text, fontFamily: excalidrawFontFamily }}
                >
                  {displayTitle}
                </h2>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1 rounded hover:bg-white/10 flex-shrink-0"
                >
                  <Edit3 size={14} style={{ color: currentTheme.muted }} />
                </button>
              </div>
            )}
            
            {displaySubtitle && (
              <span 
                className="text-sm truncate hidden sm:block"
                style={{ color: currentTheme.muted, fontFamily: excalidrawFontFamilyUI }}
              >
                {displaySubtitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Layout type badge */}
            <span 
              className="px-2 py-1 text-xs rounded-full mr-2"
              style={{ 
                backgroundColor: excalidrawPrimary + '33',
                color: excalidrawPrimary,
                fontFamily: excalidrawFontFamilyUI
              }}
            >
              {layoutType}
            </span>

            {/* Theme toggle */}
            <button
              onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded hover:bg-white/10"
              title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            >
              {themeMode === 'dark' ? (
                <Sun size={18} style={{ color: currentTheme.muted }} />
              ) : (
                <Moon size={18} style={{ color: currentTheme.muted }} />
              )}
            </button>

            {/* Color scheme picker */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 rounded hover:bg-white/10"
                title="Change color scheme"
              >
                <Palette size={18} style={{ color: currentTheme.muted }} />
              </button>
              {showColorPicker && (
                <div 
                  className="absolute right-0 top-full mt-1 p-2 rounded-lg shadow-lg z-10"
                  style={{ backgroundColor: currentTheme.panel, border: `1px solid ${currentTheme.border}` }}
                >
                  {(Object.keys(colorSchemes) as ColorScheme[]).map((scheme) => (
                    <button
                      key={scheme}
                      onClick={() => {
                        setColorScheme(scheme);
                        setShowColorPicker(false);
                      }}
                      className={cn(
                        "block w-full px-3 py-1.5 text-left text-sm rounded hover:bg-white/10",
                        colorScheme === scheme && "bg-white/10"
                      )}
                      style={{ color: currentTheme.text, fontFamily: excalidrawFontFamilyUI }}
                    >
                      {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded hover:bg-white/10"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 size={18} style={{ color: currentTheme.muted }} />
              ) : (
                <Maximize2 size={18} style={{ color: currentTheme.muted }} />
              )}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-white/10"
              title="Close"
            >
              <X size={18} style={{ color: currentTheme.muted }} />
            </button>
          </div>
        </div>

        {/* Metrics bar (for legacy format) */}
        {legacyData?.metrics && legacyData.metrics.length > 0 && (
          <div 
            className="flex items-center gap-4 px-4 py-2 border-b overflow-x-auto"
            style={{ borderColor: currentTheme.border }}
          >
            {legacyData.metrics.map((metric, i) => (
              <div key={i} className="flex items-center gap-2 flex-shrink-0">
                <span 
                  className="text-sm"
                  style={{ color: currentTheme.muted, fontFamily: excalidrawFontFamilyUI }}
                >
                  {metric.label}
                </span>
                <span 
                  className="font-semibold"
                  style={{ color: currentTheme.text, fontFamily: excalidrawFontFamily }}
                >
                  {metric.value}
                </span>
                {metric.change && (
                  <span 
                    className="flex items-center text-sm"
                    style={{ 
                      color: metric.trend === 'up' ? openColors.green[6] : 
                             metric.trend === 'down' ? openColors.red[6] : 
                             currentTheme.muted 
                    }}
                  >
                    {metric.trend === 'up' && <TrendingUp size={14} />}
                    {metric.trend === 'down' && <TrendingDown size={14} />}
                    {metric.trend === 'neutral' && <Minus size={14} />}
                    {metric.change}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Canvas area */}
        <div 
          className="flex-1 overflow-hidden relative"
          style={{ backgroundColor: currentTheme.bg }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transformOrigin: 'center center',
              cursor: isDragging ? 'grabbing' : 'grab',
              width: '100%',
              height: '100%',
            }}
          >
            {/* Background */}
            <rect width={canvasWidth} height={canvasHeight} fill={currentTheme.bg} />
            
            {/* Title */}
            <text
              x={canvasWidth / 2}
              y={40}
              textAnchor="middle"
              fontSize={24}
              fontWeight="bold"
              fill={currentTheme.text}
              fontFamily={excalidrawFontFamily}
            >
              {displayTitle}
            </text>
            
            {/* Subtitle */}
            {displaySubtitle && (
              <text
                x={canvasWidth / 2}
                y={68}
                textAnchor="middle"
                fontSize={14}
                fill={currentTheme.muted}
                fontFamily={excalidrawFontFamilyUI}
              >
                {displaySubtitle}
              </text>
            )}

            {/* Diagram content */}
            {renderDiagramContent()}
          </svg>

          {/* Interaction hint */}
          <div 
            className="absolute bottom-4 right-4 text-xs"
            style={{ color: currentTheme.muted, fontFamily: excalidrawFontFamilyUI }}
          >
            Click nodes to explore • Scroll to zoom • Drag to pan
          </div>
        </div>

        {/* Footer controls */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-t"
          style={{ borderColor: currentTheme.border }}
        >
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleZoom(-0.1)}
              className="p-1.5 rounded hover:bg-white/10"
              title="Zoom out"
            >
              <ZoomOut size={18} style={{ color: currentTheme.muted }} />
            </button>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 accent-blue-500"
            />
            <button
              onClick={() => handleZoom(0.1)}
              className="p-1.5 rounded hover:bg-white/10"
              title="Zoom in"
            >
              <ZoomIn size={18} style={{ color: currentTheme.muted }} />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 rounded hover:bg-white/10 ml-2"
              title="Reset view"
            >
              <RotateCcw size={18} style={{ color: currentTheme.muted }} />
            </button>
          </div>

          {/* Export button */}
          <button
            onClick={exportToPNG}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: excalidrawPrimary,
              color: '#fff',
              fontFamily: excalidrawFontFamilyUI
            }}
          >
            <Download size={18} />
            Export PNG
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagramCanvas;
export { DiagramCanvas };

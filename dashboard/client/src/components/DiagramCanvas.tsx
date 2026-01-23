import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X, Maximize2, Minimize2, Download, ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, TrendingDown, Minus, Edit3, Check, Sun, Moon, Palette,
  Share2, Copy, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

type LayoutType = 'treemap' | 'hierarchy' | 'waterfall' | 'sankey' | 'comparison' | 'timeline';
type ThemeMode = 'dark' | 'light';
type ColorScheme = 'excalidraw' | 'vibrant' | 'pastel' | 'monochrome';
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
  color?: string;
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

// ============ EXCALIDRAW OPEN COLORS PALETTE ============
// Based on https://yeun.github.io/open-color/

const openColors = {
  // Grays
  gray: ['#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#868e96', '#495057', '#343a40', '#212529'],
  // Colors (index 6 is the primary, 9 is darkest for strokes)
  red: ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a'],
  pink: ['#fff0f6', '#ffdeeb', '#fcc2d7', '#faa2c1', '#f783ac', '#f06595', '#e64980', '#d6336c', '#c2255c', '#a61e4d'],
  grape: ['#f8f0fc', '#f3d9fa', '#eebefa', '#e599f7', '#da77f2', '#cc5de8', '#be4bdb', '#ae3ec9', '#9c36b5', '#862e9c'],
  violet: ['#f3f0ff', '#e5dbff', '#d0bfff', '#b197fc', '#9775fa', '#845ef7', '#7950f2', '#7048e8', '#6741d9', '#5f3dc4'],
  indigo: ['#edf2ff', '#dbe4ff', '#bac8ff', '#91a7ff', '#748ffc', '#5c7cfa', '#4c6ef5', '#4263eb', '#3b5bdb', '#364fc7'],
  blue: ['#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc', '#4dabf7', '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab'],
  cyan: ['#e3fafc', '#c5f6fa', '#99e9f2', '#66d9e8', '#3bc9db', '#22b8cf', '#15aabf', '#1098ad', '#0c8599', '#0b7285'],
  teal: ['#e6fcf5', '#c3fae8', '#96f2d7', '#63e6be', '#38d9a9', '#20c997', '#12b886', '#0ca678', '#099268', '#087f5b'],
  green: ['#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057', '#37b24d', '#2f9e44', '#2b8a3e'],
  lime: ['#f4fce3', '#e9fac8', '#d8f5a2', '#c0eb75', '#a9e34b', '#94d82d', '#82c91e', '#74b816', '#66a80f', '#5c940d'],
  yellow: ['#fff9db', '#fff3bf', '#ffec99', '#ffe066', '#ffd43b', '#fcc419', '#fab005', '#f59f00', '#f08c00', '#e67700'],
  orange: ['#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d', '#ff922b', '#fd7e14', '#f76707', '#e8590c', '#d9480f'],
};

// Excalidraw primary colors
const excalidrawPrimary = {
  violet: '#6965db',
  violetDarker: '#5b57d1',
  violetDarkest: '#4a47a3',
  violetLight: '#8b87e0',
};

// ============ COLOR SCHEMES ============

const colorSchemes: Record<ColorScheme, Record<string, { bg: string; border: string; text: string; hover: string }>> = {
  excalidraw: {
    revenue: { bg: openColors.teal[1], border: openColors.teal[6], text: openColors.teal[9], hover: openColors.teal[2] },
    cost: { bg: openColors.red[1], border: openColors.red[6], text: openColors.red[9], hover: openColors.red[2] },
    asset: { bg: openColors.blue[1], border: openColors.blue[6], text: openColors.blue[9], hover: openColors.blue[2] },
    metric: { bg: openColors.violet[1], border: openColors.violet[6], text: openColors.violet[9], hover: openColors.violet[2] },
    risk: { bg: openColors.orange[1], border: openColors.orange[6], text: openColors.orange[9], hover: openColors.orange[2] },
    neutral: { bg: openColors.gray[1], border: openColors.gray[5], text: openColors.gray[8], hover: openColors.gray[2] },
  },
  vibrant: {
    revenue: { bg: openColors.teal[6], border: openColors.teal[8], text: '#ffffff', hover: openColors.teal[7] },
    cost: { bg: openColors.red[6], border: openColors.red[8], text: '#ffffff', hover: openColors.red[7] },
    asset: { bg: openColors.blue[6], border: openColors.blue[8], text: '#ffffff', hover: openColors.blue[7] },
    metric: { bg: openColors.violet[6], border: openColors.violet[8], text: '#ffffff', hover: openColors.violet[7] },
    risk: { bg: openColors.orange[6], border: openColors.orange[8], text: '#ffffff', hover: openColors.orange[7] },
    neutral: { bg: openColors.gray[6], border: openColors.gray[8], text: '#ffffff', hover: openColors.gray[7] },
  },
  pastel: {
    revenue: { bg: openColors.teal[2], border: openColors.teal[4], text: openColors.teal[9], hover: openColors.teal[3] },
    cost: { bg: openColors.red[2], border: openColors.red[4], text: openColors.red[9], hover: openColors.red[3] },
    asset: { bg: openColors.blue[2], border: openColors.blue[4], text: openColors.blue[9], hover: openColors.blue[3] },
    metric: { bg: openColors.violet[2], border: openColors.violet[4], text: openColors.violet[9], hover: openColors.violet[3] },
    risk: { bg: openColors.orange[2], border: openColors.orange[4], text: openColors.orange[9], hover: openColors.orange[3] },
    neutral: { bg: openColors.gray[2], border: openColors.gray[4], text: openColors.gray[8], hover: openColors.gray[3] },
  },
  monochrome: {
    revenue: { bg: openColors.gray[2], border: openColors.gray[5], text: openColors.gray[9], hover: openColors.gray[3] },
    cost: { bg: openColors.gray[3], border: openColors.gray[6], text: openColors.gray[9], hover: openColors.gray[4] },
    asset: { bg: openColors.gray[4], border: openColors.gray[7], text: openColors.gray[9], hover: openColors.gray[5] },
    metric: { bg: openColors.gray[5], border: openColors.gray[8], text: '#ffffff', hover: openColors.gray[6] },
    risk: { bg: openColors.gray[6], border: openColors.gray[8], text: '#ffffff', hover: openColors.gray[7] },
    neutral: { bg: openColors.gray[1], border: openColors.gray[4], text: openColors.gray[8], hover: openColors.gray[2] },
  },
};

// Excalidraw-style category colors for treemap segments
const excalidrawCategoryColors = [
  { bg: openColors.blue[1], border: openColors.blue[6], text: openColors.blue[9] },
  { bg: openColors.teal[1], border: openColors.teal[6], text: openColors.teal[9] },
  { bg: openColors.green[1], border: openColors.green[6], text: openColors.green[9] },
  { bg: openColors.yellow[1], border: openColors.yellow[6], text: openColors.yellow[9] },
  { bg: openColors.orange[1], border: openColors.orange[6], text: openColors.orange[9] },
  { bg: openColors.red[1], border: openColors.red[6], text: openColors.red[9] },
  { bg: openColors.pink[1], border: openColors.pink[6], text: openColors.pink[9] },
  { bg: openColors.grape[1], border: openColors.grape[6], text: openColors.grape[9] },
  { bg: openColors.violet[1], border: openColors.violet[6], text: openColors.violet[9] },
  { bg: openColors.indigo[1], border: openColors.indigo[6], text: openColors.indigo[9] },
  { bg: openColors.cyan[1], border: openColors.cyan[6], text: openColors.cyan[9] },
  { bg: openColors.lime[1], border: openColors.lime[6], text: openColors.lime[9] },
];

// ============ THEME STYLES ============

const themeStyles: Record<ThemeMode, { bg: string; text: string; border: string; panel: string; muted: string }> = {
  light: {
    bg: openColors.gray[0], // Excalidraw canvas background
    text: openColors.gray[9],
    border: openColors.gray[4],
    panel: '#ffffff',
    muted: openColors.gray[6],
  },
  dark: {
    bg: '#1e1e1e',
    text: openColors.gray[1],
    border: openColors.gray[7],
    panel: '#2d2d2d',
    muted: openColors.gray[5],
  },
};

// ============ EXCALIDRAW FONT STYLES ============
// Using a hand-drawn style font similar to Virgil/Excalifont

const excalidrawFontFamily = "'Virgil', 'Segoe Print', 'Bradley Hand', 'Chilanka', cursive";
const excalidrawFontFamilyUI = "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";

// ============ HELPER FUNCTIONS ============

const formatValue = (value: number | undefined): string => {
  if (value === undefined) return '';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

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

// Generate hand-drawn style path with slight wobble
const generateHandDrawnRect = (x: number, y: number, width: number, height: number, seed: number = 0): string => {
  const wobble = 1.5;
  const rand = (i: number) => Math.sin(seed + i * 12.9898) * 0.5;
  
  const x1 = x + rand(1) * wobble;
  const y1 = y + rand(2) * wobble;
  const x2 = x + width + rand(3) * wobble;
  const y2 = y + rand(4) * wobble;
  const x3 = x + width + rand(5) * wobble;
  const y3 = y + height + rand(6) * wobble;
  const x4 = x + rand(7) * wobble;
  const y4 = y + height + rand(8) * wobble;
  
  return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
};

// ============ MAIN COMPONENT ============

export default function DiagramCanvas({
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
    const canvasWidth = 900;
    const canvasHeight = 500;
    return squarify(diagramData.nodes, 50, 120, canvasWidth - 100, canvasHeight - 170);
  }, [diagramData]);

  // Get color for node
  const getNodeColor = useCallback((node: DiagramNode, index: number) => {
    if (node.color) {
      return { bg: node.color, border: node.color, text: '#ffffff' };
    }
    if (node.category && currentColors[node.category]) {
      return currentColors[node.category];
    }
    // Use rotating Excalidraw colors for treemap segments
    return excalidrawCategoryColors[index % excalidrawCategoryColors.length];
  }, [currentColors]);

  if (!isOpen) return null;

  const canvasWidth = 900;
  const canvasHeight = 500;

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
                            ringColor: excalidrawPrimary.violet,
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

            {/* Metrics Header */}
            {diagramData?.metrics && diagramData.metrics.length > 0 && (
              <g>
                {diagramData.metrics.map((metric, i) => {
                  const metricWidth = 150;
                  const startX = 50 + i * (metricWidth + 20);
                  return (
                    <g key={i}>
                      <rect
                        x={startX}
                        y={20}
                        width={metricWidth}
                        height={70}
                        rx={8}
                        fill={currentTheme.panel}
                        stroke={currentTheme.border}
                        strokeWidth={2}
                      />
                      <text
                        x={startX + 12}
                        y={42}
                        fontSize={10}
                        fill={currentTheme.muted}
                        fontFamily={excalidrawFontFamilyUI}
                        textTransform="uppercase"
                      >
                        {metric.label}
                      </text>
                      <text
                        x={startX + 12}
                        y={65}
                        fontSize={22}
                        fontWeight="600"
                        fill={currentTheme.text}
                        fontFamily={excalidrawFontFamily}
                      >
                        {metric.value}
                      </text>
                      {metric.change && (
                        <text
                          x={startX + 12}
                          y={82}
                          fontSize={11}
                          fill={
                            metric.trend === 'up' ? openColors.teal[6] :
                            metric.trend === 'down' ? openColors.red[6] :
                            currentTheme.muted
                          }
                          fontFamily={excalidrawFontFamilyUI}
                        >
                          {metric.change}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Treemap Nodes */}
            {diagramData?.layoutType === 'treemap' && diagramData.nodes.map((node, index) => {
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

            {/* Comparison Bar Chart */}
            {diagramData?.layoutType === 'comparison' && (() => {
              const nodes = diagramData.nodes;
              if (!nodes || nodes.length === 0) return null;
              
              const maxValue = Math.max(...nodes.map(n => n.value || n.percentage || 0));
              const barWidth = Math.min(80, (canvasWidth - 200) / nodes.length - 20);
              const chartHeight = canvasHeight - 250;
              const chartTop = 120;
              const chartLeft = 100;
              
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
                    x2={canvasWidth - 50}
                    y2={chartTop + chartHeight}
                    stroke={currentTheme.border}
                    strokeWidth={2}
                  />
                  
                  {/* Y-axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const y = chartTop + chartHeight * (1 - ratio);
                    const value = maxValue * ratio;
                    return (
                      <g key={i}>
                        <line
                          x1={chartLeft - 5}
                          y1={y}
                          x2={chartLeft}
                          y2={y}
                          stroke={currentTheme.border}
                          strokeWidth={1}
                        />
                        <text
                          x={chartLeft - 10}
                          y={y + 4}
                          textAnchor="end"
                          fontSize={10}
                          fill={currentTheme.muted}
                          fontFamily={excalidrawFontFamilyUI}
                        >
                          {formatValue(value)}
                        </text>
                        {/* Grid line */}
                        <line
                          x1={chartLeft}
                          y1={y}
                          x2={canvasWidth - 50}
                          y2={y}
                          stroke={currentTheme.border}
                          strokeWidth={0.5}
                          strokeDasharray="4,4"
                          opacity={0.3}
                        />
                      </g>
                    );
                  })}
                  
                  {/* Bars */}
                  {nodes.map((node, index) => {
                    const value = node.value || node.percentage || 0;
                    const barHeight = (value / maxValue) * chartHeight;
                    const x = chartLeft + 40 + index * (barWidth + 20);
                    const y = chartTop + chartHeight - barHeight;
                    const colors = getNodeColor(node, index);
                    const isHovered = hoveredNode === node.id;
                    
                    return (
                      <g
                        key={node.id}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Bar */}
                        <path
                          d={generateHandDrawnRect(x, y, barWidth, barHeight, index)}
                          fill={isHovered ? colors.border : colors.bg}
                          stroke={colors.border}
                          strokeWidth={2}
                          style={{
                            transition: 'all 0.2s ease',
                            filter: isHovered ? 'brightness(1.05)' : 'none',
                          }}
                        />
                        
                        {/* Value label on top of bar */}
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
                        
                        {/* X-axis label */}
                        <text
                          x={x + barWidth / 2}
                          y={chartTop + chartHeight + 20}
                          textAnchor="middle"
                          fontSize={11}
                          fill={currentTheme.text}
                          fontFamily={excalidrawFontFamily}
                        >
                          {node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label}
                        </text>
                        
                        {/* Percentage if available */}
                        {node.percentage !== undefined && (
                          <text
                            x={x + barWidth / 2}
                            y={chartTop + chartHeight + 35}
                            textAnchor="middle"
                            fontSize={10}
                            fill={currentTheme.muted}
                            fontFamily={excalidrawFontFamilyUI}
                          >
                            {node.percentage}%
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}

            {/* Tooltip */}
            {hoveredNode && diagramData && (
              (() => {
                const node = diagramData.nodes.find(n => n.id === hoveredNode);
                const pos = nodePositions.get(hoveredNode);
                if (!node || !pos) return null;
                
                const tooltipX = Math.min(pos.x + pos.width + 10, canvasWidth - 180);
                const tooltipY = Math.max(pos.y, 20);
                
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={tooltipX}
                      y={tooltipY}
                      width={170}
                      height={90}
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
                        textTransform="capitalize"
                      >
                        Category: {node.category}
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
              title="Zoom In"
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
              title="Zoom Out"
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

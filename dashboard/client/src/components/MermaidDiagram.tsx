import { useEffect, useRef, useState, useMemo } from 'react';
import mermaid from 'mermaid';
import {
  X, Download, Maximize2, Minimize2, Loader2, ZoomIn, ZoomOut, RotateCcw,
  TrendingUp, TrendingDown, Minus, DollarSign, Percent, BarChart3, PieChart, GitBranch
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

interface MermaidDiagramProps {
  title: string;
  description?: string;
  diagramData: DiagramData;
  isOpen: boolean;
  onClose: () => void;
}

// ============ CATEGORY COLORS ============

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  revenue: { bg: '#166534', border: '#22c55e', text: '#dcfce7' },
  cost: { bg: '#991b1b', border: '#ef4444', text: '#fee2e2' },
  asset: { bg: '#1e40af', border: '#3b82f6', text: '#dbeafe' },
  metric: { bg: '#6b21a8', border: '#a855f7', text: '#f3e8ff' },
  risk: { bg: '#c2410c', border: '#f97316', text: '#ffedd5' },
  neutral: { bg: '#374151', border: '#6b7280', text: '#f3f4f6' },
};

// ============ MERMAID INITIALIZATION ============

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#4f46e5',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#6366f1',
    lineColor: '#94a3b8',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    background: '#0f172a',
    mainBkg: '#1e293b',
    nodeBorder: '#6366f1',
    clusterBkg: '#1e293b',
    titleColor: '#f8fafc',
    edgeLabelBackground: '#1e293b',
    nodeTextColor: '#f8fafc',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 20,
    nodeSpacing: 50,
    rankSpacing: 80,
  },
  pie: {
    textPosition: 0.75,
  },
});

// ============ MERMAID CONVERTERS ============

function convertToFlowchart(data: DiagramData): string {
  const lines: string[] = ['flowchart TD'];
  
  // Add nodes with styled labels including values
  data.nodes.forEach(node => {
    const label = node.valueLabel 
      ? `${node.label}<br/><strong>${node.valueLabel}</strong>`
      : node.label;
    const safeLabel = label.replace(/"/g, "'");
    
    // Use different shapes based on category
    const shape = node.category === 'metric' ? '([' : 
                  node.category === 'risk' ? '{{' :
                  node.category === 'revenue' ? '([' : '[';
    const closeShape = node.category === 'metric' ? '])' : 
                       node.category === 'risk' ? '}}' :
                       node.category === 'revenue' ? '])' : ']';
    
    lines.push(`    ${node.id}${shape}"${safeLabel}"${closeShape}`);
  });
  
  // Add connections with labels
  data.connections.forEach(conn => {
    if (conn.label) {
      const safeLabel = conn.label.replace(/"/g, "'");
      lines.push(`    ${conn.from} -->|"${safeLabel}"| ${conn.to}`);
    } else {
      lines.push(`    ${conn.from} --> ${conn.to}`);
    }
  });
  
  // Add styling based on categories
  lines.push('');
  const categorizedNodes: Record<string, string[]> = {};
  data.nodes.forEach(node => {
    const cat = node.category || 'neutral';
    if (!categorizedNodes[cat]) categorizedNodes[cat] = [];
    categorizedNodes[cat].push(node.id);
  });
  
  Object.entries(categorizedNodes).forEach(([category, nodeIds]) => {
    const colors = categoryColors[category] || categoryColors.neutral;
    lines.push(`    classDef ${category} fill:${colors.bg},stroke:${colors.border},stroke-width:2px,color:${colors.text}`);
    lines.push(`    class ${nodeIds.join(',')} ${category}`);
  });
  
  return lines.join('\n');
}

function convertToPie(data: DiagramData): string {
  const lines: string[] = ['pie showData'];
  lines.push(`    title ${data.nodes[0]?.label || 'Distribution'}`);
  
  data.nodes.forEach(node => {
    if (node.value !== undefined) {
      const label = node.label.replace(/"/g, "'");
      lines.push(`    "${label}" : ${node.value}`);
    }
  });
  
  return lines.join('\n');
}

function convertToBar(data: DiagramData): string {
  // Use xychart for bar charts
  const lines: string[] = ['xychart-beta horizontal'];
  lines.push('    title "Comparison"');
  
  const labels = data.nodes.map(n => `"${n.label.replace(/"/g, "'").substring(0, 15)}"`).join(', ');
  const values = data.nodes.map(n => n.value || 0).join(', ');
  
  lines.push(`    x-axis [${labels}]`);
  lines.push(`    y-axis "Value"`);
  lines.push(`    bar [${values}]`);
  
  return lines.join('\n');
}

function convertToSankey(data: DiagramData): string {
  // Sankey diagram
  const lines: string[] = ['sankey-beta'];
  
  data.connections.forEach(conn => {
    const fromNode = data.nodes.find(n => n.id === conn.from);
    const toNode = data.nodes.find(n => n.id === conn.to);
    if (fromNode && toNode) {
      const value = conn.value || fromNode.value || 100;
      lines.push(`${fromNode.label},${toNode.label},${value}`);
    }
  });
  
  return lines.join('\n');
}

function convertToMermaid(data: DiagramData): string {
  switch (data.chartType) {
    case 'pie':
      return convertToPie(data);
    case 'bar':
      return convertToBar(data);
    case 'sankey':
      return convertToSankey(data);
    case 'treemap':
      // Treemap not directly supported, fall back to flowchart
      return convertToFlowchart(data);
    case 'flowchart':
    default:
      return convertToFlowchart(data);
  }
}

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

// ============ CHART TYPE SELECTOR ============

function ChartTypeIndicator({ chartType }: { chartType: string }) {
  const icons: Record<string, typeof BarChart3> = {
    flowchart: GitBranch,
    sankey: GitBranch,
    pie: PieChart,
    bar: BarChart3,
    treemap: BarChart3,
  };
  
  const Icon = icons[chartType] || GitBranch;
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700/50 rounded-lg text-xs text-zinc-400">
      <Icon className="w-4 h-4" />
      <span className="capitalize">{chartType}</span>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function MermaidDiagram({
  title,
  description,
  diagramData,
  isOpen,
  onClose,
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const mermaidCode = useMemo(() => convertToMermaid(diagramData), [diagramData]);

  useEffect(() => {
    if (!isOpen || !diagramData) return;

    const renderDiagram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        setSvgContent(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsLoading(false);
      }
    };

    renderDiagram();
  }, [isOpen, diagramData, mermaidCode]);

  const handleExport = async () => {
    if (!svgContent) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (!blob) return;
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${title.replace(/\s+/g, '_')}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
        }, 'image/png');
        
        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={cn(
        "bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200",
        isFullscreen ? "w-full h-full rounded-none" : "w-[90vw] h-[85vh] max-w-6xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 flex-shrink-0 bg-zinc-800">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <ChartTypeIndicator chartType={diagramData.chartType || 'flowchart'} />
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-zinc-700/50 rounded-lg">
              <button
                onClick={handleZoomOut}
                className="p-1 hover:bg-zinc-600 rounded transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4 text-zinc-400" />
              </button>
              <span className="text-xs text-zinc-400 min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 hover:bg-zinc-600 rounded transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4 text-zinc-400" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1 hover:bg-zinc-600 rounded transition-colors"
                title="Reset zoom"
              >
                <RotateCcw className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
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
        {diagramData.metrics && diagramData.metrics.length > 0 && (
          <MetricsPanel metrics={diagramData.metrics} />
        )}

        {/* Diagram Content */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-8"
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <span className="text-sm text-zinc-400">Rendering diagram...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 text-center max-w-md">
              <div className="text-red-400 text-sm">{error}</div>
              <pre className="text-xs text-zinc-500 bg-zinc-800 p-4 rounded-lg overflow-auto max-h-48 w-full">
                {mermaidCode}
              </pre>
            </div>
          ) : (
            <div 
              className="transition-transform duration-200 [&_svg]:max-w-full"
              style={{ transform: `scale(${zoom})` }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>

        {/* Footer with Mermaid code preview */}
        <div className="px-4 py-2 border-t border-zinc-700 bg-zinc-800/50">
          <details className="text-xs">
            <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
              View Mermaid code
            </summary>
            <pre className="mt-2 p-3 bg-zinc-900 rounded-lg text-zinc-400 overflow-auto max-h-32">
              {mermaidCode}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

export default MermaidDiagram;

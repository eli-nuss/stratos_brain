import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  X, Download, Maximize2, Minimize2, Loader2, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#6366f1',
    primaryTextColor: '#fff',
    primaryBorderColor: '#4f46e5',
    lineColor: '#94a3b8',
    secondaryColor: '#1e293b',
    tertiaryColor: '#0f172a',
    background: '#0f172a',
    mainBkg: '#1e293b',
    nodeBorder: '#4f46e5',
    clusterBkg: '#1e293b',
    titleColor: '#f8fafc',
    edgeLabelBackground: '#1e293b',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 20,
  },
});

interface DiagramData {
  nodes: Array<{ id: string; label: string }>;
  connections: Array<{ from: string; to: string; label?: string }>;
}

interface MermaidDiagramProps {
  title: string;
  description?: string;
  diagramData: DiagramData;
  isOpen: boolean;
  onClose: () => void;
}

// Convert diagram data to Mermaid syntax
function convertToMermaid(data: DiagramData): string {
  const lines: string[] = ['flowchart TD'];
  
  // Add nodes with labels
  data.nodes.forEach(node => {
    // Escape special characters and wrap in quotes
    const label = node.label.replace(/"/g, "'");
    lines.push(`    ${node.id}["${label}"]`);
  });
  
  // Add connections
  data.connections.forEach(conn => {
    if (conn.label) {
      const label = conn.label.replace(/"/g, "'");
      lines.push(`    ${conn.from} -->|"${label}"| ${conn.to}`);
    } else {
      lines.push(`    ${conn.from} --> ${conn.to}`);
    }
  });
  
  // Add styling
  lines.push('');
  lines.push('    classDef default fill:#1e293b,stroke:#4f46e5,stroke-width:2px,color:#f8fafc');
  lines.push('    classDef highlight fill:#4f46e5,stroke:#6366f1,stroke-width:2px,color:#fff');
  
  return lines.join('\n');
}

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

  useEffect(() => {
    if (!isOpen || !diagramData) return;

    const renderDiagram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const mermaidCode = convertToMermaid(diagramData);
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
  }, [isOpen, diagramData]);

  const handleExport = async () => {
    if (!svgContent) return;

    try {
      // Create a canvas to convert SVG to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create an image from the SVG
      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Set canvas size with some padding
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        
        // Fill background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Export as PNG
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
        isFullscreen ? "w-full h-full rounded-none" : "w-[90vw] h-[85vh] max-w-5xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 flex-shrink-0 bg-zinc-800">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
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
                {convertToMermaid(diagramData)}
              </pre>
            </div>
          ) : (
            <div 
              className="transition-transform duration-200"
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
              {convertToMermaid(diagramData)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

export default MermaidDiagram;

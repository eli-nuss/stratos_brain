import { useState, useRef, useEffect } from 'react';
import {
  FileText, Presentation, PenTool, Table2, Sparkles,
  ChevronDown, ChevronRight, Loader2, Download, Eye,
  X, Check, AlertCircle, Trash2, RefreshCw, Copy, Edit2,
  MoreHorizontal, Share2, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiagramCanvas } from './DiagramCanvas';
import type { 
  DiagramNode, 
  DiagramConnection, 
  DiagramMetric, 
  DiagramData 
} from './diagrams/types';

// ============ TYPES ============

export type OutputType = 'report' | 'slides' | 'diagram' | 'table';

// Re-export diagram types for external use
export type { DiagramNode, DiagramConnection, DiagramMetric, DiagramData };

export interface StudioOutput {
  id: string;
  type: OutputType;
  title: string;
  status: 'generating' | 'ready' | 'error';
  content?: string;
  diagramData?: DiagramData;
  error?: string;
  createdAt: string;
  prompt?: string;
}

interface StudioPanelProps {
  chatId: string;
  onGenerate: (type: OutputType, prompt?: string) => Promise<StudioOutput>;
  onDelete?: (outputId: string) => Promise<void>;
  onRename?: (outputId: string, newTitle: string) => Promise<void>;
  onDuplicate?: (output: StudioOutput) => Promise<StudioOutput>;
  outputs: StudioOutput[];
  isGenerating: boolean;
  isLoading?: boolean;
  className?: string;
}

// ============ HELPERS ============

const outputTypes: { type: OutputType; label: string; icon: typeof FileText; description: string }[] = [
  { type: 'report', label: 'Report', icon: FileText, description: 'Investment memo or analysis report' },
  { type: 'slides', label: 'Slides', icon: Presentation, description: 'Presentation deck' },
  { type: 'diagram', label: 'Diagram', icon: PenTool, description: 'Interactive flowchart diagram' },
  { type: 'table', label: 'Table', icon: Table2, description: 'Formatted data table' },
];

function getOutputIcon(type: OutputType) {
  switch (type) {
    case 'report':
      return FileText;
    case 'slides':
      return Presentation;
    case 'diagram':
      return PenTool;
    case 'table':
      return Table2;
    default:
      return FileText;
  }
}

function getStatusBadge(status: StudioOutput['status']) {
  switch (status) {
    case 'ready':
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
          <Check className="w-3 h-3" />
          Ready
        </span>
      );
    case 'generating':
      return (
        <span className="flex items-center gap-1 text-[10px] text-blue-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[10px] text-red-400">
          <AlertCircle className="w-3 h-3" />
          Error
        </span>
      );
  }
}

// Generate a simple thumbnail preview for diagrams
function DiagramThumbnail({ diagramData }: { diagramData?: DiagramData }) {
  if (!diagramData?.nodes || diagramData.nodes.length === 0) {
    return (
      <div className="w-12 h-12 bg-zinc-800 rounded flex items-center justify-center">
        <PenTool className="w-5 h-5 text-zinc-600" />
      </div>
    );
  }

  const layoutType = diagramData.layoutType || 'treemap';
  const nodes = diagramData.nodes.slice(0, 6);
  const total = nodes.reduce((sum, n) => sum + (n.value || 1), 0);

  // Simple treemap thumbnail
  if (layoutType === 'treemap') {
    return (
      <div className="w-12 h-12 bg-zinc-800 rounded overflow-hidden flex flex-wrap">
        {nodes.map((node, i) => {
          const size = ((node.value || 1) / total) * 100;
          const colors = ['bg-emerald-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-cyan-600'];
          return (
            <div
              key={i}
              className={cn("rounded-sm", colors[i % colors.length])}
              style={{
                width: `${Math.max(size, 20)}%`,
                height: nodes.length <= 3 ? '100%' : '50%',
              }}
            />
          );
        })}
      </div>
    );
  }

  // Simple bar chart thumbnail for comparison/waterfall
  if (layoutType === 'comparison' || layoutType === 'waterfall') {
    const maxValue = Math.max(...nodes.map(n => n.value || 1));
    return (
      <div className="w-12 h-12 bg-zinc-800 rounded overflow-hidden flex items-end gap-0.5 p-1">
        {nodes.slice(0, 5).map((node, i) => {
          const height = ((node.value || 1) / maxValue) * 100;
          const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
          return (
            <div
              key={i}
              className={cn("flex-1 rounded-t-sm", colors[i % colors.length])}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
    );
  }

  // Default hierarchy thumbnail
  return (
    <div className="w-12 h-12 bg-zinc-800 rounded overflow-hidden p-1">
      <div className="w-full h-2 bg-indigo-500 rounded-sm mb-1" />
      <div className="flex gap-0.5">
        <div className="flex-1 h-3 bg-emerald-500 rounded-sm" />
        <div className="flex-1 h-3 bg-blue-500 rounded-sm" />
        <div className="flex-1 h-3 bg-purple-500 rounded-sm" />
      </div>
    </div>
  );
}

// ============ GENERATE MODAL ============

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (type: OutputType, prompt?: string) => Promise<void>;
  isGenerating: boolean;
  initialPrompt?: string;
  initialType?: OutputType;
}

function GenerateModal({ isOpen, onClose, onGenerate, isGenerating, initialPrompt, initialType }: GenerateModalProps) {
  const [selectedType, setSelectedType] = useState<OutputType>(initialType || 'report');
  const [customPrompt, setCustomPrompt] = useState(initialPrompt || '');

  useEffect(() => {
    if (initialPrompt) setCustomPrompt(initialPrompt);
    if (initialType) setSelectedType(initialType);
  }, [initialPrompt, initialType]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    await onGenerate(selectedType, customPrompt || undefined);
    setCustomPrompt('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Generate Output</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Output Type Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Output Type</label>
            <div className="grid grid-cols-2 gap-2">
              {outputTypes.map(({ type, label, icon: Icon, description }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-lg border transition-colors text-left",
                    selectedType === type
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn(
                      "w-4 h-4",
                      selectedType === type ? "text-purple-400" : "text-zinc-400"
                    )} />
                    <span className={cn(
                      "text-sm font-medium",
                      selectedType === type ? "text-purple-300" : "text-white"
                    )}>
                      {label}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">{description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Instructions (optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add specific instructions for the output..."
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors",
              "bg-purple-600 text-white hover:bg-purple-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ TEXT VIEWER MODAL ============

interface TextViewerProps {
  output: StudioOutput;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}

function TextViewer({ output, isOpen, onClose, onDownload }: TextViewerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[80vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            {(() => {
              const Icon = getOutputIcon(output.type);
              return <Icon className="w-5 h-5 text-purple-400" />;
            })()}
            <h3 className="text-sm font-semibold text-white">{output.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">
            {output.content || 'No content available'}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============ CONTEXT MENU ============

interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  onView: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  output: StudioOutput;
}

function ContextMenu({ 
  isOpen, onClose, position, 
  onView, onDownload, onRename, onDuplicate, onDelete, output 
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { icon: Eye, label: 'View', onClick: onView, show: output.status === 'ready' },
    { icon: Download, label: 'Download', onClick: onDownload, show: output.status === 'ready' },
    { icon: Edit2, label: 'Rename', onClick: onRename, show: true },
    { icon: Copy, label: 'Duplicate', onClick: onDuplicate, show: true },
    { icon: Trash2, label: 'Delete', onClick: onDelete, show: !!onDelete, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.filter(item => item.show).map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick?.();
            onClose();
          }}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
            item.danger 
              ? "text-red-400 hover:bg-red-900/30" 
              : "text-zinc-300 hover:bg-zinc-700"
          )}
        >
          <item.icon className="w-4 h-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ============ OUTPUT ITEM ============

interface OutputItemProps {
  output: StudioOutput;
  onView: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  onRename?: (newTitle: string) => void;
  onDuplicate?: () => void;
}

function OutputItem({ output, onView, onDownload, onDelete, onRename, onDuplicate }: OutputItemProps) {
  const Icon = getOutputIcon(output.type);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(output.title);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameSubmit = () => {
    if (onRename && newTitle.trim() && newTitle !== output.title) {
      onRename(newTitle.trim());
    }
    setIsRenaming(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div 
        className="flex items-center gap-3 px-3 py-2.5 bg-zinc-800/30 border border-zinc-700/50 rounded-lg hover:bg-zinc-800/50 transition-colors group cursor-pointer"
        onContextMenu={handleContextMenu}
        onClick={output.status === 'ready' ? onView : undefined}
      >
        {/* Thumbnail */}
        {output.type === 'diagram' ? (
          <DiagramThumbnail diagramData={output.diagramData} />
        ) : (
          <div className="w-12 h-12 bg-zinc-800 rounded flex items-center justify-center">
            <Icon className="w-5 h-5 text-zinc-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setNewTitle(output.title);
                  setIsRenaming(false);
                }
              }}
              className="w-full bg-zinc-700 border border-purple-500 rounded px-2 py-0.5 text-xs font-medium text-white focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white truncate">{output.title}</span>
              {getStatusBadge(output.status)}
            </div>
          )}
          <span className="text-[10px] text-zinc-500">
            {new Date(output.createdAt).toLocaleString()}
          </span>
        </div>

        {/* Quick Actions */}
        {output.status === 'ready' && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
              title="View"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY });
              }}
              className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        )}

        {output.status === 'generating' && (
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
        )}
      </div>

      {/* Context Menu */}
      <ContextMenu
        isOpen={!!contextMenu}
        onClose={() => setContextMenu(null)}
        position={contextMenu || { x: 0, y: 0 }}
        onView={onView}
        onDownload={onDownload}
        onRename={() => setIsRenaming(true)}
        onDuplicate={onDuplicate || (() => {})}
        onDelete={onDelete ? handleDelete : undefined}
        output={output}
      />
    </>
  );
}

// ============ MAIN COMPONENT ============

export function StudioPanel({
  chatId,
  onGenerate,
  onDelete,
  onRename,
  onDuplicate,
  outputs,
  isGenerating,
  isLoading,
  className
}: StudioPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingOutput, setViewingOutput] = useState<StudioOutput | null>(null);
  const [viewingDiagram, setViewingDiagram] = useState<StudioOutput | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ type: OutputType; prompt: string } | null>(null);

  const handleGenerate = async (type: OutputType, prompt?: string) => {
    await onGenerate(type, prompt);
  };

  const handleView = (output: StudioOutput) => {
    if (output.type === 'diagram') {
      // Always open DiagramCanvas for diagrams, even if diagramData is loading
      setViewingDiagram(output);
    } else {
      setViewingOutput(output);
    }
  };

  const handleDownload = (output: StudioOutput) => {
    if (!output.content && output.type !== 'diagram') return;
    
    if (output.type === 'diagram') {
      // For diagrams, trigger the canvas export
      setViewingDiagram(output);
      return;
    }
    
    // Create blob and download
    const blob = new Blob([output.content || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${output.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRename = async (outputId: string, newTitle: string) => {
    if (onRename) {
      await onRename(outputId, newTitle);
    }
  };

  const handleDuplicate = (output: StudioOutput) => {
    // Open generate modal with the same prompt
    setDuplicatePrompt({
      type: output.type,
      prompt: output.prompt || '',
    });
    setIsModalOpen(true);
  };

  const handleTitleChange = async (newTitle: string) => {
    if (viewingDiagram && onRename) {
      await onRename(viewingDiagram.id, newTitle);
      setViewingDiagram({ ...viewingDiagram, title: newTitle });
    }
  };

  return (
    <div className={cn("border-b border-zinc-700/50", className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Studio</span>
          {outputs.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded">
              {outputs.length}
            </span>
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Generate Button */}
          <button
            onClick={() => {
              setDuplicatePrompt(null);
              setIsModalOpen(true);
            }}
            disabled={isGenerating}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Output
              </>
            )}
          </button>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-4">
              <Loader2 className="w-8 h-8 text-purple-400 mx-auto mb-2 animate-spin" />
              <p className="text-xs text-zinc-500">Loading saved outputs...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && outputs.length === 0 && (
            <div className="text-center py-4">
              <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No outputs generated yet</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Create reports, slides, diagrams, and more
              </p>
            </div>
          )}

          {/* Output List */}
          {outputs.length > 0 && (
            <div className="space-y-2">
              {outputs.map((output) => (
                <OutputItem
                  key={output.id}
                  output={output}
                  onView={() => handleView(output)}
                  onDownload={() => handleDownload(output)}
                  onDelete={onDelete ? () => onDelete(output.id) : undefined}
                  onRename={onRename ? (newTitle) => handleRename(output.id, newTitle) : undefined}
                  onDuplicate={() => handleDuplicate(output)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate Modal */}
      <GenerateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDuplicatePrompt(null);
        }}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        initialPrompt={duplicatePrompt?.prompt}
        initialType={duplicatePrompt?.type}
      />

      {/* Text Viewer Modal */}
      {viewingOutput && (
        <TextViewer
          output={viewingOutput}
          isOpen={!!viewingOutput}
          onClose={() => setViewingOutput(null)}
          onDownload={() => handleDownload(viewingOutput)}
        />
      )}

      {/* Diagram Canvas Editor */}
      {viewingDiagram && (
        <DiagramCanvas
          title={viewingDiagram.title}
          description={viewingDiagram.content}
          diagramData={viewingDiagram.diagramData}
          isOpen={!!viewingDiagram}
          onClose={() => setViewingDiagram(null)}
          onTitleChange={handleTitleChange}
        />
      )}
    </div>
  );
}

export default StudioPanel;

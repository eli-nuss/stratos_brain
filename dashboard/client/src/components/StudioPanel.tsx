import { useState, useCallback } from 'react';
import {
  Sparkles, Plus, Trash2, Edit3, Download, Image as ImageIcon,
  Loader2, ChevronDown, ChevronRight, MoreHorizontal, Eye,
  FileJson, Wand2, Database, Search, Globe, CheckCircle2, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Diagram } from '@/hooks/useDiagrams';
import type { GenerationProgress } from '@/hooks/useDiagrams';

// ============ TYPES ============

interface StudioPanelProps {
  chatId: string;
  diagrams: Diagram[];
  isLoading: boolean;
  isGenerating?: boolean;
  generationProgress?: GenerationProgress | null;
  toolCalls?: Array<{ tool: string; args?: Record<string, unknown>; status: 'running' | 'complete' }>;
  onCreateDiagram: (prompt?: string) => void;
  onOpenDiagram: (diagramId: string) => void;
  onDeleteDiagram: (diagramId: string) => Promise<void>;
  onExportDiagram: (diagramId: string, format: 'png' | 'json') => Promise<void>;
  className?: string;
}

// ============ HELPERS ============

function getDiagramTypeLabel(type?: string): string {
  const labels: Record<string, string> = {
    flowchart: 'Flowchart',
    org_chart: 'Org Chart',
    mind_map: 'Mind Map',
    relationship: 'Relationship',
    timeline: 'Timeline',
    process: 'Process',
    hierarchy: 'Hierarchy',
    comparison: 'Comparison',
    custom: 'Custom',
  };
  return labels[type || 'custom'] || 'Diagram';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'get_company_fundamentals':
      return <Database className="w-3 h-3" />;
    case 'get_sector_peers':
      return <Database className="w-3 h-3" />;
    case 'search_web':
      return <Globe className="w-3 h-3" />;
    default:
      return <Search className="w-3 h-3" />;
  }
}

function getToolLabel(toolName: string) {
  switch (toolName) {
    case 'get_company_fundamentals':
      return 'Fetching fundamentals';
    case 'get_sector_peers':
      return 'Finding peers';
    case 'search_web':
      return 'Searching web';
    default:
      return toolName;
  }
}

// ============ GENERATION PROGRESS COMPONENT ============

interface GenerationProgressDisplayProps {
  progress: GenerationProgress | null;
  toolCalls: Array<{ tool: string; args?: Record<string, unknown>; status: 'running' | 'complete' }>;
}

function GenerationProgressDisplay({ progress, toolCalls }: GenerationProgressDisplayProps) {
  if (!progress) return null;

  const getStageIcon = () => {
    switch (progress.stage) {
      case 'starting':
        return <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />;
      case 'thinking':
        return <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />;
      case 'tool_call':
      case 'tool_result':
        return <Database className="w-4 h-4 text-blue-400" />;
      case 'parsing':
        return <Loader2 className="w-4 h-4 text-green-400 animate-spin" />;
      case 'saving':
        return <Loader2 className="w-4 h-4 text-green-400 animate-spin" />;
      case 'retrying':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'error':
        return <Circle className="w-4 h-4 text-red-400" />;
      default:
        return <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />;
    }
  };

  return (
    <div className="border border-purple-500/30 rounded-lg bg-purple-500/5 overflow-hidden">
      {/* Main Progress */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-purple-500/20">
        {getStageIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white font-medium truncate">{progress.message}</p>
          {progress.iteration !== undefined && (
            <p className="text-[10px] text-zinc-500">Step {progress.iteration + 1}</p>
          )}
        </div>
      </div>

      {/* Tool Calls */}
      {toolCalls.length > 0 && (
        <div className="px-3 py-2 space-y-1.5 bg-zinc-900/50">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Tools Used</p>
          {toolCalls.map((tc, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className={cn(
                "p-1 rounded",
                tc.status === 'complete' ? "bg-green-500/20" : "bg-blue-500/20"
              )}>
                {tc.status === 'complete' ? (
                  <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />
                ) : (
                  <Loader2 className="w-2.5 h-2.5 text-blue-400 animate-spin" />
                )}
              </div>
              <span className="text-[11px] text-zinc-300">{getToolLabel(tc.tool)}</span>
              {tc.args?.symbol && (
                <span className="text-[10px] text-zinc-500">({String(tc.args.symbol)})</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ CREATE DIAGRAM MODAL ============

interface CreateDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt?: string) => void;
}

function CreateDiagramModal({ isOpen, onClose, onSubmit }: CreateDiagramModalProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<'ai' | 'blank'>('ai');

  const handleSubmit = () => {
    if (mode === 'ai' && prompt.trim()) {
      onSubmit(prompt.trim());
    } else {
      onSubmit();
    }
    setPrompt('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Create Diagram
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
            ×
          </button>
        </div>

        {/* Mode Selection */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setMode('ai')}
            className={cn(
              "flex-1 px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-2",
              mode === 'ai'
                ? "text-white border-b-2 border-purple-500 bg-zinc-800/50"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
            )}
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Generated
          </button>
          <button
            onClick={() => setMode('blank')}
            className={cn(
              "flex-1 px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-2",
              mode === 'blank'
                ? "text-white border-b-2 border-purple-500 bg-zinc-800/50"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
            )}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Blank Canvas
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'ai' ? (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                What would you like to visualize?
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Create a flowchart showing Apple's revenue streams and how they connect to different product lines..."
                rows={4}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
              />
              <p className="text-[10px] text-zinc-500 mt-2">
                The AI will analyze your request and create an appropriate diagram type.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <Edit3 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Start with a blank Excalidraw canvas</p>
              <p className="text-xs text-zinc-500 mt-1">
                Draw freely and create your own diagram from scratch
              </p>
            </div>
          )}
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
            onClick={handleSubmit}
            disabled={mode === 'ai' && !prompt.trim()}
            className={cn(
              "px-4 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-2",
              "bg-purple-600 text-white hover:bg-purple-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {mode === 'ai' ? (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                Generate
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ DIAGRAM ITEM ============

interface DiagramItemProps {
  diagram: Diagram;
  onOpen: () => void;
  onDelete: () => void;
  onExport: (format: 'png' | 'json') => void;
}

function DiagramItem({ diagram, onOpen, onDelete, onExport }: DiagramItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="group relative border border-zinc-700/50 rounded-lg overflow-hidden bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
      {/* Thumbnail / Preview */}
      <div
        onClick={onOpen}
        className="aspect-video bg-zinc-900 flex items-center justify-center cursor-pointer relative"
      >
        {diagram.thumbnail_url ? (
          <img
            src={diagram.thumbnail_url}
            alt={diagram.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center text-zinc-600">
            <Sparkles className="w-8 h-8 mb-1" />
            <span className="text-[10px]">{getDiagramTypeLabel(diagram.diagram_type)}</span>
          </div>
        )}
        
        {/* Status overlay */}
        {diagram.status === 'generating' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-medium text-white truncate">{diagram.name}</h4>
            <p className="text-[10px] text-zinc-500">{formatDate(diagram.created_at)}</p>
          </div>
          
          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                  <button
                    onClick={() => { onOpen(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => { onExport('png'); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    <ImageIcon className="w-3 h-3" />
                    Export PNG
                  </button>
                  <button
                    onClick={() => { onExport('json'); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    <FileJson className="w-3 h-3" />
                    Export JSON
                  </button>
                  <div className="border-t border-zinc-700 my-1" />
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* AI badge */}
        {diagram.is_ai_generated && (
          <div className="flex items-center gap-1 mt-1">
            <Wand2 className="w-2.5 h-2.5 text-purple-400" />
            <span className="text-[9px] text-purple-400">AI Generated</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function StudioPanel({
  chatId,
  diagrams,
  isLoading,
  isGenerating = false,
  generationProgress = null,
  toolCalls = [],
  onCreateDiagram,
  onOpenDiagram,
  onDeleteDiagram,
  onExportDiagram,
  className
}: StudioPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateDiagram = useCallback((prompt?: string) => {
    onCreateDiagram(prompt);
  }, [onCreateDiagram]);

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
          {diagrams.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded">
              {diagrams.length}
            </span>
          )}
          {isGenerating && (
            <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin ml-1" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Diagrams Section */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400">Diagrams</span>
              <button
                onClick={() => setIsModalOpen(true)}
                disabled={isGenerating}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded transition-colors",
                  isGenerating && "opacity-50 cursor-not-allowed"
                )}
              >
                <Plus className="w-3 h-3" />
                New
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
              </div>
            )}

            {/* Generating State with Progress */}
            {isGenerating && (
              <div className="mb-3">
                <GenerationProgressDisplay 
                  progress={generationProgress} 
                  toolCalls={toolCalls} 
                />
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isGenerating && diagrams.length === 0 && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full flex flex-col items-center justify-center py-6 border border-dashed border-zinc-600 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/30 transition-colors"
              >
                <Sparkles className="w-8 h-8 text-zinc-600 mb-2" />
                <span className="text-xs">Create your first diagram</span>
                <span className="text-[10px] text-zinc-600 mt-1">
                  AI-generated or blank canvas
                </span>
              </button>
            )}

            {/* Diagram Grid */}
            {!isLoading && diagrams.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {diagrams.map((diagram) => (
                  <DiagramItem
                    key={diagram.diagram_id}
                    diagram={diagram}
                    onOpen={() => onOpenDiagram(diagram.diagram_id)}
                    onDelete={() => onDeleteDiagram(diagram.diagram_id)}
                    onExport={(format) => onExportDiagram(diagram.diagram_id, format)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateDiagramModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateDiagram}
      />
    </div>
  );
}

export default StudioPanel;

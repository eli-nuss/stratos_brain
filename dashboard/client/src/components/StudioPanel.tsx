import { useState } from 'react';
import {
  Sparkles, Plus, Trash2, Edit3, Download, Image as ImageIcon,
  Loader2, ChevronDown, ChevronRight, MoreHorizontal, Eye,
  FileJson, Wand2, Database, Search, Globe, CheckCircle2, Circle,
  ListChecks, Layout, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Diagram } from '@/hooks/useDiagrams';
import type { GenerationProgress, DiagramPlan } from '@/hooks/useDiagrams';

// ============ TYPES ============

interface StudioPanelProps {
  chatId: string;
  diagrams: Diagram[];
  isLoading: boolean;
  isGenerating?: boolean;
  generationProgress?: GenerationProgress | null;
  diagramPlan?: DiagramPlan | null;
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
    breakdown: 'Breakdown',
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
    case 'create_diagram_plan':
      return 'Creating plan';
    default:
      return toolName;
  }
}

// ============ GENERATION PROGRESS COMPONENT ============

interface GenerationProgressDisplayProps {
  progress: GenerationProgress | null;
  plan: DiagramPlan | null;
  toolCalls: Array<{ tool: string; args?: Record<string, unknown>; status: 'running' | 'complete' }>;
}

function GenerationProgressDisplay({ progress, plan, toolCalls }: GenerationProgressDisplayProps) {
  if (!progress) return null;

  const getStageIcon = () => {
    switch (progress.stage) {
      case 'planning':
        return <ListChecks className="w-4 h-4 text-purple-400 animate-pulse" />;
      case 'researching':
        return <Database className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'designing':
        return <Layout className="w-4 h-4 text-green-400 animate-pulse" />;
      case 'parsing':
        return <Loader2 className="w-4 h-4 text-green-400 animate-spin" />;
      case 'saving':
        return <Loader2 className="w-4 h-4 text-green-400 animate-spin" />;
      case 'refining':
        return <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'error':
        return <Circle className="w-4 h-4 text-red-400" />;
      default:
        return <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />;
    }
  };

  const getStageLabel = () => {
    switch (progress.stage) {
      case 'planning': return 'Planning';
      case 'researching': return 'Researching';
      case 'designing': return 'Designing';
      case 'parsing': return 'Processing';
      case 'saving': return 'Saving';
      case 'refining': return 'Refining';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return 'Working';
    }
  };

  return (
    <div className="border border-purple-500/30 rounded-lg bg-purple-500/5 overflow-hidden">
      {/* Stage Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-purple-500/20 bg-purple-500/10">
        {getStageIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white font-semibold">{getStageLabel()}</p>
          <p className="text-[10px] text-zinc-400 truncate">{progress.message}</p>
        </div>
      </div>

      {/* Plan/Checklist */}
      {plan && (
        <div className="px-3 py-2.5 border-b border-purple-500/20 bg-zinc-900/50">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Plan</span>
          </div>
          
          {/* Plan Title & Type */}
          <p className="text-xs text-white font-medium mb-1 truncate">{plan.title}</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
              {getDiagramTypeLabel(plan.type)}
            </span>
            <span className="text-[10px] text-zinc-500">
              ~{plan.estimated_elements} elements
            </span>
          </div>
          
          {/* Checklist */}
          <div className="space-y-1 mt-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide flex items-center gap-1">
              <ListChecks className="w-3 h-3" />
              Data Checklist
            </p>
            {plan.checklist.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {item.status === 'complete' ? (
                  <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                )}
                <span className={cn(
                  "text-[11px] truncate",
                  item.status === 'complete' ? "text-zinc-400 line-through" : "text-zinc-300"
                )}>
                  {item.item}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool Calls */}
      {toolCalls.length > 0 && (
        <div className="px-3 py-2 space-y-1.5 bg-zinc-900/50">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide flex items-center gap-1">
            <Database className="w-3 h-3" />
            Tools Used
          </p>
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
              {tc.args?.query && (
                <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                  ({String(tc.args.query).substring(0, 30)}...)
                </span>
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
                The AI will create a plan, gather real data, then design your diagram.
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
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mode === 'ai' && !prompt.trim()}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-2",
              mode === 'ai' && !prompt.trim()
                ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-500"
            )}
          >
            {mode === 'ai' ? (
              <>
                <Wand2 className="w-3 h-3" />
                Generate
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ DIAGRAM CARD ============

interface DiagramCardProps {
  diagram: Diagram;
  onOpen: () => void;
  onDelete: () => void;
  onExport: (format: 'png' | 'json') => void;
}

function DiagramCard({ diagram, onOpen, onDelete, onExport }: DiagramCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="group border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors bg-zinc-900/50">
      {/* Thumbnail / Preview */}
      <div
        onClick={onOpen}
        className="aspect-video bg-zinc-800/50 rounded-t-lg flex items-center justify-center cursor-pointer relative overflow-hidden"
      >
        {diagram.thumbnail_url ? (
          <img
            src={diagram.thumbnail_url}
            alt={diagram.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <ImageIcon className="w-8 h-8" />
            <span className="text-[10px]">No preview</span>
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            Open
          </button>
        </div>
        
        {/* AI badge */}
        {diagram.is_ai_generated && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-purple-500/80 rounded text-[9px] text-white font-medium flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            AI
          </div>
        )}
        
        {/* Status badge */}
        {diagram.status === 'generating' && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-yellow-500/80 rounded text-[9px] text-white font-medium flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Generating
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-medium text-white truncate">{diagram.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-zinc-500">{getDiagramTypeLabel(diagram.diagram_type)}</span>
              <span className="text-[10px] text-zinc-600">•</span>
              <span className="text-[10px] text-zinc-500">{formatDate(diagram.created_at)}</span>
            </div>
          </div>
          
          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-32 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 py-1">
                  <button
                    onClick={() => { onExport('png'); setShowMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                  >
                    <Download className="w-3 h-3" />
                    Export PNG
                  </button>
                  <button
                    onClick={() => { onExport('json'); setShowMenu(false); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                  >
                    <FileJson className="w-3 h-3" />
                    Export JSON
                  </button>
                  <div className="border-t border-zinc-700 my-1" />
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
  diagramPlan = null,
  toolCalls = [],
  onCreateDiagram,
  onOpenDiagram,
  onDeleteDiagram,
  onExportDiagram,
  className,
}: StudioPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-white"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Studio
          {diagrams.length > 0 && (
            <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-400">
              {diagrams.length}
            </span>
          )}
        </button>
        
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isGenerating}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            isGenerating
              ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              : "bg-purple-600/20 text-purple-400 hover:bg-purple-600/30"
          )}
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Generation Progress */}
          {isGenerating && (
            <GenerationProgressDisplay 
              progress={generationProgress} 
              plan={diagramPlan}
              toolCalls={toolCalls} 
            />
          )}

          {/* Loading State */}
          {isLoading && !isGenerating && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isGenerating && diagrams.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-xs text-zinc-500 mb-3">No diagrams yet</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                Create Diagram
              </button>
            </div>
          )}

          {/* Diagram List */}
          {!isLoading && diagrams.length > 0 && (
            <div className="space-y-2">
              {diagrams.map((diagram) => (
                <DiagramCard
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
      )}

      {/* Create Modal */}
      <CreateDiagramModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onCreateDiagram}
      />
    </div>
  );
}

export default StudioPanel;

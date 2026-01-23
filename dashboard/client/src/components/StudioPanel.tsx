import { useState } from 'react';
import {
  FileText, Presentation, PenTool, Table2, Sparkles,
  ChevronDown, ChevronRight, Loader2, Download, Eye,
  X, Check, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MermaidDiagram } from './MermaidDiagram';

// ============ TYPES ============

export type OutputType = 'report' | 'slides' | 'diagram' | 'table';

export interface DiagramNode {
  id: string;
  label: string;
  value?: number;
  valueLabel?: string;
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral';
  color?: string;
  icon?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  value?: number;
}

export interface DiagramMetric {
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

export interface StudioOutput {
  id: string;
  type: OutputType;
  title: string;
  status: 'generating' | 'ready' | 'error';
  content?: string;
  diagramData?: DiagramData;
  error?: string;
  createdAt: string;
}

interface StudioPanelProps {
  chatId: string;
  onGenerate: (type: OutputType, prompt?: string) => Promise<StudioOutput>;
  outputs: StudioOutput[];
  isGenerating: boolean;
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

// ============ GENERATE MODAL ============

interface GenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (type: OutputType, prompt?: string) => Promise<void>;
  isGenerating: boolean;
}

function GenerateModal({ isOpen, onClose, onGenerate, isGenerating }: GenerateModalProps) {
  const [selectedType, setSelectedType] = useState<OutputType>('report');
  const [customPrompt, setCustomPrompt] = useState('');

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

// ============ OUTPUT ITEM ============

interface OutputItemProps {
  output: StudioOutput;
  onView: () => void;
  onDownload: () => void;
}

function OutputItem({ output, onView, onDownload }: OutputItemProps) {
  const Icon = getOutputIcon(output.type);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
      <Icon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white truncate">{output.title}</span>
          {getStatusBadge(output.status)}
        </div>
        <span className="text-[10px] text-zinc-500">
          {new Date(output.createdAt).toLocaleString()}
        </span>
      </div>

      {output.status === 'ready' && (
        <div className="flex items-center gap-1">
          <button
            onClick={onView}
            className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
            title="View"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          <button
            onClick={onDownload}
            className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function StudioPanel({
  chatId,
  onGenerate,
  outputs,
  isGenerating,
  className
}: StudioPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingOutput, setViewingOutput] = useState<StudioOutput | null>(null);
  const [viewingDiagram, setViewingDiagram] = useState<StudioOutput | null>(null);

  const handleGenerate = async (type: OutputType, prompt?: string) => {
    await onGenerate(type, prompt);
  };

  const handleView = (output: StudioOutput) => {
    if (output.type === 'diagram' && output.diagramData) {
      setViewingDiagram(output);
    } else {
      setViewingOutput(output);
    }
  };

  const handleDownload = (output: StudioOutput) => {
    if (!output.content) return;
    
    // Create blob and download
    const blob = new Blob([output.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${output.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            onClick={() => setIsModalOpen(true)}
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

          {/* Empty State */}
          {outputs.length === 0 && (
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
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate Modal */}
      <GenerateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
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

      {/* Mermaid Diagram Viewer */}
      {viewingDiagram && viewingDiagram.diagramData && (
        <MermaidDiagram
          title={viewingDiagram.title}
          description={viewingDiagram.content}
          diagramData={viewingDiagram.diagramData}
          isOpen={!!viewingDiagram}
          onClose={() => setViewingDiagram(null)}
        />
      )}
    </div>
  );
}

export default StudioPanel;

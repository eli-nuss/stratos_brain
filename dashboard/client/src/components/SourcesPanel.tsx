import { useState, useCallback, useRef } from 'react';
import {
  FileText, Link, StickyNote, Plus, Trash2, RefreshCw,
  CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight,
  Upload, X, ExternalLink, ToggleLeft, ToggleRight, File
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

export interface Source {
  source_id: string;
  chat_id: string;
  source_type: 'file' | 'url' | 'text' | 'company_doc';
  name: string;
  description?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  source_url?: string;
  extracted_text?: string;
  word_count?: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message?: string;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SourcesPanelProps {
  chatId: string;
  sources: Source[];
  isLoading: boolean;
  onAddSource: (source: {
    source_type: 'file' | 'url' | 'text';
    name: string;
    description?: string;
    content?: string;
    url?: string;
    file?: File;
  }) => Promise<void>;
  onToggleSource: (sourceId: string, enabled: boolean) => Promise<void>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  onReprocessSource: (sourceId: string) => Promise<void>;
  className?: string;
}

// ============ HELPERS ============

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSourceIcon(type: Source['source_type']) {
  switch (type) {
    case 'file':
      return File;
    case 'url':
      return Link;
    case 'text':
      return StickyNote;
    case 'company_doc':
      return FileText;
    default:
      return FileText;
  }
}

function getStatusIcon(status: Source['status']) {
  switch (status) {
    case 'ready':
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case 'processing':
    case 'pending':
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  }
}

// ============ ADD SOURCE MODAL ============

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (source: {
    source_type: 'file' | 'url' | 'text';
    name: string;
    description?: string;
    content?: string;
    url?: string;
    file?: File;
  }) => Promise<void>;
}

function AddSourceModal({ isOpen, onClose, onSubmit }: AddSourceModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'text'>('file');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        source_type: activeTab,
        name: name || (activeTab === 'file' ? selectedFile?.name : activeTab === 'url' ? url : 'Note') || 'Untitled',
        description: description || undefined,
        content: activeTab === 'text' ? textContent : undefined,
        url: activeTab === 'url' ? url : undefined,
        file: activeTab === 'file' ? selectedFile || undefined : undefined,
      });
      // Reset form
      setName('');
      setDescription('');
      setUrl('');
      setTextContent('');
      setSelectedFile(null);
      onClose();
    } catch (error) {
      console.error('Failed to add source:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!name) setName(file.name);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!name) setName(file.name);
    }
  }, [name]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h3 className="text-sm font-semibold text-white">Add Source</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          {(['file', 'url', 'text'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-medium transition-colors",
                activeTab === tab
                  ? "text-white border-b-2 border-blue-500 bg-zinc-800/50"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
              )}
            >
              {tab === 'file' && <Upload className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === 'url' && <Link className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === 'text' && <StickyNote className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* File Upload */}
          {activeTab === 'file' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                selectedFile
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-600 hover:border-zinc-500 hover:bg-zinc-800/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <File className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-white">{selectedFile.name}</span>
                  <span className="text-xs text-zinc-400">({formatFileSize(selectedFile.size)})</span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">Drop a file here or click to browse</p>
                  <p className="text-xs text-zinc-500 mt-1">PDF, TXT, MD, CSV (max 10MB)</p>
                </>
              )}
            </div>
          )}

          {/* URL Input */}
          {activeTab === 'url' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Text Input */}
          {activeTab === 'text' && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Content</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste or type your notes here..."
                rows={6}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          )}

          {/* Name & Description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Source name"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
            </div>
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
            onClick={handleSubmit}
            disabled={isSubmitting || (activeTab === 'file' && !selectedFile) || (activeTab === 'url' && !url) || (activeTab === 'text' && !textContent)}
            className={cn(
              "px-4 py-2 text-xs font-medium rounded-lg transition-colors",
              "bg-blue-600 text-white hover:bg-blue-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Add Source'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ SOURCE ITEM ============

interface SourceItemProps {
  source: Source;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  onReprocess: () => void;
}

function SourceItem({ source, onToggle, onDelete, onReprocess }: SourceItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getSourceIcon(source.source_type);

  return (
    <div className={cn(
      "border border-zinc-700/50 rounded-lg overflow-hidden transition-colors",
      source.is_enabled ? "bg-zinc-800/30" : "bg-zinc-900/50 opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0.5 hover:bg-zinc-700 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>
        
        <Icon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white truncate">{source.name}</span>
            {getStatusIcon(source.status)}
          </div>
          {source.word_count && (
            <span className="text-[10px] text-zinc-500">{source.word_count.toLocaleString()} words</span>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggle(!source.is_enabled)}
          className="p-1 hover:bg-zinc-700 rounded"
          title={source.is_enabled ? 'Disable source' : 'Enable source'}
        >
          {source.is_enabled ? (
            <ToggleRight className="w-5 h-5 text-blue-400" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-zinc-500" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-700/50">
          {source.description && (
            <p className="text-xs text-zinc-400 mb-2">{source.description}</p>
          )}
          
          {source.source_url && (
            <a
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mb-2"
            >
              <ExternalLink className="w-3 h-3" />
              {source.source_url.substring(0, 40)}...
            </a>
          )}

          {source.status === 'error' && source.error_message && (
            <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 mb-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{source.error_message}</span>
            </div>
          )}

          {source.extracted_text && (
            <div className="p-2 bg-zinc-800 rounded text-xs text-zinc-300 max-h-24 overflow-y-auto">
              {source.extracted_text.substring(0, 300)}...
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            {source.status === 'error' && (
              <button
                onClick={onReprocess}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded ml-auto"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ MAIN COMPONENT ============

export function SourcesPanel({
  chatId,
  sources,
  isLoading,
  onAddSource,
  onToggleSource,
  onDeleteSource,
  onReprocessSource,
  className
}: SourcesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const enabledCount = sources.filter(s => s.is_enabled && s.status === 'ready').length;
  const totalWords = sources
    .filter(s => s.is_enabled && s.status === 'ready')
    .reduce((sum, s) => sum + (s.word_count || 0), 0);

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
          <FileText className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-white">Sources</span>
          {sources.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-700 text-zinc-300 rounded">
              {enabledCount}/{sources.length}
            </span>
          )}
        </div>
        {totalWords > 0 && (
          <span className="text-[10px] text-zinc-500">{totalWords.toLocaleString()} words</span>
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Add Source Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-zinc-600 rounded-lg text-xs text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Source
          </button>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && sources.length === 0 && (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No sources added yet</p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Add files, URLs, or notes to enhance your research
              </p>
            </div>
          )}

          {/* Source List */}
          {!isLoading && sources.length > 0 && (
            <div className="space-y-2">
              {sources.map((source) => (
                <SourceItem
                  key={source.source_id}
                  source={source}
                  onToggle={(enabled) => onToggleSource(source.source_id, enabled)}
                  onDelete={() => onDeleteSource(source.source_id)}
                  onReprocess={() => onReprocessSource(source.source_id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Source Modal */}
      <AddSourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onAddSource}
      />
    </div>
  );
}

export default SourcesPanel;

import { useState, useEffect, useRef } from 'react';
import { FileText, ChevronDown, ChevronUp, ExternalLink, Loader2, Clock, CheckCircle, BookOpen, RefreshCw } from 'lucide-react';

interface AssetFile {
  file_id: number;
  asset_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  description?: string;
  created_at: string;
}

interface DocumentsSectionProps {
  assetId: number;
  symbol: string;
  companyName?: string;
  assetType?: 'equity' | 'crypto';
  onOpenChat?: () => void;
}

interface CascadeStatus {
  isGenerating: boolean;
  currentPhase: 'idle' | 'deep_research' | 'memo' | 'one_pager' | 'complete';
  progress?: string;
  error?: string;
  jobId?: string;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: string;
  result?: {
    files?: {
      deep_research?: string;
      memo?: string;
      one_pager?: string;
    };
    file_url?: string;
    generation_time_seconds?: number;
    sources_cited?: number;
  };
  error?: string;
}

const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1';

export function DocumentsSection({ assetId, symbol, companyName, assetType, onOpenChat }: DocumentsSectionProps) {
  const [onePagers, setOnePagers] = useState<AssetFile[]>([]);
  const [memos, setMemos] = useState<AssetFile[]>([]);
  const [deepResearch, setDeepResearch] = useState<AssetFile[]>([]);
  const [showOnePagerHistory, setShowOnePagerHistory] = useState(false);
  const [showMemoHistory, setShowMemoHistory] = useState(false);
  const [showDeepResearchHistory, setShowDeepResearchHistory] = useState(false);
  const [cascadeStatus, setCascadeStatus] = useState<CascadeStatus>({ isGenerating: false, currentPhase: 'idle' });
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [assetId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/control-api/dashboard/files/${assetId}`);
      const data = await response.json();
      const files: AssetFile[] = data.files || [];
      
      const onePagerFiles = files
        .filter(f => f.file_type === 'one_pager')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const memoFiles = files
        .filter(f => f.file_type === 'memo')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const deepResearchFiles = files
        .filter(f => f.file_type === 'deep_research')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setOnePagers(onePagerFiles);
      setMemos(memoFiles);
      setDeepResearch(deepResearchFiles);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const pollJobStatus = async (jobId: string, onUpdate: (job: JobStatus) => void, onComplete: (job: JobStatus) => void) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/control-api/dashboard/job-status/${jobId}`);
        const job: JobStatus = await response.json();
        
        if (job.status === 'completed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          onComplete(job);
        } else if (job.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          onUpdate(job);
        } else {
          onUpdate(job);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };

    await poll();
    pollingIntervalRef.current = setInterval(poll, 3000);
  };

  const generateAllDocuments = async () => {
    setCascadeStatus({ 
      isGenerating: true, 
      currentPhase: 'deep_research',
      progress: 'Starting...'
    });

    try {
      const response = await fetch(`${API_BASE}/control-api/dashboard/create-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          asset_id: assetId,
          asset_type: assetType,
          document_type: 'all'
        })
      });

      const data = await response.json();
      
      if (data.job_id) {
        setCascadeStatus(prev => ({ 
          ...prev, 
          jobId: data.job_id,
          progress: 'Researching...'
        }));

        pollJobStatus(
          data.job_id,
          (job) => {
            if (job.status === 'failed') {
              setCascadeStatus({ 
                isGenerating: false, 
                currentPhase: 'idle',
                error: job.error || 'Generation failed'
              });
              setTimeout(() => setCascadeStatus({ isGenerating: false, currentPhase: 'idle' }), 10000);
            } else {
              let phase: CascadeStatus['currentPhase'] = 'deep_research';
              let progress = 'Researching...';
              if (job.progress?.includes('Phase 2') || job.progress?.includes('Memo')) {
                phase = 'memo';
                progress = 'Writing memo...';
              } else if (job.progress?.includes('Phase 3') || job.progress?.includes('One Pager')) {
                phase = 'one_pager';
                progress = 'Creating summary...';
              }
              setCascadeStatus(prev => ({ 
                ...prev, 
                currentPhase: phase,
                progress
              }));
            }
          },
          async (job) => {
            setCascadeStatus({ 
              isGenerating: false, 
              currentPhase: 'complete',
              progress: `Done (${job.result?.sources_cited || 0} sources)`
            });
            
            await fetchDocuments();
            
            if (job.result?.files?.deep_research) {
              window.open(job.result.files.deep_research, '_blank');
            }
            
            setTimeout(() => setCascadeStatus({ isGenerating: false, currentPhase: 'idle' }), 5000);
          }
        );
      } else if (data.error) {
        setCascadeStatus({ 
          isGenerating: false, 
          currentPhase: 'idle',
          error: data.error
        });
        setTimeout(() => setCascadeStatus({ isGenerating: false, currentPhase: 'idle' }), 10000);
      }
    } catch (error) {
      console.error('Error generating documents:', error);
      setCascadeStatus({ 
        isGenerating: false, 
        currentPhase: 'idle',
        error: 'Network error'
      });
      setTimeout(() => setCascadeStatus({ isGenerating: false, currentPhase: 'idle' }), 10000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderDocumentCard = (
    doc: AssetFile | undefined,
    title: string,
    historyDocs: AssetFile[],
    showHistory: boolean,
    setShowHistory: (show: boolean) => void
  ) => {
    const hasHistory = historyDocs.length > 0;

    return (
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{title}</div>
        
        {doc ? (
          <div className="space-y-1">
            <a
              href={doc.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-200 hover:text-white transition-colors group"
            >
              <FileText className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />
              <span className="truncate">{doc.file_name.replace(/_/g, ' ').replace('.md', '')}</span>
              <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
            </a>
            <div className="flex items-center gap-1 text-xs text-gray-600 ml-6">
              <Clock className="w-3 h-3" />
              {formatDate(doc.created_at)}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600">—</div>
        )}

        {hasHistory && (
          <div className="mt-2 ml-6">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {historyDocs.length} older
            </button>
            
            {showHistory && (
              <div className="mt-2 space-y-1">
                {historyDocs.map(d => (
                  <a
                    key={d.file_id}
                    href={d.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <span className="truncate">{formatDate(d.created_at)}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const hasAnyDocs = deepResearch.length > 0 || onePagers.length > 0 || memos.length > 0;

  return (
    <div className="bg-gray-900/30 rounded-lg border border-gray-800/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">Documents</h3>
        
        <button
          onClick={generateAllDocuments}
          disabled={cascadeStatus.isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:opacity-50 rounded text-xs font-medium text-gray-300 transition-colors disabled:cursor-not-allowed"
        >
          {cascadeStatus.isGenerating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              {cascadeStatus.progress}
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" />
              Generate
            </>
          )}
        </button>
      </div>

      {/* Status messages */}
      {cascadeStatus.error && (
        <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-900/30 rounded text-xs text-red-400">
          {cascadeStatus.error}
        </div>
      )}
      
      {cascadeStatus.currentPhase === 'complete' && !cascadeStatus.isGenerating && (
        <div className="mb-3 px-3 py-2 bg-green-900/20 border border-green-900/30 rounded text-xs text-green-400 flex items-center gap-2">
          <CheckCircle className="w-3 h-3" />
          {cascadeStatus.progress}
        </div>
      )}

      {/* Progress indicator */}
      {cascadeStatus.isGenerating && (
        <div className="mb-4 flex items-center gap-3 text-xs">
          <div className={`flex items-center gap-1 ${cascadeStatus.currentPhase === 'deep_research' ? 'text-blue-400' : cascadeStatus.currentPhase !== 'idle' ? 'text-green-500' : 'text-gray-600'}`}>
            {cascadeStatus.currentPhase === 'deep_research' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Research
          </div>
          <div className="w-4 h-px bg-gray-700" />
          <div className={`flex items-center gap-1 ${cascadeStatus.currentPhase === 'memo' ? 'text-blue-400' : ['one_pager', 'complete'].includes(cascadeStatus.currentPhase) ? 'text-green-500' : 'text-gray-600'}`}>
            {cascadeStatus.currentPhase === 'memo' ? <Loader2 className="w-3 h-3 animate-spin" /> : ['one_pager', 'complete'].includes(cascadeStatus.currentPhase) ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3" />}
            Memo
          </div>
          <div className="w-4 h-px bg-gray-700" />
          <div className={`flex items-center gap-1 ${cascadeStatus.currentPhase === 'one_pager' ? 'text-blue-400' : cascadeStatus.currentPhase === 'complete' ? 'text-green-500' : 'text-gray-600'}`}>
            {cascadeStatus.currentPhase === 'one_pager' ? <Loader2 className="w-3 h-3 animate-spin" /> : cascadeStatus.currentPhase === 'complete' ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3" />}
            Summary
          </div>
        </div>
      )}

      {/* Documents */}
      {hasAnyDocs ? (
        <div className="space-y-4">
          {/* Deep Research */}
          {renderDocumentCard(
            deepResearch[0],
            'Deep Research',
            deepResearch.slice(1),
            showDeepResearchHistory,
            setShowDeepResearchHistory
          )}
          
          {/* One Pager & Memo side by side */}
          <div className="flex gap-6 pt-3 border-t border-gray-800/50">
            {renderDocumentCard(
              onePagers[0],
              'One Pager',
              onePagers.slice(1),
              showOnePagerHistory,
              setShowOnePagerHistory
            )}
            {renderDocumentCard(
              memos[0],
              'Memo',
              memos.slice(1),
              showMemoHistory,
              setShowMemoHistory
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-gray-600 text-sm">
          No documents yet
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { FileText, Sparkles, ChevronDown, ChevronUp, ExternalLink, Loader2, Clock, CheckCircle, BookOpen, MessageSquare, Zap } from 'lucide-react';

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

interface GenerationStatus {
  isGenerating: boolean;
  progress?: string;
  error?: string;
  jobId?: string;
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
  const [onePagerStatus, setOnePagerStatus] = useState<GenerationStatus>({ isGenerating: false });
  const [memoStatus, setMemoStatus] = useState<GenerationStatus>({ isGenerating: false });
  const [deepResearchStatus, setDeepResearchStatus] = useState<GenerationStatus>({ isGenerating: false });
  const [cascadeStatus, setCascadeStatus] = useState<CascadeStatus>({ isGenerating: false, currentPhase: 'idle' });
  
  // Refs for polling intervals
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Fetch documents on mount and when assetId changes
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

  // Poll for job status
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
          // Still processing - update progress
          onUpdate(job);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };

    // Poll immediately, then every 3 seconds
    await poll();
    pollingIntervalRef.current = setInterval(poll, 3000);
  };

  // Generate all documents using cascade workflow (async)
  const generateAllDocuments = async () => {
    setCascadeStatus({ 
      isGenerating: true, 
      currentPhase: 'deep_research',
      progress: 'Starting cascade generation...'
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
        // Start polling for job status
        setCascadeStatus(prev => ({ 
          ...prev, 
          jobId: data.job_id,
          progress: 'Phase 1/3: Researching & Writing Deep Report...'
        }));

        pollJobStatus(
          data.job_id,
          // onUpdate - progress updates
          (job) => {
            if (job.status === 'failed') {
              setCascadeStatus({ 
                isGenerating: false, 
                currentPhase: 'idle',
                error: job.error || 'Generation failed'
              });
              setTimeout(() => setCascadeStatus({ isGenerating: false, currentPhase: 'idle' }), 10000);
            } else {
              // Update progress message based on job progress
              let phase: CascadeStatus['currentPhase'] = 'deep_research';
              if (job.progress?.includes('Phase 2') || job.progress?.includes('Memo')) {
                phase = 'memo';
              } else if (job.progress?.includes('Phase 3') || job.progress?.includes('One Pager')) {
                phase = 'one_pager';
              }
              setCascadeStatus(prev => ({ 
                ...prev, 
                currentPhase: phase,
                progress: job.progress || prev.progress
              }));
            }
          },
          // onComplete - job finished
          async (job) => {
            setCascadeStatus({ 
              isGenerating: false, 
              currentPhase: 'complete',
              progress: `All documents generated in ${job.result?.generation_time_seconds?.toFixed(1) || '?'}s with ${job.result?.sources_cited || 0} sources`
            });
            
            await fetchDocuments();
            
            // Open the deep research document
            if (job.result?.files?.deep_research) {
              window.open(job.result.files.deep_research, '_blank');
            }
            
            setTimeout(() => setCascadeStatus({ isGenerating: false, currentPhase: 'idle' }), 10000);
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
        error: 'Network error. Please try again.'
      });
      setTimeout(() => setCascadeStatus({ isGenerating: false, currentPhase: 'idle' }), 10000);
    }
  };

  // Generate single document (async)
  const generateDocument = async (docType: 'one_pager' | 'memo' | 'deep_research') => {
    const setStatus = docType === 'one_pager' 
      ? setOnePagerStatus 
      : docType === 'memo' 
        ? setMemoStatus 
        : setDeepResearchStatus;
    
    const progressMessage = docType === 'deep_research' 
      ? 'Starting deep research... This may take 3-5 minutes.'
      : 'Starting generation...';
    
    setStatus({ isGenerating: true, progress: progressMessage });

    try {
      const response = await fetch(`${API_BASE}/control-api/dashboard/create-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          asset_id: assetId,
          asset_type: assetType,
          document_type: docType
        })
      });

      const data = await response.json();
      
      if (data.job_id) {
        // Start polling for job status
        setStatus(prev => ({ ...prev, jobId: data.job_id }));

        pollJobStatus(
          data.job_id,
          // onUpdate
          (job) => {
            if (job.status === 'failed') {
              setStatus({ 
                isGenerating: false, 
                error: job.error || 'Generation failed'
              });
              setTimeout(() => setStatus({ isGenerating: false }), 10000);
            } else {
              setStatus(prev => ({ 
                ...prev, 
                progress: job.progress || prev.progress
              }));
            }
          },
          // onComplete
          async (job) => {
            setStatus({ 
              isGenerating: false, 
              progress: `Generated in ${job.result?.generation_time_seconds?.toFixed(1) || '?'}s with ${job.result?.sources_cited || 0} sources`
            });
            
            await fetchDocuments();
            
            if (job.result?.file_url) {
              window.open(job.result.file_url, '_blank');
            }
            
            setTimeout(() => setStatus({ isGenerating: false }), 5000);
          }
        );
      } else if (data.error) {
        setStatus({ 
          isGenerating: false, 
          error: data.error
        });
        setTimeout(() => setStatus({ isGenerating: false }), 10000);
      }
    } catch (error) {
      console.error('Error generating document:', error);
      setStatus({ 
        isGenerating: false, 
        error: 'Network error. Please try again.'
      });
      setTimeout(() => setStatus({ isGenerating: false }), 10000);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderDocumentColumn = (
    title: string,
    documents: AssetFile[],
    docType: 'one_pager' | 'memo' | 'deep_research',
    showHistory: boolean,
    setShowHistory: (show: boolean) => void,
    status: GenerationStatus,
    isDeepResearch: boolean = false
  ) => {
    const latestDoc = documents[0];
    const historyDocs = documents.slice(1);
    const hasHistory = historyDocs.length > 0;
    const isCascadeGenerating = cascadeStatus.isGenerating;

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            {isDeepResearch ? <BookOpen className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {title}
          </h4>
          <button
            onClick={() => generateDocument(docType)}
            disabled={status.isGenerating || isCascadeGenerating}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              isDeepResearch 
                ? 'bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600' 
                : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600'
            } disabled:cursor-not-allowed`}
          >
            {status.isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                Generate
              </>
            )}
          </button>
        </div>

        {/* Status message */}
        {(status.progress || status.error) && !status.isGenerating && (
          <div className={`mb-2 p-2 rounded text-xs flex items-center gap-2 ${
            status.error 
              ? 'bg-red-900/30 text-red-400 border border-red-800' 
              : isDeepResearch
                ? 'bg-purple-900/30 text-purple-400 border border-purple-800'
                : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
          }`}>
            {status.error ? (
              <span>{status.error}</span>
            ) : (
              <>
                <CheckCircle className="w-3 h-3" />
                <span>{status.progress}</span>
              </>
            )}
          </div>
        )}

        {/* Generating indicator with progress */}
        {status.isGenerating && (
          <div className={`mb-2 p-3 rounded-lg border ${
            isDeepResearch 
              ? 'bg-purple-900/20 border-purple-800/50' 
              : 'bg-blue-900/20 border-blue-800/50'
          }`}>
            <div className={`flex items-center gap-2 text-sm ${
              isDeepResearch ? 'text-purple-300' : 'text-blue-300'
            }`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-medium">
                {isDeepResearch ? 'Deep Research in Progress...' : 'Generating...'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {status.progress || (isDeepResearch 
                ? 'Analyzing business model, extracting financials, and identifying key metrics. This comprehensive research takes 3-5 minutes.'
                : 'This typically takes 30-60 seconds.'
              )}
            </p>
          </div>
        )}

        {/* Latest document */}
        {latestDoc ? (
          <div className={`p-3 rounded-lg border ${
            isDeepResearch 
              ? 'bg-purple-900/10 border-purple-800/30' 
              : 'bg-gray-800/50 border-gray-700'
          }`}>
            <a
              href={latestDoc.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 hover:text-blue-400 transition-colors"
            >
              <span className="truncate text-sm font-medium">{latestDoc.file_name}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 mt-1" />
            </a>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              {formatDate(latestDoc.created_at)}
            </div>
            {latestDoc.description && (
              <p className="text-xs text-gray-500 mt-1 truncate">{latestDoc.description}</p>
            )}
          </div>
        ) : (
          <div className={`p-4 rounded-lg border border-dashed text-center ${
            isDeepResearch 
              ? 'border-purple-800/50 bg-purple-900/10' 
              : 'border-gray-700 bg-gray-800/30'
          }`}>
            <p className="text-sm text-gray-500">
              {isDeepResearch ? 'No deep research report yet' : `No ${title.toLowerCase()} yet`}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {isDeepResearch 
                ? 'Generate a comprehensive research report to analyze this company'
                : 'Click Generate to create one'
              }
            </p>
          </div>
        )}

        {/* History toggle */}
        {hasHistory && (
          <div className="mt-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {historyDocs.length} older version{historyDocs.length > 1 ? 's' : ''}
            </button>
            
            {showHistory && (
              <div className="mt-2 space-y-2">
                {historyDocs.map(doc => (
                  <a
                    key={doc.file_id}
                    href={doc.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 bg-gray-800/30 rounded border border-gray-700/50 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs truncate text-gray-400">{doc.file_name}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-500" />
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">{formatDate(doc.created_at)}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
      {/* Header with Generate All button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold">AI Documents</h3>
          <span className="text-xs text-gray-500">Powered by Gemini</span>
        </div>
        
        <button
          onClick={generateAllDocuments}
          disabled={cascadeStatus.isGenerating || onePagerStatus.isGenerating || memoStatus.isGenerating || deepResearchStatus.isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 rounded-lg font-medium text-sm transition-all disabled:cursor-not-allowed"
        >
          {cascadeStatus.isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate All Documents
            </>
          )}
        </button>
      </div>

      {/* Cascade status indicator */}
      {cascadeStatus.isGenerating && (
        <div className="mb-4 p-4 bg-gradient-to-r from-purple-900/30 to-emerald-900/30 rounded-lg border border-purple-800/50">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="font-medium text-purple-300">Cascade Generation in Progress</span>
          </div>
          <p className="text-sm text-gray-400">{cascadeStatus.progress}</p>
          
          {/* Phase indicators */}
          <div className="flex items-center gap-2 mt-3">
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              cascadeStatus.currentPhase === 'deep_research' 
                ? 'bg-purple-600 text-white' 
                : cascadeStatus.currentPhase === 'memo' || cascadeStatus.currentPhase === 'one_pager' || cascadeStatus.currentPhase === 'complete'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-400'
            }`}>
              {cascadeStatus.currentPhase === 'deep_research' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Deep Research
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              cascadeStatus.currentPhase === 'memo' 
                ? 'bg-purple-600 text-white' 
                : cascadeStatus.currentPhase === 'one_pager' || cascadeStatus.currentPhase === 'complete'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-400'
            }`}>
              {cascadeStatus.currentPhase === 'memo' ? <Loader2 className="w-3 h-3 animate-spin" /> : cascadeStatus.currentPhase === 'one_pager' || cascadeStatus.currentPhase === 'complete' ? <CheckCircle className="w-3 h-3" /> : null}
              Memo
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              cascadeStatus.currentPhase === 'one_pager' 
                ? 'bg-purple-600 text-white' 
                : cascadeStatus.currentPhase === 'complete'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-400'
            }`}>
              {cascadeStatus.currentPhase === 'one_pager' ? <Loader2 className="w-3 h-3 animate-spin" /> : cascadeStatus.currentPhase === 'complete' ? <CheckCircle className="w-3 h-3" /> : null}
              One Pager
            </div>
          </div>
        </div>
      )}

      {/* Cascade completion/error message */}
      {!cascadeStatus.isGenerating && (cascadeStatus.progress || cascadeStatus.error) && cascadeStatus.currentPhase !== 'idle' && (
        <div className={`mb-4 p-3 rounded-lg border ${
          cascadeStatus.error 
            ? 'bg-red-900/30 border-red-800 text-red-400' 
            : 'bg-emerald-900/30 border-emerald-800 text-emerald-400'
        }`}>
          <div className="flex items-center gap-2">
            {cascadeStatus.error ? null : <CheckCircle className="w-4 h-4" />}
            <span className="text-sm">{cascadeStatus.error || cascadeStatus.progress}</span>
          </div>
        </div>
      )}

      {/* Deep Research Section */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Deep Research Report
        </h4>
        {renderDocumentColumn(
          'Deep Research Report',
          deepResearch,
          'deep_research',
          showDeepResearchHistory,
          setShowDeepResearchHistory,
          deepResearchStatus,
          true
        )}
        
        {/* Chat with Deep Research button */}
        {deepResearch.length > 0 && onOpenChat && (
          <button
            onClick={onOpenChat}
            className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800/50 rounded-lg text-sm text-purple-300 transition-colors w-full justify-center"
          >
            <MessageSquare className="w-4 h-4" />
            Ask follow-up questions in Company Chat
          </button>
        )}
      </div>

      {/* One Pagers and Memos side by side */}
      <div className="flex gap-6">
        {renderDocumentColumn(
          'One Pagers',
          onePagers,
          'one_pager',
          showOnePagerHistory,
          setShowOnePagerHistory,
          onePagerStatus
        )}
        
        {renderDocumentColumn(
          'Memos',
          memos,
          'memo',
          showMemoHistory,
          setShowMemoHistory,
          memoStatus
        )}
      </div>
    </div>
  );
}

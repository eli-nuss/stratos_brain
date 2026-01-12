import { useState, useEffect } from 'react';
import { FileText, Sparkles, ChevronDown, ChevronUp, ExternalLink, Loader2, Clock, CheckCircle, BookOpen, MessageSquare } from 'lucide-react';

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
  onOpenChat?: () => void; // Callback to open company chat with deep research context
}

interface GenerationStatus {
  isGenerating: boolean;
  progress?: string;
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

  // Fetch documents on mount and when assetId changes
  useEffect(() => {
    fetchDocuments();
  }, [assetId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/control-api/dashboard/files/${assetId}`);
      const data = await response.json();
      const files: AssetFile[] = data.files || [];
      
      // Separate by type and sort by date (newest first)
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
      // Call the Gemini-based create-document endpoint in control-api
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
      
      if (data.success) {
        setStatus({ 
          isGenerating: false, 
          progress: `Generated in ${data.generation_time_seconds?.toFixed(1)}s with ${data.sources_cited} sources` 
        });
        
        // Refresh documents to show the new file
        await fetchDocuments();
        
        // Open the generated document in a new tab
        if (data.file_url) {
          window.open(data.file_url, '_blank');
        }
        
        // Clear the success message after 5 seconds
        setTimeout(() => {
          setStatus({ isGenerating: false });
        }, 5000);
      } else {
        setStatus({ 
          isGenerating: false, 
          error: data.error || 'Failed to generate document' 
        });
        
        // Clear error after 10 seconds
        setTimeout(() => {
          setStatus({ isGenerating: false });
        }, 10000);
      }
    } catch (error) {
      console.error('Error generating document:', error);
      setStatus({ 
        isGenerating: false, 
        error: 'Network error. Please try again.' 
      });
      
      setTimeout(() => {
        setStatus({ isGenerating: false });
      }, 10000);
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

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            {isDeepResearch ? <BookOpen className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {title}
          </h4>
          <button
            onClick={() => generateDocument(docType)}
            disabled={status.isGenerating}
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

        {/* Generating indicator */}
        {status.isGenerating && (
          <div className={`mb-2 p-3 rounded-lg border ${
            isDeepResearch 
              ? 'bg-purple-900/20 border-purple-800/50' 
              : 'bg-blue-900/20 border-blue-800/50'
          }`}>
            <div className={`flex items-center gap-2 text-sm ${
              isDeepResearch ? 'text-purple-400' : 'text-blue-400'
            }`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isDeepResearch ? 'Deep Research in Progress...' : 'Generating with Gemini AI...'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isDeepResearch 
                ? 'Analyzing business model, extracting financials, and identifying key metrics. This comprehensive research takes 3-5 minutes.'
                : 'Researching latest news and analyzing data. This may take 1-2 minutes.'}
            </p>
          </div>
        )}

        {latestDoc ? (
          <div className="space-y-2">
            {/* Latest document */}
            <a
              href={latestDoc.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-3 rounded-lg border transition-colors ${
                isDeepResearch
                  ? 'bg-purple-900/20 border-purple-700 hover:border-purple-500/50 hover:bg-purple-900/30'
                  : 'bg-gray-800/50 border-gray-700 hover:border-emerald-500/50 hover:bg-gray-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {latestDoc.file_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(latestDoc.created_at)}
                  </p>
                  {latestDoc.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {latestDoc.description}
                    </p>
                  )}
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </a>

            {/* Chat button for deep research */}
            {isDeepResearch && latestDoc && onOpenChat && (
              <button
                onClick={onOpenChat}
                className="w-full flex items-center justify-center gap-2 p-2 text-xs bg-purple-600/20 hover:bg-purple-600/30 border border-purple-700/50 rounded-lg text-purple-300 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                Ask follow-up questions in Company Chat
              </button>
            )}

            {/* History toggle */}
            {hasHistory && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showHistory ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Hide history ({historyDocs.length})
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show history ({historyDocs.length})
                  </>
                )}
              </button>
            )}

            {/* History documents */}
            {showHistory && historyDocs.map((doc) => (
              <a
                key={doc.file_id}
                href={doc.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-2 bg-gray-900/50 rounded border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-500 flex-shrink-0">{formatDate(doc.created_at)}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className={`p-4 rounded-lg border text-center ${
            isDeepResearch 
              ? 'bg-purple-900/10 border-purple-700/50' 
              : 'bg-gray-800/30 border-gray-700/50'
          }`}>
            <p className="text-sm text-gray-500">No {title.toLowerCase()} yet</p>
            <p className="text-xs text-gray-600 mt-1">
              {isDeepResearch 
                ? 'Generate a comprehensive research report to analyze this company'
                : 'Click Generate to create one'}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
      <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-emerald-400" />
        AI Documents
        <span className="text-xs text-gray-500 font-normal ml-2">Powered by Gemini</span>
      </h3>
      
      {/* Deep Research Report - Full Width at Top */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        {renderDocumentColumn(
          'Deep Research Report',
          deepResearch,
          'deep_research',
          showDeepResearchHistory,
          setShowDeepResearchHistory,
          deepResearchStatus,
          true
        )}
      </div>
      
      {/* One Pagers and Memos - Side by Side */}
      <div className="flex gap-4">
        {renderDocumentColumn(
          'One Pagers',
          onePagers,
          'one_pager',
          showOnePagerHistory,
          setShowOnePagerHistory,
          onePagerStatus
        )}
        
        <div className="w-px bg-gray-700" />
        
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

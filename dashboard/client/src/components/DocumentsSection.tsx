import { useState, useEffect } from 'react';
import { FileText, Sparkles, ChevronDown, ChevronUp, ExternalLink, Loader2, Clock } from 'lucide-react';
import { 
  registerPendingDocument, 
  isPendingForAsset, 
  addCompletionListener 
} from '@/lib/documentPollingService';

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
}

const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api';

export function DocumentsSection({ assetId, symbol, companyName }: DocumentsSectionProps) {
  const [onePagers, setOnePagers] = useState<AssetFile[]>([]);
  const [memos, setMemos] = useState<AssetFile[]>([]);
  const [showOnePagerHistory, setShowOnePagerHistory] = useState(false);
  const [showMemoHistory, setShowMemoHistory] = useState(false);
  const [generatingOnePager, setGeneratingOnePager] = useState(false);
  const [generatingMemo, setGeneratingMemo] = useState(false);

  // Fetch documents on mount and when assetId changes
  useEffect(() => {
    fetchDocuments();
    
    // Check if there are pending documents for this asset
    setGeneratingOnePager(isPendingForAsset(assetId, 'one_pager'));
    setGeneratingMemo(isPendingForAsset(assetId, 'memo'));
  }, [assetId]);

  // Listen for document completion events from the global polling service
  useEffect(() => {
    const handleCompletion = (taskId: string, completedAssetId: number, documentType: string) => {
      if (completedAssetId === assetId) {
        // Refresh documents when one completes for this asset
        fetchDocuments();
        
        // Update generating state
        if (documentType === 'one_pager') {
          setGeneratingOnePager(false);
        } else if (documentType === 'memo') {
          setGeneratingMemo(false);
        }
      }
    };

    // Subscribe to completion events
    const unsubscribe = addCompletionListener(handleCompletion);
    
    // Also listen for the window event (backup)
    const handleWindowEvent = (e: CustomEvent) => {
      const { taskId, assetId: completedAssetId, documentType } = e.detail;
      handleCompletion(taskId, completedAssetId, documentType);
    };
    
    window.addEventListener('document-completed', handleWindowEvent as EventListener);
    
    return () => {
      unsubscribe();
      window.removeEventListener('document-completed', handleWindowEvent as EventListener);
    };
  }, [assetId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboard/files/${assetId}`);
      const files: AssetFile[] = await response.json();
      
      // Separate by type and sort by date (newest first)
      const onePagerFiles = files
        .filter(f => f.file_type === 'one_pager')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const memoFiles = files
        .filter(f => f.file_type === 'memo')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setOnePagers(onePagerFiles);
      setMemos(memoFiles);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const generateDocument = async (docType: 'one_pager' | 'memo') => {
    if (docType === 'one_pager') {
      setGeneratingOnePager(true);
    } else {
      setGeneratingMemo(true);
    }

    try {
      const response = await fetch(`${API_BASE}/dashboard/create-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          company_name: companyName,
          asset_id: assetId,
          document_type: docType
        })
      });

      const data = await response.json();
      
      if (data.success && data.task_id) {
        // Open Manus task in new tab
        if (data.task_url) {
          window.open(data.task_url, '_blank');
        }
        
        // Register with global polling service (persists even if component unmounts)
        registerPendingDocument(data.task_id, assetId, docType, symbol);
        
        // Refresh to show the "generating" entry
        fetchDocuments();
      } else {
        // Reset generating state on error
        if (docType === 'one_pager') {
          setGeneratingOnePager(false);
        } else {
          setGeneratingMemo(false);
        }
      }
    } catch (error) {
      console.error('Error generating document:', error);
      if (docType === 'one_pager') {
        setGeneratingOnePager(false);
      } else {
        setGeneratingMemo(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isGenerating = (file: AssetFile) => {
    return file.description?.includes('Generating') || file.file_path?.includes('manus.im');
  };

  const renderDocumentColumn = (
    title: string,
    documents: AssetFile[],
    docType: 'one_pager' | 'memo',
    showHistory: boolean,
    setShowHistory: (show: boolean) => void,
    isGeneratingNew: boolean
  ) => {
    const latestDoc = documents[0];
    const historyDocs = documents.slice(1);
    const hasHistory = historyDocs.length > 0;

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {title}
          </h4>
          <button
            onClick={() => generateDocument(docType)}
            disabled={isGeneratingNew}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
          >
            {isGeneratingNew ? (
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

        {latestDoc ? (
          <div className="space-y-2">
            {/* Latest document */}
            <a
              href={isGenerating(latestDoc) ? undefined : latestDoc.file_path}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-3 bg-gray-800/50 rounded-lg border border-gray-700 ${
                isGenerating(latestDoc) ? 'cursor-default' : 'hover:border-emerald-500/50 hover:bg-gray-800'
              } transition-colors`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {latestDoc.file_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    {isGenerating(latestDoc) ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3" />
                        {formatDate(latestDoc.created_at)}
                      </>
                    )}
                  </p>
                </div>
                {!isGenerating(latestDoc) && (
                  <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </div>
            </a>

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
          <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 text-center">
            <p className="text-sm text-gray-500">No {title.toLowerCase()} yet</p>
            <p className="text-xs text-gray-600 mt-1">Click Generate to create one</p>
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
      </h3>
      
      <div className="flex gap-4">
        {renderDocumentColumn(
          'One Pagers',
          onePagers,
          'one_pager',
          showOnePagerHistory,
          setShowOnePagerHistory,
          generatingOnePager
        )}
        
        <div className="w-px bg-gray-700" />
        
        {renderDocumentColumn(
          'Memos',
          memos,
          'memo',
          showMemoHistory,
          setShowMemoHistory,
          generatingMemo
        )}
      </div>
    </div>
  );
}

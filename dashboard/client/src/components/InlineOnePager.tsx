import { useState, useEffect, useRef } from 'react';
import { FileText, ExternalLink, Loader2, ChevronDown, ChevronUp, Sparkles, Download, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AssetFile {
  file_id: number;
  asset_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  description?: string;
  created_at: string;
}

interface InlineDocumentViewerProps {
  assetId: number;
  symbol: string;
}

type DocumentType = 'one_pager' | 'memo' | 'deep_research';

const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api';

export function InlineOnePager({ assetId, symbol }: InlineDocumentViewerProps) {
  const [activeTab, setActiveTab] = useState<DocumentType>('one_pager');
  const [onePager, setOnePager] = useState<AssetFile | null>(null);
  const [memo, setMemo] = useState<AssetFile | null>(null);
  const [deepResearch, setDeepResearch] = useState<AssetFile | null>(null);
  const [onePagerContent, setOnePagerContent] = useState<string | null>(null);
  const [memoContent, setMemoContent] = useState<string | null>(null);
  const [deepResearchContent, setDeepResearchContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [contentError, setContentError] = useState<{ one_pager: boolean; memo: boolean; deep_research: boolean }>({ one_pager: false, memo: false, deep_research: false });
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get the current document based on active tab
  const currentDocument = activeTab === 'one_pager' ? onePager : activeTab === 'memo' ? memo : deepResearch;
  const currentContent = activeTab === 'one_pager' ? onePagerContent : activeTab === 'memo' ? memoContent : deepResearchContent;
  const currentError = contentError[activeTab];

  // Export to PDF function using browser print
  const exportToPDF = async () => {
    if (!contentRef.current || !currentDocument) return;
    
    setIsExporting(true);
    try {
      // Get the content HTML
      const contentHtml = contentRef.current.innerHTML;
      const title = `${symbol} ${activeTab === 'one_pager' ? 'One Pager' : activeTab === 'memo' ? 'Investment Memo' : 'Deep Research Report'}`;
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Please allow popups to export PDF');
        return;
      }
      
      // Write the print-friendly HTML
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          <style>
            @media print {
              @page { margin: 0.75in; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            h1 { font-size: 24px; font-weight: bold; margin: 24px 0 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
            h2 { font-size: 20px; font-weight: 600; margin: 20px 0 12px; }
            h3 { font-size: 16px; font-weight: 600; margin: 16px 0 8px; }
            h4 { font-size: 14px; font-weight: 600; margin: 12px 0 6px; }
            p { margin: 0 0 12px; color: #374151; }
            ul, ol { margin: 0 0 12px; padding-left: 24px; }
            li { margin: 4px 0; color: #374151; }
            strong { font-weight: 600; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th { background: #f3f4f6; color: #111827; font-weight: 600; text-align: left; padding: 10px; border: 1px solid #e5e7eb; }
            td { padding: 10px; border: 1px solid #e5e7eb; color: #374151; }
            a { color: #2563eb; text-decoration: none; }
            blockquote { border-left: 4px solid #e5e7eb; margin: 16px 0; padding-left: 16px; color: #6b7280; }
            code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
            hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Close after a delay to allow print dialog
          setTimeout(() => printWindow.close(), 1000);
        }, 250);
      };
      
      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.print();
          setTimeout(() => printWindow.close(), 1000);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch documents
  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/dashboard/files/${assetId}`);
      const data = await response.json();
      const files: AssetFile[] = data.files || [];
      
      // Find the most recent one_pager that has actual content (not manus.im link)
      const onePagers = files
        .filter(f => f.file_type === 'one_pager' && !f.file_path.includes('manus.im'))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Find the most recent memo that has actual content
      const memos = files
        .filter(f => f.file_type === 'memo' && !f.file_path.includes('manus.im'))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Find the most recent deep_research that has actual content
      const deepResearchFiles = files
        .filter(f => f.file_type === 'deep_research' && !f.file_path.includes('manus.im'))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (onePagers.length > 0) {
        setOnePager(onePagers[0]);
        // Fetch content if markdown
        if (onePagers[0].file_name.endsWith('.md')) {
          try {
            const contentResponse = await fetch(onePagers[0].file_path);
            if (contentResponse.ok) {
              const text = await contentResponse.text();
              setOnePagerContent(text);
            } else {
              setContentError(prev => ({ ...prev, one_pager: true }));
            }
          } catch (err) {
            console.error('Error fetching one pager content:', err);
            setContentError(prev => ({ ...prev, one_pager: true }));
          }
        } else {
          setContentError(prev => ({ ...prev, one_pager: true }));
        }
      }

      if (memos.length > 0) {
        setMemo(memos[0]);
        // Fetch content if markdown
        if (memos[0].file_name.endsWith('.md')) {
          try {
            const contentResponse = await fetch(memos[0].file_path);
            if (contentResponse.ok) {
              const text = await contentResponse.text();
              setMemoContent(text);
            } else {
              setContentError(prev => ({ ...prev, memo: true }));
            }
          } catch (err) {
            console.error('Error fetching memo content:', err);
            setContentError(prev => ({ ...prev, memo: true }));
          }
        } else {
          setContentError(prev => ({ ...prev, memo: true }));
        }
      }

      if (deepResearchFiles.length > 0) {
        setDeepResearch(deepResearchFiles[0]);
        // Fetch content if markdown
        if (deepResearchFiles[0].file_name.endsWith('.md')) {
          try {
            const contentResponse = await fetch(deepResearchFiles[0].file_path);
            if (contentResponse.ok) {
              const text = await contentResponse.text();
              setDeepResearchContent(text);
            } else {
              setContentError(prev => ({ ...prev, deep_research: true }));
            }
          } catch (err) {
            console.error('Error fetching deep research content:', err);
            setContentError(prev => ({ ...prev, deep_research: true }));
          }
        } else {
          setContentError(prev => ({ ...prev, deep_research: true }));
        }
      }

      // Auto-select the tab based on what's available (prefer one_pager first)
      if (onePagers.length > 0) {
        setActiveTab('one_pager');
      } else if (memos.length > 0) {
        setActiveTab('memo');
      } else if (deepResearchFiles.length > 0) {
        setActiveTab('deep_research');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and when assetId changes
  useEffect(() => {
    fetchDocuments();
  }, [assetId]);

  // Listen for document completion events to refresh the inline view
  useEffect(() => {
    const handleDocumentCompleted = (e: CustomEvent) => {
      const { assetId: completedAssetId, documentType } = e.detail;
      // Refresh if a document was completed for this asset
      if (completedAssetId === assetId && (documentType === 'one_pager' || documentType === 'memo' || documentType === 'deep_research')) {
        console.log('[InlineDocumentViewer] New document completed, refreshing...');
        fetchDocuments();
        // Switch to the newly completed document type
        setActiveTab(documentType);
      }
    };

    window.addEventListener('document-completed', handleDocumentCompleted as EventListener);
    return () => {
      window.removeEventListener('document-completed', handleDocumentCompleted as EventListener);
    };
  }, [assetId]);

  // Don't render anything if no documents exist
  if (!isLoading && !onePager && !memo && !deepResearch) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header with Toggle */}
      <div className="bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            
            {/* Toggle Buttons */}
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('one_pager')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'one_pager'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                } ${!onePager ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!onePager}
              >
                One Pager
              </button>
              <button
                onClick={() => setActiveTab('memo')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'memo'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                } ${!memo ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!memo}
              >
                Memo
              </button>
              <button
                onClick={() => setActiveTab('deep_research')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                  activeTab === 'deep_research'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                } ${!deepResearch ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!deepResearch}
              >
                <BookOpen className="w-3 h-3" />
                Deep Dive
              </button>
            </div>

            {currentDocument && (
              <span className="text-xs text-muted-foreground">
                • {formatDate(currentDocument.created_at)}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Export PDF Button */}
            {currentContent && (
              <button
                onClick={exportToPDF}
                disabled={isExporting}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Export as PDF"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}
            
            {currentDocument && (
              <a
                href={currentDocument.file_path}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className={`p-5 overflow-y-auto ${activeTab === 'deep_research' ? 'max-h-[800px]' : 'max-h-[600px]'}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : currentContent ? (
            <div ref={contentRef} className="markdown-content">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom heading styles with better spacing and visual hierarchy
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold text-foreground mb-4 mt-6 first:mt-0 pb-2 border-b border-border/50">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-semibold text-foreground mb-3 mt-5 first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-foreground mb-2 mt-4 first:mt-0">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-sm font-semibold text-foreground mb-2 mt-3 first:mt-0">
                      {children}
                    </h4>
                  ),
                  // Paragraphs with proper spacing
                  p: ({ children }) => (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {children}
                    </p>
                  ),
                  // Strong/bold text stands out
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                      {children}
                    </strong>
                  ),
                  // Emphasis/italic
                  em: ({ children }) => (
                    <em className="italic text-muted-foreground">
                      {children}
                    </em>
                  ),
                  // Lists with proper styling
                  ul: ({ children }) => (
                    <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-outside ml-5 mb-3 space-y-1.5">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm text-muted-foreground leading-relaxed pl-1">
                      {children}
                    </li>
                  ),
                  // Links
                  a: ({ href, children }) => (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  // Blockquotes for callouts
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-3 bg-muted/20 rounded-r">
                      {children}
                    </blockquote>
                  ),
                  // Code blocks
                  code: ({ className, children }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className="block bg-muted/30 p-3 rounded-lg text-xs font-mono text-foreground overflow-x-auto my-3">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="bg-muted/30 p-3 rounded-lg overflow-x-auto my-3">
                      {children}
                    </pre>
                  ),
                  // Tables with nice styling
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 rounded-lg border border-border">
                      <table className="w-full text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/40 border-b border-border">
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left font-semibold text-foreground text-xs uppercase tracking-wide">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-muted-foreground border-b border-border/50">
                      {children}
                    </td>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-muted/20 transition-colors">
                      {children}
                    </tr>
                  ),
                  // Horizontal rule
                  hr: () => (
                    <hr className="my-4 border-border/50" />
                  ),
                }}
              >
                {currentContent}
              </ReactMarkdown>
            </div>
          ) : currentError && currentDocument ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                {currentDocument.file_name}
              </p>
              <a
                href={currentDocument.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open document
              </a>
            </div>
          ) : !currentDocument ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No {activeTab === 'one_pager' ? 'one pager' : activeTab === 'memo' ? 'memo' : 'deep research report'} available yet.
              <br />
              <span className="text-xs">Generate one from the AI Documents panel.</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No content available
            </p>
          )}
        </div>
      )}
    </div>
  );
}

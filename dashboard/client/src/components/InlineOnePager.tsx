import { useState, useEffect } from 'react';
import { FileText, ExternalLink, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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

interface InlineOnePagerProps {
  assetId: number;
  symbol: string;
}

const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api';

export function InlineOnePager({ assetId, symbol }: InlineOnePagerProps) {
  const [onePager, setOnePager] = useState<AssetFile | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [contentError, setContentError] = useState(false);

  // Fetch the most recent one pager
  useEffect(() => {
    const fetchOnePager = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/dashboard/files/${assetId}`);
        const data = await response.json();
        const files: AssetFile[] = data.files || [];
        
        // Find the most recent one_pager that has actual content (not manus.im link)
        const onePagers = files
          .filter(f => f.file_type === 'one_pager' && !f.file_path.includes('manus.im'))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        if (onePagers.length > 0) {
          setOnePager(onePagers[0]);
          
          // Fetch the content if it's a markdown file
          if (onePagers[0].file_name.endsWith('.md')) {
            try {
              const contentResponse = await fetch(onePagers[0].file_path);
              if (contentResponse.ok) {
                const text = await contentResponse.text();
                setContent(text);
              } else {
                setContentError(true);
              }
            } catch (err) {
              console.error('Error fetching one pager content:', err);
              setContentError(true);
            }
          } else {
            // For non-markdown files (docx, pdf), we can't display inline
            setContentError(true);
          }
        }
      } catch (error) {
        console.error('Error fetching one pager:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOnePager();
  }, [assetId]);

  // Don't render anything if no one pager exists
  if (!isLoading && !onePager) {
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
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-sm">One Pager</h3>
          {onePager && (
            <span className="text-xs text-muted-foreground">
              • {formatDate(onePager.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onePager && (
            <a
              href={onePager.file_path}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div className="prose prose-sm prose-invert max-w-none 
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
              prose-p:text-muted-foreground prose-p:text-sm prose-p:leading-relaxed prose-p:my-2
              prose-li:text-muted-foreground prose-li:text-sm
              prose-strong:text-foreground
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
              prose-hr:border-border
              max-h-[500px] overflow-y-auto"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : contentError && onePager ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                {onePager.file_name}
              </p>
              <a
                href={onePager.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open document
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No one pager available
            </p>
          )}
        </div>
      )}
    </div>
  );
}

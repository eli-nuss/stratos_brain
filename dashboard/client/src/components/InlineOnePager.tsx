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
  const [manusTaskUrl, setManusTaskUrl] = useState<string | null>(null);

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
          
          // Extract Manus task URL from description
          const taskMatch = onePagers[0].description?.match(/Task: ([A-Za-z0-9]+)/);
          if (taskMatch) {
            setManusTaskUrl(`https://manus.im/app/${taskMatch[1]}`);
          }
          
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
          {manusTaskUrl ? (
            <a
              href={manusTaskUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-sm hover:text-primary transition-colors flex items-center gap-1"
              title="Open Manus AI chat"
            >
              One Pager
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          ) : (
            <h3 className="font-semibold text-sm">One Pager</h3>
          )}
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
        <div className="p-5 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div className="markdown-content">
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

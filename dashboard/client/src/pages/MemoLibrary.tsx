import useSWR from "swr";
import { Search, FileText, Calendar, FileDown, File, Loader2, Activity } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MemoFile {
  file_id: number;
  asset_id: number;
  symbol: string;
  name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: 'memo' | 'one_pager';
  description: string;
  universe_id: string;
  created_at: string;
}

interface MemoDetailModalProps {
  memo: MemoFile;
  onClose: () => void;
}

function MemoDetailModal({ memo, onClose }: MemoDetailModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleOpenAsPdf = () => {
    // Open the formatted viewer page in a new tab (user can print to PDF from there)
    const viewerUrl = `/memo/${memo.file_id}`;
    window.open(viewerUrl, '_blank');
  };

  // Fetch the markdown content
  useEffect(() => {
    if (memo.file_path) {
      fetch(memo.file_path)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch memo');
          return res.text();
        })
        .then(text => {
          setContent(text);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [memo.file_path]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-700 bg-zinc-800/50 gap-3">
          <div className="flex items-center justify-between sm:justify-start sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-lg sm:text-xl font-bold text-white">{memo.symbol}</span>
              <span className="text-xs sm:text-sm text-zinc-400 hidden sm:inline">{memo.name}</span>
              <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium rounded-full ${
                memo.file_type === 'memo' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {memo.file_type === 'memo' ? 'Memo' : 'One Pager'}
              </span>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors sm:hidden"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={handleOpenAsPdf}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-4 h-4" />
              Open as PDF
            </button>
            <button 
              onClick={onClose} 
              className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-12">
              Failed to load memo content: {error}
            </div>
          ) : (
            <div className="px-8 py-6">
              <article className="memo-content">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({children}) => (
                      <h1 className="text-2xl font-bold text-white mb-6 pb-3 border-b border-zinc-700">
                        {children}
                      </h1>
                    ),
                    h2: ({children}) => (
                      <h2 className="text-xl font-semibold text-white mt-8 mb-4">
                        {children}
                      </h2>
                    ),
                    h3: ({children}) => (
                      <h3 className="text-lg font-semibold text-zinc-200 mt-6 mb-3">
                        {children}
                      </h3>
                    ),
                    p: ({children}) => (
                      <p className="text-zinc-300 leading-7 mb-4">
                        {children}
                      </p>
                    ),
                    strong: ({children}) => (
                      <strong className="font-semibold text-white">{children}</strong>
                    ),
                    em: ({children}) => (
                      <em className="italic text-zinc-300">{children}</em>
                    ),
                    ul: ({children}) => (
                      <ul className="list-disc list-outside ml-6 mb-4 space-y-2 text-zinc-300">
                        {children}
                      </ul>
                    ),
                    ol: ({children}) => (
                      <ol className="list-decimal list-outside ml-6 mb-4 space-y-2 text-zinc-300">
                        {children}
                      </ol>
                    ),
                    li: ({children}) => (
                      <li className="leading-7">{children}</li>
                    ),
                    blockquote: ({children}) => (
                      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-zinc-800/50 rounded-r-lg italic text-zinc-400">
                        {children}
                      </blockquote>
                    ),
                    code: ({className, children}) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="px-1.5 py-0.5 bg-zinc-800 text-blue-400 rounded text-sm font-mono">
                          {children}
                        </code>
                      ) : (
                        <code className={className}>{children}</code>
                      );
                    },
                    pre: ({children}) => (
                      <pre className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 my-4 overflow-x-auto text-sm">
                        {children}
                      </pre>
                    ),
                    table: ({children}) => (
                      <div className="overflow-x-auto my-6">
                        <table className="w-full border-collapse text-sm">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({children}) => (
                      <thead className="bg-zinc-800">{children}</thead>
                    ),
                    th: ({children}) => (
                      <th className="border border-zinc-700 px-4 py-3 text-left font-semibold text-zinc-200">
                        {children}
                      </th>
                    ),
                    td: ({children}) => (
                      <td className="border border-zinc-700 px-4 py-3 text-zinc-300">
                        {children}
                      </td>
                    ),
                    hr: () => (
                      <hr className="border-zinc-700 my-8" />
                    ),
                    a: ({href, children}) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {content || ''}
                </ReactMarkdown>
              </article>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-2 sm:py-3 border-t border-zinc-700 bg-zinc-800/30 text-xs text-zinc-500 gap-1">
          <div className="flex items-center gap-3 sm:gap-6">
            <span>{new Date(memo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>{(memo.file_size / 1024).toFixed(1)} KB</span>
          </div>
          <span className="text-zinc-400 truncate">{memo.description}</span>
        </div>
      </div>
    </div>
  );
}

export default function MemoLibrary() {
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<'memo' | 'one_pager'>('memo');
  const [selectedMemo, setSelectedMemo] = useState<MemoFile | null>(null);

  const { data: memos, error, isLoading } = useSWR<MemoFile[]>(
    `/api/dashboard/memos?type=${docTypeFilter}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Filter memos by search
  const filteredMemos = (Array.isArray(memos) ? memos : []).filter(memo => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      memo.symbol?.toLowerCase().includes(searchLower) ||
      memo.name?.toLowerCase().includes(searchLower) ||
      memo.file_name?.toLowerCase().includes(searchLower)
    );
  });

  // Group memos by date
  const groupedMemos = filteredMemos.reduce((acc, memo) => {
    const date = new Date(memo.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(memo);
    return acc;
  }, {} as Record<string, MemoFile[]>);

  const hasError = error || (memos && !Array.isArray(memos));
  const errorMessage = error?.message || (memos as any)?.error || 'Unknown error';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Memo Library"
        subtitle={`${filteredMemos.length} documents`}
        icon={<FileText className="w-4 h-4 text-primary" />}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Document Type Filter */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => setDocTypeFilter('memo')}
                className={`px-2 sm:px-3 py-1.5 text-xs rounded min-h-[36px] sm:min-h-0 ${docTypeFilter === 'memo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Memos
              </button>
              <button
                onClick={() => setDocTypeFilter('one_pager')}
                className={`px-2 sm:px-3 py-1.5 text-xs rounded min-h-[36px] sm:min-h-0 ${docTypeFilter === 'one_pager' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                One Pagers
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-32 sm:w-48 lg:w-64 pl-9 pr-4 py-2 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px] sm:min-h-0"
              />
            </div>
          </div>
        }
        showBackLink={true}
      />

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : hasError ? (
          <div className="text-red-400 text-center py-8">
            Failed to load memos: {errorMessage}
          </div>
        ) : filteredMemos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No memos found</p>
            <p className="text-sm mt-2">Generate memos from asset detail views to see them here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMemos).map(([date, dateMemos]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium text-muted-foreground">{date}</h2>
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                    {dateMemos.length}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {dateMemos.map((memo) => (
                    <div
                      key={memo.file_id}
                      onClick={() => setSelectedMemo(memo)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                        memo.file_type === 'memo' ? 'border-purple-500/30 bg-purple-500/5' : 'border-blue-500/30 bg-blue-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <File className={`w-4 h-4 ${memo.file_type === 'memo' ? 'text-purple-400' : 'text-blue-400'}`} />
                          <span className="font-bold">{memo.symbol}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          memo.file_type === 'memo' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {memo.file_type === 'memo' ? 'Memo' : 'One Pager'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                        {memo.name}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(memo.created_at).toLocaleTimeString()}</span>
                        <span>{(memo.file_size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedMemo && (
        <MemoDetailModal memo={selectedMemo} onClose={() => setSelectedMemo(null)} />
      )}
    </div>
  );
}

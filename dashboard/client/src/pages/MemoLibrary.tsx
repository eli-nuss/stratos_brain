import useSWR from "swr";
import { Search, FileText, Calendar, ExternalLink, File, Loader2 } from "lucide-react";
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-card border border-border rounded-lg shadow-lg w-[95vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{memo.symbol}</span>
              <span className="text-sm text-muted-foreground">{memo.name}</span>
            </div>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              memo.file_type === 'memo' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {memo.file_type === 'memo' ? 'Investment Memo' : 'One Pager'}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              memo.universe_id === 'crypto_all' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {memo.universe_id === 'crypto_all' ? 'Crypto' : 'Equity'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={memo.file_path} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              <ExternalLink className="w-3 h-3" />
              Open in New Tab
            </a>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg px-2">
              ✕
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-8">
              Failed to load memo content: {error}
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-foreground prose-headings:font-semibold
              prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h1:mb-4
              prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3
              prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:text-muted-foreground prose-ol:text-muted-foreground
              prose-li:my-1
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:italic
              prose-code:text-primary prose-code:bg-muted/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-muted/30 prose-pre:border prose-pre:border-border
              prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-muted/30 prose-th:p-2
              prose-td:border prose-td:border-border prose-td:p-2
              prose-hr:border-border
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || ''}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Created: {new Date(memo.created_at).toLocaleString()}</span>
            <span>Size: {(memo.file_size / 1024).toFixed(1)} KB</span>
          </div>
          <span>{memo.description}</span>
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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.history.back()}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Memo Library</h1>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredMemos.length} documents
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Document Type Filter */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
              <button
                onClick={() => setDocTypeFilter('memo')}
                className={`px-3 py-1 text-xs rounded ${docTypeFilter === 'memo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Memos
              </button>
              <button
                onClick={() => setDocTypeFilter('one_pager')}
                className={`px-3 py-1 text-xs rounded ${docTypeFilter === 'one_pager' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                One Pagers
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by symbol, name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-64"
              />
            </div>
          </div>
        </div>
      </div>

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

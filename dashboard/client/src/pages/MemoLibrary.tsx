import { useState, useMemo } from "react";
import useSWR from "swr";
import { Search, FileText, Calendar, TrendingUp, TrendingDown, Minus, AlertCircle, Eye, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MemoReview {
  id: string;
  asset_id: string;
  symbol: string;
  name: string;
  as_of_date: string;
  universe_id: string;
  source_scope: string;
  attention_level: string;
  direction: string;
  setup_type: string;
  confidence: number;
  summary_text: string;
  review_json: any;
  created_at: string;
}

interface MemoDetailModalProps {
  memo: MemoReview;
  onClose: () => void;
}

function MemoDetailModal({ memo, onClose }: MemoDetailModalProps) {
  const review = memo.review_json || {};
  
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-card border border-border rounded-lg shadow-lg w-[90vw] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
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
              memo.attention_level === 'URGENT' ? 'bg-red-500/20 text-red-400' :
              memo.attention_level === 'FOCUS' ? 'bg-yellow-500/20 text-yellow-400' :
              memo.attention_level === 'WATCH' ? 'bg-blue-500/20 text-blue-400' :
              'bg-muted text-muted-foreground'
            }`}>
              {memo.attention_level}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${
              memo.direction === 'bullish' ? 'bg-green-500/20 text-green-400' :
              memo.direction === 'bearish' ? 'bg-red-500/20 text-red-400' :
              'bg-muted text-muted-foreground'
            }`}>
              {memo.direction === 'bullish' ? <TrendingUp className="w-3 h-3" /> :
               memo.direction === 'bearish' ? <TrendingDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {memo.direction}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Summary</h3>
            <p className="text-sm">{memo.summary_text || review.summary || 'No summary available'}</p>
          </div>
          
          {/* Setup Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded p-3">
              <div className="text-xs text-muted-foreground mb-1">Setup Type</div>
              <div className="text-sm font-medium capitalize">{memo.setup_type || 'N/A'}</div>
            </div>
            <div className="bg-muted/30 rounded p-3">
              <div className="text-xs text-muted-foreground mb-1">Confidence</div>
              <div className="text-sm font-medium">{memo.confidence ? `${(memo.confidence * 100).toFixed(0)}%` : 'N/A'}</div>
            </div>
            <div className="bg-muted/30 rounded p-3">
              <div className="text-xs text-muted-foreground mb-1">Time Horizon</div>
              <div className="text-sm font-medium">{review.time_horizon || 'N/A'}</div>
            </div>
            <div className="bg-muted/30 rounded p-3">
              <div className="text-xs text-muted-foreground mb-1">Source</div>
              <div className="text-sm font-medium capitalize">{memo.source_scope?.replace(/_/g, ' ') || 'N/A'}</div>
            </div>
          </div>
          
          {/* Trade Plan */}
          {(review.entry_zone || review.targets || review.invalidation) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Trade Plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {review.entry_zone && (
                  <div className="bg-muted/30 rounded p-3">
                    <div className="text-xs text-muted-foreground mb-1">Entry Zone</div>
                    <div className="text-sm font-medium">
                      ${review.entry_zone.low?.toFixed(2)} - ${review.entry_zone.high?.toFixed(2)}
                    </div>
                  </div>
                )}
                {review.targets && review.targets.length > 0 && (
                  <div className="bg-muted/30 rounded p-3">
                    <div className="text-xs text-muted-foreground mb-1">Targets</div>
                    <div className="text-sm font-medium">
                      {review.targets.map((t: any, i: number) => (
                        <span key={i}>${t.price?.toFixed(2)}{i < review.targets.length - 1 ? ', ' : ''}</span>
                      ))}
                    </div>
                  </div>
                )}
                {review.invalidation && (
                  <div className="bg-muted/30 rounded p-3">
                    <div className="text-xs text-muted-foreground mb-1">Invalidation</div>
                    <div className="text-sm font-medium text-red-400">${review.invalidation?.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Why Now */}
          {review.why_now && review.why_now.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Why Now</h3>
              <ul className="text-sm space-y-1">
                {review.why_now.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Risks */}
          {review.risks && review.risks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Risks</h3>
              <ul className="text-sm space-y-1">
                {review.risks.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 text-yellow-400 mt-1 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* What to Watch */}
          {review.what_to_watch_next && review.what_to_watch_next.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">What to Watch</h3>
              <ul className="text-sm space-y-1">
                {review.what_to_watch_next.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <Eye className="w-3 h-3 text-blue-400 mt-1 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {memo.as_of_date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(memo.created_at).toLocaleString()}
            </span>
          </div>
          <span className="capitalize">{memo.universe_id?.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
}

export default function MemoLibrary() {
  const [search, setSearch] = useState("");
  const [selectedMemo, setSelectedMemo] = useState<MemoReview | null>(null);
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterAttention, setFilterAttention] = useState<string>("all");
  
  const { data: memos, isLoading, error } = useSWR<MemoReview[]>(
    "/api/dashboard/memos",
    fetcher
  );
  
  const filteredMemos = useMemo(() => {
    if (!memos) return [];
    
    return memos.filter((memo) => {
      // Search filter
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        memo.symbol?.toLowerCase().includes(searchLower) ||
        memo.name?.toLowerCase().includes(searchLower) ||
        memo.summary_text?.toLowerCase().includes(searchLower);
      
      // Direction filter
      const matchesDirection = filterDirection === "all" || memo.direction === filterDirection;
      
      // Attention filter
      const matchesAttention = filterAttention === "all" || memo.attention_level === filterAttention;
      
      return matchesSearch && matchesDirection && matchesAttention;
    });
  }, [memos, search, filterDirection, filterAttention]);
  
  // Group memos by date
  const groupedMemos = useMemo(() => {
    const groups: Record<string, MemoReview[]> = {};
    filteredMemos.forEach((memo) => {
      const date = memo.as_of_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(memo);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredMemos]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </a>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Memo Library
            </h1>
            <span className="text-sm text-muted-foreground">
              {memos?.length || 0} memos
            </span>
          </div>
          
          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by symbol, name, or content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9 pr-3 py-1.5 text-sm bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value)}
              className="px-3 py-1.5 text-sm bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Directions</option>
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </select>
            
            <select
              value={filterAttention}
              onChange={(e) => setFilterAttention(e.target.value)}
              className="px-3 py-1.5 text-sm bg-muted/30 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Attention</option>
              <option value="URGENT">Urgent</option>
              <option value="FOCUS">Focus</option>
              <option value="WATCH">Watch</option>
              <option value="IGNORE">Ignore</option>
            </select>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="container py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading memos...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-400">Failed to load memos</div>
          </div>
        ) : filteredMemos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p>No memos found</p>
            {search && <p className="text-sm mt-1">Try adjusting your search or filters</p>}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedMemos.map(([date, dateMemos]) => (
              <div key={date}>
                <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">{dateMemos.length}</span>
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dateMemos.map((memo) => (
                    <button
                      key={memo.id}
                      onClick={() => setSelectedMemo(memo)}
                      className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary/50 hover:bg-muted/20 transition-all group"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium group-hover:text-primary transition-colors">
                            {memo.symbol}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {memo.name}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            memo.attention_level === 'URGENT' ? 'bg-red-500/20 text-red-400' :
                            memo.attention_level === 'FOCUS' ? 'bg-yellow-500/20 text-yellow-400' :
                            memo.attention_level === 'WATCH' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {memo.attention_level}
                          </span>
                          <span className={`flex items-center gap-0.5 text-[10px] ${
                            memo.direction === 'bullish' ? 'text-green-400' :
                            memo.direction === 'bearish' ? 'text-red-400' :
                            'text-muted-foreground'
                          }`}>
                            {memo.direction === 'bullish' ? <TrendingUp className="w-3 h-3" /> :
                             memo.direction === 'bearish' ? <TrendingDown className="w-3 h-3" /> :
                             <Minus className="w-3 h-3" />}
                            {memo.direction}
                          </span>
                        </div>
                      </div>
                      
                      {/* Summary */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {memo.summary_text || 'No summary available'}
                      </p>
                      
                      {/* Footer */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="capitalize">{memo.setup_type?.replace(/_/g, ' ') || 'N/A'}</span>
                        <span>{memo.confidence ? `${(memo.confidence * 100).toFixed(0)}% conf` : ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Memo Detail Modal */}
      {selectedMemo && (
        <MemoDetailModal memo={selectedMemo} onClose={() => setSelectedMemo(null)} />
      )}
    </div>
  );
}

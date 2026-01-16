import useSWR from "swr";
import { Search, FileText, Calendar, FileDown, File, Loader2, MessageSquare, TrendingUp, Download, ExternalLink, Activity, List, LayoutGrid } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation } from "wouter";

import { apiFetcher } from "@/lib/api-config";

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
  created_at: string;
  sector?: string;
  sentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score?: number;
  thesis?: string;
  performance_since?: number;
  stock_lists?: { id: number; name: string }[];
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
    const viewerUrl = `/memo/${memo.file_id}`;
    window.open(viewerUrl, '_blank');
  };

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

function MemoCard({ memo, onClick }: { memo: MemoFile; onClick: () => void }) {
  const [, setLocation] = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  const handleOpenChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(`/asset/${memo.asset_id}?tab=chat`);
  };

  const handleViewChart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(`/asset/${memo.asset_id}?tab=chart`);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const viewerUrl = `/memo/${memo.file_id}`;
    window.open(viewerUrl, '_blank');
  };

  const getSentimentColor = (sentiment?: string) => {
    if (sentiment === 'BULLISH') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (sentiment === 'BEARISH') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  };

  const getPerformanceColor = (perf?: number) => {
    if (!perf) return 'text-zinc-400';
    return perf >= 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 cursor-pointer transition-all hover:border-zinc-600 hover:bg-zinc-900 hover:shadow-xl overflow-hidden"
    >
      {/* Performance Badge */}
      {memo.performance_since !== undefined && (
        <div className="absolute top-4 right-4 flex flex-col items-end">
          <span className={`text-xs font-bold ${getPerformanceColor(memo.performance_since)}`}>
            {memo.performance_since >= 0 ? '+' : ''}{memo.performance_since.toFixed(1)}%
          </span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Since Memo</span>
        </div>
      )}

      {/* Header: Logo + Symbol */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
          <img 
            src={`https://logo.clearbit.com/${memo.symbol.toLowerCase()}.com`} 
            alt={memo.symbol}
            className="w-7 h-7 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${memo.symbol}&background=27272a&color=fff&bold=true`;
            }}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-lg leading-none">{memo.symbol}</h3>
            <span className="text-xs text-zinc-500 font-medium truncate max-w-[120px]">({memo.name})</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {memo.sentiment && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${getSentimentColor(memo.sentiment)}`}>
                {memo.sentiment}
              </span>
            )}
            {memo.score && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-blue-500/30 bg-blue-500/10 text-blue-400">
                SCORE: {memo.score}
              </span>
            )}
            {memo.sector && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-zinc-700 bg-zinc-800 text-zinc-400">
                {memo.sector}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Thesis Hook */}
      <div className="mb-4 h-12">
        <p className="text-sm text-zinc-300 line-clamp-2 italic leading-relaxed">
          "{memo.thesis || memo.description || 'No executive thesis available for this memo.'}"
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3" />
          <span>{new Date(memo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>•</span>
          <span>{new Date(memo.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
        </div>
        <span className="font-medium">By Eli Nuss</span>
      </div>

      {/* Quick Actions Overlay */}
      <div className={`absolute inset-x-0 bottom-0 bg-zinc-900/95 border-t border-zinc-700 p-3 flex items-center justify-around transition-all duration-200 ${isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleOpenChat} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <MessageSquare className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Open Research Chat</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleViewChart} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <Activity className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View Price Chart</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <Download className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Download PDF</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onClick} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                <ExternalLink className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View Full Memo</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

export default function MemoLibrary() {
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState<'memo' | 'one_pager' | 'all'>('all');
  const [selectedMemo, setSelectedMemo] = useState<MemoFile | null>(null);
  const [groupBy, setGroupBy] = useState<'date' | 'list'>('date');

  const { data: memos, error, isLoading } = useSWR<MemoFile[]>(
    `/api/dashboard/memos?type=${docTypeFilter}`,
    apiFetcher,
    { revalidateOnFocus: false }
  );

  // Filter memos by search
  const filteredMemos = (Array.isArray(memos) ? memos : []).filter(memo => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      memo.symbol?.toLowerCase().includes(searchLower) ||
      memo.name?.toLowerCase().includes(searchLower) ||
      memo.file_name?.toLowerCase().includes(searchLower) ||
      memo.thesis?.toLowerCase().includes(searchLower) ||
      memo.sector?.toLowerCase().includes(searchLower)
    );
  });

  // Group memos by date
  const groupedByDate = filteredMemos.reduce((acc, memo) => {
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

  // Group memos by stock list
  const groupedByList = filteredMemos.reduce((acc, memo) => {
    if (memo.stock_lists && memo.stock_lists.length > 0) {
      memo.stock_lists.forEach(list => {
        if (!acc[list.name]) acc[list.name] = [];
        // Avoid duplicates
        if (!acc[list.name].find(m => m.file_id === memo.file_id)) {
          acc[list.name].push(memo);
        }
      });
    } else {
      if (!acc['Uncategorized']) acc['Uncategorized'] = [];
      acc['Uncategorized'].push(memo);
    }
    return acc;
  }, {} as Record<string, MemoFile[]>);

  // Sort lists alphabetically, but put Uncategorized at the end
  const sortedListKeys = Object.keys(groupedByList).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  const groupedMemos = groupBy === 'date' ? groupedByDate : groupedByList;
  const groupKeys = groupBy === 'date' ? Object.keys(groupedByDate) : sortedListKeys;

  const hasError = error || (memos && !Array.isArray(memos));
  const errorMessage = error?.message || (memos as any)?.error || 'Unknown error';

  return (
    <DashboardLayout hideNavTabs>
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-500" />
              Research Library
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Track conviction, performance, and institutional-grade research.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search ticker, sector, or thesis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 w-full md:w-64 transition-all"
              />
            </div>
            
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setDocTypeFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${docTypeFilter === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                All
              </button>
              <button
                onClick={() => setDocTypeFilter('memo')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${docTypeFilter === 'memo' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Memos
              </button>
              <button
                onClick={() => setDocTypeFilter('one_pager')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${docTypeFilter === 'one_pager' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                One Pagers
              </button>
            </div>

            {/* Group By Toggle */}
            <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setGroupBy('date')}
                      className={`p-1.5 rounded-md transition-all ${groupBy === 'date' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Group by Date</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setGroupBy('list')}
                      className={`p-1.5 rounded-md transition-all ${groupBy === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Group by Stock List</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="text-zinc-500 animate-pulse">Analyzing research library...</p>
          </div>
        ) : hasError ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
            <p className="text-red-400 font-medium">Failed to load research library</p>
            <p className="text-red-400/60 text-sm mt-1">{errorMessage}</p>
          </div>
        ) : filteredMemos.length === 0 ? (
          <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-2xl p-16 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <h3 className="text-lg font-medium text-zinc-300">No research found</h3>
            <p className="text-zinc-500 text-sm mt-2 max-w-xs mx-auto">Generate memos from asset detail views to populate your institutional library.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupKeys.map((groupKey) => {
              const groupMemos = groupedMemos[groupKey];
              const isListView = groupBy === 'list';
              const Icon = isListView ? List : Calendar;
              const iconColor = isListView 
                ? (groupKey === 'Uncategorized' ? 'text-zinc-600' : 'text-blue-500')
                : 'text-zinc-500';
              const badgeColor = isListView
                ? (groupKey === 'Uncategorized' ? 'text-zinc-500 bg-zinc-800/50 border-zinc-700' : 'text-blue-400 bg-blue-500/10 border-blue-500/20')
                : 'text-blue-400 bg-blue-500/10 border-blue-500/20';
              
              return (
                <div key={groupKey}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-zinc-800/50"></div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
                      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                      <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{groupKey}</h2>
                      <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full border ${badgeColor}`}>
                        {groupMemos.length}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-zinc-800/50"></div>
                  </div>
                  
                  {isListView ? (
                    <div className="overflow-x-auto pb-4 -mx-2 px-2">
                      <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                        {groupMemos.map((memo) => (
                          <div key={`${groupKey}-${memo.file_id}`} className="w-[320px] flex-shrink-0">
                            <MemoCard 
                              memo={memo} 
                              onClick={() => setSelectedMemo(memo)} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {groupMemos.map((memo) => (
                        <MemoCard 
                          key={`${groupKey}-${memo.file_id}`} 
                          memo={memo} 
                          onClick={() => setSelectedMemo(memo)} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedMemo && (
        <MemoDetailModal memo={selectedMemo} onClose={() => setSelectedMemo(null)} />
      )}
    </DashboardLayout>
  );
}

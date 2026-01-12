import { useState, useEffect } from 'react';
import { 
  Users, TrendingUp, Search, Plus, ArrowLeft, 
  BarChart3, BrainCircuit, Activity, RefreshCw, Trash2, X,
  ChevronRight, DollarSign, Percent, Target, ExternalLink
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import AssetDetail from '@/components/AssetDetail';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import useSWR, { mutate } from 'swr';

// Types
interface Investor {
  investor_id: number;
  investor_name: string;
  cik: string;
  manager_name?: string;
  last_filing_date: string;
  last_updated: string;
  top_sector?: string;
  turnover_rate?: string;
  performance_1y?: number;
  performance_ytd?: number;
  total_positions: number;
  total_portfolio_value: number;
  new_positions: number;
  increased_positions: number;
  reduced_positions: number;
  sold_positions: number;
  top_holdings: string[];
}

interface EnrichedHolding {
  id: number;
  investor_id: number;
  investor_name: string;
  symbol: string;
  company_name: string;
  shares: number;
  value: number;
  percent_portfolio: number;
  change_shares: number;
  change_percent: number;
  action: string;
  date_reported: string;
  quarter: string;
  // Stratos AI enrichment
  asset_id?: number;
  current_price?: number;
  day_change?: number;
  change_30d?: number;
  change_365d?: number;
  stratos_ai_score?: number;
  stratos_ai_direction?: string;
  stratos_rsi?: number;
  sector?: string;
  market_cap?: number;
}

interface ConsensusStock {
  symbol: string;
  company_name: string;
  guru_count: number;
  guru_names: string[];
  total_guru_invested: number;
  avg_conviction: number;
  latest_filing_date: string;
  // Stratos AI enrichment
  asset_id?: number;
  current_price?: number;
  market_cap?: number;
  day_change?: number;
  change_30d?: number;
  change_365d?: number;
  stratos_ai_score?: number;
  stratos_ai_direction?: string;
  stratos_rsi?: number;
  sector?: string;
}

interface SearchResult {
  cik: string;
  name: string;
  date?: string;
}

// Fetcher with error handling
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: { 'x-stratos-key': 'stratos_brain_api_key_2024' }
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};

// Format helpers
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
};

const getInitials = (name: string): string => {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
};

const getScoreColor = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'text-slate-500';
  if (score >= 50) return 'text-emerald-400';
  if (score >= 0) return 'text-amber-400';
  return 'text-red-400';
};

const getDirectionBadge = (direction: string | null | undefined, score: number | null | undefined) => {
  if (!direction) return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' };
  
  const dir = direction.toLowerCase();
  if (dir === 'bullish') {
    return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  } else if (dir === 'bearish') {
    return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
  }
  return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
};

const getActionBadge = (action: string) => {
  const styles: Record<string, string> = {
    NEW: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    ADD: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    REDUCE: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    SOLD: 'bg-red-500/20 text-red-400 border-red-500/30',
    HOLD: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return styles[action] || styles.HOLD;
};

export default function InvestorWatchlist() {
  const { user } = useAuth();

  const [activeView, setActiveView] = useState<'overview' | 'detail'>('overview');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  
  // Asset detail modal state
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Fetch investors list
  const { data: investors, error: investorsError, isLoading: investorsLoading } = useSWR<Investor[]>(
    '/api/investor-api/investors',
    fetcher,
    { refreshInterval: 60000 }
  );

  // Fetch consensus stocks
  const { data: consensusStocks } = useSWR<ConsensusStock[]>(
    '/api/investor-api/consensus?min_gurus=2',
    fetcher,
    { refreshInterval: 60000 }
  );

  // Fetch enriched holdings for selected investor
  const { data: holdings, isLoading: holdingsLoading } = useSWR<EnrichedHolding[]>(
    selectedInvestor ? `/api/investor-api/holdings/${selectedInvestor.investor_id}?enriched=true` : null,
    fetcher
  );

  const investorList = Array.isArray(investors) ? investors : [];
  const consensusList = Array.isArray(consensusStocks) ? consensusStocks : [];

  // Open asset detail modal
  const handleRowClick = (assetId: number | null | undefined, symbol: string) => {
    if (assetId) {
      setSelectedAssetId(assetId.toString());
    } else {
      // If no asset_id, try to look it up
      fetch(`/api/investor-api/asset/${symbol}`, {
        headers: { 'x-stratos-key': 'stratos_brain_api_key_2024' }
      })
        .then(res => res.json())
        .then(data => {
          if (data.asset_id) {
            setSelectedAssetId(data.asset_id.toString());
          } else {
            toast.error(`Asset ${symbol} not found in Stratos database`);
          }
        })
        .catch(() => {
          toast.error(`Could not find asset ${symbol}`);
        });
    }
  };

  // Close asset detail modal
  const handleCloseAssetDetail = () => {
    setSelectedAssetId(null);
  };

  // Search for investors
  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/investor-api/search?query=${encodeURIComponent(query)}`, {
        headers: { 'x-stratos-key': 'stratos_brain_api_key_2024' }
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Track a new investor
  const handleTrack = async (result: SearchResult) => {
    setIsTracking(true);
    try {
      const res = await fetch('/api/investor-api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-stratos-key': 'stratos_brain_api_key_2024'
        },
        body: JSON.stringify({ cik: result.cik, name: result.name })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success(`Now tracking ${result.name}`);
      setShowSearchModal(false);
      setSearchQuery('');
      setSearchResults([]);
      mutate('/api/investor-api/investors');
    } catch (err: any) {
      toast.error(err.message || 'Failed to track investor');
    } finally {
      setIsTracking(false);
    }
  };

  // Delete an investor
  const handleDelete = async (investorId: number, name: string) => {
    if (!confirm(`Remove ${name} from tracking?`)) return;
    
    try {
      await fetch(`/api/investor-api/investors/${investorId}`, {
        method: 'DELETE',
        headers: { 'x-stratos-key': 'stratos_brain_api_key_2024' }
      });
      toast.success(`Removed ${name}`);
      mutate('/api/investor-api/investors');
      if (selectedInvestor?.investor_id === investorId) {
        setSelectedInvestor(null);
        setActiveView('overview');
      }
    } catch (err) {
      toast.error('Failed to remove investor');
    }
  };

  // Refresh holdings
  const handleRefresh = async (investorId: number) => {
    try {
      const res = await fetch(`/api/investor-api/refresh/${investorId}`, {
        method: 'POST',
        headers: { 'x-stratos-key': 'stratos_brain_api_key_2024' }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success(`Refreshed holdings (${data.holdingsCount} positions)`);
      mutate('/api/investor-api/investors');
      mutate(`/api/investor-api/holdings/${investorId}?enriched=true`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh');
    }
  };

  // Select investor for detail view
  const handleSelectInvestor = (investor: Investor) => {
    setSelectedInvestor(investor);
    setActiveView('detail');
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-6rem)] flex-col p-6 space-y-6 overflow-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-400" />
              Smart Money Tracker
            </h1>
            <p className="text-slate-400">
              Analyze institutional portfolios with Stratos AI overlays
            </p>
          </div>
          <button 
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Add Investor
          </button>
        </div>

        {/* --- VIEW 1: AGGREGATE OVERVIEW --- */}
        {activeView === 'overview' && (
          <div className="space-y-6 flex-1 min-h-0">
            
            {/* Top Section: Consensus + Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Consensus Ideas */}
              <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-emerald-400" />
                  High Conviction Consensus
                  <span className="text-xs font-normal text-slate-500 ml-2">(Owned by 2+ Investors)</span>
                </h3>
                
                {consensusList.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm text-left text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                        <tr>
                          <th className="px-3 py-3">Ticker</th>
                          <th className="px-3 py-3 text-center">Investors</th>
                          <th className="px-3 py-3 text-right">Avg Weight</th>
                          <th className="px-3 py-3 text-right">Total Invested</th>
                          <th className="px-3 py-3 text-right">MC</th>
                          <th className="px-3 py-3 text-center">AI Direction</th>
                          <th className="px-3 py-3 text-right">24h%</th>
                          <th className="px-3 py-3 text-right">30d%</th>
                          <th className="px-3 py-3 text-right">365d%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                        {consensusList.slice(0, 15).map((stock) => {
                          const dirBadge = getDirectionBadge(stock.stratos_ai_direction, stock.stratos_ai_score);
                          return (
                            <tr 
                              key={stock.symbol} 
                              className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                              onClick={() => handleRowClick(stock.asset_id, stock.symbol)}
                            >
                              <td className="px-3 py-3">
                                <span className="font-medium text-white hover:text-indigo-400 transition-colors flex items-center gap-1 group">
                                  {stock.symbol}
                                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="text-indigo-400 font-bold">{stock.guru_count}</span>
                              </td>
                              <td className="px-3 py-3 text-right font-mono">{(stock.avg_conviction ?? 0).toFixed(1)}%</td>
                              <td className="px-3 py-3 text-right font-mono">{formatCurrency(stock.total_guru_invested)}</td>
                              <td className="px-3 py-3 text-right font-mono text-slate-400">{formatCurrency(stock.market_cap)}</td>
                              <td className="px-3 py-3 text-center">
                                {stock.stratos_ai_direction ? (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-xs font-medium border",
                                    dirBadge.bg, dirBadge.text, dirBadge.border
                                  )}>
                                    {stock.stratos_ai_score ?? '-'}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                              <td className={cn(
                                "px-3 py-3 text-right font-mono",
                                (stock.day_change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                              )}>
                                {stock.day_change != null ? `${stock.day_change >= 0 ? '+' : ''}${stock.day_change.toFixed(2)}%` : '-'}
                              </td>
                              <td className={cn(
                                "px-3 py-3 text-right font-mono",
                                (stock.change_30d ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                              )}>
                                {stock.change_30d != null ? `${stock.change_30d >= 0 ? '+' : ''}${stock.change_30d.toFixed(1)}%` : '-'}
                              </td>
                              <td className={cn(
                                "px-3 py-3 text-right font-mono",
                                (stock.change_365d ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                              )}>
                                {stock.change_365d != null ? `${stock.change_365d >= 0 ? '+' : ''}${stock.change_365d.toFixed(1)}%` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    Track at least 2 investors to see consensus picks
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  Portfolio Stats
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-indigo-400" />
                      <span className="text-slate-400">Tracked Investors</span>
                    </div>
                    <span className="text-white font-mono text-lg">{investorList.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <span className="text-slate-400">Total AUM</span>
                    </div>
                    <span className="text-white font-mono text-lg">
                      {formatCurrency(investorList.reduce((sum, i) => sum + (i.total_portfolio_value || 0), 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-amber-400" />
                      <span className="text-slate-400">Consensus Picks</span>
                    </div>
                    <span className="text-white font-mono text-lg">{consensusList.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Investor Cards Grid */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Your Tracked Funds</h3>
              
              {investorsLoading ? (
                <div className="text-center py-12 text-slate-500">Loading investors...</div>
              ) : investorList.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">No investors tracked yet</p>
                  <button 
                    onClick={() => setShowSearchModal(true)}
                    className="text-indigo-400 hover:text-indigo-300"
                  >
                    + Add your first investor
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {investorList.map((investor) => (
                    <div 
                      key={investor.investor_id}
                      className="group relative bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-indigo-500/10"
                      onClick={() => handleSelectInvestor(investor)}
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-sm">
                          {getInitials(investor.investor_name)}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRefresh(investor.investor_id); }}
                            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Refresh holdings"
                          >
                            <RefreshCw className="w-4 h-4 text-slate-400" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(investor.investor_id, investor.investor_name); }}
                            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Remove investor"
                          >
                            <Trash2 className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </div>

                      {/* Fund Name */}
                      <h4 className="font-semibold text-white mb-1 line-clamp-2 text-sm leading-tight">
                        {investor.investor_name}
                      </h4>
                      
                      {/* Stats */}
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>AUM</span>
                          <span className="text-white font-mono">{formatCurrency(investor.total_portfolio_value)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Positions</span>
                          <span className="text-white font-mono">{investor.total_positions}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Last Filing</span>
                          <span className="text-white">{investor.last_filing_date || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Top Holdings Preview */}
                      {investor.top_holdings && investor.top_holdings.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800">
                          <div className="flex flex-wrap gap-1">
                            {investor.top_holdings.slice(0, 5).filter(h => h !== 'UNKNOWN').map((ticker) => (
                              <span 
                                key={ticker} 
                                className="px-1.5 py-0.5 bg-slate-800 rounded text-xs text-slate-400"
                              >
                                {ticker}
                              </span>
                            ))}
                            {investor.top_holdings.length > 5 && (
                              <span className="px-1.5 py-0.5 text-xs text-slate-500">
                                +{investor.top_holdings.length - 5}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* View Details Arrow */}
                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VIEW 2: PORTFOLIO DETAIL (THE X-RAY) --- */}
        {activeView === 'detail' && selectedInvestor && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Breadcrumb */}
            <button 
              onClick={() => setActiveView('overview')}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Overview
            </button>

            {/* Fund Header */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedInvestor.investor_name}</h2>
                  <div className="flex items-center gap-6 text-sm text-slate-400 flex-wrap">
                    <span className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> AUM: <span className="text-white">{formatCurrency(selectedInvestor.total_portfolio_value)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> Positions: <span className="text-white">{selectedInvestor.total_positions}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Last Filing: <span className="text-white">{selectedInvestor.last_filing_date || 'N/A'}</span>
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleRefresh(selectedInvestor.investor_id)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* The "X-Ray" Table */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center flex-shrink-0">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-400" />
                  Portfolio X-Ray
                </h3>
                <div className="text-xs text-slate-500">
                  Holdings from 13F (Lagged) • Live Stratos AI Scores • Click row to view details
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {holdingsLoading ? (
                  <div className="text-center py-12 text-slate-500">Loading holdings...</div>
                ) : !holdings || holdings.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No holdings found</div>
                ) : (
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Ticker</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3 text-right">% Port</th>
                        <th className="px-4 py-3 text-right">Value</th>
                        <th className="px-4 py-3 text-right">Shares</th>
                        <th className="px-4 py-3 text-center">Action</th>
                        <th className="px-4 py-3 text-center">AI Score</th>
                        <th className="px-4 py-3 text-center">RSI</th>
                        <th className="px-4 py-3 text-right">24h%</th>
                        <th className="px-4 py-3 text-right">30d%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {holdings.map((holding) => {
                        const dirBadge = getDirectionBadge(holding.stratos_ai_direction, holding.stratos_ai_score);
                        return (
                          <tr 
                            key={holding.id} 
                            className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                            onClick={() => handleRowClick(holding.asset_id, holding.symbol)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium text-white hover:text-indigo-400 transition-colors flex items-center gap-1 group">
                                {holding.symbol}
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{holding.company_name}</td>
                            <td className="px-4 py-3 text-right font-mono">{(holding.percent_portfolio ?? 0).toFixed(2)}%</td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(holding.value)}</td>
                            <td className="px-4 py-3 text-right font-mono">{formatNumber(holding.shares)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn("px-2 py-0.5 rounded text-xs border", getActionBadge(holding.action))}>
                                {holding.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {holding.stratos_ai_direction ? (
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium border",
                                  dirBadge.bg, dirBadge.text, dirBadge.border
                                )}>
                                  {holding.stratos_ai_score ?? '-'}
                                </span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-slate-400">
                              {holding.stratos_rsi?.toFixed(0) ?? '-'}
                            </td>
                            <td className={cn(
                              "px-4 py-3 text-right font-mono",
                              (holding.day_change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                              {holding.day_change != null ? `${holding.day_change >= 0 ? '+' : ''}${holding.day_change.toFixed(2)}%` : '-'}
                            </td>
                            <td className={cn(
                              "px-4 py-3 text-right font-mono",
                              (holding.change_30d ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                              {holding.change_30d != null ? `${holding.change_30d >= 0 ? '+' : ''}${holding.change_30d.toFixed(1)}%` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Modal */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Add Investor</h3>
                <button 
                  onClick={() => { setShowSearchModal(false); setSearchQuery(''); setSearchResults([]); }}
                  className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by fund name or manager..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>
                
                <div className="mt-4 max-h-80 overflow-auto">
                  {isSearching ? (
                    <div className="text-center py-8 text-slate-500">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <button
                          key={result.cik}
                          onClick={() => handleTrack(result)}
                          disabled={isTracking}
                          className="w-full p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-left transition-colors disabled:opacity-50"
                        >
                          <div className="font-medium text-white">{result.name}</div>
                          <div className="text-sm text-slate-500">CIK: {result.cik} {result.date && `• Latest: ${result.date}`}</div>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <div className="text-center py-8 text-slate-500">No investors found</div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p className="mb-2">Search for institutional investors</p>
                      <p className="text-xs">Try: Berkshire, Pershing Square, Scion, Bridgewater...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Asset Detail Modal */}
        {selectedAssetId && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl h-[90vh] shadow-2xl overflow-hidden">
              <AssetDetail 
                assetId={selectedAssetId} 
                onClose={handleCloseAssetDetail} 
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Activity, 
  Target, 
  RefreshCw, 
  Calendar,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { SUPABASE_ANON_KEY } from '@/lib/api-config';

// Types
interface Pick {
  symbol: string;
  name: string;
  sector: string;
  setup_type: string;
  entry: number;
  stop: number;
  target: number;
  risk_reward: number;
  conviction: 'HIGH' | 'MEDIUM';
  one_liner: string;
}

interface Category {
  theme_summary: string;
  picks: Pick[];
}

interface PortfolioAlert {
  type: 'ADD_ON_OPPORTUNITY' | 'SECTOR_CONCENTRATION';
  symbol: string;
  sector?: string;
  setup_type: string;
  message: string;
}

interface ActionItem {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  symbol: string;
  setup_type: string;
}

interface DailyBrief {
  date: string;
  market_regime: string;
  macro_summary: string;
  categories: {
    momentum_breakouts: Category;
    trend_continuation: Category;
    compression_reversion: Category;
  };
  portfolio_alerts: PortfolioAlert[];
  action_items: ActionItem[];
  tokens: { in: number; out: number };
}

const API_URL = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/daily-brief-api-v3';

export default function DailyBriefV3() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBrief = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success && data.brief) {
        setBrief(data.brief);
      } else {
        setBrief(null);
      }
    } catch (err) {
      setError('Failed to fetch daily brief');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateBrief = async () => {
    try {
      setGenerating(true);
      setError(null);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success && data.brief) {
        setBrief(data.brief);
      } else {
        setError(data.error || 'Failed to generate brief');
      }
    } catch (err) {
      setError('Failed to generate daily brief');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchBrief();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getRegimeBadge = (regime: string) => {
    const lower = regime.toLowerCase();
    if (lower.includes('bull') || lower.includes('risk-on')) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{regime}</Badge>;
    } else if (lower.includes('bear') || lower.includes('risk-off')) {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{regime}</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{regime}</Badge>;
  };

  const getConvictionBadge = (conviction: string) => {
    if (conviction === 'HIGH') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">HIGH</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">MEDIUM</Badge>;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-red-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const CategorySection = ({ 
    title, 
    icon: Icon, 
    category, 
    color 
  }: { 
    title: string; 
    icon: any; 
    category: Category; 
    color: string;
  }) => (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="outline" className="ml-auto">
            {category.picks?.length || 0} picks
          </Badge>
        </div>
        <CardDescription className="text-zinc-400 mt-2">
          {category.theme_summary}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {category.picks && category.picks.length > 0 ? (
          <div className="space-y-3">
            {category.picks.map((pick, idx) => (
              <div 
                key={idx} 
                className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{pick.symbol}</span>
                    {getConvictionBadge(pick.conviction)}
                    <Badge variant="outline" className="text-xs">{pick.setup_type}</Badge>
                  </div>
                  <span className="text-xs text-zinc-500">{pick.sector}</span>
                </div>
                <p className="text-sm text-zinc-300 mb-2">{pick.one_liner}</p>
                <div className="flex gap-4 text-xs text-zinc-500">
                  <span>Entry: <span className="text-green-400">${pick.entry?.toFixed(2)}</span></span>
                  <span>Stop: <span className="text-red-400">${pick.stop?.toFixed(2)}</span></span>
                  <span>Target: <span className="text-blue-400">${pick.target?.toFixed(2)}</span></span>
                  <span>R:R: <span className="text-yellow-400">{pick.risk_reward?.toFixed(1)}</span></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-4">No picks available</p>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Daily Brief
          </h1>
          <p className="text-zinc-400">AI-powered market analysis and top trading setups</p>
        </div>
        <Button 
          onClick={generateBrief} 
          disabled={generating}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {generating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </>
          )}
        </Button>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-2 text-red-400">
            <XCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {brief ? (
        <>
          {/* Market Overview */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-zinc-400" />
                  <span className="text-zinc-300">{formatDate(brief.date)}</span>
                  {getRegimeBadge(brief.market_regime)}
                </div>
                <div className="text-xs text-zinc-500">
                  {brief.tokens?.in?.toLocaleString()} tokens in / {brief.tokens?.out?.toLocaleString()} out
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300">{brief.macro_summary}</p>
            </CardContent>
          </Card>

          {/* Categories Tabs */}
          <Tabs defaultValue="momentum" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-zinc-900/50">
              <TabsTrigger value="momentum" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Momentum
              </TabsTrigger>
              <TabsTrigger value="trend" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Trend
              </TabsTrigger>
              <TabsTrigger value="compression" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Compression
              </TabsTrigger>
            </TabsList>

            <TabsContent value="momentum" className="mt-4">
              <CategorySection 
                title="Momentum Breakouts" 
                icon={TrendingUp} 
                category={brief.categories.momentum_breakouts}
                color="text-green-500"
              />
            </TabsContent>

            <TabsContent value="trend" className="mt-4">
              <CategorySection 
                title="Trend Continuation" 
                icon={Activity} 
                category={brief.categories.trend_continuation}
                color="text-blue-500"
              />
            </TabsContent>

            <TabsContent value="compression" className="mt-4">
              <CategorySection 
                title="Compression & Reversion" 
                icon={Target} 
                category={brief.categories.compression_reversion}
                color="text-purple-500"
              />
            </TabsContent>
          </Tabs>

          {/* Portfolio Alerts & Action Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Portfolio Alerts */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-orange-500" />
                  <CardTitle className="text-lg">Portfolio Alerts</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {brief.portfolio_alerts && brief.portfolio_alerts.length > 0 ? (
                  <div className="space-y-2">
                    {brief.portfolio_alerts.map((alert, idx) => (
                      <div key={idx} className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <div className="flex items-center gap-2 mb-1">
                          {alert.type === 'ADD_ON_OPPORTUNITY' ? (
                            <ArrowUpRight className="h-4 w-4 text-green-400" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-400" />
                          )}
                          <span className="font-medium text-white">{alert.symbol}</span>
                          <Badge variant="outline" className="text-xs">{alert.type.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-sm text-zinc-400">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-4">No portfolio alerts</p>
                )}
              </CardContent>
            </Card>

            {/* Action Items */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-lg">Action Items</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {brief.action_items && brief.action_items.length > 0 ? (
                  <div className="space-y-2">
                    {brief.action_items.slice(0, 7).map((item, idx) => (
                      <div key={idx} className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold text-xs ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                          <span className="font-medium text-white">{item.symbol}</span>
                        </div>
                        <p className="text-sm text-zinc-400">{item.action}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-4">No action items</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Brief Available</h3>
            <p className="text-zinc-400 mb-4">Generate today's market brief to see the top trading opportunities.</p>
            <Button onClick={generateBrief} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Brief'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

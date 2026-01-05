import { useState } from "react";
import { 
  Activity, 
  Database, 
  Brain, 
  Cpu, 
  ArrowRight, 
  ChevronDown,
  ChevronRight,
  Target,
  TrendingUp,
  AlertTriangle,
  Eye,
  BarChart3,
  Zap,
  FileJson,
  Server,
  Globe
} from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
      >
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <div className="ml-auto">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function FlowDiagram() {
  return (
    <div className="p-6 bg-card/30 rounded-lg border border-border">
      <h3 className="text-lg font-semibold mb-6 text-center">AI Analysis Pipeline</h3>
      
      {/* Data Pipeline */}
      <div className="mb-8">
        <div className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Data Pipeline</div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-lg flex flex-col items-center justify-center">
              <Globe className="w-5 h-5 text-blue-400 mb-1" />
              <span className="text-xs font-medium">Data Sources</span>
              <span className="text-[10px] text-muted-foreground">CoinGecko / Polygon</span>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-lg flex flex-col items-center justify-center">
              <Database className="w-5 h-5 text-green-400 mb-1" />
              <span className="text-xs font-medium">daily_bars</span>
              <span className="text-[10px] text-muted-foreground">OHLCV Data</span>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-lg flex flex-col items-center justify-center">
              <BarChart3 className="w-5 h-5 text-yellow-400 mb-1" />
              <span className="text-xs font-medium">daily_features</span>
              <span className="text-[10px] text-muted-foreground">Technical Indicators</span>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-lg flex flex-col items-center justify-center">
              <Zap className="w-5 h-5 text-orange-400 mb-1" />
              <span className="text-xs font-medium">signal_facts</span>
              <span className="text-[10px] text-muted-foreground">Pattern Detection</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* AI Pipeline */}
      <div className="mb-8">
        <div className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">AI Analysis Pipeline</div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-lg flex flex-col items-center justify-center">
              <Target className="w-5 h-5 text-purple-400 mb-1" />
              <span className="text-xs font-medium">Asset Selection</span>
              <span className="text-[10px] text-muted-foreground">Top 500 by Volume</span>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-500/30 rounded-lg flex flex-col items-center justify-center">
              <FileJson className="w-5 h-5 text-pink-400 mb-1" />
              <span className="text-xs font-medium">Context Build</span>
              <span className="text-[10px] text-muted-foreground">365d OHLCV + Features</span>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          
          <div className="flex flex-col items-center">
            <div className="w-36 h-20 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-lg flex flex-col items-center justify-center">
              <Brain className="w-5 h-5 text-cyan-400 mb-1" />
              <span className="text-xs font-medium">Gemini 3 Pro</span>
              <span className="text-[10px] text-muted-foreground">10 Concurrent Calls</span>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-lg flex flex-col items-center justify-center">
              <Database className="w-5 h-5 text-emerald-400 mb-1" />
              <span className="text-xs font-medium">ai_reviews</span>
              <span className="text-[10px] text-muted-foreground">Stored Results</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Dashboard */}
      <div>
        <div className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Dashboard Display</div>
        <div className="flex items-center justify-center gap-2">
          <div className="flex flex-col items-center">
            <div className="w-32 h-20 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 rounded-lg flex flex-col items-center justify-center">
              <Server className="w-5 h-5 text-indigo-400 mb-1" />
              <span className="text-xs font-medium">Edge Function</span>
              <span className="text-[10px] text-muted-foreground">API Endpoint</span>
            </div>
          </div>
          
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
          
          <div className="flex flex-col items-center">
            <div className="w-40 h-20 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 rounded-lg flex flex-col items-center justify-center">
              <Activity className="w-5 h-5 text-primary mb-1" />
              <span className="text-xs font-medium">Stratos Dashboard</span>
              <span className="text-[10px] text-muted-foreground">Table + Detail Modal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Documentation() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/" className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              STRATOS<span className="text-muted-foreground font-normal">BRAIN</span>
            </a>
            <div className="h-4 w-px bg-border" />
            <span className="text-sm text-muted-foreground">Documentation</span>
          </div>
          <a 
            href="/"
            className="px-4 py-1.5 text-sm font-medium rounded-md bg-muted/50 hover:bg-muted transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Analysis System</h1>
          <p className="text-muted-foreground">
            Technical documentation for the Stratos Brain AI-powered trading signal system.
          </p>
        </div>

        {/* Flow Diagram */}
        <div className="mb-8">
          <FlowDiagram />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {/* System Prompt */}
          <CollapsibleSection 
            title="System Prompt (v3.0)" 
            icon={<Brain className="w-4 h-4 text-cyan-400" />}
            defaultOpen={true}
          >
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="text-xs font-mono text-yellow-400 mb-2">[CRITICAL INDEPENDENCE MANDATE]</div>
                <p className="text-sm text-muted-foreground mb-3">
                  The prompt is designed to <strong className="text-foreground">decouple direction from quality</strong> - 
                  a key improvement to prevent the AI from conflating "bullish = good setup":
                </p>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>A <strong className="text-red-400">BEARISH</strong> asset with a clean breakdown pattern MUST have <strong className="text-green-400">HIGH quality (80+)</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>A <strong className="text-green-400">BULLISH</strong> asset with a messy chart MUST have <strong className="text-red-400">LOW quality (&lt;50)</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span>Quality measures <strong className="text-foreground">STRUCTURAL CLARITY</strong>, not directional conviction</span>
                  </li>
                </ul>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-green-500/10 to-transparent rounded-lg border border-green-500/20">
                  <div className="text-sm font-semibold text-green-400 mb-2">Task 1: Direction</div>
                  <p className="text-xs text-muted-foreground">
                    Evaluate probability and magnitude of price movement. Score from -100 (max bearish) to +100 (max bullish).
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-transparent rounded-lg border border-blue-500/20">
                  <div className="text-sm font-semibold text-blue-400 mb-2">Task 2: Quality</div>
                  <p className="text-xs text-muted-foreground">
                    Evaluate structural integrity and tradability. INDEPENDENT of direction. Score from 0 to 100.
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Context Data */}
          <CollapsibleSection 
            title="Context Data Provided to AI" 
            icon={<Database className="w-4 h-4 text-green-400" />}
          >
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">1. OHLCV Data (365 days, last 60 shown)</h4>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {['Date', 'Open', 'High', 'Low', 'Close', 'Volume'].map(col => (
                    <div key={col} className="p-2 bg-muted/30 rounded text-center font-mono">{col}</div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold mb-2">2. Technical Indicators</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {[
                    { name: 'SMA 20/50/200', desc: 'Moving Averages' },
                    { name: 'RSI 14', desc: 'Momentum' },
                    { name: 'MACD', desc: 'Trend Strength' },
                    { name: 'Bollinger Bands', desc: 'Volatility' },
                    { name: 'ATR 14', desc: 'True Range' },
                    { name: 'Returns', desc: '1d/5d/21d' },
                    { name: 'MA Distance', desc: '% from MAs' },
                    { name: 'RVOL', desc: 'Relative Volume' },
                  ].map(ind => (
                    <div key={ind.name} className="p-2 bg-muted/30 rounded">
                      <div className="font-mono text-foreground">{ind.name}</div>
                      <div className="text-muted-foreground">{ind.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Output Schema */}
          <CollapsibleSection 
            title="Output Schema" 
            icon={<FileJson className="w-4 h-4 text-pink-400" />}
          >
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Core Assessment</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium">Field</th>
                        <th className="text-left py-2 px-3 font-medium">Type</th>
                        <th className="text-left py-2 px-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-foreground">direction</td>
                        <td className="py-2 px-3">string</td>
                        <td className="py-2 px-3">bullish / bearish / neutral</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-foreground">ai_direction_score</td>
                        <td className="py-2 px-3">int</td>
                        <td className="py-2 px-3">-100 to +100 (conviction)</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-foreground">ai_setup_quality_score</td>
                        <td className="py-2 px-3">int</td>
                        <td className="py-2 px-3">0 to 100 (structural quality)</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-foreground">setup_type</td>
                        <td className="py-2 px-3">string</td>
                        <td className="py-2 px-3">breakout / reversal / continuation / range</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-foreground">attention_level</td>
                        <td className="py-2 px-3">string</td>
                        <td className="py-2 px-3">URGENT / FOCUS / WATCH / IGNORE</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold mb-2">Trade Plan</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="font-mono text-green-400">entry_zone</div>
                    <div className="text-muted-foreground">{'{low, high}'}</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="font-mono text-blue-400">targets</div>
                    <div className="text-muted-foreground">[TP1, TP2, TP3]</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="font-mono text-yellow-400">support</div>
                    <div className="text-muted-foreground">[S1, S2]</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <div className="font-mono text-red-400">invalidation</div>
                    <div className="text-muted-foreground">Stop-loss level</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold mb-2">Quality Subscores (1-5 each)</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                  {[
                    { name: 'Boundary Definition', desc: 'S/R precision' },
                    { name: 'Structural Compliance', desc: 'Textbook patterns' },
                    { name: 'Volatility Profile', desc: 'Clean vs choppy' },
                    { name: 'Volume Coherence', desc: 'Volume confirms' },
                    { name: 'Risk/Reward Clarity', desc: 'Stop placement' },
                  ].map(sub => (
                    <div key={sub.name} className="p-2 bg-muted/30 rounded text-center">
                      <div className="font-medium text-foreground">{sub.name}</div>
                      <div className="text-muted-foreground">{sub.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Attention Levels */}
          <CollapsibleSection 
            title="Attention Level Criteria" 
            icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
          >
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-gradient-to-r from-red-500/20 to-transparent rounded-lg border border-red-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded">URGENT</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  High conviction setup with immediate catalyst. Quality &gt; 80, strong direction score.
                </p>
              </div>
              <div className="p-3 bg-gradient-to-r from-yellow-500/20 to-transparent rounded-lg border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded">FOCUS</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Good setup worth monitoring closely. Quality &gt; 60, clear direction.
                </p>
              </div>
              <div className="p-3 bg-gradient-to-r from-blue-500/20 to-transparent rounded-lg border border-blue-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded">WATCH</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Developing setup, not yet actionable. Quality 40-60 or unclear direction.
                </p>
              </div>
              <div className="p-3 bg-gradient-to-r from-gray-500/20 to-transparent rounded-lg border border-gray-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs font-bold rounded">IGNORE</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Poor setup or no clear edge. Quality &lt; 40 or conflicting signals.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Model Configuration */}
          <CollapsibleSection 
            title="Model Configuration" 
            icon={<Cpu className="w-4 h-4 text-purple-400" />}
          >
            <div className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium">Parameter</th>
                      <th className="text-left py-2 px-3 font-medium">Value</th>
                      <th className="text-left py-2 px-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-foreground">Model</td>
                      <td className="py-2 px-3 text-cyan-400">gemini-3-pro-preview</td>
                      <td className="py-2 px-3">Latest Gemini Pro model</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-foreground">Temperature</td>
                      <td className="py-2 px-3 text-cyan-400">0.1</td>
                      <td className="py-2 px-3">Low for consistent outputs</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-foreground">Max Tokens</td>
                      <td className="py-2 px-3 text-cyan-400">8192</td>
                      <td className="py-2 px-3">Sufficient for detailed analysis</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-foreground">Response Format</td>
                      <td className="py-2 px-3 text-cyan-400">JSON</td>
                      <td className="py-2 px-3">Structured output</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-foreground">Concurrency</td>
                      <td className="py-2 px-3 text-cyan-400">10</td>
                      <td className="py-2 px-3">Parallel API calls</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-foreground">Rate Limit</td>
                      <td className="py-2 px-3 text-cyan-400">~3s</td>
                      <td className="py-2 px-3">Between calls to avoid throttling</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CollapsibleSection>

          {/* Version History */}
          <CollapsibleSection 
            title="Version History" 
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          >
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-bold rounded">v3.0</span>
                <div>
                  <div className="text-sm font-medium">Current - Decoupled Scoring</div>
                  <p className="text-xs text-muted-foreground">
                    Direction and quality scores are now independent. Quality measures structural clarity, not directional conviction.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg opacity-70">
                <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-bold rounded">v2.0</span>
                <div>
                  <div className="text-sm font-medium">Quality Subscores</div>
                  <p className="text-xs text-muted-foreground">
                    Added 5 quality subscores for more granular assessment.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg opacity-50">
                <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-bold rounded">v1.0</span>
                <div>
                  <div className="text-sm font-medium">Initial Implementation</div>
                  <p className="text-xs text-muted-foreground">
                    Basic scoring with direction and quality (correlated).
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </main>
    </div>
  );
}

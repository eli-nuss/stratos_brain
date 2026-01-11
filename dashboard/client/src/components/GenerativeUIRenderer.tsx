import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Types corresponding to the Gemini Tool Definition
interface GenerativeUIToolCall {
  componentType: 'FinancialChart' | 'MetricCard' | 'RiskGauge' | 'DataTable' | 'ComparisonChart';
  title: string;
  data: any;
  insight?: string;
}

// Color palette for charts
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const GenerativeUIRenderer = ({ toolCall }: { toolCall: GenerativeUIToolCall }) => {
  const { componentType, title, data, insight } = toolCall;

  // Insight box component (reused across all types)
  const InsightBox = ({ text }: { text: string }) => (
    <div className="mt-3 p-2 bg-blue-950/30 border border-blue-900/50 rounded text-xs text-blue-200">
      <span className="font-semibold">💡 Analyst Note:</span> {text}
    </div>
  );

  // 1. FINANCIAL CHART RENDERER (Line or Bar)
  if (componentType === 'FinancialChart') {
    const chartType = data.type || 'bar';
    const isLine = chartType === 'line';
    const points = data.points || [];
    const metric = data.metric || 'Value';
    
    // Determine if values are currency
    const isCurrency = points.some((p: any) => 
      typeof p.value === 'number' && (p.value > 1000 || metric.toLowerCase().includes('revenue') || metric.toLowerCase().includes('price'))
    );
    
    const formatValue = (value: number) => {
      if (isCurrency) {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
        return `$${value.toFixed(2)}`;
      }
      return value.toFixed(1);
    };

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {isLine ? (
                <LineChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={formatValue}
                    width={70}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(value: number) => [formatValue(value), metric]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    name={metric}
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={formatValue}
                    width={70}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                    itemStyle={{ color: '#f8fafc' }}
                    formatter={(value: number) => [formatValue(value), metric]}
                  />
                  <Legend />
                  <Bar 
                    dataKey="value" 
                    name={metric}
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // 2. METRIC CARD RENDERER (Key Stats Grid)
  if (componentType === 'MetricCard') {
    const metrics = data.metrics || [];
    
    const getTrendIcon = (trend: number) => {
      if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
      if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
      return <Minus className="w-4 h-4 text-slate-400" />;
    };

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {metrics.map((m: any, idx: number) => (
              <div key={idx} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">{m.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{m.value}</p>
                {m.trend !== undefined && (
                  <div className={`flex items-center gap-1 text-xs mt-1 ${m.trend > 0 ? 'text-green-400' : m.trend < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {getTrendIcon(m.trend)}
                    <span>{m.trend > 0 ? '+' : ''}{m.trend}% vs prior</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // 3. RISK GAUGE RENDERER
  if (componentType === 'RiskGauge') {
    const riskLevel = data.level || 'medium'; // low, medium, high, critical
    const riskScore = data.score || 50; // 0-100
    const factors = data.factors || [];
    
    const getRiskColor = (level: string) => {
      switch (level.toLowerCase()) {
        case 'low': return 'text-green-400 bg-green-950/30 border-green-900/50';
        case 'medium': return 'text-yellow-400 bg-yellow-950/30 border-yellow-900/50';
        case 'high': return 'text-orange-400 bg-orange-950/30 border-orange-900/50';
        case 'critical': return 'text-red-400 bg-red-950/30 border-red-900/50';
        default: return 'text-slate-400 bg-slate-950/30 border-slate-900/50';
      }
    };

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-4">
            <div className={`text-4xl font-bold px-4 py-2 rounded-lg border ${getRiskColor(riskLevel)}`}>
              {riskLevel.toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm text-slate-400 mb-1">Risk Score: {riskScore}/100</div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${riskScore > 75 ? 'bg-red-500' : riskScore > 50 ? 'bg-orange-500' : riskScore > 25 ? 'bg-yellow-500' : 'bg-green-500'}`}
                  style={{ width: `${riskScore}%` }}
                />
              </div>
            </div>
          </div>
          {factors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 uppercase font-semibold">Key Risk Factors:</p>
              <ul className="space-y-1">
                {factors.map((f: string, idx: number) => (
                  <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // 4. DATA TABLE RENDERER
  if (componentType === 'DataTable') {
    const headers = data.headers || [];
    const rows = data.rows || [];

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  {headers.map((header: string, idx: number) => (
                    <TableHead key={idx} className="text-slate-400 font-semibold">
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: string[], rowIdx: number) => (
                  <TableRow key={rowIdx} className="border-slate-700 hover:bg-slate-800/50">
                    {row.map((cell: string, cellIdx: number) => (
                      <TableCell key={cellIdx} className="text-slate-300">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // 5. COMPARISON CHART RENDERER (Pie/Donut or Horizontal Bar)
  if (componentType === 'ComparisonChart') {
    const items = data.items || [];
    const chartStyle = data.style || 'pie'; // pie, bar
    
    // Add colors if not provided
    const itemsWithColors = items.map((item: any, idx: number) => ({
      ...item,
      color: item.color || CHART_COLORS[idx % CHART_COLORS.length]
    }));

    const total = itemsWithColors.reduce((sum: number, item: any) => sum + item.value, 0);

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-[200px] w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={itemsWithColors}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {itemsWithColors.map((item: any, idx: number) => (
                      <Cell key={idx} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                    formatter={(value: number, name: string) => [`${((value / total) * 100).toFixed(1)}%`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {itemsWithColors.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-slate-300">{item.name}</span>
                  </div>
                  <div className="text-sm font-medium text-white">
                    {typeof item.value === 'number' && item.value > 100 
                      ? `$${(item.value / 1e9).toFixed(1)}B` 
                      : `${item.value}%`
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // Fallback for unknown component types
  return (
    <Card className="w-full my-4 border-red-700 bg-red-950/20">
      <CardContent className="pt-6">
        <div className="text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>Unknown Component Type: {componentType}</span>
        </div>
        <pre className="mt-2 text-xs text-slate-400 overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
};

export default GenerativeUIRenderer;

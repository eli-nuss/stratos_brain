import React from 'react';
import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ScatterChart, Scatter, ZAxis, Treemap, ReferenceLine
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Calculator, RefreshCw, Grid3X3, CandlestickChart as CandlestickIcon, LayoutGrid, ScatterChart as ScatterIcon } from 'lucide-react';

// Types corresponding to the Gemini Tool Definition
interface GenerativeUIToolCall {
  componentType: 'FinancialChart' | 'MetricCard' | 'RiskGauge' | 'DataTable' | 'ComparisonChart' | 'InteractiveModel' | 'CorrelationHeatmap' | 'CandlestickChart' | 'TreeMap' | 'ScatterPlot';
  title: string;
  data: any;
  insight?: string;
}

// Interactive Model variable type
interface InteractiveVariable {
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;  // e.g., '%', '$', 'x'
}

// Interactive Model data structure
interface InteractiveModelData {
  modelType: 'dcf' | 'scenario' | 'sensitivity' | 'custom';
  variables: InteractiveVariable[];
  formula?: string;  // Optional formula description
  baseValue?: number;  // Starting value for calculations
  outputs?: { name: string; label: string; formula: string }[];  // Multiple output calculations
}

// Correlation Heatmap data structure
interface CorrelationHeatmapData {
  assets: string[];  // Asset names/tickers
  matrix: number[][];  // Correlation matrix (values -1 to 1)
  period?: string;  // e.g., "1Y", "3M"
}

// Candlestick data structure
interface CandlestickData {
  candles: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }[];
  ticker?: string;
}

// TreeMap data structure
interface TreeMapData {
  items: {
    name: string;
    value: number;
    category?: string;
    change?: number;  // Percentage change for coloring
  }[];
  valueLabel?: string;  // e.g., "Market Cap", "Weight"
}

// ScatterPlot data structure
interface ScatterPlotData {
  points: {
    name: string;
    x: number;
    y: number;
    size?: number;  // Optional bubble size
    category?: string;
  }[];
  xLabel: string;
  yLabel: string;
  xUnit?: string;  // e.g., "%", "$"
  yUnit?: string;
}

// Color palette for charts
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// Correlation color scale (red for negative, white for zero, green for positive)
const getCorrelationColor = (value: number): string => {
  if (value >= 0) {
    const intensity = Math.min(value, 1);
    const green = Math.round(34 + intensity * (187 - 34));
    const red = Math.round(34 + (1 - intensity) * (148 - 34));
    return `rgb(${red}, ${green}, 102)`;
  } else {
    const intensity = Math.min(Math.abs(value), 1);
    const red = Math.round(34 + intensity * (239 - 34));
    const green = Math.round(34 + (1 - intensity) * (148 - 34));
    return `rgb(${red}, ${green}, 68)`;
  }
};

// TreeMap change color (red for negative, green for positive)
const getChangeColor = (change: number | undefined): string => {
  if (change === undefined) return '#3b82f6';
  if (change > 5) return '#10b981';
  if (change > 0) return '#34d399';
  if (change > -5) return '#f87171';
  return '#ef4444';
};

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

  // 6. INTERACTIVE MODEL RENDERER (DCF, Scenario, Sensitivity Analysis)
  if (componentType === 'InteractiveModel') {
    return <InteractiveModelComponent title={title} data={data as InteractiveModelData} insight={insight} />;
  }

  // 7. CORRELATION HEATMAP RENDERER (NEW)
  if (componentType === 'CorrelationHeatmap') {
    const heatmapData = data as CorrelationHeatmapData;
    const assets = heatmapData.assets || [];
    const matrix = heatmapData.matrix || [];
    const period = heatmapData.period || '1Y';

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Grid3X3 className="w-4 h-4" />
            {title}
            <span className="text-xs text-slate-500 ml-2">({period})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header row */}
              <div className="flex">
                <div className="w-20 h-10 flex items-center justify-center text-xs text-slate-500"></div>
                {assets.map((asset, idx) => (
                  <div key={idx} className="w-16 h-10 flex items-center justify-center text-xs text-slate-400 font-medium">
                    {asset}
                  </div>
                ))}
              </div>
              {/* Matrix rows */}
              {matrix.map((row, rowIdx) => (
                <div key={rowIdx} className="flex">
                  <div className="w-20 h-12 flex items-center justify-start text-xs text-slate-400 font-medium pl-2">
                    {assets[rowIdx]}
                  </div>
                  {row.map((value, colIdx) => (
                    <div
                      key={colIdx}
                      className="w-16 h-12 flex items-center justify-center text-xs font-medium border border-slate-800 rounded-sm m-0.5 transition-all hover:scale-105 cursor-default"
                      style={{ 
                        backgroundColor: getCorrelationColor(value),
                        color: Math.abs(value) > 0.5 ? '#fff' : '#94a3b8'
                      }}
                      title={`${assets[rowIdx]} vs ${assets[colIdx]}: ${value.toFixed(2)}`}
                    >
                      {value.toFixed(2)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getCorrelationColor(-1) }}></div>
              <span>-1 (Negative)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getCorrelationColor(0) }}></div>
              <span>0 (None)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getCorrelationColor(1) }}></div>
              <span>+1 (Positive)</span>
            </div>
          </div>
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // 8. CANDLESTICK CHART RENDERER (NEW)
  if (componentType === 'CandlestickChart') {
    const candleData = data as CandlestickData;
    const candles = candleData.candles || [];
    const ticker = candleData.ticker || '';

    // Custom candlestick shape
    const CandlestickShape = (props: any) => {
      const { x, y, width, payload } = props;
      const { open, high, low, close } = payload;
      
      const isGreen = close >= open;
      const color = isGreen ? '#10b981' : '#ef4444';
      
      // Calculate positions (inverted because Y axis is inverted in SVG)
      const yScale = props.yScale || ((v: number) => v);
      const candleWidth = Math.max(width * 0.8, 4);
      const wickWidth = 1;
      
      const bodyTop = yScale(Math.max(open, close));
      const bodyBottom = yScale(Math.min(open, close));
      const bodyHeight = Math.max(Math.abs(bodyBottom - bodyTop), 1);
      
      const wickTop = yScale(high);
      const wickBottom = yScale(low);

      return (
        <g>
          {/* Wick (high-low line) */}
          <line
            x1={x + candleWidth / 2}
            y1={wickTop}
            x2={x + candleWidth / 2}
            y2={wickBottom}
            stroke={color}
            strokeWidth={wickWidth}
          />
          {/* Body */}
          <rect
            x={x}
            y={bodyTop}
            width={candleWidth}
            height={bodyHeight}
            fill={isGreen ? color : color}
            stroke={color}
            strokeWidth={1}
          />
        </g>
      );
    };

    // Prepare data for the chart
    const chartData = candles.map((c, idx) => ({
      ...c,
      idx,
      range: [c.low, c.high],
    }));

    const minPrice = Math.min(...candles.map(c => c.low)) * 0.99;
    const maxPrice = Math.max(...candles.map(c => c.high)) * 1.01;

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <CandlestickIcon className="w-4 h-4" />
            {title}
            {ticker && <span className="text-xs text-blue-400 ml-2">{ticker}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={0}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  domain={[minPrice, maxPrice]}
                  tickFormatter={(v) => `$${v.toFixed(0)}`}
                  width={60}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const isGreen = d.close >= d.open;
                      return (
                        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs">
                          <div className="font-medium text-slate-300 mb-2">{d.date}</div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-slate-400">Open:</span>
                            <span className="text-white">${d.open.toFixed(2)}</span>
                            <span className="text-slate-400">High:</span>
                            <span className="text-white">${d.high.toFixed(2)}</span>
                            <span className="text-slate-400">Low:</span>
                            <span className="text-white">${d.low.toFixed(2)}</span>
                            <span className="text-slate-400">Close:</span>
                            <span className={isGreen ? 'text-green-400' : 'text-red-400'}>${d.close.toFixed(2)}</span>
                            {d.volume && (
                              <>
                                <span className="text-slate-400">Volume:</span>
                                <span className="text-white">{(d.volume / 1e6).toFixed(1)}M</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Render candlesticks as custom bars */}
                <Bar 
                  dataKey="high"
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const { open, high, low, close } = payload;
                    const isGreen = close >= open;
                    const color = isGreen ? '#10b981' : '#ef4444';
                    
                    // Calculate Y positions
                    const chartHeight = 260; // Approximate chart area height
                    const priceRange = maxPrice - minPrice;
                    const yScale = (price: number) => ((maxPrice - price) / priceRange) * chartHeight + 30;
                    
                    const candleWidth = Math.max(width * 0.6, 3);
                    const xCenter = x + width / 2;
                    
                    const bodyTop = yScale(Math.max(open, close));
                    const bodyBottom = yScale(Math.min(open, close));
                    const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

                    return (
                      <g>
                        {/* Wick */}
                        <line
                          x1={xCenter}
                          y1={yScale(high)}
                          x2={xCenter}
                          y2={yScale(low)}
                          stroke={color}
                          strokeWidth={1}
                        />
                        {/* Body */}
                        <rect
                          x={xCenter - candleWidth / 2}
                          y={bodyTop}
                          width={candleWidth}
                          height={bodyHeight}
                          fill={color}
                          stroke={color}
                        />
                      </g>
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // 9. TREEMAP RENDERER (NEW)
  if (componentType === 'TreeMap') {
    const treeData = data as TreeMapData;
    const items = treeData.items || [];
    const valueLabel = treeData.valueLabel || 'Value';

    // Prepare data for Recharts Treemap
    const treemapData = items.map((item, idx) => ({
      name: item.name,
      size: Math.abs(item.value),
      value: item.value,
      change: item.change,
      category: item.category,
      fill: getChangeColor(item.change),
    }));

    // Custom content renderer for treemap cells
    const CustomTreemapContent = (props: any) => {
      const { x, y, width, height, name, value, change } = props;
      
      if (width < 40 || height < 30) return null;
      
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={getChangeColor(change)}
            stroke="#1e293b"
            strokeWidth={2}
            rx={4}
          />
          <text
            x={x + width / 2}
            y={y + height / 2 - 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={width > 80 ? 12 : 10}
            fontWeight="bold"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 8}
            textAnchor="middle"
            fill="#fff"
            fontSize={width > 80 ? 11 : 9}
            opacity={0.8}
          >
            {value >= 1e9 ? `$${(value / 1e9).toFixed(1)}B` : 
             value >= 1e6 ? `$${(value / 1e6).toFixed(1)}M` : 
             `$${value.toFixed(0)}`}
          </text>
          {change !== undefined && width > 60 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 22}
              textAnchor="middle"
              fill={change >= 0 ? '#86efac' : '#fca5a5'}
              fontSize={9}
            >
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </text>
          )}
        </g>
      );
    };

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#1e293b"
                content={<CustomTreemapContent />}
              />
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
              <span>&gt;5% gain</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#34d399' }}></div>
              <span>0-5% gain</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f87171' }}></div>
              <span>0-5% loss</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
              <span>&gt;5% loss</span>
            </div>
          </div>
          {insight && <InsightBox text={insight} />}
        </CardContent>
      </Card>
    );
  }

  // 10. SCATTER PLOT RENDERER (NEW)
  if (componentType === 'ScatterPlot') {
    const scatterData = data as ScatterPlotData;
    const points = scatterData.points || [];
    const xLabel = scatterData.xLabel || 'X';
    const yLabel = scatterData.yLabel || 'Y';
    const xUnit = scatterData.xUnit || '';
    const yUnit = scatterData.yUnit || '';

    // Group by category for coloring
    const categories = [...new Set(points.map(p => p.category || 'default'))];
    const categoryColors: Record<string, string> = {};
    categories.forEach((cat, idx) => {
      categoryColors[cat] = CHART_COLORS[idx % CHART_COLORS.length];
    });

    // Prepare data with colors
    const chartData = points.map(p => ({
      ...p,
      z: p.size || 100,
      fill: categoryColors[p.category || 'default'],
    }));

    // Calculate axis domains with padding
    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xPadding = (xMax - xMin) * 0.1;
    const yPadding = (yMax - yMin) * 0.1;

    return (
      <Card className="w-full my-4 border-slate-700 bg-slate-900/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <ScatterIcon className="w-4 h-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name={xLabel}
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                  domain={[xMin - xPadding, xMax + xPadding]}
                  tickFormatter={(v) => `${v.toFixed(1)}${xUnit}`}
                  label={{ 
                    value: xLabel, 
                    position: 'bottom', 
                    offset: 40,
                    fill: '#94a3b8',
                    fontSize: 12
                  }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name={yLabel}
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickLine={false}
                  domain={[yMin - yPadding, yMax + yPadding]}
                  tickFormatter={(v) => `${v.toFixed(1)}${yUnit}`}
                  label={{ 
                    value: yLabel, 
                    angle: -90, 
                    position: 'left',
                    offset: 40,
                    fill: '#94a3b8',
                    fontSize: 12
                  }}
                />
                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                {/* Reference lines at 0 if applicable */}
                {xMin < 0 && xMax > 0 && (
                  <ReferenceLine x={0} stroke="#475569" strokeDasharray="3 3" />
                )}
                {yMin < 0 && yMax > 0 && (
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                )}
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs">
                          <div className="font-medium text-white mb-2">{d.name}</div>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">{xLabel}:</span>
                              <span className="text-white">{d.x.toFixed(2)}{xUnit}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">{yLabel}:</span>
                              <span className="text-white">{d.y.toFixed(2)}{yUnit}</span>
                            </div>
                            {d.category && (
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-400">Category:</span>
                                <span className="text-white">{d.category}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  data={chartData} 
                  fill="#3b82f6"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    const size = Math.sqrt(payload.z || 100) / 2;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={size}
                        fill={payload.fill}
                        fillOpacity={0.7}
                        stroke={payload.fill}
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {/* Category Legend */}
          {categories.length > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-slate-400">
              {categories.map((cat, idx) => (
                <div key={cat} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: categoryColors[cat] }}
                  ></div>
                  <span>{cat}</span>
                </div>
              ))}
            </div>
          )}
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

// Separate component for InteractiveModel to use hooks properly
const InteractiveModelComponent = ({ 
  title, 
  data, 
  insight 
}: { 
  title: string; 
  data: InteractiveModelData; 
  insight?: string 
}) => {
  // Initialize local state with the variable values
  const initialVars = useMemo(() => {
    const vars: Record<string, number> = {};
    (data.variables || []).forEach(v => {
      vars[v.name] = v.value;
    });
    return vars;
  }, [data.variables]);

  const [localVars, setLocalVars] = useState<Record<string, number>>(initialVars);

  // Calculate outputs based on current variable values
  const calculateOutputs = useMemo(() => {
    const outputs: Record<string, number> = {};
    
    // Default DCF calculation if no custom outputs provided
    if (data.modelType === 'dcf' && !data.outputs) {
      const fcf = localVars['fcf'] || 1000;
      const growth = (localVars['growth'] || 10) / 100;
      const discount = (localVars['discount'] || 10) / 100;
      const terminal = (localVars['terminal_growth'] || 2) / 100;
      const years = localVars['years'] || 5;
      
      // Simple DCF calculation
      let pvFcf = 0;
      let currentFcf = fcf;
      for (let i = 1; i <= years; i++) {
        currentFcf *= (1 + growth);
        pvFcf += currentFcf / Math.pow(1 + discount, i);
      }
      
      // Terminal value
      const terminalFcf = currentFcf * (1 + terminal);
      const terminalValue = terminalFcf / (discount - terminal);
      const pvTerminal = terminalValue / Math.pow(1 + discount, years);
      
      outputs['enterprise_value'] = pvFcf + pvTerminal;
      outputs['implied_price'] = outputs['enterprise_value'] / (localVars['shares'] || 100);
      
      if (data.baseValue) {
        outputs['upside'] = ((outputs['implied_price'] - data.baseValue) / data.baseValue) * 100;
      }
    } else if (data.outputs) {
      // Custom output calculations using eval (simplified - in production use a safer parser)
      data.outputs.forEach(output => {
        try {
          // Replace variable names with values in formula
          let formula = output.formula;
          Object.entries(localVars).forEach(([name, value]) => {
            formula = formula.replace(new RegExp(name, 'g'), value.toString());
          });
          outputs[output.name] = eval(formula);
        } catch (e) {
          outputs[output.name] = 0;
        }
      });
    }
    
    return outputs;
  }, [localVars, data]);

  const handleReset = () => {
    setLocalVars(initialVars);
  };

  const formatValue = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const modelTypeLabels: Record<string, string> = {
    dcf: 'DCF Model',
    scenario: 'Scenario Analysis',
    sensitivity: 'Sensitivity Analysis',
    custom: 'Custom Model'
  };

  return (
    <Card className="w-full my-4 border-purple-700/50 bg-slate-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded">
              {modelTypeLabels[data.modelType] || 'Interactive'}
            </span>
            <button
              onClick={handleReset}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="Reset to initial values"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Variable Sliders */}
        <div className="space-y-4 mb-6">
          {(data.variables || []).map((variable) => (
            <div key={variable.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-slate-400">{variable.label}</Label>
                <span className="text-sm font-medium text-white">
                  {variable.unit === '%' ? `${localVars[variable.name]?.toFixed(1)}%` :
                   variable.unit === '$' ? formatValue(localVars[variable.name] || 0) :
                   variable.unit === 'x' ? `${localVars[variable.name]?.toFixed(1)}x` :
                   localVars[variable.name]?.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[localVars[variable.name] || variable.value]}
                min={variable.min}
                max={variable.max}
                step={variable.step}
                onValueChange={(val) => setLocalVars({ ...localVars, [variable.name]: val[0] })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{variable.unit === '%' ? `${variable.min}%` : variable.min}</span>
                <span>{variable.unit === '%' ? `${variable.max}%` : variable.max}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Output Values */}
        <div className="border-t border-slate-700 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(calculateOutputs).map(([key, value]) => (
              <div key={key} className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className={`text-xl font-bold ${
                  key.includes('upside') 
                    ? value > 0 ? 'text-green-400' : 'text-red-400'
                    : 'text-white'
                }`}>
                  {key.includes('upside') || key.includes('rate') || key.includes('growth')
                    ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
                    : formatValue(value)
                  }
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Formula description if provided */}
        {data.formula && (
          <div className="mt-4 p-2 bg-slate-800/30 rounded text-xs text-slate-400">
            <span className="font-semibold">Formula:</span> {data.formula}
          </div>
        )}

        {/* Insight */}
        {insight && (
          <div className="mt-3 p-2 bg-blue-950/30 border border-blue-900/50 rounded text-xs text-blue-200">
            <span className="font-semibold">💡 Analyst Note:</span> {insight}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GenerativeUIRenderer;

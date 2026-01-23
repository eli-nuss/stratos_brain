// ============ DIAGRAM TYPES ============

export type LayoutType = 'treemap' | 'hierarchy' | 'waterfall' | 'sankey' | 'comparison' | 'timeline';
export type ThemeMode = 'dark' | 'light';
export type ColorScheme = 'excalidraw' | 'vibrant' | 'pastel' | 'monochrome';

export interface DiagramNodeMetrics {
  yield?: number;
  growth?: number;
  peRatio?: number;
  marketCap?: number;
  roe?: string | number;
  [key: string]: string | number | undefined;
}

export interface DiagramNode {
  id: string;
  label: string;
  value?: number;
  valueLabel?: string;
  percentage?: number;
  category?: 'revenue' | 'cost' | 'asset' | 'metric' | 'risk' | 'neutral' | string;
  parentId?: string;
  children?: string[];
  color?: string;
  details?: string;
  metrics?: DiagramNodeMetrics;
  date?: string; // For timeline layouts
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  value?: number;
}

export interface DiagramMetric {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DiagramData {
  layoutType: LayoutType;
  title: string;
  subtitle?: string;
  totalValue?: number;
  totalLabel?: string;
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  metrics?: DiagramMetric[];
}

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ThemeStyles {
  bg: string;
  text: string;
  border: string;
  panel: string;
  muted: string;
}

export interface NodeColors {
  bg: string;
  border: string;
  text: string;
  hover?: string;
}

export interface RendererProps {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  canvasWidth: number;
  canvasHeight: number;
  theme: ThemeStyles;
  colorScheme: ColorScheme;
  hoveredNode: string | null;
  onNodeHover: (nodeId: string | null) => void;
  getNodeColor: (node: DiagramNode, index: number) => NodeColors;
}

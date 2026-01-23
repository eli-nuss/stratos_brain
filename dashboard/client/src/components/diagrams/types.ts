// ============ FLEXIBLE DIAGRAM SYSTEM ============
// Gemini has full control over structure - frontend renders generic elements

export type ThemeMode = 'dark' | 'light';
export type ColorScheme = 'excalidraw' | 'vibrant' | 'pastel' | 'monochrome';

// ============ THOUGHT PROCESS ============
export interface ThoughtProcess {
  user_intent: string;
  data_analysis: string;
  visualization_strategy: string;
  reasoning: string;
}

// ============ CANVAS CONFIGURATION ============
export interface CanvasConfig {
  title: string;
  subtitle?: string;
  width?: number;
  height?: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

// ============ GENERIC ELEMENT TYPES ============
// Gemini chooses which elements to use and how to combine them

export interface BaseElement {
  id: string;
  label: string;
  tooltip?: string;
  metadata?: Record<string, string | number | boolean>;
}

// Bar element - for waterfalls, comparisons, histograms, timelines
export interface BarElement extends BaseElement {
  type: 'bar';
  value: number;
  displayValue?: string;  // Formatted value like "$394B" or "25.5%"
  color?: string;
  category?: string;  // For grouping/coloring (e.g., "positive", "negative", "revenue")
  group?: string;  // For grouped bar charts
  order?: number;  // Explicit ordering
}

// Box element - for treemaps, cards, nodes in hierarchies
export interface BoxElement extends BaseElement {
  type: 'box';
  value?: number;
  displayValue?: string;
  percentage?: number;
  color?: string;
  category?: string;
  parentId?: string;  // For hierarchies
  size?: 'small' | 'medium' | 'large' | number;  // Relative or absolute size
  icon?: string;  // Optional icon name
  metrics?: Record<string, string | number>;  // Key-value pairs to display
}

// Flow element - for sankeys, flow diagrams
export interface FlowElement extends BaseElement {
  type: 'flow';
  value?: number;
  displayValue?: string;
  color?: string;
  column?: number;  // Which column/stage (0, 1, 2, etc.)
}

// Point element - for scatter plots, bubble charts
export interface PointElement extends BaseElement {
  type: 'point';
  x: number;
  y: number;
  size?: number;
  color?: string;
  category?: string;
}

// Line element - for line charts, trends
export interface LineElement extends BaseElement {
  type: 'line';
  points: Array<{ x: number | string; y: number; label?: string }>;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

// Text element - for annotations, callouts
export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  x?: number;
  y?: number;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  align?: 'left' | 'center' | 'right';
  style?: 'normal' | 'bold' | 'italic';
}

// Metric card element - for KPI displays
export interface MetricElement extends BaseElement {
  type: 'metric';
  value: string | number;
  displayValue?: string;
  change?: string;  // e.g., "+12.5%"
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
  icon?: string;
}

// Union type for all elements
export type DiagramElement = 
  | BarElement 
  | BoxElement 
  | FlowElement 
  | PointElement 
  | LineElement 
  | TextElement
  | MetricElement;

// ============ CONNECTIONS ============
export interface Connection {
  from: string;  // Element ID
  to: string;    // Element ID
  value?: number;
  displayValue?: string;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

// ============ AXES (Optional) ============
export interface Axis {
  show?: boolean;
  label?: string;
  min?: number;
  max?: number;
  format?: string;  // e.g., "$,.0f" or ",.1%"
}

export interface Axes {
  x?: Axis;
  y?: Axis;
}

// ============ LEGEND ============
export interface LegendItem {
  label: string;
  color: string;
}

export interface Legend {
  show?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  items?: LegendItem[];
}

// ============ LAYOUT HINTS ============
// Gemini can suggest how to arrange elements, but frontend decides final layout
export interface LayoutHints {
  arrangement?: 'horizontal' | 'vertical' | 'grid' | 'radial' | 'tree' | 'flow';
  spacing?: 'compact' | 'normal' | 'spacious';
  groupBy?: string;  // Field name to group elements by
  sortBy?: string;   // Field name to sort elements by
  sortOrder?: 'asc' | 'desc';
}

// ============ MAIN DIAGRAM SPEC ============
export interface DiagramSpec {
  thought_process: ThoughtProcess;
  canvas: CanvasConfig;
  elements: DiagramElement[];
  connections?: Connection[];
  axes?: Axes;
  legend?: Legend;
  layout?: LayoutHints;
}

// ============ LEGACY SUPPORT ============
// Keep these for backward compatibility during transition
export type LayoutType = 'treemap' | 'hierarchy' | 'waterfall' | 'sankey' | 'comparison' | 'timeline' | 'flexible';

export interface DiagramNodeMetrics {
  [key: string]: string | number | undefined;
}

export interface DiagramNode {
  id: string;
  label: string;
  value?: number;
  valueLabel?: string;
  percentage?: number;
  category?: string;
  parentId?: string;
  children?: string[];
  color?: string;
  details?: string;
  metrics?: DiagramNodeMetrics;
  date?: string;
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

// Legacy DiagramData - will be converted to DiagramSpec
export interface DiagramData {
  thought_process?: ThoughtProcess;
  layoutType?: LayoutType;
  title: string;
  subtitle?: string;
  totalValue?: number;
  totalLabel?: string;
  nodes?: DiagramNode[];
  connections?: DiagramConnection[];
  metrics?: DiagramMetric[];
  // New flexible format
  spec?: DiagramSpec;
}

// ============ RENDERER PROPS ============
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
  spec: DiagramSpec;
  canvasWidth: number;
  canvasHeight: number;
  theme: ThemeStyles;
  colorScheme: ColorScheme;
  hoveredElement: string | null;
  onElementHover: (elementId: string | null) => void;
}

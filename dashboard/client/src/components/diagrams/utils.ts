import rough from 'roughjs';
import type { RoughSVG } from 'roughjs/bin/svg';
import type { ColorScheme, NodeColors, ThemeStyles, DiagramNode } from './types';

// ============ EXCALIDRAW OPEN COLORS PALETTE ============
// Based on https://yeun.github.io/open-color/

export const openColors = {
  // Grays
  gray: ['#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#868e96', '#495057', '#343a40', '#212529'],
  // Colors (index 6 is the primary, 9 is darkest for strokes)
  red: ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a'],
  pink: ['#fff0f6', '#ffdeeb', '#fcc2d7', '#faa2c1', '#f783ac', '#f06595', '#e64980', '#d6336c', '#c2255c', '#a61e4d'],
  grape: ['#f8f0fc', '#f3d9fa', '#eebefa', '#e599f7', '#da77f2', '#cc5de8', '#be4bdb', '#ae3ec9', '#9c36b5', '#862e9c'],
  violet: ['#f3f0ff', '#e5dbff', '#d0bfff', '#b197fc', '#9775fa', '#845ef7', '#7950f2', '#7048e8', '#6741d9', '#5f3dc4'],
  indigo: ['#edf2ff', '#dbe4ff', '#bac8ff', '#91a7ff', '#748ffc', '#5c7cfa', '#4c6ef5', '#4263eb', '#3b5bdb', '#364fc7'],
  blue: ['#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc', '#4dabf7', '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab'],
  cyan: ['#e3fafc', '#c5f6fa', '#99e9f2', '#66d9e8', '#3bc9db', '#22b8cf', '#15aabf', '#1098ad', '#0c8599', '#0b7285'],
  teal: ['#e6fcf5', '#c3fae8', '#96f2d7', '#63e6be', '#38d9a9', '#20c997', '#12b886', '#0ca678', '#099268', '#087f5b'],
  green: ['#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057', '#37b24d', '#2f9e44', '#2b8a3e'],
  lime: ['#f4fce3', '#e9fac8', '#d8f5a2', '#c0eb75', '#a9e34b', '#94d82d', '#82c91e', '#74b816', '#66a80f', '#5c940d'],
  yellow: ['#fff9db', '#fff3bf', '#ffec99', '#ffe066', '#ffd43b', '#fcc419', '#fab005', '#f59f00', '#f08c00', '#e67700'],
  orange: ['#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d', '#ff922b', '#fd7e14', '#f76707', '#e8590c', '#d9480f'],
};

// Excalidraw primary colors
export const excalidrawPrimary = {
  violet: '#6965db',
  violetDarker: '#5b57d1',
  violetDarkest: '#4a47a3',
  violetLight: '#8b87e0',
};

// ============ COLOR SCHEMES ============

export const colorSchemes: Record<ColorScheme, Record<string, NodeColors>> = {
  excalidraw: {
    revenue: { bg: openColors.teal[1], border: openColors.teal[6], text: openColors.teal[9], hover: openColors.teal[2] },
    cost: { bg: openColors.red[1], border: openColors.red[6], text: openColors.red[9], hover: openColors.red[2] },
    asset: { bg: openColors.blue[1], border: openColors.blue[6], text: openColors.blue[9], hover: openColors.blue[2] },
    metric: { bg: openColors.violet[1], border: openColors.violet[6], text: openColors.violet[9], hover: openColors.violet[2] },
    risk: { bg: openColors.orange[1], border: openColors.orange[6], text: openColors.orange[9], hover: openColors.orange[2] },
    neutral: { bg: openColors.gray[1], border: openColors.gray[5], text: openColors.gray[8], hover: openColors.gray[2] },
    positive: { bg: openColors.green[1], border: openColors.green[6], text: openColors.green[9], hover: openColors.green[2] },
    negative: { bg: openColors.red[1], border: openColors.red[6], text: openColors.red[9], hover: openColors.red[2] },
  },
  vibrant: {
    revenue: { bg: openColors.teal[6], border: openColors.teal[8], text: '#ffffff', hover: openColors.teal[7] },
    cost: { bg: openColors.red[6], border: openColors.red[8], text: '#ffffff', hover: openColors.red[7] },
    asset: { bg: openColors.blue[6], border: openColors.blue[8], text: '#ffffff', hover: openColors.blue[7] },
    metric: { bg: openColors.violet[6], border: openColors.violet[8], text: '#ffffff', hover: openColors.violet[7] },
    risk: { bg: openColors.orange[6], border: openColors.orange[8], text: '#ffffff', hover: openColors.orange[7] },
    neutral: { bg: openColors.gray[6], border: openColors.gray[8], text: '#ffffff', hover: openColors.gray[7] },
    positive: { bg: openColors.green[6], border: openColors.green[8], text: '#ffffff', hover: openColors.green[7] },
    negative: { bg: openColors.red[6], border: openColors.red[8], text: '#ffffff', hover: openColors.red[7] },
  },
  pastel: {
    revenue: { bg: openColors.teal[2], border: openColors.teal[4], text: openColors.teal[9], hover: openColors.teal[3] },
    cost: { bg: openColors.red[2], border: openColors.red[4], text: openColors.red[9], hover: openColors.red[3] },
    asset: { bg: openColors.blue[2], border: openColors.blue[4], text: openColors.blue[9], hover: openColors.blue[3] },
    metric: { bg: openColors.violet[2], border: openColors.violet[4], text: openColors.violet[9], hover: openColors.violet[3] },
    risk: { bg: openColors.orange[2], border: openColors.orange[4], text: openColors.orange[9], hover: openColors.orange[3] },
    neutral: { bg: openColors.gray[2], border: openColors.gray[4], text: openColors.gray[8], hover: openColors.gray[3] },
    positive: { bg: openColors.green[2], border: openColors.green[4], text: openColors.green[9], hover: openColors.green[3] },
    negative: { bg: openColors.red[2], border: openColors.red[4], text: openColors.red[9], hover: openColors.red[3] },
  },
  monochrome: {
    revenue: { bg: openColors.gray[2], border: openColors.gray[5], text: openColors.gray[9], hover: openColors.gray[3] },
    cost: { bg: openColors.gray[3], border: openColors.gray[6], text: openColors.gray[9], hover: openColors.gray[4] },
    asset: { bg: openColors.gray[4], border: openColors.gray[7], text: openColors.gray[9], hover: openColors.gray[5] },
    metric: { bg: openColors.gray[5], border: openColors.gray[8], text: '#ffffff', hover: openColors.gray[6] },
    risk: { bg: openColors.gray[6], border: openColors.gray[8], text: '#ffffff', hover: openColors.gray[7] },
    neutral: { bg: openColors.gray[1], border: openColors.gray[4], text: openColors.gray[8], hover: openColors.gray[2] },
    positive: { bg: openColors.gray[2], border: openColors.gray[5], text: openColors.gray[9], hover: openColors.gray[3] },
    negative: { bg: openColors.gray[4], border: openColors.gray[7], text: openColors.gray[9], hover: openColors.gray[5] },
  },
};

// Excalidraw-style category colors for treemap segments
export const excalidrawCategoryColors: NodeColors[] = [
  { bg: openColors.blue[1], border: openColors.blue[6], text: openColors.blue[9] },
  { bg: openColors.teal[1], border: openColors.teal[6], text: openColors.teal[9] },
  { bg: openColors.green[1], border: openColors.green[6], text: openColors.green[9] },
  { bg: openColors.yellow[1], border: openColors.yellow[6], text: openColors.yellow[9] },
  { bg: openColors.orange[1], border: openColors.orange[6], text: openColors.orange[9] },
  { bg: openColors.red[1], border: openColors.red[6], text: openColors.red[9] },
  { bg: openColors.pink[1], border: openColors.pink[6], text: openColors.pink[9] },
  { bg: openColors.grape[1], border: openColors.grape[6], text: openColors.grape[9] },
  { bg: openColors.violet[1], border: openColors.violet[6], text: openColors.violet[9] },
  { bg: openColors.indigo[1], border: openColors.indigo[6], text: openColors.indigo[9] },
  { bg: openColors.cyan[1], border: openColors.cyan[6], text: openColors.cyan[9] },
  { bg: openColors.lime[1], border: openColors.lime[6], text: openColors.lime[9] },
];

// ============ THEME STYLES ============

export const themeStyles: Record<'dark' | 'light', ThemeStyles> = {
  light: {
    bg: openColors.gray[0], // Excalidraw canvas background
    text: openColors.gray[9],
    border: openColors.gray[4],
    panel: '#ffffff',
    muted: openColors.gray[6],
  },
  dark: {
    bg: '#1e1e1e',
    text: openColors.gray[1],
    border: openColors.gray[7],
    panel: '#2d2d2d',
    muted: openColors.gray[5],
  },
};

// ============ FONT STYLES ============

export const excalidrawFontFamily = "'Virgil', 'Segoe Print', 'Bradley Hand', 'Chilanka', cursive";
export const excalidrawFontFamilyUI = "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";

// ============ HELPER FUNCTIONS ============

export const formatValue = (value: number | undefined): string => {
  if (value === undefined) return '';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export const formatCompactValue = (value: number | undefined): string => {
  if (value === undefined) return '';
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
};

// ============ ROUGH.JS UTILITIES ============

export const createRoughSVG = (svg: SVGSVGElement): RoughSVG => {
  return rough.svg(svg);
};

export interface RoughOptions {
  fill?: string;
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots' | 'dashed' | 'zigzag-line';
  fillWeight?: number;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  bowing?: number;
  seed?: number;
}

export const getDefaultRoughOptions = (colors: NodeColors, seed: number = 0): RoughOptions => ({
  fill: colors.bg,
  fillStyle: 'solid',
  stroke: colors.border,
  strokeWidth: 2,
  roughness: 1,
  bowing: 1,
  seed,
});

// Legacy hand-drawn rect function for fallback
export const generateHandDrawnRect = (x: number, y: number, width: number, height: number, seed: number = 0): string => {
  const wobble = 1.5;
  const rand = (i: number) => Math.sin(seed + i * 12.9898) * 0.5;
  
  const x1 = x + rand(1) * wobble;
  const y1 = y + rand(2) * wobble;
  const x2 = x + width + rand(3) * wobble;
  const y2 = y + rand(4) * wobble;
  const x3 = x + width + rand(5) * wobble;
  const y3 = y + height + rand(6) * wobble;
  const x4 = x + rand(7) * wobble;
  const y4 = y + height + rand(8) * wobble;
  
  return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
};

// Generate hand-drawn line path
export const generateHandDrawnLine = (
  x1: number, y1: number, 
  x2: number, y2: number, 
  seed: number = 0
): string => {
  const wobble = 1.5;
  const rand = (i: number) => Math.sin(seed + i * 12.9898) * 0.5;
  
  // Add slight curve to make it look hand-drawn
  const midX = (x1 + x2) / 2 + rand(1) * wobble * 2;
  const midY = (y1 + y2) / 2 + rand(2) * wobble * 2;
  
  return `M ${x1 + rand(3) * wobble} ${y1 + rand(4) * wobble} Q ${midX} ${midY} ${x2 + rand(5) * wobble} ${y2 + rand(6) * wobble}`;
};

// ============ NODE COLOR HELPER ============

export const getNodeColorHelper = (
  node: DiagramNode, 
  index: number, 
  colorScheme: ColorScheme
): NodeColors => {
  const currentColors = colorSchemes[colorScheme];
  
  if (node.color) {
    return { bg: node.color, border: node.color, text: '#ffffff' };
  }
  if (node.category && currentColors[node.category]) {
    return currentColors[node.category];
  }
  // Use rotating Excalidraw colors for segments
  return excalidrawCategoryColors[index % excalidrawCategoryColors.length];
};

// ============ WATERFALL SPECIFIC ============

export const getWaterfallNodeColor = (
  node: DiagramNode,
  index: number,
  totalNodes: number,
  colorScheme: ColorScheme
): NodeColors => {
  const currentColors = colorSchemes[colorScheme];
  const value = node.value || 0;
  
  // First and last nodes are typically totals (neutral)
  if (index === 0 || index === totalNodes - 1 || node.category === 'neutral') {
    return currentColors.neutral || excalidrawCategoryColors[0];
  }
  
  // Positive values are green/revenue, negative are red/cost
  if (value >= 0) {
    return currentColors.positive || currentColors.revenue || excalidrawCategoryColors[1];
  } else {
    return currentColors.negative || currentColors.cost || excalidrawCategoryColors[4];
  }
};

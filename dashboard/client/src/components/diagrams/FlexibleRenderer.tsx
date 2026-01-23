import React, { useMemo } from 'react';
import {
  type DiagramSpec,
  type DiagramElement,
  type BarElement,
  type BoxElement,
  type FlowElement,
  type MetricElement,
  type TextElement,
  type Connection,
  type ThemeStyles,
  type ColorScheme,
} from './types';
import { openColors, excalidrawFontFamily, excalidrawFontFamilyUI, generateHandDrawnRect } from './utils';

interface FlexibleRendererProps {
  spec: DiagramSpec;
  canvasWidth: number;
  canvasHeight: number;
  theme: ThemeStyles;
  colorScheme: ColorScheme;
  hoveredElement: string | null;
  onElementHover: (elementId: string | null) => void;
}

// Color mapping for categories
const getCategoryColor = (category: string | undefined, index: number): { bg: string; border: string; text: string } => {
  const palette = [
    { bg: openColors.blue[1], border: openColors.blue[6], text: openColors.blue[9] },
    { bg: openColors.teal[1], border: openColors.teal[6], text: openColors.teal[9] },
    { bg: openColors.violet[1], border: openColors.violet[6], text: openColors.violet[9] },
    { bg: openColors.orange[1], border: openColors.orange[6], text: openColors.orange[9] },
    { bg: openColors.pink[1], border: openColors.pink[6], text: openColors.pink[9] },
    { bg: openColors.cyan[1], border: openColors.cyan[6], text: openColors.cyan[9] },
    { bg: openColors.grape[1], border: openColors.grape[6], text: openColors.grape[9] },
    { bg: openColors.lime[1], border: openColors.lime[6], text: openColors.lime[9] },
  ];

  if (category) {
    const cat = category.toLowerCase();
    if (cat === 'positive' || cat === 'revenue' || cat === 'profit' || cat === 'growth') {
      return { bg: openColors.green[1], border: openColors.green[6], text: openColors.green[9] };
    }
    if (cat === 'negative' || cat === 'cost' || cat === 'expense' || cat === 'loss' || cat === 'decline') {
      return { bg: openColors.red[1], border: openColors.red[6], text: openColors.red[9] };
    }
    if (cat === 'neutral' || cat === 'start' || cat === 'end' || cat === 'total') {
      return { bg: openColors.blue[1], border: openColors.blue[6], text: openColors.blue[9] };
    }
  }

  return palette[index % palette.length];
};

// Parse color from spec (hex, name, or category)
const parseColor = (color: string | undefined, category: string | undefined, index: number): { bg: string; border: string; text: string } => {
  if (color) {
    // If it's a hex color
    if (color.startsWith('#')) {
      return { bg: color + '33', border: color, text: color };
    }
    // If it's a named color from openColors
    const colorName = color.toLowerCase();
    if (openColors[colorName as keyof typeof openColors]) {
      const c = openColors[colorName as keyof typeof openColors];
      return { bg: c[1], border: c[6], text: c[9] };
    }
  }
  return getCategoryColor(category, index);
};

const FlexibleRenderer: React.FC<FlexibleRendererProps> = ({
  spec,
  canvasWidth,
  canvasHeight,
  theme,
  colorScheme,
  hoveredElement,
  onElementHover,
}) => {
  const { elements, connections, layout, legend } = spec;

  // Separate elements by type
  const barElements = elements.filter((e): e is BarElement => e.type === 'bar');
  const boxElements = elements.filter((e): e is BoxElement => e.type === 'box');
  const flowElements = elements.filter((e): e is FlowElement => e.type === 'flow');
  const metricElements = elements.filter((e): e is MetricElement => e.type === 'metric');
  const textElements = elements.filter((e): e is TextElement => e.type === 'text');

  // Determine the primary element type for layout
  const primaryType = useMemo(() => {
    if (barElements.length >= boxElements.length && barElements.length >= flowElements.length && barElements.length >= metricElements.length) {
      return 'bar';
    }
    if (boxElements.length >= flowElements.length && boxElements.length >= metricElements.length) {
      return 'box';
    }
    if (flowElements.length >= metricElements.length) {
      return 'flow';
    }
    return 'metric';
  }, [barElements.length, boxElements.length, flowElements.length, metricElements.length]);

  // Chart dimensions
  const chartPadding = { top: 120, right: 60, bottom: 80, left: 80 };
  const chartWidth = canvasWidth - chartPadding.left - chartPadding.right;
  const chartHeight = canvasHeight - chartPadding.top - chartPadding.bottom;

  // Render bar elements (waterfall, comparison, histogram)
  const renderBars = () => {
    if (barElements.length === 0) return null;

    const arrangement = layout?.arrangement || 'horizontal';
    const sortedBars = [...barElements].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Calculate max value for scaling
    const maxAbsValue = Math.max(...sortedBars.map(b => Math.abs(b.value || 0)), 1);
    
    if (arrangement === 'waterfall') {
      // Waterfall chart logic
      let runningTotal = 0;
      const barWidth = Math.min(chartWidth / sortedBars.length - 20, 80);
      
      return (
        <g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
          {/* Y-axis */}
          <line x1={0} y1={0} x2={0} y2={chartHeight} stroke={theme.border} strokeWidth={2} />
          {/* X-axis */}
          <line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke={theme.border} strokeWidth={2} />
          
          {sortedBars.map((bar, i) => {
            const colors = parseColor(bar.color, bar.category, i);
            const isHovered = hoveredElement === bar.id;
            const value = bar.value || 0;
            const isNegative = value < 0;
            
            // For waterfall: first bar starts from 0, others build on running total
            const startValue = i === 0 ? 0 : runningTotal;
            const endValue = i === sortedBars.length - 1 ? value : startValue + value;
            
            // Update running total (except for last bar which shows final value)
            if (i < sortedBars.length - 1) {
              runningTotal += value;
            }
            
            const barHeight = Math.abs(value) / maxAbsValue * chartHeight * 0.7;
            const x = i * (chartWidth / sortedBars.length) + (chartWidth / sortedBars.length - barWidth) / 2;
            
            // Y position depends on whether it's positive or negative
            let y: number;
            if (i === 0 || i === sortedBars.length - 1) {
              // First and last bars start from bottom
              y = chartHeight - barHeight;
            } else if (isNegative) {
              // Negative bars hang from the running total line
              y = chartHeight - (runningTotal - value) / maxAbsValue * chartHeight * 0.7;
            } else {
              // Positive bars stack on top
              y = chartHeight - runningTotal / maxAbsValue * chartHeight * 0.7 - barHeight;
            }
            
            return (
              <g
                key={bar.id}
                onMouseEnter={() => onElementHover(bar.id)}
                onMouseLeave={() => onElementHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={generateHandDrawnRect(x, Math.max(0, y), barWidth, barHeight, i)}
                  fill={isHovered ? colors.border : colors.bg}
                  stroke={colors.border}
                  strokeWidth={2}
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Value label */}
                <text
                  x={x + barWidth / 2}
                  y={Math.max(0, y) - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="600"
                  fill={theme.text}
                  fontFamily={excalidrawFontFamily}
                >
                  {bar.displayValue || `${value >= 0 ? '' : '-'}$${Math.abs(value).toFixed(0)}B`}
                </text>
                {/* Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontSize={11}
                  fill={theme.text}
                  fontFamily={excalidrawFontFamilyUI}
                >
                  {bar.label.length > 12 ? bar.label.substring(0, 10) + '...' : bar.label}
                </text>
              </g>
            );
          })}
        </g>
      );
    } else {
      // Regular bar chart (horizontal arrangement)
      const barWidth = Math.min(chartWidth / sortedBars.length - 20, 60);
      
      return (
        <g transform={`translate(${chartPadding.left}, ${chartPadding.top})`}>
          {/* Y-axis */}
          <line x1={0} y1={0} x2={0} y2={chartHeight} stroke={theme.border} strokeWidth={2} />
          {/* X-axis */}
          <line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke={theme.border} strokeWidth={2} />
          
          {sortedBars.map((bar, i) => {
            const colors = parseColor(bar.color, bar.category, i);
            const isHovered = hoveredElement === bar.id;
            const value = Math.abs(bar.value || 0);
            const barHeight = (value / maxAbsValue) * chartHeight * 0.85;
            const x = i * (chartWidth / sortedBars.length) + (chartWidth / sortedBars.length - barWidth) / 2;
            const y = chartHeight - barHeight;
            
            return (
              <g
                key={bar.id}
                onMouseEnter={() => onElementHover(bar.id)}
                onMouseLeave={() => onElementHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={generateHandDrawnRect(x, y, barWidth, barHeight, i)}
                  fill={isHovered ? colors.border : colors.bg}
                  stroke={colors.border}
                  strokeWidth={2}
                  style={{ transition: 'all 0.2s ease' }}
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight="600"
                  fill={theme.text}
                  fontFamily={excalidrawFontFamily}
                >
                  {bar.displayValue || bar.value?.toString()}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontSize={11}
                  fill={theme.text}
                  fontFamily={excalidrawFontFamilyUI}
                >
                  {bar.label.length > 12 ? bar.label.substring(0, 10) + '...' : bar.label}
                </text>
              </g>
            );
          })}
        </g>
      );
    }
  };

  // Render box elements (treemap, cards, hierarchy)
  const renderBoxes = () => {
    if (boxElements.length === 0) return null;

    const arrangement = layout?.arrangement || 'grid';
    
    // Check if it's a hierarchy (has parentId)
    const hasHierarchy = boxElements.some(b => b.parentId);
    
    if (hasHierarchy || arrangement === 'tree') {
      // Render as hierarchy/tree
      const rootNodes = boxElements.filter(b => !b.parentId);
      const getChildren = (parentId: string) => boxElements.filter(b => b.parentId === parentId);
      
      const renderNode = (node: BoxElement, x: number, y: number, width: number, depth: number): JSX.Element => {
        const colors = parseColor(node.color, node.category, depth);
        const isHovered = hoveredElement === node.id;
        const children = getChildren(node.id);
        const nodeHeight = 60;
        const childSpacing = 80;
        
        return (
          <g key={node.id}>
            {/* Node box */}
            <g
              onMouseEnter={() => onElementHover(node.id)}
              onMouseLeave={() => onElementHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={generateHandDrawnRect(x, y, width, nodeHeight, depth)}
                fill={isHovered ? colors.border : colors.bg}
                stroke={colors.border}
                strokeWidth={2}
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={x + width / 2}
                y={y + 25}
                textAnchor="middle"
                fontSize={13}
                fontWeight="600"
                fill={theme.text}
                fontFamily={excalidrawFontFamily}
              >
                {node.label}
              </text>
              {node.displayValue && (
                <text
                  x={x + width / 2}
                  y={y + 45}
                  textAnchor="middle"
                  fontSize={11}
                  fill={theme.muted}
                  fontFamily={excalidrawFontFamilyUI}
                >
                  {node.displayValue}
                </text>
              )}
            </g>
            
            {/* Children */}
            {children.map((child, i) => {
              const childWidth = Math.min(width * 0.8, 150);
              const totalChildWidth = children.length * childWidth + (children.length - 1) * 20;
              const startX = x + width / 2 - totalChildWidth / 2;
              const childX = startX + i * (childWidth + 20);
              const childY = y + nodeHeight + childSpacing;
              
              return (
                <g key={child.id}>
                  {/* Connection line */}
                  <path
                    d={`M ${x + width / 2} ${y + nodeHeight} 
                        C ${x + width / 2} ${y + nodeHeight + childSpacing / 2},
                          ${childX + childWidth / 2} ${y + nodeHeight + childSpacing / 2},
                          ${childX + childWidth / 2} ${childY}`}
                    fill="none"
                    stroke={theme.border}
                    strokeWidth={2}
                    strokeDasharray="4,4"
                  />
                  {renderNode(child, childX, childY, childWidth, depth + 1)}
                </g>
              );
            })}
          </g>
        );
      };
      
      const rootWidth = Math.min(200, chartWidth / rootNodes.length - 40);
      const totalRootWidth = rootNodes.length * rootWidth + (rootNodes.length - 1) * 40;
      const startX = chartPadding.left + (chartWidth - totalRootWidth) / 2;
      
      return (
        <g>
          {rootNodes.map((node, i) => 
            renderNode(node, startX + i * (rootWidth + 40), chartPadding.top, rootWidth, 0)
          )}
        </g>
      );
    } else {
      // Render as treemap/grid
      const totalValue = boxElements.reduce((sum, b) => sum + (b.percentage || b.value || 0), 0);
      
      // Simple squarified treemap
      let x = chartPadding.left;
      let y = chartPadding.top;
      let remainingWidth = chartWidth;
      let remainingHeight = chartHeight;
      let remainingValue = totalValue;
      
      const sortedBoxes = [...boxElements].sort((a, b) => 
        (b.percentage || b.value || 0) - (a.percentage || a.value || 0)
      );
      
      return (
        <g>
          {sortedBoxes.map((box, i) => {
            const colors = parseColor(box.color, box.category, i);
            const isHovered = hoveredElement === box.id;
            const boxValue = box.percentage || box.value || 0;
            const ratio = boxValue / remainingValue;
            
            let boxWidth: number;
            let boxHeight: number;
            let boxX = x;
            let boxY = y;
            
            if (remainingWidth > remainingHeight) {
              boxWidth = remainingWidth * ratio;
              boxHeight = remainingHeight;
              x += boxWidth;
              remainingWidth -= boxWidth;
            } else {
              boxWidth = remainingWidth;
              boxHeight = remainingHeight * ratio;
              y += boxHeight;
              remainingHeight -= boxHeight;
            }
            
            remainingValue -= boxValue;
            
            // Add padding
            const padding = 4;
            boxX += padding;
            boxY += padding;
            boxWidth = Math.max(boxWidth - padding * 2, 20);
            boxHeight = Math.max(boxHeight - padding * 2, 20);
            
            return (
              <g
                key={box.id}
                onMouseEnter={() => onElementHover(box.id)}
                onMouseLeave={() => onElementHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={generateHandDrawnRect(boxX, boxY, boxWidth, boxHeight, i)}
                  fill={isHovered ? colors.border : colors.bg}
                  stroke={colors.border}
                  strokeWidth={2}
                  style={{ transition: 'all 0.2s ease' }}
                />
                {boxWidth > 60 && boxHeight > 40 && (
                  <>
                    <text
                      x={boxX + boxWidth / 2}
                      y={boxY + boxHeight / 2 - 8}
                      textAnchor="middle"
                      fontSize={Math.min(14, boxWidth / 8)}
                      fontWeight="600"
                      fill={theme.text}
                      fontFamily={excalidrawFontFamily}
                    >
                      {box.label}
                    </text>
                    <text
                      x={boxX + boxWidth / 2}
                      y={boxY + boxHeight / 2 + 10}
                      textAnchor="middle"
                      fontSize={Math.min(12, boxWidth / 10)}
                      fill={theme.muted}
                      fontFamily={excalidrawFontFamilyUI}
                    >
                      {box.displayValue || (box.percentage ? `${box.percentage}%` : '')}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      );
    }
  };

  // Render flow elements (sankey)
  const renderFlows = () => {
    if (flowElements.length === 0 || !connections || connections.length === 0) return null;

    // Group by column
    const columns = new Map<number, FlowElement[]>();
    flowElements.forEach(f => {
      const col = f.column || 0;
      if (!columns.has(col)) columns.set(col, []);
      columns.get(col)!.push(f);
    });
    
    const numColumns = Math.max(...Array.from(columns.keys())) + 1;
    const columnWidth = chartWidth / numColumns;
    const nodeWidth = Math.min(120, columnWidth * 0.4);
    
    // Calculate node positions
    const nodePositions = new Map<string, { x: number; y: number; height: number }>();
    
    columns.forEach((nodes, colIndex) => {
      const totalValue = nodes.reduce((sum, n) => sum + (n.value || 100), 0);
      let currentY = chartPadding.top;
      
      nodes.forEach((node, i) => {
        const nodeHeight = Math.max(40, ((node.value || 100) / totalValue) * chartHeight * 0.8);
        nodePositions.set(node.id, {
          x: chartPadding.left + colIndex * columnWidth + (columnWidth - nodeWidth) / 2,
          y: currentY,
          height: nodeHeight,
        });
        currentY += nodeHeight + 20;
      });
    });
    
    return (
      <g>
        {/* Connections */}
        {connections.map((conn, i) => {
          const from = nodePositions.get(conn.from);
          const to = nodePositions.get(conn.to);
          if (!from || !to) return null;
          
          const flowHeight = Math.max(10, (conn.value || 50) / 100 * 30);
          
          return (
            <path
              key={`conn-${i}`}
              d={`M ${from.x + nodeWidth} ${from.y + from.height / 2}
                  C ${from.x + nodeWidth + columnWidth * 0.3} ${from.y + from.height / 2},
                    ${to.x - columnWidth * 0.3} ${to.y + to.height / 2},
                    ${to.x} ${to.y + to.height / 2}`}
              fill="none"
              stroke={conn.color || theme.border}
              strokeWidth={flowHeight}
              strokeOpacity={0.4}
            />
          );
        })}
        
        {/* Nodes */}
        {flowElements.map((node, i) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          
          const colors = parseColor(node.color, undefined, i);
          const isHovered = hoveredElement === node.id;
          
          return (
            <g
              key={node.id}
              onMouseEnter={() => onElementHover(node.id)}
              onMouseLeave={() => onElementHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={generateHandDrawnRect(pos.x, pos.y, nodeWidth, pos.height, i)}
                fill={isHovered ? colors.border : colors.bg}
                stroke={colors.border}
                strokeWidth={2}
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={pos.x + nodeWidth / 2}
                y={pos.y + pos.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontWeight="600"
                fill={theme.text}
                fontFamily={excalidrawFontFamily}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // Render metric elements (KPI cards)
  const renderMetrics = () => {
    if (metricElements.length === 0) return null;

    const cardWidth = Math.min(180, (chartWidth - 40) / metricElements.length - 20);
    const cardHeight = 100;
    const totalWidth = metricElements.length * cardWidth + (metricElements.length - 1) * 20;
    const startX = chartPadding.left + (chartWidth - totalWidth) / 2;
    
    return (
      <g>
        {metricElements.map((metric, i) => {
          const colors = parseColor(metric.color, undefined, i);
          const isHovered = hoveredElement === metric.id;
          const x = startX + i * (cardWidth + 20);
          const y = chartPadding.top + (chartHeight - cardHeight) / 2;
          
          const trendColor = metric.trend === 'up' ? openColors.green[6] : 
                            metric.trend === 'down' ? openColors.red[6] : 
                            theme.muted;
          
          return (
            <g
              key={metric.id}
              onMouseEnter={() => onElementHover(metric.id)}
              onMouseLeave={() => onElementHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={generateHandDrawnRect(x, y, cardWidth, cardHeight, i)}
                fill={isHovered ? colors.border + '22' : colors.bg}
                stroke={colors.border}
                strokeWidth={2}
                style={{ transition: 'all 0.2s ease' }}
              />
              <text
                x={x + cardWidth / 2}
                y={y + 25}
                textAnchor="middle"
                fontSize={11}
                fill={theme.muted}
                fontFamily={excalidrawFontFamilyUI}
              >
                {metric.label}
              </text>
              <text
                x={x + cardWidth / 2}
                y={y + 55}
                textAnchor="middle"
                fontSize={24}
                fontWeight="700"
                fill={theme.text}
                fontFamily={excalidrawFontFamily}
              >
                {metric.displayValue || metric.value}
              </text>
              {metric.change && (
                <text
                  x={x + cardWidth / 2}
                  y={y + 80}
                  textAnchor="middle"
                  fontSize={12}
                  fill={trendColor}
                  fontFamily={excalidrawFontFamilyUI}
                >
                  {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : ''} {metric.change}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // Render legend
  const renderLegend = () => {
    if (!legend?.show || !legend.items || legend.items.length === 0) return null;

    return (
      <g transform={`translate(${chartPadding.left}, ${canvasHeight - 40})`}>
        {legend.items.map((item, i) => (
          <g key={i} transform={`translate(${i * 120}, 0)`}>
            <rect
              x={0}
              y={0}
              width={14}
              height={14}
              fill={item.color}
              stroke={item.color}
              strokeWidth={1}
              rx={2}
            />
            <text
              x={20}
              y={11}
              fontSize={11}
              fill={theme.text}
              fontFamily={excalidrawFontFamilyUI}
            >
              {item.label}
            </text>
          </g>
        ))}
      </g>
    );
  };

  return (
    <g>
      {/* Render based on what elements are present */}
      {barElements.length > 0 && renderBars()}
      {boxElements.length > 0 && barElements.length === 0 && renderBoxes()}
      {flowElements.length > 0 && renderFlows()}
      {metricElements.length > 0 && barElements.length === 0 && boxElements.length === 0 && renderMetrics()}
      
      {/* Always render legend if present */}
      {renderLegend()}
    </g>
  );
};

export default FlexibleRenderer;

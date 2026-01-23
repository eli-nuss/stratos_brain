import { useMemo } from 'react';
import type { RendererProps } from './types';
import { 
  generateHandDrawnRect, 
  generateHandDrawnLine,
  formatValue,
  excalidrawFontFamily,
  excalidrawFontFamilyUI,
  excalidrawPrimary,
} from './utils';

interface TimelineRendererProps extends RendererProps {}

export function TimelineRenderer({
  nodes,
  canvasWidth,
  canvasHeight,
  theme,
  colorScheme,
  hoveredNode,
  onNodeHover,
  getNodeColor,
}: TimelineRendererProps) {
  // Calculate timeline layout
  const timelineData = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;

    const chartTop = 160;
    const chartLeft = 80;
    const chartRight = canvasWidth - 60;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = canvasHeight - 280;
    const timelineY = chartTop + chartHeight / 2;
    
    // Calculate spacing
    const nodeSpacing = chartWidth / (nodes.length + 1);
    const nodeRadius = 24;
    const barWidth = Math.min(40, nodeSpacing * 0.6);

    // Calculate value range for bar heights
    const values = nodes.map(n => n.value || 0).filter(v => v !== 0);
    const maxValue = Math.max(...values.map(Math.abs), 1);

    // Position nodes along timeline
    const positionedNodes = nodes.map((node, i) => {
      const x = chartLeft + nodeSpacing * (i + 1);
      const value = node.value || 0;
      const barHeight = Math.abs(value) / maxValue * (chartHeight / 2 - 40);
      const isPositive = value >= 0;

      return {
        ...node,
        x,
        y: timelineY,
        barHeight,
        isPositive,
        barY: isPositive ? timelineY - barHeight : timelineY,
      };
    });

    return {
      positionedNodes,
      chartTop,
      chartLeft,
      chartRight,
      chartWidth,
      chartHeight,
      timelineY,
      nodeRadius,
      barWidth,
      maxValue,
    };
  }, [nodes, canvasWidth, canvasHeight]);

  if (!timelineData) return null;

  const {
    positionedNodes,
    chartLeft,
    chartRight,
    chartHeight,
    timelineY,
    nodeRadius,
    barWidth,
    maxValue,
  } = timelineData;

  return (
    <g>
      {/* Timeline axis */}
      <path
        d={generateHandDrawnLine(chartLeft - 20, timelineY, chartRight + 20, timelineY, 0)}
        stroke={theme.border}
        strokeWidth={3}
        fill="none"
      />
      
      {/* Arrow at end */}
      <polygon
        points={`${chartRight + 20},${timelineY} ${chartRight + 10},${timelineY - 6} ${chartRight + 10},${timelineY + 6}`}
        fill={theme.border}
      />

      {/* Zero reference lines */}
      <line
        x1={chartLeft}
        y1={timelineY - chartHeight / 2 + 40}
        x2={chartLeft}
        y2={timelineY + chartHeight / 2 - 40}
        stroke={theme.border}
        strokeWidth={1}
        strokeDasharray="4,4"
        opacity={0.5}
      />

      {/* Connecting lines between nodes */}
      {positionedNodes.map((node, i) => {
        if (i === 0) return null;
        const prevNode = positionedNodes[i - 1];
        
        return (
          <path
            key={`line-${i}`}
            d={generateHandDrawnLine(
              prevNode.x,
              prevNode.y - prevNode.barHeight * (prevNode.isPositive ? 1 : -1),
              node.x,
              node.y - node.barHeight * (node.isPositive ? 1 : -1),
              i * 100
            )}
            stroke={excalidrawPrimary.violet}
            strokeWidth={2}
            fill="none"
            opacity={0.6}
            strokeDasharray="6,4"
          />
        );
      })}

      {/* Nodes */}
      {positionedNodes.map((node, index) => {
        const colors = getNodeColor(node, index);
        const isHovered = hoveredNode === node.id;

        return (
          <g
            key={node.id}
            onMouseEnter={() => onNodeHover(node.id)}
            onMouseLeave={() => onNodeHover(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Value bar */}
            {node.value !== undefined && node.value !== 0 && (
              <path
                d={generateHandDrawnRect(
                  node.x - barWidth / 2,
                  node.barY,
                  barWidth,
                  node.barHeight,
                  index
                )}
                fill={isHovered ? colors.border : colors.bg}
                stroke={colors.border}
                strokeWidth={2}
                style={{
                  transition: 'all 0.2s ease',
                  filter: isHovered ? 'brightness(1.05)' : 'none',
                }}
              />
            )}

            {/* Timeline node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={nodeRadius}
              fill={isHovered ? colors.border : colors.bg}
              stroke={colors.border}
              strokeWidth={2}
              style={{
                transition: 'all 0.2s ease',
                filter: isHovered ? 'brightness(1.05)' : 'none',
              }}
            />

            {/* Node index/label inside circle */}
            <text
              x={node.x}
              y={node.y + 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight="600"
              fill={isHovered ? '#ffffff' : colors.text}
              fontFamily={excalidrawFontFamily}
            >
              {index + 1}
            </text>

            {/* Value label above/below bar */}
            {node.value !== undefined && (
              <text
                x={node.x}
                y={node.isPositive 
                  ? node.barY - 10 
                  : node.barY + node.barHeight + 18}
                textAnchor="middle"
                fontSize={12}
                fontWeight="600"
                fill={theme.text}
                fontFamily={excalidrawFontFamily}
              >
                {node.valueLabel || formatValue(node.value)}
              </text>
            )}

            {/* Percentage change */}
            {node.percentage !== undefined && (
              <text
                x={node.x}
                y={node.isPositive 
                  ? node.barY - 24 
                  : node.barY + node.barHeight + 32}
                textAnchor="middle"
                fontSize={10}
                fill={node.isPositive ? '#2f9e44' : '#e03131'}
                fontFamily={excalidrawFontFamilyUI}
              >
                {node.isPositive ? '▲' : '▼'} {node.percentage}%
              </text>
            )}

            {/* Date/Label below timeline */}
            <text
              x={node.x}
              y={timelineY + nodeRadius + 20}
              textAnchor="middle"
              fontSize={11}
              fill={theme.text}
              fontFamily={excalidrawFontFamily}
            >
              {node.date || node.label}
            </text>

            {/* Secondary label */}
            {node.date && node.label && (
              <text
                x={node.x}
                y={timelineY + nodeRadius + 36}
                textAnchor="middle"
                fontSize={9}
                fill={theme.muted}
                fontFamily={excalidrawFontFamilyUI}
              >
                {node.label.length > 12 ? node.label.substring(0, 10) + '...' : node.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Y-axis scale labels */}
      <text
        x={chartLeft - 30}
        y={timelineY - chartHeight / 2 + 50}
        textAnchor="end"
        fontSize={9}
        fill={theme.muted}
        fontFamily={excalidrawFontFamilyUI}
      >
        +{formatValue(maxValue)}
      </text>
      <text
        x={chartLeft - 30}
        y={timelineY + 4}
        textAnchor="end"
        fontSize={9}
        fill={theme.muted}
        fontFamily={excalidrawFontFamilyUI}
      >
        $0
      </text>
      <text
        x={chartLeft - 30}
        y={timelineY + chartHeight / 2 - 40}
        textAnchor="end"
        fontSize={9}
        fill={theme.muted}
        fontFamily={excalidrawFontFamilyUI}
      >
        -{formatValue(maxValue)}
      </text>

      {/* Timeline label */}
      <text
        x={chartRight + 10}
        y={timelineY + nodeRadius + 20}
        textAnchor="start"
        fontSize={10}
        fill={theme.muted}
        fontFamily={excalidrawFontFamilyUI}
      >
        Time →
      </text>
    </g>
  );
}

export default TimelineRenderer;

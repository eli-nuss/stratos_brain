import { useMemo } from 'react';
import type { RendererProps } from './types';
import { 
  generateHandDrawnRect, 
  generateHandDrawnLine,
  formatValue, 
  formatCompactValue,
  excalidrawFontFamily,
  excalidrawFontFamilyUI,
  getWaterfallNodeColor,
} from './utils';

interface WaterfallRendererProps extends RendererProps {}

export function WaterfallRenderer({
  nodes,
  canvasWidth,
  canvasHeight,
  theme,
  colorScheme,
  hoveredNode,
  onNodeHover,
}: WaterfallRendererProps) {
  // Calculate waterfall chart layout
  const waterfallData = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;

    const chartHeight = canvasHeight - 250;
    const chartTop = 140;
    const chartLeft = 100;
    const chartRight = canvasWidth - 60;
    const chartWidth = chartRight - chartLeft;
    const barWidth = Math.min((chartWidth / nodes.length) * 0.6, 80);
    const barSpacing = chartWidth / nodes.length;

    // Calculate cumulative values and find min/max for scaling
    let runningTotal = 0;
    const processedNodes = nodes.map((node, i) => {
      const val = node.value || 0;
      const isTotal = node.category === 'neutral' || i === 0 || i === nodes.length - 1;
      
      let yStart: number;
      let yEnd: number;
      
      if (isTotal) {
        yStart = 0;
        yEnd = val;
        runningTotal = val;
      } else {
        yStart = runningTotal;
        yEnd = runningTotal + val;
        runningTotal += val;
      }

      return {
        ...node,
        yStart,
        yEnd,
        isTotal,
        runningTotal: yEnd,
      };
    });

    // Find the range for scaling
    const allValues = processedNodes.flatMap(n => [n.yStart, n.yEnd]);
    const minValue = Math.min(0, ...allValues);
    const maxValue = Math.max(0, ...allValues);
    const valueRange = maxValue - minValue || 1;
    const padding = valueRange * 0.15;
    const scaledMin = minValue - padding;
    const scaledMax = maxValue + padding;
    const scale = chartHeight / (scaledMax - scaledMin);

    // Calculate zero line position
    const zeroY = chartTop + (scaledMax - 0) * scale;

    return {
      processedNodes,
      chartHeight,
      chartTop,
      chartLeft,
      chartWidth,
      barWidth,
      barSpacing,
      scale,
      scaledMin,
      scaledMax,
      zeroY,
    };
  }, [nodes, canvasWidth, canvasHeight]);

  if (!waterfallData) return null;

  const {
    processedNodes,
    chartHeight,
    chartTop,
    chartLeft,
    barWidth,
    barSpacing,
    scale,
    scaledMax,
    zeroY,
  } = waterfallData;

  return (
    <g>
      {/* Y-axis */}
      <line
        x1={chartLeft - 10}
        y1={chartTop}
        x2={chartLeft - 10}
        y2={chartTop + chartHeight}
        stroke={theme.border}
        strokeWidth={2}
      />

      {/* Zero line */}
      <line
        x1={chartLeft - 10}
        y1={zeroY}
        x2={chartLeft + waterfallData.chartWidth}
        y2={zeroY}
        stroke={theme.border}
        strokeWidth={1}
        strokeDasharray="4,4"
      />
      <text
        x={chartLeft - 20}
        y={zeroY + 4}
        textAnchor="end"
        fontSize={10}
        fill={theme.muted}
        fontFamily={excalidrawFontFamilyUI}
      >
        $0
      </text>

      {/* Bars */}
      {processedNodes.map((node, i) => {
        const x = chartLeft + (i * barSpacing) + (barSpacing - barWidth) / 2;
        const colors = getWaterfallNodeColor(node, i, processedNodes.length, colorScheme);
        const isHovered = hoveredNode === node.id;

        // Calculate Y positions
        const yPixStart = chartTop + (scaledMax - node.yStart) * scale;
        const yPixEnd = chartTop + (scaledMax - node.yEnd) * scale;
        const yTop = Math.min(yPixStart, yPixEnd);
        const barHeight = Math.max(4, Math.abs(yPixStart - yPixEnd));
        const isPositive = (node.value || 0) >= 0;

        return (
          <g
            key={node.id}
            onMouseEnter={() => onNodeHover(node.id)}
            onMouseLeave={() => onNodeHover(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Connection line to next bar (dashed bridge) */}
            {i < processedNodes.length - 1 && !node.isTotal && (
              <path
                d={generateHandDrawnLine(
                  x + barWidth,
                  yPixEnd,
                  chartLeft + ((i + 1) * barSpacing) + (barSpacing - barWidth) / 2,
                  yPixEnd,
                  i * 100
                )}
                stroke={theme.border}
                strokeWidth={1.5}
                strokeDasharray="6,4"
                fill="none"
                opacity={0.6}
              />
            )}

            {/* The Bar */}
            <path
              d={generateHandDrawnRect(x, yTop, barWidth, barHeight, i)}
              fill={isHovered ? colors.border : colors.bg}
              stroke={colors.border}
              strokeWidth={2}
              style={{
                transition: 'all 0.2s ease',
                filter: isHovered ? 'brightness(1.05)' : 'none',
              }}
            />

            {/* Value Label (above or below bar) */}
            <text
              x={x + barWidth / 2}
              y={isPositive ? yTop - 10 : yTop + barHeight + 18}
              textAnchor="middle"
              fontSize={12}
              fontWeight="600"
              fill={isHovered ? colors.border : theme.text}
              fontFamily={excalidrawFontFamily}
            >
              {node.valueLabel || formatValue(node.value)}
            </text>

            {/* Change indicator for non-total bars */}
            {!node.isTotal && (
              <text
                x={x + barWidth / 2}
                y={isPositive ? yTop - 24 : yTop + barHeight + 32}
                textAnchor="middle"
                fontSize={10}
                fill={isPositive ? '#2f9e44' : '#e03131'}
                fontFamily={excalidrawFontFamilyUI}
              >
                {isPositive ? '▲' : '▼'} {node.percentage ? `${node.percentage}%` : ''}
              </text>
            )}

            {/* Node Label (below x-axis) */}
            <text
              x={x + barWidth / 2}
              y={chartTop + chartHeight + 25}
              textAnchor="middle"
              fontSize={11}
              fill={theme.text}
              fontFamily={excalidrawFontFamily}
            >
              {node.label.length > 12 ? node.label.substring(0, 10) + '...' : node.label}
            </text>

            {/* Category label for totals */}
            {node.isTotal && (
              <text
                x={x + barWidth / 2}
                y={chartTop + chartHeight + 40}
                textAnchor="middle"
                fontSize={9}
                fill={theme.muted}
                fontFamily={excalidrawFontFamilyUI}
              >
                {i === 0 ? 'Starting' : i === processedNodes.length - 1 ? 'Ending' : 'Subtotal'}
              </text>
            )}
          </g>
        );
      })}

      {/* Y-axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const value = waterfallData.scaledMin + (waterfallData.scaledMax - waterfallData.scaledMin) * (1 - pct);
        const y = chartTop + chartHeight * pct;
        return (
          <g key={i}>
            <line
              x1={chartLeft - 15}
              y1={y}
              x2={chartLeft - 10}
              y2={y}
              stroke={theme.border}
              strokeWidth={1}
            />
            <text
              x={chartLeft - 20}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill={theme.muted}
              fontFamily={excalidrawFontFamilyUI}
            >
              {formatCompactValue(value)}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${chartLeft}, ${chartTop + chartHeight + 60})`}>
        <rect
          x={0}
          y={0}
          width={12}
          height={12}
          fill={getWaterfallNodeColor({ id: '', label: '', value: 100 }, 1, 3, colorScheme).bg}
          stroke={getWaterfallNodeColor({ id: '', label: '', value: 100 }, 1, 3, colorScheme).border}
          strokeWidth={1}
        />
        <text x={18} y={10} fontSize={10} fill={theme.muted} fontFamily={excalidrawFontFamilyUI}>
          Increase
        </text>
        
        <rect
          x={80}
          y={0}
          width={12}
          height={12}
          fill={getWaterfallNodeColor({ id: '', label: '', value: -100 }, 1, 3, colorScheme).bg}
          stroke={getWaterfallNodeColor({ id: '', label: '', value: -100 }, 1, 3, colorScheme).border}
          strokeWidth={1}
        />
        <text x={98} y={10} fontSize={10} fill={theme.muted} fontFamily={excalidrawFontFamilyUI}>
          Decrease
        </text>
        
        <rect
          x={170}
          y={0}
          width={12}
          height={12}
          fill={getWaterfallNodeColor({ id: '', label: '', category: 'neutral' }, 0, 3, colorScheme).bg}
          stroke={getWaterfallNodeColor({ id: '', label: '', category: 'neutral' }, 0, 3, colorScheme).border}
          strokeWidth={1}
        />
        <text x={188} y={10} fontSize={10} fill={theme.muted} fontFamily={excalidrawFontFamilyUI}>
          Total
        </text>
      </g>
    </g>
  );
}

export default WaterfallRenderer;

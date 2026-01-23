import { useMemo } from 'react';
import type { RendererProps, DiagramNode, DiagramConnection } from './types';
import { 
  formatValue,
  excalidrawFontFamily,
  excalidrawFontFamilyUI,
  openColors,
} from './utils';

interface SankeyRendererProps extends RendererProps {}

interface SankeyNode extends DiagramNode {
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  incomingValue: number;
  outgoingValue: number;
}

interface SankeyLink {
  source: SankeyNode;
  target: SankeyNode;
  value: number;
  sourceY: number;
  targetY: number;
  thickness: number;
}

export function SankeyRenderer({
  nodes,
  connections,
  canvasWidth,
  canvasHeight,
  theme,
  colorScheme,
  hoveredNode,
  onNodeHover,
  getNodeColor,
}: SankeyRendererProps) {
  // Calculate Sankey layout
  const sankeyData = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;

    const chartTop = 140;
    const chartLeft = 80;
    const chartRight = canvasWidth - 80;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = canvasHeight - 220;
    const nodeWidth = 30;
    const nodePadding = 20;

    // Determine node levels based on connections
    const nodeMap = new Map<string, SankeyNode>();
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        x: 0,
        y: 0,
        width: nodeWidth,
        height: 0,
        level: 0,
        incomingValue: 0,
        outgoingValue: node.value || 0,
      });
    });

    // Calculate incoming/outgoing values from connections
    connections.forEach(conn => {
      const target = nodeMap.get(conn.to);
      if (target && conn.value) {
        target.incomingValue += conn.value;
      }
    });

    // Assign levels - nodes with no incoming connections are level 0
    // Then propagate levels through connections
    const assignLevels = () => {
      // Start with nodes that have no incoming connections
      nodeMap.forEach(node => {
        if (node.incomingValue === 0) {
          node.level = 0;
        } else {
          node.level = -1; // Unassigned
        }
      });

      // Propagate levels
      let changed = true;
      let iterations = 0;
      while (changed && iterations < 10) {
        changed = false;
        iterations++;
        connections.forEach(conn => {
          const source = nodeMap.get(conn.from);
          const target = nodeMap.get(conn.to);
          if (source && target && source.level >= 0) {
            const newLevel = source.level + 1;
            if (target.level < newLevel) {
              target.level = newLevel;
              changed = true;
            }
          }
        });
      }

      // Assign level 0 to any remaining unassigned nodes
      nodeMap.forEach(node => {
        if (node.level < 0) node.level = 0;
      });
    };
    assignLevels();

    // Group nodes by level
    const levels: SankeyNode[][] = [];
    let maxLevel = 0;
    nodeMap.forEach(node => {
      maxLevel = Math.max(maxLevel, node.level);
    });
    for (let i = 0; i <= maxLevel; i++) {
      levels.push([]);
    }
    nodeMap.forEach(node => {
      levels[node.level].push(node);
    });

    // Calculate X positions based on level
    const levelWidth = chartWidth / (maxLevel + 1);
    levels.forEach((level, i) => {
      level.forEach(node => {
        node.x = chartLeft + i * levelWidth;
      });
    });

    // Calculate node heights based on values
    const maxLevelValue = Math.max(
      ...levels.map(level => 
        level.reduce((sum, node) => sum + Math.max(node.value || 0, node.incomingValue), 0)
      )
    );
    const valueScale = (chartHeight - (Math.max(...levels.map(l => l.length)) - 1) * nodePadding) / maxLevelValue;

    // Calculate Y positions and heights
    levels.forEach(level => {
      let currentY = chartTop;
      level.forEach(node => {
        const nodeValue = Math.max(node.value || 0, node.incomingValue, 10);
        node.height = Math.max(nodeValue * valueScale, 20);
        node.y = currentY;
        currentY += node.height + nodePadding;
      });
      
      // Center the level vertically
      const totalHeight = currentY - nodePadding - chartTop;
      const offset = (chartHeight - totalHeight) / 2;
      level.forEach(node => {
        node.y += offset;
      });
    });

    // Build links with positions
    const links: SankeyLink[] = [];
    const sourceYOffsets = new Map<string, number>();
    const targetYOffsets = new Map<string, number>();
    
    nodeMap.forEach(node => {
      sourceYOffsets.set(node.id, 0);
      targetYOffsets.set(node.id, 0);
    });

    connections.forEach(conn => {
      const source = nodeMap.get(conn.from);
      const target = nodeMap.get(conn.to);
      if (source && target && conn.value) {
        const thickness = conn.value * valueScale;
        const sourceYOffset = sourceYOffsets.get(conn.from) || 0;
        const targetYOffset = targetYOffsets.get(conn.to) || 0;

        links.push({
          source,
          target,
          value: conn.value,
          sourceY: source.y + sourceYOffset,
          targetY: target.y + targetYOffset,
          thickness: Math.max(thickness, 4),
        });

        sourceYOffsets.set(conn.from, sourceYOffset + thickness);
        targetYOffsets.set(conn.to, targetYOffset + thickness);
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links,
      levels,
      nodeWidth,
    };
  }, [nodes, connections, canvasWidth, canvasHeight]);

  if (!sankeyData) return null;

  const { nodes: sankeyNodes, links, nodeWidth } = sankeyData;

  // Generate curved path for Sankey link
  const generateLinkPath = (link: SankeyLink): string => {
    const x0 = link.source.x + nodeWidth;
    const x1 = link.target.x;
    const y0 = link.sourceY + link.thickness / 2;
    const y1 = link.targetY + link.thickness / 2;
    const curvature = 0.5;
    const xi = (x0 + x1) * curvature;

    return `M${x0},${y0 - link.thickness / 2}
            C${xi},${y0 - link.thickness / 2} ${xi},${y1 - link.thickness / 2} ${x1},${y1 - link.thickness / 2}
            L${x1},${y1 + link.thickness / 2}
            C${xi},${y1 + link.thickness / 2} ${xi},${y0 + link.thickness / 2} ${x0},${y0 + link.thickness / 2}
            Z`;
  };

  // Link colors based on source node
  const getLinkColor = (link: SankeyLink, index: number): string => {
    const colors = getNodeColor(link.source, index);
    return colors.border;
  };

  return (
    <g>
      {/* Links (rendered first, behind nodes) */}
      {links.map((link, i) => {
        const isSourceHovered = hoveredNode === link.source.id;
        const isTargetHovered = hoveredNode === link.target.id;
        const isHighlighted = isSourceHovered || isTargetHovered;

        return (
          <g key={`link-${i}`}>
            <path
              d={generateLinkPath(link)}
              fill={getLinkColor(link, i)}
              opacity={isHighlighted ? 0.7 : 0.4}
              style={{
                transition: 'all 0.2s ease',
              }}
            />
            {/* Link value label on hover */}
            {isHighlighted && (
              <text
                x={(link.source.x + nodeWidth + link.target.x) / 2}
                y={(link.sourceY + link.targetY) / 2 + link.thickness / 2}
                textAnchor="middle"
                fontSize={10}
                fontWeight="600"
                fill={theme.text}
                fontFamily={excalidrawFontFamilyUI}
              >
                {formatValue(link.value)}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {sankeyNodes.map((node, index) => {
        const colors = getNodeColor(node, index);
        const isHovered = hoveredNode === node.id;

        return (
          <g
            key={node.id}
            onMouseEnter={() => onNodeHover(node.id)}
            onMouseLeave={() => onNodeHover(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Node rectangle */}
            <rect
              x={node.x}
              y={node.y}
              width={nodeWidth}
              height={node.height}
              rx={4}
              fill={isHovered ? colors.border : colors.bg}
              stroke={colors.border}
              strokeWidth={2}
              style={{
                transition: 'all 0.2s ease',
                filter: isHovered ? 'brightness(1.05)' : 'none',
              }}
            />

            {/* Node label */}
            <text
              x={node.level === 0 ? node.x - 8 : node.x + nodeWidth + 8}
              y={node.y + node.height / 2 - 6}
              textAnchor={node.level === 0 ? 'end' : 'start'}
              fontSize={11}
              fontWeight="500"
              fill={theme.text}
              fontFamily={excalidrawFontFamily}
            >
              {node.label.length > 15 ? node.label.substring(0, 13) + '...' : node.label}
            </text>

            {/* Node value */}
            <text
              x={node.level === 0 ? node.x - 8 : node.x + nodeWidth + 8}
              y={node.y + node.height / 2 + 10}
              textAnchor={node.level === 0 ? 'end' : 'start'}
              fontSize={12}
              fontWeight="700"
              fill={isHovered ? colors.border : colors.text}
              fontFamily={excalidrawFontFamily}
            >
              {node.valueLabel || formatValue(node.value)}
            </text>

            {/* Percentage if available */}
            {node.percentage !== undefined && (
              <text
                x={node.level === 0 ? node.x - 8 : node.x + nodeWidth + 8}
                y={node.y + node.height / 2 + 24}
                textAnchor={node.level === 0 ? 'end' : 'start'}
                fontSize={9}
                fill={theme.muted}
                fontFamily={excalidrawFontFamilyUI}
              >
                {node.percentage}%
              </text>
            )}
          </g>
        );
      })}

      {/* Level labels */}
      {sankeyData.levels.length > 1 && (
        <g>
          {sankeyData.levels.map((level, i) => {
            if (level.length === 0) return null;
            const x = level[0].x + nodeWidth / 2;
            return (
              <text
                key={`level-label-${i}`}
                x={x}
                y={canvasHeight - 40}
                textAnchor="middle"
                fontSize={10}
                fill={theme.muted}
                fontFamily={excalidrawFontFamilyUI}
              >
                {i === 0 ? 'Sources' : i === sankeyData.levels.length - 1 ? 'Destinations' : `Stage ${i}`}
              </text>
            );
          })}
        </g>
      )}
    </g>
  );
}

export default SankeyRenderer;

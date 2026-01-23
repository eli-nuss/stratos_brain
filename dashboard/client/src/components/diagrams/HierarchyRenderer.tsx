import { useMemo } from 'react';
import type { RendererProps, DiagramNode, NodePosition } from './types';
import { 
  generateHandDrawnRect, 
  generateHandDrawnLine,
  formatValue,
  excalidrawFontFamily,
  excalidrawFontFamilyUI,
} from './utils';

interface HierarchyRendererProps extends RendererProps {}

interface TreeNode extends DiagramNode {
  depth: number;
  childNodes: TreeNode[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export function HierarchyRenderer({
  nodes,
  connections,
  canvasWidth,
  canvasHeight,
  theme,
  colorScheme,
  hoveredNode,
  onNodeHover,
  getNodeColor,
}: HierarchyRendererProps) {
  // Build tree structure and calculate positions
  const treeData = useMemo(() => {
    if (!nodes || nodes.length === 0) return null;

    const chartTop = 120;
    const chartLeft = 50;
    const chartWidth = canvasWidth - 100;
    const chartHeight = canvasHeight - 180;
    const nodeWidth = 140;
    const nodeHeight = 60;
    const levelGap = 80;
    const siblingGap = 20;

    // Build node map
    const nodeMap = new Map<string, TreeNode>();
    nodes.forEach(node => {
      nodeMap.set(node.id, {
        ...node,
        depth: 0,
        childNodes: [],
        x: 0,
        y: 0,
        width: nodeWidth,
        height: nodeHeight,
      });
    });

    // Find root nodes (nodes without parents or with null parentId)
    const rootNodes: TreeNode[] = [];
    nodes.forEach(node => {
      const treeNode = nodeMap.get(node.id)!;
      if (!node.parentId || !nodeMap.has(node.parentId)) {
        rootNodes.push(treeNode);
      } else {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.childNodes.push(treeNode);
        }
      }
    });

    // If no clear hierarchy, treat first node as root
    if (rootNodes.length === 0 && nodes.length > 0) {
      rootNodes.push(nodeMap.get(nodes[0].id)!);
    }

    // Calculate depths
    const setDepths = (node: TreeNode, depth: number) => {
      node.depth = depth;
      node.childNodes.forEach(child => setDepths(child, depth + 1));
    };
    rootNodes.forEach(root => setDepths(root, 0));

    // Find max depth
    let maxDepth = 0;
    nodeMap.forEach(node => {
      maxDepth = Math.max(maxDepth, node.depth);
    });

    // Group nodes by level
    const levels: TreeNode[][] = [];
    for (let i = 0; i <= maxDepth; i++) {
      levels.push([]);
    }
    nodeMap.forEach(node => {
      levels[node.depth].push(node);
    });

    // Calculate Y positions based on depth
    const levelHeight = Math.min(levelGap + nodeHeight, chartHeight / (maxDepth + 1));
    levels.forEach((level, depth) => {
      level.forEach(node => {
        node.y = chartTop + depth * levelHeight;
      });
    });

    // Calculate X positions - center nodes at each level
    levels.forEach((level) => {
      const totalWidth = level.length * nodeWidth + (level.length - 1) * siblingGap;
      const startX = chartLeft + (chartWidth - totalWidth) / 2;
      level.forEach((node, i) => {
        node.x = startX + i * (nodeWidth + siblingGap);
      });
    });

    // Adjust positions to center children under parents
    const centerChildren = (node: TreeNode) => {
      if (node.childNodes.length > 0) {
        node.childNodes.forEach(centerChildren);
        
        // Center parent above children
        const firstChild = node.childNodes[0];
        const lastChild = node.childNodes[node.childNodes.length - 1];
        const childrenCenter = (firstChild.x + lastChild.x + nodeWidth) / 2;
        node.x = childrenCenter - nodeWidth / 2;
      }
    };
    rootNodes.forEach(centerChildren);

    // Build connections from parent-child relationships
    const hierarchyConnections: Array<{ from: TreeNode; to: TreeNode }> = [];
    nodeMap.forEach(node => {
      node.childNodes.forEach(child => {
        hierarchyConnections.push({ from: node, to: child });
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      connections: hierarchyConnections,
      rootNodes,
      levels,
      nodeWidth,
      nodeHeight,
    };
  }, [nodes, connections, canvasWidth, canvasHeight]);

  if (!treeData) return null;

  const { nodes: treeNodes, connections: treeConnections, nodeWidth, nodeHeight } = treeData;

  return (
    <g>
      {/* Connection lines */}
      {treeConnections.map((conn, i) => {
        const fromX = conn.from.x + nodeWidth / 2;
        const fromY = conn.from.y + nodeHeight;
        const toX = conn.to.x + nodeWidth / 2;
        const toY = conn.to.y;
        const midY = (fromY + toY) / 2;

        return (
          <g key={`conn-${i}`}>
            {/* Vertical line from parent */}
            <path
              d={generateHandDrawnLine(fromX, fromY, fromX, midY, i * 10)}
              stroke={theme.border}
              strokeWidth={2}
              fill="none"
            />
            {/* Horizontal line */}
            <path
              d={generateHandDrawnLine(fromX, midY, toX, midY, i * 10 + 1)}
              stroke={theme.border}
              strokeWidth={2}
              fill="none"
            />
            {/* Vertical line to child */}
            <path
              d={generateHandDrawnLine(toX, midY, toX, toY, i * 10 + 2)}
              stroke={theme.border}
              strokeWidth={2}
              fill="none"
            />
            {/* Arrow head */}
            <polygon
              points={`${toX},${toY} ${toX - 5},${toY - 8} ${toX + 5},${toY - 8}`}
              fill={theme.border}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {treeNodes.map((node, index) => {
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
            <path
              d={generateHandDrawnRect(node.x, node.y, nodeWidth, nodeHeight, index)}
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
              x={node.x + nodeWidth / 2}
              y={node.y + 22}
              textAnchor="middle"
              fontSize={12}
              fontWeight="600"
              fill={isHovered ? '#ffffff' : colors.text}
              fontFamily={excalidrawFontFamily}
            >
              {node.label.length > 16 ? node.label.substring(0, 14) + '...' : node.label}
            </text>

            {/* Node value */}
            {(node.value !== undefined || node.valueLabel) && (
              <text
                x={node.x + nodeWidth / 2}
                y={node.y + 42}
                textAnchor="middle"
                fontSize={14}
                fontWeight="700"
                fill={isHovered ? '#ffffff' : colors.text}
                fontFamily={excalidrawFontFamily}
              >
                {node.valueLabel || formatValue(node.value)}
              </text>
            )}

            {/* Percentage badge */}
            {node.percentage !== undefined && (
              <g>
                <rect
                  x={node.x + nodeWidth - 35}
                  y={node.y - 8}
                  width={40}
                  height={18}
                  rx={9}
                  fill={colors.border}
                />
                <text
                  x={node.x + nodeWidth - 15}
                  y={node.y + 5}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="600"
                  fill="#ffffff"
                  fontFamily={excalidrawFontFamilyUI}
                >
                  {node.percentage}%
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Level labels */}
      {treeData.levels.length > 1 && (
        <g>
          {treeData.levels.map((level, i) => {
            if (level.length === 0) return null;
            const y = level[0].y + nodeHeight / 2;
            return (
              <text
                key={`level-${i}`}
                x={30}
                y={y}
                textAnchor="middle"
                fontSize={10}
                fill={theme.muted}
                fontFamily={excalidrawFontFamilyUI}
                transform={`rotate(-90, 30, ${y})`}
              >
                Level {i + 1}
              </text>
            );
          })}
        </g>
      )}
    </g>
  );
}

export default HierarchyRenderer;

import { useEffect, useRef, useMemo, useState } from "react";
import { useLocation } from "wouter";
import useSWR from "swr";
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from "d3-sankey";
import { apiFetcher } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// Types for the API response
interface RelationshipCompany {
  asset_id: number | null;
  private_id: number | null;
  symbol: string | null;
  name: string;
  tier_number: number;
  tier_name: string;
  category_name?: string;
  market_cap?: number;
  is_private: boolean;
}

interface Relationship {
  relationship_id: number;
  supplier: RelationshipCompany;
  customer: RelationshipCompany;
  relationship_type: string;
  relationship_strength: "critical" | "strong" | "medium";
  description: string;
  products_services: string[];
  revenue_dependency_percent: number | null;
}

// Tier colors matching the main supply chain map
const tierColors: Record<number, { bg: string; text: string; stroke: string }> = {
  [-1]: { bg: "#f59e0b", text: "#fef3c7", stroke: "#d97706" }, // Raw Materials - amber
  [0]: { bg: "#64748b", text: "#f1f5f9", stroke: "#475569" },  // Wafer-Level - slate
  [1]: { bg: "#ef4444", text: "#fef2f2", stroke: "#dc2626" },  // Chip Integration - red
  [2]: { bg: "#3b82f6", text: "#eff6ff", stroke: "#2563eb" },  // System Integration - blue
  [3]: { bg: "#a855f7", text: "#faf5ff", stroke: "#9333ea" },  // Data Center - purple
  [4]: { bg: "#10b981", text: "#ecfdf5", stroke: "#059669" },  // Cloud - emerald
  [5]: { bg: "#f97316", text: "#fff7ed", stroke: "#ea580c" },  // Application - orange
  [6]: { bg: "#06b6d4", text: "#ecfeff", stroke: "#0891b2" },  // Physical AI - cyan
};

const tierNames: Record<number, string> = {
  [-1]: "Raw Materials",
  [0]: "Equipment",
  [1]: "Chips",
  [2]: "Systems",
  [3]: "Data Centers",
  [4]: "Cloud",
  [5]: "Applications",
  [6]: "Physical AI",
};

// Format large numbers
function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

// Custom node type for sankey
interface CustomNode extends SankeyNode<{}, {}> {
  id: string;
  name: string;
  symbol: string | null;
  tier: number;
  market_cap: number | null;
  asset_id: number | null;
  is_private: boolean;
}

interface CustomLink extends SankeyLink<{}, {}> {
  strength: "critical" | "strong" | "medium";
  description: string;
  dependency: number | null;
}

export default function SupplyChainSankey() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setLocation] = useLocation();
  const [hoveredNode, setHoveredNode] = useState<CustomNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<CustomLink | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Fetch relationships data
  const { data: relationships, error, isLoading } = useSWR<Relationship[]>(
    '/api/supply-chain/relationships',
    apiFetcher,
    { revalidateOnFocus: false }
  );

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const { width, height } = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width: Math.max(width - 40, 800), height: Math.max(height - 40, 600) });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Process data into sankey format
  const sankeyData = useMemo(() => {
    if (!relationships) return null;

    // Create unique nodes from relationships
    const nodeMap = new Map<string, CustomNode>();
    
    relationships.forEach(rel => {
      const supplierId = rel.supplier.asset_id 
        ? `asset-${rel.supplier.asset_id}` 
        : `private-${rel.supplier.private_id}`;
      const customerId = rel.customer.asset_id 
        ? `asset-${rel.customer.asset_id}` 
        : `private-${rel.customer.private_id}`;

      if (!nodeMap.has(supplierId)) {
        nodeMap.set(supplierId, {
          id: supplierId,
          name: rel.supplier.name,
          symbol: rel.supplier.symbol,
          tier: rel.supplier.tier_number,
          market_cap: rel.supplier.market_cap || null,
          asset_id: rel.supplier.asset_id,
          is_private: rel.supplier.is_private,
        } as CustomNode);
      }

      if (!nodeMap.has(customerId)) {
        nodeMap.set(customerId, {
          id: customerId,
          name: rel.customer.name,
          symbol: rel.customer.symbol,
          tier: rel.customer.tier_number,
          market_cap: rel.customer.market_cap || null,
          asset_id: rel.customer.asset_id,
          is_private: rel.customer.is_private,
        } as CustomNode);
      }
    });

    const nodes = Array.from(nodeMap.values());
    
    // Sort nodes by tier for better layout
    nodes.sort((a, b) => a.tier - b.tier);

    // Create node index map
    const nodeIndex = new Map<string, number>();
    nodes.forEach((node, i) => nodeIndex.set(node.id, i));

    // Create links
    const links: CustomLink[] = relationships.map(rel => {
      const supplierId = rel.supplier.asset_id 
        ? `asset-${rel.supplier.asset_id}` 
        : `private-${rel.supplier.private_id}`;
      const customerId = rel.customer.asset_id 
        ? `asset-${rel.customer.asset_id}` 
        : `private-${rel.customer.private_id}`;

      return {
        source: nodeIndex.get(supplierId)!,
        target: nodeIndex.get(customerId)!,
        value: rel.relationship_strength === 'critical' ? 3 : rel.relationship_strength === 'strong' ? 2 : 1,
        strength: rel.relationship_strength,
        description: rel.description,
        dependency: rel.revenue_dependency_percent,
      } as CustomLink;
    });

    return { nodes, links };
  }, [relationships]);

  // Generate sankey layout
  const layout = useMemo(() => {
    if (!sankeyData) return null;

    const sankeyGenerator = sankey<CustomNode, CustomLink>()
      .nodeId((d) => d.id)
      .nodeWidth(20)
      .nodePadding(15)
      .nodeSort((a, b) => (a.tier - b.tier) || (b.market_cap || 0) - (a.market_cap || 0))
      .extent([[50, 50], [dimensions.width - 50, dimensions.height - 50]]);

    return sankeyGenerator({
      nodes: sankeyData.nodes.map(d => ({ ...d })),
      links: sankeyData.links.map(d => ({ ...d })),
    });
  }, [sankeyData, dimensions]);

  const handleNodeClick = (node: CustomNode) => {
    if (node.asset_id && !node.is_private) {
      setLocation(`/asset/${node.asset_id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/30 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2 text-muted-foreground">Loading supply chain flow...</span>
      </div>
    );
  }

  if (error || !layout) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/30 rounded-lg">
        <span className="text-destructive">Failed to load supply chain data</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[700px] bg-black/30 rounded-lg overflow-hidden">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-black/70 rounded-lg p-3 text-xs">
        <div className="font-semibold mb-2 text-white">Supply Chain Flow</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-red-500 rounded" />
            <span className="text-gray-300">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-yellow-500 rounded" />
            <span className="text-gray-300">Strong</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 bg-gray-500 rounded" />
            <span className="text-gray-300">Medium</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-white/20">
          <div className="text-gray-400">{layout.nodes.length} Companies</div>
          <div className="text-gray-400">{layout.links.length} Relationships</div>
        </div>
      </div>

      {/* Tier Labels */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-4">
        {Object.entries(tierNames).map(([tier, name]) => (
          <Badge 
            key={tier} 
            style={{ backgroundColor: tierColors[Number(tier)]?.bg }}
            className="text-white text-xs"
          >
            {name}
          </Badge>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <Card className="absolute z-20 p-3 bg-black/90 border-white/20 text-white max-w-xs"
          style={{ 
            left: Math.min((hoveredNode.x0 || 0) + 30, dimensions.width - 200), 
            top: (hoveredNode.y0 || 0) 
          }}
        >
          <div className="font-semibold">{hoveredNode.symbol || hoveredNode.name}</div>
          <div className="text-sm text-gray-300">{hoveredNode.name}</div>
          <div className="text-xs text-gray-400 mt-1">{tierNames[hoveredNode.tier]}</div>
          {hoveredNode.market_cap && (
            <div className="text-sm text-green-400 mt-1">
              {formatLargeNumber(hoveredNode.market_cap)}
            </div>
          )}
          {!hoveredNode.is_private && (
            <div className="text-xs text-blue-400 mt-2">Click to view details</div>
          )}
        </Card>
      )}

      {hoveredLink && (
        <Card className="absolute z-20 p-3 bg-black/90 border-white/20 text-white max-w-xs pointer-events-none"
          style={{ left: dimensions.width / 2 - 100, top: dimensions.height / 2 }}
        >
          <div className="text-sm">{hoveredLink.description}</div>
          {hoveredLink.dependency && (
            <div className="text-xs text-yellow-400 mt-1">
              {hoveredLink.dependency}% revenue dependency
            </div>
          )}
          <Badge 
            className={cn(
              "mt-2 text-xs",
              hoveredLink.strength === 'critical' && "bg-red-500",
              hoveredLink.strength === 'strong' && "bg-yellow-500",
              hoveredLink.strength === 'medium' && "bg-gray-500"
            )}
          >
            {hoveredLink.strength}
          </Badge>
        </Card>
      )}

      {/* SVG Sankey Diagram */}
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height}>
        <defs>
          {/* Gradient definitions for links */}
          {layout.links.map((link, i) => {
            const sourceNode = link.source as CustomNode;
            const targetNode = link.target as CustomNode;
            return (
              <linearGradient key={i} id={`gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={tierColors[sourceNode.tier]?.bg || '#666'} stopOpacity={0.6} />
                <stop offset="100%" stopColor={tierColors[targetNode.tier]?.bg || '#666'} stopOpacity={0.6} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Links */}
        <g>
          {layout.links.map((link, i) => {
            const customLink = link as CustomLink;
            const strokeColor = customLink.strength === 'critical' 
              ? 'rgba(239, 68, 68, 0.7)' 
              : customLink.strength === 'strong' 
                ? 'rgba(234, 179, 8, 0.5)' 
                : 'rgba(107, 114, 128, 0.3)';
            
            return (
              <path
                key={i}
                d={sankeyLinkHorizontal()(link) || ''}
                fill="none"
                stroke={strokeColor}
                strokeWidth={Math.max(1, link.width || 1)}
                opacity={hoveredLink === customLink ? 1 : 0.7}
                className="transition-opacity cursor-pointer"
                onMouseEnter={() => setHoveredLink(customLink)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                {customLink.strength === 'critical' && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="20"
                    to="0"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                )}
              </path>
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {layout.nodes.map((node, i) => {
            const customNode = node as CustomNode;
            const color = tierColors[customNode.tier] || tierColors[0];
            const isHovered = hoveredNode?.id === customNode.id;
            
            return (
              <g key={i}>
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={(node.x1 || 0) - (node.x0 || 0)}
                  height={(node.y1 || 0) - (node.y0 || 0)}
                  fill={color.bg}
                  stroke={isHovered ? '#fff' : color.stroke}
                  strokeWidth={isHovered ? 2 : 1}
                  rx={3}
                  className={cn(
                    "transition-all cursor-pointer",
                    !customNode.is_private && "hover:stroke-white hover:stroke-2"
                  )}
                  onMouseEnter={() => setHoveredNode(customNode)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick(customNode)}
                />
                {/* Node label */}
                <text
                  x={(node.x1 || 0) + 5}
                  y={((node.y0 || 0) + (node.y1 || 0)) / 2}
                  dy="0.35em"
                  fontSize={10}
                  fill="#fff"
                  className="pointer-events-none"
                >
                  {customNode.symbol || customNode.name.slice(0, 15)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

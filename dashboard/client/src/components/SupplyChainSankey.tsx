import { useEffect, useRef, useMemo, useState } from "react";
import { useLocation } from "wouter";
import useSWR from "swr";
import { apiFetcher } from "@/lib/api-config";

// Types
interface RelationshipCompany {
  asset_id: number | null;
  private_id: number | null;
  symbol: string | null;
  name: string;
  tier_number: number;
  tier_name: string;
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
}

// Tier colors
const tierColors: Record<number, string> = {
  [-1]: "#f59e0b",
  [0]: "#64748b",
  [1]: "#ef4444",
  [2]: "#3b82f6",
  [3]: "#a855f7",
  [4]: "#10b981",
  [5]: "#f97316",
  [6]: "#06b6d4",
};

const tierNames: Record<number, string> = {
  [-1]: "Raw Materials",
  [0]: "Wafer-Level",
  [1]: "Chip Integration",
  [2]: "System Integration",
  [3]: "Data Center",
  [4]: "Cloud",
  [5]: "Application",
  [6]: "Physical AI",
};

interface NodePosition {
  id: string;
  name: string;
  symbol: string | null;
  tier: number;
  asset_id: number | null;
  is_private: boolean;
  x: number;
  y: number;
}

export default function SupplyChainSankey() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  const { data: relationships, isLoading } = useSWR<Relationship[]>(
    "/api/supply-chain/relationships",
    apiFetcher
  );

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(width - 40, 800), height: Math.max(height - 40, 600) });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const { nodes, links, tierGroups } = useMemo(() => {
    if (!relationships || relationships.length === 0) {
      return { nodes: [], links: [], tierGroups: {} };
    }

    const nodeMap = new Map<string, NodePosition>();
    const linkList: { source: string; target: string; strength: string }[] = [];
    const tierCounts: Record<number, number> = {};

    // First pass: collect all nodes and count per tier
    relationships.forEach((rel) => {
      const supplierId = rel.supplier.asset_id 
        ? `public_${rel.supplier.asset_id}` 
        : `private_${rel.supplier.private_id}`;
      
      if (!nodeMap.has(supplierId)) {
        tierCounts[rel.supplier.tier_number] = (tierCounts[rel.supplier.tier_number] || 0) + 1;
        nodeMap.set(supplierId, {
          id: supplierId,
          name: rel.supplier.name,
          symbol: rel.supplier.symbol,
          tier: rel.supplier.tier_number,
          asset_id: rel.supplier.asset_id,
          is_private: rel.supplier.is_private,
          x: 0,
          y: 0,
        });
      }

      const customerId = rel.customer.asset_id 
        ? `public_${rel.customer.asset_id}` 
        : `private_${rel.customer.private_id}`;
      
      if (!nodeMap.has(customerId)) {
        tierCounts[rel.customer.tier_number] = (tierCounts[rel.customer.tier_number] || 0) + 1;
        nodeMap.set(customerId, {
          id: customerId,
          name: rel.customer.name,
          symbol: rel.customer.symbol,
          tier: rel.customer.tier_number,
          asset_id: rel.customer.asset_id,
          is_private: rel.customer.is_private,
          x: 0,
          y: 0,
        });
      }

      linkList.push({
        source: supplierId,
        target: customerId,
        strength: rel.relationship_strength,
      });
    });

    // Calculate positions
    const { width, height } = dimensions;
    const tiers = Array.from(new Set(Array.from(nodeMap.values()).map(n => n.tier))).sort((a, b) => a - b);
    const tierWidth = (width - 200) / (tiers.length - 1 || 1);
    const tierPositions: Record<number, number> = {};
    tiers.forEach((tier, i) => {
      tierPositions[tier] = 100 + i * tierWidth;
    });

    // Position nodes within tiers
    const tierNodeCounts: Record<number, number> = {};
    const nodes = Array.from(nodeMap.values()).map(node => {
      const tierIndex = tierNodeCounts[node.tier] || 0;
      tierNodeCounts[node.tier] = tierIndex + 1;
      const nodesInTier = tierCounts[node.tier] || 1;
      const ySpacing = (height - 100) / (nodesInTier + 1);
      
      return {
        ...node,
        x: tierPositions[node.tier] || 100,
        y: 50 + (tierIndex + 1) * ySpacing,
      };
    });

    // Group nodes by tier for labels
    const tierGroups: Record<number, NodePosition[]> = {};
    nodes.forEach(node => {
      if (!tierGroups[node.tier]) tierGroups[node.tier] = [];
      tierGroups[node.tier].push(node);
    });

    return { nodes, links: linkList, tierGroups };
  }, [relationships, dimensions]);

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2 text-muted-foreground">Loading relationships...</span>
      </div>
    );
  }

  if (!relationships || relationships.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/50 rounded-lg">
        <span className="text-muted-foreground">No relationship data available</span>
      </div>
    );
  }

  const filteredNodes = selectedTier !== null 
    ? nodes.filter(n => n.tier === selectedTier || 
        links.some(l => {
          const source = getNodeById(l.source);
          const target = getNodeById(l.target);
          return (source?.tier === selectedTier && target?.id === n.id) ||
                 (target?.tier === selectedTier && source?.id === n.id) ||
                 n.tier === selectedTier;
        }))
    : nodes;

  const filteredLinks = selectedTier !== null
    ? links.filter(l => {
        const source = getNodeById(l.source);
        const target = getNodeById(l.target);
        return source?.tier === selectedTier || target?.tier === selectedTier;
      })
    : links;

  return (
    <div className="space-y-4">
      {/* Tier Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter by tier:</span>
        <button
          onClick={() => setSelectedTier(null)}
          className={`px-3 py-1 text-xs rounded-full transition-colors ${
            selectedTier === null 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          All
        </button>
        {Object.entries(tierNames).map(([tier, name]) => {
          const tierNum = parseInt(tier);
          if (!tierGroups[tierNum]) return null;
          return (
            <button
              key={tier}
              onClick={() => setSelectedTier(tierNum)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedTier === tierNum 
                  ? 'text-white' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
              style={{ 
                backgroundColor: selectedTier === tierNum ? tierColors[tierNum] : undefined 
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">Relationship strength:</span>
        <div className="flex items-center gap-1">
          <div className="w-8 h-1 bg-red-500 rounded" />
          <span>Critical</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-1 bg-yellow-500 rounded" />
          <span>Strong</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-1 bg-gray-500 rounded" />
          <span>Medium</span>
        </div>
      </div>

      {/* SVG Visualization */}
      <div 
        ref={containerRef} 
        className="bg-black/30 rounded-lg border border-border overflow-hidden"
        style={{ height: '700px' }}
      >
        <svg width={dimensions.width} height={dimensions.height}>
          {/* Tier Labels */}
          {Object.entries(tierGroups).map(([tier, tierNodes]) => {
            const tierNum = parseInt(tier);
            if (tierNodes.length === 0) return null;
            const x = tierNodes[0].x;
            return (
              <g key={tier}>
                <text
                  x={x}
                  y={25}
                  textAnchor="middle"
                  fill={tierColors[tierNum]}
                  fontSize="12"
                  fontWeight="bold"
                >
                  {tierNames[tierNum]}
                </text>
              </g>
            );
          })}

          {/* Links */}
          <g>
            {filteredLinks.map((link, i) => {
              const source = getNodeById(link.source);
              const target = getNodeById(link.target);
              if (!source || !target) return null;
              
              const isHighlighted = hoveredNode === link.source || hoveredNode === link.target;
              const strokeColor = link.strength === 'critical' 
                ? '#ef4444' 
                : link.strength === 'strong' 
                  ? '#eab308' 
                  : '#6b7280';
              
              // Create curved path
              const midX = (source.x + target.x) / 2;
              const path = `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;
              
              return (
                <path
                  key={i}
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={link.strength === 'critical' ? 3 : link.strength === 'strong' ? 2 : 1}
                  strokeOpacity={hoveredNode ? (isHighlighted ? 0.8 : 0.1) : 0.4}
                  className="transition-opacity duration-200"
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {filteredNodes.map((node) => {
              const isHovered = hoveredNode === node.id;
              const isConnected = hoveredNode && links.some(
                l => (l.source === hoveredNode && l.target === node.id) ||
                     (l.target === hoveredNode && l.source === node.id)
              );
              const opacity = hoveredNode ? (isHovered || isConnected ? 1 : 0.3) : 1;
              
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: node.is_private ? 'default' : 'pointer', opacity }}
                  className="transition-opacity duration-200"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => {
                    if (node.asset_id && !node.is_private) {
                      setLocation(`/asset/${node.asset_id}`);
                    }
                  }}
                >
                  <circle
                    r={isHovered ? 28 : 24}
                    fill={tierColors[node.tier]}
                    fillOpacity={0.2}
                    stroke={tierColors[node.tier]}
                    strokeWidth={2}
                    className="transition-all duration-200"
                  />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fill="white"
                    fontSize={isHovered ? "11" : "10"}
                    fontWeight="bold"
                  >
                    {node.symbol || node.name.slice(0, 4)}
                  </text>
                  {node.is_private && (
                    <text
                      textAnchor="middle"
                      dy="2.5em"
                      fill="#9ca3af"
                      fontSize="8"
                    >
                      (Private)
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>{filteredNodes.length} companies</span>
        <span>{filteredLinks.length} relationships</span>
        <span>{Object.keys(tierGroups).length} tiers</span>
      </div>
    </div>
  );
}

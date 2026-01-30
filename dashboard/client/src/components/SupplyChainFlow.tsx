import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle,
  NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import useSWR from "swr";
import { apiFetcher } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// Types for the relationships API response
interface RelationshipCompany {
  asset_id: number | null;
  private_id: number | null;
  symbol: string | null;
  name: string;
  tier_number: number;
  tier_name: string;
  category_name: string;
  market_cap: number | null;
  is_private: boolean;
}

interface SupplyChainRelationship {
  relationship_id: number;
  supplier: RelationshipCompany;
  customer: RelationshipCompany;
  relationship_type: string;
  relationship_strength: string;
  description: string;
  products_services: string[];
  revenue_dependency_percent: number | null;
}

// Color mapping for tiers
const tierColors: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: "bg-amber-900/30", border: "border-amber-500", text: "text-amber-400" },
  1: { bg: "bg-slate-800/50", border: "border-slate-500", text: "text-slate-300" },
  2: { bg: "bg-red-900/30", border: "border-red-500", text: "text-red-400" },
  3: { bg: "bg-blue-900/30", border: "border-blue-500", text: "text-blue-400" },
  4: { bg: "bg-purple-900/30", border: "border-purple-500", text: "text-purple-400" },
  5: { bg: "bg-emerald-900/30", border: "border-emerald-500", text: "text-emerald-400" },
  6: { bg: "bg-orange-900/30", border: "border-orange-500", text: "text-orange-400" },
  7: { bg: "bg-cyan-900/30", border: "border-cyan-500", text: "text-cyan-400" },
};

// Edge colors based on relationship strength
const strengthColors: Record<string, string> = {
  critical: "#ef4444", // red
  strong: "#f59e0b", // amber
  medium: "#6b7280", // gray
  weak: "#374151", // dark gray
};

// Format large numbers
function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

// Node data type
interface CompanyNodeData {
  symbol: string | null;
  name: string;
  market_cap: number | null;
  tier_number: number;
  tier_name: string;
  asset_id: number | null;
  is_private: boolean;
}

// Custom node component
function CompanyNode({ data, selected }: NodeProps) {
  const [, setLocation] = useLocation();
  const nodeData = data as unknown as CompanyNodeData;
  const colors = tierColors[nodeData.tier_number] || tierColors[0];
  
  const handleClick = () => {
    if (nodeData.asset_id && !nodeData.is_private) {
      setLocation(`/asset/${nodeData.asset_id}`);
    }
  };
  
  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 min-w-[120px] max-w-[180px] cursor-pointer transition-all",
        colors.bg,
        colors.border,
        selected && "ring-2 ring-white ring-offset-2 ring-offset-black"
      )}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
      
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {nodeData.symbol && (
            <Badge variant="outline" className={cn("text-xs font-mono", colors.text)}>
              {nodeData.symbol}
            </Badge>
          )}
          {nodeData.is_private && (
            <Badge variant="outline" className="text-xs text-gray-400">
              Private
            </Badge>
          )}
        </div>
        <div className="text-xs text-gray-300 truncate font-medium">
          {nodeData.name}
        </div>
        {nodeData.market_cap && (
          <div className="text-xs text-gray-500">
            {formatLargeNumber(nodeData.market_cap)}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  company: CompanyNode,
};

// Main component
export function SupplyChainFlow() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  
  // Fetch relationships data
  const { data: relationships, error, isLoading } = useSWR<SupplyChainRelationship[]>(
    "/api/supply-chain/relationships",
    apiFetcher,
    { revalidateOnFocus: false }
  );
  
  // Build nodes and edges from relationships
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!relationships || relationships.length === 0) {
      return { nodes: [], edges: [] };
    }
    
    // Collect unique companies
    const companiesMap = new Map<string, RelationshipCompany & { x: number; y: number }>();
    
    // Track companies by tier for positioning
    const tierCompanies: Map<number, string[]> = new Map();
    
    relationships.forEach((rel) => {
      // Add supplier
      const supplierId = rel.supplier.asset_id 
        ? `asset-${rel.supplier.asset_id}` 
        : `private-${rel.supplier.private_id}`;
      
      if (!companiesMap.has(supplierId)) {
        companiesMap.set(supplierId, { ...rel.supplier, x: 0, y: 0 });
        const tier = rel.supplier.tier_number;
        if (!tierCompanies.has(tier)) tierCompanies.set(tier, []);
        tierCompanies.get(tier)!.push(supplierId);
      }
      
      // Add customer
      const customerId = rel.customer.asset_id 
        ? `asset-${rel.customer.asset_id}` 
        : `private-${rel.customer.private_id}`;
      
      if (!companiesMap.has(customerId)) {
        companiesMap.set(customerId, { ...rel.customer, x: 0, y: 0 });
        const tier = rel.customer.tier_number;
        if (!tierCompanies.has(tier)) tierCompanies.set(tier, []);
        tierCompanies.get(tier)!.push(customerId);
      }
    });
    
    // Position nodes by tier (horizontal layout)
    const tierSpacing = 300;
    const nodeSpacing = 120;
    
    // Sort tiers
    const sortedTiers = Array.from(tierCompanies.keys()).sort((a, b) => a - b);
    
    sortedTiers.forEach((tier, tierIndex) => {
      const companies = tierCompanies.get(tier)!;
      const tierX = tierIndex * tierSpacing + 100;
      
      // Sort companies by market cap within tier
      companies.sort((a, b) => {
        const compA = companiesMap.get(a)!;
        const compB = companiesMap.get(b)!;
        return (compB.market_cap || 0) - (compA.market_cap || 0);
      });
      
      companies.forEach((companyId, index) => {
        const company = companiesMap.get(companyId)!;
        company.x = tierX;
        company.y = index * nodeSpacing + 50;
      });
    });
    
    // Create nodes
    const nodes: Node[] = Array.from(companiesMap.entries()).map(([id, company]) => ({
      id,
      type: "company",
      position: { x: company.x, y: company.y },
      data: {
        symbol: company.symbol,
        name: company.name,
        market_cap: company.market_cap,
        tier_number: company.tier_number,
        tier_name: company.tier_name,
        asset_id: company.asset_id,
        is_private: company.is_private,
      },
    }));
    
    // Create edges
    const edges: Edge[] = relationships.map((rel) => {
      const sourceId = rel.supplier.asset_id 
        ? `asset-${rel.supplier.asset_id}` 
        : `private-${rel.supplier.private_id}`;
      const targetId = rel.customer.asset_id 
        ? `asset-${rel.customer.asset_id}` 
        : `private-${rel.customer.private_id}`;
      
      return {
        id: `edge-${rel.relationship_id}`,
        source: sourceId,
        target: targetId,
        type: "smoothstep",
        animated: rel.relationship_strength === "critical",
        style: {
          stroke: strengthColors[rel.relationship_strength] || strengthColors.medium,
          strokeWidth: rel.relationship_strength === "critical" ? 3 : 
                       rel.relationship_strength === "strong" ? 2 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strengthColors[rel.relationship_strength] || strengthColors.medium,
        },
        label: rel.revenue_dependency_percent ? `${rel.revenue_dependency_percent}%` : undefined,
        labelStyle: { fill: "#9ca3af", fontSize: 10 },
        labelBgStyle: { fill: "#1f2937", fillOpacity: 0.8 },
        data: {
          description: rel.description,
          products: rel.products_services,
          strength: rel.relationship_strength,
        },
      };
    });
    
    return { nodes, edges };
  }, [relationships]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  // Update nodes/edges when data changes
  useMemo(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);
  
  // Handle node selection to highlight connected edges
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    
    // Find all edges connected to this node
    const connectedEdgeIds = new Set<string>();
    edges.forEach((edge) => {
      if (edge.source === node.id || edge.target === node.id) {
        connectedEdgeIds.add(edge.id);
      }
    });
    setHighlightedEdges(connectedEdgeIds);
  }, [edges]);
  
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightedEdges(new Set());
  }, []);
  
  // Apply highlighting to edges
  const styledEdges = useMemo(() => {
    if (highlightedEdges.size === 0) return edges;
    
    return edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity: highlightedEdges.has(edge.id) ? 1 : 0.15,
        strokeWidth: highlightedEdges.has(edge.id) 
          ? (edge.style?.strokeWidth as number || 1) * 1.5 
          : edge.style?.strokeWidth,
      },
    }));
  }, [edges, highlightedEdges]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/50 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-400">Loading supply chain relationships...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/50 rounded-lg">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <span className="ml-2 text-red-400">Failed to load relationships</span>
      </div>
    );
  }
  
  if (!relationships || relationships.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-black/50 rounded-lg">
        <span className="text-gray-400">No supply chain relationships found</span>
      </div>
    );
  }
  
  return (
    <div className="h-[700px] bg-black/50 rounded-lg border border-gray-800 relative">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-gray-900/90 rounded-lg p-3 border border-gray-700">
        <div className="text-xs font-medium text-gray-300 mb-2">Relationship Strength</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-red-500" style={{ animation: "pulse 2s infinite" }} />
            <span className="text-xs text-gray-400">Critical (animated)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-amber-500" />
            <span className="text-xs text-gray-400">Strong</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-500" />
            <span className="text-xs text-gray-400">Medium</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Click a company to highlight its connections
        </div>
      </div>
      
      {/* Stats */}
      <div className="absolute top-4 right-4 z-10 bg-gray-900/90 rounded-lg p-3 border border-gray-700">
        <div className="text-xs text-gray-400">
          <span className="font-medium text-gray-300">{nodes.length}</span> Companies
        </div>
        <div className="text-xs text-gray-400">
          <span className="font-medium text-gray-300">{edges.length}</span> Relationships
        </div>
      </div>
      
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
        <Controls 
          className="!bg-gray-900 !border-gray-700 !rounded-lg"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}

export default SupplyChainFlow;

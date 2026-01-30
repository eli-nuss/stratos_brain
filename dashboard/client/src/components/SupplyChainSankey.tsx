import { useEffect, useRef, useMemo, useState } from "react";
import { useLocation } from "wouter";
import useSWR from "swr";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from "d3-sankey";
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

interface SankeyNodeData {
  id: string;
  name: string;
  symbol: string | null;
  tier: number;
  asset_id: number | null;
  is_private: boolean;
}

interface SankeyLinkData {
  source: string;
  target: string;
  value: number;
  strength: string;
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

export default function SupplyChainSankey() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { data: relationships } = useSWR<Relationship[]>(
    "/api/supply-chain/relationships",
    apiFetcher
  );

  const { nodes, links } = useMemo(() => {
    if (!relationships || relationships.length === 0) {
      return { nodes: [], links: [] };
    }

    const nodeMap = new Map<string, SankeyNodeData>();
    const linkList: SankeyLinkData[] = [];

    relationships.forEach((rel) => {
      const supplierId = rel.supplier.asset_id 
        ? `public_${rel.supplier.asset_id}` 
        : `private_${rel.supplier.private_id}`;
      
      if (!nodeMap.has(supplierId)) {
        nodeMap.set(supplierId, {
          id: supplierId,
          name: rel.supplier.name,
          symbol: rel.supplier.symbol,
          tier: rel.supplier.tier_number,
          asset_id: rel.supplier.asset_id,
          is_private: rel.supplier.is_private,
        });
      }

      const customerId = rel.customer.asset_id 
        ? `public_${rel.customer.asset_id}` 
        : `private_${rel.customer.private_id}`;
      
      if (!nodeMap.has(customerId)) {
        nodeMap.set(customerId, {
          id: customerId,
          name: rel.customer.name,
          symbol: rel.customer.symbol,
          tier: rel.customer.tier_number,
          asset_id: rel.customer.asset_id,
          is_private: rel.customer.is_private,
        });
      }

      linkList.push({
        source: supplierId,
        target: customerId,
        value: rel.relationship_strength === "critical" ? 3 : rel.relationship_strength === "strong" ? 2 : 1,
        strength: rel.relationship_strength,
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: linkList,
    };
  }, [relationships]);

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

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0 || links.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;

    const sankeyGenerator = sankey<SankeyNodeData, SankeyLinkData>()
      .nodeId((d) => d.id)
      .nodeWidth(20)
      .nodePadding(15)
      .extent([[150, 20], [width - 150, height - 20]])
      .nodeSort((a, b) => a.tier - b.tier);

    const sankeyData = sankeyGenerator({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ 
        source: d.source, 
        target: d.target, 
        value: d.value,
        strength: d.strength 
      })),
    });

    const g = svg.append("g");

    // Links
    g.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(sankeyData.links)
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d: any) => {
        const sourceNode = d.source as SankeyNode<SankeyNodeData, SankeyLinkData>;
        return tierColors[sourceNode.tier] || "#666";
      })
      .attr("stroke-opacity", (d: any) => {
        if (hoveredNode) {
          const sourceNode = d.source as SankeyNode<SankeyNodeData, SankeyLinkData>;
          const targetNode = d.target as SankeyNode<SankeyNodeData, SankeyLinkData>;
          return sourceNode.id === hoveredNode || targetNode.id === hoveredNode ? 0.7 : 0.1;
        }
        return d.strength === "critical" ? 0.6 : d.strength === "strong" ? 0.4 : 0.25;
      })
      .attr("stroke-width", (d: any) => Math.max(1, d.width));

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(sankeyData.nodes)
      .join("g")
      .attr("transform", (d: any) => `translate(${d.x0},${d.y0})`)
      .style("cursor", "pointer")
      .on("mouseenter", (_: any, d: any) => setHoveredNode(d.id))
      .on("mouseleave", () => setHoveredNode(null))
      .on("click", (_: any, d: any) => {
        if (d.asset_id && !d.is_private) {
          setLocation(`/asset/${d.asset_id}`);
        }
      });

    node.append("rect")
      .attr("height", (d: any) => Math.max(d.y1 - d.y0, 4))
      .attr("width", (d: any) => d.x1 - d.x0)
      .attr("fill", (d: any) => tierColors[d.tier] || "#666")
      .attr("opacity", (d: any) => hoveredNode ? (d.id === hoveredNode ? 1 : 0.3) : 0.9)
      .attr("rx", 3);

    node.append("text")
      .attr("x", (d: any) => d.x0 < width / 2 ? (d.x1 - d.x0) + 8 : -8)
      .attr("y", (d: any) => (d.y1 - d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", (d: any) => d.x0 < width / 2 ? "start" : "end")
      .attr("fill", "#e5e5e5")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .text((d: any) => d.symbol || d.name.split(" ")[0]);

  }, [nodes, links, dimensions, hoveredNode, setLocation]);

  if (!relationships || relationships.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p>Loading supply chain relationships...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-[calc(100vh-200px)] min-h-[600px] relative">
      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 z-10">
        <div className="text-xs text-gray-400 mb-2 font-medium">Supply Chain Tiers</div>
        <div className="space-y-1">
          {Object.entries(tierColors).map(([tier, color]) => (
            <div key={tier} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }}></div>
              <span className="text-xs text-gray-300">
                {tier === "-1" ? "Raw Materials" : 
                 tier === "0" ? "Equipment" :
                 tier === "1" ? "Chips" :
                 tier === "2" ? "Systems" :
                 tier === "3" ? "Data Centers" :
                 tier === "4" ? "Cloud" :
                 tier === "5" ? "Apps" : "Physical AI"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 z-10">
        <div className="text-xs text-gray-400">
          <p>• Hover over nodes to highlight connections</p>
          <p>• Click on public companies to view details</p>
          <p>• Flow: Left (suppliers) → Right (customers)</p>
        </div>
      </div>

      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="mx-auto" />
    </div>
  );
}

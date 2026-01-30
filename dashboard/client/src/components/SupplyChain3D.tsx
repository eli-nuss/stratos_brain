import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html, Line } from "@react-three/drei";
import { useLocation } from "wouter";
import useSWR from "swr";
import * as THREE from "three";
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

// Tier colors
const tierColors: Record<number, string> = {
  [-1]: "#f59e0b", // Raw Materials - amber
  [0]: "#64748b",  // Wafer-Level - slate
  [1]: "#ef4444",  // Chip Integration - red
  [2]: "#3b82f6",  // System Integration - blue
  [3]: "#a855f7",  // Data Center - purple
  [4]: "#10b981",  // Cloud - emerald
  [5]: "#f97316",  // Application - orange
  [6]: "#06b6d4",  // Physical AI - cyan
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

// Node data structure
interface NodeData {
  id: string;
  name: string;
  symbol: string | null;
  tier: number;
  market_cap: number | null;
  asset_id: number | null;
  is_private: boolean;
  position: [number, number, number];
}

interface LinkData {
  source: string;
  target: string;
  strength: "critical" | "strong" | "medium";
  description: string;
}

// 3D Node component
function Node3D({ 
  node, 
  isHovered, 
  isSelected,
  onHover, 
  onClick 
}: { 
  node: NodeData;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (node: NodeData | null) => void;
  onClick: (node: NodeData) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = tierColors[node.tier] || "#666";
  const scale = isHovered || isSelected ? 1.3 : 1;
  const size = node.market_cap ? Math.max(0.3, Math.min(1, Math.log10(node.market_cap / 1e9) * 0.2)) : 0.3;

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime + node.position[0]) * 0.1;
    }
  });

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        scale={scale}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); onClick(node); }}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={isHovered || isSelected ? 0.5 : 0.2}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      {/* Glow effect for important nodes */}
      {(node.market_cap && node.market_cap > 500e9) && (
        <mesh scale={scale * 1.2}>
          <sphereGeometry args={[size, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      )}

      {/* Label */}
      {(isHovered || isSelected || (node.market_cap && node.market_cap > 1e12)) && (
        <Html position={[0, size + 0.3, 0]} center>
          <div className="bg-black/80 px-2 py-1 rounded text-white text-xs whitespace-nowrap pointer-events-none">
            <div className="font-bold">{node.symbol || node.name.slice(0, 10)}</div>
            {node.market_cap && (
              <div className="text-green-400">{formatLargeNumber(node.market_cap)}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// Connection line component
function ConnectionLine({ 
  start, 
  end, 
  strength,
  isHighlighted 
}: { 
  start: [number, number, number];
  end: [number, number, number];
  strength: "critical" | "strong" | "medium";
  isHighlighted: boolean;
}) {
  const lineRef = useRef<THREE.Line>(null);
  
  const color = strength === 'critical' 
    ? '#ef4444' 
    : strength === 'strong' 
      ? '#eab308' 
      : '#6b7280';

  const opacity = isHighlighted ? 0.9 : strength === 'critical' ? 0.6 : 0.3;
  const lineWidth = strength === 'critical' ? 2 : strength === 'strong' ? 1.5 : 1;

  // Create curved path
  const curve = useMemo(() => {
    const midPoint: [number, number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2 + 1,
      (start[2] + end[2]) / 2,
    ];
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(...midPoint),
      new THREE.Vector3(...end)
    );
  }, [start, end]);

  const points = useMemo(() => curve.getPoints(30), [curve]);

  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
    />
  );
}

// Main 3D scene
function Scene({ 
  nodes, 
  links,
  hoveredNode,
  selectedNode,
  onHoverNode,
  onSelectNode
}: {
  nodes: NodeData[];
  links: LinkData[];
  hoveredNode: NodeData | null;
  selectedNode: NodeData | null;
  onHoverNode: (node: NodeData | null) => void;
  onSelectNode: (node: NodeData) => void;
}) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Get highlighted links (connected to hovered/selected node)
  const highlightedLinks = useMemo(() => {
    const activeNode = hoveredNode || selectedNode;
    if (!activeNode) return new Set<string>();
    
    const highlighted = new Set<string>();
    links.forEach(link => {
      if (link.source === activeNode.id || link.target === activeNode.id) {
        highlighted.add(`${link.source}-${link.target}`);
      }
    });
    return highlighted;
  }, [links, hoveredNode, selectedNode]);

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={0.4} />
      
      {/* Directional lights */}
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
      
      {/* Point lights for dramatic effect */}
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#ffffff" />
      
      {/* Connection lines */}
      {links.map((link, i) => {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        if (!sourceNode || !targetNode) return null;
        
        const isHighlighted = highlightedLinks.has(`${link.source}-${link.target}`);
        
        return (
          <ConnectionLine
            key={i}
            start={sourceNode.position}
            end={targetNode.position}
            strength={link.strength}
            isHighlighted={isHighlighted}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => (
        <Node3D
          key={node.id}
          node={node}
          isHovered={hoveredNode?.id === node.id}
          isSelected={selectedNode?.id === node.id}
          onHover={onHoverNode}
          onClick={onSelectNode}
        />
      ))}

      {/* Tier labels floating in space */}
      {Object.entries(tierNames).map(([tier, name], i) => {
        const tierNum = Number(tier);
        const x = (tierNum + 1) * 4 - 12;
        return (
          <Text
            key={tier}
            position={[x, 8, 0]}
            fontSize={0.5}
            color={tierColors[tierNum]}
            anchorX="center"
            anchorY="middle"
          >
            {name}
          </Text>
        );
      })}

      {/* Camera controls */}
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={50}
        autoRotate={!hoveredNode && !selectedNode}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export default function SupplyChain3D() {
  const [, setLocation] = useLocation();
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);

  // Fetch relationships data
  const { data: relationships, error, isLoading } = useSWR<Relationship[]>(
    '/api/supply-chain/relationships',
    apiFetcher,
    { revalidateOnFocus: false }
  );

  // Process data into 3D nodes and links
  const { nodes, links } = useMemo(() => {
    if (!relationships) return { nodes: [], links: [] };

    const nodeMap = new Map<string, NodeData>();
    const tierCounts: Record<number, number> = {};

    // Create nodes
    relationships.forEach(rel => {
      [rel.supplier, rel.customer].forEach(company => {
        const id = company.asset_id 
          ? `asset-${company.asset_id}` 
          : `private-${company.private_id}`;

        if (!nodeMap.has(id)) {
          const tier = company.tier_number;
          tierCounts[tier] = (tierCounts[tier] || 0) + 1;
          const count = tierCounts[tier];
          
          // Position nodes in a 3D space organized by tier
          const x = (tier + 1) * 4 - 12; // Spread tiers along X axis
          const y = (count % 5) * 2 - 4 + Math.random() * 0.5; // Stack within tier
          const z = Math.floor(count / 5) * 3 - 3 + Math.random() * 0.5; // Depth

          nodeMap.set(id, {
            id,
            name: company.name,
            symbol: company.symbol,
            tier: company.tier_number,
            market_cap: company.market_cap || null,
            asset_id: company.asset_id,
            is_private: company.is_private,
            position: [x, y, z],
          });
        }
      });
    });

    // Create links
    const linkList: LinkData[] = relationships.map(rel => ({
      source: rel.supplier.asset_id 
        ? `asset-${rel.supplier.asset_id}` 
        : `private-${rel.supplier.private_id}`,
      target: rel.customer.asset_id 
        ? `asset-${rel.customer.asset_id}` 
        : `private-${rel.customer.private_id}`,
      strength: rel.relationship_strength,
      description: rel.description,
    }));

    return { nodes: Array.from(nodeMap.values()), links: linkList };
  }, [relationships]);

  const handleNodeClick = useCallback((node: NodeData) => {
    if (selectedNode?.id === node.id) {
      // Double click - navigate to asset
      if (node.asset_id && !node.is_private) {
        setLocation(`/asset/${node.asset_id}`);
      }
    } else {
      setSelectedNode(node);
    }
  }, [selectedNode, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[700px] bg-black rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2 text-muted-foreground">Loading 3D visualization...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[700px] bg-black rounded-lg">
        <span className="text-destructive">Failed to load supply chain data</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[700px] bg-black rounded-lg overflow-hidden">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-10 bg-black/80 rounded-lg p-3 text-xs">
        <div className="font-semibold mb-2 text-white">3D Supply Chain</div>
        <div className="space-y-1 mb-3">
          {Object.entries(tierNames).slice(0, 4).map(([tier, name]) => (
            <div key={tier} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: tierColors[Number(tier)] }}
              />
              <span className="text-gray-300">{name}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-red-500" />
            <span className="text-gray-400">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-yellow-500" />
            <span className="text-gray-400">Strong</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-white/20 text-gray-400">
          <div>{nodes.length} Companies</div>
          <div>{links.length} Relationships</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/60 rounded-lg px-3 py-2 text-xs text-gray-400">
        <div>🖱️ Drag to rotate • Scroll to zoom</div>
        <div>Click node to select • Double-click to view</div>
      </div>

      {/* Selected node info */}
      {selectedNode && (
        <Card className="absolute top-4 right-4 z-10 p-4 bg-black/90 border-white/20 text-white max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <Badge style={{ backgroundColor: tierColors[selectedNode.tier] }}>
              {tierNames[selectedNode.tier]}
            </Badge>
            <button 
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="font-bold text-lg">{selectedNode.symbol || selectedNode.name}</div>
          <div className="text-sm text-gray-300">{selectedNode.name}</div>
          {selectedNode.market_cap && (
            <div className="text-lg text-green-400 mt-2">
              {formatLargeNumber(selectedNode.market_cap)}
            </div>
          )}
          {selectedNode.is_private ? (
            <Badge variant="outline" className="mt-2 text-gray-400">Private</Badge>
          ) : (
            <button 
              onClick={() => setLocation(`/asset/${selectedNode.asset_id}`)}
              className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
            >
              View Full Analysis →
            </button>
          )}
        </Card>
      )}

      {/* Three.js Canvas */}
      <Canvas camera={{ position: [0, 5, 20], fov: 60 }}>
        <color attach="background" args={['#0a0a0a']} />
        <fog attach="fog" args={['#0a0a0a', 20, 60]} />
        <Scene 
          nodes={nodes}
          links={links}
          hoveredNode={hoveredNode}
          selectedNode={selectedNode}
          onHoverNode={setHoveredNode}
          onSelectNode={handleNodeClick}
        />
      </Canvas>
    </div>
  );
}

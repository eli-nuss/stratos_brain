import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import useSWR from "swr";
import { apiFetcher } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  RotateCcw,
  ChevronRight,
  Cpu,
  Server,
  Cloud,
  Zap,
  Factory,
  Layers
} from "lucide-react";

// Types
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

// Journey step definition
interface JourneyStep {
  id: number;
  title: string;
  tier: number;
  description: string;
  companies: {
    symbol: string;
    name: string;
    role: string;
    asset_id?: number | null;
    market_cap?: number;
  }[];
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
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

// Format large numbers
function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(0)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

// Predefined journey: "How an H100 GPU Gets Made"
const h100Journey: JourneyStep[] = [
  {
    id: 0,
    title: "Raw Materials",
    tier: -1,
    description: "The journey begins with ultra-pure silicon wafers and rare earth elements. Shin-Etsu produces 99.9999999% pure silicon crystals, while Entegris provides the specialty chemicals needed for chip fabrication.",
    companies: [
      { symbol: "4063.T", name: "Shin-Etsu Chemical", role: "Silicon wafer supplier (30% global share)", market_cap: 80e9 },
      { symbol: "ENTG", name: "Entegris", role: "Specialty chemicals & materials", asset_id: 6377, market_cap: 14e9 },
      { symbol: "LIN", name: "Linde", role: "Process gases (nitrogen, argon)", asset_id: 6378, market_cap: 203e9 },
    ],
    icon: <Layers className="w-6 h-6" />,
    color: "#f59e0b",
    bgGradient: "from-amber-900/50 to-amber-800/30",
  },
  {
    id: 1,
    title: "Lithography Equipment",
    tier: 0,
    description: "ASML's EUV machines are the most complex devices ever built - costing $380M each. They use extreme ultraviolet light to print transistors just 3 nanometers wide. Only 3 companies in the world can make the lenses.",
    companies: [
      { symbol: "ASML", name: "ASML Holding", role: "EUV lithography monopoly (100% share)", asset_id: 6384, market_cap: 477e9 },
      { symbol: "AMAT", name: "Applied Materials", role: "Deposition & etch equipment", asset_id: 6385, market_cap: 227e9 },
      { symbol: "LRCX", name: "Lam Research", role: "Etch & deposition systems", asset_id: 6386, market_cap: 246e9 },
      { symbol: "KLAC", name: "KLA Corporation", role: "Inspection & metrology", asset_id: 6387, market_cap: 178e9 },
    ],
    icon: <Factory className="w-6 h-6" />,
    color: "#64748b",
    bgGradient: "from-slate-800/50 to-slate-700/30",
  },
  {
    id: 2,
    title: "Chip Fabrication",
    tier: 0,
    description: "TSMC's fabs in Taiwan manufacture NVIDIA's chips using their N4 process. A single H100 die contains 80 billion transistors. The fabrication process takes 3+ months and involves 1,000+ steps.",
    companies: [
      { symbol: "TSM", name: "Taiwan Semiconductor", role: "Sole manufacturer of H100 (90%+ of advanced chips)", asset_id: 6379, market_cap: 1.7e12 },
      { symbol: "INTC", name: "Intel", role: "Foundry services (emerging)", asset_id: 6383, market_cap: 188e9 },
      { symbol: "005930.KS", name: "Samsung Electronics", role: "Alternative foundry", market_cap: 350e9 },
    ],
    icon: <Cpu className="w-6 h-6" />,
    color: "#64748b",
    bgGradient: "from-slate-800/50 to-slate-700/30",
  },
  {
    id: 3,
    title: "HBM Memory & Packaging",
    tier: 1,
    description: "SK Hynix produces the HBM3e memory stacks - 8 DRAM dies bonded together with through-silicon vias. TSMC's CoWoS packaging combines the GPU die with 6 HBM stacks on a single interposer.",
    companies: [
      { symbol: "000660.KS", name: "SK Hynix", role: "HBM3e memory (50%+ share)", market_cap: 120e9 },
      { symbol: "MU", name: "Micron Technology", role: "HBM memory (growing share)", asset_id: 6393, market_cap: 351e9 },
      { symbol: "TSM", name: "TSMC (CoWoS)", role: "Advanced packaging (90% share)", asset_id: 6379, market_cap: 1.7e12 },
      { symbol: "AMKR", name: "Amkor Technology", role: "OSAT packaging services", asset_id: 6395, market_cap: 10e9 },
    ],
    icon: <Layers className="w-6 h-6" />,
    color: "#ef4444",
    bgGradient: "from-red-900/50 to-red-800/30",
  },
  {
    id: 4,
    title: "GPU Design & Assembly",
    tier: 1,
    description: "NVIDIA designs the H100 architecture (Hopper) using ARM's instruction set. The final GPU is tested, binned for quality, and prepared for integration into server systems.",
    companies: [
      { symbol: "NVDA", name: "NVIDIA Corporation", role: "GPU design & IP (95% AI accelerator share)", asset_id: 6, market_cap: 4.6e12 },
      { symbol: "ARM", name: "ARM Holdings", role: "CPU architecture licensing", asset_id: 6391, market_cap: 123e9 },
      { symbol: "AVGO", name: "Broadcom", role: "Networking ASICs & custom silicon", asset_id: 6389, market_cap: 1.6e12 },
    ],
    icon: <Cpu className="w-6 h-6" />,
    color: "#ef4444",
    bgGradient: "from-red-900/50 to-red-800/30",
  },
  {
    id: 5,
    title: "Server Integration",
    tier: 2,
    description: "Supermicro and Dell integrate 8 H100 GPUs into a single DGX server. NVLink connects the GPUs with 900GB/s bandwidth. Each server costs $200K-$400K.",
    companies: [
      { symbol: "SMCI", name: "Super Micro Computer", role: "AI server systems (60%+ NVIDIA share)", asset_id: 6397, market_cap: 18e9 },
      { symbol: "DELL", name: "Dell Technologies", role: "Enterprise AI servers", asset_id: 6398, market_cap: 95e9 },
      { symbol: "HPE", name: "Hewlett Packard Enterprise", role: "HPC & AI infrastructure", asset_id: 6399, market_cap: 35e9 },
      { symbol: "CSCO", name: "Cisco Systems", role: "Networking infrastructure", asset_id: 6400, market_cap: 240e9 },
    ],
    icon: <Server className="w-6 h-6" />,
    color: "#3b82f6",
    bgGradient: "from-blue-900/50 to-blue-800/30",
  },
  {
    id: 6,
    title: "Data Center Deployment",
    tier: 3,
    description: "Servers are deployed in hyperscale data centers. Each rack of 8 H100s consumes 10kW of power. Equinix and Digital Realty provide the physical infrastructure, while Vertiv handles cooling.",
    companies: [
      { symbol: "EQIX", name: "Equinix", role: "Colocation data centers", asset_id: 6404, market_cap: 85e9 },
      { symbol: "DLR", name: "Digital Realty", role: "Data center REITs", asset_id: 6405, market_cap: 55e9 },
      { symbol: "VRT", name: "Vertiv Holdings", role: "Thermal management & power", asset_id: 6407, market_cap: 45e9 },
      { symbol: "VST", name: "Vistra Corp", role: "Power generation for AI", asset_id: 6436, market_cap: 52e9 },
    ],
    icon: <Zap className="w-6 h-6" />,
    color: "#a855f7",
    bgGradient: "from-purple-900/50 to-purple-800/30",
  },
  {
    id: 7,
    title: "Cloud Infrastructure",
    tier: 4,
    description: "Hyperscalers like Microsoft Azure and AWS offer H100 instances to customers. A single H100 hour costs $2-4. These GPUs power the world's largest AI models.",
    companies: [
      { symbol: "MSFT", name: "Microsoft (Azure)", role: "Cloud AI infrastructure", asset_id: 6410, market_cap: 3.4e12 },
      { symbol: "AMZN", name: "Amazon (AWS)", role: "Largest cloud provider", asset_id: 6411, market_cap: 2.4e12 },
      { symbol: "GOOGL", name: "Google Cloud", role: "AI/ML cloud services", asset_id: 6412, market_cap: 2.3e12 },
      { symbol: "ORCL", name: "Oracle Cloud", role: "Enterprise AI cloud", asset_id: 6413, market_cap: 500e9 },
    ],
    icon: <Cloud className="w-6 h-6" />,
    color: "#10b981",
    bgGradient: "from-emerald-900/50 to-emerald-800/30",
  },
  {
    id: 8,
    title: "AI Applications",
    tier: 5,
    description: "Finally, the H100's compute power enables foundation models like GPT-4 and Claude. Training a frontier model requires 10,000+ H100s running for months, costing $100M+.",
    companies: [
      { symbol: "MSFT", name: "Microsoft (OpenAI partner)", role: "GPT-4 & Copilot", asset_id: 6410, market_cap: 3.4e12 },
      { symbol: "GOOGL", name: "Google (Gemini)", role: "Gemini & Bard", asset_id: 6412, market_cap: 2.3e12 },
      { symbol: "META", name: "Meta (Llama)", role: "Open-source LLMs", asset_id: 6414, market_cap: 1.6e12 },
      { symbol: "CRM", name: "Salesforce (Einstein)", role: "Enterprise AI", asset_id: 6418, market_cap: 300e9 },
    ],
    icon: <Cpu className="w-6 h-6" />,
    color: "#f97316",
    bgGradient: "from-orange-900/50 to-orange-800/30",
  },
];

export default function SupplyChainJourney() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalSteps = h100Journey.length;
  const step = h100Journey[currentStep];

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            // Move to next step
            setCurrentStep(curr => {
              if (curr >= totalSteps - 1) {
                setIsPlaying(false);
                return curr;
              }
              return curr + 1;
            });
            return 0;
          }
          return prev + 2; // 2% per 100ms = 5 seconds per step
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, totalSteps]);

  // Reset progress when step changes manually
  useEffect(() => {
    setProgress(0);
  }, [currentStep]);

  const handlePrevious = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.min(totalSteps - 1, prev + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
    setProgress(0);
  };

  const handleCompanyClick = (assetId: number | null | undefined) => {
    if (assetId) {
      setLocation(`/asset/${assetId}`);
    }
  };

  return (
    <div className="w-full bg-black/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">How an H100 GPU Gets Made</h2>
            <p className="text-sm text-gray-400">The journey from silicon to AI inference</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePrevious} disabled={currentStep === 0}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button 
              variant="default" 
              size="icon" 
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-primary hover:bg-primary/80"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNext} disabled={currentStep === totalSteps - 1}>
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-2">
          {h100Journey.map((s, i) => (
            <div 
              key={s.id}
              className={cn(
                "flex-1 h-1.5 rounded-full cursor-pointer transition-all",
                i < currentStep ? "bg-primary" : i === currentStep ? "bg-primary/50" : "bg-white/20"
              )}
              onClick={() => { setIsPlaying(false); setCurrentStep(i); }}
            >
              {i === currentStep && (
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>Step {currentStep + 1} of {totalSteps}</span>
          <span>{step.title}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex">
        {/* Timeline sidebar */}
        <div className="w-64 border-r border-white/10 p-4 hidden lg:block">
          <div className="space-y-2">
            {h100Journey.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setIsPlaying(false); setCurrentStep(i); }}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all",
                  i === currentStep 
                    ? "bg-white/10 text-white" 
                    : i < currentStep 
                      ? "text-gray-400 hover:bg-white/5" 
                      : "text-gray-600 hover:bg-white/5"
                )}
              >
                <div 
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    i <= currentStep ? "bg-opacity-100" : "bg-opacity-30"
                  )}
                  style={{ backgroundColor: i <= currentStep ? s.color : '#333' }}
                >
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.title}</div>
                  <div className="text-xs text-gray-500">Tier {s.tier}</div>
                </div>
                {i < currentStep && (
                  <ChevronRight className="w-4 h-4 text-green-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 p-6">
          <div className={cn("rounded-xl p-6 bg-gradient-to-br", step.bgGradient)}>
            {/* Step header */}
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: step.color }}
              >
                {step.icon}
              </div>
              <div>
                <Badge style={{ backgroundColor: step.color }} className="mb-2">
                  Tier {step.tier}: {step.title}
                </Badge>
                <h3 className="text-2xl font-bold text-white">{step.title}</h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              {step.description}
            </p>

            {/* Companies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {step.companies.map((company, i) => (
                <Card 
                  key={i}
                  className={cn(
                    "p-4 bg-black/40 border-white/10 cursor-pointer transition-all hover:bg-black/60 hover:border-white/20",
                    company.asset_id && "hover:scale-[1.02]"
                  )}
                  onClick={() => handleCompanyClick(company.asset_id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-white">{company.symbol}</div>
                      <div className="text-sm text-gray-400">{company.name}</div>
                    </div>
                    {company.market_cap && (
                      <div className="text-green-400 font-semibold">
                        {formatLargeNumber(company.market_cap)}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-gray-300">{company.role}</div>
                  {company.asset_id && (
                    <div className="mt-2 text-xs text-blue-400">Click to view analysis →</div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Flow arrow to next step */}
          {currentStep < totalSteps - 1 && (
            <div className="flex justify-center my-6">
              <div className="flex items-center gap-2 text-gray-500">
                <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-500 to-transparent" />
                <ChevronRight className="w-6 h-6 animate-pulse" />
                <span className="text-sm">Next: {h100Journey[currentStep + 1].title}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

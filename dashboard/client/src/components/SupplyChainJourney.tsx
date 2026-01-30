import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const journeySteps = [
  {
    id: 1,
    tier: -1,
    title: "Silicon Wafer Production",
    company: "Shin-Etsu Chemical",
    symbol: "SHECY",
    asset_id: 7401,
    description: "Ultra-pure silicon wafers are produced in Japan. These 300mm wafers are the foundation of all advanced semiconductors.",
    detail: "Shin-Etsu controls ~30% of the global silicon wafer market. Each wafer costs $100-150 and will eventually contain dozens of H100 dies.",
    color: "#f59e0b",
    duration: 4000,
  },
  {
    id: 2,
    tier: 0,
    title: "EUV Lithography",
    company: "ASML Holding",
    symbol: "ASML",
    asset_id: 5,
    description: "ASML's EUV machines use extreme ultraviolet light to print circuit patterns at 4nm scale - smaller than a virus.",
    detail: "Each EUV machine costs $200M+ and ASML has a 100% monopoly. TSMC needs 100+ machines to produce H100s at scale.",
    color: "#64748b",
    duration: 5000,
  },
  {
    id: 3,
    tier: 0,
    title: "Wafer Fabrication",
    company: "TSMC",
    symbol: "TSM",
    asset_id: 4,
    description: "TSMC's fabs in Taiwan transform silicon wafers into H100 GPU dies using their 4nm process node.",
    detail: "TSMC manufactures 90%+ of the world's most advanced chips. The H100 die has 80 billion transistors across 814mm².",
    color: "#64748b",
    duration: 5000,
  },
  {
    id: 4,
    tier: 1,
    title: "HBM Memory Production",
    company: "SK Hynix",
    symbol: "000660.KS",
    asset_id: 7398,
    description: "SK Hynix produces HBM3 memory - stacked DRAM chips that provide 3TB/s bandwidth to the GPU.",
    detail: "Each H100 needs 80GB of HBM3. SK Hynix has ~50% market share in HBM, with Samsung and Micron competing.",
    color: "#ef4444",
    duration: 4000,
  },
  {
    id: 5,
    tier: 1,
    title: "Advanced Packaging (CoWoS)",
    company: "TSMC",
    symbol: "TSM",
    asset_id: 4,
    description: "TSMC's CoWoS technology bonds the H100 die to HBM memory on a silicon interposer - the current bottleneck.",
    detail: "CoWoS capacity is the #1 constraint on H100 supply. TSMC is investing $10B+ to expand CoWoS capacity through 2025.",
    color: "#ef4444",
    duration: 5000,
  },
  {
    id: 6,
    tier: 1,
    title: "GPU Design & Validation",
    company: "NVIDIA",
    symbol: "NVDA",
    asset_id: 6,
    description: "NVIDIA designs the H100 architecture and validates packaged chips before shipping to system integrators.",
    detail: "NVIDIA captures ~80% of the AI accelerator market. The H100 sells for $25,000-40,000 depending on configuration.",
    color: "#ef4444",
    duration: 4000,
  },
  {
    id: 7,
    tier: 2,
    title: "Server Integration",
    company: "Super Micro Computer",
    symbol: "SMCI",
    asset_id: 6453,
    description: "Supermicro builds DGX-compatible servers housing 8 H100 GPUs with NVLink interconnects.",
    detail: "A single 8-GPU H100 server costs $200,000+. Supermicro has ~10% of the AI server market and is growing rapidly.",
    color: "#3b82f6",
    duration: 4000,
  },
  {
    id: 8,
    tier: 2,
    title: "Networking Infrastructure",
    company: "Arista Networks",
    symbol: "ANET",
    asset_id: 6549,
    description: "Arista provides 400G Ethernet switches connecting GPU clusters for distributed AI training.",
    detail: "AI clusters need ultra-low latency networking. Arista's AI networking revenue is growing 50%+ annually.",
    color: "#3b82f6",
    duration: 3000,
  },
  {
    id: 9,
    tier: 3,
    title: "Data Center Deployment",
    company: "Equinix",
    symbol: "EQIX",
    asset_id: 6555,
    description: "Equinix provides colocation facilities with power, cooling, and connectivity for AI infrastructure.",
    detail: "A single H100 server rack needs 30-40kW of power. Data centers are racing to add liquid cooling capacity.",
    color: "#a855f7",
    duration: 3000,
  },
  {
    id: 10,
    tier: 4,
    title: "Cloud Deployment",
    company: "Microsoft Azure",
    symbol: "MSFT",
    asset_id: 3,
    description: "Microsoft deploys H100 clusters in Azure data centers, offering them as cloud GPU instances.",
    detail: "Azure is OpenAI's exclusive cloud partner. Microsoft has committed $13B+ to OpenAI and AI infrastructure.",
    color: "#10b981",
    duration: 3000,
  },
  {
    id: 11,
    tier: 5,
    title: "AI Model Training",
    company: "OpenAI",
    symbol: null,
    asset_id: null,
    description: "OpenAI uses thousands of H100s to train GPT models, turning raw compute into artificial intelligence.",
    detail: "GPT-4 training required ~25,000 A100s over 3+ months. GPT-5 will likely need 10x more H100 compute.",
    color: "#f97316",
    duration: 4000,
  },
];

export default function SupplyChainJourney() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      if (currentStep < journeySteps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        setIsPlaying(false);
      }
    }, journeySteps[currentStep].duration);

    return () => clearTimeout(timer);
  }, [currentStep, isPlaying]);

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const handleStepClick = (index: number) => {
    setCurrentStep(index);
    setIsPlaying(false);
  };

  const step = journeySteps[currentStep];

  return (
    <div className="w-full h-[calc(100vh-200px)] min-h-[600px] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-white">The Journey of an H100 GPU</h2>
          <p className="text-sm text-gray-400">From silicon wafer to AI model training</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPlaying(!isPlaying)} className="gap-2">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-4 bg-black/30">
        {journeySteps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => handleStepClick(i)}
            className={cn("flex-1 h-2 rounded-full transition-all cursor-pointer", i <= currentStep ? "opacity-100" : "opacity-30")}
            style={{ backgroundColor: s.color }}
          />
        ))}
      </div>

      <div className="flex-1 flex">
        <div className="w-64 border-r border-gray-800 overflow-y-auto">
          {journeySteps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => handleStepClick(i)}
              className={cn("w-full p-3 text-left border-b border-gray-800 transition-all", i === currentStep ? "bg-gray-800" : "hover:bg-gray-900")}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className={cn("text-xs font-medium", i <= currentStep ? "text-white" : "text-gray-500")}>{s.company}</span>
              </div>
              <p className={cn("text-xs mt-1 truncate", i <= currentStep ? "text-gray-400" : "text-gray-600")}>{s.title}</p>
            </button>
          ))}
        </div>

        <div className="flex-1 p-8 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl text-center"
            >
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                style={{ backgroundColor: `${step.color}20`, border: `1px solid ${step.color}` }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: step.color }} />
                <span className="text-sm font-medium" style={{ color: step.color }}>
                  Step {step.id} of {journeySteps.length}
                </span>
              </div>

              <div className="mb-4">
                <h3 className="text-3xl font-bold text-white mb-2">{step.company}</h3>
                {step.symbol && <span className="text-lg text-gray-400">{step.symbol}</span>}
              </div>

              <h4 className="text-xl text-gray-300 mb-6">{step.title}</h4>
              <p className="text-lg text-gray-400 mb-4">{step.description}</p>
              <p className="text-sm text-gray-500 mb-8">{step.detail}</p>

              {step.asset_id && (
                <Button variant="outline" onClick={() => setLocation(`/asset/${step.asset_id}`)} className="gap-2">
                  View {step.symbol} Details
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-4 mt-8">
            <Button variant="ghost" size="sm" disabled={currentStep === 0} onClick={() => setCurrentStep(currentStep - 1)}>
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentStep === journeySteps.length - 1}
              onClick={() => setCurrentStep(currentStep + 1)}
              className="gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

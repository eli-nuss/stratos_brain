import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { Link, useLocation } from "wouter";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, 
  ChevronRight, 
  X, 
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Layers,
  Cpu,
  Server,
  Building,
  Cloud,
  Sparkles,
  Zap,
  ArrowLeft,
  Info,
  DollarSign,
  BarChart3,
  Globe,
  Lock,
  ChevronUp,
  ChevronsUpDown,
  Flame,
  Thermometer,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { apiFetcher } from "@/lib/api-config";
import { formatCurrency, formatPercent } from "@/lib/formatters";

// Lazy load the flow visualization component
const SupplyChainFlow = lazy(() => import("@/components/SupplyChainFlow"));

// Helper to format large numbers compactly
function formatLargeNumber(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

// Types
interface SupplyChainTier {
  tier_id: number;
  tier_number: number;
  tier_name: string;
  tier_short_name: string;
  tier_description: string;
  color_code: string;
  is_bottleneck: boolean;
  icon_name: string;
  categories: SupplyChainCategory[];
}

interface SupplyChainCategory {
  category_id: number;
  category_name: string;
  category_description: string;
  market_size_2024: number;
  cagr_percent: number;
  public_company_count: number;
  private_company_count: number;
  companies: SupplyChainCompany[];
}

interface SupplyChainCompany {
  company_id: string;
  company_type: 'public' | 'private';
  symbol: string | null;
  name: string;
  asset_id?: number;
  role_description: string;
  market_share_percent: number | null;
  competitive_position: string;
  key_products: string[];
  market_cap: number | null;
  revenue_ttm: number | null;
  profit_margin: number | null;
  ev_to_revenue: number | null;
  ev_to_ebitda: number | null;
  latest_price: number | null;
  return_1d: number | null;
  return_7d: number | null;
  return_30d: number | null;
  return_1y: number | null;
  estimated_valuation?: number;
  estimated_revenue?: number;
  funding_stage?: string;
  total_funding?: number;
  key_investors?: string[];
}

// Heat map time period type
type HeatMapPeriod = 'off' | '1d' | '7d' | '30d' | '1y';

// Icon mapping
const tierIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  layers: Layers,
  cpu: Cpu,
  microchip: Cpu,
  server: Server,
  building: Building,
  cloud: Cloud,
  sparkles: Sparkles,
};

// Tier colors with gradients
const tierColors: Record<number, { bg: string; border: string; text: string; gradient: string }> = {
  [-1]: { bg: 'bg-amber-950/20', border: 'border-amber-700/50', text: 'text-amber-400', gradient: 'from-amber-900/30 to-amber-950/10' },
  [0]: { bg: 'bg-slate-800/30', border: 'border-slate-600/50', text: 'text-slate-300', gradient: 'from-slate-800/40 to-slate-900/20' },
  [1]: { bg: 'bg-red-950/30', border: 'border-red-600/60', text: 'text-red-400', gradient: 'from-red-900/40 to-red-950/20' },
  [2]: { bg: 'bg-blue-950/30', border: 'border-blue-600/50', text: 'text-blue-400', gradient: 'from-blue-900/30 to-blue-950/20' },
  [3]: { bg: 'bg-purple-950/30', border: 'border-purple-600/50', text: 'text-purple-400', gradient: 'from-purple-900/30 to-purple-950/20' },
  [4]: { bg: 'bg-emerald-950/30', border: 'border-emerald-600/50', text: 'text-emerald-400', gradient: 'from-emerald-900/30 to-emerald-950/20' },
  [5]: { bg: 'bg-orange-950/30', border: 'border-orange-600/50', text: 'text-orange-400', gradient: 'from-orange-900/30 to-orange-950/20' },
  [6]: { bg: 'bg-cyan-950/30', border: 'border-cyan-600/50', text: 'text-cyan-400', gradient: 'from-cyan-900/30 to-cyan-950/20' },
};

// Get heat map color based on performance
function getHeatMapColor(value: number | null): string {
  if (value === null) return 'bg-muted/30';
  if (value >= 10) return 'bg-green-500/60 border-green-400';
  if (value >= 5) return 'bg-green-500/40 border-green-500/50';
  if (value >= 2) return 'bg-green-500/25 border-green-600/40';
  if (value >= 0) return 'bg-green-500/10 border-green-700/30';
  if (value >= -2) return 'bg-red-500/10 border-red-700/30';
  if (value >= -5) return 'bg-red-500/25 border-red-600/40';
  if (value >= -10) return 'bg-red-500/40 border-red-500/50';
  return 'bg-red-500/60 border-red-400';
}

// Get performance value based on period
function getPerformanceValue(company: SupplyChainCompany, period: HeatMapPeriod): number | null {
  switch (period) {
    case '1d': return company.return_1d;
    case '7d': return company.return_7d;
    case '30d': return company.return_30d;
    case '1y': return company.return_1y;
    default: return null;
  }
}

// Calculate tier stats
interface TierStats {
  totalMarketCap: number;
  avgPE: number | null;
  avgReturn1D: number | null;
  avgReturn7D: number | null;
  avgReturn30D: number | null;
  avgReturn1Y: number | null;
  totalMarketSize: number;
  avgCAGR: number;
  publicCount: number;
  privateCount: number;
}

function calculateTierStats(tier: SupplyChainTier): TierStats {
  let totalMarketCap = 0;
  let peSum = 0;
  let peCount = 0;
  let return1DSum = 0;
  let return1DCount = 0;
  let return7DSum = 0;
  let return7DCount = 0;
  let return30DSum = 0;
  let return30DCount = 0;
  let return1YSum = 0;
  let return1YCount = 0;
  let totalMarketSize = 0;
  let cagrSum = 0;
  let cagrCount = 0;
  let publicCount = 0;
  let privateCount = 0;

  tier.categories?.forEach(cat => {
    totalMarketSize += cat.market_size_2024 || 0;
    if (cat.cagr_percent) {
      cagrSum += cat.cagr_percent;
      cagrCount++;
    }
    publicCount += cat.public_company_count || 0;
    privateCount += cat.private_company_count || 0;

    cat.companies?.forEach(company => {
      if (company.market_cap) totalMarketCap += company.market_cap;
      if (company.ev_to_ebitda && company.ev_to_ebitda > 0 && company.ev_to_ebitda < 200) {
        peSum += company.ev_to_ebitda;
        peCount++;
      }
      if (company.return_1d !== null) {
        return1DSum += company.return_1d;
        return1DCount++;
      }
      if (company.return_7d !== null) {
        return7DSum += company.return_7d;
        return7DCount++;
      }
      if (company.return_30d !== null) {
        return30DSum += company.return_30d;
        return30DCount++;
      }
      if (company.return_1y !== null) {
        return1YSum += company.return_1y;
        return1YCount++;
      }
    });
  });

  return {
    totalMarketCap,
    avgPE: peCount > 0 ? peSum / peCount : null,
    avgReturn1D: return1DCount > 0 ? return1DSum / return1DCount : null,
    avgReturn7D: return7DCount > 0 ? return7DSum / return7DCount : null,
    avgReturn30D: return30DCount > 0 ? return30DSum / return30DCount : null,
    avgReturn1Y: return1YCount > 0 ? return1YSum / return1YCount : null,
    totalMarketSize,
    avgCAGR: cagrCount > 0 ? cagrSum / cagrCount : 0,
    publicCount,
    privateCount
  };
}

// Calculate category stats
interface CategoryStats {
  totalMarketCap: number;
  avgPE: number | null;
  avgReturn1D: number | null;
  avgReturn7D: number | null;
  avgReturn30D: number | null;
  avgReturn1Y: number | null;
}

function calculateCategoryStats(category: SupplyChainCategory): CategoryStats {
  let totalMarketCap = 0;
  let peSum = 0;
  let peCount = 0;
  let return1DSum = 0;
  let return1DCount = 0;
  let return7DSum = 0;
  let return7DCount = 0;
  let return30DSum = 0;
  let return30DCount = 0;
  let return1YSum = 0;
  let return1YCount = 0;

  category.companies?.forEach(company => {
    if (company.market_cap) totalMarketCap += company.market_cap;
    if (company.ev_to_ebitda && company.ev_to_ebitda > 0 && company.ev_to_ebitda < 200) {
      peSum += company.ev_to_ebitda;
      peCount++;
    }
    if (company.return_1d !== null) {
      return1DSum += company.return_1d;
      return1DCount++;
    }
    if (company.return_7d !== null) {
      return7DSum += company.return_7d;
      return7DCount++;
    }
    if (company.return_30d !== null) {
      return30DSum += company.return_30d;
      return30DCount++;
    }
    if (company.return_1y !== null) {
      return1YSum += company.return_1y;
      return1YCount++;
    }
  });

  return {
    totalMarketCap,
    avgPE: peCount > 0 ? peSum / peCount : null,
    avgReturn1D: return1DCount > 0 ? return1DSum / return1DCount : null,
    avgReturn7D: return7DCount > 0 ? return7DSum / return7DCount : null,
    avgReturn30D: return30DCount > 0 ? return30DSum / return30DCount : null,
    avgReturn1Y: return1YCount > 0 ? return1YSum / return1YCount : null
  };
}

// Company Card Component
function CompanyCard({ 
  company, 
  tierNumber,
  onClick,
  heatMapPeriod
}: { 
  company: SupplyChainCompany; 
  tierNumber: number;
  onClick: () => void;
  heatMapPeriod: HeatMapPeriod;
}) {
  const [, setLocation] = useLocation();
  const colors = tierColors[tierNumber] || tierColors[0];
  const isPrivate = company.company_type === 'private';
  const performanceValue = getPerformanceValue(company, heatMapPeriod);
  const isHeatMapActive = heatMapPeriod !== 'off';
  
  const handleClick = () => {
    // For public companies with asset_id, navigate directly to asset page
    if (!isPrivate && company.asset_id) {
      setLocation(`/asset/${company.asset_id}`);
    } else {
      // For private companies, show the detail sheet
      onClick();
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      onClick={handleClick}
      className={cn(
        "cursor-pointer rounded-lg border p-3 transition-all",
        "hover:shadow-lg hover:shadow-black/20",
        isHeatMapActive ? getHeatMapColor(performanceValue) : colors.bg,
        !isHeatMapActive && colors.border,
        isPrivate && "border-dashed"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isPrivate && <Lock className="h-3 w-3 text-muted-foreground" />}
            <span className="font-medium text-sm truncate">
              {company.symbol || company.name}
            </span>
            {company.competitive_position === 'leader' && (
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                Leader
              </Badge>
            )}
          </div>
          {company.symbol && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {company.name}
            </p>
          )}
        </div>
        {isHeatMapActive && performanceValue !== null ? (
          <div className={cn(
            "text-sm font-bold flex items-center gap-0.5",
            performanceValue > 0 ? "text-green-400" : performanceValue < 0 ? "text-red-400" : "text-muted-foreground"
          )}>
            {performanceValue > 0 ? '+' : ''}{performanceValue.toFixed(1)}%
          </div>
        ) : company.return_1d !== null && (
          <div className={cn(
            "text-xs font-medium flex items-center gap-0.5",
            company.return_1d > 0 ? "text-green-500" : company.return_1d < 0 ? "text-red-500" : "text-muted-foreground"
          )}>
            {company.return_1d > 0 ? <TrendingUp className="h-3 w-3" /> : 
             company.return_1d < 0 ? <TrendingDown className="h-3 w-3" /> : 
             <Minus className="h-3 w-3" />}
            {formatPercent(company.return_1d)}
          </div>
        )}
      </div>
      
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        {company.market_cap && (
          <span>${formatLargeNumber(company.market_cap)}</span>
        )}
        {isPrivate && company.estimated_valuation && (
          <span className="italic">${formatLargeNumber(company.estimated_valuation)} (est.)</span>
        )}
        {company.market_share_percent && (
          <span>{company.market_share_percent}% share</span>
        )}
      </div>
    </motion.div>
  );
}

// Stats Badge Component
function StatsBadge({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
      {trend !== undefined && trend !== null && (
        <span className={cn(
          "font-medium",
          trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-muted-foreground"
        )}>
          ({trend > 0 ? '+' : ''}{trend.toFixed(1)}%)
        </span>
      )}
    </div>
  );
}

// Category Section Component
function CategorySection({
  category,
  tierNumber,
  isExpanded,
  onToggle,
  onCompanyClick,
  heatMapPeriod
}: {
  category: SupplyChainCategory;
  tierNumber: number;
  isExpanded: boolean;
  onToggle: () => void;
  onCompanyClick: (company: SupplyChainCompany) => void;
  heatMapPeriod: HeatMapPeriod;
}) {
  const colors = tierColors[tierNumber] || tierColors[0];
  const totalCompanies = category.public_company_count + category.private_company_count;
  const stats = useMemo(() => calculateCategoryStats(category), [category]);
  const isHeatMapActive = heatMapPeriod !== 'off';
  
  // Get the relevant return for heat map
  const avgReturn = heatMapPeriod === '1d' ? stats.avgReturn1D :
                    heatMapPeriod === '7d' ? stats.avgReturn7D :
                    heatMapPeriod === '30d' ? stats.avgReturn30D :
                    heatMapPeriod === '1y' ? stats.avgReturn1Y : null;
  
  return (
    <div className={cn(
      "rounded-lg border",
      isHeatMapActive ? getHeatMapColor(avgReturn) : colors.border,
      !isHeatMapActive && colors.bg
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg",
            `bg-gradient-to-br ${colors.gradient}`
          )}>
            <span className={cn("text-sm font-bold", colors.text)}>
              {totalCompanies}
            </span>
          </div>
          <div className="text-left">
            <h4 className="font-medium text-sm">{category.category_name}</h4>
            <p className="text-xs text-muted-foreground">
              {category.market_size_2024 && `$${formatLargeNumber(category.market_size_2024)} market`}
              {category.cagr_percent && ` • ${category.cagr_percent}% CAGR`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Category Stats */}
          {stats.totalMarketCap > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                ${formatLargeNumber(stats.totalMarketCap)} mkt cap
              </span>
              {isHeatMapActive && avgReturn !== null && (
                <span className={cn(
                  "text-xs font-medium",
                  avgReturn > 0 ? "text-green-500" : avgReturn < 0 ? "text-red-500" : "text-muted-foreground"
                )}>
                  {avgReturn > 0 ? '+' : ''}{avgReturn.toFixed(1)}%
                </span>
              )}
            </div>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      <AnimatePresence>
        {isExpanded && category.companies && category.companies.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {category.companies.map((company) => (
                <CompanyCard
                  key={company.company_id}
                  company={company}
                  tierNumber={tierNumber}
                  onClick={() => onCompanyClick(company)}
                  heatMapPeriod={heatMapPeriod}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tier Section Component
function TierSection({
  tier,
  isExpanded,
  onToggle,
  expandedCategories,
  onCategoryToggle,
  onCompanyClick,
  heatMapPeriod
}: {
  tier: SupplyChainTier;
  isExpanded: boolean;
  onToggle: () => void;
  expandedCategories: Set<number>;
  onCategoryToggle: (categoryId: number) => void;
  onCompanyClick: (company: SupplyChainCompany) => void;
  heatMapPeriod: HeatMapPeriod;
}) {
  const colors = tierColors[tier.tier_number] || tierColors[0];
  const IconComponent = tierIcons[tier.icon_name] || Layers;
  const stats = useMemo(() => calculateTierStats(tier), [tier]);
  const isHeatMapActive = heatMapPeriod !== 'off';
  
  const totalCompanies = stats.publicCount + stats.privateCount;
  
  // Get the relevant return for heat map
  const avgReturn = heatMapPeriod === '1d' ? stats.avgReturn1D :
                    heatMapPeriod === '7d' ? stats.avgReturn7D :
                    heatMapPeriod === '30d' ? stats.avgReturn30D :
                    heatMapPeriod === '1y' ? stats.avgReturn1Y : null;
  
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      isHeatMapActive ? getHeatMapColor(avgReturn) : colors.border,
      tier.is_bottleneck && "ring-2 ring-red-500/50"
    )}>
      <CardHeader 
        className={cn(
          "cursor-pointer hover:bg-white/5 transition-colors py-4",
          !isHeatMapActive && `bg-gradient-to-r ${colors.gradient}`
        )}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-xl",
              colors.bg,
              colors.border,
              "border"
            )}>
              <IconComponent className={cn("h-6 w-6", colors.text)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{tier.tier_name}</CardTitle>
                {tier.is_bottleneck && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Bottleneck
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {tier.tier_description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={cn("text-2xl font-bold", colors.text)}>{totalCompanies}</p>
              <p className="text-xs text-muted-foreground">Companies</p>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
        
        {/* Tier Stats Row */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/10">
          {stats.totalMarketCap > 0 && (
            <StatsBadge label="Mkt Cap" value={`$${formatLargeNumber(stats.totalMarketCap)}`} />
          )}
          {stats.totalMarketSize > 0 && (
            <StatsBadge label="TAM" value={`$${formatLargeNumber(stats.totalMarketSize)}`} />
          )}
          {stats.avgCAGR > 0 && (
            <StatsBadge label="Avg CAGR" value={`${stats.avgCAGR.toFixed(0)}%`} />
          )}
          {stats.avgPE !== null && (
            <StatsBadge label="Avg EV/EBITDA" value={stats.avgPE.toFixed(1)} />
          )}
          {isHeatMapActive && avgReturn !== null && (
            <StatsBadge 
              label={`Avg ${heatMapPeriod.toUpperCase()}`} 
              value={`${avgReturn > 0 ? '+' : ''}${avgReturn.toFixed(1)}%`}
              trend={avgReturn}
            />
          )}
          {!isHeatMapActive && stats.avgReturn1D !== null && (
            <StatsBadge label="Avg 1D" value={`${stats.avgReturn1D > 0 ? '+' : ''}${stats.avgReturn1D.toFixed(1)}%`} trend={stats.avgReturn1D} />
          )}
        </div>
      </CardHeader>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CardContent className="pt-4 space-y-3">
              {tier.categories?.map((category) => (
                <CategorySection
                  key={category.category_id}
                  category={category}
                  tierNumber={tier.tier_number}
                  isExpanded={expandedCategories.has(category.category_id)}
                  onToggle={() => onCategoryToggle(category.category_id)}
                  onCompanyClick={onCompanyClick}
                  heatMapPeriod={heatMapPeriod}
                />
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Company Detail Sheet
function CompanyDetailSheet({
  company,
  isOpen,
  onClose
}: {
  company: SupplyChainCompany | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!company) return null;
  
  const isPrivate = company.company_type === 'private';
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            {isPrivate && <Lock className="h-5 w-5 text-muted-foreground" />}
            <div>
              <SheetTitle className="text-xl">
                {company.symbol || company.name}
              </SheetTitle>
              {company.symbol && (
                <SheetDescription>{company.name}</SheetDescription>
              )}
            </div>
            {company.competitive_position === 'leader' && (
              <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                Market Leader
              </Badge>
            )}
          </div>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          {/* Role & Products */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Role in Supply Chain</h4>
            <p className="text-sm">{company.role_description || 'Key player in the AI infrastructure ecosystem.'}</p>
          </div>
          
          {company.key_products && company.key_products.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Products</h4>
              <div className="flex flex-wrap gap-2">
                {company.key_products.map((product, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {product}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Financial Metrics */}
          {!isPrivate && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Financial Metrics</h4>
              <div className="grid grid-cols-2 gap-3">
                {company.market_cap && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Market Cap</p>
                    <p className="text-lg font-semibold">${formatLargeNumber(company.market_cap)}</p>
                  </div>
                )}
                {company.revenue_ttm && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Revenue (TTM)</p>
                    <p className="text-lg font-semibold">${formatLargeNumber(company.revenue_ttm)}</p>
                  </div>
                )}
                {company.profit_margin !== null && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Profit Margin</p>
                    <p className="text-lg font-semibold">{formatPercent(company.profit_margin)}</p>
                  </div>
                )}
                {company.ev_to_ebitda && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">EV/EBITDA</p>
                    <p className="text-lg font-semibold">{company.ev_to_ebitda.toFixed(1)}x</p>
                  </div>
                )}
                {company.market_share_percent && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Market Share</p>
                    <p className="text-lg font-semibold">{company.market_share_percent}%</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Private Company Valuation */}
          {isPrivate && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Estimated Valuation</h4>
              <div className="grid grid-cols-2 gap-3">
                {company.estimated_valuation && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Valuation</p>
                    <p className="text-lg font-semibold">${formatLargeNumber(company.estimated_valuation)}</p>
                  </div>
                )}
                {company.estimated_revenue && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Est. Revenue</p>
                    <p className="text-lg font-semibold">${formatLargeNumber(company.estimated_revenue)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Performance */}
          {!isPrivate && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Performance</h4>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '1D', value: company.return_1d },
                  { label: '7D', value: company.return_7d },
                  { label: '30D', value: company.return_30d },
                  { label: '1Y', value: company.return_1y },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn(
                      "text-sm font-semibold",
                      value !== null && value > 0 ? "text-green-500" : 
                      value !== null && value < 0 ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {value !== null ? formatPercent(value) : '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Private Company Info */}
          {isPrivate && (
            <>
              {company.funding_stage && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Funding</h4>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{company.funding_stage}</Badge>
                    {company.total_funding && (
                      <span className="text-sm">
                        ${formatLargeNumber(company.total_funding)} raised
                      </span>
                    )}
                  </div>
                </div>
              )}
              {company.key_investors && company.key_investors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Investors</h4>
                  <div className="flex flex-wrap gap-2">
                    {company.key_investors.map((investor, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {investor}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          
          {/* Actions */}
          {!isPrivate && company.symbol && (
            <div className="pt-4 border-t">
              <Link href={`/asset/${company.asset_id || company.company_id.replace('public_', '')}`}>
                <Button className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Full Analysis
                </Button>
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Tier Navigation Sidebar
function TierNavigation({
  tiers,
  activeTier,
  onTierClick
}: {
  tiers: SupplyChainTier[];
  activeTier: number | null;
  onTierClick: (tierNumber: number) => void;
}) {
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden lg:block">
      <div className="flex flex-col gap-2 p-2 rounded-xl bg-background/80 backdrop-blur-sm border shadow-lg">
        {tiers.map((tier) => {
          const colors = tierColors[tier.tier_number] || tierColors[0];
          const isActive = activeTier === tier.tier_number;
          
          return (
            <Tooltip key={tier.tier_id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onTierClick(tier.tier_number)}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                    isActive ? colors.bg : "hover:bg-muted",
                    isActive && colors.border,
                    isActive && "border"
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold",
                    isActive ? colors.text : "text-muted-foreground"
                  )}>
                    {tier.tier_number === -1 ? 'B' : tier.tier_number}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{tier.tier_name}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// Heat Map Toggle Component
function HeatMapToggle({
  period,
  onChange
}: {
  period: HeatMapPeriod;
  onChange: (period: HeatMapPeriod) => void;
}) {
  const periods: { value: HeatMapPeriod; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: '1d', label: '1D' },
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '1y', label: '1Y' },
  ];
  
  return (
    <div className="flex items-center gap-2">
      <Thermometer className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Heat Map:</span>
      <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded-md transition-all",
              period === p.value 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Main Component
export default function SupplyChainMap() {
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set([1])); // Start with bottleneck tier expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [selectedCompany, setSelectedCompany] = useState<SupplyChainCompany | null>(null);
  const [activeTier, setActiveTier] = useState<number | null>(null);
  const [heatMapPeriod, setHeatMapPeriod] = useState<HeatMapPeriod>('off');
  const [viewMode, setViewMode] = useState<'tree' | 'flow'>('tree');
  
  // Fetch supply chain data
  const { data: tiers, error, isLoading } = useSWR<SupplyChainTier[]>(
    '/api/supply-chain/tiers',
    apiFetcher,
    { revalidateOnFocus: false }
  );
  
  // Toggle tier expansion
  const toggleTier = useCallback((tierNumber: number) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tierNumber)) {
        next.delete(tierNumber);
      } else {
        next.add(tierNumber);
      }
      return next;
    });
  }, []);
  
  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);
  
  // Expand all tiers and categories
  const expandAll = useCallback(() => {
    if (!tiers) return;
    const allTierNumbers = new Set(tiers.map(t => t.tier_number));
    const allCategoryIds = new Set<number>();
    tiers.forEach(tier => {
      tier.categories?.forEach(cat => {
        allCategoryIds.add(cat.category_id);
      });
    });
    setExpandedTiers(allTierNumbers);
    setExpandedCategories(allCategoryIds);
  }, [tiers]);
  
  // Collapse all tiers and categories
  const collapseAll = useCallback(() => {
    setExpandedTiers(new Set());
    setExpandedCategories(new Set());
  }, []);
  
  // Handle tier navigation click
  const handleTierNavClick = useCallback((tierNumber: number) => {
    setActiveTier(tierNumber);
    setExpandedTiers(prev => new Set([...Array.from(prev), tierNumber]));
    
    // Scroll to tier
    const element = document.getElementById(`tier-${tierNumber}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);
  
  // Calculate totals
  const totals = useMemo(() => {
    if (!tiers) return { companies: 0, publicCompanies: 0, privateCompanies: 0, totalMarketCap: 0 };
    
    let publicCompanies = 0;
    let privateCompanies = 0;
    let totalMarketCap = 0;
    
    tiers.forEach(tier => {
      tier.categories?.forEach(cat => {
        publicCompanies += cat.public_company_count || 0;
        privateCompanies += cat.private_company_count || 0;
        cat.companies?.forEach(company => {
          if (company.market_cap) totalMarketCap += company.market_cap;
        });
      });
    });
    
    return {
      companies: publicCompanies + privateCompanies,
      publicCompanies,
      privateCompanies,
      totalMarketCap
    };
  }, [tiers]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading supply chain data...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Failed to load supply chain data</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">AI Infrastructure Supply Chain</h1>
                <p className="text-sm text-muted-foreground">
                  Interactive map of the AI compute stack from raw materials to applications
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center hidden md:block">
                <p className="text-lg font-bold">${formatLargeNumber(totals.totalMarketCap)}</p>
                <p className="text-xs text-muted-foreground">Total Mkt Cap</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{totals.companies}</p>
                <p className="text-muted-foreground">Total Companies</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{totals.publicCompanies}</p>
                <p className="text-muted-foreground">Public</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{totals.privateCompanies}</p>
                <p className="text-muted-foreground">Private</p>
              </div>
            </div>
          </div>
          
          {/* Controls Row */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                <Button
                  variant={viewMode === 'tree' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('tree')}
                  className="text-xs h-7"
                >
                  <Layers className="h-3 w-3 mr-1" />
                  Tree View
                </Button>
                <Button
                  variant={viewMode === 'flow' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('flow')}
                  className="text-xs h-7"
                >
                  <Activity className="h-3 w-3 mr-1" />
                  Flow View
                </Button>
              </div>
              
              {/* Tree View Controls */}
              {viewMode === 'tree' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAll}
                    className="text-xs"
                  >
                    <ChevronsUpDown className="h-3 w-3 mr-1" />
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAll}
                    className="text-xs"
                  >
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Collapse All
                  </Button>
                </div>
              )}
            </div>
            {viewMode === 'tree' && <HeatMapToggle period={heatMapPeriod} onChange={setHeatMapPeriod} />}
          </div>
        </div>
      </header>
      
      {/* Flow View */}
      {viewMode === 'flow' && (
        <main className="container mx-auto px-4 py-8">
          <Suspense fallback={
            <div className="flex items-center justify-center h-[600px] bg-black/50 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-2 text-muted-foreground">Loading flow visualization...</span>
            </div>
          }>
            <SupplyChainFlow />
          </Suspense>
        </main>
      )}
      
      {/* Tree View */}
      {viewMode === 'tree' && (
        <>
          {/* Heat Map Legend */}
          {heatMapPeriod !== 'off' && (
            <div className="container mx-auto px-4 py-2">
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-muted-foreground">Performance:</span>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-4 rounded bg-red-500/60" />
                  <span>&lt;-10%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-4 rounded bg-red-500/25" />
                  <span>-5%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-4 rounded bg-muted/30" />
                  <span>0%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-4 rounded bg-green-500/25" />
                  <span>+5%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-4 rounded bg-green-500/60" />
                  <span>&gt;+10%</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Main Content */}
          <main className="container mx-auto px-4 py-8 pr-20 lg:pr-24">
            <div className="space-y-6">
              {tiers?.map((tier) => (
                <div key={tier.tier_id} id={`tier-${tier.tier_number}`}>
                  <TierSection
                    tier={tier}
                    isExpanded={expandedTiers.has(tier.tier_number)}
                    onToggle={() => toggleTier(tier.tier_number)}
                    expandedCategories={expandedCategories}
                    onCategoryToggle={toggleCategory}
                    onCompanyClick={setSelectedCompany}
                    heatMapPeriod={heatMapPeriod}
                  />
                </div>
              ))}
            </div>
          </main>
          
          {/* Tier Navigation */}
          {tiers && <TierNavigation tiers={tiers} activeTier={activeTier} onTierClick={handleTierNavClick} />}
        </>
      )}
      
      {/* Company Detail Sheet */}
      <CompanyDetailSheet
        company={selectedCompany}
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
      />
    </div>
  );
}

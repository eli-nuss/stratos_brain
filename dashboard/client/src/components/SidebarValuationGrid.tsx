import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ValuationData {
  pe_ratio?: number | null;
  forward_pe?: number | null;
  peg_ratio?: number | null;
  price_to_sales_ttm?: number | null;
  forward_price_to_sales?: number | null;
  price_to_book?: number | null;
}

// Helper to color-code the PEG ratio (The most important valuation context)
function getPegColor(value: number | undefined | null) {
  if (value === undefined || value === null) return "text-zinc-400";
  if (value < 1.0) return "text-emerald-400"; // Undervalued
  if (value > 2.0) return "text-red-400";     // Premium
  return "text-yellow-400";                   // Fair Value
}

// Helper to get background color from text color
function getBgFromTextColor(textColor: string): string {
  return textColor.replace('text-', 'bg-');
}

// Helper for info tooltips
function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground/50 hover:text-muted-foreground cursor-help ml-0.5">ⓘ</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarValuationGrid({ data }: { data: ValuationData }) {
  // Check if valuation is improving (Forward < TTM)
  const peImproving = data.forward_pe && data.pe_ratio && data.forward_pe < data.pe_ratio;
  const psImproving = data.forward_price_to_sales && data.price_to_sales_ttm && data.forward_price_to_sales < data.price_to_sales_ttm;

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* 1. PEG Ratio - The "Growth-Adjusted" Signal */}
      <div className="bg-muted/30 border border-border/50 rounded-lg p-2.5 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-1 opacity-[0.07]">
          <span className="text-3xl font-bold">PEG</span>
        </div>
        
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">PEG Ratio</span>
          <InfoTooltip content="Price/Earnings to Growth. Below 1.0 = undervalued relative to growth. Above 2.0 = premium valuation." />
        </div>
        
        <div className="mt-1">
          <span className={cn("text-xl font-bold font-mono", getPegColor(data.peg_ratio))}>
            {data.peg_ratio?.toFixed(2) || "—"}
          </span>
        </div>
        
        <div className="mt-1.5 h-1 w-full bg-muted rounded-full overflow-hidden">
           {/* Visual bar capped at 2.5 */}
           <div 
             className={cn("h-full rounded-full transition-all", getBgFromTextColor(getPegColor(data.peg_ratio)))} 
             style={{ width: `${Math.min(((data.peg_ratio || 0) / 2.5) * 100, 100)}%` }} 
           />
        </div>
        
        <span className="text-[9px] text-muted-foreground/70 mt-1 font-medium">
          {data.peg_ratio === undefined || data.peg_ratio === null ? "No data" : 
           data.peg_ratio < 1 ? "Undervalued Growth" : 
           data.peg_ratio > 2 ? "High Expectations" : "Fairly Valued"}
        </span>
      </div>

      {/* 2. P/E Ratio - TTM vs Forward */}
      <div className="bg-muted/30 border border-border/50 rounded-lg p-2.5">
        <div className="flex justify-between items-start mb-0.5">
          <div className="flex items-center gap-0.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">P/E Ratio</span>
            <InfoTooltip content="Price-to-Earnings. The gold standard for profitable companies. Lower is cheaper." />
          </div>
          {data.forward_pe && data.pe_ratio && (
            peImproving ? 
              <ArrowDownRight className="w-3 h-3 text-emerald-500" /> : 
              <ArrowUpRight className="w-3 h-3 text-red-500" />
          )}
        </div>
        
        <div className="mb-2">
          <span className="text-xl font-bold text-foreground font-mono">
            {data.pe_ratio?.toFixed(1) || "—"}
          </span>
          <span className="text-[9px] text-muted-foreground/60 ml-0.5">TTM</span>
        </div>
        
        <div className="flex justify-between items-center pt-1.5 border-t border-border/30">
          <span className="text-[9px] text-muted-foreground/70">Forward</span>
          <span className={cn("text-xs font-mono font-bold", peImproving ? "text-emerald-400" : "text-muted-foreground")}>
            {data.forward_pe?.toFixed(1) || "—"}
          </span>
        </div>
      </div>

      {/* 3. Price/Sales - TTM vs Forward */}
      <div className="bg-muted/30 border border-border/50 rounded-lg p-2.5">
        <div className="flex justify-between items-start mb-0.5">
          <div className="flex items-center gap-0.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Price/Sales</span>
            <InfoTooltip content="Price-to-Sales. Useful for growth companies or those with volatile earnings." />
          </div>
          {data.forward_price_to_sales && data.price_to_sales_ttm && (
            psImproving ? 
              <ArrowDownRight className="w-3 h-3 text-emerald-500" /> : 
              <ArrowUpRight className="w-3 h-3 text-red-500" />
          )}
        </div>
        
        <div className="mb-2">
          <span className="text-lg font-bold text-foreground font-mono">
            {data.price_to_sales_ttm?.toFixed(1) || "—"}
          </span>
          <span className="text-[9px] text-muted-foreground/60 ml-0.5">TTM</span>
        </div>
        
        <div className="flex justify-between items-center pt-1.5 border-t border-border/30">
          <span className="text-[9px] text-muted-foreground/70">Forward</span>
          <span className={cn("text-xs font-mono font-bold", psImproving ? "text-emerald-400" : "text-muted-foreground")}>
            {data.forward_price_to_sales?.toFixed(1) || "—"}
          </span>
        </div>
      </div>

      {/* 4. Price/Book - Asset Base */}
      <div className="bg-muted/30 border border-border/50 rounded-lg p-2.5 flex flex-col justify-between">
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Price/Book</span>
          <InfoTooltip content="Price-to-Book Value. Safety check - if everything fails, what are the assets worth?" />
        </div>
        
        <div className="mt-1">
          <span className="text-lg font-bold text-foreground font-mono">
            {data.price_to_book?.toFixed(1) || "—"}
          </span>
        </div>
        
        <div className="mt-auto pt-1.5 text-[9px] text-muted-foreground/60">
          Asset Value
        </div>
      </div>
    </div>
  );
}

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValuationData {
  pe_ratio?: number;
  forward_pe?: number;
  peg_ratio?: number;
  price_to_sales_ttm?: number;
  forward_price_to_sales?: number;
  price_to_book?: number;
}

// Helper to color-code the PEG ratio (The most important valuation context)
function getPegColor(value: number | undefined) {
  if (value === undefined) return "text-zinc-400";
  if (value < 1.0) return "text-emerald-400"; // Undervalued
  if (value > 2.0) return "text-red-400";     // Premium
  return "text-yellow-400";                   // Fair Value
}

// Helper to get background color from text color
function getBgFromTextColor(textColor: string): string {
  return textColor.replace('text-', 'bg-');
}

export function ValuationGrid({ data }: { data: ValuationData }) {
  // Check if valuation is improving (Forward < TTM)
  const peImproving = data.forward_pe && data.pe_ratio && data.forward_pe < data.pe_ratio;
  const psImproving = data.forward_price_to_sales && data.price_to_sales_ttm && data.forward_price_to_sales < data.price_to_sales_ttm;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 1. PEG Ratio - The "Growth-Adjusted" Signal */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-1.5 opacity-10">
          <span className="text-4xl font-bold">PEG</span>
        </div>
        
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">PEG Ratio</span>
        
        <div className="mt-1">
          <span className={cn("text-2xl font-bold font-mono", getPegColor(data.peg_ratio))}>
            {data.peg_ratio?.toFixed(2) || "—"}
          </span>
        </div>
        
        <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
           {/* Visual bar capped at 2.5 */}
           <div 
             className={cn("h-full rounded-full transition-all", getBgFromTextColor(getPegColor(data.peg_ratio)))} 
             style={{ width: `${Math.min(((data.peg_ratio || 0) / 2.5) * 100, 100)}%` }} 
           />
        </div>
        
        <span className="text-[10px] text-zinc-500 mt-1.5 font-medium">
          {data.peg_ratio === undefined ? "No data" : 
           data.peg_ratio < 1 ? "Undervalued Growth" : 
           data.peg_ratio > 2 ? "High Expectations" : "Fairly Valued"}
        </span>
      </div>

      {/* 2. P/E Ratio - TTM vs Forward */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
        <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">P/E Ratio</span>
          {data.forward_pe && data.pe_ratio && (
            peImproving ? 
              <ArrowDownRight className="w-3 h-3 text-emerald-500" /> : 
              <ArrowUpRight className="w-3 h-3 text-red-500" />
          )}
        </div>
        
        <div className="mb-3">
          <span className="text-2xl font-bold text-zinc-200 font-mono">
            {data.pe_ratio?.toFixed(1) || "—"}x
          </span>
          <span className="text-[10px] text-zinc-600 ml-1">TTM</span>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
          <span className="text-[10px] text-zinc-500">Forward</span>
          <span className={cn("text-xs font-mono font-bold", peImproving ? "text-emerald-400" : "text-zinc-400")}>
            {data.forward_pe?.toFixed(1) || "—"}x
          </span>
        </div>
      </div>

      {/* 3. Price/Sales - TTM vs Forward */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
        <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Price / Sales</span>
          {data.forward_price_to_sales && data.price_to_sales_ttm && (
            psImproving ? 
              <ArrowDownRight className="w-3 h-3 text-emerald-500" /> : 
              <ArrowUpRight className="w-3 h-3 text-red-500" />
          )}
        </div>
        
        <div className="mb-3">
          <span className="text-xl font-bold text-zinc-200 font-mono">
            {data.price_to_sales_ttm?.toFixed(1) || "—"}x
          </span>
          <span className="text-[10px] text-zinc-600 ml-1">TTM</span>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
          <span className="text-[10px] text-zinc-500">Forward</span>
          <span className={cn("text-xs font-mono font-bold", psImproving ? "text-emerald-400" : "text-zinc-400")}>
            {data.forward_price_to_sales?.toFixed(1) || "—"}x
          </span>
        </div>
      </div>

      {/* 4. Price/Book - Asset Base */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex flex-col justify-between">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Price / Book</span>
        
        <div className="mt-1">
          <span className="text-xl font-bold text-zinc-200 font-mono">
            {data.price_to_book?.toFixed(1) || "—"}x
          </span>
        </div>
        
        <div className="mt-auto pt-2 text-[10px] text-zinc-600">
          Asset Value
        </div>
      </div>
    </div>
  );
}

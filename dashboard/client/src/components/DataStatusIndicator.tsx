import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DataStatusIndicatorProps {
  equityDate?: string;
  cryptoDate?: string;
  className?: string;
}

export function DataStatusIndicator({ equityDate, cryptoDate, className = '' }: DataStatusIndicatorProps) {
  // Format date for display
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Loading...';
    try {
      const date = new Date(dateStr + 'T00:00:00');
      const month = date.toLocaleString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}`;
    } catch {
      return dateStr;
    }
  };

  // Check if data is recent (within last 2 days for equities, same day for crypto)
  const isDataFresh = () => {
    if (!equityDate && !cryptoDate) return null;
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // For crypto, check if it's today
    if (cryptoDate === today) return true;
    
    // For equities, check if it's within 2 business days
    if (equityDate) {
      const eqDate = new Date(equityDate + 'T00:00:00');
      const diffDays = Math.floor((now.getTime() - eqDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3; // Allow for weekends
    }
    
    return false;
  };

  const fresh = isDataFresh();
  const statusColor = fresh === null ? 'bg-muted-foreground/50' : fresh ? 'bg-emerald-500' : 'bg-amber-500';
  const statusText = fresh === null ? 'Loading' : fresh ? 'Data Live' : 'Data Delayed';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/30 transition-colors cursor-default ${className}`}>
          <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
          <span className="text-[11px] font-medium text-muted-foreground hidden lg:inline">
            {statusText}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Equities:</span>
            <span className="font-mono">{formatDate(equityDate)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Crypto:</span>
            <span className="font-mono">{formatDate(cryptoDate)}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default DataStatusIndicator;

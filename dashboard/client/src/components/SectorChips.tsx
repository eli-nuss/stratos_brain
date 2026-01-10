import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface Sector {
  id: string;
  label: string;
}

interface SectorChipsProps {
  sectors: Sector[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  maxVisible?: number;
}

export function SectorChips({ 
  sectors, 
  value, 
  onChange, 
  className = '',
  maxVisible = 6
}: SectorChipsProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const visibleSectors = sectors.slice(0, maxVisible);
  const hiddenSectors = sectors.slice(maxVisible);
  const hasMore = hiddenSectors.length > 0;
  
  // Check if selected value is in hidden sectors
  const selectedHidden = hiddenSectors.find(s => s.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {/* All/Clear button */}
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
          value === null
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground'
        )}
      >
        All
      </button>
      
      {/* Visible sector chips */}
      {visibleSectors.map((sector) => (
        <button
          key={sector.id}
          onClick={() => onChange(sector.id === value ? null : sector.id)}
          className={cn(
            'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
            value === sector.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground'
          )}
        >
          {sector.label}
        </button>
      ))}
      
      {/* More dropdown */}
      {hasMore && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors flex items-center gap-1',
              selectedHidden
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground'
            )}
          >
            {selectedHidden ? selectedHidden.label : `+${hiddenSectors.length}`}
            <ChevronDown className={cn('w-3 h-3 transition-transform', showDropdown && 'rotate-180')} />
          </button>
          
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 py-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
              {hiddenSectors.map((sector) => (
                <button
                  key={sector.id}
                  onClick={() => {
                    onChange(sector.id === value ? null : sector.id);
                    setShowDropdown(false);
                  }}
                  className={cn(
                    'w-full px-3 py-1.5 text-xs text-left transition-colors',
                    value === sector.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted/50'
                  )}
                >
                  {sector.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SectorChips;

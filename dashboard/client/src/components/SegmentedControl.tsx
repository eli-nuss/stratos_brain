import { cn } from '@/lib/utils';

interface Segment {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl({ 
  segments, 
  value, 
  onChange, 
  className = '',
  size = 'sm'
}: SegmentedControlProps) {
  const activeIndex = segments.findIndex(s => s.id === value);
  
  return (
    <div 
      className={cn(
        'relative flex items-center bg-muted/30 rounded-lg p-0.5 border border-border/50',
        className
      )}
    >
      {/* Sliding background indicator - only show when a segment is selected */}
      {activeIndex >= 0 && (
        <div 
          className="absolute top-0.5 bottom-0.5 bg-primary rounded-md transition-all duration-200 ease-out"
          style={{
            width: `calc(${100 / segments.length}% - 2px)`,
            left: `calc(${(activeIndex * 100) / segments.length}% + 1px)`,
          }}
        />
      )}
      
      {/* Segment buttons */}
      {segments.map((segment) => (
        <button
          key={segment.id}
          onClick={() => onChange(segment.id)}
          className={cn(
            'relative z-10 flex items-center justify-center gap-1.5 font-medium transition-colors',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
            'flex-1 rounded-md',
            value === segment.id 
              ? 'text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {segment.icon}
          {segment.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedControl;

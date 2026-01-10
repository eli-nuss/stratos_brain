import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  actions?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'prominent';
}

export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  actions,
  className,
  variant = 'default',
}: SectionHeaderProps) {
  const variants = {
    default: 'px-4 py-3 border-b border-border',
    compact: 'px-3 py-2 border-b border-border',
    prominent: 'px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/10',
  };

  return (
    <div className={cn(
      'flex items-center justify-between',
      variants[variant],
      className
    )}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5 text-primary', iconClassName)} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// Smaller header button for consistent action styling
interface HeaderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  label?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
}

export function HeaderButton({
  icon: Icon,
  label,
  variant = 'default',
  loading,
  className,
  disabled,
  ...props
}: HeaderButtonProps) {
  const variants = {
    default: 'text-muted-foreground hover:text-foreground hover:bg-muted',
    danger: 'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
  };

  return (
    <button
      className={cn(
        'flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50',
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {Icon && <Icon className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />}
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

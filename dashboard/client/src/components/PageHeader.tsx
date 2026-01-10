import { Activity, ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
  /** Page title displayed next to the logo */
  title: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Icon to display next to the title */
  icon?: ReactNode;
  /** Additional content to render on the right side (buttons, filters, etc.) */
  actions?: ReactNode;
  /** Whether to show the back to dashboard link (default: true) */
  showBackLink?: boolean;
  /** Custom back link URL (default: "/") */
  backLinkUrl?: string;
  /** Custom back link text (default: "Back to Dashboard") */
  backLinkText?: string;
  /** Additional content to render below the main header row */
  children?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  showBackLink = true,
  backLinkUrl = "/",
  backLinkText = "Back to Dashboard",
  children,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="px-4 py-3">
        {/* Main header row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Logo, divider, page title */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {/* Logo/Brand */}
            <a 
              href="/" 
              className="flex items-center gap-2 text-base sm:text-lg font-bold tracking-tight shrink-0"
            >
              <Activity className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              <span className="hidden sm:inline">STRATOS</span>
              <span className="sm:hidden">S</span>
              <span className="text-muted-foreground font-normal hidden sm:inline">BRAIN</span>
              <span className="text-muted-foreground font-normal sm:hidden">B</span>
            </a>
            
            {/* Divider */}
            <div className="h-5 w-px bg-border hidden sm:block" />
            
            {/* Page title with optional icon */}
            <div className="flex items-center gap-2 min-w-0">
              {icon && <span className="shrink-0">{icon}</span>}
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-semibold truncate">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">{subtitle}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Right side: Actions and back link */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {actions}
            
            {showBackLink && (
              <a
                href={backLinkUrl}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md bg-muted/50 hover:bg-muted transition-colors min-h-[44px] sm:min-h-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{backLinkText}</span>
                <span className="sm:hidden">Back</span>
              </a>
            )}
          </div>
        </div>
        
        {/* Optional additional content row */}
        {children && (
          <div className="mt-3 pt-3 border-t border-border">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}

export default PageHeader;

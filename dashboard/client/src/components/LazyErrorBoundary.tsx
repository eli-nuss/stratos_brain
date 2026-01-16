import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  fallbackPath?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for lazy-loaded components.
 * Handles chunk loading failures gracefully.
 */
class LazyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Log chunk loading errors
    if (error.message.includes('Loading chunk') || error.message.includes('Failed to fetch')) {
      console.error('Chunk loading failed:', error);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = 
        this.state.error?.message.includes('Loading chunk') || 
        this.state.error?.message.includes('Failed to fetch') ||
        this.state.error?.message.includes('dynamically imported module');

      return (
        <div className="flex items-center justify-center min-h-[50vh] p-8">
          <div className="flex flex-col items-center max-w-md text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
            
            <h2 className="text-lg font-semibold mb-2">
              {isChunkError ? 'Page Failed to Load' : 'Something went wrong'}
            </h2>
            
            <p className="text-sm text-muted-foreground mb-6">
              {isChunkError 
                ? 'This might be due to a new deployment. Please refresh to get the latest version.'
                : 'An error occurred while loading this page.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 transition-opacity"
                )}
              >
                <RotateCcw className="w-4 h-4" />
                Refresh
              </button>
              
              <button
                onClick={this.handleGoHome}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-muted text-foreground",
                  "hover:bg-muted/80 transition-colors"
                )}
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default LazyErrorBoundary;

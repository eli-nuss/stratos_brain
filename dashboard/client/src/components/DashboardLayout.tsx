import { ReactNode } from "react";
import useSWR from "swr";
import { Activity, Database, Brain, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: "crypto" | "equity";
  onTabChange: (tab: "crypto" | "equity") => void;
}

export default function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const { data: health } = useSWR("/api/dashboard/health", fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Status Bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              STRATOS<span className="text-muted-foreground font-normal">BRAIN</span>
            </h1>
            
            <div className="h-4 w-px bg-border" />
            
            {/* Health Stats */}
            <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>EQ: {health?.latest_dates?.equity || "..."}</span>
                <span className="text-border">|</span>
                <span>CRYPTO: {health?.latest_dates?.crypto || "..."}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3" />
                <span>{health?.eligible_assets?.equity + health?.eligible_assets?.crypto || 0} ASSETS</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Brain className="w-3 h-3" />
                <span>AI REVIEWS: {health?.ai_reviews_today?.total || 0}</span>
                {health?.ai_reviews_today?.urgent > 0 && (
                  <span className="text-attention-urgent flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {health.ai_reviews_today.urgent} URGENT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center bg-muted/50 p-1 rounded-lg">
            <button
              onClick={() => onTabChange("crypto")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === "crypto"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Crypto
            </button>
            <button
              onClick={() => onTabChange("equity")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === "equity"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Equities
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-6">
        {children}
      </main>
    </div>
  );
}

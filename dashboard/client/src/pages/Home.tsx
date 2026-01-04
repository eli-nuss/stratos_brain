import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AllAssetsTable from "@/components/AllAssetsTable";
import AssetDetail from "@/components/AssetDetail";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const [activeTab, setActiveTab] = useState<"crypto" | "equity">("crypto");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Get latest date for the active tab
  const { data: health } = useSWR("/api/dashboard/health", fetcher);
  const date = health?.latest_dates?.[activeTab];

  const handleAssetClick = (assetId: string) => {
    setSelectedAssetId(assetId);
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="h-[calc(100vh-8rem)]">
        <AllAssetsTable
          key={`all-${activeTab}`}
          assetType={activeTab}
          date={date}
          onAssetClick={handleAssetClick}
        />
      </div>
      
      {/* Asset Detail Modal */}
      {selectedAssetId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <AssetDetail 
              assetId={selectedAssetId} 
              onClose={() => setSelectedAssetId(null)} 
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

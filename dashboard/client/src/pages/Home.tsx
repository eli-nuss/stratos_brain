import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AllAssetsTable from "@/components/AllAssetsTable";
import WatchlistTable from "@/components/WatchlistTable";
import StockListTable from "@/components/StockListTable";
import AssetDetail from "@/components/AssetDetail";
import useSWR from "swr";
import { useStockLists, StockList } from "@/hooks/useStockLists";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type TabType = "watchlist" | "crypto" | "equity" | `list-${number}`;

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("watchlist");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const { lists } = useStockLists();

  // Get latest date for the active tab
  const { data: health } = useSWR("/api/dashboard/health", fetcher);
  const assetType = activeTab === "crypto" ? "crypto" : activeTab === "equity" ? "equity" : undefined;
  const date = assetType ? health?.latest_dates?.[assetType] : undefined;

  const handleAssetClick = (assetId: string) => {
    setSelectedAssetId(assetId);
  };

  // Check if current tab is a stock list
  const isStockListTab = activeTab.startsWith("list-");
  const currentListId = isStockListTab ? parseInt(activeTab.split("-")[1]) : null;
  const currentList = currentListId ? lists.find((l: StockList) => l.id === currentListId) : null;

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      stockLists={lists}
    >
      <div className="h-[calc(100vh-8rem)]">
        {activeTab === "watchlist" ? (
          <WatchlistTable
            key="watchlist"
            onAssetClick={handleAssetClick}
          />
        ) : isStockListTab && currentList ? (
          <StockListTable
            key={`list-${currentListId}`}
            list={currentList}
            onAssetClick={handleAssetClick}
          />
        ) : (
          <AllAssetsTable
            key={`all-${activeTab}`}
            assetType={activeTab as "crypto" | "equity"}
            date={date}
            onAssetClick={handleAssetClick}
          />
        )}
      </div>
      
      {/* Asset Detail Modal */}
      {selectedAssetId && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg w-[80vw] max-w-[1600px] h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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

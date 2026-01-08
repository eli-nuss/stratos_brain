import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
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
  const [location, setLocation] = useLocation();
  const [, listParams] = useRoute("/list/:listId");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const { lists, mutate: mutateLists } = useStockLists();

  // Derive active tab from URL
  const getTabFromUrl = (): TabType => {
    if (location === "/equities") return "equity";
    if (location === "/crypto") return "crypto";
    if (location === "/watchlist" || location === "/") return "watchlist";
    if (listParams?.listId) return `list-${listParams.listId}` as TabType;
    return "watchlist";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromUrl());

  // Sync activeTab with URL changes
  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location, listParams?.listId]);

  // Handle tab change - update URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "watchlist") {
      setLocation("/watchlist");
    } else if (tab === "equity") {
      setLocation("/equities");
    } else if (tab === "crypto") {
      setLocation("/crypto");
    } else if (tab.startsWith("list-")) {
      const listId = tab.split("-")[1];
      setLocation(`/list/${listId}`);
    }
  };

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

  // Handle list reordering
  const handleListsReordered = (newOrder: StockList[]) => {
    // Optimistically update the local state
    mutateLists(newOrder, false);
  };

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      onTabChange={handleTabChange}
      stockLists={lists}
      onListCreated={mutateLists}
      onListsReordered={handleListsReordered}
      onListDeleted={mutateLists}
      onListRenamed={mutateLists}
    >
      <div className="h-[calc(100vh-10rem)] sm:h-[calc(100vh-8rem)]">
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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full sm:w-[90vw] lg:w-[80vw] max-w-[1600px] h-[95vh] sm:h-[90vh] lg:h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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

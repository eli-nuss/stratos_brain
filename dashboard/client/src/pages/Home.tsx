import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import CustomizableAssetTable from "@/components/CustomizableAssetTable";
import CustomizableWatchlistTable from "@/components/CustomizableWatchlistTable";
import CustomizableStockListTable from "@/components/CustomizableStockListTable";
import CustomizableModelPortfolioTable from "@/components/CustomizableModelPortfolioTable";
import CustomizableCorePortfolioTable from "@/components/CustomizableCorePortfolioTable";
import CorePortfolioHoldings from "@/components/CorePortfolioHoldings";
import ETFTable from "@/components/ETFTable";
import IndicesTable from "@/components/IndicesTable";
import CommoditiesTable from "@/components/CommoditiesTable";
import ModelPortfolioHoldings from "@/components/ModelPortfolioHoldings";
import PortfolioSandbox from "@/components/PortfolioSandbox";
import AssetDetail from "@/components/AssetDetail";
import useSWR from "swr";
import { useStockLists, StockList } from "@/hooks/useStockLists";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type TabType = "watchlist" | "model-portfolio" | "model-portfolio-sandbox" | "core-portfolio" | "crypto" | "equity" | "etfs" | "indices" | "commodities" | `list-${number}`;

export default function Home() {
  const [location, setLocation] = useLocation();
  const [, listParams] = useRoute("/list/:listId");
  const [, assetParams] = useRoute("/asset/:assetId");
  const { lists, mutate: mutateLists } = useStockLists();

  // Track the previous view for when closing asset detail
  const [previousView, setPreviousView] = useState<string>("/watchlist");

  // Derive selected asset from URL (the assetId in URL is the numeric ID)
  const selectedAssetId = assetParams?.assetId || null;

  // Derive active tab from URL (ignore asset routes for tab selection)
  const getTabFromUrl = (): TabType => {
    // If we're on an asset page, use the previous view's tab
    if (location.startsWith("/asset/")) {
      if (previousView === "/equities") return "equity";
      if (previousView === "/crypto") return "crypto";
      if (previousView === "/model-portfolio") return "model-portfolio";
      if (previousView === "/core-portfolio") return "core-portfolio";
      if (previousView.startsWith("/list/")) {
        const listId = previousView.split("/list/")[1];
        return `list-${listId}` as TabType;
      }
      return "watchlist";
    }
    if (location === "/equities") return "equity";
    if (location === "/crypto") return "crypto";
    if (location === "/etfs") return "etfs";
    if (location === "/indices") return "indices";
    if (location === "/commodities") return "commodities";
    if (location === "/model-portfolio") return "model-portfolio";
    if (location === "/core-portfolio") return "core-portfolio";
    if (location === "/watchlist" || location === "/") return "watchlist";
    if (listParams?.listId) return `list-${listParams.listId}` as TabType;
    return "watchlist";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromUrl());

  // Sync activeTab with URL changes
  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location, listParams?.listId, previousView]);

  // Track previous view when navigating away from asset pages
  useEffect(() => {
    if (!location.startsWith("/asset/")) {
      setPreviousView(location);
    }
  }, [location]);

  // Handle tab change - update URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "watchlist") {
      setLocation("/watchlist");
    } else if (tab === "model-portfolio") {
      setLocation("/model-portfolio");
    } else if (tab === "core-portfolio") {
      setLocation("/core-portfolio");
    } else if (tab === "equity") {
      setLocation("/equities");
    } else if (tab === "crypto") {
      setLocation("/crypto");
    } else if (tab === "etfs") {
      setLocation("/etfs");
    } else if (tab === "indices") {
      setLocation("/indices");
    } else if (tab === "commodities") {
      setLocation("/commodities");
    } else if (tab.startsWith("list-")) {
      const listId = tab.split("-")[1];
      setLocation(`/list/${listId}`);
    }
  };

  // Handle asset click - update URL to show asset detail
  // The assetId passed from tables is already the numeric ID (row.asset_id)
  const handleAssetClick = (assetId: string) => {
    setLocation(`/asset/${assetId}`);
  };

  // Handle closing asset detail - go back to previous view
  const handleCloseAssetDetail = () => {
    setLocation(previousView || "/watchlist");
  };

  // Get latest date for the active tab
  const { data: health } = useSWR("/api/dashboard/health", fetcher);
  const assetType = activeTab === "crypto" ? "crypto" : activeTab === "equity" ? "equity" : undefined;
  const date = assetType ? health?.latest_dates?.[assetType] : undefined;

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
          <CustomizableWatchlistTable
            key="watchlist"
            onAssetClick={handleAssetClick}
          />
        ) : activeTab === "model-portfolio" ? (
          <PortfolioSandbox
            key="model-portfolio"
            onAssetClick={handleAssetClick}
          />
        ) : activeTab === "core-portfolio" ? (
          <CorePortfolioHoldings
            key="core-portfolio"
            onAssetClick={handleAssetClick}
          />
        ) : activeTab === "etfs" ? (
          <ETFTable key="etfs" />
        ) : activeTab === "indices" ? (
          <IndicesTable key="indices" />
        ) : activeTab === "commodities" ? (
          <CommoditiesTable key="commodities" />
        ) : isStockListTab && currentList ? (
          <CustomizableStockListTable
            key={`list-${currentListId}`}
            list={currentList}
            onAssetClick={handleAssetClick}
          />
        ) : (
          <CustomizableAssetTable
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
              onClose={handleCloseAssetDetail} 
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

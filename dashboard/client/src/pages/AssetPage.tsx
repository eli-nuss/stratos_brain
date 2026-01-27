import { useParams, useLocation } from "wouter";
import AssetDetail from "@/components/AssetDetail";

/**
 * Standalone Asset Page that wraps AssetDetail
 * Uses browser history for back navigation, so it works from any page
 */
export default function AssetPage() {
  const params = useParams<{ assetId: string }>();
  const [, setLocation] = useLocation();

  const handleClose = () => {
    // Use browser history to go back to the previous page
    // This works from Daily Brief, Smart Money, or any other page
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // Fallback to watchlist if no history
      setLocation("/watchlist");
    }
  };

  if (!params.assetId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Asset not found</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full sm:w-[90vw] lg:w-[80vw] max-w-[1600px] h-[95vh] sm:h-[90vh] lg:h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <AssetDetail 
          assetId={params.assetId} 
          onClose={handleClose} 
        />
      </div>
    </div>
  );
}

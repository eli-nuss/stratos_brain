import { X, ChevronDown } from "lucide-react";

export default function AssetDetailSkeleton() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            {/* Symbol & Name */}
            <div className="space-y-2">
              <div className="h-8 w-32 animate-pulse bg-muted rounded" />
              <div className="h-4 w-48 animate-pulse bg-muted rounded" />
            </div>
            {/* Date */}
            <div className="h-4 w-24 animate-pulse bg-muted rounded" />
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
            <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
            <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 p-4">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-4">
          {/* Chart Section */}
          <div className="space-y-3">
            {/* Tabs */}
            <div className="flex items-center gap-2 border-b">
              <div className="h-9 w-24 animate-pulse bg-muted rounded-t" />
              <div className="h-9 w-24 animate-pulse bg-muted rounded-t" />
            </div>
            {/* Chart Area */}
            <div className="h-[450px] animate-pulse bg-muted rounded-lg" />
          </div>

          {/* AI Analysis Section */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-pulse bg-muted rounded" />
              <div className="h-5 w-32 animate-pulse bg-muted rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse bg-muted rounded" />
              <div className="h-4 w-full animate-pulse bg-muted rounded" />
              <div className="h-4 w-3/4 animate-pulse bg-muted rounded" />
              <div className="h-4 w-5/6 animate-pulse bg-muted rounded" />
            </div>
            {/* Confidence Meter */}
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1 h-2 animate-pulse bg-muted rounded-full" />
              <div className="h-4 w-10 animate-pulse bg-muted rounded" />
            </div>
          </div>

          {/* Trade Plan Section */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="h-5 w-24 animate-pulse bg-muted rounded" />
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="h-4 w-12 animate-pulse bg-muted rounded" />
                <div className="h-8 w-full animate-pulse bg-muted rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-12 animate-pulse bg-muted rounded" />
                <div className="h-8 w-full animate-pulse bg-muted rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-12 animate-pulse bg-muted rounded" />
                <div className="h-8 w-full animate-pulse bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-3 space-y-3">
          {/* About Section */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-16 animate-pulse bg-muted rounded" />
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Fundamentals Card */}
          <div className="border rounded-lg p-3 space-y-3">
            <div className="h-5 w-24 animate-pulse bg-muted rounded" />
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-20 animate-pulse bg-muted rounded" />
                  <div className="h-4 w-16 animate-pulse bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="h-5 w-20 animate-pulse bg-muted rounded" />
            <div className="h-10 w-full animate-pulse bg-muted rounded" />
            <div className="h-10 w-full animate-pulse bg-muted rounded" />
          </div>

          {/* Notes Section */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="h-5 w-14 animate-pulse bg-muted rounded" />
            <div className="h-24 w-full animate-pulse bg-muted rounded" />
          </div>

          {/* Files Section */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="h-5 w-10 animate-pulse bg-muted rounded" />
            <div className="h-8 w-full animate-pulse bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

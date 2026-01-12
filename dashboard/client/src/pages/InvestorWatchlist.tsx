import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, RefreshCw, Trash2, TrendingUp, TrendingDown, Minus, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

const API_BASE = "/api/investor-api";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
};

interface InvestorSummary {
  investor_id: number;
  investor_name: string;
  cik: string;
  last_filing_date: string;
  last_updated: string;
  total_positions: number;
  total_portfolio_value: number;
  new_positions: number;
  increased_positions: number;
  reduced_positions: number;
  sold_positions: number;
  top_holdings: string[];
}

interface Holding {
  symbol: string;
  company_name: string;
  shares: number;
  value: number;
  percent_portfolio: number;
  change_shares: number;
  change_percent: number;
  action: string;
  date_reported: string;
  quarter: string;
}

interface SearchResult {
  cik: string;
  name: string;
  entityType?: string;
}

export default function InvestorWatchlist() {

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<number | null>(null);

  // Fetch list of tracked investors
  const { data: investors, mutate: mutateInvestors, isLoading: isLoadingInvestors } = useSWR<InvestorSummary[]>(
    `${API_BASE}/investors`,
    fetcher
  );

  // Fetch holdings for selected investor
  const { data: holdings, mutate: mutateHoldings, isLoading: isLoadingHoldings } = useSWR<Holding[]>(
    selectedInvestor ? `${API_BASE}/holdings/${selectedInvestor}` : null,
    fetcher
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE}/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      toast.error("Could not search for investors. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleTrackInvestor = async (cik: string, name: string) => {
    try {
      const response = await fetch(`${API_BASE}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cik, name }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Added ${name} with ${data.holdingsCount} holdings from ${data.quarter}`);
        mutateInvestors();
        setIsDialogOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      } else {
        toast.error(data.error || "Failed to track investor");
      }
    } catch (error) {
      toast.error("Failed to track investor. Please try again.");
    }
  };

  const handleRefreshInvestor = async (investorId: number, name: string) => {
    try {
      const response = await fetch(`${API_BASE}/refresh/${investorId}`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Updated ${name} with ${data.holdingsCount} holdings from ${data.quarter}`);
        mutateInvestors();
        if (selectedInvestor === investorId) {
          mutateHoldings();
        }
      } else {
        toast.error(data.error || "Failed to refresh holdings");
      }
    } catch (error) {
      toast.error("Failed to refresh holdings. Please try again.");
    }
  };

  const handleDeleteInvestor = async (investorId: number, name: string) => {
    if (!confirm(`Remove ${name} from tracking?`)) return;

    try {
      const response = await fetch(`${API_BASE}/investors/${investorId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(`${name} removed from tracking`);
        mutateInvestors();
        if (selectedInvestor === investorId) {
          setSelectedInvestor(null);
        }
      }
    } catch (error) {
      toast.error("Failed to remove investor. Please try again.");
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(0);
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      NEW: { variant: "default", icon: Plus },
      ADD: { variant: "default", icon: TrendingUp },
      REDUCE: { variant: "secondary", icon: TrendingDown },
      SOLD: { variant: "destructive", icon: Minus },
      HOLD: { variant: "outline", icon: Minus },
    };

    const config = variants[action] || variants.HOLD;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {action}
      </Badge>
    );
  };

  const investorList = Array.isArray(investors) ? investors : [];
  const selectedInvestorData = investorList.find((g) => g.investor_id === selectedInvestor);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Investor Watchlist</h1>
            <p className="text-muted-foreground">
              Track institutional investor portfolios via 13F filings
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Investor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Search for Investor</DialogTitle>
                <DialogDescription>
                  Search by fund name or investor name (e.g., "Berkshire Hathaway", "Scion", "Pershing Square")
                </DialogDescription>
              </DialogHeader>

              <div className="flex gap-2">
                <Input
                  placeholder="Search for investor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
                  {searchResults.map((result) => (
                    <Card key={result.cik} className="cursor-pointer hover:bg-accent" onClick={() => handleTrackInvestor(result.cik, result.name)}>
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm">{result.name}</CardTitle>
                        <CardDescription className="text-xs">CIK: {result.cik}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: List of Gurus */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Tracked Investors</CardTitle>
                <CardDescription>
                  {investorList.length} investors tracked
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoadingInvestors && <p className="text-sm text-muted-foreground">Loading...</p>}
                
                {investorList.map((investor) => (
                  <Card
                    key={investor.investor_id}
                    className={`cursor-pointer transition-colors ${
                      selectedInvestor === investor.investor_id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                    onClick={() => setSelectedInvestor(investor.investor_id)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm">{investor.investor_name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {investor.total_positions} positions • {investor.quarter || investor.last_filing_date}
                          </CardDescription>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {formatCurrency(investor.total_portfolio_value)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRefreshInvestor(investor.investor_id, investor.investor_name);
                            }}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInvestor(investor.investor_id, investor.investor_name);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}

                {!isLoadingInvestors && investorList.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No investors tracked yet. Click "Add Investor" to get started.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content: Holdings Table */}
          <div className="lg:col-span-2">
            {selectedInvestorData ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedInvestorData.investor_name}</CardTitle>
                      <CardDescription>
                        Portfolio as of {selectedInvestorData.last_filing_date} • {selectedInvestorData.total_positions} positions
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {selectedInvestorData.new_positions} New
                      </Badge>
                      <Badge variant="outline">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {selectedInvestorData.increased_positions} Added
                      </Badge>
                      <Badge variant="outline">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        {selectedInvestorData.reduced_positions} Reduced
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingHoldings && <p className="text-sm text-muted-foreground">Loading holdings...</p>}
                  
                  {holdings && holdings.length > 0 && (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead className="text-right">% Portfolio</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead className="text-right">Shares</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {holdings.map((holding) => (
                            <TableRow key={holding.symbol}>
                              <TableCell className="font-medium">{holding.symbol}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{holding.company_name}</TableCell>
                              <TableCell className="text-right font-medium">
                                {holding.percent_portfolio?.toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(holding.value)}</TableCell>
                              <TableCell className="text-right">{formatNumber(holding.shares)}</TableCell>
                              <TableCell className="text-right">
                                <span className={holding.change_percent > 0 ? "text-green-600" : holding.change_percent < 0 ? "text-red-600" : ""}>
                                  {holding.change_percent > 0 ? "+" : ""}{holding.change_percent?.toFixed(1)}%
                                </span>
                              </TableCell>
                              <TableCell>{getActionBadge(holding.action)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {!isLoadingHoldings && holdings?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No holdings found for this investor.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Select an investor to view their portfolio</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click on an investor from the list to see their holdings
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

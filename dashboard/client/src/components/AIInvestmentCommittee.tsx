import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Brain, Loader2, RefreshCw, AlertTriangle, CheckCircle, 
  TrendingUp, Shield, Target, Lightbulb, Copy, Download
} from "lucide-react";
import { API_BASE, getJsonApiHeaders } from "@/lib/api-config";

interface PortfolioAsset {
  symbol: string;
  name?: string;
  weight: number; // 0-100 (percentage)
  assetType?: string;
  category?: string;
}

interface AIInvestmentCommitteeProps {
  portfolio: PortfolioAsset[];
  corePortfolioValue?: number;
  riskMetrics?: {
    volatility?: number;
    beta?: number;
    sharpeRatio?: number;
  };
}

interface AnalysisSection {
  title: string;
  icon: React.ReactNode;
  content: string;
  severity?: 'info' | 'warning' | 'success' | 'danger';
}

export function AIInvestmentCommittee({ 
  portfolio, 
  corePortfolioValue = 100000,
  riskMetrics 
}: AIInvestmentCommitteeProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  // Calculate portfolio composition for the prompt
  const getPortfolioSummary = () => {
    const byCategory: Record<string, { weight: number; assets: string[] }> = {};
    
    portfolio.forEach(asset => {
      const category = asset.category || asset.assetType || 'other';
      if (!byCategory[category]) {
        byCategory[category] = { weight: 0, assets: [] };
      }
      byCategory[category].weight += asset.weight;
      byCategory[category].assets.push(`${asset.symbol} (${asset.weight.toFixed(1)}%)`);
    });

    const topHoldings = [...portfolio]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map(a => `${a.symbol} at ${a.weight.toFixed(1)}%`);

    return {
      byCategory,
      topHoldings,
      totalPositions: portfolio.length,
      portfolioValue: corePortfolioValue,
    };
  };

  const generateAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const summary = getPortfolioSummary();
      
      // Build the prompt
      const categoryBreakdown = Object.entries(summary.byCategory)
        .map(([cat, data]) => `${cat}: ${data.weight.toFixed(1)}% (${data.assets.join(', ')})`)
        .join('\n');

      const prompt = `You are a senior portfolio manager conducting an Investment Committee review. Analyze this portfolio and provide a structured critique.

PORTFOLIO COMPOSITION:
${categoryBreakdown}

TOP 5 HOLDINGS:
${summary.topHoldings.join('\n')}

PORTFOLIO METRICS:
- Total Positions: ${summary.totalPositions}
- Portfolio Value: $${summary.portfolioValue.toLocaleString()}
${riskMetrics?.volatility ? `- Estimated Volatility: ${(riskMetrics.volatility * 100).toFixed(1)}%` : ''}
${riskMetrics?.beta ? `- Portfolio Beta: ${riskMetrics.beta.toFixed(2)}` : ''}
${riskMetrics?.sharpeRatio ? `- Sharpe Ratio: ${riskMetrics.sharpeRatio.toFixed(2)}` : ''}

Provide your analysis in the following format (be specific and actionable):

1. CONCENTRATION RISK: Identify any dangerous concentration in sectors, assets, or correlated positions.

2. DIVERSIFICATION GAPS: What asset classes or sectors are missing that could improve risk-adjusted returns?

3. RISK/REWARD ASSESSMENT: Is this portfolio positioned for the current market environment? What's the biggest risk?

4. SPECIFIC RECOMMENDATIONS: Provide 2-3 specific, actionable changes with target allocations.

5. HEDGE SUGGESTIONS: What positions could protect this portfolio in a downturn?

Keep each section to 2-3 sentences. Be direct and specific.`;

      // Call the backend API
      const response = await fetch(`${API_BASE}/dashboard/ai-analysis`, {
        method: 'POST',
        headers: getJsonApiHeaders(),
        body: JSON.stringify({ 
          prompt,
          type: 'portfolio_review'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate analysis');
      }

      const data = await response.json();
      
      // Parse the response into sections
      const sections = parseAnalysisResponse(data.analysis || data.content || '');
      setAnalysis(sections);
      setLastGenerated(new Date());
    } catch (err) {
      console.error('Analysis error:', err);
      // Show error instead of falling back to mock
      setError('Failed to generate AI analysis. Please check that the Gemini API is configured in your Supabase environment.');
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  };

  const parseAnalysisResponse = (text: string): AnalysisSection[] => {
    const sections: AnalysisSection[] = [];
    
    // Try to parse structured response
    const patterns = [
      { regex: /CONCENTRATION RISK[:\s]*([\s\S]*?)(?=\d\.|DIVERSIFICATION|$)/i, title: 'Concentration Risk', icon: <AlertTriangle className="w-4 h-4" />, severity: 'warning' as const },
      { regex: /DIVERSIFICATION GAPS?[:\s]*([\s\S]*?)(?=\d\.|RISK|$)/i, title: 'Diversification Gaps', icon: <Target className="w-4 h-4" />, severity: 'info' as const },
      { regex: /RISK.?REWARD[:\s]*([\s\S]*?)(?=\d\.|SPECIFIC|$)/i, title: 'Risk/Reward Assessment', icon: <TrendingUp className="w-4 h-4" />, severity: 'info' as const },
      { regex: /SPECIFIC RECOMMENDATIONS?[:\s]*([\s\S]*?)(?=\d\.|HEDGE|$)/i, title: 'Recommendations', icon: <Lightbulb className="w-4 h-4" />, severity: 'success' as const },
      { regex: /HEDGE SUGGESTIONS?[:\s]*([\s\S]*?)$/i, title: 'Hedge Suggestions', icon: <Shield className="w-4 h-4" />, severity: 'info' as const },
    ];

    patterns.forEach(({ regex, title, icon, severity }) => {
      const match = text.match(regex);
      if (match && match[1]) {
        sections.push({
          title,
          icon,
          content: match[1].trim().replace(/^\d+\.\s*/, ''),
          severity,
        });
      }
    });

    // If parsing failed, return the full text as a single section
    if (sections.length === 0 && text) {
      sections.push({
        title: 'Portfolio Analysis',
        icon: <Brain className="w-4 h-4" />,
        content: text,
        severity: 'info',
      });
    }

    return sections;
  };

  const generateMockAnalysis = (): AnalysisSection[] => {
    const summary = getPortfolioSummary();
    const topHolding = portfolio.sort((a, b) => b.weight - a.weight)[0];
    const hasCrypto = portfolio.some(a => a.assetType === 'crypto' || a.category === 'tokens');
    const cryptoWeight = portfolio
      .filter(a => a.assetType === 'crypto' || a.category === 'tokens')
      .reduce((sum, a) => sum + a.weight, 0);

    return [
      {
        title: 'Concentration Risk',
        icon: <AlertTriangle className="w-4 h-4" />,
        content: topHolding 
          ? `Your largest position, ${topHolding.symbol} at ${topHolding.weight.toFixed(1)}%, represents significant single-asset risk. ${
              topHolding.weight > 20 
                ? 'Consider trimming to below 15% to reduce idiosyncratic risk.' 
                : 'This is within acceptable limits but monitor closely.'
            }${hasCrypto && cryptoWeight > 30 ? ` Additionally, your ${cryptoWeight.toFixed(0)}% crypto allocation creates high correlation risk during risk-off events.` : ''}`
          : 'Unable to assess concentration without position data.',
        severity: topHolding && topHolding.weight > 25 ? 'danger' : 'warning',
      },
      {
        title: 'Diversification Gaps',
        icon: <Target className="w-4 h-4" />,
        content: `Your portfolio lacks exposure to ${
          !portfolio.some(a => ['GLD', 'GOLD', 'IAU'].includes(a.symbol)) ? 'gold/precious metals, ' : ''
        }${
          !portfolio.some(a => ['TLT', 'BND', 'AGG'].includes(a.symbol)) ? 'fixed income, ' : ''
        }${
          !portfolio.some(a => ['VEA', 'EFA', 'IEFA'].includes(a.symbol)) ? 'international equities, ' : ''
        }which could improve risk-adjusted returns. Consider a 5-10% allocation to uncorrelated assets.`,
        severity: 'info',
      },
      {
        title: 'Risk/Reward Assessment',
        icon: <TrendingUp className="w-4 h-4" />,
        content: `This portfolio has a ${
          hasCrypto && cryptoWeight > 20 ? 'high-risk, high-reward' : 'moderate risk'
        } profile. ${
          riskMetrics?.beta && riskMetrics.beta > 1.3 
            ? `With a beta of ${riskMetrics.beta.toFixed(2)}, expect amplified moves in both directions.` 
            : ''
        } The biggest risk is ${
          hasCrypto ? 'a crypto winter coinciding with a tech selloff, which could result in 40%+ drawdowns.' 
            : 'sector concentration during a rotation out of growth/tech stocks.'
        }`,
        severity: 'warning',
      },
      {
        title: 'Recommendations',
        icon: <Lightbulb className="w-4 h-4" />,
        content: `1. ${topHolding && topHolding.weight > 20 ? `Reduce ${topHolding.symbol} to 15% and reallocate to underweight sectors.` : 'Maintain current allocation weights.'} 2. Add 5% allocation to GLD or a gold miner ETF for inflation hedge. 3. ${
          hasCrypto && cryptoWeight > 30 
            ? `Reduce crypto exposure from ${cryptoWeight.toFixed(0)}% to 20% maximum.` 
            : 'Consider adding 3-5% BTC exposure for asymmetric upside.'
        }`,
        severity: 'success',
      },
      {
        title: 'Hedge Suggestions',
        icon: <Shield className="w-4 h-4" />,
        content: `For downside protection: 1) Buy 3-month SPY puts at 10% OTM (cost ~1% of portfolio). 2) Add 5% allocation to TLT for flight-to-safety during equity selloffs. 3) ${
          hasCrypto 
            ? 'Consider reducing crypto positions before major Fed meetings or macro events.' 
            : 'Maintain 5-10% cash buffer for opportunistic buying during corrections.'
        }`,
        severity: 'info',
      },
    ];
  };

  const copyToClipboard = () => {
    if (!analysis) return;
    const text = analysis.map(s => `## ${s.title}\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const getSeverityStyles = (severity?: string) => {
    switch (severity) {
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-500/5';
      case 'danger':
        return 'border-l-red-500 bg-red-500/5';
      case 'success':
        return 'border-l-green-500 bg-green-500/5';
      default:
        return 'border-l-blue-500 bg-blue-500/5';
    }
  };

  return (
    <Card className="border-l-4 border-l-violet-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-500" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">AI Investment Committee</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Get an AI-powered portfolio critique similar to what a professional investment committee would provide. Analyzes concentration risk, diversification gaps, and provides actionable recommendations.</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastGenerated && (
              <span className="text-xs text-muted-foreground">
                Generated {lastGenerated.toLocaleTimeString()}
              </span>
            )}
            {analysis && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy to clipboard</TooltipContent>
              </Tooltip>
            )}
            <Button 
              onClick={generateAnalysis} 
              disabled={isLoading || portfolio.length === 0}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : analysis ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Generate Memo
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Portfolio Summary */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs text-muted-foreground mb-2 cursor-help">Portfolio Overview</div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Summary of your portfolio by category. This information is sent to the AI for analysis.</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex flex-wrap gap-2">
            {Object.entries(getPortfolioSummary().byCategory).map(([category, data]) => (
              <Badge key={category} variant="outline" className="font-mono">
                {category}: {data.weight.toFixed(0)}%
              </Badge>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500 mb-4" />
            <p className="text-muted-foreground">Analyzing portfolio composition...</p>
            <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="w-4 h-4" />
              Analysis Failed
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && !isLoading && (
          <div className="space-y-3">
            {analysis.map((section, index) => {
              const sectionTooltips: Record<string, string> = {
                'Concentration Risk': 'Identifies positions that are too large relative to your portfolio, creating single-asset risk.',
                'Diversification Gaps': 'Highlights asset classes or sectors missing from your portfolio that could improve risk-adjusted returns.',
                'Risk/Reward Assessment': 'Overall evaluation of your portfolio\'s risk profile and potential return characteristics.',
                'Recommendations': 'Specific, actionable steps to improve your portfolio based on the analysis.',
                'Hedge Suggestions': 'Strategies to protect your portfolio from downside risk, including options and defensive positions.',
                'Portfolio Analysis': 'General analysis of your portfolio composition and characteristics.',
              };
              return (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border-l-4 ${getSeverityStyles(section.severity)}`}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 font-medium mb-2 cursor-help">
                        {section.icon}
                        {section.title}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{sectionTooltips[section.title] || section.title}</p>
                    </TooltipContent>
                  </Tooltip>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {section.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!analysis && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-2">
              Get an AI-powered critique of your portfolio
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              The AI Investment Committee will analyze your portfolio for concentration risk, 
              diversification gaps, and provide specific recommendations.
            </p>
          </div>
        )}

        {/* Disclaimer */}
        {analysis && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            This analysis is AI-generated and should not be considered financial advice. 
            Always consult with a qualified financial advisor.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIInvestmentCommittee;

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Calculator, BookOpen, Info, Settings } from "lucide-react";
import { RiskSettingsValues, DEFAULT_RISK_SETTINGS } from "./RiskSettings";

interface MetricExplanation {
  name: string;
  shortDescription: string;
  formula: (settings: RiskSettingsValues) => string;
  formulaExplanation: (settings: RiskSettingsValues) => string;
  interpretation: string[];
  example?: string;
  dataSource: (settings: RiskSettingsValues) => string;
}

const createMetricExplanations = (settings: RiskSettingsValues): MetricExplanation[] => [
  {
    name: "Annualized Volatility",
    shortDescription: "Expected yearly price swing range",
    formula: () => `σ_annual = σ_daily × √${settings.annualizationFactor}`,
    formulaExplanation: () => `Standard deviation of daily returns, multiplied by √${settings.annualizationFactor} (${settings.annualizationFactor === 252 ? 'trading days' : 'calendar days'} per year) to annualize`,
    interpretation: [
      "20% volatility means the portfolio could swing ±20% in a typical year",
      "< 15% = Low volatility (bonds, stable stocks)",
      "15-25% = Moderate volatility (diversified equity portfolio)",
      "25-40% = High volatility (growth stocks, single sectors)",
      "> 40% = Very high volatility (crypto, leveraged positions)"
    ],
    example: `If daily returns have σ = 1.5%, then annual volatility = 1.5% × √${settings.annualizationFactor} ≈ ${(1.5 * Math.sqrt(settings.annualizationFactor)).toFixed(1)}%`,
    dataSource: () => `Calculated from ${settings.lookbackDays} days of daily returns from the daily_features table`
  },
  {
    name: "Beta (β)",
    shortDescription: "Sensitivity to market movements",
    formula: () => `β = Cov(R_portfolio, R_${settings.benchmark}) / Var(R_${settings.benchmark})`,
    formulaExplanation: () => `Covariance of portfolio returns with ${settings.benchmark} returns, divided by variance of ${settings.benchmark} returns. We use ${settings.benchmark} as the market benchmark.`,
    interpretation: [
      "β = 1.0: Portfolio moves exactly with the market",
      "β = 1.5: Portfolio moves 50% more than the market (if market drops 10%, portfolio drops 15%)",
      "β = 0.5: Portfolio moves 50% less than the market",
      "β < 0: Portfolio moves opposite to the market (rare, hedged positions)",
      "β > 2.0: Very aggressive, leveraged-like exposure"
    ],
    example: `If ${settings.benchmark} drops 10% and your portfolio drops 12%, your beta is approximately 1.2`,
    dataSource: () => `Calculated from ${settings.lookbackDays} days of returns vs ${settings.benchmark}`
  },
  {
    name: "Sharpe Ratio",
    shortDescription: "Risk-adjusted return (return per unit of risk)",
    formula: () => `Sharpe = (R_portfolio - ${settings.riskFreeRate}%) / σ_portfolio`,
    formulaExplanation: () => `Excess return (portfolio return minus risk-free rate of ${settings.riskFreeRate}%) divided by portfolio volatility.`,
    interpretation: [
      "< 0: Losing money or underperforming risk-free rate",
      "0 - 1.0: Suboptimal risk-adjusted returns",
      "1.0 - 2.0: Good risk-adjusted returns",
      "2.0 - 3.0: Excellent risk-adjusted returns",
      "> 3.0: Outstanding (rare, verify data quality)"
    ],
    example: `Portfolio returns 15%, risk-free is ${settings.riskFreeRate}%, volatility is 20%. Sharpe = (15% - ${settings.riskFreeRate}%) / 20% = ${((15 - settings.riskFreeRate) / 20).toFixed(2)}`,
    dataSource: () => `Calculated from ${settings.lookbackDays} days of historical returns with ${settings.riskFreeRate}% risk-free rate`
  },
  {
    name: "Max Drawdown",
    shortDescription: "Largest peak-to-trough decline",
    formula: () => "Max DD = max[(Peak_t - Trough_t) / Peak_t]",
    formulaExplanation: () => `The maximum percentage decline from any peak to any subsequent trough over the ${settings.lookbackDays}-day measurement period.`,
    interpretation: [
      "Shows your worst-case historical scenario",
      "-10% to -20%: Normal for diversified portfolios",
      "-20% to -40%: Significant but recoverable",
      "-40% to -60%: Severe (2008 crisis territory)",
      "> -60%: Catastrophic (crypto bear markets, leveraged losses)"
    ],
    example: "If portfolio peaked at $100K and dropped to $70K before recovering, max drawdown = -30%",
    dataSource: () => `Calculated from simulated portfolio value using ${settings.lookbackDays} days of historical daily returns`
  },
  {
    name: "Diversification Score",
    shortDescription: "How well assets are spread across uncorrelated investments",
    formula: () => "Div Score = 1 - (Average Pairwise Correlation)",
    formulaExplanation: () => "One minus the average correlation between all asset pairs. Higher score means assets move more independently.",
    interpretation: [
      "0-30%: Poor diversification (assets highly correlated)",
      "30-50%: Moderate diversification",
      "50-70%: Good diversification",
      "> 70%: Excellent diversification (rare with traditional assets)"
    ],
    example: "If average correlation between your 10 assets is 0.4, diversification score = 1 - 0.4 = 60%",
    dataSource: () => `Calculated from the correlation matrix based on ${settings.lookbackDays} days of returns`
  },
  {
    name: "Correlation",
    shortDescription: "How two assets move together",
    formula: () => "ρ = Cov(R_a, R_b) / (σ_a × σ_b)",
    formulaExplanation: () => "Covariance of two assets' returns divided by the product of their standard deviations. Ranges from -1 to +1.",
    interpretation: [
      "+1.0: Perfect positive correlation (move together exactly)",
      "+0.7 to +1.0: High correlation (limited diversification benefit)",
      "+0.3 to +0.7: Moderate correlation",
      "-0.3 to +0.3: Low correlation (good diversification)",
      "-1.0 to -0.3: Negative correlation (hedge benefit)"
    ],
    example: "BTC and ETH often have correlation > 0.8, while BTC and Gold might be 0.1-0.3",
    dataSource: () => `Calculated from ${settings.lookbackDays} days of daily returns for each asset pair`
  },
  {
    name: "Risk Contribution",
    shortDescription: "How much each asset contributes to total portfolio risk",
    formula: () => "RC_i = w_i × (Σ_j w_j × σ_i × σ_j × ρ_ij) / σ_portfolio",
    formulaExplanation: () => "Each asset's marginal contribution to portfolio variance, accounting for its weight, volatility, and correlations with other assets.",
    interpretation: [
      "Risk contribution can exceed capital weight for volatile assets",
      "A 10% position in BTC might contribute 30% of portfolio risk",
      "Cash has 0% risk contribution regardless of weight",
      "Aim for risk contributions roughly aligned with capital weights"
    ],
    example: "30% BTC position with 60% volatility in a 20% volatility portfolio might contribute 50%+ of total risk",
    dataSource: () => `Calculated using individual asset volatilities and the ${settings.lookbackDays}-day correlation matrix`
  },
  {
    name: "Portfolio Volatility (Multi-Asset)",
    shortDescription: "Total portfolio risk accounting for diversification",
    formula: () => `σ_p = √(Σ_i Σ_j w_i × w_j × σ_i × σ_j × ρ_ij) × √${settings.annualizationFactor}`,
    formulaExplanation: () => `Square root of the weighted sum of all pairwise covariances, annualized by √${settings.annualizationFactor}. This is why diversification reduces risk - correlations < 1 reduce total volatility.`,
    interpretation: [
      "Always less than or equal to weighted average of individual volatilities",
      "The 'diversification benefit' is the difference between weighted average vol and portfolio vol",
      "More assets with low correlations = lower portfolio volatility"
    ],
    example: "Two assets each with 30% vol and 0.5 correlation: Portfolio vol = 30% × √(1 + 0.5) / √2 ≈ 26%",
    dataSource: () => `Calculated from individual asset volatilities and the full ${settings.lookbackDays}-day correlation matrix`
  }
];

interface MetricCardProps {
  metric: MetricExplanation;
  settings: RiskSettingsValues;
  isOpen: boolean;
  onToggle: () => void;
}

function MetricCard({ metric, settings, isOpen, onToggle }: MetricCardProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <div className="text-left">
              <div className="font-medium">{metric.name}</div>
              <div className="text-xs text-muted-foreground">{metric.shortDescription}</div>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {metric.formula(settings).split('=')[0].trim()}
          </Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 border border-t-0 rounded-b-lg space-y-4 bg-card">
          {/* Formula */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Calculator className="w-4 h-4" />
              Formula
            </div>
            <div className="p-3 bg-muted/50 rounded font-mono text-sm">
              {metric.formula(settings)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{metric.formulaExplanation(settings)}</p>
          </div>

          {/* Interpretation */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <BookOpen className="w-4 h-4" />
              How to Interpret
            </div>
            <ul className="space-y-1">
              {metric.interpretation.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Example */}
          {metric.example && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="text-sm font-medium text-blue-600 mb-1">Example</div>
              <p className="text-sm">{metric.example}</p>
            </div>
          )}

          {/* Data Source */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3 h-3 mt-0.5" />
            <span>{metric.dataSource(settings)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface RiskMetricsExplainerProps {
  settings?: RiskSettingsValues;
}

export function RiskMetricsExplainer({ settings = DEFAULT_RISK_SETTINGS }: RiskMetricsExplainerProps) {
  const [openMetrics, setOpenMetrics] = useState<Set<string>>(new Set());
  const metricExplanations = createMetricExplanations(settings);

  const toggleMetric = (name: string) => {
    setOpenMetrics(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const expandAll = () => {
    setOpenMetrics(new Set(metricExplanations.map(m => m.name)));
  };

  const collapseAll = () => {
    setOpenMetrics(new Set());
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-5 h-5 text-primary" />
            How Metrics Are Calculated
          </CardTitle>
          <div className="flex gap-2">
            <button 
              onClick={expandAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Expand All
            </button>
            <span className="text-muted-foreground">|</span>
            <button 
              onClick={collapseAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Collapse All
            </button>
          </div>
        </div>
        
        {/* Current Settings Display */}
        <div className="mt-3 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium mb-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            Current Calculation Settings
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Lookback Period</div>
              <div className="font-mono font-medium">{settings.lookbackDays} days</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Risk-Free Rate</div>
              <div className="font-mono font-medium">{settings.riskFreeRate}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Benchmark</div>
              <div className="font-mono font-medium">{settings.benchmark}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Annualization</div>
              <div className="font-mono font-medium">√{settings.annualizationFactor} days</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            These settings affect how all metrics are calculated. Change them in the Sandbox tab using the Settings button.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {metricExplanations.map(metric => (
          <MetricCard
            key={metric.name}
            metric={metric}
            settings={settings}
            isOpen={openMetrics.has(metric.name)}
            onToggle={() => toggleMetric(metric.name)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

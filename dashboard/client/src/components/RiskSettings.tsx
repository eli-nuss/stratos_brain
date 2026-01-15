import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings, Info, RotateCcw, Calendar, Percent, TrendingUp } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface RiskSettingsValues {
  lookbackDays: number;
  riskFreeRate: number;
  annualizationFactor: number;
  benchmark: 'SPY' | 'BTC' | 'QQQ';
}

export const DEFAULT_RISK_SETTINGS: RiskSettingsValues = {
  lookbackDays: 90,
  riskFreeRate: 4.5,
  annualizationFactor: 252,
  benchmark: 'SPY',
};

const LOOKBACK_OPTIONS = [
  { value: 30, label: '30 Days', description: 'Short-term, more reactive' },
  { value: 60, label: '60 Days', description: 'Recent trends' },
  { value: 90, label: '90 Days', description: 'Standard (default)' },
  { value: 180, label: '180 Days', description: 'Medium-term view' },
  { value: 365, label: '1 Year', description: 'Long-term perspective' },
];

const BENCHMARK_OPTIONS = [
  { value: 'SPY', label: 'SPY (S&P 500)', description: 'US large-cap equities' },
  { value: 'QQQ', label: 'QQQ (Nasdaq 100)', description: 'US tech-heavy index' },
  { value: 'BTC', label: 'BTC (Bitcoin)', description: 'Crypto benchmark' },
];

const ANNUALIZATION_OPTIONS = [
  { value: 252, label: '252 (Trading Days)', description: 'Standard for equities' },
  { value: 365, label: '365 (Calendar Days)', description: 'For 24/7 crypto markets' },
];

interface RiskSettingsProps {
  settings: RiskSettingsValues;
  onChange: (settings: RiskSettingsValues) => void;
  compact?: boolean;
}

export function RiskSettings({ settings, onChange, compact = false }: RiskSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const handleApply = () => {
    onChange(localSettings);
    setIsOpen(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_RISK_SETTINGS);
    onChange(DEFAULT_RISK_SETTINGS);
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);
  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_RISK_SETTINGS);

  if (compact) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
            {!isDefault && <Badge variant="secondary" className="ml-1 text-xs">Custom</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Risk Calculation Settings</h4>
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={isDefault}>
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>
            
            <SettingsForm 
              settings={localSettings} 
              onChange={setLocalSettings} 
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply} disabled={!hasChanges}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="w-5 h-5 text-primary" />
            Risk Calculation Settings
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={isDefault}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset to Defaults
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingsForm 
          settings={localSettings} 
          onChange={setLocalSettings} 
        />
        
        {hasChanges && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setLocalSettings(settings)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SettingsFormProps {
  settings: RiskSettingsValues;
  onChange: (settings: RiskSettingsValues) => void;
}

function SettingsForm({ settings, onChange }: SettingsFormProps) {
  return (
    <div className="space-y-4">
      {/* Lookback Period */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <label className="text-sm font-medium">Lookback Period</label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3 h-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Number of historical days used to calculate volatility, correlation, and other metrics. Longer periods are more stable but less reactive to recent changes.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Select 
          value={String(settings.lookbackDays)} 
          onValueChange={(v) => onChange({ ...settings, lookbackDays: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOOKBACK_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                <div className="flex items-center justify-between w-full">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Risk-Free Rate */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-muted-foreground" />
          <label className="text-sm font-medium">Risk-Free Rate (%)</label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3 h-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>The return you could earn with zero risk (typically T-bill yield). Used in Sharpe Ratio calculation. Current US 3-month T-bill is ~4.5%.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.1"
            min="0"
            max="20"
            value={settings.riskFreeRate}
            onChange={(e) => onChange({ ...settings, riskFreeRate: parseFloat(e.target.value) || 0 })}
            className="w-24 font-mono"
          />
          <span className="text-sm text-muted-foreground">% annual</span>
        </div>
      </div>

      {/* Benchmark */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <label className="text-sm font-medium">Benchmark</label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3 h-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>The market index used to calculate Beta and compare performance. Choose based on your portfolio composition.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Select 
          value={settings.benchmark} 
          onValueChange={(v) => onChange({ ...settings, benchmark: v as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BENCHMARK_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center justify-between w-full">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Annualization Factor */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <label className="text-sm font-medium">Annualization Factor</label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3 h-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Days per year used to annualize volatility. Use 252 for traditional markets (trading days) or 365 for crypto (24/7 markets).</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Select 
          value={String(settings.annualizationFactor)} 
          onValueChange={(v) => onChange({ ...settings, annualizationFactor: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANNUALIZATION_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                <div className="flex items-center justify-between w-full">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Summary badge showing current settings
export function RiskSettingsSummary({ settings }: { settings: RiskSettingsValues }) {
  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_RISK_SETTINGS);
  
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="font-mono">
            {settings.lookbackDays}d
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Lookback: {settings.lookbackDays} days of historical data</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="font-mono">
            Rf={settings.riskFreeRate}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Risk-free rate: {settings.riskFreeRate}% (used in Sharpe Ratio)</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="font-mono">
            vs {settings.benchmark}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Benchmark: {settings.benchmark} (used for Beta calculation)</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="font-mono">
            ×√{settings.annualizationFactor}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Annualization: √{settings.annualizationFactor} days/year</TooltipContent>
      </Tooltip>
      
      {!isDefault && (
        <Badge variant="secondary" className="text-xs">Custom</Badge>
      )}
    </div>
  );
}

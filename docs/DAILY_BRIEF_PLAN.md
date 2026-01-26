# Stratos Brain Daily Brief - Comprehensive Plan

## Executive Summary

The Daily Brief is an AI-powered morning intelligence report for fund managers that synthesizes all available data in the Stratos Brain platform into actionable insights. Using **Gemini 3 Pro Preview** as an agentic "Chief of Staff," the system will analyze market conditions, identify the highest-conviction trading opportunities, and present them in a structured, professional format.

---

## Architecture Overview

### Core Philosophy
1. **Alpha Over Noise** - Explain *why* moves happened and whether they're tradeable
2. **Skepticism First** - Hunt for the bear case on every bullish setup
3. **Thematic Clusters** - Group setups by theme (stocks rarely move alone)
4. **Quality Filter** - Separate "Speculative Momentum" from "Quality Growth"

### Agent Design: "Stratos CIO Agent"
- **Model**: `gemini-3-pro-preview` with `thinking_level: "high"`
- **Context Window**: 1M tokens input, 64K output
- **Approach**: Chain-of-Thought reasoning before final synthesis
- **Output**: Structured JSON that maps to UI components

---

## Proposed Sections for Fund Managers

### Section 1: Market Pulse (Executive Summary)
**Purpose**: 30-second overview of market conditions

**Data Sources**:
- `daily_macro_metrics` - regime, yields, commodities
- `market_indices` / `index_daily_bars` - SPY, QQQ, IWM performance
- `daily_bars` - aggregate market breadth

**Content**:
- Market Regime (Risk-On / Risk-Off / Neutral)
- Key Index Performance (SPY, QQQ, IWM, BTC)
- Dominant Theme of the Day
- One-sentence AI summary

**UI Component**: Hero card with regime indicator + key metrics

---

### Section 2: Macro Context
**Purpose**: Understand the broader environment before diving into setups

**Data Sources**:
- `daily_macro_metrics` - full macro data
- `commodity_daily_bars` - oil, gold, copper
- `fx_rates` - DXY, major pairs

**Content**:
- Yield Curve Status (inverted/normal/steepening)
- Interest Rate Environment
- Inflation Indicators
- Risk Premium
- Commodity Trends
- Sector Rotation Signals

**UI Component**: Multi-metric dashboard with trend arrows

---

### Section 3: Technical Clusters (Thematic Opportunities)
**Purpose**: Group related setups by theme for portfolio-level thinking

**Data Sources**:
- `setup_signals` - active setups with entry/exit levels
- `daily_signal_facts` - signal strength and direction
- `daily_features` - technical indicators
- `assets` + `equity_metadata` - sector/industry grouping

**Content**:
- Theme Name (e.g., "Energy Breakouts", "AI Infrastructure")
- Urgency Level (HIGH/MEDIUM/LOW)
- Theme Description (why these are moving together)
- Assets in Cluster (3+ required)
- Aggregate Risk/Reward

**Logic**:
- Group assets by sector/industry with active signals
- Require 3+ assets for a valid cluster
- Calculate cluster-level metrics

**UI Component**: Expandable cluster cards with asset chips

---

### Section 4: Top Individual Setups
**Purpose**: Highlight the best risk/reward opportunities regardless of theme

**Data Sources**:
- `setup_signals` - entry, stop, target, R:R
- `fundamental_vigor_scores` - quality filter
- `daily_features` - technical confirmation
- `asset_ai_reviews` - AI conviction

**Content**:
- Symbol + Name
- Setup Type (Breakout, Pullback, Reversal, etc.)
- Entry Price, Stop Loss, Target Price
- Risk/Reward Ratio
- Historical Profit Factor
- FVS Score + Quality Label
- AI Conviction Score
- Volume Check (liquidity warning if needed)

**Ranking Criteria**:
1. Risk/Reward > 2.0
2. Historical Profit Factor > 1.5
3. FVS > 60 for "Quality" label
4. Fresh signal (triggered today or yesterday)

**UI Component**: Sortable table with action buttons

---

### Section 5: Fundamental Leaders
**Purpose**: Surface fundamentally strong companies for longer-term positions

**Data Sources**:
- `fundamental_vigor_scores` - all component scores
- `equity_metadata` - valuation metrics
- `equity_quarterly_fundamentals` - growth rates

**Content**:
- Top 10 by FVS Score
- Component Breakdown (Profitability, Solvency, Growth, Moat)
- Piotroski F-Score
- Altman Z-Score
- AI Reasoning Summary

**Filter**: FVS > 80, High Confidence

**UI Component**: Leaderboard with score breakdown

---

### Section 6: Signal Alerts
**Purpose**: Surface new and significant signals that need attention

**Data Sources**:
- `daily_signal_facts` - all active signals
- `signal_instances` - signal lifecycle
- `signal_ai_annotations` - AI analysis

**Content**:
- New Signals Today (triggered_at = today)
- High-Strength Signals (strength > 80)
- Signal Type Distribution
- Direction Breakdown (bullish vs bearish)

**Signal Types to Surface**:
- `breakout_participation` - Momentum breakouts
- `squeeze_release` - Volatility expansion
- `exhaustion` - Potential reversals
- `volatility_shock` - Unusual moves

**UI Component**: Signal feed with filters

---

### Section 7: Skeptic's Corner (Bear Cases)
**Purpose**: Present contrarian views and risk warnings

**Data Sources**:
- `daily_signal_facts` - bearish signals
- `daily_features` - overbought indicators
- `fundamental_vigor_scores` - low quality flags
- `asset_ai_reviews` - negative reviews

**Content**:
- Bearish Setups (direction = bearish)
- Overbought Warnings (RSI > 70, extended from MA)
- Low Quality Momentum (FVS < 40 with bullish signals)
- Liquidity Concerns (low volume)
- Fundamental Red Flags (Altman Z < 1.8)

**UI Component**: Warning cards with severity levels

---

### Section 8: Sector Analysis
**Purpose**: Understand sector rotation and relative strength

**Data Sources**:
- `daily_macro_metrics.sector_rotation` - rotation data
- `assets` + `daily_bars` - sector aggregation
- `etf_daily_bars` - sector ETFs (XLK, XLF, XLE, etc.)

**Content**:
- Sector Performance Ranking
- Week-over-Week Change
- Money Flow Direction
- Leading/Lagging Sectors
- Sector-Specific Opportunities

**UI Component**: Heatmap + ranked list

---

### Section 9: Earnings & Events Calendar
**Purpose**: Highlight upcoming catalysts

**Data Sources**:
- `equity_earnings_history` - earnings dates
- `get_financial_calendar` tool - economic events

**Content**:
- Earnings This Week (with estimates)
- Economic Events (CPI, Fed, GDP)
- Ex-Dividend Dates
- Notable IPOs/Offerings

**UI Component**: Calendar view with event cards

---

### Section 10: Portfolio Management & Positioning
**Purpose**: Analyze active portfolio holdings and provide positioning recommendations

**Data Sources**:
- `core_portfolio_holdings` - active positions with quantity, cost basis, category
- `model_portfolio_holdings` - target weights (if applicable)
- `daily_bars` - current prices for P&L calculation
- `daily_signal_facts` - signals on held assets
- `setup_signals` - setups on held assets
- `fundamental_vigor_scores` - quality of holdings
- `daily_features` - technical status of holdings

**Content**:
- **Portfolio Overview**: Total value, cash position, allocation by category (equities/tokens/options)
- **Position P&L**: Unrealized gains/losses per position, sorted by impact
- **Concentration Risk**: Positions exceeding target weights or over-concentrated
- **Signals on Holdings**: New signals triggered on portfolio assets
- **Exit Alerts**: Positions hitting technical targets or stops
- **Rebalancing Suggestions**: Based on current vs target weights
- **Quality Assessment**: FVS scores of equity holdings
- **Options Exposure**: Expiring options, delta exposure

**Portfolio Data Available**:
- BTC: 44.23 units @ $90,380 cost basis (~$4M position)
- MSTR: 7,201 shares @ $155.50 (~$1.1M)
- BMNR: 32,850 shares @ $31.26 (~$1M)
- FARTCOIN: 2M tokens @ $0.45 (~$914K)
- Cash: $5.6M
- Plus options positions (BTC calls/puts)

**AI Analysis**:
- Portfolio concentration analysis
- Correlation between holdings
- Macro sensitivity of portfolio
- Recommended position sizing adjustments
- Risk/reward of adding to winners vs losers

**UI Component**: Portfolio dashboard with P&L table, allocation pie chart, and AI recommendations

---

### Section 11: Crypto Spotlight
**Purpose**: Dedicated crypto analysis (separate from equities)

**Data Sources**:
- `assets` WHERE asset_type = 'crypto'
- `token_metadata` - crypto-specific data
- `setup_signals` - crypto setups
- `daily_features` - crypto technicals

**Content**:
- BTC/ETH Performance
- Top Crypto Movers
- Active Crypto Setups
- DeFi/L2 Themes
- Crypto-Specific Signals

**UI Component**: Crypto dashboard section

---

### Section 12: Action Items (Priority Queue)
**Purpose**: Distill everything into prioritized next steps

**Content**:
- **Immediate Actions** (Day 1 breakouts, critical levels)
- **Watch Closely** (Setups approaching entry)
- **Research Queue** (Interesting but needs more analysis)
- **Exit Alerts** (Positions hitting targets/stops)

**Logic**: AI synthesizes all sections into priority-ranked actions

**UI Component**: Checklist with priority badges

---

## Implementation Checklist

### Phase 1: Backend Infrastructure
- [ ] Create new `daily-brief-api` edge function (clean rewrite)
- [ ] Define structured output schema for Gemini
- [ ] Create data fetching functions for each section
- [ ] Implement Gemini 3 Pro Preview integration with thinking
- [ ] Create `daily_briefs` table schema (if not exists)
- [ ] Add caching layer for expensive queries

### Phase 2: Data Aggregation Functions
- [ ] `fetchMarketPulse()` - Macro + index data
- [ ] `fetchMacroContext()` - Full macro environment
- [ ] `fetchActiveSetups()` - Setup signals with enrichment
- [ ] `fetchTechnicalClusters()` - Grouped by sector/theme
- [ ] `fetchFundamentalLeaders()` - Top FVS scores
- [ ] `fetchActiveSignals()` - Signal facts
- [ ] `fetchBearishSignals()` - Skeptic's corner
- [ ] `fetchSectorAnalysis()` - Sector rotation
- [ ] `fetchEarningsCalendar()` - Upcoming earnings
- [ ] `fetchPortfolioAnalysis()` - Portfolio holdings, P&L, positioning
- [ ] `fetchCryptoSpotlight()` - Crypto-specific

### Phase 3: AI Analysis Layer
- [ ] Design system prompt for "Stratos CIO Agent"
- [ ] Implement Chain-of-Thought reasoning flow
- [ ] Create structured output schema (JSON)
- [ ] Add thematic clustering logic
- [ ] Implement quality filtering (FVS-based)
- [ ] Add skeptic analysis pass
- [ ] Generate action items synthesis

### Phase 4: Frontend Components
- [ ] Market Pulse hero card
- [ ] Macro context dashboard
- [ ] Technical clusters (expandable cards)
- [ ] Setup table with sorting/filtering
- [ ] Fundamental leaderboard
- [ ] Signal feed component
- [ ] Skeptic's corner warnings
- [ ] Sector heatmap
- [ ] Earnings calendar
- [ ] Portfolio management dashboard
- [ ] Crypto spotlight section
- [ ] Action items checklist

### Phase 5: Integration & Polish
- [ ] Add navigation to Daily Brief page
- [ ] Implement regenerate functionality
- [ ] Add date picker for historical briefs
- [ ] Add export to PDF/Markdown
- [ ] Add email delivery option
- [ ] Performance optimization
- [ ] Error handling & fallbacks
- [ ] Mobile responsiveness

---

## Technical Specifications

### Gemini 3 Pro Preview Configuration
```typescript
const config = {
  model: "gemini-3-pro-preview",
  thinking_config: {
    thinking_level: "high"
  },
  response_mime_type: "application/json",
  response_schema: DailyBriefSchema,
  temperature: 1.0 // Default, do not change
}
```

### Database Query Optimization
- Use materialized views for expensive aggregations
- Implement query caching (5-minute TTL)
- Batch related queries
- Limit historical data to necessary ranges

### Output Schema (Simplified)
```typescript
interface DailyBrief {
  generated_at: string;
  market_pulse: MarketPulse;
  macro_context: MacroContext;
  technical_clusters: TechnicalCluster[];
  top_setups: Setup[];
  fundamental_leaders: FundamentalLeader[];
  signal_alerts: SignalAlert[];
  skeptics_corner: SkepticWarning[];
  sector_analysis: SectorAnalysis;
  earnings_calendar: EarningsEvent[];
  crypto_spotlight: CryptoSpotlight;
  action_items: ActionItem[];
}
```

---

## Success Metrics

1. **Generation Time**: < 30 seconds for full brief
2. **Data Freshness**: All data from current trading day
3. **Signal Accuracy**: Track setup hit rates over time
4. **User Engagement**: Time spent on page, sections viewed
5. **Action Conversion**: Setups viewed → positions taken

---

## Next Steps

1. Review and approve this plan
2. Prioritize which sections to build first
3. Begin Phase 1 implementation
4. Iterate based on feedback

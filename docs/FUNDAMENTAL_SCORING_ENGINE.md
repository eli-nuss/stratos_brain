# Context-Aware Stock Scoring Engine

## Design Document

**Version:** 1.0
**Date:** January 2026
**Status:** Partially Implemented

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Classification System (Router)](#classification-system-router)
4. [Scoring Engines](#scoring-engines)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Deployment & Workflows](#deployment--workflows)
9. [Current Implementation Status](#current-implementation-status)
10. [Remaining Work](#remaining-work)

---

## Overview

The Context-Aware Stock Scoring Engine is a fundamental analysis system that:

1. **Classifies** stocks as Growth, Value, or Hybrid based on revenue growth characteristics
2. **Applies different scoring algorithms** based on classification (Growth stocks need different metrics than Value stocks)
3. **Produces a 0-100 composite score** for each equity
4. **Updates daily** with live valuation data while using monthly-refreshed fundamental metrics

### Why Context-Aware?

Traditional scoring systems apply the same metrics to all stocks. This is problematic:
- A high-growth tech company with no P/E ratio would score poorly on value metrics
- A mature dividend stock would score poorly on growth metrics

Our system **routes** each stock to the appropriate scoring engine based on its characteristics.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Financial Modeling Prep (FMP) API                                       │
│  - Company profiles, financials, ratios                                  │
│  - Primary data source for fundamental metrics                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLASSIFICATION ROUTER                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Input: 3-Year Revenue CAGR                                              │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   GROWTH     │  │    HYBRID    │  │    VALUE     │                   │
│  │  CAGR > 15%  │  │ 10% ≤ CAGR   │  │  CAGR < 10%  │                   │
│  │              │  │    ≤ 15%     │  │  + Low P/E   │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  GROWTH ENGINE  │ │  BOTH ENGINES   │ │  VALUE ENGINE   │
│                 │ │   (Average)     │ │                 │
│ - Rule of 40    │ │                 │ │ - FCF Yield     │
│ - Gross Margin  │ │                 │ │ - P/E vs 5Y Avg │
│ - Rev Accel     │ │                 │ │ - Debt/Equity   │
│ - PEG Ratio     │ │                 │ │ - Dividends     │
│                 │ │                 │ │ - Piotroski     │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                   ┌─────────────────┐
                   │  FINAL SCORE    │
                   │    (0-100)      │
                   └─────────────────┘
```

### Two Update Frequencies

| Component | Frequency | Purpose |
|-----------|-----------|---------|
| **Monthly Refresh** | 1st of month | Full FMP API fetch, recalculate base metrics, reclassify stocks |
| **Daily Update** | After market close | Combine base scores with live valuation from existing DB tables |

---

## Classification System (Router)

### Classification Logic

```python
def classify_stock(revenue_history, pe_ratio, fcf):
    cagr = calculate_3yr_cagr(revenue_history)

    if cagr > 0.15:  # 15%
        return "growth"

    if cagr < 0.10:  # 10%
        if pe_ratio and 0 < pe_ratio < 20:
            return "value"
        if pe_ratio < 0 and fcf > 0:  # Negative earnings but positive FCF
            return "value"

    return "hybrid"
```

### Classification Criteria

| Classification | Revenue CAGR | Additional Criteria |
|----------------|--------------|---------------------|
| **Growth** | > 15% | None |
| **Value** | < 10% | P/E < 20 OR (Negative P/E + Positive FCF) |
| **Hybrid** | 10-15% | Default for stocks between thresholds |

### Why These Thresholds?

- **15% CAGR**: Historical market average is ~7%. Companies growing 2x+ market rate are "growth" companies.
- **10% CAGR**: Below this, companies are mature enough to evaluate on value metrics.
- **P/E < 20**: Classic value threshold; market average is ~20-25.

---

## Scoring Engines

### Growth Engine (40/20/20/20 Weighting)

| Metric | Weight | Perfect Score | Zero Score | Rationale |
|--------|--------|---------------|------------|-----------|
| **Rule of 40** | 40% | 50+ | 0 | Revenue Growth % + EBITDA Margin %. Key SaaS efficiency metric. |
| **Gross Margin** | 20% | 80%+ | 40% | High margins = pricing power & scalability |
| **Revenue Acceleration** | 20% | +5% QoQ | -5% QoQ | Accelerating growth is better than decelerating |
| **PEG Ratio** | 20% | 1.0 | 2.5 | Growth-adjusted P/E. Lower = cheaper relative to growth |

#### Rule of 40 Explained
```
Rule of 40 = Revenue Growth % + EBITDA Margin %

Example:
- Company A: 30% growth + 15% margin = 45 (Good)
- Company B: 10% growth + 35% margin = 45 (Good)
- Company C: 20% growth + 10% margin = 30 (Below threshold)
```

### Value Engine (30/20/20/15/15 Weighting)

| Metric | Weight | Perfect Score | Zero Score | Rationale |
|--------|--------|---------------|------------|-----------|
| **FCF Yield** | 30% | 8%+ | 0% | Free Cash Flow / Market Cap. Higher = cheaper |
| **P/E vs 5Y Avg** | 20% | 0.8x | 1.2x | Trading below historical average = undervalued |
| **Debt/Equity** | 20% | 0.5x | 2.0x | Lower leverage = safer |
| **Dividend Yield** | 15% | 3%+ | 0% | Income component for value investors |
| **Piotroski F-Score** | 15% | 8+ | 4 | 9-point fundamental health checklist |

#### Piotroski F-Score Components (9 points)
1. Positive Net Income (+1)
2. Positive Operating Cash Flow (+1)
3. Positive Return on Assets (+1)
4. Operating Cash Flow > Net Income (+1)
5. Lower Debt Ratio YoY (+1)
6. Current Ratio > 1 (+1)
7. No Share Dilution (+1)
8. Gross Margin > 20% (+1)
9. Asset Turnover > 0.5x (+1)

### Hybrid Scoring

For stocks classified as "Hybrid", both engines run and the final score is the average:

```
Final Score = (Growth Engine Score + Value Engine Score) / 2
```

---

## Data Flow

### 1. Monthly Refresh Flow (Full Recalculation)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│  FMP API    │────▶│  Python     │────▶│ fundamental_snapshot │
│  (7 calls   │     │  Script     │     │ (monthly metrics)    │
│  per stock) │     │             │     └─────────────────────┘
└─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────────────┐
                    │ fundamental_scores   │
                    │ (with rankings)      │
                    └─────────────────────┘
```

**FMP API Calls per Stock:**
1. `profile/{symbol}` - Company info, market cap
2. `income-statement/{symbol}?limit=5` - 5 years of annual income
3. `income-statement/{symbol}?period=quarter&limit=8` - 8 quarters for acceleration
4. `balance-sheet-statement/{symbol}?limit=1` - Latest balance sheet
5. `cash-flow-statement/{symbol}?limit=1` - Latest cash flow
6. `ratios/{symbol}?limit=5` - 5 years of ratios
7. `key-metrics-ttm/{symbol}` - Trailing twelve month metrics

### 2. Daily Update Flow (Fast Path)

```
┌─────────────────────┐     ┌─────────────────────┐
│ fundamental_snapshot │────▶│                     │
│ (base scores)        │     │                     │
└─────────────────────┘     │                     │
                            │  Daily Update       │
┌─────────────────────┐     │  Script             │────▶ fundamental_scores
│ equity_metadata      │────▶│                     │      (updated daily)
│ (live P/E, etc.)     │     │                     │
└─────────────────────┘     │                     │
                            │                     │
┌─────────────────────┐     │                     │
│ daily_features       │────▶│                     │
│ (technical data)     │     └─────────────────────┘
└─────────────────────┘
```

**No FMP API calls** - uses existing database tables.

### 3. On-Demand Flow (Edge Function)

```
┌─────────────┐     ┌─────────────────────────┐     ┌─────────────┐
│  Frontend   │────▶│  fundamental-score-api  │────▶│  FMP API    │
│  Request    │     │  (Edge Function)        │     │  (real-time)│
└─────────────┘     └─────────────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  JSON       │
                        │  Response   │
                        └─────────────┘
```

---

## Database Schema

### Tables

#### `fundamental_snapshot` (Monthly Updated)

Stores pre-calculated base metrics and classification. Primary key: `asset_id`.

```sql
CREATE TABLE fundamental_snapshot (
    asset_id BIGINT PRIMARY KEY REFERENCES assets(asset_id),

    -- Classification
    classification TEXT NOT NULL,  -- 'growth', 'value', 'hybrid'
    classification_reason TEXT,

    -- Growth Metrics
    revenue_cagr_3y NUMERIC(10, 4),
    revenue_growth_yoy NUMERIC(10, 4),
    revenue_acceleration NUMERIC(10, 4),
    rule_of_40 NUMERIC(10, 4),
    gross_margin NUMERIC(10, 4),
    ebitda_margin NUMERIC(10, 4),

    -- Value Metrics
    fcf_yield NUMERIC(10, 4),
    fcf_margin NUMERIC(10, 4),
    debt_to_equity NUMERIC(10, 4),
    current_ratio NUMERIC(10, 4),
    dividend_yield NUMERIC(10, 4),
    piotroski_score INT,
    piotroski_components JSONB,

    -- Historical Averages
    pe_5y_avg NUMERIC(10, 4),
    ps_5y_avg NUMERIC(10, 4),

    -- Pre-calculated Scores
    growth_engine_score NUMERIC(5, 2),
    value_engine_score NUMERIC(5, 2),
    base_fundamental_score NUMERIC(5, 2),

    -- Metadata
    data_source TEXT DEFAULT 'fmp',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `fundamental_scores` (Daily Updated)

Stores final daily scores with live valuation. Primary key: `(asset_id, as_of_date)`.

```sql
CREATE TABLE fundamental_scores (
    asset_id BIGINT REFERENCES assets(asset_id),
    as_of_date DATE NOT NULL,

    -- Classification
    classification TEXT NOT NULL,

    -- Live Valuation (from equity_metadata)
    pe_ratio NUMERIC(10, 4),
    forward_pe NUMERIC(10, 4),
    peg_ratio NUMERIC(10, 4),
    price_to_sales NUMERIC(10, 4),
    ev_to_ebitda NUMERIC(10, 4),

    -- Relative Valuation
    pe_vs_5y_avg NUMERIC(10, 4),  -- Current P/E / 5Y Avg

    -- Technical (from daily_features)
    price_vs_sma_200 NUMERIC(10, 4),
    price_vs_sma_50 NUMERIC(10, 4),
    dist_from_52w_high NUMERIC(10, 4),

    -- Component Scores
    valuation_score NUMERIC(5, 2),
    technical_score NUMERIC(5, 2),
    fundamental_base_score NUMERIC(5, 2),

    -- Final Score
    final_score NUMERIC(5, 2) NOT NULL,
    score_breakdown JSONB,

    -- Rankings
    rank_in_universe INT,
    rank_in_classification INT,
    percentile NUMERIC(5, 2),

    -- Deltas
    score_delta_1d NUMERIC(5, 2),
    score_delta_5d NUMERIC(5, 2),

    PRIMARY KEY (asset_id, as_of_date)
);
```

#### `fundamental_score_history`

Historical snapshots for backtesting.

```sql
CREATE TABLE fundamental_score_history (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT REFERENCES assets(asset_id),
    snapshot_date DATE NOT NULL,
    classification TEXT NOT NULL,
    final_score NUMERIC(5, 2) NOT NULL,
    growth_engine_score NUMERIC(5, 2),
    value_engine_score NUMERIC(5, 2),
    score_breakdown JSONB,

    UNIQUE (asset_id, snapshot_date)
);
```

### Views

```sql
-- Top scoring stocks across all classifications
CREATE VIEW v_fundamental_leaders AS
SELECT fs.*, a.symbol, a.name, em.sector, em.industry, snap.rule_of_40, ...
FROM fundamental_scores fs
JOIN assets a ON fs.asset_id = a.asset_id
LEFT JOIN equity_metadata em ON ...
WHERE fs.as_of_date = (SELECT MAX(as_of_date) FROM fundamental_scores);

-- Top Growth stocks only
CREATE VIEW v_growth_leaders AS
SELECT * FROM v_fundamental_leaders WHERE classification = 'growth';

-- Top Value stocks only
CREATE VIEW v_value_leaders AS
SELECT * FROM v_fundamental_leaders WHERE classification = 'value';
```

### Indexes

```sql
CREATE INDEX idx_fundamental_snapshot_classification ON fundamental_snapshot(classification);
CREATE INDEX idx_fundamental_scores_date ON fundamental_scores(as_of_date DESC);
CREATE INDEX idx_fundamental_scores_final_score ON fundamental_scores(as_of_date, final_score DESC);
```

---

## API Endpoints

### Edge Function: `fundamental-score-api`

**Base URL:** `https://wfogbaipiqootjrsprde.supabase.co/functions/v1/fundamental-score-api`

#### GET /score/:symbol

Score a single stock in real-time.

**Request:**
```
GET /score/AAPL
```

**Response:**
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "classification": "growth",
  "classificationReason": "Revenue CAGR 8.5% > 15% threshold",
  "finalScore": 72.5,
  "growthEngineScore": 72.5,
  "valueEngineScore": null,
  "metrics": {
    "revenueCagr3y": 8.5,
    "ruleOf40": 45.2,
    "grossMargin": 43.8,
    "revenueAcceleration": 2.1,
    "fcfYield": 3.2,
    "peVs5yAvg": 0.95,
    "debtToEquity": 1.45,
    "piotroskiScore": 7,
    "peRatio": 28.5,
    "pegRatio": 2.1
  },
  "breakdown": {
    "growthEngine": {
      "ruleOf40": { "value": 45.2, "score": 90.4, "weight": 0.40 },
      "grossMargin": { "value": 43.8, "score": 19.0, "weight": 0.20 },
      ...
    }
  },
  "dataSource": "fmp"
}
```

#### GET /batch?symbols=X,Y,Z

Score multiple stocks (max 10).

**Request:**
```
GET /batch?symbols=AAPL,MSFT,NVDA
```

**Response:**
```json
{
  "results": [
    { "symbol": "AAPL", "finalScore": 72.5, ... },
    { "symbol": "MSFT", "finalScore": 78.2, ... },
    { "symbol": "NVDA", "finalScore": 85.1, ... }
  ],
  "count": 3
}
```

#### GET /health

Health check endpoint.

---

## Deployment & Workflows

### GitHub Actions

| Workflow | File | Schedule | Purpose |
|----------|------|----------|---------|
| Monthly Refresh | `fundamental-monthly-refresh.yml` | 1st of month, 6 AM UTC | Full FMP fetch & scoring |
| Daily Update | `fundamental-daily-update.yml` | Weekdays 10 PM UTC | Fast update with DB data |
| Edge Function Deploy | `deploy-edge-functions.yml` | On push to main | Deploy Edge Functions |

### Required Secrets

| Secret | Where | Purpose |
|--------|-------|---------|
| `FMP_API_KEY` | GitHub Actions + Supabase Edge Functions | Financial Modeling Prep API access |
| `DB_HOST` | GitHub Actions | Database host for Python scripts |
| `DB_PASSWORD` | GitHub Actions | Database password |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions | Deploy Edge Functions |
| `SUPABASE_PROJECT_REF` | GitHub Actions | Supabase project identifier |

### Adding FMP_API_KEY to Edge Functions

1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Under "Function Secrets", add `FMP_API_KEY`
3. Value: Your API key from https://financialmodelingprep.com/

---

## Current Implementation Status

### Completed

| Component | Status | Location |
|-----------|--------|----------|
| Database Schema | Applied | `supabase/migrations/022_fundamental_scoring.sql` |
| Classification Router | Complete | In both Python scripts and Edge Function |
| Growth Engine Scoring | Complete | Full implementation with all 4 metrics |
| Value Engine Scoring | Complete | Full implementation with all 5 metrics |
| Monthly Refresh Script | Complete | `scripts/fundamental_scoring_engine.py` |
| Daily Update Script | Complete | `scripts/fundamental_daily_update.py` |
| On-Demand Edge Function | Complete | `supabase/functions/fundamental-score-api/index.ts` |
| GitHub Workflows | Complete | All 3 workflows configured |
| Edge Function Deployment | Complete | Added to `deploy-edge-functions.yml` |

### Database Tables Created

- `fundamental_snapshot` - Created, empty (needs monthly refresh)
- `fundamental_scores` - Created, empty (needs data)
- `fundamental_score_history` - Created, empty
- `v_fundamental_leaders` - View created
- `v_growth_leaders` - View created
- `v_value_leaders` - View created

---

## Remaining Work

### Critical (Must Do)

| Task | Priority | Description |
|------|----------|-------------|
| **Add FMP_API_KEY to Supabase** | HIGH | Edge Function won't work without this secret |
| **Run Initial Monthly Refresh** | HIGH | Populate `fundamental_snapshot` with data |
| **Test Edge Function** | HIGH | Verify `/score/AAPL` returns valid data |

### Integration Tasks

| Task | Description |
|------|-------------|
| Frontend Integration | Add fundamental scores to stock detail pages |
| Screener UI | Build UI to filter stocks by classification/score |
| Score Comparison | Show score vs sector/industry average |
| Historical Charts | Visualize score changes over time |

### Enhancements (Nice to Have)

| Task | Description |
|------|-------------|
| Sector Rankings | Add `rank_in_sector` calculation |
| Score Alerts | Notify when score changes significantly |
| Caching Layer | Cache Edge Function results in `fundamental_snapshot` |
| Batch Processing | Optimize monthly refresh for 1000+ stocks |
| Alpha Vantage Fallback | Add secondary data source if FMP fails |

### Testing

| Test | Status |
|------|--------|
| Unit tests for scoring functions | Not implemented |
| Integration tests for FMP API | Not implemented |
| Backtest validation | Not implemented |

---

## File Reference

```
stratos_brain/
├── supabase/
│   ├── migrations/
│   │   └── 022_fundamental_scoring.sql    # Database schema
│   └── functions/
│       └── fundamental-score-api/
│           └── index.ts                    # On-demand scoring Edge Function
├── scripts/
│   ├── fundamental_scoring_engine.py       # Monthly batch refresh
│   └── fundamental_daily_update.py         # Daily fast update
├── .github/workflows/
│   ├── fundamental-monthly-refresh.yml     # Monthly cron job
│   ├── fundamental-daily-update.yml        # Daily cron job
│   └── deploy-edge-functions.yml           # Includes fundamental-score-api
└── docs/
    └── FUNDAMENTAL_SCORING_ENGINE.md       # This document
```

---

## Quick Start for New Developer

1. **Get FMP API Key**: Sign up at https://financialmodelingprep.com/
2. **Add Secrets**:
   - GitHub: `FMP_API_KEY`, `DB_HOST`, `DB_PASSWORD`
   - Supabase Edge Functions: `FMP_API_KEY`
3. **Run Monthly Refresh**: Manually trigger `fundamental-monthly-refresh.yml`
4. **Test Edge Function**: `curl https://wfogbaipiqootjrsprde.supabase.co/functions/v1/fundamental-score-api/score/AAPL`
5. **Check Data**: Query `SELECT * FROM fundamental_snapshot LIMIT 10`

---

## Contact

For questions about this system, refer to:
- FMP API Docs: https://site.financialmodelingprep.com/developer/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

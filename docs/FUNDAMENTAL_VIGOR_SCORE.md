# Fundamental Vigor Score (FVS) Documentation

**Version:** 1.0  
**Last Updated:** January 13, 2026  
**Author:** Stratos Team  
**Status:** Active

---

## Overview

The Fundamental Vigor Score (FVS) is a qualitative fundamental analysis system that combines deterministic financial calculations with LLM-based interpretation to produce a comprehensive assessment of a company's fundamental health.

**Key Principle:** The FVS is **completely separate** from the technical analysis signal workflow. It operates independently and can be run on its own schedule.

---

## Architecture

### Design Philosophy

The FVS follows a **Code-First Reasoning Pipeline**:

1. **Python handles all math** - Deterministic calculations ensure reproducibility
2. **Gemini handles interpretation** - LLM provides qualitative assessment of the numbers
3. **Structured output** - JSON schema enforcement for consistent results

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FUNDAMENTAL VIGOR SCORE PIPELINE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │    FMP      │───▶│ Python Engine   │───▶│    Gemini LLM           │  │
│  │  (Data)     │    │ (Calculations)  │    │ (Interpretation)        │  │
│  └─────────────┘    └─────────────────┘    └─────────────────────────┘  │
│         │                   │                         │                  │
│         │                   │                         │                  │
│         ▼                   ▼                         ▼                  │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │ Income Stmt │    │ fvs_calculation │    │ fundamental_vigor_      │  │
│  │ Balance Sht │    │ _inputs         │    │ scores                  │  │
│  │ Cash Flow   │    │ (audit trail)   │    │ (final scores)          │  │
│  │ Ratios      │    └─────────────────┘    └─────────────────────────┘  │
│  └─────────────┘                                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Four-Pillar Scoring Methodology

The FVS evaluates companies across four weighted pillars:

### Pillar 1: Profitability & Efficiency (35%)

**Quantitative Metrics:**
- ROIC (Return on Invested Capital)
- Gross Margin and Trend
- Operating Margin
- Net Margin
- Asset Turnover
- DuPont Analysis (ROE decomposition)

**Qualitative Assessment:**
- Quality of earnings (recurring vs one-time)
- Sustainability of margin expansion
- Identification of accounting red flags

**Scoring Rubric:**
| Score Range | Criteria |
|-------------|----------|
| 90-100 | ROIC >20%, expanding margins, high-quality recurring earnings |
| 70-89 | ROIC >10%, stable margins, consistent profitability |
| 50-69 | ROIC 5-10%, mixed margin trends |
| 30-49 | ROIC <5%, contracting margins |
| 0-29 | Operating losses, deteriorating profitability |

---

### Pillar 2: Solvency & Liquidity (25%)

**Quantitative Metrics:**
- Current Ratio
- Quick Ratio
- Cash Ratio
- Net Debt / EBITDA
- Interest Coverage
- Debt to Equity
- Altman Z-Score

**Qualitative Assessment:**
- Debt maturity profile
- Off-balance sheet liabilities
- Covenant compliance risks

**Constraint:** If Altman Z-Score < 1.8, the Solvency score **cannot exceed 50** without extraordinary evidence.

**Scoring Rubric:**
| Score Range | Criteria |
|-------------|----------|
| 90-100 | Net cash position, Z-Score >3, excellent liquidity |
| 70-89 | Low leverage (Debt/EBITDA <2x), Z-Score >2.5 |
| 50-69 | Moderate leverage, adequate liquidity |
| 30-49 | High leverage, liquidity concerns |
| 0-29 | Z-Score <1.8, imminent distress risk |

---

### Pillar 3: Growth & Momentum (20%)

**Quantitative Metrics:**
- 4-Year Revenue CAGR
- 4-Year EBITDA CAGR
- 4-Year FCF CAGR
- 4-Year EPS CAGR
- YoY Revenue Growth
- Revenue Acceleration (QoQ growth rate change)

**Qualitative Assessment:**
- Organic vs inorganic (M&A-driven) growth
- Market share trajectory
- TAM expansion potential

**Scoring Rubric:**
| Score Range | Criteria |
|-------------|----------|
| 90-100 | Revenue CAGR >20%, accelerating growth, organic |
| 70-89 | Revenue CAGR 10-20%, stable growth trajectory |
| 50-69 | Revenue CAGR 5-10%, mixed signals |
| 30-49 | Revenue CAGR <5%, decelerating |
| 0-29 | Revenue decline, structural challenges |

---

### Pillar 4: Quality & Moat (20%)

**Quantitative Metrics:**
- Accruals Ratio
- FCF / Net Income Conversion
- Share Buyback Yield
- Dividend Yield
- Piotroski F-Score (9 components)

**Qualitative Assessment:**
- Economic moat identification:
  - Switching costs
  - Network effects
  - Intangible assets
  - Cost advantages
  - Efficient scale
- Corporate governance quality
- Management track record

**Constraint:** If Piotroski F-Score ≤ 3, the Moat score **cannot exceed 60** without extraordinary evidence.

**Scoring Rubric:**
| Score Range | Criteria |
|-------------|----------|
| 90-100 | Strong moat, F-Score 8-9, excellent cash conversion |
| 70-89 | Identifiable moat, F-Score 6-7, good quality |
| 50-69 | Narrow moat, F-Score 4-5, adequate quality |
| 30-49 | No clear moat, F-Score 2-3, quality concerns |
| 0-29 | Negative moat, F-Score 0-1, poor quality |

---

## Final Score Calculation

```
Final Score = (Profitability × 0.35) + (Solvency × 0.25) + (Growth × 0.20) + (Moat × 0.20)
```

### Quality Tiers

| Final Score | Tier | Description |
|-------------|------|-------------|
| 80-100 | Fortress | Exceptional fundamentals, minimal risk |
| 60-79 | Quality | Strong fundamentals, well-positioned |
| 40-59 | Average | Mixed fundamentals, sector-dependent |
| 20-39 | Speculative | Weak fundamentals, elevated risk |
| 0-19 | Distressed | Poor fundamentals, high distress risk |

---

## Shadow Scoring (Calibration)

The FVS includes shadow scoring against established metrics for calibration:

### Piotroski F-Score (0-9)
Nine binary signals measuring profitability, leverage, and efficiency:
1. Positive Net Income
2. Positive Operating Cash Flow
3. ROA Increasing
4. OCF > Net Income (quality of earnings)
5. Debt Ratio Decreasing
6. Current Ratio Increasing
7. No Share Dilution
8. Gross Margin Increasing
9. Asset Turnover Increasing

### Altman Z-Score
Bankruptcy prediction model:
- Z > 3.0: Safe Zone
- 1.8 < Z < 3.0: Gray Zone
- Z < 1.8: Distress Zone

---

## Database Schema

### fundamental_vigor_scores
Primary table storing FVS results:

| Column | Type | Description |
|--------|------|-------------|
| asset_id | BIGINT | Foreign key to assets table |
| as_of_date | DATE | Date of analysis |
| profitability_score | INTEGER | 0-100 |
| solvency_score | INTEGER | 0-100 |
| growth_score | INTEGER | 0-100 |
| moat_score | INTEGER | 0-100 |
| final_score | NUMERIC(5,2) | Weighted average |
| confidence_level | VARCHAR | HIGH/MEDIUM/LOW |
| piotroski_f_score | INTEGER | 0-9 |
| altman_z_score | NUMERIC | Z-Score value |
| reasoning_scratchpad | TEXT | Chain of thought (internal) |
| final_reasoning_paragraph | TEXT | User-facing summary |
| score_breakdown | JSONB | Detailed pillar analysis |
| quantitative_metrics | JSONB | Input metrics |

### fvs_calculation_inputs
Audit trail of all calculated metrics:

| Column | Type | Description |
|--------|------|-------------|
| asset_id | BIGINT | Foreign key to assets table |
| as_of_date | DATE | Date of calculation |
| roic | NUMERIC | Return on Invested Capital |
| gross_margin | NUMERIC | Gross Profit / Revenue |
| current_ratio | NUMERIC | Current Assets / Current Liabilities |
| ... | ... | All other calculated metrics |

---

## API Endpoints

### Edge Function: fvs-api

**Base URL:** `/api/fvs-api`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/score/:symbol` | GET | Calculate FVS for a symbol |
| `/latest/:symbol` | GET | Get cached FVS for a symbol |
| `/batch?symbols=A,B,C` | GET | Score multiple symbols (max 5) |
| `/health` | GET | Health check |

**Query Parameters:**
- `refresh=true`: Force recalculation (bypass cache)

**Response Example:**
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc.",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "asOfDate": "2026-01-13",
  "profitabilityScore": 85,
  "solvencyScore": 92,
  "growthScore": 68,
  "moatScore": 88,
  "finalScore": 83.55,
  "confidenceLevel": "HIGH",
  "dataQualityScore": 0.95,
  "piotroskiFScore": 7,
  "altmanZScore": 4.2,
  "finalReasoningParagraph": "Apple demonstrates fortress-level fundamentals...",
  "keyStrengths": ["Exceptional cash position", "Strong brand moat"],
  "keyRisks": ["Revenue concentration in iPhone", "China exposure"],
  "qualityTier": "fortress"
}
```

---

## Frontend Components

### FundamentalVigorScore
Full FVS display component with:
- Score gauge visualization
- Four-pillar breakdown bars
- Shadow scores (Piotroski, Altman)
- Expandable analysis details
- Strengths and risks summary

### FVSBadge
Compact badge for table cells:
```tsx
<FVSBadge score={83.5} />
```

---

## Configuration

### Environment Variables
```env
FMP_API_KEY=your_fmp_api_key
GEMINI_API_KEY=your_gemini_api_key
```

### Model Configuration
- **Model:** gemini-3-pro-preview (Python engine) / gemini-2.0-flash (Edge function)
- **Temperature:** 0 (deterministic)
- **Response Format:** JSON with schema enforcement

### Cache Duration
- **Default:** 7 days (fundamentals don't change frequently)
- **Force Refresh:** Available via `?refresh=true` parameter

---

## Usage Examples

### Python Engine
```python
from stratos_engine.stages.stage_fvs import FundamentalVigorScoreEngine

engine = FundamentalVigorScoreEngine(db=supabase_client)

# Score single asset
result = engine.score_asset(
    asset_id=123,
    symbol="AAPL",
    name="Apple Inc.",
    sector="Technology",
    industry="Consumer Electronics"
)

# Batch scoring
results = engine.run_batch(limit=100)
```

### Frontend
```tsx
import { FundamentalVigorScore, FVSBadge } from '@/components/FundamentalVigorScore';

// Full component
<FundamentalVigorScore assetId={123} symbol="AAPL" />

// Compact badge
<FVSBadge score={83.5} />
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 13, 2026 | Initial FVS implementation |

---

*This is a living document. Please update as the FVS system evolves.*

# Stratos Brain — AI-Assisted Changes Log

This document tracks all changes made to the Stratos Brain codebase with AI assistance.

## Quick Stats
- **Total Changes:** 6
- **Files Created:** 11
- **Files Modified:** 3
- **Status:** ✅ All deployed

---

## Changes

### 2026-01-28 — Daily Brief Quick Stats Bar
**Status:** ✅ Deployed  
**Commit:** `698f0b3`

**Description:**
Added a statistics overview bar to the Daily Brief V3 page showing at-a-glance metrics.

**Changes:**
- **Created:** `dashboard/client/src/pages/DailyBriefV3.tsx` (enhanced)
  - Added `QuickStatsBar` component
  - Shows: total opportunities, conviction distribution, avg R:R, alerts, actions
  - Added setup style badges (Position vs Swing) to AssetCard
  - New icons: Sparkles, ArrowUpRight, Layers, Flag

**Impact:**
Users can now quickly assess the day's opportunity landscape without scrolling through all three categories.

---

### 2026-01-28 — AssetDetail Skeleton Loading
**Status:** ✅ Deployed  
**Commit:** `fa83082`

**Description:**
Replaced the simple spinner loading state with a proper skeleton layout that mimics the actual component structure.

**Changes:**
- **Created:** `dashboard/client/src/components/AssetDetailSkeleton.tsx` (new file, 128 lines)
  - Header with symbol, name, date, action placeholders
  - Two-column layout (lg:grid-cols-10)
  - Chart area (450px placeholder)
  - AI Analysis section with confidence meter
  - Trade Plan section with Entry/Target/Stop placeholders
  - Sidebar: About, Fundamentals, Documents, Notes, Files

- **Modified:** `dashboard/client/src/components/AssetDetail.tsx`
  - Added import for AssetDetailSkeleton
  - Replaced spinner loading state with `<AssetDetailSkeleton />`

**Impact:**
Reduced perceived load time and eliminated layout shift when data arrives.

---

### 2026-01-28 — Toast Notifications for Chart Capture
**Status:** ✅ Deployed  
**Commit:** `24ff9d0`

**Description:**
Replaced jarring `alert()` with proper toast notifications using the existing sonner library.

**Changes:**
- **Modified:** `dashboard/client/src/components/AssetDetail.tsx`
  - Added `import { toast } from 'sonner'`
  - Changed clipboard success: `alert()` → `toast.success('Chart copied to clipboard!')`
  - Added error toast: `toast.error('Error generating chart image. Please try again.')`

**Impact:**
Better UX — non-intrusive notifications instead of blocking alerts.

---

## Security Improvements

### 2026-01-28 — Read-Only Database Access for Sub-Agents
**Status:** ✅ Active  
**Purpose:** Enable sub-agents to query Supabase without risk of data destruction

**Setup:**
- Created `readonly_user` in Supabase with SELECT-only permissions
- Direct PostgreSQL connection (not REST API) for full SQL flexibility
- Connection string in `.env.subagent` (read-only credentials)

**Files Created:**
- `.env.subagent` — Sub-agent environment variables with read-only DATABASE_URL
- `supabase-readonly.sh` — Direct psql wrapper for read-only queries

**Usage:**
```bash
./supabase-readonly.sh "SELECT * FROM assets LIMIT 10"
```

**Impact:**
Sub-agents can now safely query the database for analysis without risk of accidental deletions or modifications. Direct connection gives full SQL flexibility (CTEs, complex joins) vs REST API limitations.

---

## Infrastructure / Backend

### 2026-01-28 — Complete ETF Analysis Pipeline
**Status:** ✅ Deployed (GitHub Actions)  
**Commits:** `7a43531`, `3fc8a31`, `6b49f45`

**Description:**
Built complete ETF analysis pipeline matching the equity workflow structure. Enables technical analysis, setup detection, and AI-powered insights for ETFs.

**Pipeline Flow:**
```
ETF OHLCV → ETF Features → ETF Setup Scanner → ETF AI Signals
```

**Components Created:**

**1. ETF Daily Features** (`jobs/etf_daily_features.py`)
   - Calculates 30+ technical indicators (RSI, MACD, Bollinger, MAs)
   - Trend regime detection (bullish/bearish/sideways)
   - Parallel processing with ThreadPoolExecutor
   - `--force` flag for reprocessing existing data

**2. ETF Daily Setup Scanner** (`jobs/etf_daily_setup_scanner.py`)
   - **Separate ETF-only workflow** (not shared with equities)
   - 4 ETF-specific setups with tuned parameters:
     - `etf_trend_pullback_50ma` — Pullback to 50MA in uptrend
     - `etf_oversold_bounce` — RSI < 35 mean reversion
     - `etf_breakout_confirmed` — Volume-confirmed breakout
     - `etf_golden_cross` — 50MA crosses above 200MA
   - Parallel processing, writes to `setup_signals` table

**3. ETF AI Signals** (E2B Parallel Pattern)
   - `scripts/run_etf_ai_analysis_batch.py` — Batch AI analysis with Gemini
   - `scripts/e2b_etf_orchestrator.py` — Parallel sandbox orchestration
   - Uses **same E2B/Gemini pattern as equity AI signals**
   - Analyzes sector/macro themes for ETFs
   - Configurable sandboxes (default 10, vs 50 for equities)

**4. ETF Daily Scoring** (`jobs/etf_daily_scoring.py`)
   - Composite scoring: Trend (35%), Momentum (25%), Mean Reversion (25%), Volume (15%)
   - Generates `weighted_score` and `inflection_score`
   - Null-safe handling for missing data

**Workflows:**
| Workflow | Triggers After | Purpose |
|----------|----------------|---------|
| `etf-daily-features.yml` | ETF OHLCV | Calculate technical indicators |
| `etf-daily-setup-scanner.yml` | ETF Features | Detect ETF-specific setups |
| `etf-ai-signals-parallel.yml` | ETF Setup Scanner | Gemini AI sector analysis |
| `etf-daily-scoring.yml` | (Manual/scheduled) | Generate composite scores |

**Impact:**
Enables todo item #48 — complete ETF ranking system with technicals, setups, and AI insights. Matches equity workflow architecture while being ETF-optimized.

---

## Pending / Ideas

- [ ] Recent Assets Quick Access — horizontal strip of last viewed assets
- [x] ETF technical score rankings — **Backend complete, frontend pending**
- [ ] Multi-column sorting in asset tables
- [ ] TradingView chart integration in asset detail
- [ ] Memo generation agent for fundamental narratives
- [ ] Backtesting system implementation

---

## Notes

- All changes auto-deploy via Vercel on git push
- Each commit includes detailed message with change summary
- Changes are additive/minor — no breaking changes
- Revert instructions available per change if needed

---

*Last updated: 2026-01-28*

# Stratos Brain — AI-Assisted Changes Log

This document tracks all changes made to the Stratos Brain codebase with AI assistance.

## Quick Stats
- **Total Changes:** 5
- **Files Created:** 6
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

### 2026-01-28 — ETF Feature Calculation & Scoring Pipeline
**Status:** ✅ Deployed (GitHub Actions)  
**Commit:** `7a43531`

**Description:**
Built complete data pipeline to enable technical analysis and ranking of ETFs (sector, index, commodity ETFs).

**Components Created:**

1. **jobs/etf_daily_features.py** (350 lines)
   - Calculates 30+ technical indicators for ETFs
   - RSI, MACD, Bollinger Bands, moving averages (20/50/200)
   - ATR (volatility), volume metrics, trend regime detection
   - Parallel processing with ThreadPoolExecutor

2. **jobs/etf_daily_scoring.py** (180 lines)
   - Composite scoring algorithm for ETFs
   - Trend score (35%), Momentum (25%), Mean reversion (25%), Volume (15%)
   - Generates weighted_score and inflection_score for ranking

3. **GitHub Actions Workflows**
   - `.github/workflows/etf-daily-features.yml` — runs daily at 7am UTC
   - `.github/workflows/etf-daily-scoring.yml` — triggers after features complete

**Prerequisites Met:**
- ETFs already have OHLCV data (from index_commodity_etf_daily_ohlcv.py)
- daily_features table already accepts ETF asset_ids
- daily_asset_scores table already supports ETF universe

**Impact:**
Enables the todo item #48: "rank order all the sector ETFs based on their technical score to search for ideas." Frontend can now query `daily_asset_scores` for ETFs and display ranked lists.

**Next Step:** Run the workflows to populate historical ETF features, then build the frontend ETF ranking UI.

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

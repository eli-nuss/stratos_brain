# Missing Financial Data Analysis Report

**Date:** January 20, 2026  
**Issue:** Some assets in the dashboard don't show financial metrics (P/E, Fwd P/E, PEG, P/S, Revenue Growth)

---

## Executive Summary

After analyzing the codebase and database, I identified **three root causes** for missing financial data:

1. **Unprofitable/Pre-revenue Companies**: Alpha Vantage returns `"-"` for P/E ratios when companies have negative earnings
2. **Incomplete Metadata Population**: Only ~74% of P/S ratios are populated despite being available from the API
3. **Stale Materialized View**: The `mv_dashboard_all_assets` view may not be refreshed after metadata updates

---

## Current State Analysis

### Database Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| Total Active Equities | 4,458 | 100% |
| With P/E Ratio | 2,810 | 63% |
| Missing P/E Ratio | 1,648 | 37% |
| With P/S Ratio | 1,156 | 26% |
| Missing P/S Ratio | 3,302 | 74% |
| With equity_metadata record | 4,304 | 97% |
| Missing equity_metadata record | 154 | 3% |

### Sample Assets with Missing Data

| Symbol | Company | P/E | Fwd P/E | PEG | P/S | Reason |
|--------|---------|-----|---------|-----|-----|--------|
| PL | Planet Labs PBC | NULL | NULL | NULL | NULL | Negative earnings, P/S available from API (33.48) |
| ACHR | Archer Aviation Inc. | NULL | NULL | NULL | NULL | Pre-revenue, negative earnings |
| LUNR | Intuitive Machines Inc. | NULL | NULL | NULL | NULL | Negative earnings, P/S available from API (13.96) |
| VSAT | Viasat, Inc | NULL | NULL | NULL | NULL | Negative earnings |
| FLY | Firefly Aerospace Inc | 0.00 | NULL | NULL | NULL | Pre-revenue |
| VOYG | Voyager Technologies, Inc. | NULL | NULL | NULL | NULL | Pre-revenue |

---

## Root Cause Details

### 1. Alpha Vantage API Returns "-" for Unprofitable Companies

When a company has negative earnings, Alpha Vantage returns:
```json
{
  "PERatio": "None",
  "TrailingPE": "-",
  "ForwardPE": "-",
  "PEGRatio": "None",
  "PriceToSalesRatioTTM": "33.48"  // ← This IS available!
}
```

The `parse_decimal()` function in `ingest_fundamentals.py` correctly handles these values by returning `None`. However, **P/S ratio IS available** for many of these companies but isn't being populated.

### 2. `ingest_fundamentals.py` Uses UPDATE Instead of UPSERT

The `update_equity_metadata()` function only updates existing records:
```python
cur.execute("""
    UPDATE equity_metadata SET
        pe_ratio = COALESCE(%s, pe_ratio),
        price_to_sales_ttm = COALESCE(%s, price_to_sales_ttm),
        ...
    WHERE asset_id = %s
""")
```

This means:
- Assets without existing `equity_metadata` records won't get updated
- The script only processes assets that already have metadata records

### 3. Materialized View Not Refreshed

The `mv_dashboard_all_assets` materialized view needs to be manually refreshed after metadata updates. If not refreshed, the dashboard shows stale data.

---

## Recommended Solutions

### Immediate Fix: Refresh Metadata and Materialized View

Run these SQL commands to update the materialized view:

```sql
-- Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_all_assets;
```

### Short-term Fix: Run Comprehensive Metadata Update

Run the `ingest_fundamentals.py` script for all active equities to populate missing P/S ratios:

```bash
cd /home/ubuntu/stratos_brain
python3 -m src.stratos_engine.ingest_fundamentals --limit 5000
```

### Long-term Fixes

1. **Modify `update_equity_metadata()` to use UPSERT**:
   ```python
   cur.execute("""
       INSERT INTO equity_metadata (asset_id, symbol, price_to_sales_ttm, ...)
       VALUES (%s, %s, %s, ...)
       ON CONFLICT (asset_id) DO UPDATE SET
           price_to_sales_ttm = COALESCE(EXCLUDED.price_to_sales_ttm, equity_metadata.price_to_sales_ttm),
           ...
   """)
   ```

2. **Add automatic materialized view refresh** after metadata updates:
   ```sql
   -- Add to the end of the fundamentals ingestion job
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_all_assets;
   ```

3. **Consider showing "N/A" in the UI** for P/E when companies are unprofitable, instead of leaving it blank

4. **Add a scheduled job** to refresh metadata weekly for all active equities

---

## Files Involved

| File | Purpose |
|------|---------|
| `src/stratos_engine/ingest_fundamentals.py` | Fetches and updates equity_metadata from Alpha Vantage |
| `scripts/fetch_equity_metadata.py` | Alternative script using Yahoo Finance |
| `supabase/migrations/019_fundamental_vigor_scores.sql` | Defines `v_dashboard_all_assets` view |
| `supabase/functions/control-api/index.ts` | API that queries `mv_dashboard_all_assets` |

---

## Verification Steps

After implementing fixes, verify with:

```sql
-- Check P/S ratio population
SELECT 
    COUNT(*) as total,
    COUNT(price_to_sales_ttm) as with_ps,
    ROUND(100.0 * COUNT(price_to_sales_ttm) / COUNT(*), 2) as pct_with_ps
FROM equity_metadata em
JOIN assets a ON em.asset_id = a.asset_id
WHERE a.is_active = true AND a.asset_type = 'equity';

-- Check materialized view is current
SELECT MAX(last_updated) FROM equity_metadata;
```

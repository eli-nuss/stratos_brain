# Stratos Guru Tracker - Deployment Guide

**Feature:** Track super-investor portfolios (Buffett, Burry, Ackman, etc.) via 13F filings  
**Status:** Ready for deployment  
**Created:** January 12, 2026

---

## Overview

The Guru Tracker feature allows users to:
- Search for institutional investors by name (e.g., "Berkshire Hathaway", "Scion")
- Track their portfolios automatically via FMP API
- View holdings sorted by conviction (% of portfolio)
- See position changes (NEW, ADD, REDUCE, SOLD)
- Refresh holdings to get latest 13F data

---

## Architecture

### Components Created

1. **Database Schema** (`supabase/migrations/019_guru_tracker.sql`)
   - `tracked_investors` - List of tracked gurus
   - `investor_holdings` - Portfolio snapshots from 13F filings
   - Views for latest holdings, summaries, and cross-references

2. **Backend API** (`supabase/functions/guru-api/index.ts`)
   - Search investors by name
   - Track new investors and fetch holdings
   - Refresh holdings for existing investors
   - Delete investors from tracking

3. **Frontend Page** (`dashboard/client/src/pages/GuruTracker.tsx`)
   - Search modal with FMP CIK search
   - Sidebar list of tracked gurus
   - Holdings table with conviction metrics
   - Action badges (NEW, ADD, REDUCE, SOLD)

4. **Integration**
   - Added route to `App.tsx`
   - Added navigation link to `DashboardLayout.tsx`
   - Added proxy route to `dashboard/server/index.ts`

---

## Deployment Steps

### Step 1: Run Database Migration

Connect to your Supabase database and run the migration:

```bash
# Using Supabase CLI
cd /path/to/stratos_brain
supabase db push

# OR manually via psql
psql "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres" \
  -f supabase/migrations/019_guru_tracker.sql
```

**Verify migration:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('tracked_investors', 'investor_holdings');

-- Check views exist
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'v_guru%';
```

### Step 2: Deploy Edge Function

Deploy the `guru-api` edge function to Supabase:

```bash
# Make sure FMP_API_KEY is set in Supabase secrets
supabase secrets set FMP_API_KEY=your_fmp_api_key_here

# Deploy the function
supabase functions deploy guru-api --project-ref wfogbaipiqootjrsprde --no-verify-jwt
```

**Environment variables needed:**
- `FMP_API_KEY` - Your Financial Modeling Prep API key
- `SUPABASE_URL` - Already configured
- `SUPABASE_SERVICE_ROLE_KEY` - Already configured

### Step 3: Update GitHub Actions Workflow

Add guru-api deployment to `.github/workflows/deploy-edge-functions.yml`:

```yaml
- name: Deploy guru-api function
  run: |
    supabase functions deploy guru-api --project-ref ${{ secrets.SUPABASE_PROJECT_REF }} --no-verify-jwt
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Step 4: Deploy Frontend

The frontend changes are already integrated. Deploy the dashboard:

```bash
cd dashboard
pnpm install  # Install dependencies if needed
pnpm build    # Build for production
```

If using Vercel (as indicated by `vercel.json`):
```bash
vercel --prod
```

Or commit and push to trigger automatic deployment:
```bash
git add .
git commit -m "feat: Add Guru Tracker feature"
git push origin main
```

---

## Testing Checklist

### Backend Testing

**1. Test FMP API connectivity:**
```bash
# Search for an investor
curl "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/guru-api/search?query=berkshire" \
  -H "x-stratos-key: stratos_brain_api_key_2024"

# Expected: Array of search results with CIK numbers
```

**2. Test tracking an investor:**
```bash
curl -X POST "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/guru-api/track" \
  -H "Content-Type: application/json" \
  -H "x-stratos-key: stratos_brain_api_key_2024" \
  -d '{"cik": "0001067983", "name": "Berkshire Hathaway Inc."}'

# Expected: { "success": true, "investorId": 1, "holdingsCount": 50, ... }
```

**3. Test retrieving holdings:**
```bash
curl "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/guru-api/holdings/1" \
  -H "x-stratos-key: stratos_brain_api_key_2024"

# Expected: Array of holdings with symbols, values, percentages
```

**4. Test listing investors:**
```bash
curl "https://wfogbaipiqootjrsprde.supabase.co/functions/v1/guru-api/investors" \
  -H "x-stratos-key: stratos_brain_api_key_2024"

# Expected: Array of tracked investors with summaries
```

### Frontend Testing

**1. Navigation:**
- [ ] Click "Guru Tracker" in top navigation
- [ ] Page loads at `/gurus` route
- [ ] No console errors

**2. Search functionality:**
- [ ] Click "Add Guru" button
- [ ] Modal opens with search input
- [ ] Type "Buffett" and press Enter
- [ ] Search results appear
- [ ] Click on a result to track

**3. Tracking workflow:**
- [ ] After clicking a result, modal closes
- [ ] Toast notification appears with success message
- [ ] Guru appears in left sidebar
- [ ] Holdings count and portfolio value display

**4. Holdings view:**
- [ ] Click on a tracked guru in sidebar
- [ ] Holdings table loads on right side
- [ ] Columns display: Symbol, Company, % Portfolio, Value, Shares, Change, Action
- [ ] Action badges show correct colors (NEW=blue, ADD=green, REDUCE=yellow, SOLD=red)
- [ ] Table is sorted by % Portfolio (highest first)

**5. Refresh functionality:**
- [ ] Click refresh icon on a guru card
- [ ] Toast shows "Refreshed!" message
- [ ] Holdings update if new data available

**6. Delete functionality:**
- [ ] Click trash icon on a guru card
- [ ] Confirmation dialog appears
- [ ] After confirming, guru is removed
- [ ] If guru was selected, main area shows "Select a guru" message

---

## FMP API Endpoints Used

### 1. CIK Search
```
GET https://financialmodelingprep.com/api/v3/cik-search/{query}?apikey={key}
```
**Purpose:** Find institutional investors by name  
**Returns:** Array of `{ cik, name, entityType }`

### 2. Portfolio Holdings
```
GET https://financialmodelingprep.com/api/v4/institutional-ownership/portfolio-holdings?cik={cik}&apikey={key}
```
**Purpose:** Get latest 13F holdings for an investor  
**Returns:** Array of holdings with:
- `symbol` - Stock ticker
- `securityName` - Company name
- `shares` - Number of shares held
- `value` - Position value in USD
- `weightPercentage` - % of portfolio
- `changeInSharesNumber` - Change since last quarter
- `changeInSharesNumberPercentage` - % change
- `filingDate` - Date of 13F filing

---

## Database Schema Reference

### Table: `tracked_investors`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `user_id` | UUID | Optional user association |
| `name` | TEXT | Investor name (e.g., "Berkshire Hathaway") |
| `cik` | TEXT | SEC CIK identifier (unique) |
| `last_filing_date` | DATE | Date of most recent 13F |
| `last_updated` | TIMESTAMPTZ | Last refresh timestamp |
| `is_active` | BOOLEAN | Active tracking flag |
| `metadata` | JSONB | Additional metadata |

### Table: `investor_holdings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `investor_id` | BIGINT | Foreign key to tracked_investors |
| `symbol` | TEXT | Stock ticker |
| `company_name` | TEXT | Company name |
| `shares` | BIGINT | Number of shares |
| `value` | BIGINT | Position value (USD) |
| `percent_portfolio` | NUMERIC | Conviction weight (%) |
| `change_shares` | BIGINT | Share change from last quarter |
| `change_percent` | NUMERIC | Percentage change |
| `action` | TEXT | NEW, ADD, REDUCE, SOLD, HOLD |
| `date_reported` | DATE | 13F filing date |
| `quarter` | TEXT | Quarter label (e.g., "Q4 2024") |

### Views

- **`v_guru_latest_holdings`** - Latest holdings for each investor
- **`v_guru_summary`** - Portfolio summaries with position counts
- **`v_stock_guru_holders`** - Cross-reference of which gurus hold each stock

---

## Troubleshooting

### Issue: "FMP_API_KEY not configured"

**Solution:** Set the environment variable in Supabase:
```bash
supabase secrets set FMP_API_KEY=your_key_here
```

### Issue: "No holdings found for this investor"

**Possible causes:**
1. CIK is incorrect
2. Investor hasn't filed 13F recently (only required for funds >$100M AUM)
3. FMP API doesn't have data for this CIK

**Solution:** Try a different investor or check FMP directly

### Issue: Search returns no results

**Possible causes:**
1. FMP API key invalid
2. Typo in search query
3. Investor not in FMP database

**Solution:** Test FMP API directly:
```bash
curl "https://financialmodelingprep.com/api/v3/cik-search/berkshire?apikey=YOUR_KEY"
```

### Issue: Holdings not updating on refresh

**Possible causes:**
1. 13F data hasn't changed (filings are quarterly)
2. FMP hasn't updated their data yet

**Solution:** 13F filings are only required quarterly, so holdings may not change daily

---

## Future Enhancements

### Phase 2 Features (Not Implemented Yet)

1. **Cross-Reference on Stock Pages**
   - When viewing a stock (e.g., AAPL), show "Held by: Buffett, Soros"
   - Requires integration with `AssetDetail.tsx` component
   - Query: `SELECT * FROM v_stock_guru_holders WHERE symbol = 'AAPL'`

2. **Historical Tracking**
   - Store multiple quarters of data
   - Show position size changes over time
   - Chart portfolio evolution

3. **Alerts**
   - Notify when a guru makes a NEW position
   - Alert on large ADD/REDUCE actions
   - Email digest of guru activity

4. **Guru Comparison**
   - Compare holdings across multiple gurus
   - Find common positions
   - Divergence analysis

5. **Performance Tracking**
   - Calculate returns for guru portfolios
   - Compare to S&P 500 benchmark
   - Leaderboard of best performers

---

## API Rate Limits

**FMP API Limits:**
- Free tier: 250 requests/day
- Starter: 750 requests/day
- Professional: Unlimited

**Recommendations:**
- Cache search results client-side
- Implement refresh cooldown (e.g., max once per hour per investor)
- Consider upgrading FMP plan if tracking many gurus

---

## Support & Maintenance

### Monitoring

Monitor these metrics:
- Number of tracked investors
- API call volume to FMP
- Error rates in edge function logs
- User engagement (page views, searches)

### Logs

View edge function logs:
```bash
supabase functions logs guru-api --project-ref wfogbaipiqootjrsprde
```

### Database Maintenance

Recommended indexes are already created. If performance degrades:
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('tracked_investors', 'investor_holdings')
ORDER BY idx_scan DESC;

-- Vacuum tables periodically
VACUUM ANALYZE tracked_investors;
VACUUM ANALYZE investor_holdings;
```

---

## Files Modified/Created

### New Files
- `supabase/migrations/019_guru_tracker.sql`
- `supabase/functions/guru-api/index.ts`
- `dashboard/client/src/pages/GuruTracker.tsx`
- `GURU_TRACKER_DEPLOYMENT.md` (this file)

### Modified Files
- `dashboard/client/src/App.tsx` - Added `/gurus` route
- `dashboard/client/src/components/DashboardLayout.tsx` - Added navigation link
- `dashboard/server/index.ts` - Added guru-api proxy route

---

## Rollback Plan

If issues arise after deployment:

**1. Disable frontend:**
```typescript
// In App.tsx, comment out the route
// <Route path={"/gurus"} component={GuruTracker} />
```

**2. Disable backend:**
```bash
# Delete the edge function
supabase functions delete guru-api --project-ref wfogbaipiqootjrsprde
```

**3. Rollback database:**
```sql
-- Drop tables and views
DROP VIEW IF EXISTS v_stock_guru_holders;
DROP VIEW IF EXISTS v_guru_summary;
DROP VIEW IF EXISTS v_guru_latest_holdings;
DROP TABLE IF EXISTS investor_holdings;
DROP TABLE IF EXISTS tracked_investors;
```

---

## Success Criteria

Feature is successfully deployed when:
- [ ] Database migration runs without errors
- [ ] Edge function deploys and responds to requests
- [ ] Frontend page loads at `/gurus`
- [ ] Can search for "Berkshire Hathaway" and get results
- [ ] Can track an investor and see their holdings
- [ ] Holdings display with correct formatting
- [ ] Refresh functionality works
- [ ] No console errors or warnings

---

## Contact & Questions

For questions about this feature:
1. Review this deployment guide
2. Check Supabase edge function logs
3. Test FMP API endpoints directly
4. Review the comprehensive codebase review at `/home/ubuntu/stratos_brain_review.md`

---

**End of Deployment Guide**

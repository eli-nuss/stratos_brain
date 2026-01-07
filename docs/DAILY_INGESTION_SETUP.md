# Daily Bars Ingestion Setup Guide

This guide explains how to set up automated daily OHLCV data ingestion for both **crypto** and **equities** using GitHub Actions.

## Overview

| Job | Data Source | Schedule | Runtime | Assets |
|-----|-------------|----------|---------|--------|
| **Crypto Daily OHLCV** | CoinGecko Pro | Daily 00:30 UTC | ~1 min | 253 |
| **Equity Daily OHLCV** | Alpha Vantage Premium | Mon-Fri 21:30 UTC | ~85 min | 5,018 |

---

## Date Handling

### Crypto (24/7 Markets)
- **Schedule**: 00:30 UTC daily (30 min after midnight)
- **Logic**: Fetches price at 00:00 UTC of current day, stores as YESTERDAY's close
- **Example**: Job at 2026-01-06 00:30 UTC → stores data for 2026-01-05

### Equities (Market Hours)
- **Schedule**: 21:30 UTC Mon-Fri (after 4:30 PM ET market close)
- **Logic**: Uses date directly from Alpha Vantage (official market close)
- **Example**: Job at 2026-01-06 21:30 UTC → stores data for 2026-01-06

---

## Prerequisites

1. **GitHub Repository**: `eli-nuss/stratos_brain`
2. **API Keys**:
   - CoinGecko Pro API Key
   - Alpha Vantage Premium API Key
3. **Database**: Supabase PostgreSQL with `daily_bars` table

---

## Step 1: Add GitHub Secrets

Go to your repository: **Settings → Secrets and variables → Actions → New repository secret**

Add these three secrets:

### `DATABASE_URL`
```
postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres?sslmode=require
```

### `COINGECKO_API_KEY`
```
CG-k7Vqq9wSF98RuuRZX527bzvv
```

### `ALPHAVANTAGE_API_KEY`
```
PLZVWIJQFOVHT4WL
```

---

## Step 2: Push the Workflow Files

The following files need to be in your repository:

```
stratos_brain/
├── .github/
│   └── workflows/
│       ├── crypto-daily-ohlcv.yml    # Crypto ingestion workflow
│       └── equity-daily-ohlcv.yml    # Equity ingestion workflow
├── jobs/
│   ├── __init__.py
│   ├── crypto_daily_ohlcv.py         # Crypto ingestion script
│   └── equity_daily_ohlcv.py         # Equity ingestion script
```

Push these files to your repository:

```bash
cd stratos_brain
git add .github/workflows/ jobs/ docs/DAILY_INGESTION_SETUP.md
git commit -m "Add daily OHLCV ingestion workflows"
git push origin main
```

---

## Step 3: Verify Workflows

After pushing, go to **Actions** tab in your GitHub repository. You should see:

1. **Crypto Daily OHLCV** - Scheduled for 00:30 UTC daily
2. **Equity Daily OHLCV** - Scheduled for 21:30 UTC Mon-Fri

---

## Manual Execution

You can manually trigger either workflow:

1. Go to **Actions** tab
2. Select the workflow (e.g., "Crypto Daily OHLCV")
3. Click **Run workflow**
4. Optionally specify a target date (YYYY-MM-DD format)
5. Click **Run workflow** button

---

## Workflow Details

### Crypto Daily OHLCV

**File**: `.github/workflows/crypto-daily-ohlcv.yml`

**Schedule**: Daily at 00:30 UTC (30 min after midnight)

**What it does**:
1. Fetches market chart data from CoinGecko Pro API
2. Processes 253 active crypto assets in parallel (10 concurrent)
3. Stores data as YESTERDAY's date (price at 00:00 UTC = previous day's close)
4. Upserts data into `daily_bars` table

**Expected runtime**: ~1 minute

**Rate limits**: CoinGecko Pro allows ~30 calls/min, we use 10 concurrent with 2s delays

### Equity Daily OHLCV

**File**: `.github/workflows/equity-daily-ohlcv.yml`

**Schedule**: Mon-Fri at 21:30 UTC (4:30 PM ET, after market close)

**What it does**:
1. Checks if target date is a trading day (skips weekends/holidays)
2. Fetches daily adjusted OHLCV from Alpha Vantage
3. Processes 5,018 active equity assets sequentially
4. Uses rate-limited requests (60/min for Premium tier)
5. Upserts data into `daily_bars` table

**Expected runtime**: ~85 minutes

**Rate limits**: Alpha Vantage Premium allows 75 calls/min, we use 60/min for safety

---

## Monitoring

### View Workflow Runs

1. Go to **Actions** tab
2. Click on a workflow name to see run history
3. Click on a specific run to see logs

### Check for Failures

GitHub will show a red ❌ for failed runs. Click to see error logs.

### Email Notifications

GitHub sends email notifications for workflow failures by default.

---

## Troubleshooting

### "Rate limit hit" errors

**Crypto**: Wait 1-2 minutes and retry. CoinGecko rate limits reset quickly.

**Equity**: The script automatically waits 60s on rate limit. If persistent, check your API tier.

### "No data for date" warnings

**Crypto**: Some tokens may not have data for recent dates. This is normal.

**Equity**: Check if the date is a trading day. The script skips weekends/holidays.

### Database connection errors

1. Verify `DATABASE_URL` secret is correct
2. Check Supabase is accessible (not paused)
3. Verify SSL mode is included (`?sslmode=require`)

### Workflow not running on schedule

1. GitHub Actions schedules can be delayed by up to 15 minutes
2. Schedules only run on the default branch (usually `main`)
3. Check if Actions are enabled for the repository

---

## Data Verification

After a successful run, verify data in Supabase:

```sql
-- Check latest crypto data
SELECT a.symbol, db.date, db.close, db.volume
FROM daily_bars db
JOIN assets a ON db.asset_id = a.asset_id
WHERE a.asset_type = 'crypto'
ORDER BY db.date DESC, a.symbol
LIMIT 20;

-- Check latest equity data
SELECT a.symbol, db.date, db.close, db.volume
FROM daily_bars db
JOIN assets a ON db.asset_id = a.asset_id
WHERE a.asset_type = 'equity'
ORDER BY db.date DESC, a.symbol
LIMIT 20;

-- Check data freshness
SELECT 
    a.asset_type,
    MAX(db.date) as latest_date,
    COUNT(DISTINCT db.asset_id) as assets_with_data
FROM daily_bars db
JOIN assets a ON db.asset_id = a.asset_id
WHERE db.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY a.asset_type;
```

---

## Local Testing

You can test the scripts locally:

```bash
# Set environment variables
export DATABASE_URL="postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres?sslmode=require"
export COINGECKO_API_KEY="CG-k7Vqq9wSF98RuuRZX527bzvv"
export ALPHAVANTAGE_API_KEY="PLZVWIJQFOVHT4WL"

# Install dependencies
pip install psycopg2-binary aiohttp python-dotenv

# Test crypto ingestion (specific date)
python -m jobs.crypto_daily_ohlcv --date 2026-01-06

# Test equity ingestion (limited assets)
python -m jobs.equity_daily_ohlcv --date 2026-01-06 --limit 10
```

---

## Cost Considerations

### GitHub Actions

- **Free tier**: 2,000 minutes/month for private repos
- **Crypto job**: ~1 min × 30 days = 30 min/month
- **Equity job**: ~85 min × 22 trading days = 1,870 min/month
- **Total**: ~1,900 min/month (within free tier!)

### API Costs

- **CoinGecko Pro**: Included in your plan
- **Alpha Vantage Premium**: Included in your plan

---

## Next Steps

After daily bars ingestion is working:

1. **Feature Calculation**: Run `feature_calc_direct.py` after OHLCV ingestion
2. **AI Analysis**: Run AI scoring after features are calculated
3. **Full Pipeline**: Consider creating a combined workflow that runs all stages

---

## Support

If you encounter issues:

1. Check the workflow logs in GitHub Actions
2. Verify secrets are set correctly
3. Test scripts locally with `--limit 10` flag
4. Check Supabase database connectivity

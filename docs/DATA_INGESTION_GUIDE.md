# Stratos Brain: Data Ingestion Guide

This document outlines how to ingest daily OHLCV (Open, High, Low, Close, Volume) data into the Stratos Brain database for both **crypto** and **equities**.

---

## Table of Contents

1. [Overview](#overview)
2. [Data Sources](#data-sources)
3. [Database Schema](#database-schema)
4. [Scripts Reference](#scripts-reference)
5. [Crypto Data Ingestion](#crypto-data-ingestion)
6. [Equity Data Ingestion](#equity-data-ingestion)
7. [Feature Calculation](#feature-calculation)
8. [Complete Daily Pipeline](#complete-daily-pipeline)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The data ingestion pipeline consists of three main stages:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Fetch OHLCV │ ──▶ │  2. Calculate   │ ──▶ │  3. Run AI      │
│     Data        │     │     Features    │     │     Analysis    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
  daily_bars            daily_features          asset_ai_reviews
```

**Key Tables:**
- `assets` - Master list of all tracked assets
- `daily_bars` - Raw OHLCV price data
- `daily_features` - Calculated technical indicators
- `asset_ai_reviews` - AI-generated analysis

---

## Data Sources

| Asset Type | Data Provider | API Key Variable | Rate Limits |
|------------|---------------|------------------|-------------|
| **Crypto** | CoinGecko Pro | `COINGECKO_API_KEY` | ~30 calls/min |
| **Equities** | AlphaVantage | `ALPHAVANTAGE_API_KEY` | 5 calls/min (free), 75/min (premium) |

### API Keys Setup

```bash
# Add to your environment or .env file
export COINGECKO_API_KEY="CG-your-api-key-here"
export ALPHAVANTAGE_API_KEY="your-api-key-here"
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
```

---

## Database Schema

### `daily_bars` Table

```sql
CREATE TABLE daily_bars (
    asset_id INTEGER REFERENCES assets(asset_id),
    date DATE NOT NULL,
    open NUMERIC(20,8),
    high NUMERIC(20,8),
    low NUMERIC(20,8),
    close NUMERIC(20,8),
    volume NUMERIC(30,8),
    dollar_volume NUMERIC(30,8),  -- close * volume
    source VARCHAR(50),           -- 'coingecko', 'alphavantage', etc.
    adjusted_flag BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (asset_id, date)
);
```

### `assets` Table (Key Fields)

```sql
-- Crypto assets need coingecko_id
SELECT asset_id, symbol, coingecko_id FROM assets WHERE asset_type = 'crypto';

-- Equity assets use symbol directly (or alpha_vantage_symbol if different)
SELECT asset_id, symbol, alpha_vantage_symbol FROM assets WHERE asset_type = 'equity';
```

---

## Scripts Reference

| Script | Purpose | Asset Type |
|--------|---------|------------|
| `scripts/backfill_ohlcv.py` | Basic OHLCV backfill (sequential) | Both |
| `scripts/parallel_ohlcv_update.py` | Fast parallel crypto update | Crypto |
| `scripts/feature_calc_direct.py` | Calculate technical features | Both |
| `run_all_crypto.py` | Full crypto pipeline + AI analysis | Crypto |
| `run_all_equities.py` | Full equity pipeline + AI analysis | Equities |

---

## Crypto Data Ingestion

### Option 1: Quick Daily Update (Recommended)

Use the parallel script for fast daily updates:

```bash
cd /home/ubuntu/stratos_brain
source venv/bin/activate

# Update crypto OHLCV for today
python scripts/parallel_ohlcv_update.py --date 2026-01-05

# Or for a specific date
python scripts/parallel_ohlcv_update.py --date 2026-01-04
```

**What it does:**
- Fetches data from CoinGecko Pro API
- Processes 10 assets concurrently
- Inserts/updates `daily_bars` table
- ~5 minutes for 300+ crypto assets

### Option 2: Full Backfill

For initial setup or historical backfill:

```bash
# Backfill last 30 days for all crypto
python scripts/backfill_ohlcv.py --type crypto

# Limit to specific number of assets
python scripts/backfill_ohlcv.py --type crypto --limit 100

# Resume from a specific index (if interrupted)
python scripts/backfill_ohlcv.py --type crypto --start-from 150
```

### Option 3: Complete Pipeline (OHLCV + Features + AI)

Run the full pipeline including AI analysis:

```bash
# Full crypto pipeline for today
python run_all_crypto.py

# For a specific date
python run_all_crypto.py --date 2026-01-04

# Limit number of assets
python run_all_crypto.py --limit 200
```

**This script:**
1. Fetches OHLCV from CoinGecko
2. Calculates technical features
3. Runs AI analysis (Gemini)
4. Saves to `asset_ai_reviews`

---

## Equity Data Ingestion

### Option 1: Basic Backfill

```bash
cd /home/ubuntu/stratos_brain
source venv/bin/activate

# Backfill equities from AlphaVantage
python scripts/backfill_ohlcv.py --type equity

# Limit to top N assets
python scripts/backfill_ohlcv.py --type equity --limit 500

# Resume from index
python scripts/backfill_ohlcv.py --type equity --start-from 100
```

**Note:** AlphaVantage free tier is limited to 5 calls/minute. The script automatically adds delays.

### Option 2: Complete Pipeline (OHLCV + Features + AI)

```bash
# Full equity pipeline
python run_all_equities.py

# For a specific date (must be a trading day)
python run_all_equities.py --date 2026-01-02

# Limit number of assets
python run_all_equities.py --limit 500
```

**Important:** Equity markets are closed on weekends. Only run for trading days (Mon-Fri, excluding holidays).

---

## Feature Calculation

After ingesting OHLCV data, calculate technical features:

```bash
# Calculate features for all equities on a specific date
python scripts/feature_calc_direct.py --date 2026-01-02 --type equity

# Calculate features for crypto
python scripts/feature_calc_direct.py --date 2026-01-04 --type crypto

# Use parallel processing (faster)
python scripts/feature_calc_direct.py --date 2026-01-02 --type equity --parallel 8
```

**Features Calculated:**
- Moving Averages: SMA 20, 50, 200
- Momentum: RSI 14, MACD, ROC
- Volatility: ATR, Bollinger Bands, Realized Vol
- Volume: RVOL, Dollar Volume
- Trend: MA distances, slopes, regime
- And 50+ more indicators

---

## Complete Daily Pipeline

### For Crypto (Daily)

```bash
#!/bin/bash
# run_daily_crypto.sh

cd /home/ubuntu/stratos_brain
source venv/bin/activate

DATE=$(date +%Y-%m-%d)

echo "=== Starting Crypto Pipeline for $DATE ==="

# Step 1: Fetch OHLCV
echo "Step 1: Fetching OHLCV data..."
python scripts/parallel_ohlcv_update.py --date $DATE

# Step 2: Calculate Features
echo "Step 2: Calculating features..."
python scripts/feature_calc_direct.py --date $DATE --type crypto --parallel 8

# Step 3: Run AI Analysis
echo "Step 3: Running AI analysis..."
python run_all_crypto.py --date $DATE --skip-ohlcv --skip-features

echo "=== Crypto Pipeline Complete ==="
```

### For Equities (Trading Days Only)

```bash
#!/bin/bash
# run_daily_equities.sh

cd /home/ubuntu/stratos_brain
source venv/bin/activate

# Get last trading day (skip weekends)
DOW=$(date +%u)
if [ $DOW -eq 1 ]; then
    DATE=$(date -d "3 days ago" +%Y-%m-%d)  # Monday -> Friday
elif [ $DOW -eq 7 ]; then
    DATE=$(date -d "2 days ago" +%Y-%m-%d)  # Sunday -> Friday
else
    DATE=$(date -d "1 day ago" +%Y-%m-%d)   # Weekday -> Previous day
fi

echo "=== Starting Equity Pipeline for $DATE ==="

# Step 1: Fetch OHLCV (slow due to rate limits)
echo "Step 1: Fetching OHLCV data..."
python scripts/backfill_ohlcv.py --type equity --limit 500

# Step 2: Calculate Features
echo "Step 2: Calculating features..."
python scripts/feature_calc_direct.py --date $DATE --type equity --parallel 8

# Step 3: Run AI Analysis
echo "Step 3: Running AI analysis..."
python run_all_equities.py --date $DATE --skip-ohlcv --skip-features

echo "=== Equity Pipeline Complete ==="
```

---

## Troubleshooting

### Common Issues

**1. Rate Limit Errors**

```
Rate limit hit for bitcoin
```

**Solution:** The scripts automatically handle rate limits with delays. If you see repeated errors:
- For CoinGecko: Wait 1 minute and retry
- For AlphaVantage: Wait 1 minute (free) or check your premium quota

**2. Missing coingecko_id**

```
No coingecko_id for asset XYZ
```

**Solution:** Update the `assets` table:
```sql
UPDATE assets SET coingecko_id = 'correct-id' WHERE symbol = 'XYZ';
```

**3. No Data for Date**

```
No data for 2026-01-04
```

**Solution:** 
- For crypto: Check if CoinGecko has data for that date
- For equities: Ensure it's a trading day (not weekend/holiday)

**4. Database Connection Errors**

```
Connection refused
```

**Solution:** Check your `DATABASE_URL` environment variable and ensure Supabase is accessible.

### Checking Data Status

```sql
-- Check latest OHLCV data per asset type
SELECT asset_type, MAX(date) as latest_date, COUNT(DISTINCT asset_id) as assets
FROM daily_bars db
JOIN assets a ON db.asset_id = a.asset_id
GROUP BY asset_type;

-- Check assets missing data for a specific date
SELECT a.symbol, a.asset_type
FROM assets a
WHERE a.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM daily_bars db 
    WHERE db.asset_id = a.asset_id AND db.date = '2026-01-04'
  )
LIMIT 20;

-- Check feature calculation status
SELECT asset_type, date, COUNT(*) as features_count
FROM daily_features df
JOIN assets a ON df.asset_id = a.asset_id
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY asset_type, date
ORDER BY date DESC;
```

---

## Environment Setup

### Required Python Packages

```bash
pip install requests psycopg2-binary pandas numpy aiohttp
```

### Full Environment Setup

```bash
cd /home/ubuntu/stratos_brain
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file or export these variables:

```bash
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
export COINGECKO_API_KEY="CG-xxx"
export ALPHAVANTAGE_API_KEY="xxx"
export GEMINI_API_KEY="xxx"  # For AI analysis
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_KEY="xxx"
```

---

## Summary

| Task | Command |
|------|---------|
| **Crypto daily update** | `python scripts/parallel_ohlcv_update.py --date YYYY-MM-DD` |
| **Crypto full pipeline** | `python run_all_crypto.py` |
| **Equity backfill** | `python scripts/backfill_ohlcv.py --type equity` |
| **Equity full pipeline** | `python run_all_equities.py` |
| **Calculate features** | `python scripts/feature_calc_direct.py --date YYYY-MM-DD --type TYPE` |

For questions or issues, check the logs or run scripts with `--help` for more options.

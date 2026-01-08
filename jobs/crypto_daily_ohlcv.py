#!/usr/bin/env python3
"""
Crypto Daily OHLCV Ingestion Job
================================
Fetches daily OHLCV bars from CoinGecko Pro API for all active crypto assets.
Designed to run as a GitHub Actions scheduled workflow.

This script uses the /coins/{id}/ohlc endpoint to get REAL OHLC data (not just close),
then aggregates 4-hour candles into daily candles.

DATE HANDLING:
--------------
This script should be run AFTER midnight UTC (recommended: 00:30-02:00 UTC).
When run, it fetches OHLC candles and aggregates them for the target date.
The data is stored with the specified date.

Features:
- Real OHLC data (not just close price repeated 4x)
- Parallel async fetching with rate limiting
- Volume data from market_chart endpoint
- Upsert to daily_bars table (no duplicates)
- Comprehensive logging

Usage:
    python -m jobs.crypto_daily_ohlcv [--date YYYY-MM-DD] [--limit N]
    
    --date: The date to fetch/store data for (default: yesterday UTC)
    --limit: Limit number of assets (for testing)

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
    COINGECKO_API_KEY: CoinGecko Pro API key
"""

import os
import sys
import asyncio
import argparse
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

import aiohttp
import psycopg2
from psycopg2.extras import execute_values

# ============================================================================
# Configuration
# ============================================================================

COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")

# Rate limiting: CoinGecko Pro allows ~30 calls/min
# We need 2 calls per asset (OHLC + volume), so ~15 assets/min
# With 253 assets, that's ~17 minutes total
# We'll use concurrent requests with delays to stay under limit
MAX_CONCURRENT = 5  # Concurrent requests
RATE_LIMIT_DELAY = 2.5  # Seconds between requests (24 req/min)
REQUEST_TIMEOUT = 30  # Seconds

# Minimum coverage threshold - fail workflow if below this
MIN_SUCCESS_RATE = 0.90  # 90% minimum coverage required

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# ============================================================================
# Database Functions
# ============================================================================

def get_db_connection():
    """Create database connection."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL)


def get_crypto_assets(conn, limit: Optional[int] = None) -> list[tuple]:
    """
    Get all active crypto assets with coingecko_id.
    Returns: List of (asset_id, symbol, coingecko_id) tuples
    """
    query = """
        SELECT asset_id, symbol, coingecko_id 
        FROM assets 
        WHERE asset_type = 'crypto' 
          AND is_active = true 
          AND coingecko_id IS NOT NULL
        ORDER BY asset_id
    """
    if limit:
        query = query.rstrip() + f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()


def insert_daily_bars(conn, records: list[dict]) -> int:
    """
    Insert/update daily bars using upsert.
    Returns: Number of records inserted/updated
    """
    if not records:
        return 0
    
    query = """
        INSERT INTO daily_bars 
            (asset_id, date, open, high, low, close, volume, dollar_volume, source, adjusted_flag)
        VALUES %s
        ON CONFLICT (asset_id, date) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume,
            dollar_volume = EXCLUDED.dollar_volume,
            source = EXCLUDED.source,
            adjusted_flag = EXCLUDED.adjusted_flag
    """
    
    values = []
    for rec in records:
        close = rec["close"]
        volume = rec.get("volume", Decimal("0"))
        dollar_volume = close * volume if volume and volume > 0 else Decimal("0")
        
        values.append((
            rec["asset_id"],
            rec["date"],
            rec["open"],
            rec["high"],
            rec["low"],
            close,
            volume,
            dollar_volume,
            "coingecko_ohlc",
            True  # adjusted_flag
        ))
    
    with conn.cursor() as cur:
        execute_values(cur, query, values)
    conn.commit()
    
    return len(values)


# ============================================================================
# CoinGecko API Functions
# ============================================================================

async def fetch_ohlc(
    session: aiohttp.ClientSession,
    coingecko_id: str,
    semaphore: asyncio.Semaphore
) -> dict:
    """
    Fetch OHLC data from CoinGecko Pro API.
    Uses days=7 which returns 4-hour candles that we aggregate to daily.
    
    Returns: [timestamp_ms, open, high, low, close] arrays
    """
    url = f"https://pro-api.coingecko.com/api/v3/coins/{coingecko_id}/ohlc"
    params = {
        "vs_currency": "usd",
        "days": "7"  # Returns 4-hour candles
    }
    headers = {"x-cg-pro-api-key": COINGECKO_API_KEY}
    
    async with semaphore:
        await asyncio.sleep(RATE_LIMIT_DELAY)  # Rate limiting
        
        try:
            async with session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                if response.status == 429:
                    logger.warning(f"Rate limited for {coingecko_id}, waiting 60s...")
                    await asyncio.sleep(60)
                    # Retry once
                    async with session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT) as retry:
                        if retry.status == 200:
                            data = await retry.json()
                            return {"coingecko_id": coingecko_id, "error": None, "data": data}
                        return {"coingecko_id": coingecko_id, "error": f"retry_http_{retry.status}", "data": None}
                
                if response.status != 200:
                    return {"coingecko_id": coingecko_id, "error": f"http_{response.status}", "data": None}
                
                data = await response.json()
                return {"coingecko_id": coingecko_id, "error": None, "data": data}
                
        except asyncio.TimeoutError:
            return {"coingecko_id": coingecko_id, "error": "timeout", "data": None}
        except Exception as e:
            return {"coingecko_id": coingecko_id, "error": str(e)[:50], "data": None}


async def fetch_volume(
    session: aiohttp.ClientSession,
    coingecko_id: str,
    semaphore: asyncio.Semaphore
) -> dict:
    """
    Fetch volume data from market_chart endpoint.
    OHLC endpoint doesn't include volume, so we fetch it separately.
    """
    url = f"https://pro-api.coingecko.com/api/v3/coins/{coingecko_id}/market_chart"
    params = {
        "vs_currency": "usd",
        "days": "7",
        "interval": "daily"
    }
    headers = {"x-cg-pro-api-key": COINGECKO_API_KEY}
    
    async with semaphore:
        await asyncio.sleep(RATE_LIMIT_DELAY)  # Rate limiting
        
        try:
            async with session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                if response.status == 429:
                    await asyncio.sleep(60)
                    async with session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT) as retry:
                        if retry.status == 200:
                            data = await retry.json()
                            return {"coingecko_id": coingecko_id, "error": None, "data": data}
                        return {"coingecko_id": coingecko_id, "error": f"retry_http_{retry.status}", "data": None}
                
                if response.status != 200:
                    return {"coingecko_id": coingecko_id, "error": f"http_{response.status}", "data": None}
                
                data = await response.json()
                return {"coingecko_id": coingecko_id, "error": None, "data": data}
                
        except asyncio.TimeoutError:
            return {"coingecko_id": coingecko_id, "error": "timeout", "data": None}
        except Exception as e:
            return {"coingecko_id": coingecko_id, "error": str(e)[:50], "data": None}


def aggregate_ohlc_to_daily(ohlc_data: list, target_date: str) -> Optional[dict]:
    """
    Aggregate 4-hour OHLC candles into a daily candle.
    
    CoinGecko OHLC format: [timestamp_ms, open, high, low, close]
    
    For a given target_date, we aggregate all candles from 00:00 UTC to 23:59 UTC.
    - Open: First candle's open
    - High: Max high across all candles
    - Low: Min low across all candles
    - Close: Last candle's close
    """
    if not ohlc_data:
        return None
    
    target_dt = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    target_end = target_dt + timedelta(days=1)
    
    # Filter candles for target date
    daily_candles = []
    for candle in ohlc_data:
        ts_ms, open_price, high, low, close = candle
        candle_time = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        
        if target_dt <= candle_time < target_end:
            daily_candles.append({
                'time': candle_time,
                'open': Decimal(str(open_price)),
                'high': Decimal(str(high)),
                'low': Decimal(str(low)),
                'close': Decimal(str(close))
            })
    
    if not daily_candles:
        return None
    
    # Sort by time
    daily_candles.sort(key=lambda x: x['time'])
    
    # Aggregate
    return {
        'open': daily_candles[0]['open'],
        'high': max(c['high'] for c in daily_candles),
        'low': min(c['low'] for c in daily_candles),
        'close': daily_candles[-1]['close']
    }


def extract_volume_for_date(market_data: dict, target_date: str) -> Optional[Decimal]:
    """
    Extract volume for a specific date from market_chart data.
    """
    if not market_data:
        return None
    
    target_dt = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    
    for vol_entry in market_data.get("total_volumes", []):
        ts_ms, volume = vol_entry
        vol_time = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        if vol_time.date() == target_dt.date():
            return Decimal(str(volume))
    
    return None


# ============================================================================
# Main Processing
# ============================================================================

async def process_asset(
    session: aiohttp.ClientSession,
    asset_id: int,
    symbol: str,
    coingecko_id: str,
    target_date: str,
    semaphore: asyncio.Semaphore
) -> Optional[dict]:
    """
    Process a single asset: fetch OHLC and volume, aggregate to daily.
    """
    # Fetch OHLC data
    ohlc_result = await fetch_ohlc(session, coingecko_id, semaphore)
    
    if ohlc_result["error"]:
        logger.debug(f"✗ {symbol}: OHLC error - {ohlc_result['error']}")
        return None
    
    # Aggregate to daily
    daily_ohlc = aggregate_ohlc_to_daily(ohlc_result["data"], target_date)
    
    if not daily_ohlc:
        logger.debug(f"✗ {symbol}: No OHLC data for {target_date}")
        return None
    
    # Fetch volume data
    vol_result = await fetch_volume(session, coingecko_id, semaphore)
    volume = None
    
    if not vol_result["error"] and vol_result["data"]:
        volume = extract_volume_for_date(vol_result["data"], target_date)
    
    return {
        "asset_id": asset_id,
        "date": target_date,
        "open": daily_ohlc["open"],
        "high": daily_ohlc["high"],
        "low": daily_ohlc["low"],
        "close": daily_ohlc["close"],
        "volume": volume or Decimal("0")
    }


async def run_ingestion(target_date: str, limit: Optional[int] = None) -> int:
    """
    Run the crypto OHLCV ingestion for a specific date.
    
    Args:
        target_date: Date string in YYYY-MM-DD format
        limit: Optional limit on number of assets (for testing)
    
    Returns:
        Number of records inserted
    """
    logger.info("=" * 60)
    logger.info(f"CRYPTO DAILY OHLCV INGESTION (Real OHLC)")
    logger.info(f"Target Date: {target_date}")
    logger.info(f"Current UTC: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)
    
    # Validate environment
    if not COINGECKO_API_KEY:
        raise ValueError("COINGECKO_API_KEY environment variable not set")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Get assets from database
    conn = get_db_connection()
    assets = get_crypto_assets(conn, limit)
    logger.info(f"Found {len(assets)} active crypto assets")
    
    if not assets:
        logger.warning("No crypto assets found!")
        conn.close()
        return 0
    
    # Estimate time: 2 API calls per asset, ~2.5s each
    est_time = len(assets) * 2 * RATE_LIMIT_DELAY / 60
    logger.info(f"Estimated time: ~{est_time:.1f} minutes")
    
    # Process all assets
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    all_records = []
    success = 0
    errors = 0
    
    async with aiohttp.ClientSession() as session:
        # Process in batches for progress reporting
        batch_size = 25
        batches = [assets[i:i + batch_size] for i in range(0, len(assets), batch_size)]
        
        for batch_idx, batch in enumerate(batches):
            logger.info(f"Processing batch {batch_idx + 1}/{len(batches)} ({len(batch)} assets)...")
            
            tasks = [
                process_asset(session, asset_id, symbol, cg_id, target_date, semaphore)
                for asset_id, symbol, cg_id in batch
            ]
            
            results = await asyncio.gather(*tasks)
            
            batch_success = 0
            for result in results:
                if result:
                    all_records.append(result)
                    batch_success += 1
                    success += 1
                else:
                    errors += 1
            
            logger.info(f"  → Batch complete: {batch_success}/{len(batch)} successful")
    
    # Insert records
    logger.info("-" * 60)
    logger.info(f"Inserting {len(all_records)} records into daily_bars...")
    
    inserted = insert_daily_bars(conn, all_records)
    conn.close()
    
    # Summary
    success_rate = success / len(assets) if len(assets) > 0 else 0
    logger.info("=" * 60)
    logger.info(f"INGESTION COMPLETE")
    logger.info(f"  Assets processed: {len(assets)}")
    logger.info(f"  Records inserted: {inserted}")
    logger.info(f"  Success rate: {success_rate * 100:.1f}%")
    logger.info(f"  Errors: {errors}")
    logger.info("=" * 60)
    
    # Check minimum coverage gate
    if success_rate < MIN_SUCCESS_RATE:
        logger.error(f"COVERAGE GATE FAILED: {success_rate*100:.1f}% < {MIN_SUCCESS_RATE*100:.0f}% minimum")
        logger.error("Workflow will fail to prevent incomplete data from propagating downstream.")
        return -1  # Signal failure
    
    return inserted


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Crypto Daily OHLCV Ingestion")
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Target date in YYYY-MM-DD format (default: yesterday UTC)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of assets (for testing)"
    )
    args = parser.parse_args()
    
    # Default to yesterday UTC
    if args.date:
        target_date = args.date
    else:
        yesterday = datetime.utcnow() - timedelta(days=1)
        target_date = yesterday.strftime("%Y-%m-%d")
    
    logger.info(f"Target date: {target_date}")
    
    try:
        inserted = asyncio.run(run_ingestion(target_date, args.limit))
        if inserted < 0:  # Coverage gate failed
            sys.exit(1)
        sys.exit(0 if inserted > 0 else 1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

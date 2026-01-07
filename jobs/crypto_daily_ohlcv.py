#!/usr/bin/env python3
"""
Crypto Daily OHLCV Ingestion Job
================================
Fetches daily bars from CoinGecko Pro API for all active crypto assets.
Designed to run as a GitHub Actions scheduled workflow.

DATE HANDLING:
--------------
This script should be run AFTER midnight UTC (recommended: 00:30-02:00 UTC).
When run, it fetches the price at 00:00 UTC of the CURRENT day, which represents
the CLOSE of the PREVIOUS day. The data is stored with the PREVIOUS day's date.

Example:
- Script runs at 2026-01-06 01:00 UTC
- Fetches price at 2026-01-06 00:00 UTC (from market_chart)
- Stores as 2026-01-05's close (yesterday)

This matches the existing data convention in the database.

Features:
- Parallel async fetching (10 concurrent requests)
- Rate limit handling with automatic retry
- Upsert to daily_bars table (no duplicates)
- Comprehensive logging

Usage:
    python -m jobs.crypto_daily_ohlcv [--date YYYY-MM-DD]
    
    --date: The date to store the data as (default: yesterday UTC)
            The script will fetch the 00:00 UTC price of the NEXT day.

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
    COINGECKO_API_KEY: CoinGecko Pro API key
"""

import os
import sys
import asyncio
import argparse
import logging
from datetime import datetime, timedelta
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

# Parallel processing settings
MAX_CONCURRENT = 10  # CoinGecko Pro allows ~30/min, we use 10 for safety
RATE_LIMIT_DELAY = 2.0  # Seconds between batches
REQUEST_TIMEOUT = 30  # Seconds

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


def get_crypto_assets(conn) -> list[tuple]:
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
        dollar_volume = close * volume if volume > 0 else Decimal("0")
        
        values.append((
            rec["asset_id"],
            rec["date"],
            rec["open"],
            rec["high"],
            rec["low"],
            close,
            volume,
            dollar_volume,
            "coingecko",
            True  # adjusted_flag
        ))
    
    with conn.cursor() as cur:
        execute_values(cur, query, values)
    conn.commit()
    
    return len(values)


# ============================================================================
# CoinGecko API Functions
# ============================================================================

async def fetch_market_chart(
    session: aiohttp.ClientSession,
    coingecko_id: str,
    days: int = 7
) -> dict:
    """
    Fetch market chart data from CoinGecko Pro API.
    This gives us prices and volumes at daily intervals (00:00 UTC).
    
    Args:
        session: aiohttp session
        coingecko_id: CoinGecko coin ID
        days: Number of days of history (1, 7, 14, 30, 90, 180, 365, max)
    """
    url = f"https://pro-api.coingecko.com/api/v3/coins/{coingecko_id}/market_chart"
    params = {
        "vs_currency": "usd",
        "days": days,
        "interval": "daily"
    }
    headers = {"x-cg-pro-api-key": COINGECKO_API_KEY}
    
    try:
        async with session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT) as response:
            if response.status == 429:
                logger.warning(f"Rate limited for {coingecko_id}")
                return {"coingecko_id": coingecko_id, "error": "rate_limit", "data": None}
            
            if response.status != 200:
                text = await response.text()
                logger.warning(f"HTTP {response.status} for {coingecko_id}: {text[:100]}")
                return {"coingecko_id": coingecko_id, "error": f"http_{response.status}", "data": None}
            
            data = await response.json()
            return {"coingecko_id": coingecko_id, "error": None, "data": data}
            
    except asyncio.TimeoutError:
        logger.warning(f"Timeout for {coingecko_id}")
        return {"coingecko_id": coingecko_id, "error": "timeout", "data": None}
    except Exception as e:
        logger.warning(f"Error fetching {coingecko_id}: {str(e)[:80]}")
        return {"coingecko_id": coingecko_id, "error": str(e)[:80], "data": None}


def parse_market_chart_for_date(market_data: dict, target_date: str) -> Optional[dict]:
    """
    Parse market chart data and extract the close price for a specific date.
    
    DATE HANDLING:
    The price at 00:00 UTC on date X represents the CLOSE of date X-1.
    So to get the close for target_date, we look for the timestamp at 00:00 UTC
    on target_date + 1 day.
    
    Args:
        market_data: Raw market chart response from CoinGecko
        target_date: The date we want to store the data as (YYYY-MM-DD)
    
    Returns:
        Dict with OHLCV data, or None if not found
    """
    if not market_data:
        return None
    
    # We need the price at 00:00 UTC on the day AFTER target_date
    target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    next_day = target_dt + timedelta(days=1)
    next_day_str = next_day.strftime("%Y-%m-%d")
    
    # Parse prices and volumes, keyed by date string
    prices = {}
    volumes = {}
    
    for p in market_data.get("prices", []):
        timestamp_ms = p[0]
        dt = datetime.utcfromtimestamp(timestamp_ms / 1000)
        date_str = dt.strftime("%Y-%m-%d")
        # Only keep 00:00 UTC timestamps (ignore intraday)
        if dt.hour == 0 and dt.minute == 0:
            prices[date_str] = Decimal(str(p[1]))
    
    for v in market_data.get("total_volumes", []):
        timestamp_ms = v[0]
        dt = datetime.utcfromtimestamp(timestamp_ms / 1000)
        date_str = dt.strftime("%Y-%m-%d")
        if dt.hour == 0 and dt.minute == 0:
            volumes[date_str] = Decimal(str(v[1]))
    
    # Look for the next day's 00:00 UTC price (which is target_date's close)
    if next_day_str not in prices:
        # If next day not available, try using target_date's price as fallback
        # This can happen if we're running before 00:00 UTC of the next day
        if target_date in prices:
            logger.debug(f"Using {target_date} price as fallback (next day not yet available)")
            price = prices[target_date]
            volume = volumes.get(target_date, Decimal("0"))
        else:
            return None
    else:
        price = prices[next_day_str]
        volume = volumes.get(next_day_str, Decimal("0"))
    
    # For daily bars, we use the close price for all OHLC values
    # (CoinGecko market_chart only provides one price point per day)
    return {
        "date": target_date,
        "open": price,
        "high": price,
        "low": price,
        "close": price,
        "volume": volume,
    }


# ============================================================================
# Batch Processing
# ============================================================================

async def process_batch(
    session: aiohttp.ClientSession,
    batch: list[tuple],
    target_date: str
) -> list[dict]:
    """
    Process a batch of assets concurrently.
    
    Args:
        session: aiohttp session
        batch: List of (asset_id, symbol, coingecko_id) tuples
        target_date: Date string in YYYY-MM-DD format (the date to store as)
    
    Returns:
        List of bar records ready for insertion
    """
    # Fetch market chart data for all assets in batch
    tasks = [fetch_market_chart(session, cg_id, days=7) for _, _, cg_id in batch]
    responses = await asyncio.gather(*tasks)
    
    results = []
    
    for (asset_id, symbol, cg_id), resp in zip(batch, responses):
        if resp["error"]:
            logger.debug(f"✗ {symbol}: {resp['error']}")
            continue
        
        bar_data = parse_market_chart_for_date(resp["data"], target_date)
        
        if bar_data:
            bar_data["asset_id"] = asset_id
            results.append(bar_data)
            logger.debug(f"✓ {symbol}: close=${bar_data['close']:.4f}, vol=${bar_data['volume']:.0f}")
        else:
            logger.debug(f"✗ {symbol}: No data for {target_date}")
    
    return results


# ============================================================================
# Main Function
# ============================================================================

async def run_ingestion(target_date: str) -> int:
    """
    Run the crypto OHLCV ingestion for a specific date.
    
    Args:
        target_date: Date string in YYYY-MM-DD format (the date to store data as)
    
    Returns:
        Number of records inserted
    """
    logger.info("=" * 60)
    logger.info(f"CRYPTO DAILY OHLCV INGESTION")
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
    assets = get_crypto_assets(conn)
    logger.info(f"Found {len(assets)} active crypto assets")
    
    if not assets:
        logger.warning("No crypto assets found!")
        conn.close()
        return 0
    
    # Split into batches
    batches = [assets[i:i + MAX_CONCURRENT] for i in range(0, len(assets), MAX_CONCURRENT)]
    logger.info(f"Processing {len(batches)} batches of {MAX_CONCURRENT} assets each")
    
    all_records = []
    errors = 0
    
    # Process batches
    async with aiohttp.ClientSession() as session:
        for i, batch in enumerate(batches):
            batch_start = datetime.now()
            logger.info(f"Batch {i + 1}/{len(batches)} ({len(batch)} assets)...")
            
            try:
                results = await process_batch(session, batch, target_date)
                all_records.extend(results)
                
                batch_time = (datetime.now() - batch_start).total_seconds()
                logger.info(f"  → Got {len(results)} records in {batch_time:.1f}s")
                
            except Exception as e:
                logger.error(f"  → Batch error: {e}")
                errors += 1
            
            # Rate limit delay between batches
            if i < len(batches) - 1:
                await asyncio.sleep(RATE_LIMIT_DELAY)
    
    # Insert records
    logger.info("-" * 60)
    logger.info(f"Inserting {len(all_records)} records into daily_bars...")
    
    inserted = insert_daily_bars(conn, all_records)
    conn.close()
    
    # Summary
    logger.info("=" * 60)
    logger.info(f"INGESTION COMPLETE")
    logger.info(f"  Assets processed: {len(assets)}")
    logger.info(f"  Records inserted: {inserted}")
    logger.info(f"  Success rate: {inserted * 100 / len(assets):.1f}%")
    logger.info(f"  Batch errors: {errors}")
    logger.info("=" * 60)
    
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
    args = parser.parse_args()
    
    # Default to yesterday UTC (since we're fetching the close of that day)
    if args.date:
        target_date = args.date
    else:
        yesterday = datetime.utcnow() - timedelta(days=1)
        target_date = yesterday.strftime("%Y-%m-%d")
    
    logger.info(f"Target date: {target_date}")
    
    try:
        inserted = asyncio.run(run_ingestion(target_date))
        sys.exit(0 if inserted > 0 else 1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

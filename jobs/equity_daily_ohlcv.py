#!/usr/bin/env python3
"""
Equity Daily OHLCV Ingestion Job
================================
Fetches daily bars from Alpha Vantage API for all active equity assets.
Designed to run as a GitHub Actions scheduled workflow.

Features:
- Optimized for Alpha Vantage Premium (75 calls/min)
- Async batch processing with rate limiting
- Trading day detection (skips weekends)
- Upsert to daily_bars table (no duplicates)
- Comprehensive logging with progress tracking

Usage:
    python -m jobs.equity_daily_ohlcv [--date YYYY-MM-DD] [--limit N]

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
    ALPHAVANTAGE_API_KEY: Alpha Vantage API key
"""

import os
import sys
import asyncio
import argparse
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
import time

import aiohttp
import psycopg2
from psycopg2.extras import execute_values

# Exchange calendar for accurate market day detection
try:
    import exchange_calendars as xcals
    NYSE_CALENDAR = xcals.get_calendar('XNYS')
    USE_EXCHANGE_CALENDAR = True
except ImportError:
    NYSE_CALENDAR = None
    USE_EXCHANGE_CALENDAR = False

# ============================================================================
# Configuration
# ============================================================================

ALPHAVANTAGE_API_KEY = os.environ.get("ALPHAVANTAGE_API_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")

# Rate limiting for Alpha Vantage Premium (75 calls/min)
# We use 60 calls/min to be safe (1 call per second)
CALLS_PER_MINUTE = 60
RATE_LIMIT_DELAY = 60.0 / CALLS_PER_MINUTE  # ~1 second between calls

# Batch settings
BATCH_SIZE = 50  # Insert in batches of 50
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
# Trading Day Detection
# ============================================================================

# US Market Holidays 2024-2026 (NYSE/NASDAQ)
US_MARKET_HOLIDAYS = {
    # 2024
    "2024-01-01", "2024-01-15", "2024-02-19", "2024-03-29",
    "2024-05-27", "2024-06-19", "2024-07-04", "2024-09-02",
    "2024-11-28", "2024-12-25",
    # 2025
    "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18",
    "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01",
    "2025-11-27", "2025-12-25",
    # 2026
    "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
    "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
    "2026-11-26", "2026-12-25",
}


def is_trading_day(date_str: str) -> bool:
    """
    Check if a date is a US stock market trading day.
    Uses exchange_calendars library if available, falls back to hardcoded holidays.
    """
    import pandas as pd
    
    if USE_EXCHANGE_CALENDAR and NYSE_CALENDAR:
        try:
            ts = pd.Timestamp(date_str, tz='UTC')
            return NYSE_CALENDAR.is_session(ts)
        except Exception as e:
            logger.warning(f"exchange_calendars error: {e}, falling back to hardcoded holidays")
    
    # Fallback to hardcoded logic
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    
    # Check weekend (Monday=0, Sunday=6)
    if dt.weekday() >= 5:
        return False
    
    # Check holidays
    if date_str in US_MARKET_HOLIDAYS:
        return False
    
    return True


def get_last_trading_day(from_date: str) -> str:
    """Get the most recent trading day on or before the given date."""
    import pandas as pd
    
    if USE_EXCHANGE_CALENDAR and NYSE_CALENDAR:
        try:
            ts = pd.Timestamp(from_date, tz='UTC')
            # Get the previous valid session
            sessions = NYSE_CALENDAR.sessions_in_range(
                ts - pd.Timedelta(days=10), ts
            )
            if len(sessions) > 0:
                return sessions[-1].strftime("%Y-%m-%d")
        except Exception as e:
            logger.warning(f"exchange_calendars error: {e}, falling back to hardcoded logic")
    
    # Fallback
    dt = datetime.strptime(from_date, "%Y-%m-%d")
    while not is_trading_day(dt.strftime("%Y-%m-%d")):
        dt -= timedelta(days=1)
    return dt.strftime("%Y-%m-%d")


# ============================================================================
# Database Functions
# ============================================================================

def get_db_connection():
    """Create database connection."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL)


def get_equity_assets(conn, limit: Optional[int] = None) -> list[tuple]:
    """
    Get all active equity assets.
    Returns: List of (asset_id, symbol) tuples
    """
    query = """
        SELECT asset_id, symbol 
        FROM assets 
        WHERE asset_type = 'equity' 
          AND is_active = true
        ORDER BY asset_id
    """
    if limit:
        query += f" LIMIT {limit}"
    
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
            "alphavantage",
            True  # adjusted_flag (using adjusted close)
        ))
    
    with conn.cursor() as cur:
        execute_values(cur, query, values)
    conn.commit()
    
    return len(values)


# ============================================================================
# Alpha Vantage API Functions
# ============================================================================

async def fetch_daily_adjusted(
    session: aiohttp.ClientSession,
    symbol: str,
    semaphore: asyncio.Semaphore
) -> dict:
    """
    Fetch daily adjusted OHLCV from Alpha Vantage.
    Uses semaphore for rate limiting.
    """
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": symbol,
        "outputsize": "compact",  # Last 100 days
        "apikey": ALPHAVANTAGE_API_KEY,
        "datatype": "json"
    }
    # Disable brotli encoding to avoid decoding issues
    headers = {"Accept-Encoding": "gzip, deflate"}
    
    async with semaphore:
        try:
            async with session.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT) as response:
                data = await response.json()
                
                # Check for rate limit
                if "Note" in data:
                    logger.warning(f"Rate limit hit for {symbol}")
                    return {"symbol": symbol, "error": "rate_limit", "data": None}
                
                # Check for error
                if "Error Message" in data:
                    logger.debug(f"Error for {symbol}: {data['Error Message'][:50]}")
                    return {"symbol": symbol, "error": "invalid_symbol", "data": None}
                
                # Check for valid data
                if "Time Series (Daily)" not in data:
                    logger.debug(f"No data for {symbol}")
                    return {"symbol": symbol, "error": "no_data", "data": None}
                
                return {"symbol": symbol, "error": None, "data": data["Time Series (Daily)"]}
                
        except asyncio.TimeoutError:
            logger.warning(f"Timeout for {symbol}")
            return {"symbol": symbol, "error": "timeout", "data": None}
        except Exception as e:
            logger.warning(f"Error fetching {symbol}: {str(e)[:80]}")
            return {"symbol": symbol, "error": str(e)[:80], "data": None}
        finally:
            # Rate limit delay
            await asyncio.sleep(RATE_LIMIT_DELAY)


def parse_daily_data(time_series: dict, target_date: str) -> Optional[dict]:
    """
    Parse daily adjusted data from Alpha Vantage.
    
    Alpha Vantage format:
    {
        "2024-01-05": {
            "1. open": "...",
            "2. high": "...",
            "3. low": "...",
            "4. close": "...",
            "5. adjusted close": "...",
            "6. volume": "...",
            "7. dividend amount": "...",
            "8. split coefficient": "..."
        }
    }
    """
    if not time_series or target_date not in time_series:
        return None
    
    day_data = time_series[target_date]
    
    try:
        return {
            "date": target_date,
            "open": Decimal(day_data["1. open"]),
            "high": Decimal(day_data["2. high"]),
            "low": Decimal(day_data["3. low"]),
            "close": Decimal(day_data["5. adjusted close"]),  # Use adjusted close
            "volume": Decimal(day_data["6. volume"]),
        }
    except (KeyError, ValueError) as e:
        logger.warning(f"Parse error for {target_date}: {e}")
        return None


# ============================================================================
# Batch Processing
# ============================================================================

async def process_assets(
    assets: list[tuple],
    target_date: str,
    conn
) -> int:
    """
    Process all assets with rate-limited async requests.
    
    Args:
        assets: List of (asset_id, symbol) tuples
        target_date: Date string in YYYY-MM-DD format
        conn: Database connection
    
    Returns:
        Total number of records inserted
    """
    # Semaphore for rate limiting (1 concurrent request)
    semaphore = asyncio.Semaphore(1)
    
    total_inserted = 0
    batch_records = []
    rate_limit_count = 0
    success_count = 0
    error_count = 0
    
    async with aiohttp.ClientSession() as session:
        for i, (asset_id, symbol) in enumerate(assets):
            # Progress logging every 100 assets
            if i % 100 == 0:
                pct = i * 100 // len(assets)
                logger.info(f"Progress: {i}/{len(assets)} ({pct}%) - Success: {success_count}, Errors: {error_count}")
            
            # Fetch data
            result = await fetch_daily_adjusted(session, symbol, semaphore)
            
            # Handle rate limit
            if result["error"] == "rate_limit":
                rate_limit_count += 1
                if rate_limit_count >= 5:
                    logger.error("Too many rate limits, stopping")
                    break
                logger.info("Waiting 60s for rate limit cooldown...")
                await asyncio.sleep(60)
                # Retry
                result = await fetch_daily_adjusted(session, symbol, semaphore)
            
            # Parse and collect record
            if result["data"]:
                bar_data = parse_daily_data(result["data"], target_date)
                if bar_data:
                    bar_data["asset_id"] = asset_id
                    batch_records.append(bar_data)
                    success_count += 1
                else:
                    error_count += 1
            else:
                error_count += 1
            
            # Insert in batches
            if len(batch_records) >= BATCH_SIZE:
                inserted = insert_daily_bars(conn, batch_records)
                total_inserted += inserted
                logger.info(f"  → Inserted batch of {inserted} records")
                batch_records = []
    
    # Insert remaining records
    if batch_records:
        inserted = insert_daily_bars(conn, batch_records)
        total_inserted += inserted
        logger.info(f"  → Inserted final batch of {inserted} records")
    
    return total_inserted


# ============================================================================
# Main Function
# ============================================================================

async def run_ingestion(target_date: str, limit: Optional[int] = None) -> int:
    """
    Run the equity OHLCV ingestion for a specific date.
    
    Args:
        target_date: Date string in YYYY-MM-DD format
        limit: Optional limit on number of assets to process
    
    Returns:
        Number of records inserted
    """
    logger.info("=" * 60)
    logger.info(f"EQUITY DAILY OHLCV INGESTION")
    logger.info(f"Target Date: {target_date}")
    logger.info("=" * 60)
    
    # Check if trading day
    if not is_trading_day(target_date):
        last_trading = get_last_trading_day(target_date)
        logger.info(f"⚠️  {target_date} is not a trading day")
        logger.info(f"   Last trading day was: {last_trading}")
        logger.info(f"   Skipping ingestion (no new data expected)")
        return 0
    
    # Validate environment
    if not ALPHAVANTAGE_API_KEY:
        raise ValueError("ALPHAVANTAGE_API_KEY environment variable not set")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Get assets from database
    conn = get_db_connection()
    assets = get_equity_assets(conn, limit)
    logger.info(f"Found {len(assets)} active equity assets")
    
    if not assets:
        logger.warning("No equity assets found!")
        conn.close()
        return 0
    
    # Estimate runtime
    estimated_minutes = len(assets) * RATE_LIMIT_DELAY / 60
    logger.info(f"Estimated runtime: ~{estimated_minutes:.0f} minutes")
    
    # Process assets
    start_time = datetime.now()
    inserted = await process_assets(assets, target_date, conn)
    elapsed = (datetime.now() - start_time).total_seconds()
    
    conn.close()
    
    # Summary
    success_rate = inserted / len(assets) if len(assets) > 0 else 0
    logger.info("=" * 60)
    logger.info(f"INGESTION COMPLETE")
    logger.info(f"  Assets processed: {len(assets)}")
    logger.info(f"  Records inserted: {inserted}")
    logger.info(f"  Success rate: {success_rate * 100:.1f}%")
    logger.info(f"  Elapsed time: {elapsed / 60:.1f} minutes")
    logger.info("=" * 60)
    
    # Check minimum coverage gate
    if success_rate < MIN_SUCCESS_RATE:
        logger.error(f"COVERAGE GATE FAILED: {success_rate*100:.1f}% < {MIN_SUCCESS_RATE*100:.0f}% minimum")
        logger.error("Workflow will fail to prevent incomplete data from propagating downstream.")
        return -1  # Signal failure
    
    return inserted


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Equity Daily OHLCV Ingestion")
    parser.add_argument(
        "--date",
        type=str,
        default=datetime.utcnow().strftime("%Y-%m-%d"),
        help="Target date in YYYY-MM-DD format (default: today UTC)"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of assets to process (for testing)"
    )
    args = parser.parse_args()
    
    try:
        inserted = asyncio.run(run_ingestion(args.date, args.limit))
        if inserted < 0:  # Coverage gate failed
            sys.exit(1)
        # Exit 0 even if no records (could be non-trading day)
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

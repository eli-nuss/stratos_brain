#!/usr/bin/env python3
"""
Equity Daily OHLCV Ingestion Job
================================
Fetches daily bars for all active equity assets:
- US equities from Alpha Vantage API
- International equities (symbols with exchange suffix like .AX, .L, .DE) from FMP API

Designed to run as a GitHub Actions scheduled workflow.

Features:
- Optimized for Alpha Vantage Premium (75 calls/min)
- FMP support for international stocks
- Async batch processing with rate limiting
- Trading day detection (skips weekends)
- Upsert to daily_bars table (no duplicates)
- Comprehensive logging with progress tracking

Usage:
    python -m jobs.equity_daily_ohlcv [--date YYYY-MM-DD] [--limit N]

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
    ALPHAVANTAGE_API_KEY: Alpha Vantage API key
    FMP_API_KEY: Financial Modeling Prep API key
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

# ============================================================================
# Configuration
# ============================================================================

ALPHAVANTAGE_API_KEY = os.environ.get("ALPHAVANTAGE_API_KEY")
FMP_API_KEY = os.environ.get("FMP_API_KEY")
DATABASE_URL = os.environ.get("DATABASE_URL")

# Rate limiting for Alpha Vantage Premium (75 calls/min)
# We use 60 calls/min to be safe (1 call per second)
AV_CALLS_PER_MINUTE = 60
AV_RATE_LIMIT_DELAY = 60.0 / AV_CALLS_PER_MINUTE  # ~1 second between calls

# Rate limiting for FMP (300 calls/min for premium)
FMP_CALLS_PER_MINUTE = 200
FMP_RATE_LIMIT_DELAY = 60.0 / FMP_CALLS_PER_MINUTE  # ~0.3 seconds between calls

# Batch settings
BATCH_SIZE = 50  # Insert in batches of 50
REQUEST_TIMEOUT = 30  # Seconds

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
    Returns False for weekends and market holidays.
    """
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


def get_equity_assets(conn, limit: Optional[int] = None) -> tuple[list[tuple], list[tuple]]:
    """
    Get all active equity assets, split into US and international.
    
    Returns: 
        Tuple of (us_assets, intl_assets) where each is a list of (asset_id, symbol) tuples
        - US assets: symbols without '.' (e.g., AAPL, MSFT)
        - International assets: symbols with '.' (e.g., BHP.AX, SAP.DE)
    """
    query = """
        SELECT asset_id, symbol 
        FROM assets 
        WHERE asset_type = 'equity' 
          AND is_active = true
        ORDER BY asset_id
    """
    if limit:
        query = query.replace("ORDER BY", f"ORDER BY") + f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query)
        all_assets = cur.fetchall()
    
    # Split into US and international
    us_assets = [(aid, sym) for aid, sym in all_assets if '.' not in sym]
    intl_assets = [(aid, sym) for aid, sym in all_assets if '.' in sym]
    
    return us_assets, intl_assets


def insert_daily_bars(conn, records: list[dict], source: str = "alphavantage") -> int:
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
            source,
            True  # adjusted_flag (using adjusted close)
        ))
    
    with conn.cursor() as cur:
        execute_values(cur, query, values)
    conn.commit()
    
    return len(values)


# ============================================================================
# Alpha Vantage API Functions (for US equities)
# ============================================================================

async def fetch_daily_adjusted_av(
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
            await asyncio.sleep(AV_RATE_LIMIT_DELAY)


def parse_daily_data_av(time_series: dict, target_date: str) -> Optional[dict]:
    """
    Parse daily adjusted data from Alpha Vantage.
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
# FMP API Functions (for international equities)
# ============================================================================

async def fetch_daily_fmp(
    session: aiohttp.ClientSession,
    symbol: str,
    target_date: str,
    semaphore: asyncio.Semaphore
) -> dict:
    """
    Fetch daily OHLCV from FMP for international stocks.
    Uses semaphore for rate limiting.
    """
    url = f"https://financialmodelingprep.com/stable/historical-price-eod/full"
    params = {
        "symbol": symbol,
        "from": target_date,
        "to": target_date,
        "apikey": FMP_API_KEY
    }
    
    async with semaphore:
        try:
            async with session.get(url, params=params, timeout=REQUEST_TIMEOUT) as response:
                data = await response.json()
                
                # FMP returns a list directly
                if isinstance(data, list) and len(data) > 0:
                    return {"symbol": symbol, "error": None, "data": data[0]}
                elif isinstance(data, dict) and "error" in data:
                    logger.debug(f"FMP error for {symbol}: {data.get('error', 'unknown')}")
                    return {"symbol": symbol, "error": "api_error", "data": None}
                else:
                    logger.debug(f"No FMP data for {symbol}")
                    return {"symbol": symbol, "error": "no_data", "data": None}
                
        except asyncio.TimeoutError:
            logger.warning(f"FMP timeout for {symbol}")
            return {"symbol": symbol, "error": "timeout", "data": None}
        except Exception as e:
            logger.warning(f"FMP error fetching {symbol}: {str(e)[:80]}")
            return {"symbol": symbol, "error": str(e)[:80], "data": None}
        finally:
            # Rate limit delay
            await asyncio.sleep(FMP_RATE_LIMIT_DELAY)


def parse_daily_data_fmp(day_data: dict, target_date: str) -> Optional[dict]:
    """
    Parse daily data from FMP.
    
    FMP format:
    {
        "date": "2026-01-28",
        "open": 123.45,
        "high": 125.00,
        "low": 122.00,
        "close": 124.50,
        "adjClose": 124.50,
        "volume": 1234567,
        ...
    }
    """
    if not day_data:
        return None
    
    try:
        # Use adjClose if available, otherwise use close
        close = day_data.get("adjClose") or day_data.get("close")
        
        return {
            "date": day_data.get("date", target_date),
            "open": Decimal(str(day_data["open"])),
            "high": Decimal(str(day_data["high"])),
            "low": Decimal(str(day_data["low"])),
            "close": Decimal(str(close)),
            "volume": Decimal(str(day_data.get("volume", 0))),
        }
    except (KeyError, ValueError, TypeError) as e:
        logger.warning(f"FMP parse error: {e}")
        return None


# ============================================================================
# Batch Processing
# ============================================================================

async def process_us_assets(
    assets: list[tuple],
    target_date: str,
    conn
) -> int:
    """
    Process US assets with Alpha Vantage API.
    """
    if not assets:
        return 0
    
    logger.info(f"Processing {len(assets)} US equities via Alpha Vantage...")
    
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
                pct = i * 100 // len(assets) if assets else 0
                logger.info(f"  US Progress: {i}/{len(assets)} ({pct}%) - Success: {success_count}, Errors: {error_count}")
            
            # Fetch data
            result = await fetch_daily_adjusted_av(session, symbol, semaphore)
            
            # Handle rate limit
            if result["error"] == "rate_limit":
                rate_limit_count += 1
                if rate_limit_count >= 5:
                    logger.error("Too many rate limits, stopping US ingestion")
                    break
                logger.info("Waiting 60s for rate limit cooldown...")
                await asyncio.sleep(60)
                # Retry
                result = await fetch_daily_adjusted_av(session, symbol, semaphore)
            
            # Parse and collect record
            if result["data"]:
                bar_data = parse_daily_data_av(result["data"], target_date)
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
                inserted = insert_daily_bars(conn, batch_records, source="alphavantage")
                total_inserted += inserted
                logger.info(f"    → Inserted batch of {inserted} US records")
                batch_records = []
    
    # Insert remaining records
    if batch_records:
        inserted = insert_daily_bars(conn, batch_records, source="alphavantage")
        total_inserted += inserted
        logger.info(f"    → Inserted final batch of {inserted} US records")
    
    logger.info(f"  US equities complete: {success_count} success, {error_count} errors")
    return total_inserted


async def process_intl_assets(
    assets: list[tuple],
    target_date: str,
    conn
) -> int:
    """
    Process international assets with FMP API.
    """
    if not assets:
        return 0
    
    if not FMP_API_KEY:
        logger.warning("FMP_API_KEY not set, skipping international equities")
        return 0
    
    logger.info(f"Processing {len(assets)} international equities via FMP...")
    
    # Semaphore for rate limiting (allow more concurrent for FMP)
    semaphore = asyncio.Semaphore(3)
    
    total_inserted = 0
    batch_records = []
    success_count = 0
    error_count = 0
    
    async with aiohttp.ClientSession() as session:
        for i, (asset_id, symbol) in enumerate(assets):
            # Progress logging every 20 assets
            if i % 20 == 0:
                pct = i * 100 // len(assets) if assets else 0
                logger.info(f"  Intl Progress: {i}/{len(assets)} ({pct}%) - Success: {success_count}, Errors: {error_count}")
            
            # Fetch data
            result = await fetch_daily_fmp(session, symbol, target_date, semaphore)
            
            # Parse and collect record
            if result["data"]:
                bar_data = parse_daily_data_fmp(result["data"], target_date)
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
                inserted = insert_daily_bars(conn, batch_records, source="fmp")
                total_inserted += inserted
                logger.info(f"    → Inserted batch of {inserted} intl records")
                batch_records = []
    
    # Insert remaining records
    if batch_records:
        inserted = insert_daily_bars(conn, batch_records, source="fmp")
        total_inserted += inserted
        logger.info(f"    → Inserted final batch of {inserted} intl records")
    
    logger.info(f"  International equities complete: {success_count} success, {error_count} errors")
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
    
    # Check if trading day (for US markets - international may still trade)
    if not is_trading_day(target_date):
        last_trading = get_last_trading_day(target_date)
        logger.info(f"Note: {target_date} is not a US trading day")
        logger.info(f"      Last US trading day was: {last_trading}")
        logger.info(f"      Will still fetch international data...")
    
    # Validate environment
    if not ALPHAVANTAGE_API_KEY:
        logger.warning("ALPHAVANTAGE_API_KEY not set, will skip US equities")
    if not FMP_API_KEY:
        logger.warning("FMP_API_KEY not set, will skip international equities")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Get assets from database
    conn = get_db_connection()
    us_assets, intl_assets = get_equity_assets(conn, limit)
    
    logger.info(f"Found {len(us_assets)} US equities (Alpha Vantage)")
    logger.info(f"Found {len(intl_assets)} international equities (FMP)")
    
    if not us_assets and not intl_assets:
        logger.warning("No equity assets found!")
        conn.close()
        return 0
    
    # Estimate runtime
    us_minutes = len(us_assets) * AV_RATE_LIMIT_DELAY / 60 if ALPHAVANTAGE_API_KEY else 0
    intl_minutes = len(intl_assets) * FMP_RATE_LIMIT_DELAY / 60 if FMP_API_KEY else 0
    logger.info(f"Estimated runtime: ~{us_minutes + intl_minutes:.0f} minutes")
    
    # Process assets
    start_time = datetime.now()
    total_inserted = 0
    
    # Process US equities (skip on non-trading days)
    if is_trading_day(target_date) and ALPHAVANTAGE_API_KEY and us_assets:
        us_inserted = await process_us_assets(us_assets, target_date, conn)
        total_inserted += us_inserted
    elif not is_trading_day(target_date):
        logger.info("Skipping US equities (not a trading day)")
    
    # Process international equities (may trade on different schedules)
    if FMP_API_KEY and intl_assets:
        intl_inserted = await process_intl_assets(intl_assets, target_date, conn)
        total_inserted += intl_inserted
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    conn.close()
    
    # Summary
    total_assets = len(us_assets) + len(intl_assets)
    logger.info("=" * 60)
    logger.info(f"INGESTION COMPLETE")
    logger.info(f"  US assets: {len(us_assets)}")
    logger.info(f"  International assets: {len(intl_assets)}")
    logger.info(f"  Total records inserted: {total_inserted}")
    logger.info(f"  Success rate: {total_inserted * 100 / total_assets:.1f}%" if total_assets > 0 else "  Success rate: N/A")
    logger.info(f"  Elapsed time: {elapsed / 60:.1f} minutes")
    logger.info("=" * 60)
    
    return total_inserted


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
        # Exit 0 even if no records (could be non-trading day)
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

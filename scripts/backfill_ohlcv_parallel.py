#!/usr/bin/env python3
"""
Optimized Parallelized OHLCV Backfill Script for Stratos Brain
- Global rate limiter (leaky bucket) for smooth API usage
- Requests session per worker for connection reuse
- Only inserts missing dates (incremental)
- Uses adjusted close consistently

IMPORTANT - CRYPTO DATE HANDLING:
================================
CoinGecko returns prices at 00:00 UTC timestamps. For crypto markets that trade 24/7,
the price at 00:00 UTC on a given date is actually the CLOSE of the PREVIOUS day,
not the close of that day.

Example:
- CoinGecko timestamp 2026-01-05 00:00 UTC = Close price of Jan 4
- CoinGecko timestamp 2026-01-06 00:00 UTC = Close price of Jan 5

When storing crypto OHLCV data, you must SUBTRACT 1 DAY from the CoinGecko timestamp
to get the correct date for the close price.

Incorrect: Store 00:00 UTC price as that date's close (e.g., Jan 5 00:00 -> Jan 5 close) ❌
Correct:   Store 00:00 UTC price as previous date's close (e.g., Jan 5 00:00 -> Jan 4 close) ✓

This does NOT apply to equities, which have defined market hours and clear daily closes.
"""

import os
import sys
import time
import threading
import requests
import psycopg2
from psycopg2.extras import execute_values
from psycopg2 import pool
from datetime import datetime, timedelta
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse

# API Keys
ALPHAVANTAGE_API_KEY = os.environ.get("ALPHAVANTAGE_API_KEY", "PLZVWIJQFOVHT4WL")
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "CG-k7Vqq9wSF98RuuRZX527bzvv")

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres?sslmode=require"
)

# Connection pool
db_pool = None


class RateLimiter:
    """Leaky bucket: enforces avg rate_per_min across all threads."""
    def __init__(self, rate_per_min: float):
        self.interval = 60.0 / rate_per_min
        self.lock = threading.Lock()
        self.next_t = time.monotonic()

    def acquire(self):
        with self.lock:
            now = time.monotonic()
            if now < self.next_t:
                sleep = self.next_t - now
                self.next_t += self.interval
            else:
                sleep = 0.0
                self.next_t = now + self.interval
        if sleep > 0:
            time.sleep(sleep)


# Global rate limiters
av_limiter = RateLimiter(rate_per_min=75)  # AlphaVantage Premium
cg_limiter = RateLimiter(rate_per_min=30)  # CoinGecko Pro (conservative)


def init_db_pool(min_conn=2, max_conn=15):
    """Initialize database connection pool."""
    global db_pool
    db_pool = pool.ThreadedConnectionPool(min_conn, max_conn, DATABASE_URL)
    return db_pool


def get_db_connection():
    """Get connection from pool."""
    return db_pool.getconn()


def release_db_connection(conn):
    """Return connection to pool."""
    db_pool.putconn(conn)


def get_max_date_for_asset(asset_id: int) -> str:
    """Get the most recent date we have data for this asset."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT MAX(date) FROM daily_bars WHERE asset_id = %s",
                (asset_id,)
            )
            result = cur.fetchone()
            if result and result[0]:
                return result[0].strftime("%Y-%m-%d")
            return None
    finally:
        release_db_connection(conn)


def fetch_alphavantage_daily_adjusted(session: requests.Session, symbol: str) -> tuple:
    """
    Fetch daily OHLCV from AlphaVantage using adjusted close.
    Returns (symbol, bars, error).
    """
    av_limiter.acquire()
    
    try:
        resp = session.get("https://www.alphavantage.co/query", params={
            "function": "TIME_SERIES_DAILY_ADJUSTED",
            "symbol": symbol,
            "outputsize": "compact",
            "apikey": ALPHAVANTAGE_API_KEY,
            "datatype": "json",
        }, timeout=30)
        data = resp.json()

        if "Time Series (Daily)" not in data:
            if "Note" in data or "Information" in data:
                return (symbol, None, "rate_limit")
            if "Error Message" in data:
                return (symbol, [], f"error: {data['Error Message'][:80]}")
            return (symbol, [], f"unexpected: {list(data.keys())}")

        bars = []
        ts = data["Time Series (Daily)"]
        for date_str, v in ts.items():
            # Use ADJUSTED close to match Stage1Fetch
            bars.append({
                "date": date_str,
                "open": Decimal(v["1. open"]),
                "high": Decimal(v["2. high"]),
                "low": Decimal(v["3. low"]),
                "close": Decimal(v.get("5. adjusted close", v["4. close"])),
                "volume": Decimal(v["6. volume"]),
            })
        return (symbol, bars, None)
    except Exception as e:
        return (symbol, [], str(e)[:80])


def fetch_coingecko_market_chart(session: requests.Session, coingecko_id: str, days: int = 30) -> tuple:
    """
    Fetch market chart from CoinGecko Pro API. Returns (coingecko_id, bars, error).
    
    WARNING: CoinGecko timestamps are at 00:00 UTC, which represents the CLOSE
    of the PREVIOUS day. When storing this data, subtract 1 day from the date.
    See module docstring for detailed explanation.
    """
    cg_limiter.acquire()
    
    try:
        resp = session.get(
            f"https://pro-api.coingecko.com/api/v3/coins/{coingecko_id}/market_chart",
            params={
                "vs_currency": "usd",
                "days": days,
                "interval": "daily",
            },
            headers={"x-cg-pro-api-key": COINGECKO_API_KEY},
            timeout=30
        )
        
        if resp.status_code == 429:
            return (coingecko_id, None, "rate_limit")
        
        if resp.status_code != 200:
            return (coingecko_id, [], f"http_{resp.status_code}")
        
        data = resp.json()
        
        prices = {datetime.utcfromtimestamp(p[0]/1000).strftime("%Y-%m-%d"): p[1] for p in data.get("prices", [])}
        volumes = {datetime.utcfromtimestamp(v[0]/1000).strftime("%Y-%m-%d"): v[1] for v in data.get("total_volumes", [])}
        
        bars = []
        for date_str, price in prices.items():
            volume = volumes.get(date_str, 0)
            bars.append({
                "date": date_str,
                "open": Decimal(str(price)),
                "high": Decimal(str(price)),
                "low": Decimal(str(price)),
                "close": Decimal(str(price)),
                "volume": Decimal(str(volume)),
            })
        
        return (coingecko_id, bars, None)
    except Exception as e:
        return (coingecko_id, [], str(e)[:80])


def insert_bars(asset_id: int, bars: list, source: str) -> int:
    """Insert bars into daily_bars table using pooled connection."""
    if not bars:
        return 0
    
    conn = get_db_connection()
    try:
        query = """
        INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, dollar_volume, source, adjusted_flag)
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
        for bar in bars:
            close = bar["close"]
            volume = bar["volume"]
            dollar_volume = close * volume if volume > 0 else Decimal("0")
            
            values.append((
                asset_id,
                bar["date"],
                bar["open"],
                bar["high"],
                bar["low"],
                close,
                volume,
                dollar_volume,
                source,
                True,  # adjusted_flag = True since we use adjusted close
            ))
        
        with conn.cursor() as cur:
            execute_values(cur, query, values)
        conn.commit()
        
        return len(values)
    finally:
        release_db_connection(conn)


def filter_new_bars(bars: list, max_date: str) -> list:
    """Filter bars to only include dates after max_date."""
    if not max_date or not bars:
        return bars
    return [b for b in bars if b["date"] > max_date]


def process_equity_asset(session: requests.Session, asset_data: tuple, incremental: bool = True) -> dict:
    """Process a single equity asset. Returns result dict."""
    asset_id, symbol = asset_data
    
    # Get max date if incremental
    max_date = None
    if incremental:
        max_date = get_max_date_for_asset(asset_id)
    
    symbol_clean, bars, error = fetch_alphavantage_daily_adjusted(session, symbol)
    
    if error == "rate_limit":
        return {"asset_id": asset_id, "symbol": symbol, "status": "rate_limit", "bars": 0}
    
    if error:
        return {"asset_id": asset_id, "symbol": symbol, "status": "error", "error": error, "bars": 0}
    
    if bars:
        # Filter to only new bars if incremental
        if incremental and max_date:
            bars = filter_new_bars(bars, max_date)
        
        if bars:
            inserted = insert_bars(asset_id, bars, "alphavantage")
            return {"asset_id": asset_id, "symbol": symbol, "status": "success", "bars": inserted, "max_date": max_date}
        else:
            return {"asset_id": asset_id, "symbol": symbol, "status": "up_to_date", "bars": 0, "max_date": max_date}
    
    return {"asset_id": asset_id, "symbol": symbol, "status": "no_data", "bars": 0}


def process_crypto_asset(session: requests.Session, asset_data: tuple, days: int = 30, incremental: bool = True) -> dict:
    """Process a single crypto asset. Returns result dict."""
    asset_id, symbol, coingecko_id = asset_data
    
    # Get max date if incremental
    max_date = None
    if incremental:
        max_date = get_max_date_for_asset(asset_id)
    
    coingecko_id_clean, bars, error = fetch_coingecko_market_chart(session, coingecko_id, days)
    
    if error == "rate_limit":
        return {"asset_id": asset_id, "symbol": symbol, "status": "rate_limit", "bars": 0}
    
    if error:
        return {"asset_id": asset_id, "symbol": symbol, "status": "error", "error": error, "bars": 0}
    
    if bars:
        # Filter to only new bars if incremental
        if incremental and max_date:
            bars = filter_new_bars(bars, max_date)
        
        if bars:
            inserted = insert_bars(asset_id, bars, "coingecko")
            return {"asset_id": asset_id, "symbol": symbol, "status": "success", "bars": inserted, "max_date": max_date}
        else:
            return {"asset_id": asset_id, "symbol": symbol, "status": "up_to_date", "bars": 0, "max_date": max_date}
    
    return {"asset_id": asset_id, "symbol": symbol, "status": "no_data", "bars": 0}


def get_equity_assets(limit: int = None, offset: int = 0) -> list:
    """Get equity assets to backfill."""
    conn = get_db_connection()
    try:
        query = """
        SELECT asset_id, symbol 
        FROM assets 
        WHERE asset_type = 'equity' AND is_active = true
        ORDER BY asset_id
        OFFSET %s
        """
        if limit:
            query += f" LIMIT {limit}"
        
        with conn.cursor() as cur:
            cur.execute(query, (offset,))
            return cur.fetchall()
    finally:
        release_db_connection(conn)


def get_crypto_assets(limit: int = None, offset: int = 0) -> list:
    """Get crypto assets with coingecko_id to backfill."""
    conn = get_db_connection()
    try:
        query = """
        SELECT asset_id, symbol, coingecko_id 
        FROM assets 
        WHERE asset_type = 'crypto' AND is_active = true AND coingecko_id IS NOT NULL
        ORDER BY asset_id
        OFFSET %s
        """
        if limit:
            query += f" LIMIT {limit}"
        
        with conn.cursor() as cur:
            cur.execute(query, (offset,))
            return cur.fetchall()
    finally:
        release_db_connection(conn)


# Thread-local storage for sessions
thread_local = threading.local()

def get_session():
    """Get or create a requests session for the current thread."""
    if not hasattr(thread_local, "session"):
        thread_local.session = requests.Session()
        # Set connection pool size
        adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10)
        thread_local.session.mount("https://", adapter)
    return thread_local.session


def worker_process_equity(asset_data: tuple, incremental: bool = True) -> dict:
    """Worker function that uses thread-local session."""
    session = get_session()
    return process_equity_asset(session, asset_data, incremental)


def worker_process_crypto(asset_data: tuple, days: int = 30, incremental: bool = True) -> dict:
    """Worker function that uses thread-local session."""
    session = get_session()
    return process_crypto_asset(session, asset_data, days, incremental)


def backfill_equities_parallel(limit: int = None, offset: int = 0, workers: int = 10, incremental: bool = True):
    """
    Backfill equity OHLCV data using parallel workers with global rate limiter.
    Workers pull work continuously; limiter enforces 75/min.
    """
    print(f"\n=== Backfilling Equities from AlphaVantage ===")
    print(f"Workers: {workers}, Rate limit: 75/min, Incremental: {incremental}")
    
    assets = get_equity_assets(limit, offset)
    total_assets = len(assets)
    print(f"Found {total_assets} equity assets to process")
    
    if total_assets == 0:
        return 0
    
    total_bars = 0
    success_count = 0
    error_count = 0
    rate_limit_count = 0
    up_to_date_count = 0
    processed = 0
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        # Submit all tasks - rate limiter handles pacing
        future_to_asset = {
            executor.submit(worker_process_equity, asset, incremental): asset 
            for asset in assets
        }
        
        # Process results as they complete
        for future in as_completed(future_to_asset):
            asset = future_to_asset[future]
            processed += 1
            
            try:
                result = future.result(timeout=120)
                
                if result["status"] == "success":
                    success_count += 1
                    total_bars += result["bars"]
                    print(f"[{processed}/{total_assets}] {result['symbol']}: +{result['bars']} bars")
                elif result["status"] == "up_to_date":
                    up_to_date_count += 1
                    if processed % 100 == 0:  # Only print every 100th up-to-date
                        print(f"[{processed}/{total_assets}] ... {up_to_date_count} assets up to date")
                elif result["status"] == "rate_limit":
                    rate_limit_count += 1
                    print(f"[{processed}/{total_assets}] {result['symbol']}: RATE LIMITED")
                elif result["status"] == "error":
                    error_count += 1
                    # Only print errors for first 50, then summarize
                    if error_count <= 50:
                        print(f"[{processed}/{total_assets}] {result['symbol']}: ERROR - {result.get('error', 'unknown')[:50]}")
                else:
                    print(f"[{processed}/{total_assets}] {result['symbol']}: no data")
                
                # Progress update every 500 assets
                if processed % 500 == 0:
                    elapsed = time.time() - start_time
                    rate = processed / elapsed * 60
                    eta = (total_assets - processed) / (processed / elapsed) if processed > 0 else 0
                    print(f"\n--- Progress: {processed}/{total_assets} ({processed/total_assets*100:.1f}%) ---")
                    print(f"    Rate: {rate:.1f} assets/min, ETA: {eta/60:.1f} min")
                    print(f"    Success: {success_count}, Errors: {error_count}, Up-to-date: {up_to_date_count}\n")
                    
            except Exception as e:
                error_count += 1
                print(f"[{processed}/{total_assets}] {asset[1]}: EXCEPTION - {str(e)[:50]}")
    
    elapsed = time.time() - start_time
    print(f"\n=== Equity backfill complete ===")
    print(f"  Time: {elapsed/60:.1f} minutes")
    print(f"  Total bars inserted: {total_bars}")
    print(f"  Success: {success_count}")
    print(f"  Up-to-date: {up_to_date_count}")
    print(f"  Errors: {error_count}")
    print(f"  Rate limits: {rate_limit_count}")
    print(f"  Avg rate: {total_assets/elapsed*60:.1f} assets/min")
    
    return total_bars


def backfill_crypto_parallel(limit: int = None, offset: int = 0, workers: int = 5, days: int = 30, incremental: bool = True):
    """Backfill crypto OHLCV data using parallel workers with global rate limiter."""
    print(f"\n=== Backfilling Crypto from CoinGecko ===")
    print(f"Workers: {workers}, Rate limit: 30/min, Days: {days}, Incremental: {incremental}")
    
    assets = get_crypto_assets(limit, offset)
    total_assets = len(assets)
    print(f"Found {total_assets} crypto assets to process")
    
    if total_assets == 0:
        return 0
    
    total_bars = 0
    success_count = 0
    error_count = 0
    rate_limit_count = 0
    up_to_date_count = 0
    processed = 0
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_asset = {
            executor.submit(worker_process_crypto, asset, days, incremental): asset 
            for asset in assets
        }
        
        for future in as_completed(future_to_asset):
            asset = future_to_asset[future]
            processed += 1
            
            try:
                result = future.result(timeout=120)
                
                if result["status"] == "success":
                    success_count += 1
                    total_bars += result["bars"]
                    print(f"[{processed}/{total_assets}] {result['symbol']}: +{result['bars']} bars")
                elif result["status"] == "up_to_date":
                    up_to_date_count += 1
                elif result["status"] == "rate_limit":
                    rate_limit_count += 1
                    print(f"[{processed}/{total_assets}] {result['symbol']}: RATE LIMITED")
                elif result["status"] == "error":
                    error_count += 1
                    if error_count <= 20:
                        print(f"[{processed}/{total_assets}] {result['symbol']}: ERROR - {result.get('error', 'unknown')}")
                else:
                    print(f"[{processed}/{total_assets}] {result['symbol']}: no data")
                    
            except Exception as e:
                error_count += 1
                print(f"[{processed}/{total_assets}] {asset[1]}: EXCEPTION - {e}")
    
    elapsed = time.time() - start_time
    print(f"\nCrypto backfill complete:")
    print(f"  Time: {elapsed/60:.1f} minutes")
    print(f"  Total bars: {total_bars}")
    print(f"  Success: {success_count}")
    print(f"  Up-to-date: {up_to_date_count}")
    print(f"  Errors: {error_count}")
    print(f"  Rate limits: {rate_limit_count}")
    
    return total_bars


def main():
    parser = argparse.ArgumentParser(description="Optimized Parallelized OHLCV Backfill")
    parser.add_argument("--type", choices=["equity", "crypto", "both"], default="both",
                       help="Type of assets to backfill")
    parser.add_argument("--limit", type=int, default=None,
                       help="Limit number of assets to process")
    parser.add_argument("--offset", type=int, default=0,
                       help="Offset to start from (for resuming)")
    parser.add_argument("--workers", type=int, default=10,
                       help="Number of parallel workers")
    parser.add_argument("--full", action="store_true",
                       help="Full backfill (ignore existing data)")
    parser.add_argument("--days", type=int, default=30,
                       help="Days of history for crypto (default 30)")
    
    args = parser.parse_args()
    incremental = not args.full
    
    print("Initializing database connection pool...")
    init_db_pool(min_conn=2, max_conn=args.workers + 5)
    print("Connected!")
    
    try:
        if args.type in ["crypto", "both"]:
            backfill_crypto_parallel(args.limit, args.offset, min(args.workers, 5), args.days, incremental)
        
        if args.type in ["equity", "both"]:
            backfill_equities_parallel(args.limit, args.offset, args.workers, incremental)
    finally:
        if db_pool:
            db_pool.closeall()
    
    print("\nBackfill complete!")


if __name__ == "__main__":
    main()

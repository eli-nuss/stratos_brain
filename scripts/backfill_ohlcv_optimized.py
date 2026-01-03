#!/usr/bin/env python3
"""
Highly Optimized OHLCV Backfill Script for Stratos Brain
Improvements:
1. Single SQL pre-scan to get max_date per asset (not per-asset queries)
2. Only call API for stale symbols (skip up-to-date assets)
3. Dynamic outputsize (full for never-loaded, compact for gaps)
4. Rate limit retry with exponential backoff
5. Chunked submission (500 at a time) to reduce memory overhead
6. Reduced rate limit (70/min) to avoid boundary throttles
"""

import os
import sys
import time
import threading
import random
import requests
import psycopg2
from psycopg2.extras import execute_values
from psycopg2 import pool
from datetime import datetime, timedelta, date
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


# Global rate limiters - reduced to 70/min to avoid boundary throttles
av_limiter = RateLimiter(rate_per_min=70)
cg_limiter = RateLimiter(rate_per_min=30)


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


def get_equity_assets_with_max_date(target_date: str, limit: int = None, offset: int = 0) -> list:
    """
    OPTIMIZATION #1: Single SQL query to get all equity assets with their max_date.
    Returns list of (asset_id, symbol, max_date) tuples.
    Only returns assets that are STALE (max_date < target_date or NULL).
    """
    conn = get_db_connection()
    try:
        query = """
        SELECT a.asset_id,
               a.symbol,
               MAX(b.date) AS max_date
        FROM assets a
        LEFT JOIN daily_bars b ON b.asset_id = a.asset_id
        WHERE a.asset_type = 'equity'
          AND a.is_active = true
        GROUP BY a.asset_id, a.symbol
        HAVING MAX(b.date) IS NULL OR MAX(b.date) < %s
        ORDER BY a.asset_id
        OFFSET %s
        """
        if limit:
            query += f" LIMIT {limit}"
        
        with conn.cursor() as cur:
            cur.execute(query, (target_date, offset))
            results = cur.fetchall()
            # Convert date objects to strings
            return [(r[0], r[1], r[2].strftime("%Y-%m-%d") if r[2] else None) for r in results]
    finally:
        release_db_connection(conn)


def get_crypto_assets_with_max_date(target_date: str, limit: int = None, offset: int = 0) -> list:
    """Single SQL query to get crypto assets with their max_date (stale only)."""
    conn = get_db_connection()
    try:
        query = """
        SELECT a.asset_id,
               a.symbol,
               a.coingecko_id,
               MAX(b.date) AS max_date
        FROM assets a
        LEFT JOIN daily_bars b ON b.asset_id = a.asset_id
        WHERE a.asset_type = 'crypto'
          AND a.is_active = true
          AND a.coingecko_id IS NOT NULL
        GROUP BY a.asset_id, a.symbol, a.coingecko_id
        HAVING MAX(b.date) IS NULL OR MAX(b.date) < %s
        ORDER BY a.asset_id
        OFFSET %s
        """
        if limit:
            query += f" LIMIT {limit}"
        
        with conn.cursor() as cur:
            cur.execute(query, (target_date, offset))
            results = cur.fetchall()
            return [(r[0], r[1], r[2], r[3].strftime("%Y-%m-%d") if r[3] else None) for r in results]
    finally:
        release_db_connection(conn)


def fetch_alphavantage_daily_adjusted(session: requests.Session, symbol: str, outputsize: str = "compact") -> tuple:
    """
    Fetch daily OHLCV from AlphaVantage using adjusted close.
    OPTIMIZATION #2: Dynamic outputsize parameter.
    Returns (symbol, bars, error).
    """
    av_limiter.acquire()
    
    try:
        resp = session.get("https://www.alphavantage.co/query", params={
            "function": "TIME_SERIES_DAILY_ADJUSTED",
            "symbol": symbol,
            "outputsize": outputsize,
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


def fetch_with_retry(session: requests.Session, symbol: str, outputsize: str = "compact", max_retries: int = 5) -> tuple:
    """
    OPTIMIZATION #3: Retry on rate limit with exponential backoff.
    """
    for attempt in range(max_retries):
        sym, bars, err = fetch_alphavantage_daily_adjusted(session, symbol, outputsize)
        if err != "rate_limit":
            return (sym, bars, err)
        # Exponential backoff with jitter
        sleep_time = 2 + attempt * 2 + random.random()
        time.sleep(sleep_time)
    return (symbol, None, "rate_limit_exhausted")


def fetch_coingecko_market_chart(session: requests.Session, coingecko_id: str, days: int = 30) -> tuple:
    """Fetch market chart from CoinGecko Pro API."""
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


def insert_bars(asset_id: int, bars: list, source: str, use_do_nothing: bool = False) -> int:
    """
    Insert bars into daily_bars table.
    OPTIMIZATION #5: Option to use DO NOTHING for initial loads.
    """
    if not bars:
        return 0
    
    conn = get_db_connection()
    try:
        if use_do_nothing:
            query = """
            INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, dollar_volume, source, adjusted_flag)
            VALUES %s
            ON CONFLICT (asset_id, date) DO NOTHING
            """
        else:
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
                True,
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


def process_equity_asset(session: requests.Session, asset_data: tuple, target_date: str) -> dict:
    """
    Process a single equity asset.
    asset_data = (asset_id, symbol, max_date)
    max_date is already known from the pre-scan query.
    """
    asset_id, symbol, max_date = asset_data
    
    # OPTIMIZATION #2: Determine outputsize based on max_date
    if max_date is None:
        outputsize = "full"  # Never loaded - get full history
    else:
        max_date_obj = datetime.strptime(max_date, "%Y-%m-%d").date()
        target_date_obj = datetime.strptime(target_date, "%Y-%m-%d").date()
        gap_days = (target_date_obj - max_date_obj).days
        outputsize = "full" if gap_days > 90 else "compact"
    
    # OPTIMIZATION #3: Fetch with retry
    symbol_clean, bars, error = fetch_with_retry(session, symbol, outputsize)
    
    if error == "rate_limit_exhausted":
        return {"asset_id": asset_id, "symbol": symbol, "status": "rate_limit", "bars": 0}
    
    if error:
        return {"asset_id": asset_id, "symbol": symbol, "status": "error", "error": error, "bars": 0}
    
    if bars:
        # Filter to only new bars
        if max_date:
            bars = filter_new_bars(bars, max_date)
        
        if bars:
            # Use DO NOTHING for initial loads (max_date is None)
            use_do_nothing = max_date is None
            inserted = insert_bars(asset_id, bars, "alphavantage", use_do_nothing)
            return {"asset_id": asset_id, "symbol": symbol, "status": "success", "bars": inserted, "outputsize": outputsize}
    
    return {"asset_id": asset_id, "symbol": symbol, "status": "no_data", "bars": 0}


def process_crypto_asset(session: requests.Session, asset_data: tuple, days: int = 30) -> dict:
    """Process a single crypto asset."""
    asset_id, symbol, coingecko_id, max_date = asset_data
    
    coingecko_id_clean, bars, error = fetch_coingecko_market_chart(session, coingecko_id, days)
    
    if error == "rate_limit":
        return {"asset_id": asset_id, "symbol": symbol, "status": "rate_limit", "bars": 0}
    
    if error:
        return {"asset_id": asset_id, "symbol": symbol, "status": "error", "error": error, "bars": 0}
    
    if bars:
        if max_date:
            bars = filter_new_bars(bars, max_date)
        
        if bars:
            use_do_nothing = max_date is None
            inserted = insert_bars(asset_id, bars, "coingecko", use_do_nothing)
            return {"asset_id": asset_id, "symbol": symbol, "status": "success", "bars": inserted}
    
    return {"asset_id": asset_id, "symbol": symbol, "status": "no_data", "bars": 0}


# Thread-local storage for sessions
thread_local = threading.local()

def get_session():
    """Get or create a requests session for the current thread."""
    if not hasattr(thread_local, "session"):
        thread_local.session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(pool_connections=10, pool_maxsize=10)
        thread_local.session.mount("https://", adapter)
    return thread_local.session


def worker_process_equity(asset_data: tuple, target_date: str) -> dict:
    """Worker function that uses thread-local session."""
    session = get_session()
    return process_equity_asset(session, asset_data, target_date)


def worker_process_crypto(asset_data: tuple, days: int = 30) -> dict:
    """Worker function that uses thread-local session."""
    session = get_session()
    return process_crypto_asset(session, asset_data, days)


def backfill_equities_optimized(target_date: str, limit: int = None, offset: int = 0, workers: int = 10, chunk_size: int = 500):
    """
    Optimized equity backfill:
    - Only processes stale assets (pre-filtered by SQL)
    - Chunked submission to reduce memory overhead
    """
    print(f"\n=== Optimized Equity Backfill from AlphaVantage ===")
    print(f"Target date: {target_date}")
    print(f"Workers: {workers}, Rate limit: 70/min, Chunk size: {chunk_size}")
    
    # OPTIMIZATION #1: Single SQL query to get stale assets only
    print("Scanning for stale assets...")
    assets = get_equity_assets_with_max_date(target_date, limit, offset)
    total_assets = len(assets)
    print(f"Found {total_assets} STALE equity assets to process (skipping up-to-date assets)")
    
    if total_assets == 0:
        print("All assets are up to date!")
        return 0
    
    total_bars = 0
    success_count = 0
    error_count = 0
    rate_limit_count = 0
    processed = 0
    start_time = time.time()
    
    # OPTIMIZATION #4: Process in chunks
    for chunk_start in range(0, total_assets, chunk_size):
        chunk_end = min(chunk_start + chunk_size, total_assets)
        chunk = assets[chunk_start:chunk_end]
        chunk_num = (chunk_start // chunk_size) + 1
        total_chunks = (total_assets + chunk_size - 1) // chunk_size
        
        print(f"\n--- Chunk {chunk_num}/{total_chunks} (assets {chunk_start+1}-{chunk_end}) ---")
        
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_asset = {
                executor.submit(worker_process_equity, asset, target_date): asset 
                for asset in chunk
            }
            
            for future in as_completed(future_to_asset):
                asset = future_to_asset[future]
                processed += 1
                
                try:
                    result = future.result(timeout=120)
                    
                    if result["status"] == "success":
                        success_count += 1
                        total_bars += result["bars"]
                        outputsize = result.get("outputsize", "compact")
                        print(f"[{processed}/{total_assets}] {result['symbol']}: +{result['bars']} bars ({outputsize})")
                    elif result["status"] == "rate_limit":
                        rate_limit_count += 1
                        print(f"[{processed}/{total_assets}] {result['symbol']}: RATE LIMITED (exhausted retries)")
                    elif result["status"] == "error":
                        error_count += 1
                        if error_count <= 50:
                            print(f"[{processed}/{total_assets}] {result['symbol']}: ERROR - {result.get('error', 'unknown')[:50]}")
                    else:
                        print(f"[{processed}/{total_assets}] {result['symbol']}: no data")
                    
                except Exception as e:
                    error_count += 1
                    print(f"[{processed}/{total_assets}] {asset[1]}: EXCEPTION - {str(e)[:50]}")
        
        # Progress update after each chunk
        elapsed = time.time() - start_time
        rate = processed / elapsed * 60 if elapsed > 0 else 0
        eta = (total_assets - processed) / (processed / elapsed) if processed > 0 else 0
        print(f"\nProgress: {processed}/{total_assets} ({processed/total_assets*100:.1f}%)")
        print(f"Rate: {rate:.1f} assets/min, ETA: {eta/60:.1f} min")
        print(f"Success: {success_count}, Errors: {error_count}, Rate limits: {rate_limit_count}")
    
    elapsed = time.time() - start_time
    print(f"\n=== Equity backfill complete ===")
    print(f"  Time: {elapsed/60:.1f} minutes")
    print(f"  Total bars inserted: {total_bars}")
    print(f"  Success: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Rate limits: {rate_limit_count}")
    print(f"  Avg rate: {total_assets/elapsed*60:.1f} assets/min")
    
    return total_bars


def backfill_crypto_optimized(target_date: str, limit: int = None, offset: int = 0, workers: int = 5, days: int = 30):
    """Optimized crypto backfill - only processes stale assets."""
    print(f"\n=== Optimized Crypto Backfill from CoinGecko ===")
    print(f"Target date: {target_date}, Days: {days}")
    
    print("Scanning for stale crypto assets...")
    assets = get_crypto_assets_with_max_date(target_date, limit, offset)
    total_assets = len(assets)
    print(f"Found {total_assets} STALE crypto assets to process")
    
    if total_assets == 0:
        print("All crypto assets are up to date!")
        return 0
    
    total_bars = 0
    success_count = 0
    error_count = 0
    rate_limit_count = 0
    processed = 0
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_asset = {
            executor.submit(worker_process_crypto, asset, days): asset 
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
    print(f"  Errors: {error_count}")
    print(f"  Rate limits: {rate_limit_count}")
    
    return total_bars


def get_last_trading_day() -> str:
    """Get the last trading day (skip weekends)."""
    today = date.today()
    # If today is weekend, go back to Friday
    if today.weekday() == 5:  # Saturday
        today = today - timedelta(days=1)
    elif today.weekday() == 6:  # Sunday
        today = today - timedelta(days=2)
    return today.strftime("%Y-%m-%d")


def main():
    parser = argparse.ArgumentParser(description="Highly Optimized OHLCV Backfill")
    parser.add_argument("--type", choices=["equity", "crypto", "both"], default="both",
                       help="Type of assets to backfill")
    parser.add_argument("--target-date", type=str, default=None,
                       help="Target date to backfill to (default: last trading day)")
    parser.add_argument("--limit", type=int, default=None,
                       help="Limit number of assets to process")
    parser.add_argument("--offset", type=int, default=0,
                       help="Offset to start from (for resuming)")
    parser.add_argument("--workers", type=int, default=10,
                       help="Number of parallel workers")
    parser.add_argument("--chunk-size", type=int, default=500,
                       help="Chunk size for equity processing")
    parser.add_argument("--days", type=int, default=30,
                       help="Days of history for crypto (default 30)")
    
    args = parser.parse_args()
    
    # Determine target date
    target_date = args.target_date or get_last_trading_day()
    print(f"Target date: {target_date}")
    
    print("Initializing database connection pool...")
    init_db_pool(min_conn=2, max_conn=args.workers + 5)
    print("Connected!")
    
    try:
        if args.type in ["crypto", "both"]:
            backfill_crypto_optimized(target_date, args.limit, args.offset, min(args.workers, 5), args.days)
        
        if args.type in ["equity", "both"]:
            backfill_equities_optimized(target_date, args.limit, args.offset, args.workers, args.chunk_size)
    finally:
        if db_pool:
            db_pool.closeall()
    
    print("\nBackfill complete!")


if __name__ == "__main__":
    main()

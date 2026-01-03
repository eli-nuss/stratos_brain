#!/usr/bin/env python3
"""
Parallelized OHLCV Backfill Script for Stratos Brain
Fetches daily bars from CoinGecko (crypto) and AlphaVantage (equities) using concurrent workers
"""

import os
import sys
import time
import requests
import psycopg2
from psycopg2.extras import execute_values
from psycopg2 import pool
from datetime import datetime, timedelta
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import argparse

# API Keys
ALPHAVANTAGE_API_KEY = os.environ.get("ALPHAVANTAGE_API_KEY", "PLZVWIJQFOVHT4WL")
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "CG-k7Vqq9wSF98RuuRZX527bzvv")

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres?sslmode=require"
)

# Thread-safe counters
stats_lock = Lock()
stats = {
    "total_bars": 0,
    "success_count": 0,
    "error_count": 0,
    "rate_limit_count": 0,
}

# Connection pool
db_pool = None

def init_db_pool(min_conn=2, max_conn=10):
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

def fetch_alphavantage_daily(symbol: str) -> tuple:
    """Fetch daily OHLCV from AlphaVantage. Returns (symbol, bars, error)."""
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": symbol,
        "outputsize": "compact",
        "apikey": ALPHAVANTAGE_API_KEY,
        "datatype": "json"
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        if "Time Series (Daily)" not in data:
            if "Note" in data:
                return (symbol, None, "rate_limit")
            if "Error Message" in data:
                return (symbol, [], f"error: {data['Error Message'][:50]}")
            return (symbol, [], f"unexpected: {list(data.keys())}")
        
        bars = []
        for date_str, values in data["Time Series (Daily)"].items():
            bars.append({
                "date": date_str,
                "open": Decimal(values["1. open"]),
                "high": Decimal(values["2. high"]),
                "low": Decimal(values["3. low"]),
                "close": Decimal(values["4. close"]),
                "volume": Decimal(values["6. volume"]),
            })
        
        return (symbol, bars, None)
    except Exception as e:
        return (symbol, [], str(e))

def fetch_coingecko_market_chart(coingecko_id: str, days: int = 30) -> tuple:
    """Fetch market chart from CoinGecko Pro API. Returns (coingecko_id, bars, error)."""
    url = f"https://pro-api.coingecko.com/api/v3/coins/{coingecko_id}/market_chart"
    params = {
        "vs_currency": "usd",
        "days": days,
        "interval": "daily",
    }
    headers = {
        "x-cg-pro-api-key": COINGECKO_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=30)
        
        if response.status_code == 429:
            return (coingecko_id, None, "rate_limit")
        
        if response.status_code != 200:
            return (coingecko_id, [], f"http_{response.status_code}")
        
        data = response.json()
        
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
        return (coingecko_id, [], str(e))

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
            source = EXCLUDED.source
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

def process_crypto_asset(asset_data: tuple, days: int = 30) -> dict:
    """Process a single crypto asset. Returns result dict."""
    asset_id, symbol, coingecko_id = asset_data
    
    coingecko_id_clean, bars, error = fetch_coingecko_market_chart(coingecko_id, days)
    
    if error == "rate_limit":
        return {"asset_id": asset_id, "symbol": symbol, "status": "rate_limit", "bars": 0}
    
    if error:
        return {"asset_id": asset_id, "symbol": symbol, "status": "error", "error": error, "bars": 0}
    
    if bars:
        inserted = insert_bars(asset_id, bars, "coingecko")
        return {"asset_id": asset_id, "symbol": symbol, "status": "success", "bars": inserted}
    
    return {"asset_id": asset_id, "symbol": symbol, "status": "no_data", "bars": 0}

def process_equity_asset(asset_data: tuple) -> dict:
    """Process a single equity asset. Returns result dict."""
    asset_id, symbol = asset_data
    
    symbol_clean, bars, error = fetch_alphavantage_daily(symbol)
    
    if error == "rate_limit":
        return {"asset_id": asset_id, "symbol": symbol, "status": "rate_limit", "bars": 0}
    
    if error:
        return {"asset_id": asset_id, "symbol": symbol, "status": "error", "error": error, "bars": 0}
    
    if bars:
        inserted = insert_bars(asset_id, bars, "alphavantage")
        return {"asset_id": asset_id, "symbol": symbol, "status": "success", "bars": inserted}
    
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

def backfill_crypto_parallel(limit: int = None, offset: int = 0, workers: int = 5, delay: float = 0.5):
    """Backfill crypto OHLCV data using parallel workers."""
    print(f"\n=== Backfilling Crypto from CoinGecko (Parallel, {workers} workers) ===")
    
    assets = get_crypto_assets(limit, offset)
    print(f"Found {len(assets)} crypto assets to process")
    
    total_bars = 0
    success_count = 0
    error_count = 0
    rate_limit_count = 0
    
    # Process in batches with controlled concurrency
    with ThreadPoolExecutor(max_workers=workers) as executor:
        # Submit all tasks
        future_to_asset = {}
        for i, asset in enumerate(assets):
            # Add delay between submissions to avoid overwhelming API
            if i > 0 and i % workers == 0:
                time.sleep(delay * workers)
            
            future = executor.submit(process_crypto_asset, asset)
            future_to_asset[future] = asset
        
        # Process results as they complete
        for i, future in enumerate(as_completed(future_to_asset)):
            asset = future_to_asset[future]
            try:
                result = future.result()
                
                if result["status"] == "success":
                    success_count += 1
                    total_bars += result["bars"]
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: {result['bars']} bars")
                elif result["status"] == "rate_limit":
                    rate_limit_count += 1
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: RATE LIMITED")
                elif result["status"] == "error":
                    error_count += 1
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: ERROR - {result.get('error', 'unknown')}")
                else:
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: no data")
                    
            except Exception as e:
                error_count += 1
                print(f"[{i+1}/{len(assets)}] {asset[1]}: EXCEPTION - {e}")
    
    print(f"\nCrypto backfill complete:")
    print(f"  Total bars: {total_bars}")
    print(f"  Success: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Rate limits: {rate_limit_count}")
    
    return total_bars

def backfill_equities_parallel(limit: int = None, offset: int = 0, workers: int = 5, delay: float = 12.0):
    """
    Backfill equity OHLCV data using parallel workers.
    Note: AlphaVantage free tier is 5 calls/minute, so we use longer delays.
    """
    print(f"\n=== Backfilling Equities from AlphaVantage (Parallel, {workers} workers) ===")
    print(f"Note: AlphaVantage rate limit is 5 calls/min, using {delay}s delay")
    
    assets = get_equity_assets(limit, offset)
    print(f"Found {len(assets)} equity assets to process")
    
    total_bars = 0
    success_count = 0
    error_count = 0
    rate_limit_count = 0
    
    # For AlphaVantage, we need to be more careful with rate limits
    # Process sequentially with delays, but use thread pool for I/O
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = []
        
        for i, asset in enumerate(assets):
            # Submit task
            future = executor.submit(process_equity_asset, asset)
            futures.append((future, asset))
            
            # Wait between submissions to respect rate limit
            if i < len(assets) - 1:
                time.sleep(delay)
        
        # Collect results
        for i, (future, asset) in enumerate(futures):
            try:
                result = future.result(timeout=60)
                
                if result["status"] == "success":
                    success_count += 1
                    total_bars += result["bars"]
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: {result['bars']} bars")
                elif result["status"] == "rate_limit":
                    rate_limit_count += 1
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: RATE LIMITED")
                elif result["status"] == "error":
                    error_count += 1
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: ERROR - {result.get('error', 'unknown')}")
                else:
                    print(f"[{i+1}/{len(assets)}] {result['symbol']}: no data")
                    
            except Exception as e:
                error_count += 1
                print(f"[{i+1}/{len(assets)}] {asset[1]}: EXCEPTION - {e}")
    
    print(f"\nEquity backfill complete:")
    print(f"  Total bars: {total_bars}")
    print(f"  Success: {success_count}")
    print(f"  Errors: {error_count}")
    print(f"  Rate limits: {rate_limit_count}")
    
    return total_bars

def main():
    parser = argparse.ArgumentParser(description="Parallelized OHLCV Backfill")
    parser.add_argument("--type", choices=["equity", "crypto", "both"], default="both",
                       help="Type of assets to backfill")
    parser.add_argument("--limit", type=int, default=None,
                       help="Limit number of assets to process")
    parser.add_argument("--offset", type=int, default=0,
                       help="Offset to start from (for resuming)")
    parser.add_argument("--workers", type=int, default=5,
                       help="Number of parallel workers")
    parser.add_argument("--delay", type=float, default=None,
                       help="Delay between API calls (auto-set based on type if not specified)")
    
    args = parser.parse_args()
    
    print("Initializing database connection pool...")
    init_db_pool(min_conn=2, max_conn=args.workers + 2)
    print("Connected!")
    
    try:
        if args.type in ["crypto", "both"]:
            delay = args.delay if args.delay else 0.5  # CoinGecko Pro allows ~30 calls/min
            backfill_crypto_parallel(args.limit, args.offset, args.workers, delay)
        
        if args.type in ["equity", "both"]:
            delay = args.delay if args.delay else 12.0  # AlphaVantage free: 5 calls/min
            backfill_equities_parallel(args.limit, args.offset, args.workers, delay)
    finally:
        if db_pool:
            db_pool.closeall()
    
    print("\nBackfill complete!")

if __name__ == "__main__":
    main()

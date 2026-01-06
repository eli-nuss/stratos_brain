#!/usr/bin/env python3
"""
OHLCV Backfill Script for Stratos Brain
Fetches daily bars from CoinGecko (crypto) and AlphaVantage (equities)

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
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
from decimal import Decimal

# API Keys
ALPHAVANTAGE_API_KEY = os.environ.get("ALPHAVANTAGE_API_KEY", "PLZVWIJQFOVHT4WL")
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "CG-k7Vqq9wSF98RuuRZX527bzvv")

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres?sslmode=require"
)

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(DATABASE_URL)

def fetch_alphavantage_daily(symbol: str) -> list:
    """Fetch daily OHLCV from AlphaVantage."""
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": symbol,
        "outputsize": "compact",  # Last 100 days
        "apikey": ALPHAVANTAGE_API_KEY,
        "datatype": "json"
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        if "Time Series (Daily)" not in data:
            if "Note" in data:
                print(f"  Rate limit hit: {data['Note'][:50]}...")
                return None  # Rate limited
            if "Error Message" in data:
                print(f"  Error: {data['Error Message'][:50]}...")
                return []
            print(f"  Unexpected response: {list(data.keys())}")
            return []
        
        bars = []
        for date_str, values in data["Time Series (Daily)"].items():
            bars.append({
                "date": date_str,
                "open": Decimal(values["1. open"]),
                "high": Decimal(values["2. high"]),
                "low": Decimal(values["3. low"]),
                "close": Decimal(values["4. close"]),
                "volume": Decimal(values["6. volume"]),  # Adjusted volume
                "adjusted_close": Decimal(values["5. adjusted close"]),
            })
        
        return bars
    except Exception as e:
        print(f"  Error fetching {symbol}: {e}")
        return []

def fetch_coingecko_daily(coingecko_id: str, days: int = 30) -> list:
    """
    Fetch daily OHLCV from CoinGecko Pro API.
    
    WARNING: CoinGecko timestamps are at 00:00 UTC, which represents the CLOSE
    of the PREVIOUS day. When storing this data, subtract 1 day from the date.
    See module docstring for detailed explanation.
    """
    url = f"https://pro-api.coingecko.com/api/v3/coins/{coingecko_id}/ohlc"
    params = {
        "vs_currency": "usd",
        "days": days,
    }
    headers = {
        "x-cg-pro-api-key": COINGECKO_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=30)
        
        if response.status_code == 429:
            print(f"  Rate limit hit for {coingecko_id}")
            return None  # Rate limited
        
        if response.status_code != 200:
            print(f"  Error {response.status_code} for {coingecko_id}")
            return []
        
        data = response.json()
        
        # CoinGecko OHLC returns [timestamp, open, high, low, close]
        # Group by date and take the last entry for each date
        daily_data = {}
        for entry in data:
            ts = entry[0] / 1000  # Convert ms to seconds
            dt = datetime.utcfromtimestamp(ts)
            date_str = dt.strftime("%Y-%m-%d")
            
            daily_data[date_str] = {
                "date": date_str,
                "open": Decimal(str(entry[1])),
                "high": Decimal(str(entry[2])),
                "low": Decimal(str(entry[3])),
                "close": Decimal(str(entry[4])),
                "volume": Decimal("0"),  # OHLC endpoint doesn't include volume
            }
        
        return list(daily_data.values())
    except Exception as e:
        print(f"  Error fetching {coingecko_id}: {e}")
        return []

def fetch_coingecko_market_chart(coingecko_id: str, days: int = 30) -> list:
    """
    Fetch market chart data from CoinGecko Pro API (includes volume).
    
    WARNING: CoinGecko timestamps are at 00:00 UTC, which represents the CLOSE
    of the PREVIOUS day. When storing this data, subtract 1 day from the date.
    See module docstring for detailed explanation.
    """
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
            print(f"  Rate limit hit for {coingecko_id}")
            return None  # Rate limited
        
        if response.status_code != 200:
            print(f"  Error {response.status_code} for {coingecko_id}")
            return []
        
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
        
        return bars
    except Exception as e:
        print(f"  Error fetching {coingecko_id}: {e}")
        return []

def insert_bars(conn, asset_id: int, bars: list, source: str):
    """Insert bars into daily_bars table."""
    if not bars:
        return 0
    
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
            True,  # adjusted_flag
        ))
    
    with conn.cursor() as cur:
        execute_values(cur, query, values)
    conn.commit()
    
    return len(values)

def get_equity_assets(conn, limit: int = None) -> list:
    """Get equity assets to backfill."""
    query = """
    SELECT asset_id, symbol 
    FROM assets 
    WHERE asset_type = 'equity' AND is_active = true
    ORDER BY asset_id
    """
    if limit:
        query += f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

def get_crypto_assets(conn, limit: int = None) -> list:
    """Get crypto assets with coingecko_id to backfill."""
    query = """
    SELECT asset_id, symbol, coingecko_id 
    FROM assets 
    WHERE asset_type = 'crypto' AND is_active = true AND coingecko_id IS NOT NULL
    ORDER BY asset_id
    """
    if limit:
        query += f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query)
        return cur.fetchall()

def backfill_equities(conn, limit: int = None, start_from: int = 0):
    """Backfill equity OHLCV data from AlphaVantage."""
    print("\n=== Backfilling Equities from AlphaVantage ===")
    
    assets = get_equity_assets(conn, limit)
    print(f"Found {len(assets)} equity assets to process")
    
    total_bars = 0
    rate_limit_count = 0
    
    for i, (asset_id, symbol) in enumerate(assets):
        if i < start_from:
            continue
            
        print(f"[{i+1}/{len(assets)}] Fetching {symbol} (asset_id={asset_id})...")
        
        bars = fetch_alphavantage_daily(symbol)
        
        if bars is None:
            # Rate limited - wait and retry
            rate_limit_count += 1
            if rate_limit_count >= 3:
                print("Too many rate limits, stopping equity backfill")
                print(f"Resume from index {i} with --start-from {i}")
                break
            print("  Waiting 60s for rate limit...")
            time.sleep(60)
            bars = fetch_alphavantage_daily(symbol)
        
        if bars:
            inserted = insert_bars(conn, asset_id, bars, "alphavantage")
            total_bars += inserted
            print(f"  Inserted {inserted} bars")
        else:
            print(f"  No bars fetched")
        
        # AlphaVantage Premium: 75 calls/minute (use 1s delay to be safe)
        time.sleep(1)  # ~60 calls per minute
    
    print(f"\nEquity backfill complete: {total_bars} total bars inserted")
    return total_bars

def backfill_crypto(conn, limit: int = None, start_from: int = 0):
    """Backfill crypto OHLCV data from CoinGecko."""
    print("\n=== Backfilling Crypto from CoinGecko ===")
    
    assets = get_crypto_assets(conn, limit)
    print(f"Found {len(assets)} crypto assets to process")
    
    total_bars = 0
    rate_limit_count = 0
    
    for i, (asset_id, symbol, coingecko_id) in enumerate(assets):
        if i < start_from:
            continue
            
        print(f"[{i+1}/{len(assets)}] Fetching {symbol} ({coingecko_id})...")
        
        bars = fetch_coingecko_market_chart(coingecko_id, days=30)
        
        if bars is None:
            # Rate limited - wait and retry
            rate_limit_count += 1
            if rate_limit_count >= 3:
                print("Too many rate limits, stopping crypto backfill")
                print(f"Resume from index {i} with --start-from {i}")
                break
            print("  Waiting 60s for rate limit...")
            time.sleep(60)
            bars = fetch_coingecko_market_chart(coingecko_id, days=30)
        
        if bars:
            inserted = insert_bars(conn, asset_id, bars, "coingecko")
            total_bars += inserted
            print(f"  Inserted {inserted} bars")
        else:
            print(f"  No bars fetched")
        
        # CoinGecko demo: 10-30 calls/minute
        time.sleep(3)
    
    print(f"\nCrypto backfill complete: {total_bars} total bars inserted")
    return total_bars

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Backfill OHLCV data")
    parser.add_argument("--type", choices=["equity", "crypto", "both"], default="both",
                       help="Type of assets to backfill")
    parser.add_argument("--limit", type=int, default=None,
                       help="Limit number of assets to process")
    parser.add_argument("--start-from", type=int, default=0,
                       help="Start from asset index (for resuming)")
    
    args = parser.parse_args()
    
    print("Connecting to database...")
    conn = get_db_connection()
    print("Connected!")
    
    try:
        if args.type in ["crypto", "both"]:
            backfill_crypto(conn, args.limit, args.start_from)
        
        if args.type in ["equity", "both"]:
            backfill_equities(conn, args.limit, args.start_from)
    finally:
        conn.close()
    
    print("\nBackfill complete!")

if __name__ == "__main__":
    main()

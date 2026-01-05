#!/usr/bin/env python3
"""
Parallel OHLCV Update Script for Crypto Assets
Fetches daily OHLCV data from CoinGecko Pro API using parallel processing.
"""

import os
import sys
import asyncio
import aiohttp
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from decimal import Decimal
import argparse

# API Key
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "CG-k7Vqq9wSF98RuuRZX527bzvv")

# Database connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres?sslmode=require"
)

# Concurrency settings
MAX_CONCURRENT = 10  # CoinGecko Pro allows ~30 calls/min, we'll use 10 concurrent
RATE_LIMIT_DELAY = 0.5  # Delay between batches to respect rate limits


async def fetch_coingecko_ohlc(session: aiohttp.ClientSession, coingecko_id: str, days: int = 1) -> dict:
    """Fetch OHLC data from CoinGecko Pro API."""
    url = f"https://pro-api.coingecko.com/api/v3/coins/{coingecko_id}/ohlc"
    params = {
        "vs_currency": "usd",
        "days": days,
    }
    headers = {
        "x-cg-pro-api-key": COINGECKO_API_KEY
    }
    
    try:
        async with session.get(url, params=params, headers=headers, timeout=30) as response:
            if response.status == 429:
                return {"coingecko_id": coingecko_id, "error": "rate_limit", "data": None}
            
            if response.status != 200:
                return {"coingecko_id": coingecko_id, "error": f"http_{response.status}", "data": None}
            
            data = await response.json()
            return {"coingecko_id": coingecko_id, "error": None, "data": data}
    except Exception as e:
        return {"coingecko_id": coingecko_id, "error": str(e)[:80], "data": None}


async def fetch_coingecko_market_chart(session: aiohttp.ClientSession, coingecko_id: str, days: int = 1) -> dict:
    """Fetch market chart data from CoinGecko Pro API (includes volume)."""
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
        async with session.get(url, params=params, headers=headers, timeout=30) as response:
            if response.status == 429:
                return {"coingecko_id": coingecko_id, "error": "rate_limit", "data": None}
            
            if response.status != 200:
                return {"coingecko_id": coingecko_id, "error": f"http_{response.status}", "data": None}
            
            data = await response.json()
            return {"coingecko_id": coingecko_id, "error": None, "data": data}
    except Exception as e:
        return {"coingecko_id": coingecko_id, "error": str(e)[:80], "data": None}


def get_crypto_assets(conn) -> list:
    """Get all active crypto assets with coingecko_id."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT asset_id, symbol, coingecko_id 
            FROM assets 
            WHERE asset_type = 'crypto' 
              AND is_active = true 
              AND coingecko_id IS NOT NULL
            ORDER BY asset_id
        """)
        return cur.fetchall()


def parse_ohlc_data(ohlc_data: list, target_date: str) -> dict:
    """Parse OHLC data and extract the target date's values."""
    if not ohlc_data:
        return None
    
    # CoinGecko OHLC returns [timestamp, open, high, low, close]
    daily_data = {}
    for entry in ohlc_data:
        ts = entry[0] / 1000  # Convert ms to seconds
        dt = datetime.utcfromtimestamp(ts)
        date_str = dt.strftime("%Y-%m-%d")
        
        # Keep the latest entry for each date
        daily_data[date_str] = {
            "date": date_str,
            "open": Decimal(str(entry[1])),
            "high": Decimal(str(entry[2])),
            "low": Decimal(str(entry[3])),
            "close": Decimal(str(entry[4])),
        }
    
    return daily_data.get(target_date)


def parse_market_chart_data(market_data: dict, target_date: str) -> dict:
    """Parse market chart data and extract the target date's values."""
    if not market_data:
        return None
    
    prices = {}
    volumes = {}
    
    for p in market_data.get("prices", []):
        dt = datetime.utcfromtimestamp(p[0] / 1000)
        date_str = dt.strftime("%Y-%m-%d")
        prices[date_str] = p[1]
    
    for v in market_data.get("total_volumes", []):
        dt = datetime.utcfromtimestamp(v[0] / 1000)
        date_str = dt.strftime("%Y-%m-%d")
        volumes[date_str] = v[1]
    
    if target_date not in prices:
        return None
    
    price = prices[target_date]
    volume = volumes.get(target_date, 0)
    
    return {
        "date": target_date,
        "open": Decimal(str(price)),
        "high": Decimal(str(price)),
        "low": Decimal(str(price)),
        "close": Decimal(str(price)),
        "volume": Decimal(str(volume)),
    }


def insert_bars(conn, records: list) -> int:
    """Insert bars into daily_bars table."""
    if not records:
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
            True,
        ))
    
    with conn.cursor() as cur:
        execute_values(cur, query, values)
    conn.commit()
    
    return len(values)


async def process_batch(session: aiohttp.ClientSession, batch: list, target_date: str) -> list:
    """Process a batch of assets concurrently."""
    tasks = []
    for asset_id, symbol, coingecko_id in batch:
        # Use market_chart endpoint which includes volume
        task = fetch_coingecko_market_chart(session, coingecko_id, days=2)
        tasks.append((asset_id, symbol, coingecko_id, task))
    
    results = []
    for asset_id, symbol, coingecko_id, task in tasks:
        response = await task
        if response["error"]:
            results.append({
                "asset_id": asset_id,
                "symbol": symbol,
                "coingecko_id": coingecko_id,
                "error": response["error"],
                "data": None
            })
        else:
            bar_data = parse_market_chart_data(response["data"], target_date)
            if bar_data:
                bar_data["asset_id"] = asset_id
                results.append({
                    "asset_id": asset_id,
                    "symbol": symbol,
                    "coingecko_id": coingecko_id,
                    "error": None,
                    "data": bar_data
                })
            else:
                results.append({
                    "asset_id": asset_id,
                    "symbol": symbol,
                    "coingecko_id": coingecko_id,
                    "error": f"no_data_for_{target_date}",
                    "data": None
                })
    
    return results


async def main(target_date: str):
    """Main function to run the parallel OHLCV update."""
    print(f"Starting parallel OHLCV update for {target_date}")
    print(f"Concurrency: {MAX_CONCURRENT}")
    
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    
    # Get all crypto assets
    assets = get_crypto_assets(conn)
    print(f"Found {len(assets)} crypto assets to process")
    
    # Create batches
    batches = [assets[i:i + MAX_CONCURRENT] for i in range(0, len(assets), MAX_CONCURRENT)]
    print(f"Processing in {len(batches)} batches of up to {MAX_CONCURRENT} assets each")
    
    all_records = []
    errors = []
    
    async with aiohttp.ClientSession() as session:
        for i, batch in enumerate(batches):
            print(f"Processing batch {i + 1}/{len(batches)}...", end=" ", flush=True)
            
            # Process batch
            results = await process_batch(session, batch, target_date)
            
            # Collect results
            batch_records = []
            batch_errors = []
            for result in results:
                if result["error"]:
                    batch_errors.append(result)
                elif result["data"]:
                    batch_records.append(result["data"])
            
            all_records.extend(batch_records)
            errors.extend(batch_errors)
            
            print(f"OK ({len(batch_records)} records, {len(batch_errors)} errors)")
            
            # Rate limit delay between batches
            if i < len(batches) - 1:
                await asyncio.sleep(RATE_LIMIT_DELAY)
    
    # Insert all records
    print(f"\nInserting {len(all_records)} records into database...")
    inserted = insert_bars(conn, all_records)
    print(f"Inserted {inserted} records")
    
    # Report errors
    if errors:
        print(f"\nErrors ({len(errors)}):")
        for err in errors[:20]:  # Show first 20 errors
            print(f"  {err['symbol']} ({err['coingecko_id']}): {err['error']}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more errors")
    
    conn.close()
    
    print(f"\nComplete! Processed {len(assets)} assets, inserted {inserted} records, {len(errors)} errors")
    return inserted, len(errors)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parallel OHLCV Update for Crypto Assets")
    parser.add_argument("--date", type=str, default=datetime.utcnow().strftime("%Y-%m-%d"),
                       help="Target date for OHLCV data (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    asyncio.run(main(args.date))

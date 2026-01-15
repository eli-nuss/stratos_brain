#!/usr/bin/env python3
"""
Ingest 4 years of historical OHLCV data for global equities from FMP.
Includes USD conversion using daily forex rates.
"""

import os
import sys
import json
import time
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
from typing import Dict, List, Optional

FMP_API_KEY = os.environ.get("FMP_API_KEY", "DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"
)

# 4 years of data
DAYS_OF_HISTORY = 365 * 4

# Forex rate cache
fx_cache: Dict[str, Dict[str, float]] = {}

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def fetch_historical_bars(symbol: str, days: int = DAYS_OF_HISTORY) -> List[Dict]:
    """Fetch historical OHLCV data from FMP."""
    url = f"{FMP_BASE_URL}/historical-price-eod/full"
    params = {"symbol": symbol, "apikey": FMP_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=60)
        if response.status_code == 200:
            data = response.json()
            # Filter to last N days
            cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            return [bar for bar in data if bar.get("date", "") >= cutoff_date]
        else:
            print(f"  Error fetching {symbol}: HTTP {response.status_code}")
            return []
    except Exception as e:
        print(f"  Error fetching {symbol}: {e}")
        return []

def fetch_forex_rates(currency: str) -> Dict[str, float]:
    """Fetch historical forex rates for a currency to USD."""
    if currency == "USD":
        return {}
    
    if currency in fx_cache:
        return fx_cache[currency]
    
    pair = f"{currency}USD"
    url = f"{FMP_BASE_URL}/historical-price-eod/full"
    params = {"symbol": pair, "apikey": FMP_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=60)
        if response.status_code == 200:
            data = response.json()
            rates = {bar["date"]: bar["close"] for bar in data}
            fx_cache[currency] = rates
            return rates
        else:
            print(f"  Warning: Could not fetch {pair} rates")
            return {}
    except Exception as e:
        print(f"  Error fetching {pair}: {e}")
        return {}

def get_fx_rate(currency: str, date: str, rates: Dict[str, float]) -> Optional[float]:
    """Get forex rate for a specific date, with fallback to nearest previous date."""
    if currency == "USD":
        return 1.0
    
    if date in rates:
        return rates[date]
    
    # Find nearest previous date
    sorted_dates = sorted([d for d in rates.keys() if d <= date], reverse=True)
    if sorted_dates:
        return rates[sorted_dates[0]]
    
    return None

def store_fx_rates(conn, currency: str, rates: Dict[str, float]):
    """Store forex rates in the database."""
    if not rates:
        return 0
    
    records = [(date, currency, "USD", rate, "fmp") for date, rate in rates.items()]
    
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO fx_rates (rate_date, from_currency, to_currency, rate, source)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (rate_date, from_currency, to_currency) 
            DO UPDATE SET rate = EXCLUDED.rate
        """, records)
    
    conn.commit()
    return len(records)

def ingest_asset_bars(conn, asset_id: int, symbol: str, currency: str, bars: List[Dict], fx_rates: Dict[str, float]) -> int:
    """Ingest bars for a single asset."""
    if not bars:
        return 0
    
    records = []
    for bar in bars:
        date = bar.get("date")
        close = bar.get("close")
        volume = bar.get("volume", 0)
        
        # Calculate USD values
        fx_rate = get_fx_rate(currency, date, fx_rates)
        close_usd = close * fx_rate if fx_rate else None
        volume_usd = volume * close_usd if close_usd and volume else None
        
        records.append((
            asset_id,
            date,
            bar.get("open"),
            bar.get("high"),
            bar.get("low"),
            close,
            volume,
            close_usd,
            volume_usd,
            "fmp"
        ))
    
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, close_usd, volume_usd, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (asset_id, date) 
            DO UPDATE SET 
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume,
                close_usd = EXCLUDED.close_usd,
                volume_usd = EXCLUDED.volume_usd,
                source = EXCLUDED.source
        """, records)
    
    conn.commit()
    return len(records)

def main():
    print("=" * 60)
    print("Global Equity Historical Data Ingestion")
    print(f"Loading {DAYS_OF_HISTORY // 365} years of data")
    print("=" * 60)
    
    conn = get_db_connection()
    
    # Get all global equity assets
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT asset_id, symbol, name, currency, fmp_symbol
            FROM assets
            WHERE asset_type = 'global_equity'
              AND is_active = true
              AND data_vendor = 'fmp'
            ORDER BY asset_id
        """)
        assets = cur.fetchall()
    
    print(f"\nFound {len(assets)} global equity assets to process")
    
    # First, fetch and store all needed forex rates
    currencies_needed = set(a["currency"] for a in assets if a["currency"] != "USD")
    print(f"\nFetching forex rates for: {', '.join(currencies_needed)}")
    
    for currency in currencies_needed:
        print(f"  Fetching {currency}/USD rates...")
        rates = fetch_forex_rates(currency)
        if rates:
            stored = store_fx_rates(conn, currency, rates)
            print(f"    Stored {stored} rates")
        time.sleep(0.3)
    
    # Now process each asset
    print("\nIngesting historical bars...")
    total_bars = 0
    success_count = 0
    
    for i, asset in enumerate(assets):
        asset_id = asset["asset_id"]
        symbol = asset["fmp_symbol"] or asset["symbol"]
        name = asset["name"][:40]
        currency = asset["currency"]
        
        print(f"\n[{i+1}/{len(assets)}] {symbol}: {name}")
        
        # Fetch bars
        bars = fetch_historical_bars(symbol)
        
        if bars:
            # Get forex rates for this currency
            fx_rates = fx_cache.get(currency, {}) if currency != "USD" else {}
            
            # Ingest bars
            count = ingest_asset_bars(conn, asset_id, symbol, currency, bars, fx_rates)
            total_bars += count
            success_count += 1
            
            # Show date range
            dates = [b["date"] for b in bars]
            print(f"  ✓ Loaded {count} bars ({min(dates)} to {max(dates)})")
        else:
            print(f"  ✗ No data available")
        
        # Rate limiting
        time.sleep(0.3)
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("Ingestion Complete")
    print("=" * 60)
    print(f"Assets processed: {success_count}/{len(assets)}")
    print(f"Total bars ingested: {total_bars:,}")
    print(f"Forex currencies loaded: {len(currencies_needed)}")

if __name__ == "__main__":
    main()

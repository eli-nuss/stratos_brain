#!/usr/bin/env python3
"""
Ingest 4 years of historical OHLCV data for ETFs and indices from FMP.
"""

import time
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta

FMP_API_KEY = "DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe"
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# 4 years ago
START_DATE = (datetime.now() - timedelta(days=4*365)).strftime("%Y-%m-%d")


def fetch_historical_data(symbol: str) -> list:
    """Fetch historical OHLCV data from FMP."""
    url = "https://financialmodelingprep.com/stable/historical-price-eod/full"
    params = {
        "symbol": symbol,
        "from": START_DATE,
        "apikey": FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"    Error fetching {symbol}: {e}")
    
    return []


def ingest_etfs(conn):
    """Ingest historical data for all ETFs."""
    cur = conn.cursor()
    
    # Get all ETFs
    cur.execute("SELECT etf_id, symbol FROM etf_assets WHERE is_active = true ORDER BY etf_id")
    etfs = cur.fetchall()
    
    print(f"\nIngesting data for {len(etfs)} ETFs...")
    
    total_bars = 0
    for i, (etf_id, symbol) in enumerate(etfs):
        data = fetch_historical_data(symbol)
        
        if not data:
            print(f"  [{i+1}/{len(etfs)}] {symbol}: No data")
            continue
        
        # Prepare values
        values = [
            (
                etf_id,
                bar["date"],
                bar.get("open"),
                bar.get("high"),
                bar.get("low"),
                bar.get("close"),
                bar.get("volume"),
                "fmp"
            )
            for bar in data
            if bar.get("date")
        ]
        
        if values:
            query = """
                INSERT INTO etf_daily_bars (etf_id, date, open, high, low, close, volume, source)
                VALUES %s
                ON CONFLICT (etf_id, date) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume
            """
            execute_values(cur, query, values)
            conn.commit()
            total_bars += len(values)
            print(f"  [{i+1}/{len(etfs)}] {symbol}: {len(values)} bars")
        
        time.sleep(0.15)  # Rate limiting
    
    cur.close()
    return total_bars


def ingest_indices(conn):
    """Ingest historical data for all indices."""
    cur = conn.cursor()
    
    # Get all indices
    cur.execute("SELECT index_id, symbol FROM market_indices WHERE is_active = true ORDER BY index_id")
    indices = cur.fetchall()
    
    print(f"\nIngesting data for {len(indices)} indices...")
    
    total_bars = 0
    for i, (index_id, symbol) in enumerate(indices):
        data = fetch_historical_data(symbol)
        
        if not data:
            print(f"  [{i+1}/{len(indices)}] {symbol}: No data")
            continue
        
        # Prepare values
        values = [
            (
                index_id,
                bar["date"],
                bar.get("open"),
                bar.get("high"),
                bar.get("low"),
                bar.get("close"),
                bar.get("volume"),
                "fmp"
            )
            for bar in data
            if bar.get("date")
        ]
        
        if values:
            query = """
                INSERT INTO index_daily_bars (index_id, date, open, high, low, close, volume, source)
                VALUES %s
                ON CONFLICT (index_id, date) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume
            """
            execute_values(cur, query, values)
            conn.commit()
            total_bars += len(values)
            print(f"  [{i+1}/{len(indices)}] {symbol}: {len(values)} bars")
        
        time.sleep(0.15)  # Rate limiting
    
    cur.close()
    return total_bars


def main():
    print("=" * 60)
    print("Ingesting ETF and Index Historical Data")
    print(f"Date range: {START_DATE} to today")
    print("=" * 60)
    
    conn = psycopg2.connect(DB_URL)
    
    # Ingest ETFs
    etf_bars = ingest_etfs(conn)
    
    # Ingest Indices
    index_bars = ingest_indices(conn)
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"ETF bars ingested: {etf_bars:,}")
    print(f"Index bars ingested: {index_bars:,}")
    print(f"Total bars: {etf_bars + index_bars:,}")
    
    # Verify in database
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM etf_daily_bars")
    etf_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM index_daily_bars")
    index_count = cur.fetchone()[0]
    cur.close()
    
    print(f"\nDatabase totals:")
    print(f"  etf_daily_bars: {etf_count:,}")
    print(f"  index_daily_bars: {index_count:,}")
    
    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()

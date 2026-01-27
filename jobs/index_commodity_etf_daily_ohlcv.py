#!/usr/bin/env python3
"""
Index, Commodity, and ETF Daily OHLCV Ingestion Job
====================================================
Fetches daily OHLCV bars from FMP API for all active indices, commodities, and ETFs.
Designed to run as a GitHub Actions scheduled workflow.

This script fetches data for assets in the assets table with asset_type in 
('index', 'commodity', 'etf') and writes to the daily_bars table.

Usage:
    python -m jobs.index_commodity_etf_daily_ohlcv [--date YYYY-MM-DD] [--limit N] [--asset-type TYPE]
    
    --date: The date to fetch/store data for (default: today)
    --limit: Limit number of assets (for testing)
    --asset-type: Filter by asset type (index, commodity, etf, or all)

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
    FMP_API_KEY: Financial Modeling Prep API key
"""

import os
import sys
import argparse
import logging
import time
from datetime import datetime, timedelta
from typing import Optional, List, Tuple

import requests
import psycopg2
from psycopg2.extras import execute_values

# Configuration
FMP_API_KEY = os.environ.get('FMP_API_KEY')
DATABASE_URL = os.environ.get('DATABASE_URL')

# FMP API settings
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
RATE_LIMIT_DELAY = 0.2  # 200ms between requests (300 req/min limit)
REQUEST_TIMEOUT = 30

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


def get_db_connection():
    """Create database connection."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(DATABASE_URL)


def get_assets(conn, asset_types: List[str], limit: Optional[int] = None) -> List[Tuple]:
    """
    Get all active assets of specified types.
    Returns: List of (asset_id, symbol, fmp_symbol, asset_type) tuples
    """
    query = """
        SELECT asset_id, symbol, COALESCE(fmp_symbol, symbol) as fmp_symbol, asset_type
        FROM assets 
        WHERE asset_type = ANY(%s)
          AND is_active = true
        ORDER BY asset_type, asset_id
    """
    if limit:
        query = query.rstrip() + f" LIMIT {limit}"
    
    with conn.cursor() as cur:
        cur.execute(query, (asset_types,))
        return cur.fetchall()


def fetch_daily_bar(symbol: str, target_date: str) -> Optional[dict]:
    """
    Fetch daily OHLCV data from FMP for a single symbol.
    Uses the historical-price-eod endpoint for specific date.
    """
    if not FMP_API_KEY:
        raise ValueError("FMP_API_KEY environment variable not set")
    
    url = f"{FMP_BASE_URL}/historical-price-eod/full"
    params = {
        "symbol": symbol,
        "from": target_date,
        "to": target_date,
        "apikey": FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        
        if isinstance(data, list) and len(data) > 0:
            return data[0]
        return None
        
    except requests.exceptions.RequestException as e:
        logger.warning(f"Error fetching {symbol}: {e}")
        return None


def upsert_daily_bars(conn, bars: List[Tuple]) -> int:
    """
    Upsert daily bars to database.
    bars: List of (asset_id, date, open, high, low, close, volume, source) tuples
    """
    if not bars:
        return 0
    
    query = """
        INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, source)
        VALUES %s
        ON CONFLICT (asset_id, date) DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            volume = EXCLUDED.volume,
            source = EXCLUDED.source
    """
    
    with conn.cursor() as cur:
        execute_values(cur, query, bars)
    conn.commit()
    
    return len(bars)


def main():
    parser = argparse.ArgumentParser(description='Fetch daily OHLCV for indices, commodities, and ETFs')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD), default: today')
    parser.add_argument('--limit', type=int, help='Limit number of assets (for testing)')
    parser.add_argument('--asset-type', type=str, default='all', 
                        choices=['index', 'commodity', 'etf', 'all'],
                        help='Asset type to process')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = datetime.utcnow().strftime('%Y-%m-%d')
    
    # Determine asset types
    if args.asset_type == 'all':
        asset_types = ['index', 'commodity', 'etf']
    else:
        asset_types = [args.asset_type]
    
    logger.info("=" * 60)
    logger.info("Index/Commodity/ETF Daily OHLCV Ingestion")
    logger.info(f"Target date: {target_date}")
    logger.info(f"Asset types: {asset_types}")
    logger.info("=" * 60)
    
    conn = get_db_connection()
    
    try:
        # Get assets to process
        assets = get_assets(conn, asset_types, args.limit)
        logger.info(f"Found {len(assets)} assets to process")
        
        # Fetch and store data
        bars_to_insert = []
        success_count = 0
        error_count = 0
        
        for i, (asset_id, symbol, fmp_symbol, asset_type) in enumerate(assets):
            # Fetch data
            bar = fetch_daily_bar(fmp_symbol, target_date)
            
            if bar and bar.get('date') == target_date:
                bars_to_insert.append((
                    asset_id,
                    bar['date'],
                    bar.get('open'),
                    bar.get('high'),
                    bar.get('low'),
                    bar.get('close'),
                    bar.get('volume'),
                    'fmp'
                ))
                success_count += 1
                
                if (i + 1) % 20 == 0:
                    logger.info(f"Progress: {i + 1}/{len(assets)} ({success_count} success, {error_count} errors)")
            else:
                error_count += 1
                if bar:
                    logger.debug(f"{symbol}: No data for {target_date} (got {bar.get('date')})")
                else:
                    logger.debug(f"{symbol}: No data returned")
            
            # Rate limiting
            time.sleep(RATE_LIMIT_DELAY)
            
            # Batch insert every 50 records
            if len(bars_to_insert) >= 50:
                upsert_daily_bars(conn, bars_to_insert)
                bars_to_insert = []
        
        # Insert remaining bars
        if bars_to_insert:
            upsert_daily_bars(conn, bars_to_insert)
        
        # Summary
        logger.info("=" * 60)
        logger.info("Summary")
        logger.info("=" * 60)
        logger.info(f"Total assets processed: {len(assets)}")
        logger.info(f"Successful: {success_count}")
        logger.info(f"Errors/No data: {error_count}")
        
        # Verify in database
        with conn.cursor() as cur:
            for at in asset_types:
                cur.execute("""
                    SELECT COUNT(*) FROM daily_bars db
                    JOIN assets a ON db.asset_id = a.asset_id
                    WHERE a.asset_type = %s AND db.date = %s
                """, (at, target_date))
                count = cur.fetchone()[0]
                logger.info(f"  {at} bars for {target_date}: {count}")
        
    finally:
        conn.close()
    
    logger.info("Done!")


if __name__ == "__main__":
    main()

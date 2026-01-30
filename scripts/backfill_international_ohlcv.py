#!/usr/bin/env python3
"""
Backfill OHLCV data for international stocks from FMP API.
Fetches 4 years of daily data for stocks with exchange suffixes.
"""

import os
import sys
import time
import logging
import requests
import psycopg2
from datetime import datetime, timedelta
from psycopg2.extras import execute_values

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/backfill_ohlcv.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe')
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres')

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(DATABASE_URL)

def get_international_stocks(conn):
    """Get list of international stocks (with exchange suffix) that need OHLCV data."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT a.asset_id, a.symbol, a.name
            FROM assets a
            WHERE a.asset_type = 'equity' 
            AND a.symbol LIKE '%.%'
            ORDER BY a.symbol
        """)
        return cur.fetchall()

def fetch_ohlcv_from_fmp(symbol: str, years: int = 4) -> list:
    """Fetch historical OHLCV data from FMP API."""
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=years * 365)
        
        url = f"https://financialmodelingprep.com/stable/historical-price-eod/full?symbol={symbol}&apikey={FMP_API_KEY}"
        
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # FMP returns a list directly for this endpoint
        if not data or not isinstance(data, list):
            logger.warning(f"No data returned for {symbol}")
            return []
        
        # Filter to last 4 years
        historical = data
        filtered = []
        for bar in historical:
            bar_date = datetime.strptime(bar['date'], '%Y-%m-%d')
            if bar_date >= start_date:
                filtered.append(bar)
        
        return filtered
        
    except Exception as e:
        logger.error(f"Error fetching OHLCV for {symbol}: {e}")
        return []

def save_ohlcv_data(conn, asset_id: int, symbol: str, bars: list):
    """Save OHLCV data to daily_bars table."""
    if not bars:
        return 0
    
    try:
        with conn.cursor() as cur:
            # Prepare data for insertion
            values = []
            for bar in bars:
                values.append((
                    asset_id,
                    bar['date'],
                    float(bar.get('open', 0)),
                    float(bar.get('high', 0)),
                    float(bar.get('low', 0)),
                    float(bar.get('close', 0)),
                    int(bar.get('volume', 0)),
                    'fmp'  # source
                ))
            
            # Insert with ON CONFLICT DO UPDATE
            execute_values(
                cur,
                """
                INSERT INTO daily_bars (asset_id, date, open, high, low, close, volume, source)
                VALUES %s
                ON CONFLICT (asset_id, date) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume
                """,
                values
            )
            
            conn.commit()
            return len(values)
            
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving OHLCV for {symbol}: {e}")
        return 0

def main():
    """Main function to backfill OHLCV data."""
    logger.info("Starting OHLCV backfill for international stocks")
    
    conn = get_db_connection()
    
    try:
        # Get list of international stocks
        stocks = get_international_stocks(conn)
        logger.info(f"Found {len(stocks)} international stocks to process")
        
        total_bars = 0
        success_count = 0
        error_count = 0
        
        for i, (asset_id, symbol, name) in enumerate(stocks):
            logger.info(f"Processing {i+1}/{len(stocks)}: {symbol} ({name})")
            
            # Fetch OHLCV data
            bars = fetch_ohlcv_from_fmp(symbol)
            
            if bars:
                # Save to database
                saved = save_ohlcv_data(conn, asset_id, symbol, bars)
                total_bars += saved
                success_count += 1
                logger.info(f"  Saved {saved} bars for {symbol}")
            else:
                error_count += 1
                logger.warning(f"  No data for {symbol}")
            
            # Rate limiting
            time.sleep(0.2)
        
        logger.info(f"\n{'='*50}")
        logger.info(f"OHLCV Backfill Complete!")
        logger.info(f"  Stocks processed: {len(stocks)}")
        logger.info(f"  Successful: {success_count}")
        logger.info(f"  Errors: {error_count}")
        logger.info(f"  Total bars saved: {total_bars}")
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()

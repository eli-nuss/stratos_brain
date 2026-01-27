#!/usr/bin/env python3
"""
FX Rates Daily Ingestion Job
============================
Fetches daily foreign exchange rates from FMP API and stores in fx_rates table.

Usage:
    python -m jobs.fx_rates_daily [--date YYYY-MM-DD]
    
Environment Variables:
    DATABASE_URL: PostgreSQL connection string
    FMP_API_KEY: Financial Modeling Prep API key
"""

import os
import sys
import argparse
import logging
from datetime import datetime
from typing import Optional, List, Dict

import requests
import psycopg2
from psycopg2.extras import execute_values

# Configuration
FMP_API_KEY = os.environ.get('FMP_API_KEY')
DATABASE_URL = os.environ.get('DATABASE_URL')

# FMP API settings
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
REQUEST_TIMEOUT = 30

# Major currency pairs to track
CURRENCY_PAIRS = [
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
    "EURGBP", "EURJPY", "GBPJPY", "USDCNY", "USDHKD", "USDSGD", "USDINR",
    "USDBRL", "USDMXN", "USDZAR", "USDKRW", "USDTRY", "USDRUB"
]

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


def fetch_fx_rates() -> List[Dict]:
    """Fetch current FX rates from FMP API."""
    if not FMP_API_KEY:
        raise ValueError("FMP_API_KEY environment variable not set")
    
    url = f"{FMP_BASE_URL}/fx"
    params = {"apikey": FMP_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching FX rates: {e}")
        return []


def upsert_fx_rates(conn, rates: List[tuple]) -> int:
    """Upsert FX rates to database."""
    if not rates:
        return 0
    
    query = """
        INSERT INTO fx_rates (pair, rate_date, bid, ask, open, high, low, close, change_pct)
        VALUES %s
        ON CONFLICT (pair, rate_date) DO UPDATE SET
            bid = EXCLUDED.bid,
            ask = EXCLUDED.ask,
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            change_pct = EXCLUDED.change_pct
    """
    
    with conn.cursor() as cur:
        execute_values(cur, query, rates)
    conn.commit()
    
    return len(rates)


def main():
    parser = argparse.ArgumentParser(description='Fetch daily FX rates')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD), default: today')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = datetime.utcnow().strftime('%Y-%m-%d')
    
    logger.info("=" * 60)
    logger.info("FX Rates Daily Ingestion")
    logger.info(f"Target date: {target_date}")
    logger.info("=" * 60)
    
    conn = get_db_connection()
    
    try:
        # Fetch FX rates
        logger.info("Fetching FX rates from FMP...")
        fx_data = fetch_fx_rates()
        
        if not fx_data:
            logger.error("No FX data returned from API")
            sys.exit(1)
        
        logger.info(f"Received {len(fx_data)} currency pairs")
        
        # Filter to our tracked pairs and prepare for insert
        rates_to_insert = []
        for fx in fx_data:
            ticker = fx.get('ticker', '')
            # Remove the slash if present (e.g., "EUR/USD" -> "EURUSD")
            pair = ticker.replace('/', '')
            
            if pair in CURRENCY_PAIRS:
                rates_to_insert.append((
                    pair,
                    target_date,
                    fx.get('bid'),
                    fx.get('ask'),
                    fx.get('open'),
                    fx.get('high'),
                    fx.get('low'),
                    fx.get('close') or fx.get('price'),
                    fx.get('changes')
                ))
        
        logger.info(f"Inserting {len(rates_to_insert)} tracked currency pairs")
        
        # Insert rates
        inserted = upsert_fx_rates(conn, rates_to_insert)
        
        # Summary
        logger.info("=" * 60)
        logger.info("Summary")
        logger.info("=" * 60)
        logger.info(f"FX rates inserted/updated: {inserted}")
        
        # Verify
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM fx_rates WHERE rate_date = %s", (target_date,))
            count = cur.fetchone()[0]
            logger.info(f"Total FX rates for {target_date}: {count}")
        
    finally:
        conn.close()
    
    logger.info("Done!")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Build ISIN/CUSIP lookup table from FMP profiles for existing equity symbols.
Then use it to link ETF holdings to assets.
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
import psycopg2
from concurrent.futures import ThreadPoolExecutor, as_completed

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# API Keys
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe')
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres')

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(DATABASE_URL)

def get_equity_symbols(conn):
    """Get all equity symbols from the database."""
    cur = conn.cursor()
    cur.execute("SELECT asset_id, symbol FROM assets WHERE asset_type = 'equity' ORDER BY symbol")
    return cur.fetchall()

def get_profile_batch(symbols):
    """Get profiles for a batch of symbols (max ~100 at a time)."""
    symbol_str = ','.join(symbols)
    try:
        url = f"https://financialmodelingprep.com/stable/profile?symbol={symbol_str}&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=30)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"Error fetching batch: {e}")
    return []

def get_single_profile(symbol):
    """Get profile for a single symbol."""
    try:
        url = f"https://financialmodelingprep.com/stable/profile?symbol={symbol}&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0]
    except Exception as e:
        logger.debug(f"Error fetching {symbol}: {e}")
    return None

def build_lookup_table(conn, batch_size=1, delay=0.15):
    """Build ISIN/CUSIP lookup table from FMP profiles."""
    equities = get_equity_symbols(conn)
    logger.info(f"Found {len(equities)} equity symbols")
    
    isin_lookup = {}  # ISIN -> (asset_id, symbol)
    cusip_lookup = {}  # CUSIP -> (asset_id, symbol)
    
    # Process one at a time due to FMP API limitations
    for i, (asset_id, symbol) in enumerate(equities):
        if i % 100 == 0:
            logger.info(f"Processing {i}/{len(equities)}...")
        
        profile = get_single_profile(symbol)
        if profile:
            isin = profile.get('isin')
            cusip = profile.get('cusip')
            
            if isin:
                isin_lookup[isin] = (asset_id, symbol)
            if cusip:
                cusip_lookup[cusip] = (asset_id, symbol)
        
        time.sleep(delay)
    
    return isin_lookup, cusip_lookup

def link_holdings(conn, isin_lookup, cusip_lookup):
    """Link ETF holdings to assets using ISIN/CUSIP lookup."""
    cur = conn.cursor()
    
    # Get unlinked holdings
    cur.execute("""
        SELECT id, isin, cusip, holding_name
        FROM etf_holdings
        WHERE asset_id IS NULL
          AND (isin IS NOT NULL OR cusip IS NOT NULL)
    """)
    unlinked = cur.fetchall()
    logger.info(f"Found {len(unlinked)} unlinked holdings with ISIN/CUSIP")
    
    linked = 0
    for holding_id, isin, cusip, holding_name in unlinked:
        asset_id = None
        
        # Try ISIN first
        if isin and isin in isin_lookup:
            asset_id = isin_lookup[isin][0]
        # Then try CUSIP
        elif cusip and cusip in cusip_lookup:
            asset_id = cusip_lookup[cusip][0]
        
        if asset_id:
            cur.execute("""
                UPDATE etf_holdings SET asset_id = %s, updated_at = NOW()
                WHERE id = %s
            """, (asset_id, holding_id))
            linked += 1
    
    conn.commit()
    logger.info(f"Linked {linked} holdings")
    return linked

def main():
    parser = argparse.ArgumentParser(description='Build ISIN/CUSIP lookup and link ETF holdings')
    parser.add_argument('--build', action='store_true', help='Build lookup table from FMP')
    parser.add_argument('--link', action='store_true', help='Link holdings using existing lookup')
    parser.add_argument('--lookup-file', default='/tmp/isin_cusip_lookup.json', help='Lookup file path')
    parser.add_argument('--delay', type=float, default=0.15, help='Delay between API calls')
    parser.add_argument('--limit', type=int, default=None, help='Limit symbols to process')
    args = parser.parse_args()
    
    conn = get_db_connection()
    
    if args.build:
        logger.info("Building ISIN/CUSIP lookup table...")
        isin_lookup, cusip_lookup = build_lookup_table(conn, delay=args.delay)
        
        # Save to file
        with open(args.lookup_file, 'w') as f:
            json.dump({
                'isin': {k: list(v) for k, v in isin_lookup.items()},
                'cusip': {k: list(v) for k, v in cusip_lookup.items()}
            }, f)
        
        logger.info(f"Saved lookup table: {len(isin_lookup)} ISINs, {len(cusip_lookup)} CUSIPs")
    
    if args.link:
        # Load lookup table
        if os.path.exists(args.lookup_file):
            with open(args.lookup_file, 'r') as f:
                data = json.load(f)
                isin_lookup = {k: tuple(v) for k, v in data['isin'].items()}
                cusip_lookup = {k: tuple(v) for k, v in data['cusip'].items()}
            
            logger.info(f"Loaded lookup table: {len(isin_lookup)} ISINs, {len(cusip_lookup)} CUSIPs")
            link_holdings(conn, isin_lookup, cusip_lookup)
        else:
            logger.error(f"Lookup file not found: {args.lookup_file}")
    
    conn.close()

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Add missing ETF holdings to the assets table.
Uses FMP API to look up stock symbols from CUSIP/ISIN.
"""

import os
import sys
import time
import logging
import argparse
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

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

def get_unlinked_us_holdings(conn):
    """Get unlinked US stock holdings from ETF holdings."""
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT 
            holding_name,
            isin,
            cusip
        FROM etf_holdings
        WHERE asset_id IS NULL
          AND isin LIKE 'US%%'
          AND holding_name IS NOT NULL 
          AND holding_name != ''
          AND holding_name NOT LIKE '%%SECURED%%'
          AND holding_name NOT LIKE '%%BOND%%'
          AND holding_name NOT LIKE '%%NOTE%%'
          AND holding_name NOT LIKE '%%TREASURY%%'
          AND holding_name NOT LIKE '%%GUAR%%'
          AND holding_name NOT LIKE '%%SR %%'
          AND holding_name NOT LIKE '%%/%%'
          AND holding_name NOT LIKE '%%BILL%%'
          AND holding_name NOT LIKE '%%FRN%%'
        ORDER BY holding_name
    """)
    return cur.fetchall()

def lookup_symbol_by_cusip(cusip):
    """Look up stock symbol by CUSIP using FMP API."""
    if not cusip:
        return None
    
    try:
        url = f"https://financialmodelingprep.com/api/v3/cusip/{cusip}?apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0].get('symbol')
    except Exception as e:
        logger.debug(f"Error looking up CUSIP {cusip}: {e}")
    return None

def lookup_symbol_by_isin(isin):
    """Look up stock symbol by ISIN using FMP API."""
    if not isin:
        return None
    
    try:
        url = f"https://financialmodelingprep.com/api/v3/search/isin?isin={isin}&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0].get('symbol')
    except Exception as e:
        logger.debug(f"Error looking up ISIN {isin}: {e}")
    return None

def get_stock_profile(symbol):
    """Get stock profile from FMP API."""
    try:
        url = f"https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0]
    except Exception as e:
        logger.debug(f"Error getting profile for {symbol}: {e}")
    return None

def check_symbol_exists(conn, symbol):
    """Check if symbol already exists in assets table."""
    cur = conn.cursor()
    cur.execute("SELECT asset_id FROM assets WHERE symbol = %s", (symbol,))
    result = cur.fetchone()
    return result[0] if result else None

def add_asset(conn, symbol, name, sector=None, industry=None, market_cap=None, exchange=None):
    """Add a new equity asset to the database."""
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO assets (symbol, name, asset_type, sector, industry, market_cap, exchange, is_active, created_at, updated_at)
            VALUES (%s, %s, 'equity', %s, %s, %s, %s, true, NOW(), NOW())
            ON CONFLICT (symbol) DO UPDATE SET
                name = EXCLUDED.name,
                sector = COALESCE(EXCLUDED.sector, assets.sector),
                industry = COALESCE(EXCLUDED.industry, assets.industry),
                market_cap = COALESCE(EXCLUDED.market_cap, assets.market_cap),
                exchange = COALESCE(EXCLUDED.exchange, assets.exchange),
                updated_at = NOW()
            RETURNING asset_id
        """, (symbol, name, sector, industry, market_cap, exchange))
        conn.commit()
        result = cur.fetchone()
        return result[0] if result else None
    except Exception as e:
        conn.rollback()
        logger.error(f"Error adding asset {symbol}: {e}")
        return None

def link_holdings_to_asset(conn, asset_id, isin, cusip, holding_name):
    """Link ETF holdings to the newly created asset."""
    cur = conn.cursor()
    try:
        # Update by ISIN
        if isin:
            cur.execute("""
                UPDATE etf_holdings 
                SET asset_id = %s, updated_at = NOW()
                WHERE asset_id IS NULL AND isin = %s
            """, (asset_id, isin))
        
        # Update by CUSIP
        if cusip:
            cur.execute("""
                UPDATE etf_holdings 
                SET asset_id = %s, updated_at = NOW()
                WHERE asset_id IS NULL AND cusip = %s
            """, (asset_id, cusip))
        
        # Update by holding name (case insensitive)
        cur.execute("""
            UPDATE etf_holdings 
            SET asset_id = %s, updated_at = NOW()
            WHERE asset_id IS NULL AND UPPER(holding_name) = UPPER(%s)
        """, (asset_id, holding_name))
        
        conn.commit()
        return cur.rowcount
    except Exception as e:
        conn.rollback()
        logger.error(f"Error linking holdings: {e}")
        return 0

def main():
    parser = argparse.ArgumentParser(description='Add missing ETF holdings to assets')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of holdings to process')
    parser.add_argument('--delay', type=float, default=0.25, help='Delay between API calls (seconds)')
    parser.add_argument('--dry-run', action='store_true', help='Do not actually add assets')
    args = parser.parse_args()
    
    conn = get_db_connection()
    
    # Get unlinked US holdings
    holdings = get_unlinked_us_holdings(conn)
    logger.info(f"Found {len(holdings)} unique unlinked US holdings")
    
    if args.limit:
        holdings = holdings[:args.limit]
        logger.info(f"Processing limited to {args.limit} holdings")
    
    added = 0
    linked = 0
    skipped = 0
    errors = 0
    
    # Track processed symbols to avoid duplicates
    processed_symbols = set()
    
    for i, (holding_name, isin, cusip) in enumerate(holdings):
        logger.info(f"[{i+1}/{len(holdings)}] Processing: {holding_name}")
        
        # Try to find symbol
        symbol = None
        
        # First try CUSIP
        if cusip:
            symbol = lookup_symbol_by_cusip(cusip)
            if symbol:
                logger.debug(f"  Found symbol {symbol} via CUSIP")
        
        # Then try ISIN
        if not symbol and isin:
            symbol = lookup_symbol_by_isin(isin)
            if symbol:
                logger.debug(f"  Found symbol {symbol} via ISIN")
        
        if not symbol:
            logger.warning(f"  Could not find symbol for {holding_name}")
            errors += 1
            time.sleep(args.delay)
            continue
        
        # Skip if already processed
        if symbol in processed_symbols:
            logger.debug(f"  Already processed {symbol}")
            skipped += 1
            continue
        
        processed_symbols.add(symbol)
        
        # Check if symbol already exists
        existing_id = check_symbol_exists(conn, symbol)
        if existing_id:
            logger.info(f"  Symbol {symbol} already exists (ID: {existing_id}), linking holdings")
            linked_count = link_holdings_to_asset(conn, existing_id, isin, cusip, holding_name)
            linked += linked_count
            skipped += 1
            continue
        
        # Get stock profile
        profile = get_stock_profile(symbol)
        time.sleep(args.delay)
        
        if not profile:
            logger.warning(f"  Could not get profile for {symbol}")
            errors += 1
            continue
        
        if args.dry_run:
            logger.info(f"  [DRY RUN] Would add: {symbol} - {profile.get('companyName', holding_name)}")
            added += 1
            continue
        
        # Add asset
        asset_id = add_asset(
            conn,
            symbol=symbol,
            name=profile.get('companyName', holding_name),
            sector=profile.get('sector'),
            industry=profile.get('industry'),
            market_cap=profile.get('mktCap'),
            exchange=profile.get('exchange')
        )
        
        if asset_id:
            logger.info(f"  Added {symbol} (ID: {asset_id})")
            added += 1
            
            # Link holdings
            linked_count = link_holdings_to_asset(conn, asset_id, isin, cusip, holding_name)
            linked += linked_count
            logger.info(f"  Linked {linked_count} holdings")
        else:
            errors += 1
        
        time.sleep(args.delay)
    
    conn.close()
    
    logger.info(f"\nSummary:")
    logger.info(f"  Added: {added} assets")
    logger.info(f"  Linked: {linked} holdings")
    logger.info(f"  Skipped: {skipped} (already exist)")
    logger.info(f"  Errors: {errors}")

if __name__ == '__main__':
    main()

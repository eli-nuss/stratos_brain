#!/usr/bin/env python3
"""
Add missing ETF holdings to the assets table using FMP API.
Strategy:
1. Get unique unlinked holdings with ISIN/CUSIP
2. For each, try to find matching asset by ISIN/CUSIP
3. If not found, search FMP by name to get symbol
4. Add new assets and link holdings
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
import psycopg2
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

def get_unlinked_holdings(conn, us_only=True):
    """Get unique unlinked holdings."""
    cur = conn.cursor()
    
    isin_filter = "AND isin LIKE 'US%%'" if us_only else ""
    
    cur.execute(f"""
        SELECT DISTINCT 
            holding_name,
            isin,
            cusip
        FROM etf_holdings
        WHERE asset_id IS NULL
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
          {isin_filter}
        ORDER BY holding_name
    """)
    return cur.fetchall()

def find_asset_by_isin_cusip(conn, isin, cusip):
    """Find existing asset by ISIN or CUSIP."""
    cur = conn.cursor()
    
    if isin:
        cur.execute("SELECT asset_id, symbol FROM assets WHERE isin = %s", (isin,))
        result = cur.fetchone()
        if result:
            return result
    
    if cusip:
        cur.execute("SELECT asset_id, symbol FROM assets WHERE cusip = %s", (cusip,))
        result = cur.fetchone()
        if result:
            return result
    
    return None

def search_fmp_by_name(name):
    """Search FMP for a stock by company name."""
    # Clean up name for search
    search_name = name.replace(' INC', '').replace(' CORP', '').replace(' LTD', '')
    search_name = search_name.replace(' PLC', '').replace(' SA', '').replace(' AG', '')
    search_name = search_name.strip()
    
    # Try the v3 search endpoint (may work for some queries)
    try:
        # Use name search endpoint
        url = f"https://financialmodelingprep.com/api/v3/search-name?query={search_name}&limit=5&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and not isinstance(data, dict):  # Not an error response
                # Find best match
                for item in data:
                    if item.get('symbol'):
                        return item.get('symbol')
    except Exception as e:
        logger.debug(f"Search error for {name}: {e}")
    
    return None

def get_fmp_profile(symbol):
    """Get stock profile from FMP."""
    try:
        url = f"https://financialmodelingprep.com/stable/profile?symbol={symbol}&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return data[0]
    except Exception as e:
        logger.debug(f"Profile error for {symbol}: {e}")
    return None

def add_asset(conn, symbol, name, isin=None, cusip=None, sector=None, industry=None, market_cap=None, exchange=None):
    """Add a new equity asset."""
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO assets (symbol, name, asset_type, isin, cusip, sector, industry, market_cap, exchange, is_active, created_at, updated_at)
            VALUES (%s, %s, 'equity', %s, %s, %s, %s, %s, %s, true, NOW(), NOW())
            ON CONFLICT (asset_type, symbol) DO UPDATE SET
                name = COALESCE(EXCLUDED.name, assets.name),
                isin = COALESCE(EXCLUDED.isin, assets.isin),
                cusip = COALESCE(EXCLUDED.cusip, assets.cusip),
                sector = COALESCE(EXCLUDED.sector, assets.sector),
                industry = COALESCE(EXCLUDED.industry, assets.industry),
                market_cap = COALESCE(EXCLUDED.market_cap, assets.market_cap),
                exchange = COALESCE(EXCLUDED.exchange, assets.exchange),
                updated_at = NOW()
            RETURNING asset_id
        """, (symbol, name, isin, cusip, sector, industry, market_cap, exchange))
        conn.commit()
        result = cur.fetchone()
        return result[0] if result else None
    except Exception as e:
        conn.rollback()
        logger.error(f"Error adding asset {symbol}: {e}")
        return None

def update_asset_isin_cusip(conn, asset_id, isin, cusip):
    """Update ISIN/CUSIP for existing asset."""
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE assets SET 
                isin = COALESCE(isin, %s),
                cusip = COALESCE(cusip, %s),
                updated_at = NOW()
            WHERE asset_id = %s
        """, (isin, cusip, asset_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating asset {asset_id}: {e}")

def link_holdings(conn, asset_id, isin, cusip, holding_name):
    """Link ETF holdings to asset."""
    cur = conn.cursor()
    linked = 0
    try:
        if isin:
            cur.execute("""
                UPDATE etf_holdings SET asset_id = %s, updated_at = NOW()
                WHERE asset_id IS NULL AND isin = %s
            """, (asset_id, isin))
            linked += cur.rowcount
        
        if cusip:
            cur.execute("""
                UPDATE etf_holdings SET asset_id = %s, updated_at = NOW()
                WHERE asset_id IS NULL AND cusip = %s
            """, (asset_id, cusip))
            linked += cur.rowcount
        
        # Also link by name (case insensitive)
        cur.execute("""
            UPDATE etf_holdings SET asset_id = %s, updated_at = NOW()
            WHERE asset_id IS NULL AND UPPER(holding_name) = UPPER(%s)
        """, (asset_id, holding_name))
        linked += cur.rowcount
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error linking holdings: {e}")
    return linked

def extract_symbol_from_cusip(cusip):
    """Try to extract symbol from CUSIP (first 6 chars are often related to ticker)."""
    # This is a heuristic and won't always work
    return None

def main():
    parser = argparse.ArgumentParser(description='Add missing ETF holdings using FMP')
    parser.add_argument('--us-only', action='store_true', default=True, help='Only process US stocks')
    parser.add_argument('--all', action='store_true', help='Process all stocks including international')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of holdings to process')
    parser.add_argument('--delay', type=float, default=0.2, help='Delay between API calls')
    parser.add_argument('--dry-run', action='store_true', help='Do not make changes')
    args = parser.parse_args()
    
    us_only = not args.all
    
    conn = get_db_connection()
    
    # Get unlinked holdings
    holdings = get_unlinked_holdings(conn, us_only=us_only)
    logger.info(f"Found {len(holdings)} unique unlinked holdings")
    
    if args.limit:
        holdings = holdings[:args.limit]
        logger.info(f"Limited to {args.limit} holdings")
    
    added = 0
    linked = 0
    found_existing = 0
    not_found = 0
    
    processed_isins = set()
    processed_cusips = set()
    
    for i, (holding_name, isin, cusip) in enumerate(holdings):
        # Skip if already processed this ISIN/CUSIP
        if isin and isin in processed_isins:
            continue
        if cusip and cusip in processed_cusips:
            continue
        
        if isin:
            processed_isins.add(isin)
        if cusip:
            processed_cusips.add(cusip)
        
        logger.info(f"[{i+1}/{len(holdings)}] {holding_name} (ISIN: {isin}, CUSIP: {cusip})")
        
        # First check if we already have this asset by ISIN/CUSIP
        existing = find_asset_by_isin_cusip(conn, isin, cusip)
        if existing:
            asset_id, symbol = existing
            logger.info(f"  Found existing asset: {symbol} (ID: {asset_id})")
            found_existing += 1
            
            if not args.dry_run:
                linked_count = link_holdings(conn, asset_id, isin, cusip, holding_name)
                linked += linked_count
                logger.info(f"  Linked {linked_count} holdings")
            continue
        
        # Try to find symbol via FMP search
        symbol = search_fmp_by_name(holding_name)
        time.sleep(args.delay)
        
        if not symbol:
            logger.warning(f"  Could not find symbol")
            not_found += 1
            continue
        
        # Get profile to verify and get metadata
        profile = get_fmp_profile(symbol)
        time.sleep(args.delay)
        
        if not profile:
            logger.warning(f"  Could not get profile for {symbol}")
            not_found += 1
            continue
        
        # Verify ISIN/CUSIP matches (if available)
        profile_isin = profile.get('isin')
        profile_cusip = profile.get('cusip')
        
        # Check if this symbol already exists in our system
        cur = conn.cursor()
        cur.execute("SELECT asset_id FROM assets WHERE symbol = %s", (symbol,))
        existing_by_symbol = cur.fetchone()
        
        if existing_by_symbol:
            asset_id = existing_by_symbol[0]
            logger.info(f"  Symbol {symbol} already exists (ID: {asset_id}), updating ISIN/CUSIP")
            
            if not args.dry_run:
                update_asset_isin_cusip(conn, asset_id, isin or profile_isin, cusip or profile_cusip)
                linked_count = link_holdings(conn, asset_id, isin, cusip, holding_name)
                linked += linked_count
                logger.info(f"  Linked {linked_count} holdings")
            found_existing += 1
            continue
        
        # Add new asset
        if args.dry_run:
            logger.info(f"  [DRY RUN] Would add: {symbol} - {profile.get('companyName', holding_name)}")
            added += 1
            continue
        
        asset_id = add_asset(
            conn,
            symbol=symbol,
            name=profile.get('companyName', holding_name),
            isin=isin or profile_isin,
            cusip=cusip or profile_cusip,
            sector=profile.get('sector'),
            industry=profile.get('industry'),
            market_cap=profile.get('mktCap'),
            exchange=profile.get('exchange')
        )
        
        if asset_id:
            logger.info(f"  Added {symbol} (ID: {asset_id})")
            added += 1
            
            linked_count = link_holdings(conn, asset_id, isin, cusip, holding_name)
            linked += linked_count
            logger.info(f"  Linked {linked_count} holdings")
        else:
            not_found += 1
    
    conn.close()
    
    logger.info(f"\nSummary:")
    logger.info(f"  Added: {added} new assets")
    logger.info(f"  Found existing: {found_existing}")
    logger.info(f"  Linked: {linked} holdings")
    logger.info(f"  Not found: {not_found}")

if __name__ == '__main__':
    main()

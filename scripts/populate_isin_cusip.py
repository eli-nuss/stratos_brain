#!/usr/bin/env python3
"""
Populate ISIN/CUSIP for all equity assets from FMP profiles.
Then link ETF holdings using the ISIN/CUSIP data.
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
import psycopg2
from concurrent.futures import ThreadPoolExecutor

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

def get_equities_without_isin(conn, limit=None):
    """Get equity symbols that don't have ISIN yet."""
    cur = conn.cursor()
    query = """
        SELECT asset_id, symbol 
        FROM assets 
        WHERE asset_type = 'equity' 
          AND isin IS NULL
        ORDER BY symbol
    """
    if limit:
        query += f" LIMIT {limit}"
    cur.execute(query)
    return cur.fetchall()

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

def update_asset_isin_cusip(conn, asset_id, isin, cusip):
    """Update ISIN/CUSIP for an asset."""
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE assets 
            SET isin = %s, cusip = %s, updated_at = NOW()
            WHERE asset_id = %s
        """, (isin, cusip, asset_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating asset {asset_id}: {e}")
        return False

def link_holdings_by_isin_cusip(conn):
    """Link unlinked ETF holdings using ISIN/CUSIP."""
    cur = conn.cursor()
    
    # Link by ISIN
    cur.execute("""
        UPDATE etf_holdings eh
        SET asset_id = a.asset_id, updated_at = NOW()
        FROM assets a
        WHERE eh.asset_id IS NULL
          AND eh.isin IS NOT NULL
          AND eh.isin = a.isin
    """)
    isin_linked = cur.rowcount
    
    # Link by CUSIP
    cur.execute("""
        UPDATE etf_holdings eh
        SET asset_id = a.asset_id, updated_at = NOW()
        FROM assets a
        WHERE eh.asset_id IS NULL
          AND eh.cusip IS NOT NULL
          AND eh.cusip = a.cusip
    """)
    cusip_linked = cur.rowcount
    
    conn.commit()
    return isin_linked, cusip_linked

def main():
    parser = argparse.ArgumentParser(description='Populate ISIN/CUSIP for equities')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of equities to process')
    parser.add_argument('--delay', type=float, default=0.12, help='Delay between API calls')
    parser.add_argument('--link-only', action='store_true', help='Only link holdings, skip fetching')
    args = parser.parse_args()
    
    conn = get_db_connection()
    
    if not args.link_only:
        # Get equities without ISIN
        equities = get_equities_without_isin(conn, args.limit)
        logger.info(f"Found {len(equities)} equities without ISIN")
        
        updated = 0
        not_found = 0
        
        for i, (asset_id, symbol) in enumerate(equities):
            if i % 100 == 0:
                logger.info(f"Progress: {i}/{len(equities)} ({updated} updated)")
            
            profile = get_fmp_profile(symbol)
            
            if profile:
                isin = profile.get('isin')
                cusip = profile.get('cusip')
                
                if isin or cusip:
                    if update_asset_isin_cusip(conn, asset_id, isin, cusip):
                        updated += 1
                        logger.debug(f"  {symbol}: ISIN={isin}, CUSIP={cusip}")
                else:
                    not_found += 1
            else:
                not_found += 1
            
            time.sleep(args.delay)
        
        logger.info(f"\nISIN/CUSIP population complete:")
        logger.info(f"  Updated: {updated}")
        logger.info(f"  Not found: {not_found}")
    
    # Link holdings
    logger.info("\nLinking ETF holdings by ISIN/CUSIP...")
    isin_linked, cusip_linked = link_holdings_by_isin_cusip(conn)
    logger.info(f"  Linked by ISIN: {isin_linked}")
    logger.info(f"  Linked by CUSIP: {cusip_linked}")
    
    # Check final counts
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(asset_id) as linked,
            COUNT(*) - COUNT(asset_id) as unlinked
        FROM etf_holdings
    """)
    total, linked, unlinked = cur.fetchone()
    logger.info(f"\nFinal ETF holdings status:")
    logger.info(f"  Total: {total}")
    logger.info(f"  Linked: {linked} ({100*linked/total:.1f}%)")
    logger.info(f"  Unlinked: {unlinked} ({100*unlinked/total:.1f}%)")
    
    conn.close()

if __name__ == '__main__':
    main()

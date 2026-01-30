#!/usr/bin/env python3
"""
Add top international stocks from ETF holdings using FMP.
Focuses on top 100 by market value for each major market.
"""

import os
import sys
import time
import json
import logging
import argparse
import requests
import psycopg2
from difflib import SequenceMatcher

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# API Keys
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe')
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres')

# Exchange suffixes for international stocks
EXCHANGE_SUFFIXES = {
    'JP': ['.T'],           # Tokyo
    'GB': ['.L'],           # London
    'DE': ['.DE', '.F'],    # Germany (Xetra, Frankfurt)
    'FR': ['.PA'],          # Paris
    'AU': ['.AX'],          # Australia
    'HK': ['.HK'],          # Hong Kong
    'CA': ['.TO', '.V'],    # Toronto, Venture
    'CH': ['.SW'],          # Switzerland
    'NL': ['.AS'],          # Amsterdam
    'KR': ['.KS', '.KQ'],   # Korea
    'TW': ['.TW', '.TWO'],  # Taiwan
    'IN': ['.NS', '.BO'],   # India (NSE, BSE)
    'CN': ['.SS', '.SZ'],   # China (Shanghai, Shenzhen)
}

# Common company name patterns to extract potential tickers
SUFFIXES_TO_REMOVE = [
    ' INC', ' CORP', ' CO', ' LTD', ' PLC', ' SA', ' AG', ' NV', ' SE', 
    ' HOLDINGS', ' GROUP', ' COMPANY', ' LIMITED', ' CORPORATION',
    ' CLASS A', ' CLASS B', ' CLASS C', ' CL A', ' CL B', ' CL C',
    ' COMMON', ' ORDINARY', ' ADR', ' ADS', ' SPON ADR',
    ' ORD', ' SHS', ' SHARES', ' REIT', ' LP', ' LLC',
    ' & CO', ' KG', ' GMBH', ' BHD', ' PTY', ' BERHAD'
]

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(DATABASE_URL)

def clean_name(name):
    """Clean company name for matching."""
    if not name:
        return ''
    name = name.upper().strip()
    for suffix in SUFFIXES_TO_REMOVE:
        name = name.replace(suffix, '')
    return ' '.join(name.split())

def get_top_holdings_by_country(conn, country, limit=100):
    """Get top holdings by market value for a country."""
    cur = conn.cursor()
    cur.execute("""
        WITH ranked AS (
            SELECT 
                holding_name,
                isin,
                cusip,
                SUM(market_value) as total_market_value,
                ROW_NUMBER() OVER (ORDER BY SUM(market_value) DESC NULLS LAST) as rank
            FROM etf_holdings
            WHERE asset_id IS NULL
              AND LEFT(isin, 2) = %s
              AND holding_name IS NOT NULL
              AND holding_name != ''
              AND holding_name NOT LIKE '%%BOND%%'
              AND holding_name NOT LIKE '%%NOTE%%'
              AND holding_name NOT LIKE '%%TREASURY%%'
            GROUP BY holding_name, isin, cusip
        )
        SELECT holding_name, isin, cusip, total_market_value
        FROM ranked
        WHERE rank <= %s
        ORDER BY total_market_value DESC NULLS LAST
    """, (country, limit))
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

def verify_match(holding_name, profile):
    """Verify that the FMP profile matches the holding name."""
    if not profile:
        return False
    
    profile_name = profile.get('companyName', '')
    
    clean_holding = clean_name(holding_name)
    clean_profile = clean_name(profile_name)
    
    # Exact match
    if clean_holding == clean_profile:
        return True
    
    # Substring match
    if clean_holding in clean_profile or clean_profile in clean_holding:
        return True
    
    # Similarity ratio
    ratio = SequenceMatcher(None, clean_holding, clean_profile).ratio()
    if ratio > 0.6:
        return True
    
    # Check if main words match
    holding_words = set(clean_holding.split())
    profile_words = set(clean_profile.split())
    common = holding_words & profile_words
    if len(common) >= 2 or (len(common) >= 1 and len(holding_words) <= 2):
        return True
    
    return False

def extract_ticker_candidates(name, country):
    """Extract potential ticker candidates from company name."""
    clean = clean_name(name)
    words = clean.split()
    candidates = []
    
    # For Japanese stocks, try numeric codes (4-digit)
    if country == 'JP':
        # Common Japanese tickers are 4-digit numbers
        import re
        nums = re.findall(r'\d{4}', name)
        candidates.extend(nums)
    
    # First word if short
    if words and len(words[0]) <= 5:
        candidates.append(words[0])
    
    # First letters of words
    if len(words) >= 2:
        candidates.append(''.join(w[0] for w in words[:4]))
        candidates.append(''.join(w[0] for w in words[:3]))
        candidates.append(''.join(w[0] for w in words[:2]))
    
    # First 3-4 letters of first word
    if words:
        candidates.append(words[0][:4])
        candidates.append(words[0][:3])
    
    return candidates

def find_symbol_for_holding(holding_name, isin, country):
    """Try to find the FMP symbol for a holding."""
    candidates = extract_ticker_candidates(holding_name, country)
    suffixes = EXCHANGE_SUFFIXES.get(country, [''])
    
    for candidate in candidates:
        if not candidate or len(candidate) < 2:
            continue
        
        for suffix in suffixes:
            symbol = candidate + suffix
            profile = get_fmp_profile(symbol)
            
            if profile and verify_match(holding_name, profile):
                return symbol, profile
            
            time.sleep(0.1)
    
    return None, None

def check_existing_asset(conn, symbol):
    """Check if symbol already exists in assets."""
    cur = conn.cursor()
    cur.execute("SELECT asset_id FROM assets WHERE symbol = %s", (symbol,))
    result = cur.fetchone()
    return result[0] if result else None

def add_asset(conn, symbol, name, isin=None, cusip=None, sector=None, industry=None, exchange=None):
    """Add a new equity asset."""
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO assets (symbol, name, asset_type, isin, cusip, sector, industry, exchange, is_active, created_at, updated_at)
            VALUES (%s, %s, 'equity', %s, %s, %s, %s, %s, true, NOW(), NOW())
            ON CONFLICT (asset_type, symbol) DO UPDATE SET
                name = COALESCE(EXCLUDED.name, assets.name),
                isin = COALESCE(EXCLUDED.isin, assets.isin),
                cusip = COALESCE(EXCLUDED.cusip, assets.cusip),
                sector = COALESCE(EXCLUDED.sector, assets.sector),
                industry = COALESCE(EXCLUDED.industry, assets.industry),
                exchange = COALESCE(EXCLUDED.exchange, assets.exchange),
                updated_at = NOW()
            RETURNING asset_id
        """, (symbol, name, isin, cusip, sector, industry, exchange))
        conn.commit()
        result = cur.fetchone()
        return result[0] if result else None
    except Exception as e:
        conn.rollback()
        logger.error(f"Error adding asset {symbol}: {e}")
        return None

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

def main():
    parser = argparse.ArgumentParser(description='Add top international stocks')
    parser.add_argument('--countries', type=str, default='JP,AU,GB,DE,FR,CA,HK,CH,KR,TW,IN,CN,NL',
                        help='Comma-separated list of country codes')
    parser.add_argument('--limit', type=int, default=100, help='Top N stocks per country')
    parser.add_argument('--delay', type=float, default=0.15, help='Delay between API calls')
    args = parser.parse_args()
    
    countries = args.countries.split(',')
    conn = get_db_connection()
    
    total_added = 0
    total_linked = 0
    total_found_existing = 0
    total_not_found = 0
    
    for country in countries:
        logger.info(f"\n{'='*50}")
        logger.info(f"Processing {country} - Top {args.limit} stocks")
        logger.info(f"{'='*50}")
        
        holdings = get_top_holdings_by_country(conn, country, args.limit)
        logger.info(f"Found {len(holdings)} holdings to process")
        
        added = 0
        linked = 0
        found_existing = 0
        not_found = 0
        
        for i, (holding_name, isin, cusip, market_value) in enumerate(holdings):
            if i % 20 == 0:
                logger.info(f"Progress: {i}/{len(holdings)}")
            
            symbol, profile = find_symbol_for_holding(holding_name, isin, country)
            
            if not symbol:
                not_found += 1
                continue
            
            logger.info(f"  Found: {holding_name} -> {symbol}")
            
            # Check if exists
            existing_id = check_existing_asset(conn, symbol)
            if existing_id:
                found_existing += 1
                linked_count = link_holdings(conn, existing_id, isin, cusip, holding_name)
                linked += linked_count
                continue
            
            # Add new asset
            asset_id = add_asset(
                conn,
                symbol=symbol,
                name=profile.get('companyName', holding_name),
                isin=isin or profile.get('isin'),
                cusip=cusip or profile.get('cusip'),
                sector=profile.get('sector'),
                industry=profile.get('industry'),
                exchange=profile.get('exchange')
            )
            
            if asset_id:
                added += 1
                linked_count = link_holdings(conn, asset_id, isin, cusip, holding_name)
                linked += linked_count
            else:
                not_found += 1
            
            time.sleep(args.delay)
        
        logger.info(f"\n{country} Summary:")
        logger.info(f"  Added: {added}")
        logger.info(f"  Found existing: {found_existing}")
        logger.info(f"  Linked: {linked}")
        logger.info(f"  Not found: {not_found}")
        
        total_added += added
        total_linked += linked
        total_found_existing += found_existing
        total_not_found += not_found
    
    # Final linking pass
    logger.info("\n" + "="*50)
    logger.info("Final ISIN/CUSIP linking pass...")
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE etf_holdings eh
        SET asset_id = a.asset_id, updated_at = NOW()
        FROM assets a
        WHERE eh.asset_id IS NULL
          AND eh.isin IS NOT NULL
          AND eh.isin = a.isin
    """)
    isin_linked = cur.rowcount
    
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
    
    logger.info(f"Additional linked by ISIN: {isin_linked}")
    logger.info(f"Additional linked by CUSIP: {cusip_linked}")
    
    # Final status
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(asset_id) as linked,
            COUNT(*) - COUNT(asset_id) as unlinked
        FROM etf_holdings
    """)
    total, linked_total, unlinked = cur.fetchone()
    
    logger.info(f"\n{'='*50}")
    logger.info(f"FINAL SUMMARY")
    logger.info(f"{'='*50}")
    logger.info(f"Total added: {total_added}")
    logger.info(f"Total found existing: {total_found_existing}")
    logger.info(f"Total linked: {total_linked + isin_linked + cusip_linked}")
    logger.info(f"Total not found: {total_not_found}")
    logger.info(f"\nETF Holdings Status:")
    logger.info(f"  Total: {total}")
    logger.info(f"  Linked: {linked_total} ({100*linked_total/total:.1f}%)")
    logger.info(f"  Unlinked: {unlinked} ({100*unlinked/total:.1f}%)")
    
    conn.close()

if __name__ == '__main__':
    main()

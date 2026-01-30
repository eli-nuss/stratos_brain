#!/usr/bin/env python3
"""
Fill in missing ETF holdings by matching to FMP symbols.
Uses multiple strategies to find the correct symbol for each holding.
"""

import os
import sys
import time
import json
import re
import logging
import argparse
import requests
import psycopg2
from datetime import datetime
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

# Common company suffixes to remove for matching
SUFFIXES = [
    ' INC', ' CORP', ' CO', ' LTD', ' PLC', ' SA', ' AG', ' NV', ' SE', 
    ' HOLDINGS', ' GROUP', ' COMPANY', ' LIMITED', ' CORPORATION',
    ' CLASS A', ' CLASS B', ' CLASS C', ' CL A', ' CL B', ' CL C',
    ' COMMON', ' ORDINARY', ' ADR', ' ADS', ' SPON ADR', ' SPONSORED ADR',
    ' ORD', ' SHS', ' SHARES', ' STOCK', ' REIT', ' LP', ' LLC'
]

# Exchange suffixes for international stocks
EXCHANGE_SUFFIXES = {
    'JP': '.T',   # Tokyo
    'GB': '.L',   # London
    'DE': '.DE',  # Germany (Xetra)
    'FR': '.PA',  # Paris
    'AU': '.AX',  # Australia
    'HK': '.HK',  # Hong Kong
    'CA': '.TO',  # Toronto
    'CH': '.SW',  # Switzerland
    'NL': '.AS',  # Amsterdam
    'ES': '.MC',  # Madrid
    'IT': '.MI',  # Milan
    'BE': '.BR',  # Brussels
    'KR': '.KS',  # Korea
    'TW': '.TW',  # Taiwan
    'IN': '.NS',  # India (NSE)
    'SG': '.SI',  # Singapore
    'SE': '.ST',  # Stockholm
    'NO': '.OL',  # Oslo
    'DK': '.CO',  # Copenhagen
    'FI': '.HE',  # Helsinki
}

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(DATABASE_URL)

def clean_name(name):
    """Clean company name for matching."""
    if not name:
        return ''
    name = name.upper().strip()
    for suffix in SUFFIXES:
        name = name.replace(suffix, '')
    # Remove extra whitespace
    name = ' '.join(name.split())
    return name

def get_unlinked_holdings(conn, country_filter=None):
    """Get unique unlinked holdings."""
    cur = conn.cursor()
    
    country_clause = ""
    if country_filter:
        if isinstance(country_filter, list):
            placeholders = ','.join(['%s'] * len(country_filter))
            country_clause = f"AND LEFT(isin, 2) IN ({placeholders})"
        else:
            country_clause = "AND LEFT(isin, 2) = %s"
    
    query = f"""
        SELECT DISTINCT 
            holding_name,
            isin,
            cusip,
            LEFT(isin, 2) as country
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
          AND holding_name NOT LIKE '%%COUPON%%'
          AND holding_name NOT LIKE '%%MATURITY%%'
          {country_clause}
        ORDER BY holding_name
    """
    
    if country_filter:
        if isinstance(country_filter, list):
            cur.execute(query, country_filter)
        else:
            cur.execute(query, (country_filter,))
    else:
        cur.execute(query)
    
    return cur.fetchall()

def extract_potential_ticker(name):
    """Try to extract a potential ticker from the company name."""
    # Common patterns where ticker might be embedded
    # e.g., "NVIDIA CORP" -> try "NVDA", "NVD", etc.
    
    # For names that are already short, they might be tickers
    words = name.split()
    if len(words) == 1 and len(name) <= 5:
        return name
    
    # Try first letters of each word
    if len(words) >= 2:
        ticker = ''.join(w[0] for w in words if w)[:4]
        if len(ticker) >= 2:
            return ticker
    
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

def verify_match(holding_name, profile):
    """Verify that the FMP profile matches the holding name."""
    if not profile:
        return False
    
    profile_name = profile.get('companyName', '')
    
    # Clean both names
    clean_holding = clean_name(holding_name)
    clean_profile = clean_name(profile_name)
    
    # Check for exact match
    if clean_holding == clean_profile:
        return True
    
    # Check for substring match
    if clean_holding in clean_profile or clean_profile in clean_holding:
        return True
    
    # Check similarity ratio
    ratio = SequenceMatcher(None, clean_holding, clean_profile).ratio()
    if ratio > 0.7:
        return True
    
    # Check if main words match
    holding_words = set(clean_holding.split())
    profile_words = set(clean_profile.split())
    common = holding_words & profile_words
    if len(common) >= 2 or (len(common) >= 1 and len(holding_words) <= 2):
        return True
    
    return False

def find_symbol_for_holding(holding_name, isin, cusip, country):
    """Try various strategies to find the FMP symbol for a holding."""
    
    # Strategy 1: Try common ticker patterns based on name
    clean = clean_name(holding_name)
    words = clean.split()
    
    candidates = []
    
    # Try the first word if it looks like a ticker
    if words and len(words[0]) <= 5:
        candidates.append(words[0])
    
    # Try first letters
    if len(words) >= 2:
        candidates.append(''.join(w[0] for w in words[:4]))
        candidates.append(''.join(w[0] for w in words[:3]))
        candidates.append(''.join(w[0] for w in words[:2]))
    
    # Try first word + first letter of second
    if len(words) >= 2:
        candidates.append(words[0][:3] + words[1][0])
        candidates.append(words[0][:2] + words[1][0])
    
    # For international stocks, add exchange suffix
    exchange_suffix = EXCHANGE_SUFFIXES.get(country, '')
    
    # Try each candidate
    for candidate in candidates:
        if not candidate or len(candidate) < 2:
            continue
        
        # Try without suffix first (for US stocks and ADRs)
        profile = get_fmp_profile(candidate)
        if profile and verify_match(holding_name, profile):
            return candidate, profile
        
        # Try with exchange suffix for international
        if exchange_suffix and country != 'US':
            intl_symbol = candidate + exchange_suffix
            profile = get_fmp_profile(intl_symbol)
            if profile and verify_match(holding_name, profile):
                return intl_symbol, profile
        
        time.sleep(0.1)  # Rate limiting
    
    return None, None

def check_existing_asset(conn, symbol):
    """Check if symbol already exists in assets."""
    cur = conn.cursor()
    cur.execute("SELECT asset_id FROM assets WHERE symbol = %s", (symbol,))
    result = cur.fetchone()
    return result[0] if result else None

def add_asset(conn, symbol, name, isin=None, cusip=None, sector=None, industry=None, exchange=None, country=None):
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

def main():
    parser = argparse.ArgumentParser(description='Fill missing ETF holdings using FMP')
    parser.add_argument('--country', type=str, default=None, help='Filter by country code (e.g., US, GB, JP)')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of holdings to process')
    parser.add_argument('--delay', type=float, default=0.2, help='Delay between API calls')
    parser.add_argument('--dry-run', action='store_true', help='Do not make changes')
    args = parser.parse_args()
    
    conn = get_db_connection()
    
    # Get unlinked holdings
    country_filter = args.country.split(',') if args.country and ',' in args.country else args.country
    holdings = get_unlinked_holdings(conn, country_filter)
    logger.info(f"Found {len(holdings)} unique unlinked holdings")
    
    if args.limit:
        holdings = holdings[:args.limit]
        logger.info(f"Limited to {args.limit} holdings")
    
    added = 0
    linked = 0
    found_existing = 0
    not_found = 0
    
    processed_isins = set()
    
    for i, (holding_name, isin, cusip, country) in enumerate(holdings):
        # Skip if already processed this ISIN
        if isin and isin in processed_isins:
            continue
        if isin:
            processed_isins.add(isin)
        
        logger.info(f"[{i+1}/{len(holdings)}] {holding_name} ({country})")
        
        # Try to find symbol
        symbol, profile = find_symbol_for_holding(holding_name, isin, cusip, country)
        
        if not symbol:
            logger.warning(f"  Could not find symbol")
            not_found += 1
            continue
        
        logger.info(f"  Found: {symbol} -> {profile.get('companyName', 'N/A')}")
        
        # Check if symbol already exists
        existing_id = check_existing_asset(conn, symbol)
        if existing_id:
            logger.info(f"  Symbol exists (ID: {existing_id}), linking holdings")
            found_existing += 1
            
            if not args.dry_run:
                linked_count = link_holdings(conn, existing_id, isin, cusip, holding_name)
                linked += linked_count
                logger.info(f"  Linked {linked_count} holdings")
            continue
        
        # Add new asset
        if args.dry_run:
            logger.info(f"  [DRY RUN] Would add: {symbol}")
            added += 1
            continue
        
        asset_id = add_asset(
            conn,
            symbol=symbol,
            name=profile.get('companyName', holding_name),
            isin=isin or profile.get('isin'),
            cusip=cusip or profile.get('cusip'),
            sector=profile.get('sector'),
            industry=profile.get('industry'),
            exchange=profile.get('exchange'),
            country=country
        )
        
        if asset_id:
            logger.info(f"  Added {symbol} (ID: {asset_id})")
            added += 1
            
            linked_count = link_holdings(conn, asset_id, isin, cusip, holding_name)
            linked += linked_count
            logger.info(f"  Linked {linked_count} holdings")
        else:
            not_found += 1
        
        time.sleep(args.delay)
    
    conn.close()
    
    logger.info(f"\nSummary:")
    logger.info(f"  Added: {added} new assets")
    logger.info(f"  Found existing: {found_existing}")
    logger.info(f"  Linked: {linked} holdings")
    logger.info(f"  Not found: {not_found}")

if __name__ == '__main__':
    main()

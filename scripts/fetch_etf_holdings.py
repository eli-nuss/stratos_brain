#!/usr/bin/env python3
"""
Fetch ETF Holdings from Financial Modeling Prep (FMP) API

This script fetches holdings data for all ETFs in the database and stores them
in the etf_holdings table. It also fetches ETF metadata (expense ratio, AUM, etc.)
and stores it in the etf_info table.

Usage:
    python scripts/fetch_etf_holdings.py [--symbol SPY] [--all] [--limit 10]
"""

import os
import sys
import argparse
import logging
import time
from datetime import datetime
from typing import Optional
import requests
import psycopg2
from psycopg2.extras import execute_values

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FMP API configuration
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe')
FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 
    'postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres')


def get_db_connection():
    """Create a database connection."""
    return psycopg2.connect(DATABASE_URL)


def fetch_etf_holdings(symbol: str) -> list:
    """Fetch holdings for a specific ETF from FMP API."""
    url = f"{FMP_BASE_URL}/etf/holdings"
    params = {
        'symbol': symbol,
        'apikey': FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and 'error' in data:
            logger.warning(f"API error for {symbol}: {data.get('error')}")
            return []
        return []
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching holdings for {symbol}: {e}")
        return []


def fetch_etf_info(symbol: str) -> Optional[dict]:
    """Fetch ETF metadata from FMP API."""
    url = f"{FMP_BASE_URL}/etf/info"
    params = {
        'symbol': symbol,
        'apikey': FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if isinstance(data, list) and len(data) > 0:
            return data[0]
        elif isinstance(data, dict) and 'error' not in data:
            return data
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching info for {symbol}: {e}")
        return None


def fetch_etf_sector_weightings(symbol: str) -> Optional[list]:
    """Fetch ETF sector weightings from FMP API."""
    url = f"{FMP_BASE_URL}/etf/sector-weightings"
    params = {
        'symbol': symbol,
        'apikey': FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if isinstance(data, list):
            return data
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching sector weightings for {symbol}: {e}")
        return None


def get_etf_list(conn, limit: Optional[int] = None) -> list:
    """Get list of ETF symbols from the database."""
    with conn.cursor() as cur:
        query = """
            SELECT e.symbol, a.asset_id, e.etf_id
            FROM etf_assets e
            JOIN assets a ON e.symbol = a.symbol AND a.asset_type = 'etf'
            ORDER BY e.symbol
        """
        if limit:
            query += f" LIMIT {limit}"
        cur.execute(query)
        return cur.fetchall()


def get_asset_id_map(conn) -> dict:
    """Get mapping of symbols to asset_ids for equities."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT symbol, asset_id 
            FROM assets 
            WHERE asset_type = 'equity'
        """)
        return {row[0]: row[1] for row in cur.fetchall()}


def save_holdings(conn, etf_id: int, holdings: list, asset_id_map: dict):
    """Save ETF holdings to the database."""
    if not holdings:
        return 0
    
    # Prepare data for insertion
    rows = []
    for h in holdings:
        holding_symbol = h.get('asset', '')
        if not holding_symbol:
            continue
            
        rows.append((
            etf_id,
            asset_id_map.get(holding_symbol),  # May be None if not in our equities
            h.get('weightPercentage'),
            h.get('sharesNumber'),
            h.get('marketValue'),
            datetime.now().date(),
            h.get('name', ''),
            h.get('isin', ''),
            h.get('securityCusip', '')
        ))
    
    if not rows:
        return 0
    
    with conn.cursor() as cur:
        # Delete existing holdings for this ETF
        cur.execute("DELETE FROM etf_holdings WHERE etf_id = %s", (etf_id,))
        
        # Insert new holdings
        execute_values(
            cur,
            """
            INSERT INTO etf_holdings 
                (etf_id, asset_id, weight_percent, shares_held, market_value, as_of_date, holding_name, isin, cusip)
            VALUES %s
            """,
            rows
        )
        conn.commit()
        return len(rows)


def save_etf_info(conn, symbol: str, asset_id: int, info: dict, sector_weightings: Optional[list]):
    """Save ETF metadata to the database."""
    if not info:
        return False
    
    # Calculate top 10 concentration if we have holdings
    top_10_concentration = None
    
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO etf_info (
                symbol, asset_id, name, expense_ratio, aum, avg_volume, 
                holdings_count, inception_date, description, sector_weightings,
                top_10_concentration, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (symbol) DO UPDATE SET
                name = EXCLUDED.name,
                expense_ratio = EXCLUDED.expense_ratio,
                aum = EXCLUDED.aum,
                avg_volume = EXCLUDED.avg_volume,
                holdings_count = EXCLUDED.holdings_count,
                inception_date = EXCLUDED.inception_date,
                description = EXCLUDED.description,
                sector_weightings = EXCLUDED.sector_weightings,
                top_10_concentration = EXCLUDED.top_10_concentration,
                updated_at = NOW()
        """, (
            symbol,
            asset_id,
            info.get('name') or info.get('companyName'),
            info.get('expenseRatio'),
            info.get('aum') or info.get('netAssets'),
            info.get('avgVolume'),
            info.get('holdingsCount'),
            info.get('inceptionDate'),
            info.get('description'),
            psycopg2.extras.Json(sector_weightings) if sector_weightings else None,
            top_10_concentration
        ))
        conn.commit()
        return True


def calculate_top_10_concentration(conn, etf_id: int) -> Optional[float]:
    """Calculate the concentration of top 10 holdings."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COALESCE(SUM(weight_percent), 0)
            FROM (
                SELECT weight_percent
                FROM etf_holdings
                WHERE etf_id = %s AND weight_percent IS NOT NULL
                ORDER BY weight_percent DESC
                LIMIT 10
            ) top10
        """, (etf_id,))
        result = cur.fetchone()
        return float(result[0]) if result and result[0] else None


def process_etf(conn, symbol: str, asset_id: int, etf_id: int, asset_id_map: dict) -> dict:
    """Process a single ETF: fetch and save holdings and info."""
    result = {
        'symbol': symbol,
        'holdings_count': 0,
        'info_saved': False,
        'errors': []
    }
    
    # Fetch holdings
    holdings = fetch_etf_holdings(symbol)
    if holdings:
        result['holdings_count'] = save_holdings(conn, etf_id, holdings, asset_id_map)
        
        # Calculate and update top 10 concentration
        top_10 = calculate_top_10_concentration(conn, etf_id)
        if top_10:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE etf_info SET top_10_concentration = %s WHERE symbol = %s
                """, (top_10, symbol))
                conn.commit()
    else:
        result['errors'].append('No holdings data')
    
    # Fetch ETF info
    info = fetch_etf_info(symbol)
    sector_weightings = fetch_etf_sector_weightings(symbol)
    
    if info:
        result['info_saved'] = save_etf_info(conn, symbol, asset_id, info, sector_weightings)
    else:
        result['errors'].append('No ETF info data')
    
    return result


def main():
    parser = argparse.ArgumentParser(description='Fetch ETF holdings from FMP API')
    parser.add_argument('--symbol', type=str, help='Specific ETF symbol to fetch')
    parser.add_argument('--all', action='store_true', help='Fetch all ETFs')
    parser.add_argument('--limit', type=int, help='Limit number of ETFs to process')
    parser.add_argument('--delay', type=float, default=0.3, help='Delay between API calls (seconds)')
    args = parser.parse_args()
    
    if not args.symbol and not args.all:
        print("Please specify --symbol or --all")
        sys.exit(1)
    
    conn = get_db_connection()
    
    try:
        # Get asset ID mapping for equities
        asset_id_map = get_asset_id_map(conn)
        logger.info(f"Loaded {len(asset_id_map)} equity asset IDs")
        
        if args.symbol:
            # Process single ETF
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT e.symbol, a.asset_id, e.etf_id
                    FROM etf_assets e
                    JOIN assets a ON e.symbol = a.symbol AND a.asset_type = 'etf'
                    WHERE e.symbol = %s
                """, (args.symbol,))
                row = cur.fetchone()
                
            if not row:
                logger.error(f"ETF {args.symbol} not found in database")
                sys.exit(1)
                
            symbol, asset_id, etf_id = row
            result = process_etf(conn, symbol, asset_id, etf_id, asset_id_map)
            logger.info(f"Processed {symbol}: {result['holdings_count']} holdings, info_saved={result['info_saved']}")
            
        else:
            # Process all ETFs
            etfs = get_etf_list(conn, args.limit)
            logger.info(f"Processing {len(etfs)} ETFs")
            
            success_count = 0
            error_count = 0
            total_holdings = 0
            
            for i, (symbol, asset_id, etf_id) in enumerate(etfs):
                try:
                    result = process_etf(conn, symbol, asset_id, etf_id, asset_id_map)
                    total_holdings += result['holdings_count']
                    
                    if result['holdings_count'] > 0 or result['info_saved']:
                        success_count += 1
                        logger.info(f"[{i+1}/{len(etfs)}] {symbol}: {result['holdings_count']} holdings")
                    else:
                        error_count += 1
                        logger.warning(f"[{i+1}/{len(etfs)}] {symbol}: No data - {result['errors']}")
                    
                    # Rate limiting
                    time.sleep(args.delay)
                    
                except Exception as e:
                    error_count += 1
                    logger.error(f"[{i+1}/{len(etfs)}] {symbol}: Error - {e}")
            
            logger.info(f"\nSummary:")
            logger.info(f"  Processed: {len(etfs)} ETFs")
            logger.info(f"  Success: {success_count}")
            logger.info(f"  Errors: {error_count}")
            logger.info(f"  Total holdings: {total_holdings}")
            
    finally:
        conn.close()


if __name__ == '__main__':
    main()

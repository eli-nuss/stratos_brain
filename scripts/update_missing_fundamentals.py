#!/usr/bin/env python3
"""
Update equity_metadata for assets with missing fundamental data.
Fetches P/S ratio, Forward P/E, and other metrics from Alpha Vantage.
"""

import os
import sys
import time
import psycopg2
import requests
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Database connection
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# Alpha Vantage API
ALPHA_VANTAGE_API_KEY = os.environ.get('ALPHA_VANTAGE_API_KEY', 'PLZVWIJQFOVHT4WL')
ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query'

# Rate limiting: Alpha Vantage premium allows 75 calls/minute
REQUEST_DELAY = 1.0  # 1 second between requests

def get_connection():
    return psycopg2.connect(DB_URL)

def get_assets_needing_fundamentals(conn, limit=None):
    """Get active equities missing P/S ratio or Forward P/E."""
    with conn.cursor() as cur:
        query = """
            SELECT a.asset_id, a.symbol, a.name,
                   em.price_to_sales_ttm IS NULL as needs_ps,
                   em.forward_pe IS NULL as needs_fwd_pe
            FROM assets a
            JOIN equity_metadata em ON a.asset_id = em.asset_id
            WHERE a.asset_type = 'equity' 
              AND a.is_active = true 
              AND (em.price_to_sales_ttm IS NULL OR em.forward_pe IS NULL)
            ORDER BY em.market_cap DESC NULLS LAST
        """
        if limit:
            query += f" LIMIT {limit}"
        cur.execute(query)
        return cur.fetchall()

def parse_decimal(value):
    """Parse a decimal value from Alpha Vantage, handling 'None' and '-' strings."""
    if value is None or value == 'None' or value == '' or value == '-':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def fetch_alpha_vantage_overview(symbol):
    """Fetch company overview from Alpha Vantage."""
    try:
        params = {
            'function': 'OVERVIEW',
            'symbol': symbol,
            'apikey': ALPHA_VANTAGE_API_KEY
        }
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=30)
        data = response.json()
        
        # Check for rate limiting or errors
        if 'Note' in data or 'Information' in data:
            print(f"  Rate limited or error: {data.get('Note', data.get('Information', ''))[:50]}")
            return None
        
        if not data or 'Symbol' not in data:
            return None
            
        return {
            'price_to_sales_ttm': parse_decimal(data.get('PriceToSalesRatioTTM')),
            'forward_pe': parse_decimal(data.get('ForwardPE')),
            'trailing_pe': parse_decimal(data.get('TrailingPE')),
            'peg_ratio': parse_decimal(data.get('PEGRatio')),
            'pe_ratio': parse_decimal(data.get('PERatio')),
            'ev_to_revenue': parse_decimal(data.get('EVToRevenue')),
            'ev_to_ebitda': parse_decimal(data.get('EVToEBITDA')),
            'profit_margin': parse_decimal(data.get('ProfitMargin')),
            'revenue_ttm': parse_decimal(data.get('RevenueTTM')),
            'quarterly_revenue_growth_yoy': parse_decimal(data.get('QuarterlyRevenueGrowthYOY')),
        }
    except Exception as e:
        print(f"  Error fetching {symbol}: {e}")
        return None

def update_metadata(conn, asset_id, symbol, data):
    """Update equity_metadata with new fundamental data."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE equity_metadata SET
                price_to_sales_ttm = COALESCE(%s, price_to_sales_ttm),
                forward_pe = COALESCE(%s, forward_pe),
                trailing_pe = COALESCE(%s, trailing_pe),
                peg_ratio = COALESCE(%s, peg_ratio),
                pe_ratio = COALESCE(%s, pe_ratio),
                ev_to_revenue = COALESCE(%s, ev_to_revenue),
                ev_to_ebitda = COALESCE(%s, ev_to_ebitda),
                profit_margin = COALESCE(%s, profit_margin),
                revenue_ttm = COALESCE(%s, revenue_ttm),
                quarterly_revenue_growth_yoy = COALESCE(%s, quarterly_revenue_growth_yoy),
                last_updated = NOW()
            WHERE asset_id = %s
        """, (
            data.get('price_to_sales_ttm'),
            data.get('forward_pe'),
            data.get('trailing_pe'),
            data.get('peg_ratio'),
            data.get('pe_ratio'),
            data.get('ev_to_revenue'),
            data.get('ev_to_ebitda'),
            data.get('profit_margin'),
            data.get('revenue_ttm'),
            data.get('quarterly_revenue_growth_yoy'),
            asset_id
        ))
    conn.commit()

def main(limit=None):
    print(f"Starting fundamental data update at {datetime.now()}")
    
    conn = get_connection()
    
    # Get assets needing updates
    assets = get_assets_needing_fundamentals(conn, limit)
    total = len(assets)
    print(f"Found {total} assets needing fundamental data updates")
    
    success_count = 0
    fail_count = 0
    skip_count = 0
    
    for i, (asset_id, symbol, name, needs_ps, needs_fwd_pe) in enumerate(assets):
        print(f"[{i+1}/{total}] {symbol} ({name[:30]}...)")
        
        data = fetch_alpha_vantage_overview(symbol)
        
        if data:
            # Check if we got useful data
            got_ps = data.get('price_to_sales_ttm') is not None
            got_fwd_pe = data.get('forward_pe') is not None
            
            if got_ps or got_fwd_pe:
                update_metadata(conn, asset_id, symbol, data)
                print(f"  ✓ Updated (P/S: {data.get('price_to_sales_ttm')}, Fwd P/E: {data.get('forward_pe')})")
                success_count += 1
            else:
                print(f"  - No useful data available (company may be unprofitable/pre-revenue)")
                skip_count += 1
        else:
            print(f"  ✗ Failed to fetch data")
            fail_count += 1
        
        # Rate limiting
        time.sleep(REQUEST_DELAY)
        
        # Progress report every 50 assets
        if (i + 1) % 50 == 0:
            print(f"\n=== Progress: {i+1}/{total} | Success: {success_count} | Skipped: {skip_count} | Failed: {fail_count} ===\n")
    
    conn.close()
    
    print(f"\n=== COMPLETE ===")
    print(f"Total processed: {total}")
    print(f"Success: {success_count}")
    print(f"Skipped (no data available): {skip_count}")
    print(f"Failed: {fail_count}")
    
    # Remind to refresh materialized view
    print(f"\n⚠️  Remember to refresh the materialized view:")
    print(f"    REFRESH MATERIALIZED VIEW mv_dashboard_all_assets;")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Update missing fundamental data')
    parser.add_argument('--limit', type=int, help='Limit number of assets to process')
    args = parser.parse_args()
    
    main(limit=args.limit)

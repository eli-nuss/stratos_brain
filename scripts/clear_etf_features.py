#!/usr/bin/env python3
"""
Clear ETF Features
==================
Removes ETF feature records for a specific date so they can be recalculated.

Usage:
    python scripts/clear_etf_features.py --date 2026-01-27
"""

import os
import sys
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')

def clear_etf_features(target_date: str) -> int:
    """Delete ETF feature records for target_date."""
    if not DATABASE_URL:
        print("Error: DATABASE_URL not set")
        return 0
    
    conn = psycopg2.connect(DATABASE_URL)
    
    with conn.cursor() as cur:
        # Get count before delete
        cur.execute("""
            SELECT COUNT(*) FROM daily_features df
            JOIN assets a ON df.asset_id = a.asset_id
            WHERE df.date = %s AND a.asset_type = 'etf'
        """, (target_date,))
        count = cur.fetchone()[0]
        
        if count == 0:
            print(f"No ETF features found for {target_date}")
            return 0
        
        print(f"Found {count} ETF feature records to delete for {target_date}")
        
        # Delete ETF features for target date
        cur.execute("""
            DELETE FROM daily_features df
            WHERE df.date = %s 
              AND df.asset_id IN (SELECT asset_id FROM assets WHERE asset_type = 'etf')
        """, (target_date,))
        
        deleted = cur.rowcount
        conn.commit()
        
        print(f"✅ Deleted {deleted} ETF feature records")
        return deleted

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', required=True, help='Date to clear (YYYY-MM-DD)')
    args = parser.parse_args()
    
    clear_etf_features(args.date)

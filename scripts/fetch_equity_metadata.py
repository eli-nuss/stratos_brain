#!/usr/bin/env python3
"""
Fetch missing equity metadata from Yahoo Finance.
Updates equity_metadata table with industry, sector, description, market_cap, pe_ratio, etc.
Includes rate limiting and retry logic to handle Yahoo Finance throttling.
"""

import os
import sys
import time
import random
import psycopg2
import yfinance as yf
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Database connection
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# Rate limiting settings
BASE_DELAY = 0.5  # Base delay between requests
MAX_DELAY = 30    # Maximum delay after rate limiting
BATCH_SIZE = 50   # Pause longer every N requests
BATCH_PAUSE = 5   # Seconds to pause between batches

def get_connection():
    return psycopg2.connect(DB_URL)

def get_symbols_needing_metadata(conn):
    """Get active equities missing industry OR description."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT a.symbol, a.asset_id, a.name,
                   em.industry IS NOT NULL as has_industry,
                   em.description IS NOT NULL as has_description
            FROM assets a
            LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
            WHERE a.asset_type = 'equity' 
              AND a.is_active = true 
              AND (em.industry IS NULL OR em.description IS NULL)
            ORDER BY a.symbol
        """)
        return cur.fetchall()

def safe_numeric(value, max_value=99999999.99):
    """Convert value to safe numeric, handling infinity, NaN, and very large values."""
    if value is None:
        return None
    import math
    try:
        # Handle string 'Infinity' or other non-numeric
        if isinstance(value, str):
            value = float(value)
        # Check for infinity or NaN
        if isinstance(value, (int, float)):
            if math.isinf(value) or math.isnan(value):
                return None
            # Cap very large values that would overflow the database field
            if abs(value) > max_value:
                return None
        return value
    except (ValueError, TypeError):
        return None

def fetch_yahoo_metadata(symbol, retry_count=0):
    """Fetch metadata from Yahoo Finance for a single symbol with retry logic."""
    max_retries = 3
    
    try:
        # Convert preferred stock symbols (e.g., ALL-P-B -> ALL-PB for Yahoo)
        yahoo_symbol = symbol.replace('-P-', '-P')
        
        ticker = yf.Ticker(yahoo_symbol)
        info = ticker.info
        
        # Check if we got valid data
        if not info or info.get('regularMarketPrice') is None:
            return None
            
        return {
            'symbol': symbol,
            'name': info.get('longName') or info.get('shortName'),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
            'description': info.get('longBusinessSummary'),
            'market_cap': safe_numeric(info.get('marketCap'), max_value=999999999999999.99),  # Allow up to quadrillions
            'pe_ratio': safe_numeric(info.get('trailingPE')),
            'dividend_yield': safe_numeric(info.get('dividendYield')),
            'beta': safe_numeric(info.get('beta')),
            'eps': safe_numeric(info.get('trailingEps')),
            'book_value': safe_numeric(info.get('bookValue')),
            'week_52_high': safe_numeric(info.get('fiftyTwoWeekHigh')),
            'week_52_low': safe_numeric(info.get('fiftyTwoWeekLow')),
            'exchange': info.get('exchange'),
            'currency': info.get('currency'),
            'country': info.get('country'),
        }
    except Exception as e:
        error_str = str(e)
        
        # Handle rate limiting
        if '429' in error_str or 'Too Many Requests' in error_str:
            if retry_count < max_retries:
                wait_time = min(MAX_DELAY, (2 ** retry_count) * 5 + random.uniform(1, 5))
                print(f"  Rate limited, waiting {wait_time:.1f}s before retry {retry_count + 1}...", flush=True)
                time.sleep(wait_time)
                return fetch_yahoo_metadata(symbol, retry_count + 1)
            else:
                print(f"  Max retries reached for {symbol}", flush=True)
                return None
        
        # Suppress common 404 errors for preferred stocks
        if '404' not in error_str:
            print(f"  Error fetching {symbol}: {e}", flush=True)
        return None

def upsert_metadata(conn, asset_id, symbol, metadata):
    """Insert or update equity_metadata record."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO equity_metadata (
                symbol, asset_id, name, sector, industry, description,
                market_cap, pe_ratio, dividend_yield, beta, eps, book_value,
                week_52_high, week_52_low, exchange, currency, country,
                last_updated
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                NOW()
            )
            ON CONFLICT (symbol) DO UPDATE SET
                asset_id = EXCLUDED.asset_id,
                name = COALESCE(EXCLUDED.name, equity_metadata.name),
                sector = COALESCE(EXCLUDED.sector, equity_metadata.sector),
                industry = COALESCE(EXCLUDED.industry, equity_metadata.industry),
                description = COALESCE(EXCLUDED.description, equity_metadata.description),
                market_cap = COALESCE(EXCLUDED.market_cap, equity_metadata.market_cap),
                pe_ratio = COALESCE(EXCLUDED.pe_ratio, equity_metadata.pe_ratio),
                dividend_yield = COALESCE(EXCLUDED.dividend_yield, equity_metadata.dividend_yield),
                beta = COALESCE(EXCLUDED.beta, equity_metadata.beta),
                eps = COALESCE(EXCLUDED.eps, equity_metadata.eps),
                book_value = COALESCE(EXCLUDED.book_value, equity_metadata.book_value),
                week_52_high = COALESCE(EXCLUDED.week_52_high, equity_metadata.week_52_high),
                week_52_low = COALESCE(EXCLUDED.week_52_low, equity_metadata.week_52_low),
                exchange = COALESCE(EXCLUDED.exchange, equity_metadata.exchange),
                currency = COALESCE(EXCLUDED.currency, equity_metadata.currency),
                country = COALESCE(EXCLUDED.country, equity_metadata.country),
                last_updated = NOW()
        """, (
            symbol,
            asset_id,
            metadata.get('name'),
            metadata.get('sector'),
            metadata.get('industry'),
            metadata.get('description'),
            metadata.get('market_cap'),
            metadata.get('pe_ratio'),
            metadata.get('dividend_yield'),
            metadata.get('beta'),
            metadata.get('eps'),
            metadata.get('book_value'),
            metadata.get('week_52_high'),
            metadata.get('week_52_low'),
            metadata.get('exchange'),
            metadata.get('currency'),
            metadata.get('country'),
        ))
    conn.commit()

def main():
    print(f"Starting equity metadata fetch at {datetime.now()}", flush=True)
    print(f"Rate limiting: {BASE_DELAY}s base delay, {BATCH_PAUSE}s pause every {BATCH_SIZE} requests", flush=True)
    
    conn = get_connection()
    
    # Get symbols needing metadata
    symbols = get_symbols_needing_metadata(conn)
    total = len(symbols)
    print(f"Found {total} symbols needing metadata updates", flush=True)
    
    success_count = 0
    fail_count = 0
    skip_count = 0
    consecutive_failures = 0
    
    for i, (symbol, asset_id, name, has_industry, has_description) in enumerate(symbols):
        # Progress indicator every symbol
        status = f"[{i+1}/{total}] {symbol}"
        
        metadata = fetch_yahoo_metadata(symbol)
        
        if metadata:
            # Check if we got the data we need
            got_industry = metadata.get('industry') is not None
            got_description = metadata.get('description') is not None
            
            if got_industry or got_description:
                upsert_metadata(conn, asset_id, symbol, metadata)
                print(f"{status} ✓ (ind:{got_industry}, desc:{got_description})", flush=True)
                success_count += 1
                consecutive_failures = 0
            else:
                print(f"{status} - no useful data", flush=True)
                skip_count += 1
                consecutive_failures = 0
        else:
            print(f"{status} ✗", flush=True)
            fail_count += 1
            consecutive_failures += 1
            
            # If we get many consecutive failures, slow down
            if consecutive_failures >= 5:
                extra_wait = min(30, consecutive_failures * 2)
                print(f"  {consecutive_failures} consecutive failures, extra wait {extra_wait}s", flush=True)
                time.sleep(extra_wait)
        
        # Rate limiting
        if (i + 1) % BATCH_SIZE == 0:
            print(f"\n=== Progress: {i+1}/{total} | Success: {success_count} | Failed: {fail_count} | Skipped: {skip_count} ===", flush=True)
            print(f"=== Batch pause: {BATCH_PAUSE}s ===\n", flush=True)
            time.sleep(BATCH_PAUSE)
        else:
            # Add jitter to base delay
            delay = BASE_DELAY + random.uniform(0, 0.3)
            time.sleep(delay)
    
    conn.close()
    
    print(f"\n=== COMPLETE ===", flush=True)
    print(f"Total processed: {total}", flush=True)
    print(f"Success: {success_count}", flush=True)
    print(f"Failed: {fail_count}", flush=True)
    print(f"Skipped (no useful data): {skip_count}", flush=True)

if __name__ == "__main__":
    main()

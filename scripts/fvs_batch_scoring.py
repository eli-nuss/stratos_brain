#!/usr/bin/env python3
"""
Fundamental Vigor Score (FVS) Batch Scoring Script

This script processes equities in batches to calculate FVS scores using the
Edge Function API. It's designed to be run as a GitHub Action on a schedule.

Usage:
    python fvs_batch_scoring.py [--limit N] [--symbols "AAPL MSFT"] [--refresh]

Environment Variables:
    - SUPABASE_URL: Supabase project URL
    - SUPABASE_SERVICE_KEY: Supabase service role key
    - FVS_API_URL: FVS Edge Function URL (optional, defaults to Supabase function)
"""

import os
import sys
import time
import json
import argparse
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

import requests
import psycopg2
from psycopg2.extras import RealDictCursor

# ============================================================================
# Configuration
# ============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database connection
DB_HOST = os.environ.get('DB_HOST', 'db.wfogbaipiqootjrsprde.supabase.co')
DB_NAME = os.environ.get('DB_NAME', 'postgres')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_PORT = os.environ.get('DB_PORT', '5432')

# FVS API
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://wfogbaipiqootjrsprde.supabase.co')
FVS_API_URL = os.environ.get('FVS_API_URL', f'{SUPABASE_URL}/functions/v1/fvs-api')

# Rate limiting
BATCH_SIZE = 3  # Process 3 symbols at a time (Edge Function limit is 5)
DELAY_BETWEEN_BATCHES = 5  # Seconds between batches
MAX_RETRIES = 3
RETRY_DELAY = 10  # Seconds between retries

# Cache settings
CACHE_DAYS = 7  # Don't re-score if scored within this many days


# ============================================================================
# Database Functions
# ============================================================================
def get_db_connection():
    """Create a database connection."""
    if not DB_PASSWORD:
        raise ValueError("DB_PASSWORD environment variable not set")
    
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT
    )


def get_equity_symbols(conn, limit: Optional[int] = None, symbols: Optional[List[str]] = None) -> List[Dict]:
    """
    Get list of equity symbols to process.
    
    Only returns equities that:
    1. Are active (is_active = true in assets table)
    2. Have equity_metadata (joined via asset_id)
    
    This matches the criteria used in the frontend dashboard view.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if symbols:
            # Process specific symbols
            placeholders = ','.join(['%s'] * len(symbols))
            query = f"""
                SELECT em.asset_id, em.symbol, em.name as company_name
                FROM equity_metadata em
                JOIN assets a ON em.asset_id = a.asset_id
                WHERE em.symbol IN ({placeholders})
                  AND a.is_active = true
                ORDER BY em.symbol
            """
            cur.execute(query, symbols)
        else:
            # Get all active equities that appear in the dashboard
            # This matches the v_dashboard_all_assets view criteria
            query = """
                SELECT em.asset_id, em.symbol, em.name as company_name, em.market_cap
                FROM equity_metadata em
                JOIN assets a ON em.asset_id = a.asset_id
                WHERE em.symbol IS NOT NULL
                  AND a.is_active = true
                  AND a.asset_type = 'equity'
                ORDER BY em.market_cap DESC NULLS LAST, em.symbol
            """
            if limit:
                query += f" LIMIT {limit}"
            cur.execute(query)
        
        return cur.fetchall()


def get_recently_scored_symbols(conn, days: int = CACHE_DAYS) -> set:
    """Get symbols that have been scored recently."""
    cutoff_date = datetime.now().date() - timedelta(days=days)
    
    with conn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT em.symbol
            FROM fundamental_vigor_scores fvs
            JOIN equity_metadata em ON fvs.asset_id = em.asset_id
            WHERE fvs.as_of_date >= %s
        """, (cutoff_date,))
        
        return {row[0] for row in cur.fetchall()}


def get_scoring_stats(conn) -> Dict[str, Any]:
    """Get current FVS scoring statistics."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                COUNT(DISTINCT fvs.asset_id) as scored_count,
                COUNT(DISTINCT em.asset_id) as total_equities,
                MAX(fvs.as_of_date) as latest_score_date,
                AVG(fvs.final_score) as avg_score
            FROM equity_metadata em
            LEFT JOIN fundamental_vigor_scores fvs ON em.asset_id = fvs.asset_id
        """)
        return cur.fetchone()


# ============================================================================
# FVS API Functions
# ============================================================================
def call_fvs_api(symbols: List[str], refresh: bool = False) -> Dict[str, Any]:
    """Call the FVS Edge Function API."""
    if len(symbols) == 1:
        # Single symbol endpoint
        url = f"{FVS_API_URL}/score/{symbols[0]}"
        if refresh:
            url += "?refresh=true"
    else:
        # Batch endpoint
        symbols_param = ','.join(symbols)
        url = f"{FVS_API_URL}/batch?symbols={symbols_param}"
        if refresh:
            url += "&refresh=true"
    
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=120)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                # Rate limited, wait and retry
                logger.warning(f"Rate limited, waiting {RETRY_DELAY}s before retry...")
                time.sleep(RETRY_DELAY)
                continue
            else:
                logger.error(f"API error {response.status_code}: {response.text}")
                return {'error': f"HTTP {response.status_code}"}
                
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout on attempt {attempt + 1}/{MAX_RETRIES}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error: {e}")
            return {'error': str(e)}
    
    return {'error': 'Max retries exceeded'}


def check_api_health() -> bool:
    """Check if the FVS API is healthy."""
    try:
        response = requests.get(f"{FVS_API_URL}/health", timeout=10)
        if response.status_code == 200:
            health = response.json()
            logger.info(f"FVS API healthy: {health}")
            return True
        return False
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return False


# ============================================================================
# Main Processing
# ============================================================================
def process_batch(symbols: List[str], refresh: bool = False) -> Dict[str, Any]:
    """Process a batch of symbols and return results."""
    results = {
        'success': [],
        'failed': [],
        'skipped': []
    }
    
    logger.info(f"Processing batch: {', '.join(symbols)}")
    
    response = call_fvs_api(symbols, refresh)
    
    if 'error' in response:
        logger.error(f"Batch failed: {response['error']}")
        results['failed'].extend(symbols)
        return results
    
    # Handle single symbol response
    if 'symbol' in response:
        if response.get('finalScore') is not None:
            results['success'].append({
                'symbol': response['symbol'],
                'score': response['finalScore'],
                'tier': response.get('qualityTier', 'unknown')
            })
        else:
            results['failed'].append(response['symbol'])
    
    # Handle batch response
    elif 'results' in response:
        for symbol, data in response['results'].items():
            if isinstance(data, dict) and data.get('finalScore') is not None:
                results['success'].append({
                    'symbol': symbol,
                    'score': data['finalScore'],
                    'tier': data.get('qualityTier', 'unknown')
                })
            else:
                results['failed'].append(symbol)
    
    return results


def run_batch_scoring(
    limit: Optional[int] = None,
    symbols: Optional[List[str]] = None,
    refresh: bool = False,
    skip_recent: bool = True
):
    """Run the full batch scoring process."""
    start_time = datetime.now()
    logger.info("=" * 60)
    logger.info("FVS Batch Scoring Started")
    logger.info(f"Time: {start_time.isoformat()}")
    logger.info("=" * 60)
    
    # Check API health
    if not check_api_health():
        logger.error("FVS API is not healthy, aborting")
        sys.exit(1)
    
    # Connect to database
    conn = get_db_connection()
    
    try:
        # Get initial stats
        stats = get_scoring_stats(conn)
        logger.info(f"Current stats: {stats['scored_count']}/{stats['total_equities']} equities scored")
        
        # Get symbols to process
        equities = get_equity_symbols(conn, limit, symbols)
        logger.info(f"Found {len(equities)} equities to consider")
        
        # Filter out recently scored (unless refresh or specific symbols)
        if skip_recent and not symbols and not refresh:
            recent = get_recently_scored_symbols(conn)
            equities = [e for e in equities if e['symbol'] not in recent]
            logger.info(f"After filtering recent: {len(equities)} equities to process")
        
        if not equities:
            logger.info("No equities to process")
            return
        
        # Process in batches
        total_success = 0
        total_failed = 0
        all_results = []
        
        for i in range(0, len(equities), BATCH_SIZE):
            batch = equities[i:i + BATCH_SIZE]
            batch_symbols = [e['symbol'] for e in batch]
            
            logger.info(f"\nBatch {i // BATCH_SIZE + 1}/{(len(equities) + BATCH_SIZE - 1) // BATCH_SIZE}")
            
            results = process_batch(batch_symbols, refresh)
            
            total_success += len(results['success'])
            total_failed += len(results['failed'])
            all_results.extend(results['success'])
            
            # Log progress
            for s in results['success']:
                logger.info(f"  ✓ {s['symbol']}: {s['score']:.1f} ({s['tier']})")
            for f in results['failed']:
                logger.warning(f"  ✗ {f}: Failed")
            
            # Delay between batches
            if i + BATCH_SIZE < len(equities):
                time.sleep(DELAY_BETWEEN_BATCHES)
        
        # Final stats
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        logger.info("\n" + "=" * 60)
        logger.info("FVS Batch Scoring Complete")
        logger.info("=" * 60)
        logger.info(f"Duration: {duration:.1f} seconds")
        logger.info(f"Processed: {total_success + total_failed} symbols")
        logger.info(f"Success: {total_success}")
        logger.info(f"Failed: {total_failed}")
        
        if all_results:
            avg_score = sum(r['score'] for r in all_results) / len(all_results)
            logger.info(f"Average FVS: {avg_score:.1f}")
            
            # Score distribution
            tiers = {}
            for r in all_results:
                tier = r['tier']
                tiers[tier] = tiers.get(tier, 0) + 1
            logger.info(f"Tier distribution: {tiers}")
        
        # Get updated stats
        final_stats = get_scoring_stats(conn)
        logger.info(f"Final coverage: {final_stats['scored_count']}/{final_stats['total_equities']} equities")
        
    finally:
        conn.close()


# ============================================================================
# CLI
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description='FVS Batch Scoring')
    parser.add_argument('--limit', type=int, help='Maximum number of equities to process')
    parser.add_argument('--symbols', type=str, help='Space-separated list of symbols to process')
    parser.add_argument('--refresh', action='store_true', help='Force refresh even if recently scored')
    parser.add_argument('--include-recent', action='store_true', help='Include recently scored symbols')
    
    args = parser.parse_args()
    
    symbols = args.symbols.split() if args.symbols else None
    
    run_batch_scoring(
        limit=args.limit,
        symbols=symbols,
        refresh=args.refresh,
        skip_recent=not args.include_recent
    )


if __name__ == '__main__':
    main()

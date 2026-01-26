#!/usr/bin/env python3
"""
Batch AI Analysis Runner for E2B Parallel Processing.

This script processes a specific batch of assets based on offset and batch_size.
Designed to be run in parallel E2B sandboxes, each handling a different slice.

Usage:
    python run_ai_analysis_batch.py --date 2026-01-25 --asset-type equity --offset 0 --batch-size 50
"""

import argparse
import logging
import os
import sys

# Add the specific module directory to path to avoid importing all stages via __init__.py
# This is necessary because E2B sandboxes only have minimal dependencies installed
_stages_dir = os.path.join(os.path.dirname(__file__), '..', 'src', 'stratos_engine', 'stages')
sys.path.insert(0, _stages_dir)

# Direct import from the module file, bypassing __init__.py
from stage5_ai_review_v3 import Stage5AIReviewV3

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_assets_batch(reviewer, as_of_date: str, asset_type: str, offset: int, batch_size: int):
    """Get a specific batch of assets based on offset and batch_size."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    conn = psycopg2.connect(reviewer.db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # First get assets with active quant setups
            query = """
            WITH ranked_assets AS (
                -- Assets with setups first, then others
                SELECT 
                    a.asset_id, 
                    a.symbol, 
                    a.asset_type, 
                    a.name,
                    CASE WHEN ss.asset_id IS NOT NULL THEN TRUE ELSE FALSE END as has_active_setup,
                    ROW_NUMBER() OVER (
                        ORDER BY 
                            CASE WHEN ss.asset_id IS NOT NULL THEN 0 ELSE 1 END,
                            a.asset_id
                    ) as rn
                FROM assets a
                LEFT JOIN (
                    SELECT DISTINCT asset_id 
                    FROM setup_signals 
                    WHERE signal_date = %s
                ) ss ON a.asset_id = ss.asset_id
                WHERE a.is_active = TRUE
            """
            params = [as_of_date]
            
            if asset_type and asset_type != 'all':
                query += " AND a.asset_type = %s"
                params.append(asset_type)
            
            query += """
            )
            SELECT asset_id, symbol, asset_type, name, has_active_setup
            FROM ranked_assets
            WHERE rn > %s AND rn <= %s
            ORDER BY rn
            """
            params.extend([offset, offset + batch_size])
            
            cur.execute(query, params)
            return list(cur.fetchall())
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Run AI analysis for a batch of assets')
    parser.add_argument('--date', type=str, required=True,
                        help='Target date (YYYY-MM-DD)')
    parser.add_argument('--asset-type', type=str, choices=['crypto', 'equity', 'all'], default='all',
                        help='Asset type to process')
    parser.add_argument('--model', type=str, default='gemini-3-flash-preview',
                        help='Gemini model to use')
    parser.add_argument('--offset', type=int, required=True,
                        help='Starting offset (0-indexed)')
    parser.add_argument('--batch-size', type=int, required=True,
                        help='Number of assets to process in this batch')
    
    args = parser.parse_args()
    
    logger.info(f"Starting AI Analysis Batch")
    logger.info(f"  Date: {args.date}")
    logger.info(f"  Asset Type: {args.asset_type}")
    logger.info(f"  Model: {args.model}")
    logger.info(f"  Offset: {args.offset}")
    logger.info(f"  Batch Size: {args.batch_size}")
    
    # Initialize reviewer
    reviewer = Stage5AIReviewV3(model=args.model)
    
    # Get batch of assets
    assets = get_assets_batch(
        reviewer,
        args.date,
        args.asset_type,
        args.offset,
        args.batch_size
    )
    
    logger.info(f"Found {len(assets)} assets in batch (offset={args.offset}, size={args.batch_size})")
    
    if not assets:
        logger.info("No assets to process in this batch")
        return
    
    # Process each asset
    processed = 0
    errors = 0
    
    for asset in assets:
        try:
            result = reviewer.analyze_asset(
                asset_id=asset['asset_id'],
                symbol=asset['symbol'],
                as_of_date=args.date,
                name=asset.get('name', ''),
                asset_type=asset['asset_type']
            )
            if result:
                processed += 1
                logger.info(f"✓ Processed {asset['symbol']} ({processed}/{len(assets)})")
            else:
                errors += 1
                logger.warning(f"✗ No result for {asset['symbol']}")
        except Exception as e:
            errors += 1
            logger.error(f"Error processing {asset['symbol']}: {e}")
    
    logger.info(f"Batch complete: {processed} processed, {errors} errors")
    
    # Exit with error code if too many failures
    if errors > len(assets) * 0.5:
        sys.exit(1)


if __name__ == '__main__':
    main()

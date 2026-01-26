#!/usr/bin/env python3
"""
AI Analysis v3 - Constrained Autonomy with Quant Setup Integration

This script runs the Stage5AIReviewV3 analysis which integrates quant setup signals
from the setup_signals table with AI analysis for a unified trading recommendation.

Usage:
    python scripts/run_ai_analysis_v3.py --date 2026-01-25
    python scripts/run_ai_analysis_v3.py --date 2026-01-25 --asset-type crypto --limit 100
    python scripts/run_ai_analysis_v3.py  # defaults to yesterday
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description='Run AI Analysis v3 with Quant Setup Integration')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD). Defaults to yesterday.')
    parser.add_argument('--asset-type', type=str, choices=['crypto', 'equity', 'all'], default='all',
                        help='Asset type to process')
    parser.add_argument('--model', type=str, default='gemini-3-flash-preview',
                        help='Gemini model to use')
    parser.add_argument('--limit', type=int, default=500,
                        help='Number of assets to process')
    
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')
    
    logger.info(f"Starting AI Analysis v3 (Constrained Autonomy)")
    logger.info(f"  Date: {target_date}")
    logger.info(f"  Asset Type: {args.asset_type}")
    logger.info(f"  Model: {args.model}")
    logger.info(f"  Limit: {args.limit}")
    
    # Import and run the Stage5AIReviewV3
    from stratos_engine.stages.stage5_ai_review_v3 import Stage5AIReviewV3
    
    reviewer = Stage5AIReviewV3(model=args.model)
    
    # Get assets to process
    assets = reviewer.get_assets_to_process(
        as_of_date=target_date,
        asset_type=args.asset_type if args.asset_type != 'all' else None,
        limit=args.limit
    )
    
    logger.info(f"Found {len(assets)} assets to process")
    
    # Process each asset
    processed = 0
    errors = 0
    
    for asset in assets:
        try:
            result = reviewer.analyze_asset(
                asset_id=asset['asset_id'],
                symbol=asset['symbol'],
                as_of_date=target_date
            )
            if result:
                processed += 1
                if processed % 10 == 0:
                    logger.info(f"Processed {processed}/{len(assets)} assets")
        except Exception as e:
            errors += 1
            logger.error(f"Error processing {asset['symbol']}: {e}")
    
    logger.info(f"Completed: {processed} processed, {errors} errors")

if __name__ == '__main__':
    main()

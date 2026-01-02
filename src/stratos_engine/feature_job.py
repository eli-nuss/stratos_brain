"""
Stratos Feature Calculation Job Runner

This module provides a Cloud Run Job entrypoint for running daily feature calculations.
It can be triggered by Cloud Scheduler or manually via gcloud.

Usage:
    # Run incremental update (yesterday + today)
    python -m stratos_engine.feature_job --incremental
    
    # Run for specific date range
    python -m stratos_engine.feature_job --start-date 2026-01-01 --end-date 2026-01-01
    
    # Run for specific asset type
    python -m stratos_engine.feature_job --incremental --asset-type crypto
"""

import os
import sys
import argparse
import logging
from datetime import date, timedelta
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_feature_calculation(
    start_date: date,
    end_date: date,
    asset_type: Optional[str] = None,
    batch_size: int = 50
) -> dict:
    """
    Run feature calculation for the specified date range.
    
    Args:
        start_date: Start date for calculation
        end_date: End date for calculation
        asset_type: Optional filter ('crypto', 'equity')
        batch_size: Number of assets to process before logging progress
        
    Returns:
        dict with processing statistics
    """
    from .utils.feature_calculator import FeatureCalculator
    
    # Get Supabase credentials from environment
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables")
    
    logger.info(f"Initializing feature calculator...")
    logger.info(f"Date range: {start_date} to {end_date}")
    logger.info(f"Asset type filter: {asset_type or 'all'}")
    
    calculator = FeatureCalculator(supabase_url, supabase_key)
    
    # Run backfill (works for both backfill and incremental)
    result = calculator.backfill(
        start_date=start_date,
        end_date=end_date,
        asset_type=asset_type,
        batch_size=batch_size
    )
    
    logger.info(f"Feature calculation complete: {result}")
    return result


def main():
    """Main entrypoint for the feature calculation job."""
    parser = argparse.ArgumentParser(
        description='Stratos Feature Calculation Job',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Daily incremental update
    python -m stratos_engine.feature_job --incremental
    
    # Specific date range
    python -m stratos_engine.feature_job --start-date 2026-01-01 --end-date 2026-01-01
    
    # Only crypto assets
    python -m stratos_engine.feature_job --incremental --asset-type crypto
        """
    )
    
    parser.add_argument(
        '--incremental',
        action='store_true',
        help='Run incremental update (yesterday and today)'
    )
    parser.add_argument(
        '--start-date',
        type=str,
        help='Start date (YYYY-MM-DD). Required if not using --incremental'
    )
    parser.add_argument(
        '--end-date',
        type=str,
        help='End date (YYYY-MM-DD). Defaults to today'
    )
    parser.add_argument(
        '--asset-type',
        type=str,
        choices=['crypto', 'equity', 'commodity', 'fx', 'rate', 'etf', 'index'],
        help='Filter by asset type'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=50,
        help='Batch size for progress logging (default: 50)'
    )
    
    args = parser.parse_args()
    
    # Determine date range
    today = date.today()
    
    if args.incremental:
        # Incremental: process yesterday and today
        start_date = today - timedelta(days=1)
        end_date = today
        logger.info("Running incremental update mode")
    elif args.start_date:
        start_date = date.fromisoformat(args.start_date)
        end_date = date.fromisoformat(args.end_date) if args.end_date else today
    else:
        parser.error("Either --incremental or --start-date is required")
        return 1
    
    try:
        result = run_feature_calculation(
            start_date=start_date,
            end_date=end_date,
            asset_type=args.asset_type,
            batch_size=args.batch_size
        )
        
        # Log summary
        logger.info("=" * 60)
        logger.info("FEATURE CALCULATION JOB COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Total assets: {result.get('total_assets', 0)}")
        logger.info(f"Processed: {result.get('processed', 0)}")
        logger.info(f"Skipped: {result.get('skipped', 0)}")
        logger.info(f"Total rows written: {result.get('total_rows', 0)}")
        logger.info(f"Errors: {len(result.get('errors', []))}")
        
        if result.get('errors'):
            logger.warning("Errors encountered:")
            for err in result['errors'][:10]:  # Show first 10 errors
                logger.warning(f"  - Asset {err['asset_id']} ({err['symbol']}): {err['error']}")
            if len(result['errors']) > 10:
                logger.warning(f"  ... and {len(result['errors']) - 10} more errors")
        
        return 0
        
    except Exception as e:
        logger.error(f"Feature calculation failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())

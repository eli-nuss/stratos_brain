#!/usr/bin/env python3
"""
Run AI analysis for all crypto assets and top 500 equities.
Uses the new Stage5AIReviewV2 which has no dependency on Stage 4 scoring.
"""

import os
import sys
import logging
import argparse
from datetime import date

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from stratos_engine.db import Database
from stratos_engine.stages.stage5_ai_review_v2 import Stage5AIReviewV2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Run AI Analysis (Stage 5 v2)")
    parser.add_argument("--date", type=str, default=str(date.today()),
                       help="Target date (YYYY-MM-DD)")
    parser.add_argument("--asset-type", type=str, choices=['crypto', 'equity'],
                       help="Filter to specific asset type (default: both)")
    parser.add_argument("--model", type=str, default="gemini-3-flash",
                       help="AI model to use")
    
    args = parser.parse_args()
    
    logger.info(f"Starting AI Analysis v2")
    logger.info(f"  Date: {args.date}")
    logger.info(f"  Asset Type: {args.asset_type or 'all'}")
    logger.info(f"  Model: {args.model}")
    
    # Initialize database
    db = Database()
    
    # Initialize Stage 5 v2
    stage5 = Stage5AIReviewV2(db, model=args.model)
    
    # Run analysis
    summary = stage5.run(args.date, asset_type=args.asset_type)
    
    logger.info(f"Completed: {summary}")
    
    db.close()


if __name__ == "__main__":
    main()

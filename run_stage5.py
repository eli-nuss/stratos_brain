#!/usr/bin/env python3
"""
Script to run Stage 5 AI Review for the latest signaled date.
Uses gemini-3-pro-preview model as specified.
"""

import os
import sys
import logging
from datetime import datetime

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from stratos_engine.stages.stage5_ai_review import Stage5AIReview
from stratos_engine.db import Database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def find_latest_signaled_date(db: Database) -> str:
    """Find the latest date with signaled assets."""
    query = """
    SELECT as_of_date 
    FROM daily_asset_scores 
    WHERE inflection_score != 0 
    ORDER BY as_of_date DESC 
    LIMIT 1
    """
    result = db.fetch_one(query)
    return str(result['as_of_date']) if result else None

def count_signaled_assets(db: Database, as_of_date: str) -> int:
    """Count the number of signaled assets for a given date."""
    query = """
    SELECT COUNT(*) as count 
    FROM daily_asset_scores 
    WHERE as_of_date = %s AND inflection_score != 0
    """
    result = db.fetch_one(query, (as_of_date,))
    return result['count'] if result else 0

if __name__ == "__main__":
    # Load .env file
    from dotenv import load_dotenv
    load_dotenv()
    
    # GEMINI_API_KEY should be set in environment or .env file
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        logger.error("GEMINI_API_KEY not set in environment. Please set it before running.")
        sys.exit(1)
    
    # Initialize database connection
    db = Database()
    
    # Find the latest signaled date
    latest_date = find_latest_signaled_date(db)
    
    if not latest_date:
        logger.warning("No signaled assets found to review.")
        sys.exit(0)
    
    # Count assets to process
    asset_count = count_signaled_assets(db, latest_date)
    logger.info(f"Found {asset_count} signaled assets for date: {latest_date}")
    
    # Initialize Stage 5 with gemini-3-pro-preview model
    logger.info("Initializing Stage5AIReview with gemini-3-pro-preview model...")
    review_stage = Stage5AIReview(
        db=db,
        model="gemini-3-pro-preview"  # Use the specified model
    )
    
    # Run the AI review
    logger.info(f"Starting Stage 5 AI Review run for date: {latest_date}")
    start_time = datetime.now()
    
    try:
        review_stage.run(
            as_of_date=latest_date,
            limit_per_scope=5,  # Process only 5 assets for testing
            run_pass_b=False  # Only run Pass A for now
        )
        
        elapsed = datetime.now() - start_time
        logger.info(f"Stage 5 AI Review completed in {elapsed.total_seconds():.1f} seconds")
        
    except Exception as e:
        logger.error(f"Error during AI review: {e}")
        raise
    finally:
        db.close()

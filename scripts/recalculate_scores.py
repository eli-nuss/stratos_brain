#!/usr/bin/env python3
"""
Recalculate scores for all assets with the new scoring logic:
1. Re-run Stage 1 to update signal facts with weight values
2. Re-run Stage 4 to recalculate scores with baseline subtraction
"""

import os
import sys
from datetime import datetime, timedelta

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from stratos_engine.db import Database
from stratos_engine.stages.stage1_evaluate import Stage1Evaluate
from stratos_engine.stages.stage4_scoring import Stage4Scoring

# Configuration
CONFIG_ID = "6a6cd5d6-1f43-475b-a0e7-2fe6fdffe714"  # Default config ID from engine_configs
UNIVERSES = [
    "crypto_top200",
    "equities_top500",
]

def main():
    print("=" * 60)
    print("RECALCULATING SCORES WITH NEW SCORING LOGIC")
    print("=" * 60)
    print("\nChanges applied:")
    print("1. Weight propagation: weight = base_weight / 20")
    print("2. Baseline subtraction: contribution = max(strength - 50, 0) * weight")
    print("3. Weighted delta: delta from weighted_score, not raw score")
    print("4. Exhaustion booster: requires RSI <= 30 AND accel_turn_up")
    print()
    
    # Connect to database
    db = Database()
    
    # Get the current date (or use yesterday if running early morning)
    as_of_date = datetime.now().strftime("%Y-%m-%d")
    
    # Also process yesterday to ensure delta calculation works
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    dates_to_process = [yesterday, as_of_date]
    
    for universe_id in UNIVERSES:
        print(f"\n{'='*60}")
        print(f"Processing universe: {universe_id}")
        print(f"{'='*60}")
        
        for date in dates_to_process:
            print(f"\n--- Date: {date} ---")
            
            # Stage 1: Re-evaluate signals to update weights
            print(f"  Stage 1: Evaluating signals...")
            stage1 = Stage1Evaluate(db)
            result1 = stage1.run(
                as_of_date=date,
                universe_id=universe_id,
                config_id=CONFIG_ID,
                write=True
            )
            print(f"    - Assets evaluated: {result1.get('assets_evaluated', 0)}")
            print(f"    - Signals generated: {result1.get('signals_generated', 0)}")
            print(f"    - By direction: {result1.get('by_direction', {})}")
            
            # Stage 4: Recalculate scores
            print(f"  Stage 4: Scoring assets...")
            stage4 = Stage4Scoring(db)
            result4 = stage4.run(
                as_of_date=date,
                universe_id=universe_id,
                config_id=CONFIG_ID
            )
            print(f"    - Assets scored: {result4.get('assets_scored', 0)}")
    
    # Show sample of new scores
    print(f"\n{'='*60}")
    print("SAMPLE OF NEW SCORES (Top 10 by weighted_score)")
    print(f"{'='*60}")
    
    query = """
    SELECT 
        a.symbol,
        a.name,
        das.weighted_score,
        das.score_delta,
        das.score_total as raw_score,
        das.components
    FROM daily_asset_scores das
    JOIN assets a ON das.asset_id::text = a.asset_id::text
    WHERE das.as_of_date = %s
      AND das.universe_id = 'crypto_top200'
      AND das.config_id = %s
    ORDER BY das.weighted_score DESC
    LIMIT 10
    """
    
    results = db.fetch_all(query, (as_of_date, CONFIG_ID))
    
    print(f"\n{'Symbol':<10} {'Name':<25} {'Weighted':<10} {'Delta':<10} {'Raw':<10}")
    print("-" * 65)
    for row in results:
        print(f"{row['symbol']:<10} {row['name'][:24]:<25} {row['weighted_score'] or 0:>8.1f}  {row['score_delta'] or 0:>8.1f}  {row['raw_score'] or 0:>8.1f}")
    
    print("\n" + "=" * 60)
    print("RECALCULATION COMPLETE")
    print("=" * 60)
    
    db.close()

if __name__ == "__main__":
    main()

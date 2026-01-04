import os
import sys
import concurrent.futures
import time
from typing import Dict, Any, List

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env manually BEFORE imports
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    key, val = line.strip().split("=", 1)
                    os.environ[key] = val

load_env()

from src.stratos_engine.db import Database
from src.stratos_engine.stages.stage4_scoring import Stage4Scoring
from src.stratos_engine.stages.stage5_ai_review import Stage5AIReview

# Worker function for parallel execution
def process_asset_wrapper(args):
    target, as_of_date, config_id, skip_existing = args
    
    # Create a NEW database connection for this thread
    # This is crucial because psycopg2 connections are not thread-safe
    db = Database()
    db.connect()
    
    try:
        # Initialize Stage 5 with this thread's DB connection
        stage5 = Stage5AIReview(db)
        result = stage5.process_single_asset(target, as_of_date, config_id, skip_existing)
        return result
    except Exception as e:
        print(f"Worker error for {target['symbol']}: {e}")
        return {"symbol": target['symbol'], "status": "failed", "error": str(e)}
    finally:
        db.close()

def main():
    # Main thread DB connection for fetching targets
    db = Database()
    db.connect()

    target_date = "2026-01-02"
    config_id = "6a6cd5d6-1f43-475b-a0e7-2fe6fdffe714"
    max_workers = 10  # Run 10 parallel workers
    
    print(f"--- Starting PARALLEL Pipeline Run for {target_date} ---")
    print(f"Workers: {max_workers}")

    # 1. Run Stage 4: Signal Scoring (Sequential is fine/fast)
    print("\n[Stage 4] Running Signal Scoring...")
    stage4 = Stage4Scoring(db)
    universes = ["crypto_all", "equities_top500"]
    
    for universe in universes:
        print(f"  > Scoring universe: {universe}")
        stage4.run(as_of_date=target_date, universe_id=universe, config_id=config_id)
    
    print("\n[Stage 4] Scoring Complete.")

    # 2. Run Stage 5: AI Review (Parallel)
    print("\n[Stage 5] Running AI Review (Parallel)...")
    
    # Use main thread stage5 just to fetch targets
    stage5_main = Stage5AIReview(db)
    all_targets = []
    
    for universe in universes:
        print(f"  > Fetching targets for {universe}...")
        targets = stage5_main._get_flashed_assets(
            as_of_date=target_date,
            universe_id=universe,
            config_id=config_id,
            limit_per_scope=1000  # Get ALL targets
        )
        all_targets.extend(targets)
    
    print(f"\nFound {len(all_targets)} total assets to review.")
    
    # Prepare arguments for workers
    worker_args = [
        (target, target_date, config_id, True) # True = skip_existing
        for target in all_targets
    ]
    
    start_time = time.time()
    processed = 0
    skipped = 0
    failed = 0
    
    # Run in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_symbol = {
            executor.submit(process_asset_wrapper, args): args[0]['symbol'] 
            for args in worker_args
        }
        
        print(f"  > Processing with {max_workers} threads...")
        
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                res = future.result()
                status = res.get("status", "failed")
                
                if status == "processed":
                    processed += 1
                    details = res.get("details", {})
                    print(f"  ✓ {symbol}: {details.get('attention_level')} / {details.get('direction')}")
                elif status == "skipped":
                    skipped += 1
                    # print(f"  - {symbol}: Skipped (exists)")
                else:
                    failed += 1
                    print(f"  ✗ {symbol}: Failed")
                    
            except Exception as exc:
                print(f"  ✗ {symbol}: Exception {exc}")
                failed += 1
                
    elapsed = time.time() - start_time
    print(f"\n[Stage 5] Complete in {elapsed:.2f}s")
    print(f"Processed: {processed}, Skipped: {skipped}, Failed: {failed}")
    
    db.close()

if __name__ == "__main__":
    main()

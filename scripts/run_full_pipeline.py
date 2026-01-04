import os
import sys

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

# Now import modules that depend on env vars
from src.stratos_engine.db import Database
from src.stratos_engine.stages.stage4_scoring import Stage4Scoring
from src.stratos_engine.stages.stage5_ai_review import Stage5AIReview

def main():
    # Initialize Database (no args, uses config)
    db = Database()
    db.connect()

    # Use the latest date or a specific date
    target_date = "2026-01-02"
    config_id = "6a6cd5d6-1f43-475b-a0e7-2fe6fdffe714"
    
    print(f"--- Starting Full Pipeline Run for {target_date} ---")

    # 1. Run Stage 4: Signal Scoring
    print("\n[Stage 4] Running Signal Scoring...")
    stage4 = Stage4Scoring(db)
    
    universes = ["crypto_top100", "equities_top500"]
    
    for universe in universes:
        print(f"  > Scoring universe: {universe}")
        stage4.run(
            as_of_date=target_date,
            universe_id=universe,
            config_id=config_id
        )
    
    print("\n[Stage 4] Scoring Complete.")

    # 2. Run Stage 5: AI Review
    # Stage 5 automatically finds "flashed" assets from the dashboard views
    print("\n[Stage 5] Running AI Review...")
    stage5 = Stage5AIReview(db)
    
    for universe in universes:
        print(f"  > Reviewing assets in {universe}...")
        
        try:
            results = stage5.run(
                as_of_date=target_date,
                universe_id=universe,
                config_id=config_id,
                limit_per_scope=1000,  # Process ALL assets (high limit)
                skip_existing=True
            )
            print(f"    Processed: {results['processed']}, Skipped: {results['skipped']}, Failed: {results['failed']}")
            
        except Exception as e:
            print(f"Error running Stage 5 for {universe}: {e}")
            import traceback
            traceback.print_exc()

    print("\n[Stage 5] AI Review Complete.")
    db.close()

if __name__ == "__main__":
    main()

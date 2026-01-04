"""
Run AI analysis on BTC manually (even though it's not triggering thresholds).
"""
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variables BEFORE importing modules
os.environ["DATABASE_URL"] = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"
os.environ["GEMINI_API_KEY"] = "AIzaSyAHg70im-BbB9HYZm7TOzr3cKRQp7RWY1Q"

from src.stratos_engine.db import Database
from src.stratos_engine.stages.stage5_ai_review import Stage5AIReview


def main():
    # Configuration
    target_date = "2026-01-03"
    config_id = "6a6cd5d6-1f43-475b-a0e7-2fe6fdffe714"
    universe_id = "crypto_all"
    
    # BTC asset data
    btc_target = {
        "asset_id": 139,
        "symbol": "BTC",
        "name": "Bitcoin",
        "asset_type": "crypto",
        "universe_id": universe_id,
        "weighted_score": 0,
        "score_delta": 0,
        "new_signal_count": 0,
        "inflection_score": 0,
        "components": [],
        "scope": "inflections_bullish",  # Use valid scope
        "config_id": config_id
    }
    
    # Connect to database
    db = Database()
    db.connect()
    
    print("=" * 60)
    print("STRATOS BRAIN - MANUAL BTC AI ANALYSIS")
    print(f"Date: {target_date}")
    print("=" * 60)
    
    # Initialize Stage 5
    try:
        stage5 = Stage5AIReview(db)
        print(f"✓ Initialized AI Review with model: {stage5.model_name}")
    except Exception as e:
        print(f"✗ Failed to initialize AI Review: {e}")
        db.close()
        return
    
    print(f"\nProcessing BTC...")
    
    try:
        result = stage5.process_single_asset(
            target=btc_target,
            as_of_date=target_date,
            config_id=config_id,
            skip_existing=False  # Force re-run even if exists
        )
        
        status = result.get("status", "failed")
        if status == "processed":
            details = result.get("details", {})
            print(f"\n✓ BTC Analysis Complete!")
            print(f"  Attention Level: {details.get('attention_level', 'N/A')}")
            print(f"  Direction: {details.get('direction', 'N/A')}")
            print(f"  Confidence: {details.get('confidence', 'N/A')}")
            print(f"  Setup Type: {details.get('setup_type', 'N/A')}")
            print(f"  Summary: {details.get('summary_text', 'N/A')}")
        elif status == "skipped":
            print(f"  - BTC: Skipped (already exists)")
        else:
            print(f"  ✗ BTC: Failed - {result.get('error', 'Unknown error')}")
            
    except Exception as e:
        print(f"  ✗ BTC: Exception - {e}")
        import traceback
        traceback.print_exc()
    
    db.close()
    print("\nDone!")


if __name__ == "__main__":
    main()

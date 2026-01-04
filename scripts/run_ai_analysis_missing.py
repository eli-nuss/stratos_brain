"""
Run AI analysis on assets that are showing in the dashboard but haven't been analyzed yet.
"""
import os
import sys
import time
from typing import Dict, Any, List

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment variables BEFORE importing modules
os.environ["DATABASE_URL"] = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"
os.environ["GEMINI_API_KEY"] = "AIzaSyAHg70im-BbB9HYZm7TOzr3cKRQp7RWY1Q"

from src.stratos_engine.db import Database
from src.stratos_engine.stages.stage5_ai_review import Stage5AIReview


def get_unanalyzed_assets(db: Database, as_of_date: str, universe_id: str) -> List[Dict[str, Any]]:
    """Get assets that are in the dashboard views but haven't been analyzed yet."""
    
    query = """
    WITH flashed_assets AS (
        SELECT DISTINCT asset_id, symbol, name, asset_type, universe_id,
               weighted_score, score_delta, new_signal_count, inflection_score, components,
               'inflections_bullish' as scope
        FROM v_dashboard_inflections 
        WHERE as_of_date = %s AND universe_id = %s AND inflection_direction = 'bullish'
        
        UNION ALL
        
        SELECT DISTINCT asset_id, symbol, name, asset_type, universe_id,
               weighted_score, score_delta, new_signal_count, inflection_score, components,
               'inflections_bearish' as scope
        FROM v_dashboard_inflections 
        WHERE as_of_date = %s AND universe_id = %s AND inflection_direction = 'bearish'
        
        UNION ALL
        
        SELECT DISTINCT asset_id, symbol, name, asset_type, universe_id,
               weighted_score, score_delta, new_signal_count, inflection_score, components,
               'risk' as scope
        FROM v_dashboard_risk 
        WHERE as_of_date = %s AND universe_id = %s
        
        UNION ALL
        
        SELECT DISTINCT asset_id, symbol, name, asset_type, universe_id,
               weighted_score, score_delta, new_signal_count, inflection_score, components,
               'trends' as scope
        FROM v_dashboard_trends 
        WHERE as_of_date = %s AND universe_id = %s
    ),
    reviewed_assets AS (
        SELECT DISTINCT asset_id, scope
        FROM asset_ai_reviews 
        WHERE as_of_date = %s
    )
    SELECT DISTINCT ON (f.asset_id) 
        f.asset_id, f.symbol, f.name, f.asset_type, f.universe_id,
        f.weighted_score, f.score_delta, f.new_signal_count, f.inflection_score, f.components,
        f.scope
    FROM flashed_assets f
    LEFT JOIN reviewed_assets r ON f.asset_id::bigint = r.asset_id::bigint AND f.scope = r.scope
    WHERE r.asset_id IS NULL
    ORDER BY f.asset_id, ABS(f.weighted_score) DESC
    """
    
    params = (as_of_date, universe_id) * 4 + (as_of_date,)
    return db.fetch_all(query, params)


def run_analysis(asset_type: str = "crypto"):
    """Run AI analysis for a specific asset type."""
    
    # Configuration
    if asset_type == "crypto":
        target_date = "2026-01-03"  # Latest crypto date
        universe_id = "crypto_all"
    else:
        target_date = "2026-01-02"  # Latest equity date
        universe_id = "equities_all"
    
    config_id = "6a6cd5d6-1f43-475b-a0e7-2fe6fdffe714"
    
    # Connect to database
    db = Database()
    db.connect()
    
    print("=" * 60)
    print(f"STRATOS BRAIN - AI ANALYSIS FOR {asset_type.upper()} ASSETS")
    print(f"Date: {target_date} | Universe: {universe_id}")
    print("=" * 60)
    
    # Initialize Stage 5
    try:
        stage5 = Stage5AIReview(db)
        print(f"✓ Initialized AI Review with model: {stage5.model_name}")
    except Exception as e:
        print(f"✗ Failed to initialize AI Review: {e}")
        db.close()
        return 0, 0
    
    total_processed = 0
    total_failed = 0
    
    # Get unanalyzed assets
    assets = get_unanalyzed_assets(db, target_date, universe_id)
    print(f"Found {len(assets)} unanalyzed {asset_type} assets\n")
    
    if len(assets) == 0:
        print("No assets to process!")
        db.close()
        return 0, 0
    
    for i, asset in enumerate(assets):
        symbol = asset['symbol']
        scope = asset['scope']
        print(f"[{i+1}/{len(assets)}] Processing {symbol} ({scope})...", end=" ", flush=True)
        
        try:
            # Add config_id to the asset dict
            asset['config_id'] = config_id
            
            result = stage5.process_single_asset(
                target=asset,
                as_of_date=target_date,
                config_id=config_id,
                skip_existing=True
            )
            
            status = result.get("status", "failed")
            if status == "processed":
                details = result.get("details", {})
                attention = details.get("attention_level", "N/A")
                direction = details.get("direction", "N/A")
                print(f"✓ {attention} / {direction}")
                total_processed += 1
            elif status == "skipped":
                print(f"- Skipped (exists)")
            else:
                error = result.get('error', 'Unknown error')
                print(f"✗ Failed: {error[:50]}")
                total_failed += 1
                
            # Rate limiting - Gemini has limits, be conservative
            time.sleep(6)
            
        except Exception as e:
            print(f"✗ Exception: {str(e)[:50]}")
            total_failed += 1
            time.sleep(6)
    
    print(f"\n--- {asset_type.upper()} Summary ---")
    print(f"Processed: {total_processed}, Failed: {total_failed}")
    
    db.close()
    return total_processed, total_failed


def main():
    import sys
    
    # Check command line args
    if len(sys.argv) > 1:
        asset_type = sys.argv[1].lower()
        if asset_type in ["crypto", "equity"]:
            run_analysis(asset_type)
        else:
            print(f"Unknown asset type: {asset_type}. Use 'crypto' or 'equity'")
    else:
        # Run both
        print("\n" + "=" * 60)
        print("RUNNING AI ANALYSIS FOR ALL MISSING ASSETS")
        print("=" * 60 + "\n")
        
        crypto_processed, crypto_failed = run_analysis("crypto")
        print("\n")
        equity_processed, equity_failed = run_analysis("equity")
        
        print("\n" + "=" * 60)
        print("FINAL SUMMARY")
        print("=" * 60)
        print(f"Crypto: {crypto_processed} processed, {crypto_failed} failed")
        print(f"Equity: {equity_processed} processed, {equity_failed} failed")
        print(f"Total:  {crypto_processed + equity_processed} processed, {crypto_failed + equity_failed} failed")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Macro Context Ingestion Script (Updated for FMP /stable/ API)
Fetches daily macro-economic data from Financial Modeling Prep (FMP) API
and stores it in the daily_macro_metrics table.

Data Sources:
- Market Risk Premium (FMP /stable/market-risk-premium)
- Treasury Yields (FMP /stable/treasury-rates)
- Commodities & ETFs (FMP /stable/batch-quote)
- Economic Indicators (FMP /stable/economics-indicators)

Usage:
    python ingest_macro_fmp_v2.py
    python ingest_macro_fmp_v2.py --backfill 30  # Backfill last 30 days
"""

import os
import sys
import argparse
import requests
import psycopg2
from datetime import datetime, timedelta
import json
from typing import Dict, List, Optional

# Configuration
FMP_API_KEY = os.environ.get("FMP_API_KEY")
DB_HOST = "db.wfogbaipiqootjrsprde.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASSWORD = "stratosbrainpostgresdbpw"

# FMP API Base URL (Updated to /stable/)
FMP_BASE_URL = "https://financialmodelingprep.com/stable"


def get_fmp(endpoint: str, params: Optional[Dict] = None) -> List[Dict]:
    """Fetch data from FMP API."""
    if not FMP_API_KEY:
        print("ERROR: FMP_API_KEY environment variable not set")
        sys.exit(1)
    
    url = f"{FMP_BASE_URL}/{endpoint}"
    params = params or {}
    params['apikey'] = FMP_API_KEY
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"ERROR fetching {endpoint}: {e}")
        return []


def calculate_regime(risk_premium: float, spy_change: float) -> str:
    """
    Calculate market regime based on risk premium and market performance.
    
    Risk Premium interpretation:
    - Normal range: 4-5%
    - High (>5%): Market demanding higher returns = Risk-Off
    - Low (<4%): Market comfortable with risk = Risk-On
    """
    if risk_premium > 5.0 and spy_change < 0:
        return "Risk-Off"
    elif risk_premium < 4.0 and spy_change > 0:
        return "Risk-On"
    else:
        return "Neutral"


def calculate_breadth(spy_pct: float, iwm_pct: float) -> str:
    """
    Calculate market breadth quality.
    
    Strong: Both large and small caps rising together
    Divergent: Large caps up but small caps down (warning sign)
    Weak: Both declining or choppy
    """
    if spy_pct > 0 and iwm_pct < -0.2:
        return "Divergent"
    elif spy_pct > 0.5 and iwm_pct > 0.5:
        return "Strong"
    elif spy_pct < -0.5 and iwm_pct < -0.5:
        return "Weak"
    else:
        return "Neutral"


def get_db_connection():
    """Create database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def ingest_macro_data(target_date: Optional[datetime] = None) -> bool:
    """
    Fetch and store macro data for a specific date.
    Returns True if successful, False otherwise.
    """
    if target_date is None:
        target_date = datetime.now()
    
    date_str = target_date.strftime("%Y-%m-%d")
    print(f"\n{'='*60}")
    print(f"Fetching Macro Data for {date_str}")
    print(f"{'='*60}")
    
    try:
        # 1. Fetch Quotes (ETFs and Commodities) using batch-quote
        print("  Fetching market quotes...")
        # ETFs: SPY, IWM, HYG
        # Commodities: CLUSD (Crude Oil), GCUSD (Gold), HGUSD (Copper)
        quotes = get_fmp("batch-quote", params={"symbols": "SPY,IWM,HYG,CLUSD,GCUSD,HGUSD"})
        if not quotes:
            print("  ERROR: Failed to fetch quotes")
            return False
        
        q_map = {item['symbol']: item for item in quotes}
        
        # Verify we got all required symbols
        required_symbols = ['SPY', 'IWM', 'HYG', 'CLUSD', 'GCUSD', 'HGUSD']
        missing = [s for s in required_symbols if s not in q_map]
        if missing:
            print(f"  WARNING: Missing symbols: {missing}")
        
        # 2. Fetch Treasury Rates
        print("  Fetching treasury rates...")
        treasury = get_fmp("treasury-rates")
        if not treasury or len(treasury) == 0:
            print("  ERROR: Failed to fetch treasury rates")
            return False
        treasury = treasury[0]  # Latest rates
        
        # 3. Fetch Market Risk Premium (US only)
        print("  Fetching risk premium...")
        risk_data = get_fmp("market-risk-premium")
        if not risk_data or len(risk_data) == 0:
            print("  ERROR: Failed to fetch risk premium")
            return False
        
        # Find US risk premium
        us_risk = next((x for x in risk_data if 'United States' in x['country']), None)
        if not us_risk:
            print("  ERROR: Could not find US risk premium")
            return False
        
        risk_premium = us_risk['totalEquityRiskPremium']
        
        # 4. Fetch CPI (Economic Indicator) - Note: This may not be available daily
        print("  Fetching CPI data...")
        cpi_data = get_fmp("economics-indicators", params={"name": "CPI"})
        cpi_val = None
        if cpi_data and len(cpi_data) > 0:
            # CPI is reported monthly, get the most recent value
            cpi_val = cpi_data[0].get('value')
        
        # --- Calculations ---
        spy_chg = q_map['SPY']['changePercentage']
        iwm_chg = q_map['IWM']['changePercentage']
        
        regime = calculate_regime(risk_premium, spy_chg)
        breadth = calculate_breadth(spy_chg, iwm_chg)
        yield_curve = treasury['year10'] - treasury['year2']
        
        print(f"\n  Calculated Metrics:")
        print(f"    Market Regime: {regime}")
        print(f"    Breadth Rating: {breadth}")
        print(f"    Yield Curve: {yield_curve:.3f}%")
        print(f"    Risk Premium: {risk_premium:.2f}%")
        print(f"    SPY Change: {spy_chg:.2f}%")
        print(f"    IWM Change: {iwm_chg:.2f}%")
        
        # Note: Sector performance endpoint appears to be unavailable or requires different access
        # We'll store an empty dict for now
        sector_json = {}
        
        # --- Database Insert ---
        print(f"\n  Inserting into database...")
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
        INSERT INTO daily_macro_metrics (
            date, 
            risk_premium, market_regime,
            us10y_yield, us2y_yield, yield_curve_10y_2y, hyg_close,
            oil_close, gold_close, copper_close, cpi_yoy,
            spy_close, spy_change_pct, iwm_close, iwm_change_pct,
            breadth_rating, sector_rotation
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (date) DO UPDATE SET
            risk_premium = EXCLUDED.risk_premium,
            market_regime = EXCLUDED.market_regime,
            us10y_yield = EXCLUDED.us10y_yield,
            us2y_yield = EXCLUDED.us2y_yield,
            yield_curve_10y_2y = EXCLUDED.yield_curve_10y_2y,
            hyg_close = EXCLUDED.hyg_close,
            oil_close = EXCLUDED.oil_close,
            gold_close = EXCLUDED.gold_close,
            copper_close = EXCLUDED.copper_close,
            cpi_yoy = EXCLUDED.cpi_yoy,
            spy_close = EXCLUDED.spy_close,
            spy_change_pct = EXCLUDED.spy_change_pct,
            iwm_close = EXCLUDED.iwm_close,
            iwm_change_pct = EXCLUDED.iwm_change_pct,
            breadth_rating = EXCLUDED.breadth_rating,
            sector_rotation = EXCLUDED.sector_rotation,
            updated_at = NOW();
        """
        
        cur.execute(query, (
            target_date.date(),
            risk_premium, regime,
            treasury['year10'], treasury['year2'], yield_curve, q_map['HYG']['price'],
            q_map['CLUSD']['price'], q_map['GCUSD']['price'], q_map['HGUSD']['price'], cpi_val,
            q_map['SPY']['price'], spy_chg, q_map['IWM']['price'], iwm_chg,
            breadth, json.dumps(sector_json)
        ))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"  ✓ Macro data for {date_str} successfully ingested")
        return True
        
    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(description="Ingest macro-economic data from FMP")
    parser.add_argument("--backfill", type=int, help="Backfill data for N days")
    parser.add_argument("--date", type=str, help="Specific date to ingest (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    print("="*60)
    print("Macro Context Ingestion Script (Updated for /stable/ API)")
    print("="*60)
    
    if not FMP_API_KEY:
        print("ERROR: FMP_API_KEY environment variable not set")
        print("Please set it with: export FMP_API_KEY=your_key_here")
        sys.exit(1)
    
    success_count = 0
    total_count = 0
    
    if args.backfill:
        # Backfill mode
        print(f"\nBackfilling {args.backfill} days of macro data...")
        for i in range(args.backfill):
            target_date = datetime.now() - timedelta(days=i)
            total_count += 1
            if ingest_macro_data(target_date):
                success_count += 1
    elif args.date:
        # Specific date mode
        try:
            target_date = datetime.strptime(args.date, "%Y-%m-%d")
            total_count = 1
            if ingest_macro_data(target_date):
                success_count = 1
        except ValueError:
            print(f"ERROR: Invalid date format. Use YYYY-MM-DD")
            sys.exit(1)
    else:
        # Default: today only
        total_count = 1
        if ingest_macro_data():
            success_count = 1
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Successfully ingested: {success_count}/{total_count} days")
    
    if success_count < total_count:
        print(f"Failed: {total_count - success_count} days")
        sys.exit(1)
    else:
        print("✓ All macro data successfully ingested")


if __name__ == "__main__":
    main()

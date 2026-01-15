#!/usr/bin/env python3
"""
Test FMP data ingestion for a few global equity stocks.
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

FMP_API_KEY = os.environ.get("FMP_API_KEY", "DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"
)

def test_fmp_api():
    """Test basic FMP API connectivity."""
    print("=" * 60)
    print("Testing FMP API Connectivity")
    print("=" * 60)
    
    # Test profile endpoint
    url = f"{FMP_BASE_URL}/profile"
    params = {"symbol": "3350.T", "apikey": FMP_API_KEY}
    
    response = requests.get(url, params=params, timeout=30)
    if response.status_code == 200:
        data = response.json()
        if data:
            print(f"✓ Profile API works")
            print(f"  Symbol: {data[0].get('symbol')}")
            print(f"  Name: {data[0].get('companyName')}")
            print(f"  Currency: {data[0].get('currency')}")
            print(f"  Exchange: {data[0].get('exchange')}")
        else:
            print("✗ Profile API returned empty data")
            return False
    else:
        print(f"✗ Profile API failed: {response.status_code}")
        return False
    
    return True

def test_historical_data():
    """Test historical OHLCV data fetching."""
    print("\n" + "=" * 60)
    print("Testing Historical Data Fetch")
    print("=" * 60)
    
    test_symbols = ["3350.T", "005930.KS", "0700.HK", "2330.TW"]
    
    for symbol in test_symbols:
        url = f"{FMP_BASE_URL}/historical-price-eod/full"
        params = {"symbol": symbol, "apikey": FMP_API_KEY}
        
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data:
                latest = data[0]
                print(f"✓ {symbol}: {len(data)} bars")
                print(f"  Latest: {latest.get('date')} - Close: {latest.get('close')} Volume: {latest.get('volume')}")
            else:
                print(f"✗ {symbol}: No data returned")
        else:
            print(f"✗ {symbol}: API failed ({response.status_code})")
    
    return True

def test_forex_rates():
    """Test forex rate fetching."""
    print("\n" + "=" * 60)
    print("Testing Forex Rates")
    print("=" * 60)
    
    pairs = ["JPYUSD", "KRWUSD", "HKDUSD", "TWDUSD", "INRUSD", "EURUSD"]
    
    for pair in pairs:
        url = f"{FMP_BASE_URL}/historical-price-eod/full"
        params = {"symbol": pair, "apikey": FMP_API_KEY}
        
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data:
                latest = data[0]
                print(f"✓ {pair}: {latest.get('date')} = {latest.get('close')}")
            else:
                print(f"✗ {pair}: No data returned")
        else:
            print(f"✗ {pair}: API failed ({response.status_code})")
    
    return True

def test_usd_conversion():
    """Test USD conversion calculation."""
    print("\n" + "=" * 60)
    print("Testing USD Conversion")
    print("=" * 60)
    
    # Get 3350.T price
    url = f"{FMP_BASE_URL}/historical-price-eod/full"
    params = {"symbol": "3350.T", "apikey": FMP_API_KEY}
    response = requests.get(url, params=params, timeout=30)
    jpy_data = response.json()
    
    # Get JPYUSD rate
    params = {"symbol": "JPYUSD", "apikey": FMP_API_KEY}
    response = requests.get(url, params=params, timeout=30)
    fx_data = response.json()
    
    if jpy_data and fx_data:
        jpy_close = jpy_data[0].get('close')
        fx_rate = fx_data[0].get('close')
        usd_close = jpy_close * fx_rate
        
        print(f"3350.T (Metaplanet):")
        print(f"  JPY Price: ¥{jpy_close:,.0f}")
        print(f"  FX Rate (JPY/USD): {fx_rate:.6f}")
        print(f"  USD Price: ${usd_close:,.2f}")
        print(f"  Date: {jpy_data[0].get('date')}")
    
    return True

def test_database_connection():
    """Test database connection and query global equities."""
    print("\n" + "=" * 60)
    print("Testing Database Connection")
    print("=" * 60)
    
    import psycopg2
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Count global equities
        cur.execute("SELECT COUNT(*) FROM assets WHERE asset_type = 'global_equity'")
        count = cur.fetchone()[0]
        print(f"✓ Connected to database")
        print(f"  Global equities in database: {count}")
        
        # Show sample
        cur.execute("""
            SELECT symbol, name, currency, exchange 
            FROM assets 
            WHERE asset_type = 'global_equity' 
            ORDER BY asset_id 
            LIMIT 5
        """)
        rows = cur.fetchall()
        print("\n  Sample global equities:")
        for row in rows:
            print(f"    {row[0]}: {row[1][:40]} ({row[2]}, {row[3]})")
        
        # Check fx_rates table
        cur.execute("SELECT COUNT(*) FROM fx_rates")
        fx_count = cur.fetchone()[0]
        print(f"\n  FX rates in database: {fx_count}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"✗ Database error: {e}")
        return False

def main():
    print("\n" + "=" * 60)
    print("FMP Data Ingestion Test Suite")
    print("=" * 60)
    
    tests = [
        ("FMP API Connectivity", test_fmp_api),
        ("Historical Data Fetch", test_historical_data),
        ("Forex Rates", test_forex_rates),
        ("USD Conversion", test_usd_conversion),
        ("Database Connection", test_database_connection),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n✗ {name} failed with error: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}: {name}")
    
    passed = sum(1 for _, r in results if r)
    print(f"\n  {passed}/{len(results)} tests passed")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Insert all 40 FMP commodities and ingest historical data.
"""

import time
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta

FMP_API_KEY = "DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe"
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# 4 years ago
START_DATE = (datetime.now() - timedelta(days=4*365)).strftime("%Y-%m-%d")

# All 40 commodities from FMP with categorization
COMMODITIES = [
    # Precious Metals
    {"symbol": "GCUSD", "name": "Gold Futures", "category": "precious_metals", "unit": "oz"},
    {"symbol": "SIUSD", "name": "Silver Futures", "category": "precious_metals", "unit": "oz"},
    {"symbol": "PLUSD", "name": "Platinum", "category": "precious_metals", "unit": "oz"},
    {"symbol": "PAUSD", "name": "Palladium", "category": "precious_metals", "unit": "oz"},
    {"symbol": "MGCUSD", "name": "Micro Gold Futures", "category": "precious_metals", "unit": "oz"},
    {"symbol": "SILUSD", "name": "Micro Silver Futures", "category": "precious_metals", "unit": "oz"},
    
    # Energy
    {"symbol": "CLUSD", "name": "Crude Oil", "category": "energy", "unit": "barrel"},
    {"symbol": "NGUSD", "name": "Natural Gas", "category": "energy", "unit": "mmBtu"},
    
    # Base Metals
    {"symbol": "HGUSD", "name": "Copper", "category": "base_metals", "unit": "lb"},
    {"symbol": "ALIUSD", "name": "Aluminum Futures", "category": "base_metals", "unit": "lb"},
    
    # Agriculture - Grains
    {"symbol": "ZSUSX", "name": "Soybean Futures", "category": "agriculture", "unit": "bushel"},
    {"symbol": "ZCUSX", "name": "Corn Futures", "category": "agriculture", "unit": "bushel"},
    {"symbol": "KEUSX", "name": "Wheat Futures", "category": "agriculture", "unit": "bushel"},
    {"symbol": "ZOUSX", "name": "Oat Futures", "category": "agriculture", "unit": "bushel"},
    {"symbol": "ZMUSD", "name": "Soybean Meal Futures", "category": "agriculture", "unit": "ton"},
    {"symbol": "ZLUSX", "name": "Soybean Oil Futures", "category": "agriculture", "unit": "lb"},
    
    # Agriculture - Softs
    {"symbol": "SBUSX", "name": "Sugar", "category": "agriculture", "unit": "lb"},
    {"symbol": "KCUSX", "name": "Coffee", "category": "agriculture", "unit": "lb"},
    {"symbol": "CTUSX", "name": "Cotton", "category": "agriculture", "unit": "lb"},
    {"symbol": "OJUSX", "name": "Orange Juice", "category": "agriculture", "unit": "lb"},
    
    # Livestock
    {"symbol": "LEUSX", "name": "Live Cattle Futures", "category": "livestock", "unit": "lb"},
    {"symbol": "HEUSX", "name": "Lean Hogs Futures", "category": "livestock", "unit": "lb"},
    {"symbol": "GFUSX", "name": "Feeder Cattle Futures", "category": "livestock", "unit": "lb"},
    
    # Other
    {"symbol": "LBUSD", "name": "Lumber Futures", "category": "other", "unit": "board_feet"},
    {"symbol": "DXUSD", "name": "US Dollar Index", "category": "currency", "unit": "index"},
    
    # Interest Rate Futures
    {"symbol": "ZTUSD", "name": "2-Year T-Note Futures", "category": "interest_rates", "unit": "contract"},
    {"symbol": "ZFUSD", "name": "Five-Year US Treasury Note", "category": "interest_rates", "unit": "contract"},
    {"symbol": "ZBUSD", "name": "30 Year U.S. Treasury Bond Futures", "category": "interest_rates", "unit": "contract"},
    {"symbol": "ZQUSD", "name": "30 Day Fed Fund Futures", "category": "interest_rates", "unit": "contract"},
    
    # Index Futures
    {"symbol": "ESUSD", "name": "E-Mini S&P 500", "category": "index_futures", "unit": "contract"},
    
    # Additional commodities from FMP list
    {"symbol": "BNUSD", "name": "Brent Crude Oil", "category": "energy", "unit": "barrel"},
    {"symbol": "BZUSD", "name": "Brent Crude Oil Last Day", "category": "energy", "unit": "barrel"},
    {"symbol": "RBUSD", "name": "RBOB Gasoline", "category": "energy", "unit": "gallon"},
    {"symbol": "HOUSD", "name": "Heating Oil", "category": "energy", "unit": "gallon"},
    {"symbol": "ZNUSD", "name": "10-Year T-Note Futures", "category": "interest_rates", "unit": "contract"},
    {"symbol": "CCUSD", "name": "Cocoa Futures", "category": "agriculture", "unit": "ton"},
    {"symbol": "NQUSD", "name": "E-Mini NASDAQ 100", "category": "index_futures", "unit": "contract"},
    {"symbol": "YMUSD", "name": "E-Mini Dow Jones", "category": "index_futures", "unit": "contract"},
    {"symbol": "RTYU", "name": "E-Mini Russell 2000", "category": "index_futures", "unit": "contract"},
    {"symbol": "SAUSD", "name": "Sugar #11 World", "category": "agriculture", "unit": "lb"},
]


def fetch_historical_data(symbol: str) -> list:
    """Fetch historical OHLCV data from FMP."""
    url = "https://financialmodelingprep.com/stable/historical-price-eod/full"
    params = {
        "symbol": symbol,
        "from": START_DATE,
        "apikey": FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                return data
    except Exception as e:
        pass
    
    return []


def main():
    print("=" * 60)
    print("Inserting Commodities and Ingesting Historical Data")
    print(f"Date range: {START_DATE} to today")
    print("=" * 60)
    
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Insert all commodities
    print(f"\nInserting {len(COMMODITIES)} commodities...")
    
    commodity_values = [
        (c["symbol"], c["name"], c["category"], c.get("unit"), True, "fmp")
        for c in COMMODITIES
    ]
    
    insert_query = """
        INSERT INTO commodities (symbol, name, category, unit, is_active, data_vendor)
        VALUES %s
        ON CONFLICT (symbol) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            unit = EXCLUDED.unit,
            updated_at = NOW()
        RETURNING commodity_id, symbol
    """
    
    result = execute_values(cur, insert_query, commodity_values, fetch=True)
    conn.commit()
    print(f"  Inserted/updated {len(result)} commodities")
    
    # Create symbol to ID mapping
    cur.execute("SELECT commodity_id, symbol FROM commodities")
    symbol_to_id = {row[1]: row[0] for row in cur.fetchall()}
    
    # Ingest historical data
    print(f"\nIngesting historical data...")
    
    total_bars = 0
    available_count = 0
    
    for i, commodity in enumerate(COMMODITIES):
        symbol = commodity["symbol"]
        commodity_id = symbol_to_id.get(symbol)
        
        if not commodity_id:
            print(f"  [{i+1}/{len(COMMODITIES)}] {symbol}: No ID found")
            continue
        
        data = fetch_historical_data(symbol)
        
        if not data:
            print(f"  [{i+1}/{len(COMMODITIES)}] {symbol}: No data available")
            continue
        
        available_count += 1
        
        # Prepare values
        values = [
            (
                commodity_id,
                bar["date"],
                bar.get("open"),
                bar.get("high"),
                bar.get("low"),
                bar.get("close"),
                bar.get("volume"),
                "fmp"
            )
            for bar in data
            if bar.get("date")
        ]
        
        if values:
            query = """
                INSERT INTO commodity_daily_bars (commodity_id, date, open, high, low, close, volume, source)
                VALUES %s
                ON CONFLICT (commodity_id, date) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume
            """
            execute_values(cur, query, values)
            conn.commit()
            total_bars += len(values)
            print(f"  [{i+1}/{len(COMMODITIES)}] {symbol}: {len(values)} bars")
        
        time.sleep(0.15)  # Rate limiting
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Commodities with data: {available_count}/{len(COMMODITIES)}")
    print(f"Total bars ingested: {total_bars:,}")
    
    # Verify in database
    cur.execute("SELECT COUNT(*) FROM commodities")
    commodity_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM commodity_daily_bars")
    bar_count = cur.fetchone()[0]
    
    print(f"\nDatabase totals:")
    print(f"  commodities: {commodity_count}")
    print(f"  commodity_daily_bars: {bar_count:,}")
    
    # Show by category
    cur.execute("""
        SELECT c.category, COUNT(DISTINCT c.commodity_id), COUNT(b.bar_id)
        FROM commodities c
        LEFT JOIN commodity_daily_bars b ON c.commodity_id = b.commodity_id
        GROUP BY c.category
        ORDER BY COUNT(b.bar_id) DESC
    """)
    
    print("\nBy category:")
    for row in cur.fetchall():
        print(f"  {row[0] or 'unknown'}: {row[1]} commodities, {row[2]:,} bars")
    
    cur.close()
    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()

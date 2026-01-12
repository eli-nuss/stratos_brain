#!/usr/bin/env python3
"""
Ingest Institutional Holdings Data from FMP API
Fetches quarterly 13F data for companies and stores in the database
"""

import os
import sys
import requests
import psycopg2
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# Database connection
DB_CONFIG = {
    'host': 'db.wfogbaipiqootjrsprde.supabase.co',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'stratosbrainpostgresdbpw'
}

# FMP API
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe')
FMP_BASE_URL = 'https://financialmodelingprep.com/stable'


def get_current_quarter() -> tuple:
    """Get current year and quarter for 13F data (accounts for 45-day filing lag)"""
    now = datetime.now()
    quarter = (now.month - 1) // 3 + 1
    
    # 13F filings are reported with a 45-day lag
    # Go back 2 quarters to be safe (most recent fully available data)
    for _ in range(2):
        if quarter == 1:
            now = now.replace(year=now.year - 1)
            quarter = 4
        else:
            quarter -= 1
    
    return now.year, quarter


def fetch_institutional_holdings(symbol: str, year: int, quarter: int) -> Optional[Dict]:
    """Fetch institutional holdings data from FMP API"""
    url = f"{FMP_BASE_URL}/institutional-ownership/symbol-positions-summary"
    params = {
        'symbol': symbol,
        'year': year,
        'quarter': quarter,
        'apikey': FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if data and len(data) > 0:
            return data[0]  # Returns array with single object
        return None
    except Exception as e:
        print(f"Error fetching data for {symbol} Q{quarter} {year}: {e}")
        return None


def insert_institutional_holdings(conn, data: Dict) -> bool:
    """Insert institutional holdings data into database"""
    try:
        cursor = conn.cursor()
        
        # Convert date string to date object
        date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        query = """
            INSERT INTO institutional_holdings (
                symbol, cik, date, year, quarter,
                investors_holding, last_investors_holding, investors_holding_change,
                number_of_13f_shares, last_number_of_13f_shares, number_of_13f_shares_change,
                total_invested, last_total_invested, total_invested_change,
                ownership_percent, last_ownership_percent, ownership_percent_change,
                new_positions, last_new_positions, new_positions_change,
                increased_positions, last_increased_positions, increased_positions_change,
                closed_positions, last_closed_positions, closed_positions_change,
                reduced_positions, last_reduced_positions, reduced_positions_change,
                total_calls, last_total_calls, total_calls_change,
                total_puts, last_total_puts, total_puts_change,
                put_call_ratio, last_put_call_ratio, put_call_ratio_change
            ) VALUES (
                %(symbol)s, %(cik)s, %(date)s, %(year)s, %(quarter)s,
                %(investorsHolding)s, %(lastInvestorsHolding)s, %(investorsHoldingChange)s,
                %(numberOf13Fshares)s, %(lastNumberOf13Fshares)s, %(numberOf13FsharesChange)s,
                %(totalInvested)s, %(lastTotalInvested)s, %(totalInvestedChange)s,
                %(ownershipPercent)s, %(lastOwnershipPercent)s, %(ownershipPercentChange)s,
                %(newPositions)s, %(lastNewPositions)s, %(newPositionsChange)s,
                %(increasedPositions)s, %(lastIncreasedPositions)s, %(increasedPositionsChange)s,
                %(closedPositions)s, %(lastClosedPositions)s, %(closedPositionsChange)s,
                %(reducedPositions)s, %(lastReducedPositions)s, %(reducedPositionsChange)s,
                %(totalCalls)s, %(lastTotalCalls)s, %(totalCallsChange)s,
                %(totalPuts)s, %(lastTotalPuts)s, %(totalPutsChange)s,
                %(putCallRatio)s, %(lastPutCallRatio)s, %(putCallRatioChange)s
            )
            ON CONFLICT (symbol, year, quarter) 
            DO UPDATE SET
                investors_holding = EXCLUDED.investors_holding,
                last_investors_holding = EXCLUDED.last_investors_holding,
                investors_holding_change = EXCLUDED.investors_holding_change,
                number_of_13f_shares = EXCLUDED.number_of_13f_shares,
                total_invested = EXCLUDED.total_invested,
                ownership_percent = EXCLUDED.ownership_percent,
                new_positions = EXCLUDED.new_positions,
                increased_positions = EXCLUDED.increased_positions,
                closed_positions = EXCLUDED.closed_positions,
                reduced_positions = EXCLUDED.reduced_positions,
                put_call_ratio = EXCLUDED.put_call_ratio,
                updated_at = NOW()
        """
        
        # Prepare data dict with date
        insert_data = {**data, 'date': date_obj}
        
        cursor.execute(query, insert_data)
        conn.commit()
        cursor.close()
        return True
        
    except Exception as e:
        print(f"Error inserting data for {data.get('symbol')}: {e}")
        conn.rollback()
        return False


def get_companies_to_ingest(conn, limit: Optional[int] = None) -> List[str]:
    """Get list of company tickers to ingest, prioritizing most active companies"""
    cursor = conn.cursor()
    
    # Get tickers from company_documents, ordered by number of documents (proxy for importance)
    query = """
        SELECT ticker, COUNT(*) as doc_count
        FROM company_documents
        WHERE ticker IS NOT NULL
        GROUP BY ticker
        ORDER BY doc_count DESC
    """
    
    if limit:
        query += f" LIMIT {limit}"
    
    cursor.execute(query)
    tickers = [row[0] for row in cursor.fetchall()]
    cursor.close()
    
    return tickers


def main():
    """Main ingestion function"""
    # Parse command line arguments
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    quarters_back = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    
    print(f"Starting institutional holdings ingestion...")
    print(f"Companies to process: {limit}")
    print(f"Quarters to backfill: {quarters_back}")
    
    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get companies to ingest
    tickers = get_companies_to_ingest(conn, limit)
    print(f"Found {len(tickers)} companies to process")
    
    # Get current quarter
    current_year, current_quarter = get_current_quarter()
    print(f"Current reporting quarter: Q{current_quarter} {current_year}")
    
    # Generate list of quarters to fetch
    quarters_to_fetch = []
    year, quarter = current_year, current_quarter
    for _ in range(quarters_back):
        quarters_to_fetch.append((year, quarter))
        # Go back one quarter
        if quarter == 1:
            year -= 1
            quarter = 4
        else:
            quarter -= 1
    
    print(f"Quarters to fetch: {quarters_to_fetch}")
    
    # Process each company
    success_count = 0
    error_count = 0
    
    for i, ticker in enumerate(tickers, 1):
        print(f"\n[{i}/{len(tickers)}] Processing {ticker}...")
        
        for year, quarter in quarters_to_fetch:
            data = fetch_institutional_holdings(ticker, year, quarter)
            
            if data:
                if insert_institutional_holdings(conn, data):
                    print(f"  ✓ Q{quarter} {year}: {data.get('investorsHolding', 0)} holders, "
                          f"{data.get('ownershipPercent', 0):.2f}% ownership")
                    success_count += 1
                else:
                    error_count += 1
            else:
                print(f"  ✗ Q{quarter} {year}: No data available")
    
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"Ingestion complete!")
    print(f"Success: {success_count} records")
    print(f"Errors: {error_count} records")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()

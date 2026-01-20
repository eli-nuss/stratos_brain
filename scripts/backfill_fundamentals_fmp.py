#!/usr/bin/env python3
"""
Backfill quarterly and annual fundamentals using Financial Modeling Prep (FMP) API.

This script fetches income statement, balance sheet, and cash flow data from FMP
and stores it in the equity_quarterly_fundamentals and equity_annual_fundamentals tables.

FMP is faster than Alpha Vantage (no rate limit delays) and provides more data fields.

Usage:
    # Process specific symbols
    python3 scripts/backfill_fundamentals_fmp.py --symbols LUNR VSAT IRDM
    
    # Process top N missing assets by market cap
    python3 scripts/backfill_fundamentals_fmp.py --limit 100
    
    # Process all missing assets (use with caution - API limits)
    python3 scripts/backfill_fundamentals_fmp.py --all
"""

import os
import sys
import time
import argparse
import psycopg2
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Database connection
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# FMP API Configuration
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe')
FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

# Rate limiting - FMP allows more requests but let's be conservative
REQUEST_DELAY = 0.5  # 500ms between API calls


def get_connection():
    """Get database connection."""
    return psycopg2.connect(DB_URL)


def get_assets_missing_fundamentals(conn, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get active equities missing quarterly fundamentals data, ordered by market cap."""
    with conn.cursor() as cur:
        query = """
            SELECT a.asset_id, a.symbol, a.name, em.market_cap
            FROM assets a
            JOIN equity_metadata em ON a.asset_id = em.asset_id
            LEFT JOIN (SELECT DISTINCT asset_id FROM equity_quarterly_fundamentals) qf 
                ON a.asset_id = qf.asset_id
            WHERE a.asset_type = 'equity' 
              AND a.is_active = true 
              AND qf.asset_id IS NULL
            ORDER BY em.market_cap DESC NULLS LAST
        """
        if limit:
            query += f" LIMIT {limit}"
        cur.execute(query)
        return [
            {'asset_id': row[0], 'symbol': row[1], 'name': row[2], 'market_cap': row[3]}
            for row in cur.fetchall()
        ]


def get_assets_by_symbols(conn, symbols: List[str]) -> List[Dict[str, Any]]:
    """Get assets by symbol list."""
    with conn.cursor() as cur:
        placeholders = ','.join(['%s'] * len(symbols))
        cur.execute(f"""
            SELECT a.asset_id, a.symbol, a.name, em.market_cap
            FROM assets a
            LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
            WHERE a.symbol IN ({placeholders}) AND a.asset_type = 'equity'
        """, symbols)
        return [
            {'asset_id': row[0], 'symbol': row[1], 'name': row[2], 'market_cap': row[3]}
            for row in cur.fetchall()
        ]


def fetch_fmp_data(endpoint: str, symbol: str, period: str = 'quarter') -> Optional[List[Dict]]:
    """
    Fetch data from FMP API.
    
    Args:
        endpoint: API endpoint (income-statement, balance-sheet-statement, cash-flow-statement)
        symbol: Stock symbol
        period: 'quarter' or 'annual'
        
    Returns:
        List of records or None if error
    """
    url = f"{FMP_BASE_URL}/{endpoint}"
    params = {
        'symbol': symbol,
        'period': period,
        'apikey': FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        # Check for errors
        if isinstance(data, dict) and 'Error Message' in data:
            print(f"    API Error: {data['Error Message'][:80]}...")
            return None
            
        if not isinstance(data, list):
            print(f"    Unexpected response type: {type(data)}")
            return None
            
        return data
        
    except requests.exceptions.Timeout:
        print(f"    Timeout fetching {endpoint}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"    Request error: {e}")
        return None
    except Exception as e:
        print(f"    Error: {e}")
        return None


def parse_int(value) -> Optional[int]:
    """Parse integer value, handling None and invalid values."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def parse_float(value) -> Optional[float]:
    """Parse float value, handling None and invalid values."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def merge_fmp_data(income: Dict, balance: Dict, cashflow: Dict) -> Dict[str, Any]:
    """
    Merge data from income statement, balance sheet, and cash flow into database schema.
    
    Maps FMP field names to our database column names.
    """
    merged = {}
    
    # Get fiscal date from any available source
    merged['fiscal_date_ending'] = (
        income.get('date') or 
        balance.get('date') or 
        cashflow.get('date')
    )
    
    # Reported currency
    merged['reported_currency'] = (
        income.get('reportedCurrency') or 
        balance.get('reportedCurrency') or 
        cashflow.get('reportedCurrency')
    )
    
    # === Income Statement Fields ===
    if income:
        merged['total_revenue'] = parse_int(income.get('revenue'))
        merged['cost_of_revenue'] = parse_int(income.get('costOfRevenue'))
        merged['gross_profit'] = parse_int(income.get('grossProfit'))
        merged['operating_expenses'] = parse_int(income.get('operatingExpenses'))
        merged['operating_income'] = parse_int(income.get('operatingIncome'))
        merged['research_and_development'] = parse_int(income.get('researchAndDevelopmentExpenses'))
        merged['selling_general_administrative'] = parse_int(income.get('sellingGeneralAndAdministrativeExpenses'))
        merged['interest_expense'] = parse_int(income.get('interestExpense'))
        merged['income_before_tax'] = parse_int(income.get('incomeBeforeTax'))
        merged['income_tax_expense'] = parse_int(income.get('incomeTaxExpense'))
        merged['net_income'] = parse_int(income.get('netIncome'))
        merged['ebit'] = parse_int(income.get('ebit'))
        merged['ebitda'] = parse_int(income.get('ebitda'))
        merged['eps'] = parse_float(income.get('eps'))
        merged['eps_diluted'] = parse_float(income.get('epsDiluted'))
        merged['common_stock_shares_outstanding'] = parse_int(income.get('weightedAverageShsOutDil'))
    
    # === Balance Sheet Fields ===
    if balance:
        merged['total_assets'] = parse_int(balance.get('totalAssets'))
        merged['total_current_assets'] = parse_int(balance.get('totalCurrentAssets'))
        merged['cash_and_equivalents'] = parse_int(balance.get('cashAndCashEquivalents'))
        merged['total_liabilities'] = parse_int(balance.get('totalLiabilities'))
        merged['total_current_liabilities'] = parse_int(balance.get('totalCurrentLiabilities'))
        merged['long_term_debt'] = parse_int(balance.get('longTermDebt'))
        merged['total_shareholder_equity'] = parse_int(balance.get('totalStockholdersEquity'))
        merged['retained_earnings'] = parse_int(balance.get('retainedEarnings'))
    
    # === Cash Flow Fields ===
    if cashflow:
        merged['operating_cashflow'] = parse_int(cashflow.get('netCashProvidedByOperatingActivities'))
        merged['capital_expenditures'] = parse_int(cashflow.get('investmentsInPropertyPlantAndEquipment'))
        merged['investing_cashflow'] = parse_int(cashflow.get('netCashProvidedByInvestingActivities'))
        merged['financing_cashflow'] = parse_int(cashflow.get('netCashProvidedByFinancingActivities'))
        merged['dividend_payout'] = parse_int(cashflow.get('commonDividendsPaid'))
        merged['free_cash_flow'] = parse_int(cashflow.get('freeCashFlow'))
    
    return merged


def upsert_fundamentals(conn, table_name: str, asset_id: int, records: List[Dict]) -> int:
    """
    Insert or update fundamentals records.
    
    Args:
        conn: Database connection
        table_name: 'equity_quarterly_fundamentals' or 'equity_annual_fundamentals'
        asset_id: Asset ID
        records: List of merged records
        
    Returns:
        Number of records upserted
    """
    if not records:
        return 0
    
    count = 0
    with conn.cursor() as cur:
        for record in records:
            if not record.get('fiscal_date_ending'):
                continue
            
            try:
                cur.execute(f"""
                    INSERT INTO {table_name} (
                        asset_id, fiscal_date_ending, reported_currency,
                        total_revenue, cost_of_revenue, gross_profit,
                        operating_expenses, operating_income,
                        research_and_development, selling_general_administrative,
                        interest_expense, income_before_tax, income_tax_expense,
                        net_income, ebit, ebitda, eps, eps_diluted,
                        total_assets, total_current_assets, cash_and_equivalents,
                        total_liabilities, total_current_liabilities, long_term_debt,
                        total_shareholder_equity, retained_earnings,
                        common_stock_shares_outstanding,
                        operating_cashflow, capital_expenditures,
                        investing_cashflow, financing_cashflow,
                        dividend_payout, free_cash_flow,
                        updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, NOW()
                    )
                    ON CONFLICT (asset_id, fiscal_date_ending) DO UPDATE SET
                        reported_currency = COALESCE(EXCLUDED.reported_currency, {table_name}.reported_currency),
                        total_revenue = COALESCE(EXCLUDED.total_revenue, {table_name}.total_revenue),
                        cost_of_revenue = COALESCE(EXCLUDED.cost_of_revenue, {table_name}.cost_of_revenue),
                        gross_profit = COALESCE(EXCLUDED.gross_profit, {table_name}.gross_profit),
                        operating_expenses = COALESCE(EXCLUDED.operating_expenses, {table_name}.operating_expenses),
                        operating_income = COALESCE(EXCLUDED.operating_income, {table_name}.operating_income),
                        research_and_development = COALESCE(EXCLUDED.research_and_development, {table_name}.research_and_development),
                        selling_general_administrative = COALESCE(EXCLUDED.selling_general_administrative, {table_name}.selling_general_administrative),
                        interest_expense = COALESCE(EXCLUDED.interest_expense, {table_name}.interest_expense),
                        income_before_tax = COALESCE(EXCLUDED.income_before_tax, {table_name}.income_before_tax),
                        income_tax_expense = COALESCE(EXCLUDED.income_tax_expense, {table_name}.income_tax_expense),
                        net_income = COALESCE(EXCLUDED.net_income, {table_name}.net_income),
                        ebit = COALESCE(EXCLUDED.ebit, {table_name}.ebit),
                        ebitda = COALESCE(EXCLUDED.ebitda, {table_name}.ebitda),
                        eps = COALESCE(EXCLUDED.eps, {table_name}.eps),
                        eps_diluted = COALESCE(EXCLUDED.eps_diluted, {table_name}.eps_diluted),
                        total_assets = COALESCE(EXCLUDED.total_assets, {table_name}.total_assets),
                        total_current_assets = COALESCE(EXCLUDED.total_current_assets, {table_name}.total_current_assets),
                        cash_and_equivalents = COALESCE(EXCLUDED.cash_and_equivalents, {table_name}.cash_and_equivalents),
                        total_liabilities = COALESCE(EXCLUDED.total_liabilities, {table_name}.total_liabilities),
                        total_current_liabilities = COALESCE(EXCLUDED.total_current_liabilities, {table_name}.total_current_liabilities),
                        long_term_debt = COALESCE(EXCLUDED.long_term_debt, {table_name}.long_term_debt),
                        total_shareholder_equity = COALESCE(EXCLUDED.total_shareholder_equity, {table_name}.total_shareholder_equity),
                        retained_earnings = COALESCE(EXCLUDED.retained_earnings, {table_name}.retained_earnings),
                        common_stock_shares_outstanding = COALESCE(EXCLUDED.common_stock_shares_outstanding, {table_name}.common_stock_shares_outstanding),
                        operating_cashflow = COALESCE(EXCLUDED.operating_cashflow, {table_name}.operating_cashflow),
                        capital_expenditures = COALESCE(EXCLUDED.capital_expenditures, {table_name}.capital_expenditures),
                        investing_cashflow = COALESCE(EXCLUDED.investing_cashflow, {table_name}.investing_cashflow),
                        financing_cashflow = COALESCE(EXCLUDED.financing_cashflow, {table_name}.financing_cashflow),
                        dividend_payout = COALESCE(EXCLUDED.dividend_payout, {table_name}.dividend_payout),
                        free_cash_flow = COALESCE(EXCLUDED.free_cash_flow, {table_name}.free_cash_flow),
                        updated_at = NOW()
                """, (
                    asset_id,
                    record.get('fiscal_date_ending'),
                    record.get('reported_currency'),
                    record.get('total_revenue'),
                    record.get('cost_of_revenue'),
                    record.get('gross_profit'),
                    record.get('operating_expenses'),
                    record.get('operating_income'),
                    record.get('research_and_development'),
                    record.get('selling_general_administrative'),
                    record.get('interest_expense'),
                    record.get('income_before_tax'),
                    record.get('income_tax_expense'),
                    record.get('net_income'),
                    record.get('ebit'),
                    record.get('ebitda'),
                    record.get('eps'),
                    record.get('eps_diluted'),
                    record.get('total_assets'),
                    record.get('total_current_assets'),
                    record.get('cash_and_equivalents'),
                    record.get('total_liabilities'),
                    record.get('total_current_liabilities'),
                    record.get('long_term_debt'),
                    record.get('total_shareholder_equity'),
                    record.get('retained_earnings'),
                    record.get('common_stock_shares_outstanding'),
                    record.get('operating_cashflow'),
                    record.get('capital_expenditures'),
                    record.get('investing_cashflow'),
                    record.get('financing_cashflow'),
                    record.get('dividend_payout'),
                    record.get('free_cash_flow')
                ))
                count += 1
            except Exception as e:
                print(f"    Error inserting record for {record.get('fiscal_date_ending')}: {e}")
                conn.rollback()
                continue
                
    conn.commit()
    return count


def process_symbol(conn, asset_id: int, symbol: str) -> Dict[str, int]:
    """
    Fetch and store all fundamentals for a symbol.
    
    Args:
        conn: Database connection
        asset_id: Asset ID
        symbol: Stock symbol
        
    Returns:
        Dict with 'quarterly' and 'annual' counts
    """
    results = {'quarterly': 0, 'annual': 0}
    
    # Fetch quarterly data
    print(f"  Fetching quarterly data...")
    
    income_q = fetch_fmp_data('income-statement', symbol, 'quarter')
    time.sleep(REQUEST_DELAY)
    
    balance_q = fetch_fmp_data('balance-sheet-statement', symbol, 'quarter')
    time.sleep(REQUEST_DELAY)
    
    cashflow_q = fetch_fmp_data('cash-flow-statement', symbol, 'quarter')
    time.sleep(REQUEST_DELAY)
    
    if income_q:
        # Create lookup dicts by date
        income_by_date = {r['date']: r for r in income_q} if income_q else {}
        balance_by_date = {r['date']: r for r in balance_q} if balance_q else {}
        cashflow_by_date = {r['date']: r for r in cashflow_q} if cashflow_q else {}
        
        # Get all unique dates
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cashflow_by_date.keys())
        
        # Merge data for each date
        quarterly_records = []
        for date in all_dates:
            merged = merge_fmp_data(
                income_by_date.get(date, {}),
                balance_by_date.get(date, {}),
                cashflow_by_date.get(date, {})
            )
            if merged.get('fiscal_date_ending'):
                quarterly_records.append(merged)
        
        results['quarterly'] = upsert_fundamentals(
            conn, 'equity_quarterly_fundamentals', asset_id, quarterly_records
        )
    
    # Fetch annual data
    print(f"  Fetching annual data...")
    
    income_a = fetch_fmp_data('income-statement', symbol, 'annual')
    time.sleep(REQUEST_DELAY)
    
    balance_a = fetch_fmp_data('balance-sheet-statement', symbol, 'annual')
    time.sleep(REQUEST_DELAY)
    
    cashflow_a = fetch_fmp_data('cash-flow-statement', symbol, 'annual')
    time.sleep(REQUEST_DELAY)
    
    if income_a:
        income_by_date = {r['date']: r for r in income_a} if income_a else {}
        balance_by_date = {r['date']: r for r in balance_a} if balance_a else {}
        cashflow_by_date = {r['date']: r for r in cashflow_a} if cashflow_a else {}
        
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cashflow_by_date.keys())
        
        annual_records = []
        for date in all_dates:
            merged = merge_fmp_data(
                income_by_date.get(date, {}),
                balance_by_date.get(date, {}),
                cashflow_by_date.get(date, {})
            )
            if merged.get('fiscal_date_ending'):
                annual_records.append(merged)
        
        results['annual'] = upsert_fundamentals(
            conn, 'equity_annual_fundamentals', asset_id, annual_records
        )
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Backfill fundamentals data using FMP API')
    parser.add_argument('--symbols', nargs='+', help='Specific symbols to process')
    parser.add_argument('--limit', type=int, help='Limit number of assets to process')
    parser.add_argument('--all', action='store_true', help='Process all missing assets')
    parser.add_argument('--refresh-view', action='store_true', help='Refresh materialized view after completion')
    args = parser.parse_args()
    
    print(f"=" * 60)
    print(f"FMP Fundamentals Backfill - Started at {datetime.now()}")
    print(f"=" * 60)
    
    conn = get_connection()
    
    # Get assets to process
    if args.symbols:
        assets = get_assets_by_symbols(conn, args.symbols)
        print(f"Processing {len(assets)} specified symbols")
    elif args.all:
        assets = get_assets_missing_fundamentals(conn)
        print(f"Processing ALL {len(assets)} assets missing fundamentals")
    else:
        limit = args.limit or 50  # Default to 50 if no limit specified
        assets = get_assets_missing_fundamentals(conn, limit)
        print(f"Processing top {len(assets)} assets by market cap")
    
    if not assets:
        print("No assets to process!")
        conn.close()
        return
    
    # Process each asset
    total = len(assets)
    success_count = 0
    fail_count = 0
    total_quarterly = 0
    total_annual = 0
    
    start_time = time.time()
    
    for i, asset in enumerate(assets):
        asset_id = asset['asset_id']
        symbol = asset['symbol']
        name = asset['name'] or 'Unknown'
        market_cap = asset['market_cap']
        
        # Format market cap for display
        if market_cap and market_cap >= 1e9:
            mc_str = f"${market_cap/1e9:.1f}B"
        elif market_cap and market_cap >= 1e6:
            mc_str = f"${market_cap/1e6:.0f}M"
        else:
            mc_str = "N/A"
        
        print(f"\n[{i+1}/{total}] {symbol} ({name[:30]}) - MC: {mc_str}")
        
        try:
            results = process_symbol(conn, asset_id, symbol)
            
            if results['quarterly'] > 0 or results['annual'] > 0:
                print(f"  ✓ Quarterly: {results['quarterly']}, Annual: {results['annual']}")
                success_count += 1
                total_quarterly += results['quarterly']
                total_annual += results['annual']
            else:
                print(f"  - No data available from FMP")
                fail_count += 1
                
        except Exception as e:
            print(f"  ✗ Error: {e}")
            fail_count += 1
        
        # Progress report every 10 assets
        if (i + 1) % 10 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed * 60  # assets per minute
            print(f"\n{'=' * 40}")
            print(f"Progress: {i+1}/{total} | Success: {success_count} | Failed: {fail_count}")
            print(f"Rate: {rate:.1f} assets/min | Elapsed: {elapsed/60:.1f} min")
            print(f"{'=' * 40}")
    
    # Refresh materialized view if requested
    if args.refresh_view:
        print(f"\nRefreshing materialized view...")
        with conn.cursor() as cur:
            cur.execute("REFRESH MATERIALIZED VIEW mv_dashboard_all_assets;")
        conn.commit()
        print("  ✓ Materialized view refreshed")
    
    conn.close()
    
    elapsed = time.time() - start_time
    
    print(f"\n{'=' * 60}")
    print(f"COMPLETE - {datetime.now()}")
    print(f"{'=' * 60}")
    print(f"Total processed: {total}")
    print(f"Success: {success_count}")
    print(f"Failed/No data: {fail_count}")
    print(f"Total quarterly records: {total_quarterly}")
    print(f"Total annual records: {total_annual}")
    print(f"Elapsed time: {elapsed/60:.1f} minutes")
    print(f"Rate: {total/elapsed*60:.1f} assets/minute")
    
    if not args.refresh_view:
        print(f"\n⚠️  Remember to refresh the materialized view:")
        print(f"    REFRESH MATERIALIZED VIEW mv_dashboard_all_assets;")
        print(f"    Or run with --refresh-view flag")


if __name__ == "__main__":
    main()

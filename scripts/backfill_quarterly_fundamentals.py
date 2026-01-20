#!/usr/bin/env python3
"""
Backfill quarterly and annual fundamentals for assets missing historical financial data.
Uses Alpha Vantage API to fetch income statement, balance sheet, and cash flow data.
"""

import os
import sys
import time
import psycopg2
import requests
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Database connection
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# Alpha Vantage API
ALPHA_VANTAGE_API_KEY = os.environ.get('ALPHA_VANTAGE_API_KEY', 'PLZVWIJQFOVHT4WL')
ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query'

# Rate limiting: Alpha Vantage premium allows 75 calls/minute
# We need 4 calls per symbol (overview, income, balance, cashflow)
REQUEST_DELAY = 12.0  # 12 seconds between symbols (48 seconds for 4 calls)

def get_connection():
    return psycopg2.connect(DB_URL)

def get_assets_missing_fundamentals(conn, limit=None):
    """Get active equities missing quarterly fundamentals data."""
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
        return cur.fetchall()

def parse_numeric(value):
    """Parse a numeric value from Alpha Vantage, handling 'None' strings."""
    if value is None or value == 'None' or value == '':
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None

def parse_decimal(value):
    """Parse a decimal value from Alpha Vantage, handling 'None' and '-' strings."""
    if value is None or value == 'None' or value == '' or value == '-':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def fetch_alpha_vantage(function, symbol):
    """Fetch data from Alpha Vantage API."""
    try:
        params = {
            'function': function,
            'symbol': symbol,
            'apikey': ALPHA_VANTAGE_API_KEY
        }
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=30)
        data = response.json()
        
        # Check for rate limiting or errors
        if 'Note' in data:
            print(f"  Rate limited: {data['Note'][:50]}...")
            return None
        if 'Information' in data:
            print(f"  Info: {data['Information'][:50]}...")
            return None
        if 'Error Message' in data:
            print(f"  Error: {data['Error Message'][:50]}...")
            return None
            
        return data
    except Exception as e:
        print(f"  Error fetching {function} for {symbol}: {e}")
        return None

def merge_financial_data(income, balance, cashflow):
    """Merge data from income statement, balance sheet, and cash flow."""
    merged = {}
    
    if income:
        merged['fiscal_date_ending'] = income.get('fiscalDateEnding')
        merged['total_revenue'] = parse_numeric(income.get('totalRevenue'))
        merged['gross_profit'] = parse_numeric(income.get('grossProfit'))
        merged['operating_income'] = parse_numeric(income.get('operatingIncome'))
        merged['net_income'] = parse_numeric(income.get('netIncome'))
        merged['ebitda'] = parse_numeric(income.get('ebitda'))
        merged['ebit'] = parse_numeric(income.get('ebit'))
        merged['eps_diluted'] = parse_decimal(income.get('reportedEPS'))
        merged['income_tax_expense'] = parse_numeric(income.get('incomeTaxExpense'))
        
    if balance:
        merged['total_assets'] = parse_numeric(balance.get('totalAssets'))
        merged['total_liabilities'] = parse_numeric(balance.get('totalLiabilities'))
        merged['total_shareholder_equity'] = parse_numeric(balance.get('totalShareholderEquity'))
        merged['long_term_debt'] = parse_numeric(balance.get('longTermDebt'))
        merged['short_term_debt'] = parse_numeric(balance.get('shortTermDebt'))
        merged['cash_and_equivalents'] = parse_numeric(balance.get('cashAndCashEquivalentsAtCarryingValue'))
        merged['total_current_assets'] = parse_numeric(balance.get('totalCurrentAssets'))
        merged['total_current_liabilities'] = parse_numeric(balance.get('totalCurrentLiabilities'))
        merged['inventory'] = parse_numeric(balance.get('inventory'))
        merged['accounts_receivable'] = parse_numeric(balance.get('currentNetReceivables'))
        merged['accounts_payable'] = parse_numeric(balance.get('currentAccountsPayable'))
        
    if cashflow:
        merged['operating_cashflow'] = parse_numeric(cashflow.get('operatingCashflow'))
        merged['investing_cashflow'] = parse_numeric(cashflow.get('cashflowFromInvestment'))
        merged['financing_cashflow'] = parse_numeric(cashflow.get('cashflowFromFinancing'))
        merged['capital_expenditures'] = parse_numeric(cashflow.get('capitalExpenditures'))
        merged['dividends_paid'] = parse_numeric(cashflow.get('dividendPayout'))
        
        # Calculate free cash flow
        op_cf = merged.get('operating_cashflow')
        capex = merged.get('capital_expenditures')
        if op_cf is not None and capex is not None:
            # capex is typically negative, so we add it
            merged['free_cash_flow'] = op_cf + capex if capex < 0 else op_cf - capex
        else:
            merged['free_cash_flow'] = None
            
    return merged

def upsert_quarterly_fundamentals(conn, asset_id, records):
    """Insert or update quarterly fundamentals records."""
    if not records:
        return 0
        
    count = 0
    with conn.cursor() as cur:
        for record in records:
            if not record.get('fiscal_date_ending'):
                continue
                
            cur.execute("""
                INSERT INTO equity_quarterly_fundamentals (
                    asset_id, fiscal_date_ending, total_revenue, gross_profit,
                    operating_income, net_income, ebitda, ebit, eps_diluted,
                    income_tax_expense, total_assets, total_liabilities,
                    total_shareholder_equity, long_term_debt,
                    cash_and_equivalents, total_current_assets, total_current_liabilities,
                    operating_cashflow, investing_cashflow, financing_cashflow,
                    capital_expenditures, dividend_payout, free_cash_flow
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (asset_id, fiscal_date_ending) DO UPDATE SET
                    total_revenue = COALESCE(EXCLUDED.total_revenue, equity_quarterly_fundamentals.total_revenue),
                    gross_profit = COALESCE(EXCLUDED.gross_profit, equity_quarterly_fundamentals.gross_profit),
                    operating_income = COALESCE(EXCLUDED.operating_income, equity_quarterly_fundamentals.operating_income),
                    net_income = COALESCE(EXCLUDED.net_income, equity_quarterly_fundamentals.net_income),
                    ebitda = COALESCE(EXCLUDED.ebitda, equity_quarterly_fundamentals.ebitda),
                    ebit = COALESCE(EXCLUDED.ebit, equity_quarterly_fundamentals.ebit),
                    eps_diluted = COALESCE(EXCLUDED.eps_diluted, equity_quarterly_fundamentals.eps_diluted),
                    operating_cashflow = COALESCE(EXCLUDED.operating_cashflow, equity_quarterly_fundamentals.operating_cashflow),
                    investing_cashflow = COALESCE(EXCLUDED.investing_cashflow, equity_quarterly_fundamentals.investing_cashflow),
                    financing_cashflow = COALESCE(EXCLUDED.financing_cashflow, equity_quarterly_fundamentals.financing_cashflow),
                    free_cash_flow = COALESCE(EXCLUDED.free_cash_flow, equity_quarterly_fundamentals.free_cash_flow)
            """, (
                asset_id,
                record.get('fiscal_date_ending'),
                record.get('total_revenue'),
                record.get('gross_profit'),
                record.get('operating_income'),
                record.get('net_income'),
                record.get('ebitda'),
                record.get('ebit'),
                record.get('eps_diluted'),
                record.get('income_tax_expense'),
                record.get('total_assets'),
                record.get('total_liabilities'),
                record.get('total_shareholder_equity'),
                record.get('long_term_debt'),
                record.get('cash_and_equivalents'),
                record.get('total_current_assets'),
                record.get('total_current_liabilities'),
                record.get('operating_cashflow'),
                record.get('investing_cashflow'),
                record.get('financing_cashflow'),
                record.get('capital_expenditures'),
                record.get('dividends_paid'),
                record.get('free_cash_flow')
            ))
            count += 1
    conn.commit()
    return count

def upsert_annual_fundamentals(conn, asset_id, records):
    """Insert or update annual fundamentals records."""
    if not records:
        return 0
        
    count = 0
    with conn.cursor() as cur:
        for record in records:
            if not record.get('fiscal_date_ending'):
                continue
                
            cur.execute("""
                INSERT INTO equity_annual_fundamentals (
                    asset_id, fiscal_date_ending, total_revenue, gross_profit,
                    operating_income, net_income, ebitda, ebit, eps_diluted,
                    income_tax_expense, total_assets, total_liabilities,
                    total_shareholder_equity, long_term_debt,
                    cash_and_equivalents, total_current_assets, total_current_liabilities,
                    operating_cashflow, investing_cashflow, financing_cashflow,
                    capital_expenditures, dividend_payout, free_cash_flow
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (asset_id, fiscal_date_ending) DO UPDATE SET
                    total_revenue = COALESCE(EXCLUDED.total_revenue, equity_annual_fundamentals.total_revenue),
                    gross_profit = COALESCE(EXCLUDED.gross_profit, equity_annual_fundamentals.gross_profit),
                    operating_income = COALESCE(EXCLUDED.operating_income, equity_annual_fundamentals.operating_income),
                    net_income = COALESCE(EXCLUDED.net_income, equity_annual_fundamentals.net_income),
                    ebitda = COALESCE(EXCLUDED.ebitda, equity_annual_fundamentals.ebitda),
                    ebit = COALESCE(EXCLUDED.ebit, equity_annual_fundamentals.ebit),
                    eps_diluted = COALESCE(EXCLUDED.eps_diluted, equity_annual_fundamentals.eps_diluted),
                    operating_cashflow = COALESCE(EXCLUDED.operating_cashflow, equity_annual_fundamentals.operating_cashflow),
                    investing_cashflow = COALESCE(EXCLUDED.investing_cashflow, equity_annual_fundamentals.investing_cashflow),
                    financing_cashflow = COALESCE(EXCLUDED.financing_cashflow, equity_annual_fundamentals.financing_cashflow),
                    free_cash_flow = COALESCE(EXCLUDED.free_cash_flow, equity_annual_fundamentals.free_cash_flow)
            """, (
                asset_id,
                record.get('fiscal_date_ending'),
                record.get('total_revenue'),
                record.get('gross_profit'),
                record.get('operating_income'),
                record.get('net_income'),
                record.get('ebitda'),
                record.get('ebit'),
                record.get('eps_diluted'),
                record.get('income_tax_expense'),
                record.get('total_assets'),
                record.get('total_liabilities'),
                record.get('total_shareholder_equity'),
                record.get('long_term_debt'),
                record.get('cash_and_equivalents'),
                record.get('total_current_assets'),
                record.get('total_current_liabilities'),
                record.get('operating_cashflow'),
                record.get('investing_cashflow'),
                record.get('financing_cashflow'),
                record.get('capital_expenditures'),
                record.get('dividends_paid'),
                record.get('free_cash_flow')
            ))
            count += 1
    conn.commit()
    return count

def process_symbol(conn, asset_id, symbol):
    """Fetch and store all fundamentals for a symbol."""
    results = {'quarterly': 0, 'annual': 0}
    
    # Fetch income statement
    print(f"  Fetching INCOME_STATEMENT...")
    income_data = fetch_alpha_vantage('INCOME_STATEMENT', symbol)
    time.sleep(1)
    
    # Fetch balance sheet
    print(f"  Fetching BALANCE_SHEET...")
    balance_data = fetch_alpha_vantage('BALANCE_SHEET', symbol)
    time.sleep(1)
    
    # Fetch cash flow
    print(f"  Fetching CASH_FLOW...")
    cashflow_data = fetch_alpha_vantage('CASH_FLOW', symbol)
    
    if not income_data:
        print(f"  No income data available")
        return results
    
    # Process quarterly data
    quarterly_records = []
    if 'quarterlyReports' in income_data:
        income_by_date = {r['fiscalDateEnding']: r for r in income_data.get('quarterlyReports', [])}
        balance_by_date = {r['fiscalDateEnding']: r for r in (balance_data or {}).get('quarterlyReports', [])}
        cashflow_by_date = {r['fiscalDateEnding']: r for r in (cashflow_data or {}).get('quarterlyReports', [])}
        
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cashflow_by_date.keys())
        for fiscal_date in all_dates:
            merged = merge_financial_data(
                income_by_date.get(fiscal_date),
                balance_by_date.get(fiscal_date),
                cashflow_by_date.get(fiscal_date)
            )
            if merged.get('fiscal_date_ending'):
                quarterly_records.append(merged)
    
    results['quarterly'] = upsert_quarterly_fundamentals(conn, asset_id, quarterly_records)
    
    # Process annual data
    annual_records = []
    if 'annualReports' in income_data:
        income_by_date = {r['fiscalDateEnding']: r for r in income_data.get('annualReports', [])}
        balance_by_date = {r['fiscalDateEnding']: r for r in (balance_data or {}).get('annualReports', [])}
        cashflow_by_date = {r['fiscalDateEnding']: r for r in (cashflow_data or {}).get('annualReports', [])}
        
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cashflow_by_date.keys())
        for fiscal_date in all_dates:
            merged = merge_financial_data(
                income_by_date.get(fiscal_date),
                balance_by_date.get(fiscal_date),
                cashflow_by_date.get(fiscal_date)
            )
            if merged.get('fiscal_date_ending'):
                annual_records.append(merged)
    
    results['annual'] = upsert_annual_fundamentals(conn, asset_id, annual_records)
    
    return results

def main(limit=None, symbols=None):
    print(f"Starting quarterly fundamentals backfill at {datetime.now()}")
    
    conn = get_connection()
    
    if symbols:
        # Process specific symbols
        with conn.cursor() as cur:
            placeholders = ','.join(['%s'] * len(symbols))
            cur.execute(f"""
                SELECT a.asset_id, a.symbol, a.name, em.market_cap
                FROM assets a
                LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
                WHERE a.symbol IN ({placeholders}) AND a.asset_type = 'equity'
            """, symbols)
            assets = cur.fetchall()
    else:
        # Get assets missing fundamentals
        assets = get_assets_missing_fundamentals(conn, limit)
    
    total = len(assets)
    print(f"Found {total} assets to process")
    
    success_count = 0
    fail_count = 0
    total_quarterly = 0
    total_annual = 0
    
    for i, (asset_id, symbol, name, market_cap) in enumerate(assets):
        mc_str = f"${market_cap/1e9:.1f}B" if market_cap and market_cap >= 1e9 else f"${market_cap/1e6:.0f}M" if market_cap else "N/A"
        print(f"[{i+1}/{total}] {symbol} ({name[:30]}...) - MC: {mc_str}")
        
        try:
            results = process_symbol(conn, asset_id, symbol)
            
            if results['quarterly'] > 0 or results['annual'] > 0:
                print(f"  ✓ Quarterly: {results['quarterly']}, Annual: {results['annual']}")
                success_count += 1
                total_quarterly += results['quarterly']
                total_annual += results['annual']
            else:
                print(f"  - No data available")
                fail_count += 1
        except Exception as e:
            print(f"  ✗ Error: {e}")
            fail_count += 1
        
        # Rate limiting between symbols
        if i < total - 1:
            print(f"  Waiting {REQUEST_DELAY}s for rate limiting...")
            time.sleep(REQUEST_DELAY)
        
        # Progress report every 10 assets
        if (i + 1) % 10 == 0:
            print(f"\n=== Progress: {i+1}/{total} | Success: {success_count} | Failed: {fail_count} ===\n")
    
    conn.close()
    
    print(f"\n=== COMPLETE ===")
    print(f"Total processed: {total}")
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Total quarterly records: {total_quarterly}")
    print(f"Total annual records: {total_annual}")
    
    print(f"\n⚠️  Remember to refresh the materialized view:")
    print(f"    REFRESH MATERIALIZED VIEW mv_dashboard_all_assets;")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Backfill quarterly fundamentals data')
    parser.add_argument('--limit', type=int, help='Limit number of assets to process')
    parser.add_argument('--symbols', nargs='+', help='Specific symbols to process')
    args = parser.parse_args()
    
    main(limit=args.limit, symbols=args.symbols)

#!/usr/bin/env python3
"""
Fetch historical financial statements for mining stocks from FMP API.
Populates equity_annual_fundamentals and equity_quarterly_fundamentals tables.
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

# FMP API Key
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'xgLJ9K1GyYLRNZKqLhCvCcQbYBJkNqw2')

def get_connection():
    return psycopg2.connect(DB_URL)

def safe_int(value):
    """Convert value to integer, handling None and invalid values."""
    if value is None:
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None

def safe_float(value):
    """Convert value to float, handling None and invalid values."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def fetch_income_statement(symbol, period='annual'):
    """Fetch income statement from FMP API."""
    try:
        url = f"https://financialmodelingprep.com/api/v3/income-statement/{symbol}?period={period}&limit=20&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"  Error fetching income statement: {e}")
        return None

def fetch_balance_sheet(symbol, period='annual'):
    """Fetch balance sheet from FMP API."""
    try:
        url = f"https://financialmodelingprep.com/api/v3/balance-sheet-statement/{symbol}?period={period}&limit=20&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"  Error fetching balance sheet: {e}")
        return None

def fetch_cash_flow(symbol, period='annual'):
    """Fetch cash flow statement from FMP API."""
    try:
        url = f"https://financialmodelingprep.com/api/v3/cash-flow-statement/{symbol}?period={period}&limit=20&apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"  Error fetching cash flow: {e}")
        return None

def insert_annual_fundamentals(conn, asset_id, income, balance, cashflow):
    """Insert annual fundamentals data."""
    cur = conn.cursor()
    
    # Create a dict keyed by date for easy lookup
    balance_by_date = {b['date']: b for b in (balance or [])}
    cashflow_by_date = {c['date']: c for c in (cashflow or [])}
    
    inserted = 0
    for inc in (income or []):
        date = inc.get('date')
        if not date:
            continue
            
        bal = balance_by_date.get(date, {})
        cf = cashflow_by_date.get(date, {})
        
        try:
            cur.execute("""
                INSERT INTO equity_annual_fundamentals (
                    asset_id, fiscal_date_ending, reported_currency,
                    total_revenue, cost_of_revenue, gross_profit,
                    operating_expenses, operating_income, research_and_development,
                    selling_general_administrative, interest_expense, income_before_tax,
                    income_tax_expense, net_income, ebit, ebitda, eps, eps_diluted,
                    total_assets, total_current_assets, cash_and_equivalents,
                    total_liabilities, total_current_liabilities, long_term_debt,
                    total_shareholder_equity, retained_earnings, common_stock_shares_outstanding,
                    operating_cashflow, capital_expenditures, investing_cashflow,
                    financing_cashflow, dividend_payout, free_cash_flow,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                )
                ON CONFLICT (asset_id, fiscal_date_ending) DO UPDATE SET
                    total_revenue = EXCLUDED.total_revenue,
                    cost_of_revenue = EXCLUDED.cost_of_revenue,
                    gross_profit = EXCLUDED.gross_profit,
                    operating_expenses = EXCLUDED.operating_expenses,
                    operating_income = EXCLUDED.operating_income,
                    net_income = EXCLUDED.net_income,
                    ebitda = EXCLUDED.ebitda,
                    eps = EXCLUDED.eps,
                    eps_diluted = EXCLUDED.eps_diluted,
                    total_assets = EXCLUDED.total_assets,
                    total_liabilities = EXCLUDED.total_liabilities,
                    total_shareholder_equity = EXCLUDED.total_shareholder_equity,
                    operating_cashflow = EXCLUDED.operating_cashflow,
                    free_cash_flow = EXCLUDED.free_cash_flow,
                    updated_at = NOW()
            """, (
                asset_id, date, inc.get('reportedCurrency'),
                safe_int(inc.get('revenue')), safe_int(inc.get('costOfRevenue')), safe_int(inc.get('grossProfit')),
                safe_int(inc.get('operatingExpenses')), safe_int(inc.get('operatingIncome')), safe_int(inc.get('researchAndDevelopmentExpenses')),
                safe_int(inc.get('sellingGeneralAndAdministrativeExpenses')), safe_int(inc.get('interestExpense')), safe_int(inc.get('incomeBeforeTax')),
                safe_int(inc.get('incomeTaxExpense')), safe_int(inc.get('netIncome')), safe_int(inc.get('ebitda')), safe_int(inc.get('ebitda')),
                safe_float(inc.get('eps')), safe_float(inc.get('epsdiluted')),
                safe_int(bal.get('totalAssets')), safe_int(bal.get('totalCurrentAssets')), safe_int(bal.get('cashAndCashEquivalents')),
                safe_int(bal.get('totalLiabilities')), safe_int(bal.get('totalCurrentLiabilities')), safe_int(bal.get('longTermDebt')),
                safe_int(bal.get('totalStockholdersEquity')), safe_int(bal.get('retainedEarnings')), safe_int(bal.get('commonStock')),
                safe_int(cf.get('operatingCashFlow')), safe_int(cf.get('capitalExpenditure')), safe_int(cf.get('netCashUsedForInvestingActivites')),
                safe_int(cf.get('netCashUsedProvidedByFinancingActivities')), safe_int(cf.get('dividendsPaid')), safe_int(cf.get('freeCashFlow'))
            ))
            inserted += 1
        except Exception as e:
            print(f"    Error inserting {date}: {e}")
            conn.rollback()
            continue
    
    conn.commit()
    cur.close()
    return inserted

def insert_quarterly_fundamentals(conn, asset_id, income, balance, cashflow):
    """Insert quarterly fundamentals data."""
    cur = conn.cursor()
    
    # Create a dict keyed by date for easy lookup
    balance_by_date = {b['date']: b for b in (balance or [])}
    cashflow_by_date = {c['date']: c for c in (cashflow or [])}
    
    inserted = 0
    for inc in (income or []):
        date = inc.get('date')
        if not date:
            continue
            
        bal = balance_by_date.get(date, {})
        cf = cashflow_by_date.get(date, {})
        
        try:
            cur.execute("""
                INSERT INTO equity_quarterly_fundamentals (
                    asset_id, fiscal_date_ending, reported_currency,
                    total_revenue, cost_of_revenue, gross_profit,
                    operating_expenses, operating_income, research_and_development,
                    selling_general_administrative, interest_expense, income_before_tax,
                    income_tax_expense, net_income, ebit, ebitda, eps, eps_diluted,
                    total_assets, total_current_assets, cash_and_equivalents,
                    total_liabilities, total_current_liabilities, long_term_debt,
                    total_shareholder_equity, retained_earnings, common_stock_shares_outstanding,
                    operating_cashflow, capital_expenditures, investing_cashflow,
                    financing_cashflow, dividend_payout, free_cash_flow,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                )
                ON CONFLICT (asset_id, fiscal_date_ending) DO UPDATE SET
                    total_revenue = EXCLUDED.total_revenue,
                    cost_of_revenue = EXCLUDED.cost_of_revenue,
                    gross_profit = EXCLUDED.gross_profit,
                    operating_expenses = EXCLUDED.operating_expenses,
                    operating_income = EXCLUDED.operating_income,
                    net_income = EXCLUDED.net_income,
                    ebitda = EXCLUDED.ebitda,
                    eps = EXCLUDED.eps,
                    eps_diluted = EXCLUDED.eps_diluted,
                    total_assets = EXCLUDED.total_assets,
                    total_liabilities = EXCLUDED.total_liabilities,
                    total_shareholder_equity = EXCLUDED.total_shareholder_equity,
                    operating_cashflow = EXCLUDED.operating_cashflow,
                    free_cash_flow = EXCLUDED.free_cash_flow,
                    updated_at = NOW()
            """, (
                asset_id, date, inc.get('reportedCurrency'),
                safe_int(inc.get('revenue')), safe_int(inc.get('costOfRevenue')), safe_int(inc.get('grossProfit')),
                safe_int(inc.get('operatingExpenses')), safe_int(inc.get('operatingIncome')), safe_int(inc.get('researchAndDevelopmentExpenses')),
                safe_int(inc.get('sellingGeneralAndAdministrativeExpenses')), safe_int(inc.get('interestExpense')), safe_int(inc.get('incomeBeforeTax')),
                safe_int(inc.get('incomeTaxExpense')), safe_int(inc.get('netIncome')), safe_int(inc.get('ebitda')), safe_int(inc.get('ebitda')),
                safe_float(inc.get('eps')), safe_float(inc.get('epsdiluted')),
                safe_int(bal.get('totalAssets')), safe_int(bal.get('totalCurrentAssets')), safe_int(bal.get('cashAndCashEquivalents')),
                safe_int(bal.get('totalLiabilities')), safe_int(bal.get('totalCurrentLiabilities')), safe_int(bal.get('longTermDebt')),
                safe_int(bal.get('totalStockholdersEquity')), safe_int(bal.get('retainedEarnings')), safe_int(bal.get('commonStock')),
                safe_int(cf.get('operatingCashFlow')), safe_int(cf.get('capitalExpenditure')), safe_int(cf.get('netCashUsedForInvestingActivites')),
                safe_int(cf.get('netCashUsedProvidedByFinancingActivities')), safe_int(cf.get('dividendsPaid')), safe_int(cf.get('freeCashFlow'))
            ))
            inserted += 1
        except Exception as e:
            print(f"    Error inserting {date}: {e}")
            conn.rollback()
            continue
    
    conn.commit()
    cur.close()
    return inserted

def get_stocks_missing_financials(conn):
    """Get mining stocks missing financial data."""
    cur = conn.cursor()
    cur.execute("""
        SELECT a.symbol, a.asset_id, a.name
        FROM stock_list_items sli
        JOIN assets a ON sli.asset_id = a.asset_id
        WHERE sli.list_id = (SELECT id FROM stock_lists WHERE name = 'Metals Miners')
          AND NOT EXISTS (SELECT 1 FROM equity_annual_fundamentals eaf WHERE eaf.asset_id = a.asset_id)
        ORDER BY a.symbol
    """)
    result = cur.fetchall()
    cur.close()
    return result

def main():
    print(f"Starting mining financials fetch at {datetime.now()}")
    
    conn = get_connection()
    
    # Get stocks missing financials
    stocks = get_stocks_missing_financials(conn)
    total = len(stocks)
    print(f"Found {total} stocks missing financial data")
    
    success_count = 0
    fail_count = 0
    
    for i, (symbol, asset_id, name) in enumerate(stocks):
        print(f"\n[{i+1}/{total}] {symbol} ({name[:30] if name else 'N/A'})")
        
        # Fetch annual data
        print(f"  Fetching annual statements...")
        annual_income = fetch_income_statement(symbol, 'annual')
        time.sleep(0.3)
        annual_balance = fetch_balance_sheet(symbol, 'annual')
        time.sleep(0.3)
        annual_cashflow = fetch_cash_flow(symbol, 'annual')
        time.sleep(0.3)
        
        if annual_income:
            annual_inserted = insert_annual_fundamentals(conn, asset_id, annual_income, annual_balance, annual_cashflow)
            print(f"  Annual: {annual_inserted} periods inserted")
        else:
            print(f"  Annual: No data from FMP")
        
        # Fetch quarterly data
        print(f"  Fetching quarterly statements...")
        quarterly_income = fetch_income_statement(symbol, 'quarter')
        time.sleep(0.3)
        quarterly_balance = fetch_balance_sheet(symbol, 'quarter')
        time.sleep(0.3)
        quarterly_cashflow = fetch_cash_flow(symbol, 'quarter')
        time.sleep(0.3)
        
        if quarterly_income:
            quarterly_inserted = insert_quarterly_fundamentals(conn, asset_id, quarterly_income, quarterly_balance, quarterly_cashflow)
            print(f"  Quarterly: {quarterly_inserted} periods inserted")
        else:
            print(f"  Quarterly: No data from FMP")
        
        if annual_income or quarterly_income:
            success_count += 1
        else:
            fail_count += 1
        
        # Rate limiting pause every 5 stocks
        if (i + 1) % 5 == 0:
            print(f"\n=== Progress: {i+1}/{total} | Success: {success_count} | Failed: {fail_count} ===")
            time.sleep(2)
    
    conn.close()
    
    print(f"\n=== COMPLETE ===")
    print(f"Total processed: {total}")
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Fetch historical financial statements for mining stocks from Yahoo Finance.
Populates equity_annual_fundamentals and equity_quarterly_fundamentals tables.
"""

import os
import sys
import time
import psycopg2
import yfinance as yf
import pandas as pd
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Database connection
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# Symbol mappings for Canadian/international stocks
SYMBOL_MAPPINGS = {
    'ACH': 'ACH',
    'AFM': 'AFM.V',
    'ARNC': 'ARNC',
    'CENX': 'CENX',
    'DNN': 'DNN',
    'DRD': 'DRD',
    'EXK': 'EXK',
    'FSM': 'FSM',
    'GOLD': 'GOLD',
    'IE': 'IE',
    'IVN': 'IVN.TO',
    'KALU': 'KALU',
    'KGC': 'KGC',
    'LAC': 'LAC',
    'LEU': 'LEU',
    'MAG': 'MAG',
    'PLL': 'PLL',
    'SA': 'SA',
    'TECK': 'TECK',
    'TGB': 'TGB',
    'UAMY': 'UAMY',
    'UUUU': 'UUUU',
    'WPM': 'WPM',
    'X': 'X',
}

def get_connection():
    return psycopg2.connect(DB_URL)

def safe_int(value):
    """Convert value to integer, handling None and invalid values."""
    if value is None or pd.isna(value):
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None

def safe_float(value):
    """Convert value to float, handling None and invalid values."""
    if value is None or pd.isna(value):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def get_value(df, row_name, col_idx=0):
    """Safely get a value from a DataFrame."""
    if df is None or df.empty:
        return None
    if row_name in df.index:
        try:
            return df.loc[row_name].iloc[col_idx]
        except:
            return None
    return None

def fetch_yahoo_financials(symbol):
    """Fetch all financial statements from Yahoo Finance."""
    try:
        ticker = yf.Ticker(symbol)
        
        return {
            'income_annual': ticker.income_stmt,
            'income_quarterly': ticker.quarterly_income_stmt,
            'balance_annual': ticker.balance_sheet,
            'balance_quarterly': ticker.quarterly_balance_sheet,
            'cashflow_annual': ticker.cashflow,
            'cashflow_quarterly': ticker.quarterly_cashflow,
        }
    except Exception as e:
        print(f"  Error fetching Yahoo data: {e}")
        return None

def insert_fundamentals(conn, asset_id, income_df, balance_df, cashflow_df, table_name):
    """Insert fundamentals data from Yahoo Finance DataFrames."""
    if income_df is None or income_df.empty:
        return 0
    
    cur = conn.cursor()
    inserted = 0
    
    for col_idx, col in enumerate(income_df.columns):
        # Get the date from the column (it's a Timestamp)
        try:
            date = col.strftime('%Y-%m-%d')
        except:
            continue
        
        # Extract values from income statement
        total_revenue = safe_int(get_value(income_df, 'Total Revenue', col_idx))
        cost_of_revenue = safe_int(get_value(income_df, 'Cost Of Revenue', col_idx))
        gross_profit = safe_int(get_value(income_df, 'Gross Profit', col_idx))
        operating_income = safe_int(get_value(income_df, 'Operating Income', col_idx))
        operating_expenses = safe_int(get_value(income_df, 'Operating Expense', col_idx))
        research_and_development = safe_int(get_value(income_df, 'Research And Development', col_idx))
        sga = safe_int(get_value(income_df, 'Selling General And Administration', col_idx))
        interest_expense = safe_int(get_value(income_df, 'Interest Expense', col_idx))
        income_before_tax = safe_int(get_value(income_df, 'Pretax Income', col_idx))
        income_tax_expense = safe_int(get_value(income_df, 'Tax Provision', col_idx))
        net_income = safe_int(get_value(income_df, 'Net Income', col_idx))
        ebitda = safe_int(get_value(income_df, 'EBITDA', col_idx))
        ebit = safe_int(get_value(income_df, 'EBIT', col_idx))
        eps = safe_float(get_value(income_df, 'Basic EPS', col_idx))
        eps_diluted = safe_float(get_value(income_df, 'Diluted EPS', col_idx))
        
        # Extract values from balance sheet (find matching date)
        total_assets = None
        total_current_assets = None
        cash_and_equivalents = None
        total_liabilities = None
        total_current_liabilities = None
        long_term_debt = None
        total_shareholder_equity = None
        retained_earnings = None
        common_stock_shares = None
        
        if balance_df is not None and not balance_df.empty:
            # Find the closest date in balance sheet
            for bal_idx, bal_col in enumerate(balance_df.columns):
                try:
                    bal_date = bal_col.strftime('%Y-%m-%d')
                    if bal_date == date:
                        total_assets = safe_int(get_value(balance_df, 'Total Assets', bal_idx))
                        total_current_assets = safe_int(get_value(balance_df, 'Current Assets', bal_idx))
                        cash_and_equivalents = safe_int(get_value(balance_df, 'Cash And Cash Equivalents', bal_idx))
                        total_liabilities = safe_int(get_value(balance_df, 'Total Liabilities Net Minority Interest', bal_idx))
                        total_current_liabilities = safe_int(get_value(balance_df, 'Current Liabilities', bal_idx))
                        long_term_debt = safe_int(get_value(balance_df, 'Long Term Debt', bal_idx))
                        total_shareholder_equity = safe_int(get_value(balance_df, 'Stockholders Equity', bal_idx))
                        retained_earnings = safe_int(get_value(balance_df, 'Retained Earnings', bal_idx))
                        common_stock_shares = safe_int(get_value(balance_df, 'Ordinary Shares Number', bal_idx))
                        break
                except:
                    continue
        
        # Extract values from cash flow (find matching date)
        operating_cashflow = None
        capital_expenditures = None
        investing_cashflow = None
        financing_cashflow = None
        dividend_payout = None
        free_cash_flow = None
        
        if cashflow_df is not None and not cashflow_df.empty:
            for cf_idx, cf_col in enumerate(cashflow_df.columns):
                try:
                    cf_date = cf_col.strftime('%Y-%m-%d')
                    if cf_date == date:
                        operating_cashflow = safe_int(get_value(cashflow_df, 'Operating Cash Flow', cf_idx))
                        capital_expenditures = safe_int(get_value(cashflow_df, 'Capital Expenditure', cf_idx))
                        investing_cashflow = safe_int(get_value(cashflow_df, 'Investing Cash Flow', cf_idx))
                        financing_cashflow = safe_int(get_value(cashflow_df, 'Financing Cash Flow', cf_idx))
                        dividend_payout = safe_int(get_value(cashflow_df, 'Cash Dividends Paid', cf_idx))
                        free_cash_flow = safe_int(get_value(cashflow_df, 'Free Cash Flow', cf_idx))
                        break
                except:
                    continue
        
        # Skip if we don't have any meaningful data
        if total_revenue is None and net_income is None and total_assets is None:
            continue
        
        try:
            cur.execute(f"""
                INSERT INTO {table_name} (
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
                    total_revenue = COALESCE(EXCLUDED.total_revenue, {table_name}.total_revenue),
                    cost_of_revenue = COALESCE(EXCLUDED.cost_of_revenue, {table_name}.cost_of_revenue),
                    gross_profit = COALESCE(EXCLUDED.gross_profit, {table_name}.gross_profit),
                    operating_expenses = COALESCE(EXCLUDED.operating_expenses, {table_name}.operating_expenses),
                    operating_income = COALESCE(EXCLUDED.operating_income, {table_name}.operating_income),
                    net_income = COALESCE(EXCLUDED.net_income, {table_name}.net_income),
                    ebitda = COALESCE(EXCLUDED.ebitda, {table_name}.ebitda),
                    eps = COALESCE(EXCLUDED.eps, {table_name}.eps),
                    eps_diluted = COALESCE(EXCLUDED.eps_diluted, {table_name}.eps_diluted),
                    total_assets = COALESCE(EXCLUDED.total_assets, {table_name}.total_assets),
                    total_liabilities = COALESCE(EXCLUDED.total_liabilities, {table_name}.total_liabilities),
                    total_shareholder_equity = COALESCE(EXCLUDED.total_shareholder_equity, {table_name}.total_shareholder_equity),
                    operating_cashflow = COALESCE(EXCLUDED.operating_cashflow, {table_name}.operating_cashflow),
                    free_cash_flow = COALESCE(EXCLUDED.free_cash_flow, {table_name}.free_cash_flow),
                    updated_at = NOW()
            """, (
                asset_id, date, 'USD',
                total_revenue, cost_of_revenue, gross_profit,
                operating_expenses, operating_income, research_and_development,
                sga, interest_expense, income_before_tax,
                income_tax_expense, net_income, ebit, ebitda, eps, eps_diluted,
                total_assets, total_current_assets, cash_and_equivalents,
                total_liabilities, total_current_liabilities, long_term_debt,
                total_shareholder_equity, retained_earnings, common_stock_shares,
                operating_cashflow, capital_expenditures, investing_cashflow,
                financing_cashflow, dividend_payout, free_cash_flow
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
    print(f"Starting mining financials fetch (Yahoo Finance) at {datetime.now()}")
    
    conn = get_connection()
    
    # Get stocks missing financials
    stocks = get_stocks_missing_financials(conn)
    total = len(stocks)
    print(f"Found {total} stocks missing financial data")
    
    success_count = 0
    fail_count = 0
    
    for i, (symbol, asset_id, name) in enumerate(stocks):
        print(f"\n[{i+1}/{total}] {symbol} ({name[:30] if name else 'N/A'})")
        
        # Get Yahoo symbol
        yahoo_symbol = SYMBOL_MAPPINGS.get(symbol, symbol)
        print(f"  Using Yahoo symbol: {yahoo_symbol}")
        
        # Fetch data from Yahoo
        data = fetch_yahoo_financials(yahoo_symbol)
        
        if data is None:
            print(f"  Failed to fetch data")
            fail_count += 1
            continue
        
        # Insert annual data
        annual_inserted = insert_fundamentals(
            conn, asset_id,
            data['income_annual'],
            data['balance_annual'],
            data['cashflow_annual'],
            'equity_annual_fundamentals'
        )
        print(f"  Annual: {annual_inserted} periods inserted")
        
        # Insert quarterly data
        quarterly_inserted = insert_fundamentals(
            conn, asset_id,
            data['income_quarterly'],
            data['balance_quarterly'],
            data['cashflow_quarterly'],
            'equity_quarterly_fundamentals'
        )
        print(f"  Quarterly: {quarterly_inserted} periods inserted")
        
        if annual_inserted > 0 or quarterly_inserted > 0:
            success_count += 1
        else:
            fail_count += 1
        
        # Rate limiting
        time.sleep(0.5)
        
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

#!/usr/bin/env python3
"""
Comprehensive FMP Fundamentals Backfill Script

This script fetches and stores:
1. Income Statement, Balance Sheet, Cash Flow (quarterly + annual)
2. Financial Ratios (quarterly + annual)
3. Key Metrics (quarterly + annual)
4. Financial Growth metrics (quarterly + annual)
5. Updates equity_metadata with latest ratios

Usage:
    # Process specific symbols
    python3 scripts/backfill_all_fundamentals_fmp.py --symbols AAPL MSFT NVDA
    
    # Process top N missing assets by market cap
    python3 scripts/backfill_all_fundamentals_fmp.py --limit 100
    
    # Process all missing assets
    python3 scripts/backfill_all_fundamentals_fmp.py --all
    
    # Skip certain data types
    python3 scripts/backfill_all_fundamentals_fmp.py --limit 100 --skip-ratios --skip-growth
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
DB_URL = os.environ.get('DATABASE_URL', 
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres")

# FMP API Configuration
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe')
FMP_BASE_URL = 'https://financialmodelingprep.com/stable'

# Rate limiting
REQUEST_DELAY = 0.3  # 300ms between API calls


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


def fetch_fmp_data(endpoint: str, symbol: str, period: str = 'quarter', limit: int = 40) -> Optional[List[Dict]]:
    """Fetch data from FMP API."""
    url = f"{FMP_BASE_URL}/{endpoint}"
    params = {
        'symbol': symbol,
        'period': period,
        'limit': limit,
        'apikey': FMP_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        if isinstance(data, dict) and 'Error Message' in data:
            return None
            
        if not isinstance(data, list):
            return None
            
        return data
        
    except Exception as e:
        print(f"      Error fetching {endpoint}: {e}")
        return None


def parse_int(value) -> Optional[int]:
    """Parse integer value."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def parse_float(value) -> Optional[float]:
    """Parse float value."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


# ============================================================================
# FINANCIAL STATEMENTS (Income, Balance Sheet, Cash Flow)
# ============================================================================

def merge_financial_statements(income: Dict, balance: Dict, cashflow: Dict) -> Dict[str, Any]:
    """Merge financial statement data into database schema."""
    merged = {}
    
    merged['fiscal_date_ending'] = income.get('date') or balance.get('date') or cashflow.get('date')
    merged['reported_currency'] = income.get('reportedCurrency') or balance.get('reportedCurrency')
    
    # Income Statement
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
    
    # Balance Sheet
    if balance:
        merged['total_assets'] = parse_int(balance.get('totalAssets'))
        merged['total_current_assets'] = parse_int(balance.get('totalCurrentAssets'))
        merged['cash_and_equivalents'] = parse_int(balance.get('cashAndCashEquivalents'))
        merged['total_liabilities'] = parse_int(balance.get('totalLiabilities'))
        merged['total_current_liabilities'] = parse_int(balance.get('totalCurrentLiabilities'))
        merged['long_term_debt'] = parse_int(balance.get('longTermDebt'))
        merged['total_shareholder_equity'] = parse_int(balance.get('totalStockholdersEquity'))
        merged['retained_earnings'] = parse_int(balance.get('retainedEarnings'))
    
    # Cash Flow
    if cashflow:
        merged['operating_cashflow'] = parse_int(cashflow.get('netCashProvidedByOperatingActivities'))
        merged['capital_expenditures'] = parse_int(cashflow.get('investmentsInPropertyPlantAndEquipment'))
        merged['investing_cashflow'] = parse_int(cashflow.get('netCashProvidedByInvestingActivities'))
        merged['financing_cashflow'] = parse_int(cashflow.get('netCashProvidedByFinancingActivities'))
        merged['dividend_payout'] = parse_int(cashflow.get('commonDividendsPaid'))
        merged['free_cash_flow'] = parse_int(cashflow.get('freeCashFlow'))
    
    return merged


def upsert_fundamentals(conn, table_name: str, asset_id: int, records: List[Dict]) -> int:
    """Insert or update fundamentals records."""
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
                        revenue_growth, net_income_growth, eps_diluted_growth,
                        fcf_growth, ebitda_growth,
                        three_year_revenue_cagr, five_year_revenue_cagr,
                        three_year_net_income_cagr, five_year_net_income_cagr,
                        updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, NOW()
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
                        revenue_growth = COALESCE(EXCLUDED.revenue_growth, {table_name}.revenue_growth),
                        net_income_growth = COALESCE(EXCLUDED.net_income_growth, {table_name}.net_income_growth),
                        eps_diluted_growth = COALESCE(EXCLUDED.eps_diluted_growth, {table_name}.eps_diluted_growth),
                        fcf_growth = COALESCE(EXCLUDED.fcf_growth, {table_name}.fcf_growth),
                        ebitda_growth = COALESCE(EXCLUDED.ebitda_growth, {table_name}.ebitda_growth),
                        three_year_revenue_cagr = COALESCE(EXCLUDED.three_year_revenue_cagr, {table_name}.three_year_revenue_cagr),
                        five_year_revenue_cagr = COALESCE(EXCLUDED.five_year_revenue_cagr, {table_name}.five_year_revenue_cagr),
                        three_year_net_income_cagr = COALESCE(EXCLUDED.three_year_net_income_cagr, {table_name}.three_year_net_income_cagr),
                        five_year_net_income_cagr = COALESCE(EXCLUDED.five_year_net_income_cagr, {table_name}.five_year_net_income_cagr),
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
                    record.get('free_cash_flow'),
                    record.get('revenue_growth'),
                    record.get('net_income_growth'),
                    record.get('eps_diluted_growth'),
                    record.get('fcf_growth'),
                    record.get('ebitda_growth'),
                    record.get('three_year_revenue_cagr'),
                    record.get('five_year_revenue_cagr'),
                    record.get('three_year_net_income_cagr'),
                    record.get('five_year_net_income_cagr')
                ))
                count += 1
            except Exception as e:
                print(f"      Error inserting {record.get('fiscal_date_ending')}: {e}")
                conn.rollback()
                continue
                
    conn.commit()
    return count


# ============================================================================
# FINANCIAL RATIOS
# ============================================================================

def upsert_ratios_quarterly(conn, asset_id: int, ratios_data: List[Dict]) -> int:
    """Insert quarterly ratios into equity_ratios_quarterly table."""
    if not ratios_data:
        return 0
    
    count = 0
    with conn.cursor() as cur:
        for r in ratios_data:
            if not r.get('date'):
                continue
            
            try:
                cur.execute("""
                    INSERT INTO equity_ratios_quarterly (
                        asset_id, fiscal_date, fiscal_year, fiscal_quarter,
                        current_ratio, quick_ratio, cash_ratio,
                        debt_to_equity, debt_to_assets, debt_to_capital, interest_coverage,
                        asset_turnover, inventory_turnover, receivables_turnover, payables_turnover,
                        gross_profit_margin, operating_profit_margin, ebitda_margin, net_profit_margin,
                        return_on_assets, return_on_equity,
                        price_to_earnings, price_to_book, price_to_sales, price_to_fcf,
                        revenue_per_share, book_value_per_share,
                        days_sales_outstanding, days_inventory_outstanding, days_payables_outstanding,
                        cash_conversion_cycle,
                        updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, NOW()
                    )
                    ON CONFLICT (asset_id, fiscal_date) DO UPDATE SET
                        current_ratio = EXCLUDED.current_ratio,
                        quick_ratio = EXCLUDED.quick_ratio,
                        cash_ratio = EXCLUDED.cash_ratio,
                        debt_to_equity = EXCLUDED.debt_to_equity,
                        debt_to_assets = EXCLUDED.debt_to_assets,
                        debt_to_capital = EXCLUDED.debt_to_capital,
                        interest_coverage = EXCLUDED.interest_coverage,
                        asset_turnover = EXCLUDED.asset_turnover,
                        inventory_turnover = EXCLUDED.inventory_turnover,
                        receivables_turnover = EXCLUDED.receivables_turnover,
                        payables_turnover = EXCLUDED.payables_turnover,
                        gross_profit_margin = EXCLUDED.gross_profit_margin,
                        operating_profit_margin = EXCLUDED.operating_profit_margin,
                        ebitda_margin = EXCLUDED.ebitda_margin,
                        net_profit_margin = EXCLUDED.net_profit_margin,
                        return_on_assets = EXCLUDED.return_on_assets,
                        return_on_equity = EXCLUDED.return_on_equity,
                        price_to_earnings = EXCLUDED.price_to_earnings,
                        price_to_book = EXCLUDED.price_to_book,
                        price_to_sales = EXCLUDED.price_to_sales,
                        price_to_fcf = EXCLUDED.price_to_fcf,
                        revenue_per_share = EXCLUDED.revenue_per_share,
                        book_value_per_share = EXCLUDED.book_value_per_share,
                        days_sales_outstanding = EXCLUDED.days_sales_outstanding,
                        days_inventory_outstanding = EXCLUDED.days_inventory_outstanding,
                        days_payables_outstanding = EXCLUDED.days_payables_outstanding,
                        cash_conversion_cycle = EXCLUDED.cash_conversion_cycle,
                        updated_at = NOW()
                """, (
                    asset_id,
                    r.get('date'),
                    r.get('fiscalYear'),
                    r.get('period'),
                    parse_float(r.get('currentRatio')),
                    parse_float(r.get('quickRatio')),
                    parse_float(r.get('cashRatio')),
                    parse_float(r.get('debtToEquityRatio')),
                    parse_float(r.get('debtToAssetsRatio')),
                    parse_float(r.get('debtToCapitalRatio')),
                    parse_float(r.get('interestCoverageRatio')),
                    parse_float(r.get('assetTurnover')),
                    parse_float(r.get('inventoryTurnover')),
                    parse_float(r.get('receivablesTurnover')),
                    parse_float(r.get('payablesTurnover')),
                    parse_float(r.get('grossProfitMargin')),
                    parse_float(r.get('operatingProfitMargin')),
                    parse_float(r.get('ebitdaMargin')),
                    parse_float(r.get('netProfitMargin')),
                    parse_float(r.get('returnOnAssets')),
                    parse_float(r.get('returnOnEquity')),
                    parse_float(r.get('priceToEarningsRatio')),
                    parse_float(r.get('priceToBookRatio')),
                    parse_float(r.get('priceToSalesRatio')),
                    parse_float(r.get('priceToFreeCashFlowRatio')),
                    parse_float(r.get('revenuePerShare')),
                    parse_float(r.get('bookValuePerShare')),
                    parse_float(r.get('daysOfSalesOutstanding')),
                    parse_float(r.get('daysOfInventoryOutstanding')),
                    parse_float(r.get('daysOfPayablesOutstanding')),
                    parse_float(r.get('cashConversionCycle'))
                ))
                count += 1
            except Exception as e:
                print(f"      Error inserting ratio for {r.get('date')}: {e}")
                conn.rollback()
                continue
    
    conn.commit()
    return count


# ============================================================================
# UPDATE EQUITY_METADATA WITH LATEST RATIOS
# ============================================================================

def update_equity_metadata(conn, asset_id: int, ratios: Dict, key_metrics: Dict) -> bool:
    """Update equity_metadata with latest ratios and key metrics."""
    if not ratios and not key_metrics:
        return False
    
    # Get latest data (first item in list)
    r = ratios[0] if ratios else {}
    k = key_metrics[0] if key_metrics else {}
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE equity_metadata SET
                    -- Liquidity Ratios
                    current_ratio = COALESCE(%s, current_ratio),
                    quick_ratio = COALESCE(%s, quick_ratio),
                    cash_ratio = COALESCE(%s, cash_ratio),
                    
                    -- Leverage Ratios
                    debt_to_equity = COALESCE(%s, debt_to_equity),
                    debt_to_assets = COALESCE(%s, debt_to_assets),
                    interest_coverage = COALESCE(%s, interest_coverage),
                    debt_to_capital = COALESCE(%s, debt_to_capital),
                    
                    -- Efficiency Ratios
                    asset_turnover = COALESCE(%s, asset_turnover),
                    inventory_turnover = COALESCE(%s, inventory_turnover),
                    receivables_turnover = COALESCE(%s, receivables_turnover),
                    payables_turnover = COALESCE(%s, payables_turnover),
                    
                    -- Profitability Ratios
                    gross_profit_margin = COALESCE(%s, gross_profit_margin),
                    ebitda_margin = COALESCE(%s, ebitda_margin),
                    net_profit_margin = COALESCE(%s, net_profit_margin),
                    
                    -- Return Metrics
                    roic = COALESCE(%s, roic),
                    roce = COALESCE(%s, roce),
                    
                    -- Valuation Metrics
                    enterprise_value = COALESCE(%s, enterprise_value),
                    price_to_fcf = COALESCE(%s, price_to_fcf),
                    fcf_yield = COALESCE(%s, fcf_yield),
                    earnings_yield = COALESCE(%s, earnings_yield),
                    graham_number = COALESCE(%s, graham_number),
                    
                    -- Working Capital Metrics
                    working_capital = COALESCE(%s, working_capital),
                    invested_capital = COALESCE(%s, invested_capital),
                    tangible_asset_value = COALESCE(%s, tangible_asset_value),
                    cash_conversion_cycle = COALESCE(%s, cash_conversion_cycle),
                    
                    -- Dividend Metrics
                    dividend_payout_ratio = COALESCE(%s, dividend_payout_ratio),
                    dividend_per_share = COALESCE(%s, dividend_per_share),
                    
                    last_updated = NOW()
                WHERE asset_id = %s
            """, (
                # Liquidity
                parse_float(r.get('currentRatio')),
                parse_float(r.get('quickRatio')),
                parse_float(r.get('cashRatio')),
                
                # Leverage
                parse_float(r.get('debtToEquityRatio')),
                parse_float(r.get('debtToAssetsRatio')),
                parse_float(r.get('interestCoverageRatio')),
                parse_float(r.get('debtToCapitalRatio')),
                
                # Efficiency
                parse_float(r.get('assetTurnover')),
                parse_float(r.get('inventoryTurnover')),
                parse_float(r.get('receivablesTurnover')),
                parse_float(r.get('payablesTurnover')),
                
                # Profitability
                parse_float(r.get('grossProfitMargin')),
                parse_float(r.get('ebitdaMargin')),
                parse_float(r.get('netProfitMargin')),
                
                # Returns
                parse_float(k.get('returnOnInvestedCapital')),
                parse_float(k.get('returnOnCapitalEmployed')),
                
                # Valuation
                parse_int(k.get('enterpriseValue')),
                parse_float(r.get('priceToFreeCashFlowRatio')),
                parse_float(k.get('freeCashFlowYield')),
                parse_float(k.get('earningsYield')),
                parse_float(k.get('grahamNumber')),
                
                # Working Capital
                parse_int(k.get('workingCapital')),
                parse_int(k.get('investedCapital')),
                parse_int(k.get('tangibleAssetValue')),
                parse_float(k.get('cashConversionCycle')),
                
                # Dividends
                parse_float(r.get('dividendPayoutRatio')),
                parse_float(r.get('dividendPerShare')),
                
                asset_id
            ))
        conn.commit()
        return True
    except Exception as e:
        print(f"      Error updating equity_metadata: {e}")
        conn.rollback()
        return False


# ============================================================================
# MAIN PROCESSING
# ============================================================================

def process_symbol(conn, asset_id: int, symbol: str, skip_ratios: bool = False, skip_growth: bool = False) -> Dict[str, int]:
    """Process all data for a symbol."""
    results = {'quarterly': 0, 'annual': 0, 'ratios': 0, 'metadata': 0}
    
    # ========== QUARTERLY DATA ==========
    print(f"    Fetching quarterly statements...")
    
    income_q = fetch_fmp_data('income-statement', symbol, 'quarter')
    time.sleep(REQUEST_DELAY)
    
    balance_q = fetch_fmp_data('balance-sheet-statement', symbol, 'quarter')
    time.sleep(REQUEST_DELAY)
    
    cashflow_q = fetch_fmp_data('cash-flow-statement', symbol, 'quarter')
    time.sleep(REQUEST_DELAY)
    
    # Fetch growth data to merge
    growth_q = None
    if not skip_growth:
        growth_q = fetch_fmp_data('financial-growth', symbol, 'quarter')
        time.sleep(REQUEST_DELAY)
    
    if income_q:
        income_by_date = {r['date']: r for r in income_q} if income_q else {}
        balance_by_date = {r['date']: r for r in balance_q} if balance_q else {}
        cashflow_by_date = {r['date']: r for r in cashflow_q} if cashflow_q else {}
        growth_by_date = {r['date']: r for r in growth_q} if growth_q else {}
        
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cashflow_by_date.keys())
        
        quarterly_records = []
        for date in all_dates:
            merged = merge_financial_statements(
                income_by_date.get(date, {}),
                balance_by_date.get(date, {}),
                cashflow_by_date.get(date, {})
            )
            
            # Add growth metrics
            g = growth_by_date.get(date, {})
            if g:
                merged['revenue_growth'] = parse_float(g.get('revenueGrowth'))
                merged['net_income_growth'] = parse_float(g.get('netIncomeGrowth'))
                merged['eps_diluted_growth'] = parse_float(g.get('epsdilutedGrowth'))
                merged['fcf_growth'] = parse_float(g.get('freeCashFlowGrowth'))
                merged['ebitda_growth'] = parse_float(g.get('ebitdaGrowth'))
                merged['three_year_revenue_cagr'] = parse_float(g.get('threeYRevenueGrowthPerShare'))
                merged['five_year_revenue_cagr'] = parse_float(g.get('fiveYRevenueGrowthPerShare'))
                merged['three_year_net_income_cagr'] = parse_float(g.get('threeYNetIncomeGrowthPerShare'))
                merged['five_year_net_income_cagr'] = parse_float(g.get('fiveYNetIncomeGrowthPerShare'))
            
            if merged.get('fiscal_date_ending'):
                quarterly_records.append(merged)
        
        results['quarterly'] = upsert_fundamentals(conn, 'equity_quarterly_fundamentals', asset_id, quarterly_records)
    
    # ========== ANNUAL DATA ==========
    print(f"    Fetching annual statements...")
    
    income_a = fetch_fmp_data('income-statement', symbol, 'annual')
    time.sleep(REQUEST_DELAY)
    
    balance_a = fetch_fmp_data('balance-sheet-statement', symbol, 'annual')
    time.sleep(REQUEST_DELAY)
    
    cashflow_a = fetch_fmp_data('cash-flow-statement', symbol, 'annual')
    time.sleep(REQUEST_DELAY)
    
    growth_a = None
    if not skip_growth:
        growth_a = fetch_fmp_data('financial-growth', symbol, 'annual')
        time.sleep(REQUEST_DELAY)
    
    if income_a:
        income_by_date = {r['date']: r for r in income_a} if income_a else {}
        balance_by_date = {r['date']: r for r in balance_a} if balance_a else {}
        cashflow_by_date = {r['date']: r for r in cashflow_a} if cashflow_a else {}
        growth_by_date = {r['date']: r for r in growth_a} if growth_a else {}
        
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cashflow_by_date.keys())
        
        annual_records = []
        for date in all_dates:
            merged = merge_financial_statements(
                income_by_date.get(date, {}),
                balance_by_date.get(date, {}),
                cashflow_by_date.get(date, {})
            )
            
            g = growth_by_date.get(date, {})
            if g:
                merged['revenue_growth'] = parse_float(g.get('revenueGrowth'))
                merged['net_income_growth'] = parse_float(g.get('netIncomeGrowth'))
                merged['eps_diluted_growth'] = parse_float(g.get('epsdilutedGrowth'))
                merged['fcf_growth'] = parse_float(g.get('freeCashFlowGrowth'))
                merged['ebitda_growth'] = parse_float(g.get('ebitdaGrowth'))
                merged['three_year_revenue_cagr'] = parse_float(g.get('threeYRevenueGrowthPerShare'))
                merged['five_year_revenue_cagr'] = parse_float(g.get('fiveYRevenueGrowthPerShare'))
                merged['three_year_net_income_cagr'] = parse_float(g.get('threeYNetIncomeGrowthPerShare'))
                merged['five_year_net_income_cagr'] = parse_float(g.get('fiveYNetIncomeGrowthPerShare'))
            
            if merged.get('fiscal_date_ending'):
                annual_records.append(merged)
        
        results['annual'] = upsert_fundamentals(conn, 'equity_annual_fundamentals', asset_id, annual_records)
    
    # ========== RATIOS & KEY METRICS ==========
    if not skip_ratios:
        print(f"    Fetching ratios & key metrics...")
        
        ratios_q = fetch_fmp_data('ratios', symbol, 'quarter')
        time.sleep(REQUEST_DELAY)
        
        key_metrics_q = fetch_fmp_data('key-metrics', symbol, 'quarter')
        time.sleep(REQUEST_DELAY)
        
        if ratios_q:
            results['ratios'] = upsert_ratios_quarterly(conn, asset_id, ratios_q)
        
        # Update equity_metadata with latest values
        if ratios_q or key_metrics_q:
            if update_equity_metadata(conn, asset_id, ratios_q, key_metrics_q):
                results['metadata'] = 1
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Comprehensive FMP fundamentals backfill')
    parser.add_argument('--symbols', nargs='+', help='Specific symbols to process')
    parser.add_argument('--limit', type=int, help='Limit number of assets to process')
    parser.add_argument('--all', action='store_true', help='Process all missing assets')
    parser.add_argument('--skip-ratios', action='store_true', help='Skip ratios and key metrics')
    parser.add_argument('--skip-growth', action='store_true', help='Skip growth metrics')
    parser.add_argument('--refresh-view', action='store_true', help='Refresh materialized view after completion')
    args = parser.parse_args()
    
    print(f"{'=' * 70}")
    print(f"FMP Comprehensive Fundamentals Backfill - {datetime.now()}")
    print(f"{'=' * 70}")
    
    conn = get_connection()
    
    # Get assets to process
    if args.symbols:
        assets = get_assets_by_symbols(conn, args.symbols)
        print(f"Processing {len(assets)} specified symbols")
    elif args.all:
        assets = get_assets_missing_fundamentals(conn)
        print(f"Processing ALL {len(assets)} assets missing fundamentals")
    else:
        limit = args.limit or 50
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
    totals = {'quarterly': 0, 'annual': 0, 'ratios': 0, 'metadata': 0}
    
    start_time = time.time()
    
    for i, asset in enumerate(assets):
        asset_id = asset['asset_id']
        symbol = asset['symbol']
        name = asset['name'] or 'Unknown'
        market_cap = asset['market_cap']
        
        if market_cap and market_cap >= 1e9:
            mc_str = f"${market_cap/1e9:.1f}B"
        elif market_cap and market_cap >= 1e6:
            mc_str = f"${market_cap/1e6:.0f}M"
        else:
            mc_str = "N/A"
        
        print(f"\n[{i+1}/{total}] {symbol} ({name[:30]}) - MC: {mc_str}")
        
        try:
            results = process_symbol(
                conn, asset_id, symbol, 
                skip_ratios=args.skip_ratios,
                skip_growth=args.skip_growth
            )
            
            if results['quarterly'] > 0 or results['annual'] > 0:
                print(f"    ✓ Q:{results['quarterly']} A:{results['annual']} R:{results['ratios']} M:{results['metadata']}")
                success_count += 1
                for k in totals:
                    totals[k] += results[k]
            else:
                print(f"    - No data available")
                fail_count += 1
                
        except Exception as e:
            print(f"    ✗ Error: {e}")
            fail_count += 1
        
        # Progress report every 25 assets
        if (i + 1) % 25 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed * 60
            remaining = (total - i - 1) / rate if rate > 0 else 0
            print(f"\n{'=' * 50}")
            print(f"Progress: {i+1}/{total} | Success: {success_count} | Failed: {fail_count}")
            print(f"Rate: {rate:.1f}/min | Elapsed: {elapsed/60:.1f}m | ETA: {remaining:.1f}m")
            print(f"{'=' * 50}")
    
    # Refresh materialized view if requested
    if args.refresh_view:
        print(f"\nRefreshing materialized view...")
        with conn.cursor() as cur:
            cur.execute("REFRESH MATERIALIZED VIEW mv_dashboard_all_assets;")
        conn.commit()
        print("  ✓ Materialized view refreshed")
    
    conn.close()
    
    elapsed = time.time() - start_time
    
    print(f"\n{'=' * 70}")
    print(f"COMPLETE - {datetime.now()}")
    print(f"{'=' * 70}")
    print(f"Total processed: {total}")
    print(f"Success: {success_count} | Failed/No data: {fail_count}")
    print(f"Quarterly records: {totals['quarterly']}")
    print(f"Annual records: {totals['annual']}")
    print(f"Ratio records: {totals['ratios']}")
    print(f"Metadata updates: {totals['metadata']}")
    print(f"Elapsed: {elapsed/60:.1f} minutes | Rate: {total/elapsed*60:.1f}/min")
    
    if not args.refresh_view:
        print(f"\n⚠️  Remember to refresh the materialized view:")
        print(f"    REFRESH MATERIALIZED VIEW mv_dashboard_all_assets;")


if __name__ == "__main__":
    main()

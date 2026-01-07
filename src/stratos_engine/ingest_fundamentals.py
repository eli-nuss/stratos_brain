#!/usr/bin/env python3
"""
Alpha Vantage Equity Fundamentals Data Ingestion Script

This script fetches fundamental data (income statements, balance sheets, cash flows,
and company overview) from Alpha Vantage and populates the Supabase database.

Author: Manus AI
Date: 2026-01-06
"""

import os
import sys
import time
import json
import logging
import requests
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

# Database connection
import psycopg2
from psycopg2.extras import execute_values

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
ALPHA_VANTAGE_API_KEY = os.environ.get('ALPHA_VANTAGE_API_KEY', 'PLZVWIJQFOVHT4WL')
ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query'

# Database configuration
DB_HOST = os.environ.get('DB_HOST', 'db.wfogbaipiqootjrsprde.supabase.co')
DB_PORT = os.environ.get('DB_PORT', '5432')
DB_NAME = os.environ.get('DB_NAME', 'postgres')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'stratosbrainpostgresdbpw')

# Rate limiting: Alpha Vantage free tier allows 25 requests/day, 5 requests/minute
# Premium tier allows more, but we'll be conservative
REQUESTS_PER_MINUTE = 5
REQUEST_DELAY = 60 / REQUESTS_PER_MINUTE  # 12 seconds between requests


@dataclass
class FundamentalsData:
    """Container for all fundamentals data for a single equity."""
    symbol: str
    asset_id: int
    overview: Optional[Dict[str, Any]] = None
    income_statements_annual: Optional[List[Dict[str, Any]]] = None
    income_statements_quarterly: Optional[List[Dict[str, Any]]] = None
    balance_sheets_annual: Optional[List[Dict[str, Any]]] = None
    balance_sheets_quarterly: Optional[List[Dict[str, Any]]] = None
    cash_flows_annual: Optional[List[Dict[str, Any]]] = None
    cash_flows_quarterly: Optional[List[Dict[str, Any]]] = None
    earnings_annual: Optional[List[Dict[str, Any]]] = None
    earnings_quarterly: Optional[List[Dict[str, Any]]] = None


def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def fetch_alpha_vantage(function: str, symbol: str) -> Optional[Dict[str, Any]]:
    """
    Fetch data from Alpha Vantage API.
    
    Args:
        function: The API function to call (e.g., 'OVERVIEW', 'INCOME_STATEMENT')
        symbol: The stock symbol
        
    Returns:
        The JSON response as a dictionary, or None if the request failed
    """
    params = {
        'function': function,
        'symbol': symbol,
        'apikey': ALPHA_VANTAGE_API_KEY
    }
    
    try:
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        # Check for API error messages
        if 'Error Message' in data:
            logger.warning(f"API error for {symbol}/{function}: {data['Error Message']}")
            return None
        if 'Note' in data:
            logger.warning(f"API rate limit note for {symbol}/{function}: {data['Note']}")
            return None
        if 'Information' in data:
            logger.warning(f"API info for {symbol}/{function}: {data['Information']}")
            return None
            
        return data
    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed for {symbol}/{function}: {e}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode failed for {symbol}/{function}: {e}")
        return None


def parse_numeric(value: Any) -> Optional[int]:
    """Parse a numeric value from Alpha Vantage, handling 'None' strings."""
    if value is None or value == 'None' or value == '':
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def parse_decimal(value: Any) -> Optional[float]:
    """Parse a decimal value from Alpha Vantage, handling 'None' strings."""
    if value is None or value == 'None' or value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def fetch_all_fundamentals(symbol: str, asset_id: int) -> FundamentalsData:
    """
    Fetch all fundamental data for a single equity from Alpha Vantage.
    
    Args:
        symbol: The stock symbol
        asset_id: The asset_id from the database
        
    Returns:
        FundamentalsData object containing all fetched data
    """
    data = FundamentalsData(symbol=symbol, asset_id=asset_id)
    
    # Fetch company overview
    logger.info(f"Fetching OVERVIEW for {symbol}")
    data.overview = fetch_alpha_vantage('OVERVIEW', symbol)
    time.sleep(REQUEST_DELAY)
    
    # Fetch income statements
    logger.info(f"Fetching INCOME_STATEMENT for {symbol}")
    income_data = fetch_alpha_vantage('INCOME_STATEMENT', symbol)
    if income_data:
        data.income_statements_annual = income_data.get('annualReports', [])
        data.income_statements_quarterly = income_data.get('quarterlyReports', [])
    time.sleep(REQUEST_DELAY)
    
    # Fetch balance sheets
    logger.info(f"Fetching BALANCE_SHEET for {symbol}")
    balance_data = fetch_alpha_vantage('BALANCE_SHEET', symbol)
    if balance_data:
        data.balance_sheets_annual = balance_data.get('annualReports', [])
        data.balance_sheets_quarterly = balance_data.get('quarterlyReports', [])
    time.sleep(REQUEST_DELAY)
    
    # Fetch cash flows
    logger.info(f"Fetching CASH_FLOW for {symbol}")
    cash_flow_data = fetch_alpha_vantage('CASH_FLOW', symbol)
    if cash_flow_data:
        data.cash_flows_annual = cash_flow_data.get('annualReports', [])
        data.cash_flows_quarterly = cash_flow_data.get('quarterlyReports', [])
    time.sleep(REQUEST_DELAY)
    
    # Fetch earnings
    logger.info(f"Fetching EARNINGS for {symbol}")
    earnings_data = fetch_alpha_vantage('EARNINGS', symbol)
    if earnings_data:
        data.earnings_annual = earnings_data.get('annualEarnings', [])
        data.earnings_quarterly = earnings_data.get('quarterlyEarnings', [])
    time.sleep(REQUEST_DELAY)
    
    return data


def update_equity_metadata(conn, data: FundamentalsData) -> bool:
    """
    Update the equity_metadata table with overview data.
    
    Args:
        conn: Database connection
        data: FundamentalsData object
        
    Returns:
        True if successful, False otherwise
    """
    if not data.overview:
        return False
    
    overview = data.overview
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE equity_metadata SET
                    name = COALESCE(%s, name),
                    description = COALESCE(%s, description),
                    sector = COALESCE(%s, sector),
                    industry = COALESCE(%s, industry),
                    exchange = COALESCE(%s, exchange),
                    currency = COALESCE(%s, currency),
                    country = COALESCE(%s, country),
                    market_cap = COALESCE(%s, market_cap),
                    ebitda = COALESCE(%s, ebitda),
                    pe_ratio = COALESCE(%s, pe_ratio),
                    dividend_yield = COALESCE(%s, dividend_yield),
                    eps = COALESCE(%s, eps),
                    beta = COALESCE(%s, beta),
                    book_value = COALESCE(%s, book_value),
                    week_52_high = COALESCE(%s, week_52_high),
                    week_52_low = COALESCE(%s, week_52_low),
                    shares_outstanding = COALESCE(%s, shares_outstanding),
                    peg_ratio = COALESCE(%s, peg_ratio),
                    forward_pe = COALESCE(%s, forward_pe),
                    trailing_pe = COALESCE(%s, trailing_pe),
                    price_to_sales_ttm = COALESCE(%s, price_to_sales_ttm),
                    price_to_book = COALESCE(%s, price_to_book),
                    ev_to_revenue = COALESCE(%s, ev_to_revenue),
                    ev_to_ebitda = COALESCE(%s, ev_to_ebitda),
                    profit_margin = COALESCE(%s, profit_margin),
                    operating_margin_ttm = COALESCE(%s, operating_margin_ttm),
                    return_on_assets_ttm = COALESCE(%s, return_on_assets_ttm),
                    return_on_equity_ttm = COALESCE(%s, return_on_equity_ttm),
                    revenue_ttm = COALESCE(%s, revenue_ttm),
                    gross_profit_ttm = COALESCE(%s, gross_profit_ttm),
                    diluted_eps_ttm = COALESCE(%s, diluted_eps_ttm),
                    quarterly_earnings_growth_yoy = COALESCE(%s, quarterly_earnings_growth_yoy),
                    quarterly_revenue_growth_yoy = COALESCE(%s, quarterly_revenue_growth_yoy),
                    analyst_target_price = COALESCE(%s, analyst_target_price),
                    fiscal_year_end = COALESCE(%s, fiscal_year_end),
                    last_updated = NOW()
                WHERE asset_id = %s
            """, (
                overview.get('Name'),
                overview.get('Description'),
                overview.get('Sector'),
                overview.get('Industry'),
                overview.get('Exchange'),
                overview.get('Currency'),
                overview.get('Country'),
                parse_numeric(overview.get('MarketCapitalization')),
                parse_numeric(overview.get('EBITDA')),
                parse_decimal(overview.get('PERatio')),
                parse_decimal(overview.get('DividendYield')),
                parse_decimal(overview.get('EPS')),
                parse_decimal(overview.get('Beta')),
                parse_decimal(overview.get('BookValue')),
                parse_decimal(overview.get('52WeekHigh')),
                parse_decimal(overview.get('52WeekLow')),
                parse_numeric(overview.get('SharesOutstanding')),
                parse_decimal(overview.get('PEGRatio')),
                parse_decimal(overview.get('ForwardPE')),
                parse_decimal(overview.get('TrailingPE')),
                parse_decimal(overview.get('PriceToSalesRatioTTM')),
                parse_decimal(overview.get('PriceToBookRatio')),
                parse_decimal(overview.get('EVToRevenue')),
                parse_decimal(overview.get('EVToEBITDA')),
                parse_decimal(overview.get('ProfitMargin')),
                parse_decimal(overview.get('OperatingMarginTTM')),
                parse_decimal(overview.get('ReturnOnAssetsTTM')),
                parse_decimal(overview.get('ReturnOnEquityTTM')),
                parse_numeric(overview.get('RevenueTTM')),
                parse_numeric(overview.get('GrossProfitTTM')),
                parse_decimal(overview.get('DilutedEPSTTM')),
                parse_decimal(overview.get('QuarterlyEarningsGrowthYOY')),
                parse_decimal(overview.get('QuarterlyRevenueGrowthYOY')),
                parse_decimal(overview.get('AnalystTargetPrice')),
                overview.get('FiscalYearEnd'),
                data.asset_id
            ))
        conn.commit()
        logger.info(f"Updated equity_metadata for {data.symbol}")
        return True
    except Exception as e:
        logger.error(f"Failed to update equity_metadata for {data.symbol}: {e}")
        conn.rollback()
        return False


def merge_financial_data(
    income: Optional[Dict[str, Any]],
    balance: Optional[Dict[str, Any]],
    cash_flow: Optional[Dict[str, Any]],
    earnings: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Merge data from income statement, balance sheet, cash flow, and earnings
    into a single record for a given fiscal date.
    """
    merged = {}
    
    if income:
        merged.update({
            'fiscal_date_ending': income.get('fiscalDateEnding'),
            'reported_currency': income.get('reportedCurrency'),
            'total_revenue': parse_numeric(income.get('totalRevenue')),
            'cost_of_revenue': parse_numeric(income.get('costOfRevenue')),
            'gross_profit': parse_numeric(income.get('grossProfit')),
            'operating_expenses': parse_numeric(income.get('operatingExpenses')),
            'operating_income': parse_numeric(income.get('operatingIncome')),
            'research_and_development': parse_numeric(income.get('researchAndDevelopment')),
            'selling_general_administrative': parse_numeric(income.get('sellingGeneralAndAdministrative')),
            'interest_expense': parse_numeric(income.get('interestExpense')),
            'income_before_tax': parse_numeric(income.get('incomeBeforeTax')),
            'income_tax_expense': parse_numeric(income.get('incomeTaxExpense')),
            'net_income': parse_numeric(income.get('netIncome')),
            'ebit': parse_numeric(income.get('ebit')),
            'ebitda': parse_numeric(income.get('ebitda')),
        })
    
    if balance:
        merged.update({
            'fiscal_date_ending': balance.get('fiscalDateEnding'),
            'reported_currency': balance.get('reportedCurrency'),
            'total_assets': parse_numeric(balance.get('totalAssets')),
            'total_current_assets': parse_numeric(balance.get('totalCurrentAssets')),
            'cash_and_equivalents': parse_numeric(balance.get('cashAndCashEquivalentsAtCarryingValue')),
            'total_liabilities': parse_numeric(balance.get('totalLiabilities')),
            'total_current_liabilities': parse_numeric(balance.get('totalCurrentLiabilities')),
            'long_term_debt': parse_numeric(balance.get('longTermDebt')),
            'total_shareholder_equity': parse_numeric(balance.get('totalShareholderEquity')),
            'retained_earnings': parse_numeric(balance.get('retainedEarnings')),
            'common_stock_shares_outstanding': parse_numeric(balance.get('commonStockSharesOutstanding')),
        })
    
    if cash_flow:
        merged.update({
            'fiscal_date_ending': cash_flow.get('fiscalDateEnding'),
            'reported_currency': cash_flow.get('reportedCurrency'),
            'operating_cashflow': parse_numeric(cash_flow.get('operatingCashflow')),
            'capital_expenditures': parse_numeric(cash_flow.get('capitalExpenditures')),
            'investing_cashflow': parse_numeric(cash_flow.get('cashflowFromInvestment')),
            'financing_cashflow': parse_numeric(cash_flow.get('cashflowFromFinancing')),
            'dividend_payout': parse_numeric(cash_flow.get('dividendPayout')),
        })
        # Calculate free cash flow if we have the components
        if merged.get('operating_cashflow') and merged.get('capital_expenditures'):
            merged['free_cash_flow'] = merged['operating_cashflow'] - abs(merged['capital_expenditures'])
    
    if earnings:
        merged.update({
            'eps': parse_decimal(earnings.get('reportedEPS')),
        })
    
    return merged


def upsert_fundamentals(
    conn,
    asset_id: int,
    table_name: str,
    records: List[Dict[str, Any]]
) -> int:
    """
    Upsert fundamentals records into the specified table.
    
    Args:
        conn: Database connection
        asset_id: The asset_id
        table_name: Either 'equity_quarterly_fundamentals' or 'equity_annual_fundamentals'
        records: List of merged financial data records
        
    Returns:
        Number of records upserted
    """
    if not records:
        return 0
    
    columns = [
        'asset_id', 'fiscal_date_ending', 'reported_currency',
        'total_revenue', 'cost_of_revenue', 'gross_profit', 'operating_expenses',
        'operating_income', 'research_and_development', 'selling_general_administrative',
        'interest_expense', 'income_before_tax', 'income_tax_expense', 'net_income',
        'ebit', 'ebitda', 'eps', 'eps_diluted',
        'total_assets', 'total_current_assets', 'cash_and_equivalents',
        'total_liabilities', 'total_current_liabilities', 'long_term_debt',
        'total_shareholder_equity', 'retained_earnings', 'common_stock_shares_outstanding',
        'operating_cashflow', 'capital_expenditures', 'investing_cashflow',
        'financing_cashflow', 'dividend_payout', 'free_cash_flow'
    ]
    
    values = []
    for record in records:
        if not record.get('fiscal_date_ending'):
            continue
        values.append((
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
            record.get('eps'),  # eps_diluted (same as eps for now)
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
        ))
    
    if not values:
        return 0
    
    try:
        with conn.cursor() as cur:
            # Use ON CONFLICT to upsert
            insert_sql = f"""
                INSERT INTO {table_name} ({', '.join(columns)})
                VALUES %s
                ON CONFLICT (asset_id, fiscal_date_ending) DO UPDATE SET
                    reported_currency = EXCLUDED.reported_currency,
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
            """
            execute_values(cur, insert_sql, values)
        conn.commit()
        return len(values)
    except Exception as e:
        logger.error(f"Failed to upsert {table_name}: {e}")
        conn.rollback()
        return 0


def process_fundamentals(conn, data: FundamentalsData) -> Dict[str, int]:
    """
    Process and store all fundamentals data for a single equity.
    
    Args:
        conn: Database connection
        data: FundamentalsData object
        
    Returns:
        Dictionary with counts of records processed
    """
    results = {
        'metadata_updated': 0,
        'quarterly_records': 0,
        'annual_records': 0
    }
    
    # Update equity_metadata
    if update_equity_metadata(conn, data):
        results['metadata_updated'] = 1
    
    # Process quarterly data
    quarterly_records = []
    if data.income_statements_quarterly:
        # Create a lookup by fiscal date
        income_by_date = {r['fiscalDateEnding']: r for r in data.income_statements_quarterly}
        balance_by_date = {r['fiscalDateEnding']: r for r in (data.balance_sheets_quarterly or [])}
        cash_by_date = {r['fiscalDateEnding']: r for r in (data.cash_flows_quarterly or [])}
        earnings_by_date = {r['fiscalDateEnding']: r for r in (data.earnings_quarterly or [])}
        
        # Merge data for each fiscal date
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cash_by_date.keys())
        for fiscal_date in all_dates:
            merged = merge_financial_data(
                income_by_date.get(fiscal_date),
                balance_by_date.get(fiscal_date),
                cash_by_date.get(fiscal_date),
                earnings_by_date.get(fiscal_date)
            )
            if merged.get('fiscal_date_ending'):
                quarterly_records.append(merged)
    
    results['quarterly_records'] = upsert_fundamentals(
        conn, data.asset_id, 'equity_quarterly_fundamentals', quarterly_records
    )
    
    # Process annual data
    annual_records = []
    if data.income_statements_annual:
        income_by_date = {r['fiscalDateEnding']: r for r in data.income_statements_annual}
        balance_by_date = {r['fiscalDateEnding']: r for r in (data.balance_sheets_annual or [])}
        cash_by_date = {r['fiscalDateEnding']: r for r in (data.cash_flows_annual or [])}
        earnings_by_date = {r['fiscalDateEnding']: r for r in (data.earnings_annual or [])}
        
        all_dates = set(income_by_date.keys()) | set(balance_by_date.keys()) | set(cash_by_date.keys())
        for fiscal_date in all_dates:
            merged = merge_financial_data(
                income_by_date.get(fiscal_date),
                balance_by_date.get(fiscal_date),
                cash_by_date.get(fiscal_date),
                earnings_by_date.get(fiscal_date)
            )
            if merged.get('fiscal_date_ending'):
                annual_records.append(merged)
    
    results['annual_records'] = upsert_fundamentals(
        conn, data.asset_id, 'equity_annual_fundamentals', annual_records
    )
    
    return results


def get_equities_to_process(conn, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Get list of equities that need fundamentals data updated.
    
    Args:
        conn: Database connection
        limit: Maximum number of equities to return
        
    Returns:
        List of dictionaries with asset_id and symbol
    """
    with conn.cursor() as cur:
        query = """
            SELECT a.asset_id, a.symbol
            FROM assets a
            JOIN equity_metadata em ON a.asset_id = em.asset_id
            WHERE a.asset_type = 'equity' AND a.is_active = true
            ORDER BY em.market_cap DESC NULLS LAST
        """
        if limit:
            query += f" LIMIT {limit}"
        
        cur.execute(query)
        return [{'asset_id': row[0], 'symbol': row[1]} for row in cur.fetchall()]


def main(symbols: Optional[List[str]] = None, limit: Optional[int] = None):
    """
    Main entry point for the fundamentals ingestion script.
    
    Args:
        symbols: Optional list of specific symbols to process
        limit: Maximum number of equities to process (ignored if symbols provided)
    """
    logger.info("Starting equity fundamentals ingestion")
    
    conn = get_db_connection()
    
    try:
        if symbols:
            # Process specific symbols
            with conn.cursor() as cur:
                placeholders = ','.join(['%s'] * len(symbols))
                cur.execute(f"""
                    SELECT a.asset_id, a.symbol
                    FROM assets a
                    WHERE a.symbol IN ({placeholders}) AND a.asset_type = 'equity'
                """, symbols)
                equities = [{'asset_id': row[0], 'symbol': row[1]} for row in cur.fetchall()]
        else:
            # Get equities by market cap
            equities = get_equities_to_process(conn, limit)
        
        logger.info(f"Processing {len(equities)} equities")
        
        total_results = {
            'processed': 0,
            'metadata_updated': 0,
            'quarterly_records': 0,
            'annual_records': 0,
            'errors': 0
        }
        
        for i, equity in enumerate(equities):
            symbol = equity['symbol']
            asset_id = equity['asset_id']
            
            logger.info(f"[{i+1}/{len(equities)}] Processing {symbol} (asset_id: {asset_id})")
            
            try:
                # Fetch all fundamentals data
                data = fetch_all_fundamentals(symbol, asset_id)
                
                # Process and store the data
                results = process_fundamentals(conn, data)
                
                total_results['processed'] += 1
                total_results['metadata_updated'] += results['metadata_updated']
                total_results['quarterly_records'] += results['quarterly_records']
                total_results['annual_records'] += results['annual_records']
                
                logger.info(
                    f"  Completed {symbol}: metadata={'updated' if results['metadata_updated'] else 'skipped'}, "
                    f"quarterly={results['quarterly_records']}, annual={results['annual_records']}"
                )
                
            except Exception as e:
                logger.error(f"  Error processing {symbol}: {e}")
                total_results['errors'] += 1
        
        logger.info("=" * 60)
        logger.info("Ingestion complete!")
        logger.info(f"  Processed: {total_results['processed']}")
        logger.info(f"  Metadata updated: {total_results['metadata_updated']}")
        logger.info(f"  Quarterly records: {total_results['quarterly_records']}")
        logger.info(f"  Annual records: {total_results['annual_records']}")
        logger.info(f"  Errors: {total_results['errors']}")
        
    finally:
        conn.close()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Ingest equity fundamentals from Alpha Vantage')
    parser.add_argument('--symbols', nargs='+', help='Specific symbols to process')
    parser.add_argument('--limit', type=int, help='Maximum number of equities to process')
    
    args = parser.parse_args()
    
    main(symbols=args.symbols, limit=args.limit)

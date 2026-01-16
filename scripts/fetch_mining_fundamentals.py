#!/usr/bin/env python3
"""
Fetch fundamentals for mining stocks from FMP API and Yahoo Finance.
Updates equity_metadata table with market_cap, pe_ratio, ps_ratio, industry, sector, etc.
"""

import os
import sys
import time
import random
import psycopg2
import requests
import yfinance as yf
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Database connection
DB_URL = "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"

# FMP API Key
FMP_API_KEY = os.environ.get('FMP_API_KEY', 'xgLJ9K1GyYLRNZKqLhCvCcQbYBJkNqw2')

# Rate limiting settings
BASE_DELAY = 0.3
BATCH_SIZE = 20
BATCH_PAUSE = 3

def get_connection():
    return psycopg2.connect(DB_URL)

def safe_numeric(value, max_value=99999999999.99):
    """Convert value to safe numeric, handling infinity, NaN, and very large values."""
    if value is None:
        return None
    import math
    try:
        if isinstance(value, str):
            value = float(value)
        if isinstance(value, (int, float)):
            if math.isinf(value) or math.isnan(value):
                return None
            if abs(value) > max_value:
                return None
        return value
    except (ValueError, TypeError):
        return None

def fetch_fmp_profile(symbol):
    """Fetch company profile from FMP API."""
    try:
        url = f"https://financialmodelingprep.com/api/v3/profile/{symbol}?apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                profile = data[0]
                return {
                    'name': profile.get('companyName'),
                    'sector': profile.get('sector'),
                    'industry': profile.get('industry'),
                    'market_cap': safe_numeric(profile.get('mktCap'), max_value=999999999999999),
                    'description': profile.get('description'),
                    'exchange': profile.get('exchangeShortName'),
                    'currency': profile.get('currency'),
                    'country': profile.get('country'),
                    'beta': safe_numeric(profile.get('beta')),
                    'price': safe_numeric(profile.get('price')),
                }
        return None
    except Exception as e:
        print(f"  FMP profile error for {symbol}: {e}", flush=True)
        return None

def fetch_fmp_ratios(symbol):
    """Fetch financial ratios from FMP API."""
    try:
        url = f"https://financialmodelingprep.com/api/v3/ratios-ttm/{symbol}?apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                ratios = data[0]
                return {
                    'pe_ratio': safe_numeric(ratios.get('peRatioTTM')),
                    'price_to_sales_ttm': safe_numeric(ratios.get('priceToSalesRatioTTM')),
                    'peg_ratio': safe_numeric(ratios.get('pegRatioTTM')),
                    'price_to_book': safe_numeric(ratios.get('priceToBookRatioTTM')),
                    'dividend_yield': safe_numeric(ratios.get('dividendYieldTTM')),
                    'return_on_equity_ttm': safe_numeric(ratios.get('returnOnEquityTTM')),
                    'return_on_assets_ttm': safe_numeric(ratios.get('returnOnAssetsTTM')),
                    'profit_margin': safe_numeric(ratios.get('netProfitMarginTTM')),
                    'operating_margin_ttm': safe_numeric(ratios.get('operatingProfitMarginTTM')),
                }
        return None
    except Exception as e:
        print(f"  FMP ratios error for {symbol}: {e}", flush=True)
        return None

def fetch_fmp_key_metrics(symbol):
    """Fetch key metrics from FMP API."""
    try:
        url = f"https://financialmodelingprep.com/api/v3/key-metrics-ttm/{symbol}?apikey={FMP_API_KEY}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                metrics = data[0]
                return {
                    'eps': safe_numeric(metrics.get('netIncomePerShareTTM')),
                    'book_value': safe_numeric(metrics.get('bookValuePerShareTTM')),
                    'revenue_ttm': safe_numeric(metrics.get('revenuePerShareTTM'), max_value=999999999999999),
                    'ev_to_ebitda': safe_numeric(metrics.get('enterpriseValueOverEBITDATTM')),
                    'ev_to_revenue': safe_numeric(metrics.get('evToSalesTTM')),
                }
        return None
    except Exception as e:
        print(f"  FMP key metrics error for {symbol}: {e}", flush=True)
        return None

def fetch_yahoo_metadata(symbol):
    """Fetch metadata from Yahoo Finance as fallback."""
    try:
        yahoo_symbol = symbol.replace('-P-', '-P')
        ticker = yf.Ticker(yahoo_symbol)
        info = ticker.info
        
        if not info or info.get('regularMarketPrice') is None:
            return None
            
        return {
            'name': info.get('longName') or info.get('shortName'),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
            'description': info.get('longBusinessSummary'),
            'market_cap': safe_numeric(info.get('marketCap'), max_value=999999999999999),
            'pe_ratio': safe_numeric(info.get('trailingPE')),
            'forward_pe': safe_numeric(info.get('forwardPE')),
            'price_to_sales_ttm': safe_numeric(info.get('priceToSalesTrailing12Months')),
            'peg_ratio': safe_numeric(info.get('pegRatio')),
            'price_to_book': safe_numeric(info.get('priceToBook')),
            'dividend_yield': safe_numeric(info.get('dividendYield')),
            'beta': safe_numeric(info.get('beta')),
            'eps': safe_numeric(info.get('trailingEps')),
            'book_value': safe_numeric(info.get('bookValue')),
            'week_52_high': safe_numeric(info.get('fiftyTwoWeekHigh')),
            'week_52_low': safe_numeric(info.get('fiftyTwoWeekLow')),
            'exchange': info.get('exchange'),
            'currency': info.get('currency'),
            'country': info.get('country'),
            'profit_margin': safe_numeric(info.get('profitMargins')),
            'operating_margin_ttm': safe_numeric(info.get('operatingMargins')),
            'return_on_equity_ttm': safe_numeric(info.get('returnOnEquity')),
            'return_on_assets_ttm': safe_numeric(info.get('returnOnAssets')),
        }
    except Exception as e:
        if '429' not in str(e) and '404' not in str(e):
            print(f"  Yahoo error for {symbol}: {e}", flush=True)
        return None

def upsert_metadata(conn, asset_id, symbol, metadata):
    """Insert or update equity_metadata record."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO equity_metadata (
                symbol, asset_id, name, sector, industry, description,
                market_cap, pe_ratio, price_to_sales_ttm, peg_ratio, price_to_book,
                dividend_yield, beta, eps, book_value,
                week_52_high, week_52_low, exchange, currency, country,
                profit_margin, operating_margin_ttm, return_on_equity_ttm, return_on_assets_ttm,
                ev_to_ebitda, ev_to_revenue, forward_pe,
                last_updated
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                NOW()
            )
            ON CONFLICT (symbol) DO UPDATE SET
                asset_id = EXCLUDED.asset_id,
                name = COALESCE(EXCLUDED.name, equity_metadata.name),
                sector = COALESCE(EXCLUDED.sector, equity_metadata.sector),
                industry = COALESCE(EXCLUDED.industry, equity_metadata.industry),
                description = COALESCE(EXCLUDED.description, equity_metadata.description),
                market_cap = COALESCE(EXCLUDED.market_cap, equity_metadata.market_cap),
                pe_ratio = COALESCE(EXCLUDED.pe_ratio, equity_metadata.pe_ratio),
                price_to_sales_ttm = COALESCE(EXCLUDED.price_to_sales_ttm, equity_metadata.price_to_sales_ttm),
                peg_ratio = COALESCE(EXCLUDED.peg_ratio, equity_metadata.peg_ratio),
                price_to_book = COALESCE(EXCLUDED.price_to_book, equity_metadata.price_to_book),
                dividend_yield = COALESCE(EXCLUDED.dividend_yield, equity_metadata.dividend_yield),
                beta = COALESCE(EXCLUDED.beta, equity_metadata.beta),
                eps = COALESCE(EXCLUDED.eps, equity_metadata.eps),
                book_value = COALESCE(EXCLUDED.book_value, equity_metadata.book_value),
                week_52_high = COALESCE(EXCLUDED.week_52_high, equity_metadata.week_52_high),
                week_52_low = COALESCE(EXCLUDED.week_52_low, equity_metadata.week_52_low),
                exchange = COALESCE(EXCLUDED.exchange, equity_metadata.exchange),
                currency = COALESCE(EXCLUDED.currency, equity_metadata.currency),
                country = COALESCE(EXCLUDED.country, equity_metadata.country),
                profit_margin = COALESCE(EXCLUDED.profit_margin, equity_metadata.profit_margin),
                operating_margin_ttm = COALESCE(EXCLUDED.operating_margin_ttm, equity_metadata.operating_margin_ttm),
                return_on_equity_ttm = COALESCE(EXCLUDED.return_on_equity_ttm, equity_metadata.return_on_equity_ttm),
                return_on_assets_ttm = COALESCE(EXCLUDED.return_on_assets_ttm, equity_metadata.return_on_assets_ttm),
                ev_to_ebitda = COALESCE(EXCLUDED.ev_to_ebitda, equity_metadata.ev_to_ebitda),
                ev_to_revenue = COALESCE(EXCLUDED.ev_to_revenue, equity_metadata.ev_to_revenue),
                forward_pe = COALESCE(EXCLUDED.forward_pe, equity_metadata.forward_pe),
                last_updated = NOW()
        """, (
            symbol,
            asset_id,
            metadata.get('name'),
            metadata.get('sector'),
            metadata.get('industry'),
            metadata.get('description'),
            metadata.get('market_cap'),
            metadata.get('pe_ratio'),
            metadata.get('price_to_sales_ttm'),
            metadata.get('peg_ratio'),
            metadata.get('price_to_book'),
            metadata.get('dividend_yield'),
            metadata.get('beta'),
            metadata.get('eps'),
            metadata.get('book_value'),
            metadata.get('week_52_high'),
            metadata.get('week_52_low'),
            metadata.get('exchange'),
            metadata.get('currency'),
            metadata.get('country'),
            metadata.get('profit_margin'),
            metadata.get('operating_margin_ttm'),
            metadata.get('return_on_equity_ttm'),
            metadata.get('return_on_assets_ttm'),
            metadata.get('ev_to_ebitda'),
            metadata.get('ev_to_revenue'),
            metadata.get('forward_pe'),
        ))
    conn.commit()

def get_mining_stocks_needing_data(conn):
    """Get mining stocks from Metals Miners list that need data."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT a.symbol, a.asset_id, a.name, em.pe_ratio, em.price_to_sales_ttm, 
                   em.market_cap, em.industry, em.sector
            FROM stock_list_items sli
            JOIN assets a ON sli.asset_id = a.asset_id
            LEFT JOIN equity_metadata em ON a.asset_id = em.asset_id
            WHERE sli.list_id = (SELECT id FROM stock_lists WHERE name = 'Metals Miners')
            ORDER BY a.symbol
        """)
        return cur.fetchall()

def main():
    print(f"Starting mining fundamentals fetch at {datetime.now()}", flush=True)
    
    conn = get_connection()
    
    # Get all mining stocks
    stocks = get_mining_stocks_needing_data(conn)
    total = len(stocks)
    print(f"Found {total} mining stocks to check", flush=True)
    
    success_count = 0
    fail_count = 0
    skip_count = 0
    
    for i, (symbol, asset_id, name, pe, ps, mcap, industry, sector) in enumerate(stocks):
        # Check if this stock needs data
        needs_data = pe is None or ps is None or mcap is None or industry is None or sector is None
        
        if not needs_data:
            skip_count += 1
            continue
        
        status = f"[{i+1}/{total}] {symbol}"
        print(f"{status} - Fetching...", flush=True)
        
        # Combine data from multiple sources
        combined_data = {}
        
        # Try FMP first (more reliable for fundamentals)
        fmp_profile = fetch_fmp_profile(symbol)
        if fmp_profile:
            combined_data.update({k: v for k, v in fmp_profile.items() if v is not None})
            print(f"  FMP profile: ✓", flush=True)
        
        time.sleep(0.2)
        
        fmp_ratios = fetch_fmp_ratios(symbol)
        if fmp_ratios:
            combined_data.update({k: v for k, v in fmp_ratios.items() if v is not None})
            print(f"  FMP ratios: ✓", flush=True)
        
        time.sleep(0.2)
        
        fmp_metrics = fetch_fmp_key_metrics(symbol)
        if fmp_metrics:
            combined_data.update({k: v for k, v in fmp_metrics.items() if v is not None})
            print(f"  FMP metrics: ✓", flush=True)
        
        # Try Yahoo as fallback for missing data
        if not combined_data.get('market_cap') or not combined_data.get('industry'):
            time.sleep(0.3)
            yahoo_data = fetch_yahoo_metadata(symbol)
            if yahoo_data:
                # Only fill in missing values
                for k, v in yahoo_data.items():
                    if v is not None and combined_data.get(k) is None:
                        combined_data[k] = v
                print(f"  Yahoo fallback: ✓", flush=True)
        
        if combined_data:
            upsert_metadata(conn, asset_id, symbol, combined_data)
            print(f"  Updated: MCap={combined_data.get('market_cap')}, P/E={combined_data.get('pe_ratio')}, P/S={combined_data.get('price_to_sales_ttm')}, Industry={combined_data.get('industry')}", flush=True)
            success_count += 1
        else:
            print(f"  No data found", flush=True)
            fail_count += 1
        
        # Rate limiting
        if (i + 1) % BATCH_SIZE == 0:
            print(f"\n=== Progress: {i+1}/{total} | Updated: {success_count} | Failed: {fail_count} | Skipped: {skip_count} ===", flush=True)
            print(f"=== Batch pause: {BATCH_PAUSE}s ===\n", flush=True)
            time.sleep(BATCH_PAUSE)
        else:
            time.sleep(BASE_DELAY)
    
    conn.close()
    
    print(f"\n=== COMPLETE ===", flush=True)
    print(f"Total processed: {total}", flush=True)
    print(f"Updated: {success_count}", flush=True)
    print(f"Failed: {fail_count}", flush=True)
    print(f"Skipped (already had data): {skip_count}", flush=True)

if __name__ == "__main__":
    main()

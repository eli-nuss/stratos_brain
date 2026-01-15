"""Stage 1 FMP Fetch: Ingest market data from Financial Modeling Prep for global equities."""

import os
import time
import logging
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional
import structlog

from ..db import Database

logger = structlog.get_logger()

# API Configuration
FMP_API_KEY = os.environ.get("FMP_API_KEY", "DlFKwOV9d0ccK6jJy7LBUCwjk50Y0DCe")
FMP_BASE_URL = "https://financialmodelingprep.com/stable"

# Currency pairs we need for conversion
CURRENCY_PAIRS = [
    "JPYUSD",   # Japanese Yen
    "HKDUSD",   # Hong Kong Dollar
    "KRWUSD",   # Korean Won
    "TWDUSD",   # Taiwan Dollar
    "INRUSD",   # Indian Rupee
    "EURUSD",   # Euro
    "GBPUSD",   # British Pound
    "CHFUSD",   # Swiss Franc
    "CNYUSD",   # Chinese Yuan
    "AUDUSD",   # Australian Dollar
    "CADUSD",   # Canadian Dollar
    "SGDUSD",   # Singapore Dollar
]


class FMPDataFetcher:
    """Fetch market data from Financial Modeling Prep API."""
    
    def __init__(self, db: Database):
        self.db = db
        self.api_key = FMP_API_KEY
        self.base_url = FMP_BASE_URL
        self._fx_cache = {}  # Cache for forex rates
    
    def _make_request(self, endpoint: str, params: Dict = None) -> Any:
        """Make a request to the FMP API."""
        url = f"{self.base_url}/{endpoint}"
        if params is None:
            params = {}
        params["apikey"] = self.api_key
        
        try:
            response = requests.get(url, params=params, timeout=30)
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning("fmp_request_failed", 
                             endpoint=endpoint, 
                             status=response.status_code,
                             response=response.text[:200])
                return None
        except Exception as e:
            logger.error("fmp_request_error", endpoint=endpoint, error=str(e))
            return None
    
    def fetch_historical_bars(self, symbol: str, days: int = 365) -> pd.DataFrame:
        """Fetch historical OHLCV data for a symbol."""
        data = self._make_request("historical-price-eod/full", {"symbol": symbol})
        
        if not data:
            return pd.DataFrame()
        
        records = []
        for bar in data[:days]:  # API returns most recent first
            records.append({
                "date": bar.get("date"),
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": bar.get("volume", 0)
            })
        
        if not records:
            return pd.DataFrame()
        
        df = pd.DataFrame(records)
        df['date'] = pd.to_datetime(df['date']).dt.date
        df = df.sort_values('date')
        return df
    
    def fetch_daily_bar(self, symbol: str, as_of_date: str = None) -> Dict:
        """Fetch the latest or specific date bar for a symbol."""
        data = self._make_request("historical-price-eod/full", {"symbol": symbol})
        
        if not data:
            return None
        
        if as_of_date:
            # Find the bar for the specific date
            for bar in data:
                if bar.get("date") == as_of_date:
                    return bar
            return None
        else:
            # Return the most recent bar
            return data[0] if data else None
    
    def fetch_fx_rate(self, from_currency: str, rate_date: str = None) -> float:
        """Fetch forex rate for currency to USD."""
        if from_currency == "USD":
            return 1.0
        
        # Check cache first
        cache_key = f"{from_currency}_{rate_date}"
        if cache_key in self._fx_cache:
            return self._fx_cache[cache_key]
        
        pair = f"{from_currency}USD"
        data = self._make_request("historical-price-eod/full", {"symbol": pair})
        
        if not data:
            logger.warning("fx_rate_not_found", currency=from_currency)
            return None
        
        if rate_date:
            # Find rate for specific date
            for rate in data:
                if rate.get("date") == rate_date:
                    fx_rate = rate.get("close")
                    self._fx_cache[cache_key] = fx_rate
                    return fx_rate
            # If exact date not found, use most recent before that date
            for rate in data:
                if rate.get("date") <= rate_date:
                    fx_rate = rate.get("close")
                    self._fx_cache[cache_key] = fx_rate
                    return fx_rate
        
        # Return most recent rate
        fx_rate = data[0].get("close") if data else None
        self._fx_cache[cache_key] = fx_rate
        return fx_rate
    
    def fetch_and_store_fx_rates(self, currencies: List[str] = None, days: int = 30) -> int:
        """Fetch and store forex rates for multiple currencies."""
        if currencies is None:
            currencies = ["JPY", "HKD", "KRW", "TWD", "INR", "EUR", "GBP", "CHF", "CNY"]
        
        total_stored = 0
        
        for currency in currencies:
            pair = f"{currency}USD"
            data = self._make_request("historical-price-eod/full", {"symbol": pair})
            
            if not data:
                continue
            
            records = []
            for rate in data[:days]:
                records.append({
                    "rate_date": rate.get("date"),
                    "from_currency": currency,
                    "to_currency": "USD",
                    "rate": rate.get("close"),
                    "source": "fmp"
                })
            
            if records:
                # Upsert to database
                for record in records:
                    try:
                        self.db.execute("""
                            INSERT INTO fx_rates (rate_date, from_currency, to_currency, rate, source)
                            VALUES (%s, %s, %s, %s, %s)
                            ON CONFLICT (rate_date, from_currency, to_currency) 
                            DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source
                        """, (record["rate_date"], record["from_currency"], 
                              record["to_currency"], record["rate"], record["source"]))
                        total_stored += 1
                    except Exception as e:
                        logger.error("fx_rate_store_error", error=str(e), record=record)
            
            time.sleep(0.2)  # Rate limiting
        
        logger.info("fx_rates_stored", count=total_stored)
        return total_stored
    
    def get_company_profile(self, symbol: str) -> Dict:
        """Fetch company profile/metadata."""
        data = self._make_request("profile", {"symbol": symbol})
        if data and len(data) > 0:
            return data[0]
        return None


class Stage1FMPFetch:
    """Stage 1 FMP Fetch: Ingest data for global equities."""
    
    def __init__(self, db: Database):
        self.db = db
        self.fmp = FMPDataFetcher(db)
        
        # Get Supabase client for upserts
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
        
        if supabase_url and supabase_key:
            from supabase import create_client
            self.supabase = create_client(supabase_url, supabase_key)
        else:
            self.supabase = None
            logger.warning("supabase_credentials_missing")
    
    def get_global_equity_assets(self, limit: int = 500) -> List[Dict]:
        """Get global equity assets that use FMP as data vendor."""
        query = """
            SELECT asset_id, symbol, name, currency, fmp_symbol, exchange
            FROM assets
            WHERE is_active = true
              AND data_vendor = 'fmp'
            ORDER BY asset_id
            LIMIT %s
        """
        return self.db.fetch_all(query, (limit,))
    
    def get_assets_needing_update(self, as_of_date: str, limit: int = 500) -> List[Dict]:
        """Get FMP assets that need data updates for the given date."""
        query = """
            SELECT a.asset_id, a.symbol, a.name, a.currency, a.fmp_symbol, a.exchange
            FROM assets a
            WHERE a.is_active = true
              AND a.data_vendor = 'fmp'
              AND NOT EXISTS (
                  SELECT 1 FROM daily_bars db 
                  WHERE db.asset_id = a.asset_id AND db.date = %s
              )
            ORDER BY a.asset_id
            LIMIT %s
        """
        return self.db.fetch_all(query, (as_of_date, limit))
    
    def upsert_bars(self, asset_id: int, df: pd.DataFrame, currency: str = "USD") -> int:
        """Upsert bars into daily_bars table with USD conversion."""
        if df.empty or not self.supabase:
            return 0
        
        records = []
        for _, row in df.iterrows():
            date_str = row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date'])
            
            # Get USD conversion
            close_usd = None
            volume_usd = None
            
            if currency == "USD":
                close_usd = float(row['close'])
                volume_usd = float(row['volume']) * float(row['close']) if row['volume'] else None
            else:
                fx_rate = self.fmp.fetch_fx_rate(currency, date_str)
                if fx_rate:
                    close_usd = float(row['close']) * fx_rate
                    volume_usd = float(row['volume']) * close_usd if row['volume'] else None
            
            records.append({
                'asset_id': asset_id,
                'date': date_str,
                'open': float(row['open']) if row['open'] else None,
                'high': float(row['high']) if row['high'] else None,
                'low': float(row['low']) if row['low'] else None,
                'close': float(row['close']),
                'volume': float(row['volume']) if row['volume'] else 0,
                'close_usd': close_usd,
                'volume_usd': volume_usd,
                'source': 'fmp'
            })
        
        # Batch upsert
        batch_size = 500
        total = 0
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            try:
                self.supabase.table("daily_bars").upsert(batch).execute()
                total += len(batch)
            except Exception as e:
                logger.error("bars_upsert_failed", asset_id=asset_id, error=str(e))
        
        return total
    
    def run(self, as_of_date: str = None, limit: int = 500) -> Dict[str, Any]:
        """Run the FMP fetch stage for global equities."""
        if as_of_date is None:
            as_of_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        logger.info("stage1_fmp_started", date=as_of_date)
        
        if not self.supabase:
            return {
                "status": "skipped",
                "reason": "Supabase credentials not configured",
                "assets_processed": 0
            }
        
        # First, update forex rates
        logger.info("updating_fx_rates")
        self.fmp.fetch_and_store_fx_rates(days=7)
        
        # Get assets needing updates
        assets = self.get_assets_needing_update(as_of_date, limit)
        
        if not assets:
            logger.info("stage1_fmp_no_updates_needed", date=as_of_date)
            return {
                "status": "success",
                "message": "All FMP assets already have data for this date",
                "assets_processed": 0
            }
        
        logger.info("stage1_fmp_assets_to_update", count=len(assets))
        
        processed = 0
        bars_written = 0
        errors = 0
        
        for asset in assets:
            asset_id = asset['asset_id']
            symbol = asset.get('fmp_symbol') or asset['symbol']
            currency = asset.get('currency', 'USD')
            
            try:
                # Fetch historical bars
                df = self.fmp.fetch_historical_bars(symbol, days=100)
                
                if not df.empty:
                    written = self.upsert_bars(asset_id, df, currency)
                    bars_written += written
                    processed += 1
                    logger.info("asset_processed", 
                              asset_id=asset_id, 
                              symbol=symbol, 
                              bars=written)
                else:
                    logger.warning("no_data_fetched", asset_id=asset_id, symbol=symbol)
                
                # Rate limiting
                time.sleep(0.3)
                
            except Exception as e:
                logger.error("asset_fetch_error", 
                           asset_id=asset_id, 
                           symbol=symbol, 
                           error=str(e))
                errors += 1
        
        return {
            "status": "success",
            "date": as_of_date,
            "assets_processed": processed,
            "bars_written": bars_written,
            "errors": errors
        }

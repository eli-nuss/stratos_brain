"""Stage 1 Fetch: Ingest market data and calculate features."""

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
from ..utils.feature_calculator import FeatureCalculator
from ..utils.universe import parse_universe

logger = structlog.get_logger()

# API Keys
ALPHAVANTAGE_API_KEY = os.environ.get("ALPHAVANTAGE_API_KEY", "PLZVWIJQFOVHT4WL")
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "CG-k7Vqq9wSF98RuuRZX527bzvv")

class Stage1Fetch:
    """Stage 1 Fetch: Ingest data and calculate features."""
    
    def __init__(self, db: Database):
        self.db = db
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
        
        if supabase_url and supabase_key:
            self.calc = FeatureCalculator(supabase_url, supabase_key)
        else:
            logger.warning("supabase_credentials_missing", 
                         url_set=bool(supabase_url), 
                         key_set=bool(supabase_key))
            self.calc = None
    
    def fetch_alphavantage_bars(self, symbol: str) -> pd.DataFrame:
        """Fetch daily bars from AlphaVantage."""
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY_ADJUSTED",
            "symbol": symbol,
            "outputsize": "compact", # 100 data points is enough for daily update
            "apikey": ALPHAVANTAGE_API_KEY,
            "datatype": "json"
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            if response.status_code != 200:
                logger.warning("av_fetch_failed", symbol=symbol, status=response.status_code)
                return pd.DataFrame()
            
            data = response.json()
            
            # Check for rate limit or error messages
            if "Note" in data or "Information" in data:
                logger.warning("av_rate_limited", symbol=symbol, message=data.get("Note", data.get("Information", ""))[:100])
                return pd.DataFrame()
            
            ts_data = data.get("Time Series (Daily)")
            if not ts_data:
                logger.warning("av_no_data", symbol=symbol, response=str(data)[:100])
                return pd.DataFrame()
            
            records = []
            for date_str, values in ts_data.items():
                records.append({
                    "date": date_str,
                    "open": float(values.get("1. open", 0)),
                    "high": float(values.get("2. high", 0)),
                    "low": float(values.get("3. low", 0)),
                    "close": float(values.get("5. adjusted close", 0)), # Use adjusted close
                    "volume": float(values.get("6. volume", 0))
                })
                
            df = pd.DataFrame(records)
            df['date'] = pd.to_datetime(df['date']).dt.date
            df = df.sort_values('date')
            return df
            
        except Exception as e:
            logger.error("av_fetch_error", symbol=symbol, error=str(e))
            return pd.DataFrame()

    def fetch_coingecko_bars(self, coin_id: str) -> pd.DataFrame:
        """Fetch daily bars from CoinGecko."""
        # Use Pro API if available
        base_url = "https://pro-api.coingecko.com/api/v3" if COINGECKO_API_KEY.startswith("CG-") else "https://api.coingecko.com/api/v3"
        
        ohlc_url = f"{base_url}/coins/{coin_id}/ohlc"
        ohlc_params = {
            "vs_currency": "usd",
            "days": "30",
        }
        
        headers = {}
        if COINGECKO_API_KEY.startswith("CG-"):
            headers["x-cg-pro-api-key"] = COINGECKO_API_KEY
        
        try:
            ohlc_resp = requests.get(ohlc_url, params=ohlc_params, headers=headers, timeout=30)
            
            if ohlc_resp.status_code == 429:
                logger.warning("cg_rate_limited", coin_id=coin_id)
                return pd.DataFrame()
            
            if ohlc_resp.status_code == 200:
                ohlc_data = ohlc_resp.json()
                # [time, open, high, low, close]
                records = []
                for row in ohlc_data:
                    ts = row[0]
                    dt = datetime.fromtimestamp(ts/1000).date()
                    records.append({
                        "date": dt,
                        "open": row[1],
                        "high": row[2],
                        "low": row[3],
                        "close": row[4],
                        "volume": 0 # OHLC endpoint doesn't provide volume
                    })
                
                df = pd.DataFrame(records)
                
                # Fetch volume separately
                vol_url = f"{base_url}/coins/{coin_id}/market_chart"
                vol_params = {"vs_currency": "usd", "days": "30", "interval": "daily"}
                vol_resp = requests.get(vol_url, params=vol_params, headers=headers, timeout=30)
                
                if vol_resp.status_code == 200:
                    vol_data = vol_resp.json()
                    volumes = vol_data.get("total_volumes", [])
                    vol_dict = {}
                    for v in volumes:
                        dt = datetime.fromtimestamp(v[0]/1000).date()
                        vol_dict[dt] = v[1]
                    df['volume'] = df['date'].map(vol_dict).fillna(0)
                
                return df
            else:
                logger.warning("cg_fetch_failed", coin_id=coin_id, status=ohlc_resp.status_code)
                return pd.DataFrame()

        except Exception as e:
            logger.error("cg_fetch_error", coin_id=coin_id, error=str(e))
            return pd.DataFrame()

    def upsert_bars(self, asset_id: int, df: pd.DataFrame) -> int:
        """Upsert bars into daily_bars table."""
        if df.empty or not self.calc:
            return 0
            
        records = []
        for _, row in df.iterrows():
            records.append({
                'asset_id': asset_id,
                'date': row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date']),
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['volume']),
                'source': 'api'
            })
            
        # Batch insert
        batch_size = 1000
        total = 0
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            try:
                self.calc.supabase.table("daily_bars").upsert(batch).execute()
                total += len(batch)
            except Exception as e:
                logger.error("bars_upsert_failed", asset_id=asset_id, error=str(e))
        
        return total

    def get_assets_needing_update(self, as_of_date: str, asset_type: str, limit: int) -> List[Dict]:
        """Get assets that need data updates (missing bars for as_of_date)."""
        query = """
        WITH ranked_assets AS (
            SELECT 
                a.asset_id, 
                a.symbol, 
                a.asset_type, 
                a.alpha_vantage_symbol, 
                a.coingecko_id,
                df.dollar_volume_sma_20
            FROM assets a
            LEFT JOIN daily_features df ON a.asset_id = df.asset_id 
                AND df.date = (SELECT MAX(date) FROM daily_features WHERE asset_id = a.asset_id)
            WHERE a.is_active = true 
              AND a.asset_type = %s
            ORDER BY COALESCE(df.dollar_volume_sma_20, 0) DESC
            LIMIT %s
        )
        SELECT ra.*
        FROM ranked_assets ra
        WHERE NOT EXISTS (
            SELECT 1 FROM daily_bars db 
            WHERE db.asset_id = ra.asset_id AND db.date = %s
        )
        LIMIT 500
        """
        return self.db.fetch_all(query, (asset_type, limit, as_of_date))

    def run(self, as_of_date: str, universe_id: str = "equities_all", config_id: Optional[str] = None) -> Dict[str, Any]:
        """Run the fetch and calculate stage."""
        logger.info("stage1_fetch_started", date=as_of_date, universe=universe_id)
        
        if not self.calc:
            logger.error("stage1_fetch_skipped", reason="supabase_credentials_missing")
            return {
                "status": "skipped",
                "reason": "Supabase credentials not configured",
                "assets_processed": 0,
                "features_written": 0
            }
        
        u_params = parse_universe(universe_id)
        asset_type = u_params["asset_type"]
        limit = u_params["limit"]
        
        # Get assets that need updates (missing bars for as_of_date)
        assets = self.get_assets_needing_update(as_of_date, asset_type, limit)
        
        if not assets:
            logger.info("stage1_fetch_no_updates_needed", date=as_of_date, universe=universe_id)
            return {
                "status": "success",
                "message": "All assets already have data for this date",
                "assets_processed": 0,
                "features_written": 0
            }
        
        logger.info("stage1_fetch_assets_to_update", count=len(assets))
        
        processed_count = 0
        features_written = 0
        bars_written = 0
        rate_limited = 0
        
        # Limit batch size to avoid excessive API calls
        max_batch = 100 if asset_type == 'equity' else 200
        assets = assets[:max_batch]
        
        for asset in assets:
            asset_id = asset['asset_id']
            symbol = asset['symbol']
            
            # Fetch data based on type
            new_bars = pd.DataFrame()
            
            if asset_type == 'crypto':
                cg_id = asset.get('coingecko_id')
                if cg_id:
                    new_bars = self.fetch_coingecko_bars(cg_id)
                    if new_bars.empty:
                        rate_limited += 1
                    # Rate limit for CoinGecko Pro
                    time.sleep(0.15) 
            else:
                av_symbol = asset.get('alpha_vantage_symbol') or symbol
                new_bars = self.fetch_alphavantage_bars(av_symbol)
                if new_bars.empty:
                    rate_limited += 1
                # Rate limit for AlphaVantage (5 calls/min free tier)
                time.sleep(12.5) # 5 calls per minute = 12 seconds between calls
            
            if not new_bars.empty:
                written = self.upsert_bars(asset_id, new_bars)
                bars_written += written
            
            # Calculate features for this asset
            try:
                bars = self.calc.get_bars(
                    asset_id, 
                    date.fromisoformat(as_of_date), 
                    date.fromisoformat(as_of_date), 
                    asset_type=asset_type
                )
                
                if bars.empty:
                    processed_count += 1
                    continue
                    
                features_df = self.calc.compute_features(bars, asset_type=asset_type)
                
                if features_df.empty:
                    processed_count += 1
                    continue
                    
                target_features = features_df[features_df.index == date.fromisoformat(as_of_date)]
                
                if not target_features.empty:
                    row = target_features.iloc[0]
                    record = row.to_dict()
                    
                    clean_record = {}
                    for k, v in record.items():
                        if pd.isna(v) or v is None:
                            continue
                        if isinstance(v, (np.int64, np.int32)):
                            clean_record[k] = int(v)
                        elif isinstance(v, (np.float64, np.float32)):
                            clean_record[k] = float(v)
                        elif isinstance(v, (bool, np.bool_)):
                            clean_record[k] = bool(v)
                        else:
                            clean_record[k] = v
                    
                    clean_record['asset_id'] = asset_id
                    clean_record['date'] = as_of_date
                    clean_record['created_at'] = datetime.utcnow().isoformat()
                    clean_record['updated_at'] = datetime.utcnow().isoformat()
                    
                    try:
                        self.calc.supabase.table("daily_features").upsert(clean_record).execute()
                        features_written += 1
                    except Exception as e:
                        logger.error("feature_write_failed", asset_id=asset_id, error=str(e))
            except Exception as e:
                logger.error("feature_calc_failed", asset_id=asset_id, error=str(e))
            
            processed_count += 1
            
            # Log progress every 50 assets
            if processed_count % 50 == 0:
                logger.info("stage1_fetch_progress", 
                          processed=processed_count, 
                          total=len(assets),
                          bars=bars_written,
                          features=features_written)
            
        logger.info("stage1_fetch_complete", 
                   processed=processed_count, 
                   bars_written=bars_written,
                   features_written=features_written,
                   rate_limited=rate_limited)
        
        return {
            "status": "success",
            "assets_processed": processed_count,
            "bars_written": bars_written,
            "features_written": features_written,
            "rate_limited": rate_limited
        }

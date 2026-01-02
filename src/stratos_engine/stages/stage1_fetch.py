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
        self.calc = FeatureCalculator(
            os.environ.get("SUPABASE_URL"),
            os.environ.get("SUPABASE_SERVICE_KEY")
        )
    
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
        url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
        params = {
            "vs_currency": "usd",
            "days": "30", # Fetch last 30 days
            "interval": "daily",
            "x_cg_pro_api_key": COINGECKO_API_KEY
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            if response.status_code != 200:
                logger.warning("cg_fetch_failed", coin_id=coin_id, status=response.status_code)
                return pd.DataFrame()
            
            data = response.json()
            prices = data.get("prices", [])
            volumes = data.get("total_volumes", [])
            
            if not prices:
                return pd.DataFrame()
            
            # CoinGecko returns [timestamp, value]
            # We need OHLC, but CG only gives Price/Volume history in this endpoint.
            # For OHLC, we need /coins/{id}/ohlc endpoint
            
            ohlc_url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/ohlc"
            ohlc_params = {
                "vs_currency": "usd",
                "days": "30",
                "x_cg_pro_api_key": COINGECKO_API_KEY
            }
            ohlc_resp = requests.get(ohlc_url, params=ohlc_params, timeout=30)
            
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
                        "volume": 0 # Volume is separate
                    })
                
                df = pd.DataFrame(records)
                
                # Merge volume if possible, but OHLC endpoint doesn't give volume.
                # We can approximate or fetch volume separately and merge by date.
                # For now, let's use 0 volume or try to merge.
                
                # Create volume dict
                vol_dict = {}
                for v in volumes:
                    dt = datetime.fromtimestamp(v[0]/1000).date()
                    vol_dict[dt] = v[1]
                
                df['volume'] = df['date'].map(vol_dict).fillna(0)
                
                return df
            else:
                # Fallback to price history (close only)
                records = []
                for i, p in enumerate(prices):
                    dt = datetime.fromtimestamp(p[0]/1000).date()
                    val = p[1]
                    vol = volumes[i][1] if i < len(volumes) else 0
                    records.append({
                        "date": dt,
                        "open": val,
                        "high": val,
                        "low": val,
                        "close": val,
                        "volume": vol
                    })
                return pd.DataFrame(records)

        except Exception as e:
            logger.error("cg_fetch_error", coin_id=coin_id, error=str(e))
            return pd.DataFrame()

    def upsert_bars(self, asset_id: int, df: pd.DataFrame) -> int:
        """Upsert bars into daily_bars table."""
        if df.empty:
            return 0
            
        records = []
        for _, row in df.iterrows():
            records.append({
                'asset_id': asset_id,
                'date': row['date'].isoformat(),
                'open': row['open'],
                'high': row['high'],
                'low': row['low'],
                'close': row['close'],
                'volume': row['volume']
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

    def run(self, as_of_date: str, universe_id: str = "equities_all", config_id: Optional[str] = None) -> Dict[str, Any]:
        """Run the fetch and calculate stage."""
        logger.info("stage1_fetch_started", date=as_of_date, universe=universe_id)
        
        u_params = parse_universe(universe_id)
        asset_type = u_params["asset_type"]
        limit = u_params["limit"]
        
        # Fetch active assets with vendor IDs
        query = """
        SELECT asset_id, symbol, asset_type, alpha_vantage_symbol, coingecko_id
        FROM assets 
        WHERE is_active = true AND asset_type = %s
        ORDER BY asset_id
        LIMIT %s
        """
        assets = self.db.fetch_all(query, (asset_type, limit))
        
        processed_count = 0
        features_written = 0
        
        for asset in assets:
            asset_id = asset['asset_id']
            symbol = asset['symbol']
            
            # Fetch data based on type
            new_bars = pd.DataFrame()
            
            if asset_type == 'crypto':
                cg_id = asset.get('coingecko_id')
                if cg_id:
                    new_bars = self.fetch_coingecko_bars(cg_id)
                    # Rate limit for CoinGecko (Pro is higher, but safe side)
                    time.sleep(0.2) 
            else:
                av_symbol = asset.get('alpha_vantage_symbol') or symbol
                new_bars = self.fetch_alphavantage_bars(av_symbol)
                # Rate limit for AlphaVantage (5 calls/min free, but we have key)
                # Assuming key allows higher rate, but let's be safe
                time.sleep(0.5)
            
            if not new_bars.empty:
                self.upsert_bars(asset_id, new_bars)
            
            # Load history and calculate
            bars = self.calc.get_bars(
                asset_id, 
                date.fromisoformat(as_of_date), 
                date.fromisoformat(as_of_date), 
                asset_type=asset_type
            )
            
            if bars.empty:
                continue
                
            features_df = self.calc.compute_features(bars, asset_type=asset_type)
            
            if features_df.empty:
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
            
            processed_count += 1
            
        logger.info("stage1_fetch_complete", processed=processed_count, written=features_written)
        return {
            "status": "success",
            "assets_processed": processed_count,
            "features_written": features_written
        }

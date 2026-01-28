#!/usr/bin/env python3
"""
ETF Daily Features Calculation Job
==================================
Calculates technical features for all ETF assets for a given date.
Designed to run after ETF OHLCV data is available.

Usage:
    python jobs/etf_daily_features.py --date 2026-01-27
    python jobs/etf_daily_features.py  # defaults to today

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
"""

import os
import sys
import argparse
import logging
import time
from datetime import datetime, timedelta, date
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constants
FEATURE_VERSION = "2.0"
MAX_LOOKBACK = 300
ASSET_TYPE = 'etf'
ANN_FACTOR = 252

# Thread-local storage for connections
thread_local = threading.local()


def get_connection():
    """Get thread-local database connection."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    if not hasattr(thread_local, 'conn') or thread_local.conn.closed:
        thread_local.conn = psycopg2.connect(database_url)
        thread_local.conn.autocommit = True
    return thread_local.conn


def get_stale_etfs(target_date: str) -> list:
    """Get ETF assets that need feature calculation for target_date."""
    conn = get_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT a.asset_id, a.symbol, a.asset_type
            FROM assets a
            WHERE a.asset_type = %s
              AND a.is_active = true
              AND NOT EXISTS (
                  SELECT 1 FROM daily_features df 
                  WHERE df.asset_id = a.asset_id AND df.date = %s
              )
              AND EXISTS (
                  SELECT 1 FROM daily_bars db 
                  WHERE db.asset_id = a.asset_id AND db.date = %s
              )
            ORDER BY a.asset_id
        """, (ASSET_TYPE, target_date, target_date))
        return cur.fetchall()


def get_bars_for_etf(etf_id: int, end_date: str, lookback_days: int = 600) -> pd.DataFrame:
    """Fetch daily bars for an ETF directly from PostgreSQL."""
    conn = get_connection()
    start_date = (datetime.strptime(end_date, '%Y-%m-%d') - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT date, open, high, low, close, volume
            FROM daily_bars
            WHERE asset_id = %s AND date >= %s AND date <= %s
            ORDER BY date ASC
        """, (etf_id, start_date, end_date))
        rows = cur.fetchall()
    
    if not rows:
        return pd.DataFrame()
    
    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df


def calculate_returns(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate various return metrics."""
    df = df.copy()
    df['return_1d'] = df['close'].pct_change()
    df['return_5d'] = df['close'].pct_change(5)
    df['return_21d'] = df['close'].pct_change(21)
    df['return_63d'] = df['close'].pct_change(63)
    df['return_252d'] = df['close'].pct_change(252)
    return df


def calculate_moving_averages(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate moving averages and distances."""
    df = df.copy()
    
    # Simple moving averages
    df['sma_20'] = df['close'].rolling(window=20).mean()
    df['sma_50'] = df['close'].rolling(window=50).mean()
    df['sma_200'] = df['close'].rolling(window=200).mean()
    
    # Distance from MAs
    df['ma_dist_20'] = (df['close'] - df['sma_20']) / df['sma_20']
    df['ma_dist_50'] = (df['close'] - df['sma_50']) / df['sma_50']
    df['ma_dist_200'] = (df['close'] - df['sma_200']) / df['sma_200']
    
    # MA slopes (20-day rate of change)
    df['ma_slope_20'] = df['sma_20'].pct_change(20)
    df['ma_slope_50'] = df['sma_50'].pct_change(50)
    df['ma_slope_200'] = df['sma_200'].pct_change(200)
    
    return df


def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Calculate RSI."""
    df = df.copy()
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    df['rsi_14'] = 100 - (100 / (1 + rs))
    return df


def calculate_macd(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate MACD."""
    df = df.copy()
    exp1 = df['close'].ewm(span=12, adjust=False).mean()
    exp2 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd_line'] = exp1 - exp2
    df['macd_signal'] = df['macd_line'].ewm(span=9, adjust=False).mean()
    df['macd_histogram'] = df['macd_line'] - df['macd_signal']
    return df


def calculate_bollinger_bands(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate Bollinger Bands."""
    df = df.copy()
    df['bb_middle'] = df['close'].rolling(window=20).mean()
    bb_std = df['close'].rolling(window=20).std()
    df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
    df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
    df['bb_pct'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
    return df


def calculate_atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Calculate Average True Range."""
    df = df.copy()
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    df['atr_14'] = true_range.rolling(period).mean()
    df['atr_pct'] = df['atr_14'] / df['close']
    return df


def calculate_volume_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate volume-based metrics."""
    df = df.copy()
    df['volume_sma_20'] = df['volume'].rolling(window=20).mean()
    df['dollar_volume'] = df['close'] * df['volume']
    df['dollar_volume_sma_20'] = df['dollar_volume'].rolling(window=20).mean()
    df['rvol_20'] = df['volume'] / df['volume_sma_20']
    return df


def calculate_trend_regime(df: pd.DataFrame) -> pd.DataFrame:
    """Determine trend regime based on MA alignment."""
    df = df.copy()
    
    conditions = [
        (df['close'] > df['sma_50']) & (df['sma_50'] > df['sma_200']),  # Bullish
        (df['close'] < df['sma_50']) & (df['sma_50'] < df['sma_200']),  # Bearish
    ]
    choices = ['bullish', 'bearish']
    df['trend_regime'] = np.select(conditions, choices, default='sideways')
    
    df['above_ma200'] = df['close'] > df['sma_200']
    df['ma50_above_ma200'] = df['sma_50'] > df['sma_200']
    
    return df


def calculate_all_features(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate all technical features."""
    if len(df) < 200:
        return pd.DataFrame()  # Not enough data
    
    df = calculate_returns(df)
    df = calculate_moving_averages(df)
    df = calculate_rsi(df)
    df = calculate_macd(df)
    df = calculate_bollinger_bands(df)
    df = calculate_atr(df)
    df = calculate_volume_metrics(df)
    df = calculate_trend_regime(df)
    
    return df


def get_feature_record(row: pd.Series, asset_id: int, feature_version: str) -> tuple:
    """Convert a dataframe row to a database record tuple."""
    def safe_float(val):
        if pd.isna(val) or val is None:
            return None
        try:
            return float(val)
        except:
            return None
    
    return (
        asset_id,
        row['date'].strftime('%Y-%m-%d'),
        feature_version,
        'etf_features_v1',
        None,  # asof_timestamp
        safe_float(row.get('close')),
        safe_float(row.get('return_1d')),
        safe_float(row.get('return_5d')),
        safe_float(row.get('return_21d')),
        safe_float(row.get('return_63d')),
        safe_float(row.get('return_252d')),
        safe_float(row.get('ma_dist_20')),
        safe_float(row.get('ma_dist_50')),
        safe_float(row.get('ma_dist_200')),
        safe_float(row.get('ma_slope_20')),
        safe_float(row.get('ma_slope_50')),
        safe_float(row.get('ma_slope_200')),
        row.get('trend_regime', 'unknown'),
        None, None, None, None,  # roc columns
        safe_float(row.get('rsi_14')),
        safe_float(row.get('macd_histogram')),
        safe_float(row.get('atr_pct')),
        None,  # realized_vol
        safe_float(row.get('bb_width')),
        safe_float(row.get('bb_pct')),
        safe_float(row.get('dollar_volume_sma_20')),
        safe_float(row.get('rvol_20')),
        safe_float(row.get('sma_20')),
        safe_float(row.get('sma_50')),
        safe_float(row.get('sma_200')),
        bool(row.get('above_ma200', False)),
        bool(row.get('ma50_above_ma200', False))
    )


def process_etf(etf: dict, target_date: str, feature_version: str) -> tuple:
    """Process a single ETF and return (asset_id, success, record_count)."""
    try:
        df = get_bars_for_etf(etf['asset_id'], target_date)
        if len(df) < 200:
            return (etf['asset_id'], False, 0)
        
        df = calculate_all_features(df)
        if df.empty:
            return (etf['asset_id'], False, 0)
        
        # Get the target date row
        target_row = df[df['date'] == target_date]
        if target_row.empty:
            return (etf['asset_id'], False, 0)
        
        record = get_feature_record(target_row.iloc[0], etf['asset_id'], feature_version)
        
        # Insert into database
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO daily_features (
                    asset_id, date, feature_version, calc_version, asof_timestamp,
                    close, return_1d, return_5d, return_21d, return_63d, return_252d,
                    ma_dist_20, ma_dist_50, ma_dist_200, ma_slope_20, ma_slope_50, ma_slope_200,
                    trend_regime, roc_5, roc_10, roc_20, roc_63, rsi_14, macd_histogram,
                    atr_pct, realized_vol_20, bb_width, bb_pct, dollar_volume_sma_20, rvol_20,
                    sma_20, sma_50, sma_200, above_ma200, ma50_above_ma200
                ) VALUES %s
                ON CONFLICT (asset_id, date) DO UPDATE SET
                    feature_version = EXCLUDED.feature_version,
                    calc_version = EXCLUDED.calc_version,
                    close = EXCLUDED.close,
                    return_1d = EXCLUDED.return_1d,
                    rsi_14 = EXCLUDED.rsi_14,
                    ma_dist_50 = EXCLUDED.ma_dist_50,
                    trend_regime = EXCLUDED.trend_regime
            """, (record,))
        
        return (etf['asset_id'], True, 1)
        
    except Exception as e:
        logger.error(f"Error processing ETF {etf['asset_id']}: {e}")
        return (etf['asset_id'], False, 0)


def main():
    parser = argparse.ArgumentParser(description='Calculate daily features for ETFs')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD), default: today')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--limit', type=int, help='Limit number of ETFs (for testing)')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = datetime.utcnow().strftime('%Y-%m-%d')
    
    logger.info(f"Starting ETF feature calculation for {target_date}")
    
    # Get ETFs needing calculation
    etfs = get_stale_etfs(target_date)
    if args.limit:
        etfs = etfs[:args.limit]
    
    logger.info(f"Found {len(etfs)} ETFs to process")
    
    if not etfs:
        logger.info("No ETFs to process. Exiting.")
        return
    
    # Process ETFs in parallel
    success_count = 0
    fail_count = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_etf, etf, target_date, FEATURE_VERSION): etf 
            for etf in etfs
        }
        
        for future in as_completed(futures):
            etf = futures[future]
            try:
                asset_id, success, count = future.result()
                if success:
                    success_count += 1
                    logger.info(f"✓ ETF {asset_id}: {count} records")
                else:
                    fail_count += 1
                    logger.warning(f"✗ ETF {asset_id}: failed")
            except Exception as e:
                fail_count += 1
                logger.error(f"✗ ETF {etf['asset_id']}: {e}")
    
    logger.info(f"Complete: {success_count} succeeded, {fail_count} failed")


if __name__ == '__main__':
    main()

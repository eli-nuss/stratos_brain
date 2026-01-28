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
    datefmt='%Y-%m-%d %H:%M:%S'
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
    
    # MA slopes
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
    
    # Initialize with default values
    df['trend_regime'] = 'sideways'
    df['above_ma200'] = False
    df['ma50_above_ma200'] = False
    
    # Only calculate if we have valid SMA data
    valid_sma = df['sma_50'].notna() & df['sma_200'].notna()
    
    if valid_sma.any():
        # Bullish: price > 50MA > 200MA
        bullish = (df['close'] > df['sma_50']) & (df['sma_50'] > df['sma_200'])
        df.loc[bullish & valid_sma, 'trend_regime'] = 'bullish'
        
        # Bearish: price < 50MA < 200MA
        bearish = (df['close'] < df['sma_50']) & (df['sma_50'] < df['sma_200'])
        df.loc[bearish & valid_sma, 'trend_regime'] = 'bearish'
        
        # Boolean flags
        df.loc[valid_sma, 'above_ma200'] = df.loc[valid_sma, 'close'] > df.loc[valid_sma, 'sma_200']
        df.loc[valid_sma, 'ma50_above_ma200'] = df.loc[valid_sma, 'sma_50'] > df.loc[valid_sma, 'sma_200']
    
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


def build_record(row: pd.Series, asset_id: int, target_date: str) -> tuple:
    """Convert a dataframe row to a database record tuple."""
    def safe_float(val):
        if pd.isna(val) or val is None:
            return None
        try:
            return float(val)
        except:
            return None
    
    def safe_bool(val):
        if pd.isna(val) or val is None:
            return False
        return bool(val)
    
    # Get trend_regime with proper default
    trend_regime = row.get('trend_regime')
    if pd.isna(trend_regime) or trend_regime is None:
        trend_regime = 'sideways'
    
    return (
        asset_id,
        target_date,
        FEATURE_VERSION,
        'etf_features_v1',
        datetime.now().isoformat(),  # asof_timestamp
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
        trend_regime,
        safe_float(row.get('return_5d')),  # roc_5
        None,  # roc_10
        None,  # roc_20
        None,  # roc_63
        safe_float(row.get('rsi_14')),
        safe_float(row.get('macd_histogram')),
        safe_float(row.get('atr_pct')),
        None,  # realized_vol_20
        safe_float(row.get('bb_width')),
        None,  # bb_width_pctile
        safe_float(row.get('dollar_volume_sma_20')),
        safe_float(row.get('rvol_20')),
        safe_float(row.get('sma_20')),
        safe_float(row.get('sma_50')),
        safe_float(row.get('sma_200')),
        safe_bool(row.get('above_ma200')),
        safe_bool(row.get('ma50_above_ma200'))
    )


def write_features_batch(records: list) -> int:
    """Write a batch of feature records to the database."""
    if not records:
        return 0
    
    conn = get_connection()
    query = """
        INSERT INTO daily_features (
            asset_id, date, feature_version, calc_version, asof_timestamp,
            close, return_1d, return_5d, return_21d, return_63d, return_252d,
            ma_dist_20, ma_dist_50, ma_dist_200, ma_slope_20, ma_slope_50, ma_slope_200,
            trend_regime, roc_5, roc_10, roc_20, roc_63, rsi_14, macd_histogram,
            atr_pct, realized_vol_20, bb_width, bb_width_pctile, dollar_volume_sma_20, rvol_20,
            sma_20, sma_50, sma_200, above_ma200, ma50_above_ma200
        ) VALUES %s
        ON CONFLICT (asset_id, date) DO UPDATE SET
            feature_version = EXCLUDED.feature_version,
            calc_version = EXCLUDED.calc_version,
            asof_timestamp = EXCLUDED.asof_timestamp,
            close = EXCLUDED.close,
            return_1d = EXCLUDED.return_1d,
            rsi_14 = EXCLUDED.rsi_14,
            macd_histogram = EXCLUDED.macd_histogram,
            atr_pct = EXCLUDED.atr_pct,
            bb_width = EXCLUDED.bb_width,
            dollar_volume_sma_20 = EXCLUDED.dollar_volume_sma_20,
            rvol_20 = EXCLUDED.rvol_20,
            ma_dist_50 = EXCLUDED.ma_dist_50,
            trend_regime = EXCLUDED.trend_regime,
            sma_20 = EXCLUDED.sma_20,
            sma_50 = EXCLUDED.sma_50,
            sma_200 = EXCLUDED.sma_200,
            above_ma200 = EXCLUDED.above_ma200,
            ma50_above_ma200 = EXCLUDED.ma50_above_ma200
    """
    
    with conn.cursor() as cur:
        execute_values(cur, query, records)
    
    return len(records)


def update_latest_date(target_date: str):
    """Update the latest_dates table for dashboard display."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO latest_dates (asset_type, latest_date, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (asset_type) 
                DO UPDATE SET latest_date = EXCLUDED.latest_date, updated_at = NOW()
                WHERE latest_dates.latest_date < EXCLUDED.latest_date
            """, ('etf', target_date))
            logger.info(f"Updated latest_dates for etf to {target_date}")
    except Exception as e:
        logger.warning(f"Failed to update latest_dates: {e}")


def process_etf(etf: dict, target_date: str) -> dict:
    """Process a single ETF and return result dict."""
    try:
        df = get_bars_for_etf(etf['asset_id'], target_date)
        if len(df) < 200:
            return {'status': 'skipped', 'reason': 'insufficient_data', 'asset_id': etf['asset_id']}
        
        df = calculate_all_features(df)
        if df.empty:
            return {'status': 'error', 'error': 'feature_calculation_failed', 'asset_id': etf['asset_id']}
        
        # Get the target date row
        target_row = df[df['date'] == pd.to_datetime(target_date)]
        if target_row.empty:
            return {'status': 'skipped', 'reason': 'no_data_for_target_date', 'asset_id': etf['asset_id']}
        
        record = build_record(target_row.iloc[0], etf['asset_id'], target_date)
        
        return {'status': 'success', 'record': record, 'asset_id': etf['asset_id'], 'symbol': etf['symbol']}
        
    except Exception as e:
        return {'status': 'error', 'error': str(e), 'asset_id': etf['asset_id']}


def main():
    parser = argparse.ArgumentParser(description='ETF Daily Features Calculation')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD). Defaults to today.')
    parser.add_argument('--workers', type=int, default=8, help='Number of parallel workers')
    parser.add_argument('--batch-size', type=int, default=50, help='Batch size for DB writes')
    parser.add_argument('--limit', type=int, help='Limit number of ETFs (for testing)')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = date.today().isoformat()
    
    logger.info("=" * 60)
    logger.info("ETF DAILY FEATURES CALCULATION")
    logger.info(f"Target Date: {target_date}")
    logger.info(f"Workers: {args.workers}")
    logger.info("=" * 60)
    
    # Get stale ETFs
    logger.info("Fetching ETF assets needing features...")
    etfs = get_stale_etfs(target_date)
    
    if args.limit:
        etfs = etfs[:args.limit]
    
    total = len(etfs)
    logger.info(f"Found {total} ETFs needing features for {target_date}")
    
    if total == 0:
        logger.info("No ETFs to process - all features up to date!")
        update_latest_date(target_date)
        return
    
    # Process in parallel
    start_time = time.time()
    processed = 0
    success = 0
    skipped = 0
    errors = 0
    batch = []
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_etf, etf, target_date): etf 
                   for etf in etfs}
        
        for future in as_completed(futures):
            result = future.result()
            processed += 1
            
            if result['status'] == 'success':
                success += 1
                batch.append(result['record'])
                
                # Write batch when full
                if len(batch) >= args.batch_size:
                    written = write_features_batch(batch)
                    elapsed = time.time() - start_time
                    rate = processed / elapsed if elapsed > 0 else 0
                    logger.info(f"Progress: {processed}/{total} ({100*processed/total:.1f}%) | "
                              f"Success: {success} | Skipped: {skipped} | Errors: {errors} | "
                              f"Rate: {rate:.1f}/s")
                    batch = []
                    
            elif result['status'] == 'skipped':
                skipped += 1
            else:
                errors += 1
                if errors <= 5:
                    logger.warning(f"Error processing ETF {result['asset_id']}: {result.get('error', 'unknown')}")
    
    # Write remaining batch
    if batch:
        write_features_batch(batch)
    
    # Update latest_dates
    update_latest_date(target_date)
    
    # Summary
    elapsed = time.time() - start_time
    logger.info("=" * 60)
    logger.info("ETF FEATURES CALCULATION COMPLETE")
    logger.info(f"Total: {total} | Success: {success} | Skipped: {skipped} | Errors: {errors}")
    logger.info(f"Time: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    logger.info("=" * 60)


if __name__ == '__main__':
    main()

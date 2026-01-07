#!/usr/bin/env python3
"""
Equity Daily Features Calculation Job

Calculates technical features for all equity assets for a given date.
Designed to run after equity_daily_ohlcv.py completes.

Usage:
    python jobs/equity_daily_features.py --date 2026-01-06
    python jobs/equity_daily_features.py  # defaults to yesterday
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
ASSET_TYPE = 'equity'
ANN_FACTOR = 252  # Equities trade 252 days/year

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


def get_stale_assets(target_date: str) -> list:
    """Get equity assets that need feature calculation for target_date."""
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


def get_bars_for_asset(asset_id: int, end_date: str, lookback_days: int = 600) -> pd.DataFrame:
    """Fetch daily bars for an asset directly from PostgreSQL."""
    conn = get_connection()
    start_date = (datetime.strptime(end_date, '%Y-%m-%d') - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT date, open, high, low, close, volume
            FROM daily_bars
            WHERE asset_id = %s AND date >= %s AND date <= %s
            ORDER BY date ASC
        """, (asset_id, start_date, end_date))
        rows = cur.fetchall()
    
    if not rows:
        return pd.DataFrame()
    
    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    return df


def compute_features(bars: pd.DataFrame) -> pd.DataFrame:
    """Compute technical features for a single equity asset."""
    if bars.empty or len(bars) < 20:
        return pd.DataFrame()
    
    df = bars.copy()
    df = df.sort_values('date').reset_index(drop=True)
    
    # Basic price features
    df['log_return'] = np.log(df['close'] / df['close'].shift(1))
    df['return_1d'] = df['close'].pct_change(1)
    df['return_5d'] = df['close'].pct_change(5)
    df['return_21d'] = df['close'].pct_change(21)
    df['return_63d'] = df['close'].pct_change(63)
    df['return_252d'] = df['close'].pct_change(252)
    
    # Moving averages
    df['sma_20'] = df['close'].rolling(20).mean()
    df['sma_50'] = df['close'].rolling(50).mean()
    df['sma_200'] = df['close'].rolling(200).mean()
    
    # MA distances
    df['ma_dist_20'] = (df['close'] - df['sma_20']) / df['sma_20'] * 100
    df['ma_dist_50'] = (df['close'] - df['sma_50']) / df['sma_50'] * 100
    df['ma_dist_200'] = (df['close'] - df['sma_200']) / df['sma_200'] * 100
    
    # MA slopes
    df['ma_slope_20'] = df['sma_20'].pct_change(5) * 100
    df['ma_slope_50'] = df['sma_50'].pct_change(5) * 100
    df['ma_slope_200'] = df['sma_200'].pct_change(5) * 100
    
    # Trend regime
    df['above_ma200'] = df['close'] > df['sma_200']
    df['ma50_above_ma200'] = df['sma_50'] > df['sma_200']
    
    # ROC (Rate of Change)
    df['roc_5'] = df['close'].pct_change(5) * 100
    df['roc_10'] = df['close'].pct_change(10) * 100
    df['roc_20'] = df['close'].pct_change(20) * 100
    df['roc_63'] = df['close'].pct_change(63) * 100
    
    # DROC (Derivative of ROC)
    df['droc_5'] = df['roc_5'].diff(5)
    df['droc_10'] = df['roc_10'].diff(5)
    df['droc_20'] = df['roc_20'].diff(5)
    df['droc_63'] = df['roc_63'].diff(5)
    df['droc_20_5d'] = df['roc_20'].diff(5)
    
    # Z-scores
    df['return_std_20'] = df['return_1d'].rolling(20).std()
    df['return_z'] = df['return_1d'] / df['return_std_20']
    df['return_1d_z'] = df['return_z']
    df['roc_z_5'] = (df['roc_5'] - df['roc_5'].rolling(63).mean()) / df['roc_5'].rolling(63).std()
    df['roc_z_20'] = (df['roc_20'] - df['roc_20'].rolling(63).mean()) / df['roc_20'].rolling(63).std()
    
    # RSI
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    df['rsi_14'] = 100 - (100 / (1 + rs))
    
    # Bollinger Bands
    df['bb_middle'] = df['sma_20']
    bb_std = df['close'].rolling(20).std()
    df['bb_upper'] = df['bb_middle'] + 2 * bb_std
    df['bb_lower'] = df['bb_middle'] - 2 * bb_std
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle'] * 100
    df['bb_pct'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
    
    # Keltner Channels & ATR
    df['atr_14'] = pd.concat([
        df['high'] - df['low'],
        abs(df['high'] - df['close'].shift(1)),
        abs(df['low'] - df['close'].shift(1))
    ], axis=1).max(axis=1).rolling(14).mean()
    df['kc_upper'] = df['sma_20'] + 1.5 * df['atr_14']
    df['kc_lower'] = df['sma_20'] - 1.5 * df['atr_14']
    
    # Squeeze
    df['squeeze_keltner'] = (df['bb_upper'] < df['kc_upper']) & (df['bb_lower'] > df['kc_lower'])
    df['squeeze_flag'] = df['squeeze_keltner']
    df['squeeze_release'] = df['squeeze_flag'].shift(1) & ~df['squeeze_flag']
    
    # MACD
    ema_12 = df['close'].ewm(span=12).mean()
    ema_26 = df['close'].ewm(span=26).mean()
    df['macd_line'] = ema_12 - ema_26
    df['macd_signal'] = df['macd_line'].ewm(span=9).mean()
    df['macd_histogram'] = df['macd_line'] - df['macd_signal']
    df['macd_hist_slope'] = df['macd_histogram'].diff(3)
    
    # Donchian Channels
    df['donchian_high_20'] = df['high'].rolling(20).max()
    df['donchian_low_20'] = df['low'].rolling(20).min()
    df['donchian_high_55'] = df['high'].rolling(55).max()
    df['donchian_low_55'] = df['low'].rolling(55).min()
    
    # Breakouts
    df['breakout_up_20'] = df['close'] > df['donchian_high_20'].shift(1)
    df['breakout_down_20'] = df['close'] < df['donchian_low_20'].shift(1)
    
    # Volume features
    df['volume_sma_20'] = df['volume'].rolling(20).mean()
    df['rvol_20'] = df['volume'] / df['volume_sma_20']
    df['volume_z_60'] = (df['volume'] - df['volume'].rolling(60).mean()) / df['volume'].rolling(60).std()
    
    # Dollar volume
    df['dollar_volume'] = df['close'] * df['volume']
    df['dollar_volume_sma_20'] = df['dollar_volume'].rolling(20).mean()
    
    # Volatility
    df['realized_vol_10'] = df['log_return'].rolling(10).std() * np.sqrt(ANN_FACTOR)
    df['realized_vol_20'] = df['log_return'].rolling(20).std() * np.sqrt(ANN_FACTOR)
    df['realized_vol_60'] = df['log_return'].rolling(60).std() * np.sqrt(ANN_FACTOR)
    df['atr_pct'] = df['atr_14'] / df['close'] * 100
    
    # Gaps
    df['gap_pct'] = (df['open'] - df['close'].shift(1)) / df['close'].shift(1) * 100
    df['gap_up'] = df['gap_pct'] > 1
    df['gap_down'] = df['gap_pct'] < -1
    
    # 52-week high/low
    df['dist_52w_high'] = (df['close'] - df['high'].rolling(252).max()) / df['high'].rolling(252).max() * 100
    df['dist_52w_low'] = (df['close'] - df['low'].rolling(252).min()) / df['low'].rolling(252).min() * 100
    
    # Drawdowns
    df['drawdown_20d'] = (df['close'] - df['high'].rolling(20).max()) / df['high'].rolling(20).max() * 100
    df['drawdown_63d'] = (df['close'] - df['high'].rolling(63).max()) / df['high'].rolling(63).max() * 100
    df['drawdown_252d'] = (df['close'] - df['high'].rolling(252).max()) / df['high'].rolling(252).max() * 100
    
    # Velocity/Acceleration
    df['vel_ema_5'] = df['roc_5'].ewm(span=5).mean()
    df['vel_ema_10'] = df['roc_10'].ewm(span=10).mean()
    df['accel_ema_5'] = df['vel_ema_5'].diff(3)
    df['accel_ema_10'] = df['vel_ema_10'].diff(3)
    df['accel_z_20'] = (df['accel_ema_5'] - df['accel_ema_5'].rolling(20).mean()) / df['accel_ema_5'].rolling(20).std()
    
    return df


def build_record(row: pd.Series, asset_id: int, target_date: str) -> dict:
    """Build a record dict for database insertion."""
    def clean_value(v):
        if pd.isna(v) or (isinstance(v, float) and (np.isinf(v) or np.isnan(v))):
            return None
        if isinstance(v, (np.bool_, bool)):
            return bool(v)
        if isinstance(v, (np.integer, np.floating)):
            return float(v)
        if isinstance(v, Decimal):
            return float(v)
        return v
    
    # Feature columns to include
    feature_cols = [
        'close', 'log_return', 'return_1d', 'return_5d', 'return_21d', 'return_63d', 'return_252d',
        'sma_20', 'sma_50', 'sma_200', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
        'ma_slope_20', 'ma_slope_50', 'ma_slope_200', 'above_ma200', 'ma50_above_ma200',
        'roc_5', 'roc_10', 'roc_20', 'roc_63', 'droc_5', 'droc_10', 'droc_20', 'droc_63', 'droc_20_5d',
        'return_std_20', 'return_z', 'return_1d_z', 'roc_z_5', 'roc_z_20',
        'rsi_14', 'bb_middle', 'bb_upper', 'bb_lower', 'bb_width', 'bb_pct',
        'atr_14', 'kc_upper', 'kc_lower', 'squeeze_keltner', 'squeeze_flag', 'squeeze_release',
        'macd_line', 'macd_signal', 'macd_histogram', 'macd_hist_slope',
        'donchian_high_20', 'donchian_low_20', 'donchian_high_55', 'donchian_low_55',
        'breakout_up_20', 'breakout_down_20',
        'volume_sma_20', 'rvol_20', 'volume_z_60', 'dollar_volume', 'dollar_volume_sma_20',
        'realized_vol_10', 'realized_vol_20', 'realized_vol_60', 'atr_pct',
        'gap_pct', 'gap_up', 'gap_down',
        'dist_52w_high', 'dist_52w_low', 'drawdown_20d', 'drawdown_63d', 'drawdown_252d',
        'vel_ema_5', 'vel_ema_10', 'accel_ema_5', 'accel_ema_10', 'accel_z_20'
    ]
    
    record = {
        'asset_id': asset_id,
        'date': target_date,
        'feature_version': FEATURE_VERSION,
    }
    
    for col in feature_cols:
        if col in row.index:
            record[col] = clean_value(row[col])
    
    return record


def write_features_batch(records: list) -> int:
    """Write a batch of feature records to the database."""
    if not records:
        return 0
    
    conn = get_connection()
    
    # Get column names from first record
    columns = list(records[0].keys())
    
    # Build upsert query
    cols_str = ', '.join(columns)
    placeholders = ', '.join(['%s'] * len(columns))
    update_cols = [c for c in columns if c not in ['asset_id', 'date']]
    update_str = ', '.join([f"{c} = EXCLUDED.{c}" for c in update_cols])
    
    query = f"""
        INSERT INTO daily_features ({cols_str})
        VALUES ({placeholders})
        ON CONFLICT (asset_id, date) DO UPDATE SET {update_str}
    """
    
    with conn.cursor() as cur:
        for record in records:
            values = [record.get(c) for c in columns]
            cur.execute(query, values)
    
    return len(records)


def process_asset(asset: dict, target_date: str) -> dict:
    """Process a single asset - fetch bars and compute features."""
    asset_id = asset['asset_id']
    symbol = asset['symbol']
    
    try:
        # Fetch bars
        bars_df = get_bars_for_asset(asset_id, target_date)
        
        if bars_df.empty or len(bars_df) < 20:
            return {'status': 'skipped', 'reason': 'insufficient_bars', 'asset_id': asset_id}
        
        # Calculate features
        features_df = compute_features(bars_df)
        
        if features_df.empty:
            return {'status': 'skipped', 'reason': 'no_features', 'asset_id': asset_id}
        
        # Get the row for target_date
        target_row = features_df[features_df['date'] == pd.Timestamp(target_date)]
        
        if target_row.empty:
            return {'status': 'skipped', 'reason': 'no_target_date', 'asset_id': asset_id}
        
        # Build record
        record = build_record(target_row.iloc[0], asset_id, target_date)
        
        return {'status': 'success', 'record': record, 'asset_id': asset_id, 'symbol': symbol}
        
    except Exception as e:
        return {'status': 'error', 'error': str(e), 'asset_id': asset_id}


def main():
    parser = argparse.ArgumentParser(description='Equity Daily Features Calculation')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD). Defaults to yesterday.')
    parser.add_argument('--workers', type=int, default=8, help='Number of parallel workers')
    parser.add_argument('--batch-size', type=int, default=100, help='Batch size for DB writes')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = (date.today() - timedelta(days=1)).isoformat()
    
    logger.info("=" * 60)
    logger.info("EQUITY DAILY FEATURES CALCULATION")
    logger.info(f"Target Date: {target_date}")
    logger.info(f"Workers: {args.workers}")
    logger.info("=" * 60)
    
    # Get stale assets
    logger.info("Fetching equity assets needing features...")
    stale_assets = get_stale_assets(target_date)
    total = len(stale_assets)
    
    logger.info(f"Found {total} equity assets needing features for {target_date}")
    
    if total == 0:
        logger.info("No assets to process - all features up to date!")
        return
    
    # Estimate time
    est_time = total / 50  # ~50 assets/second with 8 workers
    logger.info(f"Estimated runtime: ~{est_time:.1f} seconds ({est_time/60:.1f} minutes)")
    
    # Process in parallel
    start_time = time.time()
    processed = 0
    success = 0
    skipped = 0
    errors = 0
    batch = []
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_asset, asset, target_date): asset 
                   for asset in stale_assets}
        
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
                    logger.warning(f"Error processing {result['asset_id']}: {result.get('error', 'unknown')}")
            
            # Progress update every 1000 assets
            if processed % 1000 == 0 and len(batch) > 0:
                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                eta = (total - processed) / rate if rate > 0 else 0
                logger.info(f"Progress: {processed}/{total} ({100*processed/total:.1f}%) | "
                          f"Rate: {rate:.1f}/s | ETA: {eta:.0f}s")
    
    # Write remaining batch
    if batch:
        written = write_features_batch(batch)
        logger.info(f"Final batch written: {written}")
    
    elapsed = time.time() - start_time
    
    logger.info("=" * 60)
    logger.info("EQUITY FEATURES CALCULATION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total processed: {processed}")
    logger.info(f"Success: {success}")
    logger.info(f"Skipped: {skipped}")
    logger.info(f"Errors: {errors}")
    logger.info(f"Time: {elapsed:.1f}s ({elapsed/60:.1f}m)")
    logger.info(f"Rate: {processed/elapsed:.1f} assets/s")


if __name__ == '__main__':
    main()

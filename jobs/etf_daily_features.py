#!/usr/bin/env python3
"""
ETF Daily Features Calculation Job
==================================
Calculates technical features for all ETF assets for a given date.
Designed to run after ETF OHLCV data is available.
Matches the equity_daily_features.py pattern.

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
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constants
FEATURE_VERSION = "2.0"
ASSET_TYPE = 'etf'

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


def get_all_etfs(target_date: str) -> list:
    """Get all active ETFs with bars for target_date (for force reprocessing)."""
    conn = get_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT a.asset_id, a.symbol, a.asset_type
            FROM assets a
            WHERE a.asset_type = %s
              AND a.is_active = true
              AND EXISTS (
                  SELECT 1 FROM daily_bars db 
                  WHERE db.asset_id = a.asset_id AND db.date = %s
              )
            ORDER BY a.asset_id
        """, (ASSET_TYPE, target_date))
        return cur.fetchall()


def get_bars_for_etf(etf_id: int, end_date: str, lookback_days: int = 300) -> pd.DataFrame:
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


def compute_features(bars: pd.DataFrame) -> pd.DataFrame:
    """Compute technical features for a single ETF - matching equity pattern."""
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
    
    # Calculate trend_regime based on MA alignment
    df['trend_regime'] = 'sideways'
    bullish = (df['close'] > df['sma_50']) & (df['sma_50'] > df['sma_200'])
    bearish = (df['close'] < df['sma_50']) & (df['sma_50'] < df['sma_200'])
    df.loc[bullish, 'trend_regime'] = 'bullish'
    df.loc[bearish, 'trend_regime'] = 'bearish'
    
    # ROC (Rate of Change)
    df['roc_5'] = df['close'].pct_change(5) * 100
    df['roc_10'] = df['close'].pct_change(10) * 100
    df['roc_20'] = df['close'].pct_change(20) * 100
    df['roc_63'] = df['close'].pct_change(63) * 100
    
    # RSI
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi_14'] = 100 - (100 / (1 + rs))
    
    # Bollinger Bands
    df['bb_middle'] = df['close'].rolling(window=20).mean()
    bb_std = df['close'].rolling(window=20).std()
    df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
    df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle'] * 100
    df['bb_pct'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
    
    # ATR
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = np.max(ranges, axis=1)
    df['atr_14'] = true_range.rolling(14).mean()
    df['atr_pct'] = df['atr_14'] / df['close'] * 100
    
    # MACD
    exp1 = df['close'].ewm(span=12, adjust=False).mean()
    exp2 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd_line'] = exp1 - exp2
    df['macd_signal'] = df['macd_line'].ewm(span=9, adjust=False).mean()
    df['macd_histogram'] = df['macd_line'] - df['macd_signal']
    
    # Volume metrics
    df['volume_sma_20'] = df['volume'].rolling(window=20).mean()
    df['dollar_volume'] = df['close'] * df['volume']
    df['dollar_volume_sma_20'] = df['dollar_volume'].rolling(window=20).mean()
    df['rvol_20'] = df['volume'] / df['volume_sma_20']
    
    # Distance from 52-week highs/lows
    df['dist_52w_high'] = (df['close'] - df['close'].rolling(252).max()) / df['close'].rolling(252).max()
    df['dist_52w_low'] = (df['close'] - df['close'].rolling(252).min()) / df['close'].rolling(252).min()
    
    return df


def clean_value(v):
    """Clean a value for database insertion."""
    if pd.isna(v) or (isinstance(v, float) and (np.isinf(v) or np.isnan(v))):
        return None
    if isinstance(v, (np.bool_, bool)):
        return bool(v)
    if isinstance(v, (np.integer, np.floating)):
        return float(v)
    if isinstance(v, Decimal):
        return float(v)
    return v


def build_record(row: pd.Series, asset_id: int, target_date: str) -> dict:
    """Build a record dict for database insertion - matching equity pattern."""
    feature_cols = [
        'close', 'log_return', 'return_1d', 'return_5d', 'return_21d', 'return_63d', 'return_252d',
        'sma_20', 'sma_50', 'sma_200', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
        'ma_slope_20', 'ma_slope_50', 'ma_slope_200', 'above_ma200', 'ma50_above_ma200',
        'trend_regime', 'roc_5', 'roc_10', 'roc_20', 'roc_63',
        'rsi_14', 'bb_middle', 'bb_upper', 'bb_lower', 'bb_width', 'bb_pct',
        'atr_14', 'atr_pct', 'macd_line', 'macd_signal', 'macd_histogram',
        'volume_sma_20', 'rvol_20', 'dollar_volume', 'dollar_volume_sma_20',
        'dist_52w_high', 'dist_52w_low'
    ]
    
    record = {
        'asset_id': asset_id,
        'date': target_date,
        'feature_version': FEATURE_VERSION,
        'calc_version': 'etf_v1',
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


def process_etf(etf: dict, target_date: str) -> dict:
    """Process a single ETF and return result dict."""
    try:
        df = get_bars_for_etf(etf['asset_id'], target_date)
        if len(df) < 50:  # Need at least 50 days for 50MA
            return {'status': 'skipped', 'reason': 'insufficient_data', 'asset_id': etf['asset_id']}
        
        df = compute_features(df)
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


def update_latest_date(target_date: str):
    """Update the latest_dates table for dashboard display."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO latest_dates (asset_type, latest_date, updated_at)
                VALUES ('etf', %s, NOW())
                ON CONFLICT (asset_type) 
                DO UPDATE SET latest_date = EXCLUDED.latest_date, updated_at = NOW()
                WHERE latest_dates.latest_date < EXCLUDED.latest_date
            """, (target_date,))
            logger.info(f"Updated latest_dates for etf to {target_date}")
    except Exception as e:
        logger.warning(f"Failed to update latest_dates: {e}")


def main():
    parser = argparse.ArgumentParser(description='ETF Daily Features Calculation')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD). Defaults to today.')
    parser.add_argument('--workers', type=int, default=8, help='Number of parallel workers')
    parser.add_argument('--batch-size', type=int, default=50, help='Batch size for DB writes')
    parser.add_argument('--limit', type=int, help='Limit number of ETFs (for testing)')
    parser.add_argument('--force', action='store_true', help='Force reprocess all ETFs (ignore existing features)')
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
    if args.force:
        logger.info("FORCE MODE: Reprocessing all ETFs")
    logger.info("=" * 60)
    
    # Get ETFs to process
    if args.force:
        logger.info("Fetching all ETF assets (force mode)...")
        etfs = get_all_etfs(target_date)
    else:
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
    if success > 0:
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

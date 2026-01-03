#!/usr/bin/env python3
"""
Direct PostgreSQL Feature Calculator for Stratos Brain.
Uses psycopg2 for direct DB access instead of Supabase REST API.
Much faster for bulk operations.
"""

import os
import sys
import argparse
import time
import json
from datetime import datetime, timedelta
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Import constants
FEATURE_VERSION = "2.0"
CALC_VERSION = "2.0.0"
MAX_LOOKBACK = 300

# Database connection string
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres')

# Thread-local storage for connections
thread_local = threading.local()

def get_connection():
    """Get thread-local database connection."""
    if not hasattr(thread_local, 'conn') or thread_local.conn.closed:
        thread_local.conn = psycopg2.connect(DATABASE_URL)
        thread_local.conn.autocommit = True
    return thread_local.conn

def get_stale_assets(target_date: str, asset_type: str = 'equity') -> list:
    """Get assets that need feature calculation for target_date."""
    conn = get_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT a.asset_id, a.symbol, a.asset_type
            FROM assets a
            WHERE a.asset_type = %s
              AND NOT EXISTS (
                  SELECT 1 FROM daily_features df 
                  WHERE df.asset_id = a.asset_id AND df.date = %s
              )
              AND EXISTS (
                  SELECT 1 FROM daily_bars db 
                  WHERE db.asset_id = a.asset_id AND db.date = %s
              )
            ORDER BY a.asset_id
        """, (asset_type, target_date, target_date))
        return cur.fetchall()

def get_bars_for_asset(asset_id: int, end_date: str, lookback_days: int = 500) -> pd.DataFrame:
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

def compute_features(bars: pd.DataFrame, asset_type: str = 'equity') -> pd.DataFrame:
    """Compute technical features for a single asset."""
    if bars.empty or len(bars) < 20:
        return pd.DataFrame()
    
    df = bars.copy()
    df = df.sort_values('date').reset_index(drop=True)
    
    # Annualization factor
    ann_factor = 252 if asset_type == 'equity' else 365
    
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
    df['bb_width_pctile'] = df['bb_width'].rolling(252).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False)
    df['bb_width_pctile_prev'] = df['bb_width_pctile'].shift(1)
    df['bb_width_pctile_expanding'] = df['bb_width_pctile'] > df['bb_width_pctile_prev']
    
    # Keltner Channels
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
    df['squeeze_pctile'] = df['bb_width_pctile']  # Fixed: use actual percentile, not boolean
    
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
    df['donchian_high_20_prev'] = df['donchian_high_20'].shift(1)
    
    # Breakouts
    df['breakout_up_20'] = df['close'] > df['donchian_high_20'].shift(1)
    df['breakout_down_20'] = df['close'] < df['donchian_low_20'].shift(1)
    df['breakout_confirmed_up'] = df['breakout_up_20'] & df['breakout_up_20'].shift(1)
    df['breakout_confirmed_down'] = df['breakout_down_20'] & df['breakout_down_20'].shift(1)
    
    # Volume features
    df['volume_sma_20'] = df['volume'].rolling(20).mean()
    df['rvol_20'] = df['volume'] / df['volume_sma_20']
    df['volume_z_60'] = (df['volume'] - df['volume'].rolling(60).mean()) / df['volume'].rolling(60).std()
    df['rvol_declining_3d'] = (df['rvol_20'] < df['rvol_20'].shift(1)) & (df['rvol_20'].shift(1) < df['rvol_20'].shift(2))
    
    # Dollar volume
    df['dollar_volume'] = df['close'] * df['volume']
    df['dollar_volume_sma_20'] = df['dollar_volume'].rolling(20).mean()
    
    # Volatility
    df['realized_vol_10'] = df['log_return'].rolling(10).std() * np.sqrt(ann_factor)
    df['realized_vol_20'] = df['log_return'].rolling(20).std() * np.sqrt(ann_factor)
    df['realized_vol_60'] = df['log_return'].rolling(60).std() * np.sqrt(ann_factor)
    df['vol_of_vol'] = df['realized_vol_20'].rolling(20).std()
    df['atr_pct'] = df['atr_14'] / df['close'] * 100
    df['atr_pctile'] = df['atr_pct'].rolling(63).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False)
    
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
    
    # Velocity/Acceleration (Druckenmiller style)
    df['vel_ema_5'] = df['roc_5'].ewm(span=5).mean()
    df['vel_ema_10'] = df['roc_10'].ewm(span=10).mean()
    df['accel_ema_5'] = df['vel_ema_5'].diff(3)
    df['accel_ema_10'] = df['vel_ema_10'].diff(3)
    df['accel_z_20'] = (df['accel_ema_5'] - df['accel_ema_5'].rolling(20).mean()) / df['accel_ema_5'].rolling(20).std()
    df['accel_z_20_prev'] = df['accel_z_20'].shift(1)
    df['accel_turn_up'] = (df['accel_z_20'] > 0) & (df['accel_z_20_prev'] < 0)
    df['accel_turn_down'] = (df['accel_z_20'] < 0) & (df['accel_z_20_prev'] > 0)
    df['accel_zero_cross_up'] = df['accel_turn_up']
    df['accel_zero_cross_down'] = df['accel_turn_down']
    
    # 5-day low tracking
    df['low_5d_min'] = df['low'].rolling(5).min()
    df['no_new_5d_lows'] = df['low'] > df['low_5d_min'].shift(1)
    
    # ROC 90th percentile
    df['roc_20_p90_63d'] = df['roc_20'].rolling(63).apply(lambda x: np.percentile(x, 90), raw=True)
    
    # Illiquidity (Amihud)
    df['illiquidity'] = abs(df['return_1d']) / df['dollar_volume'] * 1e6
    
    # OBV slope
    obv = (np.sign(df['close'].diff()) * df['volume']).cumsum()
    df['obv_slope_20'] = obv.diff(20) / obv.rolling(20).mean() * 100
    
    # Trend regime
    def get_trend_regime(row):
        if pd.isna(row['above_ma200']) or pd.isna(row['ma50_above_ma200']):
            return 'unknown'
        if row['above_ma200'] and row['ma50_above_ma200']:
            return 'uptrend'
        elif not row['above_ma200'] and not row['ma50_above_ma200']:
            return 'downtrend'
        else:
            return 'transitional'
    
    df['trend_regime'] = df.apply(get_trend_regime, axis=1)
    
    # Bars available and coverage
    df['bars_available'] = range(1, len(df) + 1)
    df['coverage_252'] = df['bars_available'] / MAX_LOOKBACK  # Fixed: numeric ratio
    
    # Placeholders for relative strength (would need benchmark)
    df['rs_vs_benchmark'] = np.nan
    df['rs_roc_20'] = np.nan
    df['rs_velocity'] = np.nan
    df['rs_acceleration'] = np.nan
    df['rs_breakout'] = False
    
    # Cross-sectional ranks (placeholders)
    df['cs_rank_return_21d'] = np.nan
    df['cs_rank_roc_20'] = np.nan
    df['cs_rank_droc_20'] = np.nan
    df['cs_rank_rvol_20'] = np.nan
    df['cs_rank_bb_width_pctile'] = np.nan
    df['cs_rank_attention_score'] = np.nan
    df['cs_unusualness'] = np.nan
    
    # Attention score (placeholder)
    df['attention_score'] = 0.0
    
    # Metadata
    df['feature_version'] = FEATURE_VERSION
    df['calc_version'] = CALC_VERSION
    df['data_vendor'] = 'alphavantage'
    
    return df

def build_record(row, asset_id: int, target_date: str) -> dict:
    """Build a feature record from a DataFrame row."""
    record = {
        'asset_id': str(asset_id),
        'date': target_date,
    }
    
    # List of feature columns to include
    feature_cols = [
        'close', 'log_return', 'return_1d', 'return_5d', 'return_21d', 'return_63d', 'return_252d',
        'sma_20', 'sma_50', 'sma_200', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
        'ma_slope_20', 'ma_slope_50', 'ma_slope_200', 'above_ma200', 'ma50_above_ma200',
        'roc_5', 'roc_10', 'roc_20', 'roc_63', 'droc_5', 'droc_10', 'droc_20', 'droc_63', 'droc_20_5d',
        'return_std_20', 'return_z', 'return_1d_z', 'roc_z_5', 'roc_z_20',
        'rsi_14', 'bb_middle', 'bb_upper', 'bb_lower', 'bb_width', 'bb_pct',
        'bb_width_pctile', 'bb_width_pctile_prev', 'bb_width_pctile_expanding',
        'atr_14', 'kc_upper', 'kc_lower', 'squeeze_keltner', 'squeeze_flag', 'squeeze_release', 'squeeze_pctile',
        'macd_line', 'macd_signal', 'macd_histogram', 'macd_hist_slope',
        'donchian_high_20', 'donchian_low_20', 'donchian_high_55', 'donchian_low_55', 'donchian_high_20_prev',
        'breakout_up_20', 'breakout_down_20', 'breakout_confirmed_up', 'breakout_confirmed_down',
        'volume_sma_20', 'rvol_20', 'volume_z_60', 'rvol_declining_3d',
        'dollar_volume', 'dollar_volume_sma_20',
        'realized_vol_10', 'realized_vol_20', 'realized_vol_60', 'vol_of_vol', 'atr_pct', 'atr_pctile',
        'gap_pct', 'gap_up', 'gap_down', 'dist_52w_high', 'dist_52w_low',
        'drawdown_20d', 'drawdown_63d', 'drawdown_252d',
        'vel_ema_5', 'vel_ema_10', 'accel_ema_5', 'accel_ema_10',
        'accel_z_20', 'accel_z_20_prev', 'accel_turn_up', 'accel_turn_down',
        'accel_zero_cross_up', 'accel_zero_cross_down',
        'low_5d_min', 'no_new_5d_lows', 'roc_20_p90_63d', 'illiquidity', 'obv_slope_20',
        'trend_regime', 'bars_available', 'coverage_252',
        'rs_vs_benchmark', 'rs_roc_20', 'rs_velocity', 'rs_acceleration', 'rs_breakout',
        'cs_rank_return_21d', 'cs_rank_roc_20', 'cs_rank_droc_20', 'cs_rank_rvol_20',
        'cs_rank_bb_width_pctile', 'cs_rank_attention_score', 'cs_unusualness',
        'attention_score', 'feature_version', 'calc_version', 'data_vendor'
    ]
    
    for col in feature_cols:
        if col in row.index:
            val = row[col]
            # Convert numpy types to Python types
            if isinstance(val, (np.integer, np.int64)):
                val = int(val)
            elif isinstance(val, (np.floating, np.float64)):
                val = float(val) if not pd.isna(val) else None
            elif isinstance(val, (np.bool_, bool)):
                val = bool(val)
            elif isinstance(val, Decimal):
                val = float(val)
            elif pd.isna(val):
                val = None
            record[col] = val
    
    return record

def write_features_batch(features_list: list):
    """Write a batch of features to the database using execute_values."""
    if not features_list:
        return 0
    
    conn = get_connection()
    
    # Get column names from first record
    columns = list(features_list[0].keys())
    
    # Build the INSERT statement with ON CONFLICT
    insert_sql = f"""
        INSERT INTO daily_features ({', '.join(columns)})
        VALUES %s
        ON CONFLICT (asset_id, date) DO UPDATE SET
        {', '.join(f'{col} = EXCLUDED.{col}' for col in columns if col not in ('asset_id', 'date'))}
    """
    
    # Convert records to tuples
    values = []
    for record in features_list:
        row = []
        for col in columns:
            val = record.get(col)
            if isinstance(val, dict):
                val = json.dumps(val)
            row.append(val)
        values.append(tuple(row))
    
    with conn.cursor() as cur:
        execute_values(cur, insert_sql, values, page_size=100)
    
    return len(values)

def process_asset(asset: dict, target_date: str) -> dict:
    """Process a single asset and return feature record."""
    asset_id = asset['asset_id']
    symbol = asset['symbol']
    asset_type = asset.get('asset_type', 'equity')
    
    try:
        # Fetch bars
        bars_df = get_bars_for_asset(asset_id, target_date)
        
        if bars_df.empty or len(bars_df) < 20:
            return {'status': 'skipped', 'reason': 'insufficient_bars', 'asset_id': asset_id}
        
        # Calculate features
        features_df = compute_features(bars_df, asset_type)
        
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
    parser = argparse.ArgumentParser(description='Direct PostgreSQL Feature Calculator')
    parser.add_argument('--target-date', required=True, help='Target date (YYYY-MM-DD)')
    parser.add_argument('--asset-type', default='equity', choices=['equity', 'crypto'])
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--batch-size', type=int, default=50, help='Batch size for DB writes')
    parser.add_argument('--limit', type=int, default=None, help='Limit number of assets')
    args = parser.parse_args()
    
    print(f"=== Direct PostgreSQL Feature Calculator ===")
    print(f"Target date: {args.target_date}")
    print(f"Asset type: {args.asset_type}")
    print(f"Workers: {args.workers}")
    print(f"Batch size: {args.batch_size}")
    
    # Get stale assets
    print("\nFetching stale assets...")
    stale_assets = get_stale_assets(args.target_date, args.asset_type)
    
    if args.limit:
        stale_assets = stale_assets[:args.limit]
    
    total = len(stale_assets)
    print(f"Found {total} assets needing features for {args.target_date}")
    
    if total == 0:
        print("No assets to process!")
        return
    
    # Process in parallel
    start_time = time.time()
    processed = 0
    success = 0
    skipped = 0
    errors = 0
    batch = []
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_asset, asset, args.target_date): asset 
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
                    print(f"Progress: {processed}/{total} ({100*processed/total:.1f}%) | "
                          f"Success: {success} | Skipped: {skipped} | Errors: {errors} | "
                          f"Rate: {rate:.1f}/s | Batch: {written}")
                    batch = []
                    
            elif result['status'] == 'skipped':
                skipped += 1
            else:
                errors += 1
                if errors <= 5:
                    print(f"Error processing {result['asset_id']}: {result.get('error', 'unknown')}")
            
            # Progress update every 500 assets
            if processed % 500 == 0 and len(batch) > 0:
                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                eta = (total - processed) / rate if rate > 0 else 0
                print(f"Progress: {processed}/{total} ({100*processed/total:.1f}%) | "
                      f"Rate: {rate:.1f}/s | ETA: {eta/60:.1f}m")
    
    # Write remaining batch
    if batch:
        written = write_features_batch(batch)
        print(f"Final batch written: {written}")
    
    elapsed = time.time() - start_time
    print(f"\n=== COMPLETE ===")
    print(f"Total processed: {processed}")
    print(f"Success: {success}")
    print(f"Skipped: {skipped}")
    print(f"Errors: {errors}")
    print(f"Time: {elapsed:.1f}s ({elapsed/60:.1f}m)")
    print(f"Rate: {processed/elapsed:.1f} assets/s")

if __name__ == '__main__':
    main()

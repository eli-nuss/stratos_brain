#!/usr/bin/env python3
"""
Backfill Missing Setup Flags
============================
Updates daily_features records with missing boolean columns needed for setup scanner.
This is a one-time script to fix historical data.

Usage:
    python scripts/backfill_setup_flags.py --date 2026-01-23
    python scripts/backfill_setup_flags.py --date 2026-01-23 --asset-type equity
"""
import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def get_connection():
    """Get database connection."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(database_url)


def get_assets_to_update(conn, target_date: str, asset_type: str = None, force_rs: bool = False) -> list:
    """Get assets that need the boolean flags updated."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if force_rs:
            # Force update RS features for all assets
            query = """
                SELECT df.asset_id, a.symbol, a.asset_type
                FROM daily_features df
                JOIN assets a ON df.asset_id = a.asset_id
                WHERE df.date = %s
                  AND (df.rs_vs_benchmark IS NULL OR df.rs_roc_20 IS NULL)
            """
        else:
            query = """
                SELECT df.asset_id, a.symbol, a.asset_type
                FROM daily_features df
                JOIN assets a ON df.asset_id = a.asset_id
                WHERE df.date = %s
                  AND (df.breakout_confirmed_up IS NULL OR df.accel_turn_up IS NULL OR df.rs_breakout IS NULL OR df.rs_vs_benchmark IS NULL)
            """
        params = [target_date]
        
        if asset_type:
            query += " AND a.asset_type = %s"
            params.append(asset_type)
        
        query += " ORDER BY a.asset_id"
        cur.execute(query, params)
        return cur.fetchall()


def get_bars_for_asset(conn, asset_id: int, end_date: str, lookback_days: int = 300) -> pd.DataFrame:
    """Fetch daily bars for an asset."""
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


def get_benchmark_bars(conn, end_date: str, lookback_days: int = 300) -> pd.DataFrame:
    """Fetch S&P 500 (^GSPC) bars as benchmark from index_daily_bars."""
    start_date = (datetime.strptime(end_date, '%Y-%m-%d') - timedelta(days=lookback_days)).strftime('%Y-%m-%d')
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # index_id = 1 is S&P 500 (^GSPC)
        cur.execute("""
            SELECT date, close
            FROM index_daily_bars
            WHERE index_id = 1 AND date >= %s AND date <= %s
            ORDER BY date ASC
        """, (start_date, end_date))
        rows = cur.fetchall()
    
    if not rows:
        logger.warning("No S&P 500 benchmark data found")
        return None
    
    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'])
    df['close'] = pd.to_numeric(df['close'], errors='coerce')
    logger.info(f"Loaded {len(df)} benchmark bars from index_daily_bars")
    return df


def calculate_setup_flags(bars_df: pd.DataFrame, benchmark_df: pd.DataFrame = None) -> dict:
    """Calculate the missing boolean flags for setup scanner."""
    if bars_df.empty or len(bars_df) < 20:
        return None
    
    df = bars_df.copy()
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']
    
    # Basic features needed for calculations
    df['return_1d'] = close.pct_change()
    df['sma_20'] = close.rolling(20).mean()
    df['rvol_20'] = volume / volume.rolling(20).mean()
    df['roc_20'] = close.pct_change(20)
    
    # Donchian channels
    df['donchian_high_20'] = high.rolling(20).max()
    df['donchian_low_20'] = low.rolling(20).min()
    
    # Breakout flags
    df['breakout_up_20'] = close > df['donchian_high_20'].shift(1)
    df['breakout_down_20'] = close < df['donchian_low_20'].shift(1)
    
    # Bollinger Bands for squeeze
    df['bb_middle'] = close.rolling(20).mean()
    df['bb_std'] = close.rolling(20).std()
    df['bb_upper'] = df['bb_middle'] + 2 * df['bb_std']
    df['bb_lower'] = df['bb_middle'] - 2 * df['bb_std']
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
    
    # Keltner Channels
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low - close.shift(1)).abs()
    ], axis=1).max(axis=1)
    df['atr_14'] = tr.rolling(14).mean()
    ema_20 = close.ewm(span=20, adjust=False).mean()
    df['kc_upper'] = ema_20 + 1.5 * df['atr_14']
    df['kc_lower'] = ema_20 - 1.5 * df['atr_14']
    
    # Squeeze detection
    df['squeeze_flag'] = (df['bb_lower'] > df['kc_lower']) & (df['bb_upper'] < df['kc_upper'])
    df['squeeze_release'] = df['squeeze_flag'].shift(1) & ~df['squeeze_flag']
    
    # Breakout confirmed (with volume or squeeze confirmation)
    df['breakout_confirmed_up'] = df['breakout_up_20'] & (
        (df['rvol_20'] > 1.5) | df['squeeze_release']
    )
    df['breakout_confirmed_down'] = df['breakout_down_20'] & (
        (df['rvol_20'] > 1.5) | df['squeeze_release']
    )
    
    # Acceleration features
    df['vel_ema_5'] = close.pct_change().ewm(span=5, adjust=False).mean()
    df['accel_ema_5'] = df['vel_ema_5'].diff()
    df['accel_z_20'] = (df['accel_ema_5'] - df['accel_ema_5'].rolling(20).mean()) / df['accel_ema_5'].rolling(20).std()
    df['accel_z_20_prev'] = df['accel_z_20'].shift(1)
    
    # Acceleration turn signals
    df['accel_turn_up'] = (df['accel_z_20'] > 0.3) & (df['accel_z_20_prev'] < -0.3)
    df['accel_turn_down'] = (df['accel_z_20'] < -0.3) & (df['accel_z_20_prev'] > 0.3)
    
    # RS features (relative to benchmark)
    if benchmark_df is not None and len(benchmark_df) > 0:
        bench = benchmark_df.set_index('date')['close']
        bench = bench.reindex(df['date'], method='ffill')
        bench = bench.values
        
        df['rs_vs_benchmark'] = close / bench
        df['rs_roc_20'] = df['rs_vs_benchmark'].pct_change(20)
        df['rs_velocity'] = np.log(df['rs_vs_benchmark']).ewm(span=5, adjust=False).mean()
        df['rs_acceleration'] = df['rs_velocity'].diff()
        
        df['rs_breakout'] = (
            (df['rs_roc_20'] > 0.05) &
            (df['rs_acceleration'] > 0) &
            (df['roc_20'] > 0)
        )
    else:
        df['rs_vs_benchmark'] = np.nan
        df['rs_roc_20'] = np.nan
        df['rs_velocity'] = np.nan
        df['rs_acceleration'] = np.nan
        df['rs_breakout'] = False
    
    # BB width percentile
    df['bb_width_pctile'] = df['bb_width'].rolling(63).apply(
        lambda x: (x.iloc[-1] <= x).sum() / len(x) * 100 if len(x) > 0 else 50
    )
    
    # Get the last row
    last_row = df.iloc[-1]
    
    def clean_value(v):
        if pd.isna(v) or (isinstance(v, float) and (np.isinf(v) or np.isnan(v))):
            return None
        if isinstance(v, (np.bool_, bool)):
            return bool(v)
        if isinstance(v, (np.integer, np.floating)):
            return float(v)
        return v
    
    return {
        'breakout_confirmed_up': clean_value(last_row.get('breakout_confirmed_up')),
        'breakout_confirmed_down': clean_value(last_row.get('breakout_confirmed_down')),
        'accel_turn_up': clean_value(last_row.get('accel_turn_up')),
        'accel_turn_down': clean_value(last_row.get('accel_turn_down')),
        'accel_z_20_prev': clean_value(last_row.get('accel_z_20_prev')),
        'rs_breakout': clean_value(last_row.get('rs_breakout')),
        'rs_velocity': clean_value(last_row.get('rs_velocity')),
        'rs_acceleration': clean_value(last_row.get('rs_acceleration')),
        'rs_vs_benchmark': clean_value(last_row.get('rs_vs_benchmark')),
        'rs_roc_20': clean_value(last_row.get('rs_roc_20')),
        'bb_width_pctile': clean_value(last_row.get('bb_width_pctile')),
    }


def update_features(conn, asset_id: int, target_date: str, flags: dict):
    """Update the daily_features record with the calculated flags."""
    set_clauses = []
    values = []
    
    for col, val in flags.items():
        set_clauses.append(f"{col} = %s")
        values.append(val)
    
    values.extend([asset_id, target_date])
    
    query = f"""
        UPDATE daily_features
        SET {', '.join(set_clauses)}
        WHERE asset_id = %s AND date = %s
    """
    
    with conn.cursor() as cur:
        cur.execute(query, values)


def main():
    parser = argparse.ArgumentParser(description='Backfill missing setup flags in daily_features')
    parser.add_argument('--date', required=True, help='Target date (YYYY-MM-DD)')
    parser.add_argument('--asset-type', choices=['equity', 'crypto'], help='Filter by asset type')
    args = parser.parse_args()
    
    conn = get_connection()
    conn.autocommit = True
    
    logger.info(f"Backfilling setup flags for {args.date}")
    
    # Get benchmark bars
    logger.info("Fetching benchmark (SPY) bars...")
    benchmark_df = get_benchmark_bars(conn, args.date)
    
    # Get assets needing update
    assets = get_assets_to_update(conn, args.date, args.asset_type)
    logger.info(f"Found {len(assets)} assets needing flag updates")
    
    if not assets:
        logger.info("No assets need updating")
        return
    
    success = 0
    skipped = 0
    errors = 0
    
    for i, asset in enumerate(assets):
        asset_id = asset['asset_id']
        symbol = asset['symbol']
        
        try:
            bars_df = get_bars_for_asset(conn, asset_id, args.date)
            
            if bars_df.empty or len(bars_df) < 20:
                skipped += 1
                continue
            
            flags = calculate_setup_flags(bars_df, benchmark_df)
            
            if flags is None:
                skipped += 1
                continue
            
            update_features(conn, asset_id, args.date, flags)
            success += 1
            
            if (i + 1) % 100 == 0:
                logger.info(f"  Processed {i + 1}/{len(assets)} assets")
                
        except Exception as e:
            logger.error(f"Error processing {symbol}: {e}")
            errors += 1
    
    logger.info("=" * 60)
    logger.info("BACKFILL COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total: {len(assets)}")
    logger.info(f"Success: {success}")
    logger.info(f"Skipped: {skipped}")
    logger.info(f"Errors: {errors}")


if __name__ == '__main__':
    main()

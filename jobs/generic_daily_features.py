#!/usr/bin/env python3
"""
Generic Daily Features Calculation Job
======================================
Calculates technical features for any asset type (index, commodity, etf, etc.)
Uses the same feature calculation logic as equity/crypto but for other asset types.

Usage:
    python -m jobs.generic_daily_features --asset-type index [--date YYYY-MM-DD]
    python -m jobs.generic_daily_features --asset-type commodity [--date YYYY-MM-DD]
    python -m jobs.generic_daily_features --asset-type etf [--date YYYY-MM-DD]

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
"""

import os
import sys
import argparse
import logging
import time
from datetime import datetime, timedelta
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

# Annualization factors by asset type
ANN_FACTORS = {
    'index': 252,      # Most indices trade like equities
    'commodity': 252,  # Commodity futures trade ~252 days
    'etf': 252,        # ETFs trade like equities
    'crypto': 365,     # Crypto trades 365 days
    'equity': 252,     # Equities trade 252 days
}

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


def get_stale_assets(target_date: str, asset_type: str) -> list:
    """Get assets that need feature calculation for target_date."""
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
        """, (asset_type, target_date, target_date))
        return cur.fetchall()


def get_bars_for_asset(asset_id: int, end_date: str, lookback_days: int = 600) -> pd.DataFrame:
    """Fetch daily bars for an asset."""
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
    
    return df.set_index('date').sort_index()


def calculate_features(df: pd.DataFrame, ann_factor: int = 252) -> dict:
    """Calculate technical features from OHLCV data."""
    if len(df) < 20:
        return None
    
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']
    
    features = {}
    
    # Current price
    features['close'] = close.iloc[-1]
    
    # Returns (matching actual schema: return_1d, return_5d, return_21d, return_63d, return_252d)
    features['return_1d'] = close.pct_change().iloc[-1] * 100
    features['return_5d'] = (close.iloc[-1] / close.iloc[-5] - 1) * 100 if len(close) >= 5 else None
    features['return_21d'] = (close.iloc[-1] / close.iloc[-21] - 1) * 100 if len(close) >= 21 else None
    features['return_63d'] = (close.iloc[-1] / close.iloc[-63] - 1) * 100 if len(close) >= 63 else None
    features['return_252d'] = (close.iloc[-1] / close.iloc[-252] - 1) * 100 if len(close) >= 252 else None
    
    # Volatility (realized_vol_20, realized_vol_60)
    daily_returns = close.pct_change().dropna()
    features['realized_vol_20'] = daily_returns.tail(20).std() * np.sqrt(ann_factor) * 100 if len(daily_returns) >= 20 else None
    features['realized_vol_60'] = daily_returns.tail(60).std() * np.sqrt(ann_factor) * 100 if len(daily_returns) >= 60 else None
    
    # Moving Averages
    features['sma_20'] = close.tail(20).mean() if len(close) >= 20 else None
    features['sma_50'] = close.tail(50).mean() if len(close) >= 50 else None
    features['sma_200'] = close.tail(200).mean() if len(close) >= 200 else None
    
    # MA Distance (price vs MAs)
    current_price = close.iloc[-1]
    if features['sma_20']:
        features['ma_dist_20'] = (current_price / features['sma_20'] - 1) * 100
    if features['sma_50']:
        features['ma_dist_50'] = (current_price / features['sma_50'] - 1) * 100
    if features['sma_200']:
        features['ma_dist_200'] = (current_price / features['sma_200'] - 1) * 100
    
    # RSI
    delta = close.diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    features['rsi_14'] = rsi.iloc[-1] if len(rsi) >= 14 else None
    
    # MACD
    if len(close) >= 26:
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        features['macd_line'] = macd_line.iloc[-1]
        features['macd_signal'] = signal_line.iloc[-1]
        features['macd_histogram'] = macd_line.iloc[-1] - signal_line.iloc[-1]
    
    # Bollinger Bands
    if len(close) >= 20:
        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        upper_band = sma20 + (std20 * 2)
        lower_band = sma20 - (std20 * 2)
        features['bb_upper'] = upper_band.iloc[-1]
        features['bb_lower'] = lower_band.iloc[-1]
        features['bb_middle'] = sma20.iloc[-1]
        features['bb_width'] = ((upper_band.iloc[-1] - lower_band.iloc[-1]) / sma20.iloc[-1]) * 100
        features['bb_pct'] = (current_price - lower_band.iloc[-1]) / (upper_band.iloc[-1] - lower_band.iloc[-1]) if upper_band.iloc[-1] != lower_band.iloc[-1] else 0.5
    
    # ATR
    if len(df) >= 14:
        tr = pd.concat([
            high - low,
            abs(high - close.shift(1)),
            abs(low - close.shift(1))
        ], axis=1).max(axis=1)
        features['atr_14'] = tr.rolling(14).mean().iloc[-1]
        features['atr_pct'] = (features['atr_14'] / current_price) * 100
    
    # Volume features
    if volume.sum() > 0:
        features['volume_sma_20'] = volume.tail(20).mean() if len(volume) >= 20 else None
        if features.get('volume_sma_20') and features['volume_sma_20'] > 0:
            features['rvol_20'] = volume.iloc[-1] / features['volume_sma_20']
    
    # Donchian Channel
    if len(df) >= 20:
        features['donchian_high_20'] = high.tail(20).max()
        features['donchian_low_20'] = low.tail(20).min()
    
    if len(df) >= 55:
        features['donchian_high_55'] = high.tail(55).max()
        features['donchian_low_55'] = low.tail(55).min()
    
    # 52-week high/low distance
    if len(df) >= 252:
        high_52w = high.tail(252).max()
        low_52w = low.tail(252).min()
        features['dist_52w_high'] = (current_price / high_52w - 1) * 100
        features['dist_52w_low'] = (current_price / low_52w - 1) * 100
    
    # ROC (Rate of Change)
    features['roc_5'] = (close.iloc[-1] / close.iloc[-5] - 1) * 100 if len(close) >= 5 else None
    features['roc_10'] = (close.iloc[-1] / close.iloc[-10] - 1) * 100 if len(close) >= 10 else None
    features['roc_20'] = (close.iloc[-1] / close.iloc[-20] - 1) * 100 if len(close) >= 20 else None
    features['roc_63'] = (close.iloc[-1] / close.iloc[-63] - 1) * 100 if len(close) >= 63 else None
    
    # Bars available
    features['bars_available'] = len(df)
    
    return features


def save_features(asset_id: int, target_date: str, features: dict) -> bool:
    """Save calculated features to database."""
    conn = get_connection()
    
    # Convert numpy types to Python native types
    clean_features = {}
    for k, v in features.items():
        if v is None:
            clean_features[k] = None
        elif isinstance(v, (np.floating, np.integer)):
            clean_features[k] = float(v)
        elif isinstance(v, Decimal):
            clean_features[k] = float(v)
        else:
            clean_features[k] = v
    
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO daily_features (
                asset_id, date, feature_version, close,
                return_1d, return_5d, return_21d, return_63d, return_252d,
                realized_vol_20, realized_vol_60,
                sma_20, sma_50, sma_200,
                ma_dist_20, ma_dist_50, ma_dist_200,
                rsi_14, macd_line, macd_signal, macd_histogram,
                bb_upper, bb_lower, bb_middle, bb_width, bb_pct,
                atr_14, atr_pct,
                volume_sma_20, rvol_20,
                donchian_high_20, donchian_low_20, donchian_high_55, donchian_low_55,
                dist_52w_high, dist_52w_low,
                roc_5, roc_10, roc_20, roc_63,
                bars_available
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s, %s, %s,
                %s
            )
            ON CONFLICT (asset_id, date) DO UPDATE SET
                feature_version = EXCLUDED.feature_version,
                close = EXCLUDED.close,
                return_1d = EXCLUDED.return_1d,
                return_5d = EXCLUDED.return_5d,
                return_21d = EXCLUDED.return_21d,
                return_63d = EXCLUDED.return_63d,
                return_252d = EXCLUDED.return_252d,
                realized_vol_20 = EXCLUDED.realized_vol_20,
                realized_vol_60 = EXCLUDED.realized_vol_60,
                sma_20 = EXCLUDED.sma_20,
                sma_50 = EXCLUDED.sma_50,
                sma_200 = EXCLUDED.sma_200,
                ma_dist_20 = EXCLUDED.ma_dist_20,
                ma_dist_50 = EXCLUDED.ma_dist_50,
                ma_dist_200 = EXCLUDED.ma_dist_200,
                rsi_14 = EXCLUDED.rsi_14,
                macd_line = EXCLUDED.macd_line,
                macd_signal = EXCLUDED.macd_signal,
                macd_histogram = EXCLUDED.macd_histogram,
                bb_upper = EXCLUDED.bb_upper,
                bb_lower = EXCLUDED.bb_lower,
                bb_middle = EXCLUDED.bb_middle,
                bb_width = EXCLUDED.bb_width,
                bb_pct = EXCLUDED.bb_pct,
                atr_14 = EXCLUDED.atr_14,
                atr_pct = EXCLUDED.atr_pct,
                volume_sma_20 = EXCLUDED.volume_sma_20,
                rvol_20 = EXCLUDED.rvol_20,
                donchian_high_20 = EXCLUDED.donchian_high_20,
                donchian_low_20 = EXCLUDED.donchian_low_20,
                donchian_high_55 = EXCLUDED.donchian_high_55,
                donchian_low_55 = EXCLUDED.donchian_low_55,
                dist_52w_high = EXCLUDED.dist_52w_high,
                dist_52w_low = EXCLUDED.dist_52w_low,
                roc_5 = EXCLUDED.roc_5,
                roc_10 = EXCLUDED.roc_10,
                roc_20 = EXCLUDED.roc_20,
                roc_63 = EXCLUDED.roc_63,
                bars_available = EXCLUDED.bars_available,
                updated_at = NOW()
        """, (
            asset_id, target_date, FEATURE_VERSION, clean_features.get('close'),
            clean_features.get('return_1d'), clean_features.get('return_5d'),
            clean_features.get('return_21d'), clean_features.get('return_63d'),
            clean_features.get('return_252d'),
            clean_features.get('realized_vol_20'), clean_features.get('realized_vol_60'),
            clean_features.get('sma_20'), clean_features.get('sma_50'), clean_features.get('sma_200'),
            clean_features.get('ma_dist_20'), clean_features.get('ma_dist_50'),
            clean_features.get('ma_dist_200'),
            clean_features.get('rsi_14'), clean_features.get('macd_line'),
            clean_features.get('macd_signal'), clean_features.get('macd_histogram'),
            clean_features.get('bb_upper'), clean_features.get('bb_lower'),
            clean_features.get('bb_middle'), clean_features.get('bb_width'),
            clean_features.get('bb_pct'),
            clean_features.get('atr_14'), clean_features.get('atr_pct'),
            clean_features.get('volume_sma_20'), clean_features.get('rvol_20'),
            clean_features.get('donchian_high_20'), clean_features.get('donchian_low_20'),
            clean_features.get('donchian_high_55'), clean_features.get('donchian_low_55'),
            clean_features.get('dist_52w_high'), clean_features.get('dist_52w_low'),
            clean_features.get('roc_5'), clean_features.get('roc_10'),
            clean_features.get('roc_20'), clean_features.get('roc_63'),
            clean_features.get('bars_available')
        ))
    
    return True


def process_asset(asset: dict, target_date: str, ann_factor: int) -> tuple:
    """Process a single asset - fetch bars, calculate features, save."""
    asset_id = asset['asset_id']
    symbol = asset['symbol']
    
    try:
        # Get historical bars
        df = get_bars_for_asset(asset_id, target_date)
        
        if df.empty or len(df) < 20:
            return (symbol, False, "Insufficient data")
        
        # Calculate features
        features = calculate_features(df, ann_factor)
        
        if features is None:
            return (symbol, False, "Feature calculation failed")
        
        # Save features
        save_features(asset_id, target_date, features)
        
        return (symbol, True, None)
        
    except Exception as e:
        return (symbol, False, str(e))


def main():
    parser = argparse.ArgumentParser(description='Calculate daily features for assets')
    parser.add_argument('--asset-type', type=str, required=True,
                        choices=['index', 'commodity', 'etf'],
                        help='Asset type to process')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD), default: today')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = datetime.utcnow().strftime('%Y-%m-%d')
    
    asset_type = args.asset_type
    ann_factor = ANN_FACTORS.get(asset_type, 252)
    
    logger.info("=" * 60)
    logger.info(f"{asset_type.upper()} Daily Features Calculation")
    logger.info(f"Target date: {target_date}")
    logger.info(f"Annualization factor: {ann_factor}")
    logger.info("=" * 60)
    
    # Get assets needing features
    assets = get_stale_assets(target_date, asset_type)
    logger.info(f"Found {len(assets)} {asset_type} assets needing features")
    
    if not assets:
        logger.info("No assets to process")
        return
    
    # Process assets in parallel
    success_count = 0
    error_count = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_asset, asset, target_date, ann_factor): asset
            for asset in assets
        }
        
        for i, future in enumerate(as_completed(futures)):
            symbol, success, error = future.result()
            
            if success:
                success_count += 1
            else:
                error_count += 1
                logger.debug(f"{symbol}: {error}")
            
            if (i + 1) % 20 == 0:
                logger.info(f"Progress: {i + 1}/{len(assets)} ({success_count} success, {error_count} errors)")
    
    # Summary
    logger.info("=" * 60)
    logger.info("Summary")
    logger.info("=" * 60)
    logger.info(f"Total assets: {len(assets)}")
    logger.info(f"Successful: {success_count}")
    logger.info(f"Errors: {error_count}")
    
    # Verify in database
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FROM daily_features df
            JOIN assets a ON df.asset_id = a.asset_id
            WHERE a.asset_type = %s AND df.date = %s
        """, (asset_type, target_date))
        count = cur.fetchone()[0]
        logger.info(f"Total {asset_type} features for {target_date}: {count}")
    
    logger.info("Done!")


if __name__ == "__main__":
    main()

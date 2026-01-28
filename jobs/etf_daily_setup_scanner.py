#!/usr/bin/env python3
"""
ETF Daily Setup Scanner
=======================
Scans ETFs for trading setups based on optimized parameters.
Separate from the main setup scanner to allow independent ETF-specific tuning.

Usage:
    python jobs/etf_daily_setup_scanner.py --date 2026-01-27
    python jobs/etf_daily_setup_scanner.py  # defaults to latest date with features

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
"""

import os
import sys
import argparse
import logging
from datetime import datetime, date
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get('DATABASE_URL')
thread_local = threading.local()


def get_connection():
    """Get thread-local database connection."""
    if not hasattr(thread_local, 'conn') or thread_local.conn.closed:
        thread_local.conn = psycopg2.connect(DATABASE_URL)
        thread_local.conn.autocommit = True
    return thread_local.conn


# ETF-optimized setup definitions
# Adapted from the main setup scanner but tuned for ETF characteristics
SETUPS = {
    'etf_trend_pullback_50ma': {
        'description': 'ETF Pullback to 50MA in uptrend',
        'style': 'position',
        'entry': {
            'ma_dist_50_min': -0.03,
            'ma_dist_50_max': 0.03,
            'rsi_max': 55,
            'above_ma200': True
        },
        'exit': {
            'breakdown_ma_dist_200': -0.02,
            'trailing_activation_pct': 0.10,
            'max_hold_days': 60
        }
    },
    'etf_oversold_bounce': {
        'description': 'ETF RSI Oversold Bounce',
        'style': 'swing',
        'entry': {
            'rsi_max': 35,
            'ma_dist_20_max': -0.05
        },
        'exit': {
            'target_ma_dist_20': 0.02,
            'stop_atr_mult': 2.0,
            'max_hold_days': 15
        }
    },
    'etf_breakout_confirmed': {
        'description': 'ETF Volume-Confirmed Breakout',
        'style': 'position',
        'entry': {
            'ma_dist_50_min': 0.05,
            'rvol_min': 1.2,
            'macd_positive': True
        },
        'exit': {
            'breakdown_ma_dist_50': -0.04,
            'trailing_activation_pct': 0.08,
            'max_hold_days': 45
        }
    },
    'etf_golden_cross': {
        'description': 'ETF Golden Cross (50MA > 200MA)',
        'style': 'position',
        'entry': {
            'ma50_above_ma200': True,
            'ma_dist_50_min': -0.02,
            'rsi_min': 45,
            'rsi_max': 70
        },
        'exit': {
            'breakdown_ma_dist_50': -0.03,
            'trailing_activation_pct': 0.12,
            'max_hold_days': 90
        }
    }
}


def get_etfs_with_features(target_date: str) -> list:
    """Get all ETFs with features for target date."""
    conn = get_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                df.asset_id,
                a.symbol,
                a.name,
                df.close,
                df.rsi_14,
                df.ma_dist_20,
                df.ma_dist_50,
                df.ma_dist_200,
                df.trend_regime,
                df.above_ma200,
                df.ma50_above_ma200,
                df.bb_width,
                df.rvol_20,
                df.return_21d,
                df.macd_histogram,
                df.atr_14,
                df.atr_pct,
                df.sma_20,
                df.sma_50,
                df.sma_200
            FROM daily_features df
            JOIN assets a ON df.asset_id = a.asset_id
            WHERE df.date = %s
              AND a.asset_type = 'etf'
              AND a.is_active = true
        """, (target_date,))
        return cur.fetchall()


def evaluate_setup(etf: dict, setup_name: str, setup_config: dict) -> dict:
    """Evaluate if an ETF meets setup criteria."""
    entry = setup_config['entry']
    
    # Check each entry condition
    for key, value in entry.items():
        if key == 'ma_dist_50_min':
            if etf.get('ma_dist_50') is None or etf['ma_dist_50'] < value:
                return None
        elif key == 'ma_dist_50_max':
            if etf.get('ma_dist_50') is None or etf['ma_dist_50'] > value:
                return None
        elif key == 'ma_dist_20_max':
            if etf.get('ma_dist_20') is None or etf['ma_dist_20'] > value:
                return None
        elif key == 'rsi_max':
            if etf.get('rsi_14') is None or etf['rsi_14'] > value:
                return None
        elif key == 'rsi_min':
            if etf.get('rsi_14') is None or etf['rsi_14'] < value:
                return None
        elif key == 'above_ma200':
            if not etf.get('above_ma200'):
                return None
        elif key == 'ma50_above_ma200':
            if not etf.get('ma50_above_ma200'):
                return None
        elif key == 'rvol_min':
            if etf.get('rvol_20') is None or etf['rvol_20'] < value:
                return None
        elif key == 'macd_positive':
            if etf.get('macd_histogram') is None or etf['macd_histogram'] <= 0:
                return None
    
    # Calculate entry/stop/target
    entry_price = etf['close']
    
    # Calculate stop based on ATR or fixed percentage
    atr_pct = etf.get('atr_pct', 2.0)  # Default 2% if no ATR
    if setup_name == 'etf_oversold_bounce':
        stop_loss = entry_price * 0.95  # 5% fixed stop
        target_price = entry_price * 1.08  # 8% target
    elif setup_name == 'etf_trend_pullback_50ma':
        stop_loss = entry_price * 0.97  # 3% stop
        target_price = entry_price * 1.10  # 10% target
    else:
        stop_loss = entry_price * (1 - atr_pct / 100 * 2)  # 2x ATR
        target_price = entry_price * (1 + atr_pct / 100 * 3)  # 3x ATR
    
    # Calculate risk:reward
    risk = entry_price - stop_loss
    reward = target_price - entry_price
    risk_reward = reward / risk if risk > 0 else 0
    
    # Calculate setup strength (0-100)
    strength = 50  # Base
    if etf.get('rsi_14') is not None:
        if setup_name == 'etf_oversold_bounce':
            strength += min(30, int(35 - etf['rsi_14']))  # More oversold = stronger
        else:
            strength += min(20, int(70 - etf['rsi_14']))
    
    if etf.get('rvol_20') is not None:
        strength += min(15, int((etf['rvol_20'] - 1) * 10))  # Higher volume = stronger
    
    if etf.get('ma50_above_ma200'):
        strength += 10  # Trend alignment bonus
    
    strength = min(100, max(0, strength))
    
    return {
        'asset_id': etf['asset_id'],
        'setup_name': setup_name,
        'signal_date': None,  # Set by caller
        'entry_price': entry_price,
        'stop_loss': stop_loss,
        'target_price': target_price,
        'risk_reward': risk_reward,
        'setup_strength': strength,
        'entry_params': {k: float(v) if isinstance(v, (int, float, Decimal)) else v 
                        for k, v in entry.items()},
        'exit_params': setup_config['exit'],
        'context': {
            'rsi': etf.get('rsi_14'),
            'ma_dist_50': etf.get('ma_dist_50'),
            'trend_regime': etf.get('trend_regime'),
            'rvol': etf.get('rvol_20')
        }
    }


def process_etf(etf: dict, target_date: str) -> list:
    """Process a single ETF and return all detected setups."""
    setups = []
    for setup_name, setup_config in SETUPS.items():
        result = evaluate_setup(etf, setup_name, setup_config)
        if result:
            result['signal_date'] = target_date
            setups.append(result)
    return setups


def main():
    parser = argparse.ArgumentParser(description='ETF Daily Setup Scanner')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD)')
    parser.add_argument('--workers', type=int, default=8, help='Number of parallel workers')
    args = parser.parse_args()
    
    if args.date:
        target_date = args.date
    else:
        # Default to latest date with ETF features
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT MAX(df.date) 
                FROM daily_features df
                JOIN assets a ON df.asset_id = a.asset_id
                WHERE a.asset_type = 'etf'
            """)
            result = cur.fetchone()
            target_date = result[0].isoformat() if result and result[0] else date.today().isoformat()
    
    logger.info("=" * 60)
    logger.info("ETF DAILY SETUP SCANNER")
    logger.info(f"Target Date: {target_date}")
    logger.info("=" * 60)
    
    # Get ETFs with features
    etfs = get_etfs_with_features(target_date)
    logger.info(f"Found {len(etfs)} ETFs with features")
    
    if not etfs:
        logger.warning("No ETFs found - run ETF features first")
        return
    
    # Scan for setups in parallel
    all_setups = []
    processed = 0
    errors = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_etf, etf, target_date): etf for etf in etfs}
        
        for future in as_completed(futures):
            try:
                setups = future.result()
                all_setups.extend(setups)
                processed += 1
                if processed % 100 == 0:
                    logger.info(f"Processed {processed}/{len(etfs)} ETFs...")
            except Exception as e:
                errors += 1
                logger.warning(f"Error processing ETF: {e}")
    
    logger.info(f"Processed {processed} ETFs, found {len(all_setups)} setups")
    
    if errors > 0:
        logger.warning(f"Errors: {errors}")
    
    if not all_setups:
        logger.info("No setups detected")
        return
    
    # Insert setups into database
    conn = get_connection()
    inserted = 0
    
    with conn.cursor() as cur:
        for setup in all_setups:
            try:
                cur.execute("""
                    INSERT INTO setup_signals (
                        asset_id, setup_name, signal_date, entry_price, stop_loss, target_price,
                        risk_reward, setup_strength, entry_params, exit_params, context,
                        created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (asset_id, setup_name, signal_date) DO UPDATE SET
                        entry_price = EXCLUDED.entry_price,
                        stop_loss = EXCLUDED.stop_loss,
                        target_price = EXCLUDED.target_price,
                        risk_reward = EXCLUDED.risk_reward,
                        setup_strength = EXCLUDED.setup_strength,
                        entry_params = EXCLUDED.entry_params,
                        exit_params = EXCLUDED.exit_params,
                        context = EXCLUDED.context
                """, (
                    setup['asset_id'], setup['setup_name'], setup['signal_date'],
                    setup['entry_price'], setup['stop_loss'], setup['target_price'],
                    setup['risk_reward'], setup['setup_strength'],
                    str(setup['entry_params']), str(setup['exit_params']), str(setup['context'])
                ))
                inserted += 1
            except Exception as e:
                logger.warning(f"Error inserting setup: {e}")
    
    conn.commit()
    logger.info("=" * 60)
    logger.info(f"✅ Inserted/updated {inserted} ETF setups")
    
    # Summary by setup type
    setup_counts = {}
    for setup in all_setups:
        name = setup['setup_name']
        setup_counts[name] = setup_counts.get(name, 0) + 1
    
    logger.info("Setup breakdown:")
    for name, count in sorted(setup_counts.items()):
        logger.info(f"  - {name}: {count}")
    logger.info("=" * 60)


if __name__ == '__main__':
    main()

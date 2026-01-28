#!/usr/bin/env python3
"""
ETF Daily Setup Scanner
=======================
Scans ETFs for trading setups based on technical features.
Runs after ETF features are calculated.

Usage:
    python jobs/etf_setup_scanner.py --date 2026-01-27
    python jobs/etf_setup_scanner.py  # defaults to latest date with features

Environment Variables:
    DATABASE_URL: PostgreSQL connection string
"""

import os
import sys
import argparse
import logging
from datetime import datetime, date
from decimal import Decimal

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


def get_connection():
    """Get database connection."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg2.connect(database_url)


def get_etfs_with_features(target_date: str) -> list:
    """Get all ETFs with features for target date."""
    conn = get_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                df.asset_id,
                a.symbol,
                df.close,
                df.rsi_14,
                df.ma_dist_50,
                df.ma_dist_200,
                df.trend_regime,
                df.above_ma200,
                df.ma50_above_ma200,
                df.bb_width,
                df.rvol_20,
                df.return_21d,
                df.macd_histogram,
                df.atr_pct
            FROM daily_features df
            JOIN assets a ON df.asset_id = a.asset_id
            WHERE df.date = %s
              AND a.asset_type = 'etf'
              AND a.is_active = true
        """, (target_date,))
        return cur.fetchall()


def scan_setups(etf: dict) -> list:
    """Scan a single ETF for trading setups."""
    setups = []
    
    # Setup 1: Trend Pullback to 50MA
    # Entry: Price near 50MA (-4% to +3%), RSI < 55, in uptrend
    ma_dist_50 = etf.get('ma_dist_50')
    rsi_14 = etf.get('rsi_14')
    trend_regime = etf.get('trend_regime')
    above_ma200 = etf.get('above_ma200')
    
    if (ma_dist_50 is not None and rsi_14 is not None and 
        -0.04 <= ma_dist_50 <= 0.03 and 
        rsi_14 < 55 and 
        above_ma200):
        
        entry_price = etf['close']
        stop_loss = entry_price * 0.97  # 3% stop
        target_price = entry_price * 1.12  # 12% target
        risk = entry_price - stop_loss
        reward = target_price - entry_price
        risk_reward = reward / risk if risk > 0 else 0
        
        setups.append({
            'asset_id': etf['asset_id'],
            'setup_name': 'trend_pullback_50ma',
            'signal_date': None,  # Will be set by caller
            'entry_price': entry_price,
            'stop_loss': stop_loss,
            'target_price': target_price,
            'risk_reward': risk_reward,
            'setup_strength': min(100, int(50 + (55 - rsi_14))),  # Higher strength if more oversold
            'entry_params': {'rsi': rsi_14, 'ma_dist_50': ma_dist_50},
            'exit_params': {'target_pct': 0.12, 'stop_pct': 0.03},
            'context': {'trend_regime': trend_regime, 'above_ma200': above_ma200}
        })
    
    # Setup 2: RSI Oversold Bounce
    # Entry: RSI < 35, starting to turn up
    if rsi_14 is not None and rsi_14 < 35:
        entry_price = etf['close']
        stop_loss = entry_price * 0.95  # 5% stop
        target_price = entry_price * 1.08  # 8% target
        risk = entry_price - stop_loss
        reward = target_price - entry_price
        risk_reward = reward / risk if risk > 0 else 0
        
        setups.append({
            'asset_id': etf['asset_id'],
            'setup_name': 'oversold_bounce',
            'signal_date': None,
            'entry_price': entry_price,
            'stop_loss': stop_loss,
            'target_price': target_price,
            'risk_reward': risk_reward,
            'setup_strength': min(100, int(100 - rsi_14)),  # Stronger if more oversold
            'entry_params': {'rsi': rsi_14},
            'exit_params': {'target_pct': 0.08, 'stop_pct': 0.05},
            'context': {'rsi': rsi_14}
        })
    
    # Setup 3: Breakout Confirmed
    # Entry: Price near highs, high volume, MACD positive
    macd_histogram = etf.get('macd_histogram')
    rvol_20 = etf.get('rvol_20')
    
    if (ma_dist_50 is not None and macd_histogram is not None and rvol_20 is not None and
        ma_dist_50 > 0.05 and  # Above 50MA by 5%+
        macd_histogram > 0 and  # MACD positive
        rvol_20 > 1.2):  # Above average volume
        
        entry_price = etf['close']
        stop_loss = entry_price * 0.95
        target_price = entry_price * 1.15
        risk = entry_price - stop_loss
        reward = target_price - entry_price
        risk_reward = reward / risk if risk > 0 else 0
        
        setups.append({
            'asset_id': etf['asset_id'],
            'setup_name': 'breakout_confirmed',
            'signal_date': None,
            'entry_price': entry_price,
            'stop_loss': stop_loss,
            'target_price': target_price,
            'risk_reward': risk_reward,
            'setup_strength': min(100, int(60 + rvol_20 * 10)),  # Stronger with more volume
            'entry_params': {'ma_dist_50': ma_dist_50, 'rvol': rvol_20},
            'exit_params': {'target_pct': 0.15, 'stop_pct': 0.05},
            'context': {'macd_histogram': macd_histogram, 'rvol_20': rvol_20}
        })
    
    return setups


def main():
    parser = argparse.ArgumentParser(description='ETF Setup Scanner')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD)')
    args = parser.parse_args()
    
    if args.date:
        target_date = args.date
    else:
        # Default to latest date with ETF features
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT MAX(date) FROM daily_features WHERE asset_id IN (SELECT asset_id FROM assets WHERE asset_type = 'etf')")
            result = cur.fetchone()
            target_date = result[0].isoformat() if result and result[0] else date.today().isoformat()
    
    logger.info("=" * 60)
    logger.info("ETF SETUP SCANNER")
    logger.info(f"Target Date: {target_date}")
    logger.info("=" * 60)
    
    # Get ETFs with features
    etfs = get_etfs_with_features(target_date)
    logger.info(f"Found {len(etfs)} ETFs with features")
    
    if not etfs:
        logger.warning("No ETFs found - run ETF features first")
        return
    
    # Scan for setups
    all_setups = []
    for etf in etfs:
        setups = scan_setups(etf)
        for setup in setups:
            setup['signal_date'] = target_date
            all_setups.append(setup)
    
    logger.info(f"Found {len(all_setups)} setups across {len(etfs)} ETFs")
    
    if not all_setups:
        logger.info("No setups detected")
        return
    
    # Insert setups into database
    conn = get_connection()
    with conn.cursor() as cur:
        for setup in all_setups:
            cur.execute("""
                INSERT INTO setup_signals (
                    asset_id, setup_name, signal_date, entry_price, stop_loss, target_price,
                    risk_reward, setup_strength, entry_params, exit_params, context
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (asset_id, setup_name, signal_date) DO UPDATE SET
                    entry_price = EXCLUDED.entry_price,
                    stop_loss = EXCLUDED.stop_loss,
                    target_price = EXCLUDED.target_price,
                    risk_reward = EXCLUDED.risk_reward,
                    setup_strength = EXCLUDED.setup_strength
            """, (
                setup['asset_id'], setup['setup_name'], setup['signal_date'],
                setup['entry_price'], setup['stop_loss'], setup['target_price'],
                setup['risk_reward'], setup['setup_strength'],
                str(setup['entry_params']), str(setup['exit_params']), str(setup['context'])
            ))
    
    conn.commit()
    logger.info(f"✅ Inserted/updated {len(all_setups)} setups")
    
    # Summary by setup type
    setup_counts = {}
    for setup in all_setups:
        name = setup['setup_name']
        setup_counts[name] = setup_counts.get(name, 0) + 1
    
    logger.info("Setup breakdown:")
    for name, count in setup_counts.items():
        logger.info(f"  - {name}: {count}")


if __name__ == '__main__':
    main()

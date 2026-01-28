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
# Same 11 setups as equities, but tuned for ETF characteristics
# ETFs are less volatile and trend more smoothly, so parameters are loosened

SETUPS = {
    # Position Trading Setups (60-252 day holds)
    'weinstein_stage2': {
        'description': 'Weinstein Stage 2 Transition - breakout from long base',
        'style': 'position',
        'historical_profit_factor': 4.09,
        'historical_win_rate': 0.61,
        'historical_avg_return': 0.0845,
        'entry': {
            'base_days': 100,
            'base_range_pct': 0.15,
            'volume_mult': 1.3  # Slightly lower volume req for ETFs
        },
        'exit': {
            'breakdown_ma_dist_200': -0.03,
            'trailing_activation_pct': 0.20,
            'trailing_atr_mult': 3.5,
            'max_hold_days': 252
        }
    },
    'donchian_55_breakout': {
        'description': 'Donchian 55-Day Breakout (Turtle Traders)',
        'style': 'position',
        'historical_profit_factor': 1.99,
        'historical_win_rate': 0.508,
        'historical_avg_return': 0.0532,
        'entry': {
            'lookback_days': 55,
            'ma_slope_threshold': 0
        },
        'exit': {
            'trailing_low_days': 20,
            'max_hold_days': 120
        }
    },
    'rs_breakout': {
        'description': 'Relative Strength Breakout',
        'style': 'position',
        'historical_profit_factor': 2.03,
        'historical_win_rate': 0.493,
        'historical_avg_return': 0.0381,
        'entry': {
            'rsi_min': 50,
            'rsi_max': 75
        },
        'exit': {
            'breakdown_ma_dist_50': -0.04,
            'trailing_activation_pct': 0.15,
            'trailing_atr_mult': 3.0,
            'max_hold_days': 90
        }
    },
    'trend_pullback_50ma': {
        'description': 'Trend Pullback to 50MA',
        'style': 'position',
        'historical_profit_factor': 1.97,
        'historical_win_rate': 0.509,
        'historical_avg_return': 0.0444,
        'entry': {
            'ma_dist_50_min': -0.04,
            'ma_dist_50_max': 0.03,
            'rsi_max': 55
        },
        'exit': {
            'breakdown_ma_dist_200': -0.02,
            'trailing_activation_pct': 0.12,
            'trailing_atr_mult': 3.5,
            'max_hold_days': 120
        }
    },
    'adx_holy_grail': {
        'description': 'ADX Holy Grail Pullback',
        'style': 'position',
        'historical_profit_factor': 1.71,
        'historical_win_rate': 0.498,
        'historical_avg_return': 0.0279,
        'entry': {
            'adx_threshold': 25,
            'ma_touch_dist': 0.03
        },
        'exit': {
            'breakdown_ma_dist_50': -0.05,
            'trailing_activation_pct': 0.10,
            'trailing_atr_mult': 3.0,
            'max_hold_days': 90
        }
    },
    
    # Swing Trading Setups (10-20 day holds)
    'vcp_squeeze': {
        'description': 'Volatility Contraction Pattern (VCP)',
        'style': 'swing',
        'historical_profit_factor': 1.65,
        'historical_win_rate': 0.512,
        'historical_avg_return': 0.0321,
        'entry': {
            'contraction_phases': 2,
            'volatility_contraction': 0.5,
            'volume_dry_up': 0.7
        },
        'exit': {
            'breakdown_low_days': 5,
            'max_hold_days': 20
        }
    },
    'rsi_mean_reversion': {
        'description': 'RSI Mean Reversion (Oversold Bounce)',
        'style': 'swing',
        'historical_profit_factor': 1.45,
        'historical_win_rate': 0.534,
        'historical_avg_return': 0.0218,
        'entry': {
            'rsi_max': 35,  # Slightly higher threshold for ETFs
            'above_ma200': True  # Only in uptrend
        },
        'exit': {
            'target_rsi': 55,
            'stop_atr_mult': 2.0,
            'max_hold_days': 10
        }
    },
    'bollinger_squeeze': {
        'description': 'Bollinger Band Squeeze Breakout',
        'style': 'swing',
        'historical_profit_factor': 1.58,
        'historical_win_rate': 0.487,
        'historical_avg_return': 0.0284,
        'entry': {
            'bb_width_threshold': 0.05,
            'volume_mult': 1.3  # Lower for ETFs
        },
        'exit': {
            'target_bb_band': 'upper',
            'stop_atr_mult': 2.0,
            'max_hold_days': 15
        }
    },
    
    # Momentum Setups
    'macd_momentum_shift': {
        'description': 'MACD Momentum Shift',
        'style': 'swing',
        'historical_profit_factor': 1.52,
        'historical_win_rate': 0.498,
        'historical_avg_return': 0.0247,
        'entry': {
            'macd_crossover': True,
            'histogram_turn_positive': True,
            'above_zero_line': True
        },
        'exit': {
            'macd_crossunder': True,
            'max_hold_days': 20
        }
    },
    
    # Reversal Setups
    'volume_climax_reversal': {
        'description': 'Volume Climax Reversal',
        'style': 'swing',
        'historical_profit_factor': 1.38,
        'historical_win_rate': 0.476,
        'historical_avg_return': 0.0198,
        'entry': {
            'rvol_min': 2.0,
            'price_range_pct': 0.03,
            'close_near_high': True
        },
        'exit': {
            'volume_normalization': True,
            'max_hold_days': 5
        }
    },
    'morning_star_hammer': {
        'description': 'Morning Star / Hammer Pattern',
        'style': 'swing',
        'historical_profit_factor': 1.42,
        'historical_win_rate': 0.489,
        'historical_avg_return': 0.0223,
        'entry': {
            'downtrend_days': 5,
            'body_size_ratio': 0.3,
            'lower_shadow_ratio': 2.0
        },
        'exit': {
            'confirmation_close': True,
            'max_hold_days': 10
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
    
    # Check each entry condition based on setup type
    for key, value in entry.items():
        if key == 'ma_dist_50_min':
            if etf.get('ma_dist_50') is None or etf['ma_dist_50'] < value:
                return None
        elif key == 'ma_dist_50_max':
            if etf.get('ma_dist_50') is None or etf['ma_dist_50'] > value:
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
        elif key == 'bb_width_threshold':
            if etf.get('bb_width') is None or etf['bb_width'] > value:
                return None
        elif key == 'volume_mult':
            if etf.get('rvol_20') is None or etf['rvol_20'] < value:
                return None
        elif key == 'adx_threshold':
            # Skip ADX check if not in features (can add later)
            pass
        elif key == 'macd_crossover':
            # Check if MACD histogram turned positive (simplified)
            if etf.get('macd_histogram') is None or etf['macd_histogram'] <= 0:
                return None
    
    # Calculate entry/stop/target based on setup style
    entry_price = etf['close']
    atr_pct = etf.get('atr_pct', 2.0) or 2.0
    
    if setup_config['style'] == 'position':
        # Position trades: wider stops, bigger targets
        stop_loss = entry_price * (1 - atr_pct / 100 * 3)  # 3x ATR
        target_price = entry_price * (1 + atr_pct / 100 * 5)  # 5x ATR
    else:
        # Swing trades: tighter stops
        stop_loss = entry_price * (1 - atr_pct / 100 * 2)  # 2x ATR
        target_price = entry_price * (1 + atr_pct / 100 * 3)  # 3x ATR
    
    # Ensure reasonable stop/target distances
    stop_loss = max(stop_loss, entry_price * 0.92)  # Max 8% stop
    target_price = min(target_price, entry_price * 1.20)  # Max 20% target
    
    # Calculate risk:reward
    risk = entry_price - stop_loss
    reward = target_price - entry_price
    risk_reward = reward / risk if risk > 0 else 0
    
    # Calculate setup strength (0-100)
    strength = 50  # Base
    
    # RSI contribution
    if etf.get('rsi_14') is not None:
        rsi = etf['rsi_14']
        if setup_name == 'rsi_mean_reversion':
            strength += min(30, int(40 - rsi))  # More oversold = stronger
        elif setup_name in ['weinstein_stage2', 'rs_breakout']:
            strength += min(15, int((rsi - 50) / 2))  # Higher RSI for breakouts
        else:
            strength += min(15, int(15 - abs(rsi - 50) / 5))  # Neutral RSI bonus
    
    # Volume contribution
    if etf.get('rvol_20') is not None:
        rvol = etf['rvol_20']
        if rvol > 1.5:
            strength += min(15, int((rvol - 1) * 10))
    
    # Trend alignment bonus
    if etf.get('ma50_above_ma200'):
        strength += 10
    if etf.get('above_ma200'):
        strength += 5
    
    # Setup-specific bonuses
    if setup_name == 'weinstein_stage2' and etf.get('ma_dist_50', 0) > 0.05:
        strength += 10  # Strong trend
    
    if setup_name == 'trend_pullback_50ma' and etf.get('ma_dist_50', 0) < -0.02:
        strength += 10  # Good pullback depth
    
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
            'ma_dist_200': etf.get('ma_dist_200'),
            'trend_regime': etf.get('trend_regime'),
            'rvol': etf.get('rvol_20'),
            'bb_width': etf.get('bb_width'),
            'macd_histogram': etf.get('macd_histogram')
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

#!/usr/bin/env python3
"""
Daily Setup Scanner

Scans all assets for setup signals based on optimized parameters.
Runs after daily features are calculated.

Usage:
    python scripts/daily_setup_scanner.py --date 2026-01-25
    python scripts/daily_setup_scanner.py  # defaults to latest date with features
"""

import os
import sys
import argparse
import logging
import json
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

# Database URL
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:stratosbrainpostgresdbpw@db.wfogbaipiqootjrsprde.supabase.co:5432/postgres"
)

# Thread-local storage for connections
thread_local = threading.local()


def get_connection():
    """Get thread-local database connection."""
    if not hasattr(thread_local, 'conn') or thread_local.conn.closed:
        thread_local.conn = psycopg2.connect(DATABASE_URL)
        thread_local.conn.autocommit = True
    return thread_local.conn


# =============================================================================
# OPTIMIZED SETUP DEFINITIONS
# =============================================================================
# These are the optimized parameters from our backtesting
# historical_profit_factor comes from our optimization results

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
            'volume_mult': 1.5
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
        'historical_profit_factor': 1.69,
        'historical_win_rate': 0.553,
        'historical_avg_return': 0.0169,
        'entry': {
            'bb_width_pctile_max': 25,
            'rsi_min': 35,
            'rsi_max': 75
        },
        'exit': {
            'target_pct': 0.12,
            'stop_atr_mult': 2.0,
            'max_hold_days': 15
        }
    },
    'gap_up_momentum': {
        'description': 'Gap Up Momentum',
        'style': 'swing',
        'historical_profit_factor': 1.58,
        'historical_win_rate': 0.516,
        'historical_avg_return': 0.0187,
        'entry': {
            'gap_pct_min': 0.02,
            'rvol_min': 1.5
        },
        'exit': {
            'breakdown_ma_dist_20': -0.03,
            'max_hold_days': 15
        }
    },
    'oversold_bounce': {
        'description': 'Oversold Bounce',
        'style': 'swing',
        'historical_profit_factor': 1.52,
        'historical_win_rate': 0.656,
        'historical_avg_return': 0.0183,
        'entry': {
            'rsi_max': 35,
            'ma_dist_20_max': -0.06
        },
        'exit': {
            'target_ma_dist_20': 0.01,
            'stop_atr_mult': 2.5,
            'max_hold_days': 20
        }
    },
    'acceleration_turn': {
        'description': 'Acceleration Turn Up',
        'style': 'swing',
        'historical_profit_factor': 1.48,
        'historical_win_rate': 0.629,
        'historical_avg_return': 0.0097,
        'entry': {
            'rsi_min': 25,
            'rsi_max': 65
        },
        'exit': {
            'target_pct': 0.06,
            'stop_atr_mult': 2.5,
            'max_hold_days': 10
        }
    },
    'golden_cross': {
        'description': 'Golden Cross (50MA > 200MA)',
        'style': 'position',
        'historical_profit_factor': 1.53,
        'historical_win_rate': 0.359,
        'historical_avg_return': 0.0202,
        'entry': {
            'ma_dist_50_min': -0.02,
            'ma_dist_50_max': 0.07,
            'rsi_min': 45,
            'rsi_max': 70
        },
        'exit': {
            'breakdown_ma_dist_50': -0.03,
            'trailing_activation_pct': 0.15,
            'trailing_atr_mult': 3.5,
            'max_hold_days': 120
        }
    },
    'breakout_confirmed': {
        'description': 'Confirmed Breakout',
        'style': 'position',
        'historical_profit_factor': 1.45,
        'historical_win_rate': 0.489,
        'historical_avg_return': 0.0222,
        'entry': {
            'rvol_threshold': 1.2,
            'rsi_min': 50,
            'rsi_max': 75
        },
        'exit': {
            'breakdown_ma_dist_20': -0.04,
            'trailing_activation_pct': 0.12,
            'trailing_atr_mult': 2.5,
            'max_hold_days': 90
        }
    }
}


def get_latest_feature_date() -> str:
    """Get the most recent date with features calculated."""
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT MAX(date) FROM daily_features
        """)
        result = cur.fetchone()
        return result[0].strftime('%Y-%m-%d') if result and result[0] else None


def get_features_for_date(target_date: str) -> pd.DataFrame:
    """Fetch all features for a given date."""
    conn = get_connection()
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT df.*, a.symbol, a.asset_type
            FROM daily_features df
            JOIN assets a ON a.asset_id = df.asset_id
            WHERE df.date = %s
        """, (target_date,))
        rows = cur.fetchall()
    
    if not rows:
        return pd.DataFrame()
    
    df = pd.DataFrame(rows)
    
    # Convert numeric columns
    numeric_cols = ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
                    'bb_width', 'bb_width_pctile', 'rvol_20', 'atr_14', 'atr_pct',
                    'gap_pct', 'donchian_high_55', 'donchian_low_20', 'roc_20', 'roc_63']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df


def get_historical_bars(asset_id: int, end_date: str, lookback_days: int = 150) -> pd.DataFrame:
    """Fetch historical bars for calculating additional indicators."""
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
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    return df


def calculate_adx(bars: pd.DataFrame, period: int = 14) -> float:
    """Calculate ADX for the most recent bar."""
    if len(bars) < period + 10:
        return None
    
    df = bars.copy()
    df['tr'] = np.maximum(
        df['high'] - df['low'],
        np.maximum(
            abs(df['high'] - df['close'].shift(1)),
            abs(df['low'] - df['close'].shift(1))
        )
    )
    
    df['plus_dm'] = np.where(
        (df['high'] - df['high'].shift(1)) > (df['low'].shift(1) - df['low']),
        np.maximum(df['high'] - df['high'].shift(1), 0),
        0
    )
    df['minus_dm'] = np.where(
        (df['low'].shift(1) - df['low']) > (df['high'] - df['high'].shift(1)),
        np.maximum(df['low'].shift(1) - df['low'], 0),
        0
    )
    
    df['atr'] = df['tr'].ewm(span=period, adjust=False).mean()
    df['plus_di'] = 100 * (df['plus_dm'].ewm(span=period, adjust=False).mean() / df['atr'])
    df['minus_di'] = 100 * (df['minus_dm'].ewm(span=period, adjust=False).mean() / df['atr'])
    
    df['dx'] = 100 * abs(df['plus_di'] - df['minus_di']) / (df['plus_di'] + df['minus_di'])
    df['adx'] = df['dx'].ewm(span=period, adjust=False).mean()
    
    return df['adx'].iloc[-1] if not pd.isna(df['adx'].iloc[-1]) else None


def calculate_base_range(bars: pd.DataFrame, base_days: int) -> float:
    """Calculate the price range over the base period as a percentage."""
    if len(bars) < base_days:
        return None
    
    recent = bars.tail(base_days)
    high = recent['high'].max()
    low = recent['low'].min()
    
    if low == 0:
        return None
    
    return (high - low) / low


# =============================================================================
# SETUP CHECKER FUNCTIONS
# =============================================================================
# Each function returns a dict with 'context' if the setup is detected, or None

def check_weinstein_stage2(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Weinstein Stage 2 criteria."""
    entry = params['entry']
    
    # Need enough historical data
    if len(bars) < entry['base_days']:
        return None
    
    # Calculate base range
    base_range = calculate_base_range(bars, entry['base_days'])
    if base_range is None or base_range > entry['base_range_pct']:
        return None
    
    # Check for breakout above base high
    base_high = bars.tail(entry['base_days'])['high'].max()
    current_close = float(row['close']) if row['close'] else None
    if current_close is None or current_close <= base_high:
        return None
    
    # Check volume confirmation
    rvol = float(row['rvol_20']) if row['rvol_20'] else 0
    if rvol < entry['volume_mult']:
        return None
    
    # Check MA200 is rising or flat
    ma_slope_200 = float(row['ma_slope_200']) if row['ma_slope_200'] else 0
    if ma_slope_200 < -0.5:  # Allow slightly negative
        return None
    
    return {
        'context': {
            'base_days': entry['base_days'],
            'base_range_pct': round(base_range * 100, 2),
            'base_high': round(base_high, 2),
            'rvol': round(rvol, 2),
            'ma_slope_200': round(ma_slope_200, 2)
        }
    }


def check_donchian_55_breakout(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Donchian 55-day breakout criteria."""
    # Check if close is at 55-day high
    donchian_high_55 = float(row['donchian_high_55']) if row['donchian_high_55'] else None
    current_close = float(row['close']) if row['close'] else None
    
    if donchian_high_55 is None or current_close is None:
        return None
    
    # Must be at or above 55-day high
    if current_close < donchian_high_55 * 0.995:  # Allow 0.5% tolerance
        return None
    
    # Get context values
    rvol = float(row['rvol_20']) if row['rvol_20'] else 1
    rsi = float(row['rsi_14']) if row['rsi_14'] else 50
    ma_slope_200 = float(row['ma_slope_200']) if row['ma_slope_200'] else 0
    
    return {
        'context': {
            'donchian_high_55': round(donchian_high_55, 2),
            'rvol': round(rvol, 2),
            'rsi': round(rsi, 1),
            'ma_slope_200': round(ma_slope_200, 2)
        }
    }


def check_rs_breakout(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets RS Breakout criteria."""
    entry = params['entry']
    
    # Check RSI in range
    rsi = float(row['rsi_14']) if row['rsi_14'] else None
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    # Check for RS breakout flag
    rs_breakout = row.get('rs_breakout', False)
    if not rs_breakout:
        return None
    
    # Check above MA200
    above_ma200 = row.get('above_ma200', False)
    if not above_ma200:
        return None
    
    # Get context values
    rs_velocity = float(row.get('rs_velocity', 0)) if row.get('rs_velocity') else 0
    rvol = float(row['rvol_20']) if row['rvol_20'] else 1
    
    return {
        'context': {
            'rsi': round(rsi, 1),
            'rs_velocity': round(rs_velocity, 2),
            'rvol': round(rvol, 2)
        }
    }


def check_trend_pullback_50ma(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Trend Pullback to 50MA criteria."""
    entry = params['entry']
    
    # Check MA distance
    ma_dist_50 = float(row['ma_dist_50']) if row['ma_dist_50'] else None
    if ma_dist_50 is None:
        return None
    
    ma_dist_50_pct = ma_dist_50 / 100  # Convert from percentage
    if ma_dist_50_pct < entry['ma_dist_50_min'] or ma_dist_50_pct > entry['ma_dist_50_max']:
        return None
    
    # Check RSI not overbought
    rsi = float(row['rsi_14']) if row['rsi_14'] else None
    if rsi is None or rsi > entry['rsi_max']:
        return None
    
    # Must be in uptrend (above MA200)
    above_ma200 = row.get('above_ma200', False)
    if not above_ma200:
        return None
    
    # MA50 should be above MA200
    ma50_above_ma200 = row.get('ma50_above_ma200', False)
    if not ma50_above_ma200:
        return None
    
    # Get context values
    ma_slope_50 = float(row['ma_slope_50']) if row['ma_slope_50'] else 0
    
    return {
        'context': {
            'ma_dist_50': round(ma_dist_50, 2),
            'rsi': round(rsi, 1),
            'ma_slope_50': round(ma_slope_50, 2)
        }
    }


def check_adx_holy_grail(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets ADX Holy Grail criteria."""
    entry = params['entry']
    
    # Calculate ADX
    adx = calculate_adx(bars)
    if adx is None or adx < entry['adx_threshold']:
        return None
    
    # Check MA touch distance (close to 20 EMA)
    ma_dist_20 = float(row['ma_dist_20']) if row['ma_dist_20'] else None
    if ma_dist_20 is None:
        return None
    
    ma_dist_20_pct = abs(ma_dist_20 / 100)
    if ma_dist_20_pct > entry['ma_touch_dist']:
        return None
    
    # Must be in uptrend
    above_ma200 = row.get('above_ma200', False)
    if not above_ma200:
        return None
    
    # Get context values
    rvol = float(row['rvol_20']) if row['rvol_20'] else 1
    
    return {
        'context': {
            'adx': round(adx, 1),
            'ma_dist_20': round(ma_dist_20, 2),
            'rvol': round(rvol, 2)
        }
    }


def check_vcp_squeeze(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets VCP Squeeze criteria."""
    entry = params['entry']
    
    # Check BB width percentile
    bb_width_pctile = float(row['bb_width_pctile']) if row['bb_width_pctile'] else None
    if bb_width_pctile is None or bb_width_pctile > entry['bb_width_pctile_max']:
        return None
    
    # Check RSI in range
    rsi = float(row['rsi_14']) if row['rsi_14'] else None
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    # Check squeeze flag
    squeeze_flag = row.get('squeeze_flag', False)
    if not squeeze_flag:
        return None
    
    # Get context values
    rvol = float(row['rvol_20']) if row['rvol_20'] else 1
    
    return {
        'context': {
            'bb_width_pctile': round(bb_width_pctile, 1),
            'rsi': round(rsi, 1),
            'rvol': round(rvol, 2)
        }
    }


def check_gap_up_momentum(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Gap Up Momentum criteria."""
    entry = params['entry']
    
    # Check gap percentage
    gap_pct = float(row['gap_pct']) if row['gap_pct'] else None
    if gap_pct is None or gap_pct < entry['gap_pct_min']:
        return None
    
    # Check relative volume
    rvol = float(row['rvol_20']) if row['rvol_20'] else None
    if rvol is None or rvol < entry['rvol_min']:
        return None
    
    # Get context values
    rsi = float(row['rsi_14']) if row['rsi_14'] else 50
    
    return {
        'context': {
            'gap_pct': round(gap_pct * 100, 2),
            'rvol': round(rvol, 2),
            'rsi': round(rsi, 1)
        }
    }


def check_oversold_bounce(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Oversold Bounce criteria."""
    entry = params['entry']
    
    # Check RSI is oversold
    rsi = float(row['rsi_14']) if row['rsi_14'] else None
    if rsi is None or rsi > entry['rsi_max']:
        return None
    
    # Check MA distance (below 20 MA)
    ma_dist_20 = float(row['ma_dist_20']) if row['ma_dist_20'] else None
    if ma_dist_20 is None:
        return None
    
    ma_dist_20_pct = ma_dist_20 / 100
    if ma_dist_20_pct > entry['ma_dist_20_max']:
        return None
    
    # Get context values
    rvol = float(row['rvol_20']) if row['rvol_20'] else 1
    
    return {
        'context': {
            'rsi': round(rsi, 1),
            'ma_dist_20': round(ma_dist_20, 2),
            'rvol': round(rvol, 2)
        }
    }


def check_acceleration_turn(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Acceleration Turn criteria."""
    entry = params['entry']
    
    # Check for acceleration turn up flag
    accel_turn_up = row.get('accel_turn_up', False)
    if not accel_turn_up:
        return None
    
    # Check RSI in range
    rsi = float(row['rsi_14']) if row['rsi_14'] else None
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    # Get context values
    accel_z = float(row.get('accel_z_20', 0)) if row.get('accel_z_20') else 0
    rvol = float(row['rvol_20']) if row['rvol_20'] else 1
    
    return {
        'context': {
            'accel_z_20': round(accel_z, 2),
            'rsi': round(rsi, 1),
            'rvol': round(rvol, 2)
        }
    }


def check_golden_cross(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Golden Cross criteria."""
    entry = params['entry']
    
    # Check MA50 above MA200
    ma50_above_ma200 = row.get('ma50_above_ma200', False)
    if not ma50_above_ma200:
        return None
    
    # Check MA distance
    ma_dist_50 = float(row['ma_dist_50']) if row['ma_dist_50'] else None
    if ma_dist_50 is None:
        return None
    
    ma_dist_50_pct = ma_dist_50 / 100
    if ma_dist_50_pct < entry['ma_dist_50_min'] or ma_dist_50_pct > entry['ma_dist_50_max']:
        return None
    
    # Check RSI in range
    rsi = float(row['rsi_14']) if row['rsi_14'] else None
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    # Get context values
    ma_slope_50 = float(row['ma_slope_50']) if row['ma_slope_50'] else 0
    ma_slope_200 = float(row['ma_slope_200']) if row['ma_slope_200'] else 0
    
    return {
        'context': {
            'ma_dist_50': round(ma_dist_50, 2),
            'rsi': round(rsi, 1),
            'ma_slope_50': round(ma_slope_50, 2),
            'ma_slope_200': round(ma_slope_200, 2)
        }
    }


def check_breakout_confirmed(row: pd.Series, bars: pd.DataFrame, params: dict) -> dict:
    """Check if asset meets Confirmed Breakout criteria."""
    entry = params['entry']
    
    # Check for breakout confirmed flag
    breakout_confirmed = row.get('breakout_confirmed_up', False)
    if not breakout_confirmed:
        return None
    
    # Check volume
    rvol = float(row['rvol_20']) if row['rvol_20'] else None
    if rvol is None or rvol < entry['rvol_threshold']:
        return None
    
    # Check RSI in range
    rsi = float(row['rsi_14']) if row['rsi_14'] else None
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    # Get context values
    above_ma200 = row.get('above_ma200', False)
    
    return {
        'context': {
            'rvol': round(rvol, 2),
            'rsi': round(rsi, 1),
            'above_ma200': above_ma200
        }
    }


# Map setup names to check functions
SETUP_CHECKERS = {
    'weinstein_stage2': check_weinstein_stage2,
    'donchian_55_breakout': check_donchian_55_breakout,
    'rs_breakout': check_rs_breakout,
    'trend_pullback_50ma': check_trend_pullback_50ma,
    'adx_holy_grail': check_adx_holy_grail,
    'vcp_squeeze': check_vcp_squeeze,
    'gap_up_momentum': check_gap_up_momentum,
    'oversold_bounce': check_oversold_bounce,
    'acceleration_turn': check_acceleration_turn,
    'golden_cross': check_golden_cross,
    'breakout_confirmed': check_breakout_confirmed
}


def calculate_stop_loss(row: pd.Series, setup_params: dict) -> float:
    """Calculate stop loss price based on setup exit parameters."""
    close = float(row['close']) if row['close'] else None
    atr = float(row['atr_14']) if row['atr_14'] else None
    
    if close is None or atr is None:
        return None
    
    exit_params = setup_params['exit']
    
    # Use ATR-based stop if available
    if 'stop_atr_mult' in exit_params:
        return close - (atr * exit_params['stop_atr_mult'])
    elif 'trailing_atr_mult' in exit_params:
        return close - (atr * exit_params['trailing_atr_mult'])
    
    # Default to 2x ATR
    return close - (atr * 2)


def calculate_target(row: pd.Series, setup_params: dict) -> float:
    """Calculate target price based on setup exit parameters."""
    close = float(row['close']) if row['close'] else None
    
    if close is None:
        return None
    
    exit_params = setup_params['exit']
    
    # Use fixed target if available
    if 'target_pct' in exit_params:
        return close * (1 + exit_params['target_pct'])
    elif 'trailing_activation_pct' in exit_params:
        return close * (1 + exit_params['trailing_activation_pct'])
    
    # Default to 15% target
    return close * 1.15


def clean_for_json(obj):
    """Clean values for JSON serialization (handle NaN, Inf)."""
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [clean_for_json(v) for v in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, (np.floating, np.integer)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    return obj


def scan_asset_for_setups(row: pd.Series, bars: pd.DataFrame, target_date: str) -> list:
    """Scan a single asset for all setup signals."""
    signals = []
    
    for setup_name, setup_params in SETUPS.items():
        checker = SETUP_CHECKERS.get(setup_name)
        if not checker:
            continue
        
        try:
            result = checker(row, bars, setup_params)
            
            if result:
                close = float(row['close']) if row['close'] else None
                stop_loss = calculate_stop_loss(row, setup_params)
                target = calculate_target(row, setup_params)
                
                risk_reward = None
                if close and stop_loss and target:
                    risk = close - stop_loss
                    reward = target - close
                    if risk > 0:
                        risk_reward = reward / risk
                
                # Convert numpy types to Python types
                def to_python(val):
                    if val is None:
                        return None
                    if isinstance(val, (np.floating, np.integer)):
                        if np.isnan(val) or np.isinf(val):
                            return None
                        return float(val)
                    return val
                
                signal = {
                    'asset_id': int(row['asset_id']),
                    'setup_name': setup_name,
                    'signal_date': target_date,
                    'entry_price': to_python(close),
                    'stop_loss': to_python(stop_loss),
                    'target_price': to_python(target),
                    'risk_reward': to_python(risk_reward),
                    'historical_profit_factor': setup_params.get('historical_profit_factor'),
                    'entry_params': json.dumps(clean_for_json(setup_params['entry'])),
                    'exit_params': json.dumps(clean_for_json(setup_params['exit'])),
                    'context': json.dumps(clean_for_json(result['context']))
                }
                signals.append(signal)
                
        except Exception as e:
            logger.warning(f"Error checking {setup_name} for asset {row['asset_id']}: {e}")
    
    return signals


def write_signals_batch(signals: list) -> int:
    """Write signals to database with upsert."""
    if not signals:
        return 0
    
    conn = get_connection()
    
    query = """
        INSERT INTO setup_signals 
        (asset_id, setup_name, signal_date, entry_price, stop_loss, target_price, 
         risk_reward, historical_profit_factor, entry_params, exit_params, context)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (asset_id, setup_name, signal_date) 
        DO UPDATE SET
            entry_price = EXCLUDED.entry_price,
            stop_loss = EXCLUDED.stop_loss,
            target_price = EXCLUDED.target_price,
            risk_reward = EXCLUDED.risk_reward,
            historical_profit_factor = EXCLUDED.historical_profit_factor,
            entry_params = EXCLUDED.entry_params,
            exit_params = EXCLUDED.exit_params,
            context = EXCLUDED.context
    """
    
    with conn.cursor() as cur:
        for signal in signals:
            cur.execute(query, (
                signal['asset_id'],
                signal['setup_name'],
                signal['signal_date'],
                signal['entry_price'],
                signal['stop_loss'],
                signal['target_price'],
                signal['risk_reward'],
                signal['historical_profit_factor'],
                signal['entry_params'],
                signal['exit_params'],
                signal['context']
            ))
    
    return len(signals)


def main():
    parser = argparse.ArgumentParser(description='Daily Setup Scanner')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD). Defaults to latest.')
    parser.add_argument('--workers', type=int, default=8, help='Number of parallel workers')
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("DAILY SETUP SCANNER")
    logger.info("=" * 60)
    
    # Determine target date
    if args.date:
        target_date = args.date
    else:
        target_date = get_latest_feature_date()
        if not target_date:
            logger.error("No features found in database")
            sys.exit(1)
    
    logger.info(f"Target date: {target_date}")
    
    # Get features for all assets
    logger.info("Loading features...")
    features_df = get_features_for_date(target_date)
    
    if features_df.empty:
        logger.error(f"No features found for date {target_date}")
        sys.exit(1)
    
    logger.info(f"Loaded features for {len(features_df)} assets")
    
    # Scan each asset for setups
    all_signals = []
    processed = 0
    
    def process_asset(row):
        asset_id = int(row['asset_id'])
        bars = get_historical_bars(asset_id, target_date)
        return scan_asset_for_setups(row, bars, target_date)
    
    logger.info(f"Scanning assets with {args.workers} workers...")
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_asset, row): idx 
                   for idx, row in features_df.iterrows()}
        
        for future in as_completed(futures):
            try:
                signals = future.result()
                if signals:
                    all_signals.extend(signals)
            except Exception as e:
                logger.warning(f"Error processing asset: {e}")
            
            processed += 1
            if processed % 100 == 0:
                logger.info(f"Processed {processed}/{len(features_df)} assets, found {len(all_signals)} signals")
    
    logger.info(f"Scan complete. Found {len(all_signals)} total signals")
    
    # Write signals to database
    if all_signals:
        logger.info("Writing signals to database...")
        written = write_signals_batch(all_signals)
        logger.info(f"Wrote {written} signals to database")
    
    # Summary by setup
    logger.info("")
    logger.info("Signal counts by setup:")
    setup_counts = {}
    for signal in all_signals:
        setup_name = signal['setup_name']
        setup_counts[setup_name] = setup_counts.get(setup_name, 0) + 1
    
    for setup_name, count in sorted(setup_counts.items(), key=lambda x: -x[1]):
        pf = SETUPS[setup_name].get('historical_profit_factor', 0)
        logger.info(f"  {setup_name}: {count} signals (Historical PF: {pf})")
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("SCAN COMPLETE")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

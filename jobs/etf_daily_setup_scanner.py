#!/usr/bin/env python3
"""
ETF/Index/Commodity Daily Setup Scanner
=======================================
Scans ETFs, Indices, and Commodities for trading setups based on optimized parameters.
Aligned with crypto/equity setup scanner - uses same 11 setups.

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
import json
from datetime import datetime, date, timedelta
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

# Asset types to process
ASSET_TYPES = ('etf', 'index', 'commodity')


def get_connection():
    """Get thread-local database connection."""
    if not hasattr(thread_local, 'conn') or thread_local.conn.closed:
        thread_local.conn = psycopg2.connect(DATABASE_URL)
        thread_local.conn.autocommit = True
    return thread_local.conn


# ETF/Index/Commodity setup definitions - aligned with crypto/equity scanner
# Same 11 setups with optimized parameters

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
            'volume_mult': 1.3  # Lower volume req for ETFs
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
            'rvol_threshold': 1.2,  # Lower for ETFs
            'rsi_min': 50,
            'rsi_max': 75
        },
        'exit': {
            'breakdown_ma_dist_20': -0.04,
            'trailing_activation_pct': 0.12,
            'trailing_atr_mult': 2.5,
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
            'rvol_min': 1.5  # Lower for ETFs
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
    }
}


def get_assets_with_features(target_date: str) -> list:
    """Get all ETF/Index/Commodity assets with features for target date."""
    conn = get_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                df.asset_id,
                a.symbol,
                a.name,
                a.asset_type,
                df.close,
                df.open,
                df.high,
                df.low,
                df.rsi_14,
                df.ma_dist_20,
                df.ma_dist_50,
                df.ma_dist_200,
                df.trend_regime,
                df.above_ma200,
                df.ma50_above_ma200,
                df.bb_width,
                df.bb_width_pctile,
                df.rvol_20,
                df.return_21d,
                df.gap_pct,
                df.donchian_high_55,
                df.donchian_low_20,
                df.roc_20,
                df.roc_63,
                df.macd_histogram,
                df.atr_14,
                df.atr_pct,
                df.ma_slope_20,
                df.ma_slope_50,
                df.ma_slope_200,
                df.accel_turn_up,
                df.squeeze_flag,
                df.breakout_confirmed_up
            FROM daily_features df
            JOIN assets a ON df.asset_id = a.asset_id
            WHERE df.date = %s
              AND a.asset_type = ANY(%s)
              AND a.is_active = true
        """, (target_date, list(ASSET_TYPES)))
        return cur.fetchall()


def get_historical_bars(asset_id: int, end_date: str, lookback_days: int = 150) -> pd.DataFrame:
    """Fetch historical bars for calculating additional indicators (e.g., ADX)."""
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


def check_weinstein_stage2(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Weinstein Stage 2 criteria."""
    entry = params['entry']
    
    if len(bars) < entry['base_days']:
        return None
    
    base_range = calculate_base_range(bars, entry['base_days'])
    if base_range is None or base_range > entry['base_range_pct']:
        return None
    
    base_high = bars.tail(entry['base_days'])['high'].max()
    current_close = etf.get('close')
    if current_close is None or current_close <= base_high:
        return None
    
    rvol = etf.get('rvol_20', 0) or 0
    if rvol < entry['volume_mult']:
        return None
    
    ma_slope_200 = etf.get('ma_slope_200', 0) or 0
    if ma_slope_200 < -0.5:
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


def check_donchian_55_breakout(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Donchian 55-day breakout criteria."""
    donchian_high_55 = etf.get('donchian_high_55')
    current_close = etf.get('close')
    
    if donchian_high_55 is None or current_close is None:
        return None
    
    if current_close < donchian_high_55 * 0.995:
        return None
    
    rvol = etf.get('rvol_20', 1) or 1
    rsi = etf.get('rsi_14', 50) or 50
    ma_slope_200 = etf.get('ma_slope_200', 0) or 0
    
    return {
        'context': {
            'donchian_high_55': round(donchian_high_55, 2),
            'rvol': round(rvol, 2),
            'rsi': round(rsi, 1),
            'ma_slope_200': round(ma_slope_200, 2)
        }
    }


def check_rs_breakout(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets RS Breakout criteria."""
    entry = params['entry']
    
    rsi = etf.get('rsi_14')
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    rs_breakout = etf.get('rs_breakout', False)
    if not rs_breakout:
        return None
    
    above_ma200 = etf.get('above_ma200', False)
    if not above_ma200:
        return None
    
    rs_velocity = etf.get('rs_velocity', 0) or 0
    rvol = etf.get('rvol_20', 1) or 1
    
    return {
        'context': {
            'rsi': round(rsi, 1),
            'rs_velocity': round(rs_velocity, 2),
            'rvol': round(rvol, 2)
        }
    }


def check_trend_pullback_50ma(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Trend Pullback to 50MA criteria."""
    entry = params['entry']
    
    ma_dist_50 = etf.get('ma_dist_50')
    if ma_dist_50 is None:
        return None
    
    ma_dist_50_pct = ma_dist_50 / 100
    if ma_dist_50_pct < entry['ma_dist_50_min'] or ma_dist_50_pct > entry['ma_dist_50_max']:
        return None
    
    rsi = etf.get('rsi_14')
    if rsi is None or rsi > entry['rsi_max']:
        return None
    
    above_ma200 = etf.get('above_ma200', False)
    if not above_ma200:
        return None
    
    ma50_above_ma200 = etf.get('ma50_above_ma200', False)
    if not ma50_above_ma200:
        return None
    
    ma_slope_50 = etf.get('ma_slope_50', 0) or 0
    
    return {
        'context': {
            'ma_dist_50': round(ma_dist_50, 2),
            'rsi': round(rsi, 1),
            'ma_slope_50': round(ma_slope_50, 2)
        }
    }


def check_adx_holy_grail(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets ADX Holy Grail criteria."""
    entry = params['entry']
    
    adx = calculate_adx(bars)
    if adx is None or adx < entry['adx_threshold']:
        return None
    
    ma_dist_20 = etf.get('ma_dist_20')
    if ma_dist_20 is None:
        return None
    
    ma_dist_20_pct = abs(ma_dist_20 / 100)
    if ma_dist_20_pct > entry['ma_touch_dist']:
        return None
    
    above_ma200 = etf.get('above_ma200', False)
    if not above_ma200:
        return None
    
    rvol = etf.get('rvol_20', 1) or 1
    
    return {
        'context': {
            'adx': round(adx, 1),
            'ma_dist_20': round(ma_dist_20, 2),
            'rvol': round(rvol, 2)
        }
    }


def check_golden_cross(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Golden Cross criteria."""
    entry = params['entry']
    
    ma50_above_ma200 = etf.get('ma50_above_ma200', False)
    if not ma50_above_ma200:
        return None
    
    ma_dist_50 = etf.get('ma_dist_50')
    if ma_dist_50 is None:
        return None
    
    ma_dist_50_pct = ma_dist_50 / 100
    if ma_dist_50_pct < entry['ma_dist_50_min'] or ma_dist_50_pct > entry['ma_dist_50_max']:
        return None
    
    rsi = etf.get('rsi_14')
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    ma_slope_50 = etf.get('ma_slope_50', 0) or 0
    ma_slope_200 = etf.get('ma_slope_200', 0) or 0
    
    return {
        'context': {
            'ma_dist_50': round(ma_dist_50, 2),
            'rsi': round(rsi, 1),
            'ma_slope_50': round(ma_slope_50, 2),
            'ma_slope_200': round(ma_slope_200, 2)
        }
    }


def check_breakout_confirmed(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Confirmed Breakout criteria."""
    entry = params['entry']
    
    breakout_confirmed = etf.get('breakout_confirmed_up', False)
    if not breakout_confirmed:
        return None
    
    rvol = etf.get('rvol_20')
    if rvol is None or rvol < entry['rvol_threshold']:
        return None
    
    rsi = etf.get('rsi_14')
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    above_ma200 = etf.get('above_ma200', False)
    
    return {
        'context': {
            'rvol': round(rvol, 2),
            'rsi': round(rsi, 1),
            'above_ma200': above_ma200
        }
    }


def check_vcp_squeeze(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets VCP Squeeze criteria."""
    entry = params['entry']
    
    bb_width_pctile = etf.get('bb_width_pctile')
    if bb_width_pctile is None or bb_width_pctile > entry['bb_width_pctile_max']:
        return None
    
    rsi = etf.get('rsi_14')
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    squeeze_flag = etf.get('squeeze_flag', False)
    if not squeeze_flag:
        return None
    
    rvol = etf.get('rvol_20', 1) or 1
    
    return {
        'context': {
            'bb_width_pctile': round(bb_width_pctile, 1),
            'rsi': round(rsi, 1),
            'rvol': round(rvol, 2)
        }
    }


def check_gap_up_momentum(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Gap Up Momentum criteria."""
    entry = params['entry']
    
    gap_pct = etf.get('gap_pct')
    if gap_pct is None or gap_pct < entry['gap_pct_min']:
        return None
    
    rvol = etf.get('rvol_20')
    if rvol is None or rvol < entry['rvol_min']:
        return None
    
    rsi = etf.get('rsi_14', 50) or 50
    
    return {
        'context': {
            'gap_pct': round(gap_pct * 100, 2),
            'rvol': round(rvol, 2),
            'rsi': round(rsi, 1)
        }
    }


def check_oversold_bounce(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Oversold Bounce criteria."""
    entry = params['entry']
    
    rsi = etf.get('rsi_14')
    if rsi is None or rsi > entry['rsi_max']:
        return None
    
    ma_dist_20 = etf.get('ma_dist_20')
    if ma_dist_20 is None:
        return None
    
    ma_dist_20_pct = ma_dist_20 / 100
    if ma_dist_20_pct > entry['ma_dist_20_max']:
        return None
    
    rvol = etf.get('rvol_20', 1) or 1
    
    return {
        'context': {
            'rsi': round(rsi, 1),
            'ma_dist_20': round(ma_dist_20, 2),
            'rvol': round(rvol, 2)
        }
    }


def check_acceleration_turn(etf: dict, bars: pd.DataFrame, params: dict) -> dict:
    """Check if ETF meets Acceleration Turn criteria."""
    entry = params['entry']
    
    accel_turn_up = etf.get('accel_turn_up', False)
    if not accel_turn_up:
        return None
    
    rsi = etf.get('rsi_14')
    if rsi is None or rsi < entry['rsi_min'] or rsi > entry['rsi_max']:
        return None
    
    accel_z = etf.get('accel_z_20', 0) or 0
    rvol = etf.get('rvol_20', 1) or 1
    
    return {
        'context': {
            'accel_z_20': round(accel_z, 2),
            'rsi': round(rsi, 1),
            'rvol': round(rvol, 2)
        }
    }


# Map setup names to check functions
SETUP_CHECKERS = {
    'weinstein_stage2': check_weinstein_stage2,
    'donchian_55_breakout': check_donchian_55_breakout,
    'rs_breakout': check_rs_breakout,
    'trend_pullback_50ma': check_trend_pullback_50ma,
    'adx_holy_grail': check_adx_holy_grail,
    'golden_cross': check_golden_cross,
    'breakout_confirmed': check_breakout_confirmed,
    'vcp_squeeze': check_vcp_squeeze,
    'gap_up_momentum': check_gap_up_momentum,
    'oversold_bounce': check_oversold_bounce,
    'acceleration_turn': check_acceleration_turn
}


def calculate_stop_loss(etf: dict, setup_params: dict) -> float:
    """Calculate stop loss price based on setup exit parameters."""
    close = etf.get('close')
    atr = etf.get('atr_14')
    
    if close is None or atr is None:
        return None
    
    exit_params = setup_params['exit']
    
    if 'stop_atr_mult' in exit_params:
        return close - (atr * exit_params['stop_atr_mult'])
    elif 'trailing_atr_mult' in exit_params:
        return close - (atr * exit_params['trailing_atr_mult'])
    
    return close - (atr * 2)


def calculate_target(etf: dict, setup_params: dict) -> float:
    """Calculate target price based on setup exit parameters."""
    close = etf.get('close')
    
    if close is None:
        return None
    
    exit_params = setup_params['exit']
    
    if 'target_pct' in exit_params:
        return close * (1 + exit_params['target_pct'])
    elif 'trailing_activation_pct' in exit_params:
        return close * (1 + exit_params['trailing_activation_pct'])
    
    return close * 1.15


def calculate_setup_strength(etf: dict, setup_name: str) -> int:
    """Calculate setup strength score (0-100)."""
    strength = 50  # Base
    
    # RSI contribution
    rsi = etf.get('rsi_14')
    if rsi is not None:
        if setup_name == 'oversold_bounce':
            strength += min(30, int(40 - rsi))  # More oversold = stronger
        elif setup_name in ['weinstein_stage2', 'rs_breakout']:
            strength += min(15, int((rsi - 50) / 2))  # Higher RSI for breakouts
        else:
            strength += min(15, int(15 - abs(rsi - 50) / 5))  # Neutral RSI bonus
    
    # Volume contribution
    rvol = etf.get('rvol_20')
    if rvol is not None and rvol > 1.5:
        strength += min(15, int((rvol - 1) * 10))
    
    # Trend alignment bonus
    if etf.get('ma50_above_ma200'):
        strength += 10
    if etf.get('above_ma200'):
        strength += 5
    
    # Setup-specific bonuses
    if setup_name == 'weinstein_stage2':
        ma_dist_50 = etf.get('ma_dist_50', 0) or 0
        if ma_dist_50 > 0.05:
            strength += 10
    
    if setup_name == 'trend_pullback_50ma':
        ma_dist_50 = etf.get('ma_dist_50', 0) or 0
        if ma_dist_50 < -0.02:
            strength += 10
    
    return min(100, max(0, strength))


def evaluate_setup(etf: dict, bars: pd.DataFrame, setup_name: str, setup_config: dict) -> dict:
    """Evaluate if an ETF meets setup criteria."""
    checker = SETUP_CHECKERS.get(setup_name)
    if not checker:
        return None
    
    result = checker(etf, bars, setup_config)
    if not result:
        return None
    
    close = etf.get('close')
    stop_loss = calculate_stop_loss(etf, setup_config)
    target = calculate_target(etf, setup_config)
    
    risk_reward = None
    if close and stop_loss and target:
        risk = close - stop_loss
        reward = target - close
        if risk > 0:
            risk_reward = reward / risk
    
    strength = calculate_setup_strength(etf, setup_name)
    
    return {
        'asset_id': etf['asset_id'],
        'setup_name': setup_name,
        'entry_price': close,
        'stop_loss': stop_loss,
        'target_price': target,
        'risk_reward': risk_reward,
        'setup_strength': strength,
        'historical_profit_factor': setup_config.get('historical_profit_factor'),
        'entry_params': setup_config['entry'],
        'exit_params': setup_config['exit'],
        'context': result['context']
    }


def process_asset(etf: dict, target_date: str) -> list:
    """Process a single ETF and return all detected setups."""
    setups = []
    bars = get_historical_bars(etf['asset_id'], target_date)
    
    for setup_name, setup_config in SETUPS.items():
        result = evaluate_setup(etf, bars, setup_name, setup_config)
        if result:
            result['signal_date'] = target_date
            setups.append(result)
    return setups


def main():
    parser = argparse.ArgumentParser(description='ETF/Index/Commodity Daily Setup Scanner')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD)')
    parser.add_argument('--workers', type=int, default=8, help='Number of parallel workers')
    args = parser.parse_args()
    
    if args.date:
        target_date = args.date
    else:
        # Default to latest date with features
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT MAX(df.date) 
                FROM daily_features df
                JOIN assets a ON df.asset_id = a.asset_id
                WHERE a.asset_type = ANY(%s)
            """, (list(ASSET_TYPES),))
            result = cur.fetchone()
            target_date = result[0].isoformat() if result and result[0] else date.today().isoformat()
    
    logger.info("=" * 60)
    logger.info("ETF/INDEX/COMMODITY DAILY SETUP SCANNER")
    logger.info(f"Asset Types: {ASSET_TYPES}")
    logger.info(f"Target Date: {target_date}")
    logger.info("=" * 60)
    
    # Get assets with features
    assets = get_assets_with_features(target_date)
    logger.info(f"Found {len(assets)} assets with features")
    
    if not assets:
        logger.warning("No assets found - run features calculation first")
        return
    
    # Scan for setups in parallel
    all_setups = []
    processed = 0
    errors = 0
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_asset, asset, target_date): asset for asset in assets}
        
        for future in as_completed(futures):
            try:
                setups = future.result()
                all_setups.extend(setups)
                processed += 1
                if processed % 100 == 0:
                    logger.info(f"Processed {processed}/{len(assets)} assets...")
            except Exception as e:
                errors += 1
                logger.warning(f"Error processing asset: {e}")
    
    logger.info(f"Processed {processed} assets, found {len(all_setups)} setups")
    
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
                        risk_reward, setup_strength, historical_profit_factor, entry_params, exit_params, context,
                        created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (asset_id, setup_name, signal_date) DO UPDATE SET
                        entry_price = EXCLUDED.entry_price,
                        stop_loss = EXCLUDED.stop_loss,
                        target_price = EXCLUDED.target_price,
                        risk_reward = EXCLUDED.risk_reward,
                        setup_strength = EXCLUDED.setup_strength,
                        historical_profit_factor = EXCLUDED.historical_profit_factor,
                        entry_params = EXCLUDED.entry_params,
                        exit_params = EXCLUDED.exit_params,
                        context = EXCLUDED.context
                """, (
                    setup['asset_id'], setup['setup_name'], setup['signal_date'],
                    setup['entry_price'], setup['stop_loss'], setup['target_price'],
                    setup['risk_reward'], setup['setup_strength'], setup['historical_profit_factor'],
                    json.dumps(clean_for_json(setup['entry_params'])),
                    json.dumps(clean_for_json(setup['exit_params'])),
                    json.dumps(clean_for_json(setup['context']))
                ))
                inserted += 1
            except Exception as e:
                logger.warning(f"Error inserting setup: {e}")
    
    conn.commit()
    logger.info("=" * 60)
    logger.info(f"✅ Inserted/updated {inserted} ETF/Index/Commodity setups")
    
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

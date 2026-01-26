#!/usr/bin/env python3
"""
Parallel Parameter Optimizer for Stratos Brain
Uses multiprocessing to optimize all 8 setups simultaneously

Each setup runs in its own process with grid search over:
- Entry parameters (RSI thresholds, MA distances, volume requirements)
- Exit parameters (stop loss, trailing stops, time stops)
"""

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple, Any
import json
import os
import itertools
from multiprocessing import Pool, cpu_count, Manager
import warnings
import time
warnings.filterwarnings('ignore')

# Database connection
DB_CONFIG = {
    'host': 'db.wfogbaipiqootjrsprde.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': 'stratosbrainpostgresdbpw'
}

# Constants
FRICTION = 0.0015  # 0.15% per trade
BACKTEST_START = '2024-01-02'
BACKTEST_END = '2026-01-20'
UNIVERSE_LIMIT = 1000

# Output directory
OUTPUT_DIR = '/home/ubuntu/stratos_brain/data/optimization_results'
os.makedirs(OUTPUT_DIR, exist_ok=True)


@dataclass
class Trade:
    """Represents a single trade"""
    asset_id: int
    symbol: str
    setup: str
    entry_date: str
    entry_price: float
    exit_date: str = None
    exit_price: float = None
    exit_reason: str = None
    return_pct: float = None
    hold_days: int = None


# =============================================================================
# PARAMETER GRIDS FOR EACH SETUP
# =============================================================================

PARAMETER_GRIDS = {
    'oversold_bounce': {
        'entry': {
            'rsi_threshold': [25, 30, 35],
            'ma_dist_20_threshold': [-0.06, -0.08, -0.10],
        },
        'exit': {
            'target_ma_dist': [-0.01, 0, 0.01],
            'stop_atr_mult': [1.5, 2.0, 2.5],
            'time_stop_days': [10, 15, 20],
        }
    },
    
    'vcp_squeeze': {
        'entry': {
            'bb_width_pctile_threshold': [15, 20, 25],
            'rsi_min': [35, 40, 45],
            'rsi_max': [65, 70, 75],
        },
        'exit': {
            'target_pct': [0.08, 0.10, 0.12],
            'stop_atr_mult': [1.0, 1.5, 2.0],
            'time_stop_days': [15, 20, 25],
        }
    },
    
    'gap_up_momentum': {
        'entry': {
            'gap_pct_threshold': [0.02, 0.03, 0.04],
            'rvol_threshold': [1.5, 2.0, 2.5],
        },
        'exit': {
            'breakdown_ma_dist': [-0.01, -0.02, -0.03],
            'time_stop_days': [7, 10, 15],
        }
    },
    
    'acceleration_turn': {
        'entry': {
            'rsi_min': [25, 30, 35],
            'rsi_max': [55, 60, 65],
        },
        'exit': {
            'target_pct': [0.06, 0.08, 0.10],
            'stop_atr_mult': [1.5, 2.0, 2.5],
            'time_stop_days': [10, 15, 20],
        }
    },
    
    'trend_pullback_50ma': {
        'entry': {
            'ma_dist_50_min': [-0.04, -0.03, -0.02],
            'ma_dist_50_max': [0.01, 0.02, 0.03],
            'rsi_threshold': [45, 50, 55],
        },
        'exit': {
            'breakdown_ma_dist_200': [-0.01, -0.02, -0.03],
            'trailing_activation_pct': [0.12, 0.15, 0.18],
            'trailing_atr_mult': [2.5, 3.0, 3.5],
            'max_hold_days': [90, 120, 150],
        }
    },
    
    'golden_cross': {
        'entry': {
            'ma_dist_50_min': [-0.03, -0.02, -0.01],
            'ma_dist_50_max': [0.03, 0.05, 0.07],
            'rsi_min': [40, 45, 50],
            'rsi_max': [60, 65, 70],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.02, -0.03, -0.04],
            'trailing_activation_pct': [0.15, 0.20, 0.25],
            'trailing_atr_mult': [3.0, 3.5, 4.0],
            'max_hold_days': [120, 180, 240],
        }
    },
    
    'rs_breakout': {
        'entry': {
            'rsi_min': [45, 50, 55],
            'rsi_max': [65, 70, 75],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.02, -0.03, -0.04],
            'trailing_activation_pct': [0.12, 0.15, 0.18],
            'trailing_atr_mult': [2.5, 3.0, 3.5],
            'max_hold_days': [90, 120, 150],
        }
    },
    
    'breakout_confirmed': {
        'entry': {
            'rvol_threshold': [1.2, 1.5, 1.8],
            'rsi_min': [45, 50, 55],
            'rsi_max': [70, 75, 80],
        },
        'exit': {
            'breakdown_ma_dist_20': [-0.02, -0.03, -0.04],
            'trailing_activation_pct': [0.10, 0.12, 0.15],
            'trailing_atr_mult': [2.0, 2.5, 3.0],
            'max_hold_days': [60, 90, 120],
        }
    },
}


# =============================================================================
# DATA LOADING (cached per process)
# =============================================================================

_universe_cache = None
_data_cache = {}

def get_universe(conn, limit: int = 1000) -> List[Tuple[int, str]]:
    """Get top assets by recent dollar volume"""
    global _universe_cache
    if _universe_cache is not None:
        return _universe_cache
    
    cur = conn.cursor()
    cur.execute('''
        WITH recent_liquidity AS (
            SELECT 
                df.asset_id,
                AVG(df.dollar_volume)::float as avg_dollar_volume,
                AVG(df.close)::float as avg_price
            FROM daily_features df
            WHERE df.date >= '2026-01-01'
            GROUP BY df.asset_id
        )
        SELECT 
            a.asset_id,
            a.symbol
        FROM assets a
        JOIN recent_liquidity rl ON a.asset_id = rl.asset_id
        WHERE a.asset_type = 'equity'
        AND rl.avg_price >= 5
        AND rl.avg_price <= 10000
        AND rl.avg_dollar_volume > 1000000
        ORDER BY rl.avg_dollar_volume DESC
        LIMIT %s
    ''', (limit,))
    _universe_cache = cur.fetchall()
    return _universe_cache


def load_asset_data(conn, asset_id: int) -> pd.DataFrame:
    """Load pre-calculated features for an asset"""
    global _data_cache
    if asset_id in _data_cache:
        return _data_cache[asset_id]
    
    cur = conn.cursor()
    cur.execute('''
        SELECT 
            df.date, df.close, df.rsi_14, df.ma_dist_20, df.ma_dist_50, df.ma_dist_200,
            df.ma_slope_20, df.ma_slope_50, df.ma_slope_200, df.above_ma200, df.ma50_above_ma200,
            df.bb_width_pctile, df.rvol_20, df.gap_pct, df.accel_turn_up, df.rs_breakout,
            df.breakout_confirmed_up, df.atr_14, df.atr_pct, df.sma_20, df.sma_50, df.sma_200
        FROM daily_features df
        WHERE df.asset_id = %s
        AND df.date >= %s
        AND df.date <= %s
        ORDER BY df.date
    ''', (asset_id, BACKTEST_START, BACKTEST_END))
    
    rows = cur.fetchall()
    if not rows:
        return pd.DataFrame()
    
    columns = [
        'date', 'close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
        'ma_slope_20', 'ma_slope_50', 'ma_slope_200', 'above_ma200', 'ma50_above_ma200',
        'bb_width_pctile', 'rvol_20', 'gap_pct', 'accel_turn_up', 'rs_breakout',
        'breakout_confirmed_up', 'atr_14', 'atr_pct', 'sma_20', 'sma_50', 'sma_200'
    ]
    
    df = pd.DataFrame(rows, columns=columns)
    df['date'] = pd.to_datetime(df['date'])
    
    numeric_cols = ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
                    'ma_slope_20', 'ma_slope_50', 'ma_slope_200', 'bb_width_pctile',
                    'rvol_20', 'gap_pct', 'atr_14', 'atr_pct', 'sma_20', 'sma_50', 'sma_200']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    _data_cache[asset_id] = df
    return df


def preload_all_data(conn, universe: List[Tuple[int, str]]) -> Dict[int, pd.DataFrame]:
    """Preload all asset data into memory"""
    global _data_cache
    print(f"Preloading data for {len(universe)} assets...")
    
    for i, (asset_id, symbol) in enumerate(universe):
        if i % 200 == 0:
            print(f"  Loaded {i}/{len(universe)} assets...")
        load_asset_data(conn, asset_id)
    
    print(f"  Loaded {len(universe)} assets into cache")
    return _data_cache


# =============================================================================
# ENTRY/EXIT LOGIC WITH PARAMETERIZED CONDITIONS
# =============================================================================

def check_entry_conditions_parameterized(row: pd.Series, setup_name: str, params: Dict) -> bool:
    """Check entry conditions with parameterized thresholds"""
    
    if setup_name == 'oversold_bounce':
        if pd.isna(row['rsi_14']) or row['rsi_14'] >= params.get('rsi_threshold', 30):
            return False
        if pd.isna(row['ma_dist_20']) or row['ma_dist_20'] >= params.get('ma_dist_20_threshold', -0.08):
            return False
        if row['above_ma200'] != True:
            return False
        return True
    
    elif setup_name == 'vcp_squeeze':
        if pd.isna(row['bb_width_pctile']) or row['bb_width_pctile'] >= params.get('bb_width_pctile_threshold', 20):
            return False
        if pd.isna(row['ma_dist_50']) or row['ma_dist_50'] <= 0:
            return False
        if row['above_ma200'] != True:
            return False
        rsi = row['rsi_14']
        if pd.isna(rsi) or rsi < params.get('rsi_min', 40) or rsi > params.get('rsi_max', 70):
            return False
        return True
    
    elif setup_name == 'gap_up_momentum':
        if pd.isna(row['gap_pct']) or row['gap_pct'] <= params.get('gap_pct_threshold', 0.03):
            return False
        if pd.isna(row['rvol_20']) or row['rvol_20'] <= params.get('rvol_threshold', 2.0):
            return False
        if pd.isna(row['ma_dist_20']) or row['ma_dist_20'] <= 0:
            return False
        return True
    
    elif setup_name == 'acceleration_turn':
        if row['accel_turn_up'] != True:
            return False
        if row['above_ma200'] != True:
            return False
        rsi = row['rsi_14']
        if pd.isna(rsi) or rsi < params.get('rsi_min', 30) or rsi > params.get('rsi_max', 60):
            return False
        return True
    
    elif setup_name == 'trend_pullback_50ma':
        ma_dist_50 = row['ma_dist_50']
        if pd.isna(ma_dist_50):
            return False
        if ma_dist_50 < params.get('ma_dist_50_min', -0.03) or ma_dist_50 > params.get('ma_dist_50_max', 0.02):
            return False
        if row['above_ma200'] != True:
            return False
        if pd.isna(row['rsi_14']) or row['rsi_14'] >= params.get('rsi_threshold', 50):
            return False
        if pd.isna(row['ma_slope_50']) or row['ma_slope_50'] <= 0:
            return False
        return True
    
    elif setup_name == 'golden_cross':
        if row['ma50_above_ma200'] != True:
            return False
        ma_dist_50 = row['ma_dist_50']
        if pd.isna(ma_dist_50):
            return False
        if ma_dist_50 < params.get('ma_dist_50_min', -0.02) or ma_dist_50 > params.get('ma_dist_50_max', 0.05):
            return False
        rsi = row['rsi_14']
        if pd.isna(rsi) or rsi < params.get('rsi_min', 45) or rsi > params.get('rsi_max', 65):
            return False
        if pd.isna(row['ma_slope_50']) or row['ma_slope_50'] <= 0:
            return False
        return True
    
    elif setup_name == 'rs_breakout':
        if row['rs_breakout'] != True:
            return False
        if row['above_ma200'] != True:
            return False
        rsi = row['rsi_14']
        if pd.isna(rsi) or rsi < params.get('rsi_min', 50) or rsi > params.get('rsi_max', 70):
            return False
        return True
    
    elif setup_name == 'breakout_confirmed':
        if row['breakout_confirmed_up'] != True:
            return False
        if pd.isna(row['rvol_20']) or row['rvol_20'] <= params.get('rvol_threshold', 1.5):
            return False
        rsi = row['rsi_14']
        if pd.isna(rsi) or rsi < params.get('rsi_min', 50) or rsi > params.get('rsi_max', 75):
            return False
        return True
    
    return False


def simulate_trade_parameterized(
    df: pd.DataFrame,
    entry_idx: int,
    setup_name: str,
    exit_params: Dict
) -> Tuple[int, float, str]:
    """Simulate a trade with parameterized exit conditions"""
    entry_row = df.iloc[entry_idx]
    entry_price = float(entry_row['close'])
    entry_atr = float(entry_row['atr_14']) if pd.notna(entry_row['atr_14']) else entry_price * 0.02
    
    # Initialize
    stop_loss = None
    take_profit = None
    trailing_stop = None
    trailing_activated = False
    highest_price = entry_price
    
    # Set initial stop loss
    if 'stop_atr_mult' in exit_params:
        stop_loss = entry_price - (entry_atr * exit_params['stop_atr_mult'])
    
    # Set take profit
    if 'target_pct' in exit_params:
        take_profit = entry_price * (1 + exit_params['target_pct'])
    
    # Get max hold days
    max_hold = exit_params.get('max_hold_days', exit_params.get('time_stop_days', 60))
    
    # Simulate day by day
    for i in range(entry_idx + 1, min(entry_idx + max_hold + 1, len(df))):
        row = df.iloc[i]
        close = float(row['close'])
        
        # Estimate high/low from close and ATR
        atr = float(row['atr_14']) if pd.notna(row['atr_14']) else entry_atr
        estimated_high = close + atr * 0.5
        estimated_low = close - atr * 0.5
        
        # Update highest price
        if estimated_high > highest_price:
            highest_price = estimated_high
        
        # Check trailing stop activation
        if 'trailing_activation_pct' in exit_params:
            gain_pct = (highest_price - entry_price) / entry_price
            if gain_pct >= exit_params['trailing_activation_pct'] and not trailing_activated:
                trailing_activated = True
                trail_atr = exit_params.get('trailing_atr_mult', 3.0) * entry_atr
                trailing_stop = highest_price - trail_atr
        
        # Update trailing stop
        if trailing_activated:
            trail_atr = exit_params.get('trailing_atr_mult', 3.0) * entry_atr
            new_trailing_stop = highest_price - trail_atr
            if trailing_stop is None or new_trailing_stop > trailing_stop:
                trailing_stop = new_trailing_stop
        
        # Check stop loss
        if stop_loss and estimated_low <= stop_loss:
            return i, stop_loss, 'stop_loss'
        
        # Check trailing stop
        if trailing_stop and estimated_low <= trailing_stop:
            return i, trailing_stop, 'trailing_stop'
        
        # Check take profit
        if take_profit and estimated_high >= take_profit:
            return i, take_profit, 'take_profit'
        
        # Check target MA distance (for mean reversion)
        if 'target_ma_dist' in exit_params:
            ma_dist = row['ma_dist_20']
            if pd.notna(ma_dist) and ma_dist >= exit_params['target_ma_dist']:
                return i, close, 'target_ma'
        
        # Check breakdown MA distance
        for key, col in [('breakdown_ma_dist_200', 'ma_dist_200'), 
                         ('breakdown_ma_dist_50', 'ma_dist_50'),
                         ('breakdown_ma_dist_20', 'ma_dist_20'),
                         ('breakdown_ma_dist', 'ma_dist_20')]:
            if key in exit_params:
                ma_dist = row[col]
                if pd.notna(ma_dist) and ma_dist < exit_params[key]:
                    return i, close, 'breakdown_ma'
    
    # Time stop
    exit_idx = min(entry_idx + max_hold, len(df) - 1)
    return exit_idx, float(df.iloc[exit_idx]['close']), 'time_stop'


# =============================================================================
# SINGLE PARAMETER COMBINATION BACKTEST
# =============================================================================

def backtest_params(
    setup_name: str,
    entry_params: Dict,
    exit_params: Dict,
    universe: List[Tuple[int, str]],
    data_cache: Dict[int, pd.DataFrame]
) -> Dict:
    """Run backtest for a single parameter combination"""
    trades = []
    
    for asset_id, symbol in universe:
        df = data_cache.get(asset_id)
        if df is None or len(df) < 50:
            continue
        
        # Scan for entries
        last_exit_idx = 0
        
        for idx in range(20, len(df)):
            if idx <= last_exit_idx:
                continue
            
            row = df.iloc[idx]
            
            # Check entry conditions
            if check_entry_conditions_parameterized(row, setup_name, entry_params):
                # Simulate trade
                exit_idx, exit_price, exit_reason = simulate_trade_parameterized(
                    df, idx, setup_name, exit_params
                )
                
                entry_price = float(row['close'])
                
                # Apply friction
                entry_price_adj = entry_price * (1 + FRICTION)
                exit_price_adj = exit_price * (1 - FRICTION)
                
                return_pct = (exit_price_adj / entry_price_adj) - 1
                hold_days = exit_idx - idx
                
                trades.append({
                    'return_pct': return_pct,
                    'hold_days': hold_days,
                    'exit_reason': exit_reason
                })
                
                last_exit_idx = exit_idx
    
    # Calculate metrics
    if not trades:
        return {
            'trades': 0,
            'win_rate': 0,
            'profit_factor': 0,
            'avg_return': 0,
            'avg_hold_days': 0,
            'score': 0,
        }
    
    returns = [t['return_pct'] for t in trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r <= 0]
    
    win_rate = len(wins) / len(returns) if returns else 0
    
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0.0001
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    avg_return = np.mean(returns) if returns else 0
    avg_hold = np.mean([t['hold_days'] for t in trades]) if trades else 0
    
    # Calculate composite score
    # Score = PF * sqrt(trades) * (1 + avg_return) - penalize if too few trades
    min_trades = 50
    trade_factor = min(1.0, len(trades) / min_trades)
    score = profit_factor * np.sqrt(len(trades)) * (1 + avg_return) * trade_factor
    
    return {
        'trades': len(trades),
        'win_rate': round(win_rate * 100, 1),
        'profit_factor': round(profit_factor, 3),
        'avg_return': round(avg_return * 100, 3),
        'avg_hold_days': round(avg_hold, 1),
        'score': round(score, 3),
    }


# =============================================================================
# OPTIMIZE SINGLE SETUP (runs in its own process)
# =============================================================================

def optimize_setup(args: Tuple) -> Dict:
    """Optimize a single setup - designed to run in separate process"""
    setup_name, progress_dict = args
    
    print(f"\n[{setup_name}] Starting optimization...")
    start_time = time.time()
    
    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get universe
    universe = get_universe(conn, UNIVERSE_LIMIT)
    print(f"[{setup_name}] Loaded universe: {len(universe)} assets")
    
    # Preload data
    data_cache = preload_all_data(conn, universe)
    print(f"[{setup_name}] Data preloaded")
    
    conn.close()
    
    # Get parameter grid
    param_grid = PARAMETER_GRIDS.get(setup_name, {})
    entry_grid = param_grid.get('entry', {})
    exit_grid = param_grid.get('exit', {})
    
    # Generate all combinations
    entry_keys = list(entry_grid.keys())
    exit_keys = list(exit_grid.keys())
    
    entry_combos = list(itertools.product(*[entry_grid[k] for k in entry_keys])) if entry_keys else [()]
    exit_combos = list(itertools.product(*[exit_grid[k] for k in exit_keys])) if exit_keys else [()]
    
    total_combos = len(entry_combos) * len(exit_combos)
    print(f"[{setup_name}] Testing {total_combos} parameter combinations...")
    
    # Track best result
    best_result = None
    best_score = -float('inf')
    all_results = []
    
    combo_count = 0
    for entry_vals in entry_combos:
        entry_params = dict(zip(entry_keys, entry_vals)) if entry_keys else {}
        
        for exit_vals in exit_combos:
            exit_params = dict(zip(exit_keys, exit_vals)) if exit_keys else {}
            
            # Run backtest
            result = backtest_params(setup_name, entry_params, exit_params, universe, data_cache)
            result['entry_params'] = entry_params
            result['exit_params'] = exit_params
            
            all_results.append(result)
            
            # Track best
            if result['score'] > best_score and result['trades'] >= 30:
                best_score = result['score']
                best_result = result.copy()
            
            combo_count += 1
            if combo_count % 20 == 0:
                elapsed = time.time() - start_time
                pct = (combo_count / total_combos) * 100
                print(f"[{setup_name}] Progress: {combo_count}/{total_combos} ({pct:.1f}%) - {elapsed:.1f}s")
                if progress_dict is not None:
                    progress_dict[setup_name] = pct
    
    elapsed = time.time() - start_time
    print(f"\n[{setup_name}] COMPLETED in {elapsed:.1f}s")
    
    if best_result:
        print(f"[{setup_name}] Best: PF={best_result['profit_factor']}, WR={best_result['win_rate']}%, "
              f"Trades={best_result['trades']}, Score={best_result['score']}")
        print(f"[{setup_name}] Entry params: {best_result['entry_params']}")
        print(f"[{setup_name}] Exit params: {best_result['exit_params']}")
    
    # Save results
    output = {
        'setup': setup_name,
        'total_combinations': total_combos,
        'elapsed_seconds': round(elapsed, 1),
        'best_result': best_result,
        'top_10_results': sorted(all_results, key=lambda x: x['score'], reverse=True)[:10],
    }
    
    output_file = os.path.join(OUTPUT_DIR, f'{setup_name}_optimized.json')
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"[{setup_name}] Results saved to {output_file}")
    
    return output


# =============================================================================
# MAIN - PARALLEL EXECUTION
# =============================================================================

def main():
    """Run optimization for all setups in parallel"""
    print("="*70)
    print("PARALLEL PARAMETER OPTIMIZER")
    print("="*70)
    print(f"Setups to optimize: {list(PARAMETER_GRIDS.keys())}")
    print(f"CPU cores available: {cpu_count()}")
    print(f"Universe: Top {UNIVERSE_LIMIT} equities")
    print(f"Period: {BACKTEST_START} to {BACKTEST_END}")
    print("="*70)
    
    start_time = time.time()
    
    # Use Manager for shared progress tracking
    manager = Manager()
    progress_dict = manager.dict()
    
    # Prepare arguments for each setup
    setups = list(PARAMETER_GRIDS.keys())
    args_list = [(setup, progress_dict) for setup in setups]
    
    # Run in parallel
    # Use min of CPU count and number of setups
    n_workers = min(cpu_count(), len(setups))
    print(f"\nStarting {n_workers} parallel workers...")
    
    with Pool(processes=n_workers) as pool:
        results = pool.map(optimize_setup, args_list)
    
    total_elapsed = time.time() - start_time
    
    # Aggregate results
    print("\n" + "="*70)
    print("OPTIMIZATION COMPLETE")
    print("="*70)
    print(f"Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} minutes)")
    
    # Summary table
    print("\nBEST PARAMETERS BY SETUP:")
    print("-"*70)
    
    summary = []
    for r in results:
        if r and r.get('best_result'):
            best = r['best_result']
            summary.append({
                'setup': r['setup'],
                'profit_factor': best['profit_factor'],
                'win_rate': best['win_rate'],
                'avg_return': best['avg_return'],
                'trades': best['trades'],
                'score': best['score'],
                'entry_params': best['entry_params'],
                'exit_params': best['exit_params'],
            })
    
    # Sort by score
    summary.sort(key=lambda x: x['score'], reverse=True)
    
    for i, s in enumerate(summary, 1):
        print(f"\n{i}. {s['setup']}")
        print(f"   PF={s['profit_factor']}, WR={s['win_rate']}%, AvgRet={s['avg_return']}%, Trades={s['trades']}")
        print(f"   Entry: {s['entry_params']}")
        print(f"   Exit: {s['exit_params']}")
    
    # Save aggregate results
    aggregate_file = os.path.join(OUTPUT_DIR, 'all_setups_optimized.json')
    with open(aggregate_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_elapsed_seconds': round(total_elapsed, 1),
            'summary': summary,
            'detailed_results': results,
        }, f, indent=2)
    
    print(f"\nAggregate results saved to {aggregate_file}")
    
    return summary


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Local Multiprocessing Parameter Optimizer for Stratos Brain

Runs optimization locally using Python multiprocessing for reliability.
Optimizes entry and exit parameters for all 8 trading setups.
"""

import os
import json
import itertools
from datetime import datetime
from typing import List, Dict, Tuple
from multiprocessing import Pool, cpu_count, Manager
import time
import psycopg2
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

OUTPUT_DIR = '/home/ubuntu/stratos_brain/data/optimization_results'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Database config
DB_CONFIG = {
    'host': 'db.wfogbaipiqootjrsprde.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': 'stratosbrainpostgresdbpw'
}

# Backtest settings
BACKTEST_START = '2024-01-02'
BACKTEST_END = '2026-01-20'
UNIVERSE_LIMIT = 1000
FRICTION = 0.0015  # 15bps round trip

# Parameter grids
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
            'rsi_min': [35, 40],
            'rsi_max': [70, 75],
        },
        'exit': {
            'target_pct': [0.08, 0.10, 0.12],
            'stop_atr_mult': [1.5, 2.0],
            'time_stop_days': [15, 20],
        }
    },
    'gap_up_momentum': {
        'entry': {
            'gap_pct_threshold': [0.02, 0.03, 0.04],
            'rvol_threshold': [1.5, 2.0, 2.5],
        },
        'exit': {
            'breakdown_ma_dist': [-0.02, -0.03],
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
            'time_stop_days': [10, 15],
        }
    },
    'trend_pullback_50ma': {
        'entry': {
            'ma_dist_50_min': [-0.04, -0.03, -0.02],
            'ma_dist_50_max': [0.02, 0.03],
            'rsi_threshold': [45, 50, 55],
        },
        'exit': {
            'breakdown_ma_dist_200': [-0.02, -0.03],
            'trailing_activation_pct': [0.12, 0.15, 0.18],
            'trailing_atr_mult': [2.5, 3.0, 3.5],
            'max_hold_days': [90, 120],
        }
    },
    'golden_cross': {
        'entry': {
            'ma_dist_50_min': [-0.02, -0.01],
            'ma_dist_50_max': [0.05, 0.07],
            'rsi_min': [45, 50],
            'rsi_max': [65, 70],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.03, -0.04],
            'trailing_activation_pct': [0.15, 0.20],
            'trailing_atr_mult': [3.0, 3.5],
            'max_hold_days': [120, 180],
        }
    },
    'rs_breakout': {
        'entry': {
            'rsi_min': [45, 50, 55],
            'rsi_max': [65, 70, 75],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.03, -0.04],
            'trailing_activation_pct': [0.12, 0.15],
            'trailing_atr_mult': [2.5, 3.0],
            'max_hold_days': [90, 120],
        }
    },
    'breakout_confirmed': {
        'entry': {
            'rvol_threshold': [1.2, 1.5, 1.8],
            'rsi_min': [50, 55],
            'rsi_max': [70, 75],
        },
        'exit': {
            'breakdown_ma_dist_20': [-0.03, -0.04],
            'trailing_activation_pct': [0.10, 0.12],
            'trailing_atr_mult': [2.0, 2.5],
            'max_hold_days': [60, 90],
        }
    },
}


def load_all_data():
    """Load universe and feature data from database"""
    print("Loading data from database...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Get liquid universe
    cur.execute("""
        WITH recent_liquidity AS (
            SELECT df.asset_id, 
                   AVG(df.dollar_volume)::float as avg_dollar_volume, 
                   AVG(df.close)::float as avg_price
            FROM daily_features df 
            WHERE df.date >= '2026-01-01' 
            GROUP BY df.asset_id
        )
        SELECT a.asset_id, a.symbol 
        FROM assets a
        JOIN recent_liquidity rl ON a.asset_id = rl.asset_id
        WHERE a.asset_type = 'equity' 
          AND rl.avg_price >= 5 
          AND rl.avg_price <= 10000 
          AND rl.avg_dollar_volume > 1000000
        ORDER BY rl.avg_dollar_volume DESC 
        LIMIT %s
    """, (UNIVERSE_LIMIT,))
    universe = cur.fetchall()
    asset_ids = [a[0] for a in universe]
    print(f"Got {len(universe)} assets in universe")
    
    # Get all features
    cur.execute("""
        SELECT df.asset_id, df.date, df.close, df.rsi_14, df.ma_dist_20, df.ma_dist_50, 
               df.ma_dist_200, df.ma_slope_50, df.above_ma200, df.ma50_above_ma200,
               df.bb_width_pctile, df.rvol_20, df.gap_pct, df.accel_turn_up, df.rs_breakout,
               df.breakout_confirmed_up, df.atr_14
        FROM daily_features df 
        WHERE df.asset_id = ANY(%s) 
          AND df.date >= %s 
          AND df.date <= %s
        ORDER BY df.asset_id, df.date
    """, (asset_ids, BACKTEST_START, BACKTEST_END))
    
    rows = cur.fetchall()
    conn.close()
    print(f"Got {len(rows)} feature rows")
    
    columns = ['asset_id', 'date', 'close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 
               'ma_slope_50', 'above_ma200', 'ma50_above_ma200', 'bb_width_pctile', 'rvol_20', 
               'gap_pct', 'accel_turn_up', 'rs_breakout', 'breakout_confirmed_up', 'atr_14']
    
    df = pd.DataFrame(rows, columns=columns)
    df['date'] = pd.to_datetime(df['date'])
    
    for col in ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'ma_slope_50', 
                'bb_width_pctile', 'rvol_20', 'gap_pct', 'atr_14']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return universe, df


def get_entry_signals(df: pd.DataFrame, setup_name: str, entry_params: dict) -> pd.DataFrame:
    """Get entry signals for a setup with given parameters"""
    if setup_name == 'oversold_bounce':
        return df[
            (df['rsi_14'] < entry_params.get('rsi_threshold', 30)) &
            (df['ma_dist_20'] < entry_params.get('ma_dist_20_threshold', -0.08)) &
            (df['above_ma200'] == True)
        ]
    
    elif setup_name == 'vcp_squeeze':
        return df[
            (df['bb_width_pctile'] < entry_params.get('bb_width_pctile_threshold', 20)) &
            (df['ma_dist_50'] > 0) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] >= entry_params.get('rsi_min', 40)) &
            (df['rsi_14'] <= entry_params.get('rsi_max', 70))
        ]
    
    elif setup_name == 'gap_up_momentum':
        return df[
            (df['gap_pct'] > entry_params.get('gap_pct_threshold', 0.03)) &
            (df['rvol_20'] > entry_params.get('rvol_threshold', 2.0)) &
            (df['ma_dist_20'] > 0)
        ]
    
    elif setup_name == 'acceleration_turn':
        return df[
            (df['accel_turn_up'] == True) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] >= entry_params.get('rsi_min', 30)) &
            (df['rsi_14'] <= entry_params.get('rsi_max', 60))
        ]
    
    elif setup_name == 'trend_pullback_50ma':
        return df[
            (df['ma_dist_50'] >= entry_params.get('ma_dist_50_min', -0.03)) &
            (df['ma_dist_50'] <= entry_params.get('ma_dist_50_max', 0.02)) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] < entry_params.get('rsi_threshold', 50)) &
            (df['ma_slope_50'] > 0)
        ]
    
    elif setup_name == 'golden_cross':
        return df[
            (df['ma50_above_ma200'] == True) &
            (df['ma_dist_50'] >= entry_params.get('ma_dist_50_min', -0.02)) &
            (df['ma_dist_50'] <= entry_params.get('ma_dist_50_max', 0.05)) &
            (df['rsi_14'] >= entry_params.get('rsi_min', 45)) &
            (df['rsi_14'] <= entry_params.get('rsi_max', 65)) &
            (df['ma_slope_50'] > 0)
        ]
    
    elif setup_name == 'rs_breakout':
        return df[
            (df['rs_breakout'] == True) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] >= entry_params.get('rsi_min', 50)) &
            (df['rsi_14'] <= entry_params.get('rsi_max', 70))
        ]
    
    elif setup_name == 'breakout_confirmed':
        return df[
            (df['breakout_confirmed_up'] == True) &
            (df['rvol_20'] > entry_params.get('rvol_threshold', 1.5)) &
            (df['rsi_14'] >= entry_params.get('rsi_min', 50)) &
            (df['rsi_14'] <= entry_params.get('rsi_max', 75))
        ]
    
    return df.iloc[:0]


def simulate_trades(asset_df: pd.DataFrame, signals: pd.DataFrame, exit_params: dict) -> List[dict]:
    """Simulate trades for one asset"""
    trades = []
    if len(signals) == 0:
        return trades
    
    asset_df = asset_df.reset_index(drop=True)
    date_to_idx = dict(zip(asset_df['date'], range(len(asset_df))))
    
    last_exit_idx = -1
    
    for _, signal in signals.iterrows():
        if signal['date'] not in date_to_idx:
            continue
        
        entry_idx = date_to_idx[signal['date']]
        if entry_idx <= last_exit_idx:
            continue
        
        entry_price = float(signal['close'])
        entry_atr = float(signal['atr_14']) if pd.notna(signal['atr_14']) else entry_price * 0.02
        
        # Exit parameters
        stop_loss = entry_price - entry_atr * exit_params.get('stop_atr_mult', 2.0) if 'stop_atr_mult' in exit_params else None
        take_profit = entry_price * (1 + exit_params['target_pct']) if 'target_pct' in exit_params else None
        
        trailing_stop = None
        trailing_activated = False
        highest_price = entry_price
        
        max_hold = exit_params.get('max_hold_days', exit_params.get('time_stop_days', 60))
        
        exit_idx, exit_price, exit_reason = None, None, None
        
        for i in range(entry_idx + 1, min(entry_idx + max_hold + 1, len(asset_df))):
            row = asset_df.iloc[i]
            close = float(row['close'])
            atr = float(row['atr_14']) if pd.notna(row['atr_14']) else entry_atr
            
            est_high = close + atr * 0.5
            est_low = close - atr * 0.5
            
            if est_high > highest_price:
                highest_price = est_high
            
            # Check trailing stop activation
            if 'trailing_activation_pct' in exit_params:
                if (highest_price - entry_price) / entry_price >= exit_params['trailing_activation_pct'] and not trailing_activated:
                    trailing_activated = True
                    trailing_stop = highest_price - exit_params.get('trailing_atr_mult', 3.0) * entry_atr
            
            if trailing_activated:
                new_trailing = highest_price - exit_params.get('trailing_atr_mult', 3.0) * entry_atr
                if trailing_stop is None or new_trailing > trailing_stop:
                    trailing_stop = new_trailing
            
            # Check exits
            if stop_loss and est_low <= stop_loss:
                exit_idx, exit_price, exit_reason = i, stop_loss, 'stop_loss'
                break
            
            if trailing_stop and est_low <= trailing_stop:
                exit_idx, exit_price, exit_reason = i, trailing_stop, 'trailing_stop'
                break
            
            if take_profit and est_high >= take_profit:
                exit_idx, exit_price, exit_reason = i, take_profit, 'take_profit'
                break
            
            # MA-based exits
            if 'target_ma_dist' in exit_params and pd.notna(row['ma_dist_20']):
                if row['ma_dist_20'] >= exit_params['target_ma_dist']:
                    exit_idx, exit_price, exit_reason = i, close, 'target_ma'
                    break
            
            for key, col in [('breakdown_ma_dist_200', 'ma_dist_200'), 
                            ('breakdown_ma_dist_50', 'ma_dist_50'), 
                            ('breakdown_ma_dist_20', 'ma_dist_20'),
                            ('breakdown_ma_dist', 'ma_dist_20')]:
                if key in exit_params and pd.notna(row[col]):
                    if row[col] < exit_params[key]:
                        exit_idx, exit_price, exit_reason = i, close, 'breakdown_ma'
                        break
            
            if exit_idx:
                break
        
        # Time stop if no other exit
        if exit_idx is None:
            exit_idx = min(entry_idx + max_hold, len(asset_df) - 1)
            exit_price = float(asset_df.iloc[exit_idx]['close'])
            exit_reason = 'time_stop'
        
        # Calculate return with friction
        return_pct = (exit_price * (1 - FRICTION)) / (entry_price * (1 + FRICTION)) - 1
        
        trades.append({
            'return_pct': return_pct,
            'hold_days': exit_idx - entry_idx,
            'exit_reason': exit_reason
        })
        
        last_exit_idx = exit_idx
    
    return trades


def backtest_params(args) -> dict:
    """Backtest a single parameter combination"""
    setup_name, entry_params, exit_params, all_data, universe, progress_dict = args
    
    signals = get_entry_signals(all_data, setup_name, entry_params)
    
    if len(signals) == 0:
        return {
            'entry_params': entry_params,
            'exit_params': exit_params,
            'trades': 0,
            'win_rate': 0,
            'profit_factor': 0,
            'avg_return': 0,
            'score': 0
        }
    
    all_trades = []
    for asset_id, symbol in universe:
        asset_df = all_data[all_data['asset_id'] == asset_id]
        if len(asset_df) < 50:
            continue
        
        asset_signals = signals[signals['asset_id'] == asset_id]
        if len(asset_signals) == 0:
            continue
        
        trades = simulate_trades(asset_df, asset_signals, exit_params)
        all_trades.extend(trades)
    
    if not all_trades:
        return {
            'entry_params': entry_params,
            'exit_params': exit_params,
            'trades': 0,
            'win_rate': 0,
            'profit_factor': 0,
            'avg_return': 0,
            'score': 0
        }
    
    returns = [t['return_pct'] for t in all_trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r <= 0]
    
    win_rate = len(wins) / len(returns) if returns else 0
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0.0001
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    avg_return = np.mean(returns) if returns else 0
    
    # Score: profit_factor * sqrt(trades) * (1 + avg_return) * trade_frequency_factor
    trade_freq_factor = min(1.0, len(all_trades) / 50)
    score = profit_factor * np.sqrt(len(all_trades)) * (1 + avg_return) * trade_freq_factor
    
    # Update progress
    if progress_dict is not None:
        progress_dict[setup_name] = progress_dict.get(setup_name, 0) + 1
    
    return {
        'entry_params': entry_params,
        'exit_params': exit_params,
        'trades': len(all_trades),
        'win_rate': round(win_rate * 100, 1),
        'profit_factor': round(profit_factor, 3),
        'avg_return': round(avg_return * 100, 3),
        'score': round(score, 3)
    }


def generate_param_combinations(setup_name: str) -> List[Tuple[dict, dict]]:
    """Generate all parameter combinations for a setup"""
    param_grid = PARAMETER_GRIDS.get(setup_name, {})
    entry_grid = param_grid.get('entry', {})
    exit_grid = param_grid.get('exit', {})
    
    entry_keys = list(entry_grid.keys())
    exit_keys = list(exit_grid.keys())
    
    entry_combos = list(itertools.product(*[entry_grid[k] for k in entry_keys])) if entry_keys else [()]
    exit_combos = list(itertools.product(*[exit_grid[k] for k in exit_keys])) if exit_keys else [()]
    
    all_combos = []
    for entry_vals in entry_combos:
        entry_params = dict(zip(entry_keys, entry_vals)) if entry_keys else {}
        for exit_vals in exit_combos:
            exit_params = dict(zip(exit_keys, exit_vals)) if exit_keys else {}
            all_combos.append((entry_params, exit_params))
    
    return all_combos


def optimize_setup(setup_name: str, all_data: pd.DataFrame, universe: List, 
                   progress_dict: dict, num_workers: int = 4) -> dict:
    """Optimize parameters for a single setup"""
    print(f"\n{'='*50}")
    print(f"Optimizing: {setup_name}")
    print('='*50)
    
    param_combos = generate_param_combinations(setup_name)
    total = len(param_combos)
    print(f"Total combinations: {total}")
    
    # Prepare arguments for parallel processing
    args_list = [
        (setup_name, entry_params, exit_params, all_data, universe, progress_dict)
        for entry_params, exit_params in param_combos
    ]
    
    start_time = time.time()
    
    # Run in parallel
    with Pool(processes=num_workers) as pool:
        results = pool.map(backtest_params, args_list)
    
    elapsed = time.time() - start_time
    print(f"[{setup_name}] Completed in {elapsed:.1f}s")
    
    # Find best result
    valid_results = [r for r in results if r['trades'] >= 30]
    best = max(valid_results, key=lambda x: x['score']) if valid_results else None
    
    if best:
        print(f"[{setup_name}] BEST: PF={best['profit_factor']}, WR={best['win_rate']}%, Trades={best['trades']}")
        print(f"  Entry: {best['entry_params']}")
        print(f"  Exit: {best['exit_params']}")
    
    return {
        'setup': setup_name,
        'total_combinations': total,
        'elapsed_seconds': round(elapsed, 1),
        'best_result': best,
        'top_10': sorted(results, key=lambda x: x.get('score', 0), reverse=True)[:10],
        'all_results': results
    }


def main():
    print("="*60)
    print("LOCAL MULTIPROCESSING PARAMETER OPTIMIZER")
    print("="*60)
    print(f"CPUs available: {cpu_count()}")
    print(f"Using 4 worker processes")
    
    # Load data once
    universe, all_data = load_all_data()
    print(f"Data loaded: {len(all_data)} rows, {len(universe)} assets")
    
    setups = list(PARAMETER_GRIDS.keys())
    
    total_combos = 0
    for setup in setups:
        combos = generate_param_combinations(setup)
        print(f"  {setup}: {len(combos)} combinations")
        total_combos += len(combos)
    print(f"  TOTAL: {total_combos} combinations")
    print("="*60)
    
    start_time = time.time()
    
    # Use Manager for shared progress tracking
    manager = Manager()
    progress_dict = manager.dict()
    
    all_results = []
    
    for setup in setups:
        result = optimize_setup(setup, all_data, universe, progress_dict, num_workers=4)
        all_results.append(result)
        
        # Save intermediate results
        output_file = os.path.join(OUTPUT_DIR, f'{setup}_optimized.json')
        with open(output_file, 'w') as f:
            # Don't save all_results to keep file size manageable
            save_result = {k: v for k, v in result.items() if k != 'all_results'}
            json.dump(save_result, f, indent=2)
        print(f"Saved to {output_file}")
        
        # Progress update
        elapsed = time.time() - start_time
        completed_setups = len(all_results)
        remaining_setups = len(setups) - completed_setups
        if completed_setups > 0:
            avg_time_per_setup = elapsed / completed_setups
            eta_seconds = avg_time_per_setup * remaining_setups
            print(f"\nProgress: {completed_setups}/{len(setups)} setups | Elapsed: {elapsed/60:.1f}min | ETA: {eta_seconds/60:.1f}min")
    
    total_elapsed = time.time() - start_time
    
    # Summary
    print("\n" + "="*60)
    print("OPTIMIZATION COMPLETE")
    print("="*60)
    print(f"Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")
    
    summary = []
    for r in all_results:
        if r.get('best_result'):
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
    
    summary.sort(key=lambda x: x['score'], reverse=True)
    
    print("\nBEST PARAMETERS BY SETUP (ranked by score):")
    print("-"*60)
    for i, s in enumerate(summary, 1):
        print(f"\n{i}. {s['setup']}")
        print(f"   PF={s['profit_factor']}, WR={s['win_rate']}%, AvgRet={s['avg_return']}%, Trades={s['trades']}, Score={s['score']}")
        print(f"   Entry: {s['entry_params']}")
        print(f"   Exit: {s['exit_params']}")
    
    # Save aggregate
    aggregate_file = os.path.join(OUTPUT_DIR, 'all_setups_optimized.json')
    with open(aggregate_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_elapsed_seconds': round(total_elapsed, 1),
            'total_combinations': total_combos,
            'summary': summary,
            'detailed_results': [{k: v for k, v in r.items() if k != 'all_results'} for r in all_results],
        }, f, indent=2)
    
    print(f"\nResults saved to {aggregate_file}")
    return summary


if __name__ == '__main__':
    main()

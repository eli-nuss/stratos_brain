#!/usr/bin/env python3
"""
Fast Vectorized Parameter Optimizer for Stratos Brain

Key optimizations:
1. Pre-compute all entry signals once, then filter by parameters
2. Use vectorized operations instead of row-by-row iteration
3. Smaller, smarter parameter grids
4. Parallel processing across setups
"""

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Tuple, Any
import json
import os
import itertools
from multiprocessing import Pool, cpu_count
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
FRICTION = 0.0015
BACKTEST_START = '2024-01-02'
BACKTEST_END = '2026-01-20'
UNIVERSE_LIMIT = 1000

OUTPUT_DIR = '/home/ubuntu/stratos_brain/data/optimization_results'
os.makedirs(OUTPUT_DIR, exist_ok=True)


# =============================================================================
# SMART PARAMETER GRIDS (reduced but meaningful)
# =============================================================================

PARAMETER_GRIDS = {
    'oversold_bounce': {
        'entry': {
            'rsi_threshold': [25, 30, 35],
            'ma_dist_20_threshold': [-0.06, -0.08, -0.10],
        },
        'exit': {
            'target_ma_dist': [0],
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


# =============================================================================
# DATA LOADING
# =============================================================================

def load_all_data() -> Tuple[List[Tuple[int, str]], pd.DataFrame]:
    """Load all data into a single DataFrame for vectorized operations"""
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get universe
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
    ''', (UNIVERSE_LIMIT,))
    universe = cur.fetchall()
    asset_ids = [a[0] for a in universe]
    
    print(f"Loading data for {len(universe)} assets...")
    
    # Load all features
    cur.execute('''
        SELECT 
            df.asset_id, df.date, df.close, df.rsi_14, df.ma_dist_20, df.ma_dist_50, 
            df.ma_dist_200, df.ma_slope_50, df.above_ma200, df.ma50_above_ma200,
            df.bb_width_pctile, df.rvol_20, df.gap_pct, df.accel_turn_up, df.rs_breakout,
            df.breakout_confirmed_up, df.atr_14, df.atr_pct
        FROM daily_features df
        WHERE df.asset_id = ANY(%s)
        AND df.date >= %s
        AND df.date <= %s
        ORDER BY df.asset_id, df.date
    ''', (asset_ids, BACKTEST_START, BACKTEST_END))
    
    rows = cur.fetchall()
    conn.close()
    
    columns = [
        'asset_id', 'date', 'close', 'rsi_14', 'ma_dist_20', 'ma_dist_50',
        'ma_dist_200', 'ma_slope_50', 'above_ma200', 'ma50_above_ma200',
        'bb_width_pctile', 'rvol_20', 'gap_pct', 'accel_turn_up', 'rs_breakout',
        'breakout_confirmed_up', 'atr_14', 'atr_pct'
    ]
    
    df = pd.DataFrame(rows, columns=columns)
    df['date'] = pd.to_datetime(df['date'])
    
    # Convert numeric columns
    numeric_cols = ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
                    'ma_slope_50', 'bb_width_pctile', 'rvol_20', 'gap_pct', 
                    'atr_14', 'atr_pct']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    print(f"Loaded {len(df)} rows of data")
    
    return universe, df


# =============================================================================
# VECTORIZED ENTRY SIGNAL DETECTION
# =============================================================================

def get_entry_signals(df: pd.DataFrame, setup_name: str, params: Dict) -> pd.DataFrame:
    """Get all entry signals for a setup with given parameters"""
    
    if setup_name == 'oversold_bounce':
        mask = (
            (df['rsi_14'] < params.get('rsi_threshold', 30)) &
            (df['ma_dist_20'] < params.get('ma_dist_20_threshold', -0.08)) &
            (df['above_ma200'] == True)
        )
    
    elif setup_name == 'vcp_squeeze':
        mask = (
            (df['bb_width_pctile'] < params.get('bb_width_pctile_threshold', 20)) &
            (df['ma_dist_50'] > 0) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] >= params.get('rsi_min', 40)) &
            (df['rsi_14'] <= params.get('rsi_max', 70))
        )
    
    elif setup_name == 'gap_up_momentum':
        mask = (
            (df['gap_pct'] > params.get('gap_pct_threshold', 0.03)) &
            (df['rvol_20'] > params.get('rvol_threshold', 2.0)) &
            (df['ma_dist_20'] > 0)
        )
    
    elif setup_name == 'acceleration_turn':
        mask = (
            (df['accel_turn_up'] == True) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] >= params.get('rsi_min', 30)) &
            (df['rsi_14'] <= params.get('rsi_max', 60))
        )
    
    elif setup_name == 'trend_pullback_50ma':
        mask = (
            (df['ma_dist_50'] >= params.get('ma_dist_50_min', -0.03)) &
            (df['ma_dist_50'] <= params.get('ma_dist_50_max', 0.02)) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] < params.get('rsi_threshold', 50)) &
            (df['ma_slope_50'] > 0)
        )
    
    elif setup_name == 'golden_cross':
        mask = (
            (df['ma50_above_ma200'] == True) &
            (df['ma_dist_50'] >= params.get('ma_dist_50_min', -0.02)) &
            (df['ma_dist_50'] <= params.get('ma_dist_50_max', 0.05)) &
            (df['rsi_14'] >= params.get('rsi_min', 45)) &
            (df['rsi_14'] <= params.get('rsi_max', 65)) &
            (df['ma_slope_50'] > 0)
        )
    
    elif setup_name == 'rs_breakout':
        mask = (
            (df['rs_breakout'] == True) &
            (df['above_ma200'] == True) &
            (df['rsi_14'] >= params.get('rsi_min', 50)) &
            (df['rsi_14'] <= params.get('rsi_max', 70))
        )
    
    elif setup_name == 'breakout_confirmed':
        mask = (
            (df['breakout_confirmed_up'] == True) &
            (df['rvol_20'] > params.get('rvol_threshold', 1.5)) &
            (df['rsi_14'] >= params.get('rsi_min', 50)) &
            (df['rsi_14'] <= params.get('rsi_max', 75))
        )
    
    else:
        mask = pd.Series([False] * len(df))
    
    return df[mask].copy()


# =============================================================================
# TRADE SIMULATION (per asset)
# =============================================================================

def simulate_trades_for_asset(
    asset_df: pd.DataFrame,
    entry_signals: pd.DataFrame,
    exit_params: Dict
) -> List[Dict]:
    """Simulate trades for a single asset"""
    trades = []
    
    if len(entry_signals) == 0:
        return trades
    
    asset_df = asset_df.reset_index(drop=True)
    asset_df['idx'] = range(len(asset_df))
    
    # Create date to index mapping
    date_to_idx = dict(zip(asset_df['date'], asset_df['idx']))
    
    last_exit_idx = -1
    
    for _, signal in entry_signals.iterrows():
        entry_date = signal['date']
        if entry_date not in date_to_idx:
            continue
        
        entry_idx = date_to_idx[entry_date]
        
        # Skip if still in previous trade
        if entry_idx <= last_exit_idx:
            continue
        
        entry_price = float(signal['close'])
        entry_atr = float(signal['atr_14']) if pd.notna(signal['atr_14']) else entry_price * 0.02
        
        # Initialize exit tracking
        stop_loss = None
        take_profit = None
        trailing_stop = None
        trailing_activated = False
        highest_price = entry_price
        
        if 'stop_atr_mult' in exit_params:
            stop_loss = entry_price - (entry_atr * exit_params['stop_atr_mult'])
        
        if 'target_pct' in exit_params:
            take_profit = entry_price * (1 + exit_params['target_pct'])
        
        max_hold = exit_params.get('max_hold_days', exit_params.get('time_stop_days', 60))
        
        # Simulate day by day
        exit_idx = None
        exit_price = None
        exit_reason = None
        
        for i in range(entry_idx + 1, min(entry_idx + max_hold + 1, len(asset_df))):
            row = asset_df.iloc[i]
            close = float(row['close'])
            atr = float(row['atr_14']) if pd.notna(row['atr_14']) else entry_atr
            
            estimated_high = close + atr * 0.5
            estimated_low = close - atr * 0.5
            
            if estimated_high > highest_price:
                highest_price = estimated_high
            
            # Check trailing stop activation
            if 'trailing_activation_pct' in exit_params:
                gain_pct = (highest_price - entry_price) / entry_price
                if gain_pct >= exit_params['trailing_activation_pct'] and not trailing_activated:
                    trailing_activated = True
                    trail_atr = exit_params.get('trailing_atr_mult', 3.0) * entry_atr
                    trailing_stop = highest_price - trail_atr
            
            if trailing_activated:
                trail_atr = exit_params.get('trailing_atr_mult', 3.0) * entry_atr
                new_trailing_stop = highest_price - trail_atr
                if trailing_stop is None or new_trailing_stop > trailing_stop:
                    trailing_stop = new_trailing_stop
            
            # Check exits
            if stop_loss and estimated_low <= stop_loss:
                exit_idx, exit_price, exit_reason = i, stop_loss, 'stop_loss'
                break
            
            if trailing_stop and estimated_low <= trailing_stop:
                exit_idx, exit_price, exit_reason = i, trailing_stop, 'trailing_stop'
                break
            
            if take_profit and estimated_high >= take_profit:
                exit_idx, exit_price, exit_reason = i, take_profit, 'take_profit'
                break
            
            # Target MA distance
            if 'target_ma_dist' in exit_params:
                ma_dist = row['ma_dist_20']
                if pd.notna(ma_dist) and ma_dist >= exit_params['target_ma_dist']:
                    exit_idx, exit_price, exit_reason = i, close, 'target_ma'
                    break
            
            # Breakdown checks
            for key, col in [('breakdown_ma_dist_200', 'ma_dist_200'), 
                             ('breakdown_ma_dist_50', 'ma_dist_50'),
                             ('breakdown_ma_dist_20', 'ma_dist_20'),
                             ('breakdown_ma_dist', 'ma_dist_20')]:
                if key in exit_params:
                    ma_dist = row[col]
                    if pd.notna(ma_dist) and ma_dist < exit_params[key]:
                        exit_idx, exit_price, exit_reason = i, close, 'breakdown_ma'
                        break
            
            if exit_idx is not None:
                break
        
        # Time stop if no exit
        if exit_idx is None:
            exit_idx = min(entry_idx + max_hold, len(asset_df) - 1)
            exit_price = float(asset_df.iloc[exit_idx]['close'])
            exit_reason = 'time_stop'
        
        # Calculate return with friction
        entry_price_adj = entry_price * (1 + FRICTION)
        exit_price_adj = exit_price * (1 - FRICTION)
        return_pct = (exit_price_adj / entry_price_adj) - 1
        
        trades.append({
            'return_pct': return_pct,
            'hold_days': exit_idx - entry_idx,
            'exit_reason': exit_reason
        })
        
        last_exit_idx = exit_idx
    
    return trades


# =============================================================================
# BACKTEST SINGLE PARAMETER COMBINATION
# =============================================================================

def backtest_params(
    setup_name: str,
    entry_params: Dict,
    exit_params: Dict,
    all_data: pd.DataFrame,
    universe: List[Tuple[int, str]]
) -> Dict:
    """Run backtest for a single parameter combination"""
    
    # Get entry signals
    entry_signals = get_entry_signals(all_data, setup_name, entry_params)
    
    if len(entry_signals) == 0:
        return {
            'trades': 0,
            'win_rate': 0,
            'profit_factor': 0,
            'avg_return': 0,
            'avg_hold_days': 0,
            'score': 0,
        }
    
    all_trades = []
    
    # Process each asset
    for asset_id, symbol in universe:
        asset_df = all_data[all_data['asset_id'] == asset_id]
        if len(asset_df) < 50:
            continue
        
        asset_signals = entry_signals[entry_signals['asset_id'] == asset_id]
        if len(asset_signals) == 0:
            continue
        
        trades = simulate_trades_for_asset(asset_df, asset_signals, exit_params)
        all_trades.extend(trades)
    
    if not all_trades:
        return {
            'trades': 0,
            'win_rate': 0,
            'profit_factor': 0,
            'avg_return': 0,
            'avg_hold_days': 0,
            'score': 0,
        }
    
    # Calculate metrics
    returns = [t['return_pct'] for t in all_trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r <= 0]
    
    win_rate = len(wins) / len(returns) if returns else 0
    
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0.0001
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    avg_return = np.mean(returns) if returns else 0
    avg_hold = np.mean([t['hold_days'] for t in all_trades]) if all_trades else 0
    
    # Composite score
    min_trades = 50
    trade_factor = min(1.0, len(all_trades) / min_trades)
    score = profit_factor * np.sqrt(len(all_trades)) * (1 + avg_return) * trade_factor
    
    return {
        'trades': len(all_trades),
        'win_rate': round(win_rate * 100, 1),
        'profit_factor': round(profit_factor, 3),
        'avg_return': round(avg_return * 100, 3),
        'avg_hold_days': round(avg_hold, 1),
        'score': round(score, 3),
    }


# =============================================================================
# OPTIMIZE SINGLE SETUP
# =============================================================================

def optimize_setup(args: Tuple) -> Dict:
    """Optimize a single setup"""
    setup_name, all_data, universe = args
    
    print(f"\n[{setup_name}] Starting optimization...")
    start_time = time.time()
    
    param_grid = PARAMETER_GRIDS.get(setup_name, {})
    entry_grid = param_grid.get('entry', {})
    exit_grid = param_grid.get('exit', {})
    
    entry_keys = list(entry_grid.keys())
    exit_keys = list(exit_grid.keys())
    
    entry_combos = list(itertools.product(*[entry_grid[k] for k in entry_keys])) if entry_keys else [()]
    exit_combos = list(itertools.product(*[exit_grid[k] for k in exit_keys])) if exit_keys else [()]
    
    total_combos = len(entry_combos) * len(exit_combos)
    print(f"[{setup_name}] Testing {total_combos} parameter combinations...")
    
    best_result = None
    best_score = -float('inf')
    all_results = []
    
    combo_count = 0
    for entry_vals in entry_combos:
        entry_params = dict(zip(entry_keys, entry_vals)) if entry_keys else {}
        
        for exit_vals in exit_combos:
            exit_params = dict(zip(exit_keys, exit_vals)) if exit_keys else {}
            
            result = backtest_params(setup_name, entry_params, exit_params, all_data, universe)
            result['entry_params'] = entry_params
            result['exit_params'] = exit_params
            
            all_results.append(result)
            
            if result['score'] > best_score and result['trades'] >= 30:
                best_score = result['score']
                best_result = result.copy()
            
            combo_count += 1
            if combo_count % 10 == 0:
                elapsed = time.time() - start_time
                pct = (combo_count / total_combos) * 100
                print(f"[{setup_name}] {combo_count}/{total_combos} ({pct:.0f}%) - {elapsed:.1f}s")
    
    elapsed = time.time() - start_time
    print(f"[{setup_name}] COMPLETED in {elapsed:.1f}s")
    
    if best_result:
        print(f"[{setup_name}] Best: PF={best_result['profit_factor']}, WR={best_result['win_rate']}%, "
              f"Trades={best_result['trades']}, Score={best_result['score']}")
    
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
    
    return output


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("="*70)
    print("FAST PARAMETER OPTIMIZER")
    print("="*70)
    
    start_time = time.time()
    
    # Load all data once
    print("\nLoading data...")
    universe, all_data = load_all_data()
    load_time = time.time() - start_time
    print(f"Data loaded in {load_time:.1f}s")
    
    # Run optimization for each setup sequentially (data is shared)
    setups = list(PARAMETER_GRIDS.keys())
    results = []
    
    for setup_name in setups:
        result = optimize_setup((setup_name, all_data, universe))
        results.append(result)
    
    total_elapsed = time.time() - start_time
    
    # Summary
    print("\n" + "="*70)
    print("OPTIMIZATION COMPLETE")
    print("="*70)
    print(f"Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} minutes)")
    
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
    
    summary.sort(key=lambda x: x['score'], reverse=True)
    
    print("\nBEST PARAMETERS BY SETUP (ranked by score):")
    print("-"*70)
    for i, s in enumerate(summary, 1):
        print(f"\n{i}. {s['setup']}")
        print(f"   PF={s['profit_factor']}, WR={s['win_rate']}%, AvgRet={s['avg_return']}%, Trades={s['trades']}")
        print(f"   Entry: {s['entry_params']}")
        print(f"   Exit: {s['exit_params']}")
    
    aggregate_file = os.path.join(OUTPUT_DIR, 'all_setups_optimized.json')
    with open(aggregate_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_elapsed_seconds': round(total_elapsed, 1),
            'summary': summary,
            'detailed_results': results,
        }, f, indent=2)
    
    print(f"\nResults saved to {aggregate_file}")
    
    return summary


if __name__ == '__main__':
    main()

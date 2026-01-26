#!/usr/bin/env python3
"""
E2B Parallel Parameter Optimizer for Stratos Brain

Spins up multiple e2b sandboxes to run parameter optimization in parallel.
Each sandbox tests a subset of parameter combinations for one setup.
"""

import os
import json
import asyncio
import itertools
from datetime import datetime
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Set API key
os.environ['E2B_API_KEY'] = 'e2b_4d83c9e11ba1a22183e6b605019e63d295638947'

from e2b_code_interpreter import Sandbox

# Database config (will be passed to sandboxes)
DB_CONFIG = {
    'host': 'db.wfogbaipiqootjrsprde.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': 'stratosbrainpostgresdbpw'
}

# Output directory
OUTPUT_DIR = '/home/ubuntu/stratos_brain/data/optimization_results'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# =============================================================================
# EXPANDED PARAMETER GRIDS (full optimization)
# =============================================================================

PARAMETER_GRIDS = {
    'oversold_bounce': {
        'entry': {
            'rsi_threshold': [20, 25, 30, 35, 40],
            'ma_dist_20_threshold': [-0.05, -0.06, -0.08, -0.10, -0.12],
        },
        'exit': {
            'target_ma_dist': [-0.02, -0.01, 0, 0.01],
            'stop_atr_mult': [1.5, 2.0, 2.5, 3.0],
            'time_stop_days': [10, 15, 20, 25],
        }
    },
    
    'vcp_squeeze': {
        'entry': {
            'bb_width_pctile_threshold': [10, 15, 20, 25, 30],
            'rsi_min': [30, 35, 40, 45],
            'rsi_max': [65, 70, 75, 80],
        },
        'exit': {
            'target_pct': [0.06, 0.08, 0.10, 0.12, 0.15],
            'stop_atr_mult': [1.0, 1.5, 2.0, 2.5],
            'time_stop_days': [15, 20, 25, 30],
        }
    },
    
    'gap_up_momentum': {
        'entry': {
            'gap_pct_threshold': [0.02, 0.03, 0.04, 0.05],
            'rvol_threshold': [1.5, 2.0, 2.5, 3.0],
        },
        'exit': {
            'breakdown_ma_dist': [-0.01, -0.02, -0.03, -0.04],
            'time_stop_days': [5, 7, 10, 15, 20],
        }
    },
    
    'acceleration_turn': {
        'entry': {
            'rsi_min': [20, 25, 30, 35],
            'rsi_max': [50, 55, 60, 65, 70],
        },
        'exit': {
            'target_pct': [0.05, 0.06, 0.08, 0.10, 0.12],
            'stop_atr_mult': [1.5, 2.0, 2.5, 3.0],
            'time_stop_days': [10, 15, 20, 25],
        }
    },
    
    'trend_pullback_50ma': {
        'entry': {
            'ma_dist_50_min': [-0.05, -0.04, -0.03, -0.02],
            'ma_dist_50_max': [0.01, 0.02, 0.03, 0.04],
            'rsi_threshold': [40, 45, 50, 55, 60],
        },
        'exit': {
            'breakdown_ma_dist_200': [-0.01, -0.02, -0.03, -0.04],
            'trailing_activation_pct': [0.10, 0.12, 0.15, 0.18, 0.20],
            'trailing_atr_mult': [2.0, 2.5, 3.0, 3.5, 4.0],
            'max_hold_days': [60, 90, 120, 150, 180],
        }
    },
    
    'golden_cross': {
        'entry': {
            'ma_dist_50_min': [-0.04, -0.03, -0.02, -0.01],
            'ma_dist_50_max': [0.03, 0.05, 0.07, 0.10],
            'rsi_min': [40, 45, 50, 55],
            'rsi_max': [60, 65, 70, 75],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.02, -0.03, -0.04, -0.05],
            'trailing_activation_pct': [0.15, 0.20, 0.25, 0.30],
            'trailing_atr_mult': [2.5, 3.0, 3.5, 4.0],
            'max_hold_days': [90, 120, 150, 180, 240],
        }
    },
    
    'rs_breakout': {
        'entry': {
            'rsi_min': [40, 45, 50, 55, 60],
            'rsi_max': [60, 65, 70, 75, 80],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.02, -0.03, -0.04, -0.05],
            'trailing_activation_pct': [0.10, 0.12, 0.15, 0.18, 0.20],
            'trailing_atr_mult': [2.0, 2.5, 3.0, 3.5],
            'max_hold_days': [60, 90, 120, 150],
        }
    },
    
    'breakout_confirmed': {
        'entry': {
            'rvol_threshold': [1.0, 1.2, 1.5, 1.8, 2.0],
            'rsi_min': [45, 50, 55, 60],
            'rsi_max': [65, 70, 75, 80],
        },
        'exit': {
            'breakdown_ma_dist_20': [-0.02, -0.03, -0.04, -0.05],
            'trailing_activation_pct': [0.08, 0.10, 0.12, 0.15],
            'trailing_atr_mult': [2.0, 2.5, 3.0],
            'max_hold_days': [45, 60, 90, 120],
        }
    },
}


# =============================================================================
# SANDBOX CODE TEMPLATE
# =============================================================================

SANDBOX_CODE_TEMPLATE = '''
import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime
import json
import warnings
warnings.filterwarnings('ignore')

# Database config
DB_CONFIG = {db_config}

# Constants
FRICTION = 0.0015
BACKTEST_START = '2024-01-02'
BACKTEST_END = '2026-01-20'
UNIVERSE_LIMIT = 1000

# Parameters to test
SETUP_NAME = "{setup_name}"
PARAM_COMBINATIONS = {param_combinations}

def load_all_data():
    """Load all data into a single DataFrame"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Get universe
    cur.execute("""
        WITH recent_liquidity AS (
            SELECT df.asset_id, AVG(df.dollar_volume)::float as avg_dollar_volume, AVG(df.close)::float as avg_price
            FROM daily_features df WHERE df.date >= '2026-01-01' GROUP BY df.asset_id
        )
        SELECT a.asset_id, a.symbol FROM assets a
        JOIN recent_liquidity rl ON a.asset_id = rl.asset_id
        WHERE a.asset_type = 'equity' AND rl.avg_price >= 5 AND rl.avg_price <= 10000 AND rl.avg_dollar_volume > 1000000
        ORDER BY rl.avg_dollar_volume DESC LIMIT %s
    """, (UNIVERSE_LIMIT,))
    universe = cur.fetchall()
    asset_ids = [a[0] for a in universe]
    
    # Load features
    cur.execute("""
        SELECT df.asset_id, df.date, df.close, df.rsi_14, df.ma_dist_20, df.ma_dist_50, 
               df.ma_dist_200, df.ma_slope_50, df.above_ma200, df.ma50_above_ma200,
               df.bb_width_pctile, df.rvol_20, df.gap_pct, df.accel_turn_up, df.rs_breakout,
               df.breakout_confirmed_up, df.atr_14, df.atr_pct
        FROM daily_features df WHERE df.asset_id = ANY(%s) AND df.date >= %s AND df.date <= %s
        ORDER BY df.asset_id, df.date
    """, (asset_ids, BACKTEST_START, BACKTEST_END))
    
    rows = cur.fetchall()
    conn.close()
    
    columns = ['asset_id', 'date', 'close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 
               'ma_slope_50', 'above_ma200', 'ma50_above_ma200', 'bb_width_pctile', 'rvol_20', 
               'gap_pct', 'accel_turn_up', 'rs_breakout', 'breakout_confirmed_up', 'atr_14', 'atr_pct']
    
    df = pd.DataFrame(rows, columns=columns)
    df['date'] = pd.to_datetime(df['date'])
    
    for col in ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'ma_slope_50', 
                'bb_width_pctile', 'rvol_20', 'gap_pct', 'atr_14', 'atr_pct']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return universe, df

def get_entry_signals(df, setup_name, params):
    """Get entry signals for a setup"""
    if setup_name == 'oversold_bounce':
        mask = ((df['rsi_14'] < params.get('rsi_threshold', 30)) & 
                (df['ma_dist_20'] < params.get('ma_dist_20_threshold', -0.08)) & 
                (df['above_ma200'] == True))
    elif setup_name == 'vcp_squeeze':
        mask = ((df['bb_width_pctile'] < params.get('bb_width_pctile_threshold', 20)) & 
                (df['ma_dist_50'] > 0) & (df['above_ma200'] == True) & 
                (df['rsi_14'] >= params.get('rsi_min', 40)) & (df['rsi_14'] <= params.get('rsi_max', 70)))
    elif setup_name == 'gap_up_momentum':
        mask = ((df['gap_pct'] > params.get('gap_pct_threshold', 0.03)) & 
                (df['rvol_20'] > params.get('rvol_threshold', 2.0)) & (df['ma_dist_20'] > 0))
    elif setup_name == 'acceleration_turn':
        mask = ((df['accel_turn_up'] == True) & (df['above_ma200'] == True) & 
                (df['rsi_14'] >= params.get('rsi_min', 30)) & (df['rsi_14'] <= params.get('rsi_max', 60)))
    elif setup_name == 'trend_pullback_50ma':
        mask = ((df['ma_dist_50'] >= params.get('ma_dist_50_min', -0.03)) & 
                (df['ma_dist_50'] <= params.get('ma_dist_50_max', 0.02)) & 
                (df['above_ma200'] == True) & (df['rsi_14'] < params.get('rsi_threshold', 50)) & 
                (df['ma_slope_50'] > 0))
    elif setup_name == 'golden_cross':
        mask = ((df['ma50_above_ma200'] == True) & 
                (df['ma_dist_50'] >= params.get('ma_dist_50_min', -0.02)) & 
                (df['ma_dist_50'] <= params.get('ma_dist_50_max', 0.05)) & 
                (df['rsi_14'] >= params.get('rsi_min', 45)) & (df['rsi_14'] <= params.get('rsi_max', 65)) & 
                (df['ma_slope_50'] > 0))
    elif setup_name == 'rs_breakout':
        mask = ((df['rs_breakout'] == True) & (df['above_ma200'] == True) & 
                (df['rsi_14'] >= params.get('rsi_min', 50)) & (df['rsi_14'] <= params.get('rsi_max', 70)))
    elif setup_name == 'breakout_confirmed':
        mask = ((df['breakout_confirmed_up'] == True) & 
                (df['rvol_20'] > params.get('rvol_threshold', 1.5)) & 
                (df['rsi_14'] >= params.get('rsi_min', 50)) & (df['rsi_14'] <= params.get('rsi_max', 75)))
    else:
        mask = pd.Series([False] * len(df))
    return df[mask].copy()

def simulate_trades_for_asset(asset_df, entry_signals, exit_params):
    """Simulate trades for a single asset"""
    trades = []
    if len(entry_signals) == 0:
        return trades
    
    asset_df = asset_df.reset_index(drop=True)
    asset_df['idx'] = range(len(asset_df))
    date_to_idx = dict(zip(asset_df['date'], asset_df['idx']))
    
    last_exit_idx = -1
    
    for _, signal in entry_signals.iterrows():
        entry_date = signal['date']
        if entry_date not in date_to_idx:
            continue
        entry_idx = date_to_idx[entry_date]
        if entry_idx <= last_exit_idx:
            continue
        
        entry_price = float(signal['close'])
        entry_atr = float(signal['atr_14']) if pd.notna(signal['atr_14']) else entry_price * 0.02
        
        stop_loss = entry_price - (entry_atr * exit_params.get('stop_atr_mult', 2.0)) if 'stop_atr_mult' in exit_params else None
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
            estimated_high = close + atr * 0.5
            estimated_low = close - atr * 0.5
            
            if estimated_high > highest_price:
                highest_price = estimated_high
            
            if 'trailing_activation_pct' in exit_params:
                gain_pct = (highest_price - entry_price) / entry_price
                if gain_pct >= exit_params['trailing_activation_pct'] and not trailing_activated:
                    trailing_activated = True
                    trailing_stop = highest_price - exit_params.get('trailing_atr_mult', 3.0) * entry_atr
            
            if trailing_activated:
                new_ts = highest_price - exit_params.get('trailing_atr_mult', 3.0) * entry_atr
                if trailing_stop is None or new_ts > trailing_stop:
                    trailing_stop = new_ts
            
            if stop_loss and estimated_low <= stop_loss:
                exit_idx, exit_price, exit_reason = i, stop_loss, 'stop_loss'
                break
            if trailing_stop and estimated_low <= trailing_stop:
                exit_idx, exit_price, exit_reason = i, trailing_stop, 'trailing_stop'
                break
            if take_profit and estimated_high >= take_profit:
                exit_idx, exit_price, exit_reason = i, take_profit, 'take_profit'
                break
            if 'target_ma_dist' in exit_params:
                if pd.notna(row['ma_dist_20']) and row['ma_dist_20'] >= exit_params['target_ma_dist']:
                    exit_idx, exit_price, exit_reason = i, close, 'target_ma'
                    break
            for key, col in [('breakdown_ma_dist_200', 'ma_dist_200'), ('breakdown_ma_dist_50', 'ma_dist_50'), 
                             ('breakdown_ma_dist_20', 'ma_dist_20'), ('breakdown_ma_dist', 'ma_dist_20')]:
                if key in exit_params and pd.notna(row[col]) and row[col] < exit_params[key]:
                    exit_idx, exit_price, exit_reason = i, close, 'breakdown_ma'
                    break
            if exit_idx is not None:
                break
        
        if exit_idx is None:
            exit_idx = min(entry_idx + max_hold, len(asset_df) - 1)
            exit_price = float(asset_df.iloc[exit_idx]['close'])
            exit_reason = 'time_stop'
        
        return_pct = (exit_price * (1 - FRICTION)) / (entry_price * (1 + FRICTION)) - 1
        trades.append({{'return_pct': return_pct, 'hold_days': exit_idx - entry_idx, 'exit_reason': exit_reason}})
        last_exit_idx = exit_idx
    
    return trades

def backtest_params(setup_name, entry_params, exit_params, all_data, universe):
    """Run backtest for a single parameter combination"""
    entry_signals = get_entry_signals(all_data, setup_name, entry_params)
    if len(entry_signals) == 0:
        return {{'trades': 0, 'win_rate': 0, 'profit_factor': 0, 'avg_return': 0, 'avg_hold_days': 0, 'score': 0}}
    
    all_trades = []
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
        return {{'trades': 0, 'win_rate': 0, 'profit_factor': 0, 'avg_return': 0, 'avg_hold_days': 0, 'score': 0}}
    
    returns = [t['return_pct'] for t in all_trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r <= 0]
    
    win_rate = len(wins) / len(returns) if returns else 0
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0.0001
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    avg_return = np.mean(returns) if returns else 0
    avg_hold = np.mean([t['hold_days'] for t in all_trades]) if all_trades else 0
    
    min_trades = 50
    trade_factor = min(1.0, len(all_trades) / min_trades)
    score = profit_factor * np.sqrt(len(all_trades)) * (1 + avg_return) * trade_factor
    
    return {{
        'trades': len(all_trades),
        'win_rate': round(win_rate * 100, 1),
        'profit_factor': round(profit_factor, 3),
        'avg_return': round(avg_return * 100, 3),
        'avg_hold_days': round(avg_hold, 1),
        'score': round(score, 3),
    }}

# Main execution
print(f"Loading data for {{SETUP_NAME}}...")
universe, all_data = load_all_data()
print(f"Loaded {{len(all_data)}} rows, {{len(universe)}} assets")

results = []
for i, (entry_params, exit_params) in enumerate(PARAM_COMBINATIONS):
    result = backtest_params(SETUP_NAME, entry_params, exit_params, all_data, universe)
    result['entry_params'] = entry_params
    result['exit_params'] = exit_params
    results.append(result)
    if (i + 1) % 5 == 0:
        print(f"Progress: {{i+1}}/{{len(PARAM_COMBINATIONS)}}")

# Find best result
best_result = max([r for r in results if r['trades'] >= 30], key=lambda x: x['score'], default=None)

output = {{
    'setup': SETUP_NAME,
    'total_combinations': len(PARAM_COMBINATIONS),
    'best_result': best_result,
    'all_results': results
}}

print(json.dumps(output))
'''


def generate_param_combinations(setup_name: str) -> List[tuple]:
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


def run_sandbox(setup_name: str, param_chunk: List[tuple], chunk_id: int) -> Dict:
    """Run optimization in a single e2b sandbox"""
    print(f"[{setup_name}][chunk-{chunk_id}] Starting sandbox with {len(param_chunk)} combinations...")
    
    try:
        # Create sandbox
        sbx = Sandbox(timeout=600)  # 10 minute timeout
        
        # Install dependencies
        sbx.commands.run("pip install psycopg2-binary pandas numpy --quiet")
        
        # Generate code
        code = SANDBOX_CODE_TEMPLATE.format(
            db_config=json.dumps(DB_CONFIG),
            setup_name=setup_name,
            param_combinations=json.dumps(param_chunk)
        )
        
        # Execute
        execution = sbx.run_code(code)
        
        # Parse output
        output_text = execution.text
        
        # Find JSON in output
        json_start = output_text.rfind('{"setup"')
        if json_start >= 0:
            json_str = output_text[json_start:]
            result = json.loads(json_str)
            result['chunk_id'] = chunk_id
            print(f"[{setup_name}][chunk-{chunk_id}] Completed - {len(param_chunk)} combinations tested")
            sbx.kill()
            return result
        else:
            print(f"[{setup_name}][chunk-{chunk_id}] No JSON output found")
            print(f"Output: {output_text[:500]}")
            sbx.kill()
            return {'setup': setup_name, 'chunk_id': chunk_id, 'error': 'No JSON output', 'output': output_text[:1000]}
    
    except Exception as e:
        print(f"[{setup_name}][chunk-{chunk_id}] Error: {str(e)}")
        return {'setup': setup_name, 'chunk_id': chunk_id, 'error': str(e)}


def optimize_setup_parallel(setup_name: str, max_sandboxes: int = 10) -> Dict:
    """Optimize a setup using multiple parallel sandboxes"""
    print(f"\n{'='*60}")
    print(f"Optimizing: {setup_name}")
    print('='*60)
    
    # Generate all combinations
    all_combos = generate_param_combinations(setup_name)
    total_combos = len(all_combos)
    print(f"Total combinations: {total_combos}")
    
    # Split into chunks for parallel processing
    chunk_size = max(1, total_combos // max_sandboxes)
    chunks = [all_combos[i:i+chunk_size] for i in range(0, total_combos, chunk_size)]
    num_chunks = len(chunks)
    print(f"Splitting into {num_chunks} chunks of ~{chunk_size} combinations each")
    
    # Run in parallel
    start_time = time.time()
    all_results = []
    
    with ThreadPoolExecutor(max_workers=max_sandboxes) as executor:
        futures = {
            executor.submit(run_sandbox, setup_name, chunk, i): i 
            for i, chunk in enumerate(chunks)
        }
        
        for future in as_completed(futures):
            chunk_id = futures[future]
            try:
                result = future.result()
                all_results.append(result)
            except Exception as e:
                print(f"[{setup_name}][chunk-{chunk_id}] Failed: {e}")
    
    elapsed = time.time() - start_time
    print(f"[{setup_name}] All chunks completed in {elapsed:.1f}s")
    
    # Aggregate results
    all_param_results = []
    for r in all_results:
        if 'all_results' in r:
            all_param_results.extend(r['all_results'])
    
    # Find best overall
    valid_results = [r for r in all_param_results if r.get('trades', 0) >= 30]
    best_result = max(valid_results, key=lambda x: x['score']) if valid_results else None
    
    if best_result:
        print(f"[{setup_name}] BEST: PF={best_result['profit_factor']}, WR={best_result['win_rate']}%, "
              f"Trades={best_result['trades']}, Score={best_result['score']}")
        print(f"  Entry: {best_result['entry_params']}")
        print(f"  Exit: {best_result['exit_params']}")
    
    return {
        'setup': setup_name,
        'total_combinations': total_combos,
        'elapsed_seconds': round(elapsed, 1),
        'best_result': best_result,
        'top_10_results': sorted(all_param_results, key=lambda x: x.get('score', 0), reverse=True)[:10],
    }


def main():
    print("="*70)
    print("E2B PARALLEL PARAMETER OPTIMIZER")
    print("="*70)
    
    setups = list(PARAMETER_GRIDS.keys())
    
    # Calculate total combinations
    total_all = 0
    for setup in setups:
        combos = generate_param_combinations(setup)
        print(f"  {setup}: {len(combos)} combinations")
        total_all += len(combos)
    print(f"  TOTAL: {total_all} combinations across all setups")
    print("="*70)
    
    start_time = time.time()
    
    # Run each setup with parallel sandboxes
    # Use 8-10 sandboxes per setup to stay within limits
    all_results = []
    for setup_name in setups:
        result = optimize_setup_parallel(setup_name, max_sandboxes=8)
        all_results.append(result)
        
        # Save intermediate results
        output_file = os.path.join(OUTPUT_DIR, f'{setup_name}_optimized.json')
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
    
    total_elapsed = time.time() - start_time
    
    # Summary
    print("\n" + "="*70)
    print("OPTIMIZATION COMPLETE")
    print("="*70)
    print(f"Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} minutes)")
    
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
    print("-"*70)
    for i, s in enumerate(summary, 1):
        print(f"\n{i}. {s['setup']}")
        print(f"   PF={s['profit_factor']}, WR={s['win_rate']}%, AvgRet={s['avg_return']}%, Trades={s['trades']}")
        print(f"   Entry: {s['entry_params']}")
        print(f"   Exit: {s['exit_params']}")
    
    # Save aggregate
    aggregate_file = os.path.join(OUTPUT_DIR, 'all_setups_optimized.json')
    with open(aggregate_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_elapsed_seconds': round(total_elapsed, 1),
            'summary': summary,
            'detailed_results': all_results,
        }, f, indent=2)
    
    print(f"\nResults saved to {aggregate_file}")
    
    return summary


if __name__ == '__main__':
    main()

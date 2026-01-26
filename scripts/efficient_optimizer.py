#!/usr/bin/env python3
"""
Efficient Parameter Optimizer for Stratos Brain
Optimizes both entry conditions and exit parameters with smaller grids
and periodic yields to prevent CPU lockup.
"""

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Tuple, Any
import json
import argparse
import warnings
import itertools
import time
import sys
warnings.filterwarnings('ignore')

# Database connection
DB_CONFIG = {
    'host': 'db.wfogbaipiqootjrsprde.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': 'stratosbrainpostgresdbpw'
}

FRICTION = 0.0015
BACKTEST_START = '2024-01-02'
BACKTEST_END = '2026-01-20'


# =============================================================================
# REDUCED PARAMETER GRIDS (fewer combinations)
# =============================================================================

OPTIMIZATION_GRIDS = {
    'oversold_bounce': {
        'entry': {
            'rsi_threshold': [25, 30, 35],
            'ma_dist_threshold': [-0.06, -0.10],
        },
        'exit': {
            'target_ma_dist': [0, 0.02],
            'stop_atr_mult': [1.5, 2.0],
            'time_stop_days': [10, 15],
        }
    },
    
    'vcp_squeeze': {
        'entry': {
            'bb_width_pctile_threshold': [15, 20],
            'rsi_min': [40, 45],
            'rsi_max': [65, 70],
        },
        'exit': {
            'target_pct': [0.10, 0.12],
            'stop_atr_mult': [1.5, 2.0],
            'time_stop_days': [15, 20],
        }
    },
    
    'gap_up_momentum': {
        'entry': {
            'gap_threshold': [0.03, 0.04],
            'rvol_threshold': [2.0, 2.5],
        },
        'exit': {
            'breakdown_ma_dist': [-0.02, -0.03],
            'time_stop_days': [10, 15],
        }
    },
    
    'acceleration_turn': {
        'entry': {
            'rsi_min': [30, 35],
            'rsi_max': [55, 60],
        },
        'exit': {
            'target_pct': [0.08, 0.10],
            'stop_atr_mult': [1.5, 2.0],
            'time_stop_days': [10, 15],
        }
    },
    
    'trend_pullback_50ma': {
        'entry': {
            'ma_dist_min': [-0.03, -0.02],
            'ma_dist_max': [0.02, 0.03],
            'rsi_threshold': [45, 50],
        },
        'exit': {
            'breakdown_ma_dist_200': [-0.02, -0.03],
            'trailing_activation_pct': [0.15, 0.20],
            'trailing_atr_mult': [3.0, 3.5],
            'max_hold_days': [90, 120],
        }
    },
    
    'golden_cross': {
        'entry': {
            'ma_dist_min': [-0.02, -0.01],
            'ma_dist_max': [0.03, 0.05],
            'rsi_min': [45, 50],
            'rsi_max': [60, 65],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.03, -0.05],
            'trailing_activation_pct': [0.15, 0.20],
            'trailing_atr_mult': [3.0, 3.5],
            'max_hold_days': [120, 180],
        }
    },
    
    'rs_breakout': {
        'entry': {
            'rsi_min': [50, 55],
            'rsi_max': [65, 70],
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.03, -0.04],
            'trailing_activation_pct': [0.15, 0.20],
            'trailing_atr_mult': [3.0, 3.5],
            'max_hold_days': [90, 120],
        }
    },
    
    'breakout_confirmed': {
        'entry': {
            'rvol_threshold': [1.5, 2.0],
            'rsi_min': [50, 55],
            'rsi_max': [70, 75],
        },
        'exit': {
            'breakdown_ma_dist_20': [-0.03, -0.04],
            'trailing_activation_pct': [0.10, 0.15],
            'trailing_atr_mult': [2.5, 3.0],
            'max_hold_days': [60, 90],
        }
    },
}


def get_universe(conn, limit: int = 200) -> List[Tuple[int, str]]:
    """Get top assets by recent dollar volume"""
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
        AND rl.avg_dollar_volume > 10000000
        ORDER BY rl.avg_dollar_volume DESC
        LIMIT %s
    ''', (limit,))
    return cur.fetchall()


def load_all_data(conn, universe: List[Tuple[int, str]]) -> Dict[int, pd.DataFrame]:
    """Load all data upfront for faster optimization"""
    print("Loading all asset data...")
    sys.stdout.flush()
    data = {}
    
    cur = conn.cursor()
    
    for i, (asset_id, symbol) in enumerate(universe):
        if i % 50 == 0:
            print(f"  Loading {i+1}/{len(universe)}")
            sys.stdout.flush()
        
        cur.execute('''
            SELECT 
                df.date, df.close, df.rsi_14, df.ma_dist_20, df.ma_dist_50, df.ma_dist_200,
                df.ma_slope_20, df.ma_slope_50, df.ma_slope_200, df.above_ma200, df.ma50_above_ma200,
                df.bb_width_pctile, df.rvol_20, df.gap_pct, df.accel_turn_up, df.rs_breakout,
                df.breakout_confirmed_up, df.atr_14, df.atr_pct, df.sma_20, df.sma_50, df.sma_200
            FROM daily_features df
            WHERE df.asset_id = %s AND df.date >= %s AND df.date <= %s
            ORDER BY df.date
        ''', (asset_id, BACKTEST_START, BACKTEST_END))
        
        rows = cur.fetchall()
        if len(rows) < 50:
            continue
        
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
        
        df['symbol'] = symbol
        data[asset_id] = df
    
    print(f"Loaded data for {len(data)} assets")
    sys.stdout.flush()
    return data


def check_entry(row: pd.Series, setup_name: str, params: Dict) -> bool:
    """Check entry conditions with parameterized thresholds"""
    
    if setup_name == 'oversold_bounce':
        rsi = row.get('rsi_14')
        ma_dist = row.get('ma_dist_20')
        above_200 = row.get('above_ma200')
        if pd.isna(rsi) or pd.isna(ma_dist) or not above_200:
            return False
        return (rsi < params.get('rsi_threshold', 30) and 
                ma_dist < params.get('ma_dist_threshold', -0.08))
    
    elif setup_name == 'vcp_squeeze':
        bb = row.get('bb_width_pctile')
        ma_dist_50 = row.get('ma_dist_50')
        above_200 = row.get('above_ma200')
        rsi = row.get('rsi_14')
        if pd.isna(bb) or pd.isna(rsi) or not above_200:
            return False
        return (bb < params.get('bb_width_pctile_threshold', 20) and
                ma_dist_50 is not None and ma_dist_50 > 0 and
                params.get('rsi_min', 40) <= rsi <= params.get('rsi_max', 70))
    
    elif setup_name == 'gap_up_momentum':
        gap = row.get('gap_pct')
        rvol = row.get('rvol_20')
        ma_dist = row.get('ma_dist_20')
        if pd.isna(gap) or pd.isna(rvol) or pd.isna(ma_dist):
            return False
        return (gap > params.get('gap_threshold', 0.03) and
                rvol > params.get('rvol_threshold', 2.0) and
                ma_dist > 0)
    
    elif setup_name == 'acceleration_turn':
        accel = row.get('accel_turn_up')
        above_200 = row.get('above_ma200')
        rsi = row.get('rsi_14')
        if not accel or not above_200 or pd.isna(rsi):
            return False
        return params.get('rsi_min', 30) <= rsi <= params.get('rsi_max', 60)
    
    elif setup_name == 'trend_pullback_50ma':
        ma_dist_50 = row.get('ma_dist_50')
        above_200 = row.get('above_ma200')
        rsi = row.get('rsi_14')
        ma_slope = row.get('ma_slope_50')
        if pd.isna(ma_dist_50) or not above_200 or pd.isna(rsi) or pd.isna(ma_slope):
            return False
        return (params.get('ma_dist_min', -0.03) <= ma_dist_50 <= params.get('ma_dist_max', 0.02) and
                rsi < params.get('rsi_threshold', 50) and
                ma_slope > 0)
    
    elif setup_name == 'golden_cross':
        ma50_above = row.get('ma50_above_ma200')
        ma_dist_50 = row.get('ma_dist_50')
        rsi = row.get('rsi_14')
        ma_slope = row.get('ma_slope_50')
        if not ma50_above or pd.isna(ma_dist_50) or pd.isna(rsi) or pd.isna(ma_slope):
            return False
        return (params.get('ma_dist_min', -0.02) <= ma_dist_50 <= params.get('ma_dist_max', 0.05) and
                params.get('rsi_min', 45) <= rsi <= params.get('rsi_max', 65) and
                ma_slope > 0)
    
    elif setup_name == 'rs_breakout':
        rs = row.get('rs_breakout')
        above_200 = row.get('above_ma200')
        rsi = row.get('rsi_14')
        if not rs or not above_200 or pd.isna(rsi):
            return False
        return params.get('rsi_min', 50) <= rsi <= params.get('rsi_max', 70)
    
    elif setup_name == 'breakout_confirmed':
        breakout = row.get('breakout_confirmed_up')
        rvol = row.get('rvol_20')
        rsi = row.get('rsi_14')
        if not breakout or pd.isna(rvol) or pd.isna(rsi):
            return False
        return (rvol > params.get('rvol_threshold', 1.5) and
                params.get('rsi_min', 50) <= rsi <= params.get('rsi_max', 75))
    
    return False


def simulate_trade(df: pd.DataFrame, entry_idx: int, params: Dict) -> Tuple[int, float, str]:
    """Simulate a trade with parameterized exits"""
    entry_row = df.iloc[entry_idx]
    entry_price = float(entry_row['close'])
    entry_atr = float(entry_row['atr_14']) if pd.notna(entry_row['atr_14']) else entry_price * 0.02
    
    stop_loss = None
    take_profit = None
    trailing_stop = None
    trailing_activated = False
    highest_price = entry_price
    
    if 'stop_atr_mult' in params:
        stop_loss = entry_price - (entry_atr * params['stop_atr_mult'])
    
    if 'target_pct' in params:
        take_profit = entry_price * (1 + params['target_pct'])
    
    max_hold = params.get('max_hold_days', params.get('time_stop_days', 60))
    
    for i in range(entry_idx + 1, min(entry_idx + max_hold + 1, len(df))):
        row = df.iloc[i]
        close = float(row['close'])
        atr = float(row['atr_14']) if pd.notna(row['atr_14']) else entry_atr
        
        estimated_high = close + atr * 0.5
        estimated_low = close - atr * 0.5
        
        if estimated_high > highest_price:
            highest_price = estimated_high
        
        # Trailing stop activation
        if 'trailing_activation_pct' in params:
            gain_pct = (highest_price - entry_price) / entry_price
            if gain_pct >= params['trailing_activation_pct'] and not trailing_activated:
                trailing_activated = True
                trail_atr = params.get('trailing_atr_mult', 3.0) * entry_atr
                trailing_stop = highest_price - trail_atr
        
        if trailing_activated:
            trail_atr = params.get('trailing_atr_mult', 3.0) * entry_atr
            new_trailing_stop = highest_price - trail_atr
            if trailing_stop is None or new_trailing_stop > trailing_stop:
                trailing_stop = new_trailing_stop
        
        # Check exits
        if stop_loss and estimated_low <= stop_loss:
            return i, stop_loss, 'stop_loss'
        
        if trailing_stop and estimated_low <= trailing_stop:
            return i, trailing_stop, 'trailing_stop'
        
        if take_profit and estimated_high >= take_profit:
            return i, take_profit, 'take_profit'
        
        if 'target_ma_dist' in params:
            ma_dist = row['ma_dist_20']
            if pd.notna(ma_dist) and ma_dist >= params['target_ma_dist']:
                return i, close, 'target_ma'
        
        # Check breakdown
        for key in ['breakdown_ma_dist_200', 'breakdown_ma_dist_50', 'breakdown_ma_dist_20', 'breakdown_ma_dist']:
            if key in params:
                if '200' in key:
                    ma_dist = row['ma_dist_200']
                elif '50' in key:
                    ma_dist = row['ma_dist_50']
                else:
                    ma_dist = row['ma_dist_20']
                
                if pd.notna(ma_dist) and ma_dist < params[key]:
                    return i, close, 'breakdown_ma'
    
    exit_idx = min(entry_idx + max_hold, len(df) - 1)
    return exit_idx, float(df.iloc[exit_idx]['close']), 'time_stop'


def run_backtest_with_params(
    data: Dict[int, pd.DataFrame],
    setup_name: str,
    params: Dict
) -> Dict:
    """Run backtest with specific parameters"""
    trades = []
    
    for asset_id, df in data.items():
        if len(df) < 50:
            continue
        
        last_exit_idx = 0
        
        for idx in range(20, len(df)):
            if idx <= last_exit_idx:
                continue
            
            row = df.iloc[idx]
            
            if check_entry(row, setup_name, params):
                exit_idx, exit_price, exit_reason = simulate_trade(df, idx, params)
                
                entry_price = float(row['close'])
                entry_price_adj = entry_price * (1 + FRICTION)
                exit_price_adj = exit_price * (1 - FRICTION)
                
                return_pct = (exit_price_adj / entry_price_adj) - 1
                hold_days = exit_idx - idx
                
                trades.append({
                    'return': return_pct,
                    'hold_days': hold_days,
                    'exit_reason': exit_reason
                })
                
                last_exit_idx = exit_idx
    
    if not trades:
        return {'trades': 0, 'win_rate': 0, 'profit_factor': 0, 'avg_return': 0, 'avg_hold': 0, 'score': 0}
    
    returns = [t['return'] for t in trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r <= 0]
    
    win_rate = len(wins) / len(returns) if returns else 0
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0.0001
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    avg_return = np.mean(returns) if returns else 0
    avg_hold = np.mean([t['hold_days'] for t in trades]) if trades else 0
    
    # Calculate reliability score
    trade_count_score = min(len(trades) / 100, 1.0) * 15
    win_rate_score = (win_rate / 0.7) * 30 if win_rate <= 0.7 else 30
    pf_score = min(profit_factor / 2.5, 1.0) * 30
    return_score = min(avg_return / 0.05, 1.0) * 25
    
    score = trade_count_score + win_rate_score + pf_score + return_score
    
    return {
        'trades': len(trades),
        'win_rate': round(win_rate * 100, 1),
        'profit_factor': round(profit_factor, 2),
        'avg_return': round(avg_return * 100, 2),
        'avg_hold': round(avg_hold, 1),
        'score': round(score, 1)
    }


def optimize_setup(
    data: Dict[int, pd.DataFrame],
    setup_name: str,
    verbose: bool = True
) -> Dict:
    """Optimize parameters for a single setup"""
    
    if setup_name not in OPTIMIZATION_GRIDS:
        print(f"No optimization grid for {setup_name}")
        return None
    
    grid = OPTIMIZATION_GRIDS[setup_name]
    
    # Generate all parameter combinations
    entry_keys = list(grid['entry'].keys())
    entry_values = list(grid['entry'].values())
    entry_combos = list(itertools.product(*entry_values))
    
    exit_keys = list(grid['exit'].keys())
    exit_values = list(grid['exit'].values())
    exit_combos = list(itertools.product(*exit_values))
    
    total_combos = len(entry_combos) * len(exit_combos)
    
    if verbose:
        print(f"\nOptimizing {setup_name}: {total_combos} parameter combinations")
        sys.stdout.flush()
    
    best_result = None
    best_params = None
    best_score = 0
    
    tested = 0
    for entry_combo in entry_combos:
        entry_params = dict(zip(entry_keys, entry_combo))
        
        for exit_combo in exit_combos:
            exit_params = dict(zip(exit_keys, exit_combo))
            
            params = {**entry_params, **exit_params}
            
            result = run_backtest_with_params(data, setup_name, params)
            
            tested += 1
            
            # Periodic yield to prevent CPU lockup
            if tested % 10 == 0:
                time.sleep(0.01)
            
            if verbose and tested % 20 == 0:
                print(f"  Tested {tested}/{total_combos} combinations...")
                sys.stdout.flush()
            
            if result['score'] > best_score and result['trades'] >= 30:
                best_score = result['score']
                best_result = result
                best_params = params
                
                if verbose:
                    print(f"  New best: Score={result['score']}, PF={result['profit_factor']}, WR={result['win_rate']}%, Trades={result['trades']}")
                    sys.stdout.flush()
    
    return {
        'setup': setup_name,
        'best_params': best_params,
        'best_result': best_result,
        'combinations_tested': total_combos
    }


def main():
    parser = argparse.ArgumentParser(description='Efficient Parameter Optimizer')
    parser.add_argument('--setup', type=str, help='Specific setup to optimize')
    parser.add_argument('--universe', type=int, default=200, help='Number of assets')
    parser.add_argument('--output', type=str, default='./data/optimization_results.json')
    
    args = parser.parse_args()
    
    print(f"Starting optimization with {args.universe} assets...")
    sys.stdout.flush()
    
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get universe and load data
    universe = get_universe(conn, args.universe)
    data = load_all_data(conn, universe)
    
    conn.close()
    
    # Run optimization
    results = {}
    
    setups_to_optimize = [args.setup] if args.setup else list(OPTIMIZATION_GRIDS.keys())
    
    for setup_name in setups_to_optimize:
        print(f"\n{'='*60}")
        print(f"Optimizing: {setup_name}")
        print('='*60)
        sys.stdout.flush()
        
        result = optimize_setup(data, setup_name)
        if result:
            results[setup_name] = result
            
            print(f"\nBest result for {setup_name}:")
            print(f"  Params: {result['best_params']}")
            print(f"  Trades: {result['best_result']['trades']}")
            print(f"  Win Rate: {result['best_result']['win_rate']}%")
            print(f"  Profit Factor: {result['best_result']['profit_factor']}")
            print(f"  Avg Return: {result['best_result']['avg_return']}%")
            print(f"  Score: {result['best_result']['score']}")
            sys.stdout.flush()
    
    # Summary
    print(f"\n{'='*60}")
    print("OPTIMIZATION SUMMARY")
    print('='*60)
    sys.stdout.flush()
    
    sorted_results = sorted(results.items(), key=lambda x: x[1]['best_result']['score'] if x[1]['best_result'] else 0, reverse=True)
    for rank, (name, r) in enumerate(sorted_results, 1):
        if r['best_result']:
            br = r['best_result']
            print(f"{rank}. {name}: Score={br['score']}, PF={br['profit_factor']}, WR={br['win_rate']}%, Trades={br['trades']}")
        else:
            print(f"{rank}. {name}: No valid results")
    sys.stdout.flush()
    
    # Save results
    import os
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to {args.output}")
    sys.stdout.flush()


if __name__ == '__main__':
    main()

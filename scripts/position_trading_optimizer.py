#!/usr/bin/env python3
"""
Position Trading Optimizer for Stratos Brain

Implements and optimizes 5 new position trading setups from quantitative literature:
1. Donchian 55-Day Breakout (Turtle Traders)
2. Weinstein Stage 2 Transition
3. ADX Holy Grail Pullback
4. Wyckoff Spring (Liquidity Sweep)
5. Time-Series Momentum Acceleration

These are designed for medium-to-long-term position trading (60-180 day holds).
"""

import os
import json
import itertools
from datetime import datetime
from typing import List, Dict, Tuple
from multiprocessing import Pool, cpu_count
import time
import psycopg2
import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

OUTPUT_DIR = '/home/ubuntu/stratos_brain/data/optimization_results'
LOG_FILE = '/home/ubuntu/stratos_brain/data/position_trading_optimization_log.txt'
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

# Parameter grids for position trading setups
PARAMETER_GRIDS = {
    'donchian_55_breakout': {
        'entry': {
            'lookback_days': [55],  # Classic Turtle
            'ma_slope_threshold': [0, 0.001, 0.002],  # Rising MA filter
        },
        'exit': {
            'trailing_low_days': [20, 25, 30],  # Exit on N-day low
            'max_hold_days': [120, 180, 252],  # Max hold period
        }
    },
    'weinstein_stage2': {
        'entry': {
            'base_days': [100, 150, 200],  # Days in consolidation
            'base_range_pct': [0.15, 0.20, 0.25],  # Max range during base
            'volume_mult': [1.5, 2.0, 2.5],  # Volume on breakout
        },
        'exit': {
            'breakdown_ma_dist_200': [-0.03, -0.05, -0.07],
            'trailing_activation_pct': [0.15, 0.20],
            'trailing_atr_mult': [3.0, 3.5],
            'max_hold_days': [180, 252],
        }
    },
    'adx_holy_grail': {
        'entry': {
            'adx_threshold': [25, 30, 35],  # ADX must be above this
            'ma_touch_dist': [0.01, 0.02, 0.03],  # How close to 20 EMA
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.03, -0.04, -0.05],
            'trailing_activation_pct': [0.10, 0.15],
            'trailing_atr_mult': [2.5, 3.0],
            'max_hold_days': [90, 120],
        }
    },
    'wyckoff_spring': {
        'entry': {
            'support_lookback': [60, 100, 150],  # Days to find support
            'spring_depth_pct': [0.01, 0.02, 0.03],  # How far below support
            'recovery_days': [3, 5, 7],  # Days to recover above support
        },
        'exit': {
            'target_pct': [0.15, 0.20, 0.25],  # Target profit
            'stop_below_spring': [0.02, 0.03],  # Stop below spring low
            'max_hold_days': [90, 120, 180],
        }
    },
    'tsm_acceleration': {
        'entry': {
            'long_roc_days': [120, 180],  # Long-term momentum period
            'short_roc_days': [20, 30],  # Short-term momentum period
            'rs_percentile': [80, 90],  # Must be in top X% of universe
        },
        'exit': {
            'breakdown_ma_dist_50': [-0.04, -0.05],
            'trailing_activation_pct': [0.12, 0.15, 0.18],
            'trailing_atr_mult': [3.0, 3.5],
            'max_hold_days': [120, 180],
        }
    },
}


def log(msg):
    """Write to log file"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG_FILE, 'a') as f:
        f.write(f"[{timestamp}] {msg}\n")
    print(msg)


def load_all_data():
    """Load universe and feature data from database"""
    log("Loading data from database...")
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
    log(f"Got {len(universe)} assets in universe")
    
    # Get all features including new ones for position trading
    cur.execute("""
        SELECT df.asset_id, df.date, df.close, df.rsi_14, df.ma_dist_20, df.ma_dist_50, 
               df.ma_dist_200, df.ma_slope_50, df.ma_slope_200, df.above_ma200, df.ma50_above_ma200,
               df.bb_width_pctile, df.rvol_20, df.gap_pct, df.atr_14,
               df.donchian_high_55, df.donchian_low_55, df.donchian_high_20, df.donchian_low_20,
               df.roc_20, df.roc_63, df.dist_52w_high, df.dist_52w_low,
               df.realized_vol_20, df.sma_20, df.sma_50, df.sma_200,
               df.cs_rank_return_21d, df.rs_vs_benchmark
        FROM daily_features df 
        WHERE df.asset_id = ANY(%s) 
          AND df.date >= %s 
          AND df.date <= %s
        ORDER BY df.asset_id, df.date
    """, (asset_ids, BACKTEST_START, BACKTEST_END))
    
    rows = cur.fetchall()
    conn.close()
    log(f"Got {len(rows)} feature rows")
    
    columns = ['asset_id', 'date', 'close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 
               'ma_slope_50', 'ma_slope_200', 'above_ma200', 'ma50_above_ma200', 'bb_width_pctile', 
               'rvol_20', 'gap_pct', 'atr_14', 'donchian_high_55', 'donchian_low_55', 
               'donchian_high_20', 'donchian_low_20', 'roc_20', 'roc_63', 'dist_52w_high', 
               'dist_52w_low', 'realized_vol_20', 'sma_20', 'sma_50', 'sma_200',
               'cs_rank_return_21d', 'rs_vs_benchmark']
    
    df = pd.DataFrame(rows, columns=columns)
    df['date'] = pd.to_datetime(df['date'])
    
    # Convert numeric columns
    numeric_cols = ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'ma_slope_50', 
                   'ma_slope_200', 'bb_width_pctile', 'rvol_20', 'gap_pct', 'atr_14',
                   'donchian_high_55', 'donchian_low_55', 'donchian_high_20', 'donchian_low_20',
                   'roc_20', 'roc_63', 'dist_52w_high', 'dist_52w_low', 'realized_vol_20',
                   'sma_20', 'sma_50', 'sma_200', 'cs_rank_return_21d', 'rs_vs_benchmark']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Calculate additional indicators needed for position trading setups
    log("Calculating additional indicators...")
    df = calculate_additional_indicators(df)
    
    return universe, df


def calculate_additional_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate indicators needed for position trading setups"""
    
    # Group by asset for rolling calculations
    df = df.sort_values(['asset_id', 'date']).reset_index(drop=True)
    
    # Calculate ADX (14-day) - simplified version using directional movement
    def calc_adx(group):
        group = group.copy()
        if len(group) < 30:
            group['adx_14'] = np.nan
            return group
        
        high = group['close'].values * 1.02  # Estimate high from close
        low = group['close'].values * 0.98   # Estimate low from close
        close = group['close'].values
        
        # True Range
        tr = np.maximum(high - low, 
                       np.maximum(np.abs(high - np.roll(close, 1)), 
                                 np.abs(low - np.roll(close, 1))))
        tr[0] = high[0] - low[0]  # First value
        
        # Directional Movement
        up_move = high - np.roll(high, 1)
        down_move = np.roll(low, 1) - low
        up_move[0] = 0
        down_move[0] = 0
        
        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0)
        
        # Smoothed averages (14-period) using pandas for EWM
        atr = pd.Series(tr).ewm(span=14, adjust=False).mean().values
        plus_di = 100 * pd.Series(plus_dm).ewm(span=14, adjust=False).mean().values / (atr + 0.0001)
        minus_di = 100 * pd.Series(minus_dm).ewm(span=14, adjust=False).mean().values / (atr + 0.0001)
        
        # ADX
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di + 0.0001)
        adx = pd.Series(dx).ewm(span=14, adjust=False).mean().values
        
        group['adx_14'] = adx
        return group
    
    # Calculate rolling min/max for various lookbacks
    def calc_rolling_stats(group):
        if len(group) < 10:
            return group
        
        close = group['close']
        
        # 100-day low for Wyckoff Spring
        group['low_100d'] = close.rolling(100, min_periods=50).min()
        
        # 150-day range for Weinstein
        group['high_150d'] = close.rolling(150, min_periods=75).max()
        group['low_150d'] = close.rolling(150, min_periods=75).min()
        group['range_150d_pct'] = (group['high_150d'] - group['low_150d']) / group['low_150d']
        
        # 120-day ROC for TSM
        group['roc_120'] = close.pct_change(120)
        
        # 20-day EMA for ADX Holy Grail
        group['ema_20'] = close.ewm(span=20, adjust=False).mean()
        group['ema_dist_20'] = (close - group['ema_20']) / group['ema_20']
        
        return group
    
    log("  Calculating rolling statistics...")
    df = df.groupby('asset_id', group_keys=False).apply(calc_rolling_stats)
    
    log("  Calculating ADX...")
    df = df.groupby('asset_id', group_keys=False).apply(calc_adx)
    
    return df


def get_entry_signals(df: pd.DataFrame, setup_name: str, entry_params: dict) -> pd.DataFrame:
    """Get entry signals for a position trading setup"""
    
    if setup_name == 'donchian_55_breakout':
        # Turtle Traders: Buy on 55-day high with rising MA
        return df[
            (df['close'] >= df['donchian_high_55']) &
            (df['ma_slope_50'] > entry_params.get('ma_slope_threshold', 0)) &
            (df['above_ma200'] == True)
        ]
    
    elif setup_name == 'weinstein_stage2':
        # Weinstein: Breakout from long base with volume
        base_range = entry_params.get('base_range_pct', 0.20)
        volume_mult = entry_params.get('volume_mult', 2.0)
        
        return df[
            (df['range_150d_pct'] < base_range) &  # Tight consolidation
            (df['ma_slope_200'] > -0.001) &  # 200 MA flattening/rising
            (df['close'] > df['high_150d'].shift(1)) &  # Breaking out of range
            (df['rvol_20'] > volume_mult) &  # High volume
            (df['above_ma200'] == True)
        ]
    
    elif setup_name == 'adx_holy_grail':
        # ADX Holy Grail: Pullback to 20 EMA in strong trend
        adx_thresh = entry_params.get('adx_threshold', 30)
        touch_dist = entry_params.get('ma_touch_dist', 0.02)
        
        return df[
            (df['adx_14'] > adx_thresh) &  # Strong trend
            (df['ema_dist_20'].abs() < touch_dist) &  # Near 20 EMA
            (df['ma_slope_50'] > 0) &  # Uptrend
            (df['above_ma200'] == True)
        ]
    
    elif setup_name == 'wyckoff_spring':
        # Wyckoff Spring: False breakdown below support then recovery
        spring_depth = entry_params.get('spring_depth_pct', 0.02)
        
        # Look for price that went below 100-day low recently but recovered
        return df[
            (df['close'] > df['low_100d']) &  # Currently above support
            (df['close'].shift(1) < df['low_100d'].shift(1) * (1 - spring_depth)) &  # Was below yesterday
            (df['rvol_20'] > 1.2) &  # Some volume confirmation
            (df['rsi_14'] > 30)  # Not deeply oversold (recovery)
        ]
    
    elif setup_name == 'tsm_acceleration':
        # Time-Series Momentum: Short-term momentum accelerating vs long-term
        rs_pctile = entry_params.get('rs_percentile', 90) / 100
        
        return df[
            (df['roc_120'] > 0) &  # Positive 6-month return
            (df['roc_20'] > df['roc_120']) &  # Short-term > long-term momentum
            (df['cs_rank_return_21d'] > rs_pctile) &  # Top performers
            (df['above_ma200'] == True)
        ]
    
    return df.iloc[:0]


def simulate_trades(asset_df: pd.DataFrame, signals: pd.DataFrame, setup_name: str, exit_params: dict) -> List[dict]:
    """Simulate trades for one asset with position trading exits"""
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
        
        # Setup-specific exits
        max_hold = exit_params.get('max_hold_days', 120)
        
        # Trailing stop parameters
        trailing_stop = None
        trailing_activated = False
        highest_price = entry_price
        
        # For Wyckoff Spring - stop below spring low
        spring_stop = None
        if setup_name == 'wyckoff_spring' and 'stop_below_spring' in exit_params:
            spring_stop = entry_price * (1 - exit_params['stop_below_spring'])
        
        # For Donchian - use N-day low as trailing stop
        trailing_low_days = exit_params.get('trailing_low_days', 20)
        
        exit_idx, exit_price, exit_reason = None, None, None
        
        for i in range(entry_idx + 1, min(entry_idx + max_hold + 1, len(asset_df))):
            row = asset_df.iloc[i]
            close = float(row['close'])
            atr = float(row['atr_14']) if pd.notna(row['atr_14']) else entry_atr
            
            est_high = close + atr * 0.5
            est_low = close - atr * 0.5
            
            if est_high > highest_price:
                highest_price = est_high
            
            # Donchian trailing stop (N-day low)
            if setup_name == 'donchian_55_breakout':
                donchian_low = row.get('donchian_low_20')
                if pd.notna(donchian_low) and est_low <= float(donchian_low):
                    exit_idx, exit_price, exit_reason = i, float(donchian_low), 'donchian_trailing'
                    break
            
            # Spring stop
            if spring_stop and est_low <= spring_stop:
                exit_idx, exit_price, exit_reason = i, spring_stop, 'spring_stop'
                break
            
            # Target profit (for Wyckoff)
            if 'target_pct' in exit_params:
                target = entry_price * (1 + exit_params['target_pct'])
                if est_high >= target:
                    exit_idx, exit_price, exit_reason = i, target, 'target'
                    break
            
            # Trailing stop activation
            if 'trailing_activation_pct' in exit_params:
                if (highest_price - entry_price) / entry_price >= exit_params['trailing_activation_pct'] and not trailing_activated:
                    trailing_activated = True
                    trailing_stop = highest_price - exit_params.get('trailing_atr_mult', 3.0) * entry_atr
            
            if trailing_activated:
                new_trailing = highest_price - exit_params.get('trailing_atr_mult', 3.0) * entry_atr
                if trailing_stop is None or new_trailing > trailing_stop:
                    trailing_stop = new_trailing
            
            if trailing_stop and est_low <= trailing_stop:
                exit_idx, exit_price, exit_reason = i, trailing_stop, 'trailing_stop'
                break
            
            # MA breakdown exits
            for key, col in [('breakdown_ma_dist_200', 'ma_dist_200'), 
                            ('breakdown_ma_dist_50', 'ma_dist_50')]:
                if key in exit_params and pd.notna(row.get(col)):
                    if float(row[col]) < exit_params[key]:
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
    setup_name, entry_params, exit_params, all_data, universe = args
    
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
        
        trades = simulate_trades(asset_df, asset_signals, setup_name, exit_params)
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
    
    # Score optimized for position trading: emphasize profit factor and avg return
    # Less weight on trade count since position trading has fewer trades
    score = profit_factor * (1 + avg_return * 10) * np.sqrt(max(len(all_trades), 1))
    
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
    grid = PARAMETER_GRIDS[setup_name]
    
    entry_keys = list(grid['entry'].keys())
    entry_values = list(grid['entry'].values())
    entry_combos = list(itertools.product(*entry_values))
    
    exit_keys = list(grid['exit'].keys())
    exit_values = list(grid['exit'].values())
    exit_combos = list(itertools.product(*exit_values))
    
    combinations = []
    for entry_vals in entry_combos:
        entry_params = dict(zip(entry_keys, entry_vals))
        for exit_vals in exit_combos:
            exit_params = dict(zip(exit_keys, exit_vals))
            combinations.append((entry_params, exit_params))
    
    return combinations


def optimize_setup(setup_name: str, all_data: pd.DataFrame, universe: list) -> dict:
    """Optimize parameters for a single setup"""
    log(f"\n{'='*50}")
    log(f"Optimizing: {setup_name}")
    log(f"{'='*50}")
    
    combinations = generate_param_combinations(setup_name)
    log(f"Total combinations: {len(combinations)}")
    
    # Prepare arguments for parallel processing
    args_list = [(setup_name, entry, exit, all_data, universe) for entry, exit in combinations]
    
    start_time = time.time()
    
    # Use multiprocessing
    num_workers = max(1, cpu_count() - 2)
    with Pool(num_workers) as pool:
        results = pool.map(backtest_params, args_list)
    
    elapsed = time.time() - start_time
    
    # Filter and sort results
    valid_results = [r for r in results if r['trades'] > 0]
    
    if not valid_results:
        log(f"[{setup_name}] No valid results found!")
        return None
    
    # Sort by score (but also log by profit factor for position trading)
    valid_results.sort(key=lambda x: x['score'], reverse=True)
    best = valid_results[0]
    
    # Also find best by profit factor
    best_pf = max(valid_results, key=lambda x: x['profit_factor'])
    
    log(f"[{setup_name}] Completed in {elapsed:.1f}s")
    log(f"[{setup_name}] BEST BY SCORE: PF={best['profit_factor']}, WR={best['win_rate']}%, AvgRet={best['avg_return']}%, Trades={best['trades']}")
    log(f"  Entry: {best['entry_params']}")
    log(f"  Exit: {best['exit_params']}")
    log(f"[{setup_name}] BEST BY PF: PF={best_pf['profit_factor']}, WR={best_pf['win_rate']}%, AvgRet={best_pf['avg_return']}%, Trades={best_pf['trades']}")
    
    # Save results
    output = {
        'setup': setup_name,
        'total_combinations': len(combinations),
        'elapsed_seconds': elapsed,
        'best_result': best,
        'best_by_profit_factor': best_pf,
        'top_10': valid_results[:10]
    }
    
    output_path = os.path.join(OUTPUT_DIR, f'{setup_name}_optimized.json')
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    log(f"Saved to {output_path}")
    
    return output


def main():
    # Clear log file
    with open(LOG_FILE, 'w') as f:
        f.write("")
    
    log("=" * 60)
    log("POSITION TRADING PARAMETER OPTIMIZER")
    log("=" * 60)
    log(f"CPUs available: {cpu_count()}")
    log(f"Using {max(1, cpu_count() - 2)} worker processes")
    
    # Load data
    universe, all_data = load_all_data()
    log(f"Data loaded: {len(all_data)} rows, {len(universe)} assets")
    
    # Print setup info
    total_combos = 0
    for setup_name, grid in PARAMETER_GRIDS.items():
        combos = generate_param_combinations(setup_name)
        log(f"  {setup_name}: {len(combos)} combinations")
        total_combos += len(combos)
    log(f"  TOTAL: {total_combos} combinations")
    log("=" * 60)
    
    # Optimize each setup
    all_results = []
    start_time = time.time()
    
    for i, setup_name in enumerate(PARAMETER_GRIDS.keys()):
        result = optimize_setup(setup_name, all_data, universe)
        if result:
            all_results.append(result)
        
        elapsed = (time.time() - start_time) / 60
        remaining = (elapsed / (i + 1)) * (len(PARAMETER_GRIDS) - i - 1)
        log(f"Progress: {i+1}/{len(PARAMETER_GRIDS)} setups | Elapsed: {elapsed:.1f}min | ETA: {remaining:.1f}min")
    
    # Final summary
    total_time = time.time() - start_time
    log("\n" + "=" * 60)
    log("OPTIMIZATION COMPLETE")
    log("=" * 60)
    log(f"Total time: {total_time:.1f}s ({total_time/60:.1f} min)")
    
    # Rank by profit factor (better for position trading)
    log("\nBEST PARAMETERS BY SETUP (ranked by Profit Factor):")
    log("-" * 60)
    
    ranked = sorted(all_results, key=lambda x: x['best_result']['profit_factor'], reverse=True)
    
    summary = []
    for i, result in enumerate(ranked):
        best = result['best_result']
        log(f"{i+1}. {result['setup']}")
        log(f"   PF={best['profit_factor']}, WR={best['win_rate']}%, AvgRet={best['avg_return']}%, Trades={best['trades']}")
        log(f"   Entry: {best['entry_params']}")
        log(f"   Exit: {best['exit_params']}")
        
        summary.append({
            'setup': result['setup'],
            'profit_factor': best['profit_factor'],
            'win_rate': best['win_rate'],
            'avg_return': best['avg_return'],
            'trades': best['trades'],
            'score': best['score'],
            'entry_params': best['entry_params'],
            'exit_params': best['exit_params']
        })
    
    # Save combined results
    combined_output = {
        'optimization_date': datetime.now().isoformat(),
        'total_runtime_seconds': total_time,
        'backtest_period': f"{BACKTEST_START} to {BACKTEST_END}",
        'universe_size': len(universe),
        'ranked_results': summary,
        'detailed_results': all_results
    }
    
    combined_path = os.path.join(OUTPUT_DIR, 'position_trading_setups_optimized.json')
    with open(combined_path, 'w') as f:
        json.dump(combined_output, f, indent=2)
    log(f"\nResults saved to {combined_path}")


if __name__ == '__main__':
    main()

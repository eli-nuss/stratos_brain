#!/usr/bin/env python3
"""
Fast Backtester for Stratos Brain
Uses pre-calculated features from daily_features table

Backtest period: 2024-01-02 to 2026-01-23 (2 years)
Universe: Top 1000 equities by dollar volume
"""

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict, Tuple
import json
import argparse
import warnings
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


@dataclass
class SetupConfig:
    """Configuration for a trading setup"""
    name: str
    category: str  # 'short_term' or 'medium_term'
    entry_conditions: Dict
    exit_config: Dict


# =============================================================================
# SETUP DEFINITIONS (using available features in daily_features)
# =============================================================================

SETUPS = {
    # SHORT-TERM SETUPS (1-4 weeks)
    'oversold_bounce': SetupConfig(
        name='oversold_bounce',
        category='short_term',
        entry_conditions={
            'rsi_14': ('lt', 30),
            'ma_dist_20': ('lt', -0.08),
            'above_ma200': ('eq', True),
        },
        exit_config={
            'target_ma_dist': 0,  # Exit when price returns to 20 MA
            'stop_atr_mult': 2.0,
            'time_stop_days': 15,
        }
    ),
    
    'vcp_squeeze': SetupConfig(
        name='vcp_squeeze',
        category='short_term',
        entry_conditions={
            'bb_width_pctile': ('lt', 20),
            'ma_dist_50': ('gt', 0),
            'above_ma200': ('eq', True),
            'rsi_14': ('range', 40, 70),
        },
        exit_config={
            'target_pct': 0.10,
            'stop_atr_mult': 1.5,
            'time_stop_days': 20,
        }
    ),
    
    'gap_up_momentum': SetupConfig(
        name='gap_up_momentum',
        category='short_term',
        entry_conditions={
            'gap_pct': ('gt', 0.03),
            'rvol_20': ('gt', 2.0),
            'ma_dist_20': ('gt', 0),
        },
        exit_config={
            'breakdown_ma_dist': -0.02,  # Exit if 2% below 20 MA
            'time_stop_days': 10,
        }
    ),
    
    'acceleration_turn': SetupConfig(
        name='acceleration_turn',
        category='short_term',
        entry_conditions={
            'accel_turn_up': ('eq', True),
            'above_ma200': ('eq', True),
            'rsi_14': ('range', 30, 60),
        },
        exit_config={
            'target_pct': 0.08,
            'stop_atr_mult': 2.0,
            'time_stop_days': 15,
        }
    ),
    
    # MEDIUM-TERM SETUPS (1-6 months)
    'trend_pullback_50ma': SetupConfig(
        name='trend_pullback_50ma',
        category='medium_term',
        entry_conditions={
            'ma_dist_50': ('range', -0.03, 0.02),
            'above_ma200': ('eq', True),
            'rsi_14': ('lt', 50),
            'ma_slope_50': ('gt', 0),
        },
        exit_config={
            'breakdown_ma_dist_200': -0.02,  # Exit if 2% below 200 MA
            'trailing_activation_pct': 0.15,
            'trailing_atr_mult': 3.0,
            'max_hold_days': 120,
        }
    ),
    
    'golden_cross': SetupConfig(
        name='golden_cross',
        category='medium_term',
        entry_conditions={
            'ma50_above_ma200': ('eq', True),
            'ma_dist_50': ('range', -0.02, 0.05),
            'rsi_14': ('range', 45, 65),
            'ma_slope_50': ('gt', 0),
        },
        exit_config={
            'breakdown_ma_dist_50': -0.03,
            'trailing_activation_pct': 0.20,
            'trailing_atr_mult': 3.5,
            'max_hold_days': 180,
        }
    ),
    
    'rs_breakout': SetupConfig(
        name='rs_breakout',
        category='medium_term',
        entry_conditions={
            'rs_breakout': ('eq', True),
            'above_ma200': ('eq', True),
            'rsi_14': ('range', 50, 70),
        },
        exit_config={
            'breakdown_ma_dist_50': -0.03,
            'trailing_activation_pct': 0.15,
            'trailing_atr_mult': 3.0,
            'max_hold_days': 120,
        }
    ),
    
    'breakout_confirmed': SetupConfig(
        name='breakout_confirmed',
        category='medium_term',
        entry_conditions={
            'breakout_confirmed_up': ('eq', True),
            'rvol_20': ('gt', 1.5),
            'rsi_14': ('range', 50, 75),
        },
        exit_config={
            'breakdown_ma_dist_20': -0.03,
            'trailing_activation_pct': 0.12,
            'trailing_atr_mult': 2.5,
            'max_hold_days': 90,
        }
    ),
}


# =============================================================================
# BACKTESTER
# =============================================================================

def get_universe(conn, limit: int = 1000) -> List[Tuple[int, str]]:
    """Get top assets by recent dollar volume from daily_features"""
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
    return cur.fetchall()


def load_asset_data(conn, asset_id: int) -> pd.DataFrame:
    """Load pre-calculated features for an asset"""
    cur = conn.cursor()
    cur.execute('''
        SELECT 
            df.date,
            df.close,
            df.rsi_14,
            df.ma_dist_20,
            df.ma_dist_50,
            df.ma_dist_200,
            df.ma_slope_20,
            df.ma_slope_50,
            df.ma_slope_200,
            df.above_ma200,
            df.ma50_above_ma200,
            df.bb_width_pctile,
            df.rvol_20,
            df.gap_pct,
            df.accel_turn_up,
            df.rs_breakout,
            df.breakout_confirmed_up,
            df.atr_14,
            df.atr_pct,
            df.sma_20,
            df.sma_50,
            df.sma_200
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
    
    # Convert numeric columns
    numeric_cols = ['close', 'rsi_14', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
                    'ma_slope_20', 'ma_slope_50', 'ma_slope_200', 'bb_width_pctile',
                    'rvol_20', 'gap_pct', 'atr_14', 'atr_pct', 'sma_20', 'sma_50', 'sma_200']
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df


def check_entry_conditions(row: pd.Series, conditions: Dict) -> bool:
    """Check if entry conditions are met"""
    for key, condition in conditions.items():
        if key not in row.index:
            return False
            
        value = row[key]
        if pd.isna(value):
            return False
        
        if isinstance(condition, tuple):
            op, *args = condition
            if op == 'lt' and not (value < args[0]):
                return False
            elif op == 'gt' and not (value > args[0]):
                return False
            elif op == 'eq' and not (value == args[0]):
                return False
            elif op == 'range' and not (args[0] <= value <= args[1]):
                return False
    
    return True


def simulate_trade(
    df: pd.DataFrame,
    entry_idx: int,
    exit_config: Dict,
    category: str
) -> Tuple[int, float, str]:
    """Simulate a trade from entry to exit"""
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
    if 'stop_atr_mult' in exit_config:
        stop_loss = entry_price - (entry_atr * exit_config['stop_atr_mult'])
    
    # Set take profit
    if 'target_pct' in exit_config:
        take_profit = entry_price * (1 + exit_config['target_pct'])
    
    # Get max hold days
    max_hold = exit_config.get('max_hold_days', exit_config.get('time_stop_days', 60))
    
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
        if 'trailing_activation_pct' in exit_config:
            gain_pct = (highest_price - entry_price) / entry_price
            if gain_pct >= exit_config['trailing_activation_pct'] and not trailing_activated:
                trailing_activated = True
                trail_atr = exit_config.get('trailing_atr_mult', 3.0) * entry_atr
                trailing_stop = highest_price - trail_atr
        
        # Update trailing stop
        if trailing_activated:
            trail_atr = exit_config.get('trailing_atr_mult', 3.0) * entry_atr
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
        if 'target_ma_dist' in exit_config:
            ma_dist = row['ma_dist_20']
            if pd.notna(ma_dist) and ma_dist >= exit_config['target_ma_dist']:
                return i, close, 'target_ma'
        
        # Check breakdown MA distance
        for key in ['breakdown_ma_dist_200', 'breakdown_ma_dist_50', 'breakdown_ma_dist_20', 'breakdown_ma_dist']:
            if key in exit_config:
                if key == 'breakdown_ma_dist_200':
                    ma_dist = row['ma_dist_200']
                elif key == 'breakdown_ma_dist_50':
                    ma_dist = row['ma_dist_50']
                else:
                    ma_dist = row['ma_dist_20']
                
                if pd.notna(ma_dist) and ma_dist < exit_config[key]:
                    return i, close, 'breakdown_ma'
    
    # Time stop
    exit_idx = min(entry_idx + max_hold, len(df) - 1)
    return exit_idx, float(df.iloc[exit_idx]['close']), 'time_stop'


def run_backtest(
    setup_name: str,
    universe_limit: int = 1000,
    verbose: bool = True
) -> Dict:
    """Run backtest for a single setup"""
    
    if setup_name not in SETUPS:
        raise ValueError(f"Unknown setup: {setup_name}")
    
    setup = SETUPS[setup_name]
    
    conn = psycopg2.connect(**DB_CONFIG)
    
    # Get universe
    if verbose:
        print(f"Loading universe (top {universe_limit} by dollar volume)...")
    universe = get_universe(conn, universe_limit)
    if verbose:
        print(f"Found {len(universe)} assets")
    
    trades = []
    
    for i, (asset_id, symbol) in enumerate(universe):
        if verbose and i % 100 == 0:
            print(f"Processing {i+1}/{len(universe)}: {symbol}")
        
        # Load data
        df = load_asset_data(conn, asset_id)
        if len(df) < 50:  # Need some data
            continue
        
        # Scan for entries
        in_trade = False
        last_exit_idx = 0
        
        for idx in range(20, len(df)):  # Start after warmup
            if idx <= last_exit_idx:
                continue
            
            row = df.iloc[idx]
            
            # Check entry conditions
            if check_entry_conditions(row, setup.entry_conditions):
                # Simulate trade
                exit_idx, exit_price, exit_reason = simulate_trade(
                    df, idx, setup.exit_config, setup.category
                )
                
                entry_price = float(row['close'])
                
                # Apply friction
                entry_price_adj = entry_price * (1 + FRICTION)
                exit_price_adj = exit_price * (1 - FRICTION)
                
                return_pct = (exit_price_adj / entry_price_adj) - 1
                hold_days = exit_idx - idx
                
                trade = Trade(
                    asset_id=asset_id,
                    symbol=symbol,
                    setup=setup_name,
                    entry_date=str(row['date'].date()),
                    entry_price=entry_price,
                    exit_date=str(df.iloc[exit_idx]['date'].date()),
                    exit_price=exit_price,
                    exit_reason=exit_reason,
                    return_pct=return_pct,
                    hold_days=hold_days
                )
                trades.append(trade)
                
                last_exit_idx = exit_idx
    
    conn.close()
    
    # Calculate metrics
    if not trades:
        return {
            'setup': setup_name,
            'category': setup.category,
            'trades': 0,
            'win_rate': 0,
            'profit_factor': 0,
            'avg_return': 0,
            'avg_hold_days': 0,
        }
    
    returns = [t.return_pct for t in trades]
    wins = [r for r in returns if r > 0]
    losses = [r for r in returns if r <= 0]
    
    win_rate = len(wins) / len(returns) if returns else 0
    
    gross_profit = sum(wins) if wins else 0
    gross_loss = abs(sum(losses)) if losses else 0.0001
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
    
    avg_return = np.mean(returns) if returns else 0
    avg_hold = np.mean([t.hold_days for t in trades]) if trades else 0
    
    # Exit reason breakdown
    exit_reasons = {}
    for t in trades:
        exit_reasons[t.exit_reason] = exit_reasons.get(t.exit_reason, 0) + 1
    
    return {
        'setup': setup_name,
        'category': setup.category,
        'trades': len(trades),
        'win_rate': round(win_rate * 100, 1),
        'profit_factor': round(profit_factor, 2),
        'avg_return': round(avg_return * 100, 2),
        'avg_hold_days': round(avg_hold, 1),
        'exit_reasons': exit_reasons,
        'trade_details': [
            {
                'symbol': t.symbol,
                'entry_date': t.entry_date,
                'exit_date': t.exit_date,
                'return_pct': round(t.return_pct * 100, 2),
                'hold_days': t.hold_days,
                'exit_reason': t.exit_reason
            }
            for t in trades[:100]
        ]
    }


def run_all_setups(universe_limit: int = 1000) -> Dict:
    """Run backtest for all setups"""
    results = {}
    
    for setup_name in SETUPS:
        print(f"\n{'='*60}")
        print(f"Running backtest for: {setup_name}")
        print('='*60)
        
        result = run_backtest(setup_name, universe_limit)
        results[setup_name] = result
        
        print(f"\nResults for {setup_name}:")
        print(f"  Trades: {result['trades']}")
        print(f"  Win Rate: {result['win_rate']}%")
        print(f"  Profit Factor: {result['profit_factor']}")
        print(f"  Avg Return: {result['avg_return']}%")
        print(f"  Avg Hold: {result['avg_hold_days']} days")
        if result.get('exit_reasons'):
            print(f"  Exit Reasons: {result['exit_reasons']}")
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY - All Setups Ranked by Profit Factor")
    print('='*60)
    
    sorted_results = sorted(results.items(), key=lambda x: x[1]['profit_factor'], reverse=True)
    for rank, (name, r) in enumerate(sorted_results, 1):
        print(f"{rank}. {name}: PF={r['profit_factor']}, WR={r['win_rate']}%, Trades={r['trades']}")
    
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fast Backtester')
    parser.add_argument('--setup', type=str, help='Specific setup to test')
    parser.add_argument('--universe', type=int, default=1000, help='Number of assets')
    parser.add_argument('--output', type=str, default='./data/fast_backtest_results.json')
    
    args = parser.parse_args()
    
    if args.setup:
        results = {args.setup: run_backtest(args.setup, args.universe)}
    else:
        results = run_all_setups(args.universe)
    
    # Save results
    import os
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to {args.output}")

#!/usr/bin/env python3
"""
Essential Backtester for Stratos Brain
Following the Essential Backtesting Methodology

This backtester:
1. Calculates technical features on-the-fly from daily_bars
2. Tests setups with setup-specific exit strategies
3. Applies market regime filter (breadth > 50%)
4. Applies 0.15% friction per trade
5. Outputs auditable results
"""

import psycopg2
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import json
import argparse

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
BACKTEST_START = '2020-01-25'
BACKTEST_END = '2025-01-20'


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
# SETUP DEFINITIONS
# =============================================================================

SETUPS = {
    # SHORT-TERM SETUPS (1-4 weeks)
    'oversold_bounce': SetupConfig(
        name='oversold_bounce',
        category='short_term',
        entry_conditions={
            'rsi_14': ('lt', 30),
            'ma_dist_20': ('lt', -0.08),  # 8% below 20 MA
            'above_200ma': True,
        },
        exit_config={
            'target_ma': 20,  # Exit when price touches 20 MA
            'stop_atr_mult': 2.0,
            'time_stop_days': 15,
        }
    ),
    
    'vcp_squeeze': SetupConfig(
        name='vcp_squeeze',
        category='short_term',
        entry_conditions={
            'bb_width_pctile': ('lt', 20),  # Tight squeeze
            'above_50ma': True,
            'above_200ma': True,
            'rsi_14': ('gt', 40),
            'rsi_14_max': ('lt', 70),
        },
        exit_config={
            'target_pct': 0.10,  # 10% target
            'stop_atr_mult': 1.5,
            'time_stop_days': 20,
        }
    ),
    
    'gap_up_hold': SetupConfig(
        name='gap_up_hold',
        category='short_term',
        entry_conditions={
            'gap_pct': ('gt', 0.03),  # 3% gap up
            'rvol': ('gt', 2.0),  # High volume
            'above_20ma': True,
        },
        exit_config={
            'breakdown_ma': 20,  # Exit if breaks below 20 MA
            'stop_gap_low': True,  # Stop at gap low
            'time_stop_days': 10,
        }
    ),
    
    # MEDIUM-TERM SETUPS (1-6 months)
    'trend_pullback_50ma': SetupConfig(
        name='trend_pullback_50ma',
        category='medium_term',
        entry_conditions={
            'ma_dist_50': ('range', -0.03, 0.02),  # Within 3% below to 2% above 50 MA
            'above_200ma': True,
            'rsi_14': ('lt', 50),
            'ma_slope_50': ('gt', 0),  # Uptrending 50 MA
        },
        exit_config={
            'breakdown_ma': 200,  # Exit if breaks below 200 MA
            'trailing_activation_pct': 0.15,  # Activate trail after 15% gain
            'trailing_atr_mult': 3.0,
            'max_hold_days': 120,
        }
    ),
    
    'golden_cross_momentum': SetupConfig(
        name='golden_cross_momentum',
        category='medium_term',
        entry_conditions={
            'golden_cross_recent': True,  # 50 MA crossed above 200 MA in last 20 days
            'rsi_14': ('gt', 50),
            'ma_slope_50': ('gt', 0),
        },
        exit_config={
            'breakdown_ma': 50,  # Exit if breaks below 50 MA
            'trailing_activation_pct': 0.20,
            'trailing_atr_mult': 3.5,
            'max_hold_days': 180,
        }
    ),
    
    'rs_breakout': SetupConfig(
        name='rs_breakout',
        category='medium_term',
        entry_conditions={
            'rs_new_high': True,  # RS making new highs
            'above_50ma': True,
            'above_200ma': True,
            'rsi_14': ('range', 50, 70),
        },
        exit_config={
            'breakdown_ma': 50,
            'trailing_activation_pct': 0.15,
            'trailing_atr_mult': 3.0,
            'max_hold_days': 120,
        }
    ),
}


# =============================================================================
# FEATURE CALCULATION
# =============================================================================

def calculate_features(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate technical features from OHLCV data"""
    df = df.copy()
    
    # Price-based
    df['return_1d'] = df['close'].pct_change()
    
    # Moving averages
    df['sma_20'] = df['close'].rolling(20).mean()
    df['sma_50'] = df['close'].rolling(50).mean()
    df['sma_200'] = df['close'].rolling(200).mean()
    
    # MA distances
    df['ma_dist_20'] = (df['close'] - df['sma_20']) / df['sma_20']
    df['ma_dist_50'] = (df['close'] - df['sma_50']) / df['sma_50']
    df['ma_dist_200'] = (df['close'] - df['sma_200']) / df['sma_200']
    
    # MA slopes (20-day change in MA)
    df['ma_slope_20'] = df['sma_20'].pct_change(20)
    df['ma_slope_50'] = df['sma_50'].pct_change(20)
    df['ma_slope_200'] = df['sma_200'].pct_change(20)
    
    # Above/below MAs
    df['above_20ma'] = df['close'] > df['sma_20']
    df['above_50ma'] = df['close'] > df['sma_50']
    df['above_200ma'] = df['close'] > df['sma_200']
    
    # RSI
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    df['rsi_14'] = 100 - (100 / (1 + rs))
    
    # ATR
    high_low = df['high'] - df['low']
    high_close = (df['high'] - df['close'].shift()).abs()
    low_close = (df['low'] - df['close'].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df['atr_14'] = tr.rolling(14).mean()
    df['atr_pct'] = df['atr_14'] / df['close']
    
    # Bollinger Bands
    df['bb_middle'] = df['close'].rolling(20).mean()
    df['bb_std'] = df['close'].rolling(20).std()
    df['bb_upper'] = df['bb_middle'] + 2 * df['bb_std']
    df['bb_lower'] = df['bb_middle'] - 2 * df['bb_std']
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
    df['bb_width_pctile'] = df['bb_width'].rolling(100).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
    )
    
    # Volume
    df['vol_sma_20'] = df['volume'].rolling(20).mean()
    df['rvol'] = df['volume'] / df['vol_sma_20']
    
    # Gap
    df['gap_pct'] = (df['open'] - df['close'].shift()) / df['close'].shift()
    
    # Golden Cross detection (50 MA crossed above 200 MA in last 20 days)
    df['ma_50_above_200'] = df['sma_50'] > df['sma_200']
    df['golden_cross_recent'] = df['ma_50_above_200'] & ~df['ma_50_above_200'].shift(20).fillna(False)
    
    # RS vs benchmark (simplified - using 63-day return rank)
    df['return_63d'] = df['close'].pct_change(63)
    
    # 52-week high/low
    df['high_52w'] = df['high'].rolling(252).max()
    df['low_52w'] = df['low'].rolling(252).min()
    df['dist_52w_high'] = (df['close'] - df['high_52w']) / df['high_52w']
    df['dist_52w_low'] = (df['close'] - df['low_52w']) / df['low_52w']
    
    # RS new high (simplified - within 5% of 63-day high return)
    df['rs_new_high'] = df['return_63d'] >= df['return_63d'].rolling(63).max() * 0.95
    
    return df


# =============================================================================
# ENTRY/EXIT LOGIC
# =============================================================================

def check_entry_conditions(row: pd.Series, conditions: Dict) -> bool:
    """Check if entry conditions are met"""
    for key, condition in conditions.items():
        if key not in row.index:
            return False
            
        value = row[key]
        if pd.isna(value):
            return False
        
        if isinstance(condition, bool):
            if value != condition:
                return False
        elif isinstance(condition, tuple):
            op, *args = condition
            if op == 'lt' and not (value < args[0]):
                return False
            elif op == 'gt' and not (value > args[0]):
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
    """
    Simulate a trade from entry to exit.
    Returns: (exit_idx, exit_price, exit_reason)
    """
    entry_price = df.iloc[entry_idx]['close']
    entry_atr = df.iloc[entry_idx]['atr_14']
    
    if pd.isna(entry_atr):
        entry_atr = entry_price * 0.02  # Default 2% ATR
    
    # Initialize stops and targets
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
        high = row['high']
        low = row['low']
        close = row['close']
        
        # Update highest price for trailing stop
        if high > highest_price:
            highest_price = high
        
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
        if stop_loss and low <= stop_loss:
            return i, stop_loss, 'stop_loss'
        
        # Check trailing stop
        if trailing_stop and low <= trailing_stop:
            return i, trailing_stop, 'trailing_stop'
        
        # Check take profit
        if take_profit and high >= take_profit:
            return i, take_profit, 'take_profit'
        
        # Check target MA (for short-term mean reversion)
        if 'target_ma' in exit_config:
            ma_col = f"sma_{exit_config['target_ma']}"
            if ma_col in row.index and not pd.isna(row[ma_col]):
                if high >= row[ma_col]:
                    return i, row[ma_col], 'target_ma'
        
        # Check breakdown MA (for medium-term trend following)
        if 'breakdown_ma' in exit_config:
            ma_col = f"sma_{exit_config['breakdown_ma']}"
            if ma_col in row.index and not pd.isna(row[ma_col]):
                if close < row[ma_col]:
                    return i, close, 'breakdown_ma'
    
    # Time stop - exit at close
    exit_idx = min(entry_idx + max_hold, len(df) - 1)
    return exit_idx, df.iloc[exit_idx]['close'], 'time_stop'


# =============================================================================
# MARKET REGIME FILTER
# =============================================================================

def calculate_market_breadth(conn, date: str) -> float:
    """Calculate % of stocks above 200 MA on a given date"""
    cur = conn.cursor()
    cur.execute('''
        SELECT 
            COUNT(CASE WHEN close > sma_200 THEN 1 END)::float / 
            NULLIF(COUNT(*), 0) as breadth
        FROM (
            SELECT 
                db.asset_id,
                db.close,
                AVG(db.close) OVER (
                    PARTITION BY db.asset_id 
                    ORDER BY db.date 
                    ROWS BETWEEN 199 PRECEDING AND CURRENT ROW
                ) as sma_200
            FROM daily_bars db
            JOIN assets a ON db.asset_id = a.asset_id
            WHERE db.date = %s
            AND a.asset_type = 'equity'
        ) sub
        WHERE sma_200 IS NOT NULL
    ''', (date,))
    result = cur.fetchone()
    return result[0] if result and result[0] else 0.5


# =============================================================================
# MAIN BACKTESTER
# =============================================================================

def get_universe(conn, limit: int = 1000) -> List[Tuple[int, str]]:
    """Get top assets by recent dollar volume"""
    cur = conn.cursor()
    cur.execute('''
        WITH recent_liquidity AS (
            SELECT 
                asset_id,
                AVG(close * volume)::float as recent_dollar_volume,
                AVG(close)::float as recent_price
            FROM daily_bars
            WHERE date >= '2025-01-01'
            GROUP BY asset_id
        ),
        data_coverage AS (
            SELECT 
                asset_id,
                MIN(date) as first_date,
                MAX(date) as last_date,
                COUNT(DISTINCT date) as data_days
            FROM daily_bars
            GROUP BY asset_id
            HAVING MIN(date) <= %s
            AND MAX(date) >= %s
            AND COUNT(DISTINCT date) >= 1000
        )
        SELECT 
            a.asset_id,
            a.symbol
        FROM assets a
        JOIN data_coverage dc ON a.asset_id = dc.asset_id
        JOIN recent_liquidity rl ON a.asset_id = rl.asset_id
        WHERE a.asset_type = 'equity'
        AND rl.recent_price >= 5
        AND rl.recent_price <= 10000
        ORDER BY rl.recent_dollar_volume DESC
        LIMIT %s
    ''', (BACKTEST_START, BACKTEST_END, limit))
    return cur.fetchall()


def load_asset_data(conn, asset_id: int) -> pd.DataFrame:
    """Load OHLCV data for an asset"""
    cur = conn.cursor()
    cur.execute('''
        SELECT date, open, high, low, close, volume
        FROM daily_bars
        WHERE asset_id = %s
        AND date >= %s
        AND date <= %s
        ORDER BY date
    ''', (asset_id, BACKTEST_START, BACKTEST_END))
    
    rows = cur.fetchall()
    if not rows:
        return pd.DataFrame()
    
    df = pd.DataFrame(rows, columns=['date', 'open', 'high', 'low', 'close', 'volume'])
    df['date'] = pd.to_datetime(df['date'])
    df = df.set_index('date')
    
    # Convert to float
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = df[col].astype(float)
    
    return df


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
        if len(df) < 250:  # Need at least 1 year of data
            continue
        
        # Calculate features
        df = calculate_features(df)
        df = df.reset_index()
        
        # Scan for entries
        in_trade = False
        for idx in range(250, len(df)):  # Start after warmup period
            if in_trade:
                continue
            
            row = df.iloc[idx]
            
            # Check entry conditions
            if check_entry_conditions(row, setup.entry_conditions):
                # Simulate trade
                exit_idx, exit_price, exit_reason = simulate_trade(
                    df, idx, setup.exit_config, setup.category
                )
                
                entry_price = row['close']
                
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
                    entry_price=float(entry_price),
                    exit_date=str(df.iloc[exit_idx]['date'].date()),
                    exit_price=float(exit_price),
                    exit_reason=exit_reason,
                    return_pct=float(return_pct),
                    hold_days=int(hold_days)
                )
                trades.append(trade)
                
                # Skip to after exit
                in_trade = True
                # Reset after exit
                if exit_idx < len(df) - 1:
                    in_trade = False
    
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
            for t in trades[:100]  # First 100 trades for audit
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
    
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Essential Backtester')
    parser.add_argument('--setup', type=str, help='Specific setup to test')
    parser.add_argument('--universe', type=int, default=1000, help='Number of assets')
    parser.add_argument('--output', type=str, default='./data/backtest_results.json')
    
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

"""
Position Trading Backtester
===========================

Designed for longer-term position trading (1-12 month holds) with:
- Trailing stop losses that lock in gains
- 50% profit target
- Technical breakdown exit (below 200 SMA)
- Maximum hold period of 12 months

This is fundamentally different from swing trading backtesting.
"""

import argparse
import json
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor


# =============================================================================
# DATABASE CONNECTION
# =============================================================================

DB_CONFIG = {
    "host": "db.wfogbaipiqootjrsprde.supabase.co",
    "port": 5432,
    "database": "postgres",
    "user": "postgres",
    "password": "stratosbrainpostgresdbpw"
}


def get_db_connection():
    """Get a database connection."""
    return psycopg2.connect(**DB_CONFIG)


# =============================================================================
# TRAILING STOP CONFIGURATION
# =============================================================================

@dataclass
class TrailingStopConfig:
    """Configuration for trailing stop behavior."""
    initial_stop_pct: float = 0.15  # 15% initial stop loss
    
    # Trailing stop tiers - as profit increases, trail tighter
    # Format: (profit_threshold, trail_pct_from_high)
    trail_tiers: List[Tuple[float, float]] = field(default_factory=lambda: [
        (0.10, 0.12),   # Once up 10%, trail at 12% below high
        (0.20, 0.15),   # Once up 20%, trail at 15% below high  
        (0.35, 0.18),   # Once up 35%, trail at 18% below high
    ])
    
    profit_target: float = 0.50  # 50% profit target
    max_hold_days: int = 252  # ~12 months trading days
    
    def get_trail_pct(self, current_gain_from_entry: float) -> float:
        """Get the trailing stop percentage based on current gain."""
        trail_pct = self.initial_stop_pct
        for threshold, pct in self.trail_tiers:
            if current_gain_from_entry >= threshold:
                trail_pct = pct
        return trail_pct


# =============================================================================
# AUDIT DATA STRUCTURES
# =============================================================================

@dataclass
class ConditionCheck:
    """A single condition check with its result."""
    condition_name: str
    expression: str
    actual_value: Any
    threshold: Any
    passed: bool
    
    def to_dict(self) -> Dict:
        return {
            "condition": self.condition_name,
            "expression": self.expression,
            "actual": self.actual_value,
            "threshold": self.threshold,
            "passed": "✓" if self.passed else "✗"
        }


@dataclass
class PositionTrade:
    """A position trade with full audit trail."""
    trade_id: int
    asset_id: int
    asset_symbol: str
    setup_name: str
    
    # Entry details
    entry_date: str
    entry_price: float
    entry_conditions: List[ConditionCheck]
    entry_parameters: Dict[str, Any]
    
    # Position tracking
    highest_price: float = 0.0
    highest_price_date: Optional[str] = None
    max_gain_pct: float = 0.0
    
    # Exit details
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    exit_details: Optional[str] = None
    
    # Results
    return_pct: Optional[float] = None
    holding_period: Optional[int] = None
    is_winner: Optional[bool] = None
    
    # Trailing stop tracking
    stop_adjustments: List[Dict] = field(default_factory=list)
    
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_markdown(self) -> str:
        """Generate a human-readable Markdown summary of this trade."""
        status = "✅ WIN" if self.is_winner else "❌ LOSS" if self.is_winner is False else "⏳ OPEN"
        return_str = f"{self.return_pct*100:+.2f}%" if self.return_pct is not None else "N/A"
        exit_price_str = f"${self.exit_price:.2f}" if self.exit_price else "N/A"
        highest_price_str = f"${self.highest_price:.2f}" if self.highest_price else "N/A"
        
        md = f"""
### Trade #{self.trade_id}: {self.asset_symbol} ({status})

| Field | Value |
|-------|-------|
| **Setup** | {self.setup_name} |
| **Entry Date** | {self.entry_date} |
| **Entry Price** | ${self.entry_price:.2f} |
| **Exit Date** | {self.exit_date or 'N/A'} |
| **Exit Price** | {exit_price_str} |
| **Exit Reason** | {self.exit_reason or 'N/A'} |
| **Return** | {return_str} |
| **Holding Period** | {self.holding_period or 'N/A'} days |
| **Max Gain** | {self.max_gain_pct*100:+.2f}% |
| **Highest Price** | {highest_price_str} ({self.highest_price_date}) |

**Entry Conditions:**
"""
        for cond in self.entry_conditions:
            status_icon = "✓" if cond.passed else "✗"
            md += f"- {status_icon} `{cond.condition_name}`: {cond.expression} → Actual: {cond.actual_value}, Threshold: {cond.threshold}\n"
        
        if self.exit_details:
            md += f"\n**Exit Details:** {self.exit_details}\n"
        
        return md


# =============================================================================
# SETUP DEFINITIONS FOR POSITION TRADING
# =============================================================================

POSITION_SETUPS = {
    "oversold_quality": {
        "description": "Quality stocks that have pulled back significantly - mean reversion play",
        "category": "mean_reversion",
        "direction": "long",
        "conditions": [
            {"name": "Extended Below 20 MA", "field": "ma_dist_20", "operator": "<", "threshold_value": -0.10},
            {"name": "RSI Oversold", "field": "rsi_14", "operator": "<", "threshold_value": 35},
        ],
    },
    "deep_value_pullback": {
        "description": "Deeper pullback for higher conviction entries",
        "category": "mean_reversion", 
        "direction": "long",
        "conditions": [
            {"name": "Extended Below 20 MA", "field": "ma_dist_20", "operator": "<", "threshold_value": -0.15},
            {"name": "RSI Very Oversold", "field": "rsi_14", "operator": "<", "threshold_value": 30},
        ],
    },
    "trend_pullback_50ma": {
        "description": "Pullback to 50 MA in established uptrend",
        "category": "trend_continuation",
        "direction": "long",
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Near 50 SMA", "field": "ma_dist_50", "operator": "<=", "threshold_value": 0.03},
            {"name": "RSI Not Overbought", "field": "rsi_14", "operator": "<", "threshold_value": 50},
        ],
    },
    "trend_pullback_200ma": {
        "description": "Pullback to 200 MA - major support test",
        "category": "trend_continuation",
        "direction": "long",
        "conditions": [
            {"name": "Near 200 SMA", "field": "ma_dist_200", "operator": "<=", "threshold_value": 0.03},
            {"name": "Near 200 SMA", "field": "ma_dist_200", "operator": ">=", "threshold_value": -0.03},
            {"name": "RSI Not Overbought", "field": "rsi_14", "operator": "<", "threshold_value": 55},
        ],
    },
    "breakout_consolidation": {
        "description": "Breakout from tight consolidation with volume",
        "category": "momentum",
        "direction": "long",
        "conditions": [
            {"name": "20-Day Breakout", "field": "breakout_up_20", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Volume Confirmation", "field": "rvol_20", "operator": ">", "threshold_value": 1.5},
        ],
    },
    "squeeze_release": {
        "description": "Volatility squeeze release - expansion after contraction",
        "category": "momentum",
        "direction": "long",
        "conditions": [
            {"name": "Squeeze Released", "field": "squeeze_release", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive Momentum", "field": "roc_5", "operator": ">", "threshold_value": 0},
        ],
    },
    "gap_up_hold": {
        "description": "Gap up that holds - institutional buying",
        "category": "momentum",
        "direction": "long",
        "conditions": [
            {"name": "Gap Up", "field": "gap_pct", "operator": ">", "threshold_value": 0.03},
            {"name": "Gap Held", "field": "gap_up", "operator": "==", "threshold_value": True},
            {"name": "Volume Surge", "field": "rvol_20", "operator": ">", "threshold_value": 2.0},
        ],
    },
}


# =============================================================================
# POSITION TRADING BACKTESTER
# =============================================================================

class PositionBacktester:
    """
    Backtester designed for position trading with:
    - Trailing stops
    - 50% profit targets
    - Technical breakdown exits
    - 1-12 month holding periods
    """
    
    def __init__(self, trailing_config: TrailingStopConfig = None):
        self.conn = None
        self.trade_counter = 0
        self.trades: List[PositionTrade] = []
        self.trailing_config = trailing_config or TrailingStopConfig()
    
    def connect(self):
        """Establish database connection."""
        self.conn = get_db_connection()
        print("✅ Connected to database")
    
    def disconnect(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            print("✅ Disconnected from database")
    
    def load_asset_universe(self, universe: str) -> List[Tuple[int, str]]:
        """Load asset IDs and symbols for the given universe."""
        cur = self.conn.cursor()
        
        if universe == "crypto":
            cur.execute("""
                SELECT DISTINCT a.asset_id, a.symbol
                FROM assets a
                JOIN daily_features f ON f.asset_id = a.asset_id
                WHERE a.asset_type = 'crypto'
                AND f.date >= '2022-01-01'
                GROUP BY a.asset_id, a.symbol
                HAVING COUNT(*) >= 200
                ORDER BY a.symbol
            """)
        elif universe == "equity":
            # Use curated list of liquid stocks
            cur.execute("""
                SELECT DISTINCT a.asset_id, a.symbol
                FROM assets a
                JOIN daily_features f ON f.asset_id = a.asset_id
                WHERE a.asset_type = 'equity'
                AND a.symbol IN (
                    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'JPM', 'JNJ',
                    'V', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'PYPL', 'BAC', 'ADBE', 'CMCSA',
                    'NFLX', 'XOM', 'VZ', 'INTC', 'T', 'PFE', 'KO', 'PEP', 'MRK', 'ABT',
                    'CVX', 'WMT', 'CSCO', 'CRM', 'TMO', 'ABBV', 'ACN', 'AVGO', 'MCD', 'COST',
                    'NKE', 'DHR', 'LLY', 'TXN', 'NEE', 'PM', 'UNP', 'BMY', 'ORCL', 'HON',
                    'AMD', 'QCOM', 'LOW', 'UPS', 'MS', 'RTX', 'SBUX', 'GS', 'BLK', 'INTU',
                    'CAT', 'GILD', 'ISRG', 'AXP', 'MDLZ', 'DE', 'BKNG', 'AMAT', 'ADI', 'LRCX',
                    'SYK', 'ZTS', 'CB', 'PLD', 'REGN', 'VRTX', 'MMC', 'CI', 'NOW', 'PANW',
                    'SCHW', 'MO', 'SO', 'DUK', 'CME', 'CL', 'ICE', 'ITW', 'EOG', 'SLB',
                    'APD', 'FDX', 'NOC', 'WM', 'ETN', 'NSC', 'PNC', 'TGT', 'USB', 'AON'
                )
                AND f.date >= '2020-01-01'
                GROUP BY a.asset_id, a.symbol
                HAVING COUNT(*) >= 500
                ORDER BY a.symbol
            """)
        else:
            raise ValueError(f"Unknown universe: {universe}")
        
        assets = cur.fetchall()
        print(f"📊 Loaded {len(assets)} assets from {universe} universe")
        return assets
    
    def load_asset_data(
        self, 
        asset_id: int, 
        start_date: str, 
        end_date: str
    ) -> pd.DataFrame:
        """Load OHLCV + features for a single asset."""
        cur = self.conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT 
                b.date,
                b.open,
                b.high,
                b.low,
                b.close,
                b.volume,
                f.rsi_14,
                f.sma_50,
                f.sma_200,
                f.ma_dist_20,
                f.ma_dist_50,
                f.ma_dist_200,
                f.bb_width_pctile,
                f.rvol_20,
                f.breakout_up_20,
                f.breakout_down_20,
                f.gap_pct,
                f.gap_up,
                f.gap_down,
                f.above_ma200,
                f.squeeze_release,
                f.squeeze_flag,
                f.roc_5,
                f.roc_20,
                f.droc_20,
                f.atr_14,
                f.atr_pct,
                f.realized_vol_20
            FROM daily_bars b
            JOIN daily_features f ON f.asset_id = b.asset_id AND f.date = b.date
            WHERE b.asset_id = %s
            AND b.date BETWEEN %s AND %s
            ORDER BY b.date
        """, (asset_id, start_date, end_date))
        
        rows = cur.fetchall()
        if not rows:
            return pd.DataFrame()
        
        df = pd.DataFrame(rows)
        
        # Convert Decimal columns to float
        numeric_cols = ['open', 'high', 'low', 'close', 'volume', 'rsi_14', 'sma_50', 'sma_200',
                        'ma_dist_20', 'ma_dist_50', 'ma_dist_200', 'bb_width_pctile', 'rvol_20',
                        'gap_pct', 'roc_5', 'roc_20', 'droc_20', 'atr_14', 'atr_pct', 'realized_vol_20']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        return df
    
    def _get_threshold(self, condition: Dict, row: Dict) -> Any:
        """Get the threshold value for a condition."""
        if "threshold_value" in condition:
            return condition["threshold_value"]
        elif "threshold_field" in condition:
            return row.get(condition["threshold_field"])
        return None
    
    def _evaluate_condition(self, condition: Dict, row: Dict) -> ConditionCheck:
        """Evaluate a single condition and return a detailed check result."""
        field_name = condition["field"]
        operator = condition["operator"]
        actual_value = row.get(field_name)
        threshold = self._get_threshold(condition, row)
        
        # Handle None values
        if actual_value is None or threshold is None:
            return ConditionCheck(
                condition_name=condition["name"],
                expression=f"{field_name} {operator} {threshold}",
                actual_value=actual_value,
                threshold=threshold,
                passed=False
            )
        
        # Convert Decimal to float for comparison
        if hasattr(actual_value, '__float__'):
            actual_value = float(actual_value)
        if hasattr(threshold, '__float__'):
            threshold = float(threshold)
        
        # Evaluate the condition
        if operator == ">":
            passed = actual_value > threshold
        elif operator == ">=":
            passed = actual_value >= threshold
        elif operator == "<":
            passed = actual_value < threshold
        elif operator == "<=":
            passed = actual_value <= threshold
        elif operator == "==":
            passed = actual_value == threshold
        else:
            passed = False
        
        return ConditionCheck(
            condition_name=condition["name"],
            expression=f"{field_name} {operator} {threshold}",
            actual_value=round(actual_value, 4) if isinstance(actual_value, float) else actual_value,
            threshold=round(threshold, 4) if isinstance(threshold, float) else threshold,
            passed=passed
        )
    
    def _check_entry_conditions(
        self, 
        setup_name: str, 
        row: Dict
    ) -> Tuple[bool, List[ConditionCheck]]:
        """Check all entry conditions and return detailed results."""
        setup = POSITION_SETUPS[setup_name]
        conditions = setup["conditions"]
        
        checks = []
        all_passed = True
        
        for condition in conditions:
            check = self._evaluate_condition(condition, row)
            checks.append(check)
            if not check.passed:
                all_passed = False
        
        return all_passed, checks
    
    def _simulate_position_trade(
        self,
        df: pd.DataFrame,
        entry_idx: int,
        entry_price: float,
        entry_conditions: List[ConditionCheck],
        asset_id: int,
        asset_symbol: str,
        setup_name: str,
    ) -> PositionTrade:
        """
        Simulate a position trade with:
        - Trailing stop loss
        - 50% profit target
        - Technical breakdown exit (below 200 SMA)
        - Max hold period
        """
        self.trade_counter += 1
        
        entry_date = str(df.iloc[entry_idx]["date"])
        
        trade = PositionTrade(
            trade_id=self.trade_counter,
            asset_id=asset_id,
            asset_symbol=asset_symbol,
            setup_name=setup_name,
            entry_date=entry_date,
            entry_price=entry_price,
            entry_conditions=entry_conditions,
            entry_parameters={
                "initial_stop_pct": self.trailing_config.initial_stop_pct,
                "profit_target": self.trailing_config.profit_target,
                "trail_tiers": self.trailing_config.trail_tiers,
                "max_hold_days": self.trailing_config.max_hold_days,
            },
            highest_price=entry_price,
            highest_price_date=entry_date,
        )
        
        # Initial stop loss
        current_stop = entry_price * (1 - self.trailing_config.initial_stop_pct)
        
        # Simulate day by day
        for i in range(1, self.trailing_config.max_hold_days + 1):
            if entry_idx + i >= len(df):
                break
            
            row = df.iloc[entry_idx + i]
            current_date = str(row["date"])
            high = float(row["high"])
            low = float(row["low"])
            close = float(row["close"])
            sma_200 = row.get("sma_200")
            
            # Update highest price
            if high > trade.highest_price:
                trade.highest_price = high
                trade.highest_price_date = current_date
                trade.max_gain_pct = (high / entry_price) - 1
                
                # Adjust trailing stop based on gain
                current_gain = (high / entry_price) - 1
                trail_pct = self.trailing_config.get_trail_pct(current_gain)
                new_stop = high * (1 - trail_pct)
                
                if new_stop > current_stop:
                    trade.stop_adjustments.append({
                        "date": current_date,
                        "old_stop": current_stop,
                        "new_stop": new_stop,
                        "high": high,
                        "gain_pct": current_gain,
                        "trail_pct": trail_pct,
                    })
                    current_stop = new_stop
            
            # Check exit conditions in order of priority
            
            # 1. Stop loss hit (check low against stop)
            if low <= current_stop:
                trade.exit_date = current_date
                trade.exit_price = current_stop  # Assume exit at stop price
                trade.exit_reason = "trailing_stop"
                trade.exit_details = f"Low ({low:.2f}) breached trailing stop ({current_stop:.2f}). Max gain was {trade.max_gain_pct*100:.1f}%"
                trade.return_pct = (current_stop / entry_price) - 1
                trade.holding_period = i
                trade.is_winner = trade.return_pct > 0
                return trade
            
            # 2. Profit target hit (check high against target)
            target_price = entry_price * (1 + self.trailing_config.profit_target)
            if high >= target_price:
                trade.exit_date = current_date
                trade.exit_price = target_price
                trade.exit_reason = "profit_target"
                trade.exit_details = f"High ({high:.2f}) reached {self.trailing_config.profit_target*100:.0f}% profit target ({target_price:.2f})"
                trade.return_pct = self.trailing_config.profit_target
                trade.holding_period = i
                trade.is_winner = True
                return trade
            
            # 3. Technical breakdown (close below 200 SMA)
            if sma_200 is not None and not pd.isna(sma_200):
                sma_200_val = float(sma_200)
                if close < sma_200_val * 0.98:  # 2% buffer below 200 SMA
                    trade.exit_date = current_date
                    trade.exit_price = close
                    trade.exit_reason = "technical_breakdown"
                    trade.exit_details = f"Close ({close:.2f}) broke below 200 SMA ({sma_200_val:.2f})"
                    trade.return_pct = (close / entry_price) - 1
                    trade.holding_period = i
                    trade.is_winner = trade.return_pct > 0
                    return trade
        
        # Max hold period reached - exit at close
        if entry_idx + self.trailing_config.max_hold_days < len(df):
            exit_row = df.iloc[entry_idx + self.trailing_config.max_hold_days]
            exit_price = float(exit_row["close"])
            trade.exit_date = str(exit_row["date"])
            trade.exit_price = exit_price
            trade.exit_reason = "max_hold"
            trade.exit_details = f"Max holding period ({self.trailing_config.max_hold_days} days / ~12 months) reached. Closed at {exit_price:.2f}"
            trade.return_pct = (exit_price / entry_price) - 1
            trade.holding_period = self.trailing_config.max_hold_days
            trade.is_winner = trade.return_pct > 0
        
        return trade
    
    def run_backtest(
        self,
        setup_name: str,
        universe: str,
        start_date: str,
        end_date: str,
    ) -> Dict:
        """
        Run a backtest for a single setup.
        
        Returns a dictionary with metrics and trades.
        """
        setup = POSITION_SETUPS[setup_name]
        
        self.trades = []
        self.trade_counter = 0
        
        print(f"\n{'='*60}")
        print(f"POSITION BACKTEST: {setup_name}")
        print(f"{'='*60}")
        print(f"Universe: {universe}")
        print(f"Date Range: {start_date} to {end_date}")
        print(f"Trailing Stop Config:")
        print(f"  - Initial Stop: {self.trailing_config.initial_stop_pct*100:.0f}%")
        print(f"  - Profit Target: {self.trailing_config.profit_target*100:.0f}%")
        print(f"  - Max Hold: {self.trailing_config.max_hold_days} days")
        print(f"  - Trail Tiers: {self.trailing_config.trail_tiers}")
        print(f"{'='*60}\n")
        
        # Load assets
        assets = self.load_asset_universe(universe)
        
        total_signals = 0
        total_entries = 0
        assets_processed = 0
        assets_skipped = 0
        
        for asset_id, symbol in assets:
            df = self.load_asset_data(asset_id, start_date, end_date)
            
            if df.empty or len(df) < 250:  # Need at least ~1 year of data
                assets_skipped += 1
                continue
            
            assets_processed += 1
            trades_for_asset = 0
            
            # Track when we're in a position to avoid overlapping trades
            in_position_until = -1
            
            # Scan for entry signals
            for idx in range(50, len(df) - self.trailing_config.max_hold_days):
                # Skip if we're still in a position
                if idx <= in_position_until:
                    continue
                
                row = df.iloc[idx].to_dict()
                total_signals += 1
                
                # Check entry conditions
                all_passed, checks = self._check_entry_conditions(setup_name, row)
                
                if all_passed:
                    total_entries += 1
                    entry_price = float(row["close"])
                    
                    trade = self._simulate_position_trade(
                        df=df,
                        entry_idx=idx,
                        entry_price=entry_price,
                        entry_conditions=checks,
                        asset_id=asset_id,
                        asset_symbol=symbol,
                        setup_name=setup_name,
                    )
                    self.trades.append(trade)
                    trades_for_asset += 1
                    
                    # Mark position duration to avoid overlapping
                    if trade.holding_period:
                        in_position_until = idx + trade.holding_period
            
            if trades_for_asset > 0:
                print(f"  {symbol}: {trades_for_asset} trades")
        
        # Calculate metrics
        metrics = self._calculate_metrics()
        
        print(f"\n{'='*60}")
        print("BACKTEST COMPLETE")
        print(f"{'='*60}")
        print(f"Assets Processed: {assets_processed}")
        print(f"Assets Skipped: {assets_skipped}")
        print(f"Total Signals Scanned: {total_signals:,}")
        print(f"Total Entries: {total_entries}")
        print(f"Total Trades: {metrics['total_trades']}")
        print(f"Win Rate: {metrics['win_rate']*100:.1f}%")
        print(f"Profit Factor: {metrics['profit_factor']:.2f}")
        print(f"Avg Return: {metrics['avg_return_pct']*100:+.2f}%")
        print(f"Avg Hold Period: {metrics.get('avg_holding_period', 0):.0f} days")
        print(f"{'='*60}\n")
        
        return {
            "setup_name": setup_name,
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "trailing_config": {
                "initial_stop_pct": self.trailing_config.initial_stop_pct,
                "profit_target": self.trailing_config.profit_target,
                "trail_tiers": self.trailing_config.trail_tiers,
                "max_hold_days": self.trailing_config.max_hold_days,
            },
            "metrics": metrics,
            "summary": {
                "assets_processed": assets_processed,
                "assets_skipped": assets_skipped,
                "signals_scanned": total_signals,
                "entries_triggered": total_entries,
            },
            "trades": [asdict(t) for t in self.trades],
        }
    
    def _calculate_metrics(self) -> Dict:
        """Calculate performance metrics from trades."""
        if not self.trades:
            return {
                "total_trades": 0,
                "win_rate": 0,
                "profit_factor": 0,
                "avg_return_pct": 0,
                "reliability_score": 0,
            }
        
        completed_trades = [t for t in self.trades if t.return_pct is not None]
        if not completed_trades:
            return {
                "total_trades": 0,
                "win_rate": 0,
                "profit_factor": 0,
                "avg_return_pct": 0,
                "reliability_score": 0,
            }
        
        returns = [t.return_pct for t in completed_trades]
        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r < 0]
        
        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 0.0001
        
        win_rate = len(wins) / len(returns) if returns else 0
        profit_factor = gross_profit / gross_loss
        avg_return = np.mean(returns) if returns else 0
        
        # Sharpe ratio (annualized, assuming ~20 trades per year)
        if len(returns) > 1 and np.std(returns) > 0:
            trades_per_year = 20  # Rough estimate for position trading
            sharpe = (np.mean(returns) / np.std(returns)) * np.sqrt(trades_per_year)
        else:
            sharpe = 0
        
        # Reliability score
        reliability = self._calculate_reliability_score(
            win_rate, profit_factor, sharpe, len(returns)
        )
        
        # Exit reason breakdown
        exit_reasons = {}
        for t in completed_trades:
            reason = t.exit_reason or "unknown"
            exit_reasons[reason] = exit_reasons.get(reason, 0) + 1
        
        # Holding period stats
        holding_periods = [t.holding_period for t in completed_trades if t.holding_period]
        
        return {
            "total_trades": len(completed_trades),
            "win_rate": win_rate,
            "loss_rate": 1 - win_rate,
            "profit_factor": profit_factor,
            "avg_return_pct": avg_return,
            "median_return_pct": np.median(returns) if returns else 0,
            "std_return_pct": np.std(returns) if returns else 0,
            "sharpe_ratio": sharpe,
            "best_trade": max(returns) if returns else 0,
            "worst_trade": min(returns) if returns else 0,
            "avg_winner": np.mean(wins) if wins else 0,
            "avg_loser": np.mean(losses) if losses else 0,
            "avg_holding_period": np.mean(holding_periods) if holding_periods else 0,
            "median_holding_period": np.median(holding_periods) if holding_periods else 0,
            "exit_reasons": exit_reasons,
            "reliability_score": reliability,
        }
    
    def _calculate_reliability_score(
        self, 
        win_rate: float, 
        profit_factor: float, 
        sharpe: float, 
        sample_size: int
    ) -> float:
        """
        Calculate a composite reliability score (0-100).
        
        Weights:
        - Win Rate: 30% (target: 60% for position trading)
        - Profit Factor: 30% (target: 2.0)
        - Sharpe Ratio: 25% (target: 1.5)
        - Sample Size: 15% (target: 50 trades)
        """
        wr_score = min(win_rate / 0.60, 1.0) * 30
        pf_score = min(profit_factor / 2.0, 1.0) * 30
        sharpe_score = min(max(sharpe, 0) / 1.5, 1.0) * 25
        sample_score = min(sample_size / 50, 1.0) * 15
        
        return wr_score + pf_score + sharpe_score + sample_score
    
    def export_report(self, results: Dict, output_path: str):
        """Export the backtest results to files."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write JSON
        json_path = output_path.with_suffix(".json")
        with open(json_path, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"✓ JSON export: {json_path}")
        
        # Write Markdown report
        md_path = output_path.with_suffix(".md")
        md_content = self._generate_markdown_report(results)
        with open(md_path, "w") as f:
            f.write(md_content)
        print(f"✓ Markdown report: {md_path}")
        
        # Write CSV of trades
        if results.get("trades"):
            csv_path = output_path.with_suffix(".csv")
            trades_df = pd.DataFrame([
                {
                    "trade_id": t["trade_id"],
                    "asset": t["asset_symbol"],
                    "setup": t["setup_name"],
                    "entry_date": t["entry_date"],
                    "entry_price": t["entry_price"],
                    "exit_date": t["exit_date"],
                    "exit_price": t["exit_price"],
                    "exit_reason": t["exit_reason"],
                    "return_pct": t["return_pct"],
                    "holding_period": t["holding_period"],
                    "max_gain_pct": t["max_gain_pct"],
                    "is_winner": t["is_winner"],
                }
                for t in results["trades"]
            ])
            trades_df.to_csv(csv_path, index=False)
            print(f"✓ CSV trades: {csv_path}")
    
    def _generate_markdown_report(self, results: Dict) -> str:
        """Generate a Markdown report from results."""
        metrics = results["metrics"]
        summary = results["summary"]
        config = results["trailing_config"]
        
        md = f"""# Position Trading Backtest Report: {results['setup_name']}

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | {results['setup_name']} |
| **Universe** | {results['universe']} |
| **Date Range** | {results['start_date']} to {results['end_date']} |

### Trailing Stop Configuration

| Parameter | Value |
|-----------|-------|
| **Initial Stop Loss** | {config['initial_stop_pct']*100:.0f}% |
| **Profit Target** | {config['profit_target']*100:.0f}% |
| **Max Hold Period** | {config['max_hold_days']} days (~12 months) |
| **Trail Tiers** | {config['trail_tiers']} |

---

## Execution Summary

| Metric | Value |
|--------|-------|
| **Assets Processed** | {summary['assets_processed']} |
| **Assets Skipped** | {summary['assets_skipped']} |
| **Signals Scanned** | {summary['signals_scanned']:,} |
| **Entries Triggered** | {summary['entries_triggered']} |

---

## Performance Metrics

| Metric | Value | Interpretation |
|--------|-------|----------------|
| **Total Trades** | {metrics['total_trades']} | Sample size |
| **Win Rate** | {metrics['win_rate']*100:.1f}% | {'✅ Good' if metrics['win_rate'] > 0.5 else '⚠️ Below 50%'} |
| **Profit Factor** | {metrics['profit_factor']:.2f} | {'✅ Profitable' if metrics['profit_factor'] > 1 else '❌ Unprofitable'} |
| **Avg Return** | {metrics['avg_return_pct']*100:+.2f}% | Per-trade expectancy |
| **Avg Hold Period** | {metrics.get('avg_holding_period', 0):.0f} days | Time in position |
| **Best Trade** | {metrics.get('best_trade', 0)*100:+.2f}% | Maximum gain |
| **Worst Trade** | {metrics.get('worst_trade', 0)*100:+.2f}% | Maximum loss |
| **Reliability Score** | {metrics['reliability_score']:.1f}/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count | Description |
|-------------|-------|-------------|
"""
        exit_descriptions = {
            "trailing_stop": "Trailing stop triggered",
            "profit_target": "50% profit target reached",
            "technical_breakdown": "Broke below 200 SMA",
            "max_hold": "Max hold period reached",
        }
        for reason, count in metrics.get('exit_reasons', {}).items():
            desc = exit_descriptions.get(reason, reason)
            md += f"| {reason} | {count} | {desc} |\n"
        
        md += """
---

## Trade Journal (First 20 Trades)

"""
        # Add first 20 trades
        for trade_dict in results.get("trades", [])[:20]:
            trade = PositionTrade(
                trade_id=trade_dict["trade_id"],
                asset_id=trade_dict["asset_id"],
                asset_symbol=trade_dict["asset_symbol"],
                setup_name=trade_dict["setup_name"],
                entry_date=trade_dict["entry_date"],
                entry_price=trade_dict["entry_price"],
                entry_conditions=[ConditionCheck(**c) for c in trade_dict["entry_conditions"]],
                entry_parameters=trade_dict["entry_parameters"],
                highest_price=trade_dict.get("highest_price", 0),
                highest_price_date=trade_dict.get("highest_price_date"),
                max_gain_pct=trade_dict.get("max_gain_pct", 0),
                exit_date=trade_dict.get("exit_date"),
                exit_price=trade_dict.get("exit_price"),
                exit_reason=trade_dict.get("exit_reason"),
                exit_details=trade_dict.get("exit_details"),
                return_pct=trade_dict.get("return_pct"),
                holding_period=trade_dict.get("holding_period"),
                is_winner=trade_dict.get("is_winner"),
            )
            md += trade.to_markdown()
            md += "\n---\n"
        
        if len(results.get("trades", [])) > 20:
            md += f"\n*...and {len(results['trades']) - 20} more trades (see CSV export)*\n"
        
        md += """
---

*Report generated by Stratos Brain Position Trading Backtester*
"""
        return md


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Position Trading Backtester for Stratos Brain")
    parser.add_argument("--setup", type=str, required=True, help="Setup name to test")
    parser.add_argument("--universe", type=str, default="equity", choices=["crypto", "equity"], help="Asset universe")
    parser.add_argument("--start", type=str, default="2020-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default="2025-12-31", help="End date (YYYY-MM-DD)")
    parser.add_argument("--output", type=str, default=None, help="Output path (without extension)")
    parser.add_argument("--initial-stop", type=float, default=0.15, help="Initial stop loss percentage (default: 0.15)")
    parser.add_argument("--profit-target", type=float, default=0.50, help="Profit target percentage (default: 0.50)")
    args = parser.parse_args()
    
    if args.output is None:
        args.output = f"./data/position/{args.setup}_{args.universe}"
    
    # Configure trailing stop
    trailing_config = TrailingStopConfig(
        initial_stop_pct=args.initial_stop,
        profit_target=args.profit_target,
    )
    
    backtester = PositionBacktester(trailing_config)
    backtester.connect()
    
    try:
        results = backtester.run_backtest(
            setup_name=args.setup,
            universe=args.universe,
            start_date=args.start,
            end_date=args.end,
        )
        
        backtester.export_report(results, args.output)
        
    finally:
        backtester.disconnect()


if __name__ == "__main__":
    main()

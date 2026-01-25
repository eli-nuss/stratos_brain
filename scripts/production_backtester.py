"""
Production Backtester for Stratos Brain
========================================

Connects to the real Supabase database and runs backtests on actual crypto/equity data.

Usage:
    python scripts/production_backtester.py --setup standard_breakout --universe crypto --start 2023-01-01 --end 2025-12-31
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
class AuditableTrade:
    """A trade with full audit trail."""
    trade_id: int
    asset_id: int
    asset_symbol: str
    setup_name: str
    
    # Entry details
    entry_date: str
    entry_price: float
    entry_conditions: List[ConditionCheck]
    entry_parameters: Dict[str, Any]
    
    # Position sizing
    stop_loss_price: float
    take_profit_price: float
    risk_amount: float
    reward_amount: float
    risk_reward_ratio: float
    
    # Exit details
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    exit_details: Optional[str] = None
    
    # Results
    return_pct: Optional[float] = None
    holding_period: Optional[int] = None
    is_winner: Optional[bool] = None
    
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_markdown(self) -> str:
        """Generate a human-readable Markdown summary of this trade."""
        status = "✅ WIN" if self.is_winner else "❌ LOSS" if self.is_winner is False else "⏳ OPEN"
        return_str = f"{self.return_pct*100:+.2f}%" if self.return_pct else "N/A"
        exit_price_str = f"${self.exit_price:.4f}" if self.exit_price else "N/A"
        
        md = f"""
### Trade #{self.trade_id}: {self.asset_symbol} ({status})

| Field | Value |
|-------|-------|
| **Setup** | {self.setup_name} |
| **Entry Date** | {self.entry_date} |
| **Entry Price** | ${self.entry_price:.4f} |
| **Stop Loss** | ${self.stop_loss_price:.4f} |
| **Take Profit** | ${self.take_profit_price:.4f} |
| **Risk:Reward** | 1:{self.risk_reward_ratio:.1f} |
| **Exit Date** | {self.exit_date or 'N/A'} |
| **Exit Price** | {exit_price_str} |
| **Exit Reason** | {self.exit_reason or 'N/A'} |
| **Return** | {return_str} |
| **Holding Period** | {self.holding_period or 'N/A'} days |

**Entry Conditions:**
"""
        for cond in self.entry_conditions:
            status_icon = "✓" if cond.passed else "✗"
            md += f"- {status_icon} `{cond.condition_name}`: {cond.expression} → Actual: {cond.actual_value}, Threshold: {cond.threshold}\n"
        
        if self.exit_details:
            md += f"\n**Exit Details:** {self.exit_details}\n"
        
        return md


# =============================================================================
# SETUP DEFINITIONS
# =============================================================================

MASTER_SETUPS = {
    "pullback_ma50": {
        "description": "Pullback to 50-day MA in strong uptrend",
        "category": "trend_continuation",
        "direction": "long",
        "base_params": {
            "rsi_threshold": 45,
            "stop_loss_atr_mult": 1.5,
            "take_profit_r_mult": 3.0,
            "max_hold_days": 20,
        },
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Touched 50 SMA", "field": "ma_dist_50", "operator": "<=", "threshold_value": 0.02},
            {"name": "RSI Not Overbought", "field": "rsi_14", "operator": "<", "threshold_param": "rsi_threshold"},
        ],
    },
    "vcp_squeeze": {
        "description": "Volatility Contraction Pattern - bands tightening",
        "category": "trend_continuation",
        "direction": "long",
        "base_params": {
            "bb_width_pctile_thresh": 0.15,
            "rvol_thresh": 0.8,
            "stop_loss_atr_mult": 2.0,
            "take_profit_r_mult": 3.0,
            "max_hold_days": 30,
        },
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "BB Width Contracted", "field": "bb_width_pctile", "operator": "<", "threshold_param": "bb_width_pctile_thresh"},
            {"name": "Volume Dried Up", "field": "rvol_20", "operator": "<", "threshold_param": "rvol_thresh"},
        ],
    },
    "standard_breakout": {
        "description": "Price clears resistance on high volume",
        "category": "momentum",
        "direction": "long",
        "base_params": {
            "rvol_thresh": 2.0,
            "rsi_thresh": 60,
            "stop_loss_atr_mult": 1.5,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 10,
        },
        "conditions": [
            {"name": "20-Day Breakout", "field": "breakout_up_20", "operator": "==", "threshold_value": True},
            {"name": "High Relative Volume", "field": "rvol_20", "operator": ">", "threshold_param": "rvol_thresh"},
            {"name": "RSI Confirms Momentum", "field": "rsi_14", "operator": ">", "threshold_param": "rsi_thresh"},
        ],
    },
    "gap_and_go": {
        "description": "Institutional gap-up that holds gains",
        "category": "momentum",
        "direction": "long",
        "base_params": {
            "gap_pct_thresh": 0.03,
            "rvol_thresh": 2.5,
            "stop_loss_atr_mult": 1.0,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 5,
        },
        "conditions": [
            {"name": "Gap Up", "field": "gap_pct", "operator": ">", "threshold_param": "gap_pct_thresh"},
            {"name": "High Relative Volume", "field": "rvol_20", "operator": ">", "threshold_param": "rvol_thresh"},
            {"name": "Gap Held", "field": "gap_up", "operator": "==", "threshold_value": True},
        ],
    },
    "mean_reversion": {
        "description": "Oversold bounce from extreme levels",
        "category": "reversal",
        "direction": "long",
        "base_params": {
            "ma_dist_thresh": -0.12,
            "rsi_thresh": 35,
            "stop_loss_atr_mult": 2.0,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 10,
        },
        "conditions": [
            {"name": "Extended Below MA", "field": "ma_dist_20", "operator": "<", "threshold_param": "ma_dist_thresh"},
            {"name": "RSI Oversold", "field": "rsi_14", "operator": "<", "threshold_param": "rsi_thresh"},
        ],
    },
    "squeeze_breakout": {
        "description": "Squeeze release with momentum",
        "category": "momentum",
        "direction": "long",
        "base_params": {
            "rvol_thresh": 1.5,
            "stop_loss_atr_mult": 1.5,
            "take_profit_r_mult": 2.5,
            "max_hold_days": 15,
        },
        "conditions": [
            {"name": "Squeeze Released", "field": "squeeze_release", "operator": "==", "threshold_value": True},
            {"name": "Above Average Volume", "field": "rvol_20", "operator": ">", "threshold_param": "rvol_thresh"},
            {"name": "Positive Momentum", "field": "roc_5", "operator": ">", "threshold_value": 0},
        ],
    },
    "momentum_acceleration": {
        "description": "Accelerating momentum with volume confirmation",
        "category": "momentum",
        "direction": "long",
        "base_params": {
            "droc_thresh": 0.01,
            "rvol_thresh": 1.5,
            "stop_loss_atr_mult": 1.5,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 10,
        },
        "conditions": [
            {"name": "Momentum Accelerating", "field": "droc_20", "operator": ">", "threshold_param": "droc_thresh"},
            {"name": "Above Average Volume", "field": "rvol_20", "operator": ">", "threshold_param": "rvol_thresh"},
            {"name": "Positive RSI", "field": "rsi_14", "operator": ">", "threshold_value": 50},
        ],
    },
}


# =============================================================================
# PRODUCTION BACKTESTER
# =============================================================================

class ProductionBacktester:
    """
    Production backtester that connects to the real Stratos Brain database.
    """
    
    def __init__(self):
        self.conn = None
        self.trade_counter = 0
        self.trades: List[AuditableTrade] = []
        self.decision_log: List[Dict] = []
    
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
            # Use a curated list of liquid, well-known stocks for faster testing
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
                AND f.date >= '2022-01-01'
                GROUP BY a.asset_id, a.symbol
                HAVING COUNT(*) >= 200
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
        
        # Join daily_bars (OHLCV) with daily_features
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
        
        # Calculate ATR if missing (using realized_vol as proxy)
        if df['atr_14'].isna().all():
            # Use atr_pct * close as ATR estimate
            if 'atr_pct' in df.columns and not df['atr_pct'].isna().all():
                df['atr_14'] = df['atr_pct'] * df['close']
            else:
                # Fallback: use 2% of price
                df['atr_14'] = df['close'] * 0.02
        
        return df
    
    def _get_threshold(self, condition: Dict, params: Dict, row: Dict) -> Any:
        """Get the threshold value for a condition."""
        if "threshold_value" in condition:
            return condition["threshold_value"]
        elif "threshold_param" in condition:
            return params.get(condition["threshold_param"])
        elif "threshold_field" in condition:
            return row.get(condition["threshold_field"])
        return None
    
    def _evaluate_condition(self, condition: Dict, row: Dict, params: Dict) -> ConditionCheck:
        """Evaluate a single condition and return a detailed check result."""
        field_name = condition["field"]
        operator = condition["operator"]
        actual_value = row.get(field_name)
        threshold = self._get_threshold(condition, params, row)
        
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
        row: Dict, 
        params: Dict
    ) -> Tuple[bool, List[ConditionCheck]]:
        """Check all entry conditions and return detailed results."""
        setup = MASTER_SETUPS[setup_name]
        conditions = setup["conditions"]
        
        checks = []
        all_passed = True
        
        for condition in conditions:
            check = self._evaluate_condition(condition, row, params)
            checks.append(check)
            if not check.passed:
                all_passed = False
        
        return all_passed, checks
    
    def _simulate_trade(
        self,
        df: pd.DataFrame,
        entry_idx: int,
        entry_price: float,
        atr: float,
        params: Dict,
        direction: str,
        entry_conditions: List[ConditionCheck],
        asset_id: int,
        asset_symbol: str,
        setup_name: str,
    ) -> AuditableTrade:
        """Simulate a trade with full audit trail."""
        self.trade_counter += 1
        
        stop_mult = params.get("stop_loss_atr_mult", 1.5)
        tp_mult = params.get("take_profit_r_mult", 2.0)
        max_days = params.get("max_hold_days", 20)
        
        risk = atr * stop_mult
        reward = risk * tp_mult
        
        if direction == "long":
            stop_loss = entry_price - risk
            take_profit = entry_price + reward
        else:
            stop_loss = entry_price + risk
            take_profit = entry_price - reward
        
        entry_date = str(df.iloc[entry_idx]["date"])
        
        trade = AuditableTrade(
            trade_id=self.trade_counter,
            asset_id=asset_id,
            asset_symbol=asset_symbol,
            setup_name=setup_name,
            entry_date=entry_date,
            entry_price=entry_price,
            entry_conditions=entry_conditions,
            entry_parameters=params.copy(),
            stop_loss_price=stop_loss,
            take_profit_price=take_profit,
            risk_amount=risk,
            reward_amount=reward,
            risk_reward_ratio=tp_mult,
        )
        
        # Simulate the trade day by day
        for i in range(1, max_days + 1):
            if entry_idx + i >= len(df):
                break
            
            row = df.iloc[entry_idx + i]
            current_date = str(row["date"])
            high = float(row["high"])
            low = float(row["low"])
            close = float(row["close"])
            
            if direction == "long":
                if low <= stop_loss:
                    trade.exit_date = current_date
                    trade.exit_price = stop_loss
                    trade.exit_reason = "stop_loss"
                    trade.exit_details = f"Low ({low:.4f}) breached stop loss ({stop_loss:.4f})"
                    trade.return_pct = (stop_loss / entry_price) - 1
                    trade.holding_period = i
                    trade.is_winner = False
                    return trade
                
                if high >= take_profit:
                    trade.exit_date = current_date
                    trade.exit_price = take_profit
                    trade.exit_reason = "take_profit"
                    trade.exit_details = f"High ({high:.4f}) reached take profit ({take_profit:.4f})"
                    trade.return_pct = (take_profit / entry_price) - 1
                    trade.holding_period = i
                    trade.is_winner = True
                    return trade
            else:
                if high >= stop_loss:
                    trade.exit_date = current_date
                    trade.exit_price = stop_loss
                    trade.exit_reason = "stop_loss"
                    trade.exit_details = f"High ({high:.4f}) breached stop loss ({stop_loss:.4f})"
                    trade.return_pct = (entry_price / stop_loss) - 1
                    trade.holding_period = i
                    trade.is_winner = False
                    return trade
                
                if low <= take_profit:
                    trade.exit_date = current_date
                    trade.exit_price = take_profit
                    trade.exit_reason = "take_profit"
                    trade.exit_details = f"Low ({low:.4f}) reached take profit ({take_profit:.4f})"
                    trade.return_pct = (entry_price / take_profit) - 1
                    trade.holding_period = i
                    trade.is_winner = True
                    return trade
        
        # Time exit
        if entry_idx + max_days < len(df):
            exit_row = df.iloc[entry_idx + max_days]
            exit_price = float(exit_row["close"])
            trade.exit_date = str(exit_row["date"])
            trade.exit_price = exit_price
            trade.exit_reason = "time_exit"
            trade.exit_details = f"Max holding period ({max_days} days) reached. Closed at {exit_price:.4f}"
            
            if direction == "long":
                trade.return_pct = (exit_price / entry_price) - 1
            else:
                trade.return_pct = (entry_price / exit_price) - 1
            
            trade.holding_period = max_days
            trade.is_winner = trade.return_pct > 0
        
        return trade
    
    def run_backtest(
        self,
        setup_name: str,
        universe: str,
        start_date: str,
        end_date: str,
        params: Optional[Dict] = None,
    ) -> Dict:
        """
        Run a backtest for a single setup.
        
        Returns a dictionary with metrics and trades.
        """
        setup = MASTER_SETUPS[setup_name]
        direction = setup.get("direction", "long")
        params = params or setup["base_params"]
        
        self.trades = []
        self.trade_counter = 0
        
        print(f"\n{'='*60}")
        print(f"BACKTEST: {setup_name}")
        print(f"{'='*60}")
        print(f"Universe: {universe}")
        print(f"Date Range: {start_date} to {end_date}")
        print(f"Parameters: {json.dumps(params, indent=2)}")
        print(f"{'='*60}\n")
        
        # Load assets
        assets = self.load_asset_universe(universe)
        
        total_signals = 0
        total_entries = 0
        assets_processed = 0
        assets_skipped = 0
        
        for asset_id, symbol in assets:
            df = self.load_asset_data(asset_id, start_date, end_date)
            
            if df.empty or len(df) < 50:
                assets_skipped += 1
                continue
            
            assets_processed += 1
            trades_for_asset = 0
            max_hold = params.get("max_hold_days", 20)
            
            # Scan for entry signals
            for idx in range(20, len(df) - max_hold):
                row = df.iloc[idx].to_dict()
                total_signals += 1
                
                # Check entry conditions
                all_passed, checks = self._check_entry_conditions(setup_name, row, params)
                
                if all_passed:
                    total_entries += 1
                    entry_price = float(row["close"])
                    atr = float(row.get("atr_14") or entry_price * 0.02)
                    
                    trade = self._simulate_trade(
                        df=df,
                        entry_idx=idx,
                        entry_price=entry_price,
                        atr=atr,
                        params=params,
                        direction=direction,
                        entry_conditions=checks,
                        asset_id=asset_id,
                        asset_symbol=symbol,
                        setup_name=setup_name,
                    )
                    self.trades.append(trade)
                    trades_for_asset += 1
            
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
        print(f"{'='*60}\n")
        
        return {
            "setup_name": setup_name,
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "parameters": params,
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
        
        # Sharpe ratio (annualized)
        if len(returns) > 1 and np.std(returns) > 0:
            sharpe = (np.mean(returns) / np.std(returns)) * np.sqrt(252)
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
            "avg_holding_period": np.mean([t.holding_period for t in completed_trades if t.holding_period]),
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
        - Win Rate: 30% (target: 70%)
        - Profit Factor: 30% (target: 2.5)
        - Sharpe Ratio: 25% (target: 2.0)
        - Sample Size: 15% (target: 100 trades)
        """
        wr_score = min(win_rate / 0.70, 1.0) * 30
        pf_score = min(profit_factor / 2.5, 1.0) * 30
        sharpe_score = min(max(sharpe, 0) / 2.0, 1.0) * 25
        sample_score = min(sample_size / 100, 1.0) * 15
        
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
                    "stop_loss": t["stop_loss_price"],
                    "take_profit": t["take_profit_price"],
                    "exit_date": t["exit_date"],
                    "exit_price": t["exit_price"],
                    "exit_reason": t["exit_reason"],
                    "return_pct": t["return_pct"],
                    "holding_period": t["holding_period"],
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
        
        md = f"""# Backtest Report: {results['setup_name']}

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## Configuration

| Parameter | Value |
|-----------|-------|
| **Setup** | {results['setup_name']} |
| **Universe** | {results['universe']} |
| **Date Range** | {results['start_date']} to {results['end_date']} |

### Parameters

```json
{json.dumps(results['parameters'], indent=2)}
```

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
| **Sharpe Ratio** | {metrics.get('sharpe_ratio', 0):.2f} | Risk-adjusted return |
| **Reliability Score** | {metrics['reliability_score']:.1f}/100 | Composite score |

### Exit Reason Breakdown

| Exit Reason | Count |
|-------------|-------|
"""
        for reason, count in metrics.get('exit_reasons', {}).items():
            md += f"| {reason} | {count} |\n"
        
        md += """
---

## Trade Journal (First 20 Trades)

"""
        # Add first 20 trades
        for trade_dict in results.get("trades", [])[:20]:
            # Reconstruct trade object for markdown
            trade = AuditableTrade(
                trade_id=trade_dict["trade_id"],
                asset_id=trade_dict["asset_id"],
                asset_symbol=trade_dict["asset_symbol"],
                setup_name=trade_dict["setup_name"],
                entry_date=trade_dict["entry_date"],
                entry_price=trade_dict["entry_price"],
                entry_conditions=[ConditionCheck(**c) for c in trade_dict["entry_conditions"]],
                entry_parameters=trade_dict["entry_parameters"],
                stop_loss_price=trade_dict["stop_loss_price"],
                take_profit_price=trade_dict["take_profit_price"],
                risk_amount=trade_dict["risk_amount"],
                reward_amount=trade_dict["reward_amount"],
                risk_reward_ratio=trade_dict["risk_reward_ratio"],
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

*Report generated by Stratos Brain Production Backtester*
"""
        return md


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Production Backtester for Stratos Brain")
    parser.add_argument("--setup", type=str, required=True, help="Setup name to test")
    parser.add_argument("--universe", type=str, default="crypto", choices=["crypto", "equity"], help="Asset universe")
    parser.add_argument("--start", type=str, default="2023-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default="2025-12-31", help="End date (YYYY-MM-DD)")
    parser.add_argument("--output", type=str, default=None, help="Output path (without extension)")
    args = parser.parse_args()
    
    if args.output is None:
        args.output = f"./data/baseline/{args.setup}_{args.universe}"
    
    backtester = ProductionBacktester()
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

"""
Long-Term Position Backtester (3-12 Month Timeframe)

Setups designed to identify stocks at the beginning of major moves:
- Base breakouts (emerging from long consolidations)
- Stage 2 uptrend beginnings
- Institutional accumulation patterns
- Relative strength leaders
- Recovery from deep corrections

Exit Strategy: Very wide stops, ride the trend, 200 MA as ultimate stop
"""

import json
import os
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor


# =============================================================================
# DATABASE CONNECTION
# =============================================================================

def get_db_connection():
    return psycopg2.connect(
        host='db.wfogbaipiqootjrsprde.supabase.co',
        port=5432,
        database='postgres',
        user='postgres',
        password='stratosbrainpostgresdbpw'
    )


# =============================================================================
# LONG-TERM SETUPS (3-12 Month Timeframe)
# =============================================================================

LONGTERM_SETUPS = {
    # =========================================================================
    # BASE BREAKOUT SETUPS
    # Stocks emerging from long consolidation periods
    # =========================================================================
    "base_breakout_55d": {
        "description": "Breaking out of 55-day Donchian channel (new 55-day high)",
        "category": "breakout",
        "conditions": [
            {"name": "New 55-Day High", "field": "close", "operator": ">=", "threshold_field": "donchian_high_55"},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "50 MA Above 200 MA", "field": "ma50_above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Volume Confirmation", "field": "rvol_20", "operator": ">", "threshold_value": 1.3},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 200,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 4.0,
            "trail_activation_pct": 0.30,
            "profit_target_pct": 0.75,
            "max_hold_days": 252,
        }
    },
    
    "tight_base_breakout": {
        "description": "Breakout from tight consolidation (low volatility squeeze)",
        "category": "breakout",
        "conditions": [
            {"name": "Tight Squeeze", "field": "squeeze_pctile", "operator": "<", "threshold_value": 20},
            {"name": "Breakout Up", "field": "breakout_confirmed_up", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Volume Surge", "field": "rvol_20", "operator": ">", "threshold_value": 1.5},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 50,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 3.5,
            "trail_activation_pct": 0.25,
            "profit_target_pct": 0.60,
            "max_hold_days": 252,
        }
    },
    
    # =========================================================================
    # STAGE 2 UPTREND SETUPS
    # Stocks entering the "markup" phase (Weinstein methodology)
    # =========================================================================
    "stage2_entry": {
        "description": "Stage 2 entry - price crosses above 200 MA with momentum",
        "category": "trend_start",
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "50 MA Above 200 MA", "field": "ma50_above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Near 52-Week High", "field": "dist_52w_high", "operator": ">", "threshold_value": -0.15},
            {"name": "Positive Momentum", "field": "roc_20", "operator": ">", "threshold_value": 0.05},
            {"name": "RS Improving", "field": "rs_roc_20", "operator": ">", "threshold_value": 0},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 200,
            "stop_ma_buffer": 0.03,
            "use_trailing": True,
            "trail_atr_mult": 4.0,
            "trail_activation_pct": 0.35,
            "profit_target_pct": 0.75,
            "max_hold_days": 252,
        }
    },
    
    "golden_cross_momentum": {
        "description": "50 MA crosses above 200 MA with strong momentum",
        "category": "trend_start",
        "conditions": [
            {"name": "50 MA Above 200 MA", "field": "ma50_above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Strong Momentum", "field": "roc_20", "operator": ">", "threshold_value": 0.08},
            {"name": "Volume Confirmation", "field": "rvol_20", "operator": ">", "threshold_value": 1.2},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 200,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 4.0,
            "trail_activation_pct": 0.30,
            "profit_target_pct": 0.75,
            "max_hold_days": 252,
        }
    },
    
    # =========================================================================
    # RELATIVE STRENGTH SETUPS
    # Stocks outperforming the market
    # =========================================================================
    "rs_leader": {
        "description": "Relative strength leader breaking out",
        "category": "relative_strength",
        "conditions": [
            {"name": "RS Breakout", "field": "rs_breakout", "operator": "==", "threshold_value": True},
            {"name": "Strong RS", "field": "rs_vs_benchmark", "operator": ">", "threshold_value": 0.10},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive Momentum", "field": "roc_20", "operator": ">", "threshold_value": 0},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 50,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 3.5,
            "trail_activation_pct": 0.25,
            "profit_target_pct": 0.60,
            "max_hold_days": 252,
        }
    },
    
    "rs_acceleration": {
        "description": "Relative strength accelerating (outperformance increasing)",
        "category": "relative_strength",
        "conditions": [
            {"name": "RS Accelerating", "field": "rs_roc_20", "operator": ">", "threshold_value": 0.05},
            {"name": "Strong RS", "field": "rs_vs_benchmark", "operator": ">", "threshold_value": 0.05},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "50 MA Above 200 MA", "field": "ma50_above_ma200", "operator": "==", "threshold_value": True},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 200,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 4.0,
            "trail_activation_pct": 0.30,
            "profit_target_pct": 0.75,
            "max_hold_days": 252,
        }
    },
    
    # =========================================================================
    # ACCUMULATION SETUPS
    # Signs of institutional buying
    # =========================================================================
    "accumulation_breakout": {
        "description": "Volume accumulation with price breakout",
        "category": "accumulation",
        "conditions": [
            {"name": "OBV Rising", "field": "obv_slope_20", "operator": ">", "threshold_value": 0},
            {"name": "Volume Above Average", "field": "volume_z_60", "operator": ">", "threshold_value": 0.5},
            {"name": "Breakout Up", "field": "breakout_up_20", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 50,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 3.5,
            "trail_activation_pct": 0.25,
            "profit_target_pct": 0.60,
            "max_hold_days": 252,
        }
    },
    
    "quiet_accumulation": {
        "description": "Low volatility with rising OBV (stealth accumulation)",
        "category": "accumulation",
        "conditions": [
            {"name": "Low Volatility", "field": "bb_width_pctile", "operator": "<", "threshold_value": 30},
            {"name": "OBV Rising", "field": "obv_slope_20", "operator": ">", "threshold_value": 0},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "50 MA Above 200 MA", "field": "ma50_above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Near Highs", "field": "dist_52w_high", "operator": ">", "threshold_value": -0.10},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 200,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 4.0,
            "trail_activation_pct": 0.30,
            "profit_target_pct": 0.75,
            "max_hold_days": 252,
        }
    },
    
    # =========================================================================
    # RECOVERY SETUPS
    # Stocks recovering from significant corrections
    # =========================================================================
    "deep_correction_recovery": {
        "description": "Recovery from 30%+ drawdown with trend confirmation",
        "category": "recovery",
        "conditions": [
            {"name": "Was Deep Correction", "field": "drawdown_252d", "operator": "<", "threshold_value": -0.30},
            {"name": "Now Above 50 MA", "field": "ma_dist_50", "operator": ">", "threshold_value": 0},
            {"name": "Momentum Positive", "field": "roc_20", "operator": ">", "threshold_value": 0.05},
            {"name": "Volume Confirmation", "field": "rvol_20", "operator": ">", "threshold_value": 1.2},
        ],
        "exit": {
            "stop_type": "atr",
            "stop_atr_mult": 3.5,
            "use_trailing": True,
            "trail_atr_mult": 3.5,
            "trail_activation_pct": 0.25,
            "profit_target_pct": 0.60,
            "max_hold_days": 252,
        }
    },
    
    "52w_low_reversal": {
        "description": "Near 52-week low with reversal signals",
        "category": "recovery",
        "conditions": [
            {"name": "Near 52W Low", "field": "dist_52w_low", "operator": "<", "threshold_value": 0.15},
            {"name": "Momentum Turning", "field": "accel_turn_up", "operator": "==", "threshold_value": True},
            {"name": "Volume Surge", "field": "rvol_20", "operator": ">", "threshold_value": 1.5},
            {"name": "RSI Oversold Bounce", "field": "rsi_14", "operator": "<", "threshold_value": 40},
        ],
        "exit": {
            "stop_type": "atr",
            "stop_atr_mult": 3.0,
            "use_trailing": True,
            "trail_atr_mult": 3.0,
            "trail_activation_pct": 0.20,
            "profit_target_pct": 0.50,
            "max_hold_days": 252,
        }
    },
    
    # =========================================================================
    # TREND CONTINUATION (LONG-TERM)
    # Pullbacks in established long-term uptrends
    # =========================================================================
    "longterm_trend_pullback": {
        "description": "Pullback to 200 MA in strong long-term uptrend",
        "category": "trend_continuation",
        "conditions": [
            {"name": "Near 200 MA", "field": "ma_dist_200", "operator": "<=", "threshold_value": 0.05},
            {"name": "Near 200 MA", "field": "ma_dist_200", "operator": ">=", "threshold_value": -0.05},
            {"name": "50 MA Above 200 MA", "field": "ma50_above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Not Oversold", "field": "rsi_14", "operator": ">", "threshold_value": 30},
            {"name": "Near 52W High", "field": "dist_52w_high", "operator": ">", "threshold_value": -0.25},
        ],
        "exit": {
            "stop_type": "atr",
            "stop_atr_mult": 4.0,
            "use_trailing": True,
            "trail_atr_mult": 4.0,
            "trail_activation_pct": 0.35,
            "profit_target_pct": 0.75,
            "max_hold_days": 252,
        }
    },
    
    "monthly_breakout": {
        "description": "Breaking to new monthly highs with trend alignment",
        "category": "trend_continuation",
        "conditions": [
            {"name": "Near 52W High", "field": "dist_52w_high", "operator": ">", "threshold_value": -0.05},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "50 MA Above 200 MA", "field": "ma50_above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Strong RS", "field": "rs_vs_benchmark", "operator": ">", "threshold_value": 0},
            {"name": "Volume Confirmation", "field": "rvol_20", "operator": ">", "threshold_value": 1.2},
        ],
        "exit": {
            "stop_type": "ma_close",
            "stop_ma_period": 50,
            "stop_ma_buffer": 0.05,
            "use_trailing": True,
            "trail_atr_mult": 3.5,
            "trail_activation_pct": 0.30,
            "profit_target_pct": 0.75,
            "max_hold_days": 252,
        }
    },
}


# =============================================================================
# BACKTESTER
# =============================================================================

@dataclass
class Trade:
    trade_id: int
    asset_symbol: str
    setup_name: str
    entry_date: str
    entry_price: float
    entry_atr: float
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    return_pct: Optional[float] = None
    holding_days: Optional[int] = None
    high_water_mark: float = 0.0


class LongTermBacktester:
    """Backtester for long-term position trading (3-12 months)."""
    
    def __init__(self):
        self.conn = None
        self.trades: List[Trade] = []
        self.trade_counter = 0
    
    def connect(self):
        self.conn = get_db_connection()
        print("✅ Connected to database")
    
    def disconnect(self):
        if self.conn:
            self.conn.close()
    
    def load_assets(self, universe: str = "equity") -> List[Tuple[int, str]]:
        cur = self.conn.cursor()
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
        return cur.fetchall()
    
    def load_data(self, asset_id: int, start_date: str, end_date: str) -> pd.DataFrame:
        cur = self.conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                b.date, b.open, b.high, b.low, b.close, b.volume,
                f.rsi_14, f.sma_20, f.sma_50, f.sma_200,
                f.ma_dist_20, f.ma_dist_50, f.ma_dist_200,
                f.above_ma200, f.ma50_above_ma200,
                f.roc_5, f.roc_20, f.atr_14,
                f.dist_52w_high, f.dist_52w_low,
                f.rs_vs_benchmark, f.rs_roc_20, f.rs_breakout,
                f.donchian_high_55, f.donchian_low_55,
                f.drawdown_252d, f.drawdown_63d,
                f.squeeze_pctile, f.bb_width_pctile,
                f.obv_slope_20, f.volume_z_60,
                f.rvol_20, f.breakout_up_20, f.breakout_confirmed_up,
                f.accel_turn_up
            FROM daily_bars b
            JOIN daily_features f ON f.asset_id = b.asset_id AND f.date = b.date
            WHERE b.asset_id = %s AND b.date BETWEEN %s AND %s
            ORDER BY b.date
        """, (asset_id, start_date, end_date))
        
        rows = cur.fetchall()
        if not rows:
            return pd.DataFrame()
        
        df = pd.DataFrame(rows)
        for col in df.columns:
            if col != 'date' and df[col].dtype == object:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        return df
    
    def check_entry(self, setup_name: str, row: Dict) -> bool:
        setup = LONGTERM_SETUPS.get(setup_name)
        if not setup:
            return False
        
        for cond in setup["conditions"]:
            field = cond["field"]
            op = cond["operator"]
            
            # Handle threshold_field (compare two fields)
            if "threshold_field" in cond:
                threshold = row.get(cond["threshold_field"])
            else:
                threshold = cond["threshold_value"]
            
            actual = row.get(field)
            
            if actual is None or threshold is None:
                return False
            
            if op == "==" and actual != threshold:
                return False
            elif op == "!=" and actual == threshold:
                return False
            elif op == ">" and not (actual > threshold):
                return False
            elif op == ">=" and not (actual >= threshold):
                return False
            elif op == "<" and not (actual < threshold):
                return False
            elif op == "<=" and not (actual <= threshold):
                return False
        
        return True
    
    def check_exit(self, trade: Trade, row: Dict, exit_config: Dict, days_held: int) -> Optional[Tuple[float, str]]:
        """Check exit conditions for long-term positions."""
        close = row['close']
        high = row['high']
        low = row['low']
        atr = row.get('atr_14') or trade.entry_atr
        
        # Update high water mark
        if high > trade.high_water_mark:
            trade.high_water_mark = high
        
        gain_pct = (close - trade.entry_price) / trade.entry_price
        
        # 1. STOP LOSS
        stop_type = exit_config.get("stop_type", "atr")
        
        if stop_type == "atr":
            stop_price = trade.entry_price - (atr * exit_config.get("stop_atr_mult", 3.5))
            if low <= stop_price:
                return (stop_price, "stop_loss_atr")
        
        elif stop_type == "ma_close":
            ma_period = exit_config.get("stop_ma_period", 200)
            ma_value = row.get(f'sma_{ma_period}')
            if ma_value:
                buffer = exit_config.get("stop_ma_buffer", 0.05)
                stop_level = ma_value * (1 - buffer)
                if close < stop_level:
                    return (close, f"stop_below_{ma_period}ma")
        
        # 2. TRAILING STOP (if activated)
        if exit_config.get("use_trailing", False):
            activation = exit_config.get("trail_activation_pct", 0.30)
            if gain_pct >= activation:
                trail_mult = exit_config.get("trail_atr_mult", 4.0)
                trail_stop = trade.high_water_mark - (atr * trail_mult)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
        
        # 3. PROFIT TARGET
        target_pct = exit_config.get("profit_target_pct", 0.75)
        if gain_pct >= target_pct:
            return (trade.entry_price * (1 + target_pct), "profit_target")
        
        # 4. MAX HOLD
        max_hold = exit_config.get("max_hold_days", 252)
        if days_held >= max_hold:
            return (close, "max_hold")
        
        return None
    
    def run_backtest(
        self,
        setup_name: str,
        start_date: str = "2020-01-01",
        end_date: str = "2025-12-31",
    ) -> Dict:
        """Run backtest for a single long-term setup."""
        
        setup = LONGTERM_SETUPS.get(setup_name)
        if not setup:
            raise ValueError(f"Setup {setup_name} not found")
        
        exit_config = setup["exit"]
        self.trades = []
        self.trade_counter = 0
        
        print(f"\n{'='*60}")
        print(f"LONG-TERM BACKTEST: {setup_name}")
        print(f"Description: {setup['description']}")
        print(f"Category: {setup['category']}")
        print(f"{'='*60}")
        
        assets = self.load_assets()
        print(f"📊 Loaded {len(assets)} assets")
        
        for asset_id, symbol in assets:
            df = self.load_data(asset_id, start_date, end_date)
            if df.empty:
                continue
            
            rows = df.to_dict('records')
            in_trade = False
            current_trade = None
            entry_idx = 0
            
            for i, row in enumerate(rows):
                if in_trade:
                    days_held = i - entry_idx
                    exit_result = self.check_exit(current_trade, row, exit_config, days_held)
                    
                    if exit_result:
                        exit_price, exit_reason = exit_result
                        current_trade.exit_date = str(row['date'])
                        current_trade.exit_price = exit_price
                        current_trade.exit_reason = exit_reason
                        current_trade.return_pct = (exit_price - current_trade.entry_price) / current_trade.entry_price
                        current_trade.holding_days = days_held
                        self.trades.append(current_trade)
                        in_trade = False
                        current_trade = None
                
                else:
                    if self.check_entry(setup_name, row):
                        self.trade_counter += 1
                        atr = row.get('atr_14') or (row['high'] - row['low'])
                        
                        current_trade = Trade(
                            trade_id=self.trade_counter,
                            asset_symbol=symbol,
                            setup_name=setup_name,
                            entry_date=str(row['date']),
                            entry_price=row['close'],
                            entry_atr=atr,
                            high_water_mark=row['high'],
                        )
                        entry_idx = i
                        in_trade = True
        
        # Calculate metrics
        metrics = self._calc_metrics()
        
        print(f"\nResults:")
        print(f"  Trades: {metrics['total_trades']}")
        print(f"  Win Rate: {metrics['win_rate']*100:.1f}%")
        print(f"  Profit Factor: {metrics['profit_factor']:.2f}")
        print(f"  Avg Return: {metrics['avg_return_pct']*100:+.2f}%")
        print(f"  Avg Hold: {metrics['avg_holding_days']:.0f} days")
        print(f"  Exit Reasons: {metrics['exit_reasons']}")
        
        return {
            "setup_name": setup_name,
            "description": setup["description"],
            "category": setup["category"],
            "metrics": metrics,
            "trades": [asdict(t) for t in self.trades],
        }
    
    def _calc_metrics(self) -> Dict:
        if not self.trades:
            return {"total_trades": 0, "win_rate": 0, "profit_factor": 0, 
                    "avg_return_pct": 0, "avg_holding_days": 0, "exit_reasons": {}}
        
        returns = [t.return_pct for t in self.trades if t.return_pct is not None]
        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r <= 0]
        
        total_wins = sum(wins) if wins else 0
        total_losses = abs(sum(losses)) if losses else 0.0001
        
        exit_reasons = {}
        for t in self.trades:
            reason = t.exit_reason or "unknown"
            exit_reasons[reason] = exit_reasons.get(reason, 0) + 1
        
        holding_days = [t.holding_days for t in self.trades if t.holding_days]
        
        return {
            "total_trades": len(self.trades),
            "win_rate": len(wins) / len(returns) if returns else 0,
            "profit_factor": total_wins / total_losses,
            "avg_return_pct": sum(returns) / len(returns) if returns else 0,
            "avg_holding_days": sum(holding_days) / len(holding_days) if holding_days else 0,
            "exit_reasons": exit_reasons,
        }
    
    def run_all_setups(self, start_date: str = "2020-01-01", end_date: str = "2025-12-31") -> Dict:
        """Run backtests for all long-term setups."""
        
        results = {}
        
        for setup_name in LONGTERM_SETUPS.keys():
            try:
                result = self.run_backtest(setup_name, start_date, end_date)
                results[setup_name] = result["metrics"]
                results[setup_name]["category"] = LONGTERM_SETUPS[setup_name]["category"]
            except Exception as e:
                print(f"❌ Error with {setup_name}: {e}")
            
            # Reconnect to avoid timeout
            self.disconnect()
            self.connect()
        
        # Print summary
        print("\n" + "="*110)
        print("LONG-TERM BACKTEST SUMMARY (3-12 Month Timeframe)")
        print("="*110)
        print(f"{'Setup':<35} {'Category':<20} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10}")
        print("-"*110)
        
        sorted_results = sorted(results.items(), key=lambda x: x[1].get('profit_factor', 0), reverse=True)
        
        for setup_name, metrics in sorted_results:
            cat = metrics.get('category', 'unknown')
            wr = f"{metrics['win_rate']*100:.1f}%"
            pf = f"{metrics['profit_factor']:.2f}"
            avg_ret = f"{metrics['avg_return_pct']*100:+.2f}%"
            avg_hold = f"{metrics['avg_holding_days']:.0f}d"
            print(f"{setup_name:<35} {cat:<20} {metrics['total_trades']:>8} {wr:>10} {pf:>8} {avg_ret:>10} {avg_hold:>10}")
        
        print("="*110)
        
        # Save results
        output_path = "./data/longterm_backtest_results.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "timeframe": "3-12 months",
                "results": results,
            }, f, indent=2)
        print(f"\n✓ Results saved to: {output_path}")
        
        return results


if __name__ == "__main__":
    bt = LongTermBacktester()
    bt.connect()
    bt.run_all_setups()
    bt.disconnect()

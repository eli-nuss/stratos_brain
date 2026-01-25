"""
Quality Backtester: Setup-Specific Exit Strategies for Medium-Term Position Trading

Focus: Fewer, higher-quality trades with appropriate exit logic for each setup type.
NOT optimizing for maximum trades - optimizing for reliability and appropriate exits.
"""

import json
import os
import sys
from dataclasses import dataclass, field, asdict
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
# SETUP-SPECIFIC EXIT STRATEGIES
# =============================================================================

# Each setup type has its own exit logic that matches the entry thesis

EXIT_STRATEGIES = {
    # =========================================================================
    # TREND PULLBACK SETUPS
    # Entry: Buy pullback to MA in uptrend
    # Exit Logic: Use WIDER stops for medium-term holds (1-6 months)
    # =========================================================================
    "trend_pullback_50ma": {
        "description": "Pullback to 50 MA - exit if closes below 200 MA (wider stop)",
        "stop_type": "ma_close",           # Exit on CLOSE below MA (not intraday)
        "stop_ma_period": 200,             # Use 200 MA as stop (not 50) for room to breathe
        "stop_ma_buffer": 0.05,            # 5% buffer below 200 MA
        "use_trailing": True,
        "trail_atr_mult": 3.0,             # Wider trail for medium-term
        "trail_activation_pct": 0.30,      # Activate after 30% gain
        "profit_target_pct": 0.50,         # 50% target
        "max_hold_days": 252,              # Up to 1 year
    },
    
    "trend_pullback_200ma": {
        "description": "Pullback to 200 MA - exit on ATR stop (give room)",
        "stop_type": "atr",                # ATR stop instead of MA stop
        "stop_atr_mult": 3.0,              # Wide 3x ATR stop
        "use_trailing": True,
        "trail_atr_mult": 3.5,
        "trail_activation_pct": 0.35,
        "profit_target_pct": 0.50,
        "max_hold_days": 252,
    },
    
    "holy_grail_20ema": {
        "description": "Pullback to 20 EMA - exit if closes below 50 MA",
        "stop_type": "ma_close",
        "stop_ma_period": 50,              # Use 50 MA as stop (not 20) for room
        "stop_ma_buffer": 0.03,
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.25,
        "profit_target_pct": 0.40,
        "max_hold_days": 180,              # ~6 months
    },
    
    # =========================================================================
    # MEAN REVERSION SETUPS
    # Entry: Buy oversold condition
    # Exit Logic: Give more time to work, use trailing once profitable
    # =========================================================================
    "oversold_quality": {
        "description": "Oversold bounce - trail after touching 20 MA",
        "stop_type": "atr",                # ATR-based stop for oversold
        "stop_atr_mult": 2.5,              # Wider stop
        "use_trailing": True,              # Trail after initial bounce
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.15,      # Activate trail after 15% gain
        "profit_target_pct": 0.40,         # 40% target (not just touch MA)
        "time_stop_days": 45,              # Give it 45 days
        "max_hold_days": 90,               # ~3 months
    },
    
    "deep_oversold_bounce": {
        "description": "Deep oversold - ride the recovery",
        "stop_type": "atr",
        "stop_atr_mult": 3.0,              # Wide stop for deep pullback
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.20,
        "profit_target_pct": 0.50,
        "time_stop_days": 60,              # 60 days to work
        "max_hold_days": 120,              # ~4 months
    },
    
    "drawdown_recovery": {
        "description": "Drawdown recovery - patient recovery play",
        "stop_type": "atr",
        "stop_atr_mult": 2.5,
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.20,
        "profit_target_pct": 0.40,
        "time_stop_days": 60,
        "max_hold_days": 120,
    },
    
    # =========================================================================
    # BREAKOUT/MOMENTUM SETUPS
    # Entry: Buy breakout/momentum
    # Exit Logic: Use 50 MA breakdown (not 20), remove "no new high" for longer holds
    # =========================================================================
    "gap_up_hold": {
        "description": "Gap up - ride with trailing, exit on 50 MA breakdown",
        "stop_type": "atr",                # ATR stop instead of breakout low
        "stop_atr_mult": 2.5,
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.20,
        "breakdown_ma_period": 50,         # Exit if breaks 50 MA (not 20)
        "profit_target_pct": 0.50,
        "max_hold_days": 126,              # ~6 months
    },
    
    "breakout_consolidation": {
        "description": "Breakout from consolidation - ride the trend",
        "stop_type": "atr",
        "stop_atr_mult": 2.5,
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.20,
        "breakdown_ma_period": 50,         # 50 MA breakdown
        "profit_target_pct": 0.50,
        "max_hold_days": 126,
    },
    
    "squeeze_release": {
        "description": "Squeeze release - ride the expansion",
        "stop_type": "atr",
        "stop_atr_mult": 2.5,
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.20,
        "breakdown_ma_period": 50,
        "profit_target_pct": 0.50,
        "max_hold_days": 126,
    },
    
    "volatility_contraction_breakout": {
        "description": "VCP breakout - ride the move with trailing",
        "stop_type": "atr",
        "stop_atr_mult": 2.0,
        "use_trailing": True,
        "trail_atr_mult": 2.0,
        "trail_activation_pct": 0.15,
        "breakdown_ma_period": 50,
        "profit_target_pct": 0.50,
        "max_hold_days": 126,
    },
    
    # =========================================================================
    # ACCELERATION/MOMENTUM SETUPS
    # Entry: Buy momentum turn
    # Exit Logic: Use 200 MA breakdown for longer holds
    # =========================================================================
    "acceleration_turn_up": {
        "description": "Acceleration turn - ride until trend breaks",
        "stop_type": "ma_close",
        "stop_ma_period": 50,              # Use 50 MA stop (not 20)
        "stop_ma_buffer": 0.03,
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.25,
        "breakdown_ma_period": 200,        # Exit if breaks 200 MA
        "profit_target_pct": 0.50,
        "max_hold_days": 180,
    },
    
    "macd_bullish_cross": {
        "description": "MACD cross - ride the trend",
        "stop_type": "ma_close",
        "stop_ma_period": 50,
        "stop_ma_buffer": 0.03,
        "use_trailing": True,
        "trail_atr_mult": 2.5,
        "trail_activation_pct": 0.25,
        "breakdown_ma_period": 200,
        "profit_target_pct": 0.50,
        "max_hold_days": 180,
    },
    
    "relative_strength_breakout": {
        "description": "RS breakout - ride relative strength",
        "stop_type": "atr",
        "stop_atr_mult": 3.0,
        "use_trailing": True,
        "trail_atr_mult": 3.0,
        "trail_activation_pct": 0.30,
        "breakdown_ma_period": 200,
        "profit_target_pct": 0.50,
        "max_hold_days": 180,
    },
}


# =============================================================================
# ENTRY CONDITIONS
# =============================================================================

POSITION_SETUPS = {
    "trend_pullback_50ma": {
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Near 50 SMA", "field": "ma_dist_50", "operator": "<=", "threshold_value": 0.03},
            {"name": "RSI Not Overbought", "field": "rsi_14", "operator": "<", "threshold_value": 50},
        ],
    },
    "oversold_quality": {
        "conditions": [
            {"name": "Extended Below MA", "field": "ma_dist_20", "operator": "<", "threshold_value": -0.10},
            {"name": "RSI Oversold", "field": "rsi_14", "operator": "<", "threshold_value": 35},
        ],
    },
    "gap_up_hold": {
        "conditions": [
            {"name": "Gap Up", "field": "gap_pct", "operator": ">", "threshold_value": 0.03},
            {"name": "Gap Held", "field": "gap_up", "operator": "==", "threshold_value": True},
            {"name": "Volume Surge", "field": "rvol_20", "operator": ">", "threshold_value": 2.0},
        ],
    },
    "holy_grail_20ema": {
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Near 20 SMA", "field": "ma_dist_20", "operator": ">=", "threshold_value": -0.02},
            {"name": "Near 20 SMA", "field": "ma_dist_20", "operator": "<=", "threshold_value": 0.02},
            {"name": "20 MA Slope Positive", "field": "ma_slope_20", "operator": ">", "threshold_value": 0},
            {"name": "RSI Mid-Range", "field": "rsi_14", "operator": "<", "threshold_value": 60},
        ],
    },
    "acceleration_turn_up": {
        "conditions": [
            {"name": "Acceleration Turn Up", "field": "accel_turn_up", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive ROC", "field": "roc_20", "operator": ">", "threshold_value": 0},
        ],
    },
    "breakout_consolidation": {
        "conditions": [
            {"name": "Breakout Up", "field": "breakout_up_20", "operator": "==", "threshold_value": True},
            {"name": "Was Tight", "field": "bb_width_pctile", "operator": "<", "threshold_value": 40},
            {"name": "Volume Surge", "field": "rvol_20", "operator": ">", "threshold_value": 1.5},
        ],
    },
    "squeeze_release": {
        "conditions": [
            {"name": "Squeeze Release", "field": "squeeze_release", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive Momentum", "field": "roc_5", "operator": ">", "threshold_value": 0},
        ],
    },
    "macd_bullish_cross": {
        "conditions": [
            {"name": "MACD Histogram Positive", "field": "macd_histogram", "operator": ">", "threshold_value": 0},
            {"name": "MACD Hist Slope Up", "field": "macd_hist_slope", "operator": ">", "threshold_value": 0},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "RSI Not Overbought", "field": "rsi_14", "operator": "<", "threshold_value": 70},
        ],
    },
    "volatility_contraction_breakout": {
        "conditions": [
            {"name": "BB Width Expanding", "field": "bb_width_pctile_expanding", "operator": "==", "threshold_value": True},
            {"name": "Was Tight", "field": "bb_width_pctile_prev", "operator": "<", "threshold_value": 30},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive ROC", "field": "roc_5", "operator": ">", "threshold_value": 0},
        ],
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
    entry_low: float
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    return_pct: Optional[float] = None
    holding_days: Optional[int] = None
    high_water_mark: float = 0.0
    days_since_new_high: int = 0


class QualityBacktester:
    """Backtester focused on quality trades with setup-specific exits."""
    
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
                f.ma_slope_20, f.bb_width_pctile, f.bb_width_pctile_expanding,
                f.bb_width_pctile_prev, f.rvol_20, f.breakout_up_20,
                f.gap_pct, f.gap_up, f.above_ma200, f.squeeze_release,
                f.roc_5, f.roc_20, f.atr_14, f.accel_turn_up,
                f.macd_histogram, f.macd_hist_slope, f.donchian_high_20
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
        setup = POSITION_SETUPS.get(setup_name)
        if not setup:
            return False
        
        for cond in setup["conditions"]:
            actual = row.get(cond["field"])
            threshold = cond["threshold_value"]
            op = cond["operator"]
            
            if actual is None:
                return False
            
            if op == "==" and actual != threshold:
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
        """Check exit conditions based on setup-specific strategy."""
        close = row['close']
        high = row['high']
        low = row['low']
        atr = row.get('atr_14') or trade.entry_atr
        
        # Update high water mark
        if high > trade.high_water_mark:
            trade.high_water_mark = high
            trade.days_since_new_high = 0
        else:
            trade.days_since_new_high += 1
        
        gain_pct = (close - trade.entry_price) / trade.entry_price
        
        # 1. STOP LOSS
        stop_type = exit_config.get("stop_type", "atr")
        
        if stop_type == "atr":
            stop_price = trade.entry_price - (atr * exit_config.get("stop_atr_mult", 2.0))
            if low <= stop_price:
                return (stop_price, "stop_loss_atr")
        
        elif stop_type == "ma_close":
            ma_period = exit_config.get("stop_ma_period", 50)
            ma_value = row.get(f'sma_{ma_period}')
            if ma_value:
                buffer = exit_config.get("stop_ma_buffer", 0.03)
                stop_level = ma_value * (1 - buffer)
                if close < stop_level:  # Close below MA (not intraday)
                    return (close, f"stop_below_{ma_period}ma")
        
        elif stop_type == "breakout_low":
            if low < trade.entry_low * 0.99:
                return (trade.entry_low * 0.99, "stop_breakout_low")
        
        # 2. TRAILING STOP (if activated)
        if exit_config.get("use_trailing", False):
            activation = exit_config.get("trail_activation_pct", 0.15)
            if gain_pct >= activation:
                trail_mult = exit_config.get("trail_atr_mult", 2.5)
                trail_stop = trade.high_water_mark - (atr * trail_mult)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
        
        # 3. PROFIT TARGET
        profit_type = exit_config.get("profit_exit_type", "percent")
        
        if profit_type == "touch_ma":
            ma_period = exit_config.get("profit_ma_period", 20)
            ma_value = row.get(f'sma_{ma_period}')
            if ma_value and high >= ma_value:
                return (ma_value, f"target_{ma_period}ma")
        
        elif profit_type == "percent" or "profit_target_pct" in exit_config:
            target_pct = exit_config.get("profit_target_pct", 0.50)
            if gain_pct >= target_pct:
                return (trade.entry_price * (1 + target_pct), "profit_target")
        
        # 4. TIME STOP (for mean reversion)
        time_stop = exit_config.get("time_stop_days")
        if time_stop and days_held >= time_stop:
            return (close, "time_stop")
        
        # 5. NO NEW HIGH (for breakouts)
        new_high_days = exit_config.get("new_high_days")
        if new_high_days and trade.days_since_new_high >= new_high_days:
            return (close, "no_new_high")
        
        # 6. TECHNICAL BREAKDOWN
        breakdown_ma = exit_config.get("breakdown_ma_period")
        if breakdown_ma:
            ma_value = row.get(f'sma_{breakdown_ma}')
            if ma_value and close < ma_value:
                return (close, f"breakdown_{breakdown_ma}ma")
        
        # 7. MAX HOLD
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
        """Run backtest for a single setup with its specific exit strategy."""
        
        if setup_name not in EXIT_STRATEGIES:
            raise ValueError(f"No exit strategy defined for {setup_name}")
        
        exit_config = EXIT_STRATEGIES[setup_name]
        self.trades = []
        self.trade_counter = 0
        
        print(f"\n{'='*60}")
        print(f"BACKTEST: {setup_name}")
        print(f"Exit Strategy: {exit_config['description']}")
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
                            entry_low=row['low'],
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
            "exit_strategy": exit_config,
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
        """Run backtests for all setups and compare."""
        
        results = {}
        
        for setup_name in POSITION_SETUPS.keys():
            if setup_name in EXIT_STRATEGIES:
                try:
                    result = self.run_backtest(setup_name, start_date, end_date)
                    results[setup_name] = result["metrics"]
                except Exception as e:
                    print(f"❌ Error with {setup_name}: {e}")
                
                # Reconnect to avoid timeout
                self.disconnect()
                self.connect()
        
        # Print summary
        print("\n" + "="*100)
        print("QUALITY BACKTEST SUMMARY - Setup-Specific Exit Strategies")
        print("="*100)
        print(f"{'Setup':<35} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10}")
        print("-"*100)
        
        sorted_results = sorted(results.items(), key=lambda x: x[1].get('profit_factor', 0), reverse=True)
        
        for setup_name, metrics in sorted_results:
            wr = f"{metrics['win_rate']*100:.1f}%"
            pf = f"{metrics['profit_factor']:.2f}"
            avg_ret = f"{metrics['avg_return_pct']*100:+.2f}%"
            avg_hold = f"{metrics['avg_holding_days']:.0f}d"
            print(f"{setup_name:<35} {metrics['total_trades']:>8} {wr:>10} {pf:>8} {avg_ret:>10} {avg_hold:>10}")
        
        print("="*100)
        
        # Save results
        output_path = "./data/quality_backtest_results.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "results": results,
            }, f, indent=2)
        print(f"\n✓ Results saved to: {output_path}")
        
        return results


if __name__ == "__main__":
    bt = QualityBacktester()
    bt.connect()
    bt.run_all_setups()
    bt.disconnect()

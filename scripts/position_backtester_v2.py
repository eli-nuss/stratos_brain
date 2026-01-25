"""
Position Backtester V2: Setup-Specific Exit Strategies

Each setup has its own exit logic and parameters that can be optimized independently.
No more one-size-fits-all trailing stops.
"""

import json
import os
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor


# =============================================================================
# EXIT STRATEGY TYPES
# =============================================================================

class ExitType(Enum):
    """Types of exit strategies."""
    # Trend-following exits
    CLOSE_BELOW_MA = "close_below_ma"  # Exit when price closes below a moving average
    TRAILING_ATR = "trailing_atr"      # ATR-based trailing stop
    
    # Mean reversion exits
    TOUCH_MA = "touch_ma"              # Exit when price touches a moving average
    PERCENT_GAIN = "percent_gain"      # Exit at fixed percentage gain
    TIME_STOP = "time_stop"            # Exit after N days regardless
    
    # Breakout exits
    BREAKOUT_LOW = "breakout_low"      # Exit if price breaks below entry candle low
    NEW_HIGH_FAILURE = "new_high_fail" # Exit if no new high within N days
    CLOSE_BELOW_EMA = "close_below_ema" # Exit when price closes below EMA


@dataclass
class ExitConfig:
    """Configuration for a setup's exit strategy."""
    
    # Primary exit (profit taking)
    profit_exit_type: str = "trailing_atr"
    profit_target_pct: Optional[float] = 0.50        # Fixed % target (if used)
    profit_ma_period: Optional[int] = 20             # MA period for touch_ma exit
    
    # Stop loss
    stop_type: str = "atr"                           # "atr", "percent", "ma", "breakout_low"
    stop_atr_mult: float = 2.0                       # ATR multiplier for stop
    stop_pct: float = 0.15                           # Fixed % stop (if used)
    stop_ma_period: Optional[int] = 50               # MA period for ma-based stop
    stop_ma_buffer: float = 0.02                     # Buffer below MA (e.g., 2%)
    
    # Trailing stop (if used)
    use_trailing: bool = True
    trail_atr_mult: float = 2.5                      # ATR multiplier for trail
    trail_activation_pct: float = 0.10               # Activate trail after X% gain
    
    # Time-based exits
    time_stop_days: Optional[int] = None             # Exit after N days (None = no time stop)
    new_high_days: Optional[int] = None              # Exit if no new high in N days
    
    # Technical breakdown
    breakdown_ma_period: Optional[int] = None        # Exit if close below this MA (None = disabled)
    breakdown_ma_buffer: float = 0.0                 # Buffer below MA
    
    # Max hold
    max_hold_days: int = 252


# =============================================================================
# SETUP-SPECIFIC EXIT CONFIGURATIONS
# =============================================================================

# Default exit configs for each setup category
SETUP_EXIT_CONFIGS = {
    # =========================================================================
    # TREND PULLBACK SETUPS - Ride the trend, exit on trend break
    # =========================================================================
    "trend_pullback_50ma": ExitConfig(
        profit_exit_type="none",                # No fixed target - ride the trend
        stop_type="ma",                         # Stop below the MA we bought at
        stop_ma_period=50,
        stop_ma_buffer=0.03,                    # 3% below 50 SMA
        use_trailing=True,
        trail_atr_mult=2.5,
        trail_activation_pct=0.15,
        breakdown_ma_period=None,               # Don't use 200 SMA breakdown
        max_hold_days=252,
    ),
    
    "trend_pullback_200ma": ExitConfig(
        profit_exit_type="none",
        stop_type="ma",
        stop_ma_period=200,
        stop_ma_buffer=0.03,
        use_trailing=True,
        trail_atr_mult=3.0,
        trail_activation_pct=0.20,
        breakdown_ma_period=None,
        max_hold_days=252,
    ),
    
    "holy_grail_20ema": ExitConfig(
        profit_exit_type="none",
        stop_type="ma",
        stop_ma_period=20,
        stop_ma_buffer=0.02,
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        breakdown_ma_period=50,                 # Exit if breaks 50 SMA
        max_hold_days=126,
    ),
    
    # =========================================================================
    # MEAN REVERSION SETUPS - Quick bounce, exit at mean
    # =========================================================================
    "oversold_quality": ExitConfig(
        profit_exit_type="touch_ma",            # Exit when price touches the MA
        profit_ma_period=20,                    # Touch 20 SMA = mean reclaimed
        stop_type="atr",
        stop_atr_mult=1.5,                      # Tight stop for mean reversion
        use_trailing=False,                     # No trailing - quick in/out
        time_stop_days=5,                       # Exit after 5 days if no bounce
        breakdown_ma_period=None,
        max_hold_days=10,
    ),
    
    "deep_value_pullback": ExitConfig(
        profit_exit_type="touch_ma",
        profit_ma_period=50,                    # Deeper pullback, target 50 SMA
        stop_type="atr",
        stop_atr_mult=2.0,
        use_trailing=False,
        time_stop_days=10,
        breakdown_ma_period=None,
        max_hold_days=20,
    ),
    
    "deep_oversold_bounce": ExitConfig(
        profit_exit_type="touch_ma",
        profit_ma_period=20,
        stop_type="atr",
        stop_atr_mult=1.5,
        use_trailing=False,
        time_stop_days=5,
        breakdown_ma_period=None,
        max_hold_days=10,
    ),
    
    "drawdown_recovery": ExitConfig(
        profit_exit_type="percent_gain",
        profit_target_pct=0.15,                 # 15% bounce target
        stop_type="atr",
        stop_atr_mult=2.0,
        use_trailing=False,
        time_stop_days=10,
        breakdown_ma_period=None,
        max_hold_days=20,
    ),
    
    # =========================================================================
    # BREAKOUT/MOMENTUM SETUPS - Fast failure, ride momentum
    # =========================================================================
    "breakout_consolidation": ExitConfig(
        profit_exit_type="none",                # Ride the breakout
        stop_type="breakout_low",               # Stop at low of breakout candle
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        new_high_days=10,                       # Exit if no new 10-day high in 10 days
        breakdown_ma_period=20,                 # Fast trend = 20 EMA
        max_hold_days=63,
    ),
    
    "squeeze_release": ExitConfig(
        profit_exit_type="none",
        stop_type="breakout_low",
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        new_high_days=10,
        breakdown_ma_period=20,
        max_hold_days=63,
    ),
    
    "gap_up_hold": ExitConfig(
        profit_exit_type="none",
        stop_type="breakout_low",               # Stop at gap low
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        new_high_days=5,                        # Gaps should follow through quickly
        breakdown_ma_period=20,
        max_hold_days=42,
    ),
    
    "volatility_contraction_breakout": ExitConfig(
        profit_exit_type="none",
        stop_type="breakout_low",
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        new_high_days=10,
        breakdown_ma_period=20,
        max_hold_days=63,
    ),
    
    "confirmed_breakout": ExitConfig(
        profit_exit_type="none",
        stop_type="breakout_low",
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        new_high_days=10,
        breakdown_ma_period=20,
        max_hold_days=63,
    ),
    
    "52w_high_breakout": ExitConfig(
        profit_exit_type="none",
        stop_type="atr",
        stop_atr_mult=2.0,
        use_trailing=True,
        trail_atr_mult=2.5,
        trail_activation_pct=0.10,
        new_high_days=10,
        breakdown_ma_period=50,
        max_hold_days=126,
    ),
    
    # =========================================================================
    # ACCELERATION/MOMENTUM SETUPS
    # =========================================================================
    "acceleration_turn_up": ExitConfig(
        profit_exit_type="none",
        stop_type="ma",
        stop_ma_period=20,
        stop_ma_buffer=0.02,
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        breakdown_ma_period=50,
        max_hold_days=126,
    ),
    
    "relative_strength_breakout": ExitConfig(
        profit_exit_type="none",
        stop_type="atr",
        stop_atr_mult=2.0,
        use_trailing=True,
        trail_atr_mult=2.5,
        trail_activation_pct=0.15,
        breakdown_ma_period=50,
        max_hold_days=126,
    ),
    
    "macd_bullish_cross": ExitConfig(
        profit_exit_type="none",
        stop_type="ma",
        stop_ma_period=20,
        stop_ma_buffer=0.02,
        use_trailing=True,
        trail_atr_mult=2.0,
        trail_activation_pct=0.10,
        breakdown_ma_period=50,
        max_hold_days=126,
    ),
}


# =============================================================================
# ENTRY CONDITIONS (same as V1)
# =============================================================================

POSITION_SETUPS = {
    "trend_pullback_50ma": {
        "description": "Pullback to 50 MA in established uptrend",
        "category": "trend_continuation",
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Near 50 SMA", "field": "ma_dist_50", "operator": "<=", "threshold_value": 0.03},
            {"name": "RSI Not Overbought", "field": "rsi_14", "operator": "<", "threshold_value": 50},
        ],
    },
    "oversold_quality": {
        "description": "Mean reversion on oversold quality stocks",
        "category": "mean_reversion",
        "conditions": [
            {"name": "Extended Below MA", "field": "ma_dist_20", "operator": "<", "threshold_value": -0.10},
            {"name": "RSI Oversold", "field": "rsi_14", "operator": "<", "threshold_value": 35},
        ],
    },
    "gap_up_hold": {
        "description": "Gap up that holds - institutional buying",
        "category": "momentum",
        "conditions": [
            {"name": "Gap Up", "field": "gap_pct", "operator": ">", "threshold_value": 0.03},
            {"name": "Gap Held", "field": "gap_up", "operator": "==", "threshold_value": True},
            {"name": "Volume Surge", "field": "rvol_20", "operator": ">", "threshold_value": 2.0},
        ],
    },
    "holy_grail_20ema": {
        "description": "Pullback to rising 20 EMA in strong uptrend",
        "category": "trend_continuation",
        "conditions": [
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Near 20 SMA", "field": "ma_dist_20", "operator": ">=", "threshold_value": -0.02},
            {"name": "Near 20 SMA", "field": "ma_dist_20", "operator": "<=", "threshold_value": 0.02},
            {"name": "20 MA Slope Positive", "field": "ma_slope_20", "operator": ">", "threshold_value": 0},
            {"name": "RSI Mid-Range", "field": "rsi_14", "operator": "<", "threshold_value": 60},
        ],
    },
    "acceleration_turn_up": {
        "description": "Momentum acceleration turning positive",
        "category": "momentum",
        "conditions": [
            {"name": "Acceleration Turn Up", "field": "accel_turn_up", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive ROC", "field": "roc_20", "operator": ">", "threshold_value": 0},
        ],
    },
    "breakout_consolidation": {
        "description": "Breakout from consolidation range",
        "category": "breakout",
        "conditions": [
            {"name": "Breakout Up", "field": "breakout_up_20", "operator": "==", "threshold_value": True},
            {"name": "Was Tight", "field": "bb_width_pctile", "operator": "<", "threshold_value": 40},
            {"name": "Volume Surge", "field": "rvol_20", "operator": ">", "threshold_value": 1.5},
        ],
    },
    "squeeze_release": {
        "description": "Volatility squeeze release to upside",
        "category": "breakout",
        "conditions": [
            {"name": "Squeeze Release", "field": "squeeze_release", "operator": "==", "threshold_value": True},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive Momentum", "field": "roc_5", "operator": ">", "threshold_value": 0},
        ],
    },
    "macd_bullish_cross": {
        "description": "MACD histogram turning positive in uptrend",
        "category": "momentum",
        "conditions": [
            {"name": "MACD Histogram Positive", "field": "macd_histogram", "operator": ">", "threshold_value": 0},
            {"name": "MACD Hist Slope Up", "field": "macd_hist_slope", "operator": ">", "threshold_value": 0},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "RSI Not Overbought", "field": "rsi_14", "operator": "<", "threshold_value": 70},
        ],
    },
    "volatility_contraction_breakout": {
        "description": "Low volatility followed by expansion",
        "category": "breakout",
        "conditions": [
            {"name": "BB Width Expanding", "field": "bb_width_pctile_expanding", "operator": "==", "threshold_value": True},
            {"name": "Was Tight", "field": "bb_width_pctile_prev", "operator": "<", "threshold_value": 30},
            {"name": "Above 200 SMA", "field": "above_ma200", "operator": "==", "threshold_value": True},
            {"name": "Positive ROC", "field": "roc_5", "operator": ">", "threshold_value": 0},
        ],
    },
}


# =============================================================================
# DATABASE CONNECTION
# =============================================================================

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(
        host='db.wfogbaipiqootjrsprde.supabase.co',
        port=5432,
        database='postgres',
        user='postgres',
        password='stratosbrainpostgresdbpw'
    )


# =============================================================================
# V2 BACKTESTER
# =============================================================================

@dataclass
class TradeV2:
    """A single trade with V2 exit logic."""
    trade_id: int
    asset_id: int
    asset_symbol: str
    setup_name: str
    entry_date: str
    entry_price: float
    entry_atr: float
    entry_low: float  # Low of entry candle (for breakout stops)
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    return_pct: Optional[float] = None
    holding_days: Optional[int] = None
    high_water_mark: float = 0.0
    days_since_new_high: int = 0


class PositionBacktesterV2:
    """
    V2 Backtester with setup-specific exit strategies.
    """
    
    def __init__(self):
        self.conn = None
        self.trade_counter = 0
        self.trades: List[TradeV2] = []
    
    def connect(self):
        self.conn = get_db_connection()
    
    def disconnect(self):
        if self.conn:
            self.conn.close()
    
    def load_asset_universe(self, universe: str) -> List[Tuple[int, str]]:
        """Load asset IDs and symbols."""
        cur = self.conn.cursor()
        
        if universe == "equity":
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
        
        return cur.fetchall()
    
    def load_asset_data(self, asset_id: int, start_date: str, end_date: str) -> pd.DataFrame:
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
                f.sma_20,
                f.sma_50,
                f.sma_200,
                f.ma_dist_20,
                f.ma_dist_50,
                f.ma_dist_200,
                f.ma_slope_20,
                f.ma_slope_50,
                f.bb_width_pctile,
                f.bb_width_pctile_expanding,
                f.bb_width_pctile_prev,
                f.rvol_20,
                f.breakout_up_20,
                f.gap_pct,
                f.gap_up,
                f.above_ma200,
                f.squeeze_release,
                f.roc_5,
                f.roc_20,
                f.atr_14,
                f.accel_turn_up,
                f.macd_histogram,
                f.macd_hist_slope,
                f.donchian_high_20
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
        
        # Convert to numeric
        numeric_cols = ['open', 'high', 'low', 'close', 'volume', 'rsi_14', 
                        'sma_20', 'sma_50', 'sma_200', 'ma_dist_20', 'ma_dist_50', 'ma_dist_200',
                        'ma_slope_20', 'ma_slope_50', 'bb_width_pctile', 'bb_width_pctile_prev',
                        'rvol_20', 'gap_pct', 'roc_5', 'roc_20', 'atr_14',
                        'macd_histogram', 'macd_hist_slope', 'donchian_high_20']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        return df
    
    def _check_entry_conditions(self, setup_name: str, row: Dict) -> bool:
        """Check if all entry conditions are met."""
        setup = POSITION_SETUPS.get(setup_name)
        if not setup:
            return False
        
        for cond in setup["conditions"]:
            field = cond["field"]
            op = cond["operator"]
            threshold = cond["threshold_value"]
            actual = row.get(field)
            
            if actual is None:
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
    
    def _check_exit(
        self, 
        trade: TradeV2, 
        row: Dict, 
        exit_config: ExitConfig,
        day_index: int,
    ) -> Optional[Tuple[float, str]]:
        """
        Check if trade should exit based on setup-specific exit config.
        Returns (exit_price, exit_reason) or None.
        """
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
        
        holding_days = day_index + 1
        gain_pct = (close - trade.entry_price) / trade.entry_price
        
        # 1. Check STOP LOSS first (most important)
        stop_price = None
        
        if exit_config.stop_type == "atr":
            stop_price = trade.entry_price - (atr * exit_config.stop_atr_mult)
        
        elif exit_config.stop_type == "percent":
            stop_price = trade.entry_price * (1 - exit_config.stop_pct)
        
        elif exit_config.stop_type == "ma":
            ma_value = row.get(f'sma_{exit_config.stop_ma_period}')
            if ma_value:
                stop_price = ma_value * (1 - exit_config.stop_ma_buffer)
        
        elif exit_config.stop_type == "breakout_low":
            stop_price = trade.entry_low * 0.99  # 1% below entry candle low
        
        if stop_price and low <= stop_price:
            return (stop_price, "stop_loss")
        
        # 2. Check TRAILING STOP (if activated)
        if exit_config.use_trailing and gain_pct >= exit_config.trail_activation_pct:
            trail_stop = trade.high_water_mark - (atr * exit_config.trail_atr_mult)
            if low <= trail_stop:
                return (trail_stop, "trailing_stop")
        
        # 3. Check PROFIT TARGET
        if exit_config.profit_exit_type == "percent_gain":
            if gain_pct >= exit_config.profit_target_pct:
                target_price = trade.entry_price * (1 + exit_config.profit_target_pct)
                return (target_price, "profit_target")
        
        elif exit_config.profit_exit_type == "touch_ma":
            ma_value = row.get(f'sma_{exit_config.profit_ma_period}')
            if ma_value and high >= ma_value:
                return (ma_value, "touch_ma_target")
        
        # 4. Check TIME STOP
        if exit_config.time_stop_days and holding_days >= exit_config.time_stop_days:
            return (close, "time_stop")
        
        # 5. Check NEW HIGH FAILURE (for breakouts)
        if exit_config.new_high_days and trade.days_since_new_high >= exit_config.new_high_days:
            return (close, "no_new_high")
        
        # 6. Check TECHNICAL BREAKDOWN
        if exit_config.breakdown_ma_period:
            ma_value = row.get(f'sma_{exit_config.breakdown_ma_period}')
            if ma_value:
                breakdown_level = ma_value * (1 - exit_config.breakdown_ma_buffer)
                if close < breakdown_level:
                    return (close, "technical_breakdown")
        
        # 7. Check MAX HOLD
        if holding_days >= exit_config.max_hold_days:
            return (close, "max_hold")
        
        return None
    
    def run_backtest(
        self,
        setup_name: str,
        exit_config: ExitConfig,
        universe: str = "equity",
        start_date: str = "2020-01-01",
        end_date: str = "2025-12-31",
    ) -> Dict:
        """Run backtest with setup-specific exit config."""
        
        self.trades = []
        self.trade_counter = 0
        
        assets = self.load_asset_universe(universe)
        
        total_signals = 0
        total_entries = 0
        
        for asset_id, symbol in assets:
            df = self.load_asset_data(asset_id, start_date, end_date)
            if df.empty:
                continue
            
            rows = df.to_dict('records')
            in_trade = False
            current_trade = None
            
            for i, row in enumerate(rows):
                total_signals += 1
                
                if in_trade:
                    # Check exit
                    exit_result = self._check_exit(current_trade, row, exit_config, 
                                                   i - current_trade.entry_idx)
                    if exit_result:
                        exit_price, exit_reason = exit_result
                        current_trade.exit_date = str(row['date'])
                        current_trade.exit_price = exit_price
                        current_trade.exit_reason = exit_reason
                        current_trade.return_pct = (exit_price - current_trade.entry_price) / current_trade.entry_price
                        current_trade.holding_days = i - current_trade.entry_idx
                        self.trades.append(current_trade)
                        in_trade = False
                        current_trade = None
                
                else:
                    # Check entry
                    if self._check_entry_conditions(setup_name, row):
                        self.trade_counter += 1
                        total_entries += 1
                        
                        atr = row.get('atr_14') or (row['high'] - row['low'])
                        
                        current_trade = TradeV2(
                            trade_id=self.trade_counter,
                            asset_id=asset_id,
                            asset_symbol=symbol,
                            setup_name=setup_name,
                            entry_date=str(row['date']),
                            entry_price=row['close'],
                            entry_atr=atr,
                            entry_low=row['low'],
                            high_water_mark=row['high'],
                        )
                        current_trade.entry_idx = i
                        in_trade = True
        
        # Calculate metrics
        metrics = self._calculate_metrics()
        
        return {
            "setup_name": setup_name,
            "exit_config": asdict(exit_config),
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "metrics": metrics,
            "trades": [asdict(t) for t in self.trades],
        }
    
    def _calculate_metrics(self) -> Dict:
        """Calculate performance metrics."""
        if not self.trades:
            return {
                "total_trades": 0,
                "win_rate": 0,
                "profit_factor": 0,
                "avg_return_pct": 0,
                "avg_holding_days": 0,
                "exit_reasons": {},
            }
        
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


# =============================================================================
# OPTIMIZATION
# =============================================================================

def optimize_exit_config(
    setup_name: str,
    param_grid: Dict[str, List],
    universe: str = "equity",
    start_date: str = "2020-01-01",
    end_date: str = "2025-12-31",
) -> Dict:
    """
    Optimize exit parameters for a single setup.
    """
    from itertools import product
    
    # Generate all combinations
    param_names = list(param_grid.keys())
    param_values = list(param_grid.values())
    combinations = list(product(*param_values))
    
    print(f"\n{'='*60}")
    print(f"OPTIMIZING: {setup_name}")
    print(f"Testing {len(combinations)} parameter combinations")
    print(f"{'='*60}")
    
    results = []
    best_result = None
    best_pf = 0
    
    backtester = PositionBacktesterV2()
    backtester.connect()
    
    try:
        for i, combo in enumerate(combinations):
            params = dict(zip(param_names, combo))
            
            # Create exit config with these params
            base_config = SETUP_EXIT_CONFIGS.get(setup_name, ExitConfig())
            exit_config = ExitConfig(**{**asdict(base_config), **params})
            
            result = backtester.run_backtest(
                setup_name=setup_name,
                exit_config=exit_config,
                universe=universe,
                start_date=start_date,
                end_date=end_date,
            )
            
            metrics = result["metrics"]
            pf = metrics["profit_factor"]
            
            result_entry = {
                "params": params,
                "total_trades": metrics["total_trades"],
                "win_rate": metrics["win_rate"],
                "profit_factor": pf,
                "avg_return_pct": metrics["avg_return_pct"],
                "avg_holding_days": metrics["avg_holding_days"],
                "exit_reasons": metrics["exit_reasons"],
            }
            results.append(result_entry)
            
            # Track best (require minimum trades)
            if pf > best_pf and metrics["total_trades"] >= 20:
                best_pf = pf
                best_result = result_entry
            
            print(f"  [{i+1}/{len(combinations)}] {params}")
            print(f"      Trades: {metrics['total_trades']}, WR: {metrics['win_rate']*100:.1f}%, PF: {pf:.2f}, Avg Hold: {metrics['avg_holding_days']:.0f}d")
            
            # Reconnect periodically
            if (i + 1) % 10 == 0:
                backtester.disconnect()
                backtester.connect()
    
    finally:
        backtester.disconnect()
    
    return {
        "setup_name": setup_name,
        "total_combinations": len(combinations),
        "results": results,
        "best_result": best_result,
    }


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    # Test with one setup
    backtester = PositionBacktesterV2()
    backtester.connect()
    
    setup = "oversold_quality"
    config = SETUP_EXIT_CONFIGS[setup]
    
    print(f"Testing {setup} with V2 exit logic...")
    result = backtester.run_backtest(setup, config)
    
    metrics = result["metrics"]
    print(f"\nResults:")
    print(f"  Trades: {metrics['total_trades']}")
    print(f"  Win Rate: {metrics['win_rate']*100:.1f}%")
    print(f"  Profit Factor: {metrics['profit_factor']:.2f}")
    print(f"  Avg Return: {metrics['avg_return_pct']*100:+.2f}%")
    print(f"  Avg Hold: {metrics['avg_holding_days']:.0f} days")
    print(f"  Exit Reasons: {metrics['exit_reasons']}")
    
    backtester.disconnect()

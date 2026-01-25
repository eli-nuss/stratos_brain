"""
MASTER BACKTESTER
=================
Comprehensive testing of ALL discovered setups with:
- Setup-specific exit strategies
- Market regime filtering
- Proper position sizing

This consolidates all our findings into one definitive test.
"""

import json
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
# ALL SETUPS - CONSOLIDATED FROM ALL TESTS
# =============================================================================

ALL_SETUPS = {
    # =========================================================================
    # SHORT-TERM SETUPS (1-4 weeks)
    # =========================================================================
    
    "oversold_quality": {
        "category": "short_term",
        "description": "RSI oversold + extended below 20 MA (mean reversion)",
        "conditions": [
            {"field": "rsi_14", "op": "<", "value": 35},
            {"field": "ma_dist_20", "op": "<", "value": -0.08},
        ],
        "exit_strategy": "mean_reversion",
        "exit_params": {
            "target_ma": "sma_20",  # Exit when touches 20 MA
            "time_stop_days": 15,
            "stop_atr_mult": 2.0,
        },
    },
    
    "deep_oversold_bounce": {
        "category": "short_term",
        "description": "Extreme oversold with reversal signal",
        "conditions": [
            {"field": "rsi_14", "op": "<", "value": 25},
            {"field": "ma_dist_20", "op": "<", "value": -0.12},
            {"field": "accel_turn_up", "op": "==", "value": True},
        ],
        "exit_strategy": "mean_reversion",
        "exit_params": {
            "target_ma": "sma_20",
            "time_stop_days": 10,
            "stop_atr_mult": 1.5,
        },
    },
    
    "gap_up_hold": {
        "category": "short_term",
        "description": "Gap up with volume that holds",
        "conditions": [
            {"field": "gap_pct", "op": ">", "value": 0.03},
            {"field": "rvol_20", "op": ">", "value": 2.0},
        ],
        "exit_strategy": "breakout",
        "exit_params": {
            "breakdown_ma": "sma_20",
            "time_stop_days": 20,
            "stop_atr_mult": 1.5,
        },
    },
    
    "volatility_contraction_breakout": {
        "category": "short_term",
        "description": "VCP - tight squeeze with breakout",
        "conditions": [
            {"field": "squeeze_pctile", "op": "<", "value": 25},
            {"field": "breakout_up_20", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.3},
        ],
        "exit_strategy": "breakout",
        "exit_params": {
            "breakdown_ma": "sma_20",
            "time_stop_days": 15,
            "stop_atr_mult": 1.5,
        },
    },
    
    # =========================================================================
    # MEDIUM-TERM SETUPS (1-3 months) - The ones that performed well earlier
    # =========================================================================
    
    "acceleration_turn_up": {
        "category": "medium_term",
        "description": "Momentum acceleration turning positive in uptrend",
        "conditions": [
            {"field": "accel_turn_up", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
        ],
        "exit_strategy": "trend_follow",
        "exit_params": {
            "breakdown_ma": "sma_50",
            "trailing_activation_pct": 0.15,
            "trailing_atr_mult": 3.0,
            "max_hold_days": 90,
        },
    },
    
    "holy_grail_20ema": {
        "category": "medium_term",
        "description": "Pullback to rising 20 EMA in strong trend (Linda Raschke)",
        "conditions": [
            {"field": "ma_dist_20", "op": "<=", "value": 0.02},
            {"field": "ma_dist_20", "op": ">=", "value": -0.02},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "roc_20", "op": ">", "value": 0.05},
        ],
        "exit_strategy": "trend_follow",
        "exit_params": {
            "breakdown_ma": "sma_20",
            "trailing_activation_pct": 0.10,
            "trailing_atr_mult": 2.5,
            "max_hold_days": 60,
        },
    },
    
    "macd_bullish_cross": {
        "category": "medium_term",
        "description": "MACD histogram turning positive with trend confirmation",
        "conditions": [
            {"field": "macd_hist_slope", "op": ">", "value": 0},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "rsi_14", "op": ">", "value": 40},
            {"field": "rsi_14", "op": "<", "value": 70},
        ],
        "exit_strategy": "trend_follow",
        "exit_params": {
            "breakdown_ma": "sma_50",
            "trailing_activation_pct": 0.15,
            "trailing_atr_mult": 3.0,
            "max_hold_days": 90,
        },
    },
    
    "relative_strength_breakout": {
        "category": "medium_term",
        "description": "RS line breaking out (outperforming market)",
        "conditions": [
            {"field": "rs_breakout", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.2},
        ],
        "exit_strategy": "trend_follow",
        "exit_params": {
            "breakdown_ma": "sma_50",
            "trailing_activation_pct": 0.15,
            "trailing_atr_mult": 3.0,
            "max_hold_days": 90,
        },
    },
    
    "trend_pullback_50ma": {
        "category": "medium_term",
        "description": "Pullback to 50 MA in established uptrend",
        "conditions": [
            {"field": "ma_dist_50", "op": "<=", "value": 0.03},
            {"field": "ma_dist_50", "op": ">=", "value": -0.03},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "rsi_14", "op": "<", "value": 50},
        ],
        "exit_strategy": "trend_follow",
        "exit_params": {
            "breakdown_ma": "sma_50",
            "trailing_activation_pct": 0.20,
            "trailing_atr_mult": 3.5,
            "max_hold_days": 120,
        },
    },
    
    # =========================================================================
    # LONG-TERM SETUPS (3-12 months)
    # =========================================================================
    
    "golden_cross_momentum": {
        "category": "long_term",
        "description": "50 MA crosses above 200 MA with strong momentum",
        "conditions": [
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "roc_20", "op": ">", "value": 0.08},
            {"field": "rvol_20", "op": ">", "value": 1.2},
        ],
        "exit_strategy": "long_term_trend",
        "exit_params": {
            "breakdown_ma": "sma_200",
            "trailing_activation_pct": 0.25,
            "trailing_atr_mult": 4.0,
            "profit_target_pct": 0.50,
            "max_hold_days": 252,
        },
    },
    
    "52w_low_reversal": {
        "category": "long_term",
        "description": "Near 52-week low with reversal signals",
        "conditions": [
            {"field": "dist_52w_low", "op": "<", "value": 0.15},
            {"field": "accel_turn_up", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.5},
        ],
        "exit_strategy": "recovery",
        "exit_params": {
            "trailing_activation_pct": 0.20,
            "trailing_atr_mult": 3.5,
            "profit_target_pct": 0.50,
            "stop_atr_mult": 3.0,
            "max_hold_days": 252,
        },
    },
    
    "rs_acceleration": {
        "category": "long_term",
        "description": "Relative strength accelerating (outperformance increasing)",
        "conditions": [
            {"field": "rs_roc_20", "op": ">", "value": 0.05},
            {"field": "rs_vs_benchmark", "op": ">", "value": 0.05},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
        ],
        "exit_strategy": "long_term_trend",
        "exit_params": {
            "breakdown_ma": "sma_200",
            "trailing_activation_pct": 0.25,
            "trailing_atr_mult": 4.0,
            "profit_target_pct": 0.50,
            "max_hold_days": 252,
        },
    },
    
    "stage2_entry": {
        "category": "long_term",
        "description": "Stage 2 entry - price crosses above 200 MA with momentum",
        "conditions": [
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma_dist_200", "op": "<", "value": 0.10},
            {"field": "roc_20", "op": ">", "value": 0.05},
            {"field": "rvol_20", "op": ">", "value": 1.2},
        ],
        "exit_strategy": "long_term_trend",
        "exit_params": {
            "breakdown_ma": "sma_200",
            "trailing_activation_pct": 0.20,
            "trailing_atr_mult": 3.5,
            "profit_target_pct": 0.50,
            "max_hold_days": 252,
        },
    },
    
    "drawdown_recovery": {
        "category": "long_term",
        "description": "Recovery from significant drawdown with trend confirmation",
        "conditions": [
            {"field": "drawdown_63d", "op": "<", "value": -0.20},
            {"field": "accel_turn_up", "op": "==", "value": True},
            {"field": "roc_5", "op": ">", "value": 0.03},
        ],
        "exit_strategy": "recovery",
        "exit_params": {
            "trailing_activation_pct": 0.15,
            "trailing_atr_mult": 3.0,
            "profit_target_pct": 0.40,
            "stop_atr_mult": 2.5,
            "max_hold_days": 180,
        },
    },
    
    "52w_high_breakout": {
        "category": "long_term",
        "description": "Breaking to new 52-week high with volume",
        "conditions": [
            {"field": "dist_52w_high", "op": ">", "value": -0.02},
            {"field": "breakout_up_20", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.5},
            {"field": "above_ma200", "op": "==", "value": True},
        ],
        "exit_strategy": "breakout",
        "exit_params": {
            "breakdown_ma": "sma_50",
            "trailing_activation_pct": 0.15,
            "trailing_atr_mult": 3.0,
            "max_hold_days": 120,
        },
    },
    
    "confirmed_breakout": {
        "category": "long_term",
        "description": "Confirmed breakout with follow-through",
        "conditions": [
            {"field": "breakout_confirmed_up", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.3},
        ],
        "exit_strategy": "breakout",
        "exit_params": {
            "breakdown_ma": "sma_50",
            "trailing_activation_pct": 0.15,
            "trailing_atr_mult": 3.0,
            "max_hold_days": 120,
        },
    },
}


# =============================================================================
# TRADE DATA STRUCTURE
# =============================================================================

@dataclass
class Trade:
    trade_id: int
    asset_symbol: str
    setup_name: str
    category: str
    entry_date: str
    entry_price: float
    entry_atr: float
    exit_date: Optional[str] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    return_pct: Optional[float] = None
    holding_days: Optional[int] = None
    high_water_mark: float = 0.0


# =============================================================================
# MARKET REGIME FILTER
# =============================================================================

class MarketRegimeFilter:
    """Uses market breadth (% stocks above 200 MA) as regime indicator."""
    
    def __init__(self, conn):
        self.conn = conn
        self.breadth_data = {}
        self._load_breadth_data()
    
    def _load_breadth_data(self):
        cur = self.conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT 
                f.date,
                ROUND(100.0 * SUM(CASE WHEN f.above_ma200 = true THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_above_200ma
            FROM daily_features f
            JOIN assets a ON a.asset_id = f.asset_id
            WHERE a.asset_type = 'equity'
            AND f.date >= '2019-01-01'
            GROUP BY f.date
            ORDER BY f.date
        """)
        rows = cur.fetchall()
        self.breadth_data = {str(r['date']): float(r['pct_above_200ma']) for r in rows}
        print(f"📊 Loaded {len(self.breadth_data)} days of market breadth data")
    
    def is_bull_market(self, date: str) -> bool:
        breadth = self.breadth_data.get(date)
        if breadth is None:
            return True
        return breadth >= 50.0


# =============================================================================
# MASTER BACKTESTER
# =============================================================================

class MasterBacktester:
    """Comprehensive backtester for all setups."""
    
    def __init__(self, use_regime_filter: bool = True):
        self.conn = None
        self.regime_filter = None
        self.use_regime_filter = use_regime_filter
        self.trades: List[Trade] = []
        self.trade_counter = 0
    
    def connect(self):
        self.conn = get_db_connection()
        print("✅ Connected to database")
        if self.use_regime_filter:
            self.regime_filter = MarketRegimeFilter(self.conn)
    
    def disconnect(self):
        if self.conn:
            self.conn.close()
    
    def load_assets(self) -> List[Tuple[int, str]]:
        """Load equity universe."""
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
                'SCHW', 'MO', 'SO', 'DUK', 'CME', 'CL', 'ICE', 'ITW', 'EOG', 'SLB'
            )
            AND f.date >= '2020-01-01'
            GROUP BY a.asset_id, a.symbol
            HAVING COUNT(*) >= 500
            ORDER BY a.symbol
        """)
        return cur.fetchall()
    
    def load_data(self, asset_id: int, start_date: str, end_date: str) -> pd.DataFrame:
        """Load all required data for an asset."""
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
                f.squeeze_pctile, f.bb_width_pctile,
                f.rvol_20, f.breakout_up_20, f.breakout_confirmed_up,
                f.accel_turn_up, f.gap_pct,
                f.macd_histogram, f.macd_hist_slope,
                f.drawdown_20d, f.drawdown_63d
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
    
    def check_conditions(self, conditions: List[Dict], row: Dict) -> bool:
        """Check if all entry conditions are met."""
        for cond in conditions:
            field = cond["field"]
            op = cond["op"]
            threshold = cond["value"]
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
    
    def check_exit(
        self,
        trade: Trade,
        row: Dict,
        days_held: int,
        exit_strategy: str,
        exit_params: Dict,
    ) -> Optional[Tuple[float, str]]:
        """Check exit conditions based on strategy type."""
        
        close = row['close']
        high = row['high']
        low = row['low']
        atr = row.get('atr_14') or trade.entry_atr
        
        # Update high water mark
        if high > trade.high_water_mark:
            trade.high_water_mark = high
        
        gain_pct = (close - trade.entry_price) / trade.entry_price
        
        # =====================================================================
        # MEAN REVERSION EXIT
        # =====================================================================
        if exit_strategy == "mean_reversion":
            # Stop loss
            stop_mult = exit_params.get("stop_atr_mult", 2.0)
            stop_price = trade.entry_price - (atr * stop_mult)
            if low <= stop_price:
                return (stop_price, "stop_loss")
            
            # Target: touch the target MA
            target_ma = exit_params.get("target_ma", "sma_20")
            ma_value = row.get(target_ma)
            if ma_value and high >= float(ma_value):
                return (float(ma_value), f"target_{target_ma}")
            
            # Time stop
            time_stop = exit_params.get("time_stop_days", 15)
            if days_held >= time_stop:
                return (close, "time_stop")
        
        # =====================================================================
        # BREAKOUT EXIT
        # =====================================================================
        elif exit_strategy == "breakout":
            # Stop loss (use entry candle low or ATR)
            stop_mult = exit_params.get("stop_atr_mult", 1.5)
            stop_price = trade.entry_price - (atr * stop_mult)
            if low <= stop_price:
                return (stop_price, "stop_loss")
            
            # Breakdown below MA
            breakdown_ma = exit_params.get("breakdown_ma", "sma_20")
            ma_value = row.get(breakdown_ma)
            if ma_value and close < float(ma_value) * 0.98:
                return (close, f"breakdown_{breakdown_ma}")
            
            # Trailing stop after activation
            trail_activation = exit_params.get("trailing_activation_pct", 0.15)
            trail_atr = exit_params.get("trailing_atr_mult", 3.0)
            if gain_pct >= trail_activation:
                trail_stop = trade.high_water_mark - (atr * trail_atr)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
            
            # Max hold
            max_hold = exit_params.get("max_hold_days", 90)
            if days_held >= max_hold:
                return (close, "max_hold")
        
        # =====================================================================
        # TREND FOLLOW EXIT
        # =====================================================================
        elif exit_strategy == "trend_follow":
            # Breakdown below key MA
            breakdown_ma = exit_params.get("breakdown_ma", "sma_50")
            ma_value = row.get(breakdown_ma)
            if ma_value and close < float(ma_value) * 0.97:
                return (close, f"breakdown_{breakdown_ma}")
            
            # Trailing stop after activation
            trail_activation = exit_params.get("trailing_activation_pct", 0.15)
            trail_atr = exit_params.get("trailing_atr_mult", 3.0)
            if gain_pct >= trail_activation:
                trail_stop = trade.high_water_mark - (atr * trail_atr)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
            
            # Profit target (optional)
            profit_target = exit_params.get("profit_target_pct")
            if profit_target and gain_pct >= profit_target:
                return (close, "profit_target")
            
            # Max hold
            max_hold = exit_params.get("max_hold_days", 90)
            if days_held >= max_hold:
                return (close, "max_hold")
        
        # =====================================================================
        # LONG-TERM TREND EXIT
        # =====================================================================
        elif exit_strategy == "long_term_trend":
            # Breakdown below 200 MA
            breakdown_ma = exit_params.get("breakdown_ma", "sma_200")
            ma_value = row.get(breakdown_ma)
            if ma_value and close < float(ma_value) * 0.95:
                return (close, f"breakdown_{breakdown_ma}")
            
            # Trailing stop after activation
            trail_activation = exit_params.get("trailing_activation_pct", 0.25)
            trail_atr = exit_params.get("trailing_atr_mult", 4.0)
            if gain_pct >= trail_activation:
                trail_stop = trade.high_water_mark - (atr * trail_atr)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
            
            # Profit target
            profit_target = exit_params.get("profit_target_pct", 0.50)
            if gain_pct >= profit_target:
                return (close, "profit_target")
            
            # Max hold
            max_hold = exit_params.get("max_hold_days", 252)
            if days_held >= max_hold:
                return (close, "max_hold")
        
        # =====================================================================
        # RECOVERY EXIT
        # =====================================================================
        elif exit_strategy == "recovery":
            # Stop loss
            stop_mult = exit_params.get("stop_atr_mult", 3.0)
            stop_price = trade.entry_price - (atr * stop_mult)
            if low <= stop_price:
                return (stop_price, "stop_loss")
            
            # Trailing stop after activation
            trail_activation = exit_params.get("trailing_activation_pct", 0.20)
            trail_atr = exit_params.get("trailing_atr_mult", 3.5)
            if gain_pct >= trail_activation:
                trail_stop = trade.high_water_mark - (atr * trail_atr)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
            
            # Profit target
            profit_target = exit_params.get("profit_target_pct", 0.50)
            if gain_pct >= profit_target:
                return (close, "profit_target")
            
            # Max hold
            max_hold = exit_params.get("max_hold_days", 252)
            if days_held >= max_hold:
                return (close, "max_hold")
        
        return None
    
    def run_setup(
        self,
        setup_name: str,
        start_date: str = "2020-01-01",
        end_date: str = "2025-12-31",
    ) -> Dict:
        """Run backtest for a single setup."""
        
        setup = ALL_SETUPS[setup_name]
        self.trades = []
        self.trade_counter = 0
        
        assets = self.load_assets()
        
        bull_trades = 0
        bear_skipped = 0
        
        for asset_id, symbol in assets:
            df = self.load_data(asset_id, start_date, end_date)
            if df.empty:
                continue
            
            rows = df.to_dict('records')
            in_trade = False
            current_trade = None
            entry_idx = 0
            
            for i, row in enumerate(rows):
                date_str = str(row['date'])
                
                if in_trade:
                    days_held = i - entry_idx
                    exit_result = self.check_exit(
                        current_trade, row, days_held,
                        setup["exit_strategy"],
                        setup["exit_params"],
                    )
                    
                    if exit_result:
                        exit_price, exit_reason = exit_result
                        current_trade.exit_date = date_str
                        current_trade.exit_price = exit_price
                        current_trade.exit_reason = exit_reason
                        current_trade.holding_days = days_held
                        current_trade.return_pct = (exit_price - current_trade.entry_price) / current_trade.entry_price
                        self.trades.append(current_trade)
                        in_trade = False
                        current_trade = None
                
                else:
                    # Check regime filter
                    if self.use_regime_filter and not self.regime_filter.is_bull_market(date_str):
                        bear_skipped += 1
                        continue
                    
                    # Check entry conditions
                    if self.check_conditions(setup["conditions"], row):
                        self.trade_counter += 1
                        bull_trades += 1
                        atr = row.get('atr_14') or (row['high'] - row['low'])
                        
                        current_trade = Trade(
                            trade_id=self.trade_counter,
                            asset_symbol=symbol,
                            setup_name=setup_name,
                            category=setup["category"],
                            entry_date=date_str,
                            entry_price=row['close'],
                            entry_atr=atr,
                            high_water_mark=row['high'],
                        )
                        entry_idx = i
                        in_trade = True
        
        # Calculate metrics
        metrics = self._calc_metrics()
        metrics["bull_trades"] = bull_trades
        metrics["bear_skipped"] = bear_skipped
        
        return {
            "setup_name": setup_name,
            "category": setup["category"],
            "description": setup["description"],
            "metrics": metrics,
        }
    
    def _calc_metrics(self) -> Dict:
        if not self.trades:
            return {
                "total_trades": 0, "win_rate": 0, "profit_factor": 0,
                "avg_return_pct": 0, "avg_holding_days": 0, "exit_reasons": {},
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
    
    def run_all_setups(self, start_date: str = "2020-01-01", end_date: str = "2025-12-31") -> Dict:
        """Run backtest for ALL setups and rank them."""
        
        results = []
        
        print("\n" + "="*100)
        print("MASTER BACKTEST: Testing ALL Setups")
        print(f"Regime Filter: {'ON' if self.use_regime_filter else 'OFF'}")
        print("="*100)
        
        for setup_name in ALL_SETUPS.keys():
            print(f"\n📊 Testing: {setup_name}")
            result = self.run_setup(setup_name, start_date, end_date)
            results.append(result)
            
            m = result["metrics"]
            print(f"   Trades: {m['total_trades']}, Win Rate: {m['win_rate']*100:.1f}%, "
                  f"PF: {m['profit_factor']:.2f}, Avg Ret: {m['avg_return_pct']*100:+.2f}%")
        
        # Sort by reliability score
        def calc_reliability(m):
            if m["total_trades"] < 10:
                return 0
            wr_score = min(m["win_rate"] / 0.70, 1.0) * 30
            pf_score = min(m["profit_factor"] / 2.5, 1.0) * 30
            ret_score = min(m["avg_return_pct"] / 0.15, 1.0) * 25
            sample_score = min(m["total_trades"] / 100, 1.0) * 15
            return wr_score + pf_score + ret_score + sample_score
        
        for r in results:
            r["reliability_score"] = calc_reliability(r["metrics"])
        
        results.sort(key=lambda x: x["reliability_score"], reverse=True)
        
        # Print final ranking
        print("\n" + "="*120)
        print("FINAL RANKING (All Setups)")
        print("="*120)
        print(f"{'Rank':<6} {'Setup':<35} {'Category':<15} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10} {'Score':>8}")
        print("-"*120)
        
        for i, r in enumerate(results, 1):
            m = r["metrics"]
            print(f"{i:<6} {r['setup_name']:<35} {r['category']:<15} {m['total_trades']:>8} "
                  f"{m['win_rate']*100:>9.1f}% {m['profit_factor']:>8.2f} "
                  f"{m['avg_return_pct']*100:>+9.2f}% {m['avg_holding_days']:>9.0f}d {r['reliability_score']:>8.1f}")
        
        print("="*120)
        
        # Save results
        output_path = "./data/master_backtest_results.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "regime_filter": self.use_regime_filter,
                "results": results,
            }, f, indent=2, default=str)
        print(f"\n✓ Results saved to: {output_path}")
        
        return {"results": results}


if __name__ == "__main__":
    bt = MasterBacktester(use_regime_filter=True)
    bt.connect()
    bt.run_all_setups()
    bt.disconnect()

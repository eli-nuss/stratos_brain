"""
Advanced Backtester with Three Key Optimizations:

1. MARKET REGIME FILTER
   - Only take trades when SPY is above its 200 MA
   - Avoids trading during bear markets

2. DUAL-TIMEFRAME "FREE-ROLL" EXIT
   - Sell 50% at short-term target (lock in high win rate)
   - Hold remaining 50% with wide stops (capture big moves)

3. COMBINED SHORT+LONG ENTRY
   - Use short-term setups as entries into stocks in long-term uptrends
   - Best of both worlds: high probability entry + trend following

"""

import json
import os
from dataclasses import dataclass, asdict, field
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
# SETUP DEFINITIONS
# =============================================================================

# Short-term setups (for entries)
SHORT_TERM_SETUPS = {
    "oversold_quality": {
        "description": "RSI oversold + extended below 20 MA",
        "conditions": [
            {"field": "rsi_14", "op": "<", "value": 35},
            {"field": "ma_dist_20", "op": "<", "value": -0.08},
        ],
        "short_target_pct": 0.08,  # 8% quick target
        "stop_atr_mult": 2.0,
    },
    "volatility_contraction_breakout": {
        "description": "VCP - tight squeeze with breakout",
        "conditions": [
            {"field": "squeeze_pctile", "op": "<", "value": 25},
            {"field": "breakout_up_20", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.3},
        ],
        "short_target_pct": 0.10,  # 10% quick target
        "stop_atr_mult": 1.5,
    },
    "gap_up_momentum": {
        "description": "Gap up with volume confirmation",
        "conditions": [
            {"field": "gap_pct", "op": ">", "value": 0.03},
            {"field": "rvol_20", "op": ">", "value": 2.0},
        ],
        "short_target_pct": 0.08,
        "stop_atr_mult": 1.5,
    },
    "acceleration_turn": {
        "description": "Momentum acceleration turning positive",
        "conditions": [
            {"field": "accel_turn_up", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
        ],
        "short_target_pct": 0.10,
        "stop_atr_mult": 2.0,
    },
}

# Long-term trend filters (stock must be in uptrend)
LONG_TERM_FILTERS = {
    "strong_uptrend": {
        "description": "Above 200 MA, 50 MA above 200 MA, near highs",
        "conditions": [
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "dist_52w_high", "op": ">", "value": -0.20},
        ],
    },
    "moderate_uptrend": {
        "description": "Above 200 MA with positive momentum",
        "conditions": [
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "roc_20", "op": ">", "value": 0},
        ],
    },
}

# Long-term setups (standalone)
LONG_TERM_SETUPS = {
    "golden_cross_momentum": {
        "description": "50 MA crosses above 200 MA with strong momentum",
        "conditions": [
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "roc_20", "op": ">", "value": 0.08},
            {"field": "rvol_20", "op": ">", "value": 1.2},
        ],
    },
    "52w_low_reversal": {
        "description": "Near 52-week low with reversal signals",
        "conditions": [
            {"field": "dist_52w_low", "op": "<", "value": 0.15},
            {"field": "accel_turn_up", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.5},
        ],
    },
    "rs_acceleration": {
        "description": "Relative strength accelerating",
        "conditions": [
            {"field": "rs_roc_20", "op": ">", "value": 0.05},
            {"field": "rs_vs_benchmark", "op": ">", "value": 0.05},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
        ],
    },
    "trend_pullback_50ma": {
        "description": "Pullback to 50 MA in uptrend",
        "conditions": [
            {"field": "ma_dist_50", "op": "<=", "value": 0.03},
            {"field": "ma_dist_50", "op": ">=", "value": -0.03},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "rsi_14", "op": "<", "value": 50},
        ],
    },
}


# =============================================================================
# TRADE DATA STRUCTURES
# =============================================================================

@dataclass
class Position:
    """Represents a position with potential two-tiered exit."""
    trade_id: int
    asset_symbol: str
    setup_name: str
    entry_date: str
    entry_price: float
    entry_atr: float
    
    # Position sizing
    initial_shares: float = 100.0
    remaining_shares: float = 100.0
    
    # Tracking
    high_water_mark: float = 0.0
    first_exit_done: bool = False
    first_exit_date: Optional[str] = None
    first_exit_price: Optional[float] = None
    first_exit_return: Optional[float] = None
    
    # Final exit
    final_exit_date: Optional[str] = None
    final_exit_price: Optional[float] = None
    final_exit_reason: Optional[str] = None
    
    # Combined results
    total_return_pct: Optional[float] = None
    holding_days: Optional[int] = None


# =============================================================================
# MARKET REGIME FILTER
# =============================================================================

class MarketRegimeFilter:
    """
    Determines if we're in a bull or bear market based on market breadth.
    Uses % of stocks above 200 MA as a proxy since SPY isn't in the database.
    """
    
    def __init__(self, conn):
        self.conn = conn
        self.breadth_data = None
        self._load_breadth_data()
    
    def _load_breadth_data(self):
        """Calculate market breadth (% of stocks above 200 MA) for each date."""
        cur = self.conn.cursor(cursor_factory=RealDictCursor)
        
        # Calculate breadth for our universe of blue-chip stocks
        cur.execute("""
            SELECT 
                f.date,
                COUNT(*) as total_stocks,
                SUM(CASE WHEN f.above_ma200 = true THEN 1 ELSE 0 END) as above_200ma,
                ROUND(100.0 * SUM(CASE WHEN f.above_ma200 = true THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_above_200ma
            FROM daily_features f
            JOIN assets a ON a.asset_id = f.asset_id
            WHERE a.asset_type = 'equity'
            AND a.symbol IN (
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'JNJ',
                'V', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'BAC', 'ADBE', 'CMCSA',
                'NFLX', 'XOM', 'VZ', 'INTC', 'PFE', 'KO', 'PEP', 'MRK', 'ABT',
                'CVX', 'WMT', 'CSCO', 'CRM', 'TMO', 'ABBV', 'ACN', 'AVGO', 'MCD', 'COST',
                'NKE', 'DHR', 'LLY', 'TXN', 'NEE', 'UNP', 'BMY', 'ORCL', 'HON',
                'AMD', 'QCOM', 'LOW', 'UPS', 'MS', 'RTX', 'SBUX', 'GS', 'BLK', 'INTU'
            )
            AND f.date >= '2019-01-01'
            GROUP BY f.date
            ORDER BY f.date
        """)
        
        rows = cur.fetchall()
        self.breadth_data = {str(r['date']): float(r['pct_above_200ma']) for r in rows}
        print(f"📊 Loaded {len(self.breadth_data)} days of market breadth data")
        
        # Show some stats
        if self.breadth_data:
            values = list(self.breadth_data.values())
            print(f"   Breadth range: {min(values):.1f}% - {max(values):.1f}%")
    
    def is_bull_market(self, date: str) -> bool:
        """
        Returns True if market breadth is healthy (>50% of stocks above 200 MA).
        This is a proxy for SPY > 200 MA.
        """
        breadth = self.breadth_data.get(date)
        if breadth is None:
            return True  # Default to allowing trades if no data
        return breadth >= 50.0  # Bull market if 50%+ stocks above 200 MA
    
    def get_regime(self, date: str) -> str:
        """Returns 'BULL' or 'BEAR' based on market breadth."""
        return "BULL" if self.is_bull_market(date) else "BEAR"


# =============================================================================
# ADVANCED BACKTESTER
# =============================================================================

class AdvancedBacktester:
    """
    Backtester with three key optimizations:
    1. Market Regime Filter
    2. Dual-Timeframe Free-Roll Exit
    3. Combined Short+Long Entry
    """
    
    def __init__(self, use_regime_filter: bool = True, use_freeroll_exit: bool = True):
        self.conn = None
        self.regime_filter = None
        self.use_regime_filter = use_regime_filter
        self.use_freeroll_exit = use_freeroll_exit
        self.positions: List[Position] = []
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
        """Load blue-chip equity universe."""
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
        """Load OHLCV and features for an asset."""
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
                f.accel_turn_up, f.gap_pct
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
        """Check if all conditions are met."""
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
    
    def check_freeroll_exit(
        self, 
        pos: Position, 
        row: Dict, 
        days_held: int,
        short_target_pct: float,
        stop_atr_mult: float,
    ) -> Optional[Tuple[float, str, bool]]:
        """
        Check exit conditions for free-roll strategy.
        Returns: (exit_price, exit_reason, is_final_exit)
        """
        close = row['close']
        high = row['high']
        low = row['low']
        atr = row.get('atr_14') or pos.entry_atr
        
        # Update high water mark
        if high > pos.high_water_mark:
            pos.high_water_mark = high
        
        gain_pct = (close - pos.entry_price) / pos.entry_price
        
        # PHASE 1: First exit (50% of position at short-term target)
        if not pos.first_exit_done:
            # Stop loss (full exit)
            stop_price = pos.entry_price - (atr * stop_atr_mult)
            if low <= stop_price:
                return (stop_price, "stop_loss", True)
            
            # Short-term target hit (partial exit)
            if gain_pct >= short_target_pct:
                pos.first_exit_done = True
                pos.first_exit_date = str(row['date'])
                pos.first_exit_price = close
                pos.first_exit_return = gain_pct
                pos.remaining_shares = pos.initial_shares * 0.5
                # Move stop to breakeven for remaining position
                return (close, "short_term_target", False)  # Not final
        
        # PHASE 2: Second exit (remaining 50% with wide stops)
        else:
            # Breakeven stop (can't lose on remaining position)
            if low <= pos.entry_price:
                return (pos.entry_price, "breakeven_stop", True)
            
            # 200 MA breakdown (trend over)
            sma_200 = row.get('sma_200')
            if sma_200 and close < float(sma_200) * 0.97:
                return (close, "trend_breakdown_200ma", True)
            
            # Trailing stop (activated after 30% gain from entry)
            if gain_pct >= 0.30:
                trail_stop = pos.high_water_mark - (atr * 4.0)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop", True)
            
            # Profit target (75% gain)
            if gain_pct >= 0.75:
                return (close, "profit_target_75pct", True)
            
            # Max hold (1 year)
            if days_held >= 252:
                return (close, "max_hold_252d", True)
        
        return None
    
    def check_standard_exit(
        self,
        pos: Position,
        row: Dict,
        days_held: int,
    ) -> Optional[Tuple[float, str]]:
        """Standard exit without free-roll (for comparison)."""
        close = row['close']
        high = row['high']
        low = row['low']
        atr = row.get('atr_14') or pos.entry_atr
        
        if high > pos.high_water_mark:
            pos.high_water_mark = high
        
        gain_pct = (close - pos.entry_price) / pos.entry_price
        
        # Stop loss
        stop_price = pos.entry_price - (atr * 3.0)
        if low <= stop_price:
            return (stop_price, "stop_loss")
        
        # 200 MA breakdown
        sma_200 = row.get('sma_200')
        if sma_200 and close < float(sma_200) * 0.95:
            return (close, "breakdown_200ma")
        
        # Trailing stop (after 25% gain)
        if gain_pct >= 0.25:
            trail_stop = pos.high_water_mark - (atr * 3.5)
            if low <= trail_stop:
                return (trail_stop, "trailing_stop")
        
        # Profit target
        if gain_pct >= 0.50:
            return (close, "profit_target")
        
        # Max hold
        if days_held >= 252:
            return (close, "max_hold")
        
        return None
    
    def run_backtest(
        self,
        mode: str = "combined",  # "long_only", "short_only", "combined"
        setup_name: Optional[str] = None,
        start_date: str = "2020-01-01",
        end_date: str = "2025-12-31",
    ) -> Dict:
        """
        Run backtest with specified mode.
        
        Modes:
        - "long_only": Test long-term setups with regime filter
        - "short_only": Test short-term setups
        - "combined": Short-term entry + long-term trend filter (best of both)
        """
        
        self.positions = []
        self.trade_counter = 0
        
        print(f"\n{'='*70}")
        print(f"ADVANCED BACKTEST")
        print(f"Mode: {mode}")
        print(f"Regime Filter: {'ON' if self.use_regime_filter else 'OFF'}")
        print(f"Free-Roll Exit: {'ON' if self.use_freeroll_exit else 'OFF'}")
        if setup_name:
            print(f"Setup: {setup_name}")
        print(f"{'='*70}")
        
        assets = self.load_assets()
        print(f"📊 Loaded {len(assets)} assets")
        
        # Track regime stats
        bull_trades = 0
        bear_trades_skipped = 0
        
        for asset_id, symbol in assets:
            df = self.load_data(asset_id, start_date, end_date)
            if df.empty:
                continue
            
            rows = df.to_dict('records')
            in_trade = False
            current_pos = None
            entry_idx = 0
            
            for i, row in enumerate(rows):
                date_str = str(row['date'])
                
                if in_trade:
                    days_held = i - entry_idx
                    
                    if self.use_freeroll_exit:
                        # Get setup config for exit params
                        if mode == "combined" or mode == "short_only":
                            setup_config = SHORT_TERM_SETUPS.get(current_pos.setup_name, {})
                        else:
                            setup_config = {"short_target_pct": 0.15, "stop_atr_mult": 2.5}
                        
                        exit_result = self.check_freeroll_exit(
                            current_pos, row, days_held,
                            setup_config.get("short_target_pct", 0.10),
                            setup_config.get("stop_atr_mult", 2.0),
                        )
                        
                        if exit_result:
                            exit_price, exit_reason, is_final = exit_result
                            
                            if is_final:
                                current_pos.final_exit_date = date_str
                                current_pos.final_exit_price = exit_price
                                current_pos.final_exit_reason = exit_reason
                                current_pos.holding_days = days_held
                                
                                # Calculate total return
                                if current_pos.first_exit_done:
                                    # Weighted return: 50% at first exit, 50% at final
                                    first_ret = current_pos.first_exit_return or 0
                                    final_ret = (exit_price - current_pos.entry_price) / current_pos.entry_price
                                    current_pos.total_return_pct = (first_ret * 0.5) + (final_ret * 0.5)
                                else:
                                    # Full exit at once
                                    current_pos.total_return_pct = (exit_price - current_pos.entry_price) / current_pos.entry_price
                                
                                self.positions.append(current_pos)
                                in_trade = False
                                current_pos = None
                    else:
                        exit_result = self.check_standard_exit(current_pos, row, days_held)
                        if exit_result:
                            exit_price, exit_reason = exit_result
                            current_pos.final_exit_date = date_str
                            current_pos.final_exit_price = exit_price
                            current_pos.final_exit_reason = exit_reason
                            current_pos.holding_days = days_held
                            current_pos.total_return_pct = (exit_price - current_pos.entry_price) / current_pos.entry_price
                            self.positions.append(current_pos)
                            in_trade = False
                            current_pos = None
                
                else:
                    # Check regime filter
                    if self.use_regime_filter and not self.regime_filter.is_bull_market(date_str):
                        bear_trades_skipped += 1
                        continue
                    
                    # Check entry conditions based on mode
                    entry_setup = None
                    
                    if mode == "long_only":
                        # Test long-term setups directly
                        setups_to_check = {setup_name: LONG_TERM_SETUPS[setup_name]} if setup_name else LONG_TERM_SETUPS
                        for name, config in setups_to_check.items():
                            if self.check_conditions(config["conditions"], row):
                                entry_setup = name
                                break
                    
                    elif mode == "short_only":
                        # Test short-term setups directly
                        setups_to_check = {setup_name: SHORT_TERM_SETUPS[setup_name]} if setup_name else SHORT_TERM_SETUPS
                        for name, config in setups_to_check.items():
                            if self.check_conditions(config["conditions"], row):
                                entry_setup = name
                                break
                    
                    elif mode == "combined":
                        # COMBINED: Short-term entry + long-term trend filter
                        # First check if stock is in long-term uptrend
                        in_uptrend = self.check_conditions(
                            LONG_TERM_FILTERS["strong_uptrend"]["conditions"], row
                        )
                        
                        if in_uptrend:
                            # Then look for short-term entry signal
                            setups_to_check = {setup_name: SHORT_TERM_SETUPS[setup_name]} if setup_name else SHORT_TERM_SETUPS
                            for name, config in setups_to_check.items():
                                if self.check_conditions(config["conditions"], row):
                                    entry_setup = f"combined_{name}"
                                    break
                    
                    if entry_setup:
                        self.trade_counter += 1
                        bull_trades += 1
                        atr = row.get('atr_14') or (row['high'] - row['low'])
                        
                        current_pos = Position(
                            trade_id=self.trade_counter,
                            asset_symbol=symbol,
                            setup_name=entry_setup,
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
        metrics["bear_trades_skipped"] = bear_trades_skipped
        
        print(f"\nResults:")
        print(f"  Trades Taken (Bull Market): {bull_trades}")
        if self.use_regime_filter:
            print(f"  Trades Skipped (Bear Market): {bear_trades_skipped}")
        print(f"  Win Rate: {metrics['win_rate']*100:.1f}%")
        print(f"  Profit Factor: {metrics['profit_factor']:.2f}")
        print(f"  Avg Return: {metrics['avg_return_pct']*100:+.2f}%")
        print(f"  Avg Hold: {metrics['avg_holding_days']:.0f} days")
        if self.use_freeroll_exit:
            print(f"  Free-Roll Conversions: {metrics.get('freeroll_conversions', 0)}")
        print(f"  Exit Reasons: {metrics['exit_reasons']}")
        
        return {
            "mode": mode,
            "setup_name": setup_name,
            "regime_filter": self.use_regime_filter,
            "freeroll_exit": self.use_freeroll_exit,
            "metrics": metrics,
            "positions": [asdict(p) for p in self.positions],
        }
    
    def _calc_metrics(self) -> Dict:
        if not self.positions:
            return {
                "total_trades": 0, "win_rate": 0, "profit_factor": 0,
                "avg_return_pct": 0, "avg_holding_days": 0, "exit_reasons": {},
                "freeroll_conversions": 0,
            }
        
        returns = [p.total_return_pct for p in self.positions if p.total_return_pct is not None]
        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r <= 0]
        
        total_wins = sum(wins) if wins else 0
        total_losses = abs(sum(losses)) if losses else 0.0001
        
        exit_reasons = {}
        freeroll_conversions = 0
        for p in self.positions:
            reason = p.final_exit_reason or "unknown"
            exit_reasons[reason] = exit_reasons.get(reason, 0) + 1
            if p.first_exit_done:
                freeroll_conversions += 1
        
        holding_days = [p.holding_days for p in self.positions if p.holding_days]
        
        return {
            "total_trades": len(self.positions),
            "win_rate": len(wins) / len(returns) if returns else 0,
            "profit_factor": total_wins / total_losses,
            "avg_return_pct": sum(returns) / len(returns) if returns else 0,
            "avg_holding_days": sum(holding_days) / len(holding_days) if holding_days else 0,
            "exit_reasons": exit_reasons,
            "freeroll_conversions": freeroll_conversions,
        }
    
    def run_comparison(self) -> Dict:
        """Run all modes and compare results."""
        results = {}
        
        # Test 1: Long-term setups WITHOUT regime filter
        print("\n" + "="*80)
        print("TEST 1: Long-Term Setups WITHOUT Regime Filter")
        print("="*80)
        self.use_regime_filter = False
        self.use_freeroll_exit = False
        self.disconnect()
        self.connect()
        results["long_no_filter"] = self.run_backtest(mode="long_only")
        
        # Test 2: Long-term setups WITH regime filter
        print("\n" + "="*80)
        print("TEST 2: Long-Term Setups WITH Regime Filter (SPY > 200 MA)")
        print("="*80)
        self.use_regime_filter = True
        self.use_freeroll_exit = False
        self.disconnect()
        self.connect()
        results["long_with_filter"] = self.run_backtest(mode="long_only")
        
        # Test 3: Combined (Short entry + Long trend) WITHOUT free-roll
        print("\n" + "="*80)
        print("TEST 3: Combined Short+Long WITHOUT Free-Roll Exit")
        print("="*80)
        self.use_regime_filter = True
        self.use_freeroll_exit = False
        self.disconnect()
        self.connect()
        results["combined_no_freeroll"] = self.run_backtest(mode="combined")
        
        # Test 4: Combined (Short entry + Long trend) WITH free-roll
        print("\n" + "="*80)
        print("TEST 4: Combined Short+Long WITH Free-Roll Exit (FULL SYSTEM)")
        print("="*80)
        self.use_regime_filter = True
        self.use_freeroll_exit = True
        self.disconnect()
        self.connect()
        results["combined_with_freeroll"] = self.run_backtest(mode="combined")
        
        # Print comparison summary
        print("\n" + "="*100)
        print("COMPARISON SUMMARY")
        print("="*100)
        print(f"{'Configuration':<45} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10}")
        print("-"*100)
        
        for name, result in results.items():
            m = result["metrics"]
            wr = f"{m['win_rate']*100:.1f}%"
            pf = f"{m['profit_factor']:.2f}"
            avg_ret = f"{m['avg_return_pct']*100:+.2f}%"
            avg_hold = f"{m['avg_holding_days']:.0f}d"
            print(f"{name:<45} {m['total_trades']:>8} {wr:>10} {pf:>8} {avg_ret:>10} {avg_hold:>10}")
        
        print("="*100)
        
        # Save results
        output_path = "./data/advanced_backtest_comparison.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        # Simplify for JSON
        save_results = {}
        for name, result in results.items():
            save_results[name] = {
                "mode": result["mode"],
                "regime_filter": result["regime_filter"],
                "freeroll_exit": result["freeroll_exit"],
                "metrics": result["metrics"],
            }
        
        with open(output_path, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "results": save_results,
            }, f, indent=2)
        print(f"\n✓ Results saved to: {output_path}")
        
        return results


if __name__ == "__main__":
    bt = AdvancedBacktester()
    bt.connect()
    bt.run_comparison()
    bt.disconnect()

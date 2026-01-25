"""
EXIT PARAMETER OPTIMIZER
========================
Optimizes exit parameters for each setup individually through grid search.
Tests different combinations and finds the best configuration for each strategy.
"""

import json
import itertools
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
# SETUP DEFINITIONS (Entry conditions only - exits will be optimized)
# =============================================================================

SETUPS = {
    # Short-term
    "oversold_quality": {
        "category": "short_term",
        "description": "RSI oversold + extended below 20 MA",
        "conditions": [
            {"field": "rsi_14", "op": "<", "value": 35},
            {"field": "ma_dist_20", "op": "<", "value": -0.08},
        ],
    },
    "deep_oversold_bounce": {
        "category": "short_term",
        "description": "Extreme oversold with reversal",
        "conditions": [
            {"field": "rsi_14", "op": "<", "value": 25},
            {"field": "ma_dist_20", "op": "<", "value": -0.12},
            {"field": "accel_turn_up", "op": "==", "value": True},
        ],
    },
    "gap_up_hold": {
        "category": "short_term",
        "description": "Gap up with volume",
        "conditions": [
            {"field": "gap_pct", "op": ">", "value": 0.03},
            {"field": "rvol_20", "op": ">", "value": 2.0},
        ],
    },
    "volatility_contraction_breakout": {
        "category": "short_term",
        "description": "VCP squeeze breakout",
        "conditions": [
            {"field": "squeeze_pctile", "op": "<", "value": 25},
            {"field": "breakout_up_20", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.3},
        ],
    },
    
    # Medium-term
    "acceleration_turn_up": {
        "category": "medium_term",
        "description": "Momentum acceleration turning positive",
        "conditions": [
            {"field": "accel_turn_up", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
        ],
    },
    "holy_grail_20ema": {
        "category": "medium_term",
        "description": "Pullback to rising 20 EMA",
        "conditions": [
            {"field": "ma_dist_20", "op": "<=", "value": 0.02},
            {"field": "ma_dist_20", "op": ">=", "value": -0.02},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "roc_20", "op": ">", "value": 0.05},
        ],
    },
    "macd_bullish_cross": {
        "category": "medium_term",
        "description": "MACD histogram turning positive",
        "conditions": [
            {"field": "macd_hist_slope", "op": ">", "value": 0},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "rsi_14", "op": ">", "value": 40},
            {"field": "rsi_14", "op": "<", "value": 70},
        ],
    },
    "relative_strength_breakout": {
        "category": "medium_term",
        "description": "RS line breaking out",
        "conditions": [
            {"field": "rs_breakout", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.2},
        ],
    },
    "trend_pullback_50ma": {
        "category": "medium_term",
        "description": "Pullback to 50 MA in uptrend",
        "conditions": [
            {"field": "ma_dist_50", "op": "<=", "value": 0.03},
            {"field": "ma_dist_50", "op": ">=", "value": -0.03},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "rsi_14", "op": "<", "value": 50},
        ],
    },
    
    # Long-term
    "golden_cross_momentum": {
        "category": "long_term",
        "description": "50 MA crosses above 200 MA with momentum",
        "conditions": [
            {"field": "ma50_above_ma200", "op": "==", "value": True},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "roc_20", "op": ">", "value": 0.08},
            {"field": "rvol_20", "op": ">", "value": 1.2},
        ],
    },
    "52w_low_reversal": {
        "category": "long_term",
        "description": "Near 52-week low with reversal",
        "conditions": [
            {"field": "dist_52w_low", "op": "<", "value": 0.15},
            {"field": "accel_turn_up", "op": "==", "value": True},
            {"field": "rvol_20", "op": ">", "value": 1.5},
        ],
    },
    "rs_acceleration": {
        "category": "long_term",
        "description": "Relative strength accelerating",
        "conditions": [
            {"field": "rs_roc_20", "op": ">", "value": 0.05},
            {"field": "rs_vs_benchmark", "op": ">", "value": 0.05},
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma50_above_ma200", "op": "==", "value": True},
        ],
    },
    "stage2_entry": {
        "category": "long_term",
        "description": "Stage 2 entry above 200 MA",
        "conditions": [
            {"field": "above_ma200", "op": "==", "value": True},
            {"field": "ma_dist_200", "op": "<", "value": 0.10},
            {"field": "roc_20", "op": ">", "value": 0.05},
            {"field": "rvol_20", "op": ">", "value": 1.2},
        ],
    },
}


# =============================================================================
# EXIT PARAMETER GRIDS (to be optimized)
# =============================================================================

EXIT_PARAM_GRIDS = {
    "short_term": {
        # Mean reversion style exits
        "target_ma": ["sma_20", "sma_50"],
        "stop_atr_mult": [1.5, 2.0, 2.5],
        "time_stop_days": [5, 10, 15, 20],
        "use_trailing": [False, True],
        "trailing_activation_pct": [0.05, 0.08, 0.10],
        "trailing_atr_mult": [1.5, 2.0, 2.5],
    },
    "medium_term": {
        # Trend following exits
        "breakdown_ma": ["sma_20", "sma_50"],
        "stop_atr_mult": [2.0, 2.5, 3.0],
        "trailing_activation_pct": [0.10, 0.15, 0.20],
        "trailing_atr_mult": [2.5, 3.0, 3.5],
        "profit_target_pct": [None, 0.30, 0.50],
        "max_hold_days": [30, 60, 90],
    },
    "long_term": {
        # Long-term trend exits
        "breakdown_ma": ["sma_50", "sma_200"],
        "stop_atr_mult": [2.5, 3.0, 3.5],
        "trailing_activation_pct": [0.15, 0.20, 0.25, 0.30],
        "trailing_atr_mult": [3.0, 3.5, 4.0],
        "profit_target_pct": [None, 0.40, 0.50, 0.75],
        "max_hold_days": [90, 120, 180, 252],
    },
}


# =============================================================================
# TRADE DATA STRUCTURE
# =============================================================================

@dataclass
class Trade:
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
# EXIT OPTIMIZER
# =============================================================================

class ExitOptimizer:
    """Optimizes exit parameters for each setup."""
    
    def __init__(self):
        self.conn = None
        self.asset_data_cache = {}
    
    def connect(self):
        self.conn = get_db_connection()
        print("✅ Connected to database")
    
    def disconnect(self):
        if self.conn:
            self.conn.close()
    
    def load_assets(self) -> List[Tuple[int, str]]:
        cur = self.conn.cursor()
        cur.execute("""
            SELECT DISTINCT a.asset_id, a.symbol
            FROM assets a
            JOIN daily_features f ON f.asset_id = a.asset_id
            WHERE a.asset_type = 'equity'
            AND a.symbol IN (
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'JNJ',
                'V', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'BAC', 'ADBE', 'CMCSA',
                'NFLX', 'XOM', 'VZ', 'INTC', 'PFE', 'KO', 'PEP', 'MRK', 'ABT',
                'CVX', 'WMT', 'CSCO', 'CRM', 'TMO', 'ABBV', 'ACN', 'AVGO', 'MCD', 'COST',
                'NKE', 'DHR', 'LLY', 'TXN', 'NEE', 'UNP', 'BMY', 'ORCL', 'HON',
                'AMD', 'QCOM', 'LOW', 'UPS', 'MS', 'RTX', 'SBUX', 'GS', 'BLK', 'INTU'
            )
            AND f.date >= '2020-01-01'
            GROUP BY a.asset_id, a.symbol
            HAVING COUNT(*) >= 500
            ORDER BY a.symbol
        """)
        return cur.fetchall()
    
    def load_data(self, asset_id: int) -> pd.DataFrame:
        """Load data with caching."""
        if asset_id in self.asset_data_cache:
            return self.asset_data_cache[asset_id]
        
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
            WHERE b.asset_id = %s AND b.date >= '2020-01-01'
            ORDER BY b.date
        """, (asset_id,))
        
        rows = cur.fetchall()
        if not rows:
            return pd.DataFrame()
        
        df = pd.DataFrame(rows)
        for col in df.columns:
            if col != 'date' and df[col].dtype == object:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        self.asset_data_cache[asset_id] = df
        return df
    
    def check_conditions(self, conditions: List[Dict], row: Dict) -> bool:
        for cond in conditions:
            field = cond["field"]
            op = cond["op"]
            threshold = cond["value"]
            actual = row.get(field)
            
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
    
    def check_exit(self, trade: Trade, row: Dict, days_held: int, params: Dict, category: str) -> Optional[Tuple[float, str]]:
        """Check exit based on parameters."""
        close = row['close']
        high = row['high']
        low = row['low']
        atr = row.get('atr_14') or trade.entry_atr
        
        if high > trade.high_water_mark:
            trade.high_water_mark = high
        
        gain_pct = (close - trade.entry_price) / trade.entry_price
        
        # Stop loss (all categories)
        stop_mult = params.get("stop_atr_mult", 2.0)
        stop_price = trade.entry_price - (atr * stop_mult)
        if low <= stop_price:
            return (stop_price, "stop_loss")
        
        # SHORT-TERM specific exits
        if category == "short_term":
            # Target MA touch
            target_ma = params.get("target_ma", "sma_20")
            ma_value = row.get(target_ma)
            if ma_value and high >= float(ma_value):
                return (float(ma_value), f"target_{target_ma}")
            
            # Time stop
            time_stop = params.get("time_stop_days", 15)
            if days_held >= time_stop:
                return (close, "time_stop")
            
            # Optional trailing stop
            if params.get("use_trailing", False):
                trail_activation = params.get("trailing_activation_pct", 0.08)
                trail_atr = params.get("trailing_atr_mult", 2.0)
                if gain_pct >= trail_activation:
                    trail_stop = trade.high_water_mark - (atr * trail_atr)
                    if low <= trail_stop:
                        return (trail_stop, "trailing_stop")
        
        # MEDIUM-TERM specific exits
        elif category == "medium_term":
            # Breakdown below MA
            breakdown_ma = params.get("breakdown_ma", "sma_50")
            ma_value = row.get(breakdown_ma)
            if ma_value and close < float(ma_value) * 0.98:
                return (close, f"breakdown_{breakdown_ma}")
            
            # Trailing stop
            trail_activation = params.get("trailing_activation_pct", 0.15)
            trail_atr = params.get("trailing_atr_mult", 3.0)
            if gain_pct >= trail_activation:
                trail_stop = trade.high_water_mark - (atr * trail_atr)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
            
            # Profit target
            profit_target = params.get("profit_target_pct")
            if profit_target and gain_pct >= profit_target:
                return (close, "profit_target")
            
            # Max hold
            max_hold = params.get("max_hold_days", 60)
            if days_held >= max_hold:
                return (close, "max_hold")
        
        # LONG-TERM specific exits
        elif category == "long_term":
            # Breakdown below MA
            breakdown_ma = params.get("breakdown_ma", "sma_200")
            ma_value = row.get(breakdown_ma)
            if ma_value and close < float(ma_value) * 0.95:
                return (close, f"breakdown_{breakdown_ma}")
            
            # Trailing stop
            trail_activation = params.get("trailing_activation_pct", 0.20)
            trail_atr = params.get("trailing_atr_mult", 3.5)
            if gain_pct >= trail_activation:
                trail_stop = trade.high_water_mark - (atr * trail_atr)
                if low <= trail_stop:
                    return (trail_stop, "trailing_stop")
            
            # Profit target
            profit_target = params.get("profit_target_pct")
            if profit_target and gain_pct >= profit_target:
                return (close, "profit_target")
            
            # Max hold
            max_hold = params.get("max_hold_days", 180)
            if days_held >= max_hold:
                return (close, "max_hold")
        
        return None
    
    def run_backtest(self, setup_name: str, exit_params: Dict, assets: List, preloaded: bool = True) -> Dict:
        """Run backtest with specific exit parameters."""
        setup = SETUPS[setup_name]
        category = setup["category"]
        trades = []
        
        for asset_id, symbol in assets:
            df = self.load_data(asset_id) if preloaded else self.load_data(asset_id)
            if df.empty:
                continue
            
            rows = df.to_dict('records')
            in_trade = False
            current_trade = None
            entry_idx = 0
            
            for i, row in enumerate(rows):
                if in_trade:
                    days_held = i - entry_idx
                    exit_result = self.check_exit(current_trade, row, days_held, exit_params, category)
                    
                    if exit_result:
                        exit_price, exit_reason = exit_result
                        current_trade.exit_date = str(row['date'])
                        current_trade.exit_price = exit_price
                        current_trade.exit_reason = exit_reason
                        current_trade.holding_days = days_held
                        current_trade.return_pct = (exit_price - current_trade.entry_price) / current_trade.entry_price
                        trades.append(current_trade)
                        in_trade = False
                        current_trade = None
                
                else:
                    if self.check_conditions(setup["conditions"], row):
                        atr = row.get('atr_14') or (row['high'] - row['low'])
                        current_trade = Trade(
                            entry_date=str(row['date']),
                            entry_price=row['close'],
                            entry_atr=atr,
                            high_water_mark=row['high'],
                        )
                        entry_idx = i
                        in_trade = True
        
        # Calculate metrics
        if not trades:
            return {"total_trades": 0, "win_rate": 0, "profit_factor": 0, "avg_return_pct": 0, "avg_holding_days": 0}
        
        returns = [t.return_pct for t in trades if t.return_pct is not None]
        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r <= 0]
        
        total_wins = sum(wins) if wins else 0
        total_losses = abs(sum(losses)) if losses else 0.0001
        holding_days = [t.holding_days for t in trades if t.holding_days]
        
        return {
            "total_trades": len(trades),
            "win_rate": len(wins) / len(returns) if returns else 0,
            "profit_factor": total_wins / total_losses,
            "avg_return_pct": sum(returns) / len(returns) if returns else 0,
            "avg_holding_days": sum(holding_days) / len(holding_days) if holding_days else 0,
        }
    
    def calc_score(self, metrics: Dict) -> float:
        """Calculate reliability score for ranking."""
        if metrics["total_trades"] < 10:
            return 0
        wr_score = min(metrics["win_rate"] / 0.70, 1.0) * 30
        pf_score = min(metrics["profit_factor"] / 2.5, 1.0) * 30
        ret_score = min(metrics["avg_return_pct"] / 0.15, 1.0) * 25
        sample_score = min(metrics["total_trades"] / 100, 1.0) * 15
        return wr_score + pf_score + ret_score + sample_score
    
    def optimize_setup(self, setup_name: str) -> Dict:
        """Find optimal exit parameters for a setup."""
        setup = SETUPS[setup_name]
        category = setup["category"]
        param_grid = EXIT_PARAM_GRIDS[category]
        
        # Generate all parameter combinations
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        combinations = list(itertools.product(*param_values))
        
        print(f"\n📊 Optimizing: {setup_name} ({len(combinations)} combinations)")
        
        assets = self.load_assets()
        
        best_score = 0
        best_params = None
        best_metrics = None
        
        for i, combo in enumerate(combinations):
            params = dict(zip(param_names, combo))
            
            # Skip invalid combinations
            if category == "short_term" and not params.get("use_trailing", False):
                # Remove trailing params if not using trailing
                params.pop("trailing_activation_pct", None)
                params.pop("trailing_atr_mult", None)
            
            metrics = self.run_backtest(setup_name, params, assets)
            score = self.calc_score(metrics)
            
            if score > best_score:
                best_score = score
                best_params = params.copy()
                best_metrics = metrics.copy()
                
                print(f"   [{i+1}/{len(combinations)}] New best: Score={score:.1f}, "
                      f"WR={metrics['win_rate']*100:.1f}%, PF={metrics['profit_factor']:.2f}, "
                      f"Ret={metrics['avg_return_pct']*100:+.2f}%")
        
        return {
            "setup_name": setup_name,
            "category": category,
            "best_params": best_params,
            "best_metrics": best_metrics,
            "best_score": best_score,
        }
    
    def optimize_all(self) -> Dict:
        """Optimize all setups."""
        results = []
        
        print("\n" + "="*100)
        print("EXIT PARAMETER OPTIMIZATION")
        print("="*100)
        
        for setup_name in SETUPS.keys():
            result = self.optimize_setup(setup_name)
            results.append(result)
        
        # Sort by score
        results.sort(key=lambda x: x["best_score"], reverse=True)
        
        # Print final ranking
        print("\n" + "="*120)
        print("OPTIMIZED RESULTS (All Setups)")
        print("="*120)
        print(f"{'Rank':<6} {'Setup':<35} {'Category':<15} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10} {'Score':>8}")
        print("-"*120)
        
        for i, r in enumerate(results, 1):
            m = r["best_metrics"]
            if m:
                print(f"{i:<6} {r['setup_name']:<35} {r['category']:<15} {m['total_trades']:>8} "
                      f"{m['win_rate']*100:>9.1f}% {m['profit_factor']:>8.2f} "
                      f"{m['avg_return_pct']*100:>+9.2f}% {m['avg_holding_days']:>9.0f}d {r['best_score']:>8.1f}")
        
        print("="*120)
        
        # Print optimal parameters for each setup
        print("\n" + "="*100)
        print("OPTIMAL EXIT PARAMETERS")
        print("="*100)
        
        for r in results:
            if r["best_params"]:
                print(f"\n{r['setup_name']} ({r['category']}):")
                for k, v in r["best_params"].items():
                    print(f"   {k}: {v}")
        
        # Save results
        output_path = "./data/optimized_exit_params.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "results": results,
            }, f, indent=2, default=str)
        print(f"\n✓ Results saved to: {output_path}")
        
        return {"results": results}


if __name__ == "__main__":
    optimizer = ExitOptimizer()
    optimizer.connect()
    optimizer.optimize_all()
    optimizer.disconnect()

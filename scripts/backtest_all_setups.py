"""
Comprehensive Backtesting System for Stratos Brain

This script runs backtests across ALL setups and provides:
1. Optimized parameters for each setup
2. Cross-setup performance comparison and ranking
3. Reliability metrics to identify the best strategies

The goal is to answer: "Which setups work best, and with what parameters?"

Usage:
    python scripts/backtest_all_setups.py --universe crypto_top_100 --start 2022-01-01 --end 2025-12-31

Author: Manus AI
Date: January 25, 2026
"""

import argparse
import itertools
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import structlog

from stratos_engine.db import Database

logger = structlog.get_logger()


# =============================================================================
# SETUP DEFINITIONS WITH PARAMETER GRIDS
# =============================================================================
# Each setup includes:
#   - Base parameters (default values)
#   - Parameter grid (values to test during optimization)
#   - Entry conditions (mathematical rules)
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
        "param_grid": {
            "rsi_threshold": [35, 40, 45, 50],
            "stop_loss_atr_mult": [1.5, 2.0, 2.5],
            "take_profit_r_mult": [2.0, 3.0, 4.0],
        },
        "entry_logic": lambda row, params: (
            row.get("close", 0) > row.get("sma_200", float("inf"))
            and row.get("low", float("inf")) <= row.get("sma_50", 0)
            and row.get("close", 0) >= row.get("sma_50", float("inf"))
            and row.get("rsi_14", 100) < params.get("rsi_threshold", 45)
        ),
    },
    "vcp_squeeze": {
        "description": "Volatility Contraction Pattern - bands tightening",
        "category": "trend_continuation",
        "direction": "long",
        "base_params": {
            "bb_width_pctile_thresh": 0.10,
            "rvol_thresh": 0.7,
            "stop_loss_atr_mult": 2.0,
            "take_profit_r_mult": 3.0,
            "max_hold_days": 30,
        },
        "param_grid": {
            "bb_width_pctile_thresh": [0.05, 0.10, 0.15, 0.20],
            "rvol_thresh": [0.5, 0.7, 0.9],
            "stop_loss_atr_mult": [1.5, 2.0, 2.5],
        },
        "entry_logic": lambda row, params: (
            row.get("close", 0) > row.get("sma_200", float("inf"))
            and row.get("bb_width_pctile", 1.0) < params.get("bb_width_pctile_thresh", 0.10)
            and row.get("rvol_20", 1.0) < params.get("rvol_thresh", 0.7)
        ),
    },
    "standard_breakout": {
        "description": "Price clears resistance on high volume",
        "category": "momentum",
        "direction": "long",
        "base_params": {
            "rvol_thresh": 3.0,
            "rsi_thresh": 65,
            "stop_loss_atr_mult": 1.5,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 10,
        },
        "param_grid": {
            "rvol_thresh": [2.0, 2.5, 3.0, 4.0, 5.0],
            "rsi_thresh": [55, 60, 65, 70],
            "stop_loss_atr_mult": [1.0, 1.5, 2.0],
        },
        "entry_logic": lambda row, params: (
            row.get("breakout_up_20", False) == True
            and row.get("rvol_20", 0) > params.get("rvol_thresh", 3.0)
            and row.get("rsi_14", 0) > params.get("rsi_thresh", 65)
        ),
    },
    "gap_and_go": {
        "description": "Institutional gap-up that holds gains",
        "category": "momentum",
        "direction": "long",
        "base_params": {
            "gap_pct_thresh": 0.05,
            "rvol_thresh": 4.0,
            "candle_close_pct_thresh": 0.7,
            "stop_loss_atr_mult": 1.0,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 5,
        },
        "param_grid": {
            "gap_pct_thresh": [0.03, 0.05, 0.07, 0.10],
            "rvol_thresh": [3.0, 4.0, 5.0],
            "candle_close_pct_thresh": [0.6, 0.7, 0.8],
        },
        "entry_logic": lambda row, params: (
            row.get("gap_pct", 0) > params.get("gap_pct_thresh", 0.05)
            and row.get("rvol_20", 0) > params.get("rvol_thresh", 4.0)
            and row.get("candle_close_pct", 0) > params.get("candle_close_pct_thresh", 0.7)
        ),
    },
    "mean_reversion": {
        "description": "Oversold bounce from extreme levels",
        "category": "reversal",
        "direction": "long",
        "base_params": {
            "ma_dist_thresh": -0.15,
            "rsi_thresh": 30,
            "rvol_thresh": 1.5,
            "stop_loss_atr_mult": 2.0,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 10,
        },
        "param_grid": {
            "ma_dist_thresh": [-0.10, -0.15, -0.20, -0.25],
            "rsi_thresh": [20, 25, 30, 35],
            "rvol_thresh": [1.0, 1.5, 2.0],
        },
        "entry_logic": lambda row, params: (
            row.get("ma_dist_20", 0) < params.get("ma_dist_thresh", -0.15)
            and row.get("rsi_14", 100) < params.get("rsi_thresh", 30)
            and row.get("rvol_20", 0) > params.get("rvol_thresh", 1.5)
        ),
    },
    "double_bottom": {
        "description": "Liquidity trap - sweeps low then reverses",
        "category": "reversal",
        "direction": "long",
        "base_params": {
            "stop_loss_atr_mult": 1.5,
            "take_profit_r_mult": 3.0,
            "max_hold_days": 20,
        },
        "param_grid": {
            "stop_loss_atr_mult": [1.0, 1.5, 2.0, 2.5],
            "take_profit_r_mult": [2.0, 3.0, 4.0],
        },
        "entry_logic": lambda row, params: (
            row.get("swept_prev_low", False) == True
            and row.get("closed_above_prev_low", False) == True
            and row.get("rsi_divergence_bullish", False) == True
        ),
    },
    "parabolic_top": {
        "description": "Blow-off top with rejection (SHORT)",
        "category": "reversal",
        "direction": "short",
        "base_params": {
            "ma_dist_thresh": 0.30,
            "rvol_thresh": 5.0,
            "candle_close_pct_thresh": 0.3,
            "stop_loss_atr_mult": 1.5,
            "take_profit_r_mult": 2.0,
            "max_hold_days": 10,
        },
        "param_grid": {
            "ma_dist_thresh": [0.20, 0.25, 0.30, 0.40],
            "rvol_thresh": [4.0, 5.0, 6.0],
            "candle_close_pct_thresh": [0.2, 0.3, 0.4],
        },
        "entry_logic": lambda row, params: (
            row.get("ma_dist_20", 0) > params.get("ma_dist_thresh", 0.30)
            and row.get("rvol_20", 0) > params.get("rvol_thresh", 5.0)
            and row.get("candle_close_pct", 1.0) < params.get("candle_close_pct_thresh", 0.3)
        ),
    },
}


class ComprehensiveBacktester:
    """
    A comprehensive backtesting system that:
    1. Tests all setups with parameter optimization
    2. Ranks setups by multiple performance metrics
    3. Identifies the most reliable strategies
    """

    def __init__(self):
        self.db = Database()
        self.results_cache = {}

    # =========================================================================
    # DATA LOADING
    # =========================================================================

    def get_assets_in_universe(self, universe: str) -> List[int]:
        """Get all asset IDs in a given universe."""
        parts = universe.split("_")
        asset_type = parts[0]
        limit = int(parts[-1]) if parts[-1].isdigit() else 500

        query = """
        SELECT DISTINCT df.asset_id
        FROM daily_features df
        JOIN assets a ON a.asset_id = df.asset_id
        WHERE a.asset_type = %s
          AND df.date = (SELECT MAX(date) FROM daily_features)
        ORDER BY df.dollar_volume_sma_20 DESC NULLS LAST
        LIMIT %s
        """
        results = self.db.fetch_all(query, (asset_type, limit))
        return [r["asset_id"] for r in results]

    def load_asset_data(self, asset_id: int, start_date: str, end_date: str) -> pd.DataFrame:
        """Load historical data for a single asset with all required features."""
        query = """
        SELECT 
            b.date, b.open, b.high, b.low, b.close, b.volume,
            f.sma_20, f.sma_50, f.sma_200, f.rsi_14, f.atr_14, f.rvol_20,
            f.bb_upper, f.bb_lower, f.bb_width_pctile,
            f.ma_dist_20, f.ma_dist_50, f.ma_dist_200,
            f.breakout_up_20, f.breakout_down_20,
            LAG(b.high, 1) OVER (ORDER BY b.date) as prev_day_high,
            LAG(b.low, 1) OVER (ORDER BY b.date) as prev_day_low,
            MIN(b.low) OVER (ORDER BY b.date ROWS BETWEEN 30 PRECEDING AND 5 PRECEDING) as prev_low_30d,
            LAG(f.rsi_14, 10) OVER (ORDER BY b.date) as prev_rsi_10d
        FROM daily_bars b
        JOIN daily_features f ON b.asset_id = f.asset_id AND b.date = f.date
        WHERE b.asset_id = %s AND b.date BETWEEN %s AND %s
        ORDER BY b.date
        """
        results = self.db.fetch_all(query, (asset_id, start_date, end_date))
        if not results:
            return pd.DataFrame()

        df = pd.DataFrame(results)

        # Calculate derived features
        if "prev_day_high" in df.columns and "open" in df.columns:
            df["gap_pct"] = (df["open"] / df["prev_day_high"].replace(0, np.nan)) - 1

        if all(col in df.columns for col in ["close", "low", "high"]):
            range_val = df["high"] - df["low"]
            df["candle_close_pct"] = (df["close"] - df["low"]) / range_val.replace(0, np.nan)

        if "prev_low_30d" in df.columns:
            df["swept_prev_low"] = df["low"] < df["prev_low_30d"]
            df["closed_above_prev_low"] = df["close"] > df["prev_low_30d"]

        if "prev_rsi_10d" in df.columns and "rsi_14" in df.columns:
            df["rsi_divergence_bullish"] = df["rsi_14"] > df["prev_rsi_10d"]

        return df

    # =========================================================================
    # TRADE SIMULATION
    # =========================================================================

    def simulate_trade(
        self,
        df: pd.DataFrame,
        entry_idx: int,
        entry_price: float,
        atr: float,
        params: Dict,
        direction: str = "long",
    ) -> Optional[Dict]:
        """Simulate a single trade from entry to exit."""
        stop_mult = params.get("stop_loss_atr_mult", 1.5)
        tp_mult = params.get("take_profit_r_mult", 2.0)
        max_days = params.get("max_hold_days", 20)

        risk = atr * stop_mult
        if direction == "long":
            stop_loss = entry_price - risk
            take_profit = entry_price + (risk * tp_mult)
        else:
            stop_loss = entry_price + risk
            take_profit = entry_price - (risk * tp_mult)

        entry_date = str(df.iloc[entry_idx]["date"])

        for i in range(1, max_days + 1):
            if entry_idx + i >= len(df):
                break

            row = df.iloc[entry_idx + i]
            current_date = str(row["date"])
            high, low, close = float(row["high"]), float(row["low"]), float(row["close"])

            if direction == "long":
                if low <= stop_loss:
                    return self._make_trade_result(
                        entry_date, entry_price, current_date, stop_loss,
                        "stop_loss", i, direction
                    )
                if high >= take_profit:
                    return self._make_trade_result(
                        entry_date, entry_price, current_date, take_profit,
                        "take_profit", i, direction
                    )
            else:
                if high >= stop_loss:
                    return self._make_trade_result(
                        entry_date, entry_price, current_date, stop_loss,
                        "stop_loss", i, direction
                    )
                if low <= take_profit:
                    return self._make_trade_result(
                        entry_date, entry_price, current_date, take_profit,
                        "take_profit", i, direction
                    )

        # Time exit
        if entry_idx + max_days < len(df):
            exit_row = df.iloc[entry_idx + max_days]
            return self._make_trade_result(
                entry_date, entry_price, str(exit_row["date"]),
                float(exit_row["close"]), "time_exit", max_days, direction
            )

        return None

    def _make_trade_result(
        self, entry_date, entry_price, exit_date, exit_price,
        exit_reason, holding_period, direction
    ) -> Dict:
        """Create a standardized trade result dictionary."""
        if direction == "long":
            return_pct = (exit_price / entry_price) - 1
        else:
            return_pct = (entry_price / exit_price) - 1

        return {
            "entry_date": entry_date,
            "entry_price": entry_price,
            "exit_date": exit_date,
            "exit_price": exit_price,
            "exit_reason": exit_reason,
            "return_pct": return_pct,
            "holding_period": holding_period,
            "is_winner": return_pct > 0,
        }

    # =========================================================================
    # BACKTEST EXECUTION
    # =========================================================================

    def backtest_setup(
        self,
        setup_name: str,
        asset_ids: List[int],
        start_date: str,
        end_date: str,
        params: Dict,
    ) -> List[Dict]:
        """Run backtest for a single setup with given parameters."""
        setup = MASTER_SETUPS[setup_name]
        entry_logic = setup["entry_logic"]
        direction = setup.get("direction", "long")

        all_trades = []

        for asset_id in asset_ids:
            df = self.load_asset_data(asset_id, start_date, end_date)
            if df.empty or len(df) < 50:
                continue

            # Find entry points
            for idx in range(20, len(df) - params.get("max_hold_days", 20)):
                row = df.iloc[idx].to_dict()

                if entry_logic(row, params):
                    entry_price = float(row["close"])
                    atr = float(row.get("atr_14") or entry_price * 0.02)

                    trade = self.simulate_trade(df, idx, entry_price, atr, params, direction)
                    if trade:
                        trade["asset_id"] = asset_id
                        trade["setup_name"] = setup_name
                        all_trades.append(trade)

        return all_trades

    # =========================================================================
    # METRICS CALCULATION
    # =========================================================================

    def calculate_metrics(self, trades: List[Dict]) -> Dict:
        """Calculate comprehensive performance metrics from trade results."""
        if not trades:
            return self._empty_metrics()

        returns = [t["return_pct"] for t in trades if t.get("return_pct") is not None]
        if not returns:
            return self._empty_metrics()

        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r < 0]

        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 0.0001  # Avoid division by zero

        # Calculate consecutive wins/losses for reliability
        win_streaks, loss_streaks = self._calculate_streaks(trades)

        # Calculate Sharpe and Sortino ratios
        returns_array = np.array(returns)
        sharpe = (np.mean(returns_array) / np.std(returns_array) * np.sqrt(252)) if np.std(returns_array) > 0 else 0
        
        downside_returns = returns_array[returns_array < 0]
        sortino = (np.mean(returns_array) / np.std(downside_returns) * np.sqrt(252)) if len(downside_returns) > 0 and np.std(downside_returns) > 0 else 0

        # Exit reason breakdown
        exit_reasons = {}
        for t in trades:
            reason = t.get("exit_reason", "unknown")
            exit_reasons[reason] = exit_reasons.get(reason, 0) + 1

        return {
            "total_trades": len(trades),
            "win_rate": len(wins) / len(returns),
            "profit_factor": gross_profit / gross_loss,
            "avg_return_pct": np.mean(returns),
            "median_return_pct": np.median(returns),
            "std_return_pct": np.std(returns),
            "sharpe_ratio": sharpe,
            "sortino_ratio": sortino,
            "max_drawdown": self._calculate_max_drawdown(returns),
            "avg_win": np.mean(wins) if wins else 0,
            "avg_loss": np.mean(losses) if losses else 0,
            "win_loss_ratio": (np.mean(wins) / abs(np.mean(losses))) if losses and wins else 0,
            "max_consecutive_wins": max(win_streaks) if win_streaks else 0,
            "max_consecutive_losses": max(loss_streaks) if loss_streaks else 0,
            "avg_holding_period": np.mean([t["holding_period"] for t in trades]),
            "exit_reasons": exit_reasons,
            # Reliability score (composite metric)
            "reliability_score": self._calculate_reliability_score(
                len(wins) / len(returns),
                gross_profit / gross_loss,
                sharpe,
                len(trades)
            ),
        }

    def _empty_metrics(self) -> Dict:
        """Return empty metrics structure."""
        return {
            "total_trades": 0,
            "win_rate": 0,
            "profit_factor": 0,
            "avg_return_pct": 0,
            "reliability_score": 0,
        }

    def _calculate_streaks(self, trades: List[Dict]) -> Tuple[List[int], List[int]]:
        """Calculate winning and losing streaks."""
        win_streaks, loss_streaks = [], []
        current_win, current_loss = 0, 0

        for t in trades:
            if t.get("is_winner"):
                current_win += 1
                if current_loss > 0:
                    loss_streaks.append(current_loss)
                    current_loss = 0
            else:
                current_loss += 1
                if current_win > 0:
                    win_streaks.append(current_win)
                    current_win = 0

        if current_win > 0:
            win_streaks.append(current_win)
        if current_loss > 0:
            loss_streaks.append(current_loss)

        return win_streaks, loss_streaks

    def _calculate_max_drawdown(self, returns: List[float]) -> float:
        """Calculate maximum drawdown."""
        if not returns:
            return 0
        cumulative = np.cumprod([1 + r for r in returns])
        running_max = np.maximum.accumulate(cumulative)
        drawdowns = (cumulative - running_max) / running_max
        return float(np.min(drawdowns))

    def _calculate_reliability_score(
        self, win_rate: float, profit_factor: float, sharpe: float, trade_count: int
    ) -> float:
        """
        Calculate a composite reliability score (0-100).
        
        This score weights:
        - Win rate (30%): Higher is better, target > 55%
        - Profit factor (30%): Higher is better, target > 1.5
        - Sharpe ratio (25%): Higher is better, target > 1.0
        - Sample size (15%): More trades = more reliable
        """
        # Win rate component (0-30 points)
        win_score = min(30, (win_rate / 0.70) * 30)

        # Profit factor component (0-30 points)
        pf_score = min(30, (profit_factor / 2.5) * 30)

        # Sharpe component (0-25 points)
        sharpe_score = min(25, (max(0, sharpe) / 2.0) * 25)

        # Sample size component (0-15 points)
        # 100+ trades = full points
        sample_score = min(15, (trade_count / 100) * 15)

        return win_score + pf_score + sharpe_score + sample_score

    # =========================================================================
    # PARAMETER OPTIMIZATION
    # =========================================================================

    def optimize_setup(
        self,
        setup_name: str,
        asset_ids: List[int],
        start_date: str,
        end_date: str,
    ) -> Tuple[Dict, Dict, List[Dict]]:
        """
        Find optimal parameters for a setup.
        
        Returns:
            Tuple of (best_params, best_metrics, all_results)
        """
        setup = MASTER_SETUPS[setup_name]
        param_grid = setup["param_grid"]
        base_params = setup["base_params"].copy()

        # Generate all parameter combinations
        keys = list(param_grid.keys())
        values = list(param_grid.values())
        combinations = list(itertools.product(*values))

        logger.info(
            "Optimizing setup",
            setup=setup_name,
            combinations=len(combinations),
        )

        all_results = []
        best_score = -1
        best_params = base_params
        best_metrics = {}

        for combo in combinations:
            # Merge with base params
            test_params = base_params.copy()
            for i, key in enumerate(keys):
                test_params[key] = combo[i]

            # Run backtest
            trades = self.backtest_setup(setup_name, asset_ids, start_date, end_date, test_params)
            metrics = self.calculate_metrics(trades)

            result = {
                "params": test_params.copy(),
                "metrics": metrics,
            }
            all_results.append(result)

            # Track best by reliability score
            if metrics.get("reliability_score", 0) > best_score and metrics.get("total_trades", 0) >= 10:
                best_score = metrics["reliability_score"]
                best_params = test_params.copy()
                best_metrics = metrics

        return best_params, best_metrics, all_results

    # =========================================================================
    # CROSS-SETUP COMPARISON
    # =========================================================================

    def run_full_analysis(
        self,
        universe: str,
        start_date: str,
        end_date: str,
    ) -> Dict:
        """
        Run complete analysis across all setups.
        
        Returns a comprehensive report with:
        - Optimized parameters for each setup
        - Performance metrics for each setup
        - Cross-setup ranking
        - Recommendations
        """
        logger.info("Starting full analysis", universe=universe)

        asset_ids = self.get_assets_in_universe(universe)
        logger.info("Loaded assets", count=len(asset_ids))

        setup_results = {}

        for setup_name in MASTER_SETUPS.keys():
            logger.info(f"Analyzing setup: {setup_name}")

            best_params, best_metrics, all_results = self.optimize_setup(
                setup_name, asset_ids, start_date, end_date
            )

            setup_results[setup_name] = {
                "description": MASTER_SETUPS[setup_name]["description"],
                "category": MASTER_SETUPS[setup_name]["category"],
                "direction": MASTER_SETUPS[setup_name].get("direction", "long"),
                "best_params": best_params,
                "best_metrics": best_metrics,
                "optimization_results": all_results,
            }

        # Rank setups by reliability score
        rankings = self._rank_setups(setup_results)

        return {
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "asset_count": len(asset_ids),
            "setup_results": setup_results,
            "rankings": rankings,
            "recommendations": self._generate_recommendations(rankings, setup_results),
        }

    def _rank_setups(self, setup_results: Dict) -> List[Dict]:
        """Rank all setups by reliability score."""
        rankings = []

        for setup_name, data in setup_results.items():
            metrics = data.get("best_metrics", {})
            rankings.append({
                "rank": 0,  # Will be set after sorting
                "setup_name": setup_name,
                "category": data["category"],
                "reliability_score": metrics.get("reliability_score", 0),
                "win_rate": metrics.get("win_rate", 0),
                "profit_factor": metrics.get("profit_factor", 0),
                "sharpe_ratio": metrics.get("sharpe_ratio", 0),
                "total_trades": metrics.get("total_trades", 0),
            })

        # Sort by reliability score
        rankings.sort(key=lambda x: x["reliability_score"], reverse=True)

        # Assign ranks
        for i, r in enumerate(rankings):
            r["rank"] = i + 1

        return rankings

    def _generate_recommendations(self, rankings: List[Dict], setup_results: Dict) -> List[str]:
        """Generate actionable recommendations based on analysis."""
        recommendations = []

        # Top performers
        top_setups = [r for r in rankings if r["reliability_score"] >= 60]
        if top_setups:
            names = [r["setup_name"] for r in top_setups[:3]]
            recommendations.append(
                f"🏆 TOP PERFORMERS: {', '.join(names)} show the highest reliability scores. "
                "Prioritize these setups in the AI scoring system."
            )

        # High win rate setups
        high_wr = [r for r in rankings if r["win_rate"] >= 0.60]
        if high_wr:
            recommendations.append(
                f"✅ HIGH WIN RATE: {', '.join([r['setup_name'] for r in high_wr])} "
                f"achieve 60%+ win rates - ideal for consistent returns."
            )

        # Low sample size warnings
        low_sample = [r for r in rankings if r["total_trades"] < 30]
        if low_sample:
            recommendations.append(
                f"⚠️ LOW SAMPLE SIZE: {', '.join([r['setup_name'] for r in low_sample])} "
                "have fewer than 30 trades. Results may not be statistically significant."
            )

        # Category insights
        categories = {}
        for r in rankings:
            cat = r["category"]
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(r)

        for cat, setups in categories.items():
            avg_score = np.mean([s["reliability_score"] for s in setups])
            recommendations.append(
                f"📊 {cat.upper()}: Average reliability score of {avg_score:.1f}. "
                f"Best: {setups[0]['setup_name']} ({setups[0]['reliability_score']:.1f})"
            )

        return recommendations

    # =========================================================================
    # REPORTING
    # =========================================================================

    def print_report(self, analysis: Dict):
        """Print a comprehensive analysis report."""
        print("\n" + "=" * 80)
        print("STRATOS BRAIN - COMPREHENSIVE BACKTEST ANALYSIS")
        print("=" * 80)
        print(f"Universe: {analysis['universe']}")
        print(f"Period: {analysis['start_date']} to {analysis['end_date']}")
        print(f"Assets Tested: {analysis['asset_count']}")
        print("=" * 80)

        # Rankings table
        print("\n📊 SETUP RANKINGS (by Reliability Score)")
        print("-" * 80)
        print(f"{'Rank':<6}{'Setup':<20}{'Category':<18}{'Score':<10}{'Win%':<10}{'PF':<8}{'Trades':<8}")
        print("-" * 80)

        for r in analysis["rankings"]:
            print(
                f"{r['rank']:<6}"
                f"{r['setup_name']:<20}"
                f"{r['category']:<18}"
                f"{r['reliability_score']:<10.1f}"
                f"{r['win_rate']*100:<10.1f}"
                f"{r['profit_factor']:<8.2f}"
                f"{r['total_trades']:<8}"
            )

        # Detailed results for each setup
        print("\n" + "=" * 80)
        print("DETAILED SETUP ANALYSIS")
        print("=" * 80)

        for setup_name, data in analysis["setup_results"].items():
            metrics = data["best_metrics"]
            params = data["best_params"]

            print(f"\n{'─' * 40}")
            print(f"📈 {setup_name.upper()}")
            print(f"   {data['description']}")
            print(f"{'─' * 40}")

            print("\n   OPTIMAL PARAMETERS:")
            for k, v in params.items():
                print(f"      {k}: {v}")

            print("\n   PERFORMANCE METRICS:")
            print(f"      Total Trades:     {metrics.get('total_trades', 0)}")
            print(f"      Win Rate:         {metrics.get('win_rate', 0)*100:.1f}%")
            print(f"      Profit Factor:    {metrics.get('profit_factor', 0):.2f}")
            print(f"      Sharpe Ratio:     {metrics.get('sharpe_ratio', 0):.2f}")
            print(f"      Sortino Ratio:    {metrics.get('sortino_ratio', 0):.2f}")
            print(f"      Avg Return:       {metrics.get('avg_return_pct', 0)*100:.2f}%")
            print(f"      Max Drawdown:     {metrics.get('max_drawdown', 0)*100:.2f}%")
            print(f"      Avg Win:          {metrics.get('avg_win', 0)*100:.2f}%")
            print(f"      Avg Loss:         {metrics.get('avg_loss', 0)*100:.2f}%")
            print(f"      Reliability:      {metrics.get('reliability_score', 0):.1f}/100")

            if metrics.get("exit_reasons"):
                print("\n   EXIT REASONS:")
                for reason, count in metrics["exit_reasons"].items():
                    pct = count / metrics["total_trades"] * 100 if metrics["total_trades"] > 0 else 0
                    print(f"      {reason}: {count} ({pct:.1f}%)")

        # Recommendations
        print("\n" + "=" * 80)
        print("💡 RECOMMENDATIONS")
        print("=" * 80)
        for rec in analysis.get("recommendations", []):
            print(f"\n{rec}")

        print("\n" + "=" * 80)

    def save_results(self, analysis: Dict, output_path: str):
        """Save analysis results to JSON file."""
        # Convert numpy types to native Python types
        def convert(obj):
            if isinstance(obj, np.integer):
                return int(obj)
            elif isinstance(obj, np.floating):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {k: convert(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert(i) for i in obj]
            return obj

        with open(output_path, "w") as f:
            json.dump(convert(analysis), f, indent=2, default=str)

        logger.info("Results saved", path=output_path)


def main():
    parser = argparse.ArgumentParser(
        description="Run comprehensive backtest analysis across all setups"
    )
    parser.add_argument(
        "--universe", default="crypto_top_100",
        help="Asset universe (e.g., crypto_top_100, equity_sp500)"
    )
    parser.add_argument("--start", default="2022-01-01", help="Start date")
    parser.add_argument("--end", default="2025-12-31", help="End date")
    parser.add_argument("--output", default=None, help="Output JSON file path")

    args = parser.parse_args()

    backtester = ComprehensiveBacktester()
    analysis = backtester.run_full_analysis(
        universe=args.universe,
        start_date=args.start,
        end_date=args.end,
    )

    backtester.print_report(analysis)

    if args.output:
        backtester.save_results(analysis, args.output)
    else:
        # Default output path
        output_path = f"/home/ubuntu/stratos_brain/data/backtest_results_{args.universe}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        backtester.save_results(analysis, output_path)


if __name__ == "__main__":
    main()

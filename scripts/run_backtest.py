"""
Scalable Backtesting System for Stratos Brain

This script implements a modular, database-centric backtesting engine
that processes assets one at a time to maintain a constant memory footprint.

Usage:
    python scripts/run_backtest.py --setup pullback_ma50 --universe crypto_top_100 \
        --start 2022-01-01 --end 2025-12-31

Author: Manus AI
Date: January 25, 2026
"""

import argparse
import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import structlog
import yaml

from stratos_engine.db import Database

logger = structlog.get_logger()

# Default paths
SETUP_TEMPLATES_PATH = Path(__file__).parent.parent / "config" / "backtest_setups.yaml"


class SetupDefinitionStore:
    """Loads and manages setup definitions from YAML files."""

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or SETUP_TEMPLATES_PATH
        self.setups = {}
        self._load_setups()

    def _load_setups(self):
        """Load all setup definitions from the YAML file."""
        if not self.config_path.exists():
            logger.warning("Setup config file not found, using defaults", path=str(self.config_path))
            self.setups = self._get_default_setups()
            return

        with open(self.config_path, "r") as f:
            config = yaml.safe_load(f)
            for setup in config.get("setups", []):
                self.setups[setup["name"]] = setup

    def _get_default_setups(self) -> Dict[str, Dict]:
        """Return default setup definitions (the 7 Master Setups)."""
        return {
            "pullback_ma50": {
                "name": "pullback_ma50",
                "description": "Pullback to 50-day MA in a strong uptrend",
                "parameters": {
                    "strong_trend_ma": "sma_200",
                    "pullback_ma": "sma_50",
                    "rsi_threshold": 45,
                    "stop_loss_atr_multiplier": 1.5,
                    "take_profit_r_multiple": 3.0,
                    "max_holding_days": 20,
                },
                "entry_conditions": {
                    "all": [
                        {"feature": "close", "op": ">", "value_feature": "sma_200"},
                        {"feature": "low", "op": "<=", "value_feature": "sma_50"},
                        {"feature": "close", "op": ">=", "value_feature": "sma_50"},
                        {"feature": "rsi_14", "op": "<", "value": 45},
                    ]
                },
            },
            "vcp_squeeze": {
                "name": "vcp_squeeze",
                "description": "Volatility Contraction Pattern (VCP) squeeze",
                "parameters": {
                    "bb_width_percentile": 0.1,
                    "rvol_threshold": 0.7,
                    "stop_loss_atr_multiplier": 2.0,
                    "take_profit_r_multiple": 3.0,
                    "max_holding_days": 30,
                },
                "entry_conditions": {
                    "all": [
                        {"feature": "close", "op": ">", "value_feature": "sma_200"},
                        {"feature": "bb_width_pctile", "op": "<", "value": 0.1},
                        {"feature": "rvol_20", "op": "<", "value": 0.7},
                    ]
                },
            },
            "standard_breakout": {
                "name": "standard_breakout",
                "description": "Price clears 60-day high on high volume",
                "parameters": {
                    "rvol_threshold": 3.0,
                    "rsi_threshold": 65,
                    "stop_loss_atr_multiplier": 1.5,
                    "take_profit_r_multiple": 2.0,
                    "max_holding_days": 10,
                },
                "entry_conditions": {
                    "all": [
                        {"feature": "breakout_up_20", "op": "==", "value": True},
                        {"feature": "rvol_20", "op": ">", "value": 3.0},
                        {"feature": "rsi_14", "op": ">", "value": 65},
                    ]
                },
            },
            "gap_and_go": {
                "name": "gap_and_go",
                "description": "Institutional gap-up that holds",
                "parameters": {
                    "gap_pct_threshold": 0.05,
                    "rvol_threshold": 4.0,
                    "candle_close_pct_threshold": 0.7,
                    "stop_loss_atr_multiplier": 1.0,
                    "take_profit_r_multiple": 2.0,
                    "max_holding_days": 5,
                },
                "entry_conditions": {
                    "all": [
                        {"feature": "gap_pct", "op": ">", "value": 0.05},
                        {"feature": "rvol_20", "op": ">", "value": 4.0},
                        {"feature": "candle_close_pct", "op": ">", "value": 0.7},
                    ]
                },
            },
            "mean_reversion": {
                "name": "mean_reversion",
                "description": "Oversold bounce from extreme levels",
                "parameters": {
                    "dist_from_ma_threshold": -0.15,
                    "rsi_threshold": 30,
                    "rvol_threshold": 1.5,
                    "stop_loss_atr_multiplier": 2.0,
                    "take_profit_r_multiple": 2.0,
                    "max_holding_days": 10,
                },
                "entry_conditions": {
                    "all": [
                        {"feature": "ma_dist_20", "op": "<", "value": -0.15},
                        {"feature": "rsi_14", "op": "<", "value": 30},
                        {"feature": "rvol_20", "op": ">", "value": 1.5},
                    ]
                },
            },
            "double_bottom": {
                "name": "double_bottom",
                "description": "Liquidity trap - sweeps low then reverses",
                "parameters": {
                    "stop_loss_atr_multiplier": 1.5,
                    "take_profit_r_multiple": 3.0,
                    "max_holding_days": 20,
                },
                "entry_conditions": {
                    "all": [
                        {"feature": "swept_prev_low", "op": "==", "value": True},
                        {"feature": "closed_above_prev_low", "op": "==", "value": True},
                        {"feature": "rsi_divergence_bullish", "op": "==", "value": True},
                    ]
                },
            },
            "parabolic_top": {
                "name": "parabolic_top",
                "description": "Blow-off top (short setup)",
                "parameters": {
                    "dist_from_ma_threshold": 0.30,
                    "rvol_threshold": 5.0,
                    "candle_close_pct_threshold": 0.3,
                    "stop_loss_atr_multiplier": 1.5,
                    "take_profit_r_multiple": 2.0,
                    "max_holding_days": 10,
                },
                "entry_conditions": {
                    "all": [
                        {"feature": "ma_dist_20", "op": ">", "value": 0.30},
                        {"feature": "rvol_20", "op": ">", "value": 5.0},
                        {"feature": "candle_close_pct", "op": "<", "value": 0.3},
                    ]
                },
                "direction": "short",
            },
        }

    def get_setup(self, name: str, params_override: Optional[Dict] = None) -> Dict:
        """Get a setup definition, optionally overriding parameters."""
        if name not in self.setups:
            raise ValueError(f"Setup '{name}' not found. Available: {list(self.setups.keys())}")

        setup = self.setups[name].copy()
        if params_override:
            setup["parameters"] = {**setup.get("parameters", {}), **params_override}
        return setup


class DataProvider:
    """Provides historical data for backtesting, one asset at a time."""

    def __init__(self, db: Database):
        self.db = db

    def get_assets_in_universe(self, universe: str) -> List[int]:
        """Get all asset IDs in a given universe."""
        # Parse universe string (e.g., "crypto_top_100", "equity_sp500")
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

    def get_historical_data(
        self, asset_id: int, start_date: str, end_date: str
    ) -> pd.DataFrame:
        """Fetch historical data for a single asset."""
        query = """
        SELECT 
            b.date, b.open, b.high, b.low, b.close, b.volume,
            f.sma_20, f.sma_50, f.sma_200, f.rsi_14, f.atr_14, f.rvol_20,
            f.bb_upper, f.bb_lower, f.bb_width_pctile,
            f.ma_dist_20, f.ma_dist_50, f.ma_dist_200,
            f.breakout_up_20, f.breakout_down_20,
            LAG(b.high, 1) OVER (ORDER BY b.date) as prev_day_high,
            LAG(b.low, 1) OVER (ORDER BY b.date) as prev_day_low,
            MAX(b.high) OVER (ORDER BY b.date ROWS BETWEEN 60 PRECEDING AND 1 PRECEDING) as prev_high_60d,
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

        # Calculate derived features needed for some setups
        if "prev_day_high" in df.columns and "open" in df.columns:
            df["gap_pct"] = (df["open"] / df["prev_day_high"]) - 1

        if all(col in df.columns for col in ["close", "low", "high"]):
            df["candle_close_pct"] = (df["close"] - df["low"]) / (
                df["high"] - df["low"] + 1e-9
            )

        # Double bottom features
        if "prev_low_30d" in df.columns:
            df["swept_prev_low"] = df["low"] < df["prev_low_30d"]
            df["closed_above_prev_low"] = df["close"] > df["prev_low_30d"]

        if "prev_rsi_10d" in df.columns and "rsi_14" in df.columns:
            df["rsi_divergence_bullish"] = df["rsi_14"] > df["prev_rsi_10d"]

        return df


class SetupIdentificationEngine:
    """Identifies setup entry points in historical data."""

    def __init__(self):
        pass

    def _evaluate_condition(self, row: pd.Series, condition: Dict) -> bool:
        """Evaluate a single condition against a data row."""
        feature = condition.get("feature")
        op = condition.get("op")
        value = condition.get("value")
        value_feature = condition.get("value_feature")

        feat_val = row.get(feature)
        if feat_val is None or (isinstance(feat_val, float) and np.isnan(feat_val)):
            return False

        # Get comparison value
        if value_feature:
            comp_val = row.get(value_feature)
            if comp_val is None or (isinstance(comp_val, float) and np.isnan(comp_val)):
                return False
        else:
            comp_val = value

        # Evaluate operator
        try:
            if op == "==":
                return feat_val == comp_val
            elif op == "!=":
                return feat_val != comp_val
            elif op == ">":
                return float(feat_val) > float(comp_val)
            elif op == ">=":
                return float(feat_val) >= float(comp_val)
            elif op == "<":
                return float(feat_val) < float(comp_val)
            elif op == "<=":
                return float(feat_val) <= float(comp_val)
        except (ValueError, TypeError):
            return False

        return False

    def _evaluate_gate(self, row: pd.Series, gate: Dict) -> bool:
        """Evaluate a gate (all/any logic) against a data row."""
        if "all" in gate:
            return all(self._evaluate_gate(row, item) for item in gate["all"])
        elif "any" in gate:
            return any(self._evaluate_gate(row, item) for item in gate["any"])
        else:
            return self._evaluate_condition(row, gate)

    def identify_entries(
        self, df: pd.DataFrame, setup: Dict
    ) -> List[Tuple[str, float, float]]:
        """
        Identify all entry points for a setup in the given data.

        Returns:
            List of tuples: (entry_date, entry_price, atr_at_entry)
        """
        entry_conditions = setup.get("entry_conditions", {})
        entries = []

        for idx, row in df.iterrows():
            if self._evaluate_gate(row, entry_conditions):
                entry_date = str(row["date"])
                entry_price = float(row["close"])
                atr = float(row["atr_14"]) if row.get("atr_14") else entry_price * 0.02
                entries.append((entry_date, entry_price, atr))

        return entries


class TradeExecutionSimulator:
    """Simulates trade execution with stop-loss and take-profit logic."""

    def __init__(self):
        pass

    def simulate_trade(
        self,
        df: pd.DataFrame,
        entry_date: str,
        entry_price: float,
        atr: float,
        setup: Dict,
    ) -> Optional[Dict]:
        """
        Simulate a single trade from entry to exit.

        Returns:
            Trade result dictionary or None if simulation fails.
        """
        params = setup.get("parameters", {})
        direction = setup.get("direction", "long")

        stop_loss_mult = params.get("stop_loss_atr_multiplier", 1.5)
        take_profit_mult = params.get("take_profit_r_multiple", 2.0)
        max_holding_days = params.get("max_holding_days", 20)

        # Calculate stop loss and take profit levels
        risk = atr * stop_loss_mult
        if direction == "long":
            stop_loss = entry_price - risk
            take_profit = entry_price + (risk * take_profit_mult)
        else:  # short
            stop_loss = entry_price + risk
            take_profit = entry_price - (risk * take_profit_mult)

        # Find the entry date index
        entry_idx = df[df["date"].astype(str) == entry_date].index
        if len(entry_idx) == 0:
            return None
        entry_idx = entry_idx[0]

        # Simulate day by day
        for i in range(1, max_holding_days + 1):
            if entry_idx + i >= len(df):
                break

            row = df.iloc[entry_idx + i]
            current_date = str(row["date"])
            high = float(row["high"])
            low = float(row["low"])
            close = float(row["close"])

            if direction == "long":
                # Check stop loss first (conservative)
                if low <= stop_loss:
                    return {
                        "entry_date": entry_date,
                        "entry_price": entry_price,
                        "exit_date": current_date,
                        "exit_price": stop_loss,
                        "exit_reason": "stop_loss",
                        "return_pct": (stop_loss / entry_price) - 1,
                        "holding_period": i,
                    }
                # Check take profit
                if high >= take_profit:
                    return {
                        "entry_date": entry_date,
                        "entry_price": entry_price,
                        "exit_date": current_date,
                        "exit_price": take_profit,
                        "exit_reason": "take_profit",
                        "return_pct": (take_profit / entry_price) - 1,
                        "holding_period": i,
                    }
            else:  # short
                # Check stop loss first
                if high >= stop_loss:
                    return {
                        "entry_date": entry_date,
                        "entry_price": entry_price,
                        "exit_date": current_date,
                        "exit_price": stop_loss,
                        "exit_reason": "stop_loss",
                        "return_pct": (entry_price / stop_loss) - 1,
                        "holding_period": i,
                    }
                # Check take profit
                if low <= take_profit:
                    return {
                        "entry_date": entry_date,
                        "entry_price": entry_price,
                        "exit_date": current_date,
                        "exit_price": take_profit,
                        "exit_reason": "take_profit",
                        "return_pct": (entry_price / take_profit) - 1,
                        "holding_period": i,
                    }

        # Time-based exit
        if entry_idx + max_holding_days < len(df):
            exit_row = df.iloc[entry_idx + max_holding_days]
            exit_price = float(exit_row["close"])
            if direction == "long":
                return_pct = (exit_price / entry_price) - 1
            else:
                return_pct = (entry_price / exit_price) - 1

            return {
                "entry_date": entry_date,
                "entry_price": entry_price,
                "exit_date": str(exit_row["date"]),
                "exit_price": exit_price,
                "exit_reason": "time_exit",
                "return_pct": return_pct,
                "holding_period": max_holding_days,
            }

        return None


class BacktestResultsStore:
    """Stores backtesting results in the database."""

    def __init__(self, db: Database):
        self.db = db

    def create_run(
        self,
        setup_name: str,
        universe: str,
        start_date: str,
        end_date: str,
        parameters: Dict,
    ) -> str:
        """Create a new backtest run record."""
        run_id = str(uuid.uuid4())
        query = """
        INSERT INTO backtest_runs (run_id, setup_name, asset_universe, start_date, end_date, parameters)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING
        """
        self.db.execute(
            query, (run_id, setup_name, universe, start_date, end_date, json.dumps(parameters))
        )
        return run_id

    def save_trades(self, run_id: str, asset_id: int, trades: List[Dict]):
        """Save trade results to the database."""
        if not trades:
            return

        for trade in trades:
            query = """
            INSERT INTO backtest_trades 
                (run_id, asset_id, entry_date, entry_price, exit_date, exit_price, 
                 exit_reason, return_pct, holding_period)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            """
            self.db.execute(
                query,
                (
                    run_id,
                    asset_id,
                    trade["entry_date"],
                    trade["entry_price"],
                    trade.get("exit_date"),
                    trade.get("exit_price"),
                    trade.get("exit_reason"),
                    trade.get("return_pct"),
                    trade.get("holding_period"),
                ),
            )

    def save_summary_metrics(self, run_id: str, metrics: Dict):
        """Save summary metrics for a backtest run."""
        query = """
        INSERT INTO backtest_summary_metrics 
            (run_id, total_trades, win_rate, profit_factor, avg_return_pct, sharpe_ratio, max_drawdown)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (run_id) DO UPDATE SET
            total_trades = EXCLUDED.total_trades,
            win_rate = EXCLUDED.win_rate,
            profit_factor = EXCLUDED.profit_factor,
            avg_return_pct = EXCLUDED.avg_return_pct,
            sharpe_ratio = EXCLUDED.sharpe_ratio,
            max_drawdown = EXCLUDED.max_drawdown
        """
        self.db.execute(
            query,
            (
                run_id,
                metrics.get("total_trades", 0),
                metrics.get("win_rate"),
                metrics.get("profit_factor"),
                metrics.get("avg_return_pct"),
                metrics.get("sharpe_ratio"),
                metrics.get("max_drawdown"),
            ),
        )


class ScalableBacktester:
    """Main backtesting orchestrator."""

    def __init__(self):
        self.db = Database()
        self.setup_store = SetupDefinitionStore()
        self.data_provider = DataProvider(self.db)
        self.identification_engine = SetupIdentificationEngine()
        self.execution_simulator = TradeExecutionSimulator()
        self.results_store = BacktestResultsStore(self.db)

    def run(
        self,
        setup_name: str,
        universe: str,
        start_date: str,
        end_date: str,
        params_override: Optional[Dict] = None,
        save_to_db: bool = False,
    ) -> Dict:
        """
        Run a backtest for a given setup and universe.

        Args:
            setup_name: Name of the setup to test
            universe: Asset universe (e.g., "crypto_top_100")
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            params_override: Optional parameter overrides
            save_to_db: Whether to save results to the database

        Returns:
            Dictionary containing backtest results and metrics
        """
        logger.info(
            "Starting backtest",
            setup=setup_name,
            universe=universe,
            start=start_date,
            end=end_date,
        )

        # Load setup definition
        setup = self.setup_store.get_setup(setup_name, params_override)
        parameters = setup.get("parameters", {})

        # Create run record if saving to DB
        run_id = None
        if save_to_db:
            run_id = self.results_store.create_run(
                setup_name, universe, start_date, end_date, parameters
            )

        # Get assets in universe
        asset_ids = self.data_provider.get_assets_in_universe(universe)
        logger.info("Found assets in universe", count=len(asset_ids))

        all_trades = []

        # Process each asset
        for i, asset_id in enumerate(asset_ids):
            if (i + 1) % 50 == 0:
                logger.info("Processing assets", progress=f"{i+1}/{len(asset_ids)}")

            # Fetch historical data
            df = self.data_provider.get_historical_data(asset_id, start_date, end_date)
            if df.empty:
                continue

            # Identify entry points
            entries = self.identification_engine.identify_entries(df, setup)

            # Simulate trades
            asset_trades = []
            for entry_date, entry_price, atr in entries:
                trade = self.execution_simulator.simulate_trade(
                    df, entry_date, entry_price, atr, setup
                )
                if trade:
                    trade["asset_id"] = asset_id
                    asset_trades.append(trade)

            all_trades.extend(asset_trades)

            # Save trades to DB if enabled
            if save_to_db and run_id:
                self.results_store.save_trades(run_id, asset_id, asset_trades)

        # Calculate summary metrics
        metrics = self._calculate_metrics(all_trades)

        # Save summary metrics if enabled
        if save_to_db and run_id:
            self.results_store.save_summary_metrics(run_id, metrics)

        # Print results
        self._print_results(setup_name, metrics, all_trades)

        return {
            "run_id": run_id,
            "setup_name": setup_name,
            "universe": universe,
            "parameters": parameters,
            "metrics": metrics,
            "trades": all_trades,
        }

    def _calculate_metrics(self, trades: List[Dict]) -> Dict:
        """Calculate summary metrics from trade results."""
        if not trades:
            return {
                "total_trades": 0,
                "win_rate": None,
                "profit_factor": None,
                "avg_return_pct": None,
                "sharpe_ratio": None,
                "max_drawdown": None,
            }

        returns = [t["return_pct"] for t in trades if t.get("return_pct") is not None]
        if not returns:
            return {"total_trades": len(trades)}

        wins = [r for r in returns if r > 0]
        losses = [r for r in returns if r < 0]

        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 0

        return {
            "total_trades": len(trades),
            "win_rate": len(wins) / len(returns) if returns else None,
            "profit_factor": gross_profit / gross_loss if gross_loss > 0 else None,
            "avg_return_pct": np.mean(returns) if returns else None,
            "sharpe_ratio": (np.mean(returns) / np.std(returns) * np.sqrt(252))
            if len(returns) > 1 and np.std(returns) > 0
            else None,
            "max_drawdown": self._calculate_max_drawdown(returns),
        }

    def _calculate_max_drawdown(self, returns: List[float]) -> Optional[float]:
        """Calculate maximum drawdown from a series of returns."""
        if not returns:
            return None

        cumulative = np.cumprod([1 + r for r in returns])
        running_max = np.maximum.accumulate(cumulative)
        drawdowns = (cumulative - running_max) / running_max
        return float(np.min(drawdowns))

    def _print_results(self, setup_name: str, metrics: Dict, trades: List[Dict]):
        """Print backtest results to console."""
        print(f"\n{'='*60}")
        print(f"BACKTEST RESULTS: {setup_name.upper()}")
        print(f"{'='*60}")
        print(f"Total Trades:    {metrics.get('total_trades', 0)}")

        if metrics.get("win_rate") is not None:
            print(f"Win Rate:        {metrics['win_rate']:.1%}")
        if metrics.get("profit_factor") is not None:
            print(f"Profit Factor:   {metrics['profit_factor']:.2f}")
        if metrics.get("avg_return_pct") is not None:
            print(f"Avg Return:      {metrics['avg_return_pct']:.2%}")
        if metrics.get("sharpe_ratio") is not None:
            print(f"Sharpe Ratio:    {metrics['sharpe_ratio']:.2f}")
        if metrics.get("max_drawdown") is not None:
            print(f"Max Drawdown:    {metrics['max_drawdown']:.2%}")

        # Exit reason breakdown
        if trades:
            exit_reasons = {}
            for t in trades:
                reason = t.get("exit_reason", "unknown")
                exit_reasons[reason] = exit_reasons.get(reason, 0) + 1

            print(f"\nExit Reasons:")
            for reason, count in sorted(exit_reasons.items()):
                print(f"  {reason}: {count} ({count/len(trades):.1%})")

        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Run a backtest for a trading setup")
    parser.add_argument("--setup", required=True, help="Setup name to test")
    parser.add_argument(
        "--universe", default="crypto_top_100", help="Asset universe (e.g., crypto_top_100)"
    )
    parser.add_argument("--start", default="2022-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", default="2025-12-31", help="End date (YYYY-MM-DD)")
    parser.add_argument("--save", action="store_true", help="Save results to database")

    args = parser.parse_args()

    backtester = ScalableBacktester()
    backtester.run(
        setup_name=args.setup,
        universe=args.universe,
        start_date=args.start,
        end_date=args.end,
        save_to_db=args.save,
    )


if __name__ == "__main__":
    main()

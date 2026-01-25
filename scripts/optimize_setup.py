"""
Parameter Optimization Script for Stratos Brain Backtesting System

This script performs a grid search over setup parameters to find the
optimal configuration for each trading setup.

Usage:
    python scripts/optimize_setup.py --setup pullback_ma50 --universe crypto_top_100

Author: Manus AI
Date: January 25, 2026
"""

import argparse
import itertools
from datetime import datetime
from typing import Any, Dict, List

import pandas as pd
import structlog

from run_backtest import ScalableBacktester

logger = structlog.get_logger()


# Parameter grids for each setup
PARAMETER_GRIDS = {
    "pullback_ma50": {
        "rsi_threshold": [35, 40, 45, 50],
        "stop_loss_atr_multiplier": [1.5, 2.0, 2.5],
        "take_profit_r_multiple": [2.0, 3.0, 4.0],
    },
    "vcp_squeeze": {
        "bb_width_percentile_threshold": [0.05, 0.10, 0.15],
        "rvol_threshold": [0.5, 0.7, 0.9],
        "stop_loss_atr_multiplier": [1.5, 2.0, 2.5],
    },
    "standard_breakout": {
        "rvol_threshold": [2.0, 3.0, 4.0, 5.0],
        "rsi_threshold": [60, 65, 70],
        "stop_loss_atr_multiplier": [1.0, 1.5, 2.0],
    },
    "gap_and_go": {
        "gap_pct_threshold": [0.03, 0.05, 0.07],
        "rvol_threshold": [3.0, 4.0, 5.0],
        "candle_close_pct_threshold": [0.6, 0.7, 0.8],
    },
    "mean_reversion": {
        "dist_from_ma_threshold": [-0.10, -0.15, -0.20, -0.25],
        "rsi_threshold": [25, 30, 35],
        "rvol_threshold": [1.0, 1.5, 2.0],
    },
    "double_bottom": {
        "stop_loss_atr_multiplier": [1.0, 1.5, 2.0],
        "take_profit_r_multiple": [2.0, 3.0, 4.0],
    },
    "parabolic_top": {
        "dist_from_ma_threshold": [0.20, 0.30, 0.40],
        "rvol_threshold": [4.0, 5.0, 6.0],
        "candle_close_pct_threshold": [0.2, 0.3, 0.4],
    },
}


def generate_param_combinations(param_grid: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
    """Generate all combinations of parameters from a grid."""
    keys = param_grid.keys()
    values = param_grid.values()
    combinations = list(itertools.product(*values))
    return [dict(zip(keys, combo)) for combo in combinations]


def run_optimization(
    setup_name: str,
    universe: str,
    start_date: str,
    end_date: str,
    param_grid: Dict[str, List[Any]],
) -> pd.DataFrame:
    """
    Run a grid search optimization for a given setup.

    Returns:
        DataFrame with results for each parameter combination.
    """
    backtester = ScalableBacktester()
    param_combinations = generate_param_combinations(param_grid)

    logger.info(
        "Starting optimization",
        setup=setup_name,
        total_combinations=len(param_combinations),
    )

    results = []

    for i, params in enumerate(param_combinations):
        logger.info(
            "Running combination",
            progress=f"{i+1}/{len(param_combinations)}",
            params=params,
        )

        try:
            result = backtester.run(
                setup_name=setup_name,
                universe=universe,
                start_date=start_date,
                end_date=end_date,
                params_override=params,
                save_to_db=False,  # Don't save intermediate results
            )

            metrics = result.get("metrics", {})
            results.append(
                {
                    **params,
                    "total_trades": metrics.get("total_trades", 0),
                    "win_rate": metrics.get("win_rate"),
                    "profit_factor": metrics.get("profit_factor"),
                    "avg_return_pct": metrics.get("avg_return_pct"),
                    "sharpe_ratio": metrics.get("sharpe_ratio"),
                    "max_drawdown": metrics.get("max_drawdown"),
                }
            )
        except Exception as e:
            logger.error("Error running combination", params=params, error=str(e))
            continue

    return pd.DataFrame(results)


def print_optimization_results(df: pd.DataFrame, setup_name: str):
    """Print optimization results in a formatted table."""
    if df.empty:
        print(f"\nNo results for {setup_name}")
        return

    print(f"\n{'='*80}")
    print(f"OPTIMIZATION RESULTS: {setup_name.upper()}")
    print(f"{'='*80}")

    # Sort by win rate (or another metric)
    df_sorted = df.sort_values("win_rate", ascending=False)

    # Filter to only show results with meaningful trade counts
    df_filtered = df_sorted[df_sorted["total_trades"] >= 10]

    if df_filtered.empty:
        print("No combinations with >= 10 trades found.")
        df_filtered = df_sorted.head(10)

    # Format numeric columns
    for col in ["win_rate", "avg_return_pct", "max_drawdown"]:
        if col in df_filtered.columns:
            df_filtered[col] = df_filtered[col].apply(
                lambda x: f"{x:.1%}" if pd.notna(x) else "N/A"
            )

    for col in ["profit_factor", "sharpe_ratio"]:
        if col in df_filtered.columns:
            df_filtered[col] = df_filtered[col].apply(
                lambda x: f"{x:.2f}" if pd.notna(x) else "N/A"
            )

    print("\nTop 10 Parameter Combinations (by Win Rate):")
    print(df_filtered.head(10).to_string(index=False))

    # Print best overall configuration
    print(f"\n{'='*80}")
    print("BEST CONFIGURATION:")
    print(f"{'='*80}")
    best = df_sorted.iloc[0]
    param_cols = [c for c in df_sorted.columns if c not in [
        "total_trades", "win_rate", "profit_factor", 
        "avg_return_pct", "sharpe_ratio", "max_drawdown"
    ]]
    for col in param_cols:
        print(f"  {col}: {best[col]}")
    print(f"\n  Win Rate: {best['win_rate']:.1%}" if pd.notna(best['win_rate']) else "  Win Rate: N/A")
    print(f"  Profit Factor: {best['profit_factor']:.2f}" if pd.notna(best['profit_factor']) else "  Profit Factor: N/A")
    print(f"  Sharpe Ratio: {best['sharpe_ratio']:.2f}" if pd.notna(best['sharpe_ratio']) else "  Sharpe Ratio: N/A")


def main():
    parser = argparse.ArgumentParser(description="Optimize parameters for a trading setup")
    parser.add_argument("--setup", required=True, help="Setup name to optimize")
    parser.add_argument(
        "--universe", default="crypto_top_100", help="Asset universe"
    )
    parser.add_argument("--start", default="2022-01-01", help="Start date")
    parser.add_argument("--end", default="2025-12-31", help="End date")
    parser.add_argument(
        "--output", default=None, help="Output CSV file for results"
    )

    args = parser.parse_args()

    # Get parameter grid for this setup
    if args.setup not in PARAMETER_GRIDS:
        print(f"No parameter grid defined for setup '{args.setup}'")
        print(f"Available setups: {list(PARAMETER_GRIDS.keys())}")
        return

    param_grid = PARAMETER_GRIDS[args.setup]

    # Run optimization
    results_df = run_optimization(
        setup_name=args.setup,
        universe=args.universe,
        start_date=args.start,
        end_date=args.end,
        param_grid=param_grid,
    )

    # Print results
    print_optimization_results(results_df, args.setup)

    # Save to CSV if requested
    if args.output:
        results_df.to_csv(args.output, index=False)
        print(f"\nResults saved to {args.output}")


if __name__ == "__main__":
    main()

"""
Parameter Optimization via Grid Search
======================================

Runs grid search optimization for each setup to find optimal parameters.
"""

import json
import itertools
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

from production_backtester import ProductionBacktester, MASTER_SETUPS


# Parameter grids for each setup
PARAMETER_GRIDS = {
    "mean_reversion": {
        "ma_dist_thresh": [-0.08, -0.10, -0.12, -0.15, -0.18],
        "rsi_thresh": [25, 30, 35, 40],
        "stop_loss_atr_mult": [1.5, 2.0, 2.5],
        "take_profit_r_mult": [1.5, 2.0, 2.5, 3.0],
        "max_hold_days": [5, 10, 15],
    },
    "pullback_ma50": {
        "rsi_threshold": [35, 40, 45, 50, 55],
        "stop_loss_atr_mult": [1.0, 1.5, 2.0, 2.5],
        "take_profit_r_mult": [2.0, 2.5, 3.0, 4.0],
        "max_hold_days": [10, 15, 20, 30],
    },
    "standard_breakout": {
        "rvol_thresh": [1.5, 2.0, 2.5, 3.0],
        "rsi_thresh": [55, 60, 65, 70],
        "stop_loss_atr_mult": [1.0, 1.5, 2.0],
        "take_profit_r_mult": [1.5, 2.0, 2.5, 3.0],
        "max_hold_days": [5, 10, 15],
    },
    "squeeze_breakout": {
        "rvol_thresh": [1.0, 1.5, 2.0, 2.5],
        "stop_loss_atr_mult": [1.0, 1.5, 2.0],
        "take_profit_r_mult": [2.0, 2.5, 3.0],
        "max_hold_days": [10, 15, 20],
    },
}


def generate_param_combinations(setup_name: str) -> List[Dict]:
    """Generate all parameter combinations for a setup."""
    grid = PARAMETER_GRIDS.get(setup_name, {})
    if not grid:
        return [MASTER_SETUPS[setup_name]["base_params"]]
    
    keys = list(grid.keys())
    values = list(grid.values())
    
    combinations = []
    for combo in itertools.product(*values):
        params = dict(zip(keys, combo))
        combinations.append(params)
    
    return combinations


def optimize_setup(
    setup_name: str,
    universe: str,
    start_date: str,
    end_date: str,
    max_combinations: int = 50,
) -> Dict:
    """
    Run grid search optimization for a single setup.
    
    Returns the best parameters and all results.
    """
    print(f"\n{'#'*60}")
    print(f"# OPTIMIZING: {setup_name}")
    print(f"{'#'*60}")
    
    combinations = generate_param_combinations(setup_name)
    total_combos = len(combinations)
    
    # Limit combinations if too many
    if total_combos > max_combinations:
        print(f"⚠️ {total_combos} combinations, sampling {max_combinations}")
        import random
        random.seed(42)
        combinations = random.sample(combinations, max_combinations)
    
    print(f"Testing {len(combinations)} parameter combinations...")
    
    backtester = ProductionBacktester()
    backtester.connect()
    
    results = []
    best_result = None
    best_reliability = -1
    
    try:
        for i, params in enumerate(combinations):
            print(f"\n[{i+1}/{len(combinations)}] Testing: {params}")
            
            result = backtester.run_backtest(
                setup_name=setup_name,
                universe=universe,
                start_date=start_date,
                end_date=end_date,
                params=params,
            )
            
            metrics = result["metrics"]
            reliability = metrics.get("reliability_score", 0)
            
            results.append({
                "params": params,
                "total_trades": metrics["total_trades"],
                "win_rate": metrics["win_rate"],
                "profit_factor": metrics["profit_factor"],
                "avg_return_pct": metrics["avg_return_pct"],
                "reliability_score": reliability,
            })
            
            if reliability > best_reliability and metrics["total_trades"] >= 30:
                best_reliability = reliability
                best_result = {
                    "params": params,
                    "metrics": metrics,
                }
                print(f"  ⭐ NEW BEST: Reliability={reliability:.1f}, WR={metrics['win_rate']*100:.1f}%, PF={metrics['profit_factor']:.2f}")
            
            # Reconnect to avoid connection issues
            backtester.disconnect()
            backtester.connect()
    
    finally:
        backtester.disconnect()
    
    # Sort results by reliability
    results.sort(key=lambda x: x["reliability_score"], reverse=True)
    
    return {
        "setup_name": setup_name,
        "universe": universe,
        "start_date": start_date,
        "end_date": end_date,
        "total_combinations_tested": len(combinations),
        "best_params": best_result["params"] if best_result else None,
        "best_metrics": best_result["metrics"] if best_result else None,
        "all_results": results[:20],  # Top 20 results
    }


def run_optimization(
    setups: List[str],
    universe: str,
    start_date: str,
    end_date: str,
    output_dir: str = "./data/optimization",
):
    """Run optimization for multiple setups."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    all_results = {}
    
    for setup_name in setups:
        result = optimize_setup(
            setup_name=setup_name,
            universe=universe,
            start_date=start_date,
            end_date=end_date,
        )
        
        all_results[setup_name] = result
        
        # Save individual result
        output_path = f"{output_dir}/{setup_name}_optimization.json"
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\n✓ Saved: {output_path}")
    
    # Generate summary
    print("\n" + "="*80)
    print("OPTIMIZATION SUMMARY")
    print("="*80)
    print(f"{'Setup':<25} {'Best WR':>10} {'Best PF':>10} {'Best Rel':>12} {'Trades':>8}")
    print("-"*80)
    
    for setup_name, result in all_results.items():
        if result["best_metrics"]:
            m = result["best_metrics"]
            print(f"{setup_name:<25} {m['win_rate']*100:>9.1f}% {m['profit_factor']:>10.2f} {m['reliability_score']:>12.1f} {m['total_trades']:>8}")
        else:
            print(f"{setup_name:<25} {'N/A':>10} {'N/A':>10} {'N/A':>12} {'N/A':>8}")
    
    print("="*80)
    
    # Save combined summary
    summary_path = f"{output_dir}/optimization_summary.json"
    with open(summary_path, "w") as f:
        json.dump({
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "timestamp": datetime.now().isoformat(),
            "results": {
                name: {
                    "best_params": r["best_params"],
                    "best_reliability": r["best_metrics"]["reliability_score"] if r["best_metrics"] else 0,
                    "best_win_rate": r["best_metrics"]["win_rate"] if r["best_metrics"] else 0,
                    "best_profit_factor": r["best_metrics"]["profit_factor"] if r["best_metrics"] else 0,
                }
                for name, r in all_results.items()
            }
        }, f, indent=2)
    print(f"\n✓ Summary saved: {summary_path}")
    
    return all_results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--setups", type=str, nargs="+", 
                        default=["mean_reversion", "pullback_ma50", "standard_breakout", "squeeze_breakout"])
    parser.add_argument("--universe", type=str, default="equity")
    parser.add_argument("--start", type=str, default="2023-01-01")
    parser.add_argument("--end", type=str, default="2025-12-31")
    args = parser.parse_args()
    
    run_optimization(
        setups=args.setups,
        universe=args.universe,
        start_date=args.start,
        end_date=args.end,
    )

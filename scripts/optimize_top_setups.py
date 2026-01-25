"""
Optimize parameters for the top-performing position trading setups.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from itertools import product
from typing import Dict, List, Any

sys.path.insert(0, str(Path(__file__).parent))

from position_backtester import PositionBacktester, POSITION_SETUPS, TrailingStopConfig


# Top setups to optimize
TOP_SETUPS = [
    "acceleration_turn_up",
    "trend_pullback_50ma",
    "holy_grail_20ema",
    "macd_bullish_cross",
    "volatility_contraction_breakout",
]


# Parameter grids for each setup
PARAMETER_GRIDS = {
    "acceleration_turn_up": {
        # Vary the ROC threshold
        "roc_20_threshold": [0, 0.02, 0.05],
        # Vary trailing stop
        "initial_stop_pct": [0.12, 0.15, 0.20],
        "profit_target": [0.40, 0.50, 0.60],
    },
    "trend_pullback_50ma": {
        # Vary how close to MA50 we require
        "ma_dist_50_threshold": [0.02, 0.03, 0.05],
        # Vary RSI threshold
        "rsi_threshold": [45, 50, 55],
        # Vary trailing stop
        "initial_stop_pct": [0.12, 0.15, 0.20],
    },
    "holy_grail_20ema": {
        # Vary how close to MA20 we require
        "ma_dist_20_range": [0.01, 0.02, 0.03],
        # Vary RSI threshold
        "rsi_threshold": [55, 60, 65],
        # Vary trailing stop
        "initial_stop_pct": [0.12, 0.15, 0.20],
    },
    "macd_bullish_cross": {
        # Vary RSI threshold
        "rsi_threshold": [65, 70, 75],
        # Vary trailing stop
        "initial_stop_pct": [0.12, 0.15, 0.20],
        "profit_target": [0.40, 0.50, 0.60],
    },
    "volatility_contraction_breakout": {
        # Vary BB width percentile threshold
        "bb_width_pctile_threshold": [25, 30, 35],
        # Vary trailing stop
        "initial_stop_pct": [0.12, 0.15, 0.20],
        "profit_target": [0.40, 0.50, 0.60],
    },
}


def modify_setup_conditions(setup_name: str, params: Dict) -> Dict:
    """Create a modified setup with new parameter values."""
    setup = POSITION_SETUPS[setup_name].copy()
    setup["conditions"] = [c.copy() for c in setup["conditions"]]
    
    if setup_name == "acceleration_turn_up":
        # Modify ROC threshold
        for cond in setup["conditions"]:
            if cond["field"] == "roc_20":
                cond["threshold_value"] = params.get("roc_20_threshold", 0)
    
    elif setup_name == "trend_pullback_50ma":
        # Modify MA distance threshold
        for cond in setup["conditions"]:
            if cond["field"] == "ma_dist_50" and cond["operator"] == "<=":
                cond["threshold_value"] = params.get("ma_dist_50_threshold", 0.03)
            if cond["field"] == "rsi_14":
                cond["threshold_value"] = params.get("rsi_threshold", 50)
    
    elif setup_name == "holy_grail_20ema":
        # Modify MA distance range
        ma_range = params.get("ma_dist_20_range", 0.02)
        for cond in setup["conditions"]:
            if cond["field"] == "ma_dist_20" and cond["operator"] == ">=":
                cond["threshold_value"] = -ma_range
            if cond["field"] == "ma_dist_20" and cond["operator"] == "<=":
                cond["threshold_value"] = ma_range
            if cond["field"] == "rsi_14":
                cond["threshold_value"] = params.get("rsi_threshold", 60)
    
    elif setup_name == "macd_bullish_cross":
        # Modify RSI threshold
        for cond in setup["conditions"]:
            if cond["field"] == "rsi_14":
                cond["threshold_value"] = params.get("rsi_threshold", 70)
    
    elif setup_name == "volatility_contraction_breakout":
        # Modify BB width percentile threshold
        for cond in setup["conditions"]:
            if cond["field"] == "bb_width_pctile_prev":
                cond["threshold_value"] = params.get("bb_width_pctile_threshold", 30)
    
    return setup


def optimize_setup(
    setup_name: str,
    universe: str = "equity",
    start_date: str = "2020-01-01",
    end_date: str = "2025-12-31",
):
    """Run parameter optimization for a single setup."""
    
    if setup_name not in PARAMETER_GRIDS:
        print(f"⚠️ No parameter grid defined for {setup_name}")
        return None
    
    param_grid = PARAMETER_GRIDS[setup_name]
    
    # Generate all parameter combinations
    param_names = list(param_grid.keys())
    param_values = list(param_grid.values())
    combinations = list(product(*param_values))
    
    print(f"\n{'#'*60}")
    print(f"# OPTIMIZING: {setup_name}")
    print(f"# Testing {len(combinations)} parameter combinations")
    print(f"{'#'*60}")
    
    results = []
    best_result = None
    best_reliability = 0
    
    backtester = PositionBacktester()
    backtester.connect()
    
    try:
        for i, combo in enumerate(combinations):
            params = dict(zip(param_names, combo))
            
            # Create trailing config with params
            trailing_config = TrailingStopConfig(
                initial_stop_pct=params.get("initial_stop_pct", 0.15),
                profit_target=params.get("profit_target", 0.50),
            )
            backtester.trailing_config = trailing_config
            
            # Modify setup conditions
            modified_setup = modify_setup_conditions(setup_name, params)
            
            # Temporarily replace the setup
            original_setup = POSITION_SETUPS[setup_name]
            POSITION_SETUPS[setup_name] = modified_setup
            
            try:
                # Run backtest (suppress output)
                result = backtester.run_backtest(
                    setup_name=setup_name,
                    universe=universe,
                    start_date=start_date,
                    end_date=end_date,
                )
                
                metrics = result["metrics"]
                reliability = metrics["reliability_score"]
                
                result_entry = {
                    "params": params,
                    "total_trades": metrics["total_trades"],
                    "win_rate": metrics["win_rate"],
                    "profit_factor": metrics["profit_factor"],
                    "avg_return_pct": metrics["avg_return_pct"],
                    "reliability_score": reliability,
                }
                results.append(result_entry)
                
                # Track best
                if reliability > best_reliability and metrics["total_trades"] >= 20:
                    best_reliability = reliability
                    best_result = result_entry
                
                # Progress update
                print(f"  [{i+1}/{len(combinations)}] {params}")
                print(f"      Trades: {metrics['total_trades']}, WR: {metrics['win_rate']*100:.1f}%, PF: {metrics['profit_factor']:.2f}, Rel: {reliability:.1f}")
                
            except Exception as e:
                print(f"  [{i+1}/{len(combinations)}] Error: {e}")
            
            finally:
                # Restore original setup
                POSITION_SETUPS[setup_name] = original_setup
            
            # Reconnect to avoid connection issues
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


def main():
    """Run optimization for all top setups."""
    
    all_results = {}
    
    for setup_name in TOP_SETUPS:
        result = optimize_setup(setup_name)
        if result:
            all_results[setup_name] = result
    
    # Print summary
    print("\n" + "="*100)
    print("OPTIMIZATION SUMMARY")
    print("="*100)
    
    for setup_name, data in all_results.items():
        best = data.get("best_result")
        if best:
            print(f"\n{setup_name}:")
            print(f"  Best Params: {best['params']}")
            print(f"  Trades: {best['total_trades']}, WR: {best['win_rate']*100:.1f}%, PF: {best['profit_factor']:.2f}")
            print(f"  Avg Return: {best['avg_return_pct']*100:+.2f}%, Reliability: {best['reliability_score']:.1f}")
    
    # Save results
    output_path = "./data/optimization/top_setups_optimization.json"
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "results": all_results,
        }, f, indent=2)
    print(f"\n✓ Results saved to: {output_path}")


if __name__ == "__main__":
    main()

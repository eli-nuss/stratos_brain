"""
Quick Parameter Optimization
============================

Runs a focused optimization with fewer parameter combinations.
Based on insights from initial testing.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from production_backtester import ProductionBacktester, MASTER_SETUPS


# Focused parameter grids based on baseline results
FOCUSED_GRIDS = {
    # Mean reversion: baseline was 70.6% WR, 3.04 PF - already excellent
    # Focus on fine-tuning around the best parameters found
    "mean_reversion": [
        # Baseline (already good)
        {"ma_dist_thresh": -0.12, "rsi_thresh": 35, "stop_loss_atr_mult": 2.0, "take_profit_r_mult": 2.0, "max_hold_days": 10},
        # Tighter entry
        {"ma_dist_thresh": -0.08, "rsi_thresh": 35, "stop_loss_atr_mult": 2.0, "take_profit_r_mult": 2.0, "max_hold_days": 15},
        # Looser entry, more trades
        {"ma_dist_thresh": -0.10, "rsi_thresh": 40, "stop_loss_atr_mult": 2.0, "take_profit_r_mult": 2.0, "max_hold_days": 10},
        # Higher R:R
        {"ma_dist_thresh": -0.10, "rsi_thresh": 35, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 3.0, "max_hold_days": 15},
        # Tighter stop
        {"ma_dist_thresh": -0.10, "rsi_thresh": 35, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.0, "max_hold_days": 10},
    ],
    
    # Pullback MA50: baseline was 49.1% WR, 1.70 PF - good volume, needs tuning
    "pullback_ma50": [
        # Baseline
        {"rsi_threshold": 45, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 3.0, "max_hold_days": 20},
        # Lower RSI threshold for more oversold entries
        {"rsi_threshold": 40, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 3.0, "max_hold_days": 20},
        # Tighter stop, higher R:R
        {"rsi_threshold": 45, "stop_loss_atr_mult": 1.0, "take_profit_r_mult": 4.0, "max_hold_days": 15},
        # Wider stop for more room
        {"rsi_threshold": 45, "stop_loss_atr_mult": 2.0, "take_profit_r_mult": 3.0, "max_hold_days": 20},
        # Shorter hold
        {"rsi_threshold": 40, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.5, "max_hold_days": 10},
    ],
    
    # Standard breakout: baseline was 52.2% WR, 1.35 PF - needs improvement
    "standard_breakout": [
        # Baseline
        {"rvol_thresh": 2.0, "rsi_thresh": 60, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.0, "max_hold_days": 10},
        # Higher volume filter
        {"rvol_thresh": 2.5, "rsi_thresh": 60, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.0, "max_hold_days": 10},
        # Lower RSI for earlier entry
        {"rvol_thresh": 2.0, "rsi_thresh": 55, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.5, "max_hold_days": 10},
        # Tighter stop
        {"rvol_thresh": 2.0, "rsi_thresh": 60, "stop_loss_atr_mult": 1.0, "take_profit_r_mult": 2.5, "max_hold_days": 7},
        # More conservative
        {"rvol_thresh": 3.0, "rsi_thresh": 65, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.0, "max_hold_days": 5},
    ],
    
    # Squeeze breakout: baseline was 50.6% WR, 1.39 PF - low volume
    "squeeze_breakout": [
        # Baseline
        {"rvol_thresh": 1.5, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.5, "max_hold_days": 15},
        # Lower volume threshold for more trades
        {"rvol_thresh": 1.0, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.5, "max_hold_days": 15},
        # Higher R:R
        {"rvol_thresh": 1.5, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 3.0, "max_hold_days": 20},
        # Tighter stop
        {"rvol_thresh": 1.5, "stop_loss_atr_mult": 1.0, "take_profit_r_mult": 2.0, "max_hold_days": 10},
        # More aggressive
        {"rvol_thresh": 1.2, "stop_loss_atr_mult": 1.5, "take_profit_r_mult": 2.5, "max_hold_days": 15},
    ],
}


def quick_optimize(
    setups: List[str],
    universe: str,
    start_date: str,
    end_date: str,
):
    """Run quick optimization with focused parameter sets."""
    
    results = {}
    backtester = ProductionBacktester()
    backtester.connect()
    
    try:
        for setup_name in setups:
            print(f"\n{'#'*60}")
            print(f"# OPTIMIZING: {setup_name}")
            print(f"{'#'*60}")
            
            param_sets = FOCUSED_GRIDS.get(setup_name, [MASTER_SETUPS[setup_name]["base_params"]])
            
            best_result = None
            best_reliability = -1
            all_results = []
            
            for i, params in enumerate(param_sets):
                print(f"\n[{i+1}/{len(param_sets)}] Testing: {params}")
                
                result = backtester.run_backtest(
                    setup_name=setup_name,
                    universe=universe,
                    start_date=start_date,
                    end_date=end_date,
                    params=params,
                )
                
                metrics = result["metrics"]
                reliability = metrics.get("reliability_score", 0)
                
                all_results.append({
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
                
                # Reconnect
                backtester.disconnect()
                backtester.connect()
            
            results[setup_name] = {
                "best_params": best_result["params"] if best_result else None,
                "best_metrics": best_result["metrics"] if best_result else None,
                "all_results": sorted(all_results, key=lambda x: x["reliability_score"], reverse=True),
            }
    
    finally:
        backtester.disconnect()
    
    # Print summary
    print("\n" + "="*80)
    print("OPTIMIZATION RESULTS")
    print("="*80)
    print(f"{'Setup':<25} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Reliability':>12}")
    print("-"*80)
    
    for setup_name, result in results.items():
        if result["best_metrics"]:
            m = result["best_metrics"]
            print(f"{setup_name:<25} {m['total_trades']:>8} {m['win_rate']*100:>9.1f}% {m['profit_factor']:>8.2f} {m['avg_return_pct']*100:>+9.2f}% {m['reliability_score']:>12.1f}")
        else:
            print(f"{setup_name:<25} {'N/A':>8} {'N/A':>10} {'N/A':>8} {'N/A':>10} {'N/A':>12}")
    
    print("="*80)
    
    # Save results
    output_dir = Path("./data/optimization")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / "quick_optimization_results.json"
    with open(output_path, "w") as f:
        json.dump({
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "timestamp": datetime.now().isoformat(),
            "results": results,
        }, f, indent=2, default=str)
    print(f"\n✓ Results saved: {output_path}")
    
    # Print best parameters for each setup
    print("\n" + "="*80)
    print("OPTIMAL PARAMETERS")
    print("="*80)
    for setup_name, result in results.items():
        if result["best_params"]:
            print(f"\n{setup_name}:")
            print(f"  {json.dumps(result['best_params'], indent=4)}")
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--setups", type=str, nargs="+", 
                        default=["mean_reversion", "pullback_ma50", "standard_breakout", "squeeze_breakout"])
    parser.add_argument("--universe", type=str, default="equity")
    parser.add_argument("--start", type=str, default="2023-01-01")
    parser.add_argument("--end", type=str, default="2025-12-31")
    args = parser.parse_args()
    
    quick_optimize(
        setups=args.setups,
        universe=args.universe,
        start_date=args.start,
        end_date=args.end,
    )

"""
Run baseline tests for all setups and generate a comparison summary.
"""

import json
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from production_backtester import ProductionBacktester, MASTER_SETUPS


def run_all_baselines(universe: str, start_date: str, end_date: str):
    """Run baseline tests for all setups."""
    
    results = {}
    backtester = ProductionBacktester()
    backtester.connect()
    
    try:
        for setup_name in MASTER_SETUPS.keys():
            print(f"\n{'#'*60}")
            print(f"# TESTING: {setup_name}")
            print(f"{'#'*60}")
            
            output_path = f"./data/baseline/{setup_name}_{universe}"
            
            result = backtester.run_backtest(
                setup_name=setup_name,
                universe=universe,
                start_date=start_date,
                end_date=end_date,
            )
            
            backtester.export_report(result, output_path)
            
            results[setup_name] = {
                "total_trades": result["metrics"]["total_trades"],
                "win_rate": result["metrics"]["win_rate"],
                "profit_factor": result["metrics"]["profit_factor"],
                "avg_return_pct": result["metrics"]["avg_return_pct"],
                "reliability_score": result["metrics"]["reliability_score"],
            }
            
            # Reconnect for next setup (fresh connection)
            backtester.disconnect()
            backtester.connect()
    
    finally:
        backtester.disconnect()
    
    # Generate summary
    print("\n" + "="*80)
    print("BASELINE RESULTS SUMMARY")
    print("="*80)
    print(f"Universe: {universe}")
    print(f"Date Range: {start_date} to {end_date}")
    print("="*80)
    print(f"{'Setup':<25} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Reliability':>12}")
    print("-"*80)
    
    # Sort by reliability score
    sorted_results = sorted(results.items(), key=lambda x: x[1]["reliability_score"], reverse=True)
    
    for setup_name, metrics in sorted_results:
        wr = f"{metrics['win_rate']*100:.1f}%"
        pf = f"{metrics['profit_factor']:.2f}"
        avg_ret = f"{metrics['avg_return_pct']*100:+.2f}%"
        rel = f"{metrics['reliability_score']:.1f}"
        print(f"{setup_name:<25} {metrics['total_trades']:>8} {wr:>10} {pf:>8} {avg_ret:>10} {rel:>12}")
    
    print("="*80)
    
    # Save summary
    summary_path = f"./data/baseline/summary_{universe}.json"
    with open(summary_path, "w") as f:
        json.dump({
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "results": results,
            "ranking": [s[0] for s in sorted_results],
        }, f, indent=2)
    print(f"\n✓ Summary saved to: {summary_path}")
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--universe", type=str, default="equity", choices=["crypto", "equity"])
    parser.add_argument("--start", type=str, default="2023-01-01")
    parser.add_argument("--end", type=str, default="2025-12-31")
    args = parser.parse_args()
    
    run_all_baselines(args.universe, args.start, args.end)

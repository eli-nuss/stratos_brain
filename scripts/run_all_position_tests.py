"""
Run all position trading setups and generate comparison.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from position_backtester import PositionBacktester, POSITION_SETUPS, TrailingStopConfig


def run_all_position_tests(
    universe: str,
    start_date: str,
    end_date: str,
    initial_stop: float = 0.15,
    profit_target: float = 0.50,
):
    """Run all position trading setups."""
    
    trailing_config = TrailingStopConfig(
        initial_stop_pct=initial_stop,
        profit_target=profit_target,
    )
    
    results = {}
    backtester = PositionBacktester(trailing_config)
    backtester.connect()
    
    try:
        for setup_name in POSITION_SETUPS.keys():
            print(f"\n{'#'*60}")
            print(f"# TESTING: {setup_name}")
            print(f"{'#'*60}")
            
            output_path = f"./data/position/{setup_name}_{universe}"
            
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
                "avg_holding_period": result["metrics"].get("avg_holding_period", 0),
                "exit_reasons": result["metrics"].get("exit_reasons", {}),
                "reliability_score": result["metrics"]["reliability_score"],
            }
            
            # Reconnect for next setup
            backtester.disconnect()
            backtester.connect()
    
    finally:
        backtester.disconnect()
    
    # Generate summary
    print("\n" + "="*100)
    print("POSITION TRADING RESULTS SUMMARY")
    print("="*100)
    print(f"Universe: {universe}")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"Initial Stop: {initial_stop*100:.0f}%  |  Profit Target: {profit_target*100:.0f}%")
    print("="*100)
    print(f"{'Setup':<25} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10} {'Reliability':>12}")
    print("-"*100)
    
    # Sort by reliability score
    sorted_results = sorted(results.items(), key=lambda x: x[1]["reliability_score"], reverse=True)
    
    for setup_name, metrics in sorted_results:
        if metrics["total_trades"] > 0:
            wr = f"{metrics['win_rate']*100:.1f}%"
            pf = f"{metrics['profit_factor']:.2f}"
            avg_ret = f"{metrics['avg_return_pct']*100:+.2f}%"
            avg_hold = f"{metrics['avg_holding_period']:.0f} days"
            rel = f"{metrics['reliability_score']:.1f}"
        else:
            wr = pf = avg_ret = avg_hold = rel = "N/A"
        print(f"{setup_name:<25} {metrics['total_trades']:>8} {wr:>10} {pf:>8} {avg_ret:>10} {avg_hold:>10} {rel:>12}")
    
    print("="*100)
    
    # Exit reason analysis
    print("\nEXIT REASON BREAKDOWN:")
    print("-"*60)
    all_exits = {}
    for setup_name, metrics in results.items():
        for reason, count in metrics.get("exit_reasons", {}).items():
            all_exits[reason] = all_exits.get(reason, 0) + count
    
    total_exits = sum(all_exits.values())
    for reason, count in sorted(all_exits.items(), key=lambda x: x[1], reverse=True):
        pct = count / total_exits * 100 if total_exits > 0 else 0
        print(f"  {reason:<25} {count:>6} ({pct:.1f}%)")
    
    # Save summary
    summary_path = f"./data/position/summary_{universe}.json"
    with open(summary_path, "w") as f:
        json.dump({
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "trailing_config": {
                "initial_stop_pct": initial_stop,
                "profit_target": profit_target,
            },
            "timestamp": datetime.now().isoformat(),
            "results": results,
            "ranking": [s[0] for s in sorted_results],
        }, f, indent=2)
    print(f"\n✓ Summary saved to: {summary_path}")
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--universe", type=str, default="equity", choices=["crypto", "equity"])
    parser.add_argument("--start", type=str, default="2020-01-01")
    parser.add_argument("--end", type=str, default="2025-12-31")
    parser.add_argument("--initial-stop", type=float, default=0.15)
    parser.add_argument("--profit-target", type=float, default=0.50)
    args = parser.parse_args()
    
    run_all_position_tests(
        universe=args.universe,
        start_date=args.start,
        end_date=args.end,
        initial_stop=args.initial_stop,
        profit_target=args.profit_target,
    )

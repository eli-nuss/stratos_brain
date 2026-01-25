"""
Test all the new position trading setups.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from position_backtester import PositionBacktester, POSITION_SETUPS, TrailingStopConfig


# New setups to test
NEW_SETUPS = [
    "holy_grail_20ema",
    "relative_strength_breakout",
    "acceleration_turn_up",
    "52w_high_breakout",
    "macd_bullish_cross",
    "volatility_contraction_breakout",
    "deep_oversold_bounce",
    "confirmed_breakout",
    "drawdown_recovery",
]


def test_new_setups(
    universe: str = "equity",
    start_date: str = "2020-01-01",
    end_date: str = "2025-12-31",
):
    """Test all new setups."""
    
    trailing_config = TrailingStopConfig(
        initial_stop_pct=0.15,
        profit_target=0.50,
    )
    
    results = {}
    backtester = PositionBacktester(trailing_config)
    backtester.connect()
    
    try:
        for setup_name in NEW_SETUPS:
            if setup_name not in POSITION_SETUPS:
                print(f"⚠️ Setup '{setup_name}' not found, skipping...")
                continue
                
            print(f"\n{'#'*60}")
            print(f"# TESTING: {setup_name}")
            print(f"{'#'*60}")
            
            output_path = f"./data/position/new_{setup_name}_{universe}"
            
            try:
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
            except Exception as e:
                print(f"❌ Error testing {setup_name}: {e}")
                results[setup_name] = {"error": str(e)}
            
            # Reconnect for next setup
            backtester.disconnect()
            backtester.connect()
    
    finally:
        backtester.disconnect()
    
    # Generate summary
    print("\n" + "="*100)
    print("NEW SETUPS RESULTS SUMMARY")
    print("="*100)
    print(f"{'Setup':<30} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10} {'Reliability':>12}")
    print("-"*100)
    
    # Sort by reliability score
    valid_results = {k: v for k, v in results.items() if "error" not in v and v.get("total_trades", 0) > 0}
    sorted_results = sorted(valid_results.items(), key=lambda x: x[1].get("reliability_score", 0), reverse=True)
    
    for setup_name, metrics in sorted_results:
        wr = f"{metrics['win_rate']*100:.1f}%"
        pf = f"{metrics['profit_factor']:.2f}"
        avg_ret = f"{metrics['avg_return_pct']*100:+.2f}%"
        avg_hold = f"{metrics['avg_holding_period']:.0f} days"
        rel = f"{metrics['reliability_score']:.1f}"
        print(f"{setup_name:<30} {metrics['total_trades']:>8} {wr:>10} {pf:>8} {avg_ret:>10} {avg_hold:>10} {rel:>12}")
    
    # Print errors
    error_results = {k: v for k, v in results.items() if "error" in v}
    if error_results:
        print("\n❌ ERRORS:")
        for setup_name, data in error_results.items():
            print(f"  {setup_name}: {data['error']}")
    
    print("="*100)
    
    # Save summary
    summary_path = f"./data/position/new_setups_summary_{universe}.json"
    with open(summary_path, "w") as f:
        json.dump({
            "universe": universe,
            "start_date": start_date,
            "end_date": end_date,
            "timestamp": datetime.now().isoformat(),
            "results": results,
        }, f, indent=2)
    print(f"\n✓ Summary saved to: {summary_path}")
    
    return results


if __name__ == "__main__":
    test_new_setups()

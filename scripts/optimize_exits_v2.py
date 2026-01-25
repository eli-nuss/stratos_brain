"""
Optimize exit strategies for each setup independently.
Each setup gets its own parameter grid based on its category.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from position_backtester_v2 import (
    PositionBacktesterV2, 
    POSITION_SETUPS, 
    SETUP_EXIT_CONFIGS,
    ExitConfig,
    optimize_exit_config,
)


# =============================================================================
# SETUP-SPECIFIC PARAMETER GRIDS
# =============================================================================

# Each setup category has different exit parameters to optimize

OPTIMIZATION_GRIDS = {
    # =========================================================================
    # TREND PULLBACK - Optimize MA-based stops and trailing
    # =========================================================================
    "trend_pullback_50ma": {
        "stop_ma_buffer": [0.02, 0.03, 0.05],           # How far below 50 MA to stop
        "trail_atr_mult": [2.0, 2.5, 3.0],              # Trailing stop tightness
        "trail_activation_pct": [0.10, 0.15, 0.20],     # When to activate trail
    },
    
    "holy_grail_20ema": {
        "stop_ma_buffer": [0.01, 0.02, 0.03],           # How far below 20 MA to stop
        "trail_atr_mult": [1.5, 2.0, 2.5],
        "trail_activation_pct": [0.08, 0.10, 0.15],
        "breakdown_ma_period": [20, 50, None],          # Which MA triggers breakdown
    },
    
    # =========================================================================
    # MEAN REVERSION - Optimize time stops and targets
    # =========================================================================
    "oversold_quality": {
        "profit_ma_period": [20, 50],                   # Which MA to target
        "stop_atr_mult": [1.0, 1.5, 2.0],               # Stop tightness
        "time_stop_days": [3, 5, 7, 10],                # When to give up
        "max_hold_days": [5, 10, 15],                   # Max hold
    },
    
    # =========================================================================
    # BREAKOUT/MOMENTUM - Optimize fast failure exits
    # =========================================================================
    "gap_up_hold": {
        "trail_atr_mult": [1.5, 2.0, 2.5],
        "trail_activation_pct": [0.05, 0.10, 0.15],
        "new_high_days": [3, 5, 7],                     # Days without new high = exit
        "breakdown_ma_period": [10, 20],                # Fast trend MA
    },
    
    "breakout_consolidation": {
        "trail_atr_mult": [1.5, 2.0, 2.5],
        "trail_activation_pct": [0.08, 0.10, 0.15],
        "new_high_days": [5, 10, 15],
        "max_hold_days": [21, 42, 63],
    },
    
    "squeeze_release": {
        "trail_atr_mult": [1.5, 2.0, 2.5],
        "trail_activation_pct": [0.08, 0.10, 0.15],
        "new_high_days": [5, 10, 15],
        "max_hold_days": [21, 42, 63],
    },
    
    "volatility_contraction_breakout": {
        "trail_atr_mult": [1.5, 2.0, 2.5],
        "trail_activation_pct": [0.08, 0.10, 0.15],
        "new_high_days": [5, 10, 15],
        "max_hold_days": [21, 42, 63],
    },
    
    # =========================================================================
    # ACCELERATION/MOMENTUM
    # =========================================================================
    "acceleration_turn_up": {
        "stop_ma_buffer": [0.01, 0.02, 0.03],
        "trail_atr_mult": [1.5, 2.0, 2.5],
        "trail_activation_pct": [0.08, 0.10, 0.15],
        "breakdown_ma_period": [20, 50],
    },
    
    "macd_bullish_cross": {
        "stop_ma_buffer": [0.01, 0.02, 0.03],
        "trail_atr_mult": [1.5, 2.0, 2.5],
        "trail_activation_pct": [0.08, 0.10, 0.15],
        "breakdown_ma_period": [20, 50],
    },
}


def run_all_optimizations():
    """Run optimization for all setups."""
    
    all_results = {}
    
    for setup_name, param_grid in OPTIMIZATION_GRIDS.items():
        if setup_name not in POSITION_SETUPS:
            print(f"⚠️ Setup {setup_name} not found, skipping...")
            continue
        
        result = optimize_exit_config(
            setup_name=setup_name,
            param_grid=param_grid,
            universe="equity",
            start_date="2020-01-01",
            end_date="2025-12-31",
        )
        
        all_results[setup_name] = result
        
        # Print best result
        best = result.get("best_result")
        if best:
            print(f"\n✅ BEST for {setup_name}:")
            print(f"   Params: {best['params']}")
            print(f"   Trades: {best['total_trades']}, WR: {best['win_rate']*100:.1f}%, PF: {best['profit_factor']:.2f}")
            print(f"   Avg Return: {best['avg_return_pct']*100:+.2f}%, Avg Hold: {best['avg_holding_days']:.0f}d")
    
    # Save results
    output_path = "./data/optimization/v2_exit_optimization.json"
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "results": all_results,
        }, f, indent=2, default=str)
    
    print(f"\n✓ Results saved to: {output_path}")
    
    # Print summary table
    print("\n" + "="*100)
    print("V2 EXIT OPTIMIZATION SUMMARY")
    print("="*100)
    print(f"{'Setup':<35} {'Trades':>8} {'Win Rate':>10} {'PF':>8} {'Avg Ret':>10} {'Avg Hold':>10}")
    print("-"*100)
    
    for setup_name, data in all_results.items():
        best = data.get("best_result")
        if best:
            wr = f"{best['win_rate']*100:.1f}%"
            pf = f"{best['profit_factor']:.2f}"
            avg_ret = f"{best['avg_return_pct']*100:+.2f}%"
            avg_hold = f"{best['avg_holding_days']:.0f}d"
            print(f"{setup_name:<35} {best['total_trades']:>8} {wr:>10} {pf:>8} {avg_ret:>10} {avg_hold:>10}")
    
    print("="*100)
    
    return all_results


if __name__ == "__main__":
    run_all_optimizations()

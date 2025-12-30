#!/usr/bin/env python3
"""CLI script to run the signal engine pipeline manually."""

import argparse
import sys
from datetime import datetime
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from stratos_engine.config import config
from stratos_engine.db import db
from stratos_engine.stages import Stage1Evaluate, Stage2AI, Stage3State
from stratos_engine.utils.logging import setup_logging


def main():
    parser = argparse.ArgumentParser(description="Run Stratos Signal Engine pipeline")
    parser.add_argument(
        "--date",
        type=str,
        default=datetime.now().strftime("%Y-%m-%d"),
        help="Date to run pipeline for (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--universe",
        type=str,
        default="equities_all",
        help="Universe ID (equities_all, equities_top100, crypto_all, etc.)",
    )
    parser.add_argument(
        "--stage",
        type=str,
        choices=["all", "evaluate", "state", "ai"],
        default="all",
        help="Which stage(s) to run",
    )
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Run in dry-run mode without writing to database",
    )
    parser.add_argument(
        "--ai-budget",
        type=int,
        default=50,
        help="Maximum number of signals to analyze with AI",
    )
    parser.add_argument(
        "--min-strength",
        type=float,
        default=60,
        help="Minimum strength for AI analysis",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )
    parser.add_argument(
        "--log-format",
        type=str,
        default="console",
        choices=["console", "json"],
        help="Logging format",
    )
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.log_level, args.log_format)
    
    print(f"Running Stratos Signal Engine")
    print(f"  Date: {args.date}")
    print(f"  Universe: {args.universe}")
    print(f"  Stage: {args.stage}")
    print(f"  Write: {not args.no_write}")
    print()
    
    results = {}
    
    try:
        # Stage 1: Evaluate
        if args.stage in ("all", "evaluate"):
            print("=== Stage 1: Signal Evaluation ===")
            stage1 = Stage1Evaluate(db)
            results["stage1"] = stage1.run(
                as_of_date=args.date,
                universe_id=args.universe,
                write=not args.no_write,
            )
            print(f"  Assets evaluated: {results['stage1']['assets_evaluated']}")
            print(f"  Signals generated: {results['stage1']['signals_generated']}")
            print()
        
        # Stage 3: State Machine
        if args.stage in ("all", "state"):
            print("=== Stage 3: State Machine ===")
            stage3 = Stage3State(db)
            results["stage3"] = stage3.run(as_of_date=args.date)
            print(f"  New instances: {results['stage3']['new_created']}")
            print(f"  Updated: {results['stage3']['updated']}")
            print(f"  Ended: {results['stage3']['ended']}")
            print()
        
        # Stage 2: AI Analysis
        if args.stage in ("all", "ai") and config.engine.enable_ai_stage:
            print("=== Stage 2: AI Analysis ===")
            stage2 = Stage2AI(db)
            results["stage2"] = stage2.run(
                as_of_date=args.date,
                min_strength=args.min_strength,
                budget=args.ai_budget,
            )
            print(f"  Signals analyzed: {results['stage2']['analyzed']}")
            print(f"  Tokens used: {results['stage2']['tokens_used']}")
            print()
        
        print("=== Pipeline Complete ===")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
E2B Parallel Orchestrator for ETF/Index/Commodity AI Analysis.

Spawns multiple E2B sandboxes to process ETFs, Indices, and Commodities in parallel.
Each sandbox handles a batch of assets, all running concurrently.

Usage:
    python e2b_etf_orchestrator.py --date 2026-01-28 --sandboxes 10
    
    # Process specific asset type only
    python e2b_etf_orchestrator.py --date 2026-01-28 --asset-type etf --sandboxes 5
"""

import argparse
import asyncio
import logging
import os
import sys
import time
from typing import List, Dict, Any

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# E2B imports
try:
    from e2b_code_interpreter import AsyncSandbox
except ImportError:
    logger.error("e2b_code_interpreter not installed. Run: pip install e2b-code-interpreter")
    sys.exit(1)

# Asset types supported by this orchestrator
SUPPORTED_ASSET_TYPES = ('etf', 'index', 'commodity')


def get_total_asset_count(asset_type: str, date: str) -> int:
    """Get total count of ETF/Index/Commodity assets to process."""
    import psycopg2
    
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            # Only count assets that have daily_features for the target date
            if asset_type == 'all':
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM assets a
                    JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
                    WHERE a.is_active = TRUE 
                      AND a.asset_type = ANY(%s)
                """, (date, list(SUPPORTED_ASSET_TYPES)))
            else:
                cur.execute("""
                    SELECT COUNT(*) 
                    FROM assets a
                    JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
                    WHERE a.is_active = TRUE 
                      AND a.asset_type = %s
                """, (date, asset_type))
            return cur.fetchone()[0]
    finally:
        conn.close()


def get_asset_type_breakdown(date: str) -> Dict[str, int]:
    """Get count of assets by type for the target date."""
    import psycopg2
    
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT a.asset_type, COUNT(*) 
                FROM assets a
                JOIN daily_features df ON a.asset_id = df.asset_id AND df.date = %s
                WHERE a.is_active = TRUE 
                  AND a.asset_type = ANY(%s)
                GROUP BY a.asset_type
            """, (date, list(SUPPORTED_ASSET_TYPES)))
            return {row[0]: row[1] for row in cur.fetchall()}
    finally:
        conn.close()


async def run_sandbox_batch(
    sandbox_id: int,
    date: str,
    model: str,
    offset: int,
    batch_size: int,
    repo_url: str,
    semaphore: asyncio.Semaphore
) -> Dict[str, Any]:
    """Run a single E2B sandbox for a batch of ETF/Index/Commodity assets."""
    
    async with semaphore:
        start_time = time.time()
        logger.info(f"[Sandbox {sandbox_id}] Starting (offset={offset}, batch_size={batch_size})")
        
        try:
            # Create sandbox with longer timeout
            sandbox = await AsyncSandbox.create(timeout=7200)  # 2 hour timeout
            
            try:
                # Install dependencies
                logger.info(f"[Sandbox {sandbox_id}] Installing dependencies...")
                await sandbox.commands.run("pip install psycopg2-binary google-genai")
                
                # Clone the repo
                logger.info(f"[Sandbox {sandbox_id}] Cloning repository...")
                await sandbox.commands.run(f"git clone {repo_url} /home/user/stratos_brain")
                
                # Set environment variables
                db_url = os.environ.get("DATABASE_URL")
                gemini_key = os.environ.get("GEMINI_API_KEY")
                
                # Run the ETF batch script
                logger.info(f"[Sandbox {sandbox_id}] Running ETF/Index/Commodity AI analysis batch...")
                cmd = f"""
                cd /home/user/stratos_brain && \
                export DATABASE_URL='{db_url}' && \
                export SUPABASE_DATABASE_URL='{db_url}' && \
                export GEMINI_API_KEY='{gemini_key}' && \
                python scripts/run_etf_ai_analysis_batch.py \
                    --date {date} \
                    --model {model} \
                    --offset {offset} \
                    --batch-size {batch_size}
                """
                
                result = await sandbox.commands.run(cmd, timeout=7200)  # 2 hour timeout
                
                elapsed = time.time() - start_time
                
                if result.exit_code == 0:
                    logger.info(f"[Sandbox {sandbox_id}] ✓ Completed in {elapsed:.1f}s")
                    return {
                        "sandbox_id": sandbox_id,
                        "status": "success",
                        "offset": offset,
                        "batch_size": batch_size,
                        "elapsed_seconds": elapsed,
                        "stdout": result.stdout[-2000:] if result.stdout else "",
                    }
                else:
                    logger.error(f"[Sandbox {sandbox_id}] ✗ Failed with exit code {result.exit_code}")
                    return {
                        "sandbox_id": sandbox_id,
                        "status": "failed",
                        "offset": offset,
                        "batch_size": batch_size,
                        "elapsed_seconds": elapsed,
                        "exit_code": result.exit_code,
                        "stderr": result.stderr[-2000:] if result.stderr else "",
                        "stdout": result.stdout[-1000:] if result.stdout else "",
                    }
                    
            finally:
                # Always kill the sandbox
                await sandbox.kill()
                
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[Sandbox {sandbox_id}] ✗ Exception: {e}")
            return {
                "sandbox_id": sandbox_id,
                "status": "error",
                "offset": offset,
                "batch_size": batch_size,
                "elapsed_seconds": elapsed,
                "error": str(e),
            }


async def main_async(args):
    """Main async orchestration logic."""
    
    # Get asset type breakdown
    breakdown = get_asset_type_breakdown(args.date)
    logger.info(f"Asset breakdown for {args.date}:")
    for asset_type, count in breakdown.items():
        logger.info(f"  {asset_type}: {count}")
    
    # Get total asset count
    total_assets = get_total_asset_count(args.asset_type, args.date)
    logger.info(f"Total assets to process: {total_assets}")
    
    if total_assets == 0:
        logger.info("No assets to process")
        return
    
    # Calculate batch distribution
    num_sandboxes = min(args.sandboxes, total_assets)
    batch_size = (total_assets + num_sandboxes - 1) // num_sandboxes  # Ceiling division
    
    logger.info(f"Using {num_sandboxes} sandboxes, ~{batch_size} assets each")
    
    # Create batch configurations
    batches = []
    for i in range(num_sandboxes):
        offset = i * batch_size
        # Last batch might be smaller
        actual_batch_size = min(batch_size, total_assets - offset)
        if actual_batch_size > 0:
            batches.append({
                "sandbox_id": i + 1,
                "offset": offset,
                "batch_size": actual_batch_size,
            })
    
    logger.info(f"Created {len(batches)} batch configurations")
    
    # Semaphore to limit concurrent sandboxes
    semaphore = asyncio.Semaphore(args.max_concurrent)
    
    # Repository URL
    repo_url = "https://github.com/eli-nuss/stratos_brain.git"
    
    # Stagger startup delay
    stagger_delay = args.stagger_delay
    
    async def launch_with_delay(batch, delay):
        """Launch a sandbox after a delay."""
        if delay > 0:
            await asyncio.sleep(delay)
        return await run_sandbox_batch(
            sandbox_id=batch["sandbox_id"],
            date=args.date,
            model=args.model,
            offset=batch["offset"],
            batch_size=batch["batch_size"],
            repo_url=repo_url,
            semaphore=semaphore,
        )
    
    # Launch all sandboxes with staggered startup
    start_time = time.time()
    logger.info(f"Launching sandboxes with {stagger_delay}s stagger delay...")
    
    tasks = [
        launch_with_delay(batch, i * stagger_delay)
        for i, batch in enumerate(batches)
    ]
    
    results = await asyncio.gather(*tasks)
    
    total_elapsed = time.time() - start_time
    
    # Summarize results
    success_count = sum(1 for r in results if r["status"] == "success")
    failed_count = sum(1 for r in results if r["status"] == "failed")
    error_count = sum(1 for r in results if r["status"] == "error")
    
    logger.info("=" * 60)
    logger.info("ORCHESTRATION COMPLETE")
    logger.info(f"  Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f} min)")
    logger.info(f"  Sandboxes: {success_count} success, {failed_count} failed, {error_count} errors")
    logger.info(f"  Assets processed: ~{total_assets}")
    logger.info("=" * 60)
    
    # Print failures for debugging
    for r in results:
        if r["status"] != "success":
            logger.error(f"Sandbox {r['sandbox_id']} ({r['status']}):")
            if r.get('error'):
                logger.error(f"  Error: {r['error'][:500]}")
            if r.get('stderr'):
                logger.error(f"  Stderr: {r['stderr'][:500]}")
            if r.get('stdout'):
                logger.error(f"  Stdout: {r['stdout'][:500]}")
    
    # Exit with error if too many failures
    if success_count < len(batches) * 0.8:
        logger.error("Too many sandbox failures (>20%)")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Orchestrate parallel E2B sandboxes for ETF/Index/Commodity AI analysis'
    )
    parser.add_argument('--date', type=str, required=True,
                        help='Target date (YYYY-MM-DD)')
    parser.add_argument('--asset-type', type=str, 
                        choices=['etf', 'index', 'commodity', 'all'], 
                        default='all',
                        help='Asset type to process (default: all)')
    parser.add_argument('--model', type=str, default='gemini-3-flash-preview',
                        help='Gemini model to use')
    parser.add_argument('--sandboxes', type=int, default=10,
                        help='Number of E2B sandboxes to spawn (default: 10)')
    parser.add_argument('--max-concurrent', type=int, default=10,
                        help='Maximum concurrent sandboxes (default: 10)')
    parser.add_argument('--stagger-delay', type=float, default=2.0,
                        help='Seconds to wait between launching each sandbox (default: 2.0)')
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("E2B ETF/INDEX/COMMODITY AI ORCHESTRATOR")
    logger.info(f"  Date: {args.date}")
    logger.info(f"  Asset Type: {args.asset_type}")
    logger.info(f"  Model: {args.model}")
    logger.info(f"  Target Sandboxes: {args.sandboxes}")
    logger.info(f"  Max Concurrent: {args.max_concurrent}")
    logger.info(f"  Stagger Delay: {args.stagger_delay}s")
    logger.info("=" * 60)
    
    # Check required env vars
    if not os.environ.get("E2B_API_KEY"):
        logger.error("E2B_API_KEY not set")
        sys.exit(1)
    if not os.environ.get("DATABASE_URL"):
        logger.error("DATABASE_URL not set")
        sys.exit(1)
    if not os.environ.get("GEMINI_API_KEY"):
        logger.error("GEMINI_API_KEY not set")
        sys.exit(1)
    
    # Run async main
    asyncio.run(main_async(args))


if __name__ == '__main__':
    main()

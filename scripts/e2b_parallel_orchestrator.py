#!/usr/bin/env python3
"""
E2B Parallel Orchestrator for AI Analysis.

Spawns multiple E2B sandboxes to process assets in parallel.
Each sandbox handles a batch of assets, all running concurrently.

Usage:
    python e2b_parallel_orchestrator.py --date 2026-01-25 --asset-type equity --sandboxes 50
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


def get_total_asset_count(asset_type: str) -> int:
    """Get total count of assets to process."""
    import psycopg2
    
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            query = "SELECT COUNT(*) FROM assets WHERE is_active = TRUE"
            params = []
            
            if asset_type and asset_type != 'all':
                query += " AND asset_type = %s"
                params.append(asset_type)
            
            cur.execute(query, params)
            return cur.fetchone()[0]
    finally:
        conn.close()


async def run_sandbox_batch(
    sandbox_id: int,
    date: str,
    asset_type: str,
    model: str,
    offset: int,
    batch_size: int,
    repo_url: str,
    semaphore: asyncio.Semaphore
) -> Dict[str, Any]:
    """Run a single E2B sandbox for a batch of assets."""
    
    async with semaphore:
        start_time = time.time()
        logger.info(f"[Sandbox {sandbox_id}] Starting (offset={offset}, batch_size={batch_size})")
        
        try:
            # Create sandbox with longer timeout
            sandbox = await AsyncSandbox.create(timeout=1800)  # 30 min timeout
            
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
                
                # Run the batch script
                logger.info(f"[Sandbox {sandbox_id}] Running AI analysis batch...")
                cmd = f"""
                cd /home/user/stratos_brain && \
                export DATABASE_URL='{db_url}' && \
                export SUPABASE_DATABASE_URL='{db_url}' && \
                export GEMINI_API_KEY='{gemini_key}' && \
                python scripts/run_ai_analysis_batch.py \
                    --date {date} \
                    --asset-type {asset_type} \
                    --model {model} \
                    --offset {offset} \
                    --batch-size {batch_size}
                """
                
                result = await sandbox.commands.run(cmd, timeout=1800)
                
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
    
    # Get total asset count
    total_assets = get_total_asset_count(args.asset_type)
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
    
    # Semaphore to limit concurrent sandboxes (E2B might have limits)
    semaphore = asyncio.Semaphore(args.max_concurrent)
    
    # Repository URL
    repo_url = "https://github.com/eli-nuss/stratos_brain.git"
    
    # Launch all sandboxes
    start_time = time.time()
    
    tasks = [
        run_sandbox_batch(
            sandbox_id=batch["sandbox_id"],
            date=args.date,
            asset_type=args.asset_type,
            model=args.model,
            offset=batch["offset"],
            batch_size=batch["batch_size"],
            repo_url=repo_url,
            semaphore=semaphore,
        )
        for batch in batches
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
            logger.error(f"Sandbox {r['sandbox_id']} ({r['status']}): {r.get('error', r.get('stderr', 'Unknown'))[:500]}")
    
    # Exit with error if too many failures
    if success_count < len(batches) * 0.8:
        logger.error("Too many sandbox failures (>20%)")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Orchestrate parallel E2B sandboxes for AI analysis')
    parser.add_argument('--date', type=str, required=True,
                        help='Target date (YYYY-MM-DD)')
    parser.add_argument('--asset-type', type=str, choices=['crypto', 'equity', 'all'], default='equity',
                        help='Asset type to process')
    parser.add_argument('--model', type=str, default='gemini-3-flash-preview',
                        help='Gemini model to use')
    parser.add_argument('--sandboxes', type=int, default=50,
                        help='Number of E2B sandboxes to spawn')
    parser.add_argument('--max-concurrent', type=int, default=50,
                        help='Maximum concurrent sandboxes')
    
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("E2B PARALLEL ORCHESTRATOR")
    logger.info(f"  Date: {args.date}")
    logger.info(f"  Asset Type: {args.asset_type}")
    logger.info(f"  Model: {args.model}")
    logger.info(f"  Target Sandboxes: {args.sandboxes}")
    logger.info(f"  Max Concurrent: {args.max_concurrent}")
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

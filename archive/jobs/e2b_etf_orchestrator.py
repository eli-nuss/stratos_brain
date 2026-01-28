#!/usr/bin/env python3
"""
E2B Parallel Orchestrator for ETF/Index/Commodity AI Analysis.

Spawns multiple E2B sandboxes to process ETFs, Indices, and Commodities in parallel.
Each sandbox handles a batch of assets.

Usage:
    python e2b_etf_orchestrator.py --date 2026-01-27 --sandboxes 10
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


# Asset types to process
ASSET_TYPES = ('etf', 'index', 'commodity')


def get_asset_count() -> int:
    """Get total count of active ETF/Index/Commodity assets."""
    import psycopg2
    
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM assets WHERE asset_type = ANY(%s) AND is_active = TRUE", (list(ASSET_TYPES),))
            return cur.fetchone()[0]
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
            # Create sandbox with timeout
            sandbox = await AsyncSandbox.create(timeout=10800)  # 3 hour timeout
            
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
                
                result = await sandbox.commands.run(cmd, timeout=10800)
                
                elapsed = time.time() - start_time
                
                if result.exit_code == 0:
                    logger.info(f"[Sandbox {sandbox_id}] ✓ Completed in {elapsed:.1f}s")
                    return {
                        "sandbox_id": sandbox_id,
                        "status": "success",
                        "offset": offset,
                        "batch_size": batch_size,
                        "elapsed_seconds": elapsed,
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
    total_assets = get_asset_count()
    logger.info(f"Total ETF/Index/Commodity assets to process: {total_assets}")
    
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
            semaphore=semaphore
        )
    
    # Launch all batches with staggered delays
    tasks = []
    for i, batch in enumerate(batches):
        delay = i * stagger_delay
        task = asyncio.create_task(launch_with_delay(batch, delay))
        tasks.append(task)
    
    logger.info(f"Launched {len(tasks)} tasks with {stagger_delay}s stagger")
    
    # Wait for all to complete
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    total_elapsed = sum(r["elapsed_seconds"] for r in results if isinstance(r, dict))
    success_count = sum(1 for r in results if isinstance(r, dict) and r["status"] == "success")
    error_count = sum(1 for r in results if isinstance(r, dict) and r["status"] != "success")
    
    logger.info("=" * 60)
    logger.info("ETF/INDEX/COMMODITY PARALLEL PROCESSING COMPLETE")
    logger.info("=" * 60)
    logger.info(f"Total assets: {total_assets}")
    logger.info(f"Sandboxes: {num_sandboxes}")
    logger.info(f"Successful: {success_count}")
    logger.info(f"Failed: {error_count}")
    logger.info(f"Total time: {total_elapsed:.1f}s")
    logger.info("=" * 60)
    
    # Exit with error if any failed
    if error_count > 0:
        logger.error(f"{error_count} sandboxes failed")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='E2B Parallel Orchestrator for ETF/Index/Commodity')
    parser.add_argument('--date', type=str, required=True, help='Target date (YYYY-MM-DD)')
    parser.add_argument('--model', type=str, default='gemini-3-flash-preview', help='Gemini model')
    parser.add_argument('--sandboxes', type=int, default=10, help='Number of sandboxes')
    parser.add_argument('--max-concurrent', type=int, default=10, help='Max concurrent sandboxes')
    parser.add_argument('--stagger-delay', type=int, default=2, help='Seconds between launches')
    
    args = parser.parse_args()
    
    # Run async main
    asyncio.run(main_async(args))


if __name__ == '__main__':
    main()

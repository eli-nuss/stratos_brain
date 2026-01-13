#!/usr/bin/env python3
"""
E2B FVS Runner - Runs FVS batch scoring in an E2B sandbox.

This script is called by GitHub Actions to spin up an E2B sandbox
and run the FVS batch scoring without GitHub's 6-hour time limit.

E2B Pro Tier allows up to 24 hours of sandbox runtime.
"""

import os
import sys
import time
import argparse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def run_fvs_in_e2b(
    limit: int = None,
    symbols: str = None,
    include_recent: bool = False,
    refresh: bool = False,
    timeout_hours: int = 8
):
    """
    Spin up an E2B sandbox and run FVS batch scoring.
    
    Args:
        limit: Maximum number of equities to process
        symbols: Space-separated list of specific symbols
        include_recent: Include recently scored symbols
        refresh: Force refresh all scores
        timeout_hours: Sandbox timeout in hours (max 24 for Pro)
    """
    try:
        from e2b_code_interpreter import Sandbox
    except ImportError:
        logger.error("e2b-code-interpreter not installed. Run: pip install e2b-code-interpreter")
        sys.exit(1)
    
    # Get required environment variables
    e2b_api_key = os.environ.get('E2B_API_KEY')
    if not e2b_api_key:
        logger.error("E2B_API_KEY environment variable not set")
        sys.exit(1)
    
    db_password = os.environ.get('DB_PASSWORD')
    supabase_url = os.environ.get('SUPABASE_URL', 'https://wfogbaipiqootjrsprde.supabase.co')
    
    if not db_password:
        logger.error("DB_PASSWORD environment variable not set")
        sys.exit(1)
    
    # Calculate timeout in seconds (max 24 hours for Pro)
    timeout_seconds = min(timeout_hours, 24) * 60 * 60
    
    logger.info(f"Creating E2B sandbox with {timeout_hours}h timeout...")
    
    # Create sandbox using the new API
    sandbox = Sandbox.create(timeout=timeout_seconds)
    sandbox_id = sandbox.sandbox_id
    logger.info(f"Sandbox created: {sandbox_id}")
    
    try:
        # Install required packages
        logger.info("Installing dependencies in sandbox...")
        sandbox.run_code("""
import subprocess
subprocess.run(['pip', 'install', 'psycopg2-binary', 'requests'], check=True, capture_output=True)
print("Dependencies installed successfully")
""")
        
        # Read the batch scoring script
        script_path = os.path.join(os.path.dirname(__file__), 'fvs_batch_scoring.py')
        with open(script_path, 'r') as f:
            batch_script = f.read()
        
        # Upload the script to the sandbox
        logger.info("Uploading FVS batch scoring script...")
        sandbox.files.write('/home/user/fvs_batch_scoring.py', batch_script)
        
        # Build the command arguments
        cmd_args = []
        if limit:
            cmd_args.append(f'--limit {limit}')
        if symbols:
            cmd_args.append(f'--symbols "{symbols}"')
        if include_recent:
            cmd_args.append('--include-recent')
        if refresh:
            cmd_args.append('--refresh')
        
        args_str = ' '.join(cmd_args)
        
        # Create the runner code
        runner_code = f'''
import os
import subprocess
import sys

# Set environment variables
os.environ['DB_HOST'] = 'db.wfogbaipiqootjrsprde.supabase.co'
os.environ['DB_PORT'] = '5432'
os.environ['DB_NAME'] = 'postgres'
os.environ['DB_USER'] = 'postgres'
os.environ['DB_PASSWORD'] = '{db_password}'
os.environ['SUPABASE_URL'] = '{supabase_url}'

# Run the batch scoring script
cmd = f'python /home/user/fvs_batch_scoring.py {args_str}'
print(f"Running: {{cmd}}")
print("=" * 60)

result = subprocess.run(
    cmd,
    shell=True,
    capture_output=False,
    text=True
)

print("=" * 60)
print(f"Exit code: {{result.returncode}}")
'''
        
        logger.info(f"Starting FVS batch scoring...")
        logger.info(f"Arguments: {args_str or '(none)'}")
        
        # Run the scoring
        start_time = time.time()
        execution = sandbox.run_code(runner_code)
        elapsed = time.time() - start_time
        
        # Print output
        if execution.logs.stdout:
            for line in execution.logs.stdout:
                print(line)
        
        if execution.logs.stderr:
            for line in execution.logs.stderr:
                print(f"STDERR: {line}", file=sys.stderr)
        
        if execution.error:
            logger.error(f"Execution error: {execution.error}")
            sys.exit(1)
        
        logger.info(f"FVS scoring completed in {elapsed/60:.1f} minutes")
        
    except Exception as e:
        logger.error(f"Error during execution: {e}")
        raise
    finally:
        # Always kill the sandbox to avoid charges
        logger.info(f"Shutting down sandbox {sandbox_id}...")
        sandbox.kill()
        logger.info("Sandbox terminated")


def main():
    parser = argparse.ArgumentParser(
        description='Run FVS batch scoring in E2B sandbox'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Maximum number of equities to process'
    )
    parser.add_argument(
        '--symbols',
        type=str,
        help='Space-separated list of specific symbols to process'
    )
    parser.add_argument(
        '--include-recent',
        action='store_true',
        help='Include recently scored symbols'
    )
    parser.add_argument(
        '--refresh',
        action='store_true',
        help='Force refresh all scores'
    )
    parser.add_argument(
        '--timeout-hours',
        type=int,
        default=8,
        help='Sandbox timeout in hours (default: 8, max: 24)'
    )
    
    args = parser.parse_args()
    
    run_fvs_in_e2b(
        limit=args.limit,
        symbols=args.symbols,
        include_recent=args.include_recent,
        refresh=args.refresh,
        timeout_hours=args.timeout_hours
    )


if __name__ == '__main__':
    main()

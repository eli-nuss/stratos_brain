"""Worker process that consumes jobs from pgmq queue."""

import json
import signal
import sys
import time
import threading
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from uuid import uuid4

import structlog

from .config import config
from .db import db, queue
from .stages import Stage1Evaluate, Stage2AI, Stage3State, Stage1Fetch
from .stages.stage4_scoring import Stage4Scoring
from .stages.stage5_ai_review import Stage5AIReview
from .utils.logging import setup_logging
from .utils.freshness import FreshnessCheck

logger = structlog.get_logger()


class Worker:
    """Signal engine worker that processes jobs from pgmq."""
    
    def __init__(self):
        self.running = True
        self.current_job_id = None
        self.heartbeat_thread = None
        self.freshness = FreshnessCheck(db)
        
        # Set up signal handlers
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
    
    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info("shutdown_requested", signal=signum)
        self.running = False
    
    def _heartbeat_loop(self, job_id: str):
        """Background thread to update job heartbeat."""
        logger.info("heartbeat_started", job_id=job_id)
        while self.running and self.current_job_id == job_id:
            try:
                query = """
                UPDATE engine_jobs
                SET last_heartbeat_at = NOW(),
                    lease_expires_at = NOW() + INTERVAL '5 minutes'
                WHERE job_id = %s
                """
                db.execute(query, (job_id,))
                time.sleep(60)  # Heartbeat every minute
            except Exception as e:
                logger.error("heartbeat_failed", job_id=job_id, error=str(e))
                time.sleep(10)
    
    def start_pipeline_run(self, job: Dict[str, Any]) -> str:
        """Record pipeline run start in database."""
        run_id = str(uuid4())
        job_id = job.get("job_id")
        
        query = """
        INSERT INTO pipeline_runs 
            (run_id, job_id, started_at, as_of_date, status)
        VALUES (%s, %s, NOW(), %s, 'running')
        """
        
        db.execute(query, (
            run_id,
            job_id,
            job.get("as_of_date"),
        ))
        
        return run_id
    
    def complete_pipeline_run(
        self,
        run_id: str,
        status: str,
        counts: Dict[str, Any],
        error: Optional[str] = None
    ) -> None:
        """Record pipeline run completion."""
        query = """
        UPDATE pipeline_runs
        SET ended_at = NOW(),
            status = %s,
            counts = %s,
            error_text = %s
        WHERE run_id = %s
        """
        
        db.execute(query, (status, json.dumps(counts), error, run_id))
    
    def claim_job(self, job_id: str) -> bool:
        """Atomically claim a job and update attempt count."""
        try:
            query = """
            UPDATE engine_jobs
            SET status = 'running',
                started_at = COALESCE(started_at, NOW()),
                attempt_count = COALESCE(attempt_count, 0) + 1,
                last_heartbeat_at = NOW(),
                lease_expires_at = NOW() + INTERVAL '10 minutes'
            WHERE job_id = %s
              AND (
                status = 'queued'
                OR (status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < NOW())
              )
            RETURNING attempt_count
            """
            result = db.fetch_one(query, (job_id,))
            if result:
                logger.info("job_claimed", job_id=job_id, attempt=result['attempt_count'])
                return True
            return False
        except Exception as e:
            logger.error("claim_failed", job_id=job_id, error=str(e))
            return False

    def process_job(self, job: Dict[str, Any], job_id: Optional[str] = None) -> Dict[str, Any]:
        """Process a single job from the queue."""
        job_type = job.get("job_type", "daily_run")
        as_of_date = job.get("as_of_date", datetime.now().strftime("%Y-%m-%d"))
        universe_id = job.get("universe_id", "equities_all")
        config_id = job.get("config_id")
        
        logger.info("job_started", job_type=job_type, date=as_of_date, universe=universe_id)
        
        # Start heartbeat if we have a job_id (from engine_jobs table)
        if job_id:
            self.current_job_id = job_id
            self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, args=(job_id,))
            self.heartbeat_thread.daemon = True
            self.heartbeat_thread.start()
        
        # Start pipeline run record
        run_id = self.start_pipeline_run(job)
        
        try:
            results = {}
            
            # Freshness Check (only for full pipeline or evaluation)
            if job_type in ("daily_run", "evaluate"):
                passed, stats = self.freshness.check_coverage(as_of_date, universe_id)
                results["freshness"] = stats
                
                if not passed:
                    raise ValueError(f"Insufficient feature coverage: {stats['actual']}/{stats['expected']} ({stats['coverage']:.1%})")

            # Stage 1: Fetch & Evaluate
            if job_type in ("daily_run", "stage1_only", "evaluate"):
                # Fetch data first
                stage1_fetch = Stage1Fetch(db)
                results["stage1_fetch"] = stage1_fetch.run(as_of_date, universe_id, config_id)
                
                # Then evaluate
                stage1 = Stage1Evaluate(db)
                results["stage1"] = stage1.run(as_of_date, universe_id, config_id)
            
            # Stage 3: State Machine (before AI to create instances)
            if job_type in ("daily_run", "stage3_only", "state"):
                stage3 = Stage3State(db)
                results["stage3"] = stage3.run(as_of_date, config_id)

            # Stage 4: Scoring (after signals are generated)
            if job_type in ("daily_run", "stage4_only", "scoring"):
                stage4 = Stage4Scoring(db)
                results["stage4"] = stage4.run(as_of_date, universe_id, config_id)

            # Stage 5: AI Review (for top assets)
            if job_type in ("daily_run", "stage5_only", "ai_review") and config.engine.enable_ai_stage:
                stage5 = Stage5AIReview(db)
                results["stage5"] = stage5.run(as_of_date, config_id)
            
            # Stage 2: AI Analysis (optional)
            if job_type in ("daily_run", "stage2_only", "ai") and config.engine.enable_ai_stage:
                stage2 = Stage2AI(db)
                results["stage2"] = stage2.run(
                    as_of_date,
                    min_strength=job.get("ai_min_strength", 60),
                    budget=job.get("ai_budget", config.engine.ai_budget_per_run),
                    config_id=config_id,
                )
            
            # Complete pipeline run
            self.complete_pipeline_run(run_id, "success", results)
            
            logger.info("job_completed", run_id=run_id, results=results)
            return {"status": "success", "run_id": run_id, "results": results}
            
        except Exception as e:
            logger.error("job_failed", run_id=run_id, error=str(e))
            self.complete_pipeline_run(run_id, "failed", {}, str(e))
            raise
        finally:
            # Stop heartbeat
            self.current_job_id = None
            if self.heartbeat_thread:
                self.heartbeat_thread.join(timeout=1.0)
    
    def poll_and_process(self) -> bool:
        """Poll queue for a job and process it."""
        try:
            messages = queue.read(
                visibility_timeout=config.worker.visibility_timeout,
                limit=1
            )
            
            if not messages:
                return False
            
            msg = messages[0]
            msg_id = msg.get("msg_id")
            job = msg.get("message", {})
            
            if isinstance(job, str):
                job = json.loads(job)
            
            # Extract job_id if it exists in the payload (it should be injected by enqueue_engine_job)
            job_id = job.get("job_id")
            
            logger.info("job_received", msg_id=msg_id, job_id=job_id)
            
            # If we have a job_id, try to claim it in engine_jobs
            if job_id:
                if not self.claim_job(job_id):
                    logger.warning("job_claim_failed_skipping", job_id=job_id)
                    # If we can't claim it, it might be processed by another worker or max retries reached
                    # We archive it from the queue to stop processing
                    queue.archive(msg_id)
                    return True

            try:
                self.process_job(job, job_id)
                
                # Mark as success in engine_jobs
                if job_id:
                    db.execute("UPDATE engine_jobs SET status = 'success', ended_at = NOW() WHERE job_id = %s", (job_id,))
                
                queue.archive(msg_id)
                logger.info("job_archived", msg_id=msg_id)
                
            except Exception as e:
                logger.error("job_processing_failed", msg_id=msg_id, error=str(e))
                
                # Check if we should retry
                should_retry = True
                if "Insufficient feature coverage" in str(e):
                    should_retry = False
                
                if job_id:
                    # Get current attempt count
                    job_status = db.fetch_one("SELECT attempt_count FROM engine_jobs WHERE job_id = %s", (job_id,))
                    attempt_count = job_status['attempt_count'] if job_status else 0
                    
                    if should_retry and attempt_count < 3: # Max 3 retries
                        # Reset status to queued for retry
                        db.execute("UPDATE engine_jobs SET status = 'queued', error_text = %s WHERE job_id = %s", (str(e), job_id))
                        logger.info("job_scheduled_for_retry", job_id=job_id, attempt=attempt_count)
                    else:
                        # Mark as permanently failed
                        db.execute("UPDATE engine_jobs SET status = 'failed', error_text = %s WHERE job_id = %s", (str(e), job_id))
                        queue.archive(msg_id) # Archive from queue to stop processing
                        logger.error("job_permanently_failed", job_id=job_id, attempt=attempt_count)
                        should_retry = False # Don't raise to outer loop if archived

                if should_retry:
                    # We do NOT archive here, so it becomes visible again after timeout (retry)
                    pass
                else:
                    # Already archived above if permanent failure
                    pass
                
                raise
            
            return True
            
        except Exception as e:
            logger.error("poll_error", error=str(e))
            return False
    
    def run(self) -> None:
        """Main worker loop."""
        logger.info("worker_started", 
                   poll_interval=config.worker.poll_interval,
                   queue=config.worker.queue_name)
        
        while self.running:
            processed = self.poll_and_process()
            
            if not processed:
                # No job found, sleep before next poll
                time.sleep(config.worker.poll_interval)
        
        logger.info("worker_stopped")
        db.close()


def main():
    """Entry point for the worker."""
    setup_logging(config.log.level, config.log.format)
    
    logger.info("starting_stratos_engine_worker", version="0.3.5")
    
    worker = Worker()
    worker.run()


if __name__ == "__main__":
    main()

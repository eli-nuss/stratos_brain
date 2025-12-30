"""Worker process that consumes jobs from pgmq queue."""

import json
import signal
import sys
import time
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

import structlog

from .config import config
from .db import db, queue
from .stages import Stage1Evaluate, Stage2AI, Stage3State
from .utils.logging import setup_logging

logger = structlog.get_logger()


class Worker:
    """Signal engine worker that processes jobs from pgmq."""
    
    def __init__(self):
        self.running = True
        self.current_job = None
        
        # Set up signal handlers
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
    
    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info("shutdown_requested", signal=signum)
        self.running = False
    
    def start_pipeline_run(self, job: Dict[str, Any]) -> str:
        """Record pipeline run start in database."""
        run_id = str(uuid4())
        
        query = """
        INSERT INTO pipeline_runs 
            (run_id, started_at, as_of_date, status, job_payload, config_id)
        VALUES (%s, NOW(), %s, 'running', %s, %s)
        """
        
        db.execute(query, (
            run_id,
            job.get("as_of_date"),
            json.dumps(job),
            job.get("config_id"),
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
            counts_json = %s,
            error_message = %s
        WHERE run_id = %s
        """
        
        db.execute(query, (status, json.dumps(counts), error, run_id))
    
    def process_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single job from the queue."""
        job_type = job.get("job_type", "full_pipeline")
        as_of_date = job.get("as_of_date", datetime.now().strftime("%Y-%m-%d"))
        universe_id = job.get("universe_id", "equities_all")
        config_id = job.get("config_id")
        
        logger.info("job_started", job_type=job_type, date=as_of_date, universe=universe_id)
        
        # Start pipeline run record
        run_id = self.start_pipeline_run(job)
        
        try:
            results = {}
            
            # Stage 1: Evaluate
            if job_type in ("full_pipeline", "stage1_only", "evaluate"):
                stage1 = Stage1Evaluate(db)
                results["stage1"] = stage1.run(as_of_date, universe_id, config_id)
            
            # Stage 3: State Machine (before AI to create instances)
            if job_type in ("full_pipeline", "stage3_only", "state"):
                stage3 = Stage3State(db)
                results["stage3"] = stage3.run(as_of_date, config_id)
            
            # Stage 2: AI Analysis (optional)
            if job_type in ("full_pipeline", "stage2_only", "ai") and config.engine.enable_ai_stage:
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
            
            self.current_job = job
            logger.info("job_received", msg_id=msg_id, job=job)
            
            try:
                self.process_job(job)
                queue.archive(msg_id)
                logger.info("job_archived", msg_id=msg_id)
            except Exception as e:
                logger.error("job_processing_failed", msg_id=msg_id, error=str(e))
                # Message will become visible again after visibility timeout
                raise
            finally:
                self.current_job = None
            
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
    
    logger.info("starting_stratos_engine_worker", version="0.3.2")
    
    worker = Worker()
    worker.run()


if __name__ == "__main__":
    main()

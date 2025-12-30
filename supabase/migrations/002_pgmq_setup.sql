-- Part 2 & 3: pgmq Queue Setup + enqueue_engine_job Function
-- Creates the message queue and single entry point for job submission

-- Enable pgmq extension (must be enabled in Supabase Dashboard first)
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create the queue (lowercase, underscores allowed)
SELECT pgmq.create('signal_engine_jobs');

-- Part 3: enqueue_engine_job function
-- Single entry point that inserts idempotent job row + enqueues pgmq message
CREATE OR REPLACE FUNCTION public.enqueue_engine_job(
  p_job_type TEXT,
  p_config_id UUID,
  p_universe_id TEXT,
  p_as_of_date DATE,
  p_date_start DATE DEFAULT NULL,
  p_date_end DATE DEFAULT NULL,
  p_run_ai BOOLEAN DEFAULT true,
  p_requested_by TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_hash TEXT;
  v_job_id UUID;
  v_payload JSONB;
BEGIN
  -- Compute request hash for idempotency
  v_request_hash := encode(
    digest(
      coalesce(p_job_type,'') || '|' ||
      coalesce(p_config_id::text,'') || '|' ||
      coalesce(p_universe_id,'') || '|' ||
      coalesce(p_as_of_date::text,'') || '|' ||
      coalesce(p_date_start::text,'') || '|' ||
      coalesce(p_date_end::text,'') || '|' ||
      coalesce(p_run_ai::text,''),
      'sha256'
    ),
    'hex'
  );

  -- Insert job (on conflict return existing)
  INSERT INTO public.engine_jobs (
    job_type, config_id, universe_id, as_of_date, date_start, date_end, run_ai,
    status, requested_by, request_hash
  )
  VALUES (
    p_job_type, p_config_id, p_universe_id, p_as_of_date, p_date_start, p_date_end, p_run_ai,
    'queued', p_requested_by, v_request_hash
  )
  ON CONFLICT (request_hash) DO UPDATE SET request_hash = excluded.request_hash
  RETURNING job_id INTO v_job_id;

  -- Build payload for queue message
  v_payload := jsonb_build_object(
    'job_id', v_job_id,
    'job_type', p_job_type,
    'config_id', p_config_id,
    'universe_id', p_universe_id,
    'as_of_date', p_as_of_date,
    'date_start', p_date_start,
    'date_end', p_date_end,
    'run_ai', p_run_ai
  );

  -- Enqueue message
  PERFORM pgmq.send('signal_engine_jobs', v_payload);

  RETURN v_job_id;
END;
$$;

-- Helper function to get queue depth
CREATE OR REPLACE FUNCTION public.get_queue_depth()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT COUNT(*)::INTEGER 
  FROM pgmq.q_signal_engine_jobs 
  WHERE vt <= NOW();
$$;

-- View for job status monitoring
CREATE OR REPLACE VIEW public.v_job_status AS
SELECT 
  j.job_id,
  j.job_type,
  j.universe_id,
  j.as_of_date,
  j.status,
  j.created_at,
  j.started_at,
  j.ended_at,
  EXTRACT(EPOCH FROM (j.ended_at - j.started_at))::INTEGER AS duration_seconds,
  j.error_text,
  j.metrics,
  c.name AS config_name,
  c.base_template_version
FROM public.engine_jobs j
LEFT JOIN public.engine_configs c ON j.config_id = c.config_id
ORDER BY j.created_at DESC;

-- View for recent pipeline runs
CREATE OR REPLACE VIEW public.v_recent_runs AS
SELECT 
  r.run_id,
  r.job_id,
  r.as_of_date,
  r.status,
  r.started_at,
  r.ended_at,
  EXTRACT(EPOCH FROM (r.ended_at - r.started_at))::INTEGER AS duration_seconds,
  r.counts,
  r.error_text,
  r.git_sha,
  r.template_version,
  j.job_type,
  j.universe_id,
  c.name AS config_name
FROM public.pipeline_runs r
LEFT JOIN public.engine_jobs j ON r.job_id = j.job_id
LEFT JOIN public.engine_configs c ON j.config_id = c.config_id
ORDER BY r.started_at DESC
LIMIT 100;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.enqueue_engine_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_queue_depth TO authenticated;

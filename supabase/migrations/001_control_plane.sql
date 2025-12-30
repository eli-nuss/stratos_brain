-- Part 1: Control Plane Tables
-- Creates engine_configs, engine_jobs, pipeline_runs with proper indexes

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Engine Configs: versioned, never overwrite
CREATE TABLE IF NOT EXISTS public.engine_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_template_version TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  config_hash TEXT
);

-- Engine Jobs: queued/running/success/failed
CREATE TABLE IF NOT EXISTS public.engine_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- daily_run | recompute_scores | run_ai
  config_id UUID REFERENCES public.engine_configs(config_id),
  universe_id TEXT NOT NULL,
  as_of_date DATE,
  date_start DATE,
  date_end DATE,
  run_ai BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'queued', -- queued|running|success|failed|canceled
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  error_text TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_hash TEXT
);

-- Indexes for engine_jobs
CREATE INDEX IF NOT EXISTS idx_engine_jobs_status_created
  ON public.engine_jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engine_jobs_config_asof
  ON public.engine_jobs(config_id, as_of_date);

CREATE INDEX IF NOT EXISTS idx_engine_jobs_universe_asof
  ON public.engine_jobs(universe_id, as_of_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_engine_jobs_request_hash
  ON public.engine_jobs(request_hash)
  WHERE request_hash IS NOT NULL;

-- Pipeline Runs: audit trail
CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.engine_jobs(job_id),
  as_of_date DATE,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  git_sha TEXT,
  template_version TEXT,
  feature_version TEXT,
  prompt_version TEXT,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_text TEXT
);

-- Index for pipeline_runs
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_job_id
  ON public.pipeline_runs(job_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_date_status
  ON public.pipeline_runs(as_of_date DESC, status);

-- Insert default config if none exists
INSERT INTO public.engine_configs (name, description, base_template_version, is_active)
SELECT 'default', 'Default production configuration', 'v32', true
WHERE NOT EXISTS (SELECT 1 FROM public.engine_configs WHERE is_active = true);

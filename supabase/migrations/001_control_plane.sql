-- Control Plane Tables for Stratos Signal Engine
-- This migration creates the tables needed for job management and configuration

-- Engine Configurations Table
-- Stores different engine configurations that can be toggled from the dashboard
CREATE TABLE IF NOT EXISTS engine_configs (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Universe settings
    universe_id VARCHAR(50) DEFAULT 'equities_all',
    
    -- Template overrides (JSONB allows per-template threshold adjustments)
    template_overrides JSONB DEFAULT '{}',
    
    -- Global thresholds
    min_strength_for_ai NUMERIC DEFAULT 60,
    ai_budget_per_run INTEGER DEFAULT 50,
    
    -- Feature flags
    enable_ai_stage BOOLEAN DEFAULT true,
    enable_notifications BOOLEAN DEFAULT false,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Engine Jobs Table
-- Tracks scheduled and ad-hoc job requests
CREATE TABLE IF NOT EXISTS engine_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES engine_configs(config_id),
    
    -- Job specification
    job_type VARCHAR(50) NOT NULL DEFAULT 'full_pipeline',
    as_of_date DATE NOT NULL,
    universe_id VARCHAR(50),
    
    -- Job parameters
    params JSONB DEFAULT '{}',
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    priority INTEGER DEFAULT 0,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending',
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    CONSTRAINT valid_job_type CHECK (job_type IN (
        'full_pipeline', 'stage1_only', 'stage2_only', 'stage3_only',
        'evaluate', 'ai', 'state', 'backfill'
    )),
    CONSTRAINT valid_status CHECK (status IN (
        'pending', 'queued', 'running', 'success', 'failed', 'cancelled'
    ))
);

-- Pipeline Runs Table
-- Detailed execution log for each pipeline run
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES engine_jobs(job_id),
    config_id UUID REFERENCES engine_configs(config_id),
    
    -- Execution details
    as_of_date DATE NOT NULL,
    job_payload JSONB,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'running',
    
    -- Results
    counts_json JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Versioning
    git_sha VARCHAR(40),
    template_version VARCHAR(20),
    feature_version VARCHAR(20),
    
    CONSTRAINT valid_run_status CHECK (status IN ('running', 'success', 'failed'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_engine_jobs_status ON engine_jobs(status);
CREATE INDEX IF NOT EXISTS idx_engine_jobs_scheduled ON engine_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_date ON pipeline_runs(as_of_date);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);

-- Update trigger for engine_configs
CREATE OR REPLACE FUNCTION update_engine_configs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS engine_configs_updated ON engine_configs;
CREATE TRIGGER engine_configs_updated
    BEFORE UPDATE ON engine_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_engine_configs_timestamp();

-- Insert default configuration
INSERT INTO engine_configs (name, description, universe_id)
VALUES ('default', 'Default signal engine configuration', 'equities_all')
ON CONFLICT (name) DO NOTHING;

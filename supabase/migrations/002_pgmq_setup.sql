-- pgmq Queue Setup for Stratos Signal Engine
-- Requires pgmq extension to be enabled in Supabase dashboard

-- Create the queue (idempotent)
SELECT pgmq.create('signal_engine_jobs');

-- Function to enqueue a job
-- This is called by pg_cron or the Control API
CREATE OR REPLACE FUNCTION enqueue_engine_job(
    p_job_type VARCHAR DEFAULT 'full_pipeline',
    p_as_of_date DATE DEFAULT CURRENT_DATE,
    p_universe_id VARCHAR DEFAULT NULL,
    p_config_id UUID DEFAULT NULL,
    p_params JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_config engine_configs%ROWTYPE;
    v_message JSONB;
BEGIN
    -- Get config if specified, otherwise use default
    IF p_config_id IS NOT NULL THEN
        SELECT * INTO v_config FROM engine_configs WHERE config_id = p_config_id;
    ELSE
        SELECT * INTO v_config FROM engine_configs WHERE name = 'default';
    END IF;
    
    -- Create job record
    INSERT INTO engine_jobs (
        config_id,
        job_type,
        as_of_date,
        universe_id,
        params,
        status,
        queued_at
    ) VALUES (
        v_config.config_id,
        p_job_type,
        p_as_of_date,
        COALESCE(p_universe_id, v_config.universe_id),
        p_params,
        'queued',
        NOW()
    )
    RETURNING job_id INTO v_job_id;
    
    -- Build message payload
    v_message := jsonb_build_object(
        'job_id', v_job_id,
        'job_type', p_job_type,
        'as_of_date', p_as_of_date,
        'universe_id', COALESCE(p_universe_id, v_config.universe_id),
        'config_id', v_config.config_id,
        'ai_min_strength', v_config.min_strength_for_ai,
        'ai_budget', v_config.ai_budget_per_run,
        'enable_ai', v_config.enable_ai_stage,
        'template_overrides', v_config.template_overrides,
        'params', p_params
    );
    
    -- Send to queue
    PERFORM pgmq.send('signal_engine_jobs', v_message);
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get queue depth (for monitoring)
CREATE OR REPLACE FUNCTION get_queue_depth()
RETURNS INTEGER AS $$
DECLARE
    v_depth INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_depth
    FROM pgmq.q_signal_engine_jobs
    WHERE vt <= NOW();
    
    RETURN v_depth;
END;
$$ LANGUAGE plpgsql;

-- pg_cron job to run daily pipeline at 6:30 AM ET (11:30 UTC)
-- Note: This requires pg_cron extension enabled in Supabase
-- Uncomment after enabling pg_cron in your Supabase project

-- SELECT cron.schedule(
--     'daily-signal-pipeline',
--     '30 11 * * 1-5',  -- 11:30 UTC = 6:30 AM ET, Mon-Fri
--     $$SELECT enqueue_engine_job('full_pipeline', CURRENT_DATE, 'equities_all')$$
-- );

-- pg_cron job for crypto (runs 24/7)
-- SELECT cron.schedule(
--     'daily-crypto-pipeline',
--     '0 12 * * *',  -- 12:00 UTC daily
--     $$SELECT enqueue_engine_job('full_pipeline', CURRENT_DATE, 'crypto_all')$$
-- );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION enqueue_engine_job TO authenticated;
GRANT EXECUTE ON FUNCTION get_queue_depth TO authenticated;

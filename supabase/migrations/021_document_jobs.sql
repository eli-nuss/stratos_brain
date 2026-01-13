-- Document Jobs Table for Async Document Generation
-- This tracks long-running document generation tasks (Deep Research, Memo, One Pager, Cascade)

-- Create job status enum
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the document_jobs table
CREATE TABLE IF NOT EXISTS document_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  asset_id BIGINT REFERENCES assets(asset_id),
  symbol TEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'deep_research', 'memo', 'one_pager', 'all' (cascade)
  status job_status DEFAULT 'pending',
  progress TEXT, -- Current phase description for UI feedback
  result JSONB, -- Stores file URLs and metadata on completion
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_document_jobs_asset_id ON document_jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_document_jobs_user_id ON document_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_document_jobs_status ON document_jobs(status);
CREATE INDEX IF NOT EXISTS idx_document_jobs_created_at ON document_jobs(created_at DESC);

-- Enable realtime for live updates (optional but useful)
ALTER PUBLICATION supabase_realtime ADD TABLE document_jobs;

-- Enable RLS
ALTER TABLE document_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own jobs
CREATE POLICY "Users can view their own jobs"
  ON document_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own jobs
CREATE POLICY "Users can insert their own jobs"
  ON document_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access"
  ON document_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Allow anon/public to view jobs (for unauthenticated polling)
-- This is needed because the frontend may poll without auth
CREATE POLICY "Public can view jobs by id"
  ON document_jobs FOR SELECT
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_document_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_document_jobs_updated_at ON document_jobs;
CREATE TRIGGER trigger_document_jobs_updated_at
  BEFORE UPDATE ON document_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_document_jobs_updated_at();

-- Comment on table
COMMENT ON TABLE document_jobs IS 'Tracks async document generation jobs (Deep Research, Memo, One Pager, Cascade)';
